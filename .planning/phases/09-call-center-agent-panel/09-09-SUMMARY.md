---
phase: 09-call-center-agent-panel
plan: 09
subsystem: api
tags: [nestjs, sequelize, asterisk-ami, callcenter, missed-calls, auto-pause]

requires:
  - phase: 09-01
    provides: cc_missed_calls (client_called_back/personal cols, UNIQUE call_uniqueid), cc_settings.autopause_rules JSON
  - phase: 09-03
    provides: CallCenterAmiService AMI event handlers (handleCallerAbandon/handleAgentStatusEvent/handleDialEnd/handleAgentHangup), CallCenterStateService
  - phase: 09-07
    provides: CallCenterService.clickToCall WebRTC/PJSIP dial branching (click_to_call permission gate)
provides:
  - "getMissedCallsGrouped/claimMissedCall/callbackMissedCall + autoResolveOnAnswer on CallCenterService"
  - "CallCenterAutoPauseService — RONA + missed_count/idle_time/status_duration rule engine"
  - "GET/POST /callcenter/agent/missed/* endpoints + MissedCallActionDto"
affects: [09-10, 09-14]

tech-stack:
  added: []
  patterns:
    - "Read-layer GROUP BY caller_id_num aggregation (Sequelize fn/col/literal) — never a unique index on the number, table stays call-level"
    - "ModuleRef lazy resolution for a circular-dependency call (CallCenterAmiService -> CallCenterService) via a string provider alias"
    - "Auto-pause rules as one typed JSON union on cc_settings.autopause_rules — no per-rule-type columns"

key-files:
  created:
    - packages/backend/src/modules/callcenter/dto/callcenter-missed.dto.ts
    - packages/backend/src/modules/callcenter/callcenter-autopause.service.spec.ts
  modified:
    - packages/backend/src/modules/callcenter/callcenter.service.ts
    - packages/backend/src/modules/callcenter/callcenter-ami.service.ts
    - packages/backend/src/modules/callcenter/callcenter-autopause.service.ts
    - packages/backend/src/modules/callcenter/callcenter.module.ts
    - packages/backend/src/modules/callcenter/callcenter.controller.ts
    - packages/backend/src/modules/callcenter/callcenter.service.spec.ts
    - packages/backend/src/modules/callcenter/callcenter-ami.service.spec.ts

key-decisions:
  - "getMissedCallsGrouped aggregates at the read layer (GROUP BY caller_id_num, personal with COUNT/MAX) — cc_missed_calls stays call-level, UNIQUE(call_uniqueid) untouched"
  - "personal misses persist with queue_name=direct:<agentInterface> (NOT NULL column) instead of an empty queue, so ownership is encoded without a schema change"
  - "autoResolveOnAnswer lives on CallCenterService (missedCallModel owner) and is invoked from CallCenterAmiService.handleAgentConnect via ModuleRef lazy get('CallCenterService') to avoid a circular constructor dependency"
  - "callbackMissedCall reuses clickToCall's WebRTC/PJSIP branching through an extracted originateDial helper — no duplicated dial logic (D-18/D-29 are the same scheme)"
  - "Callback success is decided by subscribing to the agent's own SSE event stream (IN_CALL -> non-IN_CALL transition) and measuring elapsed time, not by hooking a new AMI event path"
  - "Auto-pause rules modelled as CallCenterAutoPauseService reading cc_settings.autopause_rules (AutoPauseRule[] from 09-01) — RONA is a fixed always-on trigger, the other three are configurable JSON rules"
  - "Auto-pause reuses the exact queuePause + stateService.setAgent(status: PAUSED) mechanics as CallCenterService.supervisorForcePause — no forked pause path"

requirements-completed: [D-10, D-15, D-16, D-17, D-18, D-19, D-20]

