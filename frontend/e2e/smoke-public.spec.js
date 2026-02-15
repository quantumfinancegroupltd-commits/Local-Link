import { test, expect } from '@playwright/test'

test('public: home loads', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('link', { name: /LocalLink/i })).toBeVisible()
})

test('public: marketplace loads', async ({ page }) => {
  await page.goto('/marketplace')
  await expect(page.getByText('Farmers Marketplace')).toBeVisible()
  await expect(page.getByPlaceholder('Search produce…')).toBeVisible()
})

test('public: providers loads', async ({ page }) => {
  await page.goto('/providers')
  // We don't rely on exact copy; just confirm page renders and isn't a login wall.
  await expect(page.getByRole('navigation')).toBeVisible()
  await expect(page.getByRole('link', { name: /marketplace/i })).toBeVisible()
})


