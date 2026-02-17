import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import {
  deterministicJitter01,
  haversineKm,
  responseRateFromLastActive,
  scoreDistance,
  scoreFreshness,
  scoreSkillMatch,
  trustScore as trustScore01,
  verificationScore,
} from '../services/algorithms.js'

export const matchRouter = Router()

const ArtisanMatchQuery = z.object({
  q: z.string().optional(),
  jobId: z.string().uuid().optional(),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  limit: z.coerce.number().optional().default(30),
})

// Buyer matching: fair + transparent artisan ranking
matchRouter.get('/artisans', requireAuth, requireRole(['buyer', 'admin']), asyncHandler(async (req, res) => {
  const parsed = ArtisanMatchQuery.safeParse(req.query)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  let queryText = String(parsed.data.q ?? '').trim()
  if (!queryText && parsed.data.jobId) {
    const jr = await pool.query('select title, description from jobs where id = $1', [parsed.data.jobId])
    queryText = `${jr.rows[0]?.title ?? ''} ${jr.rows[0]?.description ?? ''}`.trim()
  }

  const rows = await pool.query(
    `select a.*,
            u.id as user_id,
            u.name, u.role, u.rating, u.profile_pic, u.trust_score, u.last_active_at,
            coalesce(v.level, 'unverified') as verification_tier
     from artisans a
     join users u on u.id = a.user_id
     left join verification_levels v on v.user_id = u.id
     where u.deleted_at is null
       and (u.suspended_until is null or u.suspended_until <= now())
     order by a.created_at desc
     limit 500`,
  )

  const origin = parsed.data.lat != null && parsed.data.lng != null ? { lat: parsed.data.lat, lng: parsed.data.lng } : null

  const userIds = rows.rows.map((r) => r.user_id).filter(Boolean)
  const penaltyByUser = new Map()
  if (userIds.length) {
    const p = await pool.query(
      `select user_id,
              count(*) filter (where kind='no_show')::int as no_shows_90d,
              count(*) filter (where kind='off_platform_link')::int as off_platform_90d
       from policy_events
       where user_id = any($1::uuid[])
         and created_at > now() - interval '90 days'
       group by user_id`,
      [userIds],
    )
    for (const row of p.rows) {
      penaltyByUser.set(String(row.user_id), {
        no_shows_90d: Number(row.no_shows_90d ?? 0),
        off_platform_90d: Number(row.off_platform_90d ?? 0),
      })
    }
  }

  const scored = rows.rows.map((r) => {
    const distKm = origin ? haversineKm(origin.lat, origin.lng, r.service_lat, r.service_lng) : null
    const sSkill = scoreSkillMatch(queryText, r.skills)
    const sDist = origin ? scoreDistance(distKm) : 0.5

    const verTier = r.verification_tier ?? 'unverified'
    const fallbackTrust = trustScore01({
      completionRate: 0.6,
      ratingOutOf5: Number(r.rating ?? 0),
      onTimeRate: 0.6,
      verificationTier: verTier,
    })
    const trust01Raw = typeof r.trust_score === 'number' ? Math.max(0, Math.min(1, Number(r.trust_score))) : fallbackTrust
    const penalties = penaltyByUser.get(String(r.user_id)) ?? { no_shows_90d: 0, off_platform_90d: 0 }
    const penalty01 =
      Math.min(0.2, Number(penalties.no_shows_90d ?? 0) * 0.05) + Math.min(0.1, Number(penalties.off_platform_90d ?? 0) * 0.03)
    const trust01 = Math.max(0, Math.min(1, trust01Raw - penalty01))

    const response01 = responseRateFromLastActive(r.last_active_at)

    // Artisan Pro / premium: boost for featured placement
    const premiumBoost = r.premium ? 0.08 : 0

    // Weighted match score (0..1)
    const base =
      sSkill * 0.4 +
      sDist * 0.25 +
      trust01 * 0.25 +
      response01 * 0.1 +
      premiumBoost

    // Fair exposure: small daily jitter so results rotate without feeling random
    const jitter = deterministicJitter01(`${new Date().toISOString().slice(0, 10)}:${r.user_id}`) * 0.03

    const score01 = Math.max(0, Math.min(1, base + jitter))

    return {
      ...r,
      distance_km: distKm,
      match: {
        score: Math.round(score01 * 1000) / 1000,
        explain: {
          skill_match: Math.round(sSkill * 1000) / 1000,
          distance_score: Math.round(sDist * 1000) / 1000,
          trust_score: Math.round(trust01 * 1000) / 1000,
          reliability_penalty: Math.round(penalty01 * 1000) / 1000,
          no_shows_90d: penalties.no_shows_90d,
          off_platform_90d: penalties.off_platform_90d,
          response_rate: Math.round(response01 * 1000) / 1000,
          verification_tier: verTier,
        },
      },
    }
  })

  scored.sort((a, b) => (b.match?.score ?? 0) - (a.match?.score ?? 0))
  const limit = Math.min(Math.max(parsed.data.limit ?? 30, 1), 100)

  // Return nested user shape for frontend convenience
  const list = scored.slice(0, limit).map((row) => ({
    id: row.id,
    user_id: row.user_id,
    skills: row.skills,
    portfolio: row.portfolio,
    experience_years: row.experience_years,
    service_area: row.service_area,
    service_place_id: row.service_place_id ?? null,
    service_lat: row.service_lat ?? null,
    service_lng: row.service_lng ?? null,
    premium: row.premium,
    created_at: row.created_at,
    updated_at: row.updated_at,
    distance_km: row.distance_km,
    match: row.match,
    user: {
      id: row.user_id,
      name: row.name,
      role: row.role,
      rating: row.rating,
      profile_pic: row.profile_pic,
      trust_score: row.trust_score,
      verification_tier: row.verification_tier,
      verification_score: verificationScore(row.verification_tier),
    },
  }))

  return res.json({ query: queryText, origin, results: list })
}))

