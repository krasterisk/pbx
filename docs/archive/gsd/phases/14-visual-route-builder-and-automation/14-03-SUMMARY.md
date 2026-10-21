---
phase: 14-visual-route-builder-and-automation
plan: 03
subsystem: ui
tags: [flowchart, css-grid, react-to-print, d-01, d-02, d-03, d-04, d-05, d-52]

requires:
  - phase: 14-visual-route-builder-and-automation
    provides: routes.show_flowchart tenant flag and Phase 12 registry summarize()
provides:
  - Read-only CSS-grid FlowchartCanvas with condition branch lane
  - RouteFormModal Schema tab last, gated by routes.show_flowchart
  - react-to-print subtree print on the canvas figure
  - IvrFormModal Schema tab with digit / t / i / max branches
affects:
  - 14-04 (dry-run highlight on the same canvas)
  - 14-06+ (print and host tabs already present)

actuals:
  tokens: 16032
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - CSS-grid flowchart (minmax(240px, 360px) 32px 1fr), no graph libraries
    - useReactToPrint({ contentRef }) on a figure, print rules in SCSS module
    - Schema tab last, hidden while tenant settings load

key-files:
  created:
    - packages/frontend/src/features/dialplan-apps/ui/FlowchartCanvas/FlowchartCanvas.tsx
    - packages/frontend/src/features/dialplan-apps/ui/FlowchartCanvas/FlowchartCanvas.module.scss
    - packages/frontend/src/features/dialplan-apps/ui/FlowchartCanvas/FlowchartCanvas.test.tsx
    - packages/frontend/src/features/dialplan-apps/ui/FlowchartCanvas/FlowchartPrint.test.tsx
    - packages/frontend/src/features/dialplan-apps/ui/FlowchartCanvas/index.ts
    - packages/frontend/src/features/routes/ui/RouteFormModal/RouteFlowchartTab.tsx
    - packages/frontend/src/features/routes/ui/RouteFormModal/RouteFlowchartTab.module.scss
    - packages/frontend/src/features/ivrs/ui/IvrFormModal/IvrFlowchartTab.tsx
    - packages/frontend/src/features/ivrs/ui/IvrFormModal/IvrFlowchartTab.module.scss
    - packages/frontend/src/features/ivrs/ui/IvrFormModal/IvrFlowchartTab.test.tsx
    - packages/frontend/src/features/ivrs/ui/IvrFormModal/IvrFormModal.test.tsx
  modified:
    - packages/frontend/src/features/routes/ui/RouteFormModal/RouteFormModal.tsx
    - packages/frontend/src/features/routes/ui/RouteFormModal/RouteFormModal.test.tsx
    - packages/frontend/src/features/ivrs/ui/IvrFormModal/IvrFormModal.tsx
    - packages/frontend/src/shared/config/locales/en.ts
    - packages/frontend/src/shared/config/locales/ru.ts

key-decisions:
  - "Canvas is read-only; nodes have no role=button and no click-to-edit"
  - "Print uses react-to-print contentRef on the figure, not window.print"
  - "IVR branches come only from draft menu_items; direct_dial is never drawn"
  - "max_count > 0 without a max item renders the generator Hangup fallback"

patterns-established:
  - "FlowchartCanvas host=route|ivr reuses one component"
  - "routes.flowchart.* copy in ru/en; tab labels routes.tab.flowchart and ivrs.tabs.flowchart"

requirements-completed: [D-01, D-02, D-03, D-04, D-05, D-52]

coverage:
  - id: D1
    description: RouteFormModal shows Schema tab last when routes.show_flowchart is true and not loading
    requirement: D-02
    verification:
      - kind: unit
        ref: packages/frontend/src/features/routes/ui/RouteFormModal/RouteFormModal.test.tsx#shows the Schema tab last when routes.show_flowchart is on
        status: pass
    human_judgment: false
  - id: D2
    description: FlowchartCanvas renders a condition branch lane with success/otherwise labels
    requirement: D-03
    verification:
      - kind: unit
        ref: packages/frontend/src/features/dialplan-apps/ui/FlowchartCanvas/FlowchartCanvas.test.tsx#draws a condition branch lane with success and otherwise labels
        status: pass
    human_judgment: false
  - id: D3
    description: Print uses useReactToPrint contentRef on the canvas figure
    requirement: D-04
    verification:
      - kind: unit
        ref: packages/frontend/src/features/dialplan-apps/ui/FlowchartCanvas/FlowchartPrint.test.tsx#wires useReactToPrint contentRef to the canvas figure
        status: pass
    human_judgment: false
  - id: D4
    description: IVR Schema tab shows digit branches and omits direct_dial
    requirement: D-05
    verification:
      - kind: unit
        ref: packages/frontend/src/features/ivrs/ui/IvrFormModal/IvrFlowchartTab.test.tsx#renders digit branches and human labels for t/i/max
        status: pass
    human_judgment: false
  - id: D5
    description: No reactflow/dagre/elkjs/jspdf/html2canvas imports in owned surfaces
    requirement: D-52
    verification:
      - kind: other
        ref: rg gate over FlowchartCanvas, RouteFormModal, IvrFormModal
        status: pass
    human_judgment: false

duration: 28min
completed: 2026-09-04
status: complete
---

