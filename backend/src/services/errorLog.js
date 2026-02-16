import { pool } from '../db/pool.js'

/**
 * Log an error to the database for admin visibility. Fire-and-forget; never throws.
 * @param {Error} err
 * @param {import('express').Request} [req]
 */
export function logErrorToDb(err, req = null) {
  const message = err?.message ?? String(err)
  const stack = err?.stack ?? null
  const code = err?.code ?? null
  const method = req?.method ?? null
  const path = req?.path ?? req?.url ?? null
  const reqId = req?.id ?? null
  const userId = req?.user?.sub ?? null

  setImmediate(() => {
    pool
      .query(
        `insert into error_logs (message, stack, code, method, path, req_id, user_id)
         values ($1, $2, $3, $4, $5, $6, $7)`,
        [message.slice(0, 2000), (stack || '').slice(0, 10000), code, method, path, reqId, userId],
      )
      .catch(() => {
        // Silently ignore DB errors (e.g. table not yet migrated)
      })
  })
}
