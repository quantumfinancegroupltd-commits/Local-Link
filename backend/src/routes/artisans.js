import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

export const artisansRouter = Router()

artisansRouter.get('/', requireAuth, async (req, res) => {
  const r = await pool.query(
    `select a.*,
            u.name, u.email, u.phone, u.role, u.verified, u.rating, u.profile_pic,
            coalesce(v.level, 'unverified') as verification_tier
     from artisans a
     join users u on u.id = a.user_id
     left join verification_levels v on v.user_id = u.id
     order by a.created_at desc`,
  )
  // Return with nested user shape for frontend convenience
  const list = r.rows.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    skills: row.skills,
    portfolio: row.portfolio,
    experience_years: row.experience_years,
    service_area: row.service_area,
    verified_docs: row.verified_docs,
    premium: row.premium,
    created_at: row.created_at,
    updated_at: row.updated_at,
    user: {
      id: row.user_id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      role: row.role,
      verified: row.verified,
      rating: row.rating,
      profile_pic: row.profile_pic,
      verification_tier: row.verification_tier,
    },
  }))
  return res.json(list)
})

const CreateSchema = z.object({
  skills: z.array(z.string()).optional(),
  experience_years: z.number().int().min(0).optional().nullable(),
  service_area: z.string().optional().nullable(),
})

artisansRouter.post('/', requireAuth, requireRole(['artisan']), async (req, res) => {
  const parsed = CreateSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input' })

  const { skills, experience_years, service_area } = parsed.data
  const r = await pool.query(
    `insert into artisans (user_id, skills, experience_years, service_area)
     values ($1,$2,$3,$4)
     on conflict (user_id) do update set
       skills = excluded.skills,
       experience_years = excluded.experience_years,
       service_area = excluded.service_area,
       updated_at = now()
     returning *`,
    [req.user.sub, skills ?? null, experience_years ?? null, service_area ?? null],
  )
  return res.status(201).json(r.rows[0])
})


