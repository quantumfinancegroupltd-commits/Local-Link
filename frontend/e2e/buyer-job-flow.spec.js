import { test, expect } from '@playwright/test'
import { createUserAndLogin, setAuthStorage } from './helpers/auth.js'

test('buyer: can post a job (no media)', async ({ page, request, baseURL }) => {
  const { token, user } = await createUserAndLogin(request, baseURL, { role: 'buyer' })
  await setAuthStorage(page, { token, user })

  await page.goto('/buyer/jobs/new')
  await expect(page.getByRole('heading', { name: 'Post a job' })).toBeVisible()

  await page.getByLabel('Job title').fill('Fix leaking tap')
  await page.getByLabel('Description').fill('Kitchen tap leaking, bring tools.')
  await page.getByLabel('Location').fill('Accra')
  await page.getByLabel('Budget (optional)').fill('150')

  await page.getByRole('button', { name: 'Post job' }).click()

  await expect(page.getByText('Fix leaking tap')).toBeVisible()
  await expect(page.getByText('Kitchen tap leaking')).toBeVisible()
})


