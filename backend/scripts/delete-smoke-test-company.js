/**
 * One-off: delete "Smoke Test Ltd" companies and their job posts (cascade removes related rows).
 * Run from backend: node scripts/delete-smoke-test-company.js
 * Uses DATABASE_URL from .env (or environment).
 */
import 'dotenv/config'
import { pool } from '../src/db/pool.js'

async function main() {
  const before = await pool.query(
    "select id, name from companies where name = 'Smoke Test Ltd'"
  )
  if (before.rows.length === 0) {
    console.log('No companies named "Smoke Test Ltd" found.')
    process.exit(0)
    return
  }
  console.log(`Found ${before.rows.length} company/companies to remove:`, before.rows.map((r) => r.id))

  const r = await pool.query("delete from companies where name = 'Smoke Test Ltd'")
  console.log(`Deleted ${r.rowCount} company row(s). Job posts and related rows were removed by cascade.`)
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
