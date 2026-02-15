import { Router } from 'express'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { pool } from '../db/pool.js'
import { optionalAuth, requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { notify } from '../services/notifications.js'
import { env } from '../config.js'

export const postsRouter = Router()

function countUrls(s) {
  const text = String(s || '')
  const m = text.match(/https?:\/\/\S+/gi)
  return Array.isArray(m) ? m.length : 0
}

function normalizeLower(s) {
  return String(s ?? '').toLowerCase().trim()
}

async function loadModerationKeywordFilters() {
  try {
    const r = await pool.query(
      `select id, keyword, action
       from moderation_keyword_filters
       where enabled is true
       order by updated_at desc
       limit 200`,
    )
    return (Array.isArray(r.rows) ? r.rows : [])
      .map((x) => ({
        id: x.id,
        keyword: String(x.keyword || '').trim(),
        keyword_lc: normalizeLower(x.keyword),
        action: String(x.action || 'block'),
      }))
      .filter((x) => x.id && x.keyword_lc)
  } catch (e) {
    // Graceful fallback if migrations not applied yet.
    if (String(e?.code || '') === '42P01') return []
    throw e
  }
}

function moderationMatches(text, rules) {
  const lc = normalizeLower(text)
  if (!lc) return []
  const out = []
  for (const r of Array.isArray(rules) ? rules : []) {
    if (!r?.keyword_lc) continue
    if (lc.includes(r.keyword_lc)) out.push(r)
  }
  return out
}

async function ensureCommentModerationTicket({ commentId, postId } = {}) {
  if (!commentId) return null
  try {
    const existing = await pool.query(
      `select id
       from support_tickets
       where related_type = 'post_comment'
         and related_id = $1
         and status in ('open','pending_admin')
       order by last_activity_at desc
       limit 1`,
      [commentId],
    )
    if (existing.rows[0]?.id) return existing.rows[0].id

    const subject = `Comment moderation ${String(commentId).slice(0, 8)}`
    const description = `Moderation ticket for comment ${commentId}\nPost: ${postId ?? ''}\n`
    const tagsJson = JSON.stringify({ kind: 'comment_moderation', comment_id: commentId, post_id: postId ?? null })

    const tRes = await pool.query(
      `insert into support_tickets (requester_user_id, created_by_user_id, category, subject, description, related_type, related_id, status, priority, last_activity_at, tags)
       values (null, null, 'fraud', $2, $3, 'post_comment', $1, 'open', 'normal', now(), $4::jsonb)
       returning id`,
      [commentId, subject, description, tagsJson],
    )
    return tRes.rows[0]?.id ?? null
  } catch (e) {
    if (String(e?.code || '') === '42P01') return null
    throw e
  }
}

const commentCreateRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many comments/replies. Please slow down.' },
  keyGenerator: (req) => String(req.user?.sub || req.ip || 'unknown'),
  skip: () => env.NODE_ENV !== 'production',
})

const commentLikeRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 240,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many likes. Please slow down.' },
  keyGenerator: (req) => String(req.user?.sub || req.ip || 'unknown'),
  skip: () => env.NODE_ENV !== 'production',
})

const commentReportRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many reports. Please try again later.' },
  keyGenerator: (req) => String(req.user?.sub || req.ip || 'unknown'),
  skip: () => env.NODE_ENV !== 'production',
})

const commentEditRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many edits. Please slow down.' },
  keyGenerator: (req) => String(req.user?.sub || req.ip || 'unknown'),
  skip: () => env.NODE_ENV !== 'production',
})

const commentDeleteRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many deletes. Please slow down.' },
  keyGenerator: (req) => String(req.user?.sub || req.ip || 'unknown'),
  skip: () => env.NODE_ENV !== 'production',
})

const MediaSchema = z.object({
  url: z.string().min(1),
  kind: z.enum(['image', 'video']).optional(),
  mime: z.string().optional(),
  size: z.number().optional(),
})

const CreatePostSchema = z.object({
  body: z.string().max(5000).optional().nullable(),
  media: z.array(MediaSchema).optional().nullable(),
})

