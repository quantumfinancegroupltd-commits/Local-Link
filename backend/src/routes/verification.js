import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'

export const verificationRouter = Router()

verificationRouter.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const tier = await pool.query(`select level from verification_levels where user_id = $1`, [req.user.sub])
  const current = tier.rows[0]?.level ?? 'unverified'
  const pending = await pool.query(
    `select * from verification_requests where user_id = $1 order by created_at desc limit 1`,
    [req.user.sub],
  )
  return res.json({ current_level: current, latest_request: pending.rows[0] ?? null })
}))

const RequestSchema = z.object({
  requested_level: z.enum(['bronze', 'silver', 'gold']),
  note: z.string().max(2000).optional().nullable(),
  evidence: z.any().optional().nullable(), // { files: [url], ... }
})

// Artisan/Farmer/Driver request upgrade (admin approves later)
verificationRouter.post('/request', requireAuth, requireRole(['artisan', 'farmer', 'driver']), asyncHandler(async (req, res) => {
  const parsed = RequestSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  try {
    const r = await pool.query(
      `insert into verification_requests (user_id, requested_level, status, evidence, note, updated_at)
       values ($1,$2,'pending',$3,$4,now())
       on conflict on constraint uq_verification_requests_pending_user do update set
         requested_level = excluded.requested_level,
         evidence = excluded.evidence,
         note = excluded.note,
         updated_at = now()
       returning *`,
      [req.user.sub, parsed.data.requested_level, parsed.data.evidence ?? null, parsed.data.note ?? null],
    )
    return res.status(201).json(r.rows[0])
  } catch (e) {
    throw e
  }
}))

// Admin review
verificationRouter.get('/admin/requests', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
  const r = await pool.query(
    `select vr.*,
            u.name, u.email, u.phone, u.role
     from verification_requests vr
     join users u on u.id = vr.user_id
     where vr.status = 'pending'
     order by vr.created_at desc
     limit 200`,
  )
  return res.json(r.rows)
}))

const ApproveSchema = z.object({
  level: z.enum(['bronze', 'silver', 'gold']),
  note: z.string().max(2000).optional().nullable(),
})

verificationRouter.post('/admin/requests/:id/approve', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
  const parsed = ApproveSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const client = await pool.connect()
  try {
    await client.query('begin')
    const rr = await client.query('select * from verification_requests where id = $1 for update', [req.params.id])
    const vr = rr.rows[0]
    if (!vr) {
      await client.query('rollback')
      return res.status(404).json({ message: 'Request not found' })
    }
    if (vr.status !== 'pending') {
      await client.query('rollback')
      return res.status(400).json({ message: 'Request is not pending' })
    }

    await client.query(
      `insert into verification_levels (user_id, level, evidence, updated_by)
       values ($1, $2, $3, $4)
       on conflict (user_id) do update set
         level = excluded.level,
         evidence = excluded.evidence,
         updated_by = excluded.updated_by,
         updated_at = now()`,
      [vr.user_id, parsed.data.level, vr.evidence ?? null, req.user.sub],
    )
    await client.query(`update users set verified = true, updated_at = now() where id = $1`, [vr.user_id])
    const updatedReq = await client.query(
      `update verification_requests
       set status='approved', reviewed_by=$2, reviewed_at=now(), updated_at=now(),
           note = coalesce($3, note)
       where id=$1
       returning *`,
      [vr.id, req.user.sub, parsed.data.note ?? null],
    )
    await client.query('commit')
    return res.json(updatedReq.rows[0])
  } catch (e) {
    try {
      await client.query('rollback')
    } catch {}
    throw e
  } finally {
    client.release()
  }
}))

const RejectSchema = z.object({
  note: z.string().max(2000).optional().nullable(),
})

verificationRouter.post('/admin/requests/:id/reject', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
  const parsed = RejectSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const r = await pool.query(
    `update verification_requests
     set status='rejected', reviewed_by=$2, reviewed_at=now(), updated_at=now(),
         note = coalesce($3, note)
     where id=$1 and status='pending'
     returning *`,
    [req.params.id, req.user.sub, parsed.data.note ?? null],
  )
  if (!r.rows[0]) return res.status(404).json({ message: 'Request not found or not pending' })
  return res.json(r.rows[0])
}))


