---
phase: 12-dialplan-apps-editor-refactor-reusable-route-chain-builder
plan: 07
subsystem: ui
tags: [dialplan-editor, reducer, clipboard, dnd, unknown-type, params-onchange]

requires:
  - phase: 12-02
    provides: StepSheet + { params, onChange } tracer for toqueue / QueueApp
  - phase: 12-03
    provides: DIALPLAN_ACTION_META + 30 ActionTypes including congestion
provides:
  - editorReducer with undo-remove stack and makeId
  - In-memory step clipboard with structuredClone
  - StepRow summarize / condition badge / density / readOnly
  - Local vertical-axis DnD modifier without @dnd-kit/modifiers
  - UnknownActionCard round-trip for unknown types
  - All 13 app components on { params, onChange }
affects:
  - 12-08 host embedding (Route / phonebook / IVR props wiring)
  - 12-09 conditions editor opened from the condition badge

tech-stack:
  added: []
  patterns:
    - "Undo-remove stack of { action, index } capped at 20, not full-state snapshots"
    - "Module-singleton clipboard, not navigator.clipboard"
    - "restrictToVerticalAxisLocal = ({ transform }) => ({ ...transform, x: 0 })"

key-files:
  created:
    - packages/frontend/src/features/dialplan-apps/model/editorReducer.ts
    - packages/frontend/src/features/dialplan-apps/model/editorReducer.spec.ts
    - packages/frontend/src/features/dialplan-apps/model/clipboard.ts
    - packages/frontend/src/features/dialplan-apps/model/clipboard.spec.ts
    - packages/frontend/src/features/dialplan-apps/ui/StepRow/StepRow.tsx
    - packages/frontend/src/features/dialplan-apps/ui/UnknownActionCard/UnknownActionCard.tsx
  modified:
    - packages/frontend/src/features/dialplan-apps/ui/DialplanAppsEditor/DialplanAppsEditor.tsx
    - packages/frontend/src/features/dialplan-apps/model/registry.ts
    - packages/frontend/src/features/dialplan-apps/model/types.ts
    - packages/frontend/src/shared/config/locales/ru.ts
    - packages/frontend/src/shared/config/locales/en.ts

key-decisions:
  - "Undo is a removed-step stack, not full editor snapshots"
  - "Vertical DnD lock is a local modifier; @dnd-kit/modifiers stays uninstalled"
  - "readOnly is a UI hint only; server validation remains the access barrier (T-12-07-04)"
  - "IDialplanAppProps may carry optional actionType for GenericApp/CallerIdApp shells, never step id"

patterns-established:
  - "Feature-local dnd-kit modifier instead of a new npm package"
  - "Registry wrap fills schema/summarize/terminal/allowedIn/optionFlags from DIALPLAN_ACTION_META"

requirements-completed: [D-02, D-04, D-05, D-06, D-12, D-13, D-14, D-15]

coverage:
  - id: D1
    description: Undo-remove restores a step at its saved index from a 20-item stack
    requirement: D-13
    verification:
      - kind: unit
        ref: packages/frontend/src/features/dialplan-apps/model/editorReducer.spec.ts#restores a step removed from index 1
        status: pass
    human_judgment: false
  - id: D2
    description: Step row summarize is one sentence; no key=value leftovers
    requirement: D-04
    verification:
      - kind: unit
        ref: packages/frontend/src/features/dialplan-apps/ui/StepRow/StepRow.test.tsx#renders a toqueue route_pattern summary
        status: pass
    human_judgment: false
  - id: D3
    description: readOnly/maxSteps/density and allowedTypes are observable
    requirement: D-14
    verification:
      - kind: unit
        ref: packages/frontend/src/features/dialplan-apps/ui/DialplanAppsEditor/DialplanAppsEditor.test.tsx#disables add at maxSteps
        status: pass
    human_judgment: false
  - id: D4
    description: Unknown type keeps raw params; hangup fallback is gone
    requirement: D-12
    verification:
      - kind: unit
        ref: packages/frontend/src/features/dialplan-apps/ui/DialplanAppsEditor/DialplanAppsEditor.test.tsx#round-trips an unknown action type
        status: pass
    human_judgment: false
  - id: D5
    description: All remaining apps use { params, onChange }; onUpdate is gone
    requirement: D-06
    verification:
      - kind: unit
        ref: packages/frontend/src/features/dialplan-apps/ui/apps/GroupApp/GroupApp.test.tsx#patches only the changed field
        status: pass
    human_judgment: false

duration: 46min
completed: 2026-08-19
status: complete
---

# Phase 12 Plan 07: FE editor core Summary

**Single reducer owns the chain, StepRow is scannable, unknown types stay honest, and every app speaks `{ params, onChange }`.**

## Performance

- **Duration:** 46 min
- **Started:** 2026-08-19T07:31:00Z
- **Completed:** 2026-08-19T08:17:00Z
- **Tasks:** 4/4
- **Files modified:** 40

## Accomplishments

- Chain state lives in `editorReducer` with undo-remove (original index, stack of 20) and a session clipboard that deep-clones params.
- `StepRow` shows `registry.summarize`, condition / terminal badges, density 44/56px, and `readOnly` by omitting controls rather than disabling them.
- DnD W10: `DragOverlay`, local `restrictToVerticalAxisLocal`, ru/en announcements, `crypto.randomUUID` ids. `@dnd-kit/modifiers` was not installed.
- Unknown types render `UnknownActionCard` and round-trip raw params. All 30 registry entries have required `schema` / `summarize` / `terminal` / `allowedIn` / `optionFlags`.
- All 13 app components (including QueueApp) use `{ params, onChange }`. `grep onUpdate` under `features/dialplan-apps` is empty.

