---
phase: 16-modul-telekonferentsiy-confbridge-webrtc
plan: 03
subsystem: api
tags: [conferences, mask-index, dialplan, confbridge, tenant-isolation]

requires:
  - phase: 16-modul-telekonferentsiy-confbridge-webrtc
    provides: ConferenceRoomsService.applyRoom, krsk-conf-{room_uid}, generateConferenceDialplan
provides:
  - Tenant mask-index context krsk-conf-mask-{vpbx} rebuilt on every room mutation
  - Route step confbridge hops into krsk-conf-{uid} or the tenant mask-index
  - IConfBridgeParams / ConfBridgeParamsDto without options
  - Dry-run legacy confbridge report script and excluded MODULE_COVERAGE.conferences
affects:
  - 16-04 room selector in the route-step editor
  - 16-05 moderators and ConfBridge roles
  - 16.3 AI adapter (coverage flips from excluded to covered)

actuals:
  tokens: 11664
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - D-05 branch-to-room: mask-index emits GotoIf+DIALPLAN_EXISTS, never CURL
    - applyRoom publishes [roomCategory, maskIndexCategory] in one applyCategories
    - remove deletes the room category then rebuilds mask-index without that number
    - confbridge route step uses emitHopPrologue; ConfBridge() lives only in the room category

key-files:
  created:
    - packages/backend/src/modules/conferences/conference-dialplan.util.spec.ts
    - packages/backend/src/modules/conferences/legacy-confbridge-steps.util.ts
    - packages/backend/src/modules/conferences/report-legacy-confbridge-steps.ts
    - packages/backend/src/modules/conferences/legacy-confbridge-steps.spec.ts
  modified:
    - packages/backend/src/modules/conferences/conference-dialplan.util.ts
    - packages/backend/src/modules/conferences/conference-rooms.service.ts
    - packages/backend/src/modules/conferences/conference-rooms.service.spec.ts
    - packages/backend/src/shared/utils/dialplan.util.ts
    - packages/shared/src/types/dialplan-params.types.ts
    - packages/backend/src/modules/routes/dto/dialplan-params/address.params.dto.ts
    - packages/backend/src/modules/ai-platform/module-coverage.registry.ts
    - packages/backend/package.json

key-decisions:
  - "D-05 chose the branch-to-room mask-index, not CURL, for number resolution"
  - "Missing room plays Playback(invalid) and Hangup; it never auto-creates a conference"
  - "MODULE_COVERAGE.conferences is excluded until Phase 16.3 ships the adapter and skill"

patterns-established:
  - "Pattern: conferenceMaskContextName(vpbx) is krsk-conf-mask-{vpbx}"
  - "Pattern: room numbers stay strings through to exten (007 stays 007)"
  - "Pattern: leftover params.options is ignored at emit and stripped only with --apply"

requirements-completed: [D-05, D-07, D-08, D-09]

