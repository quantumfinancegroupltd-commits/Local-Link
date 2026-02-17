import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'

export const artisansRouter = Router()

async function upsertArtisan(userId, data) {
  const { skills, primary_skill, experience_years, service_area, job_categories: jobCategories } = data
  const inferredPrimary =
    primary_skill != null && String(primary_skill).trim()
      ? String(primary_skill).trim()
      : Array.isArray(skills) && skills.filter(Boolean).length
        ? String(skills.filter(Boolean)[0]).trim()
        : null
  const jobCats =
    Array.isArray(jobCategories) && jobCategories.length
      ? jobCategories.filter((c) => c != null && String(c).trim()).map((c) => String(c).trim())
      : null
  const r = await pool.query(
    `insert into artisans (user_id, skills, primary_skill, experience_years, service_area, job_categories)
     values ($1,$2,$3,$4,$5,$6::text[])
     on conflict (user_id) do update set
       skills = excluded.skills,
       primary_skill = excluded.primary_skill,
       experience_years = excluded.experience_years,
       service_area = excluded.service_area,
       job_categories = excluded.job_categories,
       updated_at = now()
     returning *`,
    [userId, skills ?? null, inferredPrimary, experience_years ?? null, service_area ?? null, jobCats],
  )
  return r.rows[0]
}

artisansRouter.get('/me', requireAuth, requireRole(['artisan']), asyncHandler(async (req, res) => {
  const r = await pool.query('select * from artisans where user_id = $1', [req.user.sub])
  if (!r.rows[0]) return res.json(null)
  return res.json(r.rows[0])
}))

// Public read-only directory of artisans.
// IMPORTANT: do NOT expose phone/email publicly (prevents off-platform leakage).
artisansRouter.get('/', asyncHandler(async (req, res) => {
  const r = await pool.query(
    `select u.id as user_id,
            u.name, u.role, u.verified, u.rating, u.profile_pic, u.trust_score,
            a.id as artisan_id,
            a.skills, a.primary_skill, a.portfolio, a.experience_years, a.service_area, a.service_place_id, a.service_lat, a.service_lng, a.job_categories,
            a.verified_docs, a.premium,
            a.created_at as artisan_created_at,
            a.updated_at as artisan_updated_at,
            rv.reviews_count,
            rv.verified_reviews_count,
            coalesce(v.level, 'unverified') as verification_tier
     from users u
     left join artisans a on a.user_id = u.id
     left join lateral (
       select
         count(*)::int as reviews_count,
         count(*) filter (where job_id is not null or order_id is not null)::int as verified_reviews_count
       from reviews r
       where r.target_id = u.id
     ) rv on true
     left join verification_levels v on v.user_id = u.id
     where u.role = 'artisan'
       and u.deleted_at is null
       and (u.suspended_until is null or u.suspended_until <= now())
     order by coalesce(a.created_at, u.created_at) desc`,
  )
  // Return with nested user shape for frontend convenience
  const list = r.rows.map((row) => ({
    // Keep id stable for lists even if the artisan profile hasn't been completed yet.
    id: row.artisan_id ?? row.user_id,
    artisan_id: row.artisan_id ?? null,
    user_id: row.user_id,
    skills: row.skills ?? null,
    primary_skill: row.primary_skill ?? null,
    portfolio: row.portfolio ?? null,
    experience_years: row.experience_years ?? null,
    service_area: row.service_area ?? null,
    service_place_id: row.service_place_id ?? null,
    service_lat: row.service_lat ?? null,
    service_lng: row.service_lng ?? null,
    job_categories: Array.isArray(row.job_categories) ? row.job_categories : null,
    verified_docs: row.verified_docs ?? null,
    premium: row.premium ?? false,
    created_at: row.artisan_created_at ?? null,
    updated_at: row.artisan_updated_at ?? null,
    user: {
      id: row.user_id,
      name: row.name,
      role: row.role,
      verified: row.verified,
      rating: row.rating,
      profile_pic: row.profile_pic,
      trust_score: row.trust_score ?? null,
      verification_tier: row.verification_tier,
      reviews_count: row.reviews_count ?? 0,
      verified_reviews_count: row.verified_reviews_count ?? 0,
    },
  }))
  return res.json(list)
}))

