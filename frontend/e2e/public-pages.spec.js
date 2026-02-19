import { test, expect } from '@playwright/test'

test('public: jobs list page loads', async ({ page }) => {
  await page.goto('/jobs')
  await expect(page.getByRole('navigation')).toBeVisible()
  await expect(
    page.getByText(/Jobs|Find work|Employers|Browse jobs/i).first()
  ).toBeVisible({ timeout: 10000 })
})

test('public: marketplace has search or product list', async ({ page }) => {
  await page.goto('/marketplace')
  await expect(page.getByPlaceholder(/Search|Find produce/i).or(page.getByText(/Farmers|Marketplace|Produce/i))).toBeVisible({ timeout: 10000 })
})

test('public: provider profile by id loads (or 404)', async ({ page, request, baseURL }) => {
  await page.goto('/u/00000000-0000-0000-0000-000000000000')
  await expect(page.getByRole('navigation')).toBeVisible()
  const hasContent = await page.getByText(/Profile|Not found|404|User/i).first().isVisible().catch(() => false)
  expect(hasContent).toBeTruthy()
})
