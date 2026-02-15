import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'

export const artisansRouter = Router()

async function upsertArtisan(userId, data) {
  const { skills, primary_skill, experience_years, service_area } = data
  const inferredPrimary =
    primary_skill != null && String(primary_skill).trim()
      ? String(primary_skill).trim()
      : Array.isArray(skills) && skills.filter(Boolean).length
        ? String(skills.filter(Boolean)[0]).trim()
        : null
  const r = await pool.query(
    `insert into artisans (user_id, skills, primary_skill, experience_years, service_area)
     values ($1,$2,$3,$4,$5)
     on conflict (user_id) do update set
       skills = excluded.skills,
       primary_skill = excluded.primary_skill,
       experience_years = excluded.experience_years,
       service_area = excluded.service_area,
       updated_at = now()
     returning *`,
    [userId, skills ?? null, inferredPrimary, experience_years ?? null, service_area ?? null],
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
            a.skills, a.primary_skill, a.portfolio, a.experience_years, a.service_area, a.service_place_id, a.service_lat, a.service_lng,
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


