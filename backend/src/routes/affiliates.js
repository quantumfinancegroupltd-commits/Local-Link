import { Router } from 'express'
import crypto from 'node:crypto'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { pool } from '../db/pool.js'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { sendEmail } from '../services/mailer.js'
import { env } from '../config.js'
import { updateAffiliateTier } from '../services/affiliateCommission.js'

export const affiliatesRouter = Router()

const applyRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many applications. Try again later.' },
})

const clickRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many requests.' },
})

const ApplySchema = z.object({
  full_name: z.string().min(1).max(200),
  email: z.string().email(),
  phone: z.string().max(30).optional().nullable(),
  location_city: z.string().max(100).optional().nullable(),
  instagram_handle: z.string().max(100).optional().nullable(),
  tiktok_handle: z.string().max(100).optional().nullable(),
  youtube_channel: z.string().max(200).optional().nullable(),
  website: z.string().url().max(500).optional().nullable().or(z.literal('')),
  whatsapp_group_size: z.string().max(20).optional().nullable(),
  why_affiliate: z.string().max(2000).optional().nullable(),
  how_promote: z.string().max(2000).optional().nullable(),
  estimated_audience_size: z.string().max(100).optional().nullable(),
})

/** Resolve affiliate for current user: by user_id first, then by email */
async function resolveAffiliateForUser(userId, userEmail) {
  const byUser = await pool.query(
    'select * from affiliates where user_id = $1 and status = $2 limit 1',
    [userId, 'approved'],
  )
  if (byUser.rows[0]) return byUser.rows[0]
  if (userEmail) {
    const byEmail = await pool.query(
      'select * from affiliates where lower(email) = $1 and status = $2 limit 1',
      [userEmail.toLowerCase().trim(), 'approved'],
    )
    if (byEmail.rows[0]) {
      await pool.query('update affiliates set user_id = $1, updated_at = now() where id = $2', [
        userId,
        byEmail.rows[0].id,
      ])
      return { ...byEmail.rows[0], user_id: userId }
    }
  }
  return null
}

/** POST /api/affiliates/apply - Public application */
affiliatesRouter.post(
  '/apply',
  applyRateLimit,
  asyncHandler(async (req, res) => {
    const parsed = ApplySchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

    const data = parsed.data
    const email = data.email.toLowerCase().trim()
    const website = data.website === '' ? null : data.website

    const existing = await pool.query(
      'select id, status from affiliates where lower(email) = $1 and status = $2',
      [email, 'pending'],
    )
    if (existing.rows[0]) {
      return res.status(400).json({ message: 'You already have a pending application. We will email you once reviewed.' })
    }

    const r = await pool.query(
      `insert into affiliates (
        full_name, email, phone, location_city, instagram_handle, tiktok_handle,
        youtube_channel, website, whatsapp_group_size, why_affiliate, how_promote, estimated_audience_size, status
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'pending')
      returning id, status, created_at`,
      [
        data.full_name.trim(),
        email,
        data.phone?.trim() || null,
        data.location_city?.trim() || null,
        data.instagram_handle?.trim() || null,
        data.tiktok_handle?.trim() || null,
        data.youtube_channel?.trim() || null,
        website,
        data.whatsapp_group_size?.trim() || null,
        data.why_affiliate?.trim() || null,
        data.how_promote?.trim() || null,
        data.estimated_audience_size?.trim() || null,
      ],
    )
    const row = r.rows[0]
    return res.status(201).json({ id: row.id, status: row.status, message: 'Application received. We will email you once approved.' })
  }),
)

/** POST /api/affiliates/record-click - Public; record referral link click (e.g. from frontend when ?ref=CODE) */
affiliatesRouter.post(
  '/record-click',
  clickRateLimit,
  asyncHandler(async (req, res) => {
    const code = typeof req.body?.ref === 'string' ? req.body.ref.trim().toUpperCase() : null
    if (!code) return res.status(400).json({ message: 'Missing ref (referral code)' })

    const affiliateRow = await pool.query(
      `select a.id from affiliates a
       join affiliate_promo_codes c on c.affiliate_id = a.id
       where a.status = 'approved' and c.code = $1 limit 1`,
      [code],
    )
    if (!affiliateRow.rows[0]) return res.status(200).json({ ok: true, tracked: false })

    const ip = req.ip || req.connection?.remoteAddress || null
    let ipHash = null
    if (ip) {
      try {
        ipHash = crypto.createHash('sha256').update(ip + (env.AFFILIATE_CLICK_SALT || '')).digest('hex').slice(0, 32)
      } catch {
        /* ignore */
      }
    }
    const userAgent = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'].slice(0, 500) : null

    await pool.query(
      `insert into referral_clicks (affiliate_id, referral_code, ip_address, ip_hash, user_agent)
       values ($1,$2,$3::inet,$4,$5)`,
      [affiliateRow.rows[0].id, code, ip || null, ipHash, userAgent],
    )
    return res.status(200).json({ ok: true, tracked: true })
  }),
)

