import { pool } from '../db/pool.js'
import { env } from '../config.js'
import { notify } from './notifications.js'
import { sendEmail } from './mailer.js'
import { upsertOpsAlert } from './opsAlerts.js'

function clampInt(v, a, b, fallback) {
  const x = Number(v)
  if (!Number.isFinite(x)) return fallback
  return Math.max(a, Math.min(b, Math.floor(x)))
}

async function recipientsForCompany(companyId) {
  let ids = []
  try {
    const m = await pool.query(
      `select m.user_id, u.email
       from company_members m
       join users u on u.id = m.user_id
       where m.company_id = $1
         and m.workspace_role in ('owner','ops')`,
      [companyId],
    )
    ids = (m.rows || []).map((r) => ({ user_id: r.user_id, email: r.email })).filter((r) => r.user_id)
  } catch (e) {
    if (String(e?.code || '') !== '42P01') throw e
  }

  try {
    const o = await pool.query(
      `select c.owner_user_id, u.email, c.name
       from companies c
       left join users u on u.id = c.owner_user_id
       where c.id = $1
       limit 1`,
      [companyId],
    )
    const row = o.rows[0] ?? null
    if (row?.owner_user_id) ids.push({ user_id: row.owner_user_id, email: row.email })
    return { recipients: Array.from(new Map(ids.map((r) => [String(r.user_id), r])).values()), companyName: row?.name ?? 'Company' }
  } catch {
    return { recipients: Array.from(new Map(ids.map((r) => [String(r.user_id), r])).values()), companyName: 'Company' }
  }
}

