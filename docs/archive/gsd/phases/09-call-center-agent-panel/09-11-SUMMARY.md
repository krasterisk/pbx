---
phase: 09-call-center-agent-panel
plan: 11
subsystem: api
tags: [nestjs, sequelize, ami, sse, rxjs, call-center]

# Dependency graph
requires:
  - phase: 09-01
    provides: cc_queue_calls direction/call_type columns, cc-permissions shared types
  - phase: 09-03
    provides: all-channel AMI handlers (handleDialBegin/handleDialEnd/handleNewchannel/handleAgentHangup)
  - phase: 09-07
    provides: professional call-control AMI wrappers, AmiService.getActiveChannels fix
  - phase: 09-09
    provides: smart missed-calls engine, CallCenterAutoPauseService
provides:
  - All-direction cc_queue_calls history (inbound queue + personal + outbound + internal) with direction/call_type
  - CallCenterService.getOperatorCallHistory (shift/day filter) + GET /callcenter/agent/history
  - CallCenterPresenceService — debounced DeviceState/ExtensionState → presenceUpdate SSE deltas
  - CallCenterService.getTransferDirectory (endpoints+queues+groups) + GET /callcenter/agent/directory
affects: [09-12-transfer-directory-ui, 09-history-panel-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Non-queue call state tracking: a Map<agentKey, {uniqueid,direction,callerId,enterTime,answerTime}> seeded at DialBegin/Newchannel, consumed at DialEnd/AgentHangup, mirrors the existing wrapupTimers/statusJournalEntries Map convention in callcenter-ami.service.ts"
    - "Debounce-then-emit via a per-key setTimeout Map (CallCenterPresenceService), same shape as the existing wrapup timer maps"
    - "Lazy ModuleRef resolution + string-alias provider for a new cross-service dependency from ami.service.ts (CallCenterPresenceService), matching the CallCenterAmiService/CallCenterQueueLogReconcilerService precedent"

key-files:
  created:
    - packages/backend/src/modules/callcenter/callcenter-presence.service.ts
    - packages/backend/src/modules/callcenter/callcenter-presence.service.spec.ts
    - packages/backend/src/modules/callcenter/dto/callcenter-directory.dto.ts
  modified:
    - packages/backend/src/modules/callcenter/callcenter-ami.service.ts
    - packages/backend/src/modules/callcenter/callcenter-ami.service.spec.ts
    - packages/backend/src/modules/callcenter/callcenter.service.ts
    - packages/backend/src/modules/callcenter/callcenter.service.spec.ts
    - packages/backend/src/modules/callcenter/callcenter.controller.ts
    - packages/backend/src/modules/callcenter/callcenter.module.ts
    - packages/backend/src/modules/callcenter/callcenter-state.service.spec.ts
    - packages/backend/src/modules/ami/ami.service.ts

key-decisions:
  - "Did not fork a second history writer — CallCenterHistoryWriterService was already generic (accepts any Partial<CcQueueCall>); all new work lives in the AMI handlers that call historyWriter.enqueue()"
  - "Non-queue direction classified via a nonQueueCallStates Map keyed like the existing journalKey (userUid:agentInterface); outbound vs internal decided by a short-numeric-destination heuristic ([ASSUMED], flagged for 09-VALIDATION)"
  - "Personal-ring answer time has no distinct AMI event in the current listener set, so talk_time is approximated from ring-start rather than true answer — documented as a known limitation, not silently accepted"
  - "getOperatorCallHistory 'shift' period resolves the operator's currently-open cc_agent_sessions row (logout_time IS NULL); falls back to start-of-day if none is open"
  - "Reused CallCenterAmiService.parseQueueTenant (existing `_<uid>` suffix parser) for presence tenant resolution instead of writing a second regex — same convention as queue names/SIP ids"
  - "Reused endpoint-ids.util's interfaceToExtension/extractExtension for device↔extension mapping across both the presence service and the transfer directory, instead of re-deriving the regex"
  - "Queue free-operator counts reuse CallCenterStateService.getQueue(...).agents.available (recalcQueueStats) rather than a parallel aggregation, per plan instruction"
  - "Call-group free-operator counts have no existing CC-state aggregation to reuse (call groups aren't CC queues), so they're derived per-request by matching each internal member's extension against the live agent map"

patterns-established:
  - "Presence debounce constant PRESENCE_DEBOUNCE_MS=300ms, exported for test use — same 'documented fixed window' style as FLUSH_INTERVAL_MS in the history writer"

requirements-completed: [D-34, D-35, D-36, D-37, D-45]

coverage:
  - id: D1
    description: "Non-queue (outbound/personal/internal) calls persist cc_queue_calls history rows with direction+call_type populated"
    requirement: "D-34"
    verification:
      - kind: unit
        ref: "callcenter-ami.service.spec.ts#non-queue call history rows (D-34/D-35)"
        status: pass
    human_judgment: false
  - id: D2
    description: "getOperatorCallHistory filters by shift (since login) vs day (since midnight), tenant+operator scoped, most-recent-first"
    requirement: "D-35"
    verification:
      - kind: unit
        ref: "callcenter.service.spec.ts#getOperatorCallHistory"
        status: pass
    human_judgment: false
  - id: D3
    description: "GET /callcenter/agent/history wired, ids from JWT only"
    requirement: "D-35"
    verification:
      - kind: unit
        ref: "callcenter.controller.ts#getOperatorCallHistory (manual code review — no controller-level test harness in this codebase)"
        status: unknown
    human_judgment: true
    rationale: "No NestJS controller integration-test harness exists in this repo for callcenter.controller.ts (all controller methods are thin pass-throughs verified at the service layer); endpoint wiring should be smoke-tested against a running backend."
  - id: D4
    description: "getTransferDirectory returns endpoints+queues+groups with presence/free counts, tenant-scoped; GET /callcenter/agent/directory wired"
    requirement: "D-36"
    verification:
      - kind: unit
        ref: "callcenter.service.spec.ts#getTransferDirectory"
        status: pass
    human_judgment: false
  - id: D5
    description: "CallCenterPresenceService subscribes to DeviceState/ExtensionState and emits debounced presenceUpdate SSE deltas (delta-only, _eventId, coalesced per extension)"
    requirement: "D-37"
    verification:
      - kind: unit
        ref: "callcenter-presence.service.spec.ts, callcenter-state.service.spec.ts#emitEvent presenceUpdate"
        status: pass
    human_judgment: false
  - id: D6
    description: "DeviceState/ExtensionState AMI field names/casing verified against a live Asterisk instance"
    requirement: "D-37"
    verification: []
    human_judgment: true
    rationale: "Field names (evt.device/evt.state/evt.exten/evt.context/evt.status) are [ASSUMED] per RESEARCH — no live Asterisk AMI connection available in this environment; flagged for 09-VALIDATION manual check per the plan's own verification section."

duration: ~70min
completed: 2026-07-23
status: complete
---

# Phase 9 Plan 11: All-Direction Call History + Transfer Directory + BLF Presence Summary

**Unified cc_queue_calls history across every call direction, a debounced AMI-DeviceState-driven presence service, and a tenant-scoped transfer directory (endpoints + queues + call groups) with live free-operator counts.**

## Performance

- **Duration:** ~70 min
- **Tasks:** 3
- **Files modified:** 11 (3 created, 8 modified)

## Accomplishments
- `CallCenterAmiService` now persists a `cc_queue_calls` history row for every non-queue call outcome (outbound answered/missed/cancelled, personal-ring answered/missed, internal dial) via a new `nonQueueCallStates` tracking map — reusing the existing batched `CallCenterHistoryWriterService`, not a second writer.
- `CallCenterService.getOperatorCallHistory(userUid, operatorUserId, period)` returns the unified, tenant+operator-scoped, most-recent-first history for `shift` (since the operator's current open login session) or `day` (since midnight), exposed at `GET /callcenter/agent/history`.
- New `CallCenterPresenceService` subscribes to AMI `devicestatechange`/`extensionstatus` (registered in `ami.service.ts`'s `connect()`), coalesces rapid per-extension bursts over a 300ms window, and emits tenant-scoped `presenceUpdate` SSE deltas via the existing `CallCenterStateService.emitEvent` (`_eventId`, no full-state rebroadcast).
- `CallCenterService.getTransferDirectory(userUid, search?)` returns a unified endpoints+queues+call-groups directory — endpoint presence from the new presence service (falling back to live CC agent status), queue free/total counts reused from the existing `recalcQueueStats` aggregation, call-group free counts derived from the live agent map — exposed at `GET /callcenter/agent/directory` with an optional case-insensitive `search` filter (`DirectoryQueryDto`).

## Task Commits

Each task was committed atomically (TDD tasks split into `test` → `feat`):

1. **Task 1: Extend history writer for all directions + operator history query**
   - `52b492b` test: failing tests for non-queue call history rows
   - `7065d6a` feat: persist all-direction call history in AMI non-queue handlers
   - `2b16988` test: failing tests for getOperatorCallHistory
   - `20bba56` feat: add getOperatorCallHistory + GET /callcenter/agent/history
2. **Task 2: Presence service (DeviceState/ExtensionState → debounced presenceUpdate SSE)**
   - `b82cc82` test: assert presenceUpdate is a tenant-scoped delta with _eventId
   - `6e07143` test: failing tests for CallCenterPresenceService
   - `de75a05` feat: wire CallCenterPresenceService into AMI + module
3. **Task 3: Transfer directory endpoint (endpoints + queues + groups)**
   - `7add4c9` feat: add getTransferDirectory + GET /callcenter/agent/directory

**Plan metadata:** committed alongside this SUMMARY.

_Note: Task 1 and Task 2 followed RED→GREEN (`test(...)` then `feat(...)`); Task 3 has no `tdd="true"` flag in the plan, so it was committed as a single `feat` with tests included in the same commit._

## Files Created/Modified
- `packages/backend/src/modules/callcenter/callcenter-ami.service.ts` - `nonQueueCallStates` tracking map, `isInternalNumber` heuristic, history-row writes in `handleDialBegin/handleDialEnd/handleNewchannel/handleAgentHangup`
- `packages/backend/src/modules/callcenter/callcenter-ami.service.spec.ts` - 6 new tests covering outbound/internal/personal answered/missed/cancelled history rows
- `packages/backend/src/modules/callcenter/callcenter.service.ts` - `getOperatorCallHistory`, `getTransferDirectory`, new model/service injections (Queue, PsEndpoint, CallGroup, CallGroupMember, CallCenterPresenceService)
- `packages/backend/src/modules/callcenter/callcenter.service.spec.ts` - tests for both new methods + updated constructor call
- `packages/backend/src/modules/callcenter/callcenter.controller.ts` - `GET /callcenter/agent/history`, `GET /callcenter/agent/directory`
- `packages/backend/src/modules/callcenter/callcenter-presence.service.ts` - new: DeviceState/ExtensionState → debounced presenceUpdate
- `packages/backend/src/modules/callcenter/callcenter-presence.service.spec.ts` - new: 9 tests (coalescing, tenant parsing, getPresence)
- `packages/backend/src/modules/callcenter/callcenter-state.service.spec.ts` - presenceUpdate delta/tenant-isolation assertions
- `packages/backend/src/modules/callcenter/dto/callcenter-directory.dto.ts` - new: `DirectoryQueryDto`
- `packages/backend/src/modules/callcenter/callcenter.module.ts` - registers `CallCenterPresenceService` (+ ModuleRef string alias), `PsEndpoint`/`CallGroup`/`CallGroupMember` in `SequelizeModule.forFeature`
- `packages/backend/src/modules/ami/ami.service.ts` - `getCcPresenceService()` lazy resolver, `devicestatechange`/`extensionstatus` listeners

## Decisions Made
- Kept the batched `CallCenterHistoryWriterService` untouched — it was already generic (`Partial<CcQueueCall>`); all Task 1 work is in the AMI handlers that call `enqueue()`.
- Classified `direction='internal'` via a short-all-digit heuristic on the dialed number (`/^\d{1,5}$/`), flagged `[ASSUMED]` for live verification since real extension-length conventions vary per tenant.
- Approximated personal-ring `answer_time` as ring-start (no distinct "answered" AMI event exists for a non-queue personal call in the current listener set) — documented as a limitation rather than silently guessed.
- Reused `CallCenterAmiService.parseQueueTenant` and `endpoint-ids.util`'s `interfaceToExtension`/`extractExtension` instead of duplicating tenant/extension-parsing regexes in the new presence service and directory method.
- Queue free-operator counts reuse the existing `CallCenterStateService.getQueue(...).agents.available` aggregation (populated by `recalcQueueStats`); call groups have no equivalent existing aggregation, so their free count is computed per-request from the live agent map (documented, not a parallel scheme for queues).

## Deviations from Plan

None - plan executed exactly as written. All three tasks, their `<action>` items, and both threat-model mitigations (T-09-11-01 tenant scoping, T-09-11-02 debounce) were implemented as specified.

## Issues Encountered
- `callcenter.service.spec.ts`'s `CallCenterService` constructor call needed 5 new positional arguments appended (`queueModel`, `endpointModel`, `callGroupModel`, `callGroupMemberModel`, `presenceService`) to match the new constructor signature — updated alongside the new test blocks, no functional issue.
- `callcenter-chat.service.spec.ts` has one pre-existing failing test unrelated to this plan's files (confirmed via `git stash` against the pre-plan baseline) — left untouched per the deviation rules' scope boundary (out-of-scope discovery, not introduced by this plan).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- 09-12 (transfer directory UI) can now consume `GET /callcenter/agent/directory` and `presenceUpdate` SSE deltas directly.
- The history panel UI can consume `GET /callcenter/agent/history?period=shift|day`.
- **09-VALIDATION follow-up (manual, live Asterisk required):** verify `devicestatechange`/`extensionstatus` AMI event field names/casing (`evt.device`, `evt.state`, `evt.exten`, `evt.context`, `evt.status`) and the internal-vs-outbound short-number heuristic against a real tenant's extension-length convention.

---
*Phase: 09-call-center-agent-panel*
*Completed: 2026-07-23*

## Self-Check: PASSED

All created files and task commit hashes verified present in the working tree / git history.
