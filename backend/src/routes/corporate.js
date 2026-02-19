import { Router } from 'express'
import { z } from 'zod'
import crypto from 'crypto'
import { pool } from '../db/pool.js'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { notify } from '../services/notifications.js'
import { listOpsAlerts, resolveOpsAlert } from '../services/opsAlerts.js'
import { isOffPlatformUrl, maskOffPlatformLinks, maskPhoneNumbers } from '../services/policy.js'
import { recordPolicyEvent } from '../services/policy.js'
import { generateShiftSeries } from '../services/workforce.js'

export const corporateRouter = Router()

function sha256Hex(s) {
  return crypto.createHash('sha256').update(String(s)).digest('hex')
}

function newCheckinCode() {
  // Simple numeric code suitable for QR/code entry.
  // 6 digits keeps it usable while still preventing casual guessing.
  const n = crypto.randomInt(100000, 1000000)
  return String(n)
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (Number(d) * Math.PI) / 180
  const R = 6371
  const dLat = toRad(Number(lat2) - Number(lat1))
  const dLon = toRad(Number(lon2) - Number(lon1))
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

async function requireCompanyIdForOwnerUserId(ownerUserId) {
  // Enterprise Mode: company access may be via membership (not only owner_user_id).
  // Fallback gracefully if the membership table isn't migrated yet.
  try {
    const m = await pool.query('select company_id from company_members where user_id = $1 limit 1', [ownerUserId])
    const companyId = m.rows[0]?.company_id ?? null
    if (companyId) return companyId
  } catch (e) {
    if (String(e?.code || '') !== '42P01') throw e // undefined_table
  }
  const c = await pool.query('select id from companies where owner_user_id = $1 limit 1', [ownerUserId])
  const companyId = c.rows[0]?.id ?? null
  if (!companyId) return null
  return companyId
}

const CompanyIdParam = z.string().uuid()

async function resolveCompanyIdForReq(req) {
  // Allows multi-company users to specify context via ?company_id=...
  // Admin can also use ?company_id=... or legacy ?user_id=...
  const requested = req.query?.company_id != null ? String(req.query.company_id).trim() : ''
  if (requested) {
    const parsed = CompanyIdParam.safeParse(requested)
    if (!parsed.success) return { ok: false, code: 'INVALID_COMPANY_ID' }
    const companyId = parsed.data
    if (req.user?.role === 'admin') return { ok: true, companyId }
    try {
      const r = await pool.query('select 1 from company_members where company_id = $1 and user_id = $2 limit 1', [companyId, req.user?.sub])
      if (r.rowCount) return { ok: true, companyId }
      // Owner may not be in company_members yet (e.g. seed-created company); allow if they own the company.
      const o = await pool.query('select 1 from companies where id = $1 and owner_user_id = $2 limit 1', [companyId, req.user?.sub])
      if (o.rowCount) return { ok: true, companyId }
      return { ok: false, code: 'NOT_A_MEMBER' }
    } catch (e) {
      if (String(e?.code || '') !== '42P01') throw e
      const o = await pool.query('select 1 from companies where id = $1 and owner_user_id = $2 limit 1', [companyId, req.user?.sub])
      if (!o.rowCount) return { ok: false, code: 'NOT_A_MEMBER' }
      return { ok: true, companyId }
    }
  }

  if (req.user?.role === 'admin') {
    const legacyUserId = req.query?.user_id != null ? String(req.query.user_id).trim() : ''
    if (legacyUserId) {
      const c = await pool.query('select id from companies where owner_user_id = $1 limit 1', [legacyUserId])
      const companyId = c.rows[0]?.id ?? null
      if (!companyId) return { ok: true, companyId: null }
      return { ok: true, companyId }
    }
  }

  const companyId = await requireCompanyIdForOwnerUserId(req.user?.sub)
  return { ok: true, companyId }
}

async function workspaceRoleForUserInCompany(userId, companyId) {
  if (!userId || !companyId) return null
  try {
    const r = await pool.query(
      `select workspace_role
       from company_members
       where user_id = $1 and company_id = $2
       limit 1`,
      [userId, companyId],
    )
    const role = r.rows[0]?.workspace_role ? String(r.rows[0].workspace_role) : null
    if (role) return role
  } catch (e) {
    if (String(e?.code || '') !== '42P01') throw e
    // Membership table not ready; treat as owner-style access.
    return 'owner'
  }
  // Fallback: if you own the company, you're owner.
  const o = await pool.query('select 1 from companies where id = $1 and owner_user_id = $2 limit 1', [companyId, userId])
  if (o.rowCount) return 'owner'
  return null
}

async function logCompanyAudit(req, { companyId, action, targetType = null, targetId = null, meta = null }) {
  if (!companyId || !action) return
  try {
    await pool.query(
      `insert into company_audit_logs (company_id, actor_user_id, action, target_type, target_id, meta, ip, user_agent)
       values ($1,$2,$3,$4,$5,$6::jsonb,$7,$8)`,
      [
        companyId,
        req?.user?.sub ?? null,
        String(action),
        targetType ? String(targetType) : null,
        targetId != null ? String(targetId) : null,
        meta ? JSON.stringify(meta) : null,
        String(req.headers['x-forwarded-for'] || req.ip || ''),
        String(req.headers['user-agent'] || ''),
      ],
    )
  } catch (e) {
    // If not migrated yet, ignore in production to avoid breaking workflows.
    if (String(e?.code || '') === '42P01') return
    // Also ignore payload issues (best-effort logging).
    if (String(e?.code || '') === '22P02') return
    // Otherwise, don't break the request.
  }
}

async function requireWorkspaceRole(req, res, companyId, allowedRoles) {
  if (req.user?.role === 'admin') return { ok: true, role: 'admin' }
  if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) return { ok: true, role: null }
  const role = await workspaceRoleForUserInCompany(req.user?.sub, companyId)
  if (!role || !allowedRoles.includes(role)) {
    res.status(403).json({ message: 'Forbidden' })
    return { ok: false, role }
  }
  return { ok: true, role }
}

function slugify(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

async function uniqueSlug(base) {
  const raw = slugify(base) || 'company'
  let candidate = raw
  for (let i = 0; i < 30; i++) {
    const r = await pool.query('select 1 from companies where slug = $1 limit 1', [candidate])
    if (r.rowCount === 0) return candidate
    candidate = `${raw}-${Math.floor(Math.random() * 9000 + 1000)}`
  }
  return `${raw}-${Date.now()}`
}

// Public job board
corporateRouter.get('/jobs', asyncHandler(async (req, res) => {
  const q = String(req.query.q ?? '').trim().toLowerCase()
  const companySlug = String(req.query.company ?? '').trim().toLowerCase()
  const limit = Math.min(Number(req.query.limit) || 50, 200)

  const r = await pool.query(
    `select jp.*,
            c.name as company_name,
            c.slug as company_slug,
            c.logo_url as company_logo_url,
            c.location as company_location
     from job_posts jp
     join companies c on c.id = jp.company_id
     where jp.status = 'open'
       and ($2 = '' or lower(c.slug) = $2)
     order by jp.created_at desc
     limit $1`,
    [limit, companySlug],
  )

  let rows = Array.isArray(r.rows) ? r.rows : []
  if (q) {
    rows = rows.filter((row) => {
      const hay = [
        row?.title,
        row?.description,
        row?.location,
        row?.employment_type,
        row?.work_mode,
        row?.company_name,
        row?.company_location,
        ...(Array.isArray(row?.tags) ? row.tags : []),
      ]
        .filter(Boolean)
        .map((x) => String(x).toLowerCase())
        .join(' ')
      return hay.includes(q)
    })
  }

  return res.json(rows)
}))

// Enterprise Mode: list workspaces user belongs to
corporateRouter.get('/companies/mine', requireAuth, asyncHandler(async (req, res) => {
  const userId = req.user.sub
  try {
    const r = await pool.query(
      `select
         c.id,
         c.slug,
         c.name,
         c.logo_url,
         cm.workspace_role,
         cm.created_at as joined_at
       from company_members cm
       join companies c on c.id = cm.company_id
       where cm.user_id = $1
       order by cm.created_at desc
       limit 50`,
      [userId],
    )
    return res.json(r.rows)
  } catch (e) {
    if (String(e?.code || '') !== '42P01') throw e
    // Fallback (older DB): owner-only
    const r = await pool.query(`select id, slug, name, logo_url, 'owner' as workspace_role, created_at as joined_at from companies where owner_user_id = $1 limit 50`, [
      userId,
    ])
    return res.json(r.rows)
  }
}))

corporateRouter.get('/jobs/:id', asyncHandler(async (req, res) => {
  const r = await pool.query(
    `select jp.*,
            c.name as company_name,
            c.slug as company_slug,
            c.logo_url as company_logo_url,
            c.location as company_location,
            c.website as company_website,
            c.industry as company_industry,
            c.size_range as company_size_range
     from job_posts jp
     join companies c on c.id = jp.company_id
     where jp.id = $1
     limit 1`,
    [req.params.id],
  )
  const row = r.rows[0] ?? null
  if (!row) return res.status(404).json({ message: 'Job not found' })
  if (String(row.status) !== 'open') return res.status(404).json({ message: 'Job not found' })
  return res.json(row)
}))

// Public company page
corporateRouter.get('/companies/:slug', asyncHandler(async (req, res) => {
  const c = await pool.query('select * from companies where slug = $1 limit 1', [req.params.slug])
  let company = c.rows[0] ?? null
  if (!company) return res.status(404).json({ message: 'Company not found' })

  // Use owner profile as fallback so one upload shows on both company page and owner profile
  const ownerId = company.owner_user_id
  if (ownerId) {
    const [ownerRes, profRes] = await Promise.all([
      pool.query('select profile_pic from users where id = $1 limit 1', [ownerId]),
      pool.query('select cover_photo, bio from user_profiles where user_id = $1 limit 1', [ownerId]),
    ])
    const owner = ownerRes.rows[0] ?? null
    const profile = profRes.rows[0] ?? null
    company = {
      ...company,
      cover_url: company.cover_url || profile?.cover_photo || null,
      logo_url: company.logo_url || owner?.profile_pic || null,
      description: company.description || profile?.bio || null,
    }
  }

  const jobs = await pool.query(
    `select id, title, location, employment_type, work_mode, pay_min, pay_max, currency, pay_period, job_term, schedule_text, benefits, tags, status, created_at, closes_at
       from job_posts
       where company_id = $1 and status = 'open'
       order by created_at desc
       limit 50`,
    [company.id],
  ).catch(async (e) => {
    if (String(e?.code || '') !== '42703') throw e
    // Columns not migrated yet (pay_period/job_term/schedule_text/benefits)
    return await pool.query(
      `select id, title, location, employment_type, work_mode, pay_min, pay_max, currency, tags, status, created_at, closes_at
       from job_posts
       where company_id = $1 and status = 'open'
       order by created_at desc
       limit 50`,
      [company.id],
    )
  })

  return res.json({ company, jobs: jobs.rows })
}))

const ProfileLinkSchema = z.object({
  label: z.string().min(1).max(40),
  url: z.string().url().max(500),
})
const UpsertCompanySchema = z.object({
  name: z.string().min(2).max(120),
  industry: z.string().max(120).optional().nullable(),
  size_range: z.string().max(40).optional().nullable(),
  website: z.string().max(300).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  description: z.string().max(4000).optional().nullable(),
  logo_url: z.string().max(2000).optional().nullable(),
  cover_url: z.string().max(2000).optional().nullable(),
  profile_links: z.array(ProfileLinkSchema).max(8).optional().nullable(),
  private_profile: z.boolean().optional(),
})

// --- Enterprise Mode: Workspace members (multi-user) ---
const WorkspaceRoleSchema = z.enum(['owner', 'ops', 'hr', 'finance', 'supervisor', 'auditor'])
const AddMemberSchema = z
  .object({
    user_id: z.string().uuid().optional().nullable(),
    email: z.string().email().max(200).optional().nullable(),
    workspace_role: WorkspaceRoleSchema,
  })
  .refine((v) => Boolean(v.user_id || v.email), { message: 'Provide user_id or email' })

const CreateInviteSchema = z.object({
  email: z.string().email().max(200),
  workspace_role: WorkspaceRoleSchema.default('ops'),
})

// Company: view/update their profile
corporateRouter.get('/company/access', requireAuth, asyncHandler(async (req, res) => {
  const userId = req.user.sub
  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) {
    if (resolved.code === 'INVALID_COMPANY_ID') return res.status(400).json({ message: 'Invalid company_id' })
    return res.status(403).json({ message: 'Forbidden' })
  }
  const companyId = resolved.companyId
  if (!companyId) return res.json({ company_id: null, workspace_role: null, company_slug: null })
  const role = await workspaceRoleForUserInCompany(userId, companyId)
  const c = await pool.query('select slug from companies where id = $1 limit 1', [companyId])
  return res.json({ company_id: companyId, workspace_role: role, company_slug: c.rows[0]?.slug ?? null })
}))

corporateRouter.get('/company/invites', requireAuth, asyncHandler(async (req, res) => {
  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.json({ items: [] })
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'ops'])
  if (!ok.ok) return
  try {
    const r = await pool.query(
      `select id, email, workspace_role, created_at, expires_at, accepted_at, revoked_at
       from company_member_invites
       where company_id = $1
       order by created_at desc
       limit 200`,
      [companyId],
    )
    return res.json({ items: r.rows })
  } catch (e) {
    if (String(e?.code || '') === '42P01') return res.status(400).json({ message: 'Invite tables not ready (run migrations).' })
    throw e
  }
}))

corporateRouter.post('/company/invites', requireAuth, asyncHandler(async (req, res) => {
  const parsed = CreateInviteSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })
  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.status(400).json({ message: 'Create your company profile first.' })
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'ops'])
  if (!ok.ok) return

  const email = String(parsed.data.email).trim().toLowerCase()
  const role = String(parsed.data.workspace_role || 'ops')
  const rawToken = crypto.randomBytes(24).toString('hex')
  const tokenHash = sha256Hex(rawToken)
  const base = String(process.env.APP_BASE_URL || '').trim()
  const claimUrl = `${base || ''}/company/invite?token=${encodeURIComponent(rawToken)}`

  try {
    const r = await pool.query(
      `insert into company_member_invites (company_id, email, workspace_role, token_hash, invited_by)
       values ($1,$2,$3,$4,$5)
       on conflict on constraint uq_company_member_invites_active
       do update set
         workspace_role = excluded.workspace_role,
         token_hash = excluded.token_hash,
         invited_by = excluded.invited_by,
         created_at = now(),
         expires_at = (now() + interval '14 days'),
         revoked_at = null,
         revoked_by = null
       returning id, email, workspace_role, created_at, expires_at`,
      [companyId, email, role, tokenHash, req.user.sub],
    )
    const invite = r.rows[0]
    await logCompanyAudit(req, { companyId, action: 'workspace.invite.create', targetType: 'company_invite', targetId: invite?.id ?? null, meta: { email, workspace_role: role } })
    return res.status(201).json({ invite, claim_url: claimUrl })
  } catch (e) {
    if (String(e?.code || '') === '42P01') return res.status(400).json({ message: 'Invite tables not ready (run migrations).' })
    throw e
  }
}))

corporateRouter.post('/company/invites/:id/revoke', requireAuth, asyncHandler(async (req, res) => {
  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.status(404).json({ message: 'Not found' })
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'ops'])
  if (!ok.ok) return
  try {
    const r = await pool.query(
      `update company_member_invites
       set revoked_at = now(), revoked_by = $3
       where id = $2 and company_id = $1 and accepted_at is null and revoked_at is null
       returning id`,
      [companyId, String(req.params.id), req.user.sub],
    )
    if (!r.rowCount) return res.status(404).json({ message: 'Invite not found' })
    await logCompanyAudit(req, { companyId, action: 'workspace.invite.revoke', targetType: 'company_invite', targetId: String(req.params.id) })
    return res.json({ ok: true })
  } catch (e) {
    if (String(e?.code || '') === '42P01') return res.status(400).json({ message: 'Invite tables not ready (run migrations).' })
    throw e
  }
}))

corporateRouter.post('/company/invites/accept', requireAuth, asyncHandler(async (req, res) => {
  const token = req.body?.token != null ? String(req.body.token) : ''
  const raw = token.trim()
  if (!raw || raw.length < 16) return res.status(400).json({ message: 'Invalid invite token' })
  const tokenHash = sha256Hex(raw)

  const client = await pool.connect()
  try {
    await client.query('begin')
    const invRes = await client.query(
      `select *
       from company_member_invites
       where token_hash = $1
       limit 1
       for update`,
      [tokenHash],
    )
    const inv = invRes.rows[0] ?? null
    if (!inv) {
      await client.query('rollback')
      return res.status(404).json({ message: 'Invite not found' })
    }
    if (inv.revoked_at) {
      await client.query('rollback')
      return res.status(409).json({ message: 'Invite revoked' })
    }
    if (inv.accepted_at) {
      await client.query('rollback')
      return res.status(409).json({ message: 'Invite already accepted' })
    }
    if (inv.expires_at && new Date(inv.expires_at).getTime() < Date.now()) {
      await client.query('rollback')
      return res.status(409).json({ message: 'Invite expired' })
    }

    const uRes = await client.query('select email from users where id = $1 limit 1', [req.user.sub])
    const myEmail = uRes.rows[0]?.email ? String(uRes.rows[0].email).trim().toLowerCase() : ''
    const invEmail = inv.email ? String(inv.email).trim().toLowerCase() : ''
    if (!myEmail || myEmail !== invEmail) {
      await client.query('rollback')
      return res.status(403).json({ message: 'This invite does not match your account email.' })
    }

    await client.query(
      `insert into company_members (company_id, user_id, workspace_role, created_by, updated_at)
       values ($1,$2,$3,$4,now())
       on conflict (company_id, user_id)
       do update set workspace_role = excluded.workspace_role, updated_at = now()`,
      [inv.company_id, req.user.sub, inv.workspace_role, inv.invited_by ?? req.user.sub],
    )

    await client.query(
      `update company_member_invites
       set accepted_at = now(), accepted_by = $2
       where id = $1`,
      [inv.id, req.user.sub],
    )

    await client.query('commit')
    await logCompanyAudit(req, { companyId: inv.company_id, action: 'workspace.invite.accept', targetType: 'company_invite', targetId: inv.id, meta: { email: invEmail, workspace_role: inv.workspace_role } })
    return res.json({ ok: true, company_id: inv.company_id })
  } catch (e) {
    try {
      await client.query('rollback')
    } catch {}
    if (String(e?.code || '') === '42P01') return res.status(400).json({ message: 'Invite tables not ready (run migrations).' })
    throw e
  } finally {
    client.release()
  }
}))

corporateRouter.get('/company/me', requireAuth, asyncHandler(async (req, res) => {
  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) {
    if (req.user.role === 'company' || req.user.role === 'admin') return res.json(null)
    return res.status(403).json({ message: 'Forbidden' })
  }
  if (req.user.role !== 'admin') {
    const role = await workspaceRoleForUserInCompany(req.user.sub, companyId)
    if (!role) return res.status(403).json({ message: 'Forbidden' })
  }
  const r = await pool.query('select * from companies where id = $1 limit 1', [companyId])
  return res.json(r.rows[0] ?? null)
}))

corporateRouter.get('/company/members', requireAuth, asyncHandler(async (req, res) => {
  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.json({ company_id: null, items: [] })
  if (req.user.role !== 'admin') {
    const role = await workspaceRoleForUserInCompany(req.user.sub, companyId)
    if (!role) return res.status(403).json({ message: 'Forbidden' })
  }
  try {
    const r = await pool.query(
      `select
         cm.user_id as id,
         u.name,
         u.email,
         u.role as user_role,
         u.profile_pic,
         cm.workspace_role,
         cm.created_at
       from company_members cm
       join users u on u.id = cm.user_id
       where cm.company_id = $1
       order by
         case cm.workspace_role when 'owner' then 0 when 'ops' then 1 when 'hr' then 2 when 'finance' then 3 when 'supervisor' then 4 when 'auditor' then 5 else 9 end,
         cm.created_at asc`,
      [companyId],
    )
    return res.json({ company_id: companyId, items: r.rows })
  } catch (e) {
    if (String(e?.code || '') === '42P01') return res.status(400).json({ message: 'Workspace tables not ready (run migrations).' })
    throw e
  }
}))

corporateRouter.post('/company/members', requireAuth, asyncHandler(async (req, res) => {
  const parsed = AddMemberSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })
  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.status(400).json({ message: 'Create your company profile first.' })
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'ops'])
  if (!ok.ok) return

  const email = parsed.data.email ? String(parsed.data.email).trim().toLowerCase() : null
  const userId = parsed.data.user_id ? String(parsed.data.user_id) : null
  const role = String(parsed.data.workspace_role)

  const uRes = await pool.query(
    `select id, name, email, role, profile_pic
     from users
     where deleted_at is null
       and (suspended_until is null or suspended_until <= now())
       and ($1::uuid is null or id = $1::uuid)
       and ($2::text is null or lower(email) = $2::text)
     limit 1`,
    [userId, email],
  )
  const u = uRes.rows[0] ?? null
  if (!u) return res.status(404).json({ message: 'User not found (ask them to create an account first).' })
  if (String(u.role) === 'admin') return res.status(400).json({ message: 'Cannot add admin users to a company workspace.' })

  try {
    const ins = await pool.query(
      `insert into company_members (company_id, user_id, workspace_role, created_by, updated_at)
       values ($1,$2,$3,$4,now())
       on conflict (company_id, user_id)
       do update set workspace_role = excluded.workspace_role, updated_at = now()
       returning company_id, user_id, workspace_role`,
      [companyId, u.id, role, req.user.sub],
    )
    await logCompanyAudit(req, { companyId, action: 'workspace.member.upsert', targetType: 'company_member', targetId: u.id, meta: { workspace_role: role } })
    return res.status(201).json(ins.rows[0])
  } catch (e) {
    if (String(e?.code || '') === '42P01') return res.status(400).json({ message: 'Workspace tables not ready (run migrations).' })
    throw e
  }
}))