postsRouter.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const userId = req.user.sub
  const r = await pool.query(
    `
    select
      p.*,
      coalesce(c.name, u.name) as author_name,
      coalesce(c.logo_url, u.profile_pic) as author_profile_pic,
      u.role as author_role,
      c.slug as author_company_slug,
      (
        select count(*)::int from user_post_likes l where l.post_id = p.id
      ) as like_count,
      (
        select count(*)::int from user_post_comments c where c.post_id = p.id and c.deleted_at is null
      ) as comment_count,
      exists(
        select 1 from user_post_likes l where l.post_id = p.id and l.user_id = $1
      ) as viewer_liked
    from user_posts p
    join users u on u.id = p.user_id
      and u.deleted_at is null
      and (u.suspended_until is null or u.suspended_until <= now())
    left join companies c on c.owner_user_id = u.id
    where p.user_id = $1
    order by p.created_at desc
    limit 100
    `,
    [userId],
  )
  return res.json(r.rows)
}))

// Home feed for the authenticated user: posts from people you follow + your own posts.
postsRouter.get('/feed', requireAuth, asyncHandler(async (req, res) => {
  const userId = req.user.sub
  const r = await pool.query(
    `
    select
      p.*,
      coalesce(c.name, u.name) as author_name,
      coalesce(c.logo_url, u.profile_pic) as author_profile_pic,
      u.role as author_role,
      c.slug as author_company_slug,
      (
        select count(*)::int from user_post_likes l where l.post_id = p.id
      ) as like_count,
      (
        select count(*)::int from user_post_comments c where c.post_id = p.id and c.deleted_at is null
      ) as comment_count,
      exists(
        select 1 from user_post_likes l where l.post_id = p.id and l.user_id = $1
      ) as viewer_liked
    from user_posts p
    join users u on u.id = p.user_id
      and u.deleted_at is null
      and (u.suspended_until is null or u.suspended_until <= now())
    left join companies c on c.owner_user_id = u.id
    where
      p.user_id = $1
      or p.user_id in (select following_id from user_follows where follower_id = $1 and status = 'accepted')
    order by p.created_at desc
    limit 100
    `,
    [userId],
  )
  return res.json(r.rows)
}))

// Public posts for a given user (read-only). If authenticated, includes viewer_liked.
postsRouter.get('/user/:userId', optionalAuth, asyncHandler(async (req, res) => {
  const viewerId = req.user?.sub ?? null
  const targetUserId = req.params.userId

  const metaRes = await pool
    .query(
      `select u.role as role, up.private_profile as private_profile
       from users u
       left join user_profiles up on up.user_id = u.id
       where u.id = $1
       limit 1`,
      [targetUserId],
    )
    .catch(() => ({ rows: [] }))
  const targetRole = metaRes.rows?.[0]?.role ? String(metaRes.rows[0].role) : null
  const isCompany = targetRole === 'company'
  const isPrivate = !isCompany && Boolean(metaRes.rows?.[0]?.private_profile)
  const isAdmin = req.user?.role === 'admin'
  const isOwner = viewerId && String(viewerId) === String(targetUserId)
  if (isPrivate && !isAdmin && !isOwner) {
    if (!viewerId) return res.status(403).json({ message: 'Login required', code: 'LOGIN_REQUIRED' })
    const fr = await pool.query('select status from user_follows where follower_id = $1 and following_id = $2', [viewerId, targetUserId])
    const st = fr.rows[0]?.status ? String(fr.rows[0].status) : 'none'
    if (st !== 'accepted') return res.status(403).json({ message: 'Follow approval required', code: 'FOLLOW_APPROVAL_REQUIRED', follow_status: st })
  }

  const r = await pool.query(
    `
    select
      p.*,
      coalesce(c.name, u.name) as author_name,
      coalesce(c.logo_url, u.profile_pic) as author_profile_pic,
      u.role as author_role,
      c.slug as author_company_slug,
      (
        select count(*)::int from user_post_likes l where l.post_id = p.id
      ) as like_count,
      (
        select count(*)::int from user_post_comments c where c.post_id = p.id and c.deleted_at is null
      ) as comment_count,
      exists(
        select 1 from user_post_likes l where l.post_id = p.id and l.user_id = $1
      ) as viewer_liked
    from user_posts p
    join users u on u.id = p.user_id
      and u.deleted_at is null
      and (u.suspended_until is null or u.suspended_until <= now())
    left join companies c on c.owner_user_id = u.id
    where p.user_id = $2
    order by p.created_at desc
    limit 100
    `,
    [viewerId, targetUserId],
  )
  return res.json(r.rows)
}))

