import { Router } from 'express'
import { pool } from '../db/pool.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { optionalAuth } from '../middleware/auth.js'
import { Readable } from 'node:stream'

export const newsRouter = Router()

// Keep this allowlist tight to avoid turning this route into an open proxy.
// Add hosts here only when we intentionally depend on them for public-facing images.
const ALLOWED_IMAGE_HOSTS = new Set([
  'images.pexels.com',
  'images.unsplash.com',
  'upload.wikimedia.org',
])

// Public image proxy (prevents CSP/hotlink issues by serving from same-origin).
// Example: /api/news/image?src=https%3A%2F%2Fimages.pexels.com%2Fphotos%2F...
newsRouter.get('/image', asyncHandler(async (req, res) => {
  const src = String(req.query.src || '').trim()
  if (!src) return res.status(400).json({ message: 'Missing src' })

  let u
  try {
    u = new URL(src)
  } catch {
    return res.status(400).json({ message: 'Invalid src' })
  }

  if (!['http:', 'https:'].includes(u.protocol)) return res.status(400).json({ message: 'Invalid protocol' })
  if (!ALLOWED_IMAGE_HOSTS.has(u.hostname)) return res.status(400).json({ message: 'Host not allowed' })

  let r
  try {
    r = await fetch(u.toString(), {
      redirect: 'follow',
      headers: {
        'User-Agent': 'LocalLink/1.0 (+https://locallink.agency)',
        Accept: 'image/*,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(15000),
    })
  } catch (err) {
    return res.status(502).json({ message: 'Upstream image unreachable' })
  }

  if (!r.ok) {
    return res.status(404).json({ message: 'Image not found' })
  }

  const ct = String(r.headers.get('content-type') || '')
  if (!ct.startsWith('image/')) {
    return res.status(415).json({ message: 'Unsupported content type' })
  }

  const len = Number(r.headers.get('content-length') || 0)
  if (Number.isFinite(len) && len > 8_000_000) {
    return res.status(413).json({ message: 'Image too large' })
  }

  res.setHeader('Content-Type', ct)
  res.setHeader('Cache-Control', 'public, max-age=86400') // 24h
  res.setHeader('X-Content-Type-Options', 'nosniff')

  if (!r.body) return res.status(502).json({ message: 'Upstream error' })
  Readable.fromWeb(r.body).pipe(res)
}))

// Public list (published only)
newsRouter.get('/', asyncHandler(async (_req, res) => {
  const r = await pool.query(
    `select id, title, slug,
            coalesce(summary, left(body, 280)) as excerpt,
            category,
            hero_image_url,
            published_at, created_at, updated_at
     from news_posts
     where deleted_at is null
       and status = 'published'
       and published_at is not null
     order by published_at asc, created_at asc
     limit 50`,
  )
  return res.json(r.rows)
}))

// Public detail (published only). If admin + preview=1, allows draft view by slug.
newsRouter.get('/:slug', optionalAuth, asyncHandler(async (req, res) => {
  const slug = String(req.params.slug || '').trim()
  if (!slug) return res.status(400).json({ message: 'Missing slug' })

  const preview = String(req.query.preview || '') === '1'
  const isAdmin = req.user?.role === 'admin'

  const r = await pool.query(
    `select id, title, slug, body, status, published_at, created_at, updated_at,
            category, summary, hero_image_url, hero_image_alt, hero_image_credit
     from news_posts
     where deleted_at is null
       and slug = $1
       and (
         (status = 'published' and published_at is not null)
         or ($2::bool = true and $3::bool = true)
       )
     limit 1`,
    [slug, preview, isAdmin],
  )
  const row = r.rows[0]
  if (!row) return res.status(404).json({ message: 'News post not found' })
  return res.json(row)
}))

