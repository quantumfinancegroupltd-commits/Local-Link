import { pool } from '../db/pool.js'
import { responseRateFromLastActive, verificationScore } from './algorithms.js'

function clamp(n, a, b) {
  const x = Number(n)
  if (!Number.isFinite(x)) return a
  return Math.max(a, Math.min(b, x))
}

function sigmoid(x) {
  const n = Number(x)
  if (!Number.isFinite(n)) return 0.5
  return 1 / (1 + Math.exp(-n))
}

function bandFor(score100) {
  const s = Number(score100)
  if (!Number.isFinite(s)) return 'restricted'
  if (s >= 80) return 'excellent'
  if (s >= 60) return 'good'
  if (s >= 40) return 'watch'
  return 'restricted'
}

function daysSince(ts) {
  if (!ts) return null
  const t = ts instanceof Date ? ts.getTime() : new Date(ts).getTime()
  if (!Number.isFinite(t)) return null
  return (Date.now() - t) / (24 * 3600 * 1000)
}

function identityPoints({ idVerified, verificationTier, phone, locationConfirmed }) {
  // Weight target: 20
  const ghanaId = idVerified ? 12 : 0
  const tierPts = Math.round(verificationScore(verificationTier) * 5) // up to 5
  const phonePts = phone ? 2 : 0
  const locPts = locationConfirmed ? 1 : 0
  return clamp(ghanaId + tierPts + phonePts + locPts, 0, 20)
}

function reliabilityPoints({ completed90d, noShows90d, cancels90d }) {
  // Weight target: 25
  // Evidence (rough v1): +2 per completion, heavy penalties for no-shows and cancellations.
  const E = Number(completed90d ?? 0) * 2 - Number(noShows90d ?? 0) * 15 - Number(cancels90d ?? 0) * 8
  // Map: start slightly below mid by default; allow good history to climb.
  const score01 = sigmoid((E - 4) / 10)
  return clamp(25 * score01, 0, 25)
}

function qualityPoints({ ratingOutOf5 }) {
  // Weight target: 25
  const r = clamp((Number(ratingOutOf5 ?? 0) || 0) / 5, 0, 1)
  // Keep a small floor so new users aren’t instantly “0”, but don’t over-reward.
  return clamp(25 * (0.15 + 0.85 * r), 0, 25)
}

function integrityPoints({ phoneLeaks30d, offPlatform30d }) {
  // Weight target: 15
  const penalty = Math.min(15, Number(phoneLeaks30d ?? 0) * 8 + Number(offPlatform30d ?? 0) * 6)
  return clamp(15 - penalty, 0, 15)
}

function responsivenessPoints({ lastActiveAt }) {
  // Weight target: 10
  const r = clamp(responseRateFromLastActive(lastActiveAt), 0, 1)
  return clamp(10 * r, 0, 10)
}

function tenurePoints({ createdAt }) {
  // Weight target: 5
  const ageDays = daysSince(createdAt)
  if (ageDays == null) return 0
  if (ageDays >= 365) return 5
  if (ageDays >= 180) return 4
  if (ageDays >= 90) return 3
  if (ageDays >= 30) return 2
  return 1
}

export function computeTrustSnapshotFromRow(row) {
  const identity = identityPoints({
    idVerified: !!row.id_verified,
    verificationTier: row.verification_tier ?? 'unverified',
    phone: row.phone,
    locationConfirmed: !!row.location_confirmed,
  })
  const reliability = reliabilityPoints({
    completed90d: row.completed_90d,
    noShows90d: row.no_shows_90d,
    cancels90d: row.cancels_90d,
  })
  const quality = qualityPoints({ ratingOutOf5: row.rating })
  const integrity = integrityPoints({ phoneLeaks30d: row.phone_leaks_30d, offPlatform30d: row.off_platform_30d })
  const responsiveness = responsivenessPoints({ lastActiveAt: row.last_active_at })
  const tenure = tenurePoints({ createdAt: row.created_at })

  const score100 = clamp(identity + reliability + quality + integrity + responsiveness + tenure, 0, 100)
  const band = bandFor(score100)

  return {
    score_100: Math.round(score100 * 10) / 10,
    band,
    components: {
      identity: {
        weight: 20,
        score: Math.round(identity * 10) / 10,
        signals: {
          id_verified: !!row.id_verified,
          verification_tier: row.verification_tier ?? 'unverified',
          phone_present: !!row.phone,
          location_confirmed: !!row.location_confirmed,
        },
      },
      reliability: {
        weight: 25,
        score: Math.round(reliability * 10) / 10,
        signals: {
          completed_90d: Number(row.completed_90d ?? 0),
          no_shows_90d: Number(row.no_shows_90d ?? 0),
          cancels_90d: Number(row.cancels_90d ?? 0),
        },
      },
      quality: {
        weight: 25,
        score: Math.round(quality * 10) / 10,
        signals: {
          rating_out_of_5: Number(row.rating ?? 0),
        },
      },
      integrity: {
        weight: 15,
        score: Math.round(integrity * 10) / 10,
        signals: {
          phone_leaks_30d: Number(row.phone_leaks_30d ?? 0),
          off_platform_30d: Number(row.off_platform_30d ?? 0),
        },
      },
      responsiveness: {
        weight: 10,
        score: Math.round(responsiveness * 10) / 10,
        signals: {
          last_active_at: row.last_active_at ?? null,
        },
      },
      tenure: {
        weight: 5,
        score: Math.round(tenure * 10) / 10,
        signals: {
          created_at: row.created_at ?? null,
        },
      },
    },
  }
}

export async function upsertTrustSnapshot({ userId, snapshot, writeHistory = false }) {
  const componentsJson = JSON.stringify(snapshot.components ?? {})
  const r = await pool.query(
    `insert into trust_snapshots (user_id, score_100, band, components, computed_at)
     values ($1,$2,$3,$4::jsonb, now())
     on conflict (user_id) do update set
       score_100 = excluded.score_100,
       band = excluded.band,
       components = excluded.components,
       computed_at = now()
     returning user_id, score_100, band, components, computed_at`,
    [userId, snapshot.score_100, snapshot.band, componentsJson],
  )
  if (writeHistory) {
    await pool.query(
      `insert into trust_snapshot_history (user_id, score_100, band, components, computed_at)
       values ($1,$2,$3,$4::jsonb, now())`,
      [userId, snapshot.score_100, snapshot.band, componentsJson],
    )
  }
  return r.rows[0]
}

