import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { notifyWithSms } from '../services/messaging/index.js'

export const quotesRouter = Router()

const UpdateSchema = z.object({
  status: z.enum(['accepted', 'rejected']),
})

quotesRouter.put('/:id', requireAuth, requireRole(['buyer', 'admin']), asyncHandler(async (req, res) => {
  const parsed = UpdateSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

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

    // Notify artisan that they were accepted (in-app + optional SMS)
    const artisanUserRes = await pool.query('select user_id from artisans where id = $1', [quote.artisan_id])
    const artisanUserId = artisanUserRes.rows[0]?.user_id ?? null
    if (artisanUserId) {
      notifyWithSms(artisanUserId, {
        type: 'quote_accepted',
        title: 'Quote accepted',
        body: 'A buyer accepted your quote. Open the job to continue.',
        meta: { url: `/artisan/jobs/${quote.job_id}`, job_id: quote.job_id, quote_id: quote.id },
        dedupeKey: `quote:${quote.id}:accepted`,
      }).catch(() => {})
    }
  }

  const updated = await pool.query('select * from quotes where id = $1', [quote.id])
  return res.json(updated.rows[0])
}))