postsRouter.post('/', requireAuth, asyncHandler(async (req, res) => {
  const parsed = CreatePostSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const body = (parsed.data.body ?? '').trim()
  const media = parsed.data.media ?? null
  if (!body && (!Array.isArray(media) || media.length === 0)) {
    return res.status(400).json({ message: 'Post must have text or media' })
  }

  const mediaJson = media == null ? null : JSON.stringify(media)
  const r = await pool.query(
    `insert into user_posts (user_id, body, media)
     values ($1,$2,$3::jsonb)
     returning *`,
    [req.user.sub, body || null, mediaJson],
  )
  return res.status(201).json(r.rows[0])
}))

postsRouter.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query('begin')
    const pRes = await client.query('select * from user_posts where id = $1 for update', [req.params.id])
    const post = pRes.rows[0]
    if (!post) {
      await client.query('rollback')
      return res.status(404).json({ message: 'Post not found' })
    }
    const isAdmin = req.user.role === 'admin'
    const isOwner = post.user_id === req.user.sub
    if (!isAdmin && !isOwner) {
      await client.query('rollback')
      return res.status(403).json({ message: 'Forbidden' })
    }

    await client.query('delete from user_posts where id = $1', [post.id])
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

// List users who liked a post (for display in UI; public read).
postsRouter.get('/:id/likes', optionalAuth, asyncHandler(async (req, res) => {
  const postId = req.params.id
  const r = await pool.query(
    `select
       u.id,
       coalesce(c.name, u.name) as name,
       u.role as role,
       c.slug as company_slug,
       coalesce(c.logo_url, u.profile_pic) as profile_pic
     from user_post_likes l
     join users u on u.id = l.user_id and u.deleted_at is null
     left join companies c on c.owner_user_id = u.id
     where l.post_id = $1
     order by l.created_at desc
     limit 100`,
    [postId],
  )
  return res.json(r.rows)
}))

postsRouter.post('/:id/like', requireAuth, asyncHandler(async (req, res) => {
  await pool.query(
    `insert into user_post_likes (post_id, user_id)
     values ($1,$2)
     on conflict do nothing`,
    [req.params.id, req.user.sub],
  )
  return res.json({ ok: true, liked: true })
}))

postsRouter.delete('/:id/like', requireAuth, asyncHandler(async (req, res) => {
  await pool.query('delete from user_post_likes where post_id = $1 and user_id = $2', [req.params.id, req.user.sub])
  return res.json({ ok: true, liked: false })
}))

const CommentSchema = z.object({
  body: z
    .string()
    .min(1)
    .max(2000)
    .refine((s) => countUrls(s) <= 3, { message: 'Too many links in comment (max 3)' }),
  parent_id: z.string().uuid().optional().nullable(),
})

const ListCommentsSchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((v) => (v == null ? 100 : Number(v)))
    .refine((n) => Number.isFinite(n) && n >= 1 && n <= 200, { message: 'limit must be 1..200' }),
  offset: z
    .string()
    .optional()
    .transform((v) => (v == null ? 0 : Number(v)))
    .refine((n) => Number.isFinite(n) && n >= 0 && n <= 50_000, { message: 'offset must be 0..50000' }),
})

const CommentUpdateSchema = z.object({
  body: z
    .string()
    .min(1)
    .max(2000)
    .refine((s) => countUrls(s) <= 3, { message: 'Too many links in comment (max 3)' }),
})

const CommentReportSchema = z.object({
  reason: z.string().min(3).max(200),
  details: z.string().max(2000).optional().nullable(),
})

