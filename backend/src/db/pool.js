import pg from 'pg'
import { env } from '../config.js'

const { Pool } = pg

function inferSsl(connectionString) {
  // Supabase typically requires SSL. The connection string often includes `sslmode=require`.
  if (!connectionString) return undefined
  try {
    const u = new URL(connectionString)
    const sslmode = u.searchParams.get('sslmode')
    if (sslmode === 'require') return { rejectUnauthorized: false }

    // Local/dev DBs typically don't support SSL.
    const host = u.hostname
    if (host === 'localhost' || host === '127.0.0.1' || host === 'db') return undefined

    // Known managed providers that require/expect SSL
    if (host.endsWith('.supabase.co')) return { rejectUnauthorized: false }
  } catch {
    // If it's clearly local, skip SSL.
    if (connectionString.includes('localhost') || connectionString.includes('127.0.0.1') || connectionString.includes('@db:')) {
      return undefined
    }
  }

  // Default: no SSL unless explicitly requested or known provider.
  return undefined
}

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: inferSsl(env.DATABASE_URL),
  max: Number(env.PG_POOL_MAX ?? 10),
  idleTimeoutMillis: Number(env.PG_POOL_IDLE_TIMEOUT_MS ?? 30_000),
  connectionTimeoutMillis: Number(env.PG_POOL_CONN_TIMEOUT_MS ?? 5_000),
})

pool.on('connect', (client) => {
  const ms = Number(env.PG_STATEMENT_TIMEOUT_MS ?? 0)
  if (Number.isFinite(ms) && ms > 0) {
    client.query('set statement_timeout = $1', [String(Math.floor(ms))]).catch(() => {})
  }
})

pool.on('error', (err) => {
  // eslint-disable-next-line no-console
  console.error('Unexpected Postgres pool error', err)
})


