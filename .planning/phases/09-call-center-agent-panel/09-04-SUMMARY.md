---
phase: 09-call-center-agent-panel
plan: 04
subsystem: ui
tags: [react, rtk-query, sse, i18n, scss-modules, lucide-react]

# Dependency graph
requires:
  - phase: 09-02
    provides: AgentStatus 9-member union + authoritative agentStatusLabel/agentStatusColorFamily maps
  - phase: 09-03
    provides: CallCenterMetricsService dual sinceLogin/sinceMidnight KPI accumulators + agentKpiUpdate SSE delta
provides:
  - "GET /callcenter/agent/kpi endpoint + CallCenterService.getAgentKpi (self-scoped, no client-supplied interface)"
  - "callCenterApi.getAgentKpi RTK query with AgentKpi cache tag, reshaping raw sinceLogin/sinceMidnight into {shift,day} pairs"
  - "useCallCenterSSE agentKpiUpdate listener — invalidates AgentKpi tag only for the current agent, delta-only (no polling)"
  - "CallControlBar — reusable compact/full inline mute/hold/transfer/hangup row shared by AgentStatusBar and (future) SoftphoneWidget"
  - "AgentStatusBar — 9-status pill, live mm:ss status timer, dual shift.day KPI group, informative active-call indicator + inline compact controls"
