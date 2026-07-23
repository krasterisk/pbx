---
phase: 09-call-center-agent-panel
plan: 15
subsystem: ui
tags: [callcenter, CallCenterAgentPage, CallControlBar, ParkedCallsIndicator, TransferDirectory, CallHistoryPanel, gap-closure]

requires:
  - phase: 09-call-center-agent-panel
    provides: CallControlBar full variant + ParkedCallsIndicator (09-10), TransferDirectory + CallHistoryPanel (09-12), park/warm-transfer/zombie-reset APIs (09-07)
provides:
  - Mounted park/retrieve/zombie-reset via CallControlBar variant=full gated on showCallControls
  - Persistent ParkedCallsIndicator in agent header chrome
  - Transfer Modal wired to TransferDirectory mode=transfer (endpoint targets)
  - CallHistoryPanel as fourth history panel/tab with D-05 visibility + i18n
affects: [09-verification, uat, operator-workspace]

tech-stack:
  added: []
  patterns:
    - "Wire orphaned feature components into CallCenterAgentPage; do not rebuild"
    - "Full CallControlBar gated on showCallControls (connected call), not showCallPanel (ringing)"
    - "Single executeTransfer(target) shared by manual input and directory pick"

key-files:
  created: []
  modified:
    - packages/frontend/src/pages/CallCenterAgentPage/CallCenterAgentPage.tsx
    - packages/frontend/src/pages/CallCenterAgentPage/CallCenterAgentPage.module.scss
    - packages/frontend/src/pages/CallCenterAgentPage/CallCenterAgentPage.test.tsx
    - packages/frontend/src/shared/config/locales/en.ts
    - packages/frontend/src/shared/config/locales/ru.ts

key-decisions:
  - "Gate CallControlBar variant=full on showCallControls so park/zombie-reset never appear while IncomingCallToast owns ringing UI"
  - "uniqueid/isZombie derived only from live activeCall (T-09-15-01/02)"
  - "Directory transfer closes gap 2 for endpoint rows only; queue/group transfer CTA remains follow-up"
  - "history panel defaults visible via effectivePanelVisibility; IUiVisibility open map needs no schema change"

patterns-established:
  - "Gap-closure mounts: import existing feature barrel/module components into page orchestrator + stub in page tests"

requirements-completed: [D-05, D-27, D-28, D-29, D-34, D-35, D-36, D-37]

coverage:
  - id: D1
    description: "Park/retrieve/warm-transfer/zombie-reset reachable from CallCenterAgentPage via CallControlBar full + ParkedCallsIndicator"
    requirement: "D-27"
    verification:
      - kind: unit
        ref: "packages/frontend/src/pages/CallCenterAgentPage/CallCenterAgentPage.test.tsx"
        status: pass
      - kind: other
        ref: "rg CallControlBar|ParkedCallsIndicator CallCenterAgentPage.tsx"
        status: pass
    human_judgment: true
    rationale: "Live park/retrieve/zombie-reset against AMI requires tenant UAT"
  - id: D2
    description: "Blind/attended transfer can pick a BLF-aware directory endpoint target"
    requirement: "D-36"
    verification:
      - kind: other
        ref: "rg TransferDirectory CallCenterAgentPage.tsx"
        status: pass
    human_judgment: true
    rationale: "Live blind/attended transfer to directory endpoint needs tenant UAT; queue/group CTA out of scope"
  - id: D3
    description: "Operator call history panel mounted with shift/day and click-to-call reachability"
    requirement: "D-34"
    verification:
      - kind: unit
        ref: "packages/frontend/src/pages/CallCenterAgentPage/CallCenterAgentPage.test.tsx"
        status: pass
      - kind: other
        ref: "rg CallHistoryPanel|callcenter.tabs.history CallCenterAgentPage.tsx"
        status: pass
    human_judgment: true
    rationale: "Click-to-callback and open-card against live CDR/history needs tenant UAT"

duration: 14min
completed: 2026-07-23
status: complete
---

# Phase 09 Plan 15: Gap Closure Orchestrator Wiring Summary

**Mounted orphaned CallControlBar/ParkedCallsIndicator/TransferDirectory/CallHistoryPanel into CallCenterAgentPage so park, directory transfer, and operator history are reachable live**

## Performance

- **Duration:** 14 min
- **Started:** 2026-07-23T03:50:00Z
- **Completed:** 2026-07-23T04:04:00Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- Persistent `ParkedCallsIndicator` in header chrome; `CallControlBar variant="full"` gated on `showCallControls` with `uniqueid`/`isZombie` from live `activeCall`
- Transfer Modal hosts `TransferDirectory mode="transfer"` via shared `executeTransfer(target)` (blind/attended host toggle preserved)
- Fourth `history` panel/tab mounts `CallHistoryPanel` with D-05 visibility default-on and `callcenter.tabs.history` ru/en keys

## Task Commits

Each task was committed atomically:

1. **Task 1: Mount park / retrieve / warm-transfer / zombie-reset controls** - `d58e8f9` (feat)
2. **Task 2: Wire Transfer Modal to TransferDirectory mode=transfer** - `abc7698` (feat)
3. **Task 3: Mount CallHistoryPanel as toggleable panel/tab** - `e18433e` (feat)

**Plan metadata:** (pending docs commit)

## Files Created/Modified
- `packages/frontend/src/pages/CallCenterAgentPage/CallCenterAgentPage.tsx` - Orchestrator mounts all four previously orphaned surfaces
- `packages/frontend/src/pages/CallCenterAgentPage/CallCenterAgentPage.module.scss` - `.fullControlBar` layout within call chrome
- `packages/frontend/src/pages/CallCenterAgentPage/CallCenterAgentPage.test.tsx` - Stubs for ParkedCallsIndicator + CallHistoryPanel
- `packages/frontend/src/shared/config/locales/en.ts` - `callcenter.tabs.history`
- `packages/frontend/src/shared/config/locales/ru.ts` - `callcenter.tabs.history`

## Decisions Made
- Gate full control bar on `showCallControls` (not `showCallPanel`) so ringing stays with IncomingCallToast
- Derive park/zombie channel identity only from live `activeCall` state
- Close directory-transfer gap for endpoint rows only; queue/group transfer CTA documented follow-up
- History panel visibility uses existing open `IUiVisibility` map with default `true`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `npx tsc -p packages/frontend/tsconfig.json --noEmit` still reports a pre-existing error in `callCenterSlice.test.ts` (`null` vs `string | undefined`) unrelated to this plan; page suite green.

## Known Stubs
None that block plan goals — page-test `vi.mock` stubs for ParkedCallsIndicator/CallHistoryPanel are test doubles only; production page mounts real components.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Three 09-VERIFICATION gaps closed at the orchestrator layer; ready for `/gsd-verify-work 9` / live UAT of park, directory transfer, and history click-to-call.
- Follow-up: TransferDirectory queue/group transfer CTAs (out of scope here).

## Self-Check: PASSED

- FOUND: CallCenterAgentPage.tsx, module.scss, test.tsx, en.ts, ru.ts, 09-15-SUMMARY.md
- FOUND: commits d58e8f9, abc7698, e18433e
- FOUND: CallControlBar, ParkedCallsIndicator, TransferDirectory, CallHistoryPanel mounts in page
- `npm run test:frontend -- CallCenterAgentPage` — 2/2 passed

---
*Phase: 09-call-center-agent-panel*
*Completed: 2026-07-23*
