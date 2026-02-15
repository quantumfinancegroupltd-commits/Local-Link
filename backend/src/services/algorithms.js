import crypto from 'node:crypto'

export function clamp01(x) {
  const n = Number(x)
  if (!Number.isFinite(n)) return 0
  if (n < 0) return 0
  if (n > 1) return 1
  return n
}

export function haversineKm(aLat, aLng, bLat, bLng) {
  const lat1 = Number(aLat)
  const lng1 = Number(aLng)
  const lat2 = Number(bLat)
  const lng2 = Number(bLng)
  if (![lat1, lng1, lat2, lng2].every((v) => Number.isFinite(v))) return null

  const R = 6371 // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const s1 = Math.sin(dLat / 2)
  const s2 = Math.sin(dLng / 2)
  const q =
    s1 * s1 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * s2 * s2
  const c = 2 * Math.atan2(Math.sqrt(q), Math.sqrt(1 - q))
  return R * c
}

export function scoreDistance(distanceKm, nearKm = 2, farKm = 30) {
  if (distanceKm == null) return 0.5 // unknown distance should not zero someone out
  const d = Number(distanceKm)
  if (!Number.isFinite(d)) return 0.5 // unknown distance should not zero someone out
  if (d <= nearKm) return 1
  if (d >= farKm) return 0
  return clamp01(1 - (d - nearKm) / (farKm - nearKm))
}

export function scoreFreshness(createdAt, boostHours = 24, decayDays = 7) {
  const t = createdAt instanceof Date ? createdAt.getTime() : new Date(createdAt).getTime()
  if (!Number.isFinite(t)) return 0
  const ageMs = Date.now() - t
  if (ageMs <= 0) return 1
  const boostMs = boostHours * 3600 * 1000
  if (ageMs <= boostMs) return 1
  const decayMs = decayDays * 24 * 3600 * 1000
  const x = clamp01(1 - (ageMs - boostMs) / Math.max(decayMs, 1))
  // keep a small floor so older items are still discoverable
  return 0.15 + 0.85 * x
}

function tokenize(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((x) => x.trim())
    .filter(Boolean)
}

export function scoreSkillMatch(jobText, skills) {
  const tokens = new Set(tokenize(jobText))
  const skillList = Array.isArray(skills) ? skills : typeof skills === 'string' ? tokenize(skills) : []
  if (skillList.length === 0) return 0.5

  let hits = 0
  for (const raw of skillList) {
    const parts = tokenize(raw)
    if (parts.length === 0) continue
    // if any token for this skill appears, count as a hit
    if (parts.some((p) => tokens.has(p))) hits += 1
  }
  return clamp01(hits / Math.max(skillList.length, 1))
}

export function verificationScore(tier) {
  const t = String(tier || 'unverified').toLowerCase()
  if (t === 'gold') return 1
  if (t === 'silver') return 0.8
  if (t === 'bronze') return 0.6
  return 0
}

export function trustScore({ completionRate, ratingOutOf5, onTimeRate, verificationTier }) {
  const completion = clamp01(completionRate ?? 0)
  const rating = clamp01((Number(ratingOutOf5 ?? 0) || 0) / 5)
  const onTime = clamp01(onTimeRate ?? 0)
  const ver = verificationScore(verificationTier)
  return clamp01(completion * 0.35 + rating * 0.3 + onTime * 0.2 + ver * 0.15)
}

export function responseRateFromLastActive(lastActiveAt) {
  if (!lastActiveAt) return 0.4
  const t = lastActiveAt instanceof Date ? lastActiveAt.getTime() : new Date(lastActiveAt).getTime()
  if (!Number.isFinite(t)) return 0.4
  const days = (Date.now() - t) / (24 * 3600 * 1000)
  if (days <= 1) return 1
  if (days <= 7) return 0.7
  if (days <= 30) return 0.45
  return 0.25
}

export function deterministicJitter01(seed) {
  const h = crypto.createHash('sha256').update(String(seed)).digest()
  // 0..1 from first 4 bytes
  const n = h.readUInt32BE(0)
  return n / 0xffffffff
}

export function deliveryFeeGhs(distanceKm, baseFee, ratePerKm) {
  const d = Number(distanceKm)
  const base = Number(baseFee)
  const rate = Number(ratePerKm)
  if (!Number.isFinite(d) || d < 0) return Number.isFinite(base) ? base : 0
  const fee = (Number.isFinite(base) ? base : 0) + d * (Number.isFinite(rate) ? rate : 0)
  // Round to nearest 1 GHS for transparency
  return Math.max(0, Math.round(fee))
}

export function etaMinutes(distanceKm, speedKmh = 25) {
  const d = Number(distanceKm)
  const v = Number(speedKmh)
  if (!Number.isFinite(d) || d < 0 || !Number.isFinite(v) || v <= 0) return null
  return Math.max(1, Math.round((d / v) * 60))
}


