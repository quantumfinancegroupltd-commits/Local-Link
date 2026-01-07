import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

export const quotesRouter = Router()

const UpdateSchema = z.object({
  status: z.enum(['accepted', 'rejected']),
})

quotesRouter.put('/:id', requireAuth, requireRole(['buyer', 'admin']), async (req, res) => {
  const parsed = UpdateSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input' })

  const quoteRes = await pool.query('select * from quotes where id = $1', [req.params.id])
  const quote = quoteRes.rows[0]
  if (!quote) return res.status(404).json({ message: 'Quote not found' })

  await pool.query('update quotes set status = $1 where id = $2', [parsed.data.status, quote.id])

  if (parsed.data.status === 'accepted') {
    // Update job with accepted quote + assigned artisan
    const artisanRes = await pool.query('select * from artisans where id = $1', [quote.artisan_id])
    const artisan = artisanRes.rows[0]
    await pool.query(
      `update jobs
       set status = 'assigned',
           assigned_artisan_id = $1,
           accepted_quote = $2,
           updated_at = now()
       where id = $3`,
      [artisan?.id ?? null, quote.quote_amount ?? null, quote.job_id],
    )
    // Reject other quotes for this job
    await pool.query(
      `update quotes
       set status = 'rejected'
       where job_id = $1 and id <> $2 and status = 'pending'`,
      [quote.job_id, quote.id],
    )
  }

  const updated = await pool.query('select * from quotes where id = $1', [quote.id])
  return res.json(updated.rows[0])
})


