---
phase: 07-call-center-overhaul-professional-agent-supervisor-workspace
plan: 07
subsystem: api
tags: [nestjs, sequelize, sse, rtk-query, redux, internal-chat, tenant-isolation]

requires:
  - phase: 07-call-center-overhaul-professional-agent-supervisor-workspace
    provides: CC routes /callcenter/* and SSE hook foundation (07-02)
provides:
  - cc_chat_messages + cc_chat_channels persistence with tenant isolation (D-32)
  - REST /callcenter/chat/* + SSE ccChatMessage with server-side recipient filter (D-30)
  - Direct, group, supervisor broadcast (all/queue) chat v1 (D-31)
  - ChatPanel + ChatThread in agent/supervisor ARM with i18n ru/en
affects:
  - 07-08 / 07-09 workspace layout refactor (chat panel mount point)
  - future chat UX polish (replace broadcast prompt)

tech-stack:
  added: []
  patterns:
    - "Chat transport: REST POST send + SSE ccChatMessage on existing tenant-filtered stream (no WebSocket)"
    - "recipientUserIds inside emitEvent data; SSE controller filters + strips before client"
    - "channel_key: dm:min:max | group:uid | broadcast:all | broadcast:queue:name"
    - "sender_user_id always from JWT; canAccessChannel before getHistory"

key-files:
  created:
    - packages/backend/src/modules/callcenter/models/chat-message.model.ts
    - packages/backend/src/modules/callcenter/models/chat-channel.model.ts
    - packages/backend/src/modules/callcenter/migrate-callcenter-chat-phase7.ts
    - packages/backend/src/modules/callcenter/callcenter-chat.service.ts
    - packages/backend/src/modules/callcenter/callcenter-chat.controller.ts
    - packages/backend/src/modules/callcenter/dto/chat.dto.ts
    - packages/frontend/src/features/callcenter/ui/ChatPanel/ChatPanel.tsx
    - packages/frontend/src/features/callcenter/ui/ChatPanel/ChatThread.tsx
  modified:
    - packages/backend/src/app.module.ts
    - packages/backend/src/modules/callcenter/callcenter.module.ts
    - packages/backend/src/modules/callcenter/callcenter-sse.controller.ts
    - packages/frontend/src/shared/api/endpoints/callCenterApi.ts
    - packages/frontend/src/shared/api/rtkApi.ts
    - packages/frontend/src/features/callcenter/lib/useCallCenterSSE.ts
    - packages/frontend/src/features/callcenter/model/slice/callCenterSlice.ts
    - packages/frontend/src/pages/CallCenterAgentPage/CallCenterAgentPage.tsx
    - packages/frontend/src/pages/CallCenterSupervisorPage/CallCenterSupervisorPage.tsx

key-decisions:
  - "recipientUserIds passed inside ccChatMessage SSE payload; filtered/stripped in CallCenterSseController (no state service signature change)"
  - "broadcast_all uses recipientUserIds undefined so all tenant SSE subscribers receive the event"
  - "Direct channel keys sorted dm:min:max for deterministic symmetric addressing"
  - "Frontend compares sender_user_id to auth user uniqueid (not id)"

patterns-established:
  - "Pattern: chat authorization dual-layer — REST canAccessChannel + SSE recipientUserIds filter"
  - "Pattern: open thread listens to window cc:chat-message CustomEvent for live append alongside RTK history query"

requirements-completed: [D-30, D-31, D-32]

duration: 28min
completed: 2026-07-15
---

# Phase 07 Plan 07: Internal Chat v1 Summary

**REST+SSE internal chat with cc_chat_* persistence, server-side DM/group authorization, and 320px ChatPanel in agent/supervisor workspaces**

## Performance

- **Duration:** 28 min
- **Started:** 2026-07-15T16:13:00Z
- **Completed:** 2026-07-15T16:41:00Z
- **Tasks:** 3
- **Files modified:** 24

## Accomplishments

- Added `cc_chat_messages` and `cc_chat_channels` models, idempotent migration, and `CallCenterChatService` with tenant-scoped authorization and recipient computation (D-32)
- Wired `CallCenterChatController` REST endpoints and extended SSE controller to deliver `ccChatMessage` only to listed recipients (D-30, D-31)
- Built frontend `ChatPanel`/`ChatThread` with RTK chat API, SSE unread counter, paginated history, and mount in operator/supervisor ARM (D-30–D-32)

## Task Commits

1. **Task 1: Chat data layer — models, migration, service** - `2c5eb53` (feat)
2. **Task 2: Chat transport — REST controller, DTOs, SSE delivery** - `64e36bd` (feat)
3. **Task 3: Frontend chat panel — RTK, SSE listener, ChatPanel** - `b0dc27c` (feat)

**Plan metadata:** pending (docs commit)

## Self-Check: PASSED

- FOUND: packages/backend/src/modules/callcenter/callcenter-chat.service.ts
- FOUND: packages/backend/src/modules/callcenter/callcenter-chat.controller.ts
- FOUND: packages/frontend/src/features/callcenter/ui/ChatPanel/ChatPanel.tsx
- FOUND: .planning/phases/07-call-center-overhaul-professional-agent-supervisor-workspace/07-07-SUMMARY.md
- FOUND commits: 2c5eb53, 64e36bd, b0dc27c

## Files Created/Modified

- `callcenter-chat.service.ts` — channel keys, canAccessChannel, history, contacts, computeRecipientUserIds
- `callcenter-chat.controller.ts` — JWT-derived sender, supervisor gate on broadcast, SSE emit
- `callcenter-sse.controller.ts` — ccChatMessage recipient filter + payload strip
- `migrate-callcenter-chat-phase7.ts` — standalone MySQL migration with composite indexes
- `callCenterApi.ts` — getChatChannels/Contacts/Messages, sendChatMessage, createChatChannel
- `ChatPanel.tsx` / `ChatThread.tsx` — UI-SPEC §6 collapsible 320px panel, bubbles, Enter/Shift+Enter

## Decisions Made

- Kept `CallCenterStateService.emitEvent` signature unchanged; recipient list travels inside event data
- Broadcast-to-queue recipients derived from in-memory agent queue membership via `getAllAgents`
- Chat unread counts in Redux slice; open thread clears via `markChannelRead` + live SSE handler

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

| File | Location | Reason |
|------|----------|--------|
| `ChatPanel.tsx` | `sendBroadcast` uses `window.prompt` | Minimal v1 broadcast compose; replace with inline composer in 07-08/07-09 workspace polish |

## Issues Encountered

- gsd-tools SDK not built in repo — STATE/ROADMAP updated manually
- Migration script not run against live DB in this session (requires MySQL `.env`); script follows idempotent pattern from Phase 6

## User Setup Required

Run once per environment (from `packages/backend`):

```bash
npx ts-node src/modules/callcenter/migrate-callcenter-chat-phase7.ts
```

## Next Phase Readiness

- Internal chat v1 ready for manual two-tab SSE verification (operator A→B, operator C blocked)
- Chat panel mounted in ARM headers; full 4-zone layout integration deferred to 07-08/07-09

---
*Phase: 07-call-center-overhaul-professional-agent-supervisor-workspace*
*Completed: 2026-07-15*
