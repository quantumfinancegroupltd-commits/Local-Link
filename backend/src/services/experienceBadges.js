import { pool } from '../db/pool.js'

function daysBetween(a, b) {
  const t1 = a instanceof Date ? a.getTime() : new Date(a).getTime()
  const t2 = b instanceof Date ? b.getTime() : new Date(b).getTime()
  if (!Number.isFinite(t1) || !Number.isFinite(t2)) return null
  return Math.max(0, Math.floor((t2 - t1) / (24 * 3600 * 1000)))
}

function pushBadge(list, badge) {
  if (!badge?.key) return
  if (list.some((b) => b.key === badge.key)) return
  list.push(badge)
}

function withWhy(badge, why) {
  if (!badge) return badge
  const w = String(why ?? '').trim()
  return w ? { ...badge, why: w } : badge
}

function milestoneBadge(kind, n) {
  const count = Number(n ?? 0)
  if (!Number.isFinite(count) || count <= 0) return null

  const steps = [10, 50, 100, 250, 500]
  const hit = [...steps].reverse().find((s) => count >= s) ?? null
  if (!hit) return null

  const title =
    kind === 'jobs'
      ? `${hit}+ jobs completed`
      : kind === 'orders'
        ? `${hit}+ orders delivered`
        : kind === 'deliveries'
          ? `${hit}+ deliveries completed`
          : `${hit}+ completed`

  return {
    key: `${kind}_${hit}`,
    title,
    tone: hit >= 100 ? 'emerald' : hit >= 50 ? 'blue' : 'slate',
    meta: { threshold: hit, count },
  }
}

function tenureBadges(createdAt) {
  const out = []
  const days = daysBetween(createdAt, new Date())
  if (days == null) return out

  const years = days / 365
  if (years >= 2) pushBadge(out, withWhy({ key: 'tenure_2y', title: '2+ years active', tone: 'emerald', meta: { days } }, `Active on LocalLink for ${days} days.`))
  else if (years >= 1) pushBadge(out, withWhy({ key: 'tenure_1y', title: '1+ year active', tone: 'blue', meta: { days } }, `Active on LocalLink for ${days} days.`))
  else if (days >= 90) pushBadge(out, withWhy({ key: 'tenure_3m', title: '3+ months active', tone: 'slate', meta: { days } }, `Active on LocalLink for ${days} days.`))
  return out
}

export async function computeExperienceBadges(userId) {
  const uid = String(userId)

  const userRes = await pool.query(
    `select id, role, created_at, id_verified
     from users
     where id = $1 and deleted_at is null`,
    [uid],
  )
  const u = userRes.rows[0]
  if (!u) return null

  const role = String(u.role || '')

  const [ver, endorseTotals, noShow] = await Promise.all([
    pool.query(`select coalesce(level, 'unverified') as tier from verification_levels where user_id = $1`, [uid]),
    pool.query(
      `select
         count(*)::int as total_endorsements,
         count(distinct endorser_user_id)::int as total_endorsers
       from skill_endorsements
       where provider_user_id = $1`,
      [uid],
    ),
    pool.query(
      `select count(*)::int as n
       from policy_events
       where user_id = $1
         and kind = 'no_show'
         and created_at >= now() - interval '90 days'`,
      [uid],
    ),
  ])

  const verificationTier = ver.rows[0]?.tier ?? 'unverified'
  const totalEndorsers = Number(endorseTotals.rows[0]?.total_endorsers ?? 0)
  const noShows90d = Number(noShow.rows[0]?.n ?? 0)

  const badges = []

  // Identity / verification
  if (u.id_verified) pushBadge(badges, withWhy({ key: 'id_verified', title: 'Ghana Card verified', tone: 'emerald' }, 'Your Ghana Card verification was approved.'))
  if (verificationTier && verificationTier !== 'unverified') {
    pushBadge(
      badges,
      withWhy(
        { key: `tier_${verificationTier}`, title: `${String(verificationTier).toUpperCase()} verification`, tone: 'blue' },
        `Verification level: ${String(verificationTier).toUpperCase()}.`,
      ),
    )
  }

  // Tenure
  for (const b of tenureBadges(u.created_at)) pushBadge(badges, b)

  // Endorsements
  if (totalEndorsers >= 20)
    pushBadge(
      badges,
      withWhy(
        { key: 'endorsed_20', title: `Endorsed by ${totalEndorsers} clients`, tone: 'emerald', meta: { endorsers: totalEndorsers } },
        'Based on verified, post-transaction skill endorsements from clients.',
      ),
    )
  else if (totalEndorsers >= 5)
    pushBadge(
      badges,
      withWhy(
        { key: 'endorsed_5', title: `Endorsed by ${totalEndorsers} clients`, tone: 'blue', meta: { endorsers: totalEndorsers } },
        'Based on verified, post-transaction skill endorsements from clients.',
      ),
    )

  // Reliability streak (provider roles)
  if (['artisan', 'farmer', 'driver'].includes(role) && noShows90d === 0) {
    pushBadge(
      badges,
      withWhy(
        { key: 'noshow_free_90d', title: 'No-show free (90 days)', tone: 'emerald', meta: { window_days: 90 } },
        'No confirmed no-show reports in the last 90 days.',
      ),
    )
  }

  // Completion milestones per role
  if (role === 'artisan') {
    const r = await pool.query(
      `select count(*) filter (where j.status='completed')::int as n
       from jobs j
       join artisans a on a.id = j.assigned_artisan_id
       where a.user_id = $1`,
      [uid],
    )
    const n = Number(r.rows[0]?.n ?? 0)
    const m = milestoneBadge('jobs', n)
    if (m) pushBadge(badges, withWhy(m, 'Based on jobs marked completed on LocalLink.'))
  } else if (role === 'farmer') {
    const r = await pool.query(
      `select count(*) filter (where o.order_status='delivered')::int as n
       from orders o
       join farmers f on f.id = o.farmer_id
       where f.user_id = $1`,
      [uid],
    )
    const n = Number(r.rows[0]?.n ?? 0)
    const m = milestoneBadge('orders', n)
    if (m) pushBadge(badges, withWhy(m, 'Based on orders marked delivered on LocalLink.'))
  } else if (role === 'driver') {
    const r = await pool.query(
      `select count(*) filter (where d.status in ('delivered','confirmed'))::int as n
       from deliveries d
       where d.driver_user_id = $1`,
      [uid],
    )
    const n = Number(r.rows[0]?.n ?? 0)
    const m = milestoneBadge('deliveries', n)
    if (m) pushBadge(badges, withWhy(m, 'Based on deliveries marked delivered/confirmed on LocalLink.'))
  }

  // Sort: strongest first (simple tone-based + stable title)
  const toneRank = { emerald: 3, blue: 2, slate: 1 }
  badges.sort((a, b) => (toneRank[String(b.tone)] ?? 0) - (toneRank[String(a.tone)] ?? 0) || String(a.title).localeCompare(String(b.title)))

  return {
    user_id: uid,
    role,
    computed_at: new Date().toISOString(),
    badges: badges.slice(0, 20),
  }
}

