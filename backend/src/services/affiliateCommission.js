/**
 * Affiliate commission: when a referred user's escrow is released (job or order),
 * award commission = platformFee * affiliate.commission_rate (first 30 days only).
 * Fraud: no self-referral, one commission per escrow (idempotent).
 */

import { pool } from '../db/pool.js'

const COMMISSION_WINDOW_DAYS = 30

/**
 * Call inside a transaction (client) after escrow release.
 * @param {object} client - pg client (transaction)
 * @param {{ counterpartyUserId: string, platformFee: number, escrowId: string }} opts
 */
export async function tryAffiliateCommissionOnRelease(client, { counterpartyUserId, platformFee, escrowId }) {
  if (!counterpartyUserId || !escrowId || platformFee == null || Number(platformFee) <= 0) return

  const userRow = await client.query(
    `select id, affiliate_id, created_at, phone from users where id = $1 and deleted_at is null`,
    [counterpartyUserId],
  )
  const user = userRow.rows[0]
  if (!user || !user.affiliate_id) return

  const affiliateRow = await client.query(
    `select id, user_id, status, commission_rate, phone as affiliate_phone from affiliates where id = $1`,
    [user.affiliate_id],
  )
  const affiliate = affiliateRow.rows[0]
  if (!affiliate || affiliate.status !== 'approved') return

  // Self-referral: referred user must not be the affiliate's linked account
  if (affiliate.user_id && String(affiliate.user_id) === String(counterpartyUserId)) return

  // Fraud: same phone (affiliate application phone vs user phone)
  const userPhone = (user.phone || '').toString().trim()
  const affPhone = (affiliate.affiliate_phone || '').toString().trim()
  if (userPhone && affPhone && userPhone === affPhone) return

  const createdAt = user.created_at ? new Date(user.created_at).getTime() : null
  if (!createdAt || !Number.isFinite(createdAt)) return
  const windowEnd = createdAt + COMMISSION_WINDOW_DAYS * 24 * 60 * 60 * 1000
  if (Date.now() > windowEnd) return

  // Idempotency: already have a commission for this escrow
  const existing = await client.query(
    'select 1 from commissions where affiliate_id = $1 and escrow_id = $2 limit 1',
    [affiliate.id, escrowId],
  )
  if (existing.rows[0]) return

  const rate = Number(affiliate.commission_rate ?? 0.07)
  const amount = Math.round(Number(platformFee) * rate * 100) / 100
  if (amount <= 0) return

  const periodEnd = new Date(createdAt)
  periodEnd.setDate(periodEnd.getDate() + COMMISSION_WINDOW_DAYS)
  const periodStart = new Date(createdAt)
  const periodStartStr = periodStart.toISOString().slice(0, 10)
  const periodEndStr = periodEnd.toISOString().slice(0, 10)

  const exists = await client.query(
    'select 1 from commissions where affiliate_id = $1 and escrow_id = $2 limit 1',
    [affiliate.id, escrowId],
  )
  if (exists.rows[0]) return

  await client.query(
    `insert into commissions (affiliate_id, referred_user_id, amount, status, period_start, period_end, escrow_id)
     values ($1,$2,$3,'pending',$4::date,$5::date,$6)`,
    [affiliate.id, counterpartyUserId, amount, periodStartStr, periodEndStr, escrowId],
  )
  await client.query(
    `update affiliates set total_earned = total_earned + $1, updated_at = now() where id = $2`,
    [amount, affiliate.id],
  )
}

/**
 * Recompute tier and commission_rate for an affiliate based on active referred users (this month).
 * Tier 1: 7% (default), 2: 10%, 3: 15%. Thresholds: 10, 25, 50 active users.
 * Can be called with pool (no transaction) for dashboard refresh.
 */
export async function updateAffiliateTier(clientOrPool, affiliateId) {
  const r = await clientOrPool.query(
    `select count(*)::int as n from users u
     where u.affiliate_id = $1 and u.deleted_at is null
       and (exists (select 1 from escrow_transactions e where e.counterparty_user_id = u.id and e.status in ('released','refunded'))
            or exists (select 1 from orders o where o.buyer_id = u.id or o.farmer_id = u.id))`,
    [affiliateId],
  )
  const n = Number(r.rows[0]?.n ?? 0)
  let tierLevel = 1
  let rate = 0.07
  if (n >= 50) {
    tierLevel = 3
    rate = 0.15
  } else if (n >= 25) {
    tierLevel = 2
    rate = 0.1
  } else if (n >= 10) {
    tierLevel = 1
    rate = 0.07
  }
  await clientOrPool.query(
    'update affiliates set tier_level = $1, commission_rate = $2, updated_at = now() where id = $3',
    [tierLevel, rate, affiliateId],
  )
}
