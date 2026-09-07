import { test, expect } from '@playwright/test'
import { signupTestUser, signInAs } from './support/auth'

const API_URL = 'http://localhost:3000/v1'

test('an invalid/expired session redirects to login instead of leaving a dead-in-place UI', async ({
  page,
  request,
}) => {
  const user = await signupTestUser(request)
  await request.post(`${API_URL}/contacts`, {
    headers: { Authorization: `Bearer ${user.accessToken}` },
    data: { name: 'Session Expiry Test Contact' },
  })

  await signInAs(page, user)
  await expect(page).toHaveURL(/\/dashboard/)
  await expect(page.getByText('Live')).toBeVisible({ timeout: 10000 })

  // Simulates both the access token expiring and the refresh token being
  // dead too (e.g. revoked, or expired past its own longer TTL) — the case
  // api.ts's refresh-then-give-up path is for.
  await page.evaluate(() => {
    localStorage.setItem('occasion.accessToken', 'invalid.invalid.invalid')
    localStorage.setItem('occasion.refreshToken', 'invalid.invalid.invalid')
  })

  // Any authenticated fetch will 401; reloading re-fires the dashboard's
  // queries on mount without needing a UI interaction to trigger one.
  await page.reload()

  await expect(page).toHaveURL(/\/login/, { timeout: 10000 })
})
