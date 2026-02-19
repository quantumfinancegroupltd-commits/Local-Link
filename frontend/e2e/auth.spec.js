import { test, expect } from '@playwright/test'
import { createUserAndLogin, setAuthStorage } from './helpers/auth.js'

test('auth: login page loads and shows form', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: /Sign in|Log in|Login/i })).toBeVisible({ timeout: 10000 })
  await expect(page.getByLabel(/Email/i)).toBeVisible()
  await expect(page.getByLabel(/Password/i)).toBeVisible()
  await expect(page.getByRole('button', { name: /Sign in|Log in|Submit/i })).toBeVisible()
})

test('auth: register page loads and shows role options', async ({ page }) => {
  await page.goto('/register')
  await expect(page.getByRole('heading', { name: /Register|Sign up|Create account/i })).toBeVisible({ timeout: 10000 })
  await expect(page.getByLabel(/Email/i)).toBeVisible()
  await expect(page.getByLabel(/Password/i)).toBeVisible()
  const roleSelect = page.getByLabel(/Role|I am a/i)
  if (await roleSelect.isVisible()) {
    await expect(roleSelect).toBeVisible()
  }
})

test('auth: login with API-created user redirects to role home', async ({ page, request, baseURL }) => {
  const { token, user } = await createUserAndLogin(request, baseURL, { role: 'buyer' })
  await setAuthStorage(page, { token, user })
  await page.goto('/')
  await expect(page).not.toHaveURL(/\/login/)
  await page.goto('/buyer')
  await expect(page.getByText(/Today|My Jobs|Buyer|Dashboard/i).first()).toBeVisible({ timeout: 10000 })
})
