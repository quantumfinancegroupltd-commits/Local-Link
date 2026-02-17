import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { optionalAuth, requireAuth, requireRole } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'

export const searchRouter = Router()

const SearchQuery = z.object({
  q: z.string().min(1).max(200),
  type: z.enum(['products', 'providers', 'all']).optional().default('all'),
  limit: z.coerce.number().min(1).max(100).optional().default(30),
})

searchRouter.get('/', optionalAuth, asyncHandler(async (req, res) => {
  const parsed = SearchQuery.safeParse(req.query)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const q = String(parsed.data.q).trim().replace(/\s+/g, ' ')
  const type = parsed.data.type
  const limit = parsed.data.limit

  const out = { products: [], providers: [] }

  const likePattern = `%${q.replace(/%/g, '\\%').replace(/_/g, '\\_')}%`

  if (type === 'products' || type === 'all') {
    try {
      const r = await pool.query(
        `select p.id, p.name, p.category, p.quantity, p.unit, p.price, p.image_url, p.status,
                f.farm_location, f.farm_lat, f.farm_lng,
                u.id as farmer_user_id, u.name as farmer_name
         from products p
         left join farmers f on f.id = p.farmer_id
         left join users u on u.id = f.user_id and u.deleted_at is null
         where p.status = 'available'
           and (p.quantity is null or p.quantity > 0)
           and p.search_vector @@ plainto_tsquery('english', $1)
         order by ts_rank(p.search_vector, plainto_tsquery('english', $1)) desc
         limit $2`,
        [q, limit],
      )
      out.products = r.rows
    } catch {
      const r = await pool.query(
        `select p.id, p.name, p.category, p.quantity, p.unit, p.price, p.image_url, p.status,
                f.farm_location, f.farm_lat, f.farm_lng,
                u.id as farmer_user_id, u.name as farmer_name
         from products p
         left join farmers f on f.id = p.farmer_id
         left join users u on u.id = f.user_id and u.deleted_at is null
         where p.status = 'available' and (p.quantity is null or p.quantity > 0)
           and (p.name ilike $1 or p.category ilike $1)
         order by p.created_at desc
         limit $2`,
        [likePattern, limit],
      )
      out.products = r.rows
    }
  }

  if (type === 'providers' || type === 'all') {
    try {
      const r = await pool.query(
        `select u.id as user_id, u.name, u.role, u.rating, u.profile_pic, u.trust_score,
                a.id as artisan_id, a.service_area, a.skills, a.primary_skill, a.premium,
                coalesce(v.level, 'unverified') as verification_tier
         from users u
         join artisans a on a.user_id = u.id
         left join verification_levels v on v.user_id = u.id
         where u.deleted_at is null
           and (u.suspended_until is null or u.suspended_until <= now())
           and u.search_vector @@ plainto_tsquery('english', $1)
         order by ts_rank(u.search_vector, plainto_tsquery('english', $1)) desc,
                  a.premium desc nulls last
         limit $2`,
        [q, limit],
      )
      out.providers = r.rows
    } catch {
      const r = await pool.query(
        `select u.id as user_id, u.name, u.role, u.rating, u.profile_pic, u.trust_score,
                a.id as artisan_id, a.service_area, a.skills, a.primary_skill, a.premium,
                coalesce(v.level, 'unverified') as verification_tier
         from users u
         join artisans a on a.user_id = u.id
         left join verification_levels v on v.user_id = u.id
         where u.deleted_at is null
           and (u.suspended_until is null or u.suspended_until <= now())
           and (u.name ilike $1 or a.service_area ilike $1 or a.primary_skill ilike $1)
         order by a.premium desc nulls last, u.created_at desc
         limit $2`,
        [likePattern, limit],
      )
      out.providers = r.rows
    }
  }

  return res.json(out)
}))
