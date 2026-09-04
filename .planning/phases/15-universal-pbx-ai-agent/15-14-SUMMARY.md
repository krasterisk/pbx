---
phase: 15-universal-pbx-ai-agent
plan: 14
subsystem: ui
tags: [ai-agent, diff-confirm-card, d-19, d-21, rtk-query, i18n]

requires:
  - phase: 15-universal-pbx-ai-agent
    provides: Authenticated apply/reject by proposal identifier (15-05)
  - phase: 15-universal-pbx-ai-agent
    provides: Thread rail and restore from detail query (15-12)
provides:
  - DiffConfirmCard with pending, applied, rejected, denied, expired and failed-retry
  - Confirm/reject mutations that send only the proposal identifier
  - Card placed in the conversation at the producing turn
affects:
  - 15-08 (stream proposal event consumed by the panel)
  - 15-18 (composer sits beside cards already in the transcript)

actuals:
  tokens: 8824
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - Confirm/reject POST carries only proposalId in the URL; no body
    - Settled cards omit actions rather than disabling them
    - Failed apply stays pending with error + retry; expired offers ask-again
    - Later frontend plans append keys inside aiChat.* rather than restructuring

key-files:
  created:
    - packages/frontend/src/features/ai-chat/ui/DiffConfirmCard/DiffConfirmCard.tsx
    - packages/frontend/src/features/ai-chat/ui/DiffConfirmCard/DiffConfirmCard.module.scss
    - packages/frontend/src/features/ai-chat/ui/DiffConfirmCard/DiffConfirmCard.test.tsx
    - packages/frontend/src/features/ai-chat/ui/DiffConfirmCard/index.ts
  modified:
    - packages/frontend/src/shared/api/endpoints/aiChatApi.ts
    - packages/frontend/src/widgets/AiChatWidget/AiChatWidget.tsx
    - packages/frontend/src/shared/config/locales/en.ts
    - packages/frontend/src/shared/config/locales/ru.ts

key-decisions:
  - "Agreement is a button on the card; confirm/reject send only the proposal identifier"
  - "Settled cards hide actions; failed apply stays pending with retry"
  - "Denied copy comes from locale keys (role limit), not the raw server reason"
  - "Expired offers ask-again rather than re-applying a stale payload"

patterns-established:
  - "Pattern: proposal view is presentational input; mutations take proposalId only"
  - "Pattern: card lives in the transcript at the producing turn, not in a modal"

requirements-completed: [D-19, D-21]

coverage:
  - id: D1
    description: Agreement is a button on a card that names the entity and each change line (D-19)
    requirement: D-19
    verification:
      - kind: unit
        ref: packages/frontend/src/features/ai-chat/ui/DiffConfirmCard/DiffConfirmCard.test.tsx#renders the entity label, every change line and both actions
        status: pass
      - kind: unit
        ref: packages/frontend/src/features/ai-chat/ui/DiffConfirmCard/DiffConfirmCard.test.tsx#sends only the proposal identifier on confirm and moves the card to applied
        status: pass
    human_judgment: false
  - id: D2
    description: Confirmed, rejected or denied cards cannot be confirmed again
    requirement: D-19
    verification:
      - kind: unit
        ref: packages/frontend/src/features/ai-chat/ui/DiffConfirmCard/DiffConfirmCard.test.tsx#cannot confirm a denied or already settled card again
        status: pass
    human_judgment: false
  - id: D3
    description: A denied card explains that the caller's role does not permit the change (D-21)
    requirement: D-21
    verification:
      - kind: unit
        ref: packages/frontend/src/features/ai-chat/ui/DiffConfirmCard/DiffConfirmCard.test.tsx#shows the permission explanation on a denied card and hides both actions
        status: pass
    human_judgment: false
  - id: D4
    description: Failed confirmation stays pending with the error and a retry, not success
    requirement: D-19
    verification:
      - kind: unit
        ref: packages/frontend/src/features/ai-chat/ui/DiffConfirmCard/DiffConfirmCard.test.tsx#keeps a failed apply pending with the error and a retry
        status: pass
    human_judgment: false
  - id: D5
    description: A card from a reopened conversation renders in its stored state at the producing turn
    requirement: D-19
    verification:
      - kind: unit
        ref: packages/frontend/src/widgets/AiChatWidget/AiChatWidget.test.tsx#places a stored change card at the turn that produced it
        status: pass
    human_judgment: false

duration: 18min
completed: 2026-09-04
status: complete
---

# Phase 15 Plan 14: Diff Confirm Card Summary

**Explicit change card: button agreement (never typed yes), five honest states, confirm/reject by proposal id only**

## Performance

