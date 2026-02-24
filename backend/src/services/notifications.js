import { pool } from '../db/pool.js'
import { sendPushToUser } from './push.js'

export async function notify({ userId, type, title, body, meta, dedupeKey }) {
  if (!userId) return null
  const t = String(type || '').trim()
  if (!t) return null

  const key = dedupeKey ? String(dedupeKey).slice(0, 128) : null

  // Dedupe: same user+type+dedupeKey within ~60s
  if (key) {
    const recent = await pool.query(
      `select id
       from notifications
       where user_id = $1 and type = $2 and dedupe_key = $3
         and created_at > now() - interval '60 seconds'
       limit 1`,
      [userId, t, key],
    )
    if (recent.rowCount > 0) return recent.rows[0]
  }

  const r = await pool.query(
    `insert into notifications (user_id, type, title, body, meta, dedupe_key)
     values ($1,$2,$3,$4,$5,$6)
     returning *`,
    [userId, t, String(title || '').slice(0, 200), body ?? null, meta ?? null, key],
  )
  const row = r.rows[0]
  // Web push: best-effort; do not block or throw
  if (row) {
    const url = meta?.url ?? '/notifications'
    sendPushToUser(userId, { title: row.title, body: row.body ?? '', url }).catch(() => {})
  }
  return row
}


