---
phase: 14-visual-route-builder-and-automation
plan: 06
subsystem: ui
tags: [dry-run, flowchart, highlight, reask, ivr, d-29, d-30, d-31, d-38, d-43, d-47]

requires:
  - phase: 14-visual-route-builder-and-automation
    provides: FlowchartCanvas Schema tabs (14-03), POST /dialplan/dry-run + postDryRun (14-04), callback ActionType (14-08)
provides:
  - Collapsed DryRunForm on route and IVR Schema tabs posting draft actions
  - Five-channel FlowchartCanvas highlight including Success for callback_requested
  - Multi-segment Card stack, hop-limit copy, and D-47 reask loop
affects:
  - 14-09 (callback UI reuses outcome.callback copy)
  - 14-10 (Usage tab stays last; Schema already hosts dry-run)

actuals:
  tokens: 18751
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - DryRunForm owns postDryRun; parent tabs pass highlight props into FlowchartCanvas
    - Condition sources collected from draft chain; ConditionEditor locale keys reused for presets
    - Five-channel highlight: order chip, edge weight, node border, not-taken badge, color

key-files:
  created:
    - packages/frontend/src/features/dialplan-apps/ui/DryRunForm/DryRunForm.tsx
    - packages/frontend/src/features/dialplan-apps/ui/DryRunForm/DryRunForm.module.scss
    - packages/frontend/src/features/dialplan-apps/ui/DryRunForm/DryRunForm.test.tsx
    - packages/frontend/src/features/dialplan-apps/ui/DryRunForm/collectConditionSources.ts
    - packages/frontend/src/features/dialplan-apps/ui/DryRunForm/index.ts
  modified:
    - packages/frontend/src/features/dialplan-apps/ui/FlowchartCanvas/FlowchartCanvas.tsx
    - packages/frontend/src/features/dialplan-apps/ui/FlowchartCanvas/FlowchartCanvas.module.scss
    - packages/frontend/src/features/dialplan-apps/ui/FlowchartCanvas/FlowchartCanvas.test.tsx
    - packages/frontend/src/features/routes/ui/RouteFormModal/RouteFlowchartTab.tsx
    - packages/frontend/src/features/ivrs/ui/IvrFormModal/IvrFlowchartTab.tsx
    - packages/frontend/src/shared/config/locales/en.ts
    - packages/frontend/src/shared/config/locales/ru.ts

key-decisions:
  - "Dry-run runs against local draft actions / menu_items, never last-saved route"
  - "callback_requested paints terminal node Success and uses routes.dryRun.outcome.callback"
  - "Foreign walk segments render as sticky-header Cards with order chips from WalkSegment.nodes (API does not return foreign action lists)"
  - "Stable EMPTY_ACTIONS / EMPTY_MENU defaults so result reset does not fire every render"

patterns-established:
  - "Pattern: Schema tab = banners + DryRunForm + FlowchartCanvas(highlight)"
  - "Pattern: routes.dryRun.* copy in ru/en; ConditionEditor keys for dial/queue/record presets"

requirements-completed: [D-29, D-30, D-31, D-43, D-44, D-45, D-47, D-38]

coverage:
  - id: D1
    description: Route Schema dry-run posts draft actions and announces callback_requested first
    requirement: D-31
    verification:
      - kind: unit
        ref: packages/frontend/src/features/dialplan-apps/ui/DryRunForm/DryRunForm.test.tsx#posts draft actions and announces callback outcome first
        status: pass
    human_judgment: false
  - id: D2
    description: FlowchartCanvas five-channel highlight and Success on callback_requested
    requirement: D-38
    verification:
      - kind: unit
        ref: packages/frontend/src/features/dialplan-apps/ui/FlowchartCanvas/FlowchartCanvas.test.tsx#applies five-channel highlight and Success on callback_requested
        status: pass
    human_judgment: false
  - id: D3
    description: IVR dry-run Select includes menu digits plus always-present t/i and pass input
    requirement: D-43
    verification:
      - kind: unit
        ref: packages/frontend/src/features/dialplan-apps/ui/DryRunForm/DryRunForm.test.tsx#renders IVR digit options plus always-present timeout and invalid
        status: pass
    human_judgment: false
  - id: D4
    description: Multi-segment result is a vertical Card stack with breadcrumbs and hop-limit copy
    requirement: D-44
    verification:
      - kind: unit
        ref: packages/frontend/src/features/dialplan-apps/ui/DryRunForm/DryRunForm.test.tsx#renders stacked segment cards and hop-limit copy, never tabs
        status: pass
    human_judgment: false
  - id: D5
    description: Reask QUEUESTATUS appends one control, disables Run until filled, second run completes
    requirement: D-47
    verification:
      - kind: unit
        ref: packages/frontend/src/features/dialplan-apps/ui/DryRunForm/DryRunForm.test.tsx#appends a reask QUEUESTATUS control
        status: pass
    human_judgment: false

