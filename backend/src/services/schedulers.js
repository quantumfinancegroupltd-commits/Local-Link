import { pool } from '../db/pool.js'
import { env } from '../config.js'
import { recomputeTrustScores } from './trust.js'
import { processWebhookQueue } from './webhookQueue.js'
import { runGuardedTask } from './opsGuardrails.js'
import { runStuckMoneyDetectors } from './opsDetectors.js'
import { runCompanyOpsAlertsSweep, runCompanyOpsWeeklyDigestSweep } from './companyOps.js'
import { runQuoteFollowUpNudge } from './quoteFollowUp.js'
import { runShiftCompletionSweep, runShiftCoverageAutoFillSweep, runShiftNoShowSweep, runShiftSeriesAutoGenerateSweep } from './workforce.js'
import { creditWalletTx } from './walletLedger.js'

async function runAutoOfflineDrivers() {
  // If a driver hasn't updated their location recently, they shouldn't be treated as “online”.
  // This keeps dispatch predictable and prevents stale availability.
  const r = await pool.query(
    `update drivers
     set is_online = false,
         updated_at = now()
     where is_online = true
       and (last_location_at is null or last_location_at < now() - interval '30 minutes')`,
  )
  return { offlined: r.rowCount }
}

async function runAutoReleaseJobs() {
  const hours = Number(env.AUTO_RELEASE_JOB_HOURS ?? 72)
  if (!Number.isFinite(hours) || hours <= 0) return { released: 0 }

  const client = await pool.connect()
  let released = 0
  try {
    await client.query('begin')

    const due = await client.query(
      `select e.*
       from escrow_transactions e
       join jobs j on j.id = e.job_id
       where e.type='job'
         and e.status='completed_pending_confirmation'
         and j.status='completed'
         and not exists (
           select 1 from disputes d
           where d.escrow_id = e.id
             and d.status in ('open','under_review')
         )
       order by e.updated_at asc
       limit 200
       for update of e`,
    )

    for (const e of due.rows) {
      if (!e.counterparty_user_id) continue
      const updatedAt = e.updated_at ? new Date(e.updated_at).getTime() : null
      const ageHours = updatedAt != null && Number.isFinite(updatedAt) ? (Date.now() - updatedAt) / (3600 * 1000) : null
      if (ageHours == null) continue

      // Incentive: faster auto-release for high-trust verified providers (still dispute-guarded above).
      let trust01 = 0
      let tier = 'unverified'
      try {
        const ur = await client.query(
          `select u.trust_score, coalesce(v.level, 'unverified') as verification_tier
           from users u
           left join verification_levels v on v.user_id = u.id
           where u.id = $1`,
          [e.counterparty_user_id],
        )
        const row = ur.rows[0] ?? null
        trust01 = typeof row?.trust_score === 'number' ? Math.max(0, Math.min(1, Number(row.trust_score))) : 0
        tier = String(row?.verification_tier ?? 'unverified')
      } catch {
        // best-effort; ignore
      }
      const effectiveHours = trust01 >= 0.8 && (tier === 'silver' || tier === 'gold') ? Math.max(24, hours - 24) : hours
      if (ageHours < effectiveHours) continue

      const feePct = Math.min(Math.max(env.PLATFORM_FEE_PCT_JOB ?? 0, 0), 0.25)
      const platformFee = Number(e.amount) * feePct
      const payout = Number(e.amount) - platformFee

      if (payout > 0) {
        await creditWalletTx(client, {
          userId: e.counterparty_user_id,
          amount: payout,
          currency: e.currency ?? 'GHS',
          kind: 'escrow_release',
          refType: 'escrow',
          refId: e.id,
          idempotencyKey: `escrow_release:${e.id}`,
          meta: { type: 'job', job_id: e.job_id, platform_fee: platformFee, auto_release: true },
        })
        const { tryReferralCreditOnJobRelease } = await import('./referralCredit.js')
        await tryReferralCreditOnJobRelease(client, { refereeUserId: e.counterparty_user_id })
      }
      await client.query(
        `update escrow_transactions
         set status='released', platform_fee=$2, updated_at=now(),
             meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object('auto_release', true)
         where id=$1`,
        [e.id, platformFee],
      )
      released += 1
    }

    await client.query('commit')
    return { released }
  } catch (e) {
    try {
      await client.query('rollback')
    } catch {}
    throw e
  } finally {
    client.release()
  }
}

