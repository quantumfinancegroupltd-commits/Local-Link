import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'

export const buyerSavedProvidersRouter = Router()

const ArtisanIdBody = z.object({
  artisan_user_id: z.string().uuid(),
})

// List saved provider IDs (and optionally full artisan details for "My trusted providers" view)
buyerSavedProvidersRouter.get('/', requireAuth, requireRole(['buyer']), asyncHandler(async (req, res) => {
  const buyerId = req.user.sub
  const full = String(req.query.full ?? '').toLowerCase() === '1' || String(req.query.full ?? '').toLowerCase() === 'true'

  if (!full) {
    const r = await pool.query(
      'select artisan_user_id, created_at from buyer_saved_providers where buyer_id = $1 order by created_at desc',
      [buyerId],
    )
    return res.json({ saved_artisan_ids: r.rows.map((row) => row.artisan_user_id), items: r.rows })
  }

  const r = await pool.query(
    `select s.artisan_user_id, s.created_at as saved_at,
            a.id as artisan_id, a.skills, a.primary_skill, a.experience_years, a.service_area,
            a.service_place_id, a.service_lat, a.service_lng, a.premium,
            u.name as user_name, u.profile_pic, u.rating, u.trust_score, u.verified
     from buyer_saved_providers s
     join users u on u.id = s.artisan_user_id and u.deleted_at is null
     left join artisans a on a.user_id = u.id
     where s.buyer_id = $1
     order by s.created_at desc`,
    [buyerId],
  )
  const items = r.rows.map((row) => ({
    artisan_user_id: row.artisan_user_id,
    saved_at: row.saved_at,
    artisan_id: row.artisan_id,
    user_id: row.artisan_user_id,
    name: row.user_name,
    profile_pic: row.profile_pic,
    rating: row.rating,
    trust_score: row.trust_score,
    verified: row.verified,
    primary_skill: row.primary_skill,
    skills: row.skills,
    experience_years: row.experience_years,
    service_area: row.service_area,
    premium: row.premium,
    user: {
      id: row.artisan_user_id,
      name: row.user_name,
      profile_pic: row.profile_pic,
      rating: row.rating,
      trust_score: row.trust_score,
      verified: row.verified,
    },
  }))
  return res.json({ saved_artisan_ids: items.map((i) => i.artisan_user_id), items })
}))

// Add a provider to saved list
buyerSavedProvidersRouter.post('/', requireAuth, requireRole(['buyer']), asyncHandler(async (req, res) => {
  const buyerId = req.user.sub
  const parsed = ArtisanIdBody.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })
  const { artisan_user_id } = parsed.data
  if (artisan_user_id === buyerId) return res.status(400).json({ message: 'Cannot save yourself' })

  const artisan = await pool.query(
    'select 1 from users where id = $1 and role = $2 and deleted_at is null',
    [artisan_user_id, 'artisan'],
  )
  if (!artisan.rows[0]) return res.status(404).json({ message: 'Artisan not found' })

  await pool.query(
    `insert into buyer_saved_providers (buyer_id, artisan_user_id)
     values ($1, $2)
     on conflict (buyer_id, artisan_user_id) do nothing`,
    [buyerId, artisan_user_id],
  )
  return res.status(201).json({ ok: true, saved: true })
}))

// Remove a provider from saved list
buyerSavedProvidersRouter.delete('/:artisanUserId', requireAuth, requireRole(['buyer']), asyncHandler(async (req, res) => {
  const buyerId = req.user.sub
  const parsed = z.string().uuid().safeParse(req.params.artisanUserId)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid artisan user id' })

  const r = await pool.query(
    'delete from buyer_saved_providers where buyer_id = $1 and artisan_user_id = $2 returning 1',
    [buyerId, parsed.data],
  )
  if (!r.rowCount) return res.status(404).json({ message: 'Saved provider not found' })
  return res.json({ ok: true, saved: false })
}))
