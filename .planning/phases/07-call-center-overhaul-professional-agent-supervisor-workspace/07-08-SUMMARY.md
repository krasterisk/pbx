---
phase: 07-call-center-overhaul-professional-agent-supervisor-workspace
plan: 08
subsystem: ui
tags: [callcenter, nestjs, react, wrapup, dnd, notifications, rbac]

requires:
  - phase: 07-call-center-overhaul-professional-agent-supervisor-workspace
    provides: CallCenterSettingsService + useGetMyOperatorSettingsQuery (07-05)
  - phase: 07-call-center-overhaul-professional-agent-supervisor-workspace
    provides: /callcenter/agent route shell (07-02)
provides:
  - Server-enforced pickup_enabled gate (403) + UI hidden pick button (D-18)
  - Per-operator wrap-up timers with extend endpoint and WrapupBar UX (D-19)
  - Per-operator sounds + Browser Notification when tab hidden (D-20)
  - DnD/click transfer modal with blind/attended/cancel (D-21)
  - 4-zone agent ARM layout per UI-SPEC §1
  - shared/ui Progress primitive
affects:
  - 07-11 runtime call card (cc:draft localStorage integration point)
  - 07-13 SLA bars (Progress reuse)

tech-stack:
  added: []
  patterns:
    - "Wrap-up timers loaded at agentLogin into in-memory AgentState; AMI hot-path reads memory only"
    - "wrapupDeadlines Map + extendWrapupTimer SSE wrapupExtend for frontend countdown resync"
    - "Transfer target allow-list: tenant agents/exten or queues via getAllAgents/getAllQueues"
    - "DragTransfer Dialog 3-action modal; colleague click opens same modal as DnD drop"

key-files:
  created:
    - packages/frontend/src/shared/ui/Progress/Progress.tsx
    - packages/frontend/src/features/callcenter/ui/WrapupBar/WrapupBar.tsx
    - packages/frontend/src/features/callcenter/ui/WrapupBar/WrapupBar.module.scss
  modified:
    - packages/backend/src/modules/callcenter/callcenter.service.ts
    - packages/backend/src/modules/callcenter/callcenter-ami.service.ts
    - packages/backend/src/modules/callcenter/callcenter.controller.ts
    - packages/backend/src/modules/callcenter/dto/callcenter.dto.ts
    - packages/backend/src/modules/callcenter/callcenter-state.service.ts
    - packages/backend/src/modules/callcenter/callcenter.service.spec.ts
    - packages/frontend/src/features/callcenter/ui/DragTransfer/DragTransfer.tsx
    - packages/frontend/src/features/callcenter/lib/useCallNotifications.ts
    - packages/frontend/src/features/callcenter/lib/useCallCenterSSE.ts
    - packages/frontend/src/pages/CallCenterAgentPage/CallCenterAgentPage.tsx
    - packages/frontend/src/pages/CallCenterAgentPage/CallCenterAgentPage.module.scss
    - packages/frontend/src/shared/api/endpoints/callCenterApi.ts
    - packages/frontend/src/shared/config/locales/ru.ts
    - packages/frontend/src/shared/config/locales/en.ts

key-decisions:
  - "pickup_enabled enforced server-side (ForbiddenException); UI hides button entirely when false"
  - "wrapupEnd emits reason timeout|manual; timeout includes autosaveDraft flag for frontend"
  - "Browser Notification gated by document.hidden + notifications_enabled per operator"
  - "Draft autosave to localStorage cc:draft:{uniqueid} pending 07-11 runtime card"

patterns-established:
  - "Pattern: operator ARM reads useGetMyOperatorSettingsQuery once for pickup/wrapup/sounds"
  - "Pattern: SSE wrap-up events mirrored to window CustomEvents for page-local countdown"

requirements-completed: [D-18, D-19, D-20, D-21]

duration: 35min
completed: 2026-07-15
---

# Phase 07 Plan 08: Agent ARM D-18–D-21 Summary

**Server-gated pick/transfer, per-operator wrap-up with extend, 4-zone ARM, DnD transfer modal, and full notification stack**

## Performance