corporateRouter.put('/company/members/:userId', requireAuth, asyncHandler(async (req, res) => {
  const parsed = z.object({ workspace_role: WorkspaceRoleSchema }).safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })
  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.status(400).json({ message: 'Create your company profile first.' })
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner'])
  if (!ok.ok) return

  const memberUserId = String(req.params.userId)
  const nextRole = String(parsed.data.workspace_role)

  let prevRes
  try {
    prevRes = await pool.query(`select workspace_role from company_members where company_id = $1 and user_id = $2 limit 1`, [
      companyId,
      memberUserId,
    ])
  } catch (e) {
    if (String(e?.code || '') === '42P01') return res.status(400).json({ message: 'Workspace tables not ready (run migrations).' })
    throw e
  }
  const prevRole = prevRes.rows[0]?.workspace_role ? String(prevRes.rows[0].workspace_role) : null
  if (!prevRole) return res.status(404).json({ message: 'Member not found' })

  if (prevRole === 'owner' && nextRole !== 'owner') {
    const owners = await pool.query(
      `select count(*)::int as n from company_members where company_id = $1 and workspace_role = 'owner'`,
      [companyId],
    )
    const n = Number(owners.rows[0]?.n ?? 0)
    if (n <= 1) return res.status(400).json({ message: 'You must keep at least one owner.' })
  }

  let r
  try {
    r = await pool.query(
      `update company_members
       set workspace_role = $3, updated_at = now()
       where company_id = $1 and user_id = $2
       returning company_id, user_id, workspace_role`,
      [companyId, memberUserId, nextRole],
    )
  } catch (e) {
    if (String(e?.code || '') === '42P01') return res.status(400).json({ message: 'Workspace tables not ready (run migrations).' })
    throw e
  }
  await logCompanyAudit(req, { companyId, action: 'workspace.member.role.update', targetType: 'company_member', targetId: memberUserId, meta: { workspace_role: nextRole } })
  return res.json(r.rows[0])
}))

corporateRouter.delete('/company/members/:userId', requireAuth, asyncHandler(async (req, res) => {
  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.status(400).json({ message: 'Create your company profile first.' })
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner'])
  if (!ok.ok) return

  const memberUserId = String(req.params.userId)
  let prevRes
  try {
    prevRes = await pool.query(`select workspace_role from company_members where company_id = $1 and user_id = $2 limit 1`, [
      companyId,
      memberUserId,
    ])
  } catch (e) {
    if (String(e?.code || '') === '42P01') return res.status(400).json({ message: 'Workspace tables not ready (run migrations).' })
    throw e
  }
  const prevRole = prevRes.rows[0]?.workspace_role ? String(prevRes.rows[0].workspace_role) : null
  if (!prevRole) return res.status(404).json({ message: 'Member not found' })
  if (prevRole === 'owner') {
    const owners = await pool.query(
      `select count(*)::int as n from company_members where company_id = $1 and workspace_role = 'owner'`,
      [companyId],
    )
    const n = Number(owners.rows[0]?.n ?? 0)
    if (n <= 1) return res.status(400).json({ message: 'You must keep at least one owner.' })
  }

  try {
    await pool.query('delete from company_members where company_id = $1 and user_id = $2', [companyId, memberUserId])
  } catch (e) {
    if (String(e?.code || '') === '42P01') return res.status(400).json({ message: 'Workspace tables not ready (run migrations).' })
    throw e
  }
  await logCompanyAudit(req, { companyId, action: 'workspace.member.remove', targetType: 'company_member', targetId: memberUserId })
  return res.json({ ok: true })
}))

corporateRouter.get('/company/audit', requireAuth, asyncHandler(async (req, res) => {
  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.json({ items: [], next_before: null })
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'ops', 'finance', 'auditor'])
  if (!ok.ok) return

  const limitRaw = req.query.limit == null ? 50 : Number(req.query.limit)
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, limitRaw)) : 50
  const before = req.query.before ? String(req.query.before) : null

  try {
    const r = await pool.query(
      `select
         l.*,
         u.name as actor_name,
         u.email as actor_email
       from company_audit_logs l
       left join users u on u.id = l.actor_user_id
       where l.company_id = $1
         and ($2::timestamptz is null or l.created_at < $2::timestamptz)
       order by l.created_at desc
       limit $3`,
      [companyId, before, limit + 1],
    )
    const rows = Array.isArray(r.rows) ? r.rows : []
    const items = rows.slice(0, limit)
    const nextBefore = rows.length > limit ? items[items.length - 1]?.created_at : null
    return res.json({ items, next_before: nextBefore })
  } catch (e) {
    if (String(e?.code || '') === '42P01') return res.json({ items: [], next_before: null })
    throw e
  }
}))

corporateRouter.post('/company/me', requireAuth, asyncHandler(async (req, res) => {
  const parsed = UpsertCompanySchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const ownerUserId = req.user.sub
  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId

  if (companyId) {
    const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'ops', 'hr'])
    if (!ok.ok) return
    const r = await pool.query(
      `update companies
       set name = $2,
           industry = $3,
           size_range = $4,
           website = $5,
           location = $6,
           description = $7,
           logo_url = $8,
           cover_url = $9,
           updated_at = now()
       where id = $1
       returning *`,
      [
        companyId,
        parsed.data.name,
        parsed.data.industry ?? null,
        parsed.data.size_range ?? null,
        parsed.data.website ?? null,
        parsed.data.location ?? null,
        parsed.data.description ?? null,
        parsed.data.logo_url ?? null,
        parsed.data.cover_url ?? null,
      ],
    )
    const company = r.rows[0]
    // Sync to owner's user profile so the same cover/bio/links show on both company page and owner profile
    if (company?.owner_user_id) {
      const profileLinks =
        parsed.data.profile_links !== undefined
          ? (Array.isArray(parsed.data.profile_links) ? parsed.data.profile_links : []).filter((l) => l?.label && l?.url)
          : undefined
      if (profileLinks !== undefined) {
        const blockedLinks = profileLinks.filter((l) => isOffPlatformUrl(l.url))
        if (blockedLinks.length) {
          await recordPolicyEvent({
            userId: company.owner_user_id,
            kind: 'off_platform_link',
            contextType: 'profile',
            contextId: null,
            meta: { blocked: true, count: blockedLinks.length },
          }).catch(() => {})
          return res.status(400).json({ message: 'Remove WhatsApp links from your profile. Keep communication on LocalLink until a transaction is secured.' })
        }
      }
      const linksJson = profileLinks !== undefined ? JSON.stringify(profileLinks) : null
      const nextPrivate = parsed.data.private_profile === undefined ? undefined : Boolean(parsed.data.private_profile)
      const prevProf = await pool.query('select private_profile from user_profiles where user_id = $1 limit 1', [company.owner_user_id]).catch(() => ({ rows: [] }))
      const privateVal = nextPrivate === undefined ? (prevProf.rows[0]?.private_profile ?? false) : nextPrivate
      await pool.query(
        `insert into user_profiles (user_id, bio, cover_photo, links, private_profile, updated_at)
         values ($1, $2, $3, $4::jsonb, $5, now())
         on conflict (user_id) do update set
           bio = excluded.bio,
           cover_photo = excluded.cover_photo,
           links = case when $4 is not null then excluded.links else user_profiles.links end,
           private_profile = excluded.private_profile,
           updated_at = now()`,
        [company.owner_user_id, parsed.data.description ?? null, parsed.data.cover_url ?? null, linksJson, privateVal],
      ).catch(() => {})
    }
    await logCompanyAudit(req, { companyId, action: 'company.profile.update', targetType: 'company', targetId: companyId })
    return res.json(company)
  }

  // No workspace yet: only company-role accounts can create a new company profile.
  if (req.user.role !== 'company') return res.status(403).json({ message: 'Forbidden' })
  // Treat as "create my company profile" (owner account).
  const existing = await pool.query('select * from companies where owner_user_id = $1 limit 1', [ownerUserId])
  const prev = existing.rows[0] ?? null
  const slug = prev?.slug ?? (await uniqueSlug(parsed.data.name))

  const r = await pool.query(
    `insert into companies (owner_user_id, slug, name, industry, size_range, website, location, description, logo_url, cover_url, updated_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now())
     on conflict (owner_user_id)
     do update set
       name = excluded.name,
       industry = excluded.industry,
       size_range = excluded.size_range,
       website = excluded.website,
       location = excluded.location,
       description = excluded.description,
       logo_url = excluded.logo_url,
       cover_url = excluded.cover_url,
       updated_at = now()
     returning *`,
    [
      ownerUserId,
      slug,
      parsed.data.name,
      parsed.data.industry ?? null,
      parsed.data.size_range ?? null,
      parsed.data.website ?? null,
      parsed.data.location ?? null,
      parsed.data.description ?? null,
      parsed.data.logo_url ?? null,
      parsed.data.cover_url ?? null,
    ],
  )
  const company = r.rows[0]
  try {
    await pool.query(
      `insert into company_members (company_id, user_id, workspace_role, created_by)
       values ($1,$2,'owner',$2)
       on conflict do nothing`,
      [company.id, ownerUserId],
    )
  } catch (e) {
    if (String(e?.code || '') !== '42P01') throw e
  }
  // Sync to owner's user profile so the same cover/bio/links show on both company page and owner profile
  const profileLinks =
    parsed.data.profile_links !== undefined
      ? (Array.isArray(parsed.data.profile_links) ? parsed.data.profile_links : []).filter((l) => l?.label && l?.url)
      : undefined
  if (profileLinks !== undefined) {
    const blockedLinks = profileLinks.filter((l) => isOffPlatformUrl(l.url))
    if (blockedLinks.length) {
      await recordPolicyEvent({
        userId: ownerUserId,
        kind: 'off_platform_link',
        contextType: 'profile',
        contextId: null,
        meta: { blocked: true, count: blockedLinks.length },
      }).catch(() => {})
      return res.status(400).json({ message: 'Remove WhatsApp links from your profile. Keep communication on LocalLink until a transaction is secured.' })
    }
  }
  const linksJson = profileLinks !== undefined ? JSON.stringify(profileLinks) : null
  const nextPrivate = parsed.data.private_profile === undefined ? undefined : Boolean(parsed.data.private_profile)
  const prevProf = await pool.query('select private_profile from user_profiles where user_id = $1 limit 1', [ownerUserId]).catch(() => ({ rows: [] }))
  const privateVal = nextPrivate === undefined ? (prevProf.rows[0]?.private_profile ?? false) : nextPrivate
  await pool.query(
    `insert into user_profiles (user_id, bio, cover_photo, links, private_profile, updated_at)
     values ($1, $2, $3, $4::jsonb, $5, now())
     on conflict (user_id) do update set
       bio = excluded.bio,
       cover_photo = excluded.cover_photo,
       links = case when $4 is not null then excluded.links else user_profiles.links end,
       private_profile = excluded.private_profile,
       updated_at = now()`,
    [ownerUserId, parsed.data.description ?? null, parsed.data.cover_url ?? null, linksJson, privateVal],
  ).catch(() => {})
  await logCompanyAudit(req, { companyId: company.id, action: 'company.profile.create', targetType: 'company', targetId: company.id })
  return res.json(company)
}))

const CreateJobSchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().min(10).max(20_000),
  location: z.string().max(200).optional().nullable(),
  employment_type: z.enum(['full_time', 'part_time', 'contract', 'shift', 'internship']).optional().nullable(),
  work_mode: z.enum(['onsite', 'remote', 'hybrid']).optional().nullable(),
  pay_min: z.number().nonnegative().optional().nullable(),
  pay_max: z.number().nonnegative().optional().nullable(),
  currency: z.string().max(8).optional().nullable(),
  pay_period: z.enum(['hour', 'day', 'week', 'month', 'year', 'shift']).optional().nullable(),
  job_term: z.enum(['permanent', 'temporary', 'contract', 'internship']).optional().nullable(),
  schedule_text: z.string().max(200).optional().nullable(),
  benefits: z.array(z.string().max(80)).max(30).optional().nullable(),
  tags: z.array(z.string().max(40)).max(20).optional().nullable(),
  closes_at: z.string().datetime().optional().nullable(),
})

corporateRouter.get('/company/jobs', requireAuth, asyncHandler(async (req, res) => {
  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.json([])
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'ops', 'hr'])
  if (!ok.ok) return
  const r = await pool.query('select * from job_posts where company_id = $1 order by created_at desc limit 200', [companyId])
  return res.json(r.rows)
}))

corporateRouter.post('/company/jobs', requireAuth, asyncHandler(async (req, res) => {
  const parsed = CreateJobSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.status(400).json({ message: 'Create your company profile first.' })
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'ops', 'hr'])
  if (!ok.ok) return

  try {
    const r = await pool.query(
      `insert into job_posts (company_id, title, description, location, employment_type, work_mode, pay_min, pay_max, currency, pay_period, job_term, schedule_text, benefits, tags, status, closes_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::text[],$14::text[],'open',$15,now())
       returning *`,
      [
        companyId,
        parsed.data.title,
        parsed.data.description,
        parsed.data.location ?? null,
        parsed.data.employment_type ?? null,
        parsed.data.work_mode ?? null,
        parsed.data.pay_min ?? null,
        parsed.data.pay_max ?? null,
        parsed.data.currency ?? 'GHS',
        parsed.data.pay_period ?? null,
        parsed.data.job_term ?? null,
        parsed.data.schedule_text ?? null,
        parsed.data.benefits ?? null,
        parsed.data.tags ?? null,
        parsed.data.closes_at ?? null,
      ],
    )
    const row = r.rows[0]
    await logCompanyAudit(req, { companyId, action: 'jobs.create', targetType: 'job_post', targetId: row?.id ?? null })
    return res.status(201).json(row)
  } catch (e) {
    // Backwards compatibility if migrations haven't been applied yet.
    if (String(e?.code || '') === '42703') {
      const r = await pool.query(
        `insert into job_posts (company_id, title, description, location, employment_type, work_mode, pay_min, pay_max, currency, tags, status, closes_at, updated_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::text[],'open',$11,now())
         returning *`,
        [
          companyId,
          parsed.data.title,
          parsed.data.description,
          parsed.data.location ?? null,
          parsed.data.employment_type ?? null,
          parsed.data.work_mode ?? null,
          parsed.data.pay_min ?? null,
          parsed.data.pay_max ?? null,
          parsed.data.currency ?? 'GHS',
          parsed.data.tags ?? null,
          parsed.data.closes_at ?? null,
        ],
      )
      const row = r.rows[0]
      await logCompanyAudit(req, { companyId, action: 'jobs.create', targetType: 'job_post', targetId: row?.id ?? null, meta: { compat: true } })
      return res.status(201).json(row)
    }
    throw e
  }
}))

// --- Payroll (beta): settings + employees + pay runs ---
const PayrollSettingsSchema = z.object({
  currency: z.string().max(8).optional().nullable(),
  tax_rate_pct: z.number().min(0).max(100).optional().nullable(),
  ni_rate_pct: z.number().min(0).max(100).optional().nullable(),
  pension_rate_pct: z.number().min(0).max(100).optional().nullable(),
})

corporateRouter.get('/company/payroll/settings', requireAuth, asyncHandler(async (req, res) => {
  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.json(null)
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'finance'])
  if (!ok.ok) return
  try {
    const r = await pool.query('select * from employer_payroll_settings where company_id = $1 limit 1', [companyId])
    return res.json(r.rows[0] ?? null)
  } catch (e) {
    if (String(e?.code || '') === '42P01') return res.json(null) // not migrated yet
    throw e
  }
}))

corporateRouter.put('/company/payroll/settings', requireAuth, asyncHandler(async (req, res) => {
  const parsed = PayrollSettingsSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.status(400).json({ message: 'Create your company profile first.' })
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'finance'])
  if (!ok.ok) return

  const cur = parsed.data.currency ? String(parsed.data.currency) : null
  const tax = parsed.data.tax_rate_pct != null ? Number(parsed.data.tax_rate_pct) : null
  const ni = parsed.data.ni_rate_pct != null ? Number(parsed.data.ni_rate_pct) : null
  const pen = parsed.data.pension_rate_pct != null ? Number(parsed.data.pension_rate_pct) : null

  try {
    const r = await pool.query(
      `insert into employer_payroll_settings (company_id, currency, tax_rate_pct, ni_rate_pct, pension_rate_pct, updated_by, updated_at)
       values ($1, coalesce($2, 'GHS'), coalesce($3, 0), coalesce($4, 0), coalesce($5, 0), $6, now())
       on conflict (company_id) do update set
         currency = coalesce($2, employer_payroll_settings.currency),
         tax_rate_pct = coalesce($3, employer_payroll_settings.tax_rate_pct),
         ni_rate_pct = coalesce($4, employer_payroll_settings.ni_rate_pct),
         pension_rate_pct = coalesce($5, employer_payroll_settings.pension_rate_pct),
         updated_by = $6,
         updated_at = now()
       returning *`,
      [companyId, cur, tax, ni, pen, req.user.sub],
    )
    await logCompanyAudit(req, { companyId, action: 'payroll.settings.update', targetType: 'employer_payroll_settings', targetId: companyId })
    return res.json(r.rows[0])
  } catch (e) {
    if (String(e?.code || '') === '42P01') return res.status(400).json({ message: 'Payroll tables not ready (run migrations).' })
    throw e
  }
}))

const UpsertEmployeeSchema = z.object({
  worker_user_id: z.string().uuid().optional().nullable(),
  full_name: z.string().max(200).optional().nullable(),
  email: z.string().max(200).optional().nullable(),
  phone: z.string().max(60).optional().nullable(),
  pay_basis: z.enum(['salary', 'hourly']).optional().nullable(),
  pay_rate: z.number().min(0).optional().nullable(),
  pay_period: z.enum(['hour', 'day', 'week', 'month', 'year', 'shift']).optional().nullable(),
  tax_code: z.string().max(30).optional().nullable(),
  active: z.boolean().optional().nullable(),
})

corporateRouter.get('/company/payroll/employees', requireAuth, asyncHandler(async (req, res) => {
  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.json([])
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'finance', 'hr'])
  if (!ok.ok) return
  try {
    const r = await pool.query(
      `select e.*, u.name as user_name, u.role as user_role
       from employer_employees e
       left join users u on u.id = e.worker_user_id
       where e.company_id = $1
       order by e.active desc, e.updated_at desc
       limit 300`,
      [companyId],
    )
    return res.json(r.rows)
  } catch (e) {
    if (String(e?.code || '') === '42P01') return res.json([])
    throw e
  }
}))

corporateRouter.post('/company/payroll/employees', requireAuth, asyncHandler(async (req, res) => {
  const parsed = UpsertEmployeeSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })
  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.status(400).json({ message: 'Create your company profile first.' })
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'finance'])
  if (!ok.ok) return

  const d = parsed.data
  try {
    const r = await pool.query(
      `insert into employer_employees (company_id, worker_user_id, full_name, email, phone, pay_basis, pay_rate, pay_period, tax_code, active, updated_at)
       values ($1,$2,$3,$4,$5,coalesce($6,'salary'),coalesce($7,0),coalesce($8,'month'),$9,coalesce($10,true),now())
       returning *`,
      [
        companyId,
        d.worker_user_id ?? null,
        d.full_name ?? null,
        d.email ?? null,
        d.phone ?? null,
        d.pay_basis ?? null,
        d.pay_rate ?? null,
        d.pay_period ?? null,
        d.tax_code ?? null,
        d.active ?? null,
      ],
    )
    await logCompanyAudit(req, { companyId, action: 'payroll.employee.create', targetType: 'employer_employee', targetId: r.rows[0]?.id ?? null })
    return res.status(201).json(r.rows[0])
  } catch (e) {
    if (String(e?.code || '') === '23505') return res.status(409).json({ message: 'That user is already added as an employee.' })
    if (String(e?.code || '') === '42P01') return res.status(400).json({ message: 'Payroll tables not ready (run migrations).' })
    throw e
  }
}))

corporateRouter.put('/company/payroll/employees/:id', requireAuth, asyncHandler(async (req, res) => {
  const parsed = UpsertEmployeeSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })
  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.status(400).json({ message: 'Create your company profile first.' })
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'finance'])
  if (!ok.ok) return

  const d = parsed.data
  try {
    const r = await pool.query(
      `update employer_employees
       set
         worker_user_id = coalesce($3, worker_user_id),
         full_name = coalesce($4, full_name),
         email = coalesce($5, email),
         phone = coalesce($6, phone),
         pay_basis = coalesce($7, pay_basis),
         pay_rate = coalesce($8, pay_rate),
         pay_period = coalesce($9, pay_period),
         tax_code = coalesce($10, tax_code),
         active = coalesce($11, active),
         updated_at = now()
       where id = $2 and company_id = $1
       returning *`,
      [
        companyId,
        String(req.params.id),
        d.worker_user_id ?? null,
        d.full_name ?? null,
        d.email ?? null,
        d.phone ?? null,
        d.pay_basis ?? null,
        d.pay_rate ?? null,
        d.pay_period ?? null,
        d.tax_code ?? null,
        d.active ?? null,
      ],
    )
    const row = r.rows[0] ?? null
    if (!row) return res.status(404).json({ message: 'Employee not found' })
    await logCompanyAudit(req, { companyId, action: 'payroll.employee.update', targetType: 'employer_employee', targetId: row?.id ?? null })
    return res.json(row)
  } catch (e) {
    if (String(e?.code || '') === '42P01') return res.status(400).json({ message: 'Payroll tables not ready (run migrations).' })
    throw e
  }
}))

corporateRouter.delete('/company/payroll/employees/:id', requireAuth, asyncHandler(async (req, res) => {
  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.status(400).json({ message: 'Create your company profile first.' })
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'finance'])
  if (!ok.ok) return
  try {
    const r = await pool.query(
      `update employer_employees
       set active = false, updated_at = now()
       where id = $2 and company_id = $1
       returning id`,
      [companyId, String(req.params.id)],
    )
    if (!r.rows[0]?.id) return res.status(404).json({ message: 'Employee not found' })
    await logCompanyAudit(req, { companyId, action: 'payroll.employee.deactivate', targetType: 'employer_employee', targetId: r.rows[0]?.id })
    return res.json({ ok: true })
  } catch (e) {
    if (String(e?.code || '') === '42P01') return res.status(400).json({ message: 'Payroll tables not ready (run migrations).' })
    throw e
  }
}))

const CreatePayRunSchema = z.object({
  period_start: z.string().min(8).max(20),
  period_end: z.string().min(8).max(20),
  pay_date: z.string().min(8).max(20).optional().nullable(),
  hours_by_employee_id: z.record(z.string().uuid(), z.number().min(0)).optional().nullable(),
})

function toCsvRow(arr) {
  return arr
    .map((v) => {
      const s = v == null ? '' : String(v)
      if (s.includes('"') || s.includes(',') || s.includes('\n')) return `"${s.replaceAll('"', '""')}"`
      return s
    })
    .join(',')
}

corporateRouter.get('/company/payroll/runs', requireAuth, asyncHandler(async (req, res) => {
  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.json([])
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'finance'])
  if (!ok.ok) return
  try {
    const r = await pool.query(
      `select *
       from employer_pay_runs
       where company_id = $1
       order by created_at desc
       limit 50`,
      [companyId],
    )
    return res.json(r.rows)
  } catch (e) {
    if (String(e?.code || '') === '42P01') return res.json([])
    throw e
  }
}))