// Public comments list (read-only).
// Pagination: limit/offset apply to ROOT comments (parent_id is null). Response includes the full subtree for those roots.
postsRouter.get('/:id/comments', optionalAuth, asyncHandler(async (req, res) => {
  const viewerId = req.user?.sub ?? null
  const parsed = ListCommentsSchema.safeParse(req.query)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })
  const rootsLimit = parsed.data.limit
  const rootsOffset = parsed.data.offset

  // Back-compat: if caller didn't ask for pagination, return the first 500 comments (flat list) as an array.
  const askedForPaging = req.query.limit != null || req.query.offset != null
  if (!askedForPaging) {
    const r = await pool.query(
      `select
              c.id,
              c.post_id,
              c.user_id,
              c.parent_id,
              c.created_at,
              c.updated_at,
              c.deleted_at,
              (c.deleted_at is not null) as is_deleted,
              case when c.deleted_at is not null then null else c.body end as body,
              case when c.deleted_at is not null then null else u.name end as author_name,
              case when c.deleted_at is not null then null else u.profile_pic end as author_profile_pic,
              (
                select count(*)::int from user_post_comment_likes l where l.comment_id = c.id
              ) as like_count,
              case when c.deleted_at is not null then false else exists(
                select 1 from user_post_comment_likes l where l.comment_id = c.id and l.user_id = $2
              ) end as viewer_liked,
              (
                select count(*)::int from user_post_comments r where r.parent_id = c.id and r.deleted_at is null
              ) as reply_count
       from user_post_comments c
       left join users u on u.id = c.user_id
       where c.post_id = $1
       order by c.created_at asc
       limit 500`,
      [req.params.id, viewerId],
    )
    return res.json(r.rows)
  }

  const rootsRes = await pool.query(
    `select id
     from user_post_comments
     where post_id = $1
       and parent_id is null
     order by created_at asc
     limit $2
     offset $3`,
    [req.params.id, rootsLimit, rootsOffset],
  )
  const rootIds = rootsRes.rows.map((x) => x.id).filter(Boolean)
  if (rootIds.length === 0) {
    return res.json({ items: [], hasMore: false, nextOffset: rootsOffset, rootsReturned: 0 })
  }

  const moreRes = await pool.query(
    `select 1
     from user_post_comments
     where post_id = $1
       and parent_id is null
     offset $2
     limit 1`,
    [req.params.id, rootsOffset + rootIds.length],
  )
  const hasMore = moreRes.rowCount > 0

  const r = await pool.query(
    `with recursive tree as (
       select c.*
       from user_post_comments c
       where c.post_id = $1
         and c.id = any($3::uuid[])
       union all
       select c.*
       from user_post_comments c
       join tree t on t.id = c.parent_id
       where c.post_id = $1
     )
     select
       c.id,
       c.post_id,
       c.user_id,
       c.parent_id,
       c.created_at,
       c.updated_at,
       c.deleted_at,
       (c.deleted_at is not null) as is_deleted,
       case when c.deleted_at is not null then null else c.body end as body,
       case when c.deleted_at is not null then null else u.name end as author_name,
       case when c.deleted_at is not null then null else u.profile_pic end as author_profile_pic,
       (
         select count(*)::int from user_post_comment_likes l where l.comment_id = c.id
       ) as like_count,
       case when c.deleted_at is not null then false else exists(
         select 1 from user_post_comment_likes l where l.comment_id = c.id and l.user_id = $2
       ) end as viewer_liked,
       (
         select count(*)::int from user_post_comments r where r.parent_id = c.id and r.deleted_at is null
       ) as reply_count
     from tree c
     left join users u on u.id = c.user_id
     order by c.created_at asc
     limit 2000`,
    [req.params.id, viewerId, rootIds],
  )

  return res.json({ items: r.rows, hasMore, nextOffset: rootsOffset + rootIds.length, rootsReturned: rootIds.length })
}))

