import { test, expect } from '@playwright/test'
import { createUserAndLogin, setAuthStorage } from './helpers/auth.js'

test('company: can open dashboard and see profile/hiring without permission block', async ({ page, request, baseURL }) => {
  const { token, user } = await createUserAndLogin(request, baseURL, { role: 'company' })
  await setAuthStorage(page, { token, user })

  await page.goto('/company')
  await expect(page.getByRole('navigation')).toBeVisible()

  // Must NOT see the permission block (owner fallback or backend role should grant access)
  const permissionBlock = page.getByText(/doesn't have permission to edit the company profile/i)
  await expect(permissionBlock).not.toBeVisible()

  // Profile tab: company profile section visible
  await expect(page.getByText(/Company profile/i).first()).toBeVisible({ timeout: 10000 })

  // Hiring tab: open it and ensure we don't see "doesn't have permission to post jobs"
  await page.getByRole('button', { name: /Hiring/i }).click()
  const hiringPermissionBlock = page.getByText(/doesn't have permission to post jobs/i)
  await expect(hiringPermissionBlock).not.toBeVisible()
  await expect(page.getByText(/Post a job/i).first()).toBeVisible({ timeout: 5000 })
})

test('company: can save company profile then post a job', async ({ page, request, baseURL }) => {
  const { token, user } = await createUserAndLogin(request, baseURL, { role: 'company' })
  await setAuthStorage(page, { token, user })

  await page.goto('/company')
  await expect(page.getByText(/Company profile/i).first()).toBeVisible({ timeout: 10000 })

  const companyName = `Test Co ${Date.now()}`
  await page.getByLabel(/Company name/i).fill(companyName)
  await page.getByLabel(/Industry/i).fill('Retail')
  await page.getByRole('button', { name: /Save company profile/i }).click()

  await expect(page.getByText(/saved|Saved/i)).toBeVisible({ timeout: 8000 })

  await page.getByRole('button', { name: /Hiring/i }).click()
  await page.getByLabel(/Job title/i).fill('Store Associate')
  await page.getByPlaceholder(/Role summary|responsibilities/i).fill('Customer service and stock handling. Reliable and presentable.')
  await page.getByRole('button', { name: /Post job/i }).click()

  await expect(page.getByText(/Store Associate/)).toBeVisible({ timeout: 8000 })
  await expect(page.getByText(/Job posted|posted|Your jobs/i)).toBeVisible({ timeout: 5000 })
})
