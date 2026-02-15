import { pool } from '../db/pool.js'

function clamp(n, a, b) {
  const x = Number(n)
  if (!Number.isFinite(x)) return a
  return Math.max(a, Math.min(b, x))
}

function daysSince(ts) {
  if (!ts) return null
  const t = ts instanceof Date ? ts.getTime() : new Date(ts).getTime()
  if (!Number.isFinite(t)) return null
  return (Date.now() - t) / (24 * 3600 * 1000)
}

function bandFor(score) {
  const s = Number(score)
  if (!Number.isFinite(s)) return 'low'
  if (s >= 80) return 'high'
  if (s >= 55) return 'medium'
  return 'low'
}

function pushImprove(list, key, title, body, ctaUrl) {
  if (list.some((x) => x.key === key)) return
  list.push({ key, title, body, cta_url: ctaUrl })
}

export async function buildTrustReport(userId, { includeRaw = false } = {}) {
  const uid = String(userId)

  const userRes = await pool.query(
    `select id, role, rating, trust_score, last_active_at, created_at, profile_pic
     from users
     where id = $1 and deleted_at is null`,
    [uid],
  )
  const u = userRes.rows[0]
  if (!u) return null

  const [ver, profile, resume, policy, myTx, disputes, snap] = await Promise.all([
    pool.query(`select coalesce(level, 'unverified') as tier from verification_levels where user_id = $1`, [uid]),
    pool.query(`select bio, links, cover_photo from user_profiles where user_id = $1`, [uid]),
    pool.query(`select count(*)::int as n from user_resume_entries where user_id = $1`, [uid]),
    pool.query(
      `select
         count(*) filter (where kind='phone_leak' and created_at >= now() - interval '30 days')::int as phone_leaks_30d,
         count(*) filter (where kind='off_platform_link' and created_at >= now() - interval '30 days')::int as off_platform_30d,
         count(*) filter (where kind='no_show' and created_at >= now() - interval '90 days')::int as no_shows_90d,
         count(*) filter (where kind='phone_leak')::int as phone_leaks_all
       from policy_events
       where user_id = $1`,
      [uid],
    ),
    pool.query(
      `select
         count(*) filter (where type='job' and buyer_id = $1 and created_at >= now() - interval '90 days')::int as jobs_started_90d,
         count(*) filter (where type='order' and buyer_id = $1 and created_at >= now() - interval '90 days')::int as orders_started_90d,
         count(*) filter (
           where created_at >= now() - interval '90 days'
             and (meta->>'cancelled_by')::text = $2
         )::int as cancels_90d,
         count(*) filter (
           where created_at >= now() - interval '365 days'
             and (meta->>'cancelled_by')::text = $2
         )::int as cancels_365d
       from escrow_transactions`,
      [uid, uid],
    ),
    pool.query(
      `select
         d.id,
         d.status,
         d.raised_by_user_id,
         d.created_at,
         e.amount,
         e.buyer_id,
         e.counterparty_user_id,
         d.resolution
       from disputes d
       join escrow_transactions e on e.id = d.escrow_id
       where (e.buyer_id = $1 or e.counterparty_user_id = $1 or d.raised_by_user_id = $1)`,
      [uid],
    ),
    pool
      .query(`select user_id, score_100, band, components, computed_at from trust_snapshots where user_id = $1`, [uid])
      .catch(() => ({ rows: [] })),
  ])

  const verificationTier = ver.rows[0]?.tier ?? 'unverified'
  const snapRow = snap.rows?.[0] ?? null
  const hasV2 = Boolean(snapRow?.user_id)

  const base01 = hasV2 ? clamp(Number(snapRow.score_100 ?? 0) / 100, 0, 1) : clamp(u.trust_score ?? 0, 0, 1)
  const base = hasV2 ? Math.round(Number(snapRow.score_100 ?? 0) * 10) / 10 : Math.round(base01 * 1000) / 10 // 0..100 with 0.1 precision

  const phoneLeaks30d = Number(policy.rows[0]?.phone_leaks_30d ?? 0)
  const offPlatform30d = Number(policy.rows[0]?.off_platform_30d ?? 0)
  const noShows90d = Number(policy.rows[0]?.no_shows_90d ?? 0)
  const cancels90d = Number(myTx.rows[0]?.cancels_90d ?? 0)
  const started90d = Number(myTx.rows[0]?.jobs_started_90d ?? 0) + Number(myTx.rows[0]?.orders_started_90d ?? 0)

  const daysInactive = daysSince(u.last_active_at)
  const daysOld = daysSince(u.created_at)

  let disputesOpen = 0
  let disputesTotal = 0
  let disputesLost = 0
  let disputesSplit = 0
  let disputesRaised = 0
  let disputesAgainst = 0

  for (const d of disputes.rows) {
    disputesTotal += 1
    if (d.status === 'open' || d.status === 'under_review') disputesOpen += 1
    if (d.raised_by_user_id === uid) disputesRaised += 1
    if (d.raised_by_user_id !== uid && (d.buyer_id === uid || d.counterparty_user_id === uid)) disputesAgainst += 1

    if (d.status === 'resolved' && d.resolution) {
      const total = Number(d.amount ?? 0)
      const sellerAmount = Number(d.resolution?.seller_amount ?? d.resolution?.sellerAmount ?? null)
      const buyerAmount = Number(d.resolution?.buyer_amount ?? d.resolution?.buyerAmount ?? null)
      if (Number.isFinite(total) && total > 0 && Number.isFinite(sellerAmount) && Number.isFinite(buyerAmount)) {
        const isBuyer = d.buyer_id === uid
        const isSeller = d.counterparty_user_id === uid
        if (isBuyer && buyerAmount <= 0 && sellerAmount >= total - 0.0001) disputesLost += 1
        else if (isSeller && sellerAmount <= 0 && buyerAmount >= total - 0.0001) disputesLost += 1
        else if ((isBuyer || isSeller) && sellerAmount > 0 && buyerAmount > 0) disputesSplit += 1
      }
    }
  }

  // --- Adjustments (transparent, non-ML) ---
  const penalties = []
  const boosts = []

  // Phone leakage attempts (anti-off-platform)
  if (phoneLeaks30d > 0) {
    const pts = Math.min(25, phoneLeaks30d * 8)
    penalties.push({ key: 'phone_leaks_30d', label: 'Off-platform contact attempts', points: pts, details: { phone_leaks_30d: phoneLeaks30d } })
  }

  // Off-platform links (WhatsApp links etc.)
  if (offPlatform30d > 0) {
    const pts = Math.min(20, offPlatform30d * 6)
    penalties.push({
      key: 'off_platform_links_30d',
      label: 'Off-platform links shared',
      points: pts,
      details: { off_platform_30d: offPlatform30d },
    })
  }

  // No-shows (provider reliability)
  if (noShows90d > 0) {
    const pts = Math.min(30, noShows90d * 10)
    penalties.push({ key: 'no_shows_90d', label: 'No-shows / missed commitments', points: pts, details: { no_shows_90d: noShows90d } })
  }

  // Cancellations: only meaningful if user actually started transactions
  if (cancels90d > 0) {
    const rate = started90d > 0 ? cancels90d / started90d : null
    const pts = Math.min(20, cancels90d * 5 + (rate != null && rate >= 0.35 ? 5 : 0))
    penalties.push({
      key: 'cancellations_90d',
      label: 'Recent cancellations',
      points: pts,
      details: { cancels_90d: cancels90d, started_90d: started90d, cancel_rate_90d: rate },
    })
  }

  // Disputes: open disputes and lost disputes
  if (disputesOpen > 0) {
    const pts = Math.min(20, disputesOpen * 8)
    penalties.push({ key: 'disputes_open', label: 'Active disputes', points: pts, details: { disputes_open: disputesOpen } })
  }
  if (disputesLost > 0) {
    const pts = Math.min(30, disputesLost * 12)
    penalties.push({ key: 'disputes_lost', label: 'Dispute losses', points: pts, details: { disputes_lost: disputesLost } })
  }
  if (disputesSplit > 0) {
    const pts = Math.min(10, disputesSplit * 4)
    penalties.push({ key: 'disputes_split', label: 'Split disputes', points: pts, details: { disputes_split: disputesSplit } })
  }

  // Inactivity
  if (daysInactive != null) {
    if (daysInactive > 30) penalties.push({ key: 'inactive_30d', label: 'Inactive (30d+)', points: 15, details: { days_inactive: daysInactive } })
    else if (daysInactive > 7) penalties.push({ key: 'inactive_7d', label: 'Inactive (7d+)', points: 8, details: { days_inactive: daysInactive } })
  }

  // Low-history guardrail
  if (daysOld != null && daysOld < 7) {
    penalties.push({ key: 'new_account', label: 'New account (low history)', points: 5, details: { account_age_days: daysOld } })
  }

  // Profile completeness boost (small)
  const bio = String(profile.rows[0]?.bio ?? '').trim()
  const links = profile.rows[0]?.links
  const hasLinks = Array.isArray(links) ? links.length > 0 : typeof links === 'string' ? links.trim().length > 0 : false
  const resumeN = Number(resume.rows[0]?.n ?? 0)
  const hasPic = Boolean(u.profile_pic)
  const completeBits = [hasPic, Boolean(bio), hasLinks, resumeN > 0].filter(Boolean).length
  if (completeBits >= 3) boosts.push({ key: 'profile_complete', label: 'Complete profile', points: 5, details: { complete_bits: completeBits } })
  else if (completeBits >= 2) boosts.push({ key: 'profile_partial', label: 'Profile progress', points: 2, details: { complete_bits: completeBits } })

  const penaltyTotal = penalties.reduce((s, p) => s + Number(p.points ?? 0), 0)
  const boostTotal = boosts.reduce((s, b) => s + Number(b.points ?? 0), 0)

  // If V2 snapshot exists, treat it as the final score to avoid double-penalizing.
  const score = hasV2 ? clamp(base, 0, 100) : clamp(base - penaltyTotal + boostTotal, 0, 100)
  const band = hasV2
    ? snapRow.band === 'excellent'
      ? 'high'
      : snapRow.band === 'good'
        ? 'medium'
        : 'low'
    : bandFor(score)

  // Risk flags (anti-gaming signals)
  const riskFlags = []
  if (phoneLeaks30d > 0) riskFlags.push({ key: 'phone_leak', label: 'Off-platform contact attempts (last 30d)' })
  if (offPlatform30d > 0) riskFlags.push({ key: 'off_platform_link', label: 'Shared off-platform links (last 30d)' })
  if (noShows90d > 0) riskFlags.push({ key: 'no_show', label: 'No-shows recorded (last 90d)' })
  if (disputesOpen > 0) riskFlags.push({ key: 'active_disputes', label: 'Has active dispute(s)' })
  if (disputesLost > 0) riskFlags.push({ key: 'dispute_loss', label: 'Has lost dispute(s)' })
  if (cancels90d >= 2 && started90d > 0 && cancels90d / started90d >= 0.35) riskFlags.push({ key: 'high_cancellation_rate', label: 'High cancellation rate (90d)' })
  if (daysInactive != null && daysInactive > 30) riskFlags.push({ key: 'inactive', label: 'Inactive (30d+)' })

  // How to improve (user-facing, actionable)
  const howToImprove = []
  if (!hasPic) pushImprove(howToImprove, 'add_photo', 'Add a clear profile photo', 'Real photos build trust and increase replies.', '/profile')
  if (!bio) pushImprove(howToImprove, 'add_bio', 'Write a short bio', 'Explain what you do and where you operate.', '/profile')
  if (resumeN === 0) pushImprove(howToImprove, 'add_experience', 'Add experience / education', 'This helps buyers choose you confidently.', '/profile')
  if (verificationTier === 'unverified') pushImprove(howToImprove, 'verify', 'Request verification', 'Verified accounts rank higher and convert better.', '/profile')
  if (daysInactive != null && daysInactive > 7) pushImprove(howToImprove, 'be_active', 'Stay active', 'Log in and respond quickly to keep your trust fresh.', '/')
  if (phoneLeaks30d > 0) pushImprove(howToImprove, 'stay_on_platform', 'Keep communication on LocalLink', 'Off-platform contact attempts reduce trust and may restrict your account.', '/messages')
  if (offPlatform30d > 0) pushImprove(howToImprove, 'remove_links', 'Remove WhatsApp links', 'Off-platform links reduce trust. Keep communication on LocalLink until escrow is secured.', '/profile')
  if (noShows90d > 0) pushImprove(howToImprove, 'reliability', 'Improve reliability', 'No-shows reduce ranking and may lead to a temporary freeze. Only accept work you can complete.', '/')
  if (disputesOpen > 0) pushImprove(howToImprove, 'resolve_disputes', 'Resolve open disputes', 'Respond with evidence and close disputes quickly.', '/profile')

  const report = {
    user: {
      id: u.id,
      role: u.role,
      rating: Number(u.rating ?? 0),
      verification_tier: verificationTier,
      last_active_at: u.last_active_at ?? null,
      created_at: u.created_at ?? null,
    },
    score: Math.round(score * 10) / 10,
    band,
    base_score: base,
    v2_band: hasV2 ? snapRow.band : null,
    components: hasV2 ? snapRow.components : null,
    boosts: hasV2 ? [] : boosts,
    penalties: hasV2 ? [] : penalties,
    penalty_total: hasV2 ? 0 : penaltyTotal,
    boost_total: hasV2 ? 0 : boostTotal,
    risk_flags: riskFlags,
    how_to_improve: howToImprove,
  }

  if (includeRaw) {
    report.raw = {
      phone_leaks_30d: phoneLeaks30d,
      cancels_90d: cancels90d,
      started_90d: started90d,
      disputes_total: disputesTotal,
      disputes_open: disputesOpen,
      disputes_lost: disputesLost,
      disputes_split: disputesSplit,
      disputes_raised: disputesRaised,
      disputes_against: disputesAgainst,
      profile_complete_bits: completeBits,
      trust_snapshot: hasV2
        ? {
            score_100: Number(snapRow.score_100 ?? 0),
            band: snapRow.band,
            computed_at: snapRow.computed_at ?? null,
          }
        : null,
    }
  }

  return report
}


