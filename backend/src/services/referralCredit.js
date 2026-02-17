/** Credit referrer when a referred user completes their first job (escrow release to artisan). */

import { pool } from '../db/pool.js'
import { creditWalletTx } from './walletLedger.js'

const REFERRAL_CREDIT_AMOUNT_GHS = Number(process.env.REFERRAL_CREDIT_AMOUNT_GHS ?? 5)

export async function tryReferralCreditOnJobRelease(client, { refereeUserId }) {
  if (!refereeUserId) return
  const ref = await client.query(
    'select referrer_user_id from users where id = $1 and referrer_user_id is not null',
    [refereeUserId],
  )
  const referrerId = ref.rows[0]?.referrer_user_id ?? null
  if (!referrerId) return

  const idempotencyKey = `referral:${referrerId}:${refereeUserId}`
  const existing = await client.query(
    'select 1 from wallet_ledger_entries where user_id = $1 and idempotency_key = $2',
    [referrerId, idempotencyKey],
  )
  if (existing.rows[0]) return

  if (REFERRAL_CREDIT_AMOUNT_GHS <= 0) return

  await creditWalletTx(client, {
    userId: referrerId,
    amount: REFERRAL_CREDIT_AMOUNT_GHS,
    currency: 'GHS',
    kind: 'referral_credit',
    refType: 'user',
    refId: refereeUserId,
    idempotencyKey,
    meta: { referee_user_id: refereeUserId },
  })
}
