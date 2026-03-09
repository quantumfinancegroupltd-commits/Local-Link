/**
 * One-off: change the admin user's email (e.g. from Gmail to admin@locallink.agency).
 * Run from backend with DATABASE_URL set in .env. Use your REAL DB password.
 * If you get ECONNREFUSED (IPv6): in Supabase use Settings → Database → Connection string
 * → choose "Session" mode (port 6543) and paste that URI in .env; that host usually has IPv4.
 */
import 'dotenv/config'
import dns from 'node:dns'
import pg from 'pg'

const OLD_EMAIL = process.env.OLD_EMAIL || 'locallinkagencygh@gmail.com'
const NEW_EMAIL = process.env.NEW_EMAIL || 'admin@locallink.agency'

async function getPool() {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL is not set (e.g. in backend/.env)')
  }
  if (url.includes('REPLACE_WITH_YOUR_SUPABASE_DB_PASSWORD') || url.includes('YOUR_PASSWORD') || url.includes('...')) {
    console.error('You still have the placeholder password in DATABASE_URL.')
    console.error('Open backend/.env and replace REPLACE_WITH_YOUR_SUPABASE_DB_PASSWORD with your real Supabase database password.')
    console.error('Get it from: Supabase Dashboard → your project → Settings → Database → Database password (or Reset database password).')
    process.exit(1)
  }
  const useInsecureSSL = url.includes('supabase') || url.includes('pooler')
  // Force IPv4 for remote hosts
  const hostMatch = url.match(/@([^:/]+)/)
  const hostname = hostMatch ? hostMatch[1] : null
  let host = hostname
  if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1' && !/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    try {
      const [ipv4] = await dns.promises.resolve4(hostname)
      if (ipv4) host = ipv4
    } catch (e) {}
  }
  const portMatch = url.match(/:(\d+)\//)
  const port = portMatch ? parseInt(portMatch[1], 10) : 5432
  const userMatch = url.match(/\/\/([^:]+):([^@]+)@/)
  const user = userMatch ? userMatch[1] : 'postgres'
  let password = userMatch ? userMatch[2] : ''
  try {
    password = decodeURIComponent(password)
  } catch (e) {
    // keep as-is if decoding fails
  }
  const dbMatch = url.match(/\/([^/?]+)(\?|$)/)
  const database = dbMatch ? dbMatch[1] : 'postgres'
  return new pg.Pool({
    host,
    port,
    user,
    password,
    database,
    ssl: useInsecureSSL ? { rejectUnauthorized: false } : false,
  })
}

async function run() {
  const pool = await getPool()
  const r = await pool.query(
    "select id, name, email, role from users where role = 'admin'",
  )
  if (!r.rows.length) {
    console.log('No admin user found in the database.')
    process.exit(1)
  }
  const admin = r.rows[0]
  if (admin.email === NEW_EMAIL) {
    console.log(`Admin is already ${NEW_EMAIL}. Nothing to do.`)
    process.exit(0)
  }
  if (OLD_EMAIL && admin.email !== OLD_EMAIL) {
    console.log(`Admin email in DB is "${admin.email}", but OLD_EMAIL is "${OLD_EMAIL}". Not updating (set OLD_EMAIL to match or leave unset).`)
    process.exit(1)
  }
  const byEmail = await pool.query(
    'update users set email = $1, updated_at = now() where id = $2 returning id, email',
    [NEW_EMAIL.toLowerCase(), admin.id],
  )
  if (byEmail.rowCount) {
    console.log(`Updated admin email: ${admin.email} → ${byEmail.rows[0].email}`)
    console.log('You can now log in at /admin/login with:', byEmail.rows[0].email)
  } else {
    console.log('Update failed.')
    await pool.end()
    process.exit(1)
  }
  await pool.end()
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
