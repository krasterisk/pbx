---
phase: 15-universal-pbx-ai-agent
plan: 18
subsystem: ui
tags: [ai-agent, sse-stream, progress, stop, follow-scroll, d-09, d-13]

requires:
  - phase: 15-universal-pbx-ai-agent
    provides: In-process turn SSE with progress, cancel and max_steps_exceeded (15-08)
  - phase: 15-universal-pbx-ai-agent
    provides: DiffConfirmCard in the transcript at the producing turn (15-14)
provides:
  - useAgentStream consumes the turn SSE, localises per-step progress, accumulates text
  - Stop, ceiling, failure and disconnect are four distinct tested outcomes
  - Follow-the-stream scrolling with jump-to-latest when the reader scrolls up
affects:
  - 15-15 (composer sits beside a live streaming transcript)
  - 15-19 (streaming copy keys already appended inside aiChat.*)

actuals:
  tokens: 14258
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - In-flight turn lives in the client store; committed messages stay on the server
    - Progress lines come from a tool→locale map with a neutral fallback, never the raw identifier
    - AbortController plus an ignore-after-stop guard; close of the panel also aborts
    - Follow is derived from scroll position with a 48px bottom tolerance

key-files:
  created:
    - packages/frontend/src/features/ai-chat/model/useAgentStream.ts
    - packages/frontend/src/features/ai-chat/model/useAgentStream.test.ts
  modified:
    - packages/frontend/src/features/ai-chat/model/slice/aiChatSlice.ts
    - packages/frontend/src/widgets/AiChatWidget/AiChatWidget.tsx
    - packages/frontend/src/widgets/AiChatWidget/AiChatWidget.module.scss
    - packages/frontend/src/widgets/AiChatWidget/AiChatWidget.test.tsx
    - packages/frontend/src/shared/api/endpoints/aiChatApi.ts
    - packages/frontend/src/shared/config/locales/en.ts
    - packages/frontend/src/shared/config/locales/ru.ts

key-decisions:
  - "Progress names the step from a localised tool map; unknown tools use a neutral phrase"
  - "Stop, ceiling, failure and disconnect keep distinct outcomes and copy"
  - "Follow only while the reader is at the bottom; jump-to-latest resumes it"
  - "A mid-stream change card stays in the transcript and is not a terminal event"

patterns-established:
  - "Pattern: stream hook owns AbortController, event routing and terminal outcomes"
  - "Pattern: later locale writers append inside aiChat.* rather than restructuring"

requirements-completed: [D-09, D-13]