const CreateSchema = z.object({
  skills: z.array(z.string()).optional(),
  primary_skill: z.string().max(80).optional().nullable(),
  experience_years: z.number().int().min(0).optional().nullable(),
  service_area: z.string().optional().nullable(),
  job_categories: z.array(z.string().max(80)).optional().nullable(),
})

artisansRouter.post('/me', requireAuth, requireRole(['artisan']), asyncHandler(async (req, res) => {
  const parsed = CreateSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })
  const row = await upsertArtisan(req.user.sub, parsed.data)
  return res.status(201).json(row)
}))

// Backwards-compatible alias
artisansRouter.post('/', requireAuth, requireRole(['artisan']), asyncHandler(async (req, res) => {
  const parsed = CreateSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })
  const row = await upsertArtisan(req.user.sub, parsed.data)
  return res.status(201).json(row)
}))

// --- Artisan services (productized offerings, shown on profile) ---

const CreateServiceSchema = z.object({
  title: z.string().min(1, 'Title is required').max(120),
  description: z.preprocess((v) => (v === '' || v == null ? null : String(v)), z.string().max(2000).nullable()),
  price: z.coerce.number().min(0, 'Price must be 0 or more'),
  currency: z.string().max(10).optional().default('GHS'),
  duration_minutes: z.preprocess(
    (v) => {
      if (v === '' || v == null) return null
      const n = Number(v)
      return Number.isNaN(n) || n <= 0 ? null : Math.min(10080, Math.round(n))
    },
    z.number().int().min(0).max(10080).nullable(),
  ),
  category: z.preprocess((v) => (v === '' || v == null ? null : String(v)), z.string().max(80).nullable()),
  sort_order: z.coerce.number().int().optional().nullable(),
  image_url: z.preprocess((v) => (v === '' || v == null ? null : String(v)), z.string().url().max(2000).nullable().optional()),
})

const UpdateServiceSchema = CreateServiceSchema.partial()

// Must define /me/* before /:userId/* so "me" isn't captured as userId
artisansRouter.get('/me/services', requireAuth, requireRole(['artisan']), asyncHandler(async (req, res) => {
  const r = await pool.query(
    `select id, artisan_user_id, title, description, price, currency, duration_minutes, category, sort_order, image_url, created_at, updated_at
     from artisan_services
     where artisan_user_id = $1
     order by sort_order asc, created_at asc`,
    [req.user.sub],
  )
  return res.json(r.rows)
}))

artisansRouter.get('/me/availability', requireAuth, requireRole(['artisan']), asyncHandler(async (req, res) => {
  const from = req.query.from
  const to = req.query.to
  if (!from || !to) return res.status(400).json({ message: 'Provide from and to (YYYY-MM-DD)' })
  const r = await pool.query(
    `select date
     from artisan_availability
     where artisan_user_id = $1 and date >= $2::date and date <= $3::date
     order by date asc`,
    [req.user.sub, from, to],
  )
  const dates = r.rows.map((row) => {
    const d = row.date
    if (d instanceof Date) return d.toISOString().slice(0, 10)
    if (typeof d === 'string') return d.slice(0, 10)
    return d
  })
  return res.json(dates)
}))

artisansRouter.get('/:userId/services', asyncHandler(async (req, res) => {
  const userId = req.params.userId
  const r = await pool.query(
    `select id, artisan_user_id, title, description, price, currency, duration_minutes, category, sort_order, image_url, created_at, updated_at
     from artisan_services
     where artisan_user_id = $1
     order by sort_order asc, created_at asc`,
    [userId],
  )
  return res.json(r.rows)
}))

