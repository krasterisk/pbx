---
phase: 12-dialplan-apps-editor-refactor-reusable-route-chain-builder
plan: 03
subsystem: dialplan-validation
tags: [ActionType, DialplanAction, DTO, congestion, validateActionParams, DIALPLAN_ACTION_META]

requires:
  - phase: 12-02
    provides: ValueSource + ToQueueParamsDto tracer pattern
provides:
  - Full DialplanAction discriminated union (30 types including congestion)
  - DIALPLAN_ACTION_META terminal/allowedIn/family table
  - ACTION_PARAM_DTO registry + per-type params DTOs
  - validateActionParams 400 { errors: [{ actionId, path, message }] } on four hosts
affects:
  - 12-05 Congestion() generator branch
  - 12-06 unreachable-tail reads DIALPLAN_ACTION_META.terminal
  - 12-07 registry schema/summarize/terminal required fields
  - 12-08 mapStepErrors from 400 body

tech-stack:
  added: []
  patterns:
    - "Explicit ACTION_PARAM_DTO registry instead of class-transformer discriminator"
    - "ValueSourceDto nested path target.value"
    - "MediaOptionsDto string/object parse with raw-flag round-trip"

key-files:
  created:
    - packages/shared/src/types/dialplan-action-meta.ts
    - packages/backend/src/modules/routes/dto/dialplan-params/index.ts
    - packages/backend/src/modules/routes/dto/dialplan-params/value-source.dto.ts
    - packages/backend/src/modules/routes/dto/dialplan-params/address.params.dto.ts
    - packages/backend/src/modules/routes/dto/dialplan-params/media.params.dto.ts
    - packages/backend/src/modules/routes/dto/dialplan-params/control.params.dto.ts
    - packages/backend/src/modules/routes/dto/dialplan-params/integration.params.dto.ts
    - packages/backend/src/modules/routes/dto/dialplan-params/dialplan-params.spec.ts
    - packages/backend/src/shared/pipes/action-params-validation.util.ts
    - packages/backend/src/shared/pipes/action-params-validation.util.spec.ts
    - packages/backend/src/modules/ivrs/ivrs.controller.spec.ts
    - packages/backend/src/modules/voice-robots/voice-robots.controller.spec.ts
  modified:
    - packages/shared/src/types/dialplan-params.types.ts
    - packages/shared/src/types/route.types.ts
    - packages/shared/src/index.ts
    - packages/backend/src/modules/routes/dto/route-action.dto.ts
    - packages/backend/src/modules/routes/dto/dialplan-params/toqueue.params.dto.ts
    - packages/backend/src/modules/routes/routes.controller.ts
    - packages/backend/src/modules/routes/routes.controller.spec.ts
    - packages/backend/src/modules/ivrs/ivrs.controller.ts
    - packages/backend/src/modules/phonebooks/phonebooks.controller.ts
    - packages/backend/src/modules/phonebooks/phonebooks.controller.spec.ts
    - packages/backend/src/modules/voice-robots/voice-robots.controller.ts
    - packages/frontend/src/features/dialplan-apps/model/registry.ts
    - packages/backend/src/shared/utils/dialplan.util.spec.ts

key-decisions:
  - "30 ActionTypes are the live 29 plus congestion, not the planner's generic setvar/goto taxonomy"
  - "ACTION_PARAM_DTO is null only for hangup/busy/congestion"
  - "Locales routes.action.congestion left unstaged (WIP mix); UI uses t(key, type) fallback"

patterns-established:
  - "throwIfInvalidActionPayload on every host write-path"
  - "Nested class-validator paths for ValueSource (target.value)"

requirements-completed: [D-08, D-09, D-10, D-11, D-24, D-38, D-39, D-41, D-42]

coverage:
  - id: D1
    description: 30-type DialplanAction union + congestion in all four registries
    requirement: D-08
    verification:
      - kind: unit
        ref: packages/backend/src/modules/routes/dto/dialplan-params/dialplan-params.spec.ts#D-08 DialplanAction union
        status: pass
    human_judgment: false
  - id: D2
    description: ACTION_PARAM_DTO covers every ActionTypesList value with valid/invalid cases
    requirement: D-09
    verification:
      - kind: unit
        ref: packages/backend/src/modules/routes/dto/dialplan-params/dialplan-params.spec.ts#D-09 ACTION_PARAM_DTO registry
        status: pass
    human_judgment: false
  - id: D3
    description: 400 errors name the step (actionId) and dotted params path
    requirement: D-11
    verification:
      - kind: unit
        ref: packages/backend/src/shared/pipes/action-params-validation.util.spec.ts#held-out
        status: pass
    human_judgment: false
  - id: D4
    description: Media options nsp / nU(x)L(1:2:3) round-trip character-identical
    requirement: D-38
    verification:
      - kind: unit
        ref: packages/backend/src/modules/routes/dto/dialplan-params/dialplan-params.spec.ts#D-38 MediaOptionsDto round-trip
        status: pass
    human_judgment: false
  - id: D5
    description: Host write-paths (routes, IVR, phonebooks, voice-robots) block invalid params
    requirement: D-10
    verification:
      - kind: unit
        ref: packages/backend/src/modules/routes/routes.controller.spec.ts#write-path params validation
        status: pass
    human_judgment: false

duration: 100min
completed: 2026-08-19
status: complete
---

# Phase 12 Plan 03: Per-type params union and validation Summary

**Full DialplanAction discriminated union (30 types including congestion), DIALPLAN_ACTION_META, per-type DTO registry, and a shared 400 `{ errors: [{ actionId, path, message }] }` contract on all four host write-paths.**

## Performance

