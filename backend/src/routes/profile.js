import crypto from 'node:crypto'
import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { optionalAuth, requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'

function generateReferralCode() {
  return crypto.randomBytes(8).toString('base64url').slice(0, 12).toUpperCase()
}
import { isOffPlatformUrl, maskOffPlatformLinks, maskPhoneNumbers, recordPolicyEvent } from '../services/policy.js'
import { buildWorkHistory } from '../services/workHistory.js'
import { computeExperienceBadges } from '../services/experienceBadges.js'

export const profileRouter = Router()

function publicUserShape(u) {
  if (!u) return null
  const out = {
    id: u.id,
    name: u.name,
    role: u.role,
    company_slug: u.company_slug ?? null,
    verified: u.verified,
    rating: u.rating,
    profile_pic: u.profile_pic,
    trust_score: u.trust_score ?? null,
    verification_tier: u.verification_tier ?? 'unverified',
    last_active_at: u.last_active_at ?? null,
    created_at: u.created_at,
  }
  // Include company data when user owns a company (role or has company_slug)
  if (u.role === 'company' || u.company_slug) {
    out.company_description = u.company_description ?? null
    out.company_industry = u.company_industry ?? null
    out.company_location = u.company_location ?? null
    out.company_size_range = u.company_size_range ?? null
    out.company_website = u.company_website ?? null
    out.company_cover_url = u.company_cover_url ?? null
  }
  return out
}

// Merged display values for cover/logo when user owns a company (use profile + company)
function mergedDisplayForCompanyOwner(user, profile) {
  if (!user?.company_slug) return null
  const cover = user?.company_cover_url || profile?.cover_photo || null
  const logo = user?.profile_pic || null
  if (!cover && !logo) return null
  return { cover, logo }
}

profileRouter.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const userRes = await pool.query(
    `select id, name, email, phone, role, verified, rating, profile_pic, created_at, referral_code
     from users where id = $1`,
    [req.user.sub],
  )
  const user = userRes.rows[0]
  if (!user) return res.status(404).json({ message: 'User not found' })

  // Backfill referral_code for existing users (column added in migration 101)
  if (user.referral_code == null || user.referral_code === '') {
    let code = generateReferralCode()
    for (let i = 0; i < 5; i++) {
      const exists = await pool.query('select 1 from users where referral_code = $1', [code])
      if (!exists.rows[0]) break
      code = generateReferralCode()
    }
    await pool.query('update users set referral_code = $1, updated_at = now() where id = $2', [code, req.user.sub])
    user.referral_code = code
  }

  const profRes = await pool.query('select * from user_profiles where user_id = $1', [req.user.sub])
  const profile = profRes.rows[0] ?? null

  return res.json({ user, profile })
}))

// Verified work history timeline ("professional memory")
profileRouter.get('/me/history', requireAuth, asyncHandler(async (req, res) => {
  const limit = req.query.limit
  const offset = req.query.offset
  const out = await buildWorkHistory(req.user.sub, { role: req.user.role, limit, offset })
  return res.json(out)
}))

profileRouter.get('/me/badges', requireAuth, asyncHandler(async (req, res) => {
  const out = await computeExperienceBadges(req.user.sub)
  if (!out) return res.status(404).json({ message: 'User not found' })
  return res.json(out)
}))

