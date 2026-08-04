import { defineConfig, devices } from '@playwright/test';

/**
 * Krasterisk v4 — Harness Playwright config (absorbed from e2e/).
 *
 * Targets the local dev stack (frontend on :3010, backend on :5010).
 * UI scenarios live in `harness/scenarios/ui/` and share fixtures from `harness/fixtures/`.
 */
export default defineConfig({
  testDir: './scenarios/ui',
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
