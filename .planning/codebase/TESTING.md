# Testing Patterns

**Analysis Date:** 2026-08-28

## Test Framework

**Runner:**
- Backend: Jest 29.7 + `ts-jest` — config inline in `packages/backend/package.json` (`rootDir: src`, `testRegex: .*\.spec\.ts$`, `testEnvironment: node`)
- Frontend: Vitest 4.x — `test` block in `packages/frontend/vite.config.ts` (`globals: true`, `environment: jsdom`, `setupFiles: ./src/shared/config/tests/setupTests.ts`)
- Shared: two `*.spec.ts` files under `packages/shared/src/utils/` — **not** wired to any workspace test script
- Harness API/realtime: Vitest 3.x — `harness/vitest.config.ts` (`globals: false`, `include: scenarios/**/*.test.ts`)
- Harness UI + legacy e2e: Playwright 1.50 — `harness/playwright.config.ts`, `e2e/playwright.config.ts`

**Assertion Library:**
- Jest / Vitest built-in `expect`
- Frontend DOM: `@testing-library/jest-dom` (imported in `packages/frontend/src/shared/config/tests/setupTests.ts` and again in some tests)
- Matchers in use: `toBe`, `toEqual`, `toHaveBeenCalledWith`, `toThrow`, `rejects.toBeInstanceOf`, `toBeInTheDocument`, `toHaveAttribute`

**Run Commands:**
```bash
npm run lint                 # eslint backend + frontend
npm run test                 # backend Jest then frontend Vitest
npm run test:backend         # jest in packages/backend
npm run test:frontend        # vitest run in packages/frontend
npm run test:cc              # callcenter slice only (both packages)
npm run test:ai              # ai-agents / ai-chat slice only
npm run test:cov             # jest --coverage + vitest run --coverage
npm run test:watch           # frontend vitest watch only
npm run harness              # harness API/realtime Vitest + Playwright UI
npm run harness:api          # tsx runner --kind api
npm run harness:ui           # playwright test (harness)
npm run harness:asterisk     # runner --tag asterisk
```

There is **no** root `test:e2e`. Legacy Playwright lives in `e2e/` (`npm test` inside that package). Phase 11 absorbed e2e into `harness/`.

Single-file examples:
```bash
npm run test:backend -- --testPathPattern=call-groups.service.spec
npm run test:frontend -- src/shared/ui/Tabs/Tabs.test.tsx
```

## Test File Organization

**Location:**
- Collocated next to source (no repo-wide `__tests__/` tree)
- Backend: `packages/backend/src/**/*.spec.ts` (~108 files)
- Frontend: `packages/frontend/src/**/*.test.ts(x)` plus a few `*.spec.ts` (~121 files)
- Harness: `harness/scenarios/{api,realtime}/*.test.ts`, `harness/scenarios/ui/*.spec.ts`
- E2E: `e2e/tests/*.spec.ts`

**Naming:**
- Backend unit/service: `call-groups.service.spec.ts`, `superadmin.guard.spec.ts`
- Frontend unit/UI: `phonebooksSlice.test.ts`, `Tabs.test.tsx`, `MohPage` peers as `*Page.test.tsx`
- Dialplan editor mixed: `editorReducer.spec.ts` and `StepRow.test.tsx`
- Harness: `moh-crud.test.ts` (API), `agent-smoke.spec.ts` (UI)

**Structure:**
```
packages/backend/src/modules/call-groups/
  call-groups.service.ts
  call-groups.service.spec.ts
packages/frontend/src/features/phonebooks/model/slice/
  phonebooksSlice.ts
  phonebooksSlice.test.ts
packages/frontend/src/shared/ui/Tabs/
  Tabs.tsx
  Tabs.test.tsx
harness/scenarios/api/moh-crud.test.ts
e2e/tests/operator-happy-path.spec.ts
```

## Test Structure

**Suite Organization:**
```typescript
// packages/backend/src/modules/auth/superadmin.guard.spec.ts
describe('SuperAdminGuard', () => {
  const guard = new SuperAdminGuard();

  it('allows user.level === 0 (SUPERADMIN)', () => {
    expect(guard.canActivate(mockContext({ level: UserLevel.SUPERADMIN }))).toBe(true);
  });

  it('rejects user.level !== 0 with ForbiddenException', () => {
    expect(() => guard.canActivate(mockContext({ level: UserLevel.ADMIN }))).toThrow(
      ForbiddenException,
    );
  });
});
```

