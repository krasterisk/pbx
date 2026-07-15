---
phase: 07-call-center-overhaul-professional-agent-supervisor-workspace
plan: 09
subsystem: ui
tags: [nestjs, react, supervisor, recharts, agent-timeline, rtk, sse]

requires:
  - phase: 07-call-center-overhaul-professional-agent-supervisor-workspace
    provides: /callcenter/supervisor route, RequireRole, CallCenterMetricsService
provides:
  - Supervisor REST actions (queue-penalty, force-logout, redirect-call, hangup-call, agent-detail)
  - Reusable AgentTimeline (D-36 owner) with server-built segments contract
  - SegmentedControl, Sparkline, Avatar shared/ui primitives
  - Grid/table agent view with localStorage cc:supervisor:view (D-24)
  - KPI sparklines via useKpiSamples session ring-buffer (D-23)
  - AgentDetailModal with live timeline + day stats (D-23)
  - Live-call pickup/transfer/hangup with confirm (D-23)
affects: [07-17, 07-18, 07-13]

tech-stack:
  added: []
  patterns:
    - "AgentTimeline: presentation-only; segments built server-side in getAgentDetail/getAgentTimeline"
    - "useKpiSamples: client ring-buffer for supervisor KPI sparklines (no backend history)"
    - "supervisorRedirectCall/hangupCall: tenant-guard call.userUid !== vpbx_user_uid"
    - "cc:supervisor:view localStorage persistence for grid/table toggle"

key-files:
  created:
    - packages/backend/src/modules/callcenter/dto/callcenter.dto.ts (SupervisorQueuePenaltyDto, etc.)
    - packages/frontend/src/features/callcenter/lib/useKpiSamples.ts
    - packages/frontend/src/shared/ui/SegmentedControl/SegmentedControl.tsx
    - packages/frontend/src/shared/ui/Sparkline/Sparkline.tsx
    - packages/frontend/src/shared/ui/Avatar/Avatar.tsx
    - packages/frontend/src/features/callcenter/ui/AgentTimeline/AgentTimeline.tsx
    - packages/frontend/src/features/callcenter/ui/AgentDetailModal/AgentDetailModal.tsx
  modified:
    - packages/backend/src/modules/callcenter/callcenter.service.ts
    - packages/backend/src/modules/callcenter/callcenter.controller.ts
    - packages/backend/src/modules/callcenter/callcenter.service.spec.ts
    - packages/frontend/src/shared/api/endpoints/callCenterApi.ts
    - packages/frontend/src/features/callcenter/model/types/callCenterSchema.ts
    - packages/frontend/src/pages/CallCenterSupervisorPage/CallCenterSupervisorPage.tsx
    - packages/frontend/src/shared/config/locales/ru.ts
    - packages/frontend/src/shared/config/locales/en.ts

key-decisions:
  - "CcAgentEvent filtered via today's session IDs (no agent_interface column on events table)"
  - "Tasks 1+2 backend API committed in one feat commit; regression spec in separate test commit"
  - "AgentTimeline is sole owner (D-36); 07-18 imports only"

patterns-established:
  - "Pattern: supervisor live-call redirect reuses AMI Redirect on callerChannel (pickup + transfer)"
  - "Pattern: Sparkline/Recharts wrapped in shared/ui per FSD third-party rule"

requirements-completed: [D-23, D-24, D-25, D-36]

duration: 35min
completed: 2026-07-15
---

# Phase 07 Plan 09: Supervisor CORE Summary

**Supervisor panel core with grid/table toggle, KPI sparklines, live-call actions, AgentDetailModal, and reusable AgentTimeline backed by assertSupervisor REST endpoints**

## Performance

- **Duration:** 35 min
- **Started:** 2026-07-15T16:31:00Z
- **Completed:** 2026-07-15T17:06:00Z
- **Tasks:** 5
- **Files modified:** 18

## Accomplishments

- Added five supervisor REST endpoints behind `assertSupervisor` with tenant guards on redirect/hangup (T-07-09-01/02)
- `getAgentDetail` aggregates today's `cc_queue_calls` stats and builds timeline segments from `cc_agent_events` via session join
- Created reusable `AgentTimeline` (D-36 owner), `SegmentedControl`, `Sparkline`, `Avatar` primitives
- Supervisor page: grid↔table toggle persisted in `cc:supervisor:view`, KPI sparklines, pickup/transfer/hangup on live calls
- `AgentDetailModal` (Dialog xl) with lazy agent-detail fetch and live timeline
- Spy/whisper/barge Originate logic preserved unchanged (D-25)

## Task Commits

1. **Task 1: Backend supervisor action endpoints** - `07e97b9` (feat, includes agent-detail service/controller)
2. **Task 2: agent-detail read + regression spec** - `706ea05` (test)
3. **Task 3: Frontend plumbing (RTK, hooks, primitives, AgentTimeline)** - `b401504` (feat)
4. **Task 4: Supervisor page toggle, sparklines, live-call actions** - `16147f4` (feat)
5. **Task 5: AgentDetailModal** - `b170164` (feat)

## Self-Check: PASSED

- FOUND: packages/frontend/src/features/callcenter/ui/AgentTimeline/AgentTimeline.tsx
- FOUND: packages/frontend/src/features/callcenter/ui/AgentDetailModal/AgentDetailModal.tsx
- FOUND: packages/frontend/src/shared/ui/Sparkline/Sparkline.tsx
- FOUND: .planning/phases/07-call-center-overhaul-professional-agent-supervisor-workspace/07-09-SUMMARY.md
- FOUND commits: 07e97b9, 706ea05, b401504, 16147f4, b170164

## Files Created/Modified

- `callcenter.service.ts` - supervisorQueuePenalty/ForceLogout/RedirectCall/HangupCall/getAgentDetail
- `callcenter.controller.ts` - POST supervisor/* + GET supervisor/agent-detail
- `callCenterApi.ts` - RTK mutations + useLazyGetAgentDetailQuery
- `CallCenterSupervisorPage.tsx` - D-24 toggle, D-23 sparklines + live-call actions
- `AgentTimeline.tsx` - segments presentation component (07-18 reuse)
- `AgentDetailModal.tsx` - operator detail modal with stats + timeline

## Decisions Made

- Agent events scoped by today's `cc_agent_sessions` for the requested interface (events table lacks agent_interface)
- Backend tasks 1/2 split into feat + test commits (service/controller delivered together)

## Deviations from Plan

### Task commit grouping

- **Found during:** Task 1 commit step
- **Issue:** Task 2 `getAgentDetail` lives in same service/controller files as Task 1 endpoints
- **Fix:** Single feat commit `07e97b9` for backend API; separate test commit `706ea05` for Task 2 spec
- **Impact:** No functional deviation; all acceptance criteria met

Otherwise: None — plan executed as written.

## Issues Encountered

- Pre-existing `tsc --noEmit` errors in unrelated backend/frontend files (ivrs, voice-robots, CallGroupFormModal) — out of scope
- `sessionModel.findAll` mock missing in spec stub — added for getAgentDetail test

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 07-17 can consume queue-penalty/force-logout RTK hooks + BulkActionsBar/QueueManagementModal
- 07-18 can import `AgentTimeline` + `AgentTimelineSegment` type (do not recreate)
- 07-13 can reuse `Sparkline` for wallboard KPI trends

---
*Phase: 07-call-center-overhaul-professional-agent-supervisor-workspace*
*Completed: 2026-07-15*