- **Duration:** 18 min
- **Started:** 2026-09-04T11:50:00Z
- **Completed:** 2026-09-04T12:08:00Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- A pending card names the entity and every change line; agreement is Apply/Reject, never typed yes
- Confirm and reject POST only the proposal identifier; tenant, author and role stay on the token
- Applied, rejected and denied cards hide actions; denied explains the role limit from the locale
- Failed apply stays pending with the error and a retry; expired offers to ask the agent again
- A stored proposal from a reopened conversation renders at the turn that produced it

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: failing tests for confirm from the card** - `f20b7de` (test)
2. **Task 1 GREEN: card, mutations, transcript placement** - `f4597ac` (feat)
3. **Task 2 RED: failing tests for settled / denied / failed / expired** - `bf35f74` (test)
4. **Task 2 GREEN: terminal states, retry, ask-again** - `db6bfa8` (feat)
5. **Task 3: card locale keys** - `0c4464f` (feat)

**Plan metadata:** docs commit (SUMMARY + STATE + ROADMAP) follows this file

_Note: TDD tasks produced RED then GREEN commits._

## Files Created/Modified

- `packages/frontend/src/features/ai-chat/ui/DiffConfirmCard/DiffConfirmCard.tsx` - Five-state card driven by the client proposal view
- `packages/frontend/src/features/ai-chat/ui/DiffConfirmCard/DiffConfirmCard.module.scss` - Token-based card chrome
- `packages/frontend/src/features/ai-chat/ui/DiffConfirmCard/DiffConfirmCard.test.tsx` - Confirm, reject, XSS, settled, failed, expired
- `packages/frontend/src/features/ai-chat/ui/DiffConfirmCard/index.ts` - Public export
- `packages/frontend/src/shared/api/endpoints/aiChatApi.ts` - confirm/reject mutations and proposal stream event
- `packages/frontend/src/widgets/AiChatWidget/AiChatWidget.tsx` - Card at the producing turn; stream `onProposal`
- `packages/frontend/src/shared/config/locales/en.ts` - Appended `aiChat.card.*`
- `packages/frontend/src/shared/config/locales/ru.ts` - Matching Russian contract copy

## Decisions Made

- Confirm/reject send only `proposalId` in the URL; the request has no body and never a confirmation flag
- Settled cards omit buttons rather than greying them out
- Failed apply keeps `pending` so a half-applied switch reload can be retried
- Expired offers ask-again, not retry, so a stale payload is not re-applied
- Denied explanation is locale copy (D-21), not the server's coded reason

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Applied-time assertion was timezone-fragile**
- **Found during:** Task 2 GREEN
- **Issue:** The RED spec expected `/15:42|3:42/` from a UTC ISO timestamp; local UTC+7 renders `22:42`.
- **Fix:** Assert the same `toLocaleTimeString` the card uses.
- **Files modified:** `packages/frontend/src/features/ai-chat/ui/DiffConfirmCard/DiffConfirmCard.test.tsx`
- **Verification:** 27 targeted tests pass
- **Committed in:** `db6bfa8`

**2. [Rule 2 - Missing Critical] Invalidate AiChatThreads after confirm/reject**
- **Found during:** Task 1 GREEN
- **Issue:** A reopened conversation would keep showing pending unless the detail query refreshes.
- **Fix:** Both mutations invalidate `AiChatThreads`.
- **Files modified:** `packages/frontend/src/shared/api/endpoints/aiChatApi.ts`
- **Verification:** Mutation source assertion + widget restore test
- **Committed in:** `f4597ac`

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical)
**Impact on plan:** Required for honest restore and a timezone-safe time badge. No scope creep.

## Issues Encountered

- PowerShell cannot run bash heredoc commits; used `-m` with `` `n `` newlines.
- `applyPayload` appears in `isProposalClientView` as a negative guard; the mutation source assertion checks the query blocks have no `body:` instead of scanning the whole file.

## TDD Gate Compliance

- Task 1: RED `f20b7de` then GREEN `f4597ac`
- Task 2: RED `bf35f74` then GREEN `db6bfa8`
- Task 3: locale-only auto task, no TDD cycle required

## Auth Gates

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 15-08 can emit `event: proposal` and the panel already consumes `onProposal`
- Cards are in the conversation column; later composer/streaming plans must not move them into a modal
- Locale writers after this plan must append inside `aiChat.*`

## Verification

```
npm run test -w @krasterisk/frontend -- src/features/ai-chat/ui/DiffConfirmCard/DiffConfirmCard.test.tsx src/widgets/AiChatWidget/AiChatWidget.test.tsx
```

27 passed.

## Self-Check: PASSED

- FOUND: `packages/frontend/src/features/ai-chat/ui/DiffConfirmCard/DiffConfirmCard.tsx`
- FOUND: `packages/frontend/src/features/ai-chat/ui/DiffConfirmCard/DiffConfirmCard.test.tsx`
- FOUND: `packages/frontend/src/shared/api/endpoints/aiChatApi.ts`
- FOUND: `packages/frontend/src/widgets/AiChatWidget/AiChatWidget.tsx`
- FOUND: `.planning/phases/15-universal-pbx-ai-agent/15-14-SUMMARY.md`
- FOUND: commits `f20b7de` `f4597ac` `bf35f74` `db6bfa8` `0c4464f`

---
*Phase: 15-universal-pbx-ai-agent*
*Completed: 2026-09-04*
