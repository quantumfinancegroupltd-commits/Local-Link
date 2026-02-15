#!/usr/bin/env node
/**
 * API smoke test: health, ready, and auth-protected endpoints.
 * Run: node scripts/api-smoke.mjs [API_BASE_URL]
 * e.g. API_BASE_URL=http://localhost:4000 node scripts/api-smoke.mjs
 */
const API_BASE = process.env.API_BASE_URL || process.env.E2E_API_URL || 'http://localhost:4000'

async function fetchJSON(url, opts = {}) {
  const res = await fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', ...opts.headers } })
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {}
  return { ok: res.ok, status: res.status, json, text }
}

async function main() {
  const failures = []

  // 1. Health
  const health = await fetchJSON(`${API_BASE}/api/health`)
  if (!health.ok) {
    failures.push({ name: 'health', status: health.status, text: health.text })
  } else {
    console.log('✓ /api/health', health.status)
  }

  // 2. Ready (DB)
  const ready = await fetchJSON(`${API_BASE}/api/ready`)
  if (!ready.ok) {
    failures.push({ name: 'ready', status: ready.status, text: ready.text })
  } else {
    console.log('✓ /api/ready', ready.status)
  }

  // 3. Unauthed wallet should 401
  const walletUnauth = await fetchJSON(`${API_BASE}/api/wallets/me`)
  if (walletUnauth.status !== 401) {
    failures.push({ name: 'wallets/me unauthed', expected: 401, got: walletUnauth.status })
  } else {
    console.log('✓ /api/wallets/me unauthed → 401')
  }

  // 4. Unauthed escrow list should 401
  const escrowUnauth = await fetchJSON(`${API_BASE}/api/escrow/disputes`)
  if (escrowUnauth.status !== 401) {
    failures.push({ name: 'escrow/disputes unauthed', expected: 401, got: escrowUnauth.status })
  } else {
    console.log('✓ /api/escrow/disputes unauthed → 401')
  }

  if (failures.length) {
    console.error('\nFailures:', JSON.stringify(failures, null, 2))
    process.exit(1)
  }
  console.log('\nAPI smoke: all checks passed')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
