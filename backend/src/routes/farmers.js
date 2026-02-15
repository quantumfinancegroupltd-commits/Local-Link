import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'

export const farmersRouter = Router()

const UpsertSchema = z.object({
  farm_location: z.string().optional().nullable(),
  farm_type: z.array(z.string()).optional().nullable(),
  verified_docs: z.any().optional().nullable(),
  farm_place_id: z.string().optional().nullable(),
  farm_lat: z.number().min(-90).max(90).optional().nullable(),
  farm_lng: z.number().min(-180).max(180).optional().nullable(),
})

farmersRouter.get('/me', requireAuth, requireRole(['farmer']), asyncHandler(async (req, res) => {
  const r = await pool.query('select * from farmers where user_id = $1', [req.user.sub])
  if (!r.rows[0]) return res.json(null)
  return res.json(r.rows[0])
}))

farmersRouter.post('/me', requireAuth, requireRole(['farmer']), asyncHandler(async (req, res) => {
  const parsed = UpsertSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const r = await pool.query(
    `insert into farmers (user_id, farm_location, farm_type, verified_docs, farm_place_id, farm_lat, farm_lng, updated_at)
     values ($1,$2,$3,$4,$5,$6,$7,now())
     on conflict (user_id) do update set
       farm_location = excluded.farm_location,
       farm_type = excluded.farm_type,
       verified_docs = excluded.verified_docs,
       farm_place_id = excluded.farm_place_id,
       farm_lat = excluded.farm_lat,
       farm_lng = excluded.farm_lng,
       updated_at = now()
     returning *`,
    [
      req.user.sub,
      parsed.data.farm_location ?? null,
      parsed.data.farm_type ?? null,
      parsed.data.verified_docs ?? null,
      parsed.data.farm_place_id ?? null,
      parsed.data.farm_lat ?? null,
      parsed.data.farm_lng ?? null,
    ],
  )
  return res.status(201).json(r.rows[0])
}))


