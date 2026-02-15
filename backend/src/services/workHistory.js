import { pool } from '../db/pool.js'

function clampInt(v, lo, hi, fallback) {
  const n = Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.max(lo, Math.min(hi, Math.floor(n)))
}

function coarseLocationLabel(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return null
  // Keep only the first segment before a comma (often "Area, City, ...")
  const first = s.split(',')[0]?.trim() ?? ''
  const noDigits = first.replace(/\d+/g, '').replace(/\s+/g, ' ').trim()
  const out = noDigits || first
  return out.length > 48 ? out.slice(0, 48).trim() : out
}

function outcomeFromDisputeStatus(status) {
  const s = String(status ?? '').toLowerCase()
  if (s === 'resolved') return 'issue_resolved'
  if (s === 'open' || s === 'under_review') return 'issue_open'
  return 'completed'
}

function normalizeCategory(raw) {
  const s = String(raw ?? '').trim()
  return s ? s : 'Other'
}

export async function buildWorkHistory(userId, { role, limit = 20, offset = 0 } = {}) {
  const uid = String(userId)
  const take = clampInt(limit, 1, 50, 20)
  const skip = clampInt(offset, 0, 5000, 0)
  const r = String(role ?? '').toLowerCase()

  if (r !== 'artisan' && r !== 'farmer' && r !== 'driver') {
    return { summary: { role: r, completed_total: 0, completed_90d: 0, since: null, top_categories: [] }, items: [], has_more: false }
  }

  if (r === 'artisan') {
    const [summaryRes, topRes, itemsRes] = await Promise.all([
      pool.query(
        `
        select
          count(*)::int as completed_total,
          count(*) filter (where j.completed_at >= now() - interval '90 days')::int as completed_90d,
          min(j.completed_at) as since
        from jobs j
        join artisans a on a.id = j.assigned_artisan_id
        where a.user_id = $1
          and j.status = 'completed'
        `,
        [uid],
      ),
      pool.query(
        `
        select coalesce(nullif(trim(j.category), ''), 'Other') as category, count(*)::int as n
        from jobs j
        join artisans a on a.id = j.assigned_artisan_id
        where a.user_id = $1
          and j.status = 'completed'
        group by 1
        order by n desc, category asc
        limit 6
        `,
        [uid],
      ),
      pool.query(
        `
        select
          j.id as context_id,
          'job'::text as context_type,
          j.title,
          j.category,
          j.location,
          coalesce(j.provider_completed_at, j.completed_at, j.buyer_confirmed_at, j.updated_at) as occurred_at,
          d.status as dispute_status
        from jobs j
        join artisans a on a.id = j.assigned_artisan_id
        left join escrow_transactions e on e.type='job' and e.job_id = j.id
        left join disputes d on d.escrow_id = e.id
        where a.user_id = $1
          and j.status = 'completed'
        order by occurred_at desc nulls last
        limit $2 offset $3
        `,
        [uid, take + 1, skip],
      ),
    ])

    const summaryRow = summaryRes.rows[0] ?? {}
    const itemsRaw = itemsRes.rows ?? []
    const hasMore = itemsRaw.length > take
    const sliced = itemsRaw.slice(0, take)

    return {
      summary: {
        role: r,
        completed_total: Number(summaryRow.completed_total ?? 0),
        completed_90d: Number(summaryRow.completed_90d ?? 0),
        since: summaryRow.since ?? null,
        top_categories: (topRes.rows ?? []).map((x) => ({ category: normalizeCategory(x.category), count: Number(x.n ?? 0) })),
      },
      items: sliced.map((x) => ({
        context_type: 'job',
        context_id: x.context_id,
        title: x.title ? String(x.title) : 'Job completed',
        category: normalizeCategory(x.category),
        location: coarseLocationLabel(x.location),
        occurred_at: x.occurred_at ?? null,
        outcome: outcomeFromDisputeStatus(x.dispute_status),
      })),
      has_more: hasMore,
    }
  }

  if (r === 'farmer') {
    const [summaryRes, topRes, itemsRes] = await Promise.all([
      pool.query(
        `
        select
          count(*)::int as completed_total,
          count(*) filter (where o.updated_at >= now() - interval '90 days')::int as completed_90d,
          min(o.created_at) as since
        from orders o
        join farmers f on f.id = o.farmer_id
        where f.user_id = $1
          and o.order_status = 'delivered'
        `,
        [uid],
      ),
      pool.query(
        `
        select coalesce(nullif(trim(p.category), ''), 'Other') as category, count(*)::int as n
        from orders o
        join farmers f on f.id = o.farmer_id
        left join products p on p.id = o.product_id
        where f.user_id = $1
          and o.order_status = 'delivered'
        group by 1
        order by n desc, category asc
        limit 6
        `,
        [uid],
      ),
      pool.query(
        `
        select
          o.id as context_id,
          'order'::text as context_type,
          p.name as product_name,
          p.category,
          o.delivery_address,
          coalesce(d.confirmed_at, d.delivered_at, o.updated_at, o.created_at) as occurred_at,
          ds.status as dispute_status
        from orders o
        join farmers f on f.id = o.farmer_id
        left join products p on p.id = o.product_id
        left join deliveries d on d.order_id = o.id
        left join escrow_transactions e on e.type='order' and e.order_id = o.id
        left join disputes ds on ds.escrow_id = e.id
        where f.user_id = $1
          and o.order_status = 'delivered'
        order by occurred_at desc nulls last
        limit $2 offset $3
        `,
        [uid, take + 1, skip],
      ),
    ])

    const summaryRow = summaryRes.rows[0] ?? {}
    const itemsRaw = itemsRes.rows ?? []
    const hasMore = itemsRaw.length > take
    const sliced = itemsRaw.slice(0, take)

    return {
      summary: {
        role: r,
        completed_total: Number(summaryRow.completed_total ?? 0),
        completed_90d: Number(summaryRow.completed_90d ?? 0),
        since: summaryRow.since ?? null,
        top_categories: (topRes.rows ?? []).map((x) => ({ category: normalizeCategory(x.category), count: Number(x.n ?? 0) })),
      },
      items: sliced.map((x) => ({
        context_type: 'order',
        context_id: x.context_id,
        title: x.product_name ? `Order delivered: ${String(x.product_name)}` : 'Order delivered',
        category: normalizeCategory(x.category),
        location: coarseLocationLabel(x.delivery_address),
        occurred_at: x.occurred_at ?? null,
        outcome: outcomeFromDisputeStatus(x.dispute_status),
      })),
      has_more: hasMore,
    }
  }

  // driver
  const [summaryRes, itemsRes] = await Promise.all([
    pool.query(
      `
      select
        count(*) filter (where d.status in ('delivered','confirmed'))::int as completed_total,
        count(*) filter (where d.status in ('delivered','confirmed') and d.updated_at >= now() - interval '90 days')::int as completed_90d,
        min(d.created_at) as since
      from deliveries d
      where d.driver_user_id = $1
      `,
      [uid],
    ),
    pool.query(
      `
      select
        d.id as context_id,
        'delivery'::text as context_type,
        p.name as product_name,
        coalesce(d.confirmed_at, d.delivered_at, d.updated_at, d.created_at) as occurred_at,
        d.pickup_location,
        d.dropoff_location
      from deliveries d
      left join orders o on o.id = d.order_id
      left join products p on p.id = o.product_id
      where d.driver_user_id = $1
        and d.status in ('delivered','confirmed')
      order by occurred_at desc nulls last
      limit $2 offset $3
      `,
      [uid, take + 1, skip],
    ),
  ])

  const summaryRow = summaryRes.rows[0] ?? {}
  const itemsRaw = itemsRes.rows ?? []
  const hasMore = itemsRaw.length > take
  const sliced = itemsRaw.slice(0, take)

  return {
    summary: {
      role: r,
      completed_total: Number(summaryRow.completed_total ?? 0),
      completed_90d: Number(summaryRow.completed_90d ?? 0),
      since: summaryRow.since ?? null,
      top_categories: [],
    },
    items: sliced.map((x) => ({
      context_type: 'delivery',
      context_id: x.context_id,
      title: x.product_name ? `Delivery completed: ${String(x.product_name)}` : 'Delivery completed',
      category: 'Delivery',
      location: coarseLocationLabel(x.dropoff_location) ?? coarseLocationLabel(x.pickup_location),
      occurred_at: x.occurred_at ?? null,
      outcome: 'completed',
    })),
    has_more: hasMore,
  }
}