- **Duration:** ~100 min
- **Started:** 2026-08-19T06:52:52Z
- **Completed:** 2026-08-19
- **Tasks:** 3/3 (TDD RED/GREEN per task)
- **Files modified:** 25 (locales left unstaged)

## Accomplishments

- `congestion` exists in `ActionType`, `ActionTypesList`, `DIALPLAN_ACTION_META`, and `dialplanAppsRegistry`. Generator still emits `NoOp(Unknown action: congestion)` until 12-05.
- Every live `ActionType` has a params interface in `@krasterisk/shared` and a DTO selected by `ACTION_PARAM_DTO` (`null` only for hangup/busy/congestion).
- `validateActionParams` flattens nested class-validator paths (`target.value`) and is called on routes (actions + bindings), IVR `menu_items`, phonebook write bodies, and voice-robot fallback/keyword actions.

## Task Commits

1. **Task 1 RED** - `4aa4bee` — `test(12-03): add failing test for params union and congestion`
2. **Task 1 GREEN** - `bda158f` — `feat(12-03): add full DialplanAction union and congestion type`
3. **Task 2 RED** - `d1875c4` — `test(12-03): add failing tests for per-type params DTOs`
4. **Task 2 GREEN** - `45ff77b` — `feat(12-03): add per-type params DTOs and ACTION_PARAM_DTO registry`
5. **Task 3 RED** - `36dcb08` — `test(12-03): add failing tests for host write-path validation`
6. **Task 3 GREEN** - `6b38976` — `feat(12-03): validate action params on all host write-paths`

## Files Created/Modified

- `packages/shared/src/types/dialplan-action-meta.ts` — terminal / allowedIn / family table
- `packages/shared/src/types/dialplan-params.types.ts` — 30 params interfaces + ValueSource
- `packages/shared/src/types/route.types.ts` — ActionType + DialplanAction + assertNeverAction
- `packages/backend/src/modules/routes/dto/dialplan-params/*` — DTO families + registry
- `packages/backend/src/shared/pipes/action-params-validation.util.ts` — shared 400 contract
- Host controllers: routes, ivrs, phonebooks, voice-robots

## Decisions Made

- Mapped DTO families onto the **live** 29 types + `congestion`. The plan's `setvar` / `goto` / `dial` / `background` names do not exist in this codebase; `setclid_custom.terminal === 'never'` stands in for the plan's `setvar` example.
- Address DTOs cannot `implements` the ValueSource discriminated union (class fields are optional). Shape is still validated by ValueSourceDto.
- `IRouteAction.params` stays `Record<string, any>` as the relaxed helper; `DialplanAction` is the typed noun. DTO field is `params: object`.
- `routes.action.congestion` added in working-tree locales but not committed (same WIP-mix as 12-02). `ActionTypeSelect` already uses `t(labelKey, type)`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Wave 0 ACTION_TYPES completeness gate**
- **Found during:** Task 1
- **Issue:** `dialplan.util.spec.ts` compile-fails when ActionType gains a member without updating `ACTION_TYPES`.
- **Fix:** Added `congestion` to ACTION_TYPES / CHARACTERIZED_TYPES and characterized today's `NoOp(Unknown action: congestion)`.
- **Files modified:** `packages/backend/src/shared/utils/dialplan.util.spec.ts`
- **Commit:** `bda158f`

**2. [Rule 3 - Blocking] Plan taxonomy vs live ActionType**
- **Found during:** Task 1
- **Issue:** Plan Task 2 grouped fictional types (`setvar`, `goto`, `macro`, `agi`, `moh`, `record`, `curl`, `dial`).
- **Fix:** Grouped the real 30 types by family (address/media/control/integration). Documented field-source discrepancies vs generator in this SUMMARY.
- **Files modified:** shared types + DTO family files
- **Commit:** `bda158f`, `45ff77b`

**3. [Rule 2 - Locale isolation]**
- **Found during:** Task 1
- **Issue:** `ru.ts` / `en.ts` mixed with unrelated WIP.
- **Fix:** Added `routes.action.congestion` in the working tree only; did not stage locale files. UI fallback is the type name.
- **Files modified:** locales unstaged

### Field-source discrepancies (generator wins)

- `toivr` keeps `ivr_uid` (entity id), not ValueSource.
- `tolist.numbers` stays a comma-separated string (generator split).
- `notify` / `callerid` / `trunk_carousel` keep existing notification.types shapes.
- Media `langoverride` / `digittimeout` are declared on DTOs; generator does not read them yet (12-10 / D-51).
- `confbridge.room` is ValueSource in types/DTO; generator still reads string `room` until 12-05/12-13.

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 locale isolation)
**Impact on plan:** Required for tsc/tests and dirty-tree safety. No scope creep.

## Issues Encountered

- `npm run test -w @krasterisk/backend -- --testPathPattern=...` drops jest args on this npm; ran `npx jest --testPathPattern=...` inside `packages/backend`.
- Frontend `tsc` has pre-existing callcenter/users/Profile WIP errors; registry `Record<ActionType, IDialplanAppConfig>` accepted congestion (no missing-key error).

## User Setup Required

None.

## Next Phase Readiness

- Wave 3 can add `Congestion()` in 12-05 and require `schema`/`summarize`/`terminal`/`allowedIn` in 12-07 without colliding on the 30th type.
- Next recommended plan: **12-05**.
- Commit locale key `routes.action.congestion` when ru/en hunks can be split.

## Self-Check: PASSED

- SUMMARY written; 6 task commits exist; characterization of congestion remains the Wave 0 NoOp.
- Focused backend tests: 244 passed (`dialplan-params|route-action|action-params-validation|routes/ivrs/phonebooks/voice-robots.controller|dialplan.util`).
