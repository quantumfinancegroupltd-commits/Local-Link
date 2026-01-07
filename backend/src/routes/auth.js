import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { signToken } from '../auth/jwt.js'

export const authRouter = Router()

const RegisterSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional().nullable(),
  password: z.string().min(6),
  role: z.enum(['buyer', 'artisan', 'farmer']),
})

authRouter.post('/register', async (req, res) => {
  const parsed = RegisterSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const { name, email, phone, password, role } = parsed.data
  const passwordHash = await bcrypt.hash(password, 10)

  try {
    const result = await pool.query(
      `insert into users (name, email, phone, password_hash, role)
       values ($1,$2,$3,$4,$5)
       returning id, name, email, phone, role, verified, rating, profile_pic, created_at`,
      [name, email.toLowerCase(), phone ?? null, passwordHash, role],
    )
    const user = result.rows[0]

    // Ensure a wallet row exists for every user (V2 foundation)
    await pool.query(
      `insert into wallets (user_id, balance, currency)
       values ($1, 0, 'GHS')
       on conflict (user_id) do nothing`,
      [user.id],
    )

    const token = signToken({ sub: user.id, role: user.role })
    return res.status(201).json({ token, user })
  } catch (e) {
    if (String(e?.message || '').includes('duplicate key')) {
      return res.status(409).json({ message: 'Email already exists' })
    }
    throw e
  }
})

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

authRouter.post('/login', async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input' })

  const { email, password } = parsed.data
  const result = await pool.query('select * from users where email = $1', [email.toLowerCase()])
  const user = result.rows[0]
  if (!user) return res.status(401).json({ message: 'Invalid credentials' })

  const ok = await bcrypt.compare(password, user.password_hash)
  if (!ok) return res.status(401).json({ message: 'Invalid credentials' })

  const token = signToken({ sub: user.id, role: user.role })
  const safeUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    verified: user.verified,
    rating: user.rating,
    profile_pic: user.profile_pic,
    created_at: user.created_at,
  }
  return res.json({ token, user: safeUser })
})


