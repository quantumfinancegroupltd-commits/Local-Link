import { Router } from 'express'
import { pool } from '../db/pool.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { optionalAuth } from '../middleware/auth.js'

export const economistRouter = Router()

/** GET /api/economist — list published issues, newest first (for slider on /news) */
economistRouter.get('/', asyncHandler(async (req, res) => {
  const r = await pool.query(
    `select id, slug, volume_number, issue_date, theme, title, summary, cover_image_url,
            page_count, featured_headline_1, featured_headline_2, featured_headline_3, pdf_url
     from economist_issues
     where is_published = true
     order by issue_date desc`,
  )
  return res.json(r.rows)
}))

/** POST /api/economist/read — record read (anonymous or authenticated). Body: { issue_slug, pages_viewed, time_spent_seconds?, completed? } */
economistRouter.post('/read', optionalAuth, asyncHandler(async (req, res) => {
  const slug = String(req.body?.issue_slug ?? '').trim()
  if (!slug) return res.status(400).json({ message: 'issue_slug required' })
  const r = await pool.query('select id from economist_issues where slug = $1 and is_published = true', [slug])
  if (!r.rows[0]) return res.status(404).json({ message: 'Issue not found' })
  const issueId = r.rows[0].id
  const pagesViewed = Math.max(0, parseInt(req.body?.pages_viewed, 10) || 0)
  const timeSpentSeconds = Math.max(0, parseInt(req.body?.time_spent_seconds, 10) || 0)
  const completed = Boolean(req.body?.completed)
  await pool.query(
    `insert into economist_read_tracking (issue_id, user_id, pages_viewed, time_spent_seconds, completed)
     values ($1,$2,$3,$4,$5)`,
    [issueId, req.user?.sub ?? null, pagesViewed, timeSpentSeconds, completed],
  )
  return res.status(201).json({ ok: true })
}))

/** GET /api/economist/:slug — single issue by slug (for reader page) */
economistRouter.get('/:slug', asyncHandler(async (req, res) => {
  const slug = String(req.params.slug || '').trim()
  if (!slug) return res.status(400).json({ message: 'Missing slug' })
  const r = await pool.query(
    `select id, slug, volume_number, issue_date, theme, title, summary, pdf_url, cover_image_url,
            page_count, featured_headline_1, featured_headline_2, featured_headline_3
     from economist_issues
     where slug = $1 and is_published = true`,
    [slug],
  )
  if (!r.rows[0]) return res.status(404).json({ message: 'Issue not found' })
  return res.json(r.rows[0])
}))