const ProductsRankQuery = z.object({
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  limit: z.coerce.number().optional().default(60),
})

// Buyer discovery: fair produce ranking (freshness boost + local + reliability + price competitiveness)
matchRouter.get('/products', requireAuth, requireRole(['buyer', 'admin']), asyncHandler(async (req, res) => {
  const parsed = ProductsRankQuery.safeParse(req.query)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const origin = parsed.data.lat != null && parsed.data.lng != null ? { lat: parsed.data.lat, lng: parsed.data.lng } : null

  // Pull listings + farmer trust context. Keep SQL simple for now; compute ranking in JS.
  const r = await pool.query(
    `select p.*,
            f.farm_lat, f.farm_lng, f.farm_location,
            u.id as farmer_user_id,
            u.rating as farmer_rating,
            u.trust_score as farmer_trust_score,
            coalesce(v.level, 'unverified') as verification_tier
     from products p
     left join farmers f on f.id = p.farmer_id
     left join users u on u.id = f.user_id
     left join verification_levels v on v.user_id = u.id
     where p.status = 'available'
       and u.deleted_at is null
       and (u.suspended_until is null or u.suspended_until <= now())
     order by p.created_at desc
     limit 500`,
  )

  // Category price medians (basic price competitiveness)
  const med = await pool.query(
    `select category,
            percentile_cont(0.5) within group (order by price) as median_price
     from products
     where status='available'
     group by category`,
  )
  const medianByCat = new Map(med.rows.map((x) => [String(x.category ?? ''), Number(x.median_price ?? 0)]))

  const farmerIds = r.rows.map((p) => p.farmer_user_id).filter(Boolean)
  const farmerPenaltyByUser = new Map()
  if (farmerIds.length) {
    const pr = await pool.query(
      `select user_id,
              count(*) filter (where kind='no_show')::int as no_shows_90d,
              count(*) filter (where kind='off_platform_link')::int as off_platform_90d
       from policy_events
       where user_id = any($1::uuid[])
         and created_at > now() - interval '90 days'
       group by user_id`,
      [farmerIds],
    )
    for (const row of pr.rows) {
      farmerPenaltyByUser.set(String(row.user_id), {
        no_shows_90d: Number(row.no_shows_90d ?? 0),
        off_platform_90d: Number(row.off_platform_90d ?? 0),
      })
    }
  }

  const ranked = r.rows.map((p) => {
    const createdAt = p.created_at
    const freshness = scoreFreshness(createdAt, 24, 7)

    const distKm = origin ? haversineKm(origin.lat, origin.lng, p.farm_lat, p.farm_lng) : null
    const local = origin ? scoreDistance(distKm, 3, 60) : 0.5

    const verTier = p.verification_tier ?? 'unverified'
    const ver = verificationScore(verTier)

    const farmerTrustRaw =
      typeof p.farmer_trust_score === 'number'
        ? Number(p.farmer_trust_score)
        : ver * 0.7 + (Number(p.farmer_rating ?? 0) / 5) * 0.3
    const fp = farmerPenaltyByUser.get(String(p.farmer_user_id)) ?? { no_shows_90d: 0, off_platform_90d: 0 }
    const penalty01 =
      Math.min(0.15, Number(fp.no_shows_90d ?? 0) * 0.05) + Math.min(0.1, Number(fp.off_platform_90d ?? 0) * 0.03)
    const reliability = Math.max(0, Math.min(1, Number(farmerTrustRaw ?? 0) - penalty01))

    const median = medianByCat.get(String(p.category ?? '')) ?? null
    const price = Number(p.price ?? 0)
    // 1.0 if cheaper than median, down to 0.0 if 2x median
    const priceScore =
      median && median > 0 ? Math.max(0, Math.min(1, 1 - Math.max(0, (price - median) / (median * 1.0)))) : 0.5

    const overstock = Number(p.quantity ?? 0) >= 50 ? 1 : 0

    // Ranking logic: base + boosts - penalties (penalties wired later via policy_events)
    const base = 0.4 * reliability + 0.25 * local + 0.25 * freshness + 0.1 * priceScore
    const jitter = deterministicJitter01(`${new Date().toISOString().slice(0, 10)}:${p.id}`) * 0.02
    const score = Math.max(0, Math.min(1, base + jitter))

    return {
      ...p,
      location: p.farm_location,
      distance_km: distKm,
      ranking: {
        score: Math.round(score * 1000) / 1000,
        explain: {
          freshness_boost: Math.round(freshness * 1000) / 1000,
          local_score: Math.round(local * 1000) / 1000,
          reliability_boost: Math.round(reliability * 1000) / 1000,
          reliability_penalty: Math.round(penalty01 * 1000) / 1000,
          no_shows_90d: fp.no_shows_90d,
          off_platform_90d: fp.off_platform_90d,
          price_competitiveness: Math.round(priceScore * 1000) / 1000,
          verification_tier: verTier,
          overstock_flag: overstock === 1,
        },
      },
    }
  })

  ranked.sort((a, b) => (b.ranking?.score ?? 0) - (a.ranking?.score ?? 0))
  const limit = Math.min(Math.max(parsed.data.limit ?? 60, 1), 200)
  return res.json({ origin, results: ranked.slice(0, limit) })
}))


