---
phase: 14-visual-route-builder-and-automation
plan: 01
subsystem: testing
tags: [dialplan-walk, exact_only, hop-budget, reask, action-references, tdd-red]

requires:
  - phase: 12-dialplan-apps-editor-refactor-reusable-route-chain-builder
    provides: DEFAULT_HOP_LIMIT / resolveHopDecision and collectDirectoryReferences nodeMatches pattern
provides:
  - Failing walkDialplanGraph and exactRouteResolver specs locking D-45/D-46/D-47/D-43/D-38
  - Partial collectActionReferences util (toivr + toqueue) with D-48 spec including it.failing notify/directory cases
  - Shared hop constants mirrored for walker import
affects:
  - 14-02 (greens remaining collectActionReferences cases)
  - 14-04 (greens walkDialplanGraph and exactRouteResolver)

actuals:
  tokens: 5272
  tasks: 2
  commits: 2

tech-stack:
  added: [jest-on-shared-workspace]
  patterns:
    - Shared hop constants duplicated from backend (shared cannot import backend)
    - Wave 0 compile stubs + RED specs; production walk deferred to 14-04
    - it.failing for D-48 cases reserved for 14-02

key-files:
  created:
    - packages/shared/src/utils/dialplan-hops.ts
    - packages/shared/src/utils/dialplan-walk/walkDialplanGraph.ts
    - packages/shared/src/utils/dialplan-walk/walkDialplanGraph.spec.ts
    - packages/shared/src/utils/dialplan-walk/exactRouteResolver.ts
    - packages/shared/src/utils/dialplan-walk/exactRouteResolver.spec.ts
    - packages/shared/src/utils/dialplan-walk/index.ts
    - packages/shared/src/utils/dialplan-walk/types.ts
    - packages/shared/jest.config.cjs
    - packages/backend/src/modules/route-references/action-reference.util.ts
    - packages/backend/src/modules/route-references/action-reference.util.spec.ts
  modified:
    - packages/shared/src/index.ts
    - packages/shared/package.json
    - packages/shared/tsconfig.json

key-decisions:
  - "Mirrored DEFAULT_HOP_LIMIT and resolveHopDecision into packages/shared/src/utils/dialplan-hops.ts because shared cannot import backend"
  - "Added Jest to @krasterisk/shared via hoisted workspace jest/ts-jest — no new npm package"
  - "Marked notify/voicerobot and directory collectActionReferences cases it.failing until 14-02"

patterns-established:
  - "Pattern: walk options inject resolveIvr / resolveRoutesInContext callbacks — no tenant I/O in shared"
  - "Pattern: exact_only detects Asterisk patterns by leading underscore only"
  - "Pattern: ActionType-wider WalkAction so callback can be specified before 14-08 extends the union"

requirements-completed: [D-45, D-46, D-47, D-48, D-43, D-38]

