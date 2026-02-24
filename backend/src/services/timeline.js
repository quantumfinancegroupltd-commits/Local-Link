/**
 * Unified customer timeline: one place for orders, jobs, quotes, reviews, escrow, disputes.
 * Used by GET /api/timeline (own) and GET /api/admin/timeline/:userId (admin).
 */
import { pool } from '../db/pool.js'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100

/** @typedef {{ id: string, type: string, at: string, title: string, summary: string, link: string | null, meta: object }} TimelineEvent */

/**
 * Fetch timeline events for a user. Aggregates orders, jobs, quotes, reviews, escrow, disputes, job_posts, applications.
 * @param {string} userId - user uuid
 * @param {{ limit?: number, before?: string }} opts - limit and cursor (ISO date) for pagination
 * @returns {Promise<TimelineEvent[]>}
 */
export async function getTimelineForUser(userId, opts = {}) {
  const limit = Math.min(Number(opts.limit) || DEFAULT_LIMIT, MAX_LIMIT)
  const before = opts.before ? new Date(opts.before).toISOString() : null

  const [
    orderEvents,
    jobEvents,
    quoteEvents,
    reviewEvents,
    escrowEvents,
    disputeEvents,
    jobPostEvents,
    applicationEvents,
  ] = await Promise.all([
    getOrderEvents(userId, limit, before),
    getJobEvents(userId, limit, before),
    getQuoteEvents(userId, limit, before),
    getReviewEvents(userId, limit, before),
    getEscrowEvents(userId, limit, before),
    getDisputeEvents(userId, limit, before),
    getJobPostEvents(userId, limit, before),
    getApplicationEvents(userId, limit, before),
  ])

  const combined = [
    ...orderEvents,
    ...jobEvents,
    ...quoteEvents,
    ...reviewEvents,
    ...escrowEvents,
    ...disputeEvents,
    ...jobPostEvents,
    ...applicationEvents,
  ]
  combined.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
  return combined.slice(0, limit)
}

function toEvent(row, type, title, summary, link, meta = {}) {
  return {
    id: row.id,
    type,
    at: row.created_at,
    title,
    summary: summary || '',
    link,
    meta: { ...meta, entity_id: row.entity_id ?? row.id },
  }
}

async function getOrderEvents(userId, limit, before) {
  const beforeClause = before ? 'and o.created_at < $2' : ''
  const args = before ? [userId, before, limit] : [userId, limit]
  const r = await pool.query(
    `select o.id, o.created_at, o.order_status, o.total_price, o.id as entity_id,
            p.name as product_name
     from orders o
     left join products p on p.id = o.product_id
     where (o.buyer_id = $1 or exists (select 1 from farmers f where f.id = o.farmer_id and f.user_id = $1))
       and o.created_at is not null ${beforeClause}
     order by o.created_at desc
     limit $${args.length}`,
    args,
  )
  return r.rows.map((row) => {
    const status = row.order_status || 'pending'
    const product = row.product_name ? ` · ${row.product_name}` : ''
    const price = row.total_price != null ? ` GHS ${Number(row.total_price)}` : ''
    return toEvent(
      row,
      'order',
      status === 'delivered' ? 'Order delivered' : status === 'confirmed' ? 'Order confirmed' : 'Order placed',
      `Order${product}${price}`,
      `/messages/order/${row.id}`,
      { order_status: status },
    )
  })
}

async function getJobEvents(userId, limit, before) {
  const beforeClause = before ? 'and j.created_at < $2' : ''
  const args = before ? [userId, before, limit] : [userId, limit]
  const r = await pool.query(
    `select j.id, j.created_at, j.status, j.title, j.completed_at, j.id as entity_id
     from jobs j
     left join artisans a on a.id = j.assigned_artisan_id
     where j.buyer_id = $1 or a.user_id = $1
       and j.created_at is not null ${beforeClause}
     order by j.created_at desc
     limit $${args.length}`,
    args,
  )
  return r.rows.map((row) => {
    const isCompleted = row.status === 'completed'
    const title = isCompleted ? 'Job completed' : row.status === 'open' ? 'Job posted' : 'Job updated'
    return toEvent(row, 'job', title, row.title || 'Job', `/jobs/${row.id}`, { job_status: row.status })
  })
}

async function getQuoteEvents(userId, limit, before) {
  const beforeClause = before ? 'and q.created_at < $2' : ''
  const args = before ? [userId, before, limit] : [userId, limit]
  const r = await pool.query(
    `select q.id, q.created_at, q.status, q.quote_amount, j.title as job_title, j.id as job_id,
            q.id as entity_id
     from quotes q
     join jobs j on j.id = q.job_id
     join artisans a on a.id = q.artisan_id
     where j.buyer_id = $1 or a.user_id = $1
       and q.created_at is not null ${beforeClause}
     order by q.created_at desc
     limit $${args.length}`,
    args,
  )
  return r.rows.map((row) => {
    const isAccept = row.status === 'accepted'
    const title = isAccept ? 'Quote accepted' : 'Quote submitted'
    const summary = row.job_title ? `${row.job_title}${row.quote_amount != null ? ` · GHS ${Number(row.quote_amount)}` : ''}` : 'Quote'
    return toEvent(row, 'quote', title, summary, `/jobs/${row.job_id}`, { quote_status: row.status })
  })
}