```typescript
// packages/frontend/src/shared/ui/Tabs/Tabs.test.tsx
describe('shared/ui/Tabs', () => {
  it('renders Radix tab semantics (tablist/tab/tabpanel) and shows the default panel', () => {
    renderTabs();
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Panel One');
  });
});
```

**Patterns:**
- `describe('ClassOrModule')` → nested `describe('method')` → `it('does X')`
- `beforeEach` to rebuild mocks / construct the service (`new CallGroupsService(...)`)
- Nest `Test.createTestingModule` is rare; used for wiring checks in `packages/backend/src/modules/tenant-settings/tenant-settings.controller.spec.ts`
- Frontend UI tests wrap `Provider` + `configureStore` with the feature reducer
- `it` titles are behavior sentences (`should handle openCreateModal` or plain `commits a transaction...`)

## Mocking

**Framework:**
- Backend: Jest `jest.fn()` / `jest.mock()` — construct the class with fake models
- Frontend: Vitest `vi.mock()` / `vi.fn()` / `vi.mocked()`

**Patterns:**
```typescript
// packages/backend/src/modules/call-groups/call-groups.service.spec.ts
beforeEach(() => {
  groupModel = { findAll: jest.fn(), findOne: jest.fn(), create: jest.fn() };
  dialplanApplyService = {
    applyCategories: jest.fn().mockResolvedValue({ success: true, linesApplied: 3 }),
    deleteCategories: jest.fn().mockResolvedValue({ success: true }),
  };
  service = new CallGroupsService(
    groupModel, memberModel, sequelize,
    dialplanApplyService as unknown as DialplanApplyService,
    endpointsService as unknown as EndpointsService,
  );
});
```

```typescript
// packages/frontend/src/features/notifications/ui/NotificationIntegrationFormModal/NotificationIntegrationFormModal.test.tsx
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => {
      if (typeof fallback === 'string') return fallback;
      return labels[key] ?? key;
    },
  }),
}));

vi.mock('@/shared/api/endpoints/notificationApi', () => ({
  useGetNotificationQuery: vi.fn(),
  useCreateNotificationMutation: vi.fn(),
  useUpdateNotificationMutation: vi.fn(),
}));
```

```typescript
// packages/backend/src/shared/utils/dialplan.util.spec.ts
jest.mock('../../modules/logger/action-log.model', () => ({
  ActionLog: { create: jest.fn().mockResolvedValue({}) },
}));
```

**What to Mock:**
- Sequelize models (`findOne`, `create`, `transaction`)
- Neighbor services (`DialplanApplyService`, `EndpointsService`, `LoggerService`)
- RTK Query hooks and `useAppDispatch` / `useAppSelector`
- `react-i18next` (return key or fallback string)
- Capacitor / native modules (`@capacitor/push-notifications`)
- Selected UI primitives (`Switch`, `InfoTooltip`) when asserting props

**What NOT to Mock:**
- Pure utils under test (`normalizeIvrPrompts`, `editorReducer`, dialplan emit helpers)
- Shared types / enums
- Validation via real `class-validator` in DTO specs

## Fixtures and Factories

**Test Data:**
```typescript
// packages/backend/src/modules/call-groups/call-groups.service.spec.ts
const groupRow = (overrides: Record<string, unknown> = {}) => {
  const data = { uid: 7, name: 'Sales', exten: '6007', user_uid: vpbx, ...overrides };
  return { ...data, toJSON: () => ({ ...data }), update: jest.fn(), destroy: jest.fn() };
};
```

```typescript
// packages/frontend/src/features/dialplan-apps/model/editorReducer.spec.ts
function step(id: string, extras: Partial<ChainAction> = {}): ChainAction {
  return { id, type: 'hangup', params: {}, condition: {}, enabled: true, ...extras };
}
```

```typescript
// packages/frontend/src/features/phonebooks/model/slice/phonebooksSlice.test.ts
const mockPhonebook = { uid: 1, name: 'VIP-клиенты', user_uid: 100 } as any;
```

**Location:**
- Factories live in the spec file (`groupRow`, `mockContext`, `renderWithStore`)
- Shared goldens: `packages/shared/src/fixtures/dialplan-options.roundtrip.ts`
- Harness cleanup: `registerCleanup` / `deleteMohByName` in `harness/environment/`
- Tenant in tests is a literal (`const vpbx = 42`, `const TENANT = 7`) — always passed into service methods, never inferred from body