coverage:
  - id: D1
    description: "Grouped missed-calls query returns one row per caller_id_num+personal with attemptCount/lastAttemptAt, excluding resolved rows, without touching UNIQUE(call_uniqueid)"
    requirement: "D-16"
    verification:
      - kind: unit
        ref: "callcenter.service.spec.ts#getMissedCallsGrouped groups by caller_id_num + personal, excluding resolved rows"
        status: pass
    human_judgment: false
  - id: D2
    description: "Personal vs queue-missed distinguished; queue-missed is a claimable shared pool"
    requirement: "D-19"
    verification:
      - kind: unit
        ref: "callcenter.service.spec.ts#claimMissedCall assigns the queue-missed pool group to the claiming operator"
        status: pass
      - kind: unit
        ref: "callcenter-ami.service.spec.ts#marks a READY agent RINGING on a ringing Newchannel and records a personal missed on hangup"
        status: pass
    human_judgment: false
  - id: D3
    description: "A later answered call from a number auto-resolves its open missed rows and tags client_called_back"
    requirement: "D-17"
    verification:
      - kind: unit
        ref: "callcenter.service.spec.ts#autoResolveOnAnswer tags open missed rows as client_called_back when the client rings back and connects"
        status: pass
      - kind: unit
        ref: "callcenter-ami.service.spec.ts#auto-resolves open missed-call rows for the caller number via CallCenterService"
        status: pass
    human_judgment: false
  - id: D4
    description: "Operator callback originates via the existing clickToCall branching; >5s connect marks called_back, else logs an attempt"
    requirement: "D-18"
    verification:
      - kind: unit
        ref: "callcenter.service.spec.ts#callbackMissedCall marks the number called_back when the connect exceeds 5s"
        status: pass
      - kind: unit
        ref: "callcenter.service.spec.ts#callbackMissedCall creates a new attempt row and leaves the group active when the connect is <=5s"
        status: pass
    human_judgment: false
  - id: D5
    description: "In-queue ring-no-answer never enters the missed-calls tool (only genuine personal/direct rings and queue abandons do)"
    requirement: "D-10, D-20"
    verification:
      - kind: unit
        ref: "callcenter-ami.service.spec.ts#does not persist a personal missed call when caller id is unknown (in-queue RNA never enters the tool)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Auto-pause rule engine — RONA (fixed) plus configurable missed_count/idle_time/status_duration rules sourced from cc_settings.autopause_rules JSON — evaluated from the existing AMI state-update path, reusing supervisorForcePause's pause mechanics"
    requirement: "D-15"
    verification:
      - kind: unit
        ref: "callcenter-autopause.service.spec.ts (14 tests: RONA fire/not-fire across tenants+queues, missed_count threshold+reset, idle_time fire/not-fire, status_duration fire/not-fire/reset, missed-count reset on IN_CALL)"
        status: pass
      - kind: unit
        ref: "callcenter-ami.service.spec.ts#evaluates the RONA auto-pause rule for the abandoned queue / evaluates auto-pause idle_time/status_duration rules on every status update / returns a DIALING agent to READY and records missed on NOANSWER"
        status: pass
    human_judgment: false

duration: ~50min
completed: 2026-07-23
status: complete
---

# Phase 9 Plan 09: Smart Missed-Calls Engine + Auto-Pause Rule Engine Summary

**Number-grouped, ownership-aware missed-calls worklist (personal-vs-queue, claim, client self-callback auto-resolve, operator callback with a >5s success rule) plus a configurable RONA/missed-count/idle-time/status-duration auto-pause rule engine — both server-side, both TDD'd against the existing AMI state-update path.**

## Performance

- **Duration:** ~50 min
- **Tasks:** 3/3
- **Files modified:** 7 (2 new, 5 modified)

## Accomplishments

