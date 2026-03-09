import pg from 'pg'
import { env } from '../config.js'

const { Pool } = pg

function inferSsl(connectionString) {
  // Supabase typically requires SSL; accept self-signed / pooler certs.
  if (!connectionString) return undefined
  if (connectionString.includes('supabase') || connectionString.includes('pooler.supabase.com')) {
    return { rejectUnauthorized: false }
  }
  try {
    const u = new URL(connectionString)
    const sslmode = u.searchParams.get('sslmode')
    if (sslmode === 'require') return { rejectUnauthorized: false }

    const host = u.hostname
    if (host === 'localhost' || host === '127.0.0.1' || host === 'db') return undefined
    if (host.endsWith('.supabase.co') || host.includes('pooler.supabase.com')) return { rejectUnauthorized: false }
  } catch {
    if (connectionString.includes('localhost') || connectionString.includes('127.0.0.1') || connectionString.includes('@db:')) {
      return undefined
    }
  }
  return undefined
}

// For Supabase, strip sslmode from URL so our ssl: { rejectUnauthorized: false } is used (avoids self-signed cert error).
function connectionStringForPool(url) {
  if (!url || (!url.includes('supabase') && !url.includes('pooler.supabase.com'))) return url
  try {
    const u = new URL(url)
    u.searchParams.delete('sslmode')
    const out = u.toString()
    return out !== url ? out : url
  } catch {
    return url
  }
}

export const pool = new Pool({
  connectionString: connectionStringForPool(env.DATABASE_URL),
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


