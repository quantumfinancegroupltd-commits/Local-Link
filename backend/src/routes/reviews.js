import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'

export const reviewsRouter = Router()

const PublicReviewsQuerySchema = z.object({
  limit: z
    .preprocess((v) => (v == null ? 10 : Number(v)), z.number().int().min(1).max(50))
    .optional(),
})

const LeaveReviewSchema = z.object({
  rating: z.number().min(1).max(5),
  comment: z.string().max(2000).optional().nullable(),
})

async function updateUserRating(targetId) {
  const r = await pool.query(`select coalesce(avg(rating),0) as avg, count(*)::int as cnt from reviews where target_id = $1`, [
    targetId,
  ])
  const avg = Number(r.rows[0]?.avg ?? 0)
  // store with 1 decimal
  const rounded = Math.round(avg * 10) / 10
  await pool.query(`update users set rating = $2, updated_at = now() where id = $1`, [targetId, rounded])
  return { avg: rounded, count: Number(r.rows[0]?.cnt ?? 0) }
}

reviewsRouter.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const r = await pool.query(
    `select rv.*,
            u.name as reviewer_name,
            u.role as reviewer_role
     from reviews rv
     left join users u on u.id = rv.reviewer_id
     where rv.target_id = $1
     order by rv.created_at desc
     limit 200`,
    [req.user.sub],
  )
  return res.json(r.rows)
}))

reviewsRouter.get('/summary/me', requireAuth, asyncHandler(async (req, res) => {
  const r = await pool.query(`select coalesce(avg(rating),0) as avg, count(*)::int as cnt from reviews where target_id = $1`, [
    req.user.sub,
  ])
  const avg = Number(r.rows[0]?.avg ?? 0)
  return res.json({ avg: Math.round(avg * 10) / 10, count: Number(r.rows[0]?.cnt ?? 0) })
}))

// Public read-only reviews for a user profile (safe fields only)
reviewsRouter.get('/public/:userId', asyncHandler(async (req, res) => {
  const parsed = PublicReviewsQuerySchema.safeParse(req.query)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  // Only show reviews for active, non-deleted, non-suspended users.
  const userRes = await pool.query(
    `select id from users
     where id = $1
       and deleted_at is null
       and (suspended_until is null or suspended_until <= now())`,
    [req.params.userId],
  )
  if (!userRes.rows[0]) return res.status(404).json({ message: 'User not found' })

  const limit = Number(parsed.data.limit ?? 10)
  const r = await pool.query(
    `select rv.id, rv.rating, rv.comment, rv.job_id, rv.order_id, rv.created_at,
            u.name as reviewer_name,
            u.role as reviewer_role,
            u.profile_pic as reviewer_profile_pic
     from reviews rv
     left join users u on u.id = rv.reviewer_id
     where rv.target_id = $1
     order by rv.created_at desc
     limit $2`,
    [req.params.userId, limit],
  )

  return res.json(
    r.rows.map((row) => ({
      ...row,
      verified: !!(row.job_id || row.order_id),
    })),
  )
}))

// Eligibility helpers (used by UI to hide/disable "Leave review" until verified)
reviewsRouter.get('/jobs/:jobId/eligibility', requireAuth, requireRole(['buyer']), asyncHandler(async (req, res) => {
  const jobRes = await pool.query('select * from jobs where id = $1', [req.params.jobId])
  const job = jobRes.rows[0]
  if (!job) return res.status(404).json({ message: 'Job not found' })
  if (job.buyer_id !== req.user.sub) return res.status(403).json({ message: 'Forbidden' })
  if (!job.assigned_artisan_id) {
    return res.json({ eligible: false, reason: 'Job has no assigned artisan yet.', already_reviewed: false })
  }

  const artisanRes = await pool.query('select user_id from artisans where id = $1', [job.assigned_artisan_id])
  const artisanUserId = artisanRes.rows[0]?.user_id
  if (!artisanUserId) {
    return res.json({ eligible: false, reason: 'Artisan user not found.', already_reviewed: false })
  }

  const existing = await pool.query(`select id from reviews where job_id = $1 and reviewer_id = $2 limit 1`, [
    job.id,
    req.user.sub,
  ])
  if (existing.rows[0]) {
    return res.json({ eligible: false, reason: 'You already reviewed this job.', already_reviewed: true, target_user_id: artisanUserId })
  }

  const escrowRes = await pool.query(
    `select status from escrow_transactions where type='job' and job_id = $1 order by created_at desc limit 1`,
    [job.id],
  )
  const escrowStatus = escrowRes.rows[0]?.status
  if (escrowStatus !== 'released') {
    return res.json({
      eligible: false,
      reason: 'Review becomes available after escrow is released.',
      already_reviewed: false,
      target_user_id: artisanUserId,
      escrow_status: escrowStatus ?? null,
    })
  }

  return res.json({ eligible: true, reason: null, already_reviewed: false, target_user_id: artisanUserId })
}))

