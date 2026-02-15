import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { optionalAuth, requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { notify } from '../services/notifications.js'

export const followsRouter = Router()

const IdParam = z.string().uuid()
const RoleParam = z.enum(['buyer', 'artisan', 'farmer', 'driver', 'company', 'admin'])
const FollowStatus = z.enum(['accepted', 'pending'])
const ListSchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((v) => (v == null ? 30 : Number(v)))
    .refine((n) => Number.isFinite(n) && n >= 1 && n <= 60, { message: 'limit must be 1..60' }),
  before: z.string().optional().nullable(), // ISO timestamp
})

followsRouter.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const userId = req.user.sub
  const [followers, following, incoming] = await Promise.all([
    pool.query("select count(*)::int as c from user_follows where following_id = $1 and status = 'accepted'", [userId]),
    pool.query("select count(*)::int as c from user_follows where follower_id = $1 and status = 'accepted'", [userId]),
    pool.query("select count(*)::int as c from user_follows where following_id = $1 and status = 'pending'", [userId]),
  ])
  return res.json({
    followers: followers.rows[0]?.c ?? 0,
    following: following.rows[0]?.c ?? 0,
    incoming_requests: incoming.rows[0]?.c ?? 0,
  })
}))

followsRouter.get('/:userId/status', requireAuth, asyncHandler(async (req, res) => {
  const parsed = IdParam.safeParse(req.params.userId)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid user id' })
  const targetId = parsed.data
  const userId = req.user.sub
  const r = await pool.query(
    'select status from user_follows where follower_id = $1 and following_id = $2',
    [userId, targetId],
  )
  const status = r.rows[0]?.status ? String(r.rows[0].status) : 'none'
  return res.json({ following: status === 'accepted', pending: status === 'pending', status })
}))

// Suggested accounts to follow (simple, activity-based).
followsRouter.get('/suggested/list', requireAuth, asyncHandler(async (req, res) => {
  const userId = req.user.sub
  const r = await pool.query(
    `select
       u.id,
       coalesce(c.name, u.name) as name,
       u.role,
       coalesce(c.logo_url, u.profile_pic) as profile_pic,
       u.last_active_at,
       c.slug as company_slug
     from users u
     left join companies c on c.owner_user_id = u.id
     where u.deleted_at is null
       and (u.suspended_until is null or u.suspended_until <= now())
       and u.role <> 'admin'
       and u.id <> $1
       and not exists (
         select 1 from user_follows f
         where f.follower_id = $1 and f.following_id = u.id
       )
     order by u.last_active_at desc nulls last, u.created_at desc
     limit 12`,
    [userId],
  )
  return res.json(r.rows)
}))

// People directory (search + filters). Auth optional.
// If not authed, viewer_following will be false and we won't exclude "self".
followsRouter.get('/people/list', optionalAuth, asyncHandler(async (req, res) => {
  const qRaw = req.query.q == null ? '' : String(req.query.q)
  const q = qRaw.trim().slice(0, 80)
  const roleRaw = req.query.role == null ? '' : String(req.query.role)
  const role = RoleParam.safeParse(roleRaw).success ? roleRaw : null
  const limitRaw = req.query.limit == null ? 30 : Number(req.query.limit)
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(60, limitRaw)) : 30

  const viewerId = req.user?.sub ?? null
  const qLike = q ? `%${q.replace(/%/g, '')}%` : null

  const r = await pool.query(
    `select
       u.id,
       coalesce(c.name, u.name) as name,
       u.role,
       coalesce(c.logo_url, u.profile_pic) as profile_pic,
       u.last_active_at,
       c.slug as company_slug,
       ($1::uuid is not null) and exists(
         select 1 from user_follows f
         where f.follower_id = $1 and f.following_id = u.id and f.status = 'accepted'
       ) as viewer_following,
       ($1::uuid is not null) and exists(
         select 1 from user_follows f
         where f.follower_id = $1 and f.following_id = u.id and f.status = 'pending'
       ) as viewer_requested,
       (select count(*)::int from user_follows f2 where f2.following_id = u.id and f2.status = 'accepted') as followers
     from users u
     left join companies c on c.owner_user_id = u.id
     where u.deleted_at is null
       and (u.suspended_until is null or u.suspended_until <= now())
       and u.role <> 'admin'
       and ($1::uuid is null or u.id <> $1)
       and ($2::user_role is null or u.role = $2::user_role)
       and (
         $3::text is null
         or u.name ilike $3::text
         or ($1::uuid is not null and u.email ilike $3::text)
       )
     order by u.last_active_at desc nulls last, u.created_at desc
     limit $4`,
    [viewerId, role, qLike, limit],
  )
  return res.json(r.rows)
}))