postsRouter.post('/:id/comments', requireAuth, commentCreateRateLimit, asyncHandler(async (req, res) => {
  const parsed = CommentSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const postRes = await pool.query('select 1 from user_posts where id = $1', [req.params.id])
  if (postRes.rowCount === 0) return res.status(404).json({ message: 'Post not found' })

  const parentId = parsed.data.parent_id ? String(parsed.data.parent_id) : null
  let parentUserId = null
  if (parentId) {
    const parentRes = await pool.query(`select id, post_id, user_id, deleted_at from user_post_comments where id = $1`, [parentId])
    const parent = parentRes.rows[0] ?? null
    if (!parent || parent.deleted_at) return res.status(404).json({ message: 'Parent comment not found' })
    if (String(parent.post_id) !== String(req.params.id)) return res.status(400).json({ message: 'Parent comment belongs to a different post' })
    parentUserId = parent.user_id ?? null

    // Anti-abuse: limit nesting depth to keep threads readable.
    const p1 = await pool.query('select parent_id from user_post_comments where id = $1', [parentId]).catch(() => ({ rows: [] }))
    const parentParentId = p1.rows?.[0]?.parent_id ?? null
    if (parentParentId) {
      const p2 = await pool.query('select parent_id from user_post_comments where id = $1', [parentParentId]).catch(() => ({ rows: [] }))
      const grandParentId = p2.rows?.[0]?.parent_id ?? null
      if (grandParentId) {
        return res.status(400).json({ message: 'Reply depth limit reached (max 3 levels)' })
      }
    }
  }

  // Anti-spam: dedupe identical comment by same user in a short window.
  const body = String(parsed.data.body || '').trim()
  const rules = await loadModerationKeywordFilters()
  const matches = moderationMatches(body, rules)
  const blocked = matches.filter((m) => String(m.action) === 'block')
  if (blocked.length) {
    return res.status(400).json({ message: 'Comment contains restricted content.' })
  }

  const dup = await pool.query(
    `select 1
     from user_post_comments
     where post_id = $1
       and user_id = $2
       and parent_id is not distinct from $3
       and deleted_at is null
       and body = $4
       and created_at > now() - interval '45 seconds'
     limit 1`,
    [req.params.id, req.user.sub, parentId, body],
  )
  if (dup.rowCount > 0) return res.status(409).json({ message: 'Duplicate comment detected. Please wait a moment.' })

  const r = await pool.query(
    `insert into user_post_comments (post_id, user_id, body, parent_id)
     values ($1,$2,$3,$4)
     returning *`,
    [req.params.id, req.user.sub, body, parentId],
  )

  // Keyword flags: create an internal moderation ticket + note (best-effort).
  const flagged = matches.filter((m) => String(m.action) === 'flag')
  if (flagged.length) {
    const ticketId = await ensureCommentModerationTicket({ commentId: r.rows[0]?.id ?? null, postId: req.params.id })
    if (ticketId) {
      const keywords = flagged.map((f) => f.keyword).filter(Boolean).slice(0, 12).join(', ')
      await pool
        .query(
          `insert into support_ticket_events (ticket_id, author_user_id, visibility, body, attachments)
           values ($1,null,'internal',$2,null)`,
          [ticketId, `Auto-flagged by keyword filter: ${keywords || 'keyword'}`],
        )
        .catch(() => {})
      await pool.query(`update support_tickets set last_activity_at=now(), updated_at=now() where id=$1`, [ticketId]).catch(() => {})
      await Promise.all(
        flagged.map((f) =>
          pool
            .query(
              `insert into user_post_comment_flags (comment_id, rule_id)
               values ($1,$2)
               on conflict do nothing`,
              [r.rows[0]?.id ?? null, f.id],
            )
            .catch(() => {}),
        ),
      )
    }
  }

  // Notify parent comment author about a reply (best-effort, deduped).
  if (parentId && parentUserId && String(parentUserId) !== String(req.user.sub)) {
    const fromRes = await pool.query('select name from users where id = $1', [req.user.sub]).catch(() => ({ rows: [] }))
    const fromName = fromRes.rows?.[0]?.name ? String(fromRes.rows[0].name) : 'Someone'
    notify({
      userId: parentUserId,
      type: 'comment_reply',
      title: `${fromName} replied to your comment`,
      body: String(parsed.data.body || '').slice(0, 160) || null,
      meta: { post_id: req.params.id, comment_id: r.rows[0]?.id ?? null, parent_comment_id: parentId, from_user_id: req.user.sub },
      dedupeKey: `comment_reply:${parentId}:${req.user.sub}`,
    }).catch(() => {})
  }

  return res.status(201).json(r.rows[0])
}))

