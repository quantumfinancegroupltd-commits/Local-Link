import { Router } from 'express'
import { pool } from '../db/pool.js'
import { asyncHandler } from '../middleware/asyncHandler.js'

export const marketplaceRouter = Router()

// Public: list all artisan services for marketplace browse (same services shown on artisan profiles).
marketplaceRouter.get('/services', asyncHandler(async (req, res) => {
  const r = await pool.query(
    `select s.id, s.artisan_user_id, s.title, s.description, s.price, s.currency,
            s.duration_minutes, s.category, s.sort_order, s.image_url, s.created_at,
            u.name as artisan_name,
            a.service_area,
            coalesce(v.level, 'unverified') as verification_tier
     from artisan_services s
     join users u on u.id = s.artisan_user_id
      and u.deleted_at is null
      and (u.suspended_until is null or u.suspended_until <= now())
     left join artisans a on a.user_id = u.id
     left join verification_levels v on v.user_id = u.id
     order by s.sort_order asc, s.created_at desc`,
  )
  const list = r.rows.map((row) => ({
    id: row.id,
    artisan_user_id: row.artisan_user_id,
    title: row.title,
    description: row.description ?? null,
    price: Number(row.price),
    currency: row.currency ?? 'GHS',
    duration_minutes: row.duration_minutes ?? null,
    category: row.category ?? null,
    image_url: row.image_url ?? null,
    created_at: row.created_at,
    artisan_name: row.artisan_name ?? null,
    service_area: row.service_area ?? null,
    verification_tier: row.verification_tier ?? 'unverified',
  }))
  return res.json(list)
}))
