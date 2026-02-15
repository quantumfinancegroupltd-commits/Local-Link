import { pool } from '../db/pool.js'
import { env } from '../config.js'
import { recordPolicyEvent } from './policy.js'
import { notify } from './notifications.js'

function parseDateOnlyToUtcMs(dateStr) {
  const s = String(dateStr || '').trim()
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2]) - 1
  const d = Number(m[3])
  const dt = new Date(Date.UTC(y, mo, d, 0, 0, 0, 0))
  if (!Number.isFinite(dt.getTime())) return null
  return dt.getTime()
}

function parseTimeParts(timeStr) {
  const s = String(timeStr || '').trim()
  const m = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(s)
  if (!m) return null
  const hh = Number(m[1])
  const mm = Number(m[2])
  const ss = m[3] != null ? Number(m[3]) : 0
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || !Number.isFinite(ss)) return null
  if (hh < 0 || hh > 23) return null
  if (mm < 0 || mm > 59) return null
  if (ss < 0 || ss > 59) return null
  return { hh, mm, ss }
}

function utcDatePartsFromMs(ms) {
  const d = new Date(ms)
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), day: d.getUTCDate(), dow: d.getUTCDay() }
}

function isoForUtcDateAndTime(dateMs, timeStr) {
  const t = parseTimeParts(timeStr)
  if (!t) return null
  const p = utcDatePartsFromMs(dateMs)
  const dt = new Date(Date.UTC(p.y, p.m, p.day, t.hh, t.mm, t.ss, 0))
  if (!Number.isFinite(dt.getTime())) return null
  return dt.toISOString()
}

