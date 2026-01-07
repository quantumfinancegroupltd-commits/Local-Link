import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { pool } from './pool.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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
  await pool.query('begin')
  try {
    await pool.query(sql)
    await pool.query('insert into schema_migrations (id) values ($1)', [id])
    await pool.query('commit')
  } catch (e) {
    await pool.query('rollback')
    throw e
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to run migrations')
  }

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


