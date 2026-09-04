---
phase: 15-universal-pbx-ai-agent
plan: 12
subsystem: ui
tags: [ai-agent, thread-rail, rtk-query, i18n, d-26]

requires:
  - phase: 15-universal-pbx-ai-agent
    provides: Tenant- and author-scoped AgentThread persistence (15-03)
  - phase: 15-universal-pbx-ai-agent
    provides: 520px panel with 240px thread-rail slot (15-06)
provides:
  - Conversation list/detail/create/delete queries with AiChatThreads tag invalidation
  - ThreadList rail with select, create, guarded delete, and four states
  - Panel-owned selection that hydrates messages from the detail query
affects:
  - 15-13 (threads in the rail slot)
  - 15-14 (diff cards inside the conversation column)
  - 15-18 (streaming / stop in the composer)

actuals:
  tokens: 9878
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - Selection lives on AiChatWidget; ThreadList is controlled and reports
    - Committed messages come from GET /ai-chat/threads/:uid; the slice is in-flight only
    - Later frontend plans append keys inside aiChat.* rather than restructuring

key-files:
  created:
    - packages/frontend/src/features/ai-chat/ui/ThreadList/ThreadList.tsx
    - packages/frontend/src/features/ai-chat/ui/ThreadList/ThreadList.module.scss
    - packages/frontend/src/features/ai-chat/ui/ThreadList/ThreadList.test.tsx
    - packages/frontend/src/features/ai-chat/ui/ThreadList/index.ts
  modified:
    - packages/frontend/src/shared/api/endpoints/aiChatApi.ts
    - packages/frontend/src/shared/api/rtkApi.ts
    - packages/frontend/src/features/ai-chat/model/slice/aiChatSlice.ts
    - packages/frontend/src/widgets/AiChatWidget/AiChatWidget.tsx
    - packages/frontend/src/widgets/AiChatWidget/AiChatWidget.test.tsx
    - packages/frontend/src/shared/config/locales/en.ts
    - packages/frontend/src/shared/config/locales/ru.ts

key-decisions:
  - "Panel owns selectedThreadUid; the rail only renders and reports so composer and messages share one selection"
  - "Thread response types live in aiChatApi.ts because @krasterisk/shared has no AgentThread types yet"
  - "AiChatThreads tag added to rtkApi so create/delete refresh the list without a handwritten refetch"
  - "Client store dropped sessionStorage hydration; committed history is server-owned"

patterns-established:
  - "Pattern: controlled ThreadList — selectedUid + onSelect + onDeleted, list query inside the rail"
  - "Pattern: later frontend plans append keys inside aiChat.* rather than restructuring the namespace"

requirements-completed: [D-26]

coverage:
  - id: D1
    description: Conversations persist and reopen from the rail with stored messages rather than an in-memory replay
    requirement: D-26
    verification:
      - kind: unit
        ref: packages/frontend/src/widgets/AiChatWidget/AiChatWidget.test.tsx#loads stored messages when a conversation is selected from the rail
        status: pass
      - kind: unit
        ref: packages/frontend/src/features/ai-chat/ui/ThreadList/ThreadList.test.tsx#lists conversations newest first with title and relative time
        status: pass
    human_judgment: false
  - id: D2
    description: The rail shows distinct loading, empty, error and populated states
    requirement: D-26
    verification:
      - kind: unit
        ref: packages/frontend/src/features/ai-chat/ui/ThreadList/ThreadList.test.tsx#shows skeleton rows while the list is loading and hides empty copy
        status: pass
      - kind: unit
        ref: packages/frontend/src/features/ai-chat/ui/ThreadList/ThreadList.test.tsx#shows empty-state copy and the new-conversation action when there are no threads
        status: pass
      - kind: unit
        ref: packages/frontend/src/features/ai-chat/ui/ThreadList/ThreadList.test.tsx#shows error copy and a retry that refires the list query
        status: pass
    human_judgment: false
  - id: D3
    description: Delete asks for confirmation; keep is the safe action; deleting the selection clears the conversation column
    requirement: D-26
    verification:
      - kind: unit
        ref: packages/frontend/src/features/ai-chat/ui/ThreadList/ThreadList.test.tsx#asks for confirmation before deleting and keeps the conversation on dismiss
        status: pass
      - kind: unit
        ref: packages/frontend/src/widgets/AiChatWidget/AiChatWidget.test.tsx#clears the conversation column after deleting the selected conversation
        status: pass
    human_judgment: false
  - id: D4
    description: Starting a new conversation leaves the previous one intact at the top of the rail
    requirement: D-26
    verification:
      - kind: unit
        ref: packages/frontend/src/features/ai-chat/ui/ThreadList/ThreadList.test.tsx#creates a conversation and selects it so it appears at the top without a refresh
        status: pass
    human_judgment: false

duration: 24min
completed: 2026-09-04
status: complete
---

# Phase 15 Plan 12: Thread Rail And Conversation Restore Summary

**Persisted conversations reopen from the 240px rail with stored messages, four honest list states, and a keep-first delete confirm**

## Performance

- **Duration:** 24 min
- **Started:** 2026-09-04T11:11:00Z
- **Completed:** 2026-09-04T11:35:00Z
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments

