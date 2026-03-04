import { Router } from 'express'
import { pool } from '../db/pool.js'
import { requireAuth, optionalAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'

export const eventsRouter = Router()

// List upcoming events (for feed Local Events card). Optional auth to include my_rsvp. ?company_id= for company dashboard.
eventsRouter.get('/', optionalAuth, asyncHandler(async (req, res) => {
  const companyId = req.query.company_id ? String(req.query.company_id).trim() : null
  const r = await pool.query(
    companyId
      ? `select e.id, e.company_id, e.title, e.description, e.location, e.starts_at, e.ends_at, e.image_url, e.external_url, e.created_at,
                c.name as company_name,
                (select count(*) from company_event_rsvps where event_id = e.id and status = 'going') as going_count,
                (select count(*) from company_event_rsvps where event_id = e.id and status = 'interested') as interested_count
         from company_events e
         join companies c on c.id = e.company_id
         where e.company_id = $1
         order by e.starts_at desc
         limit 50`
      : `select e.id, e.company_id, e.title, e.description, e.location, e.starts_at, e.ends_at, e.image_url, e.external_url, e.created_at,
                c.name as company_name,
                (select count(*) from company_event_rsvps where event_id = e.id and status = 'going') as going_count,
                (select count(*) from company_event_rsvps where event_id = e.id and status = 'interested') as interested_count
         from company_events e
         join companies c on c.id = e.company_id
         where e.starts_at > now()
         order by e.starts_at asc
         limit 20`,
    companyId ? [companyId] : [],
  )
  const rows = r.rows || []
  const userId = req.user?.sub
  let withRsvp = rows
  if (userId && rows.length) {
    const ids = rows.map((x) => x.id)
    const rsvps = await pool.query(
      'select event_id, status from company_event_rsvps where event_id = any($1::uuid[]) and user_id = $2',
      [ids, userId],
    )
    const byEvent = Object.fromEntries((rsvps.rows || []).map((r) => [r.event_id, r.status]))
    withRsvp = rows.map((row) => ({ ...row, my_rsvp: byEvent[row.id] || null }))
  }
  return res.json(withRsvp)
}))

// Single event (for expand/detail).
eventsRouter.get('/:id', optionalAuth, asyncHandler(async (req, res) => {
  const id = req.params.id
  const r = await pool.query(
    `select e.id, e.company_id, e.title, e.description, e.location, e.location_url, e.starts_at, e.ends_at, e.image_url, e.external_url, e.created_at,
            c.name as company_name, c.slug as company_slug
     from company_events e
     join companies c on c.id = e.company_id
     where e.id = $1
     limit 1`,
    [id],
  )
  const row = r.rows[0]
  if (!row) return res.status(404).json({ message: 'Event not found' })

  const counts = await pool.query(
    `select status, count(*) as c from company_event_rsvps where event_id = $1 group by status`,
    [id],
  )
  const going_count = Number(counts.rows.find((x) => x.status === 'going')?.c ?? 0)
  const interested_count = Number(counts.rows.find((x) => x.status === 'interested')?.c ?? 0)

  let my_rsvp = null
  if (req.user?.sub) {
    const rsvp = await pool.query('select status from company_event_rsvps where event_id = $1 and user_id = $2 limit 1', [id, req.user.sub])
    my_rsvp = rsvp.rows[0]?.status ?? null
  }

  return res.json({ ...row, going_count, interested_count, my_rsvp })
}))

// Create event (company owner/member).
eventsRouter.post('/', requireAuth, asyncHandler(async (req, res) => {
  const userId = req.user?.sub
  const { company_id, title, description, location, location_url, starts_at, ends_at, image_url, external_url } = req.body || {}

  const companyId = company_id || (await getCompanyIdForUser(userId))
  if (!companyId) return res.status(403).json({ message: 'Company required' })

  const canManage = await canUserManageCompanyEvents(userId, companyId)
  if (!canManage) return res.status(403).json({ message: 'Not allowed to create events for this company' })

  const starts = starts_at ? new Date(starts_at) : null
  if (!starts || Number.isNaN(starts.getTime())) return res.status(400).json({ message: 'Valid starts_at required' })
  const ends = ends_at ? new Date(ends_at) : null

  const r = await pool.query(
    `insert into company_events (company_id, title, description, location, location_url, starts_at, ends_at, image_url, external_url, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
     returning id, company_id, title, description, location, starts_at, ends_at, image_url, created_at`,
    [
      companyId,
      String(title ?? '').trim() || 'Untitled Event',
      description != null ? String(description).trim() : null,
      location != null ? String(location).trim() : null,
      location_url != null ? String(location_url).trim() : null,
      starts,
      ends && !Number.isNaN(ends.getTime()) ? ends : null,
      image_url != null ? String(image_url).trim() : null,
      external_url != null ? String(external_url).trim() : null,
    ],
  )
  return res.status(201).json(r.rows[0])
}))

// Update event (company).
eventsRouter.put('/:id', requireAuth, asyncHandler(async (req, res) => {
  const userId = req.user?.sub
  const id = req.params.id
  const { title, description, location, location_url, starts_at, ends_at, image_url, external_url } = req.body || {}

  const existing = await pool.query('select company_id from company_events where id = $1 limit 1', [id])
  if (!existing.rows[0]) return res.status(404).json({ message: 'Event not found' })
  const canManage = await canUserManageCompanyEvents(userId, existing.rows[0].company_id)
  if (!canManage) return res.status(403).json({ message: 'Not allowed to edit this event' })

  const starts = starts_at ? new Date(starts_at) : null
  const ends = ends_at ? new Date(ends_at) : null

  await pool.query(
    `update company_events set
       title = coalesce($2, title),
       description = coalesce($3, description),
       location = coalesce($4, location),
       location_url = coalesce($5, location_url),
       starts_at = coalesce($6, starts_at),
       ends_at = $7,
       image_url = coalesce($8, image_url),
       external_url = coalesce($9, external_url),
       updated_at = now()
     where id = $1`,
    [
      id,
      title != null ? String(title).trim() : null,
      description !== undefined ? String(description).trim() : null,
      location !== undefined ? String(location).trim() : null,
      location_url !== undefined ? String(location_url).trim() : null,
      starts && !Number.isNaN(starts.getTime()) ? starts : null,
      ends && !Number.isNaN(ends.getTime()) ? ends : null,
      image_url !== undefined ? String(image_url).trim() : null,
      external_url !== undefined ? String(external_url).trim() : null,
    ],
  )
  const r = await pool.query('select id, company_id, title, description, location, starts_at, ends_at, image_url, updated_at from company_events where id = $1', [id])
  return res.json(r.rows[0])
}))

// RSVP: going or interested.
eventsRouter.post('/:id/rsvp', requireAuth, asyncHandler(async (req, res) => {
  const userId = req.user?.sub
  const eventId = req.params.id
  const status = (req.body?.status || '').toLowerCase()
  if (status !== 'going' && status !== 'interested') {
    return res.status(400).json({ message: 'status must be "going" or "interested"' })
  }

  const event = await pool.query('select id from company_events where id = $1 limit 1', [eventId])
  if (!event.rows[0]) return res.status(404).json({ message: 'Event not found' })

  await pool.query(
    `insert into company_event_rsvps (event_id, user_id, status, updated_at)
     values ($1, $2, $3, now())
     on conflict (event_id, user_id) do update set status = $3, updated_at = now()`,
    [eventId, userId, status],
  )

  const counts = await pool.query(
    `select status, count(*) as c from company_event_rsvps where event_id = $1 group by status`,
    [eventId],
  )
  const going_count = Number(counts.rows.find((x) => x.status === 'going')?.c ?? 0)
  const interested_count = Number(counts.rows.find((x) => x.status === 'interested')?.c ?? 0)

  return res.json({ my_rsvp: status, going_count, interested_count })
}))

// Remove RSVP.
eventsRouter.delete('/:id/rsvp', requireAuth, asyncHandler(async (req, res) => {
  const userId = req.user?.sub
  const eventId = req.params.id
  await pool.query('delete from company_event_rsvps where event_id = $1 and user_id = $2', [eventId, userId])
  return res.json({ my_rsvp: null })
}))

async function getCompanyIdForUser(userId) {
  try {
    const m = await pool.query('select company_id from company_members where user_id = $1 limit 1', [userId])
    if (m.rows[0]) return m.rows[0].company_id
  } catch (e) {
    if (String(e?.code) !== '42P01') throw e
  }
  const c = await pool.query('select id from companies where owner_user_id = $1 limit 1', [userId])
  return c.rows[0]?.id ?? null
}

async function canUserManageCompanyEvents(userId, companyId) {
  const owner = await pool.query('select 1 from companies where id = $1 and owner_user_id = $2 limit 1', [companyId, userId])
  if (owner.rowCount) return true
  try {
    const m = await pool.query(
      "select 1 from company_members where company_id = $1 and user_id = $2 and workspace_role in ('owner', 'ops', 'hr') limit 1",
      [companyId, userId],
    )
    return !!m.rowCount
  } catch (e) {
    if (String(e?.code) === '42P01') return false
    throw e
  }
}
