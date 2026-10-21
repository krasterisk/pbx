---
phase: 16-modul-telekonferentsiy-confbridge-webrtc
plan: 04
subsystem: ui
tags: [conferences, catalog, value-source, dialplan-apps, rtk, i18n]

requires:
  - phase: 16-modul-telekonferentsiy-confbridge-webrtc
    provides: GET /conferences, fixed room value as decimal string uid, options removed from confbridge step
provides:
  - conferenceRoomApi.getConferenceRooms + useGetConferenceRoomsQuery
  - OptionsSource conferenceRooms in useSchemaRefs and CATALOG_DEFAULTS
  - Catalog-agnostic ValueSourceField queue mode
  - confBridge schema room selector + summarize via refs.conferenceRooms
  - Eight UI-state tests for the route-step room selector
affects:
  - 16-05 moderators and ConfBridge roles
  - 16.3 conference room list and live-room UI (do not reuse this field)

actuals:
  tokens: 8600
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - OptionsSource → useSchemaRefs → CATALOG_DEFAULTS is the only catalog path
    - Queue-mode ValueSourceField reads SchemaCatalogRef; queues fetch only when optionsSource === queues
    - Room uid stays a decimal string from catalog option to step params

key-files:
  created:
    - packages/frontend/src/shared/api/endpoints/conferenceRoomApi.ts
    - packages/frontend/src/features/dialplan-apps/ui/ValueSourceField/ValueSourceField.test.tsx
  modified:
    - packages/frontend/src/shared/api/rtkApi.ts
    - packages/frontend/src/features/dialplan-apps/model/schema.types.ts
    - packages/frontend/src/features/dialplan-apps/model/useSchemaRefs.ts
    - packages/frontend/src/features/dialplan-apps/model/useSchemaRefs.test.tsx
    - packages/frontend/src/features/dialplan-apps/model/schemas/confBridge.tsx
    - packages/frontend/src/features/dialplan-apps/model/registry.ts
    - packages/frontend/src/features/dialplan-apps/ui/SchemaFields/SchemaFields.tsx
    - packages/frontend/src/features/dialplan-apps/ui/ValueSourceField/ValueSourceField.tsx
    - packages/frontend/src/shared/config/locales/ru.ts
    - packages/frontend/src/shared/config/locales/en.ts

key-decisions:
  - "Room catalog is registered through OptionsSource → useSchemaRefs → CATALOG_DEFAULTS; fields never call useGetConferenceRoomsQuery"
  - "Queue-mode ValueSourceField is catalog-agnostic; queues skip unless optionsSource === queues"
  - "Empty catalog hides the static optgroup and links to /conferences in a new tab"

patterns-established:
  - "Pattern: catalog value is String(room.uid); compare and persist as string, never Number()"
  - "Pattern: SchemaFields passes refs[field.optionsSource] as catalog into ValueSourceField"
  - "Pattern: summarizeConfBridge looks up refs.conferenceRooms.items by uid string and shows the number in the label"

requirements-completed: [D-08]

coverage:
  - id: D1
    description: Conference rooms catalog is registered via OptionsSource, useSchemaRefs, and CATALOG_DEFAULTS; uid stays a string
    requirement: D-08
    verification:
      - kind: unit
        ref: packages/frontend/src/features/dialplan-apps/model/useSchemaRefs.test.tsx#maps rooms as string uids
        status: pass
    human_judgment: false
  - id: D2
    description: Route-step room field selects a catalog room as { source: fixed, value: uid } and keeps dynamic mask sources
    requirement: D-08
    verification:
      - kind: unit
        ref: packages/frontend/src/features/dialplan-apps/ui/ValueSourceField/ValueSourceField.test.tsx#emits fixed uid when a catalog room is selected
        status: pass
      - kind: unit
        ref: packages/frontend/src/features/dialplan-apps/model/schemas/confBridge.test.tsx
        status: pass
    human_judgment: false
  - id: D3
    description: Empty catalog shows «Ничего не создано», disables the control, and links to /conferences in a new tab
    requirement: D-08
    verification:
      - kind: unit
        ref: packages/frontend/src/features/dialplan-apps/ui/ValueSourceField/ValueSourceField.test.tsx#shows empty catalog placeholder
        status: pass
    human_judgment: false
  - id: D4
    description: Eight UI-state cases cover empty, loading, refused, 3/1/60 rooms, nameless, and 255-char labels
    requirement: D-08
    verification:
      - kind: unit
        ref: packages/frontend/src/features/dialplan-apps/ui/ValueSourceField/ValueSourceField.test.tsx#ValueSourceField conference room UI states
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-09-16
status: complete
---

# Phase 16 Plan 04: Room catalog selector Summary

**Route-step ConfBridge room field is a tenant catalog selector that stores the room uid as a decimal string and keeps dynamic sources for the mask.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-09-16T01:47:46Z
- **Completed:** 2026-09-16T02:08:00Z
- **Tasks:** 3
- **Files modified:** 15

## Accomplishments

- `conferenceRoomApi` injects `GET /conferences` with tag `ConferenceRooms`; catalog labels are `number - name` or the number alone.
- `conferenceRooms` is registered in `OptionsSource`, `useSchemaRefs`, and `CATALOG_DEFAULTS`. SchemaFields and StepSheet do not call `useGetConferenceRoomsQuery`.
- `ValueSourceField` queue mode reads `SchemaCatalogRef`. Queues fetch only when `optionsSource === 'queues'`. Room uid is not passed through `stripTenantQueueName` or `Number()`.
- `confBridge` schema uses `optionsSource: 'conferenceRooms'` and `valueSourceMode: 'queue'`. `summarizeConfBridge` resolves the selected uid against `refs.conferenceRooms`.
- Empty catalog: placeholder «Ничего не создано», disabled control, no static optgroup, link to `/conferences` with `target="_blank"`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Каталог комнат (RTK + тройка регистрации)** - `082c59d` (test RED), `9300ee9` (feat GREEN)
2. **Task 2: Селектор комнаты, схема, i18n** - `a11642f` (test RED), `0c0ddf1` (feat GREEN)
3. **Task 3: UI-state тесты селектора** - `7d8de5c` (test RED), `105e19b` (feat GREEN)