coverage:
  - id: D1
    description: Tenant mask-index resolves a room number to krsk-conf-{uid} with DIALPLAN_EXISTS and a shared not-found Playback(invalid)+Hangup
    requirement: D-05
    verification:
      - kind: unit
        ref: packages/backend/src/modules/conferences/conference-dialplan.util.spec.ts#generateConferenceMaskIndex
        status: pass
    human_judgment: false
  - id: D2
    description: create/update publish room category and rebuilt mask-index in one applyCategories; remove rebuilds mask-index without the deleted number
    requirement: D-08
    verification:
      - kind: unit
        ref: packages/backend/src/modules/conferences/conference-rooms.service.spec.ts#create
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/conferences/conference-rooms.service.spec.ts#remove
        status: pass
    human_judgment: false
  - id: D3
    description: Route step confbridge hops into krsk-conf-{uid} or krsk-conf-mask-{vpbx} and never emits ConfBridge( or leftover options
    requirement: D-07
    verification:
      - kind: unit
        ref: packages/backend/src/shared/utils/dialplan.util.spec.ts#confbridge route step (16-03)
        status: pass
    human_judgment: false
  - id: D4
    description: options is gone from IConfBridgeParams and ConfBridgeParamsDto; leftover key is accepted and ignored
    requirement: D-08
    verification:
      - kind: unit
        ref: packages/backend/src/modules/routes/dto/dialplan-params/dialplan-params.spec.ts#declares only room
        status: pass
    human_judgment: false
  - id: D5
    description: Legacy confbridge report is dry-run by default; --apply strips only options; conferences is excluded in MODULE_COVERAGE until Phase 16.3
    requirement: D-09
    verification:
      - kind: unit
        ref: packages/backend/src/modules/conferences/legacy-confbridge-steps.spec.ts
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/ai-adapter-completeness.spec.ts#live classification
        status: pass
    human_judgment: false

duration: 9min
completed: 2026-09-16
status: complete
---

# Phase 16 Plan 03: Tenant mask-index, route rewrite, legacy report Summary

**Room numbers now resolve only inside a tenant mask-index (`krsk-conf-mask-{vpbx}`), the route step hops into that context or the selected room instead of emitting a bare ConfBridge name, and leftover `options` is gone from the step contract.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-09-16T01:35:10Z
- **Completed:** 2026-09-16T01:44:19Z
- **Tasks:** 3
- **Files modified:** 15

## Accomplishments

- `generateConferenceMaskIndex` writes `exten => {number},1` under `DIALPLAN_EXISTS`, keeps numbers as strings (`007` stays `007`), and refuses 33-digit or non-digit values.
- `applyRoom` sends the room category and the rebuilt mask-index in one `applyCategories`; `remove` deletes `krsk-conf-{uid}` then republishes the index without that number.
- `case 'confbridge'` jumps to `krsk-conf-{uid},s,1` or `krsk-conf-mask-{vpbx},{expr},1` via `emitHopPrologue`. Missing room is `NoOp` plus `Playback(invalid)` / `Hangup` in the index — never an auto-created conference.
- `db:report:legacy-confbridge` is dry-run by default; `--apply` strips only the dead `options` key. `MODULE_COVERAGE.conferences` is `{ kind: 'excluded' }` until Phase 16.3.

## Task Commits

Each task was committed atomically:

1. **Task 1: Тенантный mask-index** - `4df309d` (test RED), `789004f` (feat GREEN)
2. **Task 2: Шаг маршрута без options** - `23b058f` (test RED), `124c876` (feat GREEN)
3. **Task 3: Отчёт и реестр покрытия AI** - `95f244b` (test RED), `9211fc9` (feat GREEN)

**Plan metadata:** pending `docs(16-03): complete tenant mask-index plan`

_Note: TDD tasks have RED then GREEN commits._

## Files Created/Modified

- `packages/backend/src/modules/conferences/conference-dialplan.util.ts` - `conferenceMaskContextName`, `generateConferenceMaskIndex`
- `packages/backend/src/modules/conferences/conference-dialplan.util.spec.ts` - mask-index generator cases
- `packages/backend/src/modules/conferences/conference-rooms.service.ts` - `buildMaskIndex`, dual-category `applyRoom`, mask rebuild on `remove`
- `packages/backend/src/modules/conferences/conference-rooms.service.spec.ts` - applyCategories arity and remove rebuild
- `packages/backend/src/shared/utils/dialplan.util.ts` - rewritten `case 'confbridge'`
- `packages/shared/src/types/dialplan-params.types.ts` - `IConfBridgeParams` is `room` only
- `packages/backend/src/modules/routes/dto/dialplan-params/address.params.dto.ts` - `ConfBridgeParamsDto` drops `options`
- `packages/backend/src/modules/conferences/legacy-confbridge-steps.util.ts` - classify / strip
- `packages/backend/src/modules/conferences/report-legacy-confbridge-steps.ts` - dry-run report, `--apply` strip
- `packages/backend/src/modules/ai-platform/module-coverage.registry.ts` - `conferences` excluded
- `packages/backend/package.json` - `db:report:legacy-confbridge`

## Decisions Made

- D-05 uses the generated branch-to-room mask-index; no `CURL(` appears in room or mask-index lines.
- A missing number plays the stock `invalid` sound and hangs up. The index never creates a room.
- `MODULE_COVERAGE.conferences` stays `excluded` because a `covered` entry would demand an adapter and skill that Phase 16.3 owns (D-41).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Existing applyCategories goldens expected a single room category**
- **Found during:** Task 1 GREEN
- **Issue:** 16-01/16-02 specs asserted a one-element `applyCategories` array and left `findAll` unresolved, so `buildMaskIndex` would throw before publish
- **Fix:** Mock `findAll` to `[]` / remaining rooms; assert with `arrayContaining` the room category; keep the new two-category cases
- **Files modified:** `conference-rooms.service.spec.ts`, `conference-spine.spec.ts`
- **Verification:** conference-dialplan + conference-rooms.service + conference-spine green
- **Committed in:** `789004f` (Task 1 GREEN)

**2. [Rule 2 - Missing Critical] `buildMaskIndex` treated a missing findAll result as a crash**
- **Found during:** Task 1 GREEN
- **Issue:** `rooms.map` threw when the mock returned `undefined`
- **Fix:** Coalesce `findAll` to `[]` before mapping
- **Files modified:** `conference-rooms.service.ts`
- **Verification:** spine SSE create no longer logs `.map` of undefined
- **Committed in:** `789004f` (Task 1 GREEN)

**3. [Rule 3 - Blocking] Wave 0 confbridge characterization still expected ConfBridge(room)**
- **Found during:** Task 2 GREEN
- **Issue:** Four goldens in `dialplan.util.spec.ts` froze the unscoped `ConfBridge(...)` output this plan removes
- **Fix:** Retarget those cases to the hop into `krsk-conf-{uid}` / `krsk-conf-mask-42`
- **Files modified:** `packages/backend/src/shared/utils/dialplan.util.spec.ts`
- **Verification:** `dialplan.util` 239 passed
- **Committed in:** `124c876` (Task 2 GREEN)

**4. [Rule 1 - Bug] Shared-types path in the DTO spec was one directory too high**
- **Found during:** Task 2 GREEN
- **Issue:** The new "only room" source-scan opened `krasterisk_v4/shared/...` instead of `packages/shared/...`
- **Fix:** Use six `../` segments from `dialplan-params/`
- **Files modified:** `dialplan-params.spec.ts`
- **Verification:** `declares only room on ConfBridgeParamsDto and IConfBridgeParams` green
- **Committed in:** `124c876` (Task 2 GREEN)

---

**Total deviations:** 4 auto-fixed (1 bug, 1 missing critical, 2 blocking)
**Impact on plan:** All required to keep prior-wave suites green after the contract change. No scope creep.

## Issues Encountered

Workspace `npm run lint` still fails on pre-existing errors in `read-adapters-operations.spec.ts` and `read-adapters-speech.spec.ts` (`preserve-caught-error`) plus many unrelated warnings. Files from this plan were not in that error list. Not fixed (out of scope).

The report script was not executed against the live DB in this wave; its behavior is covered through the pure classify/strip functions. Root `.env` is present (same path as `db:setup:conferences`).

## TDD Gate Compliance

- Task 1 RED `4df309d` then GREEN `789004f`
- Task 2 RED `23b058f` then GREEN `124c876`
- Task 3 RED `95f244b` then GREEN `9211fc9`

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Wave 4 (`16-04`) can replace the free-text room field with a catalog of tenant rooms. Do not rename `krsk-conf-{room_uid}` or `krsk-conf-mask-{vpbx}`.
- Phase 16.3 flips `MODULE_COVERAGE.conferences` to `covered` when the adapter and skill land.

---
*Phase: 16-modul-telekonferentsiy-confbridge-webrtc*
*Completed: 2026-09-16*

## Self-Check: PASSED
