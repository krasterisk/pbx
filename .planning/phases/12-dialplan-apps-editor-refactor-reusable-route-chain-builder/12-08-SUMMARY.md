---
phase: 12-dialplan-apps-editor-refactor-reusable-route-chain-builder
plan: 08
subsystem: ui
tags: [schema-fields, options-sync, condition-editor, step-errors, host-wiring, sheet]

requires:
  - phase: 12-06
    provides: ConditionSource + QUEUESTATUS_VALUES / DIALSTATUS_VALUES
  - phase: 12-07
    provides: editorReducer, filled registry, DialplanAppsEditor host/allowedTypes props
provides:
  - SchemaFields exhaustive kind renderer + RefSelect loading/empty catalogs
  - optionsSync frontend port with shared OPTIONS_ROUNDTRIP_STRINGS fixture
  - OptionsEditor single-source checkboxes + expert string
  - ConditionEditor presets / expert mode
  - mapStepErrors 400 projection with orphans
  - Host wiring for route / phonebook / ivr
affects:
  - 12-10 unified Playback
  - 12-17 M8 overlay nesting runtime check

tech-stack:
  added: []
  patterns:
    - "SchemaFields switch(kind) + assertNever; custom is the only escape hatch"
    - "optionsSync is a port of backend parseOptions/serializeOptions plus isOptionsParseError"
    - "allowedTypesForHost reads DIALPLAN_ACTION_META.allowedIn; hosts do not duplicate the table"

key-files:
  created:
    - packages/frontend/src/features/dialplan-apps/ui/SchemaFields/SchemaFields.tsx
    - packages/frontend/src/features/dialplan-apps/ui/OptionsEditor/OptionsEditor.tsx
    - packages/frontend/src/features/dialplan-apps/ui/ConditionEditor/ConditionEditor.tsx
    - packages/frontend/src/features/dialplan-apps/model/optionsSync.ts
    - packages/frontend/src/features/dialplan-apps/model/stepErrors.ts
    - packages/shared/src/fixtures/dialplan-options.roundtrip.ts
  modified:
    - packages/frontend/src/features/dialplan-apps/ui/StepSheet/StepSheet.tsx
    - packages/frontend/src/shared/ui/Sheet/Sheet.tsx
    - packages/frontend/src/app/styles/globals.css
    - packages/frontend/src/features/routes/ui/RouteFormModal/RouteActionsTab.tsx
    - packages/frontend/src/features/routes/ui/RouteFormModal/RoutePhonebooksTab.tsx
    - packages/frontend/src/features/ivrs/ui/IvrMenuItemsEditor/IvrMenuItemsEditor.tsx

key-decisions:
  - "t(key, fallback) instead of staging dirty locale files"
  - "--z-index-modal-nested: 55 declared, not applied (M8 / 12-17)"
  - "phonebook and ivr allowedTypes currently match DIALPLAN_ACTION_META; route differs via cmd/trunk_carousel"

patterns-established:
  - "Shared OPTIONS_ROUNDTRIP_STRINGS imported by backend and frontend specs"
  - "RefSelect three states: loading / empty+link / ready"

requirements-completed: [D-02, D-05, D-07, D-11, D-14, D-15, D-23, D-27]

coverage:
  - id: D1
    description: Every FieldKind renders an accessible control; unknown kind throws
    requirement: D-07
    verification:
      - kind: unit
        ref: packages/frontend/src/features/dialplan-apps/ui/SchemaFields/SchemaFields.test.tsx#renders an accessible control for kind
        status: pass
    human_judgment: false
  - id: D2
    description: Catalog Select distinguishes loading vs empty for queues/trunks/ivrs/prompts
    requirement: D-07
    verification:
      - kind: unit
        ref: packages/frontend/src/features/dialplan-apps/ui/SchemaFields/SchemaFields.test.tsx#distinguishes loading vs empty for catalog
        status: pass
    human_judgment: false
  - id: D3
    description: Options round-trip preserves U()/M()/L() via shared fixture
    requirement: D-27
    verification:
      - kind: unit
        ref: packages/frontend/src/features/dialplan-apps/model/optionsSync.spec.ts#round-trips
        status: pass
    human_judgment: false
  - id: D4
    description: Queue-full preset maps to queuestatus FULL; expert round-trip keeps preset
    requirement: D-23
    verification:
      - kind: unit
        ref: packages/frontend/src/features/dialplan-apps/ui/ConditionEditor/ConditionEditor.test.tsx#maps the queue-full preset
        status: pass
    human_judgment: false
  - id: D5
    description: 400 errors map to the matching step field; unknown actionId goes to orphans
    requirement: D-11
    verification:
      - kind: unit
        ref: packages/frontend/src/features/dialplan-apps/model/stepErrors.spec.ts#highlights only the matching step
        status: pass
    human_judgment: false
  - id: D6
    description: Three hosts pass host and allowedTypes derived from DIALPLAN_ACTION_META
    requirement: D-14
    verification:
      - kind: unit
        ref: packages/frontend/src/features/ivrs/ui/IvrMenuItemsEditor/IvrMenuItemsEditor.test.tsx#passes host=ivr
        status: pass
    human_judgment: false
  - id: D7
    description: Mobile Sheet 85dvh and overlay nesting need visual confirmation
    verification: []
    human_judgment: true
    rationale: Overlay stacking (M8) is a runtime visual check deferred to plan 12-17

