import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

export const productsRouter = Router()

productsRouter.get('/', requireAuth, async (req, res) => {
  const r = await pool.query(
    `select p.*,
            f.farm_location,
            u.id as farmer_user_id,
            u.name as farmer_name,
            u.verified as farmer_verified,
            coalesce(v.level, 'unverified') as verification_tier
     from products p
     left join farmers f on f.id = p.farmer_id
     left join users u on u.id = f.user_id
     left join verification_levels v on v.user_id = u.id
     order by p.created_at desc`,
  )
  const list = r.rows.map((row) => ({
    ...row,
    location: row.farm_location,
    farmer: row.farmer_user_id
      ? {
          id: row.farmer_user_id,
          name: row.farmer_name,
          verified: row.farmer_verified,
          farm_location: row.farm_location,
          verification_tier: row.verification_tier,
        }
      : null,
  }))
  return res.json(list)
})

productsRouter.get('/:id', requireAuth, async (req, res) => {
  const r = await pool.query(
    `select p.*,
            f.farm_location,
            u.id as farmer_user_id,
            u.name as farmer_name,
            u.verified as farmer_verified,
            coalesce(v.level, 'unverified') as verification_tier
     from products p
     left join farmers f on f.id = p.farmer_id
     left join users u on u.id = f.user_id
     left join verification_levels v on v.user_id = u.id
     where p.id = $1`,
    [req.params.id],
  )
  const row = r.rows[0]
  if (!row) return res.status(404).json({ message: 'Product not found' })
  return res.json({
    ...row,
    location: row.farm_location,
    farmer: row.farmer_user_id
      ? {
          id: row.farmer_user_id,
          name: row.farmer_name,
          verified: row.farmer_verified,
          farm_location: row.farm_location,
          verification_tier: row.verification_tier,
        }
      : null,
  })
})

const CreateSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  quantity: z.number().int().positive(),
  unit: z.string().min(1),
  price: z.number().positive(),
  image_url: z.string().url().optional().nullable(),
})

productsRouter.post('/', requireAuth, requireRole(['farmer']), async (req, res) => {
  const parsed = CreateSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input' })

  // Ensure farmer profile exists
  const farmerRes = await pool.query('select id from farmers where user_id = $1', [req.user.sub])
  const farmer = farmerRes.rows[0]
  if (!farmer) {
    // auto-create basic farmer profile for MVP
    const created = await pool.query('insert into farmers (user_id) values ($1) returning id', [req.user.sub])
    farmerRes.rows[0] = created.rows[0]
  }

  const { name, category, quantity, unit, price, image_url } = parsed.data
  const r = await pool.query(
    `insert into products (farmer_id, name, category, quantity, unit, price, image_url, status, created_at, updated_at)
     values ($1,$2,$3,$4,$5,$6,$7,'available',now(),now())
     returning *`,
    [farmerRes.rows[0].id, name, category, quantity, unit, price, image_url ?? null],
  )

  return res.status(201).json(r.rows[0])
})


