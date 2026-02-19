import { Router } from 'express'
import { pool } from '../db/pool.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'

export const buyerJobHistoryRouter = Router()

// GET /api/buyer/job-history/summary — lightweight spend summary for budget widget
buyerJobHistoryRouter.get('/summary', requireAuth, requireRole(['buyer']), asyncHandler(async (req, res) => {
  const buyerId = req.user.sub
  const now = new Date()
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const r = await pool.query(
    `with latest_escrow as (
       select distinct on (e.job_id) e.job_id, e.amount as escrow_amount, e.currency as escrow_currency, e.status as escrow_status
       from escrow_transactions e
       where e.type = 'job' and e.buyer_id = $1
       order by e.job_id, e.created_at desc
     ),
     completed_amounts as (
       select j.completed_at,
              case when le.escrow_status = 'released' and le.escrow_amount is not null then le.escrow_amount else j.accepted_quote end as amount
       from jobs j
       left join latest_escrow le on le.job_id = j.id
       where j.buyer_id = $1 and j.deleted_at is null and j.status = 'completed'
     )
     select
       coalesce(sum(amount) filter (where amount is not null), 0)::numeric as total_spend,
       coalesce(sum(amount) filter (where completed_at >= $2 and amount is not null), 0)::numeric as this_month
     from completed_amounts`,
    [buyerId, thisMonthStart],
  )
  const row = r.rows[0] ?? {}
  const total_spend = Math.round(Number(row.total_spend ?? 0) * 100) / 100
  const this_month = Math.round(Number(row.this_month ?? 0) * 100) / 100
  return res.json({ total_spend, this_month, currency: 'GHS' })
}))

// GET /api/buyer/job-history — order history and spend analytics for the buyer (completed jobs only)
buyerJobHistoryRouter.get('/', requireAuth, requireRole(['buyer']), asyncHandler(async (req, res) => {
  const buyerId = req.user.sub

  const ordersRes = await pool.query(
    `with latest_escrow as (
       select distinct on (e.job_id) e.job_id, e.amount as escrow_amount, e.currency as escrow_currency, e.status as escrow_status
       from escrow_transactions e
       where e.type = 'job' and e.buyer_id = $1
       order by e.job_id, e.created_at desc
     )
     select j.id as job_id,
            j.title,
            j.category,
            j.completed_at,
            j.accepted_quote,
            j.assigned_artisan_id,
            u.id as provider_user_id,
            u.name as provider_name,
            le.escrow_amount,
            le.escrow_currency,
            le.escrow_status
     from jobs j
     left join latest_escrow le on le.job_id = j.id
     left join artisans a on a.id = j.assigned_artisan_id
     left join users u on u.id = a.user_id
     where j.buyer_id = $1 and j.deleted_at is null and j.status = 'completed'
     order by j.completed_at desc nulls last, j.created_at desc`,
    [buyerId],
  )

  const now = new Date()
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const orders = ordersRes.rows.map((row) => {
    const amount =
      row.escrow_status === 'released' && row.escrow_amount != null
        ? Number(row.escrow_amount)
        : row.accepted_quote != null
          ? Number(row.accepted_quote)
          : null
    const currency = row.escrow_currency ?? 'GHS'
    return {
      job_id: row.job_id,
      title: row.title ?? 'Job',
      category: row.category ?? null,
      completed_at: row.completed_at,
      amount,
      currency,
      amount_source: row.escrow_status === 'released' ? 'released' : 'quote',
      provider_user_id: row.provider_user_id ?? null,
      provider_name: row.provider_name ?? null,
    }
  })

  const withAmount = orders.filter((o) => o.amount != null && Number.isFinite(o.amount))
  const total_spend = withAmount.reduce((s, o) => s + o.amount, 0)
  const this_month = withAmount.filter(
    (o) => o.completed_at && new Date(o.completed_at) >= thisMonthStart,
  ).reduce((s, o) => s + o.amount, 0)

  const by_category = {}
  for (const o of withAmount) {
    const cat = o.category ?? 'Other'
    if (!by_category[cat]) by_category[cat] = { category: cat, total: 0, count: 0 }
    by_category[cat].total += o.amount
    by_category[cat].count += 1
  }
  const by_category_list = Object.values(by_category).sort((a, b) => b.total - a.total)

  const by_provider = {}
  for (const o of withAmount) {
    const key = o.provider_user_id ?? 'unknown'
    const name = o.provider_name ?? 'Unknown provider'
    if (!by_provider[key]) by_provider[key] = { provider_user_id: key === 'unknown' ? null : key, provider_name: name, total: 0, count: 0 }
    by_provider[key].total += o.amount
    by_provider[key].count += 1
  }
  const by_provider_list = Object.values(by_provider).sort((a, b) => b.total - a.total)

  return res.json({
    orders,
    summary: {
      total_spend: Math.round(total_spend * 100) / 100,
      this_month: Math.round(this_month * 100) / 100,
      by_category: by_category_list,
      by_provider: by_provider_list,
    },
  })
}))
