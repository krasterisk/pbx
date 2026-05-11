import { test as base, type Page } from '@playwright/test';

/**
 * Krasterisk auth fixture.
 *
 * Reuses a single `authenticatedPage` for the duration of the worker by
 * logging in once at session level (via the REST API) and replaying the
 * tokens into localStorage before each test navigates.
 *
 * Override the credentials with env vars:
 *   PW_USER (default "admin"), PW_PASS (default "admin")
 */

interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: Record<string, unknown>;
}

async function loginViaApi(baseURL: string, login: string, password: string): Promise<AuthSession> {
  const res = await fetch(`${baseURL.replace(/\/$/, '')}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login, password }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Login failed (${res.status}): ${body}`);
  }
  return (await res.json()) as AuthSession;
}

async function seedAuthOn(page: Page, session: AuthSession) {
  await page.addInitScript((s) => {
    localStorage.setItem('accessToken', s.accessToken);
    localStorage.setItem('refreshToken', s.refreshToken);
    localStorage.setItem('user', JSON.stringify(s.user));
  }, session);
}

export const test = base.extend<{
  authenticatedPage: Page;
  authSession: AuthSession;
}>({
  authSession: [async ({ baseURL }, use) => {
    const login = process.env.PW_USER || 'admin';
    const password = process.env.PW_PASS || 'admin';
    const session = await loginViaApi(baseURL!, login, password);
    await use(session);
  }, { scope: 'worker' }],

  authenticatedPage: async ({ page, authSession }, use) => {
    await seedAuthOn(page, authSession);
    await use(page);
  },
});

export { expect } from '@playwright/test';
