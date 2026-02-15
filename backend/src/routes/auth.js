import { Router } from 'express'
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { pool } from '../db/pool.js'
import { signToken } from '../auth/jwt.js'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { env } from '../config.js'
import { sendEmail } from '../services/mailer.js'

export const authRouter = Router()

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
})

const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many login attempts, please try again later.' },
})

const passwordResetRequestRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
})

function sha256Hex(s) {
  return crypto.createHash('sha256').update(String(s)).digest('hex')
}

function baseUrlFromReq(req) {
  const explicit = env.APP_BASE_URL ? String(env.APP_BASE_URL).trim().replace(/\/+$/, '') : null
  if (explicit) return explicit
  const protoRaw = req.headers['x-forwarded-proto'] || req.protocol || 'http'
  const hostRaw = req.headers['x-forwarded-host'] || req.headers.host
  const proto = String(Array.isArray(protoRaw) ? protoRaw[0] : protoRaw).split(',')[0].trim() || 'http'
  const host = String(Array.isArray(hostRaw) ? hostRaw[0] : hostRaw || '').split(',')[0].trim()
  if (!host) return null
  return `${proto}://${host}`
}

const RegisterSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional().nullable(),
  password: z.string().min(6),
  role: z.enum(['buyer', 'artisan', 'farmer', 'driver', 'company']),
})

authRouter.post('/register', authRateLimit, asyncHandler(async (req, res) => {
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

    // Ensure role profile rows exist so directories (Providers/Marketplace) can show new accounts immediately.
    // (Profiles can be filled later; this just guarantees the row exists.)
    if (role === 'artisan') {
      await pool.query(`insert into artisans (user_id) values ($1) on conflict (user_id) do nothing`, [user.id])
    } else if (role === 'farmer') {
      await pool.query(`insert into farmers (user_id) values ($1) on conflict (user_id) do nothing`, [user.id])
    } else if (role === 'driver') {
      await pool.query(`insert into drivers (user_id, status, updated_at) values ($1, 'pending', now()) on conflict (user_id) do nothing`, [user.id])
    } else if (role === 'company') {
      // Company profile is created during onboarding (Corporate dashboard).
    }

    const token = signToken({ sub: user.id, role: user.role })
    return res.status(201).json({ token, user })
  } catch (e) {
    if (String(e?.message || '').includes('duplicate key')) {
      return res.status(409).json({ message: 'Email already exists' })
    }
    throw e
  }
}))

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

authRouter.post('/login', loginRateLimit, asyncHandler(async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const { email, password } = parsed.data
  const result = await pool.query('select * from users where email = $1', [email.toLowerCase()])
  const user = result.rows[0]
  if (!user) return res.status(401).json({ message: 'Invalid credentials' })
  if (user.deleted_at) return res.status(403).json({ message: 'Account is deleted' })
  if (user.suspended_until && new Date(user.suspended_until).getTime() > Date.now()) {
    return res.status(403).json({
      message: 'Account temporarily suspended',
      suspended_until: user.suspended_until,
      reason: user.suspended_reason ?? null,
    })
  }

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
    must_change_password: user.must_change_password ?? false,
    created_at: user.created_at,
  }
  return res.json({ token, user: safeUser })
}))

const ForgotPasswordSchema = z.object({
  email: z.string().email(),
})

// Always returns {ok:true} to avoid account enumeration.
authRouter.post('/password/forgot', passwordResetRequestRateLimit, asyncHandler(async (req, res) => {
  const parsed = ForgotPasswordSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const email = String(parsed.data.email || '').toLowerCase().trim()
  const baseUrl = baseUrlFromReq(req)
  const okResponse = { ok: true }

  try {
    const uRes = await pool.query(
      `select id, email, deleted_at
       from users
       where email = $1
       limit 1`,
      [email],
    )
    const u = uRes.rows[0]
    if (!u || u.deleted_at) {
      return res.json(okResponse)
    }

    const rawToken = crypto.randomBytes(32).toString('hex')
    const tokenHash = sha256Hex(rawToken)
    const ttlMin = Math.max(10, Math.min(240, Number(env.PASSWORD_RESET_TTL_MINUTES) || 30))
    const expiresAt = new Date(Date.now() + ttlMin * 60 * 1000)

    await pool.query(
      `insert into password_reset_tokens (user_id, token_hash, expires_at, request_ip, user_agent)
       values ($1,$2,$3,$4,$5)`,
      [
        u.id,
        tokenHash,
        expiresAt.toISOString(),
        req.ip ? String(req.ip) : null,
        req.headers['user-agent'] ? String(req.headers['user-agent']).slice(0, 500) : null,
      ],
    )

    const resetUrl = baseUrl ? `${baseUrl}/reset-password?token=${encodeURIComponent(rawToken)}` : null
    const subject = 'Reset your LocalLink password'
    const text = `You requested a password reset for LocalLink.\n\n${
      resetUrl ? `Reset your password using this link (valid for ${ttlMin} minutes):\n${resetUrl}\n\n` : ''
    }If you didn’t request this, you can ignore this email.\n`

    // Best-effort: we don't block the response on email failures (but we do try).
    await sendEmail({ to: u.email, subject, text }).catch(() => {})

    if (env.NODE_ENV !== 'production') {
      return res.json({ ...okResponse, dev_reset_url: resetUrl, dev_expires_at: expiresAt.toISOString() })
    }
    return res.json(okResponse)
  } catch (e) {
    // Still return ok to avoid leaking details.
    return res.json(okResponse)
  }
}))

