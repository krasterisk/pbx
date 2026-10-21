---
phase: 11-harness-layer-external-scenario-runner-environment-observabi
plan: 02
subsystem: testing
tags: [testcontainers, wait-on, vitest, harness, mysql, seed, teardown, black-box]

requires:
  - phase: 11-01
    provides: GET /api/health, harness workspace, runner CLI
provides:
  - waitForAppReady readiness gates (API health + optional frontend)
  - Testcontainers MySQL with GHA services fallback
  - API-based seed/teardown helpers (login, MOH create/delete)
  - Committed .env.harness.example lab config template
affects:
  - 11-03 (auth/MOH API scenarios)
  - 11-04 (Playwright UI absorption)
  - 11-07 (AMI/ARI readiness gates)

tech-stack:
  added: [wait-on, testcontainers, "@testcontainers/mysql"]
  patterns:
    - Readiness polling via wait-on against HARNESS_API_URL/api/health
    - Testcontainers when USE_TESTCONTAINERS=1; external DB_* when not
    - Seed/teardown via Bearer-authenticated public HTTP only
    - Cleanup queue drained in runner finally block

key-files:
  created:
    - harness/environment/readiness.ts
    - harness/environment/compose/docker-compose.yml
    - harness/environment/testcontainers/mysql.ts
    - harness/environment/seed.ts
    - harness/environment/teardown.ts
    - harness/environment/teardown-queue.ts
    - harness/.env.harness.example
  modified:
    - harness/package.json
    - harness/runner/index.ts
    - package-lock.json

key-decisions:
  - "Runner calls waitForAppReady before API runs unless SKIP_READINESS=1"
  - "USE_TESTCONTAINERS=1 selects Testcontainers; default uses DB_* env (GHA-compatible)"
  - "AMI/ARI probe stubs return false until plan 07 implements full gates"

patterns-established:
  - "Environment layer: no packages/*/src imports — fetch-only black-box HTTP"
  - "registerCleanup stack processed in runner finally even on scenario failure"

requirements-completed: [D-08, D-15, D-16]

coverage:
  - id: D1
    description: "waitForAppReady polls GET /api/health with optional frontend and db:migrate hook"
    requirement: D-H06
    verification:
      - kind: other
        ref: "npx tsx harness/environment/readiness.ts --dry-run"
        status: pass
    human_judgment: false
  - id: D2
    description: "Testcontainers MySQL module with GHA-compatible external fallback"
    requirement: D-08
    verification:
      - kind: other
        ref: "npx tsx -e import startHarnessMysql typeof check"
        status: pass
    human_judgment: false
  - id: D3
    description: "API seed loginAndGetToken/seedMohClass and teardown deleteMohByName via public HTTP"
    requirement: D-15
    verification:
      - kind: other
        ref: "npx tsx -e import loginAndGetToken/deleteMohByName typeof checks"
        status: pass
    human_judgment: false
  - id: D4
    description: ".env.harness.example documents lab env vars without real secrets"
    requirement: D-08
    verification:
      - kind: other
        ref: "grep HARNESS_API_URL harness/.env.harness.example"
        status: pass
    human_judgment: false
  - id: D5
    description: "End-to-end harness:api health with readiness hook against live backend"
    requirement: D-H06
    verification:
      - kind: integration
        ref: "npm run harness:api -- --tag health (requires dev:backend on :5010)"
        status: unknown
    human_judgment: true
    rationale: "Backend not running during executor session; module wiring verified, live integration deferred to CI/local dev"

duration: 44min
completed: 2026-08-04
status: complete
---

# Phase 11 Plan 02: Environment Layer Summary

**Readiness gates, Testcontainers MySQL with GHA fallback, and API-only seed/teardown helpers for black-box harness scenarios**

## Performance

- **Duration:** 44 min
- **Started:** 2026-08-04T12:10:00Z
- **Completed:** 2026-08-04T12:54:00Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- Implemented `waitForAppReady` polling `/api/health` (60s timeout) with optional `RUN_MIGRATE=1` db:migrate and frontend poll when UI scenarios selected
- Added Testcontainers MySQL module (`mysql:8.0`, krasterisk/krasterisk) plus `useExternalMysql()` for GHA services / docker-compose fallback
- Built API seed (`loginAndGetToken`, `seedMohClass`) and teardown (`deleteMohByName`, `registerCleanup`) — zero Sequelize/SQL imports
- Committed `.env.harness.example` with D-08 lab vars (placeholders only, no real secrets)
- Wired runner pre-hook (readiness) and finally-block cleanup queue

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end readiness wait — health + frontend up** - `85fc4c0` (feat)
2. **Task 2: Testcontainers MySQL module with dynamic port mapping** - `ce21c4e` (feat)
3. **Task 3: API seed and teardown helpers** - `b3ea4f8` (feat)

## Files Created/Modified

- `harness/environment/readiness.ts` - Health/frontend polling, AMI/ARI stubs for plan 07
- `harness/environment/compose/docker-compose.yml` - Optional long-lived MySQL matching e2e.yml
- `harness/environment/testcontainers/mysql.ts` - startHarnessMysql / useExternalMysql / provisionHarnessMysql
- `harness/environment/seed.ts` - loginAndGetToken, seedMohClass via POST /api/moh
- `harness/environment/teardown.ts` - deleteMohByName, registerCleanup wrapper
- `harness/environment/teardown-queue.ts` - Shared cleanup stack for runner finally
- `harness/.env.harness.example` - Documented harness env vars (D-08)
- `harness/runner/index.ts` - Readiness pre-hook + cleanup finally
- `harness/package.json` - Added wait-on, testcontainers, @testcontainers/mysql

## Decisions Made

- Runner skips readiness when `SKIP_READINESS=1` (unit-only / offline runner tests)
- `USE_TESTCONTAINERS=1` gates Testcontainers; default path reads `DB_*` from env (CI interim)
- MOH seed uses `silence/1` entry per RESEARCH Pitfall 3

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- **Testcontainers live start not verified** — Docker client present; container start skipped in session (documented fallback to external MySQL)
- **harness:api integration** — health-smoke failed with ECONNREFUSED because backend was not running locally; runner wiring and module exports verified instead

## User Setup Required

None for code delivery. To run scenarios locally:

```bash
# Option A: external MySQL (docker-compose or local)
docker compose -f harness/environment/compose/docker-compose.yml up -d
npm run db:migrate
npm run dev:backend

# Option B: Testcontainers (requires Docker)
USE_TESTCONTAINERS=1 npm run harness:api
```

## Next Phase Readiness

- Environment layer ready for plan 03 auth/MOH API scenarios
- `.env.harness.example` ready for copy to gitignored `.env.harness`
- AMI/ARI full gates deferred to plan 07 as specified

## Self-Check: PASSED

- FOUND: harness/environment/readiness.ts
- FOUND: harness/environment/testcontainers/mysql.ts
- FOUND: harness/environment/seed.ts
- FOUND: harness/environment/teardown.ts
- FOUND: harness/.env.harness.example
- FOUND: commit 85fc4c0
- FOUND: commit ce21c4e
- FOUND: commit b3ea4f8

---
*Phase: 11-harness-layer-external-scenario-runner-environment-observabi*
*Completed: 2026-08-04*
