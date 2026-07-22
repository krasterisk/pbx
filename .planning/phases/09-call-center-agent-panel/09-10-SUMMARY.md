---
phase: 09-call-center-agent-panel
plan: 10
subsystem: ui
tags: [react, rtk-query, redux, sse, i18n, call-center]

requires:
  - phase: 09-07
    provides: park/retrieve/conference/zombie-reset/warm-transfer-to-queue backend endpoints
  - phase: 09-08
    provides: CallCenterAgentPage hybrid orchestrator, QueuesTab warm-transfer precedent
  - phase: 09-09
    provides: grouped missed-calls query, personal flag, claim, callback >5s rule, auto-resolve
provides:
  - Grouped-by-number smart missed-calls worklist UI (claim/callback/resolve/badge escalation)
  - ParkedCallsIndicator (badge + dropdown + retrieve, info-tint)
  - CallControlBar full-variant real handlers (park/warm-transfer-to-queue/zombie-reset with confirm)
affects: [09-12 (transfer directory - conference-add wiring), 09-14 (permissions)]

tech-stack:
  added: []
  patterns:
    - "Feature UI components self-wire their own RTK mutation hooks instead of requiring host callback props (CallControlBar now matches the MissedCallsPanel/AgentStatusBar precedent); external callback props are kept as post-success notifications only, not the primary action path."

key-files:
  created:
    - packages/frontend/src/features/callcenter/ui/ParkedCallsIndicator/ParkedCallsIndicator.tsx
    - packages/frontend/src/features/callcenter/ui/ParkedCallsIndicator/ParkedCallsIndicator.module.scss
    - packages/frontend/src/features/callcenter/ui/ParkedCallsIndicator/index.ts
  modified:
    - packages/frontend/src/features/callcenter/ui/MissedCallsPanel/MissedCallsPanel.tsx
    - packages/frontend/src/features/callcenter/ui/MissedCallsPanel/MissedCallsPanel.module.scss
    - packages/frontend/src/features/callcenter/ui/CallControlBar/CallControlBar.tsx
    - packages/frontend/src/features/callcenter/index.ts
    - packages/frontend/src/shared/api/endpoints/callCenterApi.ts
    - packages/frontend/src/features/callcenter/lib/useCallCenterSSE.ts
    - packages/frontend/src/pages/CallCenterAgentPage/CallCenterAgentPage.tsx
    - packages/frontend/src/shared/config/locales/en.ts
    - packages/frontend/src/shared/config/locales/ru.ts
    - packages/backend/src/modules/ami/ami.service.ts
    - packages/backend/src/modules/callcenter/callcenter.controller.ts
    - packages/backend/src/modules/callcenter/callcenter.service.ts
    - packages/backend/src/modules/callcenter/callcenter.service.spec.ts

key-decisions:
  - "MissedCallsPanel dropped the client-side tel: dial fallback (onCallback prop) - callback now flows entirely server-side via callbackMissedCall (webrtc/pjsip branching), matching D-18's actual mechanism; CallCenterAgentPage's call site was updated to drop the now-removed prop."
  - "CallControlBar's full-variant park/warm-transfer/zombie-reset call their own RTK mutations directly (given a uniqueid prop) instead of only exposing callback props - conference-add stays callback-prop-only since the transfer directory it depends on ships in 09-12."
  - "Warm-transfer-to-queue in CallControlBar opens a DropdownMenu queue picker (mirrors QueuesTab's per-queue transfer button, generalized since the control bar has no single queue in context)."

patterns-established:
  - "Confirmation-gated destructive action: Dialog + locked copy (zombie-reset), same shape as DragTransfer's blind/attended confirm."

requirements-completed: [D-16, D-17, D-18, D-19, D-27, D-28, D-33, D-44]

coverage:
  - id: D1
    description: "Missed panel shows grouped-by-number rows with attempt count + last-attempt time + expandable attempt history (D-16)"
    requirement: "D-16"
    verification:
      - kind: unit
        ref: "npx tsc -p packages/frontend/tsconfig.json --noEmit"
        status: pass
    human_judgment: true
    rationale: "Visual grouping/expand-collapse interaction needs human UI verification; no component test exists for MissedCallsPanel yet."
  - id: D2
    description: "Personal vs queue-missed visually distinct; queue-missed has a claim action; badge escalates only when unclaimed pool > 0 (D-19)"
    requirement: "D-19"
    verification: []
    human_judgment: true
    rationale: "Badge color/tag visual distinction requires human UI verification."
  - id: D3
    description: "Auto-resolved rows tagged distinct from operator-callback success (D-17/D-18)"
    requirement: "D-17"
    verification: []
    human_judgment: true
    rationale: "Tag copy/styling requires human UI verification; backend logic already covered by 09-09's tests."
  - id: D4
    description: "ParkedCallsIndicator shows count + retrieve per entry, info-tint"
    requirement: "D-28"
    verification:
      - kind: unit
        ref: "npx tsc -p packages/frontend/tsconfig.json --noEmit"
        status: pass
    human_judgment: true
    rationale: "Info-tint color contract and dropdown UX need human visual check; no component test exists yet."
  - id: D5
    description: "CallControlBar full variant wires park/conference/zombie-reset(confirm)/warm-transfer; zombie button only when flagged"
    requirement: "D-27"
    verification:
      - kind: unit
        ref: "npx tsc -p packages/frontend/tsconfig.json --noEmit"
        status: pass
    human_judgment: true
    rationale: "Not mounted in any page yet (full variant has no current call site) - functional wiring verified by type-check only, needs a host page in a future plan to exercise interactively."