duration: 55min
completed: 2026-08-19
status: complete
---

# Phase 12 Plan 08: Sheet schema fields, options, conditions, host wiring Summary

**Schema-driven StepSheet with exhaustive SchemaFields, bidirectional optionsSync, ConditionSource presets, and 400→step/orphan projection wired into route / phonebook / IVR hosts.**

## Performance

- **Duration:** 55 min
- **Started:** 2026-08-19T09:00:56Z
- **Completed:** 2026-08-19T09:30:00Z
- **Tasks:** 3
- **Files modified:** 28

## Accomplishments

- All `FieldKind` values render through `SchemaFields` with `assertNever`; catalogs distinguish loading vs empty
- Options are one string: checkboxes derive from `parseOptions`; `U()`/`M()`/`L()` survive checkbox edits
- Condition presets (no-answer / busy / queue-full) and expert mode keep the matching `ConditionSource`
- `mapStepErrors` highlights the named step/field and keeps unmapped 400 errors in the host summary
- `RouteActionsTab`, `RoutePhonebooksTab`, and `IvrMenuItemsEditor` pass `host`, `labels`, and `allowedTypesForHost`

## Task Commits

Each task was committed atomically (TDD RED then GREEN):

1. **Task 1 RED:** `dea798b` test(12-08): add failing test for SchemaFields and StepSheet
2. **Task 1 GREEN:** `ade17e7` feat(12-08): implement SchemaFields and mobile StepSheet
3. **Task 2 RED:** `c8be83a` test(12-08): add failing test for optionsSync and OptionsEditor
4. **Task 2 GREEN:** `3cc26b3` feat(12-08): implement optionsSync and OptionsEditor
5. **Task 3 RED:** `6fac1e7` test(12-08): add failing test for conditions, stepErrors, and host wiring
6. **Task 3 GREEN:** `8c0539b` feat(12-08): implement ConditionEditor, stepErrors, and host wiring

**Plan metadata:** pending docs commit

## Files Created/Modified

- `packages/frontend/src/features/dialplan-apps/ui/SchemaFields/SchemaFields.tsx` - exhaustive schema renderer + RefSelect
- `packages/frontend/src/features/dialplan-apps/ui/OptionsEditor/OptionsEditor.tsx` - single-value options UI
- `packages/frontend/src/features/dialplan-apps/ui/ConditionEditor/ConditionEditor.tsx` - presets + expert
- `packages/frontend/src/features/dialplan-apps/model/optionsSync.ts` - frontend parse/serialize port
- `packages/frontend/src/features/dialplan-apps/model/stepErrors.ts` - 400 projection
- `packages/shared/src/fixtures/dialplan-options.roundtrip.ts` - shared D-27 fixture
- `packages/frontend/src/shared/ui/Sheet/Sheet.tsx` - `side` right|bottom
- `packages/frontend/src/app/styles/globals.css` - `--z-index-modal-nested` token (unused until M8)
- Host tabs / IVR editor - `host` + `allowedTypesForHost`

## Decisions Made

- Copy uses `t(key, fallback)` so dirty `ru.ts`/`en.ts` were not staged
- Nested-modal z-index token is declared only; apply only after 12-17 M8
- `phonebook` and `ivr` allowed sets are equal in current `DIALPLAN_ACTION_META`; tests assert route-only `cmd` / `trunk_carousel` exclusions instead of three pairwise inequalities

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Catalog empty copy vs tracer test**
- **Found during:** Task 1
- **Issue:** Tracer expected empty queues Select enabled with "Нет очередей"
- **Fix:** Unified empty state is disabled + "Ничего не создано" per UI-SPEC
- **Files modified:** ValueSourceField.tsx, StepSheet.test.tsx
- **Committed in:** `ade17e7`

**2. [Rule 2 - Missing Critical] RouteFormModal 400 mapping**
- **Found during:** Task 3
- **Issue:** Plan listed host tabs but save 400 lives on the modal
- **Fix:** `RouteFormModal` catch calls `mapStepErrors` and passes `stepErrors` into `RouteActionsTab`
- **Files modified:** RouteFormModal.tsx
- **Committed in:** `8c0539b`

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical)
**Impact on plan:** Required for D-07 catalog honesty and D-11 save projection. No scope creep.

## Issues Encountered

- `DIALPLAN_ACTION_META` does not distinguish phonebook vs ivr (only route-only `cmd` / `trunk_carousel`). Tests assert that real difference.
- Locale files left unstaged (WIP). Strings rely on i18n fallbacks.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Expansion Sheet branch is complete. Next sequential plan: **12-10** (unified Playback / digit-exit) after remaining wave-5/6 work, or continue 12-10+ as roadmap indicates.
- Manual M8 overlay nesting remains for 12-17.
- Surface L voicemail transcription backstop stays in Phase 12b.

## Self-Check: PASSED

- SchemaFields.tsx, OptionsEditor.tsx, ConditionEditor.tsx, optionsSync.ts, stepErrors.ts exist
- Commits dea798b, ade17e7, c8be83a, 3cc26b3, 6fac1e7, 8c0539b exist on main

---
*Phase: 12-dialplan-apps-editor-refactor-reusable-route-chain-builder*
*Completed: 2026-08-19*