// Like / unlike a comment
postsRouter.post('/comments/:commentId/like', requireAuth, commentLikeRateLimit, asyncHandler(async (req, res) => {
  const commentId = String(req.params.commentId || '').trim()
  if (!commentId) return res.status(400).json({ message: 'Invalid commentId' })

  const existsRes = await pool.query('select id, user_id, post_id, body, deleted_at from user_post_comments where id = $1', [commentId])
  const comment = existsRes.rows[0] ?? null
  if (!comment || comment.deleted_at) return res.status(404).json({ message: 'Comment not found' })

  await pool.query(
    `insert into user_post_comment_likes (comment_id, user_id)
     values ($1,$2)
     on conflict do nothing`,
    [commentId, req.user.sub],
  )

  // Notify comment author about the like (best-effort, deduped).
  const ownerId = comment.user_id ?? null
  if (ownerId && String(ownerId) !== String(req.user.sub)) {
    const fromRes = await pool.query('select name from users where id = $1', [req.user.sub]).catch(() => ({ rows: [] }))
    const fromName = fromRes.rows?.[0]?.name ? String(fromRes.rows[0].name) : 'Someone'
    notify({
      userId: ownerId,
      type: 'comment_like',
      title: `${fromName} liked your comment`,
      body: comment.body ? String(comment.body).slice(0, 160) : null,
      meta: { post_id: comment.post_id ?? null, comment_id: commentId, from_user_id: req.user.sub },
      dedupeKey: `comment_like:${commentId}:${req.user.sub}`,
    }).catch(() => {})
  }

  return res.json({ ok: true, liked: true })
}))

postsRouter.delete('/comments/:commentId/like', requireAuth, commentLikeRateLimit, asyncHandler(async (req, res) => {
  const commentId = String(req.params.commentId || '').trim()
  if (!commentId) return res.status(400).json({ message: 'Invalid commentId' })
  await pool.query('delete from user_post_comment_likes where comment_id = $1 and user_id = $2', [commentId, req.user.sub])
  return res.json({ ok: true, liked: false })
}))

// Report a comment (creates a support ticket and notifies admins).
postsRouter.post('/comments/:commentId/report', requireAuth, commentReportRateLimit, asyncHandler(async (req, res) => {
  const commentId = String(req.params.commentId || '').trim()
  if (!commentId) return res.status(400).json({ message: 'Invalid commentId' })
  const parsed = CommentReportSchema.safeParse(req.body ?? {})
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const cRes = await pool.query(
    `select id, post_id, user_id, body, deleted_at
     from user_post_comments
     where id = $1`,
    [commentId],
  )
  const c = cRes.rows[0] ?? null
  if (!c) return res.status(404).json({ message: 'Comment not found' })

  const reason = String(parsed.data.reason || '').trim()
  const details = parsed.data.details ? String(parsed.data.details).trim() : ''
  const excerpt = c.body ? String(c.body).slice(0, 400) : ''
  const accusedUserId = c.user_id ?? null

  const ticketId = await ensureCommentModerationTicket({ commentId, postId: c.post_id ?? null })

  let upserted = null
  try {
    const up = await pool.query(
      `insert into user_post_comment_reports (comment_id, reporter_user_id, reason, details, support_ticket_id)
       values ($1,$2,$3,$4,$5)
       on conflict (comment_id, reporter_user_id) do update
         set reason = excluded.reason,
             details = excluded.details,
             support_ticket_id = excluded.support_ticket_id,
             updated_at = now()
       returning (xmax = 0) as inserted`,
      [commentId, req.user.sub, reason, details || null, ticketId],
    )
    upserted = up.rows[0] ?? null
  } catch (e) {
    if (String(e?.code || '') !== '42P01') throw e
  }

  if (ticketId) {
    const reportBody =
      `USER REPORT\n` +
      `Reporter: ${req.user.sub}\n` +
      `Accused: ${accusedUserId ?? ''}\n` +
      `Reason: ${reason}\n` +
      (details ? `Details: ${details}\n` : '') +
      `Deleted: ${c.deleted_at ? 'yes' : 'no'}\n` +
      `Excerpt: ${excerpt || '—'}\n`
    await pool
      .query(
        `insert into support_ticket_events (ticket_id, author_user_id, visibility, body, attachments)
         values ($1,$2,'internal',$3,null)`,
        [ticketId, req.user.sub, reportBody],
      )
      .catch(() => {})
    await pool.query(`update support_tickets set last_activity_at=now(), updated_at=now() where id=$1`, [ticketId]).catch(() => {})

    // Ping admins in-app (deduped).
    const admins = await pool.query(`select id from users where role='admin' and deleted_at is null`).catch(() => ({ rows: [] }))
    await Promise.all(
      admins.rows.map((a) =>
        notify({
          userId: a.id,
          type: 'comment_reported',
          title: 'Comment reported',
          body: reason,
          meta: { ticket_id: ticketId, comment_id: commentId, post_id: c.post_id ?? null, accused_user_id: accusedUserId },
          dedupeKey: `comment_report:${commentId}`,
        }).catch(() => {}),
      ),
    )
  }

  const inserted = Boolean(upserted?.inserted)
  return res.status(inserted ? 201 : 200).json({ ok: true, ticket_id: ticketId })
}))