coverage:
  - id: D1
    description: While a turn runs, the panel shows a localised line per step (D-09, D-13)
    requirement: D-09
    verification:
      - kind: unit
        ref: packages/frontend/src/features/ai-chat/model/useAgentStream.test.ts#streams progress lines and accumulated answer text from a fixture turn
        status: pass
      - kind: unit
        ref: packages/frontend/src/features/ai-chat/model/useAgentStream.test.ts#names the step in the interface language, not the raw tool identifier
        status: pass
    human_judgment: false
  - id: D2
    description: A stop control ends the turn and nothing further renders after it (D-09)
    requirement: D-09
    verification:
      - kind: unit
        ref: packages/frontend/src/features/ai-chat/model/useAgentStream.test.ts#ignores further stream events after stop
        status: pass
      - kind: unit
        ref: packages/frontend/src/widgets/AiChatWidget/AiChatWidget.test.tsx#pressing stop calls the stream abort and shows the stopped outcome
        status: pass
    human_judgment: false
  - id: D3
    description: Reaching the step ceiling is its own outcome, distinct from stop and failure (D-09)
    requirement: D-09
    verification:
      - kind: unit
        ref: packages/frontend/src/features/ai-chat/model/useAgentStream.test.ts#marks the ceiling as its own outcome, distinct from stop and failure
        status: pass
    human_judgment: false
  - id: D4
    description: A dropped connection keeps the partial answer and offers reconnect (D-09)
    requirement: D-09
    verification:
      - kind: unit
        ref: packages/frontend/src/features/ai-chat/model/useAgentStream.test.ts#keeps the partial answer and reports disconnect when the stream drops
        status: pass
      - kind: unit
        ref: packages/frontend/src/widgets/AiChatWidget/AiChatWidget.test.tsx#renders ceiling, failure and disconnect as distinct outcomes
        status: pass
    human_judgment: false
  - id: D5
    description: Raw tool result payloads never appear in the rendered conversation (T-15-82, D-13)
    requirement: D-13
    verification:
      - kind: unit
        ref: packages/frontend/src/features/ai-chat/model/useAgentStream.test.ts#never exposes a raw tool result payload in the conversation
        status: pass
    human_judgment: false
  - id: D6
    description: The conversation follows new content only while the reader is at the bottom
    verification:
      - kind: unit
        ref: packages/frontend/src/widgets/AiChatWidget/AiChatWidget.test.tsx#keeps the conversation at the bottom while the reader is already there
        status: pass
      - kind: unit
        ref: packages/frontend/src/widgets/AiChatWidget/AiChatWidget.test.tsx#stops following after the user scrolls up and shows jump-to-latest
        status: pass
      - kind: unit
        ref: packages/frontend/src/widgets/AiChatWidget/AiChatWidget.test.tsx#resumes following when the reader returns to the bottom
        status: pass
    human_judgment: false
  - id: D7
    description: A change card arriving mid-stream renders in place and text continues below it (D-19)
    requirement: D-19
    verification:
      - kind: unit
        ref: packages/frontend/src/widgets/AiChatWidget/AiChatWidget.test.tsx#renders a mid-stream change card in place and continues the text below it
        status: pass
    human_judgment: false

duration: 18min
completed: 2026-09-04
status: complete
---

# Phase 15 Plan 18: Streaming Progress, Stop, and Follow-Scroll Summary

**Per-step localised progress, a stop that really stops, distinct ceiling/disconnect outcomes, and follow-the-stream scrolling that yields when the reader scrolls up**

## Performance

- **Duration:** 18 min
- **Started:** 2026-09-04T13:47:00Z
- **Completed:** 2026-09-04T14:05:00Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- `useAgentStream` consumes the turn SSE, maps tools to interface-language progress lines, and accumulates text on one assistant message
- Stop aborts the request, ignores buffered events, and marks the turn stopped; closing the panel also aborts
- Ceiling, failure and disconnect stay distinct; a drop keeps the partial answer and offers reconnect
- The conversation follows new content only while at the bottom; jump-to-latest resumes following
- A mid-stream change card stays in the transcript; raw tool payloads never enter the conversation

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1 RED: failing stream-turn progress tests** - `0c70c2e` (test)
2. **Task 1 GREEN: stream hook, progress mapping, text accumulation** - `8d98437` (feat)
3. **Task 2 RED: failing stop / ceiling / disconnect tests** - `9150721` (test)
4. **Task 2 GREEN: wire stop, outcomes and abort-on-close** - `9b26f9c` (feat)
5. **Task 3 RED: failing follow-scroll and locale tests** - `d1e95d6` (test)
6. **Task 3 GREEN: follow-scroll, mid-stream cards, streaming copy** - `e54efa1` (feat)

**Plan metadata:** docs commit (SUMMARY + STATE + ROADMAP) follows this file

_Note: TDD tracer/auto tasks have two commits each (test → feat)._

## Files Created/Modified