reviewsRouter.get('/orders/:orderId/eligibility', requireAuth, requireRole(['buyer']), asyncHandler(async (req, res) => {
  const TargetSchema = z.object({ target: z.enum(['farmer', 'driver']) })
  const parsed = TargetSchema.safeParse(req.query)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const orderRes = await pool.query(
    `select o.*, f.user_id as farmer_user_id
     from orders o
     left join farmers f on f.id = o.farmer_id
     where o.id = $1`,
    [req.params.orderId],
  )
  const order = orderRes.rows[0]
  if (!order) return res.status(404).json({ message: 'Order not found' })
  if (order.buyer_id !== req.user.sub) return res.status(403).json({ message: 'Forbidden' })

  const deliveryRes = await pool.query('select * from deliveries where order_id = $1', [order.id])
  const delivery = deliveryRes.rows[0]
  if (!delivery) return res.json({ eligible: false, reason: 'Delivery not found.', already_reviewed: false })
  if (delivery.status !== 'confirmed') {
    return res.json({
      eligible: false,
      reason: 'Review becomes available after delivery is confirmed.',
      already_reviewed: false,
      delivery_status: delivery.status,
    })
  }

  const targetId = parsed.data.target === 'driver' ? delivery.driver_user_id : order.farmer_user_id
  if (!targetId) return res.json({ eligible: false, reason: `${parsed.data.target} not available for this order.`, already_reviewed: false })

  const existing = await pool.query(
    `select id from reviews where order_id = $1 and reviewer_id = $2 and target_id = $3 limit 1`,
    [order.id, req.user.sub, targetId],
  )
  if (existing.rows[0]) {
    return res.json({ eligible: false, reason: 'You already reviewed this person for this order.', already_reviewed: true, target_user_id: targetId })
  }

  return res.json({ eligible: true, reason: null, already_reviewed: false, target_user_id: targetId })
}))

// Buyer reviews the assigned artisan for a job (after escrow released)
reviewsRouter.post('/jobs/:jobId', requireAuth, requireRole(['buyer']), asyncHandler(async (req, res) => {
  const parsed = LeaveReviewSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const jobRes = await pool.query('select * from jobs where id = $1', [req.params.jobId])
  const job = jobRes.rows[0]
  if (!job) return res.status(404).json({ message: 'Job not found' })
  if (job.buyer_id !== req.user.sub) return res.status(403).json({ message: 'Forbidden' })
  if (!job.assigned_artisan_id) return res.status(400).json({ message: 'Job has no assigned artisan' })

  const artisanRes = await pool.query('select user_id from artisans where id = $1', [job.assigned_artisan_id])
  const artisanUserId = artisanRes.rows[0]?.user_id
  if (!artisanUserId) return res.status(400).json({ message: 'Artisan user not found' })

  // Require escrow released (money settled)
  const escrowRes = await pool.query(
    `select status from escrow_transactions where type='job' and job_id = $1 order by created_at desc limit 1`,
    [job.id],
  )
  const escrowStatus = escrowRes.rows[0]?.status
  if (escrowStatus !== 'released') return res.status(400).json({ message: 'Review available after payout is released.' })

  try {
    const r = await pool.query(
      `insert into reviews (reviewer_id, target_id, rating, comment, job_id)
       values ($1,$2,$3,$4,$5)
       returning *`,
      [req.user.sub, artisanUserId, parsed.data.rating, parsed.data.comment ?? null, job.id],
    )
    const summary = await updateUserRating(artisanUserId)
    return res.status(201).json({ review: r.rows[0], summary })
  } catch (e) {
    if (String(e?.message || '').includes('duplicate key')) {
      return res.status(409).json({ message: 'You already reviewed this job.' })
    }
    throw e
  }
}))

// Buyer reviews farmer or driver after delivery confirmed
const OrderTargetSchema = z.object({
  target: z.enum(['farmer', 'driver']),
  rating: z.number().min(1).max(5),
  comment: z.string().max(2000).optional().nullable(),
})

reviewsRouter.post('/orders/:orderId', requireAuth, requireRole(['buyer']), asyncHandler(async (req, res) => {
  const parsed = OrderTargetSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const orderRes = await pool.query(
    `select o.*, f.user_id as farmer_user_id
     from orders o
     left join farmers f on f.id = o.farmer_id
     where o.id = $1`,
    [req.params.orderId],
  )
  const order = orderRes.rows[0]
  if (!order) return res.status(404).json({ message: 'Order not found' })
  if (order.buyer_id !== req.user.sub) return res.status(403).json({ message: 'Forbidden' })

  const deliveryRes = await pool.query('select * from deliveries where order_id = $1', [order.id])
  const delivery = deliveryRes.rows[0]
  if (!delivery) return res.status(400).json({ message: 'Delivery not found' })
  if (delivery.status !== 'confirmed') return res.status(400).json({ message: 'Review available after delivery is confirmed.' })

  const targetId = parsed.data.target === 'driver' ? delivery.driver_user_id : order.farmer_user_id
  if (!targetId) return res.status(400).json({ message: `${parsed.data.target} not available for this order.` })

  try {
    const r = await pool.query(
      `insert into reviews (reviewer_id, target_id, rating, comment, order_id)
       values ($1,$2,$3,$4,$5)
       returning *`,
      [req.user.sub, targetId, parsed.data.rating, parsed.data.comment ?? null, order.id],
    )
    const summary = await updateUserRating(targetId)
    return res.status(201).json({ review: r.rows[0], summary })
  } catch (e) {
    if (String(e?.message || '').includes('duplicate key')) {
      return res.status(409).json({ message: 'You already reviewed this person for this order.' })
    }
    throw e
  }
}))