affects: [09-08, 09-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CallControlBar variant prop (compact|full) — one control row, two hosts, icon+label >=768px / icon-only+tooltip <768px via useIsMobile"
    - "Self-contained feature UI components call their own RTK query hooks (AgentStatusBar -> useGetAgentKpiQuery), matching MissedCallsPanel"
    - "Client-tracked 'time since last status change' via ref+interval when no server timestamp field exists yet on IAgent"

key-files:
  created:
    - packages/frontend/src/features/callcenter/ui/CallControlBar/CallControlBar.tsx
    - packages/frontend/src/features/callcenter/ui/CallControlBar/CallControlBar.module.scss
    - packages/frontend/src/features/callcenter/ui/CallControlBar/index.ts
    - packages/frontend/src/features/callcenter/ui/AgentStatusBar/AgentStatusBar.tsx
    - packages/frontend/src/features/callcenter/ui/AgentStatusBar/AgentStatusBar.module.scss
    - packages/frontend/src/features/callcenter/ui/AgentStatusBar/index.ts
  modified:
    - packages/frontend/src/shared/api/endpoints/callCenterApi.ts
    - packages/frontend/src/shared/api/rtkApi.ts
    - packages/frontend/src/features/callcenter/lib/useCallCenterSSE.ts
    - packages/frontend/src/features/callcenter/lib/useCallCenterSSE.test.ts
    - packages/frontend/src/features/callcenter/index.ts
    - packages/frontend/src/shared/config/locales/en.ts
    - packages/frontend/src/shared/config/locales/ru.ts
    - packages/backend/src/modules/callcenter/callcenter.service.ts
    - packages/backend/src/modules/callcenter/callcenter.controller.ts
    - packages/backend/src/modules/callcenter/callcenter.service.spec.ts

key-decisions:
  - "Added GET /callcenter/agent/kpi + CallCenterService.getAgentKpi — the plan required a getAgentKpi RTK query but 09-03 only shipped the in-memory metric service and SSE emission, not a REST endpoint (Rule 2: missing critical functionality)"
  - "CallControlBar and AgentStatusBar built as standalone, prop-driven components not yet wired into CallCenterAgentPage.tsx — the plan's files_modified list omits CallCenterAgentPage.tsx, and integration is the orchestrator rework's job (09-08)"
  - "Live status timer tracked client-side (ref + 1s interval reset on agent.status change) since IAgent has no server-side 'status changed at' timestamp yet"

patterns-established:
  - "Pattern: shared inline call-control row via CallControlBar(variant) consumed by both the status bar and (later) the softphone widget — avoids duplicating mute/hold/transfer/hangup wiring"

requirements-completed: [D-03, D-11, D-12, D-13, D-14, D-44]

coverage:
  - id: D1
    description: "GET /callcenter/agent/kpi + getAgentKpi RTK query return dual shift/day answered/made/missed counters"
    requirement: "D-11"
    verification:
      - kind: unit
        ref: "packages/backend/src/modules/callcenter/callcenter.service.spec.ts#getAgentKpi"
        status: pass
    human_judgment: false
  - id: D2
    description: "agentKpiUpdate SSE listener invalidates the AgentKpi cache tag only for the current agent (delta-only, no polling)"
    requirement: "D-12"
    verification:
      - kind: unit
        ref: "packages/frontend/src/features/callcenter/lib/useCallCenterSSE.test.ts#agentKpiUpdate"
        status: pass
    human_judgment: false
  - id: D3
    description: "CallControlBar renders compact (mute/hold/transfer/hangup) and full variants with 44px touch targets and icon-only+tooltip below 768px"
    requirement: "D-03"
    verification: []
    human_judgment: true
    rationale: "Visual/responsive behavior (breakpoint switch, touch target sizing, tooltip rendering) needs human/browser verification — no component test harness exists yet for features/callcenter/ui"
  - id: D4
    description: "AgentStatusBar renders all 9 statuses with correct color family, a live mm:ss timer, dual shift.day KPI group, and swaps to the active-call indicator + inline CallControlBar during a call"
    requirement: "D-13"
    verification: []
    human_judgment: true
    rationale: "Visual composition and live-timer behavior need human/browser verification; component is not yet wired into CallCenterAgentPage in this plan"

duration: ~35min
completed: 2026-07-22
status: complete
---

# Phase 9 Plan 04: Status Bar Redesign + KPI + Call-Control Bar Summary

**Dual shift·day KPI status bar cockpit (AgentStatusBar) with a live status timer and informative active-call indicator, plus a reusable CallControlBar shared by the bar and the softphone widget — fed by a new getAgentKpi endpoint and agentKpiUpdate SSE deltas.**

## Performance

- **Duration:** ~35 min (across two sessions)
- **Tasks:** 3/3
- **Files modified:** 16 (6 created, 10 modified)

## Accomplishments

- New `GET /callcenter/agent/kpi` backend endpoint + `callCenterApi.getAgentKpi` RTK query, reshaping raw `sinceLogin`/`sinceMidnight` counters into `{answered,made,missed}: {shift,day}` for the bar
- `useCallCenterSSE` gained an `agentKpiUpdate` listener that invalidates the `AgentKpi` cache tag only when the delta is for the current agent — delta-only, no polling (D-45 contract preserved)
- New reusable `CallControlBar` (compact/full variants) — mute/hold/transfer/hangup with 44px touch targets, icon+label ≥768px / icon-only+tooltip <768px, aria-labels on icon-only buttons
- New `AgentStatusBar` — full 9-status pill (dot + label via the 09-02 `displayLabels` map), agent name+extension, live mm:ss status timer, desktop-only queue chips, dual shift·day KPI group (принял/совершил/пропустил), and an active-call indicator (queue name, or Личный/Исходящий + caller) that swaps in the compact `CallControlBar` during a call
- i18n: `callcenter.kpi.*`, `callcenter.statusBar.*`, `callcenter.controlBar.*` added to both `ru.ts` and `en.ts` (no em dash, per Copywriting Contract)

## Task Commits

Each task was committed atomically:

1. **Task 1: getAgentKpi endpoint + agentKpiUpdate SSE listener** - `cd90aab` (feat)
2. **Task 2: CallControlBar reusable inline control row** - `941af0f` (feat)
3. **Task 3: AgentStatusBar with dual KPI, live timer, active-call indicator** - `31f9ec0` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `packages/frontend/src/features/callcenter/ui/CallControlBar/CallControlBar.tsx` - compact/full inline mute/hold/transfer/hangup row
- `packages/frontend/src/features/callcenter/ui/CallControlBar/CallControlBar.module.scss` - 44px touch targets, active-state dot indicator
- `packages/frontend/src/features/callcenter/ui/CallControlBar/index.ts` - barrel export
- `packages/frontend/src/features/callcenter/ui/AgentStatusBar/AgentStatusBar.tsx` - status pill, live timer, dual KPI, active-call indicator
- `packages/frontend/src/features/callcenter/ui/AgentStatusBar/AgentStatusBar.module.scss` - status-family pill colors, KPI counter layout
- `packages/frontend/src/features/callcenter/ui/AgentStatusBar/index.ts` - barrel export
- `packages/frontend/src/shared/api/endpoints/callCenterApi.ts` - `IAgentKpi` type + `getAgentKpi` query
- `packages/frontend/src/shared/api/rtkApi.ts` - `AgentKpi` cache tag
- `packages/frontend/src/features/callcenter/lib/useCallCenterSSE.ts` - `agentKpiUpdate` listener
- `packages/frontend/src/features/callcenter/lib/useCallCenterSSE.test.ts` - listener tests (own-agent vs other-agent)
- `packages/frontend/src/features/callcenter/index.ts` - barrel exports for both new components
- `packages/frontend/src/shared/config/locales/en.ts` / `ru.ts` - `kpi`, `statusBar`, `controlBar` i18n keys
- `packages/backend/src/modules/callcenter/callcenter.service.ts` - `getAgentKpi(userUid, userId)` self-scoped resolver
- `packages/backend/src/modules/callcenter/callcenter.controller.ts` - `GET /callcenter/agent/kpi`
- `packages/backend/src/modules/callcenter/callcenter.service.spec.ts` - `getAgentKpi` tests (self-scoped, no client-supplied interface)

## Decisions Made

- Added the missing `GET /callcenter/agent/kpi` REST endpoint (Rule 2) — 09-03 only shipped the in-memory metrics accumulator and SSE emission, not a queryable endpoint, but Task 1 required a working `getAgentKpi` RTK query
- Self-scoped the KPI endpoint server-side (interface resolved from `req.user.sub`, never accepted from the client) to close the IDOR risk flagged in the plan's threat model (T-09-04-01)
- Kept `CallControlBar`/`AgentStatusBar` decoupled from `CallCenterAgentPage.tsx` — the plan's `files_modified` list never includes the page, so wiring belongs to the 09-08 layout/orchestrator rework, not this plan
- Tracked the live status timer client-side (no server "status changed at" field exists on `IAgent` yet) — resets on `agent.status` transitions via a ref + 1s interval

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added GET /callcenter/agent/kpi backend endpoint**
- **Found during:** Task 1
- **Issue:** Plan's Task 1 required a working `getAgentKpi` RTK query, but 09-03 (its stated dependency) only implemented the in-memory `CallCenterMetricsService` accumulator and the `agentKpiUpdate` SSE emission — no REST endpoint existed to back the query
- **Fix:** Added `CallCenterService.getAgentKpi(userUid, userId)` (resolves the caller's own agent interface server-side, never from a client param) and `GET /callcenter/agent/kpi` in the controller
- **Files modified:** `packages/backend/src/modules/callcenter/callcenter.service.ts`, `callcenter.controller.ts`, `callcenter.service.spec.ts`
- **Verification:** `callcenter.service.spec.ts` passes (2 new tests: happy path + not-online fallback); `npx tsc -p packages/backend/tsconfig.json --noEmit` clean of new errors
- **Committed in:** `cd90aab` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Necessary to make Task 1's stated deliverable ("getAgentKpi query exists") actually functional end-to-end. No scope creep beyond the plan's own Task 1 acceptance criteria.

## Issues Encountered

None beyond the deviation above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `AgentStatusBar` and `CallControlBar` are ready to be wired into `CallCenterAgentPage.tsx` — deferred to 09-08 (layout/IA rework), which is the plan that touches the page's orchestration
- `SoftphoneWidget` (09-06) can adopt `CallControlBar`'s `full` variant when 09-10 lands real handlers for park/conference/warm-transfer/zombie-reset (currently no-op placeholders)
- Pre-existing, unrelated issues remain logged in `deferred-items.md` (frontend `callCenterSlice.test.ts` TS2322; backend `call-groups`/`ivrs`/`keyword-matcher` spec errors; `callcenter-chat.service.spec.ts` 1 failing test) — none touched by this plan

## Self-Check: PASSED

- FOUND: `.planning/phases/09-call-center-agent-panel/09-04-SUMMARY.md`
- FOUND: `packages/frontend/src/features/callcenter/ui/AgentStatusBar/AgentStatusBar.tsx`
- FOUND: `packages/frontend/src/features/callcenter/ui/CallControlBar/CallControlBar.tsx`
- FOUND commit: `cd90aab` (Task 1)
- FOUND commit: `941af0f` (Task 2)
- FOUND commit: `31f9ec0` (Task 3)

---
*Phase: 09-call-center-agent-panel*
*Completed: 2026-07-22*
