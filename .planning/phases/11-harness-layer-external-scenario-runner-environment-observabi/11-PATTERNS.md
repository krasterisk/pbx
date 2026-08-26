# Phase 11: Harness Layer - Pattern Map

**Mapped:** 2026-08-04
**Files analyzed:** 31 new/modified files
**Analogs found:** 26 / 31

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `harness/package.json` | config | — | `e2e/package.json` + root `package.json` | exact |
| `harness/tsconfig.json` | config | — | `packages/shared/tsconfig.json` | exact |
| `harness/vitest.config.ts` | config | batch | `packages/frontend/vite.config.ts` (test block) | exact |
| `harness/playwright.config.ts` | config | batch | `e2e/playwright.config.ts` | exact |
| `harness/fixtures/auth.fixture.ts` | fixture | request-response | `e2e/fixtures/auth.fixture.ts` | exact |
| `harness/scenarios/ui/agent-smoke.spec.ts` | test | request-response | `e2e/tests/operator-happy-path.spec.ts` | exact |
| `harness/scenarios/ui/supervisor-smoke.spec.ts` | test | request-response | `e2e/tests/operator-happy-path.spec.ts` | role-match |
| `harness/scenarios/api/auth.test.ts` | test | request-response | `e2e/fixtures/auth.fixture.ts` (`loginViaApi`) | exact |
| `harness/scenarios/api/moh-crud.test.ts` | test | CRUD | `packages/backend/src/modules/moh/moh.controller.ts` | role-match |
| `harness/scenarios/realtime/sse-heartbeat.test.ts` | test | streaming | `packages/backend/src/modules/callcenter/callcenter-sse.controller.ts` | role-match |
| `harness/assertions/http.ts` | utility | request-response | `e2e/fixtures/auth.fixture.ts` | exact |
| `harness/assertions/sse.ts` | utility | streaming | `callcenter-sse.controller.ts` + `useCallCenterSSE.test.ts` | role-match |
| `harness/assertions/ui.ts` | utility | request-response | `e2e/tests/operator-happy-path.spec.ts` | exact |
| `harness/assertions/sql.ts` | utility | transform | — | no analog |
| `harness/environment/readiness.ts` | utility | request-response | `.github/workflows/e2e.yml` (wait-on steps) | exact |
| `harness/environment/seed.ts` | utility | CRUD | `e2e/fixtures/auth.fixture.ts` + `moh.controller.ts` | role-match |
| `harness/environment/teardown.ts` | utility | CRUD | RESEARCH.md MOH cleanup pattern | role-match |
| `harness/environment/testcontainers/mysql.ts` | utility | batch | `.github/workflows/e2e.yml` (MySQL service) | partial |
| `harness/runner/index.ts` | route/CLI | batch | root `package.json` scripts | partial |
| `harness/runner/registry.ts` | config | batch | `packages/frontend/package.json` (`test:cc` filters) | partial |
| `harness/metrics/index.ts` | utility | transform | — | no analog |
| `harness/reporters/index.ts` | utility | transform | `e2e/playwright.config.ts` (reporter array) | role-match |
| `harness/.env.harness.example` | config | — | `.github/workflows/e2e.yml` env blocks | role-match |
| `harness/README.md` | config | — | `e2e/README.md` | exact |
| `packages/backend/src/modules/health/health.controller.ts` | controller | request-response | `service-requests-public.controller.ts` | role-match |
| `packages/backend/src/modules/health/health.module.ts` | module | — | `packages/backend/src/modules/moh/moh.module.ts` | exact |
| `packages/backend/src/app.module.ts` | module | — | `app.module.ts` (MohModule import) | exact |
| `packages/backend/src/modules/moh/moh.controller.ts` | controller | CRUD | `packages/backend/src/modules/ivrs/ivrs.controller.ts` | exact |
| `package.json` (root) | config | — | root `package.json` workspaces | exact |
| `.github/workflows/harness.yml` | config | batch | `.github/workflows/e2e.yml` | exact |
| `.github/workflows/harness-asterisk.yml` | config | batch | `.github/workflows/e2e.yml` + `workflow_dispatch` | role-match |

---

## Pattern Assignments

### `harness/package.json` (config)

