import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { saveSubscription, removeSubscription } from '../services/push.js'

export const notificationsRouter = Router()

const ListSchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((v) => (v == null ? 50 : Number(v)))
    .refine((n) => Number.isFinite(n) && n >= 1 && n <= 100, { message: 'limit must be 1..100' }),
  before: z.string().optional().nullable(), // ISO date string
})

// List notifications for current user (most recent first) + unread count.
notificationsRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = ListSchema.safeParse(req.query)
    if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

    const userId = req.user.sub
    const limit = parsed.data.limit
    const before = parsed.data.before ? new Date(parsed.data.before) : null
    const beforeOk = before && !Number.isNaN(before.getTime()) ? before.toISOString() : null

    const itemsRes = await pool.query(
      `
      select *
      from notifications
      where user_id = $1
        and ($2::timestamptz is null or created_at < $2::timestamptz)
      order by created_at desc
      limit $3
      `,
      [userId, beforeOk, limit],
    )

    const unreadRes = await pool.query(`select count(*)::int as unread_count from notifications where user_id = $1 and read_at is null`, [userId])
    return res.json({ items: itemsRes.rows, unreadCount: unreadRes.rows[0]?.unread_count ?? 0 })
  }),
)

notificationsRouter.post(
  '/:id/read',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user.sub
    const r = await pool.query(
      `update notifications
       set read_at = coalesce(read_at, now())
       where id = $1 and user_id = $2
       returning *`,
      [req.params.id, userId],
    )
    if (r.rowCount === 0) return res.status(404).json({ message: 'Notification not found' })
    return res.json(r.rows[0])
  }),
)

notificationsRouter.post(
  '/read_all',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user.sub
    const r = await pool.query(`update notifications set read_at = now() where user_id = $1 and read_at is null`, [userId])
    return res.json({ ok: true, updated: r.rowCount })
  }),
)

// VAPID public key for browser PushManager.subscribe()
notificationsRouter.get('/vapid-public-key', (req, res) => {
  const key = process.env.VAPID_PUBLIC_KEY?.trim()
  if (!key) return res.status(503).json({ message: 'Push notifications not configured' })
  return res.json({ publicKey: key })
})

const PushSubscribeSchema = z.object({
  subscription: z.object({
    endpoint: z.string(),
    keys: z.object({ p256dh: z.string(), auth: z.string() }),
  }),
})

notificationsRouter.post(
  '/push-subscribe',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = PushSubscribeSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ message: 'Invalid subscription', issues: parsed.error.issues })
    await saveSubscription(req.user.sub, parsed.data.subscription)
    return res.json({ ok: true })
  }),
)

notificationsRouter.delete(
  '/push-subscribe',
  requireAuth,
  asyncHandler(async (req, res) => {
    const endpoint = req.body?.endpoint ?? req.query?.endpoint
    if (!endpoint || typeof endpoint !== 'string') return res.status(400).json({ message: 'endpoint required' })
    await removeSubscription(req.user.sub, endpoint)
    return res.json({ ok: true })
  }),
)


