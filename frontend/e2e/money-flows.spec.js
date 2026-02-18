/**
 * Critical money-flow smoke tests.
 * Tests: wallet visibility, escrow pages, order flows, admin disputes.
 * Does NOT complete Paystack (payment redirect).
 */
import { test, expect } from '@playwright/test'
import { createUserAndLogin, setAuthStorage } from './helpers/auth.js'
import { ensureAdmin } from './helpers/admin.js'

test('buyer: orders page loads with search and filters', async ({ page, request, baseURL }) => {
  const { token, user } = await createUserAndLogin(request, baseURL, { role: 'buyer' })
  await setAuthStorage(page, { token, user })
  await page.goto('/buyer/orders')
  await expect(page.getByText('My orders')).toBeVisible()
  await expect(page.getByRole('button', { name: /Copy link/i })).toBeVisible()
})

test('buyer: jobs page loads with search, tabs, copy link, export', async ({ page, request, baseURL }) => {
  const { token, user } = await createUserAndLogin(request, baseURL, { role: 'buyer' })
  await setAuthStorage(page, { token, user })
  await page.goto('/buyer/jobs')
  await expect(page.getByText('My Jobs')).toBeVisible()
  await expect(page.getByRole('button', { name: /Copy link/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /Export CSV/i })).toBeVisible()
})

test('artisan: pipeline and wallet section load', async ({ page, request, baseURL }) => {
  const { token, user } = await createUserAndLogin(request, baseURL, { role: 'artisan' })
  await setAuthStorage(page, { token, user })
  await page.goto('/artisan')
  await expect(page.getByText('Work pipeline')).toBeVisible()
  await expect(page.getByText('Wallet')).toBeVisible()
})

test('farmer: orders pipeline loads with filters', async ({ page, request, baseURL }) => {
  const { token, user } = await createUserAndLogin(request, baseURL, { role: 'farmer' })
  await setAuthStorage(page, { token, user })
  await page.goto('/farmer/orders')
  await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Copy link/i })).toBeVisible()
})

test('driver: deliveries pipeline loads', async ({ page, request, baseURL }) => {
  const { token, user } = await createUserAndLogin(request, baseURL, { role: 'driver' })
  await setAuthStorage(page, { token, user })
  await page.goto('/driver')
  await expect(page.getByText('Driver Dashboard')).toBeVisible()
})

const skipAdminTests = () =>
  process.env.E2E_SKIP_ADMIN === '1' || (process.env.E2E_BASE_URL || '').includes('locallink.agency')

test.skip(skipAdminTests(), 'Admin bootstrap disabled in production')
test('admin: dashboard loads with disputes and payouts', async ({ page, request, baseURL }) => {
  const apiBaseURL = `${baseURL.replace(/\/$/, '')}/api`
  const { token, user } = await ensureAdmin(request, apiBaseURL)
  await setAuthStorage(page, { token, user })
  await page.goto('/admin')
  await expect(page.getByRole('link', { name: 'Admin' })).toBeVisible()
  await expect(page.getByText(/Disputes|Payouts|Escrows|Users|Set a new admin password/i).first()).toBeVisible()
})