export async function generateShiftSeries({
  companyId,
  seriesId,
  actorUserId = null,
  days = 60,
  fromDate = null,
  toDate = null,
  autoFillListIdOverride = null,
  autoFillModeOverride = null,
  autoFillCountOverride = null,
} = {}) {
  if (!companyId || !seriesId) return { inserted_count: 0, invited_count: 0 }

  const sRes = await pool.query(
    `select s.*,
            t.title as tpl_title,
            t.role_tag as tpl_role_tag,
            t.location as tpl_location,
            t.headcount as tpl_headcount,
            t.checkin_geo_required as tpl_geo_required,
            t.checkin_geo_radius_m as tpl_geo_radius_m,
            t.checkin_geo_lat as tpl_geo_lat,
            t.checkin_geo_lng as tpl_geo_lng
     from company_shift_series s
     join company_shift_templates t on t.id = s.template_id
     where s.id = $1 and s.company_id = $2
     limit 1`,
    [seriesId, companyId],
  )
  const s = sRes.rows[0] ?? null
  if (!s) return { inserted_count: 0, invited_count: 0 }
  if (String(s.status) === 'ended') return { inserted_count: 0, invited_count: 0 }

  const today = new Date()
  const todayMs = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 0, 0, 0, 0)

  const wantDays = Number.isFinite(Number(days)) ? Number(days) : 60
  const fromMs = fromDate ? parseDateOnlyToUtcMs(fromDate) : todayMs
  const toMs = toDate ? parseDateOnlyToUtcMs(toDate) : todayMs + wantDays * 24 * 60 * 60 * 1000
  if (!fromMs || !toMs || toMs < fromMs) return { inserted_count: 0, invited_count: 0 }

  const seriesStartMs = parseDateOnlyToUtcMs(s.start_date)
  const seriesEndMs = s.end_date ? parseDateOnlyToUtcMs(s.end_date) : null
  if (!seriesStartMs) return { inserted_count: 0, invited_count: 0 }

  const startMs = Math.max(fromMs, seriesStartMs)
  const endMs = seriesEndMs != null ? Math.min(toMs, seriesEndMs) : toMs
  if (endMs < startMs) return { inserted_count: 0, invited_count: 0 }

  const daysOfWeek = Array.isArray(s.days_of_week) ? s.days_of_week.map((n) => Number(n)).filter((n) => Number.isFinite(n)) : []
  const allowed = new Set(daysOfWeek)
  if (allowed.size === 0) return { inserted_count: 0, invited_count: 0 }

  const ex = await pool.query(
    `select on_date
     from company_shift_series_exceptions
     where series_id = $1 and kind = 'skip'
       and on_date >= $2::date and on_date <= $3::date`,
    [seriesId, new Date(startMs).toISOString().slice(0, 10), new Date(endMs).toISOString().slice(0, 10)],
  )
  const skipped = new Set((ex.rows || []).map((r) => String(r.on_date).slice(0, 10)))

  const inserts = []
  const oneDay = 24 * 60 * 60 * 1000
  for (let dMs = startMs; dMs <= endMs; dMs += oneDay) {
    const p = utcDatePartsFromMs(dMs)
    if (!allowed.has(p.dow)) continue
    const diffDays = Math.floor((dMs - seriesStartMs) / oneDay)
    if (diffDays < 0) continue
    const weekIndex = Math.floor(diffDays / 7)
    const interval = Number(s.interval_weeks || 1)
    if (interval > 1 && weekIndex % interval !== 0) continue
    const dateKey = `${p.y}-${String(p.m + 1).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
    if (skipped.has(dateKey)) continue
    const startIso = isoForUtcDateAndTime(dMs, s.start_time)
    const endIso = isoForUtcDateAndTime(dMs, s.end_time)
    if (!startIso || !endIso) continue
    inserts.push({ dateKey, startIso, endIso })
  }

  if (inserts.length === 0) return { inserted_count: 0, invited_count: 0 }

  const autoFillListId = autoFillListIdOverride != null ? autoFillListIdOverride : s.auto_fill_list_id
  const autoFillMode = String(autoFillModeOverride != null ? autoFillModeOverride : s.auto_fill_mode ?? 'headcount')
  const autoFillCount = autoFillCountOverride != null ? Number(autoFillCountOverride) : Number(s.auto_fill_count ?? 1)

  let autoFillListOk = false
  if (autoFillListId) {
    const listRes = await pool.query('select id from employer_worker_lists where id = $1 and company_id = $2 limit 1', [autoFillListId, companyId])
    autoFillListOk = listRes.rowCount > 0
  }

  let inserted = 0
  let invitedTotal = 0
  let companyName = null
  if (autoFillListOk) {
    const companyRes = await pool.query('select name from companies where id = $1 limit 1', [companyId])
    companyName = companyRes.rows[0]?.name ?? 'Company'
  }

  for (const it of inserts) {
    // eslint-disable-next-line no-await-in-loop
    const r = await pool.query(
      `insert into shift_blocks (
         company_id, title, role_tag, location, start_at, end_at, headcount, status, created_by, updated_at,
         checkin_geo_required, checkin_geo_radius_m, checkin_geo_lat, checkin_geo_lng,
         series_id, series_occurrence_date
       )
       values ($1,$2,$3,$4,$5,$6,$7,'scheduled',$8,now(),$9,$10,$11,$12,$13,$14::date)
       on conflict (series_id, series_occurrence_date) do nothing
       returning id`,
      [
        companyId,
        s.tpl_title,
        s.tpl_role_tag ?? null,
        s.tpl_location ?? null,
        it.startIso,
        it.endIso,
        Number(s.tpl_headcount ?? 1),
        actorUserId,
        Boolean(s.tpl_geo_required ?? false),
        s.tpl_geo_radius_m ?? null,
        s.tpl_geo_lat ?? null,
        s.tpl_geo_lng ?? null,
        seriesId,
        it.dateKey,
      ],
    )
    const newShiftId = r.rows[0]?.id ? String(r.rows[0].id) : null
    if (!newShiftId) continue
    inserted += 1

    if (autoFillListOk) {
      const headcount = Number(s.tpl_headcount ?? 1)
      const want = autoFillMode === 'count' ? autoFillCount : headcount
      const count = Math.min(Math.max(1, want), 200)
      // eslint-disable-next-line no-await-in-loop
      const cand = await pool.query(
        `with stats as (
           select a.worker_user_id,
                  sum(case when a.status='completed' then 1 else 0 end)::int as completed,
                  sum(case when a.status='no_show' then 1 else 0 end)::int as no_shows,
                  sum(case when a.status in ('checked_in','checked_out','completed') then 1 else 0 end)::int as check_ins
           from shift_assignments a
           join shift_blocks s on s.id = a.shift_id
           where s.company_id = $1
           group by a.worker_user_id
         )
         select mem.worker_user_id,
                coalesce(st.completed, 0) as completed,
                coalesce(st.no_shows, 0) as no_shows,
                coalesce(st.check_ins, 0) as check_ins,
                coalesce(n.rating, null) as rating,
                coalesce(n.preferred, false) as preferred
         from employer_worker_list_members mem
         left join employer_worker_notes n on n.company_id = $1 and n.worker_user_id = mem.worker_user_id
         left join stats st on st.worker_user_id = mem.worker_user_id
         where mem.list_id = $2
           and coalesce(n.blocked, false) = false
           and not exists (
             select 1 from shift_assignments a2 where a2.shift_id = $3 and a2.worker_user_id = mem.worker_user_id
           )
         order by coalesce(n.preferred, false) desc,
                  n.rating desc nulls last,
                  coalesce(st.no_shows, 0) asc,
                  coalesce(st.completed, 0) desc,
                  coalesce(st.check_ins, 0) desc,
                  mem.created_at asc
         limit $4`,
        [companyId, autoFillListId, newShiftId, count],
      )
      const workerIds = (cand.rows || []).map((x) => x.worker_user_id).filter(Boolean)
      for (const workerUserId of workerIds) {
        // eslint-disable-next-line no-await-in-loop
        const ins = await pool.query(
          `insert into shift_assignments (shift_id, worker_user_id, status, invited_at, created_by, updated_at)
           values ($1,$2,'invited',now(),$3,now())
           on conflict (shift_id, worker_user_id) do nothing
           returning id`,
          [newShiftId, workerUserId, actorUserId],
        )
        if (ins.rowCount) invitedTotal += 1
        notify({
          userId: workerUserId,
          type: 'shift_invite',
          title: 'Shift invitation',
          body: `${companyName} invited you to a shift. Tap to view and accept.`,
          meta: { url: '/shifts', shift_id: newShiftId, company_id: companyId },
          dedupeKey: `shift:${newShiftId}:invite:${workerUserId}`,
        }).catch(() => {})
      }
    }
  }

  return { inserted_count: inserted, invited_count: invitedTotal }
}

export async function runShiftSeriesAutoGenerateSweep({ limitSeries = 50 } = {}) {
  if (!env.SHIFT_SERIES_AUTO_GENERATE_ENABLED) return { ok: true, processed_series: 0, inserted_shifts: 0, invited_workers: 0 }
  const intervalMin = Number(env.SHIFT_SERIES_AUTO_GENERATE_INTERVAL_MIN ?? 15)
  const interval = Number.isFinite(intervalMin) && intervalMin > 0 ? intervalMin : 15

  const due = await pool.query(
    `select id, company_id, auto_generate_days
     from company_shift_series
     where status = 'active'
       and auto_generate_enabled = true
       and (auto_generated_at is null or auto_generated_at < now() - ($1::text || ' minutes')::interval)
     order by coalesce(auto_generated_at, '1970-01-01'::timestamptz) asc
     limit $2`,
    [String(interval), limitSeries],
  )

  let processed = 0
  let insertedTotal = 0
  let invitedTotal = 0
  for (const row of due.rows || []) {
    processed += 1
    const companyId = row.company_id
    const seriesId = row.id
    const days = Number(row.auto_generate_days ?? 14)
    // eslint-disable-next-line no-await-in-loop
    const r = await generateShiftSeries({ companyId, seriesId, actorUserId: null, days }).catch(() => ({ inserted_count: 0, invited_count: 0 }))
    insertedTotal += Number(r.inserted_count ?? 0)
    invitedTotal += Number(r.invited_count ?? 0)
    // eslint-disable-next-line no-await-in-loop
    await pool.query('update company_shift_series set auto_generated_at = now(), updated_at = now() where id = $1', [seriesId]).catch(() => {})
  }

  return { ok: true, processed_series: processed, inserted_shifts: insertedTotal, invited_workers: invitedTotal }
}

export async function runShiftCoverageAutoFillSweep({ limitCompanies = 30, limitShiftsPerCompany = 25 } = {}) {
  if (!env.SHIFT_COVERAGE_AUTO_FILL_ENABLED) {
    return { ok: true, processed_companies: 0, processed_shifts: 0, invited_workers: 0 }
  }
  const intervalMin = Number(env.SHIFT_COVERAGE_AUTO_FILL_INTERVAL_MIN ?? 10)
  const interval = Number.isFinite(intervalMin) && intervalMin > 0 ? intervalMin : 10

  const dueCompanies = await pool
    .query(
      `select company_id,
              coverage_auto_fill_list_id as list_id,
              coverage_auto_fill_days as days,
              coverage_auto_fill_max_shifts as max_shifts
       from company_ops_settings
       where coverage_auto_fill_enabled = true
         and coverage_auto_fill_list_id is not null
         and (coverage_auto_fill_last_run_at is null or coverage_auto_fill_last_run_at < now() - ($1::text || ' minutes')::interval)
       order by coalesce(coverage_auto_fill_last_run_at, '1970-01-01'::timestamptz) asc
       limit $2`,
      [String(interval), limitCompanies],
    )
    .catch((e) => {
      // If not migrated yet, ignore.
      if (String(e?.code || '') === '42P01') return { rows: [] }
      throw e
    })

  let processedCompanies = 0
  let processedShifts = 0
  let invitedTotal = 0

  for (const c of dueCompanies.rows || []) {
    processedCompanies += 1
    const companyId = String(c.company_id)
    const listId = String(c.list_id)
    const days = Math.min(Math.max(1, Number(c.days ?? 14)), 90)
    const maxShifts = Math.min(Math.max(1, Number(c.max_shifts ?? limitShiftsPerCompany)), 200)
    const startedAt = new Date().toISOString()
    let companyInvited = 0
    let companyProcessedShifts = 0
    let companyFailedShifts = 0

    // Validate list belongs to company (protect against stale FK or cross-company list id).
    // eslint-disable-next-line no-await-in-loop
    const listOk = await pool
      .query('select 1 from employer_worker_lists where id = $1 and company_id = $2 limit 1', [listId, companyId])
      .catch(() => ({ rowCount: 0 }))
    if (!listOk.rowCount) {
      // eslint-disable-next-line no-await-in-loop
      await pool
        .query(
          `update company_ops_settings
           set coverage_auto_fill_enabled = false,
               updated_at = now()
           where company_id = $1`,
          [companyId],
        )
        .catch(() => {})
      continue
    }

    // eslint-disable-next-line no-await-in-loop
    const companyRes = await pool.query('select name from companies where id = $1 limit 1', [companyId]).catch(() => ({ rows: [] }))
    const companyName = companyRes.rows[0]?.name ?? 'Company'

    // Daily cap: count invites created by autopilot today (created_by is null).
    // eslint-disable-next-line no-await-in-loop
    const capRes = await pool
      .query(
        `select coverage_auto_fill_max_invites_per_day as cap
         from company_ops_settings
         where company_id = $1
         limit 1`,
        [companyId],
      )
      .catch(() => ({ rows: [{ cap: 200 }] }))
    const cap = Math.min(Math.max(1, Number(capRes.rows[0]?.cap ?? 200)), 2000)
    // eslint-disable-next-line no-await-in-loop
    const usedRes = await pool.query(
      `select count(*)::int as n
       from shift_assignments a
       join shift_blocks s on s.id = a.shift_id
       where s.company_id = $1
         and a.created_by is null
         and a.invited_at >= date_trunc('day', now())`,
      [companyId],
    )
    let remainingInvites = Math.max(0, cap - Number(usedRes.rows[0]?.n ?? 0))

    // eslint-disable-next-line no-await-in-loop
    const shifts = await pool.query(
      `with stats as (
         select a.shift_id,
                count(*) filter (where a.status in ('invited','accepted','checked_in','checked_out','completed'))::int as active_count
         from shift_assignments a
         join shift_blocks s on s.id = a.shift_id
         where s.company_id = $1
           and s.start_at >= now()
           and s.start_at < now() + ($2::text || ' days')::interval
         group by a.shift_id
       )
       select s.id, s.headcount, coalesce(st.active_count, 0) as active_count,
              greatest(0, s.headcount - coalesce(st.active_count, 0))::int as open_slots
       from shift_blocks s
       left join stats st on st.shift_id = s.id
       where s.company_id = $1
         and s.status = 'scheduled'
         and coalesce(s.coverage_auto_fill_disabled, false) = false
         and s.start_at >= now()
         and s.start_at < now() + ($2::text || ' days')::interval
       order by s.start_at asc
       limit $3`,
      [companyId, String(days), maxShifts],
    )

    for (const s of shifts.rows || []) {
      if (remainingInvites <= 0) break
      const shiftId = String(s.id)
      const headcount = Number(s.headcount ?? 1)
      const activeCount = Number(s.active_count ?? 0)
      const holes = Math.max(0, headcount - activeCount)
      if (holes <= 0) continue
      const want = Math.min(holes, remainingInvites, 200)

      try {
        // eslint-disable-next-line no-await-in-loop
        const candidatesRes = await pool.query(
          `with members as (
             select m.worker_user_id, m.created_at
             from employer_worker_list_members m
             where m.list_id = $2
           ),
           stats as (
             select a.worker_user_id,
                    sum(case when a.status='completed' then 1 else 0 end)::int as completed,
                    sum(case when a.status='no_show' then 1 else 0 end)::int as no_shows,
                    sum(case when a.status in ('checked_in','checked_out','completed') then 1 else 0 end)::int as check_ins
             from shift_assignments a
             join shift_blocks s on s.id = a.shift_id
             where s.company_id = $1
             group by a.worker_user_id
           ),
           notes as (
             select worker_user_id, rating, preferred, blocked
             from employer_worker_notes
             where company_id = $1
           )
           select mem.worker_user_id,
                  coalesce(st.completed,0) as completed,
                  coalesce(st.no_shows,0) as no_shows,
                  coalesce(st.check_ins,0) as check_ins,
                  coalesce(n.rating, null) as rating,
                  coalesce(n.preferred, false) as preferred,
                  coalesce(n.blocked, false) as blocked
           from members mem
           left join stats st on st.worker_user_id = mem.worker_user_id
           left join notes n on n.worker_user_id = mem.worker_user_id
           where not exists (
             select 1 from shift_assignments a2 where a2.shift_id = $3 and a2.worker_user_id = mem.worker_user_id
           )
             and coalesce(n.blocked, false) = false
           order by coalesce(n.preferred, false) desc,
                    n.rating desc nulls last,
                    coalesce(st.completed,0) desc,
                    coalesce(st.no_shows,0) asc,
                    coalesce(st.check_ins,0) desc,
                    mem.created_at asc
           limit $4`,
          [companyId, listId, shiftId, want],
        )
        const workerIds = (candidatesRes.rows || []).map((r) => r.worker_user_id).filter(Boolean)
        if (workerIds.length === 0) continue

        for (const workerUserId of workerIds) {
          // eslint-disable-next-line no-await-in-loop
          const ins = await pool.query(
            `insert into shift_assignments (shift_id, worker_user_id, status, invited_at, created_by, updated_at)
             values ($1,$2,'invited',now(),null,now())
             on conflict (shift_id, worker_user_id) do nothing
             returning id`,
            [shiftId, workerUserId],
          )
          if (ins.rowCount) {
            invitedTotal += 1
            companyInvited += 1
            remainingInvites -= 1
            if (remainingInvites <= 0) break
          }
          notify({
            userId: workerUserId,
            type: 'shift_invite',
            title: 'Shift invitation',
            body: `${companyName} invited you to a shift. Tap to view and accept.`,
            meta: { url: '/shifts', shift_id: shiftId, company_id: companyId },
            dedupeKey: `shift:${shiftId}:invite:${workerUserId}`,
          }).catch(() => {})
        }
        processedShifts += 1
        companyProcessedShifts += 1
      } catch {
        companyFailedShifts += 1
      }
    }

    // eslint-disable-next-line no-await-in-loop
    await pool
      .query('update company_ops_settings set coverage_auto_fill_last_run_at = now(), updated_at = now() where company_id = $1', [companyId])
      .catch(() => {})

    // Run log (best-effort)
    const finishedAt = new Date().toISOString()
    const status = companyFailedShifts > 0 ? 'partial' : 'ok'
    try {
      // eslint-disable-next-line no-await-in-loop
      await pool.query(
        `insert into company_ops_autopilot_runs (
           company_id, kind, status, list_id, window_days, max_shifts,
           processed_shifts, invited_workers, failed_shifts, started_at, finished_at, meta
         )
         values ($1,'coverage_auto_fill',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)`,
        [
          companyId,
          status,
          listId,
          String(days),
          String(maxShifts),
          companyProcessedShifts,
          companyInvited,
          companyFailedShifts,
          startedAt,
          finishedAt,
          JSON.stringify({ interval_min: interval }),
        ],
      )
    } catch (e) {
      if (String(e?.code || '') !== '42P01') {
        // ignore (best-effort)
      }
    }

    // Summary notifications to owner/ops (only when meaningful, to avoid spam).
    if (companyInvited > 0 || companyFailedShifts > 0) {
      let recipients = []
      try {
        // eslint-disable-next-line no-await-in-loop
        const m = await pool.query(
          `select user_id
           from company_members
           where company_id = $1
             and workspace_role in ('owner','ops')`,
          [companyId],
        )
        recipients = (m.rows || []).map((r) => r.user_id).filter(Boolean)
      } catch (e) {
        if (String(e?.code || '') !== '42P01') {
          // ignore
        }
      }
      // Fallback: always include owner_user_id if available
      try {
        // eslint-disable-next-line no-await-in-loop
        const o = await pool.query('select owner_user_id from companies where id = $1 limit 1', [companyId])
        const ownerId = o.rows[0]?.owner_user_id ?? null
        if (ownerId) recipients.push(ownerId)
      } catch {}
      recipients = Array.from(new Set(recipients.map((x) => String(x))))

      // Throttle to at most 1/hour per company via dedupeKey (notify itself dedupes only 60s).
      const hourKey = Math.floor(Date.now() / (60 * 60 * 1000))
      const dedupeKey = `ops_autofill:${companyId}:${hourKey}`
      const title = companyFailedShifts > 0 ? 'Ops Autopilot (partial)' : 'Ops Autopilot ran'
      const body =
        companyInvited > 0
          ? `Invited ${companyInvited} worker(s) across ${companyProcessedShifts} shift(s).`
          : `No invites sent. ${companyFailedShifts ? `${companyFailedShifts} shift(s) failed.` : ''}`.trim()
      const meta = { url: '/company?tab=ops', company_id: companyId, invited_workers: companyInvited, processed_shifts: companyProcessedShifts, failed_shifts: companyFailedShifts }
      for (const userId of recipients) {
        notify({ userId, type: 'ops_autopilot', title, body, meta, dedupeKey }).catch(() => {})
      }
    }
  }

  return { ok: true, processed_companies: processedCompanies, processed_shifts: processedShifts, invited_workers: invitedTotal }
}

export async function runShiftNoShowSweep({ limitShifts = 120, limitAssignments = 400 } = {}) {
  const graceHours = Number(env.SHIFT_NO_SHOW_GRACE_HOURS ?? 4)
  const grace = Number.isFinite(graceHours) && graceHours > 0 ? graceHours : 4

  // 1) Find assignments that should be marked no_show.
  const due = await pool.query(
    `with due_shifts as (
       select id, company_id
       from shift_blocks
       where status = 'scheduled'
         and end_at < now() - ($1::text || ' hours')::interval
       order by end_at asc
       limit $2
     ),
     due_assign as (
       select a.shift_id, a.worker_user_id, s.company_id
       from shift_assignments a
       join due_shifts s on s.id = a.shift_id
       where a.status in ('invited','accepted')
         and a.check_in_at is null
         and a.no_show_confirmed_at is null
       limit $3
     )
     update shift_assignments a
     set status = 'no_show',
         no_show_confirmed_at = now(),
         updated_at = now()
     from due_assign d
     where a.shift_id = d.shift_id and a.worker_user_id = d.worker_user_id
     returning a.shift_id, a.worker_user_id, d.company_id`,
    [String(grace), limitShifts, limitAssignments],
  )

  const rows = due.rows || []

  // 2) Record policy events (best-effort). This also feeds Trust V2.
  // Keep it conservative: sequential inserts to avoid stampeding DB.
  for (const r of rows) {
    // eslint-disable-next-line no-await-in-loop
    await recordPolicyEvent({
      userId: r.worker_user_id,
      kind: 'no_show',
      contextType: 'shift',
      contextId: r.shift_id,
      meta: { company_id: r.company_id, auto: true, grace_hours: grace },
    }).catch(() => {})
  }

  return { marked_no_show: rows.length }
}

export async function runShiftCompletionSweep({ limitShifts = 200, limitAssignments = 1000 } = {}) {
  const graceHours = Number(env.SHIFT_COMPLETE_GRACE_HOURS ?? 2)
  const grace = Number.isFinite(graceHours) && graceHours >= 0 ? graceHours : 2

  // 1) Promote checked_out -> completed after shift ends (keeps outcomes consistent).
  const completed = await pool.query(
    `with due_shifts as (
       select id, company_id
       from shift_blocks
       where status = 'scheduled'
         and end_at < now() - ($1::text || ' hours')::interval
       order by end_at asc
       limit $2
     ),
     due_assign as (
       select a.shift_id, a.worker_user_id
       from shift_assignments a
       join due_shifts s on s.id = a.shift_id
       where a.status = 'checked_out'
       limit $3
     )
     update shift_assignments a
     set status = 'completed',
         completed_at = coalesce(completed_at, now()),
         updated_at = now()
     from due_assign d
     where a.shift_id = d.shift_id and a.worker_user_id = d.worker_user_id
     returning a.shift_id, a.worker_user_id`,
    [String(grace), limitShifts, limitAssignments],
  )

  // 2) Mark shift_blocks completed when all assignments are terminal.
  const shiftsDone = await pool.query(
    `with due_shifts as (
       select id
       from shift_blocks
       where status = 'scheduled'
         and end_at < now() - ($1::text || ' hours')::interval
       order by end_at asc
       limit $2
     )
     update shift_blocks s
     set status = 'completed',
         updated_at = now()
     where s.id in (select id from due_shifts)
       and not exists (
         select 1
         from shift_assignments a
         where a.shift_id = s.id
           and a.status in ('invited','accepted','checked_in','checked_out')
       )
     returning s.id`,
    [String(grace), limitShifts],
  )

  return { marked_assignment_completed: completed.rowCount ?? 0, marked_shift_completed: shiftsDone.rowCount ?? 0 }
}

