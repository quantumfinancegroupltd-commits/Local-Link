import os from 'node:os'
import { pool } from '../db/pool.js'
import { handleWebhook } from './webhookHandlers.js'

function backoffMinutes(attempt) {
  // Transparent, conservative backoff schedule
  if (attempt <= 1) return 1
  if (attempt === 2) return 5
  if (attempt === 3) return 15
  if (attempt === 4) return 60
  if (attempt === 5) return 6 * 60
  if (attempt === 6) return 24 * 60
  return 48 * 60
}

export async function enqueueWebhook({ provider, eventId, payload }) {
  const p = String(provider || '').toLowerCase()
  const id = String(eventId || '').trim()
  if (!p || !id || !payload) return null

  const r = await pool.query(
    `insert into webhook_queue (provider, event_id, payload, status, next_retry_at, updated_at)
     values ($1,$2,$3,'pending', now(), now())
     on conflict (provider, event_id) do update set
       payload = excluded.payload,
       -- don't resurrect processed/dead tasks; keep them as-is
       updated_at = now()
     returning *`,
    [p, id, payload],
  )
  return r.rows[0]
}

export async function processWebhookQueue({ limit = 25, maxAttempts = 10 } = {}) {
  const lim = Math.max(1, Math.min(200, Number(limit) || 25))
  const maxA = Math.max(1, Math.min(50, Number(maxAttempts) || 10))

  const workerId = `${os.hostname()}:${process.pid}`
  const client = await pool.connect()

  let processed = 0
  let retried = 0
  let ignored = 0
  let dead = 0

  try {
    await client.query('begin')

    const due = await client.query(
      `select *
       from webhook_queue
       where status in ('pending','retry')
         and next_retry_at <= now()
         and attempts < $1
       order by next_retry_at asc
       limit $2
       for update skip locked`,
      [maxA, lim],
    )

    for (const row of due.rows) {
      const nextAttempts = Number(row.attempts ?? 0) + 1
      // Mark processing + lock
      // eslint-disable-next-line no-await-in-loop
      await client.query(
        `update webhook_queue
         set status='processing',
             attempts=$2,
             locked_at=now(),
             locked_by=$3,
             updated_at=now()
         where id=$1`,
        [row.id, nextAttempts, workerId],
      )

      try {
        // eslint-disable-next-line no-await-in-loop
        const out = await handleWebhook(row.provider, row.payload)
        const outcome = out?.outcome === 'processed' ? 'processed' : 'ignored'
        const note = out?.note ? String(out.note).slice(0, 5000) : null

        // eslint-disable-next-line no-await-in-loop
        await client.query(
          `update webhook_queue
           set status=$2::webhook_queue_status,
               processed_at=now(),
               last_error=$3,
               locked_at=null,
               locked_by=null,
               updated_at=now()
           where id=$1`,
          [row.id, outcome, note],
        )

        if (outcome === 'processed') processed += 1
        else ignored += 1
      } catch (e) {
        const err = String(e?.message ?? e).slice(0, 5000)
        const willDead = nextAttempts >= maxA
        const status = willDead ? 'dead' : 'retry'
        const mins = backoffMinutes(nextAttempts)

        // eslint-disable-next-line no-await-in-loop
        await client.query(
          `update webhook_queue
           set status=$2::webhook_queue_status,
               last_error=$3,
               next_retry_at = case when $4 then now() + interval '365 days' else now() + ($5::text || ' minutes')::interval end,
               locked_at=null,
               locked_by=null,
               updated_at=now()
           where id=$1`,
          [row.id, status, err, willDead, String(mins)],
        )

        if (willDead) dead += 1
        else retried += 1
      }
    }

    await client.query('commit')
    return { processed, retried, ignored, dead }
  } catch (e) {
    try {
      await client.query('rollback')
    } catch {}
    throw e
  } finally {
    client.release()
  }
}


