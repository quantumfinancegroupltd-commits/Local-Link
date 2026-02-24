#!/usr/bin/env node
/**
 * Run API smoke test for every demo role.
 * Usage: API_BASE_URL=https://locallink.agency node scripts/smoke-all-roles.mjs
 */
import { spawn } from 'child_process'

const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'Ghana2025!'
const API_BASE = process.env.API_BASE_URL || process.env.E2E_API_URL || 'http://localhost:4000'

const ROLES = [
  { email: 'akua.mensah@demo.locallink.agency', role: 'Buyer' },
  { email: 'kofi.asante@demo.locallink.agency', role: 'Artisan' },
  { email: 'abena.osei@demo.locallink.agency', role: 'Farmer' },
  { email: 'yaw.boateng@demo.locallink.agency', role: 'Driver' },
  { email: 'afia.addo@demo.locallink.agency', role: 'Artisan' },
  { email: 'ama.serwaa@demo.locallink.agency', role: 'Company' },
  { email: 'kwame.owusu@demo.locallink.agency', role: 'Artisan' },
  { email: 'esi.tawiah@demo.locallink.agency', role: 'Artisan' },
  { email: 'kwabena.mensah@demo.locallink.agency', role: 'Artisan' },
]

function runSmoke(email) {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      ['scripts/api-smoke.mjs'],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          DEMO_EMAIL: email,
          DEMO_PASSWORD,
          API_BASE_URL: API_BASE,
          E2E_API_URL: API_BASE,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    )
    let out = ''
    let err = ''
    child.stdout?.on('data', (d) => { out += d; process.stdout.write(d) })
    child.stderr?.on('data', (d) => { err += d; process.stderr.write(d) })
    child.on('close', (code) => resolve({ code, out, err }))
  })
}

async function main() {
  console.log('Smoke testing all demo roles at', API_BASE, '\n')
  const results = []
  for (const { email, role } of ROLES) {
    process.stdout.write(`\n--- ${role} (${email}) ---\n`)
    const { code } = await runSmoke(email)
    results.push({ email, role, ok: code === 0 })
  }
  const failed = results.filter((r) => !r.ok)
  console.log('\n' + '='.repeat(50))
  if (failed.length) {
    console.error('Failed:', failed.map((r) => `${r.role} (${r.email})`).join(', '))
    process.exit(1)
  }
  console.log('All', results.length, 'roles passed.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