coverage:
  - id: D1
    description: 20 passthrough playback steps consume zero hops (D-45)
    requirement: D-45
    verification:
      - kind: unit
        ref: packages/shared/src/utils/dialplan-walk/walkDialplanGraph.spec.ts#20 consecutive passthrough playback actions consume zero hops
        status: fail
    human_judgment: true
    rationale: Wave 0 RED scaffold — 14-04 greens the walker
  - id: D2
    description: 11th toivr hop yields Congestion at DEFAULT_HOP_LIMIT with loop breadcrumb (D-45)
    requirement: D-45
    verification:
      - kind: unit
        ref: packages/shared/src/utils/dialplan-walk/walkDialplanGraph.spec.ts#11th resolvable toivr jump yields Congestion
        status: fail
    human_judgment: true
    rationale: Wave 0 RED scaffold — 14-04 greens the walker
  - id: D3
    description: exact_only resolver covers enter, ambiguous, pattern_only, inactive, non_route_context (D-46)
    requirement: D-46
    verification:
      - kind: unit
        ref: packages/shared/src/utils/dialplan-walk/exactRouteResolver.spec.ts
        status: fail
    human_judgment: true
    rationale: Wave 0 RED scaffold — 14-04 greens the resolver
  - id: D4
    description: Missing QUEUESTATUS yields reask with one source key (D-47)
    requirement: D-47
    verification:
      - kind: unit
        ref: packages/shared/src/utils/dialplan-walk/walkDialplanGraph.spec.ts#returns reask with one source key
        status: fail
    human_judgment: true
    rationale: Wave 0 RED scaffold — 14-04 greens the walker
  - id: D5
    description: IVR host always exposes t and i inputs (D-43)
    requirement: D-43
    verification:
      - kind: unit
        ref: packages/shared/src/utils/dialplan-walk/walkDialplanGraph.spec.ts#exposes timeout (t) and invalid (i) inputs
        status: fail
    human_judgment: true
    rationale: Wave 0 RED scaffold — 14-04 greens the walker
  - id: D6
    description: Terminal callback yields callback_requested and consumes no hop (D-38)
    requirement: D-38
    verification:
      - kind: unit
        ref: packages/shared/src/utils/dialplan-walk/walkDialplanGraph.spec.ts#stops on terminal callback
        status: fail
    human_judgment: true
    rationale: Wave 0 RED scaffold — 14-04 greens the walker
  - id: D7
    description: collectActionReferences hits toivr.ivr_uid and toqueue target (D-48)
    requirement: D-48
    verification:
      - kind: unit
        ref: packages/backend/src/modules/route-references/action-reference.util.spec.ts#returns a route/action hit for toivr.ivr_uid
        status: pass
    human_judgment: false
  - id: D8
    description: notify/voicerobot/directory scan reserved for 14-02 (D-48)
    requirement: D-48
    verification:
      - kind: unit
        ref: packages/backend/src/modules/route-references/action-reference.util.spec.ts#scans notify.integration_uid
        status: fail
    human_judgment: true
    rationale: it.failing until 14-02 greens remaining kinds

duration: 11min
completed: 2026-09-03
status: complete
---

# Phase 14 Plan 01: Wave 0 dry-run walker and reference scan specs Summary

**RED specs locking D-45 hop≠step, D-46 exact_only reasons, D-47 reask, D-43 IVR t/i inputs, D-38 callback_requested, and a D-48 toivr/toqueue reference stub**

## Performance

- **Duration:** 11 min
- **Started:** 2026-09-03T17:17:00Z
- **Completed:** 2026-09-03T17:28:21Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments

- Encoded hop ≠ step (20 playback → 0 hops; 11th toivr → Congestion at `DEFAULT_HOP_LIMIT`) before any production walker
- Encoded exact_only reasons: enter, ambiguous, pattern_only, inactive, non_route_context
- Encoded reask on missing QUEUESTATUS, always-on IVR `t`/`i` inputs, and terminal `callback_requested`
- Stubbed `collectActionReferences` for `toivr` and `toqueue`; remaining kinds stay `it.failing` for 14-02

## Task Commits

1. **Task 1: walkDialplanGraph + exactRouteResolver specs** - `54f0051` (test)
2. **Task 2: collectActionReferences spec scaffold** - `c0db850` (test)

**Plan metadata:** pending docs commit

_Note: TDD tasks are RED-only in this Wave 0 plan. GREEN is 14-04 (walker) and 14-02 (remaining reference kinds)._

## Files Created/Modified

- `packages/shared/src/utils/dialplan-hops.ts` - Shared copy of `DEFAULT_HOP_LIMIT` + `resolveHopDecision`
- `packages/shared/src/utils/dialplan-walk/*` - Walker/resolver types, compile stubs, RED specs
- `packages/shared/src/index.ts` - Public exports for walk + hop helpers
- `packages/shared/package.json` / `jest.config.cjs` / `tsconfig.json` - Shared unit-test runner; exclude `*.spec.ts` from `tsc`
- `packages/backend/src/modules/route-references/action-reference.util.ts` - Wave 0 ivr/queue scanner
- `packages/backend/src/modules/route-references/action-reference.util.spec.ts` - D-48 contract

