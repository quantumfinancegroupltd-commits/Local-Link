import { pool } from '../db/pool.js'

// Lightweight activity tracking so we can compute response_rate / "recent activity"
// without writing on every request.

const lastWriteByUser = new Map() // userId -> epoch ms
const MIN_INTERVAL_MS = 5 * 60 * 1000

export function markActive(userId) {
  if (!userId) return
  const now = Date.now()
  const last = lastWriteByUser.get(userId) ?? 0
  if (now - last < MIN_INTERVAL_MS) return
  lastWriteByUser.set(userId, now)

  // fire-and-forget; failures shouldn't break requests
  pool
    .query('update users set last_active_at = now(), updated_at = updated_at where id = $1', [userId])
    .catch(() => {})
}


