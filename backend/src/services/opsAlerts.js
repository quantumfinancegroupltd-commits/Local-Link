import { pool } from '../db/pool.js'

function safeJson(v) {
  try {
    return v == null ? null : JSON.parse(JSON.stringify(v))
  } catch {
    return null
  }
}

export async function upsertOpsAlert({ type, key, severity = 'warning', message = null, payload = null }) {
  const t = String(type || '').trim()
  const k = String(key || '').trim()
  if (!t || !k) return null

  const sev = ['info', 'warning', 'critical'].includes(String(severity)) ? String(severity) : 'warning'
  const msg = message == null ? null : String(message).slice(0, 2000)
  const pl = safeJson(payload)

  // Dedupe by (type,key) while unresolved; update count + last_seen_at.
  try {
    const r = await pool.query(
      `insert into ops_alerts (type, key, severity, message, payload)
       values ($1,$2,$3,$4,$5::jsonb)
       on conflict (type, key) where resolved_at is null
       do update set
         severity = case
           when ops_alerts.severity = 'critical' or excluded.severity = 'critical' then 'critical'::ops_alert_severity
           when ops_alerts.severity = 'warning' or excluded.severity = 'warning' then 'warning'::ops_alert_severity
           else 'info'::ops_alert_severity
         end,
         message = coalesce(excluded.message, ops_alerts.message),
         payload = coalesce(excluded.payload, ops_alerts.payload),
         count = ops_alerts.count + 1,
         last_seen_at = now(),
         updated_at = now()
       returning *`,
      [t, k, sev, msg, pl ? JSON.stringify(pl) : null],
    )
    return r.rows[0] ?? null
  } catch (e) {
    // If migrations haven't run yet, don't crash the scheduler/worker.
    if (String(e?.code || '') === '42P01') return null // undefined_table
    throw e
  }
}

export async function listOpsAlerts({ limit = 100, status = 'open', severity = null } = {}) {
  const lim = Math.max(1, Math.min(250, Number(limit) || 100))
  const st = String(status || 'open')
  const sev = severity ? String(severity) : null

  const where = []
  const args = []

  if (st === 'resolved') where.push('a.resolved_at is not null')
  else where.push('a.resolved_at is null')

  if (sev && ['info', 'warning', 'critical'].includes(sev)) {
    args.push(sev)
    where.push(`a.severity = $${args.length}::ops_alert_severity`)
  }

  const sql = `select a.*
    from ops_alerts a
    where ${where.join(' and ')}
    order by a.severity desc, a.last_seen_at desc
    limit ${lim}`

  try {
    const r = await pool.query(sql, args)
    return r.rows
  } catch (e) {
    if (String(e?.code || '') === '42P01') return []
    throw e
  }
}

export async function resolveOpsAlert({ id, resolvedByUserId }) {
  try {
    const r = await pool.query(
      `update ops_alerts
       set resolved_at = now(),
           resolved_by = $2,
           updated_at = now()
       where id = $1
         and resolved_at is null
       returning *`,
      [id, resolvedByUserId ?? null],
    )
    return r.rows[0] ?? null
  } catch (e) {
    if (String(e?.code || '') === '42P01') return null
    throw e
  }
}