- The 15-06 rail slot now lists tenant conversations newest first; selecting one hydrates the column from the detail query instead of replaying the client store
- Create invalidates the list tag so a new conversation appears at the top without a manual refresh and leaves the previous row intact
- Loading shows three skeletons, empty and error have distinct copy plus retry, and delete uses the contract keep/delete phrasing
- `aiChatSlice` no longer hydrates committed history from sessionStorage

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: failing tests for reopen / rail selection** - `34d9f3d` (test)
2. **Task 1 GREEN: queries, ThreadList, panel wiring** - `612ad5a` (feat)
3. **Task 2 RED: failing tests for states and delete** - `c6c1d6e` (test)
4. **Task 2 GREEN: four states, guarded delete, in-flight-only slice** - `7bac3c9` (feat)
5. **Task 3: rail locale keys** - `7dbd985` (feat)

**Plan metadata:** docs(15-12): complete thread rail plan

_Note: TDD tasks produced RED then GREEN commits_

## Files Created/Modified

- `packages/frontend/src/shared/api/endpoints/aiChatApi.ts` - Thread list, detail, create, delete with AiChatThreads tags
- `packages/frontend/src/shared/api/rtkApi.ts` - Registered `AiChatThreads` tag type
- `packages/frontend/src/features/ai-chat/ui/ThreadList/ThreadList.tsx` - Controlled rail with select, create, states, confirm delete
- `packages/frontend/src/features/ai-chat/ui/ThreadList/ThreadList.module.scss` - Selected row, skeletons, empty/error
- `packages/frontend/src/features/ai-chat/ui/ThreadList/ThreadList.test.tsx` - List, selection, states, delete
- `packages/frontend/src/features/ai-chat/ui/ThreadList/index.ts` - Public export
- `packages/frontend/src/features/ai-chat/model/slice/aiChatSlice.ts` - In-flight turn only; sessionStorage gone
- `packages/frontend/src/widgets/AiChatWidget/AiChatWidget.tsx` - Fills the rail slot; selection and deleted-selection recovery
- `packages/frontend/src/widgets/AiChatWidget/AiChatWidget.test.tsx` - Restore from rail; delete clears the column
- `packages/frontend/src/shared/config/locales/en.ts` - Appended rail keys inside `aiChat.*`
- `packages/frontend/src/shared/config/locales/ru.ts` - Matching Russian contract copy

## Decisions Made

- Selection is lifted to the panel because the composer and conversation column need the same uid
- Response types are declared next to the queries; shared has no AgentThread contract yet
- `AiChatThreads` had to be added to `rtkApi` tagTypes or create/delete could not invalidate the list
- Geometry tokens from 15-06 were left untouched

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Registered AiChatThreads on rtkApi**
- **Found during:** Task 1 (conversation queries)
- **Issue:** Tag-based invalidation requires the tag in `rtkApi.tagTypes`; the plan's `files_modified` omitted that file
- **Fix:** Appended `AiChatThreads` next to `AiChatSettings`
- **Files modified:** `packages/frontend/src/shared/api/rtkApi.ts`
- **Verification:** ThreadList create/delete contract test and 23 targeted tests pass
- **Committed in:** `612ad5a` (Task 1 GREEN)

**2. [Rule 3 - Blocking] Thread types live in aiChatApi.ts**
- **Found during:** Task 1
- **Issue:** Plan said to type responses from the shared package; `@krasterisk/shared` has no AgentThread types
- **Fix:** Declared `IAiChatThread` / `IAiChatThreadMessage` / `IAiChatThreadDetail` in the query module to stay in scope
- **Files modified:** `packages/frontend/src/shared/api/endpoints/aiChatApi.ts`
- **Verification:** Endpoints compile; tests pass
- **Committed in:** `612ad5a` (Task 1 GREEN)

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 blocking)
**Impact on plan:** Required for list refresh and typing. No scope creep.

## Issues Encountered

None.

## TDD Gate Compliance

- Task 1: RED `34d9f3d` then GREEN `612ad5a`
- Task 2: RED `c6c1d6e` then GREEN `7bac3c9`
- Task 3: locale-only auto task, no TDD cycle required

## Auth Gates

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Rail is filled; 15-13 can reuse ThreadList without changing 15-06 geometry
- Backend HTTP for `/ai-chat/threads` is still the service-only 15-03 layer — the client is wired to the sketched paths
- Later frontend plans must append keys inside `aiChat.*`

---
## Self-Check: PASSED

- FOUND: `.planning/phases/15-universal-pbx-ai-agent/15-12-SUMMARY.md`
- FOUND: `34d9f3d` `612ad5a` `c6c1d6e` `7bac3c9` `7dbd985`
- FOUND: `packages/frontend/src/features/ai-chat/ui/ThreadList/ThreadList.tsx`
- FOUND: `packages/frontend/src/shared/api/endpoints/aiChatApi.ts`
- FOUND: `packages/frontend/src/widgets/AiChatWidget/AiChatWidget.tsx`

---
*Phase: 15-universal-pbx-ai-agent*
*Completed: 2026-09-04*