corporateRouter.post('/company/payroll/runs', requireAuth, asyncHandler(async (req, res) => {
  const parsed = CreatePayRunSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })
  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.status(400).json({ message: 'Create your company profile first.' })
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'finance'])
  if (!ok.ok) return

  const hoursMap = parsed.data.hours_by_employee_id || {}

  try {
    const settingsRes = await pool.query('select * from employer_payroll_settings where company_id = $1 limit 1', [companyId]).catch(() => ({ rows: [] }))
    const settings = settingsRes.rows?.[0] ?? { currency: 'GHS', tax_rate_pct: 0, ni_rate_pct: 0, pension_rate_pct: 0 }

    const empsRes = await pool.query(
      `select *
       from employer_employees
       where company_id = $1 and active is true
       order by updated_at desc
       limit 500`,
      [companyId],
    )
    const emps = Array.isArray(empsRes.rows) ? empsRes.rows : []

    const snapshot = JSON.stringify({
      currency: settings.currency ?? 'GHS',
      tax_rate_pct: Number(settings.tax_rate_pct ?? 0),
      ni_rate_pct: Number(settings.ni_rate_pct ?? 0),
      pension_rate_pct: Number(settings.pension_rate_pct ?? 0),
    })

    const runRes = await pool.query(
      `insert into employer_pay_runs (company_id, period_start, period_end, pay_date, status, settings_snapshot, created_by)
       values ($1, $2::date, $3::date, $4::date, 'draft', $5::jsonb, $6)
       returning *`,
      [companyId, parsed.data.period_start, parsed.data.period_end, parsed.data.pay_date ?? null, snapshot, req.user.sub],
    )
    const run = runRes.rows[0]
    await logCompanyAudit(req, { companyId, action: 'payroll.run.create', targetType: 'employer_pay_run', targetId: run?.id ?? null })

    const taxPct = Number(settings.tax_rate_pct ?? 0) / 100
    const niPct = Number(settings.ni_rate_pct ?? 0) / 100
    const penPct = Number(settings.pension_rate_pct ?? 0) / 100

    const itemsOut = []
    for (const e of emps) {
      const basis = String(e.pay_basis || 'salary')
      const rate = Number(e.pay_rate ?? 0)
      const hours = basis === 'hourly' ? Number(hoursMap?.[e.id] ?? 0) : null
      const gross = basis === 'hourly' ? rate * Number(hours ?? 0) : rate
      const tax = gross * taxPct
      const ni = gross * niPct
      const pension = gross * penPct
      const net = gross - tax - ni - pension
      const itemRes = await pool.query(
        `insert into employer_pay_run_items (pay_run_id, employee_id, hours_worked, gross_pay, tax_deduction, ni_deduction, pension_deduction, net_pay)
         values ($1,$2,$3,$4,$5,$6,$7,$8)
         returning *`,
        [run.id, e.id, hours, gross, tax, ni, pension, net],
      )
      itemsOut.push(itemRes.rows[0])
    }

    return res.status(201).json({ run, items: itemsOut, settings })
  } catch (e) {
    if (String(e?.code || '') === '42P01') return res.status(400).json({ message: 'Payroll tables not ready (run migrations).' })
    throw e
  }
}))