// Public profile view (read-only; no private fields)
profileRouter.get('/:userId', optionalAuth, asyncHandler(async (req, res) => {
  const userRes = await pool.query(
    `select
            u.id,
            coalesce(c.name, u.name) as name,
            u.role,
            c.slug as company_slug,
            u.verified,
            u.rating,
            coalesce(c.logo_url, u.profile_pic) as profile_pic,
            u.trust_score,
            u.last_active_at,
            u.created_at,
            coalesce(v.level, 'unverified') as verification_tier,
            c.description as company_description,
            c.industry as company_industry,
            c.location as company_location,
            c.size_range as company_size_range,
            c.website as company_website,
            c.cover_url as company_cover_url
     from users u
     left join companies c on c.owner_user_id = u.id
     left join verification_levels v on v.user_id = u.id
     where u.id = $1
       and u.deleted_at is null
       and (u.suspended_until is null or u.suspended_until <= now())`,
    [req.params.userId],
  )
  const user = userRes.rows[0]
  if (!user) return res.status(404).json({ message: 'User not found' })

  const targetId = req.params.userId
  const viewerId = req.user?.sub ?? null
  const isAdmin = req.user?.role === 'admin'
  const isOwner = viewerId && String(viewerId) === String(targetId)

  const profRes = await pool.query('select * from user_profiles where user_id = $1', [targetId])
  const profileRaw = profRes.rows[0] ?? null
  const profile =
    profileRaw && Array.isArray(profileRaw.links)
      ? { ...profileRaw, links: profileRaw.links.filter((l) => !isOffPlatformUrl(l?.url)) }
      : profileRaw

  const isPrivate = Boolean(profile?.private_profile)
  if (isPrivate && !isAdmin && !isOwner) {
    if (!viewerId) {
      return res.status(403).json({
        message: 'Login required to view this profile.',
        code: 'LOGIN_REQUIRED',
        preview: publicUserShape(user),
        follow_status: 'none',
      })
    }
    const fr = await pool.query('select status from user_follows where follower_id = $1 and following_id = $2', [viewerId, targetId])
    const st = fr.rows[0]?.status ? String(fr.rows[0].status) : 'none'
    if (st !== 'accepted') {
      return res.status(403).json({
        message: st === 'pending' ? 'Follow request pending.' : 'Follow approval required to view this profile.',
        code: 'FOLLOW_APPROVAL_REQUIRED',
        preview: publicUserShape(user),
        follow_status: st,
      })
    }
  }

  // Record profile view for provider analytics (path identifies which profile was viewed)
  pool
    .query(
      `insert into analytics_events (event_type, path, user_id, created_at)
       values ('profile_view', $1, $2, now())`,
      [`/u/${targetId}`, viewerId],
    )
    .catch(() => {})

  const [postsCountRes, reviewsCountRes, verifiedReviewsCountRes] = await Promise.all([
    pool.query('select count(*)::int as n from user_posts where user_id = $1', [targetId]),
    pool.query('select count(*)::int as n from reviews where target_id = $1', [targetId]),
    pool.query(
      `select count(*)::int as n
       from reviews
       where target_id = $1
         and (job_id is not null or order_id is not null)`,
      [targetId],
    ),
  ])

  // Role-specific public summary (safe fields only)
  let role_profile = null
  if (user.role === 'artisan') {
    const r = await pool.query(
      `select skills, primary_skill, experience_years, service_area, service_place_id, service_lat, service_lng, premium, job_categories
       from artisans where user_id = $1`,
      [req.params.userId],
    )
    role_profile = r.rows[0] ?? null
  } else if (user.role === 'farmer') {
    const r = await pool.query(
      `select farm_location, farm_type, farm_place_id, farm_lat, farm_lng
       from farmers where user_id = $1`,
      [req.params.userId],
    )
    role_profile = r.rows[0] ?? null
  } else if (user.role === 'driver') {
    const r = await pool.query(
      `select vehicle_type, area_of_operation, status
       from drivers where user_id = $1`,
      [req.params.userId],
    )
    // Do not expose internal driver status values directly; just provide the fields for context.
    role_profile = r.rows[0] ? { vehicle_type: r.rows[0].vehicle_type, area_of_operation: r.rows[0].area_of_operation } : null
  } else if (user.role === 'company') {
    role_profile = {
      industry: user.company_industry ?? null,
      location: user.company_location ?? null,
      size_range: user.company_size_range ?? null,
      website: user.company_website ?? null,
    }
  }

  // Lightweight public stats (no money values)
  const stats = {
    posts: Number(postsCountRes.rows[0]?.n ?? 0),
    reviews: Number(reviewsCountRes.rows[0]?.n ?? 0),
    verified_reviews: Number(verifiedReviewsCountRes.rows[0]?.n ?? 0),
  }

  // Transaction counts per role (public, aggregated)
  if (user.role === 'artisan') {
    const r = await pool.query(
      `select
         count(*) filter (where j.status='completed')::int as jobs_completed
       from jobs j
       join artisans a on a.id = j.assigned_artisan_id
       where a.user_id = $1`,
      [req.params.userId],
    )
    stats.jobs_completed = Number(r.rows[0]?.jobs_completed ?? 0)
  } else if (user.role === 'farmer') {
    const r = await pool.query(
      `select
         count(*) filter (where o.order_status='delivered')::int as orders_delivered
       from orders o
       join farmers f on f.id = o.farmer_id
       where f.user_id = $1`,
      [req.params.userId],
    )
    stats.orders_delivered = Number(r.rows[0]?.orders_delivered ?? 0)
  } else if (user.role === 'driver') {
    const r = await pool.query(
      `select
         count(*) filter (where d.status in ('delivered','confirmed'))::int as deliveries_completed
       from deliveries d
       where d.driver_user_id = $1`,
      [req.params.userId],
    )
    stats.deliveries_completed = Number(r.rows[0]?.deliveries_completed ?? 0)
  }

  const shaped = publicUserShape(user)
  const display = mergedDisplayForCompanyOwner(user, profile)
  if (display) {
    shaped.display_cover_url = display.cover || null
    shaped.display_logo_url = display.logo || null
  }
  return res.json({ user: shaped, profile, role_profile, stats })
}))

