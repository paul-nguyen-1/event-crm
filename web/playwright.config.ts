import { defineConfig, devices } from '@playwright/test'

// These tests drive the real running stack end-to-end (Postgres, RabbitMQ,
// Redis, api, notification-service, web) — they don't spin any of it up
// themselves. Start everything per the README before running `npm run
// test:e2e`.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