export async function runCompanyOpsAlertsSweep({ limitCompanies = 40 } = {}) {
  if (!env.COMPANY_OPS_ALERTS_ENABLED) return { ok: true, processed_companies: 0, sent: 0 }
  const intervalMin = clampInt(env.COMPANY_OPS_ALERTS_INTERVAL_MIN ?? 10, 1, 60, 10)

  // Only consider companies that have upcoming shifts within their configured window.
  const due = await pool
    .query(
      `select s.company_id,
              s.coverage_alert_lookahead_hours,
              s.coverage_alert_min_open_slots,
              s.reliability_alert_threshold_noshow_pct,
              s.coverage_alert_last_sent_at,
              s.reliability_alert_last_sent_at
       from company_ops_settings s
       where s.coverage_alert_enabled = true
         and exists (
           select 1
           from shift_blocks b
           where b.company_id = s.company_id
             and b.status = 'scheduled'
             and b.start_at >= now()
             and b.start_at < now() + (s.coverage_alert_lookahead_hours::text || ' hours')::interval
           limit 1
         )
         and (s.coverage_alert_last_sent_at is null or s.coverage_alert_last_sent_at < now() - ($1::text || ' minutes')::interval)
       order by coalesce(s.coverage_alert_last_sent_at, '1970-01-01'::timestamptz) asc
       limit $2`,
      [String(intervalMin), limitCompanies],
    )
    .catch((e) => {
      if (String(e?.code || '') === '42P01') return { rows: [] }
      throw e
    })

  let processed = 0
  let sent = 0

  for (const row of due.rows || []) {
    processed += 1
    const companyId = String(row.company_id)
    const lookaheadH = clampInt(row.coverage_alert_lookahead_hours ?? 72, 12, 336, 72)
    const minOpen = clampInt(row.coverage_alert_min_open_slots ?? 1, 1, 500, 1)
    const noShowPct = clampInt(row.reliability_alert_threshold_noshow_pct ?? 30, 10, 95, 30)

    // Coverage risk
    // eslint-disable-next-line no-await-in-loop
    const cov = await pool.query(
      `with stats as (
         select b.id,
                b.start_at,
                b.headcount,
                count(*) filter (where a.status in ('invited','accepted','checked_in','checked_out','completed'))::int as active_count
         from shift_blocks b
         left join shift_assignments a on a.shift_id = b.id
         where b.company_id = $1
           and b.status = 'scheduled'
           and b.start_at >= now()
           and b.start_at < now() + ($2::text || ' hours')::interval
         group by b.id
       )
       select
         count(*) filter (where greatest(0, headcount - active_count) > 0)::int as shifts_unfilled,
         coalesce(sum(greatest(0, headcount - active_count)), 0)::int as open_slots,
         min(start_at) filter (where greatest(0, headcount - active_count) > 0) as next_unfilled_at,
         (select jsonb_agg(x.id order by x.start_at asc)
          from (
            select id, start_at
            from stats
            where greatest(0, headcount - active_count) > 0
            order by start_at asc
            limit 10
          ) x) as shift_ids
       from stats`,
      [companyId, String(lookaheadH)],
    )

    const shiftsUnfilled = Number(cov.rows[0]?.shifts_unfilled ?? 0)
    const openSlots = Number(cov.rows[0]?.open_slots ?? 0)
    const nextUnfilledAt = cov.rows[0]?.next_unfilled_at ?? null
    const shiftIds = cov.rows[0]?.shift_ids ?? null

    if (openSlots >= minOpen && shiftsUnfilled > 0) {
      // eslint-disable-next-line no-await-in-loop
      const { recipients, companyName } = await recipientsForCompany(companyId)
      const soonMs = nextUnfilledAt ? new Date(nextUnfilledAt).getTime() : null
      const severity = soonMs != null && Number.isFinite(soonMs) && soonMs - Date.now() < 24 * 60 * 60 * 1000 ? 'critical' : 'warning'
      const title = severity === 'critical' ? 'Coverage risk (urgent)' : 'Coverage risk'
      const body = `${companyName}: ${shiftsUnfilled} shift(s) have ${openSlots} open slot(s) in the next ${lookaheadH}h.`
      const meta = {
        url: '/company?tab=ops',
        company_id: companyId,
        lookahead_hours: lookaheadH,
        shifts_unfilled: shiftsUnfilled,
        open_slots: openSlots,
        next_unfilled_at: nextUnfilledAt,
        shift_ids: shiftIds,
      }

      for (const r of recipients) {
        notify({
          userId: r.user_id,
          type: 'ops_coverage_alert',
          title,
          body,
          meta,
          dedupeKey: `coverage:${companyId}:${Math.floor(Date.now() / (60 * 60 * 1000))}`, // 1/hour
        }).catch(() => {})
      }
      // Also create internal ops alert for visibility.
      // eslint-disable-next-line no-await-in-loop
      await upsertOpsAlert({
        type: 'company_ops_coverage_risk',
        key: companyId,
        severity: severity === 'critical' ? 'critical' : 'warning',
        message: body,
        payload: meta,
      })

      // eslint-disable-next-line no-await-in-loop
      await pool
        .query('update company_ops_settings set coverage_alert_last_sent_at = now(), updated_at = now() where company_id = $1', [companyId])
        .catch(() => {})
      sent += 1
    }

    // Reliability risk: at-risk workers currently invited/accepted into upcoming shifts.
    // eslint-disable-next-line no-await-in-loop
    const rr = await pool.query(
      `with stats as (
         select a.worker_user_id,
                count(*)::int as invited,
                count(*) filter (where a.status = 'no_show')::int as no_shows
         from shift_assignments a
         join shift_blocks s on s.id = a.shift_id
         where s.company_id = $1
           and s.start_at >= now() - interval '90 days'
         group by a.worker_user_id
       ),
       at_risk as (
         select st.worker_user_id
         from stats st
         where st.invited >= 3
           and round(100.0 * st.no_shows / nullif(st.invited, 0))::int >= $2
       ),
       upcoming as (
         select a.worker_user_id,
                count(*)::int as upcoming_assignments
         from shift_assignments a
         join shift_blocks s on s.id = a.shift_id
         where s.company_id = $1
           and s.status = 'scheduled'
           and s.start_at >= now()
           and s.start_at < now() + ($3::text || ' hours')::interval
           and a.status in ('invited','accepted')
           and a.worker_user_id in (select worker_user_id from at_risk)
         group by a.worker_user_id
       )
       select count(*)::int as workers,
              coalesce(sum(upcoming_assignments), 0)::int as assignments,
              (select jsonb_agg(jsonb_build_object('id', u.id, 'name', u.name, 'count', up.upcoming_assignments) order by up.upcoming_assignments desc)
               from upcoming up join users u on u.id = up.worker_user_id
               limit 3) as top`,
      [companyId, noShowPct, String(lookaheadH)],
    )

    const riskWorkers = Number(rr.rows[0]?.workers ?? 0)
    const riskAssignments = Number(rr.rows[0]?.assignments ?? 0)
    if (riskAssignments > 0 && riskWorkers > 0) {
      // eslint-disable-next-line no-await-in-loop
      const lastSent = row.reliability_alert_last_sent_at ? new Date(row.reliability_alert_last_sent_at).getTime() : null
      const okToSend = lastSent == null || !Number.isFinite(lastSent) || Date.now() - lastSent > 6 * 60 * 60 * 1000
      if (okToSend) {
        // eslint-disable-next-line no-await-in-loop
        const { recipients, companyName } = await recipientsForCompany(companyId)
        const title = 'Reliability risk'
        const body = `${companyName}: ${riskAssignments} upcoming assignment(s) involve at-risk workers (≥${noShowPct}% no-show rate).`
        const meta = { url: '/company?tab=insights', company_id: companyId, risk_assignments: riskAssignments, risk_workers: riskWorkers, threshold_noshow_pct: noShowPct, top: rr.rows[0]?.top ?? null }
        for (const r of recipients) {
          notify({
            userId: r.user_id,
            type: 'ops_reliability_alert',
            title,
            body,
            meta,
            dedupeKey: `reliability:${companyId}:${Math.floor(Date.now() / (6 * 60 * 60 * 1000))}`, // ~6h buckets
          }).catch(() => {})
        }
        // eslint-disable-next-line no-await-in-loop
        await upsertOpsAlert({ type: 'company_ops_reliability_risk', key: companyId, severity: 'warning', message: body, payload: meta })
        // eslint-disable-next-line no-await-in-loop
        await pool
          .query('update company_ops_settings set reliability_alert_last_sent_at = now(), updated_at = now() where company_id = $1', [companyId])
          .catch(() => {})
        sent += 1
      }
    }
  }

  return { ok: true, processed_companies: processed, sent }
}

