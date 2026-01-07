import pg from 'pg'
import { env } from '../config.js'

const { Pool } = pg

function inferSsl(connectionString) {
  // Supabase typically requires SSL. The connection string often includes `sslmode=require`.
  if (!connectionString) return undefined
  if (connectionString.includes('sslmode=require')) return { rejectUnauthorized: false }
  // If it's clearly local, skip SSL.
  if (connectionString.includes('localhost') || connectionString.includes('127.0.0.1')) return undefined
  // Default to SSL for non-local DATABASE_URL (safe for managed Postgres providers).
  return { rejectUnauthorized: false }
}

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: inferSsl(env.DATABASE_URL),
})


