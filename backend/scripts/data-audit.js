/**
 * Data audit: row counts and date ranges for key tables.
 * Use this to see if the database has data and whether it might need restoring.
 *
 * Run from backend:
 *   node scripts/data-audit.js
 * Or with explicit DB (e.g. production):
 *   DATABASE_URL="postgresql://..." node scripts/data-audit.js
 *
 * Compares with API: GET /api/admin/data-audit (admin auth required) returns the same structure.
 */
import 'dotenv/config'
import { pool } from '../src/db/pool.js'

const TABLES = [
  { name: 'users', countCol: 'id', dateCol: 'created_at', extra: 'where deleted_at is null' },
  { name: 'jobs', countCol: 'id', dateCol: 'created_at' },
  { name: 'orders', countCol: 'id', dateCol: 'created_at' },
  { name: 'products', countCol: 'id', dateCol: 'created_at' },
  { name: 'analytics_events', countCol: 'id', dateCol: 'created_at' },
  { name: 'posts', countCol: 'id', dateCol: 'created_at' },
  { name: 'escrow_transactions', countCol: 'id', dateCol: 'created_at' },
  { name: 'support_tickets', countCol: 'id', dateCol: 'created_at' },
  { name: 'admin_audit_logs', countCol: 'id', dateCol: 'created_at' },
  { name: 'companies', countCol: 'id', dateCol: 'created_at' },
  { name: 'job_posts', countCol: 'id', dateCol: 'created_at' },
]

async function run() {
  console.log('Data audit — connected DB')
  console.log('(DATABASE_URL host is hidden; this is the DB the app would use with this .env)\n')

  const audit = {}
  for (const t of TABLES) {
    try {
      const where = t.extra ? ` ${t.extra}` : ''
      const r = await pool.query(
        `select count(*)::int as n, min(${t.dateCol})::text as min_at, max(${t.dateCol})::text as max_at from ${t.name}${where}`,
      )
      const row = r.rows?.[0]
      audit[t.name] = {
        rows: row?.n ?? 0,
        earliest: row?.min_at ?? null,
        latest: row?.max_at ?? null,
      }
    } catch (e) {
      const code = String(e?.code ?? '')
      const msg = e?.message || ''
      if (code === '42P01') audit[t.name] = { error: 'table_missing', rows: 0, earliest: null, latest: null }
      else if (msg.includes('ENOTFOUND') || msg.includes('getaddrinfo')) audit[t.name] = { error: 'connection_failed', rows: 0, earliest: null, latest: null }
      else if (msg.includes('Tenant or user not found') || msg.includes('password authentication failed')) audit[t.name] = { error: 'auth_failed', rows: 0, earliest: null, latest: null }
      else audit[t.name] = { error: msg.slice(0, 40) || 'query_failed', rows: 0, earliest: null, latest: null }
    }
  }

  const col1 = 22
  const col2 = 10
  const col3 = 28
  const col4 = 28
  console.log(
    `${'Table'.padEnd(col1)} ${'Rows'.padStart(col2)} ${'Earliest'.padEnd(col3)} ${'Latest'.padEnd(col4)}`,
  )
  console.log('-'.repeat(col1 + col2 + col3 + col4 + 3))

  for (const t of TABLES) {
    const a = audit[t.name]
    const rows = a?.error ? `(${a.error})` : String(a?.rows ?? 0)
    const earliest = a?.earliest ? a.earliest.slice(0, 19).replace('T', ' ') : '—'
    const latest = a?.latest ? a.latest.slice(0, 19).replace('T', ' ') : '—'
    console.log(`${t.name.padEnd(col1)} ${rows.padStart(col2)} ${earliest.padEnd(col3)} ${latest.padEnd(col4)}`)
  }

  const ae = audit.analytics_events
  const users = audit.users
  const firstErr = Object.values(audit).find((a) => a?.error === 'connection_failed')
  console.log('')
  if (firstErr) {
    console.log('⚠️  Could not connect to the database (ENOTFOUND / getaddrinfo).')
    console.log('   Use your real DATABASE_URL, not the placeholder "...". Example:')
    console.log('   DATABASE_URL="postgresql://user:password@host:5432/dbname" node scripts/data-audit.js')
    console.log('   Run from the backend folder: cd backend  then  DATABASE_URL="..." node scripts/data-audit.js')
    console.log('')
  }
  const authFailed = Object.values(audit).find((a) => a?.error === 'auth_failed')
  if (authFailed) {
    console.log('⚠️  Supabase returned "Tenant or user not found" (or auth failed).')
    console.log('   You must use YOUR real connection string from Supabase, not the example.')
    console.log('   1. Open Supabase Dashboard → your project → Settings → Database')
    console.log('   2. Copy "Connection string" → URI')
    console.log('   3. Replace [YOUR-PASSWORD] in the URI with your actual database password')
    console.log('   4. Run: DATABASE_URL="<paste-that-whole-uri>" node scripts/data-audit.js')
    console.log('')
  }
  if (ae?.rows === 0 || ae?.error) {
    console.log('⚠️  analytics_events is empty or missing → Countries (and traffic) in Admin will show no data.')
    console.log('   Either this DB never had traffic, or it was reset. Restore from backup or wait for new traffic.')
  }
  if (users?.rows === 0 || users?.error) {
    console.log('⚠️  users is empty or missing → No logins. Bootstrap admin and/or seed demo users.')
  }
  if (ae?.latest && users?.latest) {
    const aeDate = new Date(ae.latest).getTime()
    const usersDate = new Date(users.latest).getTime()
    const weekAgo = Date.now() - 7 * 24 * 3600 * 1000
    if (aeDate < weekAgo && usersDate >= weekAgo) {
      console.log('⚠️  analytics_events latest is older than 7 days while users has recent data → possible DB switch: this DB may be old or analytics was cleared.')
    }
  }
  console.log('')
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