corporateRouter.get('/company/payroll/runs/:id/export.csv', requireAuth, asyncHandler(async (req, res) => {
  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.status(404).json({ message: 'Not found' })
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'finance', 'auditor'])
  if (!ok.ok) return
  try {
    const runRes = await pool.query(
      `select * from employer_pay_runs where id = $2 and company_id = $1 limit 1`,
      [companyId, String(req.params.id)],
    )
    const run = runRes.rows[0] ?? null
    if (!run) return res.status(404).json({ message: 'Not found' })

    const itemsRes = await pool.query(
      `select i.*, e.full_name, e.email, e.phone, e.pay_basis, e.pay_rate, e.pay_period, e.tax_code
       from employer_pay_run_items i
       join employer_employees e on e.id = i.employee_id
       where i.pay_run_id = $1
       order by e.full_name nulls last, e.email nulls last`,
      [run.id],
    )
    const items = Array.isArray(itemsRes.rows) ? itemsRes.rows : []

    const header = [
      'employee_name',
      'email',
      'phone',
      'pay_basis',
      'pay_rate',
      'pay_period',
      'hours_worked',
      'gross_pay',
      'tax_deduction',
      'ni_deduction',
      'pension_deduction',
      'net_pay',
      'tax_code',
      'period_start',
      'period_end',
      'pay_date',
    ]
    const lines = [toCsvRow(header)]
    for (const it of items) {
      lines.push(
        toCsvRow([
          it.full_name ?? '',
          it.email ?? '',
          it.phone ?? '',
          it.pay_basis ?? '',
          it.pay_rate ?? '',
          it.pay_period ?? '',
          it.hours_worked ?? '',
          it.gross_pay ?? '',
          it.tax_deduction ?? '',
          it.ni_deduction ?? '',
          it.pension_deduction ?? '',
          it.net_pay ?? '',
          it.tax_code ?? '',
          run.period_start ?? '',
          run.period_end ?? '',
          run.pay_date ?? '',
        ]),
      )
    }

    const csv = lines.join('\n')
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="payroll-${String(run.id).slice(0, 8)}.csv"`)
    return res.send(csv)
  } catch (e) {
    if (String(e?.code || '') === '42P01') return res.status(400).json({ message: 'Payroll tables not ready (run migrations).' })
    throw e
  }
}))

// --- Workforce: worker pools + employer notes ---
const CreateWorkerListSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(500).optional().nullable(),
})

corporateRouter.get('/company/worker-lists', requireAuth, asyncHandler(async (req, res) => {
  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.json([])
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'ops', 'hr', 'supervisor'])
  if (!ok.ok) return

  const r = await pool.query(
    `select l.*,
            (select count(*)::int from employer_worker_list_members m where m.list_id = l.id) as member_count
     from employer_worker_lists l
     where l.company_id = $1
     order by l.created_at desc`,
    [companyId],
  )
  return res.json(r.rows)
}))

corporateRouter.post('/company/worker-lists', requireAuth, asyncHandler(async (req, res) => {
  const parsed = CreateWorkerListSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.status(400).json({ message: 'Create your company profile first.' })
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'ops', 'hr', 'supervisor'])
  if (!ok.ok) return

  const r = await pool.query(
    `insert into employer_worker_lists (company_id, name, description, updated_at)
     values ($1,$2,$3,now())
     on conflict (company_id, name) do update
       set description = coalesce(excluded.description, employer_worker_lists.description),
           updated_at = now()
     returning *`,
    [companyId, parsed.data.name.trim(), parsed.data.description ?? null],
  )
  return res.status(201).json(r.rows[0])
}))

const AddListMemberSchema = z.object({
  worker_user_id: z.string().uuid(),
  source: z.string().max(40).optional().nullable(),
  source_id: z.string().uuid().optional().nullable(),
})

corporateRouter.post('/company/worker-lists/:listId/members', requireAuth, asyncHandler(async (req, res) => {
  const parsed = AddListMemberSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.status(400).json({ message: 'Create your company profile first.' })
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'ops', 'hr', 'supervisor'])
  if (!ok.ok) return

  const listId = String(req.params.listId || '').trim()
  const listRes = await pool.query('select * from employer_worker_lists where id = $1 and company_id = $2 limit 1', [listId, companyId])
  const list = listRes.rows[0] ?? null
  if (!list) return res.status(404).json({ message: 'List not found' })

  const u = await pool.query('select id, name, role, profile_pic from users where id = $1 limit 1', [parsed.data.worker_user_id])
  if (!u.rows[0]) return res.status(404).json({ message: 'User not found' })

  const r = await pool.query(
    `insert into employer_worker_list_members (list_id, worker_user_id, added_by_user_id, source, source_id)
     values ($1,$2,$3,$4,$5)
     on conflict (list_id, worker_user_id) do update
       set source = coalesce(excluded.source, employer_worker_list_members.source),
           source_id = coalesce(excluded.source_id, employer_worker_list_members.source_id)
     returning *`,
    [listId, parsed.data.worker_user_id, req.user.sub, parsed.data.source ?? 'manual', parsed.data.source_id ?? null],
  )
  return res.status(201).json({ member: r.rows[0], user: u.rows[0] })
}))

corporateRouter.delete('/company/worker-lists/:listId/members/:workerUserId', requireAuth, asyncHandler(async (req, res) => {
  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.status(400).json({ message: 'Create your company profile first.' })
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'ops', 'hr', 'supervisor'])
  if (!ok.ok) return

  const listId = String(req.params.listId || '').trim()
  const listRes = await pool.query('select 1 from employer_worker_lists where id = $1 and company_id = $2 limit 1', [listId, companyId])
  if (listRes.rowCount === 0) return res.status(404).json({ message: 'List not found' })

  await pool.query(`delete from employer_worker_list_members where list_id = $1 and worker_user_id = $2`, [
    listId,
    req.params.workerUserId,
  ])
  return res.json({ ok: true })
}))

const UpsertWorkerNoteSchema = z.object({
  rating: z.number().int().min(1).max(5).optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
  preferred: z.boolean().optional().nullable(),
  blocked: z.boolean().optional().nullable(),
  block_reason: z.string().min(3).max(500).optional().nullable(),
})

const WorkerHistoryQuerySchema = z.object({
  days: z.preprocess((v) => (v == null ? 90 : Number(v)), z.number().int().min(7).max(365)).optional(),
  limit: z.preprocess((v) => (v == null ? 50 : Number(v)), z.number().int().min(10).max(200)).optional(),
})

corporateRouter.put('/company/workers/:workerUserId/note', requireAuth, asyncHandler(async (req, res) => {
  const parsed = UpsertWorkerNoteSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.status(400).json({ message: 'Create your company profile first.' })
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'ops', 'hr', 'supervisor'])
  if (!ok.ok) return

  const workerUserId = String(req.params.workerUserId || '').trim()
  const exists = await pool.query('select 1 from users where id = $1 limit 1', [workerUserId])
  if (exists.rowCount === 0) return res.status(404).json({ message: 'User not found' })

  const hasRating = Object.prototype.hasOwnProperty.call(req.body || {}, 'rating')
  const hasNotes = Object.prototype.hasOwnProperty.call(req.body || {}, 'notes')
  const hasPreferred = Object.prototype.hasOwnProperty.call(req.body || {}, 'preferred')
  const hasBlocked = Object.prototype.hasOwnProperty.call(req.body || {}, 'blocked')

  let preferred = hasPreferred ? (parsed.data.preferred ?? null) : null
  let blocked = hasBlocked ? (parsed.data.blocked ?? null) : null
  if (preferred === true && !hasBlocked) blocked = false
  if (blocked === true && !hasPreferred) preferred = false
  if (preferred === true && blocked === true) return res.status(400).json({ message: 'A worker cannot be both preferred and blocked.' })

  const prevRow = await pool.query(
    `select preferred, blocked
     from employer_worker_notes
     where company_id = $1 and worker_user_id = $2
     limit 1`,
    [companyId, workerUserId],
  )
  const prevPreferred = prevRow.rows[0]?.preferred != null ? Boolean(prevRow.rows[0].preferred) : false
  const prevBlocked = prevRow.rows[0]?.blocked != null ? Boolean(prevRow.rows[0].blocked) : false

  if (blocked != null) {
    const actorRole = await workspaceRoleForUserInCompany(req.user?.sub, companyId)
    if (!actorRole || !['owner', 'ops'].includes(String(actorRole))) return res.status(403).json({ message: 'Forbidden' })
    if (blocked === true) {
      const reason = parsed.data.block_reason != null ? String(parsed.data.block_reason).trim() : ''
      if (reason.length < 3) return res.status(400).json({ message: 'Please provide a block reason (min 3 chars).' })
    }
  }

  const r = await pool.query(
    `insert into employer_worker_notes (company_id, worker_user_id, rating, notes, preferred, blocked, updated_by, updated_at)
     values ($1,$2,$3,$4,coalesce($5,false),coalesce($6,false),$7,now())
     on conflict (company_id, worker_user_id) do update set
       rating = case when $8 then excluded.rating else employer_worker_notes.rating end,
       notes = case when $9 then excluded.notes else employer_worker_notes.notes end,
       preferred = case when $5 is null then employer_worker_notes.preferred else $5 end,
       blocked = case when $6 is null then employer_worker_notes.blocked else $6 end,
       updated_by = excluded.updated_by,
       updated_at = now()
     returning *`,
    [companyId, workerUserId, parsed.data.rating ?? null, parsed.data.notes ?? null, preferred, blocked, req.user.sub, hasRating, hasNotes],
  )

  const nextPreferred = r.rows[0]?.preferred != null ? Boolean(r.rows[0].preferred) : false
  const nextBlocked = r.rows[0]?.blocked != null ? Boolean(r.rows[0].blocked) : false
  if (hasPreferred && preferred != null && nextPreferred !== prevPreferred) {
    await logCompanyAudit(req, {
      companyId,
      action: 'workers.preferred.set',
      targetType: 'worker_user',
      targetId: workerUserId,
      meta: { preferred: nextPreferred, previous: prevPreferred },
    })
  }
  if (hasBlocked && blocked != null && nextBlocked !== prevBlocked) {
    const reason = parsed.data.block_reason != null ? String(parsed.data.block_reason).trim() : null
    await logCompanyAudit(req, {
      companyId,
      action: 'workers.blocked.set',
      targetType: 'worker_user',
      targetId: workerUserId,
      meta: { blocked: nextBlocked, previous: prevBlocked, reason },
    })
  }
  return res.json(r.rows[0])
}))

corporateRouter.get('/company/workers/:workerUserId/history', requireAuth, asyncHandler(async (req, res) => {
  const parsed = WorkerHistoryQuerySchema.safeParse(req.query)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })
  const days = Number(parsed.data.days ?? 90)
  const limit = Number(parsed.data.limit ?? 50)

  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.status(400).json({ message: 'Create your company profile first.' })
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'ops', 'hr', 'supervisor'])
  if (!ok.ok) return

  const workerUserId = String(req.params.workerUserId || '').trim()
  const u = await pool.query(
    `with stats as (
       select a.worker_user_id,
              count(*)::int as invited,
              count(*) filter (where a.status in ('accepted','checked_in','checked_out','completed'))::int as accepted,
              count(*) filter (where a.status = 'completed')::int as completed,
              count(*) filter (where a.status = 'no_show')::int as no_shows,
              count(*) filter (where a.check_in_at is not null)::int as check_ins
       from shift_assignments a
       join shift_blocks s on s.id = a.shift_id
       where s.company_id = $1
         and a.worker_user_id = $2
         and s.start_at >= now() - ($3::text || ' days')::interval
       group by a.worker_user_id
     )
     select u.id,
            u.name,
            u.role,
            u.profile_pic,
            coalesce(n.rating, null) as rating,
            coalesce(n.notes, null) as notes,
            coalesce(n.preferred, false) as preferred,
            coalesce(n.blocked, false) as blocked,
            coalesce(st.invited, 0) as shifts_invited,
            coalesce(st.accepted, 0) as shifts_accepted,
            coalesce(st.completed, 0) as shifts_completed,
            coalesce(st.no_shows, 0) as shifts_no_show,
            coalesce(st.check_ins, 0) as shifts_checked_in,
            case
              when coalesce(st.invited, 0) > 0 then round(100.0 * (coalesce(st.invited, 0) - coalesce(st.no_shows, 0)) / nullif(coalesce(st.invited, 0), 0))::int
              else null
            end as reliability_pct,
            case
              when coalesce(st.accepted, 0) > 0 then round(100.0 * coalesce(st.check_ins, 0) / nullif(coalesce(st.accepted, 0), 0))::int
              else null
            end as attendance_pct,
            case
              when coalesce(st.invited, 0) > 0 then round(100.0 * coalesce(st.no_shows, 0) / nullif(coalesce(st.invited, 0), 0))::int
              else null
            end as no_show_rate_pct
     from users u
     left join employer_worker_notes n on n.company_id = $1 and n.worker_user_id = u.id
     left join stats st on st.worker_user_id = u.id
     where u.id = $2
     limit 1`,
    [companyId, workerUserId, String(days)],
  )
  if (u.rowCount === 0) return res.status(404).json({ message: 'User not found' })

  const windowEndIso = new Date().toISOString()
  const windowStartRes = await pool.query(`select (now() - ($1::text || ' days')::interval) as t0`, [String(days)])
  const windowStartIso = windowStartRes.rows[0]?.t0 ? new Date(windowStartRes.rows[0].t0).toISOString() : null

  const r = await pool.query(
    `select a.id as assignment_id,
            a.status,
            a.invited_at,
            a.responded_at,
            a.check_in_at,
            a.check_out_at,
            a.completed_at,
            a.no_show_confirmed_at,
            s.id as shift_id,
            s.title as shift_title,
            s.role_tag,
            s.location,
            s.start_at,
            s.end_at
     from shift_assignments a
     join shift_blocks s on s.id = a.shift_id
     where s.company_id = $1
       and a.worker_user_id = $2
       and s.start_at >= now() - ($3::text || ' days')::interval
     order by s.start_at desc
     limit $4`,
    [companyId, workerUserId, String(days), limit],
  )

  return res.json({
    worker: u.rows[0],
    window_days: days,
    window_start: windowStartIso,
    window_end: windowEndIso,
    items: r.rows || [],
  })
}))

corporateRouter.get('/company/workers', requireAuth, asyncHandler(async (req, res) => {
  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.json([])
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'ops', 'hr', 'supervisor'])
  if (!ok.ok) return

  const listId = req.query.list_id ? String(req.query.list_id) : null

  const r = await pool.query(
    `with members as (
       select distinct m.worker_user_id
       from employer_worker_list_members m
       join employer_worker_lists l on l.id = m.list_id
       where l.company_id = $1
         and ($2::uuid is null or m.list_id = $2::uuid)
     ),
     stats as (
       select a.worker_user_id,
              count(*)::int as invited,
              count(*) filter (where a.status in ('accepted','checked_in','checked_out','completed'))::int as accepted,
              count(*) filter (where a.status = 'completed')::int as completed,
              count(*) filter (where a.status = 'no_show')::int as no_shows,
              count(*) filter (where a.check_in_at is not null)::int as check_ins
       from shift_assignments a
       join shift_blocks s on s.id = a.shift_id
       where s.company_id = $1
       group by a.worker_user_id
     )
     select u.id,
            u.name,
            u.role,
            u.profile_pic,
            coalesce(n.rating, null) as rating,
            coalesce(n.notes, null) as notes,
            coalesce(n.preferred, false) as preferred,
            coalesce(n.blocked, false) as blocked,
            coalesce(st.invited, 0) as shifts_invited,
            coalesce(st.accepted, 0) as shifts_accepted,
            coalesce(st.completed, 0) as shifts_completed,
            coalesce(st.no_shows, 0) as shifts_no_show,
            coalesce(st.check_ins, 0) as shifts_checked_in,
            case
              when coalesce(st.invited, 0) > 0 then round(100.0 * (coalesce(st.invited, 0) - coalesce(st.no_shows, 0)) / nullif(coalesce(st.invited, 0), 0))::int
              else null
            end as reliability_pct,
            case
              when coalesce(st.accepted, 0) > 0 then round(100.0 * coalesce(st.check_ins, 0) / nullif(coalesce(st.accepted, 0), 0))::int
              else null
            end as attendance_pct,
            case
              when coalesce(st.invited, 0) > 0 then round(100.0 * coalesce(st.no_shows, 0) / nullif(coalesce(st.invited, 0), 0))::int
              else null
            end as no_show_rate_pct
     from members m
     join users u on u.id = m.worker_user_id
     left join employer_worker_notes n on n.company_id = $1 and n.worker_user_id = u.id
     left join stats st on st.worker_user_id = u.id
     order by coalesce(st.completed,0) desc, coalesce(st.check_ins,0) desc, u.name asc
     limit 500`,
    [companyId, listId],
  )
  return res.json(r.rows)
}))

const CompanyOpsSettingsSchema = z.object({
  coverage_auto_fill_enabled: z.boolean().optional(),
  coverage_auto_fill_list_id: z.string().uuid().nullable().optional(),
  coverage_auto_fill_days: z.number().int().min(1).max(90).optional(),
  coverage_auto_fill_max_shifts: z.number().int().min(1).max(200).optional(),
  coverage_auto_fill_max_invites_per_day: z.number().int().min(1).max(2000).optional(),
  coverage_alert_enabled: z.boolean().optional(),
  coverage_alert_lookahead_hours: z.number().int().min(12).max(336).optional(),
  coverage_alert_min_open_slots: z.number().int().min(1).max(500).optional(),
  reliability_alert_enabled: z.boolean().optional(),
  reliability_alert_threshold_noshow_pct: z.number().int().min(10).max(95).optional(),
  weekly_digest_enabled: z.boolean().optional(),
})

corporateRouter.get('/company/ops/settings', requireAuth, asyncHandler(async (req, res) => {
  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.status(400).json({ message: 'Create your company profile first.' })
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'ops', 'supervisor'])
  if (!ok.ok) return

  try {
    // Ensure a row exists so defaults are persisted.
    await pool.query('insert into company_ops_settings (company_id) values ($1) on conflict (company_id) do nothing', [companyId])
    const r = await pool.query(`select * from company_ops_settings where company_id = $1 limit 1`, [companyId])
    const row = r.rows[0] ?? null
    if (!row) {
      return res.json({
        company_id: companyId,
        coverage_auto_fill_enabled: false,
        coverage_auto_fill_list_id: null,
        coverage_auto_fill_days: 14,
        coverage_auto_fill_max_shifts: 25,
        coverage_auto_fill_last_run_at: null,
        coverage_alert_enabled: true,
        coverage_alert_lookahead_hours: 72,
        coverage_alert_min_open_slots: 1,
        coverage_alert_last_sent_at: null,
        reliability_alert_enabled: true,
        reliability_alert_threshold_noshow_pct: 30,
        reliability_alert_last_sent_at: null,
        weekly_digest_enabled: true,
        weekly_digest_last_sent_at: null,
      })
    }
    // Safety: if list was deleted or belongs to another company, hide it.
    let listId = row.coverage_auto_fill_list_id ? String(row.coverage_auto_fill_list_id) : null
    if (listId) {
      const okList = await pool.query('select 1 from employer_worker_lists where id = $1 and company_id = $2 limit 1', [listId, companyId])
      if (okList.rowCount === 0) listId = null
    }
    return res.json({
      company_id: companyId,
      coverage_auto_fill_enabled: Boolean(row.coverage_auto_fill_enabled),
      coverage_auto_fill_list_id: listId,
      coverage_auto_fill_days: Number(row.coverage_auto_fill_days ?? 14),
      coverage_auto_fill_max_shifts: Number(row.coverage_auto_fill_max_shifts ?? 25),
      coverage_auto_fill_max_invites_per_day: Number(row.coverage_auto_fill_max_invites_per_day ?? 200),
      coverage_auto_fill_last_run_at: row.coverage_auto_fill_last_run_at ?? null,
      coverage_alert_enabled: Boolean(row.coverage_alert_enabled ?? true),
      coverage_alert_lookahead_hours: Number(row.coverage_alert_lookahead_hours ?? 72),
      coverage_alert_min_open_slots: Number(row.coverage_alert_min_open_slots ?? 1),
      coverage_alert_last_sent_at: row.coverage_alert_last_sent_at ?? null,
      reliability_alert_enabled: Boolean(row.reliability_alert_enabled ?? true),
      reliability_alert_threshold_noshow_pct: Number(row.reliability_alert_threshold_noshow_pct ?? 30),
      reliability_alert_last_sent_at: row.reliability_alert_last_sent_at ?? null,
      weekly_digest_enabled: Boolean(row.weekly_digest_enabled ?? true),
      weekly_digest_last_sent_at: row.weekly_digest_last_sent_at ?? null,
    })
  } catch (e) {
    if (String(e?.code || '') === '42P01') {
      return res.json({
        company_id: companyId,
        coverage_auto_fill_enabled: false,
        coverage_auto_fill_list_id: null,
        coverage_auto_fill_days: 14,
        coverage_auto_fill_max_shifts: 25,
        coverage_auto_fill_max_invites_per_day: 200,
        coverage_auto_fill_last_run_at: null,
        coverage_alert_enabled: true,
        coverage_alert_lookahead_hours: 72,
        coverage_alert_min_open_slots: 1,
        coverage_alert_last_sent_at: null,
        reliability_alert_enabled: true,
        reliability_alert_threshold_noshow_pct: 30,
        reliability_alert_last_sent_at: null,
        weekly_digest_enabled: true,
        weekly_digest_last_sent_at: null,
      })
    }
    throw e
  }
}))

corporateRouter.put('/company/ops/settings', requireAuth, asyncHandler(async (req, res) => {
  const parsed = CompanyOpsSettingsSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.status(400).json({ message: 'Create your company profile first.' })
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'ops'])
  if (!ok.ok) return

  const enabled = parsed.data.coverage_auto_fill_enabled
  const listIdRaw = parsed.data.coverage_auto_fill_list_id
  const days = parsed.data.coverage_auto_fill_days
  const maxShifts = parsed.data.coverage_auto_fill_max_shifts
  const maxInvitesPerDay = parsed.data.coverage_auto_fill_max_invites_per_day
  const coverageAlertEnabled = parsed.data.coverage_alert_enabled
  const coverageLookaheadHours = parsed.data.coverage_alert_lookahead_hours
  const coverageMinOpenSlots = parsed.data.coverage_alert_min_open_slots
  const reliabilityEnabled = parsed.data.reliability_alert_enabled
  const reliabilityThreshold = parsed.data.reliability_alert_threshold_noshow_pct
  const weeklyDigestEnabled = parsed.data.weekly_digest_enabled

  if (enabled === true) {
    const lid = listIdRaw != null ? String(listIdRaw || '').trim() : ''
    if (!lid) return res.status(400).json({ message: 'Select a worker pool to enable autopilot.' })
    const listRes = await pool.query('select 1 from employer_worker_lists where id = $1 and company_id = $2 limit 1', [lid, companyId])
    if (listRes.rowCount === 0) return res.status(400).json({ message: 'Worker pool not found' })
  }

  try {
    const r = await pool.query(
      `insert into company_ops_settings (
         company_id,
         coverage_auto_fill_enabled,
         coverage_auto_fill_list_id,
         coverage_auto_fill_days,
         coverage_auto_fill_max_shifts,
         coverage_auto_fill_max_invites_per_day,
         coverage_alert_enabled,
         coverage_alert_lookahead_hours,
         coverage_alert_min_open_slots,
         reliability_alert_enabled,
         reliability_alert_threshold_noshow_pct,
         weekly_digest_enabled,
         updated_at
       )
       values (
         $1,
         coalesce($2, false),
         $3,
         coalesce($4, 14),
         coalesce($5, 25),
         coalesce($6, 200),
         coalesce($7, true),
         coalesce($8, 72),
         coalesce($9, 1),
         coalesce($10, true),
         coalesce($11, 30),
         coalesce($12, true),
         now()
       )
       on conflict (company_id) do update set
         coverage_auto_fill_enabled = coalesce($2, company_ops_settings.coverage_auto_fill_enabled),
         coverage_auto_fill_list_id = case when $3 is null then company_ops_settings.coverage_auto_fill_list_id else $3 end,
         coverage_auto_fill_days = coalesce($4, company_ops_settings.coverage_auto_fill_days),
         coverage_auto_fill_max_shifts = coalesce($5, company_ops_settings.coverage_auto_fill_max_shifts),
         coverage_auto_fill_max_invites_per_day = coalesce($6, company_ops_settings.coverage_auto_fill_max_invites_per_day),
         coverage_alert_enabled = coalesce($7, company_ops_settings.coverage_alert_enabled),
         coverage_alert_lookahead_hours = coalesce($8, company_ops_settings.coverage_alert_lookahead_hours),
         coverage_alert_min_open_slots = coalesce($9, company_ops_settings.coverage_alert_min_open_slots),
         reliability_alert_enabled = coalesce($10, company_ops_settings.reliability_alert_enabled),
         reliability_alert_threshold_noshow_pct = coalesce($11, company_ops_settings.reliability_alert_threshold_noshow_pct),
         weekly_digest_enabled = coalesce($12, company_ops_settings.weekly_digest_enabled),
         updated_at = now()
       returning company_id, coverage_auto_fill_enabled, coverage_auto_fill_list_id, coverage_auto_fill_days, coverage_auto_fill_max_shifts, coverage_auto_fill_max_invites_per_day, coverage_auto_fill_last_run_at,
                 coverage_alert_enabled, coverage_alert_lookahead_hours, coverage_alert_min_open_slots, coverage_alert_last_sent_at,
                 reliability_alert_enabled, reliability_alert_threshold_noshow_pct, reliability_alert_last_sent_at,
                 weekly_digest_enabled, weekly_digest_last_sent_at`,
      [
        companyId,
        enabled ?? null,
        listIdRaw ?? null,
        days ?? null,
        maxShifts ?? null,
        maxInvitesPerDay ?? null,
        coverageAlertEnabled ?? null,
        coverageLookaheadHours ?? null,
        coverageMinOpenSlots ?? null,
        reliabilityEnabled ?? null,
        reliabilityThreshold ?? null,
        weeklyDigestEnabled ?? null,
      ],
    )

    await logCompanyAudit(req, {
      companyId,
      action: 'ops.coverage.autofill.settings.update',
      targetType: 'company_ops_settings',
      targetId: companyId,
      meta: {
        coverage_auto_fill_enabled: enabled,
        coverage_auto_fill_list_id: listIdRaw,
        coverage_auto_fill_days: days,
        coverage_auto_fill_max_shifts: maxShifts,
        coverage_alert_enabled: coverageAlertEnabled,
        coverage_alert_lookahead_hours: coverageLookaheadHours,
        coverage_alert_min_open_slots: coverageMinOpenSlots,
        reliability_alert_enabled: reliabilityEnabled,
        reliability_alert_threshold_noshow_pct: reliabilityThreshold,
        weekly_digest_enabled: weeklyDigestEnabled,
      },
    })

    return res.json(r.rows[0])
  } catch (e) {
    if (String(e?.code || '') === '42P01') return res.status(400).json({ message: 'Ops settings table not ready (run migrations).' })
    throw e
  }
}))

corporateRouter.get('/company/ops/autopilot/runs', requireAuth, asyncHandler(async (req, res) => {
  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.json({ items: [] })
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'ops', 'supervisor'])
  if (!ok.ok) return

  const limit = Math.min(Math.max(Number(req.query.limit ?? 20), 5), 100)
  try {
    const r = await pool.query(
      `select id, kind, status, list_id, window_days, max_shifts, processed_shifts, invited_workers, failed_shifts, started_at, finished_at, created_at, meta
       from company_ops_autopilot_runs
       where company_id = $1
       order by created_at desc
       limit $2`,
      [companyId, limit],
    )
    return res.json({ items: r.rows || [] })
  } catch (e) {
    if (String(e?.code || '') === '42P01') return res.json({ items: [] })
    throw e
  }
}))

const CompanyOpsAlertsQuerySchema = z.object({
  status: z.enum(['open', 'resolved']).optional(),
  severity: z.enum(['info', 'warning', 'critical']).optional().nullable(),
  limit: z.preprocess((v) => (v == null ? 50 : Number(v)), z.number().int().min(1).max(250)).optional(),
})

corporateRouter.get('/company/ops/alerts', requireAuth, asyncHandler(async (req, res) => {
  const parsed = CompanyOpsAlertsQuerySchema.safeParse(req.query)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.json({ count: 0, items: [] })
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'ops', 'supervisor'])
  if (!ok.ok) return

  const items = await listOpsAlerts({
    status: parsed.data.status ?? 'open',
    severity: parsed.data.severity ?? null,
    limit: parsed.data.limit ?? 50,
  })

  // Company-scope filter: alerts we emit for companies use key=companyId and/or payload.company_id.
  const filtered = (Array.isArray(items) ? items : []).filter((a) => {
    const key = a?.key ? String(a.key) : ''
    const payloadCompany = a?.payload?.company_id ? String(a.payload.company_id) : a?.payload?.company_id === null ? '' : ''
    return key === String(companyId) || payloadCompany === String(companyId)
  })

  return res.json({ count: filtered.length, items: filtered })
}))

corporateRouter.post('/company/ops/alerts/:id/resolve', requireAuth, asyncHandler(async (req, res) => {
  const id = String(req.params.id || '').trim()
  if (!id) return res.status(400).json({ message: 'Invalid id' })

  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.status(400).json({ message: 'Create your company profile first.' })

  // Resolve is owner/ops only.
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'ops'])
  if (!ok.ok) return

  // Only allow resolving alerts that belong to this company.
  const current = await pool.query('select id, type, key, payload, severity from ops_alerts where id = $1 limit 1', [id]).catch(() => ({ rows: [] }))
  const row = current.rows[0] ?? null
  if (!row) return res.status(404).json({ message: 'Alert not found' })
  const key = row?.key ? String(row.key) : ''
  const payloadCompany = row?.payload?.company_id ? String(row.payload.company_id) : ''
  if (key !== String(companyId) && payloadCompany !== String(companyId)) return res.status(404).json({ message: 'Alert not found' })

  const updated = await resolveOpsAlert({ id, resolvedByUserId: req.user.sub })
  if (!updated) return res.status(404).json({ message: 'Alert not found or already resolved' })
  await logCompanyAudit(req, {
    companyId,
    action: 'ops.alert.resolve',
    targetType: 'ops_alert',
    targetId: id,
    meta: { type: updated.type, key: updated.key, severity: updated.severity },
  })
  return res.json(updated)
}))

// --- Scheduling: shift templates + recurring series + shifts + assignments ---

function parseDateOnlyToUtcMs(dateStr) {
  const s = String(dateStr || '').trim()
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2]) - 1
  const d = Number(m[3])
  const dt = new Date(Date.UTC(y, mo, d, 0, 0, 0, 0))
  if (!Number.isFinite(dt.getTime())) return null
  return dt.getTime()
}

function parseTimeParts(timeStr) {
  const s = String(timeStr || '').trim()
  const m = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(s)
  if (!m) return null
  const hh = Number(m[1])
  const mm = Number(m[2])
  const ss = m[3] != null ? Number(m[3]) : 0
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || !Number.isFinite(ss)) return null
  if (hh < 0 || hh > 23) return null
  if (mm < 0 || mm > 59) return null
  if (ss < 0 || ss > 59) return null
  return { hh, mm, ss }
}

function utcDatePartsFromMs(ms) {
  const d = new Date(ms)
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), day: d.getUTCDate(), dow: d.getUTCDay() }
}

function isoForUtcDateAndTime(dateMs, timeStr) {
  const t = parseTimeParts(timeStr)
  if (!t) return null
  const p = utcDatePartsFromMs(dateMs)
  const dt = new Date(Date.UTC(p.y, p.m, p.day, t.hh, t.mm, t.ss, 0))
  if (!Number.isFinite(dt.getTime())) return null
  return dt.toISOString()
}

const TemplateNameSchema = z.string().min(2).max(80)
const TemplateUpsertSchema = z.object({
  name: TemplateNameSchema,
  title: z.string().min(2).max(200),
  role_tag: z.string().max(80).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  headcount: z.number().int().min(1).max(500).optional().nullable(),
  checkin_geo_required: z.boolean().optional().nullable(),
  checkin_geo_radius_m: z.preprocess((v) => (v == null || v === '' ? null : Number(v)), z.number().int().min(50).max(50_000)).optional().nullable(),
  checkin_geo_lat: z.preprocess((v) => (v == null || v === '' ? null : Number(v)), z.number().min(-90).max(90)).optional().nullable(),
  checkin_geo_lng: z.preprocess((v) => (v == null || v === '' ? null : Number(v)), z.number().min(-180).max(180)).optional().nullable(),
})

corporateRouter.get('/company/shift-templates', requireAuth, asyncHandler(async (req, res) => {
  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.json([])
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'ops', 'supervisor'])
  if (!ok.ok) return
  try {
    const r = await pool.query(
      `select id, company_id, name, title, role_tag, location, headcount,
              checkin_geo_required, checkin_geo_radius_m, checkin_geo_lat, checkin_geo_lng,
              created_by, created_at, updated_at
       from company_shift_templates
       where company_id = $1
       order by created_at desc
       limit 200`,
      [companyId],
    )
    return res.json(r.rows)
  } catch (e) {
    if (String(e?.code || '') === '42P01') return res.status(400).json({ message: 'Recurring tables not ready (run migrations).' })
    throw e
  }
}))

corporateRouter.post('/company/shift-templates', requireAuth, asyncHandler(async (req, res) => {
  const parsed = TemplateUpsertSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })
  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.status(400).json({ message: 'Create your company profile first.' })
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'ops'])
  if (!ok.ok) return
  try {
    const r = await pool.query(
      `insert into company_shift_templates (
         company_id, name, title, role_tag, location, headcount,
         checkin_geo_required, checkin_geo_radius_m, checkin_geo_lat, checkin_geo_lng,
         created_by, updated_at
       )
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now())
       returning *`,
      [
        companyId,
        parsed.data.name,
        parsed.data.title,
        parsed.data.role_tag ?? null,
        parsed.data.location ?? null,
        parsed.data.headcount ?? 1,
        Boolean(parsed.data.checkin_geo_required ?? false),
        parsed.data.checkin_geo_radius_m ?? null,
        parsed.data.checkin_geo_lat ?? null,
        parsed.data.checkin_geo_lng ?? null,
        req.user.sub,
      ],
    )
    const row = r.rows[0]
    await logCompanyAudit(req, { companyId, action: 'shifts.template.create', targetType: 'shift_template', targetId: row?.id ?? null })
    return res.status(201).json(row)
  } catch (e) {
    if (String(e?.code || '') === '42P01') return res.status(400).json({ message: 'Recurring tables not ready (run migrations).' })
    if (String(e?.code || '') === '23505') return res.status(409).json({ message: 'Template name already exists.' })
    throw e
  }
}))

corporateRouter.put('/company/shift-templates/:id', requireAuth, asyncHandler(async (req, res) => {
  const parsed = TemplateUpsertSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })
  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.status(400).json({ message: 'Create your company profile first.' })
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'ops'])
  if (!ok.ok) return
  const id = String(req.params.id || '').trim()
  if (!id) return res.status(400).json({ message: 'Invalid template' })
  try {
    const r = await pool.query(
      `update company_shift_templates
       set name = $3,
           title = $4,
           role_tag = $5,
           location = $6,
           headcount = $7,
           checkin_geo_required = $8,
           checkin_geo_radius_m = $9,
           checkin_geo_lat = $10,
           checkin_geo_lng = $11,
           updated_at = now()
       where id = $2 and company_id = $1
       returning *`,
      [
        companyId,
        id,
        parsed.data.name,
        parsed.data.title,
        parsed.data.role_tag ?? null,
        parsed.data.location ?? null,
        parsed.data.headcount ?? 1,
        Boolean(parsed.data.checkin_geo_required ?? false),
        parsed.data.checkin_geo_radius_m ?? null,
        parsed.data.checkin_geo_lat ?? null,
        parsed.data.checkin_geo_lng ?? null,
      ],
    )
    if (!r.rowCount) return res.status(404).json({ message: 'Template not found' })
    await logCompanyAudit(req, { companyId, action: 'shifts.template.update', targetType: 'shift_template', targetId: id })
    return res.json(r.rows[0])
  } catch (e) {
    if (String(e?.code || '') === '42P01') return res.status(400).json({ message: 'Recurring tables not ready (run migrations).' })
    if (String(e?.code || '') === '23505') return res.status(409).json({ message: 'Template name already exists.' })
    throw e
  }
}))

corporateRouter.delete('/company/shift-templates/:id', requireAuth, asyncHandler(async (req, res) => {
  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.status(400).json({ message: 'Create your company profile first.' })
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner'])
  if (!ok.ok) return
  const id = String(req.params.id || '').trim()
  if (!id) return res.status(400).json({ message: 'Invalid template' })
  try {
    const inUse = await pool.query('select 1 from company_shift_series where template_id = $1 limit 1', [id])
    if (inUse.rowCount) return res.status(409).json({ message: 'Template is in use by a recurring series.' })
    const r = await pool.query('delete from company_shift_templates where id = $2 and company_id = $1 returning id', [companyId, id])
    if (!r.rowCount) return res.status(404).json({ message: 'Template not found' })
    await logCompanyAudit(req, { companyId, action: 'shifts.template.delete', targetType: 'shift_template', targetId: id })
    return res.json({ ok: true })
  } catch (e) {
    if (String(e?.code || '') === '42P01') return res.status(400).json({ message: 'Recurring tables not ready (run migrations).' })
    throw e
  }
}))

const TimeStrSchema = z.string().regex(/^\d{2}:\d{2}(?::\d{2})?$/)
const DateStrSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const SeriesUpsertSchema = z.object({
  template_id: z.string().uuid(),
  status: z.enum(['active', 'paused', 'ended']).optional().nullable(),
  interval_weeks: z.number().int().min(1).max(52).optional().nullable(),
  days_of_week: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  start_date: DateStrSchema,
  end_date: DateStrSchema.optional().nullable(),
  start_time: TimeStrSchema,
  end_time: TimeStrSchema,
  auto_fill_list_id: z.string().uuid().optional().nullable(),
  auto_fill_mode: z.enum(['headcount', 'count']).optional().nullable(),
  auto_fill_count: z.preprocess((v) => (v == null ? null : Number(v)), z.number().int().min(1).max(200)).optional().nullable(),
  auto_generate_enabled: z.boolean().optional().nullable(),
  auto_generate_days: z.number().int().min(1).max(90).optional().nullable(),
})

corporateRouter.get('/company/shift-series', requireAuth, asyncHandler(async (req, res) => {
  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.json([])
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'ops', 'supervisor'])
  if (!ok.ok) return
  try {
    const r = await pool.query(
      `select s.*,
              t.name as template_name,
              t.title as template_title
       from company_shift_series s
       join company_shift_templates t on t.id = s.template_id
       where s.company_id = $1
       order by s.created_at desc
       limit 200`,
      [companyId],
    )
    return res.json(r.rows)
  } catch (e) {
    if (String(e?.code || '') === '42P01') return res.status(400).json({ message: 'Recurring tables not ready (run migrations).' })
    throw e
  }
}))

corporateRouter.get('/company/shift-series/:id/preview', requireAuth, asyncHandler(async (req, res) => {
  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.status(404).json({ message: 'Not found' })
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'ops', 'supervisor'])
  if (!ok.ok) return

  const seriesId = String(req.params.id || '').trim()
  if (!seriesId) return res.status(400).json({ message: 'Invalid series' })
  const days = Math.min(Math.max(Number(req.query.days ?? 14) || 14, 1), 90)

  try {
    const sRes = await pool.query(
      `select s.*,
              t.name as template_name,
              t.title as template_title
       from company_shift_series s
       join company_shift_templates t on t.id = s.template_id
       where s.id = $1 and s.company_id = $2
       limit 1`,
      [seriesId, companyId],
    )
    const s = sRes.rows[0] ?? null
    if (!s) return res.status(404).json({ message: 'Series not found' })

    const today = new Date()
    const todayMs = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 0, 0, 0, 0)
    const fromMs = todayMs
    const toMs = todayMs + days * 24 * 60 * 60 * 1000

    const seriesStartMs = parseDateOnlyToUtcMs(s.start_date)
    const seriesEndMs = s.end_date ? parseDateOnlyToUtcMs(s.end_date) : null
    if (!seriesStartMs) return res.status(400).json({ message: 'Invalid series start_date' })

    const startMs = Math.max(fromMs, seriesStartMs)
    const endMs = seriesEndMs != null ? Math.min(toMs, seriesEndMs) : toMs
    if (endMs < startMs) return res.json({ series: s, items: [] })

    const daysOfWeek = Array.isArray(s.days_of_week) ? s.days_of_week.map((n) => Number(n)).filter((n) => Number.isFinite(n)) : []
    const allowed = new Set(daysOfWeek)
    if (allowed.size === 0) return res.json({ series: s, items: [] })

    const ex = await pool.query(
      `select on_date
       from company_shift_series_exceptions
       where series_id = $1 and kind = 'skip'
         and on_date >= $2::date and on_date <= $3::date`,
      [seriesId, new Date(startMs).toISOString().slice(0, 10), new Date(endMs).toISOString().slice(0, 10)],
    )
    const skipped = new Set((ex.rows || []).map((r) => String(r.on_date).slice(0, 10)))

    const existingRes = await pool.query(
      `select series_occurrence_date
       from shift_blocks
       where company_id = $1
         and series_id = $2
         and series_occurrence_date is not null
         and series_occurrence_date >= $3::date
         and series_occurrence_date <= $4::date`,
      [companyId, seriesId, new Date(startMs).toISOString().slice(0, 10), new Date(endMs).toISOString().slice(0, 10)],
    )
    const existing = new Set((existingRes.rows || []).map((r) => String(r.series_occurrence_date).slice(0, 10)))

    const items = []
    const oneDay = 24 * 60 * 60 * 1000
    for (let dMs = startMs; dMs <= endMs; dMs += oneDay) {
      const p = utcDatePartsFromMs(dMs)
      if (!allowed.has(p.dow)) continue
      const diffDays = Math.floor((dMs - seriesStartMs) / oneDay)
      if (diffDays < 0) continue
      const weekIndex = Math.floor(diffDays / 7)
      const interval = Number(s.interval_weeks || 1)
      if (interval > 1 && weekIndex % interval !== 0) continue
      const dateKey = `${p.y}-${String(p.m + 1).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
      const startIso = isoForUtcDateAndTime(dMs, s.start_time)
      const endIso = isoForUtcDateAndTime(dMs, s.end_time)
      items.push({
        on_date: dateKey,
        start_at: startIso,
        end_at: endIso,
        skipped: skipped.has(dateKey),
        already_generated: existing.has(dateKey),
      })
    }

    return res.json({ series: s, items })
  } catch (e) {
    if (String(e?.code || '') === '42P01') return res.status(400).json({ message: 'Recurring tables not ready (run migrations).' })
    throw e
  }
}))