## Task Commits

1. **Task 1 RED: editorReducer / clipboard tests** - `bc7bc44` (test)
2. **Task 1 GREEN: editorReducer history stack and clipboard** - `7bb99c4` (feat)
3. **Task 2 RED: StepRow and editor reuse-prop tests** - `0ff53bc` (test)
4. **Task 2 GREEN: StepRow, reuse props, local DnD lock** - `fc476b5` (feat)
5. **Task 3 RED: UnknownActionCard and registry invariant tests** - `fd53985` (test)
6. **Task 3 GREEN: UnknownActionCard and required registry fields** - `6296923` (feat)
7. **Task 4: migrate remaining apps to params/onChange** - `2cd09a5` (feat)

## Files Created/Modified

- `packages/frontend/src/features/dialplan-apps/model/editorReducer.ts` - chain owner with undo stack
- `packages/frontend/src/features/dialplan-apps/model/clipboard.ts` - module-singleton copy/paste
- `packages/frontend/src/features/dialplan-apps/ui/StepRow/StepRow.tsx` - scannable row
- `packages/frontend/src/features/dialplan-apps/ui/UnknownActionCard/UnknownActionCard.tsx` - honest unknown type
- `packages/frontend/src/features/dialplan-apps/ui/DialplanAppsEditor/DialplanAppsEditor.tsx` - orchestrator + DnD W10
- `packages/frontend/src/features/dialplan-apps/model/registry.ts` - required fields wrap from DIALPLAN_ACTION_META
- `packages/frontend/src/features/dialplan-apps/model/types.ts` - `{ params, onChange }` contract
- 13 app components under `ui/apps/` - no `onUpdate`, no step `id`
- `packages/frontend/src/shared/config/locales/ru.ts` / `en.ts` - chain.row / empty / dnd / unknown keys

## Decisions Made

- Undo-remove uses a stacked `{ action, index }` rather than snapshots of the whole editor.
- Vertical lock is a local modifier; installing `@dnd-kit/modifiers` is forbidden and the grep stays empty.
- `readOnly` / `allowedTypes` / `maxSteps` are UI hints. Server validation from 12-03 is the real barrier (T-12-07-04, T-12-07-05).
- Optional `actionType` on app props lets GenericApp and CallerIdApp pick a shell without knowing the step id.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Critical] ActionTypeSelect gained `allowedTypes`**
- **Found during:** Task 2
- **Issue:** The select reads `ACTION_TYPES_LIST` internally, so D-15 could not be observed without a filter prop.
- **Fix:** Added `allowedTypes` and filter against `DIALPLAN_ACTION_META.allowedIn` in the editor.
- **Files modified:** `ActionTypeSelect.tsx`, `DialplanAppsEditor.tsx`
- **Committed in:** `fc476b5`

**2. [Rule 2 - Critical] QueueApp and SortableActionItem also left `onUpdate`**
- **Found during:** Task 4
- **Issue:** Plan listed 12 apps; QueueApp (tracer leftover) and SortableActionItem still used `onUpdate`, which would fail the feature-wide grep.
- **Fix:** Migrated both to `{ params, onChange }`.
- **Files modified:** `QueueApp.tsx`, `SortableActionItem.tsx`
- **Committed in:** `2cd09a5`

**3. [Rule 2 - Critical] Registry summarize filled in Task 2**
- **Found during:** Task 2
- **Issue:** The 30-type `summarize` test is in Task 2 but Task 3 was scheduled to fill the registry.
- **Fix:** Wrapped registry entries with default `summarize` / `terminal` / `allowedIn` from `DIALPLAN_ACTION_META`; Task 3 made the fields required and added `schema` / `optionFlags`.
- **Files modified:** `registry.ts`
- **Committed in:** `fc476b5`, `6296923`

## Issues Encountered

- Frontend `tsc --noEmit` still reports pre-existing errors in callcenter / users / ProfilePage / ValueSourceField (`href` on `Text`). Out of 12-07 scope; not fixed.
- Mechanical `onUpdate` rewrite briefly produced broken `Number(e.target.value })` parens in IvrApp / VoiceRobotApp; corrected before the Task 4 commit.

## Threat Flags

None beyond the plan register. Params render as React text nodes (T-12-07-01). No `dangerouslySetInnerHTML`. No new npm packages (T-12-07-SC).

## Known Stubs

None that block the plan goal. Host wiring of `host` / `allowedTypes` / `labels` into Route / phonebook / IVR consumers remains 12-08.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

12-08 can embed the editor in Route / phonebook / IVR hosts and expand the conditions section. Do not start 12-08 from this close-out if 12-05 / 12-06 are still in flight. Next plan hint: **12-08** after wave-3 siblings finish.

## Self-Check: PASSED

- FOUND: editorReducer.ts, clipboard.ts, StepRow.tsx, UnknownActionCard.tsx, DialplanAppsEditor.tsx, 12-07-SUMMARY.md
- FOUND: bc7bc44, 7bb99c4, 0ff53bc, fc476b5, fd53985, 6296923, 2cd09a5
- `@dnd-kit/modifiers` grep empty; `onUpdate` grep under features/dialplan-apps empty

---
*Phase: 12-dialplan-apps-editor-refactor-reusable-route-chain-builder*
*Completed: 2026-08-19*
