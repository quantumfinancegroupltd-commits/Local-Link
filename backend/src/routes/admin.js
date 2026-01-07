import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

export const adminRouter = Router()

adminRouter.get('/users', requireAuth, requireRole(['admin']), async (req, res) => {
  const r = await pool.query(
    `select u.id, u.name, u.email, u.phone, u.role, u.verified, u.rating,
            coalesce(v.level, 'unverified') as verification_tier
     from users u
     left join verification_levels v on v.user_id = u.id
     order by u.created_at desc`,
  )
  return res.json(r.rows)
})

adminRouter.put('/users/:id/verify', requireAuth, requireRole(['admin']), async (req, res) => {
  await pool.query('update users set verified = true, updated_at = now() where id = $1', [req.params.id])
  return res.json({ ok: true })
})

const SetTierSchema = z.object({
  level: z.enum(['unverified', 'bronze', 'silver', 'gold']),
  evidence: z.any().optional(),
})

adminRouter.put('/users/:id/verification', requireAuth, requireRole(['admin']), async (req, res) => {
  const parsed = SetTierSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input' })

  await pool.query(
    `insert into verification_levels (user_id, level, evidence, updated_by)
     values ($1, $2, $3, $4)
     on conflict (user_id) do update set
       level = excluded.level,
       evidence = excluded.evidence,
       updated_by = excluded.updated_by,
       updated_at = now()`,
    [req.params.id, parsed.data.level, parsed.data.evidence ?? null, req.user.sub],
  )
  return res.json({ ok: true })
})


