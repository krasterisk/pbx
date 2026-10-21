import { defineConfig, devices } from '@playwright/test';
import { outputPath } from '../tools/artifacts/paths.cjs';

/**
 * Krasterisk v4 — Harness Playwright config (absorbed from e2e/).
 *
 * Targets the local dev stack (frontend on :3010, backend on :5010).
 * UI scenarios live in `harness/scenarios/ui/` and share fixtures from `harness/fixtures/`.
 */
const liveLlm = process.env.HARNESS_LIVE_LLM === '1';

export default defineConfig({
  testDir: './scenarios/ui',
  outputDir: outputPath('legacy', 'harness', 'test-results'),
  testIgnore: liveLlm ? [] : ['**/*.live.spec.ts'],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    ['html', { outputFolder: outputPath('legacy', 'harness', 'playwright-report'), open: 'never' }],
    ['junit', { outputFile: outputPath('legacy', 'harness', 'reports', 'junit-ui.xml') }],
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