// Followers list for a user (public). If authed, includes viewer_following for each row.
followsRouter.get('/user/:userId/followers', optionalAuth, asyncHandler(async (req, res) => {
  const idParsed = IdParam.safeParse(req.params.userId)
  if (!idParsed.success) return res.status(400).json({ message: 'Invalid user id' })
  const parsed = ListSchema.safeParse(req.query)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const targetId = idParsed.data
  const limit = parsed.data.limit
  const before = parsed.data.before ? new Date(parsed.data.before) : null
  const beforeOk = before && !Number.isNaN(before.getTime()) ? before.toISOString() : null
  const viewerId = req.user?.sub ?? null

  const r = await pool.query(
    `select
       u.id,
       coalesce(c.name, u.name) as name,
       u.role,
       coalesce(c.logo_url, u.profile_pic) as profile_pic,
       u.last_active_at,
       c.slug as company_slug,
       f.created_at as followed_at,
       ($2::uuid is not null) and exists(
         select 1 from user_follows vf where vf.follower_id = $2 and vf.following_id = u.id and vf.status = 'accepted'
       ) as viewer_following
     from user_follows f
     join users u on u.id = f.follower_id
     left join companies c on c.owner_user_id = u.id
     where f.following_id = $1
       and f.status = 'accepted'
       and u.deleted_at is null
       and (u.suspended_until is null or u.suspended_until <= now())
       and ($3::timestamptz is null or f.created_at < $3::timestamptz)
     order by f.created_at desc
     limit $4`,
    [targetId, viewerId, beforeOk, limit + 1],
  )
  const rows = r.rows
  const items = rows.slice(0, limit)
  const nextBefore = rows.length > limit ? items[items.length - 1]?.followed_at : null
  return res.json({ items, next_before: nextBefore })
}))

// Following list for a user (public). If authed, includes viewer_following for each row.
followsRouter.get('/user/:userId/following', optionalAuth, asyncHandler(async (req, res) => {
  const idParsed = IdParam.safeParse(req.params.userId)
  if (!idParsed.success) return res.status(400).json({ message: 'Invalid user id' })
  const parsed = ListSchema.safeParse(req.query)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const targetId = idParsed.data
  const limit = parsed.data.limit
  const before = parsed.data.before ? new Date(parsed.data.before) : null
  const beforeOk = before && !Number.isNaN(before.getTime()) ? before.toISOString() : null
  const viewerId = req.user?.sub ?? null

  const r = await pool.query(
    `select
       u.id,
       coalesce(c.name, u.name) as name,
       u.role,
       coalesce(c.logo_url, u.profile_pic) as profile_pic,
       u.last_active_at,
       c.slug as company_slug,
       f.created_at as followed_at,
       ($2::uuid is not null) and exists(
         select 1 from user_follows vf where vf.follower_id = $2 and vf.following_id = u.id and vf.status = 'accepted'
       ) as viewer_following
     from user_follows f
     join users u on u.id = f.following_id
     left join companies c on c.owner_user_id = u.id
     where f.follower_id = $1
       and f.status = 'accepted'
       and u.deleted_at is null
       and (u.suspended_until is null or u.suspended_until <= now())
       and ($3::timestamptz is null or f.created_at < $3::timestamptz)
     order by f.created_at desc
     limit $4`,
    [targetId, viewerId, beforeOk, limit + 1],
  )
  const rows = r.rows
  const items = rows.slice(0, limit)
  const nextBefore = rows.length > limit ? items[items.length - 1]?.followed_at : null
  return res.json({ items, next_before: nextBefore })
}))

// Public counts for a user + viewer relationship (viewer_following requires auth).
followsRouter.get('/:userId', optionalAuth, asyncHandler(async (req, res) => {
  const parsed = IdParam.safeParse(req.params.userId)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid user id' })
  const targetId = parsed.data
  const [followers, following] = await Promise.all([
    pool.query("select count(*)::int as c from user_follows where following_id = $1 and status = 'accepted'", [targetId]),
    pool.query("select count(*)::int as c from user_follows where follower_id = $1 and status = 'accepted'", [targetId]),
  ])
  let viewerFollowing = false
  let viewerRequested = false
  if (req.user?.sub) {
    const r = await pool.query('select status from user_follows where follower_id = $1 and following_id = $2', [req.user.sub, targetId])
    const st = r.rows[0]?.status ? String(r.rows[0].status) : null
    viewerFollowing = st === 'accepted'
    viewerRequested = st === 'pending'
  }
  return res.json({
    followers: followers.rows[0]?.c ?? 0,
    following: following.rows[0]?.c ?? 0,
    viewer_following: viewerFollowing,
    viewer_requested: viewerRequested,
  })
}))