profileRouter.get('/:userId/badges', optionalAuth, asyncHandler(async (req, res) => {
  const targetId = req.params.userId
  const viewerId = req.user?.sub ?? null
  const isAdmin = req.user?.role === 'admin'
  const isOwner = viewerId && String(viewerId) === String(targetId)
  const profRes = await pool.query('select private_profile from user_profiles where user_id = $1', [targetId]).catch(() => ({ rows: [] }))
  const isPrivate = Boolean(profRes.rows?.[0]?.private_profile)
  if (isPrivate && !isAdmin && !isOwner) {
    if (!viewerId) return res.status(403).json({ message: 'Login required', code: 'LOGIN_REQUIRED' })
    const fr = await pool.query('select status from user_follows where follower_id = $1 and following_id = $2', [viewerId, targetId])
    const st = fr.rows[0]?.status ? String(fr.rows[0].status) : 'none'
    if (st !== 'accepted') return res.status(403).json({ message: 'Follow approval required', code: 'FOLLOW_APPROVAL_REQUIRED', follow_status: st })
  }

  const out = await computeExperienceBadges(targetId)
  if (!out) return res.status(404).json({ message: 'User not found' })
  return res.json(out)
}))

profileRouter.get('/:userId/history', optionalAuth, asyncHandler(async (req, res) => {
  const userRes = await pool.query(
    `select u.id, u.role
     from users u
     where u.id = $1
       and u.deleted_at is null
       and (u.suspended_until is null or u.suspended_until <= now())`,
    [req.params.userId],
  )
  const u = userRes.rows[0]
  if (!u) return res.status(404).json({ message: 'User not found' })

  const targetId = req.params.userId
  const viewerId = req.user?.sub ?? null
  const isAdmin = req.user?.role === 'admin'
  const isOwner = viewerId && String(viewerId) === String(targetId)
  const profRes = await pool.query('select private_profile from user_profiles where user_id = $1', [targetId]).catch(() => ({ rows: [] }))
  const isPrivate = Boolean(profRes.rows?.[0]?.private_profile)
  if (isPrivate && !isAdmin && !isOwner) {
    if (!viewerId) return res.status(403).json({ message: 'Login required', code: 'LOGIN_REQUIRED' })
    const fr = await pool.query('select status from user_follows where follower_id = $1 and following_id = $2', [viewerId, targetId])
    const st = fr.rows[0]?.status ? String(fr.rows[0].status) : 'none'
    if (st !== 'accepted') return res.status(403).json({ message: 'Follow approval required', code: 'FOLLOW_APPROVAL_REQUIRED', follow_status: st })
  }
  const limit = req.query.limit
  const offset = req.query.offset
  const out = await buildWorkHistory(u.id, { role: u.role, limit, offset })
  return res.json(out)
}))