- `CallCenterService.getMissedCallsGrouped` aggregates `cc_missed_calls` at the read layer (`GROUP BY caller_id_num, personal` with `COUNT`/`MAX`) — never violates `UNIQUE(call_uniqueid)`, excludes `client_called_back`/`called_back` rows already resolved.
- `persistMissedCall` now carries a `personal` flag; genuine personal/direct misses persist with a synthetic `queue_name = direct:<agentInterface>` (satisfies the `NOT NULL` column without a schema change), while in-queue ring-no-answer is never persisted as a personal miss.
- `claimMissedCall` assigns a queue-missed (shared-pool) number group to the claiming operator — idempotent, server is source of truth on conflicting claims.
- `autoResolveOnAnswer` marks a number's open missed rows `client_called_back = true` the moment that number's next call is answered; wired from `CallCenterAmiService.handleAgentConnect` via `ModuleRef` lazy resolution (avoids a circular constructor dependency between the AMI service and `CallCenterService`).
- `callbackMissedCall` reuses `clickToCall`'s WebRTC/PJSIP dial branching through a shared `originateDial` helper (no duplicated dial logic), then tracks the resulting call's duration via the agent's own SSE event stream: >5s connected marks the number `called_back`, otherwise a new attempt row is created and the group stays active.
- New endpoints: `GET /callcenter/agent/missed/grouped`, `POST /callcenter/agent/missed/claim`, `POST /callcenter/agent/missed/callback` — all scoped to JWT ids only, validated via the new `MissedCallActionDto`.
- `CallCenterAutoPauseService` — a typed-union rule engine (`AutoPauseRule` from 09-01) reading `cc_settings.autopause_rules`: RONA is a fixed always-on trigger firing on queue abandon for agents still `RINGING` in that queue; `missed_count`/`idle_time`/`status_duration` are configurable JSON rules evaluated from `handleAgentStatusEvent`/`handleDialEnd`/`handleAgentHangup`. All pausing reuses `queuePause` + `stateService.setAgent(PAUSED)` — the exact mechanics `supervisorForcePause` already uses.

## Task Commits

Each task followed the RED → GREEN TDD cycle with a separate commit per gate:

1. **Task 1: Grouped missed-calls query + personal flag + claim + auto-resolve**
   - `86bd967` test(09-09): add failing tests for grouped missed-calls query + claim + auto-resolve
   - `8913749` test(09-09): add failing tests for personal-miss persistence + RONA/missed-count/auto-resolve wiring
   - `2efabdb` feat(09-09): grouped missed-calls query + personal flag + claim + auto-resolve
2. **Task 2: Callback flow with >5s success rule + endpoints**
   - `3077303` test(09-09): add failing tests for callback flow with >5s success rule
   - `d6ca274` feat(09-09): callback flow with >5s success rule + missed-call endpoints
3. **Task 3: Auto-pause rule engine (RONA + configurable rules)**
   - `a1e03fd` test(09-09): add failing tests for auto-pause rule engine (RONA + configurable rules)
   - `804ef03` feat(09-09): implement auto-pause rule engine (RONA + missed_count/idle_time/status_duration)

**Plan metadata:** (this commit) docs(09-09): complete smart missed-calls engine + auto-pause rules plan

## Files Created/Modified

- `packages/backend/src/modules/callcenter/dto/callcenter-missed.dto.ts` - `MissedCallActionDto` (callerIdNum) for claim/callback requests
- `packages/backend/src/modules/callcenter/callcenter-autopause.service.spec.ts` - 14 tests covering RONA + all three configurable rule types + reset/boundary behavior
- `packages/backend/src/modules/callcenter/callcenter.service.ts` - `getMissedCallsGrouped`/`claimMissedCall`/`autoResolveOnAnswer`/`originateDial`/`callbackMissedCall`/`trackCallbackOutcome`/`resolveCallbackOutcome`
- `packages/backend/src/modules/callcenter/callcenter-ami.service.ts` - `personalRingingChannels` as a `Map` (caller info), personal-miss persistence in `handleNewchannel`/`handleAgentHangup`, `autoResolveOnAnswer` call in `handleAgentConnect`, auto-pause hooks in `handleCallerAbandon`/`handleAgentStatusEvent`/`handleDialEnd`/`handleAgentHangup`
- `packages/backend/src/modules/callcenter/callcenter-autopause.service.ts` - real `CallCenterAutoPauseService` implementation (was a Task-1 stub)
- `packages/backend/src/modules/callcenter/callcenter.module.ts` - `CallCenterAutoPauseService` provider + `'CallCenterService'` alias for `ModuleRef` lazy resolution
- `packages/backend/src/modules/callcenter/callcenter.controller.ts` - `GET agent/missed/grouped`, `POST agent/missed/claim`, `POST agent/missed/callback`
- `packages/backend/src/modules/callcenter/callcenter.service.spec.ts` - test coverage for all new `CallCenterService` methods; fake-timer hygiene for the callback duration tests

