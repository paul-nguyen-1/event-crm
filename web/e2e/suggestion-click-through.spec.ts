import { test, expect } from '@playwright/test'
import { signupTestUser, signInAs } from './support/auth'

const API_URL = 'http://localhost:3000/v1'

test('suggestion panel click-through resolves to a real Amazon product page', async ({
  page,
  request,
}) => {
  const user = await signupTestUser(request)

  // Matches the seeded catalog's 'cooking' tag (api/prisma/seed.ts) so the
  // suggestion panel shows a ranked match rather than the no-interests
  // fallback list.
  const contactResponse = await request.post(`${API_URL}/contacts`, {
    headers: { Authorization: `Bearer ${user.accessToken}` },
    data: { name: 'Playwright Test Contact', interests: ['cooking'] },
  })
  expect(contactResponse.ok()).toBe(true)
  const contact = (await contactResponse.json()) as { id: string }

  await signInAs(page, user)
  await page.goto(`/contacts/${contact.id}`)

  const buyLink = page.getByRole('link', { name: /buy/i }).first()
  await expect(buyLink).toBeVisible({ timeout: 10000 })
  await buyLink.click()

  await expect(page).toHaveURL(/\/gift\//)
  const continueButton = page.getByRole('button', { name: 'Continue to Amazon' })
  await expect(continueButton).toBeEnabled()

  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    continueButton.click(),
  ])
  // waitUntil: 'commit' — only the URL matters here, and the default
  // 'load' state can hang for a long time on a real, heavy amazon.com page.
  await popup.waitForURL(/amazon\.com/, { timeout: 10000, waitUntil: 'commit' })
  expect(popup.url()).toContain('amazon.com')
})
