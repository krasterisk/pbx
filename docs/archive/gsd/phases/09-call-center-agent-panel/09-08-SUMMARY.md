---
phase: 09-call-center-agent-panel
plan: 08
subsystem: ui
tags: [react, redux-toolkit-query, radix-tabs, i18next, callcenter, dnd-kit]

requires:
  - phase: 09-call-center-agent-panel (09-02)
    provides: "shared/ui/Tabs primitive + AgentStatus union + authoritative label/color maps"
  - phase: 09-call-center-agent-panel (09-04)
    provides: "AgentStatusBar + CallControlBar (standalone, not yet mounted)"
  - phase: 09-call-center-agent-panel (09-05)
    provides: "CallCenterPermissionsService.getEffective + peer ChanSpy endpoint"
  - phase: 09-call-center-agent-panel (09-06)
    provides: "SoftphoneWidget + IncomingCallToast (standalone, not yet mounted)"
  - phase: 09-call-center-agent-panel (09-13)
    provides: "GET /callcenter/settings/operator/permissions self effective-rights endpoint"
provides:
  - "CallCenterAgentPage reworked into a thin hybrid orchestrator (side-by-side panels ≥1024px / shared Tabs <768px, default Waiting)"
  - "WaitingTab — extraction of the queue-waiting table with pickup and 30s/60s wait thresholds"
  - "QueuesTab — per-queue aggregate/free-operator/personal-KPI cards with pause/warm-transfer/go-to-Waiting actions"
  - "CoworkersTab — presence rows with click/drag-to-transfer, permission-gated ChanSpy mode picker, supervisor hangup"
  - "callCenterApi.getAgentQueuesStats + getEffectivePermissions + getMyUiCustomization + warmTransferToQueue + peerSpy"
  - "SegmentedControl disabled+tooltipContent option support"
affects: [09-14, 09-09, 09-10, 09-11, 09-12]

tech-stack:
  added: []
  patterns:
    - "Hybrid panel/tab layout switched by useIsMobile(768), matching the pre-existing 08-xx breakpoint convention"
    - "Self-effective-permissions RTK query as a stand-in for a not-yet-built usePermissions hook (bridged in 09-14)"

key-files:
  created:
    - packages/frontend/src/features/callcenter/ui/WaitingTab/WaitingTab.tsx
    - packages/frontend/src/features/callcenter/ui/WaitingTab/WaitingTab.module.scss
    - packages/frontend/src/features/callcenter/ui/WaitingTab/index.ts
    - packages/frontend/src/features/callcenter/ui/QueuesTab/QueuesTab.tsx
    - packages/frontend/src/features/callcenter/ui/QueuesTab/QueuesTab.module.scss
    - packages/frontend/src/features/callcenter/ui/QueuesTab/index.ts
    - packages/frontend/src/features/callcenter/ui/CoworkersTab/CoworkersTab.tsx
    - packages/frontend/src/features/callcenter/ui/CoworkersTab/CoworkersTab.module.scss
    - packages/frontend/src/features/callcenter/ui/CoworkersTab/index.ts
  modified:
    - packages/frontend/src/pages/CallCenterAgentPage/CallCenterAgentPage.tsx
    - packages/frontend/src/pages/CallCenterAgentPage/CallCenterAgentPage.module.scss
    - packages/frontend/src/pages/CallCenterAgentPage/CallCenterAgentPage.test.tsx
    - packages/frontend/src/shared/api/endpoints/callCenterApi.ts
    - packages/frontend/src/shared/api/rtkApi.ts
    - packages/frontend/src/shared/ui/SegmentedControl/SegmentedControl.tsx
    - packages/backend/src/modules/callcenter/callcenter-metrics.service.ts
    - packages/backend/src/modules/callcenter/callcenter.service.ts
    - packages/backend/src/modules/callcenter/callcenter.controller.ts
    - packages/backend/src/modules/callcenter/callcenter-metrics.service.spec.ts
    - packages/backend/src/modules/callcenter/callcenter.service.spec.ts