# Phase 14 Plan 03: CSS-grid flowchart and browser print Summary

**Read-only CSS-grid FlowchartCanvas with condition/IVR branches, Schema tabs on Route and IVR hosts, and react-to-print of the figure subtree**

## Performance

- **Duration:** 28 min
- **Started:** 2026-09-04T01:38:35Z
- **Completed:** 2026-09-04T02:06:36Z
- **Tasks:** 3
- **Files modified:** 16

## Accomplishments

- FlowchartCanvas maps draft `IRouteAction[]` to a CSS-grid spine; conditioned steps get «Условие выполнено» / «Иначе» labels (D-01, D-03, D-52)
- RouteFormModal appends Schema last when `routes.show_flowchart` is true and tenant settings are not loading; source is local draft actions (D-02)
- Print button (44px) calls `useReactToPrint({ contentRef })` on the `<figure>`; print SCSS sets `@page 12mm`, `print-color-adjust: exact`, `break-inside: avoid` (D-04, D-52)
- IvrFormModal Schema tab reuses the same canvas in `host="ivr"` with digit / pattern / t / i / max labels and no `direct_dial` branch (D-05)

## Task Commits

1. **Task 1: End-to-end route Schema tab** - `014f316` (feat)
2. **Task 2: Print subtree via react-to-print** - `e43c943` (feat)
3. **Task 3: IVR host flowchart tab** - `89ee0b4` (feat)

**Plan metadata:** pending docs commit

_Note: Task 1 commit also captured in-progress 14-04 walker/dry-run files that were staged by a parallel wave agent. See Deviations._

## Files Created/Modified

- `packages/frontend/src/features/dialplan-apps/ui/FlowchartCanvas/FlowchartCanvas.tsx` - read-only canvas, route and IVR hosts
- `packages/frontend/src/features/dialplan-apps/ui/FlowchartCanvas/FlowchartCanvas.module.scss` - grid, tokens, print rules
- `packages/frontend/src/features/dialplan-apps/ui/FlowchartCanvas/FlowchartCanvas.test.tsx` - branch lane, summarize, completeness
- `packages/frontend/src/features/dialplan-apps/ui/FlowchartCanvas/FlowchartPrint.test.tsx` - contentRef wiring
- `packages/frontend/src/features/routes/ui/RouteFormModal/RouteFlowchartTab.tsx` - draft-backed route host
- `packages/frontend/src/features/routes/ui/RouteFormModal/RouteFormModal.tsx` - gated Schema tab last
- `packages/frontend/src/features/ivrs/ui/IvrFormModal/IvrFlowchartTab.tsx` - IVR host
- `packages/frontend/src/features/ivrs/ui/IvrFormModal/IvrFormModal.tsx` - gated Schema tab
- `packages/frontend/src/shared/config/locales/en.ts` / `ru.ts` - `routes.flowchart.*` and tab labels

## Decisions Made

- Node body text comes from `dialplanAppsRegistry.summarize`, same as the Actions list
- Nested else conditions render as a transition chip, not a third grid column
- `direct_dial` is ignored on the IVR canvas because the dialplan generator has no consumer
- Print chrome (toolbar, banners) uses `.printHidden`; the printed subtree is the figure only

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Accidental 14-04 files in Task 1 commit**
- **Found during:** Task 1 commit
- **Issue:** Parallel wave agents had walker/dry-run files staged. The Task 1 commit (`014f316`) included `packages/backend/src/modules/dialplan-dry-run/*` and `packages/shared/src/utils/dialplan-walk/*` in addition to flowchart files.
- **Fix:** Left 014f316 in place because 14-05 already committed on top of it. Later 14-03 commits staged named files only and were verified clean. Soft-reset was abandoned after HEAD raced.
- **Files modified:** none after the fact
- **Verification:** Task 2 (`e43c943`) and Task 3 (`89ee0b4`) `--stat` contain only 14-03 files
- **Committed in:** `014f316` (unintended extras)

**2. [Rule 1 - Bug] Print button broke the read-only no-button assertion**
- **Found during:** Task 2
- **Issue:** Task 1 test expected zero `role=button` in the canvas
- **Fix:** Assert nodes are not buttons; print control is allowed
- **Files modified:** `FlowchartCanvas.test.tsx`
- **Verification:** 8 canvas/print tests pass
- **Committed in:** `e43c943`

---

**Total deviations:** 2 auto-fixed (2 Rule 1)
**Impact on plan:** Flowchart goal delivered. 14-04 files leaked into `014f316`; 14-04 executor should treat that tree as already present, not rewrite 14-03 history.

## Issues Encountered

- PowerShell cannot run the bash `gsd_run` shim; used `node .../gsd-tools.cjs` instead
- Locale files also carried directory/CSV WIP; Task 1 restored HEAD then re-applied only `routes.flowchart.*`
- D-52 `rg` would match a test regex that listed forbidden library names; that assertion was removed in Task 3

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Route and IVR Schema tabs are ready for 14-04 dry-run highlight on the same canvas
- Do not rewrite `014f316`; 14-04/14-05 already share that history
- Dry-run form region is not in this plan; `.printHidden` is available when 14-04 adds it

---
*Phase: 14-visual-route-builder-and-automation*
*Completed: 2026-09-04*

## Self-Check: PASSED