export async function runCompanyOpsWeeklyDigestSweep({ limitCompanies = 25 } = {}) {
  if (!env.COMPANY_OPS_WEEKLY_DIGEST_ENABLED) return { ok: true, processed_companies: 0, sent: 0 }

  const due = await pool
    .query(
      `select company_id
       from company_ops_settings
       where weekly_digest_enabled = true
         and (weekly_digest_last_sent_at is null or weekly_digest_last_sent_at < now() - interval '6 days')
       order by coalesce(weekly_digest_last_sent_at, '1970-01-01'::timestamptz) asc
       limit $1`,
      [limitCompanies],
    )
    .catch((e) => {
      if (String(e?.code || '') === '42P01') return { rows: [] }
      throw e
    })

  let processed = 0
  let sent = 0

  for (const r0 of due.rows || []) {
    processed += 1
    const companyId = String(r0.company_id)

    // eslint-disable-next-line no-await-in-loop
    const summary = await pool.query(
      `with shifts as (
         select id, headcount
         from shift_blocks
         where company_id = $1
           and start_at >= now() - interval '7 days'
           and start_at < now()
       ),
       per_shift as (
         select s.id,
                s.headcount,
                count(*) filter (where a.status in ('invited','accepted','checked_in','checked_out','completed'))::int as active,
                count(*) filter (where a.status = 'no_show')::int as no_shows,
                count(*) filter (where a.status = 'completed')::int as completed
         from shifts s
         left join shift_assignments a on a.shift_id = s.id
         group by s.id, s.headcount
       )
       select
         count(*)::int as shifts,
         coalesce(sum(headcount),0)::int as headcount_total,
         coalesce(sum(least(active, headcount)),0)::int as filled_total,
         coalesce(sum(no_shows),0)::int as no_shows_total,
         coalesce(sum(completed),0)::int as completed_total
       from per_shift`,
      [companyId],
    )
    const shifts = Number(summary.rows[0]?.shifts ?? 0)
    if (shifts <= 0) continue

    // eslint-disable-next-line no-await-in-loop
    const auto = await pool
      .query(
        `select coalesce(sum(invited_workers),0)::int as invited
         from company_ops_autopilot_runs
         where company_id = $1
           and kind = 'coverage_auto_fill'
           and created_at >= now() - interval '7 days'`,
        [companyId],
      )
      .catch((e) => {
        if (String(e?.code || '') === '42P01') return { rows: [{ invited: 0 }] }
        throw e
      })
    const invitedByAuto = Number(auto.rows[0]?.invited ?? 0)

    // eslint-disable-next-line no-await-in-loop
    const { recipients, companyName } = await recipientsForCompany(companyId)
    const headTotal = Number(summary.rows[0]?.headcount_total ?? 0)
    const filledTotal = Number(summary.rows[0]?.filled_total ?? 0)
    const fillPct = headTotal > 0 ? Math.round((100 * filledTotal) / headTotal) : null
    const noShows = Number(summary.rows[0]?.no_shows_total ?? 0)
    const completed = Number(summary.rows[0]?.completed_total ?? 0)

    const title = 'Weekly Ops digest'
    const body = `${companyName}: last 7d — shifts ${shifts}, fill ${fillPct ?? '—'}%, completed ${completed}, no-shows ${noShows}, autopilot invites ${invitedByAuto}.`
    const meta = { url: '/company?tab=ops', company_id: companyId, shifts, fill_pct: fillPct, completed, no_shows: noShows, autopilot_invites: invitedByAuto }

    for (const r of recipients) {
      notify({ userId: r.user_id, type: 'ops_weekly_digest', title, body, meta, dedupeKey: `weekly:${companyId}:${new Date().toISOString().slice(0, 10)}` }).catch(() => {})
      if (r.email) {
        sendEmail({
          to: r.email,
          subject: `LocalLink Weekly Ops Digest — ${companyName}`,
          text: `${body}\n\nOpen: ${env.APP_BASE_URL ? `${env.APP_BASE_URL}/company?tab=ops` : '/company?tab=ops'}\n`,
        }).catch(() => {})
      }
    }

    // eslint-disable-next-line no-await-in-loop
    await pool.query('update company_ops_settings set weekly_digest_last_sent_at = now(), updated_at = now() where company_id = $1', [companyId]).catch(() => {})
    sent += 1
  }

  return { ok: true, processed_companies: processed, sent }
}