**Plan metadata:** pending `docs(16-04): complete room catalog selector plan`

_Note: TDD tasks have RED then GREEN commits._

## Files Created/Modified

- `packages/frontend/src/shared/api/endpoints/conferenceRoomApi.ts` - `getConferenceRooms` + `useGetConferenceRoomsQuery`
- `packages/frontend/src/shared/api/rtkApi.ts` - tag `ConferenceRooms`
- `packages/frontend/src/features/dialplan-apps/model/schema.types.ts` - `OptionsSource` += `conferenceRooms`
- `packages/frontend/src/features/dialplan-apps/model/useSchemaRefs.ts` - catalog items as string uid
- `packages/frontend/src/features/dialplan-apps/model/useSchemaRefs.test.tsx` - mapping, skip queues, CATALOG_DEFAULTS scan
- `packages/frontend/src/features/dialplan-apps/model/schemas/confBridge.tsx` - catalog field + `summarizeConfBridge`
- `packages/frontend/src/features/dialplan-apps/model/registry.ts` - wired `summarize`
- `packages/frontend/src/features/dialplan-apps/ui/SchemaFields/SchemaFields.tsx` - `CATALOG_DEFAULTS.conferenceRooms` + catalog prop
- `packages/frontend/src/features/dialplan-apps/ui/ValueSourceField/ValueSourceField.tsx` - catalog-agnostic queue mode
- `packages/frontend/src/features/dialplan-apps/ui/ValueSourceField/ValueSourceField.test.tsx` - selector + eight UI-state cases
- `packages/frontend/src/shared/config/locales/ru.ts` / `en.ts` - room hint, `conferencesSection`, `orphanRoom`, `selectRoom`
- `StepSheet.test.tsx`, `DialplanAppsEditor.test.tsx`, `playback.test.tsx` - `conferenceRoomApi` mocks (Rule 3)

## Decisions Made

- Catalog reaches the field only through `OptionsSource` → `useSchemaRefs` → `CATALOG_DEFAULTS`.
- Queue-mode ValueSourceField is catalog-agnostic; queues skip unless `optionsSource === 'queues'`.
- Empty catalog hides the static optgroup and opens `/conferences` in a new tab.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Existing dialplan-apps suites loaded the new RTK hook unmocked**
- **Found during:** Task 2 GREEN
- **Issue:** `useGetConferenceRoomsQuery` pulled `react-redux` context into StepSheet, DialplanAppsEditor, and playback tests
- **Fix:** `vi.mock` `conferenceRoomApi` in those three files
- **Files modified:** `StepSheet.test.tsx`, `DialplanAppsEditor.test.tsx`, `playback.test.tsx`
- **Verification:** `npm run test -w @krasterisk/frontend -- src/features/dialplan-apps` — 309 passed
- **Committed in:** `0c0ddf1` (Task 2 GREEN)

**2. [Rule 3 - Blocking] Dirty-tree locales and registry would have staged unrelated WIP**
- **Found during:** Task 2 GREEN
- **Issue:** `ru.ts` / `en.ts` / `registry.ts` carried directories and totrunk WIP plus the 16-04 keys
- **Fix:** Isolated HEAD + 16-04 hunks for the commit, then restored the WIP copies
- **Files modified:** staged slices of `ru.ts`, `en.ts`, `registry.ts` only
- **Verification:** cached diff was 7/7/3 lines
- **Committed in:** `0c0ddf1` (Task 2 GREEN)

**3. [Rule 2 - Missing Critical] Empty catalog still rendered an empty static optgroup**
- **Found during:** Task 3 RED
- **Issue:** UI-SPEC / plan require no static group when the catalog is empty
- **Fix:** Render the static `optgroup` only when there are catalog items or an orphan value
- **Files modified:** `ValueSourceField.tsx`
- **Verification:** ValueSourceField 13 passed; dialplan-apps 309 passed
- **Committed in:** `105e19b` (Task 3 GREEN)

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 missing critical)
**Impact on plan:** Required to keep sibling suites green and to match the empty-catalog contract. No scope creep.

## Issues Encountered

- `npm run test:frontend` still fails `directories.locales.test.ts` (expects `fieldLabel: 'Название поля'` and `csv.*` keys; committed locales already have `Подпись` and no csv). Pre-existing on this branch, not caused by 16-04. Dialplan-apps suite is green (309). Full-suite line is an unrun-verify for this plan.
- Workspace lint was not used as a ship gate here: 16-03 already recorded pre-existing `preserve-caught-error` failures outside this plan's files.
- Browser tools were available, but no app tab was open and the route-step editor was not exercised in a live browser. UI-state tests are the verification for Surface C.

## TDD Gate Compliance

- Task 1 RED `082c59d` then GREEN `9300ee9`
- Task 2 RED `a11642f` then GREEN `0c0ddf1`
- Task 3 RED `7d8de5c` then GREEN `105e19b`

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Wave 4 sibling `16-05` can add moderators and ConfBridge roles. Do not start it from this summary.
- Do not add a second field for the bridge profile. Do not call `useGetConferenceRoomsQuery` inside SchemaFields or StepSheet.

---
*Phase: 16-modul-telekonferentsiy-confbridge-webrtc*
*Completed: 2026-09-16*

## Self-Check: PASSED
