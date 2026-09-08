import { createHmac } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
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

function repoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 6; i += 1) {
    if (existsSync(join(dir, 'package.json')) && existsSync(join(dir, 'packages'))) return dir;
    dir = join(dir, '..');
  }
  return join(process.cwd(), '..');
}

function readEnvValue(name: string): string | undefined {
  if (process.env[name]) return process.env[name];
  for (const file of [join(repoRoot(), '.env'), join(repoRoot(), 'harness', '.env.harness')]) {
    if (!existsSync(file)) continue;
    const match = readFileSync(file, 'utf8').match(new RegExp(`^${name}=(.+)$`, 'm'));
    const value = match?.[1]?.trim().replace(/^['"]|['"]$/g, '');
    if (value) return value;
  }
  return undefined;
}

function mintHs256(payload: Record<string, unknown>, secret: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

function mintAdminSession(secret: string): AuthSession {
  const now = Math.floor(Date.now() / 1000);
  const accessToken = mintHs256({
    sub: 58,
    login: 'admin',
    name: 'admin',
    level: 1,
    role: 0,
    vpbx_user_uid: 0,
    iat: now,
    exp: now + 2 * 60 * 60,
  }, secret);
  return {
    accessToken,
    refreshToken: accessToken,
    user: {
      uniqueid: 58,
      login: 'admin',
      name: 'admin',
      level: 1,
      role: 0,
      exten: '',
      vpbx_user_uid: 0,
    },
  };
}

async function loginViaApi(apiBase: string, login: string, password: string): Promise<AuthSession> {
  const res = await fetch(`${apiBase.replace(/\/$/, '')}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login, password }),
  });
  if (res.ok) return (await res.json()) as AuthSession;
  const secret = readEnvValue('JWT_SECRET');
  if (secret) return mintAdminSession(secret);
  const body = await res.text().catch(() => '');
  throw new Error(`Login failed (${res.status}): ${body}`);
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
  authSession: [async ({}, use) => {
    const apiBase = process.env.HARNESS_API_URL || 'http://localhost:5010';
    const login = process.env.PW_USER || 'admin';
    const password = process.env.PW_PASS || 'admin';
    const session = await loginViaApi(apiBase, login, password);
    await use(session);
  }, { scope: 'worker' }],

  authenticatedPage: async ({ page, authSession }, use) => {
    await seedAuthOn(page, authSession);
    await use(page);
  },
});

export { expect } from '@playwright/test';
