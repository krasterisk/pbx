import { defineConfig, devices } from '@playwright/test';

/**
 * Krasterisk v4 — Playwright config.
 *
 * Targets the local dev stack (frontend on :3010, backend on :5010).
 * Tests live in `e2e/tests/` and share fixtures from `e2e/fixtures/`.
 *
 * Run locally:
 *   npm i -D @playwright/test
 *   npx playwright install --with-deps chromium
 *   npx playwright test --config=e2e/playwright.config.ts
 */
export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3010',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
