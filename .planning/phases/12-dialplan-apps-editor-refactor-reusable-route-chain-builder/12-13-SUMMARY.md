---
phase: 12-dialplan-apps-editor-refactor-reusable-route-chain-builder
plan: 13
subsystem: dialplan
tags: [trunk-carousel, callerid, queue, webrtc, confbridge, schema-fields, D-36]

requires:
  - phase: 12-12
    provides: post-migration ActionType set; dual-read aliases removed
provides:
  - linear buildTrunkCarousel (one start line, one Dial, O(1) apps)
  - setclid_list single CURL via KRSK_HTTP_RESULT
  - QUEUE_PRIO before Queue(); announceoverride sanitized
  - toexten webrtc + empty-target NoOp
  - schema-driven ConfBridge/Queue/Exten UI
affects:
  - 12-14 call-groups exten migration
  - 12-17 live UAT of carousel and queue priority

tech-stack:
  added: []
  patterns:
    - "CUT() over TC_LIST/TC_TIMEOUTS — one Dial() loop, not n² Dial blocks"
    - "t(key, fallback) when ru.ts/en.ts are dirty WIP"
    - "ConfBridge room remains unsuffixed — accepted T-12-03-05 / T-12-13-03"

key-files:
  created:
    - packages/backend/src/shared/utils/dialplan-trunk-carousel.util.ts
    - packages/backend/src/shared/utils/dialplan-trunk-carousel.util.spec.ts
    - packages/frontend/src/features/dialplan-apps/ui/apps/ConfBridgeApp/ConfBridgeApp.tsx
    - packages/frontend/src/features/dialplan-apps/ui/apps/ConfBridgeApp/ConfBridgeApp.module.scss
    - packages/frontend/src/features/dialplan-apps/ui/apps/ConfBridgeApp/ConfBridgeApp.test.tsx
  modified:
    - packages/backend/src/shared/utils/dialplan.util.ts
    - packages/backend/src/shared/utils/dialplan.util.spec.ts
    - packages/backend/src/modules/routes/dto/dialplan-params/address.params.dto.ts
    - packages/backend/src/modules/routes/dto/dialplan-params/dialplan-params.spec.ts
    - packages/shared/src/types/notification.types.ts
    - packages/frontend/src/features/dialplan-apps/model/registry.ts
    - packages/frontend/src/features/dialplan-apps/ui/apps/QueueApp/QueueApp.tsx
    - packages/frontend/src/features/dialplan-apps/ui/apps/ExtenApp/ExtenApp.tsx
    - packages/frontend/src/features/dialplan-apps/ui/apps/CallerIdApp/CallerIdApp.tsx

key-decisions:
  - "Carousel modes: sequential Set(TC_I=1); random_then_failover RAND(1,n); never assign mode"
  - "setclid_list cache variable is KRSK_HTTP_RESULT (already one CURL after 12-01 SHELL pair)"
  - "t(key, fallback) — dirty locale files not staged"
  - "ConfBridge room argument stays unsuffixed (T-12-03-05 / T-12-13-03 accepted)"
  - "CallerIdApp pool editor keeps local Input/Select (kind custom), not SchemaFields"

patterns-established:
  - "Channel vars: TC_LIST, TC_I, TC_TRIED, TC_TIMEOUTS; CID_LAST / __CID_LAST"
  - "QUEUE_PRIO must appear before Queue() or it has no effect"

requirements-completed: [D-32, D-36, D-37, D-39, D-41, D-43]

coverage:
  - id: D1
    description: trunk carousel is linear — one start label, one Dial(); wrap order matches 12-01; modes differ
    requirement: D-36
    verification:
      - kind: unit
        ref: packages/backend/src/shared/utils/dialplan-trunk-carousel.util.spec.ts#emits one start line for three trunks
        status: pass
      - kind: unit
        ref: packages/backend/src/shared/utils/dialplan.util.spec.ts#trunk_carousel with five trunks emits one Dial()
        status: pass
    human_judgment: false
  - id: D2
    description: setclid_list one CURL reused via KRSK_HTTP_RESULT; phonebook name; CID anti-repeat; setclid_custom name
    requirement: D-37
    verification:
      - kind: unit
        ref: packages/backend/src/shared/utils/dialplan.util.spec.ts#setclid_list
        status: pass
    human_judgment: false
  - id: D3
    description: toqueue Set(QUEUE_PRIO=N) before Queue(); announceoverride sanitized
    requirement: D-32
    verification:
      - kind: unit
        ref: packages/backend/src/shared/utils/dialplan.util.spec.ts#toqueue emits Set(QUEUE_PRIO=) before Queue()
        status: pass
    human_judgment: false
  - id: D4
    description: toexten webrtc changes transport; empty target is NoOp not empty string
    requirement: D-39
    verification:
      - kind: unit
        ref: packages/backend/src/shared/utils/dialplan.util.spec.ts
        status: pass
    human_judgment: false
  - id: D5
    description: ConfBridge/Queue/Exten schema-driven; no PIN/profile/recording/DTMF stubs; room unsuffixed
    requirement: D-41
    verification:
      - kind: unit
        ref: packages/frontend/src/features/dialplan-apps/ui/apps/ConfBridgeApp/ConfBridgeApp.test.tsx
        status: pass
    human_judgment: false
  - id: D6
    description: setclid_custom name reaches CALLERID(name)
    requirement: D-43
    verification:
      - kind: unit
        ref: packages/backend/src/shared/utils/dialplan.util.spec.ts
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-08-20
status: complete
---