// Edit a comment (owner or admin)
postsRouter.put('/comments/:commentId', requireAuth, commentEditRateLimit, asyncHandler(async (req, res) => {
  const commentId = String(req.params.commentId || '').trim()
  if (!commentId) return res.status(400).json({ message: 'Invalid commentId' })
  const parsed = CommentUpdateSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const cRes = await pool.query('select id, user_id, deleted_at from user_post_comments where id = $1', [commentId])
  const c = cRes.rows[0] ?? null
  if (!c) return res.status(404).json({ message: 'Comment not found' })
  if (c.deleted_at) return res.status(409).json({ message: 'Comment is deleted' })

  const isAdmin = req.user.role === 'admin'
  const isOwner = c.user_id && String(c.user_id) === String(req.user.sub)
  if (!isAdmin && !isOwner) return res.status(403).json({ message: 'Forbidden' })

  const body = String(parsed.data.body || '').trim()
  const rules = await loadModerationKeywordFilters()
  const matches = moderationMatches(body, rules)
  const blocked = matches.filter((m) => String(m.action) === 'block')
  if (blocked.length) {
    return res.status(400).json({ message: 'Comment contains restricted content.' })
  }

  const r = await pool.query(
    `update user_post_comments
     set body = $2,
         updated_at = now()
     where id = $1
     returning id, post_id, user_id, parent_id, body, created_at, updated_at, deleted_at`,
    [commentId, body],
  )

  // Keyword flags on edit (best-effort).
  const flagged = matches.filter((m) => String(m.action) === 'flag')
  if (flagged.length) {
    const ticketId = await ensureCommentModerationTicket({ commentId, postId: r.rows[0]?.post_id ?? null })
    if (ticketId) {
      const keywords = flagged.map((f) => f.keyword).filter(Boolean).slice(0, 12).join(', ')
      await pool
        .query(
          `insert into support_ticket_events (ticket_id, author_user_id, visibility, body, attachments)
           values ($1,$2,'internal',$3,null)`,
          [ticketId, req.user.sub, `Auto-flagged on edit by keyword filter: ${keywords || 'keyword'}`],
        )
        .catch(() => {})
      await pool.query(`update support_tickets set last_activity_at=now(), updated_at=now() where id=$1`, [ticketId]).catch(() => {})
      await Promise.all(
        flagged.map((f) =>
          pool
            .query(
              `insert into user_post_comment_flags (comment_id, rule_id)
               values ($1,$2)
               on conflict do nothing`,
              [commentId, f.id],
            )
            .catch(() => {}),
        ),
      )
    }
  }

  return res.json(r.rows[0])
}))

// Soft-delete a comment (owner or admin). Keeps row to preserve reply threads.
postsRouter.delete('/comments/:commentId', requireAuth, commentDeleteRateLimit, asyncHandler(async (req, res) => {
  const commentId = String(req.params.commentId || '').trim()
  if (!commentId) return res.status(400).json({ message: 'Invalid commentId' })

  const cRes = await pool.query('select id, user_id, deleted_at from user_post_comments where id = $1', [commentId])
  const c = cRes.rows[0] ?? null
  if (!c) return res.status(404).json({ message: 'Comment not found' })

  const isAdmin = req.user.role === 'admin'
  const isOwner = c.user_id && String(c.user_id) === String(req.user.sub)
  if (!isAdmin && !isOwner) return res.status(403).json({ message: 'Forbidden' })

  await pool.query(
    `update user_post_comments
     set deleted_at = coalesce(deleted_at, now()),
         updated_at = now(),
     where id = $1`,
    [commentId],
  )
  return res.json({ ok: true })
}))


