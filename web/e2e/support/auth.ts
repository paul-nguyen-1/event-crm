import type { APIRequestContext, Page } from '@playwright/test'

const API_URL = 'http://localhost:3000/v1'

interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export interface TestUser {
  email: string
  password: string
  userId: string
  accessToken: string
  refreshToken: string
}

function decodeUserId(accessToken: string): string {
  const payloadSegment = accessToken.split('.')[1]
  const payload = JSON.parse(Buffer.from(payloadSegment, 'base64').toString('utf8')) as {
    sub: string
  }
  return payload.sub
}

/** Signs up a fresh user directly against the api, bypassing the signup form. */
export async function signupTestUser(request: APIRequestContext): Promise<TestUser> {
  const email = `pw-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`
  const password = 'Playwright-Test-1234!'

  const response = await request.post(`${API_URL}/auth/signup`, {
    data: { email, password },
  })
  if (!response.ok()) {
    throw new Error(`signup failed: ${response.status()} ${await response.text()}`)
  }
  const tokens = (await response.json()) as AuthTokens

  return {
    email,
    password,
    userId: decodeUserId(tokens.accessToken),
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  }
}

/** Puts the given user's tokens into the browser's localStorage and loads the app. */
export async function signInAs(page: Page, user: TestUser) {
  await page.goto('/login')
  await page.evaluate(
    ({ accessToken, refreshToken }) => {
      localStorage.setItem('occasion.accessToken', accessToken)
      localStorage.setItem('occasion.refreshToken', refreshToken)
    },
    { accessToken: user.accessToken, refreshToken: user.refreshToken },
  )
  await page.goto('/dashboard')
}