async function runAutoConfirmDeliveries() {
  const hours = Number(env.AUTO_CONFIRM_DELIVERY_HOURS ?? 48)
  if (!Number.isFinite(hours) || hours <= 0) return { confirmed: 0 }

  const client = await pool.connect()
  let confirmed = 0
  try {
    await client.query('begin')

    const due = await client.query(
      `select d.*
       from deliveries d
       where d.status='delivered'
       order by coalesce(d.delivered_at, d.updated_at) asc
       limit 80
       for update`,
    )

    for (const d of due.rows) {
      const t0 = d.delivered_at ?? d.updated_at
      const ts = t0 ? new Date(t0).getTime() : null
      const ageHours = ts != null && Number.isFinite(ts) ? (Date.now() - ts) / (3600 * 1000) : null
      if (ageHours == null) continue

      // Incentive: faster auto-confirm when both farmer + driver are high-trust (keeps buyers safe via dispute guardrail below).
      let effectiveHours = hours
      try {
        const usersToCheck = [d.farmer_user_id, d.driver_user_id].filter(Boolean)
        if (usersToCheck.length) {
          const ur = await client.query(
            `select u.id, u.trust_score, coalesce(v.level, 'unverified') as verification_tier
             from users u
             left join verification_levels v on v.user_id = u.id
             where u.id = any($1::uuid[])`,
            [usersToCheck],
          )
          const ok = ur.rows.every((u) => {
            const trust01 = typeof u.trust_score === 'number' ? Math.max(0, Math.min(1, Number(u.trust_score))) : 0
            const tier = String(u.verification_tier ?? 'unverified')
            return trust01 >= 0.8 && (tier === 'silver' || tier === 'gold')
          })
          if (ok) effectiveHours = Math.max(24, hours - 12)
        }
      } catch {
        // best-effort; ignore
      }
      if (ageHours < effectiveHours) continue

      // Lock related escrows
      const escrowsRes = await client.query(
        `select * from escrow_transactions
         where type='order' and order_id = $1
         order by created_at asc
         for update`,
        [d.order_id],
      )
      const escrows = escrowsRes.rows
      if (escrows.length === 0) continue

      // Freeze auto-confirm if any active dispute exists for any related escrow row.
      const disputeRes = await client.query(
        `select 1
         from disputes
         where escrow_id = any($1::uuid[])
           and status in ('open','under_review')
         limit 1`,
        [escrows.map((e) => e.id)],
      )
      if (disputeRes.rowCount > 0) {
        continue
      }

      for (const e of escrows) {
        if (e.status !== 'held') continue
        if (!e.counterparty_user_id) continue

        const isDelivery = e.meta?.kind === 'delivery'
        const pct = isDelivery ? env.PLATFORM_FEE_PCT_DELIVERY : env.PLATFORM_FEE_PCT_ORDER
        const feePct = Math.min(Math.max(pct ?? 0, 0), 0.25)
        const platformFee = Number(e.amount) * feePct
        const payout = Number(e.amount) - platformFee

        if (payout > 0) {
          await creditWalletTx(client, {
            userId: e.counterparty_user_id,
            amount: payout,
            currency: e.currency ?? 'GHS',
            kind: 'escrow_release',
            refType: 'escrow',
            refId: e.id,
            idempotencyKey: `escrow_release:${e.id}`,
            meta: { type: 'order', order_id: e.order_id, kind: e.meta?.kind ?? null, platform_fee: platformFee, auto_confirm: true },
          })
        }
        await client.query(
          `update escrow_transactions
           set status='released', platform_fee=$2, updated_at=now(),
               meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object('auto_confirm', true)
           where id=$1`,
          [e.id, platformFee],
        )
      }

      await client.query(`update deliveries set status='confirmed', confirmed_at = now(), updated_at = now() where id = $1`, [d.id])
      await client.query(
        `update orders set payment_status='paid', order_status='delivered', updated_at = now() where id = $1`,
        [d.order_id],
      )
      confirmed += 1
    }

    await client.query('commit')
    return { confirmed }
  } catch (e) {
    try {
      await client.query('rollback')
    } catch {}
    throw e
  } finally {
    client.release()
  }
}