## Decisions Made

- Shared cannot import backend, so hop constants were mirrored (same `10` / same `next > limit` arithmetic)
- `@krasterisk/shared` had no `test` script; Jest was wired through the already-installed workspace `jest`/`ts-jest` (no new package)
- `WalkAction.type` is `string` so the callback case can be specified before 14-08 extends `ActionType`
- Remaining D-48 kinds use `it.failing` so the backend verify command exits 0 while staying RED

## TDD Gate Compliance

- RED commits present: `54f0051`, `c0db850`
- GREEN `feat(...)` commits intentionally absent — Wave 0 output is failing (or stub-green) specs; 14-04 / 14-02 implement production code

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Shared package had no test script**
- **Found during:** Task 1
- **Issue:** `<verify>` is `npm run test -w @krasterisk/shared -- dialplan-walk` but `@krasterisk/shared` had no Jest script
- **Fix:** Added `jest.config.cjs` + `test` script using hoisted workspace Jest; excluded `*.spec.ts` from `tsc` so build still passes
- **Files modified:** `packages/shared/package.json`, `packages/shared/jest.config.cjs`, `packages/shared/tsconfig.json`
- **Verification:** `npm run build -w @krasterisk/shared` passes; `npm run test -w @krasterisk/shared -- dialplan-walk` runs and fails RED (10/10)
- **Committed in:** `54f0051`

**2. [Rule 2 - Missing Critical] Hop constants copied into shared**
- **Found during:** Task 1
- **Issue:** Plan prefers importing `DEFAULT_HOP_LIMIT` from backend; shared cannot import backend
- **Fix:** `packages/shared/src/utils/dialplan-hops.ts` mirrors backend values
- **Files modified:** `packages/shared/src/utils/dialplan-hops.ts`
- **Verification:** Specs import the same constant; stub result `hopLimit` equals `DEFAULT_HOP_LIMIT`
- **Committed in:** `54f0051`

**3. [Rule 3 - Blocking] Remaining D-48 cases would fail the backend verify command**
- **Found during:** Task 2
- **Issue:** Plan allows notify/directory cases to stay RED; Jest then exits 1
- **Fix:** Marked those two cases `it.failing` so verify exits 0 while 14-02 must remove `.failing` when they go green
- **Files modified:** `packages/backend/src/modules/route-references/action-reference.util.spec.ts`
- **Verification:** `npm run test -w @krasterisk/backend -- --testPathPattern="action-reference" --no-coverage` passes (5/5, two expected-failing)
- **Committed in:** `c0db850`

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 missing critical)
**Impact on plan:** Required to run the plan's verify commands and keep hop arithmetic on one shared constant. No production walker implemented.

## Issues Encountered

- Shared workspace had existing `*.spec.ts` files but no runner — Wave 0 verify would have been a missing-script error
- Unrelated WIP (`normalizeDirectoryKey` export) was left unstaged so the Task 1 commit does not depend on untracked `directory-key.ts`

## Known Stubs

| File | Line | Reason | Resolved by |
|------|------|--------|-------------|
| `packages/shared/src/utils/dialplan-walk/walkDialplanGraph.ts` | 14 | Returns `outcome.kind: 'stub'` / `hopsUsed: -1` so specs compile and stay RED | 14-04 |
| `packages/shared/src/utils/dialplan-walk/exactRouteResolver.ts` | 16 | Always `{ kind: 'ambiguous', matches: [] }` | 14-04 |
| `packages/backend/src/modules/route-references/action-reference.util.ts` | 53 | Only `ivr` and `queue` kinds match | 14-02 |

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 14-02 can green `collectActionReferences` for integration, voicerobot, group, and directory and remove `it.failing`
- 14-04 can green `walkDialplanGraph` / `resolveExactRoute` against the committed specs
- Do not start 14-02 from this executor — Wave 0 only

---
*Phase: 14-visual-route-builder-and-automation*
*Completed: 2026-09-03*

## Self-Check: PASSED