## Coverage

**Requirements:**
- No `coverageThreshold` in Jest or Vitest
- Coverage is opt-in via `npm run test:cov` (awareness, not a CI gate in-repo)
- Phase 12 notes high coverage on `dialplan.util.ts` as a characterization suite, not a global rule

**Configuration:**
- Backend Jest: `collectCoverageFrom: ["**/*.(t|j)s"]`, `coverageDirectory: ../coverage`
- Frontend: `vitest run --coverage` in `packages/frontend/package.json` — no `@vitest/coverage-*` package declared (script exists; provider may need adding)
- Shared / harness: no coverage config

**View Coverage:**
```bash
npm run test:cov
# backend HTML/JSON: packages/backend/coverage/
```

## Test Types

**Unit Tests:**
- Construct service/controller/guard with mocks; assert exceptions, SQL `where`, dialplan apply args
- Frontend: reducers/selectors (`phonebooksSlice.test.ts`) and pure editor reducers
- Shared utils: `packages/shared/src/utils/ivr-prompts.spec.ts` (run only if invoked directly)

**Integration Tests:**
- Frontend tables/modals: mock RTK hooks, render with a tiny store (`NumbersTable.test.tsx`, `TenantSettingsSection.test.tsx`)
- Occasional Nest `Test.createTestingModule` + `getModelToken` for provider resolution
- Controllers tested by calling methods with `{ user: { vpbx_user_uid } }` stubs (`voice-robots.controller.spec.ts`)

**E2E Tests:**
- Playwright Chromium, `baseURL` `http://localhost:3010`
- Harness UI: `harness/scenarios/ui/*-smoke.spec.ts`
- Legacy: `e2e/tests/operator-happy-path.spec.ts` (`test.describe` + `authenticatedPage` fixture)
- Harness API: live HTTP + JWT (`harness/scenarios/api/moh-crud.test.ts`) — black-box, not Jest

## Common Patterns

**Async Testing:**
```typescript
// packages/backend/src/modules/call-groups/call-groups.service.spec.ts
it('commits a transaction, bulk-creates members, and applies dialplan category', async () => {
  const result = await service.create({ name: 'Sales', exten: '6007', strategy: 'ringall', members: [...] } as any, vpbx);
  expect(transaction.commit).toHaveBeenCalled();
  expect(result.uid).toBe(7);
});
```

**Error Testing:**
```typescript
// packages/backend/src/modules/voice-robots/voice-robots.controller.spec.ts
it('PUT robot with invalid fallback_action returns 400 { errors }', async () => {
  await expect(
    controller.update({ user: { vpbx_user_uid: 1 } } as any, 4, { fallback_action: { ... } }),
  ).rejects.toBeInstanceOf(BadRequestException);
  expect(service.updateRobot).not.toHaveBeenCalled();
});
```

```typescript
// packages/shared/src/utils/ivr-prompts.spec.ts
it('requires engine for tts', () => {
  expect(() =>
    assertIvrPromptsForSave([{ kind: 'tts', text: 'x', engine_uid: 0 }]),
  ).toThrow(IvrPromptsValidationError);
});
```

**i18n in UI tests:**
- Mock `t` to return the fallback Russian string or the raw key (`TenantSettingsSection.test.tsx` asserts `'Показывать dialplan в маршруте'`)
- E2E locators accept both RU and EN: `/Offline|Ready|Готов|В вызове/i` in `e2e/tests/operator-happy-path.spec.ts`

**Tenant assertions:**
```typescript
// packages/backend/src/modules/tenant-settings/tenant-settings.controller.spec.ts
it('PUT writes JWT tenant and ignores vpbx_user_uid from the body', async () => {
  await controller.setMany(
    { settings: { 'routes.show_raw_dialplan': true }, vpbx_user_uid: 999 } as any,
    { user: { sub: 7, vpbx_user_uid: 42, level: UserLevel.OPERATOR } } as any,
  );
  expect(service.setMany).toHaveBeenCalledWith(42, { 'routes.show_raw_dialplan': true });
});
```

**Snapshot Testing:**
- Not used (`toMatchSnapshot` has no matches under `packages/frontend` or `packages/backend`)
- Prefer explicit `expect` / RTL role queries / `data-testid` (`moh-page-responsive`, `hybrid-table`)

---

*Testing analysis: 2026-08-28*
*Update when test patterns change*