corporateRouter.post('/company/shift-series', requireAuth, asyncHandler(async (req, res) => {
  const parsed = SeriesUpsertSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })
  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.status(400).json({ message: 'Create your company profile first.' })
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'ops'])
  if (!ok.ok) return
  try {
    const tpl = await pool.query('select id from company_shift_templates where id = $1 and company_id = $2 limit 1', [
      parsed.data.template_id,
      companyId,
    ])
    if (!tpl.rowCount) return res.status(404).json({ message: 'Template not found' })
    const r = await pool.query(
      `insert into company_shift_series (
         company_id, template_id, status, frequency, interval_weeks, days_of_week, start_date, end_date, start_time, end_time,
         auto_fill_list_id, auto_fill_mode, auto_fill_count, auto_generate_enabled, auto_generate_days,
         created_by, updated_at
       )
       values ($1,$2,$3,'weekly',$4,$5::int[],$6::date,$7::date,$8::time,$9::time,$10,$11,$12,$13,$14,$15,now())
       returning *`,
      [
        companyId,
        parsed.data.template_id,
        parsed.data.status ?? 'active',
        parsed.data.interval_weeks ?? 1,
        parsed.data.days_of_week,
        parsed.data.start_date,
        parsed.data.end_date ?? null,
        parsed.data.start_time,
        parsed.data.end_time,
        parsed.data.auto_fill_list_id ?? null,
        parsed.data.auto_fill_mode ?? 'headcount',
        parsed.data.auto_fill_mode === 'count' ? (parsed.data.auto_fill_count ?? 1) : null,
        Boolean(parsed.data.auto_generate_enabled ?? false),
        parsed.data.auto_generate_days ?? 14,
        req.user.sub,
      ],
    )
    const row = r.rows[0]
    await logCompanyAudit(req, { companyId, action: 'shifts.series.create', targetType: 'shift_series', targetId: row?.id ?? null })
    return res.status(201).json(row)
  } catch (e) {
    if (String(e?.code || '') === '42P01') return res.status(400).json({ message: 'Recurring tables not ready (run migrations).' })
    throw e
  }
}))

corporateRouter.put('/company/shift-series/:id', requireAuth, asyncHandler(async (req, res) => {
  const parsed = SeriesUpsertSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })
  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.status(400).json({ message: 'Create your company profile first.' })
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'ops'])
  if (!ok.ok) return
  const id = String(req.params.id || '').trim()
  if (!id) return res.status(400).json({ message: 'Invalid series' })
  try {
    const tpl = await pool.query('select id from company_shift_templates where id = $1 and company_id = $2 limit 1', [
      parsed.data.template_id,
      companyId,
    ])
    if (!tpl.rowCount) return res.status(404).json({ message: 'Template not found' })
    const r = await pool.query(
      `update company_shift_series
       set template_id = $3,
           status = $4,
           interval_weeks = $5,
           days_of_week = $6::int[],
           start_date = $7::date,
           end_date = $8::date,
           start_time = $9::time,
           end_time = $10::time,
           auto_fill_list_id = $11,
           auto_fill_mode = $12,
           auto_fill_count = $13,
           auto_generate_enabled = $14,
           auto_generate_days = $15,
           updated_at = now()
       where id = $2 and company_id = $1
       returning *`,
      [
        companyId,
        id,
        parsed.data.template_id,
        parsed.data.status ?? 'active',
        parsed.data.interval_weeks ?? 1,
        parsed.data.days_of_week,
        parsed.data.start_date,
        parsed.data.end_date ?? null,
        parsed.data.start_time,
        parsed.data.end_time,
        parsed.data.auto_fill_list_id ?? null,
        parsed.data.auto_fill_mode ?? 'headcount',
        parsed.data.auto_fill_mode === 'count' ? (parsed.data.auto_fill_count ?? 1) : null,
        Boolean(parsed.data.auto_generate_enabled ?? false),
        parsed.data.auto_generate_days ?? 14,
      ],
    )
    if (!r.rowCount) return res.status(404).json({ message: 'Series not found' })
    await logCompanyAudit(req, { companyId, action: 'shifts.series.update', targetType: 'shift_series', targetId: id })
    return res.json(r.rows[0])
  } catch (e) {
    if (String(e?.code || '') === '42P01') return res.status(400).json({ message: 'Recurring tables not ready (run migrations).' })
    throw e
  }
}))

const GenerateSeriesSchema = z.object({
  days: z.number().int().min(1).max(365).optional().nullable(),
  from_date: DateStrSchema.optional().nullable(),
  to_date: DateStrSchema.optional().nullable(),
  auto_fill_list_id: z.string().uuid().optional().nullable(),
  auto_fill_mode: z.enum(['headcount', 'count']).optional().nullable(),
  auto_fill_count: z.preprocess((v) => (v == null ? null : Number(v)), z.number().int().min(1).max(200)).optional().nullable(),
})

corporateRouter.post('/company/shift-series/:id/generate', requireAuth, asyncHandler(async (req, res) => {
  const parsed = GenerateSeriesSchema.safeParse(req.body || {})
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })
  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.status(400).json({ message: 'Create your company profile first.' })
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'ops', 'supervisor'])
  if (!ok.ok) return
  const seriesId = String(req.params.id || '').trim()
  if (!seriesId) return res.status(400).json({ message: 'Invalid series' })

  try {
    const days = Number(parsed.data.days ?? 60)
    const r = await generateShiftSeries({
      companyId,
      seriesId,
      actorUserId: req.user.sub,
      days,
      fromDate: parsed.data.from_date ?? null,
      toDate: parsed.data.to_date ?? null,
      autoFillListIdOverride: parsed.data.auto_fill_list_id ?? null,
      autoFillModeOverride: parsed.data.auto_fill_mode ?? null,
      autoFillCountOverride: parsed.data.auto_fill_count ?? null,
    })
    await logCompanyAudit(req, {
      companyId,
      action: 'shifts.series.generate',
      targetType: 'shift_series',
      targetId: seriesId,
      meta: { inserted_count: r.inserted_count, invited_count: r.invited_count },
    })
    return res.json({ ok: true, inserted_count: r.inserted_count, invited_count: r.invited_count })
  } catch (e) {
    if (String(e?.code || '') === '42P01') return res.status(400).json({ message: 'Recurring tables not ready (run migrations).' })
    throw e
  }
}))

const SkipSeriesDateSchema = z.object({
  on_date: DateStrSchema,
  note: z.string().max(300).optional().nullable(),
})

corporateRouter.post('/company/shift-series/:id/skip', requireAuth, asyncHandler(async (req, res) => {
  const parsed = SkipSeriesDateSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })
  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.status(400).json({ message: 'Create your company profile first.' })
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'ops', 'supervisor'])
  if (!ok.ok) return
  const seriesId = String(req.params.id || '').trim()
  if (!seriesId) return res.status(400).json({ message: 'Invalid series' })
  try {
    const s = await pool.query('select id from company_shift_series where id = $1 and company_id = $2 limit 1', [seriesId, companyId])
    if (!s.rowCount) return res.status(404).json({ message: 'Series not found' })
    await pool.query(
      `insert into company_shift_series_exceptions (series_id, kind, on_date, note, created_by)
       values ($1,'skip',$2::date,$3,$4)
       on conflict (series_id, kind, on_date) do update set note = excluded.note`,
      [seriesId, parsed.data.on_date, parsed.data.note ?? null, req.user.sub],
    )
    await logCompanyAudit(req, { companyId, action: 'shifts.series.skip', targetType: 'shift_series', targetId: seriesId, meta: { on_date: parsed.data.on_date } })
    return res.json({ ok: true })
  } catch (e) {
    if (String(e?.code || '') === '42P01') return res.status(400).json({ message: 'Recurring tables not ready (run migrations).' })
    throw e
  }
}))

const CreateShiftSchema = z.object({
  title: z.string().min(2).max(200),
  role_tag: z.string().max(80).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  department_id: z.string().uuid().optional().nullable(),
  start_at: z.string().datetime(),
  end_at: z.string().datetime(),
  headcount: z.number().int().min(1).max(500).optional().nullable(),
  checkin_geo_required: z.boolean().optional().nullable(),
  checkin_geo_radius_m: z.preprocess((v) => (v == null || v === '' ? null : Number(v)), z.number().int().min(50).max(50_000)).optional().nullable(),
  checkin_geo_lat: z.preprocess((v) => (v == null || v === '' ? null : Number(v)), z.number().min(-90).max(90)).optional().nullable(),
  checkin_geo_lng: z.preprocess((v) => (v == null || v === '' ? null : Number(v)), z.number().min(-180).max(180)).optional().nullable(),
})

corporateRouter.post('/company/shifts', requireAuth, asyncHandler(async (req, res) => {
  const parsed = CreateShiftSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })
  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.status(400).json({ message: 'Create your company profile first.' })
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'ops', 'supervisor'])
  if (!ok.ok) return
  const departmentId = parsed.data.department_id ? String(parsed.data.department_id) : null
  if (departmentId) {
    const d = await pool.query('select id from company_departments where id=$1 and company_id=$2 limit 1', [departmentId, companyId])
    if (!d.rowCount) return res.status(400).json({ message: 'Department not found' })
  }
  const r = await pool.query(
    `insert into shift_blocks (
       company_id, title, role_tag, location, department_id, start_at, end_at, headcount, status, created_by, updated_at,
       checkin_geo_required, checkin_geo_radius_m, checkin_geo_lat, checkin_geo_lng
     )
     values ($1,$2,$3,$4,$5,$6,$7,$8,'scheduled',$9,now(),$10,$11,$12,$13)
     returning id, company_id, title, role_tag, location, department_id, start_at, end_at, headcount, status, created_by, created_at, updated_at,
               checkin_geo_required, checkin_geo_radius_m, checkin_geo_lat, checkin_geo_lng`,
    [
      companyId,
      parsed.data.title,
      parsed.data.role_tag ?? null,
      parsed.data.location ?? null,
      departmentId,
      parsed.data.start_at,
      parsed.data.end_at,
      parsed.data.headcount ?? 1,
      req.user.sub,
      Boolean(parsed.data.checkin_geo_required ?? false),
      parsed.data.checkin_geo_radius_m ?? null,
      parsed.data.checkin_geo_lat ?? null,
      parsed.data.checkin_geo_lng ?? null,
    ],
  )
  return res.status(201).json(r.rows[0])
}))

corporateRouter.get('/company/shifts', requireAuth, asyncHandler(async (req, res) => {
  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.json([])
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'ops', 'supervisor', 'auditor'])
  if (!ok.ok) return
  const r = await pool.query(
    `select s.id, s.company_id, s.title, s.role_tag, s.location, s.department_id, s.start_at, s.end_at, s.headcount, s.status, s.created_by, s.created_at, s.updated_at,
            s.series_id,
            s.series_occurrence_date,
            (s.checkin_code_hash is not null)::boolean as checkin_enabled,
            s.checkin_last_rotated_at,
            s.checkin_geo_required,
            s.checkin_geo_radius_m,
            (select count(*)::int from shift_assignments a where a.shift_id = s.id) as assigned,
            (select count(*)::int from shift_assignments a where a.shift_id = s.id and a.status = 'completed') as completed,
            (select count(*)::int from shift_assignments a where a.shift_id = s.id and a.status = 'no_show') as no_shows
     from shift_blocks s
     where s.company_id = $1
     order by s.start_at desc
     limit 200`,
    [companyId],
  )
  return res.json(r.rows)
}))

const ShiftCoverageQuerySchema = z.object({
  days: z.preprocess((v) => (v == null ? 14 : Number(v)), z.number().int().min(1).max(90)).optional(),
  limit: z.preprocess((v) => (v == null ? 200 : Number(v)), z.number().int().min(10).max(500)).optional(),
  only_unfilled: z.preprocess((v) => (v === true || String(v || '').toLowerCase() === 'true'), z.boolean()).optional(),
  include_past: z.preprocess((v) => (v === true || String(v || '').toLowerCase() === 'true'), z.boolean()).optional(),
})

corporateRouter.get('/company/shifts/coverage', requireAuth, asyncHandler(async (req, res) => {
  const parsed = ShiftCoverageQuerySchema.safeParse(req.query)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })
  const days = Number(parsed.data.days ?? 14)
  const limit = Number(parsed.data.limit ?? 200)
  const onlyUnfilled = Boolean(parsed.data.only_unfilled ?? false)
  const includePast = Boolean(parsed.data.include_past ?? false)

  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.json({ window_days: days, items: [] })
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'ops', 'supervisor', 'auditor'])
  if (!ok.ok) return

  const whereStart = includePast ? `s.start_at >= now() - interval '1 day'` : `s.start_at >= now()`
  const q = `
    select s.id, s.company_id, s.title, s.role_tag, s.location, s.start_at, s.end_at, s.headcount, s.status, s.created_at, s.updated_at,
           s.series_id, s.series_occurrence_date,
           (s.checkin_code_hash is not null)::boolean as checkin_enabled,
           s.checkin_geo_required,
           s.checkin_geo_radius_m,
           s.coverage_auto_fill_disabled,
           count(a.*)::int as assigned_total,
           count(*) filter (where a.status = 'invited')::int as invited,
           count(*) filter (where a.status = 'accepted')::int as accepted,
           count(*) filter (where a.status = 'declined')::int as declined,
           count(*) filter (where a.status = 'checked_in')::int as checked_in,
           count(*) filter (where a.status = 'checked_out')::int as checked_out,
           count(*) filter (where a.status = 'completed')::int as completed,
           count(*) filter (where a.status = 'no_show')::int as no_shows,
           count(*) filter (where a.status = 'cancelled')::int as cancelled,
           count(*) filter (where a.status in ('invited','accepted','checked_in','checked_out','completed'))::int as active_count,
           greatest(0, s.headcount - count(*) filter (where a.status in ('invited','accepted','checked_in','checked_out','completed')) )::int as open_slots
    from shift_blocks s
    left join shift_assignments a on a.shift_id = s.id
    where s.company_id = $1
      and ${whereStart}
      and s.start_at < now() + ($2::text || ' days')::interval
    group by s.id
    having ($3::boolean = false) or (greatest(0, s.headcount - count(*) filter (where a.status in ('invited','accepted','checked_in','checked_out','completed')) ) > 0)
    order by s.start_at asc
    limit $4`

  const r = await pool.query(q, [companyId, String(days), onlyUnfilled, limit])
  return res.json({
    window_days: days,
    items: r.rows || [],
  })
}))

corporateRouter.get('/company/shifts/:id', requireAuth, asyncHandler(async (req, res) => {
  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.status(404).json({ message: 'Shift not found' })
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'ops', 'supervisor', 'auditor'])
  if (!ok.ok) return
  const s = await pool.query(
    `select id, company_id, title, role_tag, location, department_id, start_at, end_at, headcount, status, created_by, created_at, updated_at,
            series_id,
            series_occurrence_date,
            (checkin_code_hash is not null)::boolean as checkin_enabled,
            checkin_last_rotated_at,
            checkin_geo_required,
            checkin_geo_radius_m,
            checkin_geo_lat,
            checkin_geo_lng,
            coverage_auto_fill_disabled
     from shift_blocks
     where id = $1 and company_id = $2
     limit 1`,
    [req.params.id, companyId],
  )
  const shift = s.rows[0] ?? null
  if (!shift) return res.status(404).json({ message: 'Shift not found' })

  const a = await pool.query(
    `select a.*,
            u.name as worker_name,
            u.role as worker_role,
            u.profile_pic as worker_profile_pic
     from shift_assignments a
     join users u on u.id = a.worker_user_id
     where a.shift_id = $1
     order by a.created_at asc`,
    [shift.id],
  )
  return res.json({ shift, assignments: a.rows })
}))

const UpdateShiftAutofillSchema = z.object({
  coverage_auto_fill_disabled: z.boolean(),
})

const UpdateShiftSchema = z.object({
  title: z.string().min(2).max(200).optional(),
  role_tag: z.string().max(80).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  department_id: z.string().uuid().optional().nullable(),
  start_at: z.string().datetime().optional(),
  end_at: z.string().datetime().optional(),
  headcount: z.number().int().min(1).max(500).optional(),
  status: z.enum(['scheduled', 'cancelled']).optional(),
})

corporateRouter.post('/company/shifts/:id/autofill', requireAuth, asyncHandler(async (req, res) => {
  const parsed = UpdateShiftAutofillSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })
  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.status(400).json({ message: 'Create your company profile first.' })
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'ops', 'supervisor'])
  if (!ok.ok) return
  const shiftId = String(req.params.id || '').trim()
  if (!shiftId) return res.status(400).json({ message: 'Invalid shift' })

  const r = await pool.query(
    `update shift_blocks
     set coverage_auto_fill_disabled = $3,
         updated_at = now()
     where id = $1 and company_id = $2
     returning id, coverage_auto_fill_disabled`,
    [shiftId, companyId, Boolean(parsed.data.coverage_auto_fill_disabled)],
  )
  if (r.rowCount === 0) return res.status(404).json({ message: 'Shift not found' })
  await logCompanyAudit(req, { companyId, action: 'shifts.autofill.update', targetType: 'shift', targetId: shiftId, meta: { coverage_auto_fill_disabled: Boolean(parsed.data.coverage_auto_fill_disabled) } })
  return res.json(r.rows[0])
}))

corporateRouter.put('/company/shifts/:id', requireAuth, asyncHandler(async (req, res) => {
  const parsed = UpdateShiftSchema.safeParse(req.body ?? {})
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })
  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.status(400).json({ message: 'Create your company profile first.' })
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'ops', 'supervisor'])
  if (!ok.ok) return
  const shiftId = String(req.params.id || '').trim()
  if (!shiftId) return res.status(400).json({ message: 'Invalid shift' })

  const curRes = await pool.query(
    `select id, title, role_tag, location, department_id, start_at, end_at, headcount, status
     from shift_blocks
     where id = $1 and company_id = $2
     limit 1`,
    [shiftId, companyId],
  )
  const cur = curRes.rows[0] ?? null
  if (!cur) return res.status(404).json({ message: 'Shift not found' })

  const started = cur.start_at ? new Date(cur.start_at).getTime() <= Date.now() : false
  const wantsTimeChange = parsed.data.start_at != null || parsed.data.end_at != null
  const wantsHeadcountChange = parsed.data.headcount != null
  if (started && (wantsTimeChange || wantsHeadcountChange)) {
    return res.status(400).json({ message: 'Cannot change time/headcount after shift start.' })
  }

  const nextStart = parsed.data.start_at ?? cur.start_at
  const nextEnd = parsed.data.end_at ?? cur.end_at
  if (nextStart && nextEnd) {
    const a = new Date(nextStart).getTime()
    const b = new Date(nextEnd).getTime()
    if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return res.status(400).json({ message: 'end_at must be after start_at' })
  }

  const nextStatus = parsed.data.status ?? cur.status
  const departmentId = parsed.data.department_id !== undefined ? (parsed.data.department_id ? String(parsed.data.department_id) : null) : undefined
  if (departmentId !== undefined && departmentId) {
    const d = await pool.query('select id from company_departments where id=$1 and company_id=$2 limit 1', [departmentId, companyId])
    if (!d.rowCount) return res.status(400).json({ message: 'Department not found' })
  }
  const r = await pool.query(
    `update shift_blocks
     set title = coalesce($3, title),
         role_tag = $4,
         location = $5,
         department_id = $10,
         start_at = coalesce($6, start_at),
         end_at = coalesce($7, end_at),
         headcount = coalesce($8, headcount),
         status = coalesce($9, status),
         updated_at = now()
     where id = $1 and company_id = $2
     returning id, company_id, title, role_tag, location, department_id, start_at, end_at, headcount, status, created_by, created_at, updated_at,
               series_id, series_occurrence_date,
               (checkin_code_hash is not null)::boolean as checkin_enabled,
               checkin_last_rotated_at,
               checkin_geo_required,
               checkin_geo_radius_m,
               checkin_geo_lat,
               checkin_geo_lng,
               coverage_auto_fill_disabled`,
    [
      shiftId,
      companyId,
      parsed.data.title ?? null,
      parsed.data.role_tag !== undefined ? parsed.data.role_tag : cur.role_tag,
      parsed.data.location !== undefined ? parsed.data.location : cur.location,
      parsed.data.start_at ?? null,
      parsed.data.end_at ?? null,
      parsed.data.headcount ?? null,
      parsed.data.status ?? null,
      departmentId !== undefined ? departmentId : (cur.department_id ?? null),
    ],
  )
  const updated = r.rows[0] ?? null
  if (!updated) return res.status(404).json({ message: 'Shift not found' })

  if (String(cur.status) !== 'cancelled' && String(nextStatus) === 'cancelled') {
    const a = await pool.query(
      `update shift_assignments
       set status = 'cancelled',
           updated_at = now()
       where shift_id = $1
         and status in ('invited','accepted')`,
      [shiftId],
    )
    // Notify workers (best-effort)
    const workers = await pool.query(`select worker_user_id from shift_assignments where shift_id = $1 and status = 'cancelled'`, [shiftId]).catch(() => ({ rows: [] }))
    const companyRes = await pool.query('select name from companies where id = $1 limit 1', [companyId]).catch(() => ({ rows: [] }))
    const companyName = companyRes.rows[0]?.name ?? 'Company'
    for (const w of workers.rows || []) {
      const uid = w.worker_user_id
      notify({
        userId: uid,
        type: 'shift_cancelled',
        title: 'Shift cancelled',
        body: `${companyName} cancelled a shift you were invited to.`,
        meta: { url: '/shifts', shift_id: shiftId, company_id: companyId },
        dedupeKey: `shift:${shiftId}:cancel:${uid}`,
      }).catch(() => {})
    }
    await logCompanyAudit(req, { companyId, action: 'shifts.cancel', targetType: 'shift', targetId: shiftId, meta: { cancelled_assignments: a.rowCount ?? 0 } })
  } else {
    await logCompanyAudit(req, { companyId, action: 'shifts.update', targetType: 'shift', targetId: shiftId })
  }

  const assignmentsRes = await pool.query(
    `select a.*,
            u.name as worker_name,
            u.role as worker_role,
            u.profile_pic as worker_profile_pic
     from shift_assignments a
     join users u on u.id = a.worker_user_id
     where a.shift_id = $1
     order by a.created_at asc`,
    [shiftId],
  )
  return res.json({ shift: updated, assignments: assignmentsRes.rows })
}))