async function getReviewEvents(userId, limit, before) {
  const beforeClause = before ? 'and r.created_at < $2' : ''
  const args = before ? [userId, before, limit] : [userId, limit]
  const r = await pool.query(
    `select r.id, r.created_at, r.rating, r.reviewer_id, r.target_id, r.id as entity_id,
            ru.name as reviewer_name
     from reviews r
     left join users ru on ru.id = r.reviewer_id
     where r.reviewer_id = $1 or r.target_id = $1
       and r.created_at is not null ${beforeClause}
     order by r.created_at desc
     limit $${args.length}`,
    args,
  )
  return r.rows.map((row) => {
    const isReceiver = row.target_id === userId
    const title = isReceiver ? 'Review received' : 'Review left'
    const summary = row.rating != null ? `${row.rating} stars` : 'Review'
    const link = isReceiver ? `/u/${userId}` : `/u/${row.target_id}`
    return toEvent(row, 'review', title, summary, link, { rating: row.rating })
  })
}

async function getEscrowEvents(userId, limit, before) {
  const beforeClause = before ? 'and e.created_at < $2' : ''
  const args = before ? [userId, before, limit] : [userId, limit]
  const r = await pool.query(
    `select e.id, e.created_at, e.status, e.amount, e.type as escrow_type, e.job_id, e.order_id,
            e.id as entity_id
     from escrow_transactions e
     where e.buyer_id = $1 or e.counterparty_user_id = $1
       and e.created_at is not null ${beforeClause}
     order by e.created_at desc
     limit $${args.length}`,
    args,
  )
  return r.rows.map((row) => {
    let title = 'Payment'
    if (row.status === 'released') title = 'Escrow released'
    else if (row.status === 'held') title = 'Escrow funded'
    else if (row.status === 'refunded') title = 'Escrow refunded'
    else if (row.status === 'disputed') title = 'Escrow disputed'
    const summary = row.amount != null ? `GHS ${Number(row.amount)}` : ''
    const link = row.job_id ? `/jobs/${row.job_id}` : row.order_id ? `/messages/order/${row.order_id}` : null
    return toEvent(row, 'escrow', title, summary, link, { status: row.status, escrow_type: row.escrow_type })
  })
}

async function getDisputeEvents(userId, limit, before) {
  const beforeClause = before ? 'and d.created_at < $2' : ''
  const args = before ? [userId, before, limit] : [userId, limit]
  const r = await pool.query(
    `select d.id, d.created_at, d.status, d.reason, et.job_id, et.order_id, d.id as entity_id
     from disputes d
     join escrow_transactions et on et.id = d.escrow_id
     where d.raised_by_user_id = $1 or et.buyer_id = $1 or et.counterparty_user_id = $1
       and d.created_at is not null ${beforeClause}
     order by d.created_at desc
     limit $${args.length}`,
    args,
  )
  return r.rows.map((row) => {
    const isResolved = row.status === 'resolved' || row.status === 'rejected'
    const title = isResolved ? `Dispute ${row.status}` : 'Dispute opened'
    const summary = row.reason || 'Dispute'
    const link = row.job_id ? `/jobs/${row.job_id}` : row.order_id ? `/messages/order/${row.order_id}` : null
    return toEvent(row, 'dispute', title, summary, link, { status: row.status })
  })
}

async function getJobPostEvents(userId, limit, before) {
  const beforeClause = before ? 'and jp.created_at < $2' : ''
  const args = before ? [userId, before, limit] : [userId, limit]
  const r = await pool.query(
    `select jp.id, jp.created_at, jp.title, jp.status, jp.id as entity_id
     from job_posts jp
     join companies c on c.id = jp.company_id and c.owner_user_id = $1
     where jp.created_at is not null ${beforeClause}
     order by jp.created_at desc
     limit $${args.length}`,
    args,
  )
  return r.rows.map((row) =>
    toEvent(row, 'job_post', 'Job role posted', row.title || 'Job post', `/jobs/${row.id}`, { status: row.status }),
  )
}

async function getApplicationEvents(userId, limit, before) {
  const beforeClause = before ? 'and ja.created_at < $2' : ''
  const args = before ? [userId, before, limit] : [userId, limit]
  const r = await pool.query(
    `select ja.id, ja.created_at, ja.status, jp.title as job_title, jp.id as job_id, ja.id as entity_id
     from job_applications ja
     join job_posts jp on jp.id = ja.job_id
     where ja.applicant_user_id = $1
       and ja.created_at is not null ${beforeClause}
     order by ja.created_at desc
     limit $${args.length}`,
    args,
  )
  return r.rows.map((row) => {
    const title = row.status === 'hired' ? 'Application hired' : row.status === 'shortlisted' ? 'Application shortlisted' : 'Application submitted'
    return toEvent(row, 'application', title, row.job_title || 'Job application', `/jobs/${row.job_id}`, {
      status: row.status,
    })
  })
}
