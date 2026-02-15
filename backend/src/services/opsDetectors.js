import { pool } from '../db/pool.js'
import { upsertOpsAlert } from './opsAlerts.js'

function toInt(x) {
  const n = Number(x)
  return Number.isFinite(n) ? Math.trunc(n) : 0
}

export async function computeStuckMoneySignals() {
  const [pending12h, completed12h, payouts6h] = await Promise.all([
    pool.query(
      `select count(*)::int as n
       from escrow_transactions
       where status = 'pending_payment'
         and created_at < now() - interval '12 hours'`,
    ),
    pool.query(
      `select count(*)::int as n
       from escrow_transactions
       where status = 'completed_pending_confirmation'
         and updated_at < now() - interval '12 hours'`,
    ),
    pool.query(
      `select count(*)::int as n
       from payouts
       where status in ('pending','processing')
         and updated_at < now() - interval '6 hours'`,
    ),
  ])

  return {
    escrows_pending_payment_stuck_12h: toInt(pending12h.rows[0]?.n),
    escrows_completed_pending_stuck_12h: toInt(completed12h.rows[0]?.n),
    payouts_stuck_6h: toInt(payouts6h.rows[0]?.n),
  }
}

export async function runStuckMoneyDetectors() {
  const signals = await computeStuckMoneySignals()

  if (signals.escrows_pending_payment_stuck_12h > 0) {
    const sample = await pool.query(
      `select id, type, job_id, order_id, buyer_id, amount, currency, provider, provider_ref, created_at, updated_at
       from escrow_transactions
       where status = 'pending_payment'
         and created_at < now() - interval '12 hours'
       order by created_at asc
       limit 20`,
    )
    await upsertOpsAlert({
      type: 'escrow_stuck',
      key: 'escrow_pending_payment_12h',
      severity: 'critical',
      message: `Escrow pending_payment stuck >12h (${signals.escrows_pending_payment_stuck_12h}).`,
      payload: { ...signals, sample: sample.rows },
    })
  }

  if (signals.escrows_completed_pending_stuck_12h > 0) {
    const sample = await pool.query(
      `select id, type, job_id, order_id, buyer_id, counterparty_user_id, amount, currency, created_at, updated_at
       from escrow_transactions
       where status = 'completed_pending_confirmation'
         and updated_at < now() - interval '12 hours'
       order by updated_at asc
       limit 20`,
    )
    await upsertOpsAlert({
      type: 'escrow_stuck',
      key: 'escrow_completed_pending_confirmation_12h',
      severity: 'warning',
      message: `Escrow completed_pending_confirmation stuck >12h (${signals.escrows_completed_pending_stuck_12h}).`,
      payload: { ...signals, sample: sample.rows },
    })
  }

  if (signals.payouts_stuck_6h > 0) {
    const sample = await pool.query(
      `select id, user_id, amount, currency, method, status, provider, provider_ref, created_at, updated_at
       from payouts
       where status in ('pending','processing')
         and updated_at < now() - interval '6 hours'
       order by updated_at asc
       limit 20`,
    )
    await upsertOpsAlert({
      type: 'payout_stuck',
      key: 'payouts_pending_processing_6h',
      severity: 'warning',
      message: `Payouts stuck (pending/processing) >6h (${signals.payouts_stuck_6h}).`,
      payload: { ...signals, sample: sample.rows },
    })
  }

  return signals
}

