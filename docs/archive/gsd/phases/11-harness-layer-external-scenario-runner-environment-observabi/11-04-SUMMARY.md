---
phase: 11-harness-layer-external-scenario-runner-environment-observabi
plan: 04
subsystem: testing
tags: [playwright, vitest, harness, sse, ui-smoke, callcenter, e2e-migration]

requires:
  - phase: 11-03
    provides: apiFetch helpers, auth/MOH API scenarios, runner CLI
provides:
  - Playwright UI smoke for /callcenter/agent and /callcenter/supervisor (D-03)
  - SSE heartbeat realtime scenario via eventsource + JWT ?token= (D-04)
  - e2e content absorbed into harness/; root scripts point at harness (D-H01 partial)
affects:
  - 11-05+ (reporters, metrics, observability)
  - 11-08 (harness.yml CI cutover; e2e/ deletion)

tech-stack:
  added: ["@playwright/test", "eventsource"]
  patterns:
    - Auth fixture logs in via HARNESS_API_URL (5010) not Vite proxy
    - Worker-scoped authSession avoids baseURL test-fixture dependency
    - Runner --kind api includes realtime vitest scenarios for --tag sse

key-files:
  created:
    - harness/playwright.config.ts
    - harness/fixtures/auth.fixture.ts
    - harness/scenarios/ui/agent-smoke.spec.ts
    - harness/scenarios/ui/supervisor-smoke.spec.ts
    - harness/scenarios/realtime/sse-heartbeat.test.ts
    - harness/assertions/ui.ts
    - harness/assertions/sse.ts
  modified:
    - harness/package.json
    - harness/runner/registry.ts
    - harness/runner/index.ts
    - package.json
    - e2e/README.md

key-decisions:
  - "Auth fixture uses HARNESS_API_URL for worker-scoped login (Node fetch cannot rely on Playwright baseURL fixture scope)"
  - "filterScenarios --kind api runs both api and realtime vitest paths so harness:api --tag sse works"
  - "e2e/ retained with README migration notice; test:e2e root scripts removed per D-H01/D-23 partial"

patterns-established:
  - "UI smoke routes: /callcenter/agent and /callcenter/supervisor (not legacy /operator)"
  - "Shared i18n-tolerant UI locators in assertions/ui.ts"
  - "SSE black-box tests hit backend port 5010 directly with ?token= JWT"

requirements-completed: [D-03, D-04, D-H01, D-23]

coverage:
  - id: D1
    description: "Agent UI smoke passes on /callcenter/agent with status bar and queue KPIs"
    requirement: D-03
    verification:
      - kind: automated_ui
        ref: "npm run harness:ui -- scenarios/ui/agent-smoke.spec.ts"
        status: unknown
    human_judgment: true
    rationale: "Local DB lacks admin/admin seed; login 401 during executor session — CI e2e.yml seeds user"
  - id: D2
    description: "Supervisor UI smoke passes on /callcenter/supervisor shell"
    requirement: D-03
    verification:
      - kind: automated_ui
        ref: "npm run harness:ui -- scenarios/ui/supervisor-smoke.spec.ts"
        status: unknown
    human_judgment: true
    rationale: "Same auth dependency as D1 — requires PW_USER/PW_PASS against running stack"
  - id: D3
    description: "SSE connects with JWT query token; fullSnapshot or heartbeat within 25s"
    requirement: D-04
    verification:
      - kind: e2e
        ref: "npm run harness:api -- --tag sse"
        status: unknown
    human_judgment: true
    rationale: "Live verify blocked by local auth 401; wiring and timeout logic verified statically"
  - id: D4
    description: "Root harness:ui script delegates to harness workspace; e2e/ not deleted"
    requirement: D-H01
    verification:
      - kind: unit
        ref: "grep harness:ui package.json"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-08-04
status: complete
---

# Phase 11 Plan 04: Playwright + SSE Migration Summary

**e2e Playwright absorbed into harness with agent/supervisor UI smoke on D-03 routes and SSE heartbeat via eventsource against port 5010**

## Performance

- **Duration:** 45 min
- **Started:** 2026-08-04T13:00:00Z
- **Completed:** 2026-08-04T13:20:00Z
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments

