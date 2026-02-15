import { pool } from '../db/pool.js'
import { upsertOpsAlert } from './opsAlerts.js'

function clampInt(n, a, b) {
  const x = Number(n)
  if (!Number.isFinite(x)) return a
  return Math.max(a, Math.min(b, Math.floor(x)))
}

function backoffMs({ failures, baseMs, maxMs }) {
  const f = clampInt(failures, 0, 50)
  const base = clampInt(baseMs, 250, 60_000)
  const max = clampInt(maxMs, base, 6 * 3600_000)
  const pow = Math.min(20, Math.max(0, f - 1))
  const raw = Math.min(max, base * Math.pow(2, pow))
  const jitter = 0.15
  const j = raw * (1 - jitter + Math.random() * 2 * jitter)
  return clampInt(j, base, max)
}

export async function runGuardedTask(taskName, fn, opts = {}) {
  const name = String(taskName || '').trim()
  if (!name) throw new Error('taskName is required')
  if (typeof fn !== 'function') throw new Error('fn must be a function')

  const baseDelayMs = opts.baseDelayMs ?? 5_000
  const maxDelayMs = opts.maxDelayMs ?? 30 * 60_000
  const alertAfterFailures = opts.alertAfterFailures ?? 2
  const criticalAfterFailures = opts.criticalAfterFailures ?? 5
  const successCooldownMs = opts.successCooldownMs ?? 0

  let state = null
  try {
    const stateRes = await pool.query(`select * from ops_task_state where task_name = $1`, [name])
    state = stateRes.rows[0] ?? null
  } catch (e) {
    // If migrations haven't run yet, fall back to unguarded execution.
    if (String(e?.code || '') !== '42P01') throw e // undefined_table
  }

  const nextRunAt = state?.next_run_at ? new Date(state.next_run_at).getTime() : null
  if (nextRunAt != null && Number.isFinite(nextRunAt) && nextRunAt > Date.now()) {
    return { skipped: true, reason: 'backoff', next_run_at: state.next_run_at, task: name }
  }

  try {
    const result = await fn()
    const cooldown = Math.max(0, Number(successCooldownMs) || 0)
    const nextOk = cooldown > 0 ? new Date(Date.now() + cooldown).toISOString() : null
    try {
      await pool.query(
        `insert into ops_task_state (task_name, consecutive_failures, last_success_at, last_error, next_run_at, updated_at)
         values ($1, 0, now(), null, $2, now())
         on conflict (task_name) do update set
           consecutive_failures = 0,
           last_success_at = now(),
           last_error = null,
           next_run_at = $2,
           updated_at = now()`,
        [name, nextOk],
      )
    } catch (e) {
      if (String(e?.code || '') !== '42P01') throw e // undefined_table
    }
    return { ok: true, task: name, result }
  } catch (e) {
    const msg = e?.message ? String(e.message) : String(e || 'Task failed')

    const prevFailures = clampInt(state?.consecutive_failures ?? 0, 0, 1000)
    const failures = prevFailures + 1
    const delayMs = backoffMs({ failures, baseMs: baseDelayMs, maxMs: maxDelayMs })

    const next = new Date(Date.now() + delayMs)
    try {
      await pool.query(
        `insert into ops_task_state (task_name, consecutive_failures, last_failure_at, last_error, next_run_at, updated_at)
         values ($1, $2, now(), $3, $4, now())
         on conflict (task_name) do update set
           consecutive_failures = $2,
           last_failure_at = now(),
           last_error = $3,
           next_run_at = $4,
           updated_at = now()`,
        [name, failures, msg.slice(0, 2000), next.toISOString()],
      )
    } catch (e) {
      if (String(e?.code || '') !== '42P01') throw e // undefined_table
    }

    if (failures >= alertAfterFailures) {
      const severity = failures >= criticalAfterFailures ? 'critical' : 'warning'
      await upsertOpsAlert({
        type: 'scheduler_task_failed',
        key: name,
        severity,
        message: `Task "${name}" failed (${failures}x). Next retry in ~${Math.round(delayMs / 1000)}s.`,
        payload: { task: name, failures, next_retry_at: next.toISOString(), last_error: msg },
      })
    }

    return { ok: false, task: name, error: msg, failures, next_retry_at: next.toISOString() }
  }
}