corporateRouter.post('/company/shifts/:id/checkin/rotate', requireAuth, asyncHandler(async (req, res) => {
  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.status(400).json({ message: 'Create your company profile first.' })
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'ops', 'supervisor'])
  if (!ok.ok) return
  const shiftId = String(req.params.id || '').trim()
  if (!shiftId) return res.status(400).json({ message: 'Invalid shift' })

  const s = await pool.query('select id from shift_blocks where id = $1 and company_id = $2 limit 1', [shiftId, companyId])
  if (s.rowCount === 0) return res.status(404).json({ message: 'Shift not found' })

  const code = newCheckinCode()
  const hash = sha256Hex(code)
  await pool.query(
    `update shift_blocks
     set checkin_code_hash = $3,
         checkin_last_rotated_at = now(),
         updated_at = now()
     where id = $1 and company_id = $2`,
    [shiftId, companyId, hash],
  )
  return res.json({ ok: true, shift_id: shiftId, code })
}))

corporateRouter.post('/company/shifts/:id/checkin/disable', requireAuth, asyncHandler(async (req, res) => {
  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.status(400).json({ message: 'Create your company profile first.' })
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'ops', 'supervisor'])
  if (!ok.ok) return
  const shiftId = String(req.params.id || '').trim()
  if (!shiftId) return res.status(400).json({ message: 'Invalid shift' })

  const r = await pool.query(
    `update shift_blocks
     set checkin_code_hash = null,
         checkin_last_rotated_at = null,
         updated_at = now()
     where id = $1 and company_id = $2
     returning id`,
    [shiftId, companyId],
  )
  if (r.rowCount === 0) return res.status(404).json({ message: 'Shift not found' })
  return res.json({ ok: true })
}))

const UpdateShiftGeoCheckinSchema = z.object({
  required: z.boolean(),
  radius_m: z.preprocess((v) => (v == null || v === '' ? null : Number(v)), z.number().int().min(50).max(50_000)).optional().nullable(),
  lat: z.preprocess((v) => (v == null || v === '' ? null : Number(v)), z.number().min(-90).max(90)).optional().nullable(),
  lng: z.preprocess((v) => (v == null || v === '' ? null : Number(v)), z.number().min(-180).max(180)).optional().nullable(),
})

corporateRouter.post('/company/shifts/:id/checkin/geo', requireAuth, asyncHandler(async (req, res) => {
  const parsed = UpdateShiftGeoCheckinSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.status(400).json({ message: 'Create your company profile first.' })
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'ops', 'supervisor'])
  if (!ok.ok) return
  const shiftId = String(req.params.id || '').trim()
  if (!shiftId) return res.status(400).json({ message: 'Invalid shift' })

  const required = Boolean(parsed.data.required)
  const lat = parsed.data.lat ?? null
  const lng = parsed.data.lng ?? null
  const radiusM = parsed.data.radius_m ?? null

  if (required) {
    if (lat == null || lng == null || radiusM == null) {
      return res.status(400).json({ message: 'lat, lng, and radius_m are required when enabling geo check-in.' })
    }
  }

  const r = await pool.query(
    `update shift_blocks
     set checkin_geo_required = $3,
         checkin_geo_lat = $4,
         checkin_geo_lng = $5,
         checkin_geo_radius_m = $6,
         updated_at = now()
     where id = $1 and company_id = $2
     returning id, checkin_geo_required, checkin_geo_lat, checkin_geo_lng, checkin_geo_radius_m`,
    [shiftId, companyId, required, required ? lat : null, required ? lng : null, required ? radiusM : null],
  )
  if (r.rowCount === 0) return res.status(404).json({ message: 'Shift not found' })
  return res.json(r.rows[0])
}))

const WorkforceOverviewQuerySchema = z.object({
  days: z.preprocess((v) => (v == null ? 30 : Number(v)), z.number().int().min(1).max(365)).optional(),
})

corporateRouter.get('/company/workforce/overview', requireAuth, asyncHandler(async (req, res) => {
  const ownerUserId = req.user.role === 'admin' ? String(req.query.user_id ?? req.user.sub) : req.user.sub
  const parsed = WorkforceOverviewQuerySchema.safeParse(req.query)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })
  const days = Number(parsed.data.days ?? 30)

  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) {
    return res.json({
      window_days: days,
      window_start: null,
      window_end: new Date().toISOString(),
      totals: { assignments: 0, shifts: 0, by_status: {} },
      today: { shifts: 0, assignments: 0, by_status: {} },
    })
  }
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'ops', 'supervisor', 'auditor'])
  if (!ok.ok) return

  const windowEndIso = new Date().toISOString()

  const windowStartRes = await pool.query(`select (now() - ($1::text || ' days')::interval) as t0`, [String(days)])
  const windowStartIso = windowStartRes.rows[0]?.t0 ? new Date(windowStartRes.rows[0].t0).toISOString() : null

  const totalsByStatusRes = await pool.query(
    `select a.status, count(*)::int as count
     from shift_assignments a
     join shift_blocks s on s.id = a.shift_id
     where s.company_id = $1
       and s.start_at >= now() - ($2::text || ' days')::interval
     group by a.status`,
    [companyId, String(days)],
  )
  const totalsByStatus = {}
  let totalsAssignments = 0
  for (const r of totalsByStatusRes.rows || []) {
    totalsByStatus[String(r.status)] = Number(r.count || 0)
    totalsAssignments += Number(r.count || 0)
  }

  const totalsShiftsRes = await pool.query(
    `select count(*)::int as count
     from shift_blocks
     where company_id = $1
       and start_at >= now() - ($2::text || ' days')::interval`,
    [companyId, String(days)],
  )
  const totalsShifts = Number(totalsShiftsRes.rows[0]?.count ?? 0)

  const todayByStatusRes = await pool.query(
    `select a.status, count(*)::int as count
     from shift_assignments a
     join shift_blocks s on s.id = a.shift_id
     where s.company_id = $1
       and s.start_at < date_trunc('day', now()) + interval '1 day'
       and s.end_at >= date_trunc('day', now())
     group by a.status`,
    [companyId],
  )
  const todayByStatus = {}
  let todayAssignments = 0
  for (const r of todayByStatusRes.rows || []) {
    todayByStatus[String(r.status)] = Number(r.count || 0)
    todayAssignments += Number(r.count || 0)
  }

  const todayShiftsRes = await pool.query(
    `select count(*)::int as count
     from shift_blocks
     where company_id = $1
       and start_at < date_trunc('day', now()) + interval '1 day'
       and end_at >= date_trunc('day', now())`,
    [companyId],
  )
  const todayShifts = Number(todayShiftsRes.rows[0]?.count ?? 0)

  return res.json({
    window_days: days,
    window_start: windowStartIso,
    window_end: windowEndIso,
    totals: { shifts: totalsShifts, assignments: totalsAssignments, by_status: totalsByStatus },
    today: { shifts: todayShifts, assignments: todayAssignments, by_status: todayByStatus },
  })
}))

const WorkforceInsightsQuerySchema = z.object({
  days: z.preprocess((v) => (v == null ? 30 : Number(v)), z.number().int().min(7).max(365)).optional(),
  limit: z.preprocess((v) => (v == null ? 10 : Number(v)), z.number().int().min(3).max(50)).optional(),
})

corporateRouter.get('/company/workforce/insights', requireAuth, asyncHandler(async (req, res) => {
  const parsed = WorkforceInsightsQuerySchema.safeParse(req.query)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })
  const days = Number(parsed.data.days ?? 30)
  const limit = Number(parsed.data.limit ?? 10)

  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) {
    return res.json({
      window_days: days,
      window_start: null,
      window_end: new Date().toISOString(),
      top_reliable: [],
      at_risk: [],
      daily: [],
    })
  }
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'ops', 'hr', 'supervisor', 'auditor'])
  if (!ok.ok) return

  const windowEndIso = new Date().toISOString()
  const windowStartRes = await pool.query(`select (now() - ($1::text || ' days')::interval) as t0`, [String(days)])
  const windowStartIso = windowStartRes.rows[0]?.t0 ? new Date(windowStartRes.rows[0].t0).toISOString() : null

  const byWorker = await pool.query(
    `with stats as (
       select a.worker_user_id,
              count(*)::int as invited,
              count(*) filter (where a.status in ('accepted','checked_in','checked_out','completed'))::int as accepted,
              count(*) filter (where a.status = 'completed')::int as completed,
              count(*) filter (where a.status = 'no_show')::int as no_shows,
              count(*) filter (where a.check_in_at is not null)::int as check_ins
       from shift_assignments a
       join shift_blocks s on s.id = a.shift_id
       where s.company_id = $1
         and s.start_at >= now() - ($2::text || ' days')::interval
       group by a.worker_user_id
     )
     select u.id,
            u.name,
            u.role,
            u.profile_pic,
            coalesce(n.preferred, false) as preferred,
            coalesce(n.blocked, false) as blocked,
            st.invited as shifts_invited,
            st.accepted as shifts_accepted,
            st.completed as shifts_completed,
            st.no_shows as shifts_no_show,
            st.check_ins as shifts_checked_in,
            case when st.invited > 0 then round(100.0 * (st.invited - st.no_shows) / nullif(st.invited, 0))::int else null end as reliability_pct,
            case when st.accepted > 0 then round(100.0 * st.check_ins / nullif(st.accepted, 0))::int else null end as attendance_pct,
            case when st.invited > 0 then round(100.0 * st.no_shows / nullif(st.invited, 0))::int else null end as no_show_rate_pct
     from stats st
     join users u on u.id = st.worker_user_id
     left join employer_worker_notes n on n.company_id = $1 and n.worker_user_id = u.id
     where coalesce(n.blocked, false) = false`,
    [companyId, String(days)],
  )

  const rows = byWorker.rows || []
  const topReliable = rows
    .filter((r) => Number(r.shifts_invited ?? 0) >= 2)
    .sort((a, b) => {
      const ap = Number(a.preferred ? 1 : 0)
      const bp = Number(b.preferred ? 1 : 0)
      if (bp !== ap) return bp - ap
      const ar = Number(a.reliability_pct ?? -1)
      const br = Number(b.reliability_pct ?? -1)
      if (br !== ar) return br - ar
      return Number(b.shifts_completed ?? 0) - Number(a.shifts_completed ?? 0)
    })
    .slice(0, limit)

  const atRisk = rows
    .filter((r) => Number(r.shifts_invited ?? 0) >= 2)
    .sort((a, b) => {
      const an = Number(a.no_show_rate_pct ?? -1)
      const bn = Number(b.no_show_rate_pct ?? -1)
      if (bn !== an) return bn - an
      return Number(b.shifts_no_show ?? 0) - Number(a.shifts_no_show ?? 0)
    })
    .slice(0, limit)

  const dailyRes = await pool.query(
    `with days as (
       select generate_series(
         date_trunc('day', now() - ($2::text || ' days')::interval),
         date_trunc('day', now()),
         interval '1 day'
       ) as day
     ),
     stats as (
       select date_trunc('day', s.start_at) as day,
              count(*)::int as assignments,
              count(*) filter (where a.status = 'no_show')::int as no_shows,
              count(*) filter (where a.status = 'completed')::int as completed,
              count(*) filter (where a.check_in_at is not null)::int as check_ins
       from shift_assignments a
       join shift_blocks s on s.id = a.shift_id
       where s.company_id = $1
         and s.start_at >= now() - ($2::text || ' days')::interval
       group by 1
     )
     select to_char(d.day, 'YYYY-MM-DD') as date,
            coalesce(st.assignments, 0) as assignments,
            coalesce(st.no_shows, 0) as no_shows,
            coalesce(st.completed, 0) as completed,
            coalesce(st.check_ins, 0) as check_ins
     from days d
     left join stats st on st.day = d.day
     order by d.day asc`,
    [companyId, String(days)],
  )

  return res.json({
    window_days: days,
    window_start: windowStartIso,
    window_end: windowEndIso,
    top_reliable: topReliable,
    at_risk: atRisk,
    daily: dailyRes.rows || [],
  })
}))

const CompanyAnalyticsQuerySchema = z.object({
  days: z.preprocess((v) => (v == null ? 30 : Number(v)), z.number().int().min(1).max(365)).optional(),
})

corporateRouter.get('/company/analytics', requireAuth, asyncHandler(async (req, res) => {
  const parsed = CompanyAnalyticsQuerySchema.safeParse(req.query)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })
  const days = Number(parsed.data.days ?? 30)

  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) {
    return res.json({
      window_days: days,
      workforce: { shifts_total: 0, shifts_completed: 0, no_shows_total: 0, preferred_count: 0, workers_in_pools: 0 },
      budgets: [],
      departments_count: 0,
    })
  }
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'ops', 'hr', 'finance', 'supervisor', 'auditor'])
  if (!ok.ok) return

  const wfRes = await pool.query(
    `select
       count(distinct s.id)::int as shifts_total,
       count(distinct case when a.status = 'completed' then s.id end)::int as shifts_with_completed,
       count(*) filter (where a.status = 'no_show')::int as no_shows_total,
       count(*) filter (where a.status = 'completed')::int as assignments_completed
     from shift_blocks s
     left join shift_assignments a on a.shift_id = s.id
     where s.company_id = $1
       and s.start_at >= now() - ($2::text || ' days')::interval`,
    [companyId, String(days)],
  )
  const wf = wfRes.rows[0] ?? {}
  const prefRes = await pool.query(
    `select count(*)::int as n from employer_worker_notes where company_id = $1 and preferred = true`,
    [companyId],
  )
  const poolRes = await pool.query(
    `select count(distinct m.worker_user_id)::int as n
     from employer_worker_list_members m
     join employer_worker_lists l on l.id = m.list_id
     where l.company_id = $1`,
    [companyId],
  )
  let departmentsCount = 0
  let budgetRows = []
  try {
    const deptRes = await pool.query(
      `select count(*)::int as n from company_departments where company_id = $1`,
      [companyId],
    )
    departmentsCount = Number(deptRes.rows[0]?.n ?? 0)
    const budgetRes = await pool.query(
      `select id, department_id, period_start, period_end, budget_limit_ghs, spent_ghs
       from company_budgets
       where company_id = $1 and period_end >= current_date
       order by period_end asc limit 20`,
      [companyId],
    )
    budgetRows = budgetRes.rows ?? []
  } catch {
    // Tables may not exist if migration 106 hasn't run
  }

  const workforce = {
    shifts_total: Number(wf.shifts_total ?? 0),
    shifts_completed: Number(wf.assignments_completed ?? 0),
    no_shows_total: Number(wf.no_shows_total ?? 0),
    preferred_count: Number(prefRes.rows[0]?.n ?? 0),
    workers_in_pools: Number(poolRes.rows[0]?.n ?? 0),
  }
  const budgets = budgetRows.map((b) => ({
    id: b.id,
    department_id: b.department_id,
    period_start: b.period_start,
    period_end: b.period_end,
    budget_limit_ghs: Number(b.budget_limit_ghs ?? 0),
    spent_ghs: Number(b.spent_ghs ?? 0),
    utilisation_pct: Number(b.budget_limit_ghs) > 0
      ? Math.round((100 * Number(b.spent_ghs ?? 0)) / Number(b.budget_limit_ghs))
      : 0,
  }))

  return res.json({
    window_days: days,
    workforce,
    budgets,
    departments_count: departmentsCount,
  })
}))

// --- Enterprise: Departments CRUD ---
corporateRouter.get('/company/departments', requireAuth, asyncHandler(async (req, res) => {
  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.json({ items: [] })
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'ops', 'hr', 'finance', 'supervisor', 'auditor'])
  if (!ok.ok) return
  try {
    const r = await pool.query(
      `select id, company_id, name, slug, location, created_at
       from company_departments where company_id = $1 order by name asc`,
      [companyId],
    )
    return res.json({ items: r.rows ?? [] })
  } catch (e) {
    if (String(e?.code || '') === '42P01') return res.json({ items: [] })
    throw e
  }
}))

const DepartmentCreateSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().max(100).optional().nullable(),
  location: z.string().max(500).optional().nullable(),
})

corporateRouter.post('/company/departments', requireAuth, asyncHandler(async (req, res) => {
  const parsed = DepartmentCreateSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })
  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.status(400).json({ message: 'Create your company profile first.' })
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'ops', 'hr', 'finance'])
  if (!ok.ok) return
  const name = String(parsed.data.name).trim()
  const slug = parsed.data.slug ? String(parsed.data.slug).trim().toLowerCase() || null : null
  const location = parsed.data.location ? String(parsed.data.location).trim() : null
  const r = await pool.query(
    `insert into company_departments (company_id, name, slug, location) values ($1,$2,$3,$4)
     returning id, company_id, name, slug, location, created_at`,
    [companyId, name, slug, location],
  )
  await logCompanyAudit(req, { companyId, action: 'department.create', targetType: 'department', targetId: r.rows[0]?.id, meta: { name } })
  return res.status(201).json(r.rows[0])
}))

corporateRouter.put('/company/departments/:id', requireAuth, asyncHandler(async (req, res) => {
  const parsed = DepartmentCreateSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })
  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.status(400).json({ message: 'Create your company profile first.' })
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'ops', 'hr', 'finance'])
  if (!ok.ok) return
  const deptId = String(req.params.id)
  const name = String(parsed.data.name).trim()
  const slug = parsed.data.slug ? String(parsed.data.slug).trim().toLowerCase() || null : null
  const location = parsed.data.location ? String(parsed.data.location).trim() : null
  const r = await pool.query(
    `update company_departments set name=$3, slug=$4, location=$5, updated_at=now()
     where id=$1 and company_id=$2 returning id, company_id, name, slug, location, updated_at`,
    [deptId, companyId, name, slug, location],
  )
  if (!r.rowCount) return res.status(404).json({ message: 'Department not found' })
  await logCompanyAudit(req, { companyId, action: 'department.update', targetType: 'department', targetId: deptId, meta: { name } })
  return res.json(r.rows[0])
}))

corporateRouter.delete('/company/departments/:id', requireAuth, asyncHandler(async (req, res) => {
  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.status(400).json({ message: 'Create your company profile first.' })
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'ops', 'finance'])
  if (!ok.ok) return
  const deptId = String(req.params.id)
  const r = await pool.query('delete from company_departments where id=$1 and company_id=$2 returning id', [deptId, companyId])
  if (!r.rowCount) return res.status(404).json({ message: 'Department not found' })
  await logCompanyAudit(req, { companyId, action: 'department.delete', targetType: 'department', targetId: deptId })
  return res.json({ ok: true })
}))

// --- Enterprise: Budgets CRUD ---
corporateRouter.get('/company/budgets', requireAuth, asyncHandler(async (req, res) => {
  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.json({ items: [] })
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'ops', 'hr', 'finance', 'auditor'])
  if (!ok.ok) return
  try {
    const r = await pool.query(
      `select b.id, b.company_id, b.department_id, d.name as department_name,
              b.period_start, b.period_end, b.budget_limit_ghs, b.spent_ghs, b.notes, b.created_at
       from company_budgets b
       left join company_departments d on d.id = b.department_id
       where b.company_id = $1 order by b.period_end desc, b.created_at desc limit 100`,
      [companyId],
    )
    const items = (r.rows ?? []).map((x) => ({
      ...x,
      utilisation_pct: Number(x.budget_limit_ghs) > 0 ? Math.round((100 * Number(x.spent_ghs ?? 0)) / Number(x.budget_limit_ghs)) : 0,
    }))
    return res.json({ items })
  } catch (e) {
    if (String(e?.code || '') === '42P01') return res.json({ items: [] })
    throw e
  }
}))

const BudgetCreateSchema = z.object({
  department_id: z.string().uuid().optional().nullable(),
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  budget_limit_ghs: z.preprocess((v) => (v == null ? 0 : Number(v)), z.number().min(0)),
  spent_ghs: z.preprocess((v) => (v == null ? 0 : Number(v)), z.number().min(0)).optional(),
  notes: z.string().max(500).optional().nullable(),
})

corporateRouter.post('/company/budgets', requireAuth, asyncHandler(async (req, res) => {
  const parsed = BudgetCreateSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })
  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.status(400).json({ message: 'Create your company profile first.' })
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'ops', 'finance'])
  if (!ok.ok) return
  const { department_id, period_start, period_end, budget_limit_ghs, spent_ghs, notes } = parsed.data
  if (period_end < period_start) return res.status(400).json({ message: 'period_end must be >= period_start' })
  if (department_id) {
    const d = await pool.query('select id from company_departments where id=$1 and company_id=$2 limit 1', [department_id, companyId])
    if (!d.rowCount) return res.status(400).json({ message: 'Department not found' })
  }
  const r = await pool.query(
    `insert into company_budgets (company_id, department_id, period_start, period_end, budget_limit_ghs, spent_ghs, notes, created_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8)
     returning id, company_id, department_id, period_start, period_end, budget_limit_ghs, spent_ghs, notes, created_at`,
    [companyId, department_id || null, period_start, period_end, budget_limit_ghs, spent_ghs ?? 0, notes || null, req.user.sub],
  )
  await logCompanyAudit(req, { companyId, action: 'budget.create', targetType: 'budget', targetId: r.rows[0]?.id, meta: { period_start, period_end } })
  return res.status(201).json(r.rows[0])
}))

const BudgetUpdateSchema = z.object({
  spent_ghs: z.preprocess((v) => (v == null ? undefined : Number(v)), z.number().min(0)).optional(),
  budget_limit_ghs: z.preprocess((v) => (v == null ? undefined : Number(v)), z.number().min(0)).optional(),
  notes: z.string().max(500).optional().nullable(),
})

corporateRouter.put('/company/budgets/:id', requireAuth, asyncHandler(async (req, res) => {
  const parsed = BudgetUpdateSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })
  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.status(400).json({ message: 'Create your company profile first.' })
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'ops', 'finance'])
  if (!ok.ok) return
  const budgetId = String(req.params.id)
  const updates = []
  const values = [budgetId, companyId]
  let idx = 3
  if (parsed.data.spent_ghs !== undefined) {
    updates.push(`spent_ghs = $${idx++}`)
    values.push(parsed.data.spent_ghs)
  }
  if (parsed.data.budget_limit_ghs !== undefined) {
    updates.push(`budget_limit_ghs = $${idx++}`)
    values.push(parsed.data.budget_limit_ghs)
  }
  if (parsed.data.notes !== undefined) {
    updates.push(`notes = $${idx++}`)
    values.push(parsed.data.notes)
  }
  if (updates.length === 0) return res.status(400).json({ message: 'No fields to update' })
  updates.push('updated_at = now()')
  const r = await pool.query(
    `update company_budgets set ${updates.join(', ')} where id=$1 and company_id=$2 returning *`,
    values,
  )
  if (!r.rowCount) return res.status(404).json({ message: 'Budget not found' })
  await logCompanyAudit(req, { companyId, action: 'budget.update', targetType: 'budget', targetId: budgetId })
  return res.json(r.rows[0])
}))

