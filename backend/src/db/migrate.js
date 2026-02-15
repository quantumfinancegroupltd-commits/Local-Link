import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { pool } from './pool.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function waitForDb() {
  // Wait up to ~30s for DB to accept connections (useful for docker-compose).
  const maxAttempts = 30
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await pool.query('select 1')
      return
    } catch (e) {
      const retryable = ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', '57P03'].includes(e?.code) // 57P03 = cannot_connect_now
      if (!retryable || i === maxAttempts) throw e
      // eslint-disable-next-line no-console
      console.log(`DB not ready yet (attempt ${i}/${maxAttempts})...`)
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 1000))
    }
  }
}

async function ensureMigrationsTable() {
  await pool.query(`
    create table if not exists schema_migrations (
      id text primary key,
      applied_at timestamptz not null default now()
    );
  `)
}

function listMigrationFiles() {
  const dir = path.join(__dirname, 'migrations')
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b))
  return files.map((f) => ({ id: f, fullPath: path.join(dir, f) }))
}

async function hasMigration(id) {
  const res = await pool.query('select 1 from schema_migrations where id = $1', [id])
  return res.rowCount > 0
}

async function applyMigration(id, sql) {
  const client = await pool.connect()
  try {
    await client.query('begin')
    await client.query(sql)
    await client.query('insert into schema_migrations (id) values ($1) on conflict (id) do nothing', [id])
    await client.query('commit')
  } catch (e) {
    try {
      await client.query('rollback')
    } catch {}
    throw e
  } finally {
    client.release()
  }
}

async function main() {
  await waitForDb()
  // Prevent concurrent migration runners from racing.
  const lockClient = await pool.connect()
  try {
    await lockClient.query('select pg_advisory_lock($1, $2)', [8273, 6412])
    await ensureMigrationsTable()
    const migrations = listMigrationFiles()

    for (const m of migrations) {
      // eslint-disable-next-line no-await-in-loop
      const already = await hasMigration(m.id)
      if (already) continue
      const sql = fs.readFileSync(m.fullPath, 'utf8')
      // eslint-disable-next-line no-console
      console.log(`Applying migration: ${m.id}`)
      // eslint-disable-next-line no-await-in-loop
      await applyMigration(m.id, sql)
    }
  } finally {
    try {
      await lockClient.query('select pg_advisory_unlock($1, $2)', [8273, 6412])
    } catch {}
    lockClient.release()
  }

  // eslint-disable-next-line no-console
  console.log('Migrations complete.')
  await pool.end()
}

main().catch(async (e) => {
  // eslint-disable-next-line no-console
  console.error(e)
  try {
    await pool.end()
  } catch {}
  process.exit(1)
})