function normalizeUrlMaybe(s) {
  const raw = String(s ?? '').trim()
  if (!raw) return raw
  // If user enters "facebook.com/..." without scheme, assume https.
  if (!/^https?:\/\//i.test(raw)) return `https://${raw}`
  return raw
}

function normalizeDateStringMaybe(s) {
  const raw = s == null ? null : String(s).trim()
  if (!raw) return null
  // Accept YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  // Accept YYYY-MM (default day=01)
  if (/^\d{4}-\d{2}$/.test(raw)) return `${raw}-01`
  // Accept DD/MM/YYYY or DD-MM-YYYY
  const m1 = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/)
  if (m1) {
    const dd = String(m1[1]).padStart(2, '0')
    const mm = String(m1[2]).padStart(2, '0')
    const yyyy = m1[3]
    return `${yyyy}-${mm}-${dd}`
  }
  // Fallback: try Date parse, then format YYYY-MM-DD if valid
  const t = new Date(raw).getTime()
  if (Number.isFinite(t)) {
    const d = new Date(t)
    const yyyy = String(d.getUTCFullYear())
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(d.getUTCDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }
  return raw // let zod reject with a clear issue
}

const LinkSchema = z.object({
  label: z.string().min(1).max(40),
  url: z.preprocess((v) => normalizeUrlMaybe(v), z.string().url()),
})

const UpdateProfileSchema = z.object({
  bio: z.string().max(2000).optional().nullable(),
  cover_photo: z.string().optional().nullable(),
  links: z.array(LinkSchema).optional().nullable(),
  private_profile: z.boolean().optional().nullable(),
})

profileRouter.put('/me', requireAuth, asyncHandler(async (req, res) => {
  const parsed = UpdateProfileSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const { bio, cover_photo, links, private_profile } = parsed.data

  // Merge semantics: omitted fields should not wipe existing profile fields.
  const existing = await pool.query('select bio, cover_photo, links, private_profile from user_profiles where user_id = $1', [req.user.sub])
  const prev = existing.rows[0] ?? null

  const nextBio = bio === undefined ? (prev?.bio ?? null) : (bio ?? null)
  const nextCover = cover_photo === undefined ? (prev?.cover_photo ?? null) : (cover_photo ?? null)
  const nextLinks = links === undefined ? (prev?.links ?? null) : (links ?? null)
  const nextPrivate = private_profile === undefined ? Boolean(prev?.private_profile) : Boolean(private_profile)

  // Only validate off-platform link rules when links are being modified.
  const blockedLinks = Array.isArray(nextLinks) && links !== undefined ? nextLinks.filter((l) => isOffPlatformUrl(l.url)) : []
  if (blockedLinks.length) {
    await recordPolicyEvent({
      userId: req.user.sub,
      kind: 'off_platform_link',
      contextType: 'profile',
      contextId: null,
      meta: { blocked: true, count: blockedLinks.length },
    }).catch(() => {})
    return res.status(400).json({ message: 'Remove WhatsApp links from your profile. Keep communication on LocalLink until a transaction is secured.' })
  }

  const maskedPhone = nextBio != null ? maskPhoneNumbers(nextBio) : { text: nextBio, changed: false }
  const maskedLinks = maskedPhone.text != null ? maskOffPlatformLinks(maskedPhone.text) : { text: maskedPhone.text, changed: false }
  if (maskedPhone.changed) {
    await recordPolicyEvent({ userId: req.user.sub, kind: 'phone_leak', contextType: 'profile', contextId: null, meta: { masked: true } }).catch(
      () => {},
    )
  }
  if (maskedLinks.changed) {
    await recordPolicyEvent({ userId: req.user.sub, kind: 'off_platform_link', contextType: 'profile', contextId: null, meta: { masked: true } }).catch(
      () => {},
    )
  }

  const linksJson = nextLinks == null ? null : JSON.stringify(nextLinks)
  const r = await pool.query(
    `insert into user_profiles (user_id, bio, cover_photo, links, private_profile, updated_at)
     values ($1,$2,$3,$4::jsonb,$5,now())
     on conflict (user_id) do update set
       bio = excluded.bio,
       cover_photo = excluded.cover_photo,
       links = excluded.links,
       private_profile = excluded.private_profile,
       updated_at = now()
     returning *`,
    [req.user.sub, maskedLinks.text ?? null, nextCover ?? null, linksJson, nextPrivate],
  )
  return res.json(r.rows[0])
}))

// --- LinkedIn-style resume / landing page entries ---
const ResumeKind = z.enum(['experience', 'education', 'certification', 'qualification', 'award'])
const UploadUrl = z
  .string()
  .max(600)
  .refine((s) => /^\/api\/uploads\/[a-zA-Z0-9._-]+$/.test(String(s)), { message: 'Invalid media url' })
const ResumeMediaSchema = z
  .object({
    url: UploadUrl,
    thumb_url: z
      .string()
      .max(600)
      .optional()
      .nullable()
      .refine((s) => s == null || /^\/api\/uploads\/[a-zA-Z0-9._-]+$/.test(String(s)), { message: 'Invalid thumb url' }),
    kind: z.enum(['image', 'video', 'other']).optional().nullable(),
    mime: z.string().max(120).optional().nullable(),
    size: z.number().int().min(0).optional().nullable(),
    original_name: z.string().max(300).optional().nullable(),
  })
  .passthrough()
const ResumeEntrySchema = z.object({
  kind: ResumeKind,
  org_name: z.string().max(200).optional().nullable(),
  title: z.string().max(200).optional().nullable(),
  field: z.string().max(200).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  start_date: z.preprocess((v) => normalizeDateStringMaybe(v), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional().nullable(),
  end_date: z.preprocess((v) => normalizeDateStringMaybe(v), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional().nullable(),
  description: z.string().max(4000).optional().nullable(),
  url: z.preprocess((v) => (v == null ? null : normalizeUrlMaybe(v)), z.string().url()).optional().nullable(),
  media: z.array(ResumeMediaSchema).max(3).optional().nullable(),
  sort_order: z.number().int().min(0).max(1000).optional().nullable(),
})

profileRouter.get('/me/resume', requireAuth, asyncHandler(async (req, res) => {
  const r = await pool.query(
    `select
       id, user_id, kind, org_name, title, field, location, media,
       start_date::text as start_date,
       end_date::text as end_date,
       description, url, sort_order, created_at, updated_at
     from user_resume_entries
     where user_id = $1
     order by kind asc, sort_order asc, start_date desc nulls last, created_at desc`,
    [req.user.sub],
  )
  return res.json(r.rows)
}))

profileRouter.get('/:userId/resume', optionalAuth, asyncHandler(async (req, res) => {
  const userRes = await pool.query('select id from users where id = $1 and deleted_at is null', [req.params.userId])
  if (!userRes.rows[0]) return res.status(404).json({ message: 'User not found' })

  const targetId = req.params.userId
  const viewerId = req.user?.sub ?? null
  const isAdmin = req.user?.role === 'admin'
  const isOwner = viewerId && String(viewerId) === String(targetId)
  const profRes = await pool.query('select private_profile from user_profiles where user_id = $1', [targetId]).catch(() => ({ rows: [] }))
  const isPrivate = Boolean(profRes.rows?.[0]?.private_profile)
  if (isPrivate && !isAdmin && !isOwner) {
    if (!viewerId) return res.status(403).json({ message: 'Login required', code: 'LOGIN_REQUIRED' })
    const fr = await pool.query('select status from user_follows where follower_id = $1 and following_id = $2', [viewerId, targetId])
    const st = fr.rows[0]?.status ? String(fr.rows[0].status) : 'none'
    if (st !== 'accepted') return res.status(403).json({ message: 'Follow approval required', code: 'FOLLOW_APPROVAL_REQUIRED', follow_status: st })
  }

  const r = await pool.query(
    `select
       id, user_id, kind, org_name, title, field, location, media,
       start_date::text as start_date,
       end_date::text as end_date,
       description, url, sort_order, created_at, updated_at
     from user_resume_entries
     where user_id = $1
     order by kind asc, sort_order asc, start_date desc nulls last, created_at desc`,
    [targetId],
  )
  return res.json(r.rows)
}))

profileRouter.post('/me/resume', requireAuth, asyncHandler(async (req, res) => {
  const parsed = ResumeEntrySchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const d = parsed.data
  const mediaJson = d.media == null ? null : JSON.stringify(d.media)
  const r = await pool.query(
    `insert into user_resume_entries (user_id, kind, org_name, title, field, location, start_date, end_date, description, url, media, sort_order, updated_at)
     values ($1,$2,$3,$4,$5,$6,$7::date,$8::date,$9,$10,$11::jsonb,$12, now())
     returning
       id, user_id, kind, org_name, title, field, location, media,
       start_date::text as start_date,
       end_date::text as end_date,
       description, url, sort_order, created_at, updated_at`,
    [
      req.user.sub,
      d.kind,
      d.org_name ?? null,
      d.title ?? null,
      d.field ?? null,
      d.location ?? null,
      d.start_date ?? null,
      d.end_date ?? null,
      d.description ?? null,
      d.url ?? null,
      mediaJson,
      d.sort_order ?? 0,
    ],
  )
  return res.status(201).json(r.rows[0])
}))

profileRouter.put('/me/resume/:id', requireAuth, asyncHandler(async (req, res) => {
  const parsed = ResumeEntrySchema.partial().safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const d = parsed.data
  const mediaJson = d.media === undefined ? undefined : d.media == null ? null : JSON.stringify(d.media)
  const r = await pool.query(
    `update user_resume_entries
     set kind = coalesce($3, kind),
         org_name = coalesce($4, org_name),
         title = coalesce($5, title),
         field = coalesce($6, field),
         location = coalesce($7, location),
         start_date = coalesce($8::date, start_date),
         end_date = coalesce($9::date, end_date),
         description = coalesce($10, description),
         url = coalesce($11, url),
         media = coalesce($12::jsonb, media),
         sort_order = coalesce($13, sort_order),
         updated_at = now()
     where id = $1 and user_id = $2
     returning
       id, user_id, kind, org_name, title, field, location, media,
       start_date::text as start_date,
       end_date::text as end_date,
       description, url, sort_order, created_at, updated_at`,
    [
      req.params.id,
      req.user.sub,
      d.kind ?? null,
      d.org_name ?? null,
      d.title ?? null,
      d.field ?? null,
      d.location ?? null,
      d.start_date ?? null,
      d.end_date ?? null,
      d.description ?? null,
      d.url ?? null,
      mediaJson === undefined ? null : mediaJson,
      d.sort_order ?? null,
    ],
  )
  if (!r.rows[0]) return res.status(404).json({ message: 'Resume entry not found' })
  return res.json(r.rows[0])
}))

profileRouter.delete('/me/resume/:id', requireAuth, asyncHandler(async (req, res) => {
  const r = await pool.query('delete from user_resume_entries where id = $1 and user_id = $2', [req.params.id, req.user.sub])
  if (r.rowCount === 0) return res.status(404).json({ message: 'Resume entry not found' })
  return res.json({ ok: true })
}))