const ResetPasswordSchema = z.object({
  token: z.string().min(20).max(2000),
  new_password: z.string().min(8).max(200),
})

authRouter.post('/password/reset', passwordResetRequestRateLimit, asyncHandler(async (req, res) => {
  const parsed = ResetPasswordSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const tokenHash = sha256Hex(parsed.data.token)

  const client = await pool.connect()
  try {
    await client.query('begin')
    const tRes = await client.query(
      `select t.id, t.user_id
       from password_reset_tokens t
       join users u on u.id = t.user_id
       where t.token_hash = $1
         and t.used_at is null
         and t.expires_at > now()
         and u.deleted_at is null
       for update`,
      [tokenHash],
    )
    const t = tRes.rows[0]
    if (!t) {
      await client.query('rollback')
      return res.status(400).json({ message: 'Invalid or expired reset link.' })
    }

    const passwordHash = await bcrypt.hash(parsed.data.new_password, 10)
    await client.query(
      `update users
       set password_hash = $2,
           must_change_password = false,
           updated_at = now()
       where id = $1`,
      [t.user_id, passwordHash],
    )

    await client.query('update password_reset_tokens set used_at = now() where id = $1', [t.id])

    // Revoke any other outstanding tokens for this user.
    await client.query(
      `update password_reset_tokens
       set used_at = now()
       where user_id = $1
         and used_at is null
         and expires_at > now()`,
      [t.user_id],
    )

    await client.query('commit')
    return res.json({ ok: true })
  } catch (e) {
    try {
      await client.query('rollback')
    } catch {}
    throw e
  } finally {
    client.release()
  }
}))

authRouter.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const r = await pool.query(
    'select id, name, email, phone, role, verified, rating, profile_pic, must_change_password, created_at from users where id = $1',
    [req.user.sub],
  )
  if (!r.rows[0]) return res.status(404).json({ message: 'User not found' })
  return res.json(r.rows[0])
}))

const UpdateMeSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional().nullable(),
  profile_pic: z.string().optional().nullable(),
})

authRouter.put('/me', requireAuth, asyncHandler(async (req, res) => {
  const parsed = UpdateMeSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const { name, phone, profile_pic } = parsed.data
  const r = await pool.query(
    `update users
     set name = coalesce($2, name),
         phone = coalesce($3, phone),
         profile_pic = coalesce($4, profile_pic),
         updated_at = now()
     where id = $1
     returning id, name, email, phone, role, verified, rating, profile_pic, must_change_password, created_at`,
    [req.user.sub, name ?? null, phone ?? null, profile_pic ?? null],
  )
  return res.json(r.rows[0])
}))

const SetPasswordSchema = z.object({
  new_password: z.string().min(8),
})

// Used for first-login password setup (e.g., admin bootstrap) and normal password changes.
authRouter.post('/me/password', requireAuth, asyncHandler(async (req, res) => {
  const parsed = SetPasswordSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const passwordHash = await bcrypt.hash(parsed.data.new_password, 10)
  const r = await pool.query(
    `update users
     set password_hash = $2,
         must_change_password = false,
         updated_at = now()
     where id = $1
     returning id, name, email, phone, role, verified, rating, profile_pic, must_change_password, created_at`,
    [req.user.sub, passwordHash],
  )
  if (!r.rows[0]) return res.status(404).json({ message: 'User not found' })
  return res.json({ user: r.rows[0] })
}))

const DeleteMeSchema = z.object({
  confirm: z.string().optional().nullable(),
  reason: z.string().max(2000).optional().nullable(),
})

// "Hard to delete" UX happens on the frontend; backend enforces safety rules.
authRouter.post('/me/delete', requireAuth, asyncHandler(async (req, res) => {
  const parsed = DeleteMeSchema.safeParse(req.body ?? {})
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const confirm = String(parsed.data.confirm ?? '')
  if (confirm.toUpperCase() !== 'DELETE') {
    return res.status(400).json({ message: 'Type DELETE to confirm account deletion.' })
  }

  // Block deletion if the user is involved in any active dispute (as raiser or escrow party).
  const activeDisputes = await pool.query(
    `select d.id
     from disputes d
     join escrow_transactions e on e.id = d.escrow_id
     where d.status in ('open','under_review')
       and (
         d.raised_by_user_id = $1
         or e.buyer_id = $1
         or e.counterparty_user_id = $1
       )
     limit 1`,
    [req.user.sub],
  )
  if (activeDisputes.rowCount > 0) {
    return res.status(409).json({
      message: 'You can’t delete your account while you have an active dispute. Please resolve it first.',
    })
  }

  const userId = req.user.sub
  const deletedEmail = `deleted_${userId}@deleted.local`
  const passwordHash = await bcrypt.hash(bcrypt.genSaltSync(10) + userId, 10)

  const r = await pool.query(
    `update users
     set deleted_at = now(),
         name = 'Deleted user',
         email = $2,
         phone = null,
         profile_pic = null,
         must_change_password = false,
         password_hash = $3,
         updated_at = now()
     where id = $1 and deleted_at is null
     returning id, deleted_at`,
    [userId, deletedEmail, passwordHash],
  )
  if (!r.rows[0]) return res.status(404).json({ message: 'User not found' })

  // Optional: we keep data for audit/escrow integrity; public views will hide deleted users via deleted_at filters.
  return res.json({ ok: true })
}))


