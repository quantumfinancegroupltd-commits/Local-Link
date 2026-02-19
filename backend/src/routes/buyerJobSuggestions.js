import { Router } from 'express'
import { pool } from '../db/pool.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'

export const buyerJobSuggestionsRouter = Router()

// GET /api/buyer/job-suggestions — proactive suggestions based on last completed job(s)
buyerJobSuggestionsRouter.get('/', requireAuth, requireRole(['buyer']), asyncHandler(async (req, res) => {
  const buyerId = req.user.sub

  const r = await pool.query(
    `select id, title, category, completed_at, recurring_frequency
     from jobs
     where buyer_id = $1 and deleted_at is null and status = 'completed'
     order by completed_at desc nulls last, created_at desc
     limit 1`,
    [buyerId],
  )
  const job = r.rows[0] ?? null
  const suggestions = []

  if (job) {
    const title = (job.title || 'job').trim() || 'your last job'
    const category = job.category ?? 'services'

    if (job.recurring_frequency === 'weekly' || job.recurring_frequency === 'monthly') {
      suggestions.push({
        type: 'rebook',
        job_id: job.id,
        job_title: title,
        message: `You might be due for another ${title}. Rebook the same provider.`,
        cta_label: 'Rebook',
        cta_path: `/buyer/jobs/new?rebook=${job.id}`,
      })
    } else {
      suggestions.push({
        type: 'post_similar',
        job_id: job.id,
        job_title: title,
        category,
        message: `Based on your recent "${title}" job, you may need a follow-up or similar task.`,
        cta_label: 'Post a similar job',
        cta_path: `/buyer/jobs/new?category=${encodeURIComponent(category)}`,
      })
    }
  }

  return res.json({ suggestions })
}))
