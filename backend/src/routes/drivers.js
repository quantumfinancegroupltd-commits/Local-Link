import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'

export const driversRouter = Router()

const UpsertDriverSchema = z.object({
  vehicle_type: z.enum(['bike', 'car', 'van']).optional(),
  area_of_operation: z.string().optional().nullable(),
  is_online: z.boolean().optional(),
})

driversRouter.get('/me', requireAuth, requireRole(['driver']), asyncHandler(async (req, res) => {
  const r = await pool.query('select * from drivers where user_id = $1', [req.user.sub])
  if (!r.rows[0]) return res.status(404).json({ message: 'Driver profile not found' })
  return res.json(r.rows[0])
}))

driversRouter.post('/me', requireAuth, requireRole(['driver']), asyncHandler(async (req, res) => {
  const parsed = UpsertDriverSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const { vehicle_type, area_of_operation, is_online } = parsed.data
  const r = await pool.query(
    `insert into drivers (user_id, vehicle_type, area_of_operation, status, updated_at)
     values ($1, $2, $3, 'pending', now())
     on conflict (user_id) do update set
       vehicle_type = coalesce(excluded.vehicle_type, drivers.vehicle_type),
       area_of_operation = coalesce(excluded.area_of_operation, drivers.area_of_operation),
       is_online = coalesce($4::boolean, drivers.is_online),
       updated_at = now()
     returning *`,
    [req.user.sub, vehicle_type ?? null, area_of_operation ?? null, is_online ?? null],
  )
  return res.status(201).json(r.rows[0])
}))

const LocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().optional().nullable(),
})

// Driver: update current location and set online=true (no maps required; uses device GPS)
driversRouter.post('/me/location', requireAuth, requireRole(['driver']), asyncHandler(async (req, res) => {
  const parsed = LocationSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const r = await pool.query(
    `update drivers
     set last_lat = $2,
         last_lng = $3,
         last_accuracy = $4,
         last_location_at = now(),
         is_online = true,
         updated_at = now()
     where user_id = $1
     returning *`,
    [req.user.sub, parsed.data.lat, parsed.data.lng, parsed.data.accuracy ?? null],
  )
  if (!r.rows[0]) return res.status(404).json({ message: 'Driver profile not found' })
  return res.json(r.rows[0])
}))

// Admin: list drivers with user info
driversRouter.get('/', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
  const r = await pool.query(
    `select d.*, u.name, u.email, u.phone
     from drivers d
     join users u on u.id = d.user_id
     order by d.created_at desc`,
  )
  return res.json(r.rows)
}))

const UpdateStatusSchema = z.object({
  status: z.enum(['pending', 'approved', 'restricted', 'suspended']),
})

driversRouter.put('/:userId/status', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
  const parsed = UpdateStatusSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const r = await pool.query('update drivers set status = $2, updated_at = now() where user_id = $1 returning *', [
    req.params.userId,
    parsed.data.status,
  ])
  if (!r.rows[0]) return res.status(404).json({ message: 'Driver not found' })
  return res.json(r.rows[0])
}))


