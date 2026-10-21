---
phase: 11-harness-layer-external-scenario-runner-environment-observabi
plan: 01
subsystem: testing
tags: [vitest, harness, health, nestjs, black-box, runner-cli]

requires: []
provides:
  - Public GET /api/health liveness endpoint for CI wait-on
  - @krasterisk/harness npm workspace with Vitest health-smoke
  - Runner CLI with scenario registry (--scenario, --tag, sequential default)
  - Root harness* script stubs (D-17 partial)
affects:
  - 11-02 (auth/MOH API scenarios)
  - 11-03+ (UI Playwright absorption)
  - .github/workflows/e2e.yml evolution

tech-stack:
  added: [vitest, tsx, @types/node]
  patterns:
    - Black-box harness package with no @krasterisk/shared imports
    - Scenario registry with id/tags/kind/command metadata
    - Sequential runner default with --parallel opt-in

key-files:
  created:
    - packages/backend/src/modules/health/health.controller.ts
    - packages/backend/src/modules/health/health.module.ts
    - harness/package.json
    - harness/tsconfig.json
    - harness/vitest.config.ts
    - harness/scenarios/api/health-smoke.test.ts
    - harness/runner/index.ts
    - harness/runner/registry.ts
    - harness/README.md
  modified:
    - packages/backend/src/app.module.ts
    - package.json

key-decisions:
  - "HealthModule registered before AuthModule — public liveness without JwtAuthGuard"
  - "Runner uses tsx for TypeScript execution; vitest invoked via npx spawn"
  - "harness:ui and harness:asterisk echo stub until plans 02/04"

patterns-established:
  - "Harness black-box boundary: HTTP fetch only, no monorepo src imports"
  - "Scenario registry filterScenarios() for --scenario/--tag/--kind CLI filters"

requirements-completed: [D-H06, D-H04, D-H21, D-17, D-18, D-19, D-20, D-22]

coverage:
  - id: D1
    description: "GET /api/health returns 200 with status ok without JWT"
    requirement: D-H06
    verification:
      - kind: integration
        ref: "curl http://localhost:5010/api/health"
        status: pass
      - kind: e2e
        ref: "harness/scenarios/api/health-smoke.test.ts#returns 200 with status ok"
        status: pass
    human_judgment: false
  - id: D2
    description: "@krasterisk/harness workspace with zero @krasterisk/shared imports"
    requirement: D-H22
    verification:
      - kind: other
        ref: "grep @krasterisk/shared harness/package.json (count 0)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Runner CLI accepts --scenario and --tag; sequential by default"
    requirement: D-18
    verification:
      - kind: unit
        ref: "npx tsx harness/runner/index.ts --tag health --list"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-08-04
status: complete
---

# Phase 11 Plan 01: Harness Scaffold + Health Probe Summary

**Public GET /api/health liveness endpoint and @krasterisk/harness black-box workspace with Vitest health-smoke and sequential scenario runner CLI**

## Performance

- **Duration:** 15 min
- **Started:** 2026-08-04T12:00:00Z
- **Completed:** 2026-08-04T12:08:00Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- Implemented stateless `HealthModule` exposing `GET /api/health` with `{ status: 'ok', timestamp }` — no JWT required (D-H06)
- Created `@krasterisk/harness` npm workspace with Vitest health-smoke reaching running backend via `HARNESS_API_URL`
- Built runner CLI with scenario registry supporting `--scenario`, `--tag`, `--kind`; sequential default, `--parallel` opt-in (D-18/D-19)
- Wired root `harness`, `harness:api`, `harness:ui`, `harness:asterisk` script stubs (D-17 partial)

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end health probe — backend + harness smoke** - `8d65546` (feat)
2. **Task 2: Runner CLI with scenario registry and sequential default** - `86f3254` (feat)

## Files Created/Modified

- `packages/backend/src/modules/health/health.controller.ts` - Public liveness controller
- `packages/backend/src/modules/health/health.module.ts` - NestJS health module
- `packages/backend/src/app.module.ts` - Registers HealthModule
- `harness/package.json` - Workspace package with runner scripts
- `harness/tsconfig.json` - Extends root tsconfig, no shared alias
- `harness/vitest.config.ts` - Node environment, sequential file parallelism off
- `harness/scenarios/api/health-smoke.test.ts` - Vitest smoke against /api/health
- `harness/runner/index.ts` - CLI orchestrator
- `harness/runner/registry.ts` - Scenario metadata registry
- `harness/README.md` - Layout, env vars, CLI docs, black-box rule
- `package.json` - Added harness workspace + harness* scripts

## Decisions Made

- HealthModule placed before AuthModule in AppModule imports for clarity (public endpoint)
- Runner executes API scenarios via spawned `npx vitest run` with `--maxWorkers=1` unless `--parallel`
- `harness:ui` and `harness:asterisk` echo placeholder messages until later plans

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None — backend started successfully for verify; health-smoke and curl checks passed.

## User Setup Required

None - no external service configuration required. Local verify needs `npm run dev:backend` on port 5010.

## Next Phase Readiness

- Health endpoint ready for CI wait-on in evolved harness workflow
- Harness workspace and runner skeleton ready for plan 02 (auth/MOH API scenarios)
- Playwright and Testcontainers deferred to plans 02/04 as specified

## Self-Check: PASSED

- FOUND: packages/backend/src/modules/health/health.controller.ts
- FOUND: harness/runner/index.ts
- FOUND: harness/scenarios/api/health-smoke.test.ts
- FOUND: commit 8d65546
- FOUND: commit 86f3254

---
*Phase: 11-harness-layer-external-scenario-runner-environment-observabi*
*Completed: 2026-08-04*