corporateRouter.delete('/company/budgets/:id', requireAuth, asyncHandler(async (req, res) => {
  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.status(400).json({ message: 'Create your company profile first.' })
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'ops', 'finance'])
  if (!ok.ok) return
  const budgetId = String(req.params.id)
  const r = await pool.query('delete from company_budgets where id=$1 and company_id=$2 returning id', [budgetId, companyId])
  if (!r.rowCount) return res.status(404).json({ message: 'Budget not found' })
  await logCompanyAudit(req, { companyId, action: 'budget.delete', targetType: 'budget', targetId: budgetId })
  return res.json({ ok: true })
}))

corporateRouter.post('/company/budgets/:id/sync-from-payroll', requireAuth, asyncHandler(async (req, res) => {
  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.status(400).json({ message: 'Create your company profile first.' })
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'ops', 'finance'])
  if (!ok.ok) return
  const budgetId = String(req.params.id)
  const b = await pool.query(
    'select id, company_id, department_id, period_start, period_end from company_budgets where id=$1 and company_id=$2 limit 1',
    [budgetId, companyId],
  )
  const budget = b.rows[0] ?? null
  if (!budget) return res.status(404).json({ message: 'Budget not found' })
  const periodStart = budget.period_start
  const periodEnd = budget.period_end
  const r = await pool.query(
    `select coalesce(sum(i.gross_pay), 0)::numeric as total
     from employer_pay_run_items i
     join employer_pay_runs r on r.id = i.pay_run_id
     where r.company_id = $1
       and r.period_start <= $3
       and r.period_end >= $2`,
    [companyId, periodStart, periodEnd],
  )
  const spent = Number(r.rows[0]?.total ?? 0)
  await pool.query(
    'update company_budgets set spent_ghs = $3, updated_at = now() where id = $1 and company_id = $2',
    [budgetId, companyId, spent],
  )
  await logCompanyAudit(req, { companyId, action: 'budget.sync_from_payroll', targetType: 'budget', targetId: budgetId, meta: { spent_ghs: spent } })
  const updated = await pool.query(
    'select id, period_start, period_end, budget_limit_ghs, spent_ghs from company_budgets where id=$1 and company_id=$2 limit 1',
    [budgetId, companyId],
  )
  return res.json(updated.rows[0])
}))

const AssignWorkersSchema = z.object({
  worker_user_ids: z.array(z.string().uuid()).min(1).max(200),
})

corporateRouter.post('/company/shifts/:id/assign', requireAuth, asyncHandler(async (req, res) => {
  const parsed = AssignWorkersSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })
  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.status(400).json({ message: 'Create your company profile first.' })
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'ops', 'supervisor'])
  if (!ok.ok) return

  const s = await pool.query('select * from shift_blocks where id = $1 and company_id = $2 limit 1', [req.params.id, companyId])
  const shift = s.rows[0] ?? null
  if (!shift) return res.status(404).json({ message: 'Shift not found' })

  const companyRes = await pool.query('select name, slug from companies where id = $1 limit 1', [companyId])
  const companyName = companyRes.rows[0]?.name ?? 'Company'

  const inserted = []
  for (const workerUserId of parsed.data.worker_user_ids) {
    // eslint-disable-next-line no-await-in-loop
    const r = await pool.query(
      `insert into shift_assignments (shift_id, worker_user_id, status, invited_at, created_by, updated_at)
       values ($1,$2,'invited',now(),$3,now())
       on conflict (shift_id, worker_user_id) do nothing
       returning *`,
      [shift.id, workerUserId, req.user.sub],
    )
    if (r.rows[0]) inserted.push(r.rows[0])

    // Notify worker (best-effort)
    notify({
      userId: workerUserId,
      type: 'shift_invite',
      title: 'Shift invitation',
      body: `${companyName} invited you to a shift. Tap to view and accept.`,
      meta: { url: '/shifts', shift_id: shift.id, company_id: companyId },
      dedupeKey: `shift:${shift.id}:invite:${workerUserId}`,
    }).catch(() => {})
  }
  return res.status(201).json({ ok: true, inserted_count: inserted.length, inserted })
}))

const FillFromPoolSchema = z.object({
  list_id: z.string().uuid(),
  mode: z.enum(['count', 'remaining', 'replace_no_shows']).optional(),
  count: z.preprocess((v) => (v == null ? 1 : Number(v)), z.number().int().min(1).max(200)).optional(),
})

const BulkFillFromPoolSchema = FillFromPoolSchema.extend({
  shift_ids: z.array(z.string().uuid()).min(1).max(200),
})

corporateRouter.post('/company/shifts/:id/fill-from-pool', requireAuth, asyncHandler(async (req, res) => {
  const parsed = FillFromPoolSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })
  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.status(400).json({ message: 'Create your company profile first.' })
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'ops', 'supervisor'])
  if (!ok.ok) return

  const shiftId = String(req.params.id || '').trim()
  const shiftRes = await pool.query('select id, headcount from shift_blocks where id = $1 and company_id = $2 limit 1', [shiftId, companyId])
  const shift = shiftRes.rows[0] ?? null
  if (!shift) return res.status(404).json({ message: 'Shift not found' })

  const listId = parsed.data.list_id
  const listRes = await pool.query('select id from employer_worker_lists where id = $1 and company_id = $2 limit 1', [listId, companyId])
  if (listRes.rowCount === 0) return res.status(404).json({ message: 'Worker pool not found' })

  const mode = String(parsed.data.mode ?? 'count')
  const requestedCount = Number(parsed.data.count ?? 1)

  // Count current staffing for headcount-safe modes.
  // Active staffing counts toward headcount; terminal outcomes don't.
  const headcount = Number(shift.headcount ?? 1)
  const countsRes = await pool.query(
    `select
        sum(case when a.status in ('invited','accepted','checked_in','checked_out','completed') then 1 else 0 end)::int as active,
        sum(case when a.status = 'no_show' then 1 else 0 end)::int as no_shows
     from shift_assignments a
     where a.shift_id = $1`,
    [shiftId],
  )
  const activeCount = Number(countsRes.rows[0]?.active ?? 0)
  const noShowCount = Number(countsRes.rows[0]?.no_shows ?? 0)
  const holes = Math.max(0, headcount - activeCount)

  let count = requestedCount
  if (mode === 'remaining') count = holes
  else if (mode === 'replace_no_shows') count = Math.min(holes, noShowCount)

  if (!Number.isFinite(count) || count <= 0) {
    return res.status(201).json({
      ok: true,
      mode,
      headcount,
      active_count: activeCount,
      holes,
      no_show_count: noShowCount,
      inserted_count: 0,
      inserted: [],
    })
  }

  // Pick candidates from pool not already assigned to this shift.
  const candidatesRes = await pool.query(
    `with members as (
       select m.worker_user_id
       from employer_worker_list_members m
       where m.list_id = $2
     ),
     stats as (
       select a.worker_user_id,
              sum(case when a.status='completed' then 1 else 0 end)::int as completed,
              sum(case when a.status='no_show' then 1 else 0 end)::int as no_shows,
              sum(case when a.status in ('checked_in','checked_out','completed') then 1 else 0 end)::int as check_ins
       from shift_assignments a
       join shift_blocks s on s.id = a.shift_id
       where s.company_id = $1
       group by a.worker_user_id
     ),
     notes as (
      select worker_user_id, rating, preferred, blocked
       from employer_worker_notes
       where company_id = $1
     )
     select mem.worker_user_id,
            coalesce(st.completed,0) as completed,
            coalesce(st.no_shows,0) as no_shows,
            coalesce(st.check_ins,0) as check_ins,
           coalesce(n.rating, null) as rating,
           coalesce(n.preferred, false) as preferred,
           coalesce(n.blocked, false) as blocked
     from members mem
     left join stats st on st.worker_user_id = mem.worker_user_id
     left join notes n on n.worker_user_id = mem.worker_user_id
     where not exists (
       select 1 from shift_assignments a2 where a2.shift_id = $3 and a2.worker_user_id = mem.worker_user_id
     )
      and coalesce(n.blocked, false) = false
    order by coalesce(n.preferred, false) desc,
             n.rating desc nulls last,
             coalesce(st.completed,0) desc,
             coalesce(st.no_shows,0) asc,
             coalesce(st.check_ins,0) desc
     limit $4`,
    [companyId, listId, shiftId, count],
  )

  const workerIds = (candidatesRes.rows || []).map((r) => r.worker_user_id)
  if (workerIds.length === 0) {
    return res.status(201).json({
      ok: true,
      mode,
      headcount,
      active_count: activeCount,
      holes,
      no_show_count: noShowCount,
      inserted_count: 0,
      inserted: [],
    })
  }

  const companyRes = await pool.query('select name from companies where id = $1 limit 1', [companyId])
  const companyName = companyRes.rows[0]?.name ?? 'Company'

  const inserted = []
  for (const workerUserId of workerIds) {
    // eslint-disable-next-line no-await-in-loop
    const r = await pool.query(
      `insert into shift_assignments (shift_id, worker_user_id, status, invited_at, created_by, updated_at)
       values ($1,$2,'invited',now(),$3,now())
       on conflict (shift_id, worker_user_id) do nothing
       returning *`,
      [shiftId, workerUserId, req.user.sub],
    )
    if (r.rows[0]) inserted.push(r.rows[0])
    notify({
      userId: workerUserId,
      type: 'shift_invite',
      title: 'Shift invitation',
      body: `${companyName} invited you to a shift. Tap to view and accept.`,
      meta: { url: '/shifts', shift_id: shiftId, company_id: companyId },
      dedupeKey: `shift:${shiftId}:invite:${workerUserId}`,
    }).catch(() => {})
  }

  return res.status(201).json({
    ok: true,
    mode,
    headcount,
    active_count: activeCount,
    holes,
    no_show_count: noShowCount,
    inserted_count: inserted.length,
    inserted,
  })
}))

corporateRouter.post('/company/shifts/fill-from-pool/bulk', requireAuth, asyncHandler(async (req, res) => {
  const parsed = BulkFillFromPoolSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })
  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.status(400).json({ message: 'Create your company profile first.' })
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'ops', 'supervisor'])
  if (!ok.ok) return

  const listId = parsed.data.list_id
  const listRes = await pool.query('select id from employer_worker_lists where id = $1 and company_id = $2 limit 1', [listId, companyId])
  if (listRes.rowCount === 0) return res.status(404).json({ message: 'Worker pool not found' })

  const mode = String(parsed.data.mode ?? 'remaining')
  const requestedCount = Number(parsed.data.count ?? 1)
  const rawShiftIds = Array.isArray(parsed.data.shift_ids) ? parsed.data.shift_ids : []
  const shiftIds = Array.from(new Set(rawShiftIds.map((x) => String(x || '').trim()).filter(Boolean)))
  if (shiftIds.length === 0) return res.status(400).json({ message: 'No shifts provided' })

  const shiftsRes = await pool.query(
    `select id, headcount
     from shift_blocks
     where company_id = $1
       and id = any($2::uuid[])`,
    [companyId, shiftIds],
  )
  const shiftById = new Map((shiftsRes.rows || []).map((r) => [String(r.id), r]))

  const companyRes = await pool.query('select name from companies where id = $1 limit 1', [companyId])
  const companyName = companyRes.rows[0]?.name ?? 'Company'

  const MAX_TOTAL_INVITES = 2000
  let insertedTotal = 0
  const notFound = []
  const skipped = []
  const results = []

  for (const shiftId of shiftIds) {
    if (insertedTotal >= MAX_TOTAL_INVITES) {
      skipped.push({ shift_id: shiftId, code: 'CAP_REACHED' })
      continue
    }

    const shift = shiftById.get(String(shiftId)) ?? null
    if (!shift) {
      notFound.push(shiftId)
      continue
    }

    const headcount = Number(shift.headcount ?? 1)
    const countsRes = await pool.query(
      `select
          sum(case when a.status in ('invited','accepted','checked_in','checked_out','completed') then 1 else 0 end)::int as active,
          sum(case when a.status = 'no_show' then 1 else 0 end)::int as no_shows
       from shift_assignments a
       where a.shift_id = $1`,
      [shiftId],
    )
    const activeCount = Number(countsRes.rows[0]?.active ?? 0)
    const noShowCount = Number(countsRes.rows[0]?.no_shows ?? 0)
    const holes = Math.max(0, headcount - activeCount)

    let count = requestedCount
    if (mode === 'remaining') count = holes
    else if (mode === 'replace_no_shows') count = Math.min(holes, noShowCount)
    if (!Number.isFinite(count) || count <= 0) {
      results.push({ shift_id: shiftId, ok: true, inserted_count: 0, headcount, active_count: activeCount, holes, no_show_count: noShowCount })
      continue
    }
    count = Math.min(count, MAX_TOTAL_INVITES - insertedTotal)

    const candidatesRes = await pool.query(
      `with members as (
         select m.worker_user_id
         from employer_worker_list_members m
         where m.list_id = $2
       ),
       stats as (
         select a.worker_user_id,
                sum(case when a.status='completed' then 1 else 0 end)::int as completed,
                sum(case when a.status='no_show' then 1 else 0 end)::int as no_shows,
                sum(case when a.status in ('checked_in','checked_out','completed') then 1 else 0 end)::int as check_ins
         from shift_assignments a
         join shift_blocks s on s.id = a.shift_id
         where s.company_id = $1
         group by a.worker_user_id
       ),
       notes as (
        select worker_user_id, rating, preferred, blocked
         from employer_worker_notes
         where company_id = $1
       )
       select mem.worker_user_id,
              coalesce(st.completed,0) as completed,
              coalesce(st.no_shows,0) as no_shows,
              coalesce(st.check_ins,0) as check_ins,
             coalesce(n.rating, null) as rating,
             coalesce(n.preferred, false) as preferred,
             coalesce(n.blocked, false) as blocked
       from members mem
       left join stats st on st.worker_user_id = mem.worker_user_id
       left join notes n on n.worker_user_id = mem.worker_user_id
       where not exists (
         select 1 from shift_assignments a2 where a2.shift_id = $3 and a2.worker_user_id = mem.worker_user_id
       )
        and coalesce(n.blocked, false) = false
      order by coalesce(n.preferred, false) desc,
               n.rating desc nulls last,
               coalesce(st.completed,0) desc,
               coalesce(st.no_shows,0) asc,
               coalesce(st.check_ins,0) desc
       limit $4`,
      [companyId, listId, shiftId, count],
    )

    const workerIds = (candidatesRes.rows || []).map((r) => r.worker_user_id)
    if (workerIds.length === 0) {
      results.push({ shift_id: shiftId, ok: true, inserted_count: 0, headcount, active_count: activeCount, holes, no_show_count: noShowCount })
      continue
    }

    let insertedCount = 0
    for (const workerUserId of workerIds) {
      // eslint-disable-next-line no-await-in-loop
      const r = await pool.query(
        `insert into shift_assignments (shift_id, worker_user_id, status, invited_at, created_by, updated_at)
         values ($1,$2,'invited',now(),$3,now())
         on conflict (shift_id, worker_user_id) do nothing
         returning 1`,
        [shiftId, workerUserId, req.user.sub],
      )
      if (r.rowCount > 0) {
        insertedCount += 1
        insertedTotal += 1
      }
      notify({
        userId: workerUserId,
        type: 'shift_invite',
        title: 'Shift invitation',
        body: `${companyName} invited you to a shift. Tap to view and accept.`,
        meta: { url: '/shifts', shift_id: shiftId, company_id: companyId },
        dedupeKey: `shift:${shiftId}:invite:${workerUserId}`,
      }).catch(() => {})
      if (insertedTotal >= MAX_TOTAL_INVITES) break
    }

    results.push({ shift_id: shiftId, ok: true, inserted_count: insertedCount, headcount, active_count: activeCount, holes, no_show_count: noShowCount })
  }

  await logCompanyAudit(req, {
    companyId,
    action: 'shifts.fill_from_pool.bulk',
    targetType: 'shift',
    targetId: null,
    meta: { list_id: listId, mode, requested_shifts: shiftIds.length, inserted_total: insertedTotal, not_found_count: notFound.length, skipped_count: skipped.length },
  })

  return res.status(201).json({
    ok: true,
    mode,
    list_id: listId,
    requested_shifts: shiftIds.length,
    processed_shifts: results.length,
    inserted_total: insertedTotal,
    not_found: notFound,
    skipped,
    results,
  })
}))

const UpdateAssignmentStatusSchema = z.object({
  status: z.enum(['invited', 'accepted', 'declined', 'checked_in', 'checked_out', 'completed', 'no_show', 'cancelled']),
})

const BulkUpdateAssignmentStatusSchema = z.object({
  worker_user_ids: z.array(z.string().uuid()).min(1).max(250),
  status: z.enum(['invited', 'accepted', 'declined', 'checked_in', 'checked_out', 'completed', 'no_show', 'cancelled']),
})

corporateRouter.post('/company/shifts/:shiftId/assignments/bulk-status', requireAuth, asyncHandler(async (req, res) => {
  const parsed = BulkUpdateAssignmentStatusSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })
  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.status(400).json({ message: 'Create your company profile first.' })
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'ops', 'supervisor'])
  if (!ok.ok) return

  const shiftId = String(req.params.shiftId || '').trim()
  const shiftRes = await pool.query('select 1 from shift_blocks where id = $1 and company_id = $2 limit 1', [shiftId, companyId])
  if (shiftRes.rowCount === 0) return res.status(404).json({ message: 'Shift not found' })

  const nextStatus = parsed.data.status
  const client = await pool.connect()
  try {
    await client.query('begin')
    const updated = []
    const notFound = []

    for (const workerUserId of parsed.data.worker_user_ids) {
      // eslint-disable-next-line no-await-in-loop
      const r = await updateShiftAssignmentStatusTx(client, {
        companyId,
        shiftId,
        workerUserId,
        nextStatus,
        actorUserId: req.user.sub,
      })
      if (!r.ok) notFound.push(workerUserId)
      else updated.push(r.updated)
    }

    await client.query('commit')
    return res.json({ ok: true, updated_count: updated.length, not_found_count: notFound.length, updated, not_found: notFound })
  } catch (e) {
    try { await client.query('rollback') } catch {}
    throw e
  } finally {
    client.release()
  }
}))

async function updateShiftAssignmentStatusTx(client, { companyId, shiftId, workerUserId, nextStatus, actorUserId }) {
  const a0 = await client.query(`select * from shift_assignments where shift_id = $1 and worker_user_id = $2 for update`, [shiftId, workerUserId])
  const prev = a0.rows[0] ?? null
  if (!prev) return { ok: false, code: 'ASSIGNMENT_NOT_FOUND' }

  const patches = {
    responded_at: ['accepted', 'declined'].includes(nextStatus) ? 'now()' : null,
    check_in_at: nextStatus === 'checked_in' ? 'now()' : null,
    check_out_at: nextStatus === 'checked_out' ? 'now()' : null,
    completed_at: nextStatus === 'completed' ? 'now()' : null,
    no_show_confirmed_at: nextStatus === 'no_show' ? 'now()' : null,
  }

  const updated = await client.query(
    `update shift_assignments
     set status = $3,
         responded_at = coalesce(responded_at, ${patches.responded_at ?? 'responded_at'}),
         check_in_at = coalesce(check_in_at, ${patches.check_in_at ?? 'check_in_at'}),
         check_out_at = coalesce(check_out_at, ${patches.check_out_at ?? 'check_out_at'}),
         completed_at = coalesce(completed_at, ${patches.completed_at ?? 'completed_at'}),
         no_show_confirmed_at = coalesce(no_show_confirmed_at, ${patches.no_show_confirmed_at ?? 'no_show_confirmed_at'}),
         updated_at = now()
     where shift_id = $1 and worker_user_id = $2
     returning *`,
    [shiftId, workerUserId, nextStatus],
  )

  // Attendance ledger (best-effort): record employer-confirm check-in/out events.
  if (nextStatus === 'checked_in') {
    await client.query(
      `insert into attendance_events (company_id, shift_id, worker_user_id, kind, method, meta)
       values ($1,$2,$3,'check_in','employer_confirm', jsonb_build_object('by', $4))`,
      [companyId, shiftId, workerUserId, actorUserId],
    )
  }
  if (nextStatus === 'checked_out') {
    await client.query(
      `insert into attendance_events (company_id, shift_id, worker_user_id, kind, method, meta)
       values ($1,$2,$3,'check_out','employer_confirm', jsonb_build_object('by', $4))`,
      [companyId, shiftId, workerUserId, actorUserId],
    )
  }

  if (String(prev.status || '') !== 'no_show' && nextStatus === 'no_show') {
    await recordPolicyEvent({
      userId: workerUserId,
      kind: 'no_show',
      contextType: 'shift',
      contextId: shiftId,
      meta: { company_id: companyId },
    }).catch(() => {})
  }

  return { ok: true, updated: updated.rows[0], prev }
}

corporateRouter.post('/company/shifts/:shiftId/assignments/:workerUserId/status', requireAuth, asyncHandler(async (req, res) => {
  const parsed = UpdateAssignmentStatusSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })
  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.status(400).json({ message: 'Create your company profile first.' })
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'ops', 'supervisor'])
  if (!ok.ok) return

  const shiftId = req.params.shiftId
  const workerUserId = req.params.workerUserId
  const shiftRes = await pool.query('select 1 from shift_blocks where id = $1 and company_id = $2 limit 1', [shiftId, companyId])
  if (shiftRes.rowCount === 0) return res.status(404).json({ message: 'Shift not found' })

  const client = await pool.connect()
  try {
    await client.query('begin')
    const nextStatus = parsed.data.status
    const r = await updateShiftAssignmentStatusTx(client, {
      companyId,
      shiftId,
      workerUserId,
      nextStatus,
      actorUserId: req.user.sub,
    })
    if (!r.ok) {
      await client.query('rollback')
      return res.status(404).json({ message: 'Assignment not found' })
    }

    await client.query('commit')
    return res.json(r.updated)
  } catch (e) {
    try {
      await client.query('rollback')
    } catch {}
    throw e
  } finally {
    client.release()
  }
}))

// --- Worker side: view invitations + accept/decline + self check-in/out ---
const WorkerShiftQuerySchema = z.object({
  range: z.enum(['upcoming', 'history', 'all']).optional(),
  limit: z.preprocess((v) => (v == null ? 100 : Number(v)), z.number().int().min(1).max(200)).optional(),
})

