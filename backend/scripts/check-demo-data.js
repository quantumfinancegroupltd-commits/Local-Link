/**
 * Check if the database has demo data (services, products, jobs).
 * Run from backend: node scripts/check-demo-data.js
 * If counts are 0, run: node scripts/seed-demo-users.js
 */
import 'dotenv/config'
import { pool } from '../src/db/pool.js'

async function run() {
  const services = await pool.query('select count(*) as n from artisan_services')
  const products = await pool.query("select count(*) as n from products where status = 'available'")
  const jobs = await pool.query("select count(*) as n from job_posts where status = 'open'")
  const sn = Number(services.rows[0]?.n ?? 0)
  const pn = Number(products.rows[0]?.n ?? 0)
  const jn = Number(jobs.rows[0]?.n ?? 0)

  console.log('Demo data check:')
  console.log('  artisan_services (marketplace Services tab):', sn)
  console.log('  products (Farmers & Florists):', pn)
  console.log('  job_posts (Employers open roles):', jn)

  if (sn === 0 || pn === 0 || jn === 0) {
    console.log('\nTo populate demo data, run:')
    console.log('  cd backend && node scripts/seed-demo-users.js')
    console.log('(Ensure .env DATABASE_URL points to this database.)')
    process.exit(1)
  }
  console.log('\nDemo data present.')
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
