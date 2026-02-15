import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { notify } from '../services/notifications.js'

export const supportRouter = Router()

const CreateTicketSchema = z.object({
  category: z
    .enum(['general', 'account', 'jobs', 'orders', 'delivery', 'escrow', 'verification', 'payouts', 'fraud', 'dispute'])
    .optional()
    .default('general'),
  subject: z.string().min(3).max(200),
  description: z.string().min(3).max(5000).optional().nullable(),
  related_type: z.string().max(50).optional().nullable(),
  related_id: z.string().max(200).optional().nullable(),
  attachments: z.array(z.string().min(1).max(500)).max(12).optional().nullable(),
})

const ReplySchema = z.object({
  body: z.string().min(1).max(5000),
  attachments: z.array(z.string().min(1).max(500)).max(12).optional().nullable(),
})

function normalizeUploadUrlMaybe(u) {
  const raw = String(u ?? '').trim()
  if (!raw) return null
  // Allow relative internal upload URLs.
  if (raw.startsWith('/api/uploads/')) return raw
  // Allow absolute URLs that point to our uploads path; store as relative.
  try {
    const url = new URL(raw)
    if (url.pathname.startsWith('/api/uploads/')) return `${url.pathname}${url.search || ''}`
  } catch {
    // ignore
  }
  return null
}

supportRouter.get('/tickets', requireAuth, asyncHandler(async (req, res) => {
  const r = await pool.query(
    `select *
     from support_tickets
     where requester_user_id = $1
     order by last_activity_at desc
     limit 100`,
    [req.user.sub],
  )
  return res.json(r.rows)
}))

supportRouter.get('/tickets/:id', requireAuth, asyncHandler(async (req, res) => {
  const t = await pool.query('select * from support_tickets where id = $1 and requester_user_id = $2', [req.params.id, req.user.sub])
  if (!t.rows[0]) return res.status(404).json({ message: 'Ticket not found' })
  const e = await pool.query(
    `select *
     from support_ticket_events
     where ticket_id = $1 and visibility in ('customer','internal') -- user will be filtered below
     order by created_at asc`,
    [req.params.id],
  )
  // Users should NOT see internal notes
  const visible = e.rows.filter((x) => x.visibility === 'customer')
  return res.json({ ticket: t.rows[0], events: visible })
}))

supportRouter.post('/tickets', requireAuth, asyncHandler(async (req, res) => {
  const parsed = CreateTicketSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const d = parsed.data
  const attachments = (Array.isArray(d.attachments) ? d.attachments : [])
    .map((x) => normalizeUploadUrlMaybe(x))
    .filter(Boolean)
    .slice(0, 12)
  const attachmentsJson = attachments.length ? JSON.stringify(attachments) : null
  const client = await pool.connect()
  try {
    await client.query('begin')
    const t = await client.query(
      `insert into support_tickets (requester_user_id, created_by_user_id, category, subject, description, related_type, related_id, status, priority, last_activity_at)
       values ($1,$1,$2,$3,$4,$5,$6,'open','normal',now())
       returning *`,
      [req.user.sub, d.category, d.subject, d.description ?? null, d.related_type ?? null, d.related_id ?? null],
    )
    const ticket = t.rows[0]
    await client.query(
      `insert into support_ticket_events (ticket_id, author_user_id, visibility, body, attachments)
       values ($1,$2,'customer',$3,$4::jsonb)`,
      [ticket.id, req.user.sub, d.description ? String(d.description) : `Ticket created: ${d.subject}`, attachmentsJson],
    )
    await client.query('commit')

    // Notify admins (best-effort).
    const admins = await pool.query(`select id from users where role='admin' and deleted_at is null`)
    await Promise.all(
      admins.rows.map((a) =>
        notify({
          userId: a.id,
          type: 'support_ticket_created',
          title: 'New support ticket',
          body: d.subject,
          meta: { ticket_id: ticket.id, url: '/admin' },
          dedupeKey: `support_ticket:${ticket.id}:created`,
        }).catch(() => {}),
      ),
    )

    return res.status(201).json(ticket)
  } catch (e) {
    try {
      await client.query('rollback')
    } catch {}
    throw e
  } finally {
    client.release()
  }
}))

supportRouter.post('/tickets/:id/reply', requireAuth, asyncHandler(async (req, res) => {
  const parsed = ReplySchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const t = await pool.query('select * from support_tickets where id = $1 and requester_user_id = $2', [req.params.id, req.user.sub])
  const ticket = t.rows[0]
  if (!ticket) return res.status(404).json({ message: 'Ticket not found' })

  const attachments = (Array.isArray(parsed.data.attachments) ? parsed.data.attachments : [])
    .map((x) => normalizeUploadUrlMaybe(x))
    .filter(Boolean)
    .slice(0, 12)
  const attachmentsJson = attachments.length ? JSON.stringify(attachments) : null

  const e = await pool.query(
    `insert into support_ticket_events (ticket_id, author_user_id, visibility, body, attachments)
     values ($1,$2,'customer',$3,$4::jsonb)
     returning *`,
    [ticket.id, req.user.sub, parsed.data.body, attachmentsJson],
  )
  await pool.query(`update support_tickets set status='pending_admin', last_activity_at=now(), updated_at=now() where id=$1`, [ticket.id])

  return res.status(201).json(e.rows[0])
}))