- **Duration:** 35 min
- **Started:** 2026-07-15T16:23:00Z
- **Completed:** 2026-07-15T16:58:00Z
- **Tasks:** 3
- **Files modified:** 17

## Accomplishments

- Backend: `pickup_enabled` 403 on pick-call, tenant-scoped transfer target auth, `POST /agent/wrapup-extend` with `extendWrapupTimer`/`wrapupDeadlines`, per-operator wrap-up fields at login
- Frontend: 4-zone `/callcenter/agent` layout, `WrapupBar` + `Progress`, `DragTransfer` 3-action Dialog, pick button hidden when pickup disabled
- Notifications D-20: separate incoming/missed sounds, volume/mute, Browser Notification only when tab hidden

## Task Commits

1. **Task 1: Backend enforcement** - `5ff4449` (feat)
2. **Task 2: Frontend 4-zone ARM + wrap-up + DnD** - `a0b9036` (feat)
3. **Task 3: Full notifications D-20** - `480ee87` (feat)

**Plan metadata:** `pending` (docs commit)

## Files Created/Modified

- `callcenter.service.ts` - pickup gate, transfer auth, agentWrapupExtend, login settings hydration
- `callcenter-ami.service.ts` - extendWrapupTimer, wrapupEnd reason/autosaveDraft
- `WrapupBar.tsx` / `Progress.tsx` - wrap-up countdown UX
- `DragTransfer.tsx` - blind/attended/cancel Dialog; colleague click = same modal
- `useCallNotifications.ts` - per-operator sound/notification/volume gates
- `CallCenterAgentPage.tsx` - 4 zones, operator settings wiring, draft autosave

## Decisions Made

- SSE wrap-up events dispatch `cc:wrapup-*` window events so page keeps local countdown without Redux churn
- Volume mapped as `(operatorSettings.volume / 100) * 0.15` to preserve prior default loudness curve
- useCallCenterSSE gained `wrapupExtend` listener (not in original file list; required for countdown resync)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Critical] wrapupExtend SSE + window events for countdown resync**
- **Found during:** Task 2 (WrapupBar extend button)
- **Issue:** Plan required resync on `wrapupExtend.remainingSec` but useCallCenterSSE had no wrapupExtend handler
- **Fix:** Added `wrapupExtend` listener + `cc:wrapup-start/extend/end` CustomEvents in useCallCenterSSE; page subscribes
- **Files modified:** `useCallCenterSSE.ts`, `CallCenterAgentPage.tsx`
- **Committed in:** `a0b9036`

**2. [Rule 1 - Bug] Existing agentTransfer spec broke after target auth**
- **Found during:** Task 1 tests
- **Issue:** Transfer tests used target `201` without seeding tenant agent
- **Fix:** Login PJSIP/201 agent before valid transfer tests; ForbiddenException test for unknown target
- **Files modified:** `callcenter.service.spec.ts`
- **Committed in:** `5ff4449`

---

**Total deviations:** 2 auto-fixed (1 critical SSE wiring, 1 test fix)
**Impact on plan:** No scope change; acceptance criteria met.

## Issues Encountered

- Pre-existing `tsc --noEmit` failures in unrelated backend/frontend files; changed files pass `test:cc`
- PowerShell heredoc commit syntax failed; used single-line commit messages

## User Setup Required

None.

## Next Phase Readiness

- Agent ARM ready for 07-09 supervisor workspace parity items
- `cc:draft:{uniqueid}` localStorage stub ready for 07-11 runtime card wiring
- `Progress` primitive ready for 07-13 SLA bars

## Self-Check: PASSED

- FOUND: packages/frontend/src/shared/ui/Progress/Progress.tsx
- FOUND: packages/frontend/src/features/callcenter/ui/WrapupBar/WrapupBar.tsx
- FOUND: .planning/phases/07-call-center-overhaul-professional-agent-supervisor-workspace/07-08-SUMMARY.md
- FOUND commits: 5ff4449, a0b9036, 480ee87

---
*Phase: 07-call-center-overhaul-professional-agent-supervisor-workspace*
*Completed: 2026-07-15*
