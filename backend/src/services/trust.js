import { pool } from '../db/pool.js'
import { computeTrustSnapshotFromRow, upsertTrustSnapshot } from './trustV2.js'

function clamp(n, a, b) {
  const x = Number(n)
  if (!Number.isFinite(x)) return a
  return Math.max(a, Math.min(b, x))
}

export async function recomputeTrustScores({ limit = 1000 } = {}) {
  // Build a single “signals” row per user, then compute a snapshot in JS.
  const r = await pool.query(
    `
    with
    policy as (
      select
        user_id,
        count(*) filter (where kind='phone_leak' and created_at >= now() - interval '30 days')::int as phone_leaks_30d,
        count(*) filter (where kind='off_platform_link' and created_at >= now() - interval '30 days')::int as off_platform_30d,
        count(*) filter (where kind='no_show' and created_at >= now() - interval '90 days')::int as no_shows_90d
      from policy_events
      group by user_id
    ),
    cancels as (
      select
        (meta->>'cancelled_by')::uuid as user_id,
        count(*) filter (where created_at >= now() - interval '90 days')::int as cancels_90d
      from escrow_transactions
      where meta ? 'cancelled_by'
      group by (meta->>'cancelled_by')::uuid
    ),
    artisan_completed as (
      select a.user_id, count(*)::int as completed_90d
      from jobs j
      join artisans a on a.id = j.assigned_artisan_id
      where j.status = 'completed'
        and j.created_at >= now() - interval '90 days'
      group by a.user_id
    ),
    farmer_completed as (
      select f.user_id, count(*)::int as completed_90d
      from orders o
      join farmers f on f.id = o.farmer_id
      where o.order_status = 'delivered'
        and o.created_at >= now() - interval '90 days'
      group by f.user_id
    ),
    driver_completed as (
      select d.driver_user_id as user_id, count(*)::int as completed_90d
      from deliveries d
      where d.status in ('delivered','confirmed')
        and d.created_at >= now() - interval '90 days'
        and d.driver_user_id is not null
      group by d.driver_user_id
    ),
    completed as (
      select user_id, sum(completed_90d)::int as completed_90d
      from (
        select * from artisan_completed
        union all
        select * from farmer_completed
        union all
        select * from driver_completed
      ) x
      group by user_id
    ),
    loc as (
      select
        u.id as user_id,
        (
          (a.service_lat is not null and a.service_lng is not null)
          or (f.farm_lat is not null and f.farm_lng is not null)
          or (d.last_location_at is not null)
        ) as location_confirmed
      from users u
      left join artisans a on a.user_id = u.id
      left join farmers f on f.user_id = u.id
      left join drivers d on d.user_id = u.id
    )
    select
      u.id as user_id,
      u.role,
      u.rating,
      u.phone,
      u.id_verified,
      u.last_active_at,
      u.created_at,
      coalesce(v.level, 'unverified') as verification_tier,
      coalesce(p.phone_leaks_30d, 0) as phone_leaks_30d,
      coalesce(p.off_platform_30d, 0) as off_platform_30d,
      coalesce(p.no_shows_90d, 0) as no_shows_90d,
      coalesce(c.cancels_90d, 0) as cancels_90d,
      coalesce(cm.completed_90d, 0) as completed_90d,
      coalesce(l.location_confirmed, false) as location_confirmed
    from users u
    left join verification_levels v on v.user_id = u.id
    left join policy p on p.user_id = u.id
    left join cancels c on c.user_id = u.id
    left join completed cm on cm.user_id = u.id
    left join loc l on l.user_id = u.id
    where u.deleted_at is null
    order by u.created_at desc
    limit $1
    `,
    [Number(limit)],
  )

  let updated = 0
  for (const row of r.rows) {
    const userId = row.user_id
    const snap = computeTrustSnapshotFromRow(row)

    try {
      // eslint-disable-next-line no-await-in-loop
      await upsertTrustSnapshot({ userId, snapshot: snap, writeHistory: false })
    } catch {
      // best-effort: allow recompute to continue even if migrations aren't applied yet
    }

    // Keep existing ranking code working by mirroring to users.trust_score as 0..1
    const trust01 = clamp(snap.score_100 / 100, 0, 1)
    // eslint-disable-next-line no-await-in-loop
    await pool.query('update users set trust_score = $2, updated_at = updated_at where id = $1', [userId, trust01])
    // eslint-disable-next-line no-await-in-loop
    await pool.query('update drivers set trust_score = $2, updated_at = now() where user_id = $1', [userId, trust01])
    updated += 1
  }

  return { updated, mode: 'v2_snapshot' }
}