export function startSchedulers() {
  const intervalMs = 60_000
  // eslint-disable-next-line no-console
  console.log(
    `Schedulers: enabled=${env.SCHEDULERS_ENABLED} auto-release job=${env.AUTO_RELEASE_JOB_HOURS}h auto-confirm delivery=${env.AUTO_CONFIRM_DELIVERY_HOURS}h webhook-queue=${env.WEBHOOK_QUEUE_ENABLED}`,
  )

  if (!env.SCHEDULERS_ENABLED) return

  let running = false
  const tick = async () => {
    if (running) return
    running = true
    try {
      // Each task is isolated so one failure doesn't stop the rest.
      await runGuardedTask('auto_offline_drivers', runAutoOfflineDrivers, { baseDelayMs: 10_000, maxDelayMs: 10 * 60_000 })
      await runGuardedTask('auto_release_jobs', runAutoReleaseJobs, { baseDelayMs: 10_000, maxDelayMs: 15 * 60_000 })
      await runGuardedTask('auto_confirm_deliveries', runAutoConfirmDeliveries, { baseDelayMs: 10_000, maxDelayMs: 15 * 60_000 })
      await runGuardedTask('shift_series_auto_generate', () => runShiftSeriesAutoGenerateSweep({ limitSeries: 50 }), {
        baseDelayMs: 30_000,
        maxDelayMs: 30 * 60_000,
      })
      await runGuardedTask('shift_coverage_auto_fill', () => runShiftCoverageAutoFillSweep({ limitCompanies: 30, limitShiftsPerCompany: 25 }), {
        baseDelayMs: 30_000,
        maxDelayMs: 30 * 60_000,
      })

      if (env.WEBHOOK_QUEUE_ENABLED) {
        await runGuardedTask(
          'webhook_queue',
          () => processWebhookQueue({ limit: 25, maxAttempts: env.WEBHOOK_QUEUE_MAX_ATTEMPTS }),
          { baseDelayMs: 10_000, maxDelayMs: 30 * 60_000 },
        )
      }

      // Artisan: nudge buyers to review quotes if no response after 24h (one nudge per job).
      await runGuardedTask('quote_followup_nudge', () => runQuoteFollowUpNudge({ limit: 50 }), {
        baseDelayMs: 30_000,
        maxDelayMs: 60 * 60_000,
        successCooldownMs: 60 * 60_000,
      })

      // Keep trust_score reasonably fresh (safe best-effort; early stage scale is low)
      await runGuardedTask('trust_recompute', () => recomputeTrustScores({ limit: 2000 }), {
        baseDelayMs: 30_000,
        maxDelayMs: 60 * 60_000,
        successCooldownMs: 10 * 60_000,
      })

      // Ops detectors: catch silent money pipeline failures before users do.
      await runGuardedTask('ops_stuck_money_detectors', runStuckMoneyDetectors, {
        baseDelayMs: 30_000,
        maxDelayMs: 60 * 60_000,
        successCooldownMs: 5 * 60_000,
      })

      // Workforce ops: auto-mark no-shows after grace window (predictability).
      await runGuardedTask('shift_no_show_sweep', () => runShiftNoShowSweep({ limitShifts: 120, limitAssignments: 400 }), {
        baseDelayMs: 30_000,
        maxDelayMs: 60 * 60_000,
        successCooldownMs: 10 * 60_000,
      })

      // Workforce ops: close out shifts after check-outs (outcomes/metrics consistency).
      await runGuardedTask('shift_completion_sweep', () => runShiftCompletionSweep({ limitShifts: 200, limitAssignments: 1000 }), {
        baseDelayMs: 30_000,
        maxDelayMs: 60 * 60_000,
        successCooldownMs: 10 * 60_000,
      })

      // Company Ops alerts + digest (business-facing operational visibility).
      await runGuardedTask('company_ops_alerts', () => runCompanyOpsAlertsSweep({ limitCompanies: 40 }), {
        baseDelayMs: 30_000,
        maxDelayMs: 30 * 60_000,
        successCooldownMs: 10 * 60_000,
      })
      await runGuardedTask('company_ops_weekly_digest', () => runCompanyOpsWeeklyDigestSweep({ limitCompanies: 25 }), {
        baseDelayMs: 30_000,
        maxDelayMs: 60 * 60_000,
        successCooldownMs: 60 * 60_000,
      })
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Scheduler tick failed', e)
    } finally {
      running = false
    }
  }

  // initial tick shortly after boot
  setTimeout(tick, 5000)
  setInterval(tick, intervalMs)
}