key-decisions:
  - "Added missing backend GET /callcenter/agent/queues-kpi (CallCenterMetricsService.getAgentQueuesKpi) — the plan's getAgentQueuesStats query needed a real per-queue KPI endpoint that did not yet exist (Rule 2)"
  - "Queue self-service join/leave omitted from QueuesTab actions — no backend endpoint exists for agent-initiated queue membership changes (only supervisor-driven via QueueManagementModal); documented as a known limitation for a future plan"
  - "ChanSpy visibility gated only on own can_spy + target IN_CALL (no per-target spyable flag exposed to the client yet); spyable/shared-queue/mode enforcement stays server-side in peerSpy"
  - "Supervisor hangup button gated with (currentUser.level >= UserLevel.SUPERVISOR) to mirror callcenter.controller.ts's assertSupervisor exactly, avoiding a button that would 403"
  - "AgentStatusBar wrapped as the sole draggable transfer source (DraggableCall moved from the old floating call window onto the whole status chrome)"
  - "ClientCard kept as an explicit-open chrome strip, not migrated into a tab — out of scope for this rework"

requirements-completed: [D-04, D-05, D-07, D-21, D-22, D-23, D-25, D-26, D-31, D-32, D-33, D-44, D-46]

coverage:
  - id: D1
    description: "Wide ≥1024px renders Coworkers/Queues/Waiting as side-by-side panels with per-panel visibility toggles (D-04/D-05)"
    requirement: "D-04"
    verification:
      - kind: unit
        ref: "CallCenterAgentPage.test.tsx#renders side-by-side panels on wide screens"
        status: pass
    human_judgment: false
  - id: D2
    description: "Phone <768px renders the shared Tabs component with Waiting selected by default (D-07)"
    requirement: "D-07"
    verification:
      - kind: unit
        ref: "CallCenterAgentPage.test.tsx#renders the shared Tabs component on phone with Waiting selected by default (D-07)"
        status: pass
    human_judgment: false
  - id: D3
    description: "CoworkersTab exposes click/drag-to-transfer, permission-gated ChanSpy mode picker, and supervisor hangup (D-21/D-22/D-23/D-25/D-26)"
    requirement: "D-21"
    verification: []
    human_judgment: true
    rationale: "No dedicated CoworkersTab unit test was written this plan; behavior verified via tsc + manual code review against the 09-05 permissions contract. Needs human UAT of ChanSpy/hangup flows against a live agent session."
  - id: D4
    description: "QueuesTab shows aggregate + free-operator warning/danger + personal shift·day counters + queue actions incl. warm-transfer-to-queue (D-31/D-32/D-33)"
    requirement: "D-31"
    verification: []
    human_judgment: true
    rationale: "No dedicated QueuesTab unit test was written this plan; needs human UAT against live queue data and an active call for the warm-transfer action."
  - id: D5
    description: "WaitingTab is the extracted queue-waiting table with pickup, preserving 30s/60s wait-timer thresholds"
    requirement: "D-44"
    verification: []
    human_judgment: true
    rationale: "Logic ported verbatim from the pre-existing page (already in production); no isolated unit test exists for the extracted component. Full page test suite (312 tests) passes."

duration: ~40min
completed: 2026-07-23
status: complete
---

# Phase 9 Plan 08: Call Center Agent Panel hybrid orchestrator rework Summary

**Reworked `CallCenterAgentPage` into a thin hybrid orchestrator (side-by-side panels on wide screens, shared Tabs on phone) with `WaitingTab`/`QueuesTab`/`CoworkersTab` bodies and `AgentStatusBar`/`SoftphoneWidget`/`IncomingCallToast` mounted as persistent chrome.**

## Performance

- **Duration:** ~40 min
- **Tasks:** 3/3 completed
- **Files modified:** 16 (9 created, 7 modified across frontend + backend)

## Accomplishments