**Analog:** `e2e/package.json` + root `package.json`

**Workspace member pattern** (root `package.json` lines 6-10, 29-33):

```json
"workspaces": [
  "packages/shared",
  "packages/backend",
  "packages/frontend",
  "harness"
],
"engines": {
  "node": ">=22.0.0"
}
```

**Package scripts pattern** (`e2e/package.json` lines 1-13, extended per D-17):

```json
{
  "name": "@krasterisk/harness",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "test": "vitest run && playwright test",
    "test:api": "vitest run scenarios/api scenarios/realtime",
    "test:ui": "playwright test",
    "test:asterisk": "vitest run --grep asterisk",
    "test:ui:headed": "playwright test --headed",
    "report": "playwright show-report"
  }
}
```

**Root delegation scripts** (replace `test:e2e` in root `package.json` lines 23-24):

```json
"harness": "npm run test -w @krasterisk/harness",
"harness:ui": "npm run test:ui -w @krasterisk/harness",
"harness:api": "npm run test:api -w @krasterisk/harness",
"harness:asterisk": "npm run test:asterisk -w @krasterisk/harness"
```

**Critical:** No `@krasterisk/shared` dependency (D-H22). Install harness deps via `npm install -w @krasterisk/harness`.

---

### `harness/tsconfig.json` (config)

**Analog:** `packages/shared/tsconfig.json`

**Core pattern** (lines 1-13):

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": ".",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "types": ["node"],
    "noEmit": true
  },
  "include": ["**/*.ts"],
  "exclude": ["node_modules", "dist", "reports", "playwright-report"]
}
```

Use `tsconfig.base.json` (strict, ES2022) — do **not** add `@krasterisk/shared` path aliases.

---

### `harness/vitest.config.ts` (config, batch)

**Analog:** `packages/frontend/vite.config.ts` (test block, lines 47-52)

**Imports pattern** (frontend lines 1-2):

```typescript
/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
```

**Core Vitest config** (adapt frontend test block + add reporters for D-11):

```typescript
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['scenarios/api/**/*.test.ts', 'scenarios/realtime/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 30_000,
    reporters: ['default', 'junit'],
    outputFile: { junit: 'reports/junit-api.xml' },
    sequence: { concurrent: false }, // D-19: sequential default
  },
});
```

**Script pattern** from `packages/frontend/package.json` (lines 16-18):

```json
"test": "vitest run",
"test:watch": "vitest"
```

Harness MVP: **no watch mode** (D-20) — only `vitest run`.

---

### `harness/playwright.config.ts` (config, batch)

**Analog:** `e2e/playwright.config.ts`

**Imports + defineConfig** (lines 1-14):

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './scenarios/ui',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
```

**Reporter + artifact pattern** (lines 20-31):

```typescript
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['junit', { outputFile: 'reports/junit-ui.xml' }],
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3010',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
```

Change only `testDir` from `./tests` → `./scenarios/ui`. Preserve CI `workers: 1` (D-12).

---

### `harness/fixtures/auth.fixture.ts` (fixture, request-response)

**Analog:** `e2e/fixtures/auth.fixture.ts`

**Login via public API** (lines 20-31):

```typescript
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
```

**Worker-scoped fixture + localStorage seed** (lines 41-58):

```typescript
export const test = base.extend<{ authenticatedPage: Page; authSession: AuthSession }>({
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
```

Port verbatim; update route references from `/operator` → `/callcenter/agent` in consuming specs only.

---

### `harness/scenarios/ui/agent-smoke.spec.ts` (test, request-response)

**Analog:** `e2e/tests/operator-happy-path.spec.ts`

**Imports + fixture usage** (lines 1-16):

```typescript
import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Agent panel — happy path', () => {
  test('renders the agent workspace with status bar and queue monitor', async ({ authenticatedPage: page }) => {
    await page.goto('/callcenter/agent'); // D-03: not /operator
```

**i18n-tolerant locator pattern** (lines 18-29):

