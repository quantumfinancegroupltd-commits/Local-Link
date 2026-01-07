import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { env } from '../config.js'
import { pool } from '../db/pool.js'
import { signToken } from '../auth/jwt.js'

export const bootstrapRouter = Router()

const Schema = z.object({
  secret: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
})

bootstrapRouter.post('/admin', async (req, res) => {
  if (!env.ADMIN_BOOTSTRAP_SECRET) return res.status(501).json({ message: 'ADMIN_BOOTSTRAP_SECRET not set' })
  const parsed = Schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input' })
  if (parsed.data.secret !== env.ADMIN_BOOTSTRAP_SECRET) return res.status(401).json({ message: 'Unauthorized' })

  // Only allow bootstrap if no admin exists yet
  const existing = await pool.query("select 1 from users where role = 'admin' limit 1")
  if (existing.rowCount > 0) return res.status(409).json({ message: 'Admin already exists' })

  const passwordHash = await bcrypt.hash(parsed.data.password, 10)

  const result = await pool.query(
    `insert into users (name, email, phone, password_hash, role, verified)
     values ($1,$2,null,$3,'admin',true)
     returning id, name, email, role, verified, created_at`,
    [parsed.data.name, parsed.data.email.toLowerCase(), passwordHash],
  )
  const admin = result.rows[0]

  await pool.query(
    `insert into wallets (user_id, balance, currency)
     values ($1, 0, 'GHS')
     on conflict (user_id) do nothing`,
    [admin.id],
  )

  const token = signToken({ sub: admin.id, role: 'admin' })
  return res.status(201).json({ token, user: admin })
})