/** GET /api/affiliates/dashboard - Auth; stats for approved affiliate */
affiliatesRouter.get(
  '/dashboard',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user?.sub
    const userRow = await pool.query('select email from users where id = $1', [userId])
    const userEmail = userRow.rows[0]?.email ?? null
    const affiliate = await resolveAffiliateForUser(userId, userEmail)
    if (!affiliate) {
      return res.status(403).json({
        message: 'Not an approved affiliate. Apply at /affiliates and wait for approval.',
        approved: false,
      })
    }

    await updateAffiliateTier(pool, affiliate.id)
    await pool.query(
      `update commissions set status = 'approved' where affiliate_id = $1 and status = 'pending' and period_end + interval '30 days' < current_date`,
      [affiliate.id],
    )
    const affiliateRow = await pool.query('select tier_level, commission_rate, total_earned from affiliates where id = $1', [affiliate.id])
    const affiliateUpdated = affiliateRow.rows[0] ? { ...affiliate, ...affiliateRow.rows[0] } : affiliate
    const aid = affiliateUpdated.id
    const [clicks, signups, activeUsers, commissions, promoList, payoutsList, tierCount] = await Promise.all([
      pool.query('select count(*)::int as n from referral_clicks where affiliate_id = $1', [aid]),
      pool.query('select count(*)::int as n from users where affiliate_id = $1 and deleted_at is null', [aid]),
      pool.query(
        `select count(*)::int as n from users u
         where u.affiliate_id = $1 and u.deleted_at is null
         and (exists (select 1 from escrows e where e.counterparty_user_id = u.id and e.status in ('released','refunded'))
              or exists (select 1 from orders o where o.buyer_id = u.id or o.farmer_id = u.id))`,
        [aid],
      ),
      pool.query(
        `select
          coalesce(sum(amount) filter (where status = 'pending'), 0)::numeric(12,2) as pending,
          coalesce(sum(amount) filter (where status = 'approved'), 0)::numeric(12,2) as approved,
          coalesce(sum(amount) filter (where status = 'paid'), 0)::numeric(12,2) as paid
         from commissions where affiliate_id = $1`,
        [aid],
      ),
      pool.query(
        'select id, code, description, created_at from affiliate_promo_codes where affiliate_id = $1 order by created_at desc',
        [aid],
      ),
      pool.query(
        'select id, amount, method, status, requested_at, paid_at from payouts where affiliate_id = $1 order by requested_at desc limit 20',
        [aid],
      ),
      pool.query(
        `select count(*)::int as n from users u
         where u.affiliate_id = $1 and u.deleted_at is null
         and (exists (select 1 from escrows e where e.counterparty_user_id = u.id and e.status in ('released','refunded'))
              or exists (select 1 from orders o where (o.buyer_id = u.id or o.farmer_id = u.id)))`,
        [aid],
      ),
    ])

    const activeCount = Number(activeUsers.rows[0]?.n ?? 0)
    const tierLevel = affiliateUpdated.tier_level
    const commissionRate = Number(affiliateUpdated.commission_rate ?? 0.07)
    const tierThresholds = [10, 25, 50]
    const nextTier = tierThresholds.find((t) => t > activeCount) ?? 50
    const currentTierUsers = tierThresholds[tierLevel - 1] ?? 10

    return res.json({
      approved: true,
      affiliate: {
        id: affiliateUpdated.id,
        tier_level: tierLevel,
        commission_rate: commissionRate,
        total_earned: Number(affiliateUpdated.total_earned ?? 0),
      },
      stats: {
        total_clicks: clicks.rows[0]?.n ?? 0,
        total_signups: signups.rows[0]?.n ?? 0,
        active_users: activeCount,
        commission_pending: Number(commissions.rows[0]?.pending ?? 0),
        commission_approved: Number(commissions.rows[0]?.approved ?? 0),
        commission_paid: Number(commissions.rows[0]?.paid ?? 0),
      },
      tier_progress: {
        current_tier_users: currentTierUsers,
        next_tier_at: nextTier,
        users_this_period: activeCount,
      },
      promo_codes: promoList.rows,
      payouts: payoutsList.rows,
      min_payout: 50,
    })
  }),
)