```typescript
    const status = page.getByText(/Offline|Ready|In Call|Paused|Wrap-up|Готов|В вызове|Пауза/i).first();
    await expect(status).toBeVisible();

    const missed = page.getByRole('button', { name: /Missed|Пропущенные/i });
    await expect(missed.or(page.locator('button[title*="Missed"], button[title*="Пропущ"]'))).toBeVisible();

    await expect(page.getByText(/waiting|ожидают/i).first()).toBeVisible();
    await expect(page.getByText(/talking|разговор/i).first()).toBeVisible();
    await expect(page.getByText(/free|свободны/i).first()).toBeVisible();
```

**Asterisk skip gate** (`e2e/README.md` line 39):

```typescript
test.skip(process.env.HAS_ASTERISK !== '1', 'Requires Asterisk lab');
```

---

### `harness/scenarios/ui/supervisor-smoke.spec.ts` (test, request-response)

**Analog:** `e2e/tests/operator-happy-path.spec.ts`

Same fixture + i18n regex patterns; navigate to `/callcenter/supervisor`. Prefer `getByRole('heading')` + queue KPI regexes (RESEARCH open question #3). Copy structure from agent-smoke; swap route and supervisor-specific locators.

---

### `harness/scenarios/api/auth.test.ts` (test, request-response)

**Analog:** `e2e/fixtures/auth.fixture.ts` + `packages/backend/src/modules/auth/auth.controller.ts`

**Vitest structure** (`displayLabels.test.ts` lines 1-2, 19-25):

```typescript
import { describe, it, expect } from 'vitest';

describe('auth API', () => {
  it('login returns accessToken, refreshToken, user', async () => {
```

**API URL:** use `process.env.HARNESS_API_URL || 'http://localhost:5010'` — **not** Playwright baseURL (Vite proxy pitfall, RESEARCH Pitfall 5).

**Verified login contract** (`auth.controller.ts` lines 19-32):

```typescript
// POST /api/auth/login
// Body: { login, password }
// Response: { accessToken, refreshToken, user }
```

Reuse `loginViaApi` logic from auth fixture; assert `user.vpbx_user_uid` is present.

---

### `harness/scenarios/api/moh-crud.test.ts` (test, CRUD)

**Analog:** `packages/backend/src/modules/moh/moh.controller.ts`

**CRUD routes** (controller lines 7-55):

```typescript
@Controller('moh')
export class MohController {
  @Get()    async findAll(@Req() req: any) { ... }
  @Get(':name')  async findOne(@Param('name') name: string, @Req() req: any) { ... }
  @Post()   async create(@Body() body: { displayName; sort?; entries? }, @Req() req: any) { ... }
  @Put(':name')  async update(@Param('name') name: string, @Body() body, @Req() req: any) { ... }
  @Delete(':name') async remove(@Param('name') name: string, @Req() req: any) { ... }
}
```

**Auth header pattern** (peer `ivrs.controller.ts` lines 24-26):

```typescript
@UseGuards(JwtAuthGuard)  // MOH lacks this — harness MUST still send Bearer
const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
```

**Create payload** (RESEARCH Pattern 2):

```typescript
body: JSON.stringify({
  displayName: `Harness ${Date.now()}`,
  sort: 'alpha',
  entries: [{ filename: 'silence/1', position: 1 }],
})
```

**Cleanup in finally** (D-16):

```typescript
afterAll(async () => {
  if (createdName) await fetch(`${apiUrl}/api/moh/${createdName}`, { method: 'DELETE', headers });
});
```

---

### `harness/scenarios/realtime/sse-heartbeat.test.ts` (test, streaming)

**Analog:** `packages/backend/src/modules/callcenter/callcenter-sse.controller.ts`

**SSE contract** (controller lines 22-23, 36-37, 48-49):

```typescript
const SSE_HEARTBEAT_MS = 15_000;

/** SSE endpoint: GET /api/callcenter/events?token=<JWT> */
@Sse('events')
events(@Req() req: Request & { user: any }): Observable<MessageEvent> {
```

**Node harness client** (RESEARCH Code Examples — use `eventsource` package):

```typescript
import EventSource from 'eventsource';

const es = new EventSource(
  `${apiUrl}/api/callcenter/events?token=${encodeURIComponent(accessToken)}`,
);
// Assert fullSnapshot or heartbeat within 25s; reject on onerror
```

**Asterisk skip for non-lab scenarios:** this scenario does NOT require Asterisk (D-04).

---

### `harness/assertions/http.ts` (utility, request-response)

**Analog:** `e2e/fixtures/auth.fixture.ts`

Extract reusable helpers from fixture login pattern:

```typescript
export async function apiFetch(
  path: string,
  opts: { method?: string; token?: string; body?: unknown } = {},
): Promise<Response> {
  const apiUrl = process.env.HARNESS_API_URL || 'http://localhost:5010';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  return fetch(`${apiUrl}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
}
```

Error handling: throw with status + body text (fixture lines 26-28).

---

### `harness/assertions/sse.ts` (utility, streaming)

**Analog:** `callcenter-sse.controller.ts` + `useCallCenterSSE.test.ts` (event names)

**Event type constants** from controller comments (lines 44-46):

```typescript
// es.addEventListener('agentUpdate', ...)
// es.addEventListener('fullSnapshot', ...)
```

**Timeout pattern** from controller `SSE_HEARTBEAT_MS = 15_000` — use 25s assertion window.

Frontend mock shows event-driven assert style (`useCallCenterSSE.test.ts` lines 26-38) — harness uses real `eventsource`, not mocks.

---

### `harness/assertions/ui.ts` (utility, request-response)

**Analog:** `e2e/tests/operator-happy-path.spec.ts`

Centralize i18n regex helpers:

```typescript
export const STATUS_REGEX = /Offline|Ready|In Call|Paused|Wrap-up|Готов|В вызове|Пауза/i;
export const MISSED_BTN = /Missed|Пропущенные/i;
export const KPI_WAITING = /waiting|ожидают/i;
```

Prefer `getByRole` + `.or()` fallback locators (spec lines 23-24).

---

### `harness/environment/readiness.ts` (utility, request-response)

**Analog:** `.github/workflows/e2e.yml` (lines 43-59)

**Health wait pattern** (lines 52-54):

```yaml
npm run dev:backend &
npx wait-on -t 60000 http://localhost:5010/api/health
```

**Frontend wait** (lines 57-59):

```yaml
npm run dev:frontend &
npx wait-on -t 60000 http://localhost:3010
```

Translate to TypeScript using `wait-on` programmatic API or shell spawn. Add AMI TCP + ARI `/asterisk/info` gates per RESEARCH Pattern 6 for Asterisk profile.

---

### `harness/environment/seed.ts` / `teardown.ts` (utility, CRUD)

**Analog:** auth fixture login + MOH controller delete

**Seed flow** (D-15): login via public API → POST resources (MOH create) — never SQL/ORM.

**Teardown flow** (D-16):

```typescript
// DELETE /api/moh/{name} in finally/afterAll
await fetch(`${apiUrl}/api/moh/${name}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
```

---

### `harness/environment/testcontainers/mysql.ts` (utility, batch)

**Analog:** `.github/workflows/e2e.yml` MySQL service (lines 16-27) — **partial**

**Interim GHA service env** (lines 17-22):

```yaml
mysql:
  image: mysql:8.0
  env:
    MYSQL_ROOT_PASSWORD: krasterisk
    MYSQL_DATABASE: krasterisk
  ports: ['3306:3306']
```

Testcontainers replaces this in PR-2; map same env vars to dynamic port host. No Testcontainers code exists in repo — follow RESEARCH Standard Stack, not an existing file.

---

### `harness/runner/index.ts` + `registry.ts` (CLI, batch)

**Analog:** root `package.json` scripts (partial)

**Script delegation pattern** (root lines 12-18):

```json
"dev:backend": "npm run build -w @krasterisk/shared && npm run start:dev -w @krasterisk/backend",
"test:backend": "npm run test -w @krasterisk/backend",
```

Runner orchestrates: filter by `--scenario` / `--tag` (D-18), call `vitest run` or `playwright test` with grep/project filters. **Filtered test pattern** from frontend (line 19):

```json
"test:cc": "vitest run src/features/callcenter"
```

No existing CLI runner in repo — keep runner thin; defer complex registry to RESEARCH discretion.

---

### `harness/reporters/index.ts` (utility, transform)

**Analog:** `e2e/playwright.config.ts` reporter array (lines 20-23)

**Multi-reporter pattern:**

```typescript
reporter: [
  ['list'],
  ['html', { outputFolder: 'playwright-report', open: 'never' }],
],
```

Extend with Vitest `junit` + custom markdown/JSON aggregators writing to `reports/` (gitignored). CI uploads triad per D-11 (evolve `e2e.yml` artifact step lines 75-81).

---

### `harness/.env.harness.example` (config)

**Analog:** `.github/workflows/e2e.yml` env blocks (lines 44-51, 69-73)

```bash
HARNESS_API_URL=http://localhost:5010
PLAYWRIGHT_BASE_URL=http://localhost:3010
PW_USER=admin
PW_PASS=admin
HAS_ASTERISK=0
# AMI_HOST, AMI_PORT, ARI_* — see RESEARCH Pattern 6
```

---

### `harness/README.md` (config)

**Analog:** `e2e/README.md`

Copy structure: Quick start, Layout tree, Conventions (authenticatedPage fixture, i18n regexes, HAS_ASTERISK gate). Update paths from `e2e/` → `harness/scenarios/ui`.

---

### `packages/backend/src/modules/health/health.controller.ts` (controller, request-response)

**Analog:** `service-requests-public.controller.ts` (public, no JWT) + `dialplan-notify.controller.ts` (simple response)

**Public controller — no guards** (`service-requests-public.controller.ts` lines 8-16):

```typescript
/**
 * Public (no-auth) ... without @UseGuards(JwtAuthGuard)
 */
@Controller('public/service-requests')
export class ServiceRequestsPublicController {
```

**Minimal GET response** (`dialplan-notify.controller.ts` lines 32-33, 49):

```typescript
@HttpCode(200)
async notify(...) {
  return { accepted: true };
}
```

**Target health controller** (RESEARCH Pattern 5):

```typescript
import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  getHealth() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
```

Global prefix `api` in `main.ts` line 143 → exposed as `GET /api/health`. No JWT, no Swagger required for MVP.

---

### `packages/backend/src/modules/health/health.module.ts` (module)

**Analog:** `packages/backend/src/modules/moh/moh.module.ts`

**Minimal module** (lines 1-18):

```typescript
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
})
export class HealthModule {}
```

No Sequelize, no providers — health is stateless.

---

### `packages/backend/src/app.module.ts` (modify)

**Analog:** existing `MohModule` registration (lines 193, 180)

**Import + register** (add alongside feature modules):

```typescript
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    // ...
    HealthModule,
    MohModule,
```

Place near top of feature imports; no global guard changes.

---

### `packages/backend/src/modules/moh/moh.controller.ts` (modify, optional)

**Analog:** `packages/backend/src/modules/ivrs/ivrs.controller.ts`

**JWT guard at class level** (ivrs lines 16, 24-26):

```typescript
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('ivrs')
@UseGuards(JwtAuthGuard)
export class IvrsController {
```

Apply same to `MohController` — recommended minimal fix per RESEARCH Wave 0 gaps.

---

### `package.json` (root, modify)

**Analog:** root `package.json`

**Workspace add** (lines 6-10):

```json
"workspaces": [
  "packages/shared",
  "packages/backend",
  "packages/frontend",
  "harness"
]
```

**Remove** `test:e2e` / `test:e2e:install` (lines 23-24); **add** `harness*` scripts (D-17). Keep `engines.node >= 22` (line 31-33).

---

### `.github/workflows/harness.yml` (config, batch)

**Analog:** `.github/workflows/e2e.yml`

**Trigger block** (lines 3-8) — keep identical for D-09:

```yaml
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]
  workflow_dispatch:
```

**Node 22 fix** (change line 34 from `'20'` → `'22'`, D-H24):

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: '22'
    cache: 'npm'
```

**Test cwd migration** (lines 61-73):

```yaml
- name: Install Playwright browsers
  working-directory: harness
  run: |
    npx playwright install --with-deps chromium

- name: Run harness
  working-directory: harness
  env:
    PLAYWRIGHT_BASE_URL: http://localhost:3010
    HARNESS_API_URL: http://localhost:5010
    PW_USER: admin
    PW_PASS: admin
  run: npm test
```

**Artifacts** (extend lines 75-81 for D-11):

```yaml
- uses: actions/upload-artifact@v4
  if: always()
  with:
    name: harness-reports
    path: |
      harness/playwright-report
      harness/reports
    retention-days: 14
```

MySQL service block (lines 16-27) stays for PR-1/2 interim until Testcontainers lands.

---

### `.github/workflows/harness-asterisk.yml` (config, batch)

**Analog:** `.github/workflows/e2e.yml` + `workflow_dispatch` only (D-10)

Copy harness.yml job; change trigger to:

```yaml
on:
  workflow_dispatch:
  schedule:
    - cron: '0 3 * * *'  # optional nightly
```

Set `HAS_ASTERISK: '1'` and lab secrets. Run `npm run harness:asterisk` only.

---

## Shared Patterns

### Authentication (black-box)

**Source:** `e2e/fixtures/auth.fixture.ts` (lines 20-31) + `auth.controller.ts` (lines 19-32)  
**Apply to:** All API scenarios, seed/teardown, SSE tests (token for query param)

```typescript
const res = await fetch(`${apiUrl}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ login: process.env.PW_USER ?? 'admin', password: process.env.PW_PASS ?? 'admin' }),
});
const { accessToken, refreshToken, user } = await res.json();
// API calls: Authorization: `Bearer ${accessToken}`
// SSE: ?token=${encodeURIComponent(accessToken)}
// UI: localStorage seed via page.addInitScript
```

### Error Handling

**Source:** `e2e/fixtures/auth.fixture.ts` (lines 26-28)  
**Apply to:** All harness HTTP helpers

```typescript
if (!res.ok) {
  const body = await res.text().catch(() => '');
  throw new Error(`Request failed (${res.status}): ${body}`);
}
```

### Asterisk Skip Gate

**Source:** `e2e/README.md` (line 39)  
**Apply to:** All scenarios with `requires: ['asterisk']`

```typescript
const requiresAsterisk = meta.requires?.includes('asterisk');
if (requiresAsterisk && process.env.HAS_ASTERISK !== '1') {
  test.skip();
}
```

### CI Environment Variables

**Source:** `.github/workflows/e2e.yml` (lines 44-51, 69-73)  
**Apply to:** harness.yml, `.env.harness.example`, Environment layer

```yaml
DB_HOST: 127.0.0.1
DB_PORT: 3306
DB_USER: root
DB_PASS: krasterisk
DB_NAME: krasterisk
JWT_SECRET: ci-test-secret
CC_AI_KEY_SECRET: ci-test-ai-secret
PLAYWRIGHT_BASE_URL: http://localhost:3010
PW_USER: admin
PW_PASS: admin
```

### Global API Prefix

**Source:** `packages/backend/src/main.ts` (line 143)  
**Apply to:** All harness HTTP paths

```typescript
app.setGlobalPrefix('api');
// Harness paths: /api/auth/login, /api/moh, /api/health, /api/callcenter/events
```

### JWT on CRUD Controllers

**Source:** `packages/backend/src/modules/ivrs/ivrs.controller.ts` (lines 24-26)  
**Apply to:** MOH controller fix; harness always sends Bearer regardless

```typescript
@Controller('ivrs')
@UseGuards(JwtAuthGuard)
export class IvrsController {
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `harness/environment/testcontainers/mysql.ts` | utility | batch | No Testcontainers usage in repo; use RESEARCH Standard Stack + GHA MySQL as interim reference |
| `harness/metrics/index.ts` | utility | transform | No harness-side metrics collection exists |
| `harness/assertions/sql.ts` | utility | transform | No SQL assertion helpers; opt-in D-H02 only |
| `harness/runner/index.ts` | CLI | batch | No scenario runner CLI in monorepo; thin script orchestration is greenfield |
| `harness/observability/*` (PR-6) | utility | pub-sub | No OTel SDK in app or tests; RESEARCH stack only |

---

## Metadata

**Analog search scope:** `e2e/`, `.github/workflows/`, root + workspace `package.json`, `packages/backend/src/modules/{auth,moh,ivrs,callcenter,notifications,service-requests}`, `packages/frontend/vite.config.ts`, `packages/shared/tsconfig.json`, `tsconfig.base.json`  
**Files scanned:** ~45  
**Pattern extraction date:** 2026-08-04