- `CallCenterAgentPage` is now an orchestrator: wide screens (≥1024px) get 3 independently-scrollable panels with per-panel visibility toggles that reflow the grid; phones (<768px) get the shared `Tabs` component defaulting to Waiting (D-07); `AgentStatusBar`, `SoftphoneWidget`, and `IncomingCallToast` are mounted unconditionally as persistent chrome above the tab/panel area.
- `WaitingTab` extracts the pre-existing queue-waiting table verbatim (30s/60s wait-timer thresholds, `pickup_enabled`-gated pickup action), scoped to the operator's own queues.
- `QueuesTab` renders one card per operator queue: aggregate waiting/talking/SLA, a 3-state (ok/warning/danger) free-operator count, personal shift·day answered/missed counters, and actions for pause/unpause, go-to-Waiting, and (when an active call exists) warm-transfer-to-this-queue.
- `CoworkersTab` renders presence rows (status-colored dot, name, extension, status label) with click/drag-to-transfer reusing `DroppableColleague`, a permission-gated ChanSpy trigger opening a `SegmentedControl` mode picker (Listen/Whisper/Barge, with Whisper/Barge disabled+tooltipped when not in `spy_modes`), and a supervisor-only hangup icon with a locked confirmation dialog.
- `callCenterApi` gained `getAgentQueuesStats`, `getEffectivePermissions` (hits the 09-13 self-permissions endpoint), `getMyUiCustomization`, `warmTransferToQueue`, and `peerSpy`.
- Backend gained the missing `GET /callcenter/agent/queues-kpi` endpoint (`CallCenterMetricsService.getAgentQueuesKpi`) that `getAgentQueuesStats` needed but did not yet exist.
- `SegmentedControl` gained `disabled`/`tooltipContent` per-option support, used by the ChanSpy mode picker.

## Task Commits

1. **Task 1: WaitingTab extraction + QueuesTab + queues-stats query** - `d2b2785` (feat: backend queues-kpi endpoint), `c29df82` (feat: WaitingTab + QueuesTab + queues-stats/permissions queries)
2. **Task 2: CoworkersTab (transfer + permission-gated ChanSpy + supervisor hangup)** - `44fb076` (feat)
3. **Task 3: CallCenterAgentPage hybrid orchestrator rework** - `e9d942a` (feat)

**Plan metadata:** committed alongside this SUMMARY (see final commit below)

## Files Created/Modified

- `packages/frontend/src/features/callcenter/ui/WaitingTab/WaitingTab.tsx` - Extracted queue-waiting table with pickup
- `packages/frontend/src/features/callcenter/ui/QueuesTab/QueuesTab.tsx` - Per-queue stats + pause/warm-transfer/go-to-Waiting actions
- `packages/frontend/src/features/callcenter/ui/CoworkersTab/CoworkersTab.tsx` - Presence rows, transfer, ChanSpy picker, supervisor hangup
- `packages/frontend/src/pages/CallCenterAgentPage/CallCenterAgentPage.tsx` - Reworked into hybrid tabs/panels orchestrator with persistent chrome
- `packages/frontend/src/pages/CallCenterAgentPage/CallCenterAgentPage.module.scss` - New layout styles (panels/tabs/toggles), removed deprecated mobile-section/queue-monitor styles
- `packages/frontend/src/shared/api/endpoints/callCenterApi.ts` - Added `getAgentQueuesStats`, `getEffectivePermissions`, `getMyUiCustomization`, `warmTransferToQueue`, `peerSpy`
- `packages/frontend/src/shared/ui/SegmentedControl/SegmentedControl.tsx` - Added `disabled`/`tooltipContent` option support
- `packages/backend/src/modules/callcenter/callcenter-metrics.service.ts` - Added `getAgentQueuesKpi`
- `packages/backend/src/modules/callcenter/callcenter.service.ts` / `.controller.ts` - Exposed `agent/queues-kpi` endpoint

## Decisions Made