/** GET /api/affiliates/analytics - Time-series for charts (clicks, signups, commission by day) */
affiliatesRouter.get(
  '/analytics',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user?.sub
    const userRow = await pool.query('select email from users where id = $1', [userId])
    const userEmail = userRow.rows[0]?.email ?? null
    const affiliate = await resolveAffiliateForUser(userId, userEmail)
    if (!affiliate) return res.status(403).json({ message: 'Not an approved affiliate' })

    const days = Math.min(90, Math.max(7, Number(req.query.days) || 30))
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    const aid = affiliate.id

    const [clicksByDay, signupsByDay, commissionByDay] = await Promise.all([
      pool.query(
        `select date_trunc('day', created_at at time zone 'UTC')::date as day, count(*)::int as count
         from referral_clicks where affiliate_id = $1 and created_at >= $2
         group by 1 order by 1`,
        [aid, since],
      ),
      pool.query(
        `select date_trunc('day', created_at at time zone 'UTC')::date as day, count(*)::int as count
         from users where affiliate_id = $1 and deleted_at is null and created_at >= $2
         group by 1 order by 1`,
        [aid, since],
      ),
      pool.query(
        `select date_trunc('day', created_at at time zone 'UTC')::date as day, coalesce(sum(amount), 0)::numeric(12,2) as amount
         from commissions where affiliate_id = $1 and created_at >= $2
         group by 1 order by 1`,
        [aid, since],
      ),
    ])

    const dayMap = {}
    for (let d = 0; d < days; d++) {
      const t = new Date(since)
      t.setUTCDate(t.getUTCDate() + d)
      const key = t.toISOString().slice(0, 10)
      dayMap[key] = { day: key, clicks: 0, signups: 0, commission: 0 }
    }
    clicksByDay.rows.forEach((r) => {
      const key = r.day ? new Date(r.day).toISOString().slice(0, 10) : null
      if (key && dayMap[key]) dayMap[key].clicks = r.count
    })
    signupsByDay.rows.forEach((r) => {
      const key = r.day ? new Date(r.day).toISOString().slice(0, 10) : null
      if (key && dayMap[key]) dayMap[key].signups = r.count
    })
    commissionByDay.rows.forEach((r) => {
      const key = r.day ? new Date(r.day).toISOString().slice(0, 10) : null
      if (key && dayMap[key]) dayMap[key].commission = Number(r.amount ?? 0)
    })

    const series = Object.keys(dayMap)
      .sort()
      .map((k) => dayMap[k])

    return res.json({ series, days })
  }),
)

/** POST /api/affiliates/promo-codes - Create promo code (approved affiliates only) */
const CreatePromoSchema = z.object({
  code: z.string().min(2).max(32).regex(/^[A-Z0-9_]+$/i, 'Code must be letters, numbers, underscores'),
  description: z.string().max(200).optional().nullable(),
})
affiliatesRouter.post(
  '/promo-codes',
  requireAuth,
  asyncHandler(async (req, res) => {
    const affiliate = await resolveAffiliateForUser(req.user?.sub, req.user?.email)
    if (!affiliate) return res.status(403).json({ message: 'Not an approved affiliate' })

    const parsed = CreatePromoSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

    const code = String(parsed.data.code).trim().toUpperCase()
    const existing = await pool.query('select 1 from affiliate_promo_codes where code = $1', [code])
    if (existing.rows[0]) return res.status(400).json({ message: 'This code is already in use' })

    const r = await pool.query(
      'insert into affiliate_promo_codes (affiliate_id, code, description) values ($1,$2,$3) returning id, code, description, created_at',
      [affiliate.id, code, parsed.data.description?.trim() || null],
    )
    const baseUrl = env.APP_BASE_URL || 'https://locallink.agency'
    const referralLink = `${baseUrl.replace(/\/$/, '')}/register?ref=${encodeURIComponent(code)}`
    return res.status(201).json({ ...r.rows[0], referral_link: referralLink })
  }),
)

/** POST /api/affiliates/request-payout - Request payout (min $50) */
const PayoutSchema = z.object({
  amount: z.number().min(50),
  method: z.enum(['momo', 'bank']),
})
affiliatesRouter.post(
  '/request-payout',
  requireAuth,
  asyncHandler(async (req, res) => {
    const affiliate = await resolveAffiliateForUser(req.user?.sub, req.user?.email)
    if (!affiliate) return res.status(403).json({ message: 'Not an approved affiliate' })

    const parsed = PayoutSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

    const approved = await pool.query(
      "select coalesce(sum(amount), 0)::numeric(12,2) as balance from commissions where affiliate_id = $1 and status = 'approved'",
      [affiliate.id],
    )
    const balance = Number(approved.rows[0]?.balance ?? 0)
    if (balance < parsed.data.amount) {
      return res.status(400).json({ message: `Available balance is $${balance}. Minimum payout is $50.` })
    }

    const r = await pool.query(
      'insert into payouts (affiliate_id, amount, method, status) values ($1,$2,$3,$4) returning id, amount, method, status, requested_at',
      [affiliate.id, parsed.data.amount, parsed.data.method, 'pending'],
    )
    return res.status(201).json(r.rows[0])
  }),
)