# Phase 12 Plan 13: Per-app generator and schema UI Summary

**Linear trunk carousel (1 Dial vs 25), one CURL for setclid_list, QUEUE_PRIO/webrtc/custom CID name, and schema-driven ConfBridge/Queue/Exten**

## Performance

- **Duration:** 25 min
- **Started:** 2026-08-20T01:57:00Z
- **Completed:** 2026-08-20T02:20:00Z
- **Tasks:** 3 (TDD RED+GREEN each)
- **Files modified:** 20

## Baseline vs after (must record)

| Metric | 12-01 baseline | After 12-13 |
|--------|----------------|-------------|
| `trunk_carousel` n=3 `Dial(` | 9 (n²) | **1** |
| `trunk_carousel` n=5 `Dial(` | 25 (n²) | **1** |
| Start labels (n=3 / n=5) | 3 / 5 | **1 / 1** (`n(tc_try)`) |
| App lines n≥2 | ~n² Dial blocks | **26 lines, O(1)** (`Set(TC_LIST)` + 25 `same =>`) |
| `setclid_list` external calls | 2 `SHELL()` | **1 `CURL()`** |

Channel vars: `TC_LIST`, `TC_I`, `TC_TRIED`, `TC_TIMEOUTS`; CID cache `KRSK_HTTP_RESULT`; anti-repeat `CID_LAST` / `__CID_LAST`.

**Accepted risk T-12-03-05 / T-12-13-03:** `ConfBridge(room)` is **not** tenant-suffixed. Two tenants with the same room number join the same conference. Documented in `ConfBridgeApp` JSDoc. Closure is a later conferences-module phase.

## Accomplishments

- `buildTrunkCarousel` emits one loop start and one `Dial(${TC_TRUNK}/…)`; wrap-around order matches 12-01; `sequential` vs `random_then_failover` actually differ; per-trunk timeouts via `TC_TIMEOUTS`
- `setclid_list` one `CURL` into `KRSK_HTTP_RESULT`; phonebook `CALLERID(name)` from `CUT(PB_RAW,|,5)`; custom `name` → `CALLERID(name)`
- `toqueue`: `Set(QUEUE_PRIO=N)` **before** `Queue()`; `announceoverride` via `sanitizeFilePath`; DTO `@Min(0) @Max(20)`, rejects `../`
- `toexten` empty target → `NoOp(Missing toexten target)` (never `''`); `webrtc` reaches `normalizeTarget`
- `ConfBridgeApp` / `QueueApp` / `ExtenApp` on SchemaFields; no PIN/profile/recording/DTMF UI

## Task Commits

1. **Task 1 RED:** `9338f9b` test(12-13): add failing test for linear trunk carousel
2. **Task 1 GREEN:** `78f7bda` feat(12-13): implement linear trunk carousel
3. **Task 2 RED:** `3cd8f91` test(12-13): add failing tests for callerid queue webrtc
4. **Task 2 GREEN:** `b29a221` feat(12-13): implement callerid queue webrtc generator fixes
5. **Task 3 RED:** `51cc91d` test(12-13): add failing tests for schema-driven apps
6. **Task 3 GREEN:** `1d75e09` feat(12-13): add schema-driven confbridge queue exten UI

**Plan metadata:** (docs commit after this file)

## Files Created/Modified

