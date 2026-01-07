import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

export const ordersRouter = Router()

const CreateSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().positive(),
  total_price: z.number().positive(),
})

ordersRouter.post('/', requireAuth, requireRole(['buyer']), async (req, res) => {
  const parsed = CreateSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input' })

  const productRes = await pool.query(
    `select p.*, f.id as farmer_id, f.user_id as farmer_user_id
     from products p
     left join farmers f on f.id = p.farmer_id
     where p.id = $1`,
    [parsed.data.product_id],
  )
  const product = productRes.rows[0]
  if (!product) return res.status(404).json({ message: 'Product not found' })

  const r = await pool.query(
    `insert into orders (product_id, buyer_id, farmer_id, quantity, total_price, payment_status, order_status)
     values ($1,$2,$3,$4,$5,'pending','pending')
     returning *`,
    [parsed.data.product_id, req.user.sub, product.farmer_id ?? null, parsed.data.quantity, parsed.data.total_price],
  )
  return res.status(201).json(r.rows[0])
})


