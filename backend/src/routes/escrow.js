import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

export const escrowRouter = Router()

// --- Job escrow ---
escrowRouter.get('/jobs/:jobId', requireAuth, async (req, res) => {
  const r = await pool.query(
    `select * from escrow_transactions
     where type = 'job' and job_id = $1
     order by created_at desc`,
    [req.params.jobId],
  )
  return res.json(r.rows)
})

const DepositSchema = z.object({
  amount: z.number().positive(),
  provider: z.enum(['paystack', 'flutterwave']).optional(),
})

escrowRouter.post('/jobs/:jobId/deposit', requireAuth, requireRole(['buyer']), async (req, res) => {
  const parsed = DepositSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input' })

  const jobRes = await pool.query('select * from jobs where id = $1', [req.params.jobId])
  const job = jobRes.rows[0]
  if (!job) return res.status(404).json({ message: 'Job not found' })
  if (job.buyer_id !== req.user.sub) return res.status(403).json({ message: 'Forbidden' })

  // Resolve artisan user as counterparty (if assigned)
  let counterpartyUserId = null
  if (job.assigned_artisan_id) {
    const a = await pool.query(
      `select u.id as user_id
       from artisans ar
       join users u on u.id = ar.user_id
       where ar.id = $1`,
      [job.assigned_artisan_id],
    )
    counterpartyUserId = a.rows[0]?.user_id ?? null
  }

  const r = await pool.query(
    `insert into escrow_transactions (type, buyer_id, counterparty_user_id, job_id, amount, status, provider)
     values ('job', $1, $2, $3, $4, 'pending_payment', $5)
     returning *`,
    [req.user.sub, counterpartyUserId, job.id, parsed.data.amount, parsed.data.provider ?? null],
  )

  // NOTE: Payment provider integration comes next. This endpoint creates the escrow intent row.
  return res.status(201).json(r.rows[0])
})

// Placeholder "release" (admin or buyer confirmation flow comes next)
escrowRouter.post('/jobs/:jobId/release', requireAuth, requireRole(['buyer', 'admin']), async (req, res) => {
  const r = await pool.query(
    `update escrow_transactions
     set status = 'released', updated_at = now()
     where id = (
       select id from escrow_transactions
       where type='job' and job_id = $1
       order by created_at desc
       limit 1
     )
     returning *`,
    [req.params.jobId],
  )
  if (!r.rows[0]) return res.status(404).json({ message: 'No escrow transaction found' })
  return res.json(r.rows[0])
})