artisansRouter.post('/me/services', requireAuth, requireRole(['artisan']), asyncHandler(async (req, res) => {
  const parsed = CreateServiceSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })
  const r = await pool.query(
    `insert into artisan_services (artisan_user_id, title, description, price, currency, duration_minutes, category, sort_order, image_url)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     returning *`,
    [
      req.user.sub,
      parsed.data.title,
      parsed.data.description ?? null,
      parsed.data.price,
      parsed.data.currency ?? 'GHS',
      parsed.data.duration_minutes ?? null,
      parsed.data.category ?? null,
      parsed.data.sort_order ?? 0,
      parsed.data.image_url ?? null,
    ],
  )
  return res.status(201).json(r.rows[0])
}))

artisansRouter.patch('/me/services/:id', requireAuth, requireRole(['artisan']), asyncHandler(async (req, res) => {
  const parsed = UpdateServiceSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })
  const r = await pool.query(
    `update artisan_services set
       title = coalesce($2, title),
       description = coalesce($3, description),
       price = coalesce($4, price),
       currency = coalesce($5, currency),
       duration_minutes = coalesce($6, duration_minutes),
       category = coalesce($7, category),
       sort_order = coalesce($8, sort_order),
       image_url = coalesce($9, image_url),
       updated_at = now()
     where id = $1 and artisan_user_id = $10
     returning *`,
    [
      req.params.id,
      parsed.data.title,
      parsed.data.description,
      parsed.data.price,
      parsed.data.currency,
      parsed.data.duration_minutes,
      parsed.data.category,
      parsed.data.sort_order,
      parsed.data.image_url,
      req.user.sub,
    ],
  )
  if (!r.rows[0]) return res.status(404).json({ message: 'Service not found' })
  return res.json(r.rows[0])
}))

artisansRouter.delete('/me/services/:id', requireAuth, requireRole(['artisan']), asyncHandler(async (req, res) => {
  const r = await pool.query(
    'delete from artisan_services where id = $1 and artisan_user_id = $2 returning id',
    [req.params.id, req.user.sub],
  )
  if (!r.rows[0]) return res.status(404).json({ message: 'Service not found' })
  return res.status(204).send()
}))

// --- Artisan availability (calendar dates for booking) ---

artisansRouter.get('/:userId/availability', asyncHandler(async (req, res) => {
  const userId = req.params.userId
  const from = req.query.from // YYYY-MM-DD
  const to = req.query.to // YYYY-MM-DD
  if (!from || !to) return res.status(400).json({ message: 'Provide from and to (YYYY-MM-DD)' })
  const r = await pool.query(
    `select date
     from artisan_availability
     where artisan_user_id = $1 and date >= $2::date and date <= $3::date
     order by date asc`,
    [userId, from, to],
  )
  // Return YYYY-MM-DD strings for consistent parsing (PostgreSQL date can come back as Date or ISO string)
  const dates = r.rows.map((row) => {
    const d = row.date
    if (d instanceof Date) return d.toISOString().slice(0, 10)
    if (typeof d === 'string') return d.slice(0, 10)
    return d
  })
  return res.json(dates)
}))

const SetAvailabilitySchema = z.object({
  dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(0).max(365),
})

artisansRouter.post('/me/availability', requireAuth, requireRole(['artisan']), asyncHandler(async (req, res) => {
  const parsed = SetAvailabilitySchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })
  const dates = [...new Set(parsed.data.dates)].sort()
  if (dates.length === 0) return res.json({ added: 0, dates: [] })
  const values = dates.map((d, i) => `($1, $${i + 2}::date)`).join(', ')
  const r = await pool.query(
    `insert into artisan_availability (artisan_user_id, date)
     values ${values}
     on conflict (artisan_user_id, date) do nothing`,
    [req.user.sub, ...dates],
  )
  return res.json({ added: r.rowCount ?? dates.length, dates })
}))

artisansRouter.delete('/me/availability/:date', requireAuth, requireRole(['artisan']), asyncHandler(async (req, res) => {
  const date = req.params.date
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ message: 'Invalid date format (YYYY-MM-DD)' })
  const r = await pool.query(
    'delete from artisan_availability where artisan_user_id = $1 and date = $2::date returning id',
    [req.user.sub, date],
  )
  if (!r.rows[0]) return res.status(404).json({ message: 'Date not found' })
  return res.status(204).send()
}))


