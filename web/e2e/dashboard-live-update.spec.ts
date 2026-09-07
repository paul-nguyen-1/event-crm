import { test, expect } from '@playwright/test'
import { signupTestUser, signInAs } from './support/auth'
import { insertReminderDueEvent } from './support/insert-reminder-due'

const API_URL = 'http://localhost:3000/v1'

test('dashboard shows Live and reflects a reminder pushed in real time', async ({
  page,
  request,
}) => {
  const user = await signupTestUser(request)

  // The dashboard's connection indicator (and the rest of the "Upcoming"
  // view) only renders once the user has at least one contact — a brand
  // new account instead sees the zero-state onboarding screen.
  await request.post(`${API_URL}/contacts`, {
    headers: { Authorization: `Bearer ${user.accessToken}` },
    data: { name: 'Playwright Test Contact' },
  })

  await signInAs(page, user)

  await expect(page.getByText('Live')).toBeVisible({ timeout: 10000 })

  const title = `Playwright live-update test ${Date.now()}`
  await insertReminderDueEvent({
    userId: user.userId,
    title,
    body: 'Delivered via the real outbox -> RabbitMQ -> notification-service -> WS path.',
    deepLink: '/contacts/does-not-matter',
  })

  // The real running api's OutboxRelayService polls every 5s, so this
  // allows a full cycle plus delivery/render time rather than asserting on
  // the first poll.
  await expect(page.getByText(title)).toBeVisible({ timeout: 15000 })
})
