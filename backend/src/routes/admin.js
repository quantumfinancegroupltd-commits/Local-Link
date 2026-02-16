import { Router } from 'express'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { pool } from '../db/pool.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { env } from '../config.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { paystackSecretKey } from '../payments/paystack.js'
import { auditAdminAction } from '../services/audit.js'
import { notify } from '../services/notifications.js'
import { creditWalletTx } from '../services/walletLedger.js'
import { recordPolicyEvent } from '../services/policy.js'
import { listOpsAlerts, resolveOpsAlert } from '../services/opsAlerts.js'
import { computeStuckMoneySignals } from '../services/opsDetectors.js'

export const adminRouter = Router()

function slugify(raw) {
  const s = String(raw ?? '')
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return s.slice(0, 80) || 'news'
}

async function uniqueSlug(base, { excludeId = null } = {}) {
  const root = slugify(base)
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`
    // eslint-disable-next-line no-await-in-loop
    const r = await pool.query(
      `select 1 from news_posts where slug = $1 and deleted_at is null ${excludeId ? 'and id <> $2' : ''} limit 1`,
      excludeId ? [candidate, excludeId] : [candidate],
    )
    if (r.rowCount === 0) return candidate
  }
  // fallback
  return `${root}-${Date.now()}`
}

const NewsStatus = z.enum(['draft', 'published'])
const NewsUpsertSchema = z.object({
  title: z.string().min(3).max(200),
  slug: z.string().min(1).max(120).optional().nullable(),
  body: z.string().min(1).max(20000),
  status: NewsStatus.optional(),
  category: z.string().max(60).optional().nullable(),
  summary: z.string().max(500).optional().nullable(),
  hero_image_url: z.string().url().max(800).optional().nullable(),
  hero_image_alt: z.string().max(160).optional().nullable(),
  hero_image_credit: z.string().max(300).optional().nullable(),
})

adminRouter.get('/news', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
  const status = String(req.query.status || 'all')
  const whereStatus = status === 'draft' || status === 'published' ? status : null
  const r = await pool.query(
    `select id, title, slug, status, published_at, created_at, updated_at,
            category
     from news_posts
     where deleted_at is null
       and ($1::text is null or status = $1)
     order by coalesce(published_at, created_at) desc
     limit 200`,
    [whereStatus],
  )
  return res.json(r.rows)
}))

adminRouter.get('/news/:id', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
  const r = await pool.query(
    `select id, title, slug, body, status, published_at, created_at, updated_at,
            category, summary, hero_image_url, hero_image_alt, hero_image_credit
     from news_posts
     where id = $1 and deleted_at is null`,
    [req.params.id],
  )
  if (!r.rows[0]) return res.status(404).json({ message: 'News post not found' })
  return res.json(r.rows[0])
}))

adminRouter.post('/news', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
  const parsed = NewsUpsertSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const baseSlug = parsed.data.slug ? String(parsed.data.slug) : parsed.data.title
  const slug = await uniqueSlug(baseSlug)
  const status = parsed.data.status ?? 'draft'
  const publishedAt = status === 'published' ? new Date().toISOString() : null

  const r = await pool.query(
    `insert into news_posts (title, slug, body, status, published_at, category, summary, hero_image_url, hero_image_alt, hero_image_credit, created_by, updated_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11)
     returning id, title, slug, body, status, published_at, created_at, updated_at,
               category, summary, hero_image_url, hero_image_alt, hero_image_credit`,
    [
      parsed.data.title,
      slug,
      parsed.data.body,
      status,
      publishedAt,
      parsed.data.category ?? null,
      parsed.data.summary ?? null,
      parsed.data.hero_image_url ?? null,
      parsed.data.hero_image_alt ?? null,
      parsed.data.hero_image_credit ?? null,
      req.user.sub,
    ],
  )
  return res.status(201).json(r.rows[0])
}))

adminRouter.put('/news/:id', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
  const parsed = NewsUpsertSchema.partial().safeParse(req.body ?? {})
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const existing = await pool.query(
    `select id, title, slug, status, published_at
     from news_posts
     where id = $1 and deleted_at is null`,
    [req.params.id],
  )
  const cur = existing.rows[0]
  if (!cur) return res.status(404).json({ message: 'News post not found' })

  const nextTitle = parsed.data.title ?? cur.title
  const wantsSlug = parsed.data.slug !== undefined ? (parsed.data.slug == null ? '' : String(parsed.data.slug)) : null
  const nextSlug = wantsSlug != null ? await uniqueSlug(wantsSlug || nextTitle, { excludeId: cur.id }) : cur.slug

  const nextStatus = parsed.data.status ?? cur.status
  const nextPublishedAt =
    nextStatus === 'published' ? (cur.published_at ?? new Date().toISOString()) : null

  const r = await pool.query(
    `update news_posts
     set title = coalesce($2, title),
         slug = $3,
         body = coalesce($4, body),
         status = $5,
         published_at = $6,
         category = coalesce($7, category),
         summary = coalesce($8, summary),
         hero_image_url = coalesce($9, hero_image_url),
         hero_image_alt = coalesce($10, hero_image_alt),
         hero_image_credit = coalesce($11, hero_image_credit),
         updated_by = $12,
         updated_at = now()
     where id = $1
     returning id, title, slug, body, status, published_at, created_at, updated_at,
               category, summary, hero_image_url, hero_image_alt, hero_image_credit`,
    [
      cur.id,
      parsed.data.title ?? null,
      nextSlug,
      parsed.data.body ?? null,
      nextStatus,
      nextPublishedAt,
      parsed.data.category ?? null,
      parsed.data.summary ?? null,
      parsed.data.hero_image_url ?? null,
      parsed.data.hero_image_alt ?? null,
      parsed.data.hero_image_credit ?? null,
      req.user.sub,
    ],
  )
  return res.json(r.rows[0])
}))

adminRouter.delete('/news/:id', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
  const r = await pool.query(
    `update news_posts
     set deleted_at = now(),
         updated_by = $2,
         updated_at = now()
     where id = $1 and deleted_at is null
     returning id`,
    [req.params.id, req.user.sub],
  )
  if (!r.rows[0]) return res.status(404).json({ message: 'News post not found' })
  return res.json({ ok: true })
}))

// --- Reliability / queues (internal ops) ---
adminRouter.get('/queues/overview', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
  // Webhook queue health
  const [counts, recent] = await Promise.all([
    pool.query(
      `select
         count(*) filter (where status='pending')::int as pending,
         count(*) filter (where status='retry')::int as retry,
         count(*) filter (where status='processing')::int as processing,
         count(*) filter (where status='processed')::int as processed,
         count(*) filter (where status='ignored')::int as ignored,
         count(*) filter (where status='dead')::int as dead,
         count(*)::int as total
       from webhook_queue`,
    ),
    pool.query(
      `select id, provider, event_id, status, attempts, next_retry_at, last_error, locked_at, locked_by, created_at, updated_at
       from webhook_queue
       where status in ('retry','dead')
       order by updated_at desc
       limit 50`,
    ),
  ])

  return res.json({
    webhook_queue: {
      counts: counts.rows[0] ?? { pending: 0, retry: 0, processing: 0, processed: 0, ignored: 0, dead: 0, total: 0 },
      recent_failures: recent.rows,
    },
  })
}))

const QueueActionSchema = z.object({
  note: z.string().max(1000).optional().nullable(),
})

adminRouter.post('/queues/webhooks/:id/retry', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
  const parsed = QueueActionSchema.safeParse(req.body ?? {})
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const r = await pool.query(
    `update webhook_queue
     set status='retry',
         next_retry_at=now(),
         last_error=coalesce($2, last_error),
         locked_at=null,
         locked_by=null,
         updated_at=now()
     where id=$1
     returning *`,
    [req.params.id, parsed.data.note ?? null],
  )
  if (!r.rows[0]) return res.status(404).json({ message: 'Queue item not found' })
  await auditAdminAction({
    adminUserId: req.user.sub,
    action: 'queue_retry',
    targetType: 'webhook_queue',
    targetId: req.params.id,
    meta: { note: parsed.data.note ?? null },
    ip: req.ip,
    userAgent: req.get('user-agent'),
  }).catch(() => {})
  return res.json(r.rows[0])
}))

adminRouter.post('/queues/webhooks/:id/ignore', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
  const parsed = QueueActionSchema.safeParse(req.body ?? {})
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const r = await pool.query(
    `update webhook_queue
     set status='ignored',
         processed_at=coalesce(processed_at, now()),
         last_error=coalesce($2, last_error),
         locked_at=null,
         locked_by=null,
         updated_at=now()
     where id=$1
     returning *`,
    [req.params.id, parsed.data.note ?? null],
  )
  if (!r.rows[0]) return res.status(404).json({ message: 'Queue item not found' })
  await auditAdminAction({
    adminUserId: req.user.sub,
    action: 'queue_ignore',
    targetType: 'webhook_queue',
    targetId: req.params.id,
    meta: { note: parsed.data.note ?? null },
    ip: req.ip,
    userAgent: req.get('user-agent'),
  }).catch(() => {})
  return res.json(r.rows[0])
}))

adminRouter.get('/queues/webhooks/:id', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
  const r = await pool.query(
    `select id, provider, event_id, status, attempts, next_retry_at, last_error, locked_at, locked_by, processed_at, created_at, updated_at, payload
     from webhook_queue
     where id = $1`,
    [req.params.id],
  )
  if (!r.rows[0]) return res.status(404).json({ message: 'Queue item not found' })
  return res.json(r.rows[0])
}))

const ExportFailuresSchema = z.object({
  limit: z
    .preprocess((v) => (v == null ? 50 : Number(v)), z.number().int().min(1).max(200))
    .optional(),
})

adminRouter.get('/queues/webhooks/export/failures', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
  const parsed = ExportFailuresSchema.safeParse(req.query)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const limit = Number(parsed.data.limit ?? 50)
  const r = await pool.query(
    `select id, provider, event_id, status, attempts, next_retry_at, last_error, created_at, updated_at
     from webhook_queue
     where status in ('retry','dead')
     order by updated_at desc
     limit $1`,
    [limit],
  )
  return res.json({
    exported_at: new Date().toISOString(),
    count: r.rows.length,
    items: r.rows,
  })
}))

// --- System / configuration status (safe to show in Admin UI; no secrets) ---
adminRouter.get('/system/status', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
  const appBase = env.APP_BASE_URL ? String(env.APP_BASE_URL).replace(/\/$/, '') : null
  const uptimeSec = Math.floor(Number(process.uptime?.() ?? 0))
  const db = await pool
    .query('select 1 as ok')
    .then(() => ({ ok: true }))
    .catch((e) => ({ ok: false, code: e?.code }))

  const queueCounts = await pool
    .query(
      `select
         count(*) filter (where status='pending')::int as pending,
         count(*) filter (where status='retry')::int as retry,
         count(*) filter (where status='processing')::int as processing,
         count(*) filter (where status='dead')::int as dead,
         count(*)::int as total
       from webhook_queue`,
    )
    .then((r) => r.rows[0])
    .catch(() => null)

  return res.json({
    now: new Date().toISOString(),
    node_env: env.NODE_ENV,
    uptime_sec: uptimeSec,
    app_base_url: appBase,
    cors_origins: env.CORS_ORIGINS,
    db,
    workers: {
      schedulers_enabled: !!env.SCHEDULERS_ENABLED,
      webhook_queue_enabled: !!env.WEBHOOK_QUEUE_ENABLED,
      webhook_queue_max_attempts: Number(env.WEBHOOK_QUEUE_MAX_ATTEMPTS ?? 10),
    },
    webhook_queue: {
      counts: queueCounts,
    },
    payments: {
      paystack_configured: !!paystackSecretKey(),
      paystack_webhook_url: appBase ? `${appBase}/api/webhooks/paystack` : null,
      flutterwave_webhook_url: appBase ? `${appBase}/api/webhooks/flutterwave` : null,
    },
  })
}))

// --- Ops overview counters (for launch / day-to-day monitoring) ---
adminRouter.get('/ops/overview', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
  const [
    disputesActive,
    verificationPending,
    driversPending,
    unpaidOrders,
    unassignedPaidDeliveries,
    pendingJobEscrows,
    payoutsPending,
    stuckSignals,
    schedulerFailures,
  ] = await Promise.all([
    pool.query(`select count(*)::int as n from disputes where status in ('open','under_review')`),
    pool.query(`select count(*)::int as n from verification_requests where status = 'pending'`),
    pool.query(`select count(*)::int as n from drivers where status = 'pending'`),
    pool.query(`select count(*)::int as n from orders where order_status <> 'cancelled' and payment_status <> 'paid'`),
    pool.query(
      `select count(*)::int as n
       from deliveries d
       join orders o on o.id = d.order_id
       where d.status = 'created'
         and d.driver_user_id is null
         and o.order_status <> 'cancelled'
         and o.payment_status = 'paid'`,
    ),
    pool.query(`select count(*)::int as n from escrow_transactions where type='job' and status='pending_payment'`),
    pool.query(`select count(*)::int as n from payouts where status = 'pending'`),
    computeStuckMoneySignals(),
    pool.query(`select count(*)::int as n from ops_task_state where consecutive_failures > 0`).catch(() => ({ rows: [{ n: 0 }] })),
  ])

  return res.json({
    disputes_active: disputesActive.rows[0]?.n ?? 0,
    verification_requests_pending: verificationPending.rows[0]?.n ?? 0,
    drivers_pending: driversPending.rows[0]?.n ?? 0,
    orders_unpaid: unpaidOrders.rows[0]?.n ?? 0,
    deliveries_unassigned_paid: unassignedPaidDeliveries.rows[0]?.n ?? 0,
    job_escrows_pending_payment: pendingJobEscrows.rows[0]?.n ?? 0,
    payouts_pending: payoutsPending.rows[0]?.n ?? 0,
    escrows_pending_payment_stuck_12h: stuckSignals?.escrows_pending_payment_stuck_12h ?? 0,
    escrows_completed_pending_stuck_12h: stuckSignals?.escrows_completed_pending_stuck_12h ?? 0,
    payouts_stuck_6h: stuckSignals?.payouts_stuck_6h ?? 0,
    scheduler_tasks_failing: schedulerFailures?.rows?.[0]?.n ?? 0,
  })
}))

// --- Ops alerts (Mission Control) ---
const OpsAlertsQuerySchema = z.object({
  status: z.enum(['open', 'resolved']).optional(),
  severity: z.enum(['info', 'warning', 'critical']).optional().nullable(),
  limit: z.preprocess((v) => (v == null ? 100 : Number(v)), z.number().int().min(1).max(250)).optional(),
})

adminRouter.get('/ops/alerts', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
  const parsed = OpsAlertsQuerySchema.safeParse(req.query)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const items = await listOpsAlerts({
    status: parsed.data.status ?? 'open',
    severity: parsed.data.severity ?? null,
    limit: parsed.data.limit ?? 100,
  })
  return res.json({ count: items.length, items })
}))

adminRouter.post('/ops/alerts/:id/resolve', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
  const id = String(req.params.id || '').trim()
  if (!id) return res.status(400).json({ message: 'Invalid id' })
  const updated = await resolveOpsAlert({ id, resolvedByUserId: req.user.sub })
  if (!updated) return res.status(404).json({ message: 'Alert not found or already resolved' })
  await auditAdminAction({
    adminUserId: req.user.sub,
    action: 'ops_alert_resolve',
    targetType: 'ops_alert',
    targetId: id,
    meta: { type: updated.type, key: updated.key, severity: updated.severity },
    ip: req.ip,
    userAgent: req.get('user-agent'),
  })
  return res.json(updated)
}))

// --- Feature flags (vertical unlocks) ---
adminRouter.get('/features', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
  const r = await pool.query(
    `select key, enabled, description, updated_by, updated_at, created_at
     from feature_flags
     order by key asc`,
  )
  return res.json(r.rows)
}))

const UpdateFeatureSchema = z.object({
  enabled: z.boolean(),
  description: z.string().max(2000).optional().nullable(),
})

adminRouter.put('/features/:key', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
  const parsed = UpdateFeatureSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const key = String(req.params.key || '').trim()
  if (!key) return res.status(400).json({ message: 'Invalid key' })

  const r = await pool.query(
    `insert into feature_flags (key, enabled, description, updated_by, updated_at)
     values ($1,$2,$3,$4,now())
     on conflict (key) do update set
       enabled = excluded.enabled,
       description = coalesce(excluded.description, feature_flags.description),
       updated_by = excluded.updated_by,
       updated_at = now()
     returning key, enabled, description, updated_by, updated_at, created_at`,
    [key, parsed.data.enabled, parsed.data.description ?? null, req.user.sub],
  )
  await auditAdminAction({
    adminUserId: req.user.sub,
    action: 'feature_flag_update',
    targetType: 'feature_flag',
    targetId: key,
    meta: { enabled: parsed.data.enabled, description: parsed.data.description ?? null },
    ip: req.ip,
    userAgent: req.get('user-agent'),
  })
  return res.json(r.rows[0])
}))

// --- Metrics / dashboards ---
const MetricsQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
})

function parseDateParam(s, fallback) {
  if (!s) return fallback
  const d = new Date(String(s))
  return Number.isFinite(d.getTime()) ? d : fallback
}

adminRouter.get('/metrics/overview', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
  const parsed = MetricsQuerySchema.safeParse(req.query)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const to = parseDateParam(parsed.data.to, new Date())
  const from = parseDateParam(parsed.data.from, new Date(Date.now() - 30 * 24 * 3600 * 1000))

  // Normalize ordering
  const start = from <= to ? from : to
  const end = from <= to ? to : from

  const [escrow, jobs, orders, disputes, users, policy] = await Promise.all([
    pool.query(
      `select
         count(*) filter (where status='released')::int as released,
         count(*) filter (where status='refunded')::int as refunded,
         count(*)::int as total
       from escrow_transactions
       where created_at >= $1 and created_at < $2`,
      [start, end],
    ),
    pool.query(
      `select
         count(*)::int as jobs_posted,
         count(*) filter (where status='completed')::int as jobs_completed,
         count(*) filter (where status='cancelled')::int as jobs_cancelled
       from jobs
       where created_at >= $1 and created_at < $2`,
      [start, end],
    ),
    pool.query(
      `select
         count(*)::int as orders_created,
         count(*) filter (where order_status='delivered')::int as orders_delivered,
         count(*) filter (where order_status='cancelled')::int as orders_cancelled
       from orders
       where created_at >= $1 and created_at < $2`,
      [start, end],
    ),
    pool.query(
      `select
         count(*)::int as disputes_opened,
         count(*) filter (where status in ('open','under_review'))::int as disputes_active,
         count(*) filter (where status='resolved')::int as disputes_resolved
       from disputes
       where created_at >= $1 and created_at < $2`,
      [start, end],
    ),
    pool.query(
      `select
         count(*)::int as users_new,
         count(*) filter (where role='buyer')::int as buyers_new,
         count(*) filter (where role in ('artisan','farmer','driver'))::int as providers_new,
         count(*) filter (where last_active_at >= now() - interval '7 days')::int as weekly_active_users
       from users
       where created_at >= $1 and created_at < $2`,
      [start, end],
    ),
    pool.query(
      `select
         count(*) filter (where kind='phone_leak')::int as phone_leaks
       from policy_events
       where created_at >= $1 and created_at < $2`,
      [start, end],
    ),
  ])

  const released = Number(escrow.rows[0]?.released ?? 0)
  const totalEscrows = Number(escrow.rows[0]?.total ?? 0)
  const disputesOpened = Number(disputes.rows[0]?.disputes_opened ?? 0)
  const jobsPosted = Number(jobs.rows[0]?.jobs_posted ?? 0)
  const ordersCreated = Number(orders.rows[0]?.orders_created ?? 0)
  const cancels = Number(jobs.rows[0]?.jobs_cancelled ?? 0) + Number(orders.rows[0]?.orders_cancelled ?? 0)

  // North Star proxy: weekly escrow releases. We compute it over the chosen range.
  // For UI we return "per 7 days" normalization too.
  const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (24 * 3600 * 1000)))
  const weeklyEquivalent = Math.round((released / days) * 7)

  return res.json({
    range: { from: start.toISOString(), to: end.toISOString() },
    north_star: {
      weekly_escrow_releases: weeklyEquivalent,
      released_in_range: released,
    },
    kpis: {
      escrows_created: totalEscrows,
      escrows_released: released,
      escrows_refunded: Number(escrow.rows[0]?.refunded ?? 0),
      jobs_posted: jobsPosted,
      jobs_completed: Number(jobs.rows[0]?.jobs_completed ?? 0),
      jobs_cancelled: Number(jobs.rows[0]?.jobs_cancelled ?? 0),
      orders_created: ordersCreated,
      orders_delivered: Number(orders.rows[0]?.orders_delivered ?? 0),
      orders_cancelled: Number(orders.rows[0]?.orders_cancelled ?? 0),
      disputes_opened: disputesOpened,
      disputes_active: Number(disputes.rows[0]?.disputes_active ?? 0),
      disputes_resolved: Number(disputes.rows[0]?.disputes_resolved ?? 0),
      users_new: Number(users.rows[0]?.users_new ?? 0),
      buyers_new: Number(users.rows[0]?.buyers_new ?? 0),
      providers_new: Number(users.rows[0]?.providers_new ?? 0),
      weekly_active_users: Number(users.rows[0]?.weekly_active_users ?? 0),
      phone_leaks: Number(policy.rows[0]?.phone_leaks ?? 0),
    },
    rates: {
      dispute_rate_per_escrow: totalEscrows > 0 ? disputesOpened / totalEscrows : 0,
      cancel_rate_per_transaction: jobsPosted + ordersCreated > 0 ? cancels / (jobsPosted + ordersCreated) : 0,
      release_rate_per_escrow: totalEscrows > 0 ? released / totalEscrows : 0,
    },
  })
}))

const TimeSeriesSchema = z.object({
  metric: z.enum(['wer', 'disputes_opened', 'no_shows', 'phone_leaks', 'jobs_posted', 'jobs_completed', 'escrows_created']),
  bucket: z.enum(['day', 'week']).optional().default('day'),
  from: z.string().optional(),
  to: z.string().optional(),
})

adminRouter.get('/metrics/timeseries', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
  const parsed = TimeSeriesSchema.safeParse(req.query)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const to = parseDateParam(parsed.data.to, new Date())
  const from = parseDateParam(parsed.data.from, new Date(Date.now() - 30 * 24 * 3600 * 1000))
  const start = from <= to ? from : to
  const end = from <= to ? to : from

  const bucket = parsed.data.bucket === 'week' ? 'week' : 'day'

  async function seriesFromQuery(sql, params) {
    const r = await pool.query(sql, params)
    return r.rows.map((x) => ({ bucket_start: x.bucket_start, value: Number(x.value ?? 0) }))
  }

  if (parsed.data.metric === 'wer') {
    const series = await seriesFromQuery(
      `select date_trunc('${bucket}', updated_at) as bucket_start,
              count(*) filter (where status='released')::int as value
       from escrow_transactions
       where updated_at >= $1 and updated_at < $2
       group by 1
       order by 1 asc`,
      [start, end],
    )
    return res.json({ metric: 'wer', bucket, range: { from: start.toISOString(), to: end.toISOString() }, series })
  }

  if (parsed.data.metric === 'escrows_created') {
    const series = await seriesFromQuery(
      `select date_trunc('${bucket}', created_at) as bucket_start,
              count(*)::int as value
       from escrow_transactions
       where created_at >= $1 and created_at < $2
       group by 1
       order by 1 asc`,
      [start, end],
    )
    return res.json({ metric: 'escrows_created', bucket, range: { from: start.toISOString(), to: end.toISOString() }, series })
  }

  if (parsed.data.metric === 'disputes_opened') {
    const series = await seriesFromQuery(
      `select date_trunc('${bucket}', created_at) as bucket_start,
              count(*)::int as value
       from disputes
       where created_at >= $1 and created_at < $2
       group by 1
       order by 1 asc`,
      [start, end],
    )
    return res.json({ metric: 'disputes_opened', bucket, range: { from: start.toISOString(), to: end.toISOString() }, series })
  }

  if (parsed.data.metric === 'no_shows') {
    const series = await seriesFromQuery(
      `select date_trunc('${bucket}', created_at) as bucket_start,
              count(*) filter (where kind='no_show')::int as value
       from policy_events
       where created_at >= $1 and created_at < $2
       group by 1
       order by 1 asc`,
      [start, end],
    )
    return res.json({ metric: 'no_shows', bucket, range: { from: start.toISOString(), to: end.toISOString() }, series })
  }

  if (parsed.data.metric === 'phone_leaks') {
    const series = await seriesFromQuery(
      `select date_trunc('${bucket}', created_at) as bucket_start,
              count(*) filter (where kind='phone_leak')::int as value
       from policy_events
       where created_at >= $1 and created_at < $2
       group by 1
       order by 1 asc`,
      [start, end],
    )
    return res.json({ metric: 'phone_leaks', bucket, range: { from: start.toISOString(), to: end.toISOString() }, series })
  }

  if (parsed.data.metric === 'jobs_posted') {
    const series = await seriesFromQuery(
      `select date_trunc('${bucket}', created_at) as bucket_start,
              count(*)::int as value
       from jobs
       where created_at >= $1 and created_at < $2
       group by 1
       order by 1 asc`,
      [start, end],
    )
    return res.json({ metric: 'jobs_posted', bucket, range: { from: start.toISOString(), to: end.toISOString() }, series })
  }

  if (parsed.data.metric === 'jobs_completed') {
    const series = await seriesFromQuery(
      `select date_trunc('${bucket}', coalesce(completed_at, updated_at)) as bucket_start,
              count(*) filter (where status='completed')::int as value
       from jobs
       where coalesce(completed_at, updated_at) >= $1 and coalesce(completed_at, updated_at) < $2
       group by 1
       order by 1 asc`,
      [start, end],
    )
    return res.json({ metric: 'jobs_completed', bucket, range: { from: start.toISOString(), to: end.toISOString() }, series })
  }

  return res.status(400).json({ message: 'Unsupported metric' })
}))

// --- Location Intelligence / Geo analytics (aggregated; no raw user-level export) ---
const GeoAnalyticsSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  // bucket size in degrees (rough grid). Default ~0.05deg ≈ 5km.
  bucket_deg: z
    .preprocess((v) => (v == null ? undefined : Number(v)), z.number().min(0.01).max(0.25).optional())
    .optional(),
  min_count: z.preprocess((v) => (v == null ? undefined : Number(v)), z.number().int().min(1).max(20).optional()).optional(),
})

function bucketSql(col, bucketDeg) {
  // numeric columns; bucket to grid start
  return `floor((${col})::numeric / ${bucketDeg}) * ${bucketDeg}`
}

// Web traffic analytics (page views, top pages, referrers, UTM, device, bounce, funnel)
adminRouter.get('/analytics/traffic', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
  const days = Math.min(90, Math.max(1, Number(req.query.days) || 30))
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const pathPrefix = typeof req.query.path_prefix === 'string' && req.query.path_prefix.trim()
    ? req.query.path_prefix.trim()
    : null
  const pathFilter = pathPrefix ? ` and path like $2 escape '\\' ` : ''
  const pathFilterOneParam = pathPrefix ? ` and path like $1 escape '\\' ` : ''
  const pathArg = pathPrefix ? `${pathPrefix.replace(/%/g, '\\%').replace(/_/g, '\\_')}%` : null
  const args = pathPrefix ? [since, pathArg] : [since]
  const argsOne = pathPrefix ? [pathArg] : []

  try {
    const [
      pageViewsTs,
      topPages,
      referrers,
      totals,
      todayViews,
      bounceResult,
      utmBreakdown,
      deviceBreakdown,
      funnel,
    ] = await Promise.all([
      pool.query(
        `select date_trunc('day', created_at)::date as day, count(*)::int as views
         from analytics_events
         where event_type = 'page_view' and created_at >= $1 ${pathFilter}
         group by 1 order by 1`,
        args,
      ),
      pool.query(
        `select path, count(*)::int as views
         from analytics_events
         where event_type = 'page_view' and created_at >= $1 and path is not null and path <> '' ${pathFilter}
         group by path order by views desc limit 20`,
        args,
      ),
      pool.query(
        `select
           case when referrer is null or referrer = '' then 'Direct'
             when referrer ilike '%google%' then 'Google'
             when referrer ilike '%facebook%' then 'Facebook'
             when referrer ilike '%twitter%' or referrer ilike '%x.com%' then 'Twitter/X'
             when referrer ilike '%linkedin%' then 'LinkedIn'
             when referrer ilike '%locallink%' then 'LocalLink (internal)'
             else 'Other' end as source,
           count(*)::int as views
         from analytics_events
         where event_type = 'page_view' and created_at >= $1 ${pathFilter}
         group by 1 order by views desc limit 15`,
        args,
      ),
      pool.query(
        `select count(*)::int as total_page_views,
           count(distinct session_id)::int as unique_sessions,
           count(distinct user_id) filter (where user_id is not null)::int as logged_in_visitors
         from analytics_events
         where event_type = 'page_view' and created_at >= $1 ${pathFilter}`,
        args,
      ),
      pool.query(
        `select count(*)::int as views from analytics_events
         where event_type = 'page_view' and created_at >= date_trunc('day', now()) ${pathFilterOneParam}`,
        argsOne,
      ).then((r) => r.rows[0]?.views ?? 0).catch(() => 0).then((n) => (typeof n === 'number' ? n : 0)),
      pathPrefix
        ? pool.query(
          `select count(*)::int as bounce_sessions from (
             select session_id from analytics_events
             where event_type = 'page_view' and created_at >= $1 and path like $2 escape '\\'
             group by session_id having count(*) = 1
           ) x`,
          [since, pathArg],
        ).then((r) => r.rows[0]?.bounce_sessions ?? 0)
        : pool.query(
          `select count(*)::int as bounce_sessions from (
             select session_id from analytics_events
             where event_type = 'page_view' and created_at >= $1
             group by session_id having count(*) = 1
           ) x`,
          [since],
        ),
      pool.query(
        `select coalesce(utm_source, '(none)') as source, count(*)::int as views
         from analytics_events
         where event_type = 'page_view' and created_at >= $1 ${pathFilter}
         group by utm_source order by views desc limit 15`,
        args,
      ).catch(() => ({ rows: [] })),
      pool.query(
        `select coalesce(device_type, 'unknown') as device, count(*)::int as views
         from analytics_events
         where event_type = 'page_view' and created_at >= $1 ${pathFilter}
         group by device_type order by views desc limit 10`,
        args,
      ).catch(() => ({ rows: [] })),
      pool.query(
        `select event_type, count(*)::int as cnt from analytics_events
         where event_type in ('page_view', 'signup', 'login', 'job_posted', 'order_placed') and created_at >= $1 ${pathFilter}
         group by event_type`,
        args,
      ).catch(() => ({ rows: [] })),
    ])

    const totalsRow = totals.rows?.[0] ?? { total_page_views: 0, unique_sessions: 0, logged_in_visitors: 0 }
    const bounceSessions = bounceResult?.rows?.[0]?.bounce_sessions ?? 0
    const todayViewsVal = typeof todayViews === 'number' ? todayViews : (todayViews?.rows?.[0]?.views ?? 0)
    const uniqueSessions = Number(totalsRow.unique_sessions) || 0
    const bounceRate = uniqueSessions > 0 ? Math.round((bounceSessions / uniqueSessions) * 100) : 0

    const funnelMap = (funnel.rows || []).reduce((acc, row) => {
      acc[row.event_type] = row.cnt
      return acc
    }, {})

    return res.json({
      page_views_over_time: pageViewsTs.rows,
      top_pages: topPages.rows,
      referrers: referrers.rows,
      totals: totalsRow,
      days,
      today_views: todayViewsVal,
      bounce_sessions: bounceSessions,
      bounce_rate_pct: bounceRate,
      utm: (utmBreakdown.rows || []).filter((r) => r.source !== '(none)'),
      devices: deviceBreakdown.rows || [],
      funnel: {
        page_views: funnelMap.page_view ?? 0,
        signup: funnelMap.signup ?? 0,
        login: funnelMap.login ?? 0,
        job_posted: funnelMap.job_posted ?? 0,
        order_placed: funnelMap.order_placed ?? 0,
      },
    })
  } catch (e) {
    if (String(e?.code || '') === '42P01') {
      return res.json({
        page_views_over_time: [],
        top_pages: [],
        referrers: [],
        totals: { total_page_views: 0, unique_sessions: 0, logged_in_visitors: 0 },
        days,
        today_views: 0,
        bounce_sessions: 0,
        bounce_rate_pct: 0,
        utm: [],
        devices: [],
        funnel: { page_views: 0, signup: 0, login: 0, job_posted: 0, order_placed: 0 },
        message: 'Analytics table not ready. Run migrations.',
      })
    }
    throw e
  }
}))

adminRouter.get('/errors', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50))
  const r = await pool.query(
    `select id, message, stack, code, method, path, req_id, user_id, created_at
     from error_logs
     order by created_at desc
     limit $1`,
    [limit],
  )
  return res.json(r.rows)
}))

adminRouter.get('/analytics/geo', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
  const parsed = GeoAnalyticsSchema.safeParse(req.query)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const to = parseDateParam(parsed.data.to, new Date())
  const from = parseDateParam(parsed.data.from, new Date(Date.now() - 30 * 24 * 3600 * 1000))
  const start = from <= to ? from : to
  const end = from <= to ? to : from

  const bucketDeg = Number(parsed.data.bucket_deg ?? 0.05)
  const minCount = Number(parsed.data.min_count ?? 3)

  // Demand: jobs posted (with coordinates)
  const jobs = await pool.query(
    `select
       ${bucketSql('j.location_lat', bucketDeg)} as lat,
       ${bucketSql('j.location_lng', bucketDeg)} as lng,
       count(*)::int as n
     from jobs j
     where j.created_at >= $1 and j.created_at < $2
       and j.location_lat is not null and j.location_lng is not null
     group by 1,2
     having count(*) >= $3
     order by n desc
     limit 300`,
    [start, end, minCount],
  )

  // Demand: orders placed (delivery destination)
  const orders = await pool.query(
    `select
       ${bucketSql('o.delivery_lat', bucketDeg)} as lat,
       ${bucketSql('o.delivery_lng', bucketDeg)} as lng,
       count(*)::int as n
     from orders o
     where o.created_at >= $1 and o.created_at < $2
       and o.delivery_lat is not null and o.delivery_lng is not null
     group by 1,2
     having count(*) >= $3
     order by n desc
     limit 300`,
    [start, end, minCount],
  )

  // Supply: artisans registered (service area)
  const artisans = await pool.query(
    `select
       ${bucketSql('a.service_lat', bucketDeg)} as lat,
       ${bucketSql('a.service_lng', bucketDeg)} as lng,
       count(*)::int as n
     from artisans a
     join users u on u.id = a.user_id and u.deleted_at is null
     where a.service_lat is not null and a.service_lng is not null
     group by 1,2
     having count(*) >= $1
     order by n desc
     limit 300`,
    [minCount],
  )

  // Supply: farmers registered (farm location)
  const farmers = await pool.query(
    `select
       ${bucketSql('f.farm_lat', bucketDeg)} as lat,
       ${bucketSql('f.farm_lng', bucketDeg)} as lng,
       count(*)::int as n
     from farmers f
     join users u on u.id = f.user_id and u.deleted_at is null
     where f.farm_lat is not null and f.farm_lng is not null
     group by 1,2
     having count(*) >= $1
     order by n desc
     limit 300`,
    [minCount],
  )

  // Operations: disputes opened (mapped to job/order geo when available)
  const disputes = await pool.query(
    `select lat, lng, count(*)::int as n
     from (
       select
         case
           when e.type = 'job' then ${bucketSql('j.location_lat', bucketDeg)}
           else ${bucketSql('o.delivery_lat', bucketDeg)}
         end as lat,
         case
           when e.type = 'job' then ${bucketSql('j.location_lng', bucketDeg)}
           else ${bucketSql('o.delivery_lng', bucketDeg)}
         end as lng
       from disputes d
       join escrow_transactions e on e.id = d.escrow_id
       left join jobs j on j.id = e.job_id
       left join orders o on o.id = e.order_id
       where d.created_at >= $1 and d.created_at < $2
     ) t
     where lat is not null and lng is not null
     group by 1,2
     having count(*) >= $3
     order by n desc
     limit 300`,
    [start, end, minCount],
  )

  // Operations: online drivers (fresh pings only)
  const driversFresh = await pool.query(
    `select
       ${bucketSql('d.last_lat', bucketDeg)} as lat,
       ${bucketSql('d.last_lng', bucketDeg)} as lng,
       count(*)::int as n
     from drivers d
     join users u on u.id = d.user_id and u.deleted_at is null
     where d.status = 'approved'
       and d.is_online = true
       and d.last_location_at >= now() - interval '20 minutes'
       and d.last_lat is not null and d.last_lng is not null
     group by 1,2
     having count(*) >= $1
     order by n desc
     limit 300`,
    [minCount],
  )

  return res.json({
    range: { from: start.toISOString(), to: end.toISOString() },
    bucket_deg: bucketDeg,
    min_count: minCount,
    layers: {
      demand_jobs: jobs.rows,
      demand_orders: orders.rows,
      supply_artisans: artisans.rows,
      supply_farmers: farmers.rows,
      ops_disputes: disputes.rows,
      ops_drivers_online_fresh: driversFresh.rows,
    },
  })
}))

adminRouter.get('/users', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
  const r = await pool.query(
    `select u.id, u.name, u.email, u.phone, u.role, u.verified, u.rating, u.trust_score,
            u.last_active_at, u.created_at,
            u.suspended_until, u.suspended_reason,
            coalesce(v.level, 'unverified') as verification_tier
     from users u
     left join verification_levels v on v.user_id = u.id
     order by u.created_at desc`,
  )
  return res.json(r.rows)
}))

adminRouter.get('/users/:id', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
  const uid = req.params.id
  const u = await pool.query(
    `select u.id, u.name, u.email, u.phone, u.role, u.verified, u.rating, u.profile_pic,
            u.trust_score, u.last_active_at, u.created_at,
            u.deleted_at, u.must_change_password,
            u.suspended_until, u.suspended_reason, u.suspended_by_admin_id,
            coalesce(v.level, 'unverified') as verification_tier,
            v.updated_at as verification_updated_at
     from users u
     left join verification_levels v on v.user_id = u.id
     where u.id = $1`,
    [uid],
  )
  if (!u.rows[0]) return res.status(404).json({ message: 'User not found' })

  const [profileRes, artisanRes, farmerRes, driverRes, countsRes] = await Promise.all([
    pool.query('select user_id, bio, cover_photo, links, created_at, updated_at from user_profiles where user_id = $1', [uid]),
    pool.query(
      `select id, user_id, skills, primary_skill, experience_years, service_area, service_place_id, service_lat, service_lng, premium, created_at, updated_at
       from artisans where user_id = $1`,
      [uid],
    ),
    pool.query(
      `select id, user_id, farm_location, farm_type, farm_place_id, farm_lat, farm_lng, created_at, updated_at
       from farmers where user_id = $1`,
      [uid],
    ),
    pool.query(
      `select user_id, vehicle_type, area_of_operation, status, is_online, last_location_at, last_lat, last_lng, created_at, updated_at
       from drivers where user_id = $1`,
      [uid],
    ),
    pool.query(
      `select
         (select count(*)::int from support_tickets t where t.requester_user_id = $1) as support_tickets,
         (select count(*)::int from disputes d join escrow_transactions e on e.id=d.escrow_id where e.buyer_id=$1 or e.counterparty_user_id=$1) as disputes_involved,
         (select count(*)::int from reviews r where r.target_id = $1) as reviews_received`,
      [uid],
    ),
  ])

  const role = String(u.rows[0].role || '')
  const role_profile =
    role === 'artisan'
      ? (artisanRes.rows[0] ?? null)
      : role === 'farmer'
        ? (farmerRes.rows[0] ?? null)
        : role === 'driver'
          ? (driverRes.rows[0] ?? null)
          : null

  return res.json({
    user: u.rows[0],
    profile: profileRes.rows[0] ?? null,
    role_profile,
    counts: countsRes.rows[0] ?? { support_tickets: 0, disputes_involved: 0, reviews_received: 0 },
  })
}))

adminRouter.post('/users/:id/reset-password', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
  const uid = req.params.id
  const exists = await pool.query('select id, role, email from users where id = $1', [uid])
  if (!exists.rows[0]) return res.status(404).json({ message: 'User not found' })

  // Generate a one-time temp password (no external email integration yet).
  const tempPassword = `LL-${crypto.randomBytes(6).toString('base64url')}`
  const hash = await bcrypt.hash(tempPassword, 10)

  await pool.query('update users set password_hash = $2, must_change_password = true, updated_at = now() where id = $1', [uid, hash])

  await auditAdminAction({
    adminUserId: req.user.sub,
    action: 'user_reset_password',
    targetType: 'user',
    targetId: uid,
    meta: { email: exists.rows[0].email, must_change_password: true },
    ip: req.ip,
    userAgent: req.get('user-agent'),
  }).catch(() => {})

  return res.json({ ok: true, temp_password: tempPassword, must_change_password: true })
}))

// --- Support inbox (admin) ---
const SupportListSchema = z.object({
  status: z.enum(['open', 'pending_user', 'pending_admin', 'resolved', 'closed']).optional(),
  q: z.string().max(200).optional(),
  limit: z
    .preprocess((v) => (v == null ? 100 : Number(v)), z.number().int().min(1).max(200))
    .optional(),
})

adminRouter.get('/support/tickets', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
  const parsed = SupportListSchema.safeParse(req.query)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const status = parsed.data.status ?? null
  const q = String(parsed.data.q ?? '').trim().toLowerCase()
  const limit = Number(parsed.data.limit ?? 100)

  const r = await pool.query(
    `select t.*,
            ru.name as requester_name,
            ru.email as requester_email,
            au.name as assigned_admin_name
     from support_tickets t
     left join users ru on ru.id = t.requester_user_id
     left join users au on au.id = t.assigned_admin_user_id
     where ($1::text is null or t.status = $1::support_ticket_status)
       and (
         $2 = ''
         or lower(coalesce(t.subject,'')) like ('%'||$2||'%')
         or lower(coalesce(t.description,'')) like ('%'||$2||'%')
         or lower(coalesce(t.related_type,'')) like ('%'||$2||'%')
         or lower(coalesce(t.related_id,'')) like ('%'||$2||'%')
         or lower(coalesce(ru.name,'')) like ('%'||$2||'%')
         or lower(coalesce(ru.email,'')) like ('%'||$2||'%')
       )
     order by t.last_activity_at desc
     limit $3`,
    [status, q, limit],
  )
  return res.json(r.rows)
}))

adminRouter.get('/support/tickets/:id', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
  const t = await pool.query(
    `select t.*,
            ru.name as requester_name,
            ru.email as requester_email,
            au.name as assigned_admin_name
     from support_tickets t
     left join users ru on ru.id = t.requester_user_id
     left join users au on au.id = t.assigned_admin_user_id
     where t.id = $1`,
    [req.params.id],
  )
  if (!t.rows[0]) return res.status(404).json({ message: 'Ticket not found' })
  const events = await pool.query(
    `select e.*, u.name as author_name
     from support_ticket_events e
     left join users u on u.id = e.author_user_id
     where e.ticket_id = $1
     order by e.created_at asc`,
    [req.params.id],
  )
  return res.json({ ticket: t.rows[0], events: events.rows })
}))

const SupportUpdateSchema = z.object({
  status: z.enum(['open', 'pending_user', 'pending_admin', 'resolved', 'closed']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  assigned_admin_user_id: z.string().uuid().optional().nullable(),
})

adminRouter.put('/support/tickets/:id', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
  const parsed = SupportUpdateSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const d = parsed.data
  const r = await pool.query(
    `update support_tickets
     set status = coalesce($2::support_ticket_status, status),
         priority = coalesce($3::support_ticket_priority, priority),
         assigned_admin_user_id = coalesce($4::uuid, assigned_admin_user_id),
         last_activity_at = now(),
         updated_at = now()
     where id = $1
     returning *`,
    [req.params.id, d.status ?? null, d.priority ?? null, d.assigned_admin_user_id ?? null],
  )
  if (!r.rows[0]) return res.status(404).json({ message: 'Ticket not found' })
  return res.json(r.rows[0])
}))

const SupportEventSchema = z.object({
  visibility: z.enum(['internal', 'customer']).optional().default('customer'),
  body: z.string().min(1).max(5000),
  attachments: z.array(z.string().min(1).max(500)).max(12).optional().nullable(),
})

adminRouter.post('/support/tickets/:id/events', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
  const parsed = SupportEventSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const t = await pool.query('select * from support_tickets where id = $1', [req.params.id])
  const ticket = t.rows[0]
  if (!ticket) return res.status(404).json({ message: 'Ticket not found' })

  const attachments = (Array.isArray(parsed.data.attachments) ? parsed.data.attachments : [])
    .map((x) => (typeof x === 'string' && x.trim() ? x.trim() : null))
    .filter(Boolean)
    .slice(0, 12)
  const attachmentsJson = attachments.length ? JSON.stringify(attachments) : null

  const e = await pool.query(
    `insert into support_ticket_events (ticket_id, author_user_id, visibility, body, attachments)
     values ($1,$2,$3,$4,$5::jsonb)
     returning *`,
    [ticket.id, req.user.sub, parsed.data.visibility, parsed.data.body, attachmentsJson],
  )

  // If we replied to customer, mark pending_user and notify requester.
  if (parsed.data.visibility === 'customer' && ticket.requester_user_id) {
    await pool.query(`update support_tickets set status='pending_user', last_activity_at=now(), updated_at=now() where id=$1`, [ticket.id])
    notify({
      userId: ticket.requester_user_id,
      type: 'support_ticket_reply',
      title: 'Support replied',
      body: `Ticket: ${ticket.subject}`,
      meta: { ticket_id: ticket.id, url: '/support' },
      dedupeKey: `support_ticket:${ticket.id}:reply:${Date.now()}`,
    }).catch(() => {})
  } else {
    await pool.query(`update support_tickets set last_activity_at=now(), updated_at=now() where id=$1`, [ticket.id])
  }

  return res.status(201).json(e.rows[0])
}))

// --- Comment moderation (admin) ---
const AdminCommentListSchema = z.object({
  status: z.enum(['active', 'deleted', 'all']).optional().default('active'),
  q: z.string().max(200).optional().nullable(),
  limit: z.preprocess((v) => (v == null ? 50 : Number(v)), z.number().int().min(1).max(200)).optional(),
  offset: z.preprocess((v) => (v == null ? 0 : Number(v)), z.number().int().min(0).max(50_000)).optional(),
})

adminRouter.get('/comments', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
  const parsed = AdminCommentListSchema.safeParse(req.query)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const status = parsed.data.status
  const q = String(parsed.data.q ?? '').trim().toLowerCase()
  const limit = Number(parsed.data.limit ?? 50)
  const offset = Number(parsed.data.offset ?? 0)

  const r = await pool.query(
    `select
       c.id, c.post_id, c.user_id, c.parent_id, c.created_at, c.updated_at, c.deleted_at,
       left(coalesce(c.body,''), 240) as body_preview,
       u.name as author_name,
       (
         select count(*)::int from user_post_comment_likes l where l.comment_id = c.id
       ) as like_count,
       (
         select count(*)::int from user_post_comments r where r.parent_id = c.id and r.deleted_at is null
       ) as reply_count
     from user_post_comments c
     left join users u on u.id = c.user_id
     where
       ($1::text = 'all'
         or ($1::text = 'active' and c.deleted_at is null)
         or ($1::text = 'deleted' and c.deleted_at is not null)
       )
       and (
         $2 = ''
         or lower(cast(c.id as text)) = $2
         or lower(coalesce(c.body,'')) like ('%'||$2||'%')
         or lower(coalesce(u.name,'')) like ('%'||$2||'%')
       )
     order by c.created_at desc
     limit $3
     offset $4`,
    [status, q, limit, offset],
  )
  return res.json({ items: r.rows, limit, offset })
}))

adminRouter.get('/comments/:id', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
  const r = await pool.query(
    `select
       c.*,
       u.name as author_name,
       u.email as author_email
     from user_post_comments c
     left join users u on u.id = c.user_id
     where c.id = $1`,
    [req.params.id],
  )
  if (!r.rows[0]) return res.status(404).json({ message: 'Comment not found' })
  return res.json(r.rows[0])
}))

const AdminCommentActionSchema = z.object({
  note: z.string().max(1000).optional().nullable(),
})

adminRouter.post('/comments/:id/hide', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
  const parsed = AdminCommentActionSchema.safeParse(req.body ?? {})
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const r = await pool.query(
    `update user_post_comments
     set deleted_at = coalesce(deleted_at, now()),
         updated_at = now()
     where id = $1
     returning id, post_id, user_id, deleted_at`,
    [req.params.id],
  )
  if (!r.rows[0]) return res.status(404).json({ message: 'Comment not found' })

  await auditAdminAction({
    adminUserId: req.user.sub,
    action: 'comment_hide',
    targetType: 'post_comment',
    targetId: req.params.id,
    meta: { note: parsed.data.note ?? null, post_id: r.rows[0].post_id, user_id: r.rows[0].user_id },
    ip: req.ip,
    userAgent: req.get('user-agent'),
  }).catch(() => {})

  return res.json({ ok: true, comment: r.rows[0] })
}))

adminRouter.post('/comments/:id/restore', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
  const parsed = AdminCommentActionSchema.safeParse(req.body ?? {})
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const r = await pool.query(
    `update user_post_comments
     set deleted_at = null,
         updated_at = now()
     where id = $1
     returning id, post_id, user_id, deleted_at`,
    [req.params.id],
  )
  if (!r.rows[0]) return res.status(404).json({ message: 'Comment not found' })

  await auditAdminAction({
    adminUserId: req.user.sub,
    action: 'comment_restore',
    targetType: 'post_comment',
    targetId: req.params.id,
    meta: { note: parsed.data.note ?? null, post_id: r.rows[0].post_id, user_id: r.rows[0].user_id },
    ip: req.ip,
    userAgent: req.get('user-agent'),
  }).catch(() => {})

  return res.json({ ok: true, comment: r.rows[0] })
}))

// --- Moderation queue + keyword filters ---
const KeywordAction = z.enum(['block', 'flag'])
const KeywordCreateSchema = z.object({
  keyword: z.string().min(1).max(80),
  action: KeywordAction.optional().default('block'),
  enabled: z.boolean().optional().default(true),
})

adminRouter.get('/moderation/keywords', requireAuth, requireRole(['admin']), asyncHandler(async (_req, res) => {
  const r = await pool.query(
    `select id, keyword, action, enabled, created_at, updated_at, created_by, updated_by
     from moderation_keyword_filters
     order by enabled desc, updated_at desc
     limit 500`,
  )
  return res.json(r.rows)
}))

adminRouter.post('/moderation/keywords', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
  const parsed = KeywordCreateSchema.safeParse(req.body ?? {})
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  try {
    const r = await pool.query(
      `insert into moderation_keyword_filters (keyword, action, enabled, created_by, updated_by)
       values ($1,$2,$3,$4,$4)
       returning *`,
      [parsed.data.keyword.trim(), parsed.data.action, parsed.data.enabled, req.user.sub],
    )
    return res.status(201).json(r.rows[0])
  } catch (e) {
    if (String(e?.message || '').includes('duplicate key')) {
      return res.status(409).json({ message: 'Keyword already exists' })
    }
    throw e
  }
}))

const KeywordUpdateSchema = KeywordCreateSchema.partial()
adminRouter.put('/moderation/keywords/:id', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
  const parsed = KeywordUpdateSchema.safeParse(req.body ?? {})
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })
  const d = parsed.data
  const r = await pool.query(
    `update moderation_keyword_filters
     set keyword = coalesce($2, keyword),
         action = coalesce($3, action),
         enabled = coalesce($4, enabled),
         updated_by = $5,
         updated_at = now()
     where id = $1
     returning *`,
    [req.params.id, d.keyword != null ? String(d.keyword).trim() : null, d.action ?? null, d.enabled ?? null, req.user.sub],
  )
  if (!r.rows[0]) return res.status(404).json({ message: 'Keyword not found' })
  return res.json(r.rows[0])
}))

adminRouter.delete('/moderation/keywords/:id', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
  const r = await pool.query(`delete from moderation_keyword_filters where id = $1 returning id`, [req.params.id])
  if (!r.rows[0]) return res.status(404).json({ message: 'Keyword not found' })
  return res.json({ ok: true })
}))

const ModerationQueueSchema = z.object({
  status: z.enum(['visible', 'hidden', 'all']).optional().default('visible'),
  range: z.enum(['all', '7d', '30d']).optional().default('all'),
  q: z.string().max(200).optional().nullable(),
  limit: z.preprocess((v) => (v == null ? 80 : Number(v)), z.number().int().min(1).max(200)).optional(),
  offset: z.preprocess((v) => (v == null ? 0 : Number(v)), z.number().int().min(0).max(50_000)).optional(),
})

adminRouter.get('/moderation/comments', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
  const parsed = ModerationQueueSchema.safeParse(req.query)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const status = parsed.data.status
  const range = parsed.data.range
  const q = String(parsed.data.q ?? '').trim().toLowerCase()
  const limit = Number(parsed.data.limit ?? 80)
  const offset = Number(parsed.data.offset ?? 0)
  const since =
    range === '7d'
      ? new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()
      : range === '30d'
        ? new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
        : null

  const r = await pool.query(
    `with rep as (
       select comment_id, count(*)::int as report_count, max(updated_at) as last_reported_at
       from user_post_comment_reports
       where ($5::timestamptz is null or updated_at >= $5::timestamptz)
       group by comment_id
     ),
     flg as (
       select comment_id, count(*)::int as flag_count, max(created_at) as last_flagged_at
       from user_post_comment_flags
       where ($5::timestamptz is null or created_at >= $5::timestamptz)
       group by comment_id
     ),
     sig as (
       select
         coalesce(rep.comment_id, flg.comment_id) as comment_id,
         coalesce(rep.report_count, 0) as report_count,
         coalesce(flg.flag_count, 0) as flag_count,
         rep.last_reported_at,
         flg.last_flagged_at
       from rep
       full join flg on flg.comment_id = rep.comment_id
     )
     select
       c.id,
       c.post_id,
       c.user_id,
       c.parent_id,
       c.created_at,
       c.updated_at,
       c.deleted_at,
       u.name as author_name,
       left(coalesce(c.body,''), 240) as body_preview,
       sig.report_count,
       sig.flag_count,
       (sig.report_count + sig.flag_count)::int as signal_count,
       greatest(coalesce(sig.last_reported_at, 'epoch'::timestamptz), coalesce(sig.last_flagged_at, 'epoch'::timestamptz)) as last_signal_at
     from sig
     join user_post_comments c on c.id = sig.comment_id
     left join users u on u.id = c.user_id
     where
       ($1::text = 'all'
         or ($1::text = 'visible' and c.deleted_at is null)
         or ($1::text = 'hidden' and c.deleted_at is not null)
       )
       and (
         $2 = ''
         or lower(cast(c.id as text)) = $2
         or lower(coalesce(c.body,'')) like ('%'||$2||'%')
         or lower(coalesce(u.name,'')) like ('%'||$2||'%')
       )
     order by (sig.report_count + sig.flag_count) desc, last_signal_at desc
     limit $3
     offset $4`,
    [status, q, limit, offset, since],
  )
  return res.json({ items: r.rows, limit, offset, range })
}))

adminRouter.put('/users/:id/verify', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
  await pool.query('update users set verified = true, updated_at = now() where id = $1', [req.params.id])
  await auditAdminAction({
    adminUserId: req.user.sub,
    action: 'user_verify',
    targetType: 'user',
    targetId: req.params.id,
    meta: { verified: true },
    ip: req.ip,
    userAgent: req.get('user-agent'),
  })
  return res.json({ ok: true })
}))

const SuspendUserSchema = z.object({
  until: z.string().datetime().optional().nullable(), // ISO datetime
  hours: z.coerce.number().int().min(1).max(24 * 30).optional().nullable(), // alternative
  reason: z.string().max(500).optional().nullable(),
})

adminRouter.put('/users/:id/suspend', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
  const parsed = SuspendUserSchema.safeParse(req.body ?? {})
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const until =
    parsed.data.until != null
      ? new Date(parsed.data.until)
      : parsed.data.hours != null
        ? new Date(Date.now() + Number(parsed.data.hours) * 3600 * 1000)
        : null
  if (!until || !Number.isFinite(until.getTime())) return res.status(400).json({ message: 'Provide until or hours' })

  const r = await pool.query(
    `update users
     set suspended_until=$2, suspended_reason=$3, suspended_by_admin_id=$4, updated_at=now()
     where id=$1
     returning id, email, name, role, suspended_until, suspended_reason`,
    [req.params.id, until.toISOString(), parsed.data.reason ?? null, req.user.sub],
  )
  if (!r.rows[0]) return res.status(404).json({ message: 'User not found' })

  await auditAdminAction({
    adminUserId: req.user.sub,
    action: 'user_suspend',
    targetType: 'user',
    targetId: req.params.id,
    meta: { suspended_until: until.toISOString(), reason: parsed.data.reason ?? null },
    ip: req.ip,
    userAgent: req.get('user-agent'),
  }).catch(() => {})

  // Best-effort notify
  notify({
    userId: req.params.id,
    type: 'account_suspended',
    title: 'Account temporarily suspended',
    body: parsed.data.reason ? `Reason: ${parsed.data.reason}` : 'Please contact support if you think this is a mistake.',
    meta: { url: '/support', suspended_until: until.toISOString() },
    dedupeKey: `user:${req.params.id}:suspended:${until.toISOString()}`,
  }).catch(() => {})

  return res.json(r.rows[0])
}))

adminRouter.put('/users/:id/unsuspend', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
  const r = await pool.query(
    `update users
     set suspended_until=null, suspended_reason=null, suspended_by_admin_id=null, updated_at=now()
     where id=$1
     returning id, email, name, role, suspended_until, suspended_reason`,
    [req.params.id],
  )
  if (!r.rows[0]) return res.status(404).json({ message: 'User not found' })

  await auditAdminAction({
    adminUserId: req.user.sub,
    action: 'user_unsuspend',
    targetType: 'user',
    targetId: req.params.id,
    meta: { unsuspended: true },
    ip: req.ip,
    userAgent: req.get('user-agent'),
  }).catch(() => {})

  return res.json(r.rows[0])
}))

const SetTierSchema = z.object({
  level: z.enum(['unverified', 'bronze', 'silver', 'gold']),
  evidence: z.any().optional(),
})

adminRouter.put('/users/:id/verification', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
  const parsed = SetTierSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  await pool.query(
    `insert into verification_levels (user_id, level, evidence, updated_by)
     values ($1, $2, $3, $4)
     on conflict (user_id) do update set
       level = excluded.level,
       evidence = excluded.evidence,
       updated_by = excluded.updated_by,
       updated_at = now()`,
    [req.params.id, parsed.data.level, parsed.data.evidence ?? null, req.user.sub],
  )
  await auditAdminAction({
    adminUserId: req.user.sub,
    action: 'user_set_verification_tier',
    targetType: 'user',
    targetId: req.params.id,
    meta: { level: parsed.data.level },
    ip: req.ip,
    userAgent: req.get('user-agent'),
  })
  return res.json({ ok: true })
}))

adminRouter.get('/disputes', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
  const r = await pool.query(
    `select d.*,
            e.type as escrow_type,
            e.amount as escrow_amount,
            e.currency as escrow_currency,
            e.status as escrow_status,
            e.job_id,
            e.order_id,
            e.buyer_id,
            e.counterparty_user_id
     from disputes d
     join escrow_transactions e on e.id = d.escrow_id
     order by d.created_at desc
     limit 100`,
  )
  return res.json(r.rows)
}))

const ResolveDisputeSchema = z.object({
  action: z.enum(['release', 'refund', 'split']),
  seller_amount: z.number().nonnegative().optional(),
  buyer_amount: z.number().nonnegative().optional(),
  note: z.string().optional(),
})

adminRouter.post('/disputes/:id/resolve', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
  const parsed = ResolveDisputeSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const client = await pool.connect()
  try {
    await client.query('begin')

    const dRes = await client.query('select * from disputes where id = $1 for update', [req.params.id])
    const dispute = dRes.rows[0]
    if (!dispute) {
      await client.query('rollback')
      return res.status(404).json({ message: 'Dispute not found' })
    }
    if (dispute.status === 'resolved' || dispute.status === 'rejected') {
      await client.query('rollback')
      return res.status(400).json({ message: 'Dispute already resolved' })
    }

    const eRes = await client.query('select * from escrow_transactions where id = $1 for update', [dispute.escrow_id])
    const escrow = eRes.rows[0]
    if (!escrow) {
      await client.query('rollback')
      return res.status(404).json({ message: 'Escrow not found' })
    }

    const total = Number(escrow.amount ?? 0)
    let sellerAmount = 0
    let buyerAmount = 0

    if (parsed.data.action === 'release') {
      sellerAmount = total
      buyerAmount = 0
    } else if (parsed.data.action === 'refund') {
      sellerAmount = 0
      buyerAmount = total
    } else {
      sellerAmount = Number(parsed.data.seller_amount ?? 0)
      buyerAmount = Number(parsed.data.buyer_amount ?? 0)
    }

    if (sellerAmount < 0 || buyerAmount < 0 || Math.abs(sellerAmount + buyerAmount - total) > 0.0001) {
      await client.query('rollback')
      return res.status(400).json({ message: 'Split amounts must sum to escrow amount' })
    }

    // fee applied only to seller release portion
    const feePct = escrow.type === 'order' ? env.PLATFORM_FEE_PCT_ORDER : env.PLATFORM_FEE_PCT_JOB
    const clampedPct = Math.min(Math.max(feePct ?? 0, 0), 0.25)
    const platformFee = sellerAmount > 0 ? sellerAmount * clampedPct : 0
    const sellerPayout = sellerAmount - platformFee

    if (sellerPayout > 0 && escrow.counterparty_user_id) {
      await creditWalletTx(client, {
        userId: escrow.counterparty_user_id,
        amount: sellerPayout,
        currency: escrow.currency ?? 'GHS',
        kind: 'escrow_release',
        refType: 'escrow',
        refId: escrow.id,
        idempotencyKey: `escrow_release:${escrow.id}`,
        meta: { dispute_id: dispute.id, resolved_by: req.user.sub, platform_fee: platformFee, gross_amount: sellerAmount },
      })
    }
    if (buyerAmount > 0 && escrow.buyer_id) {
      await creditWalletTx(client, {
        userId: escrow.buyer_id,
        amount: buyerAmount,
        currency: escrow.currency ?? 'GHS',
        kind: 'escrow_refund',
        refType: 'escrow',
        refId: escrow.id,
        idempotencyKey: `escrow_refund:${escrow.id}`,
        meta: { dispute_id: dispute.id, resolved_by: req.user.sub, gross_amount: buyerAmount },
      })
    }

    const nextEscrowStatus = sellerAmount > 0 ? 'released' : 'refunded'
    const updatedEscrow = await client.query(
      `update escrow_transactions
       set status = $2,
           platform_fee = $3,
           updated_at = now(),
           meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object(
             'dispute_resolution',
             jsonb_build_object('action',$4,'seller_amount',$5,'buyer_amount',$6,'note',$7,'resolved_by',$8)
           )
       where id = $1
       returning *`,
      [
        escrow.id,
        nextEscrowStatus,
        platformFee,
        parsed.data.action,
        sellerAmount,
        buyerAmount,
        parsed.data.note ?? null,
        req.user.sub,
      ],
    )

    const updatedDispute = await client.query(
      `update disputes
       set status = 'resolved',
           updated_at = now(),
           resolved_by = $8,
           resolved_at = now(),
           resolution = jsonb_build_object(
             'action',$2,'seller_amount',$3,'buyer_amount',$4,'platform_fee',$5,'note',$6,'resolved_by',$7
           )
       where id = $1
       returning *`,
      [
        dispute.id,
        parsed.data.action,
        sellerAmount,
        buyerAmount,
        platformFee,
        parsed.data.note ?? null,
        req.user.sub,
        req.user.sub,
      ],
    )

    await client.query('commit')
    await auditAdminAction({
      adminUserId: req.user.sub,
      action: 'dispute_resolve',
      targetType: 'dispute',
      targetId: dispute.id,
      meta: {
        action: parsed.data.action,
        seller_amount: sellerAmount,
        buyer_amount: buyerAmount,
        platform_fee: platformFee,
        note: parsed.data.note ?? null,
        escrow_id: dispute.escrow_id,
      },
      ip: req.ip,
      userAgent: req.get('user-agent'),
    })
    return res.json({ ok: true, dispute: updatedDispute.rows[0], escrow: updatedEscrow.rows[0] })
  } catch (e) {
    try {
      await client.query('rollback')
    } catch {
      // ignore
    }
    throw e
  } finally {
    client.release()
  }
}))

adminRouter.get('/payouts', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
  const r = await pool.query('select * from payouts order by created_at desc limit 100')
  return res.json(r.rows)
}))

adminRouter.post('/payouts/:id/mark-paid', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
  const r = await pool.query(`update payouts set status='paid', updated_at = now() where id = $1 returning *`, [req.params.id])
  if (!r.rows[0]) return res.status(404).json({ message: 'Payout not found' })
  await auditAdminAction({
    adminUserId: req.user.sub,
    action: 'payout_mark_paid',
    targetType: 'payout',
    targetId: req.params.id,
    meta: { status: 'paid' },
    ip: req.ip,
    userAgent: req.get('user-agent'),
  })
  return res.json(r.rows[0])
}))

adminRouter.post('/payouts/:id/cancel', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query('begin')
    const pRes = await client.query('select * from payouts where id = $1 for update', [req.params.id])
    const payout = pRes.rows[0]
    if (!payout) {
      await client.query('rollback')
      return res.status(404).json({ message: 'Payout not found' })
    }
    if (payout.status === 'paid') {
      await client.query('rollback')
      return res.status(400).json({ message: 'Cannot cancel a paid payout' })
    }
    await client.query(`update payouts set status='cancelled', updated_at=now() where id = $1`, [payout.id])
    // refund amount back to wallet
    if (Number(payout.amount ?? 0) > 0 && payout.user_id) {
      await creditWalletTx(client, {
        userId: payout.user_id,
        amount: Number(payout.amount),
        currency: payout.currency ?? 'GHS',
        kind: 'payout_refund',
        refType: 'payout',
        refId: payout.id,
        idempotencyKey: `payout_refund:${payout.id}`,
        meta: { payout_status: payout.status, cancelled_by: req.user.sub },
      })
    }
    await client.query('commit')
    const updated = await pool.query('select * from payouts where id = $1', [payout.id])
    await auditAdminAction({
      adminUserId: req.user.sub,
      action: 'payout_cancel',
      targetType: 'payout',
      targetId: payout.id,
      meta: { status: 'cancelled', refunded_to_wallet: true, amount: payout.amount, currency: payout.currency ?? 'GHS' },
      ip: req.ip,
      userAgent: req.get('user-agent'),
    })
    return res.json(updated.rows[0])
  } catch (e) {
    try {
      await client.query('rollback')
    } catch {}
    throw e
  } finally {
    client.release()
  }
}))

// --- Admin audit log (recent actions) ---
adminRouter.get('/audit', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
  const r = await pool.query(
    `select id, admin_user_id, action, target_type, target_id, meta, ip, user_agent, created_at
     from admin_audit_logs
     order by created_at desc
     limit 200`,
  )
  return res.json(r.rows)
}))

// --- Logistics (Phase 1) ---
adminRouter.get('/deliveries', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
  const r = await pool.query(
    `select d.*,
            o.product_id,
            o.quantity,
            o.total_price,
            o.delivery_fee,
            o.delivery_address
     from deliveries d
     join orders o on o.id = d.order_id
     order by d.created_at desc
     limit 100`,
  )
  return res.json(r.rows)
}))

const AssignDriverSchema = z.object({
  driver_user_id: z.string().uuid(),
})

adminRouter.post('/deliveries/:id/assign', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
  const parsed = AssignDriverSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const client = await pool.connect()
  try {
    await client.query('begin')
    const dRes = await client.query('select * from deliveries where id = $1 for update', [req.params.id])
    const delivery = dRes.rows[0]
    if (!delivery) {
      await client.query('rollback')
      return res.status(404).json({ message: 'Delivery not found' })
    }

    // Ensure driver exists and is approved
    const drv = await client.query('select * from drivers where user_id = $1', [parsed.data.driver_user_id])
    if (!drv.rows[0]) {
      await client.query('rollback')
      return res.status(400).json({ message: 'Driver profile not found' })
    }
    if (drv.rows[0].status !== 'approved') {
      await client.query('rollback')
      return res.status(400).json({ message: 'Driver is not approved' })
    }

    const updated = await client.query(
      `update deliveries
       set driver_user_id = $2,
           status = 'driver_assigned',
           updated_at = now()
       where id = $1
       returning *`,
      [delivery.id, parsed.data.driver_user_id],
    )

    // Attach driver to delivery escrow row (kind=delivery)
    await client.query(
      `update escrow_transactions
       set counterparty_user_id = $2, updated_at = now()
       where type='order'
         and order_id = $1
         and (meta->>'kind') = 'delivery'`,
      [delivery.order_id, parsed.data.driver_user_id],
    )

    await client.query('commit')
    return res.json(updated.rows[0])
  } catch (e) {
    try {
      await client.query('rollback')
    } catch {}
    throw e
  } finally {
    client.release()
  }
}))

// --- Manual Ops Hooks (early-stage Ghana reality) ---
const ReassignJobSchema = z.object({
  artisan_user_id: z.string().uuid().optional().nullable(),
  artisan_id: z.string().uuid().optional().nullable(),
  accepted_quote: z.coerce.number().positive().optional().nullable(),
})

adminRouter.post('/jobs/:id/reassign', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
  const parsed = ReassignJobSchema.safeParse(req.body ?? {})
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })
  const artisanUserId = parsed.data.artisan_user_id ?? null
  const artisanId = parsed.data.artisan_id ?? null
  if (!artisanUserId && !artisanId) return res.status(400).json({ message: 'Provide artisan_user_id or artisan_id' })

  const client = await pool.connect()
  try {
    await client.query('begin')
    const jRes = await client.query('select * from jobs where id = $1 for update', [req.params.id])
    const job = jRes.rows[0]
    if (!job) {
      await client.query('rollback')
      return res.status(404).json({ message: 'Job not found' })
    }

    // Safety: don't reassign if escrow is already held/released (requires dispute/refund handling).
    const eRes = await client.query(
      `select *
       from escrow_transactions
       where type='job' and job_id = $1
       order by created_at desc
       limit 1
       for update`,
      [job.id],
    )
    const escrow = eRes.rows[0] ?? null
    if (escrow && ['held', 'completed_pending_confirmation', 'released'].includes(String(escrow.status))) {
      await client.query('rollback')
      return res.status(400).json({ message: `Cannot reassign: escrow is already '${escrow.status}'. Use disputes/refunds instead.` })
    }

    let artisan = null
    if (artisanId) {
      const aRes = await client.query('select * from artisans where id = $1', [artisanId])
      artisan = aRes.rows[0] ?? null
    } else {
      const aRes = await client.query('select * from artisans where user_id = $1', [artisanUserId])
      artisan = aRes.rows[0] ?? null
    }
    if (!artisan) {
      await client.query('rollback')
      return res.status(400).json({ message: 'Artisan not found' })
    }

    const acceptedQuote = parsed.data.accepted_quote != null ? Number(parsed.data.accepted_quote) : job.accepted_quote ?? null
    if (!acceptedQuote || !Number.isFinite(Number(acceptedQuote)) || Number(acceptedQuote) <= 0) {
      await client.query('rollback')
      return res
        .status(400)
        .json({ message: 'Provide accepted_quote (deposit amount) to assign without an accepted quote.' })
    }

    const updated = await client.query(
      `update jobs
       set status='assigned',
           assigned_artisan_id=$2,
           accepted_quote=$3,
           updated_at=now()
       where id=$1
       returning *`,
      [job.id, artisan.id, acceptedQuote],
    )

    await client.query('commit')

    await auditAdminAction({
      adminUserId: req.user.sub,
      action: 'job_reassign',
      targetType: 'job',
      targetId: job.id,
      meta: { artisan_id: artisan.id, artisan_user_id: artisan.user_id, accepted_quote: acceptedQuote },
      ip: req.ip,
      userAgent: req.get('user-agent'),
    }).catch(() => {})

    // Notify artisan/buyer (best-effort)
    if (artisan.user_id) {
      notify({
        userId: artisan.user_id,
        type: 'job_assigned',
        title: 'Job assigned',
        body: 'A job was assigned to you. Open it to continue.',
        meta: { url: `/artisan/jobs/${job.id}`, job_id: job.id },
        dedupeKey: `job:${job.id}:assigned:${artisan.user_id}`,
      }).catch(() => {})
    }
    if (job.buyer_id) {
      notify({
        userId: job.buyer_id,
        type: 'job_reassigned',
        title: 'Provider updated',
        body: 'Support updated your assigned provider. Open the job to continue.',
        meta: { url: `/buyer/jobs/${job.id}`, job_id: job.id },
        dedupeKey: `job:${job.id}:reassigned:${Date.now()}`,
      }).catch(() => {})
    }

    return res.json(updated.rows[0])
  } catch (e) {
    try {
      await client.query('rollback')
    } catch {}
    throw e
  } finally {
    client.release()
  }
}))

const EscrowActionSchema = z.object({
  note: z.string().max(1000).optional().nullable(),
})

adminRouter.post('/escrows/:id/release', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
  const parsed = EscrowActionSchema.safeParse(req.body ?? {})
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const client = await pool.connect()
  try {
    await client.query('begin')
    const eRes = await client.query('select * from escrow_transactions where id = $1 for update', [req.params.id])
    const escrow = eRes.rows[0]
    if (!escrow) {
      await client.query('rollback')
      return res.status(404).json({ message: 'Escrow not found' })
    }
    if (String(escrow.status) === 'released') {
      await client.query('commit')
      return res.json(escrow)
    }
    if (!['held', 'completed_pending_confirmation'].includes(String(escrow.status))) {
      await client.query('rollback')
      return res.status(400).json({ message: `Cannot release escrow in status '${escrow.status}'` })
    }
    const disputeRes = await client.query(
      `select 1 from disputes where escrow_id=$1 and status in ('open','under_review') limit 1`,
      [escrow.id],
    )
    if (disputeRes.rowCount > 0) {
      await client.query('rollback')
      return res.status(409).json({ message: 'Escrow has an active dispute; cannot release.' })
    }
    if (!escrow.counterparty_user_id) {
      await client.query('rollback')
      return res.status(400).json({ message: 'No counterparty set for this escrow.' })
    }

    const isOrder = escrow.type === 'order'
    const isJob = escrow.type === 'job'
    const isDelivery = isOrder && escrow.meta?.kind === 'delivery'
    const pct = isJob ? env.PLATFORM_FEE_PCT_JOB : isDelivery ? env.PLATFORM_FEE_PCT_DELIVERY : env.PLATFORM_FEE_PCT_ORDER
    const feePct = Math.min(Math.max(pct ?? 0, 0), 0.25)
    const platformFee = Number(escrow.amount ?? 0) * feePct
    const payout = Number(escrow.amount ?? 0) - platformFee

    if (payout > 0) {
      await creditWalletTx(client, {
        userId: escrow.counterparty_user_id,
        amount: payout,
        currency: escrow.currency ?? 'GHS',
        kind: 'escrow_release',
        refType: 'escrow',
        refId: escrow.id,
        idempotencyKey: `escrow_release:${escrow.id}`,
        meta: {
          type: String(escrow.type),
          job_id: escrow.job_id ?? null,
          order_id: escrow.order_id ?? null,
          platform_fee: platformFee,
          gross_amount: Number(escrow.amount ?? 0),
          by_admin: req.user.sub,
        },
      })
    }

    const updated = await client.query(
      `update escrow_transactions
       set status='released', platform_fee=$2, updated_at=now()
       where id=$1
       returning *`,
      [escrow.id, platformFee],
    )
    await client.query('commit')

    await auditAdminAction({
      adminUserId: req.user.sub,
      action: 'manual_escrow_release',
      targetType: 'escrow',
      targetId: escrow.id,
      meta: { note: parsed.data.note ?? null, platform_fee: platformFee, payout },
      ip: req.ip,
      userAgent: req.get('user-agent'),
    }).catch(() => {})

    return res.json(updated.rows[0])
  } catch (e) {
    try {
      await client.query('rollback')
    } catch {}
    throw e
  } finally {
    client.release()
  }
}))

adminRouter.post('/escrows/:id/refund', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
  const parsed = EscrowActionSchema.safeParse(req.body ?? {})
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const client = await pool.connect()
  try {
    await client.query('begin')
    const eRes = await client.query('select * from escrow_transactions where id = $1 for update', [req.params.id])
    const escrow = eRes.rows[0]
    if (!escrow) {
      await client.query('rollback')
      return res.status(404).json({ message: 'Escrow not found' })
    }
    if (String(escrow.status) === 'refunded') {
      await client.query('commit')
      return res.json(escrow)
    }
    if (!['held', 'pending_payment', 'created', 'failed'].includes(String(escrow.status))) {
      await client.query('rollback')
      return res.status(400).json({ message: `Cannot refund escrow in status '${escrow.status}'` })
    }
    const disputeRes = await client.query(
      `select 1 from disputes where escrow_id=$1 and status in ('open','under_review') limit 1`,
      [escrow.id],
    )
    if (disputeRes.rowCount > 0) {
      await client.query('rollback')
      return res.status(409).json({ message: 'Escrow has an active dispute; cannot refund.' })
    }

    const wasHeld = String(escrow.status) === 'held'
    const refundAmount = Number(escrow.amount ?? 0)
    if (wasHeld && refundAmount > 0) {
      if (!escrow.buyer_id) {
        await client.query('rollback')
        return res.status(400).json({ message: 'Escrow buyer_id missing; cannot refund-to-wallet safely.' })
      }
      await creditWalletTx(client, {
        userId: escrow.buyer_id,
        amount: refundAmount,
        currency: escrow.currency ?? 'GHS',
        kind: 'escrow_refund',
        refType: 'escrow',
        refId: escrow.id,
        idempotencyKey: `escrow_refund:${escrow.id}`,
        meta: { type: String(escrow.type), job_id: escrow.job_id ?? null, order_id: escrow.order_id ?? null, by_admin: req.user.sub },
      })
    }

    const updated = await client.query(
      `update escrow_transactions
       set status='refunded',
           updated_at=now(),
           meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object(
             'admin_refund',
             jsonb_build_object(
               'note',$2,
               'refunded_to_wallet',$3,
               'refund_amount',$4,
               'currency',$5,
               'refunded_by',$6,
               'refunded_at', now()
             )
           )
       where id=$1
       returning *`,
      [escrow.id, parsed.data.note ?? null, wasHeld ? true : false, refundAmount, escrow.currency ?? 'GHS', req.user.sub],
    )
    await client.query('commit')

    await auditAdminAction({
      adminUserId: req.user.sub,
      action: 'manual_escrow_refund',
      targetType: 'escrow',
      targetId: escrow.id,
      meta: { note: parsed.data.note ?? null },
      ip: req.ip,
      userAgent: req.get('user-agent'),
    }).catch(() => {})

    return res.json(updated.rows[0])
  } catch (e) {
    try {
      await client.query('rollback')
    } catch {}
    throw e
  } finally {
    client.release()
  }
}))

const NoShowSchema = z.object({
  user_id: z.string().uuid(),
  context_type: z.enum(['job', 'order', 'delivery']).optional().nullable(),
  context_id: z.string().uuid().optional().nullable(),
  note: z.string().max(1000).optional().nullable(),
})

async function applyNoShowEnforcement({ adminUserId, userId, contextType, contextId, note, ip, userAgent }) {
  const ev = await recordPolicyEvent({
    userId,
    kind: 'no_show',
    contextType: contextType ?? null,
    contextId: contextId ?? null,
    meta: { note: note ?? null, by_admin: adminUserId },
  })

  // Soft enforcement: 1st = warning, 2nd = strong warning, 3rd = 7-day freeze (rolling 30 days).
  const c = await pool.query(
    `select count(*)::int as n
     from policy_events
     where user_id = $1 and kind='no_show' and created_at > now() - interval '30 days'`,
    [userId],
  )
  const n = Number(c.rows[0]?.n ?? 0)

  if (n >= 3) {
    const until = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()
    await pool.query(
      `update users
       set suspended_until=$2, suspended_reason=coalesce(suspended_reason,'Repeated no-shows'), suspended_by_admin_id=$3, updated_at=now()
       where id=$1`,
      [userId, until, adminUserId],
    )
    notify({
      userId,
      type: 'account_suspended',
      title: 'Temporary freeze (no-shows)',
      body: 'Your account is temporarily frozen due to repeated no-shows. Improve reliability to restore trust.',
      meta: { url: '/support', suspended_until: until },
      dedupeKey: `user:${userId}:freeze:no_show:${until}`,
    }).catch(() => {})
  } else {
    notify({
      userId,
      type: 'trust_warning',
      title: 'Reliability warning',
      body: 'No-shows reduce your trust and ranking. Repeat issues may lead to a temporary freeze.',
      meta: { url: '/profile' },
      dedupeKey: `user:${userId}:no_show:${ev?.id ?? Date.now()}`,
    }).catch(() => {})
  }

  await auditAdminAction({
    adminUserId,
    action: 'policy_no_show',
    targetType: 'user',
    targetId: userId,
    meta: { context_type: contextType ?? null, context_id: contextId ?? null, note: note ?? null, count_30d: n },
    ip,
    userAgent,
  }).catch(() => {})

  return { event: ev, count_30d: n }
}

adminRouter.post('/policy/no-show', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
  const parsed = NoShowSchema.safeParse(req.body ?? {})
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const r = await applyNoShowEnforcement({
    adminUserId: req.user.sub,
    userId: parsed.data.user_id,
    contextType: parsed.data.context_type ?? null,
    contextId: parsed.data.context_id ?? null,
    note: parsed.data.note ?? null,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  })

  return res.status(201).json({ ok: true, ...r })
}))

const ConfirmNoShowFromTicketSchema = z.object({
  note: z.string().max(1000).optional().nullable(),
})

adminRouter.post('/support/tickets/:id/confirm-no-show', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
  const parsed = ConfirmNoShowFromTicketSchema.safeParse(req.body ?? {})
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const t = await pool.query('select * from support_tickets where id = $1', [req.params.id])
  const ticket = t.rows[0]
  if (!ticket) return res.status(404).json({ message: 'Ticket not found' })

  const relType = String(ticket.related_type || '')
  const relId = String(ticket.related_id || '')
  if (relType !== 'job' || !relId) return res.status(400).json({ message: 'Ticket is not linked to a job.' })

  const jobRes = await pool.query('select id, assigned_artisan_id from jobs where id = $1', [relId])
  const job = jobRes.rows[0]
  if (!job) return res.status(404).json({ message: 'Job not found for this ticket.' })
  if (!job.assigned_artisan_id) return res.status(400).json({ message: 'Job has no assigned artisan.' })

  const artisanRes = await pool.query('select user_id from artisans where id = $1', [job.assigned_artisan_id])
  const artisanUserId = artisanRes.rows[0]?.user_id
  if (!artisanUserId) return res.status(400).json({ message: 'Artisan user not found.' })

  const note = parsed.data.note ?? `Confirmed from support ticket ${ticket.id}`
  const r = await applyNoShowEnforcement({
    adminUserId: req.user.sub,
    userId: artisanUserId,
    contextType: 'job',
    contextId: job.id,
    note,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  })

  // Add an internal timeline note on the support ticket so ops can see what happened.
  await pool.query(
    `insert into support_ticket_events (ticket_id, author_user_id, visibility, body, attachments)
     values ($1,$2,'internal',$3,null)`,
    [ticket.id, req.user.sub, `No-show confirmed (strike applied). Count (30d): ${r.count_30d}. Policy event: ${r.event?.id ?? '—'}`],
  )
  await pool.query(`update support_tickets set last_activity_at=now(), updated_at=now() where id=$1`, [ticket.id])

  return res.status(201).json({ ok: true, ...r, artisan_user_id: artisanUserId })
}))