- `packages/frontend/src/features/ai-chat/model/useAgentStream.ts` — stream consumption, cancellation, terminal outcomes
- `packages/frontend/src/features/ai-chat/model/useAgentStream.test.ts` — fixture turn, stop, ceiling, disconnect, no raw payloads
- `packages/frontend/src/features/ai-chat/model/slice/aiChatSlice.ts` — progress lines and turn outcome on the in-flight store
- `packages/frontend/src/shared/api/endpoints/aiChatApi.ts` — progress / disconnect / error-code routing, threadUid on the turn POST
- `packages/frontend/src/widgets/AiChatWidget/AiChatWidget.tsx` — stop, outcomes, follow-scroll, mid-stream card
- `packages/frontend/src/widgets/AiChatWidget/AiChatWidget.module.scss` — progress, outcome and jump-to-latest chrome
- `packages/frontend/src/widgets/AiChatWidget/AiChatWidget.test.tsx` — stop, outcomes, follow, card, locale keys
- `packages/frontend/src/shared/config/locales/en.ts` — appended `aiChat.progress.*` and streaming outcomes
- `packages/frontend/src/shared/config/locales/ru.ts` — matching Russian contract copy

## Decisions Made

- Progress is a localised tool map with a neutral fallback; the backend label that embeds the raw tool name is ignored
- Four terminal outcomes stay separate: done, stopped, ceiling, disconnected (plus failed)
- Follow is derived from scroll position (48px tolerance), not an unconditional scroll on every token
- Mid-stream cards use the 15-14 card in the transcript; arrival is not a terminal event

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] In-flight messages rendered only after a thread was selected**
- **Found during:** Task 2 GREEN
- **Issue:** A disconnect test with a partial answer showed welcome instead of the text, because `items` was empty when `selectedThreadUid` was null.
- **Fix:** Always append in-flight messages; committed messages still require a selected thread.
- **Files modified:** `packages/frontend/src/widgets/AiChatWidget/AiChatWidget.tsx`
- **Verification:** disconnect outcome test shows `partial so far`
- **Committed in:** `9b26f9c`

**2. [Rule 3 - Blocking] `VStack` does not forward `ref`**
- **Found during:** Task 3 GREEN
- **Issue:** Follow detection needs the scroller node; `VStack` is not `forwardRef`.
- **Fix:** The messages scroller is a `Flex` so the ref and `onScroll` attach.
- **Files modified:** `packages/frontend/src/widgets/AiChatWidget/AiChatWidget.tsx`
- **Verification:** three follow-scroll tests pass
- **Committed in:** `e54efa1`

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Required for a visible partial answer and for follow detection. No scope creep.

## Issues Encountered

- PowerShell cannot run bash heredoc commits; used `-m` with multiple paragraphs.
- Task 2 hook tests for stop / ceiling / disconnect were already green from Task 1 GREEN (stream API surface). Widget tests were the RED for Task 2.

## TDD Gate Compliance

- Task 1: RED `0c70c2e` then GREEN `8d98437`
- Task 2: RED `9150721` then GREEN `9b26f9c`
- Task 3: RED `d1e95d6` then GREEN `e54efa1`
- Tracer verify after Task 1 re-ran `src/features/ai-chat` (28 passed) and continued (`human_verify_mode` default end-of-phase)

## Auth Gates

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Panel already consumes progress, stop, ceiling, disconnect and mid-stream cards
- 15-15 remains blocked on its human checkpoint; do not implement it here
- Later locale writers must append inside `aiChat.*`

## Verification

```
npm run test -w @krasterisk/frontend -- src/widgets/AiChatWidget src/features/ai-chat
```

54 passed.

## Self-Check: PASSED

- FOUND: `packages/frontend/src/features/ai-chat/model/useAgentStream.ts`
- FOUND: `packages/frontend/src/features/ai-chat/model/useAgentStream.test.ts`
- FOUND: `packages/frontend/src/widgets/AiChatWidget/AiChatWidget.tsx`
- FOUND: `.planning/phases/15-universal-pbx-ai-agent/15-18-SUMMARY.md`
- FOUND: commits `0c70c2e` `8d98437` `9150721` `9b26f9c` `d1e95d6` `e54efa1`

---
*Phase: 15-universal-pbx-ai-agent*
*Completed: 2026-09-04*