- `dialplan-trunk-carousel.util.ts` — linear carousel
- `dialplan.util.ts` — wires carousel; QUEUE_PRIO; CID; confbridge ValueSource
- `address.params.dto.ts` — toqueue priority / announceoverride
- `notification.types.ts` — carousel `mode` includes `sequential`; item `timeout?`
- `ConfBridgeApp.tsx` — schema room + options
- `QueueApp.tsx` / `ExtenApp.tsx` — SchemaFields (priority, announceoverride, webrtc)
- `CallerIdApp.tsx` — setclid_list hint (one request)
- `registry.ts` / `schema.types.ts` / `SchemaFields.tsx` / `ValueSourceField.tsx`

## Decisions Made

- Linear carousel: materialize lists, `CUT()`, increment `TC_I` with wrap; do not force `random_then_failover`
- Reuse existing `KRSK_HTTP_RESULT` for setclid_list (no new cache var)
- Copy via `t(key, fallback)` — do not stage mixed `ru.ts`/`en.ts`
- CallerId pool editor stays custom Inputs (not a full SchemaFields rewrite)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] notification.types.ts carousel mode/timeout**
- **Found during:** Task 1
- **Issue:** Shared types still omitted `sequential` and per-trunk `timeout`
- **Fix:** Added `mode` union and optional `timeout` on carousel items
- **Files modified:** `packages/shared/src/types/notification.types.ts`
- **Commit:** `78f7bda`

**2. [Rule 2 - Missing Critical] confbridge generator reads ValueSource**
- **Found during:** Task 3
- **Issue:** UI now writes room as ValueSource object; generator still expected a string
- **Fix:** `resolveValueSource` in confbridge arm; `ConfBridge(room)` vs `ConfBridge(room,opts)` when options set; room still unsuffixed
- **Files modified:** `packages/backend/src/shared/utils/dialplan.util.ts`
- **Commit:** `1d75e09`

**3. [Rule 1 - Bug] ValueSourceField aria-invalid + SchemaFields label fallback + StepSheet fixtures**
- **Found during:** Task 3 GREEN
- **Issue:** Empty required target had no `aria-invalid`; multiple catalog comboboxes broke StepSheet focus tests; toexten prepend needed a valid target
- **Fix:** a11y attrs; `t(key, field.label ?? key)`; StepSheet fixtures
- **Files modified:** `ValueSourceField.tsx`, `SchemaFields.tsx`, `StepSheet.test.tsx`
- **Commit:** `1d75e09`

**4. [Rule 3 - Blocking] TFn vs i18n TFunction**
- **Found during:** Task 3
- **Issue:** Passing `t` directly failed `TFn` (optional fallback vs TFunction overloads)
- **Fix:** Wrap `(key, fallback) => t(key, fallback)`
- **Files modified:** ConfBridgeApp, QueueApp, ExtenApp
- **Commit:** `1d75e09`

### Intentional scope

- Locales `ru.ts`/`en.ts` **not staged** (unrelated WIP). Copy lives in `t(key, fallback)`.
- `CallerIdApp` still uses local `<Input>`/`<Select>` for the CID pool editor (`kind: 'custom'`). Schema-driven surface covers ConfBridge/Queue/Exten.
- Full-repo `npm run lint` / `tsc --noEmit` not green because of unrelated callcenter/users WIP. Verified: eslint on 12-13 frontend files (exit 0); frontend dialplan-apps tests 135/135; backend carousel + dialplan.util specs.
- `dialplan-bridge` unchanged (not required).
- Commits on `main` (`use_worktrees: false`).

---

**Total deviations:** 4 auto-fixed (2 Rule 2, 1 Rule 1, 1 Rule 3) plus documented scope
**Impact on plan:** Required for correctness/types. No architectural change.

## Issues Encountered

- PowerShell: jest via `npx jest --testPathPattern=...` from `packages/backend` (npm `-w` swallows the pattern).
- Huge unrelated WIP — staged only 12-13 paths.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for **12-14** (call-groups exten migration, wave 10).
- Live carousel + queue-priority UAT remains **12-17**.

## TDD Gate Compliance

RED then GREEN commits exist for all three tasks (`test` → `feat` pairs). No refactor commit.

## Known Stubs

None that block the plan goal. ConfBridge PIN/profile/recording/DTMF are **intentionally absent** (D-41 prohibition), not stubs.

## Self-Check: PASSED

- Files: `dialplan-trunk-carousel.util.ts`, `ConfBridgeApp.tsx`, `12-13-SUMMARY.md` exist
- Commits: `9338f9b`, `78f7bda`, `3cd8f91`, `b29a221`, `51cc91d`, `1d75e09` exist on `main`
