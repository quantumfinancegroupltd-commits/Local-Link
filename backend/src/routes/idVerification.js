import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'

export const idVerificationRouter = Router()

// User: Check their ID verification status
idVerificationRouter.get('/status', requireAuth, asyncHandler(async (req, res) => {
  const r = await pool.query(
    `select id, id_type, status, rejection_reason, created_at, reviewed_at
     from id_verifications
     where user_id = $1
     order by created_at desc
     limit 1`,
    [req.user.sub],
  )
  const latest = r.rows[0] ?? null
  
  // Get user's id_verified flag
  const userRes = await pool.query('select id_verified from users where id = $1', [req.user.sub])
  const idVerified = userRes.rows[0]?.id_verified ?? false
  
  return res.json({
    id_verified: idVerified,
    latest_request: latest,
  })
}))

// User: Submit ID verification (ID images + selfie)
function isAllowedUploadUrl(s) {
  const v = String(s || '').trim()
  if (!v) return false
  // Allow internal upload endpoints (public or private) and absolute URLs for future storage backends.
  if (v.startsWith('/api/uploads/')) return true
  if (v.startsWith('http://') || v.startsWith('https://')) return true
  return false
}

const SubmitSchema = z.object({
  id_type: z.enum(['ghana_card', 'passport', 'drivers_license']).default('ghana_card'),
  id_front_url: z.string().min(1).max(2000).refine(isAllowedUploadUrl, { message: 'Invalid id_front_url' }),
  id_back_url: z.string().min(1).max(2000).refine(isAllowedUploadUrl, { message: 'Invalid id_back_url' }).optional().nullable(),
  selfie_url: z.string().min(1).max(2000).refine(isAllowedUploadUrl, { message: 'Invalid selfie_url' }),
  extracted_data: z.object({
    name: z.string().optional(),
    id_number: z.string().optional(),
    dob: z.string().optional(),
  }).optional().nullable(),
})

idVerificationRouter.post('/submit', requireAuth, requireRole(['artisan', 'farmer', 'driver']), asyncHandler(async (req, res) => {
  const parsed = SubmitSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })
  }

  // Check if user already has a pending request
  const existing = await pool.query(
    `select id, status from id_verifications 
     where user_id = $1 and status = 'pending'`,
    [req.user.sub],
  )
  
  if (existing.rows.length > 0) {
    return res.status(400).json({ 
      message: 'You already have a pending verification request. Please wait for review.',
      request_id: existing.rows[0].id,
    })
  }

  // Check if already verified
  const userRes = await pool.query('select id_verified from users where id = $1', [req.user.sub])
  if (userRes.rows[0]?.id_verified) {
    return res.status(400).json({ message: 'Your account is already verified.' })
  }

  // Create verification request
  const r = await pool.query(
    `insert into id_verifications (
      user_id, id_type, id_front_url, id_back_url, selfie_url, 
      extracted_data, status, created_at, updated_at
    ) values ($1, $2, $3, $4, $5, $6, 'pending', now(), now())
     returning *`,
    [
      req.user.sub,
      parsed.data.id_type,
      parsed.data.id_front_url,
      parsed.data.id_back_url ?? null,
      parsed.data.selfie_url,
      parsed.data.extracted_data ? JSON.stringify(parsed.data.extracted_data) : null,
    ],
  )

  return res.status(201).json(r.rows[0])
}))

// Admin: Get verification queue
idVerificationRouter.get('/admin/queue', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
  const status = req.query.status || 'pending'
  const limit = Math.min(Number(req.query.limit) || 50, 200)
  
  const r = await pool.query(
    `select iv.*,
            u.id as user_id, u.name, u.email, u.phone, u.role, u.profile_pic,
            u.created_at as user_created_at
     from id_verifications iv
     join users u on u.id = iv.user_id
     where iv.status = $1
     order by iv.created_at asc
     limit $2`,
    [status, limit],
  )
  
  return res.json(r.rows)
}))

// Admin: Get single verification request with full details
idVerificationRouter.get('/admin/requests/:id', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
  const r = await pool.query(
    `select iv.*,
            u.id as user_id, u.name, u.email, u.phone, u.role, u.profile_pic,
            u.created_at as user_created_at, u.trust_score,
            reviewer.name as reviewer_name
     from id_verifications iv
     join users u on u.id = iv.user_id
     left join users reviewer on reviewer.id = iv.reviewer_id
     where iv.id = $1`,
    [req.params.id],
  )
  
  if (!r.rows[0]) {
    return res.status(404).json({ message: 'Verification request not found' })
  }
  
  return res.json(r.rows[0])
}))

// Admin: Approve verification
const ApproveSchema = z.object({
  note: z.string().max(2000).optional().nullable(),
})

idVerificationRouter.post('/admin/requests/:id/approve', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
  const parsed = ApproveSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })
  }

  const client = await pool.connect()
  try {
    await client.query('begin')
    
    // Lock the verification request
    const vrRes = await client.query(
      'select * from id_verifications where id = $1 for update',
      [req.params.id],
    )
    const vr = vrRes.rows[0]
    
    if (!vr) {
      await client.query('rollback')
      return res.status(404).json({ message: 'Verification request not found' })
    }
    
    if (vr.status !== 'pending') {
      await client.query('rollback')
      return res.status(400).json({ message: 'Request is not pending' })
    }

    // Update verification request
    await client.query(
      `update id_verifications
       set status = 'approved',
           reviewer_id = $1,
           reviewed_at = now(),
           updated_at = now()
       where id = $2`,
      [req.user.sub, req.params.id],
    )

    // Mark user as ID verified
    await client.query(
      `update users 
       set id_verified = true, updated_at = now() 
       where id = $1`,
      [vr.user_id],
    )

    await client.query('commit')
    
    // Fetch updated request
    const updated = await client.query('select * from id_verifications where id = $1', [req.params.id])
    return res.json(updated.rows[0])
  } catch (e) {
    try {
      await client.query('rollback')
    } catch {}
    throw e
  } finally {
    client.release()
  }
}))

// Admin: Reject or request correction
const RejectSchema = z.object({
  status: z.enum(['rejected', 'needs_correction']),
  rejection_reason: z.string().min(10).max(2000),
})

idVerificationRouter.post('/admin/requests/:id/reject', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
  const parsed = RejectSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })
  }

  const r = await pool.query(
    `update id_verifications
     set status = $1,
         rejection_reason = $2,
         reviewer_id = $3,
         reviewed_at = now(),
         updated_at = now()
     where id = $4 and status = 'pending'
     returning *`,
    [parsed.data.status, parsed.data.rejection_reason, req.user.sub, req.params.id],
  )

  if (!r.rows[0]) {
    return res.status(404).json({ message: 'Verification request not found or not pending' })
  }

  return res.json(r.rows[0])
}))