- Migrated Playwright config, auth fixture, and operator happy-path → agent-smoke on `/callcenter/agent`
- Added supervisor-smoke on `/callcenter/supervisor` with shared `assertions/ui.ts` helpers
- Implemented SSE heartbeat vitest scenario and `waitForSseEvent` helper (D-04, no Asterisk required)
- Updated root `harness:ui` / removed `test:e2e`; kept `e2e/` for interim CI per D-H01/D-23
- Extended runner registry and index to run api + realtime (vitest) and ui (playwright) scenarios

## Task Commits

1. **Task 1: End-to-end agent UI smoke** - `d6c2e37` (feat)
2. **Task 2: Supervisor UI smoke and shared UI assertion helpers** - `c25c8c0` (feat)
3. **Task 3: SSE heartbeat scenario and root script migration** - `930e4a4` (feat)

## Files Created/Modified

- `harness/playwright.config.ts` - Playwright config with testDir `./scenarios/ui`, CI workers=1
- `harness/fixtures/auth.fixture.ts` - Worker-scoped JWT login + localStorage seed
- `harness/scenarios/ui/agent-smoke.spec.ts` - Agent workspace smoke (D-03)
- `harness/scenarios/ui/supervisor-smoke.spec.ts` - Supervisor dashboard smoke (D-03)
- `harness/scenarios/realtime/sse-heartbeat.test.ts` - SSE fullSnapshot/heartbeat assert (D-04)
- `harness/assertions/ui.ts` - i18n-tolerant STATUS/KPI locators
- `harness/assertions/sse.ts` - waitForSseEvent timeout wrapper
- `harness/runner/registry.ts` - Registered ui + sse scenarios; api kind includes realtime
- `harness/runner/index.ts` - Vitest for api/realtime; Playwright for ui
- `package.json` - harness:ui wired; test:e2e removed
- `e2e/README.md` - Migration notice pointing to harness/

## Decisions Made

- Auth fixture uses `HARNESS_API_URL` (5010) because worker-scoped fixtures cannot depend on Playwright's test-scoped `baseURL`
- `--kind api` filter includes `realtime` scenarios so `harness:api --tag sse` resolves sse-heartbeat

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Auth fixture backend URL + worker fixture scope**
- **Found during:** Task 1 (Playwright agent smoke verify)
- **Issue:** Worker fixture `authSession` cannot depend on test fixture `baseURL`; frontend proxy login from Node worker also unreliable
- **Fix:** Login via `HARNESS_API_URL` defaulting to `http://localhost:5010`
- **Files modified:** `harness/fixtures/auth.fixture.ts`
- **Committed in:** `d6c2e37`

**2. [Rule 2 - Missing Critical] Runner must execute realtime scenarios under harness:api**
- **Found during:** Task 3 (SSE tag filter verify)
- **Issue:** `--kind api` excluded `realtime` kind; `--tag sse` returned no runnable scenarios
- **Fix:** `filterScenarios` treats `--kind api` as api+realtime; runner runs vitest + playwright by kind
- **Files modified:** `harness/runner/registry.ts`, `harness/runner/index.ts`
- **Committed in:** `c25c8c0`, `930e4a4`

---

**Total deviations:** 2 auto-fixed (2 missing critical)
**Impact on plan:** Required for correct auth and SSE CLI filtering. No scope creep.

## Issues Encountered

- Local backend returned 401 for admin/admin — live UI/SSE verify deferred (same as plans 11-01–03); CI e2e.yml provides seeded credentials
- Playwright browser download required extended timeout on first install

## User Setup Required

None — uses existing `PW_USER`/`PW_PASS` and dev stack on :3010/:5010.

## Next Phase Readiness

- D-03/D-04 vertical slice code complete; green bar pending CI/local stack with valid credentials
- Plan 11-08 can cut over e2e.yml → harness.yml and delete e2e/

## Self-Check: PASSED

- FOUND: harness/playwright.config.ts
- FOUND: harness/fixtures/auth.fixture.ts
- FOUND: harness/scenarios/ui/agent-smoke.spec.ts
- FOUND: harness/scenarios/ui/supervisor-smoke.spec.ts
- FOUND: harness/scenarios/realtime/sse-heartbeat.test.ts
- FOUND: harness/assertions/ui.ts
- FOUND: harness/assertions/sse.ts
- FOUND: d6c2e37
- FOUND: c25c8c0
- FOUND: 930e4a4

---
*Phase: 11-harness-layer-external-scenario-runner-environment-observabi*
*Completed: 2026-08-04*