duration: 23min
completed: 2026-09-04
status: complete
---

# Phase 14 Plan 06: Dry-run form and canvas highlight Summary

**Collapsed DryRunForm on Schema tabs posts draft chains via postDryRun; FlowchartCanvas highlights the walked path with five channels and Success for callback_requested**

## Performance

- **Duration:** 23 min
- **Started:** 2026-09-03T19:42:26Z
- **Completed:** 2026-09-03T20:05:00Z
- **Tasks:** 3
- **Files modified:** 15

## Accomplishments

- Route Schema tab hosts a collapsed DryRunForm that POSTs unsaved draft actions and highlights the same canvas (D-29, D-31)
- Scenario Selects reuse ConditionEditor human labels (`routes.chain.conditions.dial.*`) (D-30)
- `callback_requested` paints the terminal callback node Success and announces `routes.dryRun.outcome.callback` in an aria-live region (D-38)
- IVR variant derives Select options from `menu_items` plus always-present timeout/invalid, with pass index when `max_count > 0` (D-43)
- Cross-entity results are a vertical Card stack with sticky headers and breadcrumb nav, not Tabs (F2.4); hop exhaustion shows `hopLimit` from the API (D-45)
- Reask appends one control marked «спросили после прогона», disables Run until filled, and merges the value on the second run (D-47)

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end route dry-run highlight** - `fae1848` (feat)
2. **Task 2: IVR dry-run inputs + multi-segment display** - `2b3e5ab` (feat)
3. **Task 3: Reask loop** - `72f7113` (feat)

## Files Created/Modified

- `packages/frontend/src/features/dialplan-apps/ui/DryRunForm/DryRunForm.tsx` - Collapsed form, scenario/IVR/reask, outcome live region, segment stack
- `packages/frontend/src/features/dialplan-apps/ui/DryRunForm/collectConditionSources.ts` - One control per source the draft actually reads
- `packages/frontend/src/features/dialplan-apps/ui/FlowchartCanvas/FlowchartCanvas.tsx` - highlight props, order chips, Success channel
- `packages/frontend/src/features/routes/ui/RouteFormModal/RouteFlowchartTab.tsx` - Wires DryRunForm + highlight
- `packages/frontend/src/features/ivrs/ui/IvrFormModal/IvrFlowchartTab.tsx` - Same wiring for IVR host
- `packages/frontend/src/shared/config/locales/en.ts` / `ru.ts` - `routes.dryRun.*` keys only

## Decisions Made

- Draft-only POST: `actions` / `menu_items` come from parent modal state, never a saved uid fetch
- Foreign segments show walk order chips from `WalkSegment.nodes` because the dry-run API does not return full remote action lists
- IVR last pass (`pass >= maxCount`) sends `ivrChoice: 'max'` so the exhausted-retries branch is reachable

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Result vanished immediately after a successful run**
- **Found during:** Task 1
- **Issue:** Default `menuItems = []` created a new array every render and retriggered the draft-reset effect
- **Fix:** Module-level `EMPTY_ACTIONS` / `EMPTY_MENU` constants
- **Files modified:** `DryRunForm.tsx`
- **Verification:** DryRunForm callback outcome test passes
- **Committed in:** `fae1848`

**2. [Rule 1 - Bug] Nested button (InfoTooltip inside collapse toggle)**
- **Found during:** Task 1
- **Issue:** Tooltip trigger is a `<button>` inside the toggle `<button>`
- **Fix:** Toggle row with sibling tooltip
- **Files modified:** `DryRunForm.tsx`, `DryRunForm.module.scss`
- **Verification:** Collapsed-by-default test no longer warns on nested buttons
- **Committed in:** `fae1848`

---

**Total deviations:** 2 auto-fixed (2 Rule 1)
**Impact on plan:** Required for correctness. No scope creep. UsageTab / FormModal tab lists left to 14-10.

## Issues Encountered

- PowerShell cannot run bash heredoc commits; used `git commit -m` title + body flags
- IvrFormModal tests needed a `usePostDryRunMutation` mock after Schema tab started rendering DryRunForm

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 14-09 can reuse `routes.dryRun.outcome.callback` and Success highlight
- 14-07 templates FE is unblocked independently
- Do not start 14-07 from this wave; Usage tab remains 14-10

---
*Phase: 14-visual-route-builder-and-automation*
*Completed: 2026-09-04*

## Self-Check: PASSED