duration: 55min
completed: 2026-07-23
status: complete
---

# Phase 9 Plan 10: Smart Missed-Calls UI + Call-Control Additions Summary

**Reworked MissedCallsPanel into a number-grouped claim/callback/resolve worklist, added the info-tinted ParkedCallsIndicator, and wired CallControlBar's full-variant park/warm-transfer/zombie-reset buttons to real RTK mutations.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 3/3
- **Files modified:** 13 modified, 3 created

## Accomplishments
- `MissedCallsPanel` rebuilt around `getMissedCallsGrouped`: attempt-count badge, relative last-attempt time, expandable inline attempt history, Personal/queue-name tags, Claim button (shared pool), Callback button, resolved sub-view with distinct client-self-callback vs operator-callback success tags, badge escalates to warning only when unclaimed queue-missed count > 0.
- New `ParkedCallsIndicator`: badge + dropdown mirroring MissedCallsPanel's shape, info-tint (`--color-info`), per-entry Retrieve action.
- `CallControlBar` full variant: Park/Warm-transfer-to-queue/Zombie-reset now call their own RTK mutations (given a `uniqueid` prop); zombie-reset only renders when `isZombie` and is gated behind the locked confirmation dialog; warm-transfer opens a queue picker.
- Fixed a regression introduced mid-rework: restored the `cc:missed-call-new`/`cc:missed-call-update` window-event to `MissedCalls` RTK tag invalidation the pre-rework panel had, so the grouped worklist actually live-updates on SSE push.
- Fixed a stale `IMissedCall` frontend type missing `personal`/`client_called_back` (the backend model/response already returns both).

## Task Commits

1. **Task 1: RTK queries/mutations + SSE for missed + call-control** - `b2c8e03` (feat)
2. **Task 2: Rework MissedCallsPanel for grouping/claim/callback/resolve** - `8f047ae` (feat)
3. **Task 3: ParkedCallsIndicator + fill CallControlBar full-variant actions** - `e829ab0` (feat)

**Plan metadata:** pending (docs commit created after this file)

## Files Created/Modified
- `packages/frontend/src/features/callcenter/ui/ParkedCallsIndicator/ParkedCallsIndicator.tsx` - badge + dropdown + retrieve action
- `packages/frontend/src/features/callcenter/ui/ParkedCallsIndicator/ParkedCallsIndicator.module.scss` - info-tint styling
- `packages/frontend/src/features/callcenter/ui/ParkedCallsIndicator/index.ts` - barrel export
- `packages/frontend/src/features/callcenter/ui/MissedCallsPanel/MissedCallsPanel.tsx` - grouped rows, claim/callback/resolve rework
- `packages/frontend/src/features/callcenter/ui/MissedCallsPanel/MissedCallsPanel.module.scss` - new class set for the reworked layout
- `packages/frontend/src/features/callcenter/ui/CallControlBar/CallControlBar.tsx` - real park/warm-transfer/zombie-reset handlers
- `packages/frontend/src/features/callcenter/index.ts` - export `ParkedCallsIndicator`
- `packages/frontend/src/shared/api/endpoints/callCenterApi.ts` - grouped/claim/callback + park/retrieve/conference/zombie/warm-transfer hooks; fixed `IMissedCall` type
- `packages/frontend/src/features/callcenter/lib/useCallCenterSSE.ts` - parked-calls SSE invalidation listener
- `packages/frontend/src/pages/CallCenterAgentPage/CallCenterAgentPage.tsx` - updated MissedCallsPanel call site (prop removed)
- `packages/frontend/src/shared/config/locales/en.ts` / `ru.ts` - new missed/parked/controlBar strings
- `packages/backend/src/modules/ami/ami.service.ts` - fixed `parkedCalls()` to collect events properly (Task 1, previously committed)
- `packages/backend/src/modules/callcenter/callcenter.controller.ts` / `callcenter.service.ts` / `callcenter.service.spec.ts` - `getParkedCalls` endpoint + `queueName` aggregate (Task 1, previously committed)