// Incoming follow requests for the current user.
followsRouter.get('/requests/incoming', requireAuth, asyncHandler(async (req, res) => {
  const userId = req.user.sub
  const r = await pool.query(
    `select
       u.id, u.name, u.role, u.profile_pic, u.last_active_at,
       f.requested_at
     from user_follows f
     join users u on u.id = f.follower_id
     where f.following_id = $1
       and f.status = 'pending'
       and u.deleted_at is null
       and (u.suspended_until is null or u.suspended_until <= now())
     order by f.requested_at desc nulls last, f.created_at desc
     limit 60`,
    [userId],
  )
  return res.json(r.rows)
}))

followsRouter.post('/requests/:followerId/accept', requireAuth, asyncHandler(async (req, res) => {
  const parsed = IdParam.safeParse(req.params.followerId)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid follower id' })
  const followerId = parsed.data
  const userId = req.user.sub

  const r = await pool.query(
    `update user_follows
     set status = 'accepted',
         accepted_at = now()
     where follower_id = $1 and following_id = $2 and status = 'pending'
     returning follower_id, following_id`,
    [followerId, userId],
  )
  if (r.rowCount === 0) return res.status(404).json({ message: 'Request not found' })

  // Notify follower that their request was accepted (best-effort).
  pool
    .query(
      `select coalesce(c.name, u.name) as name from users u
       left join companies c on c.owner_user_id = u.id
       where u.id = $1`,
      [userId],
    )
    .then((rr) => {
      const name = rr.rows[0]?.name ? String(rr.rows[0].name) : 'Someone'
      const url = `/u/${userId}`
      return notify({
        userId: followerId,
        type: 'follow_accepted',
        title: 'Follow request accepted',
        body: `${name} accepted your follow request.`,
        meta: { url },
        dedupeKey: `follow_accepted:${userId}:${followerId}`,
      })
    })
    .catch(() => {})

  return res.json({ ok: true })
}))

followsRouter.delete('/requests/:followerId', requireAuth, asyncHandler(async (req, res) => {
  const parsed = IdParam.safeParse(req.params.followerId)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid follower id' })
  const followerId = parsed.data
  const userId = req.user.sub
  const r = await pool.query(
    "delete from user_follows where follower_id = $1 and following_id = $2 and status = 'pending'",
    [followerId, userId],
  )
  if (r.rowCount === 0) return res.status(404).json({ message: 'Request not found' })
  return res.json({ ok: true })
}))

followsRouter.post('/:userId', requireAuth, asyncHandler(async (req, res) => {
  const parsed = IdParam.safeParse(req.params.userId)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid user id' })
  const targetId = parsed.data
  const userId = req.user.sub
  if (String(targetId) === String(userId)) return res.status(400).json({ message: 'You can’t follow yourself.' })

  // Ensure target exists & not deleted
  const uRes = await pool.query('select 1 from users where id = $1 and deleted_at is null', [targetId])
  if (uRes.rowCount === 0) return res.status(404).json({ message: 'User not found' })

  const profRes = await pool.query('select private_profile from user_profiles where user_id = $1', [targetId]).catch(() => ({ rows: [] }))
  const isPrivate = Boolean(profRes.rows?.[0]?.private_profile)
  const status = isPrivate ? 'pending' : 'accepted'

  await pool.query(
    `insert into user_follows (follower_id, following_id, status, requested_at, accepted_at)
     values ($1,$2,$3, now(), case when $3 = 'accepted' then now() else null end)
     on conflict do nothing`,
    [userId, targetId, status],
  )

  // Notify the followed user (deduped). Use /c/:slug for companies.
  pool
    .query(
      `select coalesce(c.name, u.name) as name, c.slug as company_slug from users u
       left join companies c on c.owner_user_id = u.id
       where u.id = $1`,
      [userId],
    )
    .then((r) => {
      const row = r.rows[0]
      const followerName = row?.name ? String(row.name) : 'Someone'
      const slug = row?.company_slug ? String(row.company_slug).trim() : ''
      const url = slug ? `/c/${encodeURIComponent(slug)}` : `/u/${userId}`
      return notify({
        userId: targetId,
        type: status === 'pending' ? 'follow_request' : 'follow',
        title: status === 'pending' ? 'Follow request' : 'New follower',
        body: status === 'pending' ? `${followerName} requested to follow you.` : `${followerName} started following you.`,
        meta: { url },
        dedupeKey: `${status === 'pending' ? 'follow_request' : 'follow'}:${userId}`,
      })
    })
    .catch(() => {})

  return res.json({ ok: true, following: status === 'accepted', pending: status === 'pending', status })
}))

followsRouter.delete('/:userId', requireAuth, asyncHandler(async (req, res) => {
  const parsed = IdParam.safeParse(req.params.userId)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid user id' })
  const targetId = parsed.data
  const userId = req.user.sub
  await pool.query('delete from user_follows where follower_id = $1 and following_id = $2', [userId, targetId])
  return res.json({ ok: true, following: false })
}))

