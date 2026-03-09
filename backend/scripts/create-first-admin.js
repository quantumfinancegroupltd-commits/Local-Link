/**
 * Create the first admin user directly in the DB (no API or ADMIN_BOOTSTRAP_SECRET needed).
 * Use when you've run migrations and need the first admin. Uses DATABASE_URL from .env.
 *
 *   node scripts/create-first-admin.js
 *
 * Default: admin@locallink.agency / Ghana2025!
 * Override: EMAIL=admin@locallink.agency PASSWORD=YourPassword node scripts/create-first-admin.js
 */
import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { pool } from '../src/db/pool.js'

const EMAIL = process.env.EMAIL || 'admin@locallink.agency'
const PASSWORD = process.env.PASSWORD || 'Ghana2025!'
const NAME = process.env.NAME || 'Admin'

async function run() {
  const existing = await pool.query("select id, email from users where role = 'admin' limit 1")
  if (existing.rows.length) {
    console.log('An admin already exists:', existing.rows[0].email)
    process.exit(0)
  }
  const passwordHash = await bcrypt.hash(PASSWORD, 10)
  const result = await pool.query(
    `insert into users (name, email, phone, password_hash, role, verified, must_change_password)
     values ($1,$2,null,$3,'admin',true,false)
     returning id, name, email, role`,
    [NAME, EMAIL.toLowerCase(), passwordHash],
  )
  const admin = result.rows[0]
  await pool.query(
    `insert into wallets (user_id, balance, currency) values ($1, 0, 'GHS') on conflict (user_id) do nothing`,
    [admin.id],
  )
  console.log('First admin created.')
  console.log('  Email:', admin.email)
  console.log('  Log in at https://locallink.agency/admin/login with this email and your chosen password.')
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