## Decisions Made
- Callback now flows entirely server-side (`callbackMissedCall`); the `tel:` link fallback in `CallCenterAgentPage` was removed along with the `onCallback` prop it fed.
- `CallControlBar`'s full-variant action buttons are self-sufficient (own RTK mutations via a `uniqueid` prop) rather than purely presentational — matches the established "feature components call their own RTK hooks" pattern from 09-04. Conference-add stays callback-prop-only pending the 09-12 transfer directory.
- Warm-transfer-to-queue in the control bar needed a queue picker since (unlike QueuesTab) there's no single queue in context; used `shared/ui`'s `DropdownMenu` over the agent's own queues.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed stale `IMissedCall` interface missing `personal`/`client_called_back`**
- **Found during:** Task 2
- **Issue:** The frontend `IMissedCall` type (consumed by `getMissedCalls`, used for the resolved sub-view and attempt-history expansion) didn't declare `personal`/`client_called_back`, even though the backend model and `findAll()` response already include both columns.
- **Fix:** Added both fields to `IMissedCall`; removed the `as any` casts in `MissedCallsPanel.tsx` that were working around the gap.
- **Files modified:** `packages/frontend/src/shared/api/endpoints/callCenterApi.ts`, `packages/frontend/src/features/callcenter/ui/MissedCallsPanel/MissedCallsPanel.tsx`
- **Verification:** `npx tsc -p packages/frontend/tsconfig.json --noEmit` passes with no new errors.
- **Committed in:** `8f047ae` (Task 2 commit)

**2. [Rule 1 - Bug] Fixed `CallCenterAgentPage`'s now-broken `MissedCallsPanel` call site**
- **Found during:** Task 2
- **Issue:** Reworking `MissedCallsPanel` dropped its `onCallback` prop (callback now flows server-side), but the only mount site (`CallCenterAgentPage.tsx`) still passed `onCallback={handleMissedCallback}` — a compile error.
- **Fix:** Removed the prop and the now-dead `handleMissedCallback` (`tel:` link) callback.
- **Files modified:** `packages/frontend/src/pages/CallCenterAgentPage/CallCenterAgentPage.tsx`
- **Verification:** `npx tsc -p packages/frontend/tsconfig.json --noEmit` passes.
- **Committed in:** `8f047ae` (Task 2 commit)

**3. [Rule 1 - Bug] Restored missed-call SSE cache invalidation dropped during the MissedCallsPanel rework**
- **Found during:** Task 3 (discovered while validating Task 2's SSE claims before building on top of it)
- **Issue:** The pre-rework `MissedCallsPanel` listened for the `cc:missed-call-new` window event and invalidated the `MissedCalls` RTK tag on every new missed call. The Task 2 rework replaced this listener with only a `cc:missed-call-update` "attempt failed" flash handler, silently dropping the live-refresh behavior — the grouped worklist would only update on next manual refetch/mount, not on SSE push, despite the component's own doc-comment claiming otherwise.
- **Fix:** Added a dedicated effect that invalidates the `MissedCalls` tag on both `cc:missed-call-new` and `cc:missed-call-update` window events (dispatch via `rtkApi.util.invalidateTags`), restoring the original refresh behavior for the new grouped-list shape.
- **Files modified:** `packages/frontend/src/features/callcenter/ui/MissedCallsPanel/MissedCallsPanel.tsx`
- **Verification:** `npx tsc -p packages/frontend/tsconfig.json --noEmit` passes; manual trace of `useCallCenterSSE.ts` confirms both window events are dispatched on `missedCallNew`/`missedCallUpdate` SSE messages.
- **Committed in:** `e829ab0` (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1 - bugs directly caused by this plan's own edits, not pre-existing)
**Impact on plan:** All fixes were necessary to keep the plan's own deliverables correct and compiling. No scope creep beyond the files this plan already touches.

## Issues Encountered
- Nesting a `Tooltip` around a Radix `DropdownMenu` root (for the icon-only mobile warm-transfer-to-queue button) risked broken event forwarding since `DropdownMenu`'s Root doesn't render a DOM node. Resolved by dropping the `Tooltip` wrapper for that one control and using a native `title` attribute instead — still satisfies the "icon-only buttons need an accessible label" requirement (`aria-label` + `title`) without the nesting risk.
- `npm run test:cc` (backend) has one pre-existing failing test (`callcenter-chat.service.spec.ts` — `emitEvent` argument mismatch) unrelated to this plan; the file was last touched in phase 07 and this plan never modifies chat code. Confirmed via `git log` that the file predates this plan. Left as-is (out of scope per the fix-attempt scope boundary).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `ParkedCallsIndicator` and the `CallControlBar` full variant are built and exported but not yet mounted into `CallCenterAgentPage` (same "build standalone, mount later" precedent as `SoftphoneWidget` in 09-04/09-08) - a future plan needs to mount them and pass a real `uniqueid`/`isZombie` from the active-call state.
- Conference-add (`onConferenceClick`) is wired as a callback prop only; 09-12's transfer directory needs to supply the actual "add to conference" picker.
- `zombieCandidate` on `ICall` (added in Task 1) is not yet consumed by any page to compute the `isZombie` prop for `CallControlBar` - the future mounting plan should derive it from the active call.

---
*Phase: 09-call-center-agent-panel*
*Completed: 2026-07-23*

## Self-Check: PASSED
All created/modified files and all three task commit hashes (`b2c8e03`, `8f047ae`, `e829ab0`) verified present.
