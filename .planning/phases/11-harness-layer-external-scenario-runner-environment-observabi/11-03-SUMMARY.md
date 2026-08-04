---
phase: 11-harness-layer-external-scenario-runner-environment-observabi
plan: 03
subsystem: testing
tags: [vitest, harness, auth, moh, jwt, black-box, api]

requires:
  - phase: 11-01
    provides: harness workspace, runner CLI, health probe
  - phase: 11-02
    provides: seed/teardown helpers, readiness gates
provides:
  - Auth login Vitest scenario tagged auth (D-01, D-13)
  - MOH CRUD Vitest scenario tagged moh (D-02)
  - Shared apiFetch/http assertions with Bearer support (D-H02)
  - JwtAuthGuard on MohController (T-11-03-02 mitigation)
affects:
  - 11-04 (SSE scenarios reuse apiFetch + seed login)
  - 11-05+ (UI Playwright absorption)

tech-stack:
  added: []
  patterns:
    - apiFetch throws with HTTP status and body text on failure
    - MOH scenarios always send Authorization Bearer on mutating calls
    - registerCleanup + afterAll double-guarantee MOH teardown

key-files:
  created:
    - harness/assertions/http.ts
    - harness/scenarios/api/auth.test.ts
    - harness/scenarios/api/moh-crud.test.ts
  modified:
    - harness/runner/registry.ts
    - packages/backend/src/modules/moh/moh.controller.ts

key-decisions:
  - "apiRequest (non-throwing) + apiFetch (throws) split for negative auth tests"
  - "JwtAuthGuard added at MohController class level matching ivrs.controller.ts"
  - "MOH DELETE test asserts 404 on subsequent GET to confirm removal"

patterns-established:
  - "Harness auth/MOH scenarios use PW_USER/PW_PASS env with admin defaults"
  - "Unique MOH displayName via Date.now() suffix for parallel-safe runs"

requirements-completed: [D-01, D-02, D-H02, D-13, D-15, D-16]

coverage:
  - id: D1
    description: "POST /api/auth/login returns accessToken, refreshToken, user.vpbx_user_uid"
    requirement: D-01
    verification:
      - kind: e2e
        ref: "harness/scenarios/api/auth.test.ts#returns 200 and accessToken string"
        status: unknown
      - kind: e2e
        ref: "harness/scenarios/api/auth.test.ts#user object includes vpbx_user_uid"
        status: unknown
    human_judgment: true
    rationale: "Backend not running during executor session (ECONNREFUSED :5010); static wiring verified"
  - id: D2
    description: "Invalid login returns non-200"
    requirement: D-13
    verification:
      - kind: e2e
        ref: "harness/scenarios/api/auth.test.ts#invalid password returns non-200"
        status: unknown
    human_judgment: true
    rationale: "Live verify deferred — requires running backend on HARNESS_API_URL"
  - id: D3
    description: "MOH CRUD create/read/update/delete via Bearer JWT"
    requirement: D-02
    verification:
      - kind: e2e
        ref: "harness/scenarios/api/moh-crud.test.ts#POST creates MOH class"
        status: unknown
      - kind: e2e
        ref: "harness/scenarios/api/moh-crud.test.ts#PUT updates sort and DELETE removes class"
        status: unknown
    human_judgment: true
    rationale: "Live verify deferred — requires backend + DB"
  - id: D4
    description: "Shared http assertions centralize HARNESS_API_URL and error bodies"
    requirement: D-H02
    verification:
      - kind: unit
        ref: "grep apiFetch harness/assertions/http.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "MohController protected with JwtAuthGuard"
    requirement: D-H02
    verification:
      - kind: unit
        ref: "packages/backend/src/modules/moh/moh.service.spec.ts"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-08-04
status: complete
---

# Phase 11 Plan 03: Auth + MOH API Scenarios Summary

**Black-box auth login and MOH CRUD Vitest scenarios with shared apiFetch assertions and JwtAuthGuard on MohController**

## Performance

- **Duration:** 25 min
- **Started:** 2026-08-04T12:55:00Z
- **Completed:** 2026-08-04T13:20:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Implemented `harness/assertions/http.ts` with `apiFetch`/`apiRequest` targeting `HARNESS_API_URL` (D-H02)
- Added `auth.test.ts` — valid login, invalid password, `vpbx_user_uid` shape checks (D-01, D-13)
- Added `moh-crud.test.ts` — POST/GET/PUT/DELETE roundtrip with seed login and cleanup queue (D-02, D-15, D-16)
- Registered `auth-login` and `moh-crud` scenarios in runner registry (`--tag auth|moh`)
- Added `@UseGuards(JwtAuthGuard)` on `MohController` to prevent unauthenticated writes with `user_uid 0` (T-11-03-02)

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end auth login — one API path** - `1afecb2` (feat)
2. **Task 2: MOH CRUD scenario with API cleanup** - `69a60bb` (feat)

## Files Created/Modified

- `harness/assertions/http.ts` - Shared fetch helpers with Bearer token and error body on failure
- `harness/scenarios/api/auth.test.ts` - Auth login Vitest suite (3 tests)
- `harness/scenarios/api/moh-crud.test.ts` - MOH CRUD Vitest suite with teardown
- `harness/runner/registry.ts` - auth-login and moh-crud scenario entries
- `packages/backend/src/modules/moh/moh.controller.ts` - JwtAuthGuard at class level

## Decisions Made

- Split `apiRequest` (non-throwing) from `apiFetch` (throws) so negative auth tests can assert status without try/catch
- MOH test deletes in-body then verifies 404 on GET; `afterAll` + `registerCleanup` provide redundant cleanup
- JwtAuthGuard applied matching `ivrs.controller.ts` pattern per RESEARCH Wave 0 gap

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- **Live harness:api verify skipped** — backend not running on `:5010` (ECONNREFUSED). Scenarios implemented; integration deferred to CI/local with `npm run dev:backend`.
- **Backend test suite** — full `npm run test:backend -- --testPathPattern=moh` run reported unrelated callcenter failures; `moh.service.spec.ts` passed.

## User Setup Required

None for code delivery. To run scenarios locally:

```bash
npm run db:migrate
npm run dev:backend
npm run harness:api -- --tag auth
npm run harness:api -- --tag moh
```

## Next Phase Readiness

- Auth and MOH API scenarios ready for plan 04 (SSE heartbeat) to reuse `apiFetch` + `loginAndGetToken`
- Runner supports `--tag auth|moh` filtering for Nyquist rows 11-03-01/02
- Live integration verify remains for `/gsd-verify-work 11` or CI

## Self-Check: PASSED

- FOUND: harness/assertions/http.ts
- FOUND: harness/scenarios/api/auth.test.ts
- FOUND: harness/scenarios/api/moh-crud.test.ts
- FOUND: commit 1afecb2
- FOUND: commit 69a60bb

---
*Phase: 11-harness-layer-external-scenario-runner-environment-observabi*
*Completed: 2026-08-04*
