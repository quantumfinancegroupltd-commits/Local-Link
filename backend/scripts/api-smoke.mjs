#!/usr/bin/env node
/**
 * API smoke test: health, ready, and auth-protected endpoints.
 * Run: node scripts/api-smoke.mjs [API_BASE_URL]
 * e.g. API_BASE_URL=http://localhost:4000 node scripts/api-smoke.mjs
 */
// Base URL without /api suffix (script appends /api/health etc.)
const raw = process.env.API_BASE_URL || process.env.E2E_API_URL || 'http://localhost:4000'
const API_BASE = raw.replace(/\/api\/?$/, '')

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

  // 5. Public marketplace services (discovery)
  const marketplaceServices = await fetchJSON(`${API_BASE}/api/marketplace/services`)
  if (!marketplaceServices.ok) {
    failures.push({ name: 'marketplace/services', status: marketplaceServices.status, text: marketplaceServices.text })
  } else {
    const list = Array.isArray(marketplaceServices.json) ? marketplaceServices.json : []
    console.log('✓ /api/marketplace/services', list.length, 'services')
  }

  // 6. Public artisans list (providers)
  const artisansList = await fetchJSON(`${API_BASE}/api/artisans`)
  if (!artisansList.ok) {
    failures.push({ name: 'artisans', status: artisansList.status, text: artisansList.text })
  } else {
    const list = Array.isArray(artisansList.json) ? artisansList.json : []
    console.log('✓ /api/artisans', list.length, 'artisans')
  }

  // 7. Demo login + profile + timeline (optional; set DEMO_EMAIL + DEMO_PASSWORD or use defaults)
  const demoEmail = process.env.DEMO_EMAIL || 'akua.mensah@demo.locallink.agency'
  const demoPassword = process.env.DEMO_PASSWORD || 'Ghana2025!'
  const loginRes = await fetchJSON(`${API_BASE}/api/login`, {
    method: 'POST',
    body: JSON.stringify({ email: demoEmail, password: demoPassword }),
  })
  if (!loginRes.ok || !loginRes.json?.token) {
    console.log('⊘ demo login skipped or failed (no token) – ensure demo user exists')
  } else {
    console.log('✓ /api/login (demo)', loginRes.json.user?.role || '')
    const token = loginRes.json.token
    const auth = { Authorization: `Bearer ${token}` }

    const profileRes = await fetchJSON(`${API_BASE}/api/profile/me`, { headers: auth })
    if (!profileRes.ok) {
      failures.push({ name: 'profile/me', status: profileRes.status, text: profileRes.text })
    } else {
      console.log('✓ /api/profile/me')
    }

    const timelineRes = await fetchJSON(`${API_BASE}/api/timeline?limit=10`, { headers: auth })
    if (!timelineRes.ok) {
      failures.push({ name: 'timeline', status: timelineRes.status, text: timelineRes.text })
    } else {
      const events = timelineRes.json?.events ?? []
      console.log('✓ /api/timeline', events.length, 'events')
    }
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