## Decisions Made

- Grouping happens at the read layer only (Sequelize `fn`/`col`/`literal` `GROUP BY`) — the table itself stays call-level with `UNIQUE(call_uniqueid)` intact; a unique index on `caller_id_num` was explicitly avoided (RESEARCH Pitfall 4).
- Personal misses use `queue_name = direct:<agentInterface>` rather than an empty string, since the column is `NOT NULL` and this also doubles as the ownership marker read back for the grouped query.
- `autoResolveOnAnswer` is owned by `CallCenterService` (it owns `missedCallModel`) but must be triggered from `CallCenterAmiService`; resolved via `ModuleRef.get('CallCenterService', { strict: false })` behind a string provider alias, mirroring the existing `'CallCenterAmiService'` alias pattern already in the module — avoids a circular constructor dependency without a new abstraction layer.
- Callback success/failure is decided by subscribing to `stateService.getEventStream(userUid)` and watching the operator's own agent status go `IN_CALL` → not-`IN_CALL`, timing the gap — this reuses the existing SSE event bus rather than adding a new AMI Hangup/DialEnd correlation path, and naturally handles both WebRTC and PJSIP dial modes identically.
- Auto-pause rules are one typed union (`AutoPauseRule[]`) already defined in `cc-permissions.types.ts` from 09-01 — no new migration, no per-rule-type columns (RESEARCH Pitfall 7).
- `idle_time`/`status_duration` are evaluated on every status-transition event (not via a separate polling timer) — matches the plan's "evaluated from the existing AMI state-update path" instruction; `status_duration` fires when the *same* status is re-observed and the configured threshold has elapsed since first entering it.

## Deviations from Plan

None — plan executed exactly as written. `CallCenterAutoPauseService` was already stubbed in Task 1 (per the file's own header comment) so `CallCenterAmiService`/`callcenter.module.ts` wiring could compile ahead of Task 3's full rule logic; Task 3 replaced the stub bodies with the real implementation as planned, with no changes needed to the already-wired call sites.

## Issues Encountered

- `callbackMissedCall`'s duration-tracking `setTimeout` initially left a dangling timer handle in tests, causing Jest to report "did not exit one second after the test run" — resolved by switching the `callbackMissedCall` describe block to `jest.useFakeTimers()`/`jest.advanceTimersByTime()` instead of spying on `Date.now()` directly, and restoring real timers in `afterEach`.
- A leftover `findOrCreate` call count from an earlier test in the same `describe` block caused a false failure on `.not.toHaveBeenCalled()` in the "in-queue RNA never enters the tool" test — fixed with an explicit `missedCallModel.findOrCreate.mockClear()` at the start of that test.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 09-10 (Frontend missed-calls UI) can now consume `GET /callcenter/agent/missed/grouped`, `POST /callcenter/agent/missed/claim`, `POST /callcenter/agent/missed/callback` directly — response shape is `{ callerIdNum, callerIdName, personal, attemptCount, lastAttemptAt, claimedBy }[]`.
- 09-14 (Settings UI) will need a UI for editing `cc_settings.autopause_rules` (currently JSON-only, no admin surface) — the `AutoPauseRule` typed union from 09-01 is the contract to build against.
- No blockers. `npx jest --testPathPattern="modules/callcenter"` is green except one pre-existing, out-of-scope failure in `callcenter-chat.service.spec.ts` (introduced in phase 07-07, unrelated to this plan) and a pre-existing `call-groups.service.spec.ts` failure (phase 06-06/06-15, unrelated) surfaced by the full-suite run.

## Self-Check: PASSED

All 7 created/modified files verified present on disk; all 7 task-level commit hashes (86bd967, 8913749, 2efabdb, 3077303, d6ca274, a1e03fd, 804ef03) verified in git log.

---
*Phase: 09-call-center-agent-panel*
*Completed: 2026-07-23*