- Added the missing `GET /callcenter/agent/queues-kpi` backend endpoint since the plan's `getAgentQueuesStats` RTK query needed real per-queue KPI data that no existing endpoint provided (Rule 2 — missing critical functionality for the task to be meaningful).
- Omitted self-service queue join/leave actions from `QueuesTab` — no backend endpoint exists for agent-initiated queue membership changes; documented as a gap for a future plan rather than building against a nonexistent endpoint.
- Gated the supervisor hangup button using the exact same numeric level check (`>= UserLevel.SUPERVISOR`) as `callcenter.controller.ts`'s `assertSupervisor`, rather than the set-based check in `callcenter-settings.controller.ts`, to avoid showing a button that would 403.
- Moved the sole `DraggableCall` wrapper from the old floating call window onto the whole `AgentStatusBar` chrome, since the old drag source no longer exists in the new layout.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added backend `GET /callcenter/agent/queues-kpi` endpoint**
- **Found during:** Task 1
- **Issue:** Plan's `getAgentQueuesStats` RTK query needed real per-queue personal KPI data (answered/missed shift·day), but no backend endpoint existed to serve it — only a single-queue-unaware `getAgentKpi` (09-04) was available.
- **Fix:** Added `CallCenterMetricsService.getAgentQueuesKpi` (aggregates KPI across an agent's queues), `CallCenterService.getAgentQueuesKpi`, and the `GET /callcenter/agent/queues-kpi` controller route, with unit tests.
- **Files modified:** `callcenter-metrics.service.ts`, `callcenter.service.ts`, `callcenter.controller.ts`, `callcenter-metrics.service.spec.ts`, `callcenter.service.spec.ts`
- **Verification:** Backend unit tests pass; `getAgentQueuesStats` query's `transformResponse` matches the new endpoint's response shape.
- **Committed in:** `d2b2785`

**2. [Rule 3 - Blocking] Corrected `UserLevel` import path in CoworkersTab**
- **Found during:** Task 2
- **Issue:** Initial import attempted `UserLevel` from an incorrect module path, causing a TypeScript error.
- **Fix:** Corrected to import `UserLevel` from `@/entities/User` (re-exported from `entities/User/model/consts/userConsts.ts`).
- **Files modified:** `CoworkersTab.tsx`
- **Verification:** `tsc --noEmit` passes.
- **Committed in:** `44fb076`

**3. [Rule 1 - Bug] Fixed `agentStatusLabel` signature mismatch**
- **Found during:** Task 2
- **Issue:** `useTranslation()`'s `TFunction` type is not structurally assignable to the plain `(key, fallback) => string` signature `agentStatusLabel` expects, causing a TS error.
- **Fix:** Wrapped `t` in a local `tLabel` helper matching the exact expected signature.
- **Files modified:** `CoworkersTab.tsx`
- **Verification:** `tsc --noEmit` passes.
- **Committed in:** `44fb076`

**4. [Rule 1 - Bug] Fixed `IAgent | undefined` vs `IAgent | null` type mismatch**
- **Found during:** Task 3
- **Issue:** `AgentStatusBar`'s `agent` prop expects `IAgent | null`, but `selectMyAgent` returns `IAgent | undefined`.
- **Fix:** Coerced with `myAgent ?? null` at the call site.
- **Files modified:** `CallCenterAgentPage.tsx`
- **Verification:** `tsc --noEmit` passes.
- **Committed in:** `e9d942a`

---

**Total deviations:** 4 auto-fixed (1 missing-critical, 3 blocking/bug)
**Impact on plan:** All auto-fixes were necessary for the plan's own deliverables to compile/function correctly. No scope creep beyond what Task 1's `getAgentQueuesStats` query required.

## Issues Encountered

- `assertSupervisor` logic diverges between `callcenter.controller.ts` (numeric level compare) and `callcenter-settings.controller.ts` (set-based check) — pre-existing from 09-05/09-07; not fixed here (out of scope), but the frontend gate was written to mirror the endpoint this plan's hangup action actually calls (`callcenter.controller.ts`).
- No backend endpoint exists for agent self-service queue join/leave — `QueuesTab`'s action row omits these entirely rather than wiring dead buttons.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `getEffectivePermissions` is consumed directly by `CoworkersTab` as an interim stand-in for the `usePermissions` hook that 09-14 will formalize — 09-14 should replace the raw RTK query call with the hook without changing the gating logic.
- Per-panel visibility currently defaults to all-visible; wiring the toggle state to the 09-13 UI-customization persistence layer is a natural follow-up once 09-14's settings UI ships.
- `WaitingTab`/`QueuesTab`/`CoworkersTab` have no dedicated unit tests yet (only exercised via the parent page's mocked-child test) — flagged as `human_judgment: true` deliverables above for UAT.

---
*Phase: 09-call-center-agent-panel*
*Completed: 2026-07-23*

## Self-Check: PASSED

All created files found on disk; all task commit hashes (`d2b2785`, `c29df82`, `44fb076`, `e9d942a`) found in git log.
