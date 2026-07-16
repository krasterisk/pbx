---
phase: 07-call-center-overhaul-professional-agent-supervisor-workspace
plan: 21
subsystem: ui
tags: [callcenter, agent-arm, shift-login, redux, sse, queues, gap-closure]

requires:
  - phase: 07-14
    provides: ShiftLoginModal, agentLogin API, callCenterSlice.myAgentInterface, selectMyAgent
provides:
  - myAgentInterface bound after Start Shift and cleared on End Shift
  - SSE userId→interface fallback when login bind missed
  - ≥1 queue required on shift start; cc:lastShiftQueues restore/persist
affects:
  - 07-UAT
  - 07-22
  - call-card-hold-transfer-wrapup

tech-stack:
  added: []
  patterns:
    - Shift identity = dispatch(setMyAgentInterface(ShiftLoginResult.interface)) after agentLogin unwrap (API returns only success+sessionId)
    - SSE fallback binds only when myAgentInterface is null and agent.userId === selectCurrentUser.uniqueid and status !== OFFLINE

key-files:
  created:
    - packages/frontend/src/features/callcenter/lib/shiftLoginQueues.ts
    - packages/frontend/src/features/callcenter/lib/shiftLoginQueues.test.ts
  modified:
    - packages/frontend/src/pages/CallCenterAgentPage/CallCenterAgentPage.tsx
    - packages/frontend/src/features/callcenter/lib/useCallCenterSSE.ts
    - packages/frontend/src/features/callcenter/lib/useCallCenterSSE.test.ts
    - packages/frontend/src/features/callcenter/model/selectors/callCenterSelectors.test.ts
    - packages/frontend/src/features/callcenter/ui/ShiftLoginModal/ShiftLoginModal.tsx
    - packages/frontend/src/shared/config/locales/en.ts
    - packages/frontend/src/shared/config/locales/ru.ts

key-decisions:
  - "Bind myAgentInterface from ShiftLoginResult.interface, not API unwrap"
  - "UI-only ≥1 queue gate; backend AgentLoginDto queues remain optional"
  - "SSE fallback never overwrites non-null myAgentInterface; logout owns clear"

patterns-established:
  - "Optimistic READY agent upsert via updateAgent after login so ARM leaves OFFLINE before SSE"
  - "Queue restore via cc:lastShiftQueues filtered to current queueOptions"

requirements-completed: [D-14, D-15]

duration: 8min
completed: 2026-07-16
---

# Phase 07 Plan 21: Gap Closure UAT Shift Login Fix Summary

**After Start Shift, Redux binds myAgentInterface so selectMyAgent resolves and status leaves OFFLINE; ≥1 queue enforced so AMI QueueAdd can run**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-16T11:49:44Z
- **Completed:** 2026-07-16T11:57:30Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- `handleShiftLogin` dispatches `setMyAgentInterface(result.interface)` and upserts a READY agent after successful `agentLogin` (SIP and WebRTC)
- WebRTC missing WSS / credentials paths throw after toast so ShiftLoginModal stays open and does not bind identity
- `handleLogout` clears `myAgentInterface` after `agentLogout`
- SSE `fullSnapshot` / `agentUpdate` fallback binds interface by matching `agent.userId` to `selectCurrentUser.uniqueid` when interface is null
- ShiftLoginModal blocks confirm with zero queues (`queuesRequired` en/ru) and persists/restores `cc:lastShiftQueues`

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: SSE/selector failing tests** - `2faa4ae` (test)
2. **Task 1 GREEN: login/logout bind + SSE userId fallback** - `b6eed52` (feat)
3. **Task 2 RED: shift queue validation failing tests** - `a1d5e28` (test)
4. **Task 2 GREEN: ≥1 queue + last queues restore** - `2696d15` (feat)

**Plan metadata:** (pending docs commit)

## Files Created/Modified
- `packages/frontend/src/pages/CallCenterAgentPage/CallCenterAgentPage.tsx` — setMyAgentInterface on login/logout; READY upsert; WebRTC fail-closed throw
- `packages/frontend/src/features/callcenter/lib/useCallCenterSSE.ts` — maybeBindMyAgentInterface after snapshot/agentUpdate
- `packages/frontend/src/features/callcenter/lib/useCallCenterSSE.test.ts` — userId fallback coverage
- `packages/frontend/src/features/callcenter/model/selectors/callCenterSelectors.test.ts` — selectMyAgent READY once bound
- `packages/frontend/src/features/callcenter/lib/shiftLoginQueues.ts` — validate / load / save last queues
- `packages/frontend/src/features/callcenter/lib/shiftLoginQueues.test.ts` — unit tests for queue helpers
- `packages/frontend/src/features/callcenter/ui/ShiftLoginModal/ShiftLoginModal.tsx` — queuesRequired gate + restore/persist
- `packages/frontend/src/shared/config/locales/en.ts` / `ru.ts` — `callcenter.softphone.queuesRequired`

## Decisions Made
- Use `ShiftLoginResult.interface` for Redux bind — backend login unwrap is `{ success, sessionId }` only
- Keep backend queues optional; UI gate is enough for UAT (empty array remains API no-op)
- SSE fallback is recover-only; never clear interface on OFFLINE agentUpdate (logout owns clear)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Clear queuesRequired error when queues change**
- **Found during:** Task 2
- **Issue:** After empty-queue validation error, selecting a queue left the error text visible
- **Fix:** MultiSelect `onChange` clears `micError`
- **Files modified:** `ShiftLoginModal.tsx`
- **Verification:** code review / acceptance grep
- **Committed in:** `2696d15`

**Total deviations:** 1 auto-fixed (Rule 2)
**Impact on plan:** Minor UX correctness; no scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. (WSS URL documentation is plan 07-22.)

## Next Phase Readiness
- UAT Test 1 PRIMARY unblocked for Start Shift → READY / End Shift → OFFLINE
- Plan 07-22 can document ASTERISK_WSS_URL / WebRTC config for missing-WSS path
- Manual UAT still needed: pick ≥1 queue, confirm inbound QueueAdd / reports

## TDD Gate Compliance
- Task 1: `test(07-21)` `2faa4ae` → `feat(07-21)` `b6eed52`
- Task 2: `test(07-21)` `a1d5e28` → `feat(07-21)` `2696d15`

## Known Stubs
None - no placeholder/TODO stubs introduced that block the plan goal.

## Self-Check: PASSED
- SUMMARY.md, shiftLoginQueues.ts, CallCenterAgentPage.tsx, useCallCenterSSE.ts, ShiftLoginModal.tsx present
- Commits 2faa4ae, b6eed52, a1d5e28, 2696d15 present
- Unit tests: 38 passed (selectors, SSE, slice, shiftLoginQueues)

---
*Phase: 07-call-center-overhaul-professional-agent-supervisor-workspace*
*Completed: 2026-07-16*
