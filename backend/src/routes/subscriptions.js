import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { requireAuth } from '../middleware/auth.js'

export const subscriptionsRouter = Router()

subscriptionsRouter.get('/me', requireAuth, async (req, res) => {
  const r = await pool.query('select * from subscriptions where user_id = $1 order by created_at desc', [req.user.sub])
  return res.json(r.rows)
})

const CreateSchema = z.object({
  type: z.string().min(1),
  interval: z.enum(['weekly', 'monthly']).default('weekly'),
  renewal_date: z.string().optional().nullable(),
  meta: z.any().optional(),
})

subscriptionsRouter.post('/', requireAuth, async (req, res) => {
  const parsed = CreateSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input' })

  const { type, interval, renewal_date, meta } = parsed.data
  const r = await pool.query(
    `insert into subscriptions (user_id, type, interval, renewal_date, meta)
     values ($1,$2,$3,$4,$5)
     returning *`,
    [req.user.sub, type, interval, renewal_date ?? null, meta ?? null],
  )
  return res.status(201).json(r.rows[0])
})

subscriptionsRouter.put('/:id/cancel', requireAuth, async (req, res) => {
  const r = await pool.query(
    `update subscriptions
     set status = 'cancelled', updated_at = now()
     where id = $1 and user_id = $2
     returning *`,
    [req.params.id, req.user.sub],
  )
  if (!r.rows[0]) return res.status(404).json({ message: 'Subscription not found' })
  return res.json(r.rows[0])
})


