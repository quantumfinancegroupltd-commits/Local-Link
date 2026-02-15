import { test, expect } from '@playwright/test'
import { createUserAndLogin, setAuthStorage } from './helpers/auth.js'

async function ensureAdmin(request, apiBaseURL) {
  const secret = process.env.E2E_ADMIN_BOOTSTRAP_SECRET || 'dev_only_change_me'
  const email = process.env.E2E_ADMIN_EMAIL || 'diag-admin@locallink.test'
  const password = process.env.E2E_ADMIN_PASSWORD || 'DiagPass123!'

  const boot = await request.post(`${apiBaseURL}/bootstrap/admin`, {
    data: { secret, name: 'Diagnostics Admin', email, password },
  })

  if (boot.ok()) {
    const data = await boot.json()
    return { token: data?.token, user: data?.user }
  }

  // If an admin already exists, log in with the known credentials (diagnostics environment).
  if (boot.status() === 409) {
    const login = await request.post(`${apiBaseURL}/login`, { data: { email, password } })
    if (!login.ok()) throw new Error(`admin login failed: ${login.status()} ${await login.text()}`)
    const data = await login.json()
    return { token: data?.token, user: data?.user }
  }

  throw new Error(`admin bootstrap failed: ${boot.status()} ${await boot.text()}`)
}

async function verifyUser(request, apiBaseURL, { userToken, adminToken }) {
  // Submit a verification request with synthetic upload URLs (format-validated only).
  const submit = await request.post(`${apiBaseURL}/id-verification/submit`, {
    headers: { Authorization: `Bearer ${userToken}` },
    data: {
      id_type: 'ghana_card',
      id_front_url: '/api/uploads/diag-id-front.jpg',
      id_back_url: '/api/uploads/diag-id-back.jpg',
      selfie_url: '/api/uploads/diag-selfie.jpg',
      extracted_data: { name: 'Diagnostics User', id_number: 'GHA-TEST-000000', dob: '1990-01-01' },
    },
  })
  if (!submit.ok()) {
    throw new Error(`id verification submit failed: ${submit.status()} ${await submit.text()}`)
  }
  const reqObj = await submit.json()
  const reqId = reqObj?.id
  if (!reqId) throw new Error(`id verification response missing id: ${JSON.stringify(reqObj)}`)

  const approve = await request.post(`${apiBaseURL}/id-verification/admin/requests/${encodeURIComponent(reqId)}/approve`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  })
  if (!approve.ok()) throw new Error(`id verification approve failed: ${approve.status()} ${await approve.text()}`)
}

async function createFarmerAndProduct(request, baseURL) {
  const apiBaseURL = `${baseURL.replace(/\/$/, '')}/api`
  const admin = await ensureAdmin(request, apiBaseURL)
  const farmer = await createUserAndLogin(request, baseURL, { role: 'farmer', prefix: 'farmer' })

  // Create minimal farmer profile so product creation is allowed.
  const farmerProfileRes = await request.post(`${apiBaseURL}/farmers/me`, {
    headers: { Authorization: `Bearer ${farmer.token}` },
    data: {
      farm_location: 'Accra',
      farm_lat: 5.6037,
      farm_lng: -0.187,
    },
  })
  if (!farmerProfileRes.ok()) {
    throw new Error(`create farmer profile failed: ${farmerProfileRes.status()} ${await farmerProfileRes.text()}`)
  }

  // Product creation is gated behind ID verification for farmer role.
  await verifyUser(request, apiBaseURL, { userToken: farmer.token, adminToken: admin.token })

  const prodRes = await request.post(`${apiBaseURL}/products`, {
    headers: { Authorization: `Bearer ${farmer.token}` },
    data: { name: 'Tomatoes', category: 'vegetables', quantity: 10, unit: 'kg', price: 50 },
  })
  if (!prodRes.ok()) {
    throw new Error(`create product failed: ${prodRes.status()} ${await prodRes.text()}`)
  }
  const prod = await prodRes.json()
  const productId = prod?.id ?? prod?.product?.id
  if (!productId) throw new Error(`create product response missing id: ${JSON.stringify(prod)}`)
  return { productId }
}

test('marketplace: product detail shows order UI and respects auth', async ({ page, request, baseURL }) => {
  const { productId } = await createFarmerAndProduct(request, baseURL)

  // Unauthed: should see prompt to sign in
  await page.goto(`/marketplace/products/${productId}`)
  await expect(page.getByText('Sign in to place an order')).toBeVisible()

  // Authed buyer: fields enabled (we do NOT submit payment here)
  const buyer = await createUserAndLogin(request, baseURL, { role: 'buyer', prefix: 'buyer' })
  await setAuthStorage(page, { token: buyer.token, user: buyer.user })

  await page.goto(`/marketplace/products/${productId}`)
  await expect(page.getByRole('heading', { name: 'Tomatoes' })).toBeVisible()
  await expect(page.getByLabel('Quantity')).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Place order' })).toBeVisible()
})