corporateRouter.get('/me/shifts', requireAuth, asyncHandler(async (req, res) => {
  if (req.user.role === 'company') return res.status(403).json({ message: 'Companies cannot have worker shifts.' })
  const parsed = WorkerShiftQuerySchema.safeParse(req.query)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const range = parsed.data.range ?? 'upcoming'
  const limit = Number(parsed.data.limit ?? 100)

  const where = []
  const args = [req.user.sub]
  if (range === 'upcoming') where.push(`s.end_at >= now() - interval '6 hours'`)
  else if (range === 'history') where.push(`s.end_at < now() + interval '6 hours'`)

  const r = await pool.query(
    `select a.*,
            s.title as shift_title,
            s.role_tag as shift_role_tag,
            s.location as shift_location,
            s.start_at,
            s.end_at,
            s.headcount,
            s.status as shift_status,
            (s.checkin_code_hash is not null)::boolean as checkin_required,
            s.checkin_geo_required,
            s.checkin_geo_radius_m,
            c.id as company_id,
            c.name as company_name,
            c.slug as company_slug
     from shift_assignments a
     join shift_blocks s on s.id = a.shift_id
     join companies c on c.id = s.company_id
     where a.worker_user_id = $1
       ${where.length ? `and ${where.join(' and ')}` : ''}
     order by s.start_at desc
     limit $2`,
    [req.user.sub, limit],
  )
  return res.json(r.rows)
}))

async function ensureWorkerAssignment(client, shiftId, workerUserId) {
  const a0 = await client.query(
    `select a.*,
            s.company_id,
            s.start_at,
            s.end_at,
            s.checkin_code_hash,
            s.checkin_geo_required,
            s.checkin_geo_radius_m,
            s.checkin_geo_lat,
            s.checkin_geo_lng
     from shift_assignments a
     join shift_blocks s on s.id = a.shift_id
     where a.shift_id=$1 and a.worker_user_id=$2
     for update`,
    [
    shiftId,
    workerUserId,
    ],
  )
  return a0.rows[0] ?? null
}

corporateRouter.post('/me/shifts/:shiftId/accept', requireAuth, asyncHandler(async (req, res) => {
  if (req.user.role === 'company') return res.status(403).json({ message: 'Forbidden' })
  const shiftId = req.params.shiftId
  const client = await pool.connect()
  try {
    await client.query('begin')
    const a = await ensureWorkerAssignment(client, shiftId, req.user.sub)
    if (!a) {
      await client.query('rollback')
      return res.status(404).json({ message: 'Assignment not found' })
    }
    if (String(a.status) !== 'invited') {
      await client.query('commit')
      return res.json({ ok: true, status: a.status })
    }
    const updated = await client.query(
      `update shift_assignments
       set status='accepted', responded_at = now(), updated_at = now()
       where shift_id=$1 and worker_user_id=$2
       returning *`,
      [shiftId, req.user.sub],
    )
    await client.query('commit')
    return res.json(updated.rows[0])
  } catch (e) {
    try { await client.query('rollback') } catch {}
    throw e
  } finally {
    client.release()
  }
}))

corporateRouter.post('/me/shifts/:shiftId/decline', requireAuth, asyncHandler(async (req, res) => {
  if (req.user.role === 'company') return res.status(403).json({ message: 'Forbidden' })
  const shiftId = req.params.shiftId
  const client = await pool.connect()
  try {
    await client.query('begin')
    const a = await ensureWorkerAssignment(client, shiftId, req.user.sub)
    if (!a) {
      await client.query('rollback')
      return res.status(404).json({ message: 'Assignment not found' })
    }
    if (String(a.status) !== 'invited') {
      await client.query('commit')
      return res.json({ ok: true, status: a.status })
    }
    const updated = await client.query(
      `update shift_assignments
       set status='declined', responded_at = now(), updated_at = now()
       where shift_id=$1 and worker_user_id=$2
       returning *`,
      [shiftId, req.user.sub],
    )
    await client.query('commit')
    return res.json(updated.rows[0])
  } catch (e) {
    try { await client.query('rollback') } catch {}
    throw e
  } finally {
    client.release()
  }
}))

corporateRouter.post('/me/shifts/:shiftId/check-in', requireAuth, asyncHandler(async (req, res) => {
  if (req.user.role === 'company') return res.status(403).json({ message: 'Forbidden' })
  const shiftId = req.params.shiftId
  const code = req.body?.code != null ? String(req.body.code) : null
  const lat = req.body?.lat != null ? Number(req.body.lat) : null
  const lng = req.body?.lng != null ? Number(req.body.lng) : null
  const client = await pool.connect()
  try {
    await client.query('begin')
    const a = await ensureWorkerAssignment(client, shiftId, req.user.sub)
    if (!a) {
      await client.query('rollback')
      return res.status(404).json({ message: 'Assignment not found' })
    }
    const checkinRequired = !!a.checkin_code_hash
    const geoRequired = Boolean(a.checkin_geo_required)
    if (checkinRequired) {
      const supplied = String(code || '').trim()
      if (!supplied) {
        await client.query('rollback')
        return res.status(409).json({ message: 'This shift requires a check-in code.' })
      }
      const suppliedHash = sha256Hex(supplied)
      if (suppliedHash !== String(a.checkin_code_hash)) {
        await client.query('rollback')
        return res.status(403).json({ message: 'Invalid check-in code.' })
      }
    }
    if (geoRequired) {
      const radiusM = a.checkin_geo_radius_m != null ? Number(a.checkin_geo_radius_m) : null
      const slat = a.checkin_geo_lat != null ? Number(a.checkin_geo_lat) : null
      const slng = a.checkin_geo_lng != null ? Number(a.checkin_geo_lng) : null
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        await client.query('rollback')
        return res.status(409).json({ message: 'This shift requires location to check in.' })
      }
      if (!Number.isFinite(radiusM) || !Number.isFinite(slat) || !Number.isFinite(slng)) {
        await client.query('rollback')
        return res.status(409).json({ message: 'Geo check-in is not configured for this shift.' })
      }
      const dKm = haversineKm(lat, lng, slat, slng)
      const dM = dKm * 1000
      if (dM > radiusM) {
        await client.query('rollback')
        return res.status(403).json({ message: `You are too far from the shift location to check in (distance ~${Math.round(dM)}m).` })
      }
    }
    const status = String(a.status || '')
    if (!['accepted', 'checked_in'].includes(status)) {
      await client.query('rollback')
      return res.status(409).json({ message: 'You must accept the shift before checking in.' })
    }
    const startAt = a.start_at ? new Date(a.start_at).getTime() : null
    const endAt = a.end_at ? new Date(a.end_at).getTime() : null
    if (startAt && Date.now() < startAt - 2 * 3600_000) {
      await client.query('rollback')
      return res.status(409).json({ message: 'Too early to check in.' })
    }
    if (endAt && Date.now() > endAt + 2 * 3600_000) {
      await client.query('rollback')
      return res.status(409).json({ message: 'Shift already ended.' })
    }

    await client.query(
      `insert into attendance_events (company_id, shift_id, worker_user_id, kind, method, lat, lng, meta)
       values ($1,$2,$3,'check_in',$4,$5,$6,$7::jsonb)`,
      [
        a.company_id,
        shiftId,
        req.user.sub,
        geoRequired ? 'geo' : checkinRequired ? 'qr' : 'self',
        Number.isFinite(lat) ? lat : null,
        Number.isFinite(lng) ? lng : null,
        JSON.stringify({ geo_required: geoRequired, code_required: checkinRequired }),
      ],
    )
    const updated = await client.query(
      `update shift_assignments
       set status='checked_in', check_in_at = coalesce(check_in_at, now()), updated_at = now()
       where shift_id=$1 and worker_user_id=$2
       returning *`,
      [shiftId, req.user.sub],
    )
    await client.query('commit')
    return res.json(updated.rows[0])
  } catch (e) {
    try { await client.query('rollback') } catch {}
    throw e
  } finally {
    client.release()
  }
}))

corporateRouter.post('/me/shifts/:shiftId/check-out', requireAuth, asyncHandler(async (req, res) => {
  if (req.user.role === 'company') return res.status(403).json({ message: 'Forbidden' })
  const shiftId = req.params.shiftId
  const client = await pool.connect()
  try {
    await client.query('begin')
    const a = await ensureWorkerAssignment(client, shiftId, req.user.sub)
    if (!a) {
      await client.query('rollback')
      return res.status(404).json({ message: 'Assignment not found' })
    }
    const status = String(a.status || '')
    if (!['checked_in', 'checked_out', 'completed'].includes(status)) {
      await client.query('rollback')
      return res.status(409).json({ message: 'You must check in before checking out.' })
    }
    await client.query(
      `insert into attendance_events (company_id, shift_id, worker_user_id, kind, method)
       values ($1,$2,$3,'check_out','self')`,
      [a.company_id, shiftId, req.user.sub],
    )
    const updated = await client.query(
      `update shift_assignments
       set status='checked_out', check_out_at = coalesce(check_out_at, now()), updated_at = now()
       where shift_id=$1 and worker_user_id=$2
       returning *`,
      [shiftId, req.user.sub],
    )
    await client.query('commit')
    return res.json(updated.rows[0])
  } catch (e) {
    try { await client.query('rollback') } catch {}
    throw e
  } finally {
    client.release()
  }
}))

// --- Enterprise Mode: Reports (CSV exports) ---
corporateRouter.get('/company/reports/jobs.csv', requireAuth, asyncHandler(async (req, res) => {
  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.status(404).json({ message: 'Not found' })
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'ops', 'hr', 'finance', 'auditor'])
  if (!ok.ok) return

  const r = await pool.query(
    `select
       jp.id,
       jp.title,
       jp.status,
       jp.employment_type,
       jp.work_mode,
       jp.location,
       jp.pay_min,
       jp.pay_max,
       jp.currency,
       jp.pay_period,
       jp.job_term,
       jp.created_at,
       jp.closes_at,
       (select count(*)::int from job_applications a where a.job_id = jp.id) as applications
     from job_posts jp
     where jp.company_id = $1
     order by jp.created_at desc
     limit 1000`,
    [companyId],
  ).catch(async (e) => {
    if (String(e?.code || '') !== '42703') throw e
    // Older schema without pay_period/job_term
    return await pool.query(
      `select
         jp.id,
         jp.title,
         jp.status,
         jp.employment_type,
         jp.work_mode,
         jp.location,
         jp.pay_min,
         jp.pay_max,
         jp.currency,
         jp.created_at,
         jp.closes_at,
         (select count(*)::int from job_applications a where a.job_id = jp.id) as applications
       from job_posts jp
       where jp.company_id = $1
       order by jp.created_at desc
       limit 1000`,
      [companyId],
    )
  })
  const rows = Array.isArray(r.rows) ? r.rows : []
  const header = [
    'id',
    'title',
    'status',
    'employment_type',
    'work_mode',
    'location',
    'pay_min',
    'pay_max',
    'currency',
    'pay_period',
    'job_term',
    'applications',
    'created_at',
    'closes_at',
  ]
  const lines = [toCsvRow(header)]
  for (const row of rows) {
    lines.push(
      toCsvRow([
        row.id,
        row.title,
        row.status,
        row.employment_type,
        row.work_mode,
        row.location,
        row.pay_min,
        row.pay_max,
        row.currency,
        row.pay_period ?? '',
        row.job_term ?? '',
        row.applications ?? 0,
        row.created_at,
        row.closes_at ?? '',
      ]),
    )
  }
  const csv = lines.join('\n')
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="jobs-${String(companyId).slice(0, 8)}.csv"`)
  return res.send(csv)
}))

corporateRouter.get('/company/reports/shifts.csv', requireAuth, asyncHandler(async (req, res) => {
  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.status(404).json({ message: 'Not found' })
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'ops', 'supervisor', 'auditor'])
  if (!ok.ok) return

  const r = await pool.query(
    `select
       s.*,
       (select count(*)::int from shift_assignments a where a.shift_id = s.id) as assigned,
       (select count(*)::int from shift_assignments a where a.shift_id = s.id and a.status = 'completed') as completed,
       (select count(*)::int from shift_assignments a where a.shift_id = s.id and a.status = 'no_show') as no_shows
     from shift_blocks s
     where s.company_id = $1
     order by s.start_at desc
     limit 2000`,
    [companyId],
  )
  const rows = Array.isArray(r.rows) ? r.rows : []
  const header = ['id', 'title', 'role_tag', 'location', 'start_at', 'end_at', 'headcount', 'status', 'assigned', 'completed', 'no_shows', 'created_at']
  const lines = [toCsvRow(header)]
  for (const row of rows) {
    lines.push(
      toCsvRow([
        row.id,
        row.title,
        row.role_tag ?? '',
        row.location ?? '',
        row.start_at,
        row.end_at,
        row.headcount,
        row.status,
        row.assigned ?? 0,
        row.completed ?? 0,
        row.no_shows ?? 0,
        row.created_at,
      ]),
    )
  }
  const csv = lines.join('\n')
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="shifts-${String(companyId).slice(0, 8)}.csv"`)
  return res.send(csv)
}))

corporateRouter.get('/company/reports/workers.csv', requireAuth, asyncHandler(async (req, res) => {
  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.status(404).json({ message: 'Not found' })
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'ops', 'hr', 'auditor'])
  if (!ok.ok) return

  const r = await pool.query(
    `select
       n.worker_user_id,
       u.name as worker_name,
       u.role as worker_role,
       n.rating,
       n.notes,
       n.updated_at,
       (select count(*)::int from shift_assignments a join shift_blocks s on s.id = a.shift_id where s.company_id = $1 and a.worker_user_id = n.worker_user_id) as shifts_total,
       (select count(*)::int from shift_assignments a join shift_blocks s on s.id = a.shift_id where s.company_id = $1 and a.worker_user_id = n.worker_user_id and a.status = 'no_show') as shifts_no_show
     from employer_worker_notes n
     join users u on u.id = n.worker_user_id
     where n.company_id = $1
     order by n.updated_at desc
     limit 5000`,
    [companyId],
  )
  const rows = Array.isArray(r.rows) ? r.rows : []
  const header = ['worker_user_id', 'worker_name', 'worker_role', 'rating', 'notes', 'shifts_total', 'shifts_no_show', 'updated_at']
  const lines = [toCsvRow(header)]
  for (const row of rows) {
    lines.push(toCsvRow([row.worker_user_id, row.worker_name, row.worker_role, row.rating ?? '', row.notes ?? '', row.shifts_total ?? 0, row.shifts_no_show ?? 0, row.updated_at]))
  }
  const csv = lines.join('\n')
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="workers-${String(companyId).slice(0, 8)}.csv"`)
  return res.send(csv)
}))

corporateRouter.get('/company/reports/budgets.csv', requireAuth, asyncHandler(async (req, res) => {
  const resolved = await resolveCompanyIdForReq(req)
  if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
  const companyId = resolved.companyId
  if (!companyId) return res.status(404).json({ message: 'Not found' })
  const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'ops', 'hr', 'finance', 'auditor'])
  if (!ok.ok) return
  try {
    const r = await pool.query(
      `select b.id, b.company_id, b.department_id, d.name as department_name,
              b.period_start, b.period_end, b.budget_limit_ghs, b.spent_ghs, b.notes, b.created_at
       from company_budgets b
       left join company_departments d on d.id = b.department_id
       where b.company_id = $1
       order by b.period_end desc, b.created_at desc
       limit 500`,
      [companyId],
    )
    const rows = Array.isArray(r.rows) ? r.rows : []
    const header = ['id', 'department_name', 'period_start', 'period_end', 'budget_limit_ghs', 'spent_ghs', 'utilisation_pct', 'notes', 'created_at']
    const lines = [toCsvRow(header)]
    for (const row of rows) {
      const limit = Number(row.budget_limit_ghs ?? 0)
      const spent = Number(row.spent_ghs ?? 0)
      const pct = limit > 0 ? Math.round((100 * spent) / limit) : 0
      lines.push(
        toCsvRow([
          row.id,
          row.department_name ?? 'Company-wide',
          row.period_start ?? '',
          row.period_end ?? '',
          limit,
          spent,
          pct,
          row.notes ?? '',
          row.created_at ?? '',
        ]),
      )
    }
    const csv = lines.join('\n')
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="budgets-${String(companyId).slice(0, 8)}.csv"`)
    return res.send(csv)
  } catch (e) {
    if (String(e?.code || '') === '42P01') return res.status(400).json({ message: 'Budgets table not ready (run migrations).' })
    throw e
  }
}))

const ApplySchema = z.object({
  full_name: z.string().min(2).max(120).optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  cover_letter: z.string().min(5).max(8000),
})

corporateRouter.post('/jobs/:id/apply', requireAuth, asyncHandler(async (req, res) => {
  if (req.user.role === 'company') return res.status(403).json({ message: 'Companies cannot apply to jobs.' })

  const parsed = ApplySchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const jobRes = await pool.query('select id, status from job_posts where id = $1', [req.params.id])
  const job = jobRes.rows[0] ?? null
  if (!job || String(job.status) !== 'open') return res.status(404).json({ message: 'Job not found' })

  const userRes = await pool.query('select name, email, phone, role from users where id = $1', [req.user.sub])
  const u = userRes.rows[0] ?? null

  // Snapshot minimal profile at apply time (expand later if needed)
  const resumeSnapshot = JSON.stringify({
    user: { id: req.user.sub, name: u?.name ?? null, role: u?.role ?? null },
    applied_at: new Date().toISOString(),
  })

  const r = await pool.query(
    `insert into job_applications (job_id, applicant_user_id, full_name, email, phone, cover_letter, resume_snapshot, updated_at)
     values ($1,$2,$3,$4,$5,$6,$7::jsonb,now())
     on conflict (job_id, applicant_user_id) do update
       set cover_letter = excluded.cover_letter,
           full_name = excluded.full_name,
           email = excluded.email,
           phone = excluded.phone,
           resume_snapshot = excluded.resume_snapshot,
           updated_at = now()
     returning *`,
    [
      job.id,
      req.user.sub,
      parsed.data.full_name ?? u?.name ?? null,
      parsed.data.email ?? u?.email ?? null,
      parsed.data.phone ?? u?.phone ?? null,
      parsed.data.cover_letter,
      resumeSnapshot,
    ],
  )
  return res.status(201).json(r.rows[0])
}))

corporateRouter.get('/company/jobs/:id/applications', requireAuth, asyncHandler(async (req, res) => {
  const jobId = req.params.id
  const jobRes = await pool.query(
    `select jp.*, jp.company_id, c.owner_user_id
     from job_posts jp
     join companies c on c.id = jp.company_id
     where jp.id = $1
     limit 1`,
    [jobId],
  )
  const job = jobRes.rows[0] ?? null
  if (!job) return res.status(404).json({ message: 'Job not found' })
  if (req.user.role !== 'admin') {
    const resolved = await resolveCompanyIdForReq(req)
    if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
    const companyId = resolved.companyId
    if (!companyId || String(companyId) !== String(job.company_id)) return res.status(403).json({ message: 'Forbidden' })
    const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'ops', 'hr'])
    if (!ok.ok) return
  }

  const r = await pool.query(
    `select a.*,
            u.role as applicant_role,
            u.profile_pic as applicant_profile_pic
     from job_applications a
     join users u on u.id = a.applicant_user_id
     where a.job_id = $1
     order by a.created_at desc
     limit 500`,
    [jobId],
  )
  return res.json(r.rows)
}))

const UpdateApplicationStatusSchema = z.object({
  status: z.enum(['submitted', 'shortlisted', 'contacted', 'rejected', 'hired', 'withdrawn']),
})

corporateRouter.post(
  '/company/jobs/:jobId/applications/:appId/status',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = UpdateApplicationStatusSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

    const jobId = req.params.jobId
    const appId = req.params.appId

    const jobRes = await pool.query(
      `select jp.id, jp.company_id, c.owner_user_id
       from job_posts jp
       join companies c on c.id = jp.company_id
       where jp.id = $1
       limit 1`,
      [jobId],
    )
    const job = jobRes.rows[0] ?? null
    if (!job) return res.status(404).json({ message: 'Job not found' })
    if (req.user.role !== 'admin') {
      const resolved = await resolveCompanyIdForReq(req)
      if (!resolved.ok) return res.status(403).json({ message: 'Forbidden' })
      const companyId = resolved.companyId
      if (!companyId || String(companyId) !== String(job.company_id)) return res.status(403).json({ message: 'Forbidden' })
      const ok = await requireWorkspaceRole(req, res, companyId, ['owner', 'ops', 'hr'])
      if (!ok.ok) return
    }

    const client = await pool.connect()
    try {
      await client.query('begin')

      const a0 = await client.query(`select * from job_applications where id = $1 and job_id = $2 for update`, [appId, jobId])
      const prev = a0.rows[0] ?? null
      if (!prev) {
        await client.query('rollback')
        return res.status(404).json({ message: 'Application not found' })
      }

      const updated = await client.query(
        `update job_applications
         set status = $3, updated_at = now()
         where id = $1 and job_id = $2
         returning *`,
        [appId, jobId, parsed.data.status],
      )
      const next = updated.rows[0]

      // Auto-message when moved to shortlisted (only on transition).
      if (String(prev.status || '') !== 'shortlisted' && parsed.data.status === 'shortlisted') {
        const companyOwnerUserId = job.owner_user_id
        const applicantUserId = next.applicant_user_id

        // Best-effort: personalize message using first name if available.
        const firstName = String(next.full_name || '').trim().split(/\s+/)[0] || 'there'
        const rawMessage =
          `Hi ${firstName} — you’ve been shortlisted for this role.\n\n` +
          `Please reply with:\n` +
          `1) Your availability (start date)\n` +
          `2) Your expected salary range (GHS)\n` +
          `3) Your current location\n\n` +
          `We’ll continue here in LocalLink.`

        // Apply the same safety masking rules as normal chat (defense-in-depth).
        const maskedPhone = maskPhoneNumbers(rawMessage)
        const maskedLinks = maskOffPlatformLinks(maskedPhone.text)

        await client.query(
          `insert into messages (sender_id, receiver_id, job_post_id, message, read)
           values ($1,$2,$3,$4,false)`,
          [companyOwnerUserId, applicantUserId, jobId, maskedLinks.text],
        )

        // Notify applicant (best-effort)
        notify({
          userId: applicantUserId,
          type: 'message',
          title: 'Shortlisted',
          body: 'A company shortlisted you and sent a message.',
          meta: { url: `/messages/jobpost/${jobId}`, context: 'jobpost', context_id: jobId, from_user_id: companyOwnerUserId },
          dedupeKey: `jobpost:${jobId}:shortlisted`,
        }).catch(() => {})
      }

      await client.query('commit')
      return res.json(next)
    } catch (e) {
      try {
        await client.query('rollback')
      } catch {}
      throw e
    } finally {
      client.release()
    }
  }),
)

