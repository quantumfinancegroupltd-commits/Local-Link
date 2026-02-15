import test from 'node:test'
import assert from 'node:assert/strict'
import {
  clamp01,
  deliveryFeeGhs,
  deterministicJitter01,
  etaMinutes,
  haversineKm,
  responseRateFromLastActive,
  scoreDistance,
  scoreFreshness,
  scoreSkillMatch,
  trustScore,
  verificationScore,
} from '../src/services/algorithms.js'

test('clamp01 clamps to [0,1] and handles non-numbers', () => {
  assert.equal(clamp01(-1), 0)
  assert.equal(clamp01(0), 0)
  assert.equal(clamp01(0.2), 0.2)
  assert.equal(clamp01(1), 1)
  assert.equal(clamp01(2), 1)
  assert.equal(clamp01(NaN), 0)
})

test('haversineKm returns expected-ish distance', () => {
  // 1 degree of longitude at equator is ~111.32km
  const km = haversineKm(0, 0, 0, 1)
  assert.ok(km != null)
  assert.ok(km > 110 && km < 112)
})

test('scoreDistance behaves as expected', () => {
  assert.equal(scoreDistance(null), 0.5)
  assert.equal(scoreDistance(undefined), 0.5)
  assert.equal(scoreDistance(0, 2, 30), 1)
  assert.equal(scoreDistance(2, 2, 30), 1)
  assert.equal(scoreDistance(30, 2, 30), 0)
  const mid = scoreDistance(16, 2, 30)
  assert.ok(mid > 0 && mid < 1)
})

test('scoreFreshness yields 1 for very recent items and decays toward a floor', () => {
  const now = new Date()
  assert.equal(scoreFreshness(now, 24, 7), 1)

  const tenDaysAgo = new Date(Date.now() - 10 * 24 * 3600 * 1000)
  const s = scoreFreshness(tenDaysAgo, 24, 7)
  assert.ok(s >= 0.15 && s <= 1)
})

test('scoreSkillMatch matches tokens', () => {
  assert.equal(scoreSkillMatch('plumbing needed for sink', ['plumbing', 'welding']), 0.5) // 1 hit / 2 skills
  assert.equal(scoreSkillMatch('I need welding', ['welding']), 1)
  assert.equal(scoreSkillMatch('I need a welder', []), 0.5)
})

test('verificationScore and trustScore behave', () => {
  assert.equal(verificationScore('unverified'), 0)
  assert.equal(verificationScore('bronze'), 0.6)
  assert.equal(verificationScore('silver'), 0.8)
  assert.equal(verificationScore('gold'), 1)

  const t = trustScore({ completionRate: 1, ratingOutOf5: 5, onTimeRate: 1, verificationTier: 'gold' })
  assert.ok(t >= 0.99 && t <= 1)
})

test('responseRateFromLastActive tiers by recency', () => {
  assert.equal(responseRateFromLastActive(new Date()), 1)
  assert.equal(responseRateFromLastActive(new Date(Date.now() - 2 * 24 * 3600 * 1000)), 0.7)
  assert.equal(responseRateFromLastActive(new Date(Date.now() - 8 * 24 * 3600 * 1000)), 0.45)
  assert.equal(responseRateFromLastActive(new Date(Date.now() - 60 * 24 * 3600 * 1000)), 0.25)
})

test('deterministicJitter01 is stable and within [0,1]', () => {
  const a = deterministicJitter01('seed-1')
  const b = deterministicJitter01('seed-1')
  const c = deterministicJitter01('seed-2')
  assert.equal(a, b)
  assert.ok(a >= 0 && a <= 1)
  assert.ok(c >= 0 && c <= 1)
})

test('deliveryFeeGhs and etaMinutes', () => {
  assert.equal(deliveryFeeGhs(0, 10, 4), 10)
  assert.equal(deliveryFeeGhs(2.2, 10, 4), 19) // 10 + 8.8 => 18.8 rounds to 19
  assert.equal(etaMinutes(25, 25), 60)
  assert.equal(etaMinutes(-1, 25), null)
})


