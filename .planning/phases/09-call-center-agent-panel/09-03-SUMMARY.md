---
phase: 09-call-center-agent-panel
plan: 03
subsystem: api
tags: [nestjs, asterisk-ami, sequelize, sse, call-center]

requires:
  - phase: 09-01
    provides: "cc_agent_events.event_type ENUM extended with DIALING/CONSULT/ACW; cc_queue_calls.direction/call_type columns"
provides:
  - "CallCenterStateService.findAgentByChannel — channel-based agent resolver, never from queue suffix"
  - "CallCenterAmiService.handleDialBegin/handleDialEnd/handleNewchannel/handleAgentHangup — all-channel agent AMI handlers"
  - "DIALING status transition + cc_agent_events journal (write-on-entry, duration-fill-on-exit)"
  - "CallCenterMetricsService dual shift/day answered·made·missed counters, agent-level and per-queue"
  - "agentKpiUpdate SSE delta"
  - "ami.service.ts dialbegin/dialend/newchannel/hangup registrations"
affects: [09-04, 09-08, 09-11]

tech-stack:
  added: []
  patterns:
    - "Channel-substring agent resolver (findAgentByChannel) mirroring the existing getAllCallsGlobal/iterateAllCalls scan-by-channel shape used by handleHold/handleUnhold"
    - "Dual sinceLogin/sinceMidnight KPI accumulator keyed by agent + agent:queue, parallel to the existing queue/agent accumulator maps"
    - "In-memory open-journal-entry map (uid + enteredAt) so a status's cc_agent_events row is written on entry and its duration filled via a targeted UPDATE on exit"

key-files:
  created: []
  modified:
    - packages/backend/src/modules/callcenter/callcenter-state.service.ts
    - packages/backend/src/modules/callcenter/callcenter-ami.service.ts
    - packages/backend/src/modules/ami/ami.service.ts
    - packages/backend/src/modules/callcenter/callcenter-metrics.service.ts
    - packages/backend/src/modules/callcenter/callcenter.service.ts
    - packages/backend/src/modules/callcenter/reports/callcenter-reports.service.ts
    - packages/backend/src/modules/callcenter/callcenter-state.service.spec.ts
    - packages/backend/src/modules/callcenter/callcenter-ami.service.spec.ts
    - packages/backend/src/modules/callcenter/callcenter-metrics.service.spec.ts
    - packages/backend/src/modules/callcenter/callcenter.service.spec.ts
    - packages/backend/src/modules/callcenter/reports/callcenter-reports.service.spec.ts

key-decisions:
  - "findAgentByChannel only matches agents with userId > 0 (logged-in operators) — a queue-preloaded QueueMember phantom (userId defaults to 0) can never trigger a status/KPI mutation for an unrelated tenant (T-09-03-01)"
  - "The DIALING/CONSULT/ACW journal is written directly via CallCenterAmiService.logAgentEvent-style single-row create (not the batched CallCenterHistoryWriterService) — see Deviations"
  - "CONSULT/ACW have a journal write-path (logStatusJournalEnter/Exit accept them) but no producer is wired in this plan — no consult-leg or after-call-work detection exists yet in the codebase for AMI to observe; only DIALING has a live producer (handleDialBegin/handleDialEnd/handleAgentHangup)"
  - "recordAnswered was extended in-place to also bump the dual KPI accumulator (rather than adding a fourth call site) — matches the plan's own key_links contract (recordAnswered/recordMade/recordMissed) and keeps the 'answered' KPI derived from the exact same call that already updates the queue accumulator"
  - "made/missed sinceMidnight rebuild-after-restart has no live producer yet — see Known Limitations"

patterns-established:
  - "Fire-and-forget async DB writes from AMI handlers use `void this.methodName(...)` exactly like the existing persistMissedCall pattern, so handler methods stay synchronous and never block state updates on DB latency"

requirements-completed: [D-08, D-09, D-11, D-12, D-13, D-14, D-31, D-32]

coverage:
  - id: D1
    description: "findAgentByChannel resolves tenant+agent from channel substring, never a queue suffix, and only matches logged-in agents"
    requirement: "D-08"
    verification:
      - kind: unit
        ref: "callcenter-state.service.spec.ts#findAgentByChannel (5 cases: suffix match, exact match, unknown channel, non-logged-in guard, prefix-collision guard)"
        status: pass
    human_judgment: false
  - id: D2
    description: "handleDialBegin/handleDialEnd/handleNewchannel/handleAgentHangup track outbound/personal/internal calls on an agent's own channel independent of queue context; DIALING set on outbound DialBegin and cleared on DialEnd/Hangup"
    requirement: "D-08"
    verification:
      - kind: unit
        ref: "callcenter-ami.service.spec.ts#handleDialBegin, #handleDialEnd, #handleNewchannel / handleAgentHangup — personal direct ring (11 cases)"
        status: pass
    human_judgment: false
  - id: D3
    description: "DIALING transitions logged to cc_agent_events with duration filled on exit; session_id/user_id/vpbx_user_uid populated exactly as existing rows"
    requirement: "D-09"
    verification:
      - kind: unit
        ref: "callcenter-ami.service.spec.ts#DIALING journal (cc_agent_events, D-09/D-13) (2 cases)"
        status: pass
    human_judgment: false
  - id: D4
    description: "dialbegin/dialend/newchannel/hangup registered in ami.service.ts connect() immediately after hold/unhold"
    requirement: "D-08"
    verification:
      - kind: other
        ref: "packages/backend/src/modules/ami/ami.service.ts connect() — grep for 'dialbegin'/'dialend' registrations"
        status: pass
    human_judgment: false
  - id: D5
    description: "answered/made/missed tracked as dual sinceLogin/sinceMidnight counters, agent-level and per-queue (userUid:agentInterface and userUid:agentInterface:queueName)"
    requirement: "D-11"
    verification:
      - kind: unit
        ref: "callcenter-metrics.service.spec.ts#dual shift/day answered·made·missed counters (D-11/D-12/D-31/D-32) (6 cases)"
        status: pass
    human_judgment: false
  - id: D6
    description: "resetKpiSinceLogin zeroes sinceLogin on agentLogin without touching sinceMidnight; restoreToday rebuilds sinceMidnight answered/made from cc_queue_calls, excluding in-queue Ring-No-Answer from personal missed"
    requirement: "D-12"
    verification:
      - kind: unit
        ref: "callcenter-metrics.service.spec.ts#restoreToday KPI rebuild (D-11/D-12 day counter) (2 cases); callcenter.service.spec.ts#agentLogin resets sinceLogin KPI counters"
        status: pass
    human_judgment: false
  - id: D7
    description: "agentKpiUpdate emitted as an SSE delta (changed agent/queue counters only) with _eventId via the existing emitEvent envelope"
    requirement: "D-14"
    verification:
      - kind: unit
        ref: "callcenter-ami.service.spec.ts (emitKpiUpdate exercised indirectly through handleDialEnd/handleAgentHangup assertions on metricsService.getAgentKpi); CallCenterStateService.emitEvent always stamps _eventId"
        status: pass
    human_judgment: false
  - id: D8
    description: "per-queue answered/missed counters exposed shift+day for the Queues tab"
    requirement: "D-31"
    verification:
      - kind: unit
        ref: "callcenter-metrics.service.spec.ts#getAgentQueueKpi cases within the dual-counter describe block"
        status: pass
    human_judgment: false
  - id: D9
    description: "DIALING/CONSULT/ACW journal rows map to their own agent-detail timeline segment state instead of the OFFLINE default"
    requirement: "D-09"
    verification:
      - kind: unit
        ref: "callcenter.service.spec.ts#getAgentDetail maps DIALING/CONSULT/ACW; reports/callcenter-reports.service.spec.ts#getAgentTimeline segments maps DIALING/CONSULT/ACW"
        status: pass
    human_judgment: false
  - id: D10
    description: "Manual verification of Dial*/Hangup/Newchannel field casing against a live Asterisk 22 instance"
    verification: []
    human_judgment: true
    rationale: "RESEARCH explicitly defers this to 09-VALIDATION Manual-Only — asterisk-manager field names/values for DialBegin/DialEnd/Newchannel channel-state cannot be confirmed without a live PBX; handlers are defensive (guard on empty/unknown fields, no-op safe) pending that verification"

duration: ~70min
completed: 2026-07-22
status: complete
---

# Phase 9 Plan 03: All-Channel AMI Listener + Dual KPI Counters Summary

**Extended the AMI listener from queue-only to all-channel awareness with a channel-based agent resolver, a DIALING status transition logged to the operator journal, and dual shift/day answered·made·missed KPI counters (agent-level + per-queue) emitted as SSE deltas.**

## Performance

- **Duration:** ~70 min
- **Tasks:** 3/3
- **Files modified:** 11 (6 implementation, 5 spec)

## Accomplishments
- `CallCenterStateService.findAgentByChannel` resolves the owning agent from an Asterisk channel string (`PJSIP/e101_42-00000005` → `PJSIP/e101_42`), scanning known agents by interface substring exactly like the existing `getAllCallsGlobal`/`iterateAllCalls` pattern — tenant/agent always comes from the matched `AgentState.userUid`, never a queue suffix, and only agents with `userId > 0` (actually logged in) can match, closing the spoofing threat (T-09-03-01).
- `CallCenterAmiService` gained four new all-channel handlers — `handleDialBegin` (sets DIALING on a READY agent's own outbound dial, guarding against consult/transfer legs), `handleDialEnd` (ANSWER → IN_CALL + "made"; anything else → READY + "missed"), `handleNewchannel` (detects a personal/direct inbound ring on a READY agent, conservatively gated on channel-state fields pending live-Asterisk field verification), and `handleAgentHangup` (releases DIALING, a personal ring, or a non-queue-tracked IN_CALL agent back to READY without disturbing queue-driven `AgentComplete` transitions).
- `ami.service.ts` registers `dialbegin`/`dialend`/`newchannel`/`hangup` listeners immediately after the existing hold/unhold registrations, using the same `this.getCcAmiService()?.handleXyz(evt)` lazy-resolution shape as every other CC forwarder — no second listener class.
- DIALING transitions are journaled to `cc_agent_events`: a row is written on entry (session looked up by `(user_id, agent_interface, logout_time IS NULL)` — the exact tuple `agentLogin()` uses to create the session) and its `duration` column is filled via a targeted `UPDATE` on exit, matching the model's own "duration filled when the state ends" contract.
- `CallCenterMetricsService` gained a dual `{sinceLogin, sinceMidnight}` KPI accumulator for `answered`/`made`/`missed`, keyed both per-agent and per-agent-per-queue. `recordAnswered` now also bumps the KPI accumulator in place (no fourth call site); new `recordMade`/`recordMissed` cover outbound/personal results. `resetKpiSinceLogin` (called from `agentLogin`) zeroes the shift counter without touching the day counter; `restoreToday` rebuilds `sinceMidnight` answered/made from `cc_queue_calls` while explicitly excluding in-queue Ring-No-Answer from personal missed (D-10/D-20).
- Every KPI mutation site emits an `agentKpiUpdate` SSE delta (changed agent/queue counters only) through the existing `emitEvent` envelope, which already stamps `_eventId` (D-45) — no new SSE plumbing needed.
- Fixed a latent display bug found while satisfying Task 3: both `eventTypeToTimelineState` implementations (`callcenter.service.ts#getAgentDetail` and `reports/callcenter-reports.service.ts#getAgentTimeline`) previously mapped any unrecognized `event_type` — including the newly-writable `DIALING`/`CONSULT`/`ACW` — to `OFFLINE` via the `default` case. Added explicit mappings so the existing agent-detail timeline (07-09) renders the new statuses correctly without a reporting rewrite.

## Task Commits

Each task was committed atomically (TDD: test → feat per task):

1. **Task 1: findAgentByChannel + all-channel AMI handlers + DIALING status** - `6d2da8c` (test), `bafe9b6` (feat)
2. **Task 2: Dual shift/day answered·made·missed counters + per-queue personal counters** - `ffa00af` (test), `8ae7397` (feat)
3. **Task 3: Log new statuses to cc_agent_events for the operator journal** - `1f02af0` (test), `0c8b11a` (feat)

**Plan metadata:** commit pending (this SUMMARY + STATE.md/ROADMAP.md, via `gsd-tools query commit`)

## Files Created/Modified
- `packages/backend/src/modules/callcenter/callcenter-state.service.ts` - `AgentStatus` += DIALING/CONSULT/ACW; new `findAgentByChannel`
- `packages/backend/src/modules/callcenter/callcenter-ami.service.ts` - new `handleDialBegin/handleDialEnd/handleNewchannel/handleAgentHangup`, `emitKpiUpdate`, `logStatusJournalEnter/Exit`, `findActiveSessionId`; `handleAgentComplete` now also emits `agentKpiUpdate`; new `CcAgentSession` constructor dependency
- `packages/backend/src/modules/ami/ami.service.ts` - registers `dialbegin`/`dialend`/`newchannel`/`hangup` → `CallCenterAmiService`
- `packages/backend/src/modules/callcenter/callcenter-metrics.service.ts` - `KpiCounters`/`KpiAccumulator` types, `kpiAccumulators` map, `getAgentKpi`/`getAgentQueueKpi`/`recordMade`/`recordMissed`/`resetKpiSinceLogin`; `recordAnswered` and `restoreToday` extended
- `packages/backend/src/modules/callcenter/callcenter.service.ts` - `agentLogin` calls `resetKpiSinceLogin`; `eventTypeToTimelineState` += DIALING/CONSULT/ACW; new `CallCenterMetricsService` constructor dependency
- `packages/backend/src/modules/callcenter/reports/callcenter-reports.service.ts` - `eventTypeToTimelineState` += DIALING/CONSULT/ACW
- `packages/backend/src/modules/callcenter/callcenter-state.service.spec.ts` - `findAgentByChannel` tests
- `packages/backend/src/modules/callcenter/callcenter-ami.service.spec.ts` - new handler tests, DIALING journal tests, `flushMicrotasks` helper, `agentSessionModel` mock
- `packages/backend/src/modules/callcenter/callcenter-metrics.service.spec.ts` - dual-counter tests, restoreToday KPI-rebuild tests
- `packages/backend/src/modules/callcenter/callcenter.service.spec.ts` - `resetKpiSinceLogin` wiring test, DIALING/CONSULT/ACW timeline mapping test
- `packages/backend/src/modules/callcenter/reports/callcenter-reports.service.spec.ts` - DIALING/CONSULT/ACW timeline mapping test

## Decisions Made
- **Session lookup for AMI-driven journal writes:** `CallCenterAmiService` has no access to `CallCenterService`'s in-memory `activeSessions` map, so `findActiveSessionId` queries `CcAgentSession` by `(user_id, agent_interface, logout_time IS NULL)` — the exact tuple `agentLogin()` uses when it creates the session row. This is more precise than a `userId`-only lookup (disambiguates an operator who could theoretically hold sessions on two interfaces).
- **`recordAnswered` extended in place** rather than adding a separate KPI call site, per the plan's own `key_links` contract naming exactly `recordAnswered/recordMade/recordMissed`. This also guarantees the "answered" KPI can never drift from the queue accumulator it's derived from — one call, two effects.
- **`resetKpiSinceLogin` scans by key-prefix with a colon boundary** (`key === prefix || key.startsWith(prefix + ':')`) to avoid a `PJSIP/a1` reset accidentally clobbering `PJSIP/a10`'s counters — verified by a dedicated test.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed a display bug where DIALING/CONSULT/ACW journal rows would render as OFFLINE on the agent-detail timeline**
- **Found during:** Task 3
- **Issue:** Both `eventTypeToTimelineState` switch statements (`callcenter.service.ts` and `reports/callcenter-reports.service.ts`) fall through to `OFFLINE` for any `event_type` not explicitly listed. Since Task 1/3's new DIALING rows (and the CONSULT/ACW ENUM values from 09-01) are now real `cc_agent_events` rows, leaving them unmapped would make the timeline (07-09) display a DIALING segment as "Offline" — directly undermining Task 3's stated goal ("reportable by the existing agent-detail timeline... without a reporting rewrite").
- **Fix:** Added `DIALING`/`CONSULT`/`ACW` cases returning their own state name in both switch statements.
- **Files modified:** `callcenter.service.ts`, `reports/callcenter-reports.service.ts` (+ their spec files)
- **Verification:** New unit tests in both spec files assert the mapping; full callcenter suite green.
- **Committed in:** `0c8b11a` (Task 3 feat commit)

**2. [Rule 2 - Missing Critical] Did not use `CallCenterHistoryWriterService` for the DIALING/CONSULT/ACW journal despite the plan's `files_modified` listing it for Task 3**
- **Found during:** Task 3
- **Issue:** The plan's `read_first` for Task 3 pointed at `callcenter-history-writer.service.ts` as "how CALL_START/WRAPUP_START rows are written." On inspection, `CallCenterHistoryWriterService` only ever writes `cc_queue_calls` rows (queue call history) — it has never written a `cc_agent_events` row, and neither `CALL_START` nor `WRAPUP_START` has any producer anywhere in the current codebase (confirmed via grep: those ENUM values are write-only, never `.create()`d). The plan's `read_first` reference does not describe a real, existing pattern.
- **Fix:** Implemented the DIALING journal directly in `CallCenterAmiService` using the same single-row `agentEventModel.create()` shape as the existing `logAgentEvent` (used by LOGIN/LOGOUT/PAUSE/READY/HOLD/UNHOLD/WRAPUP_END from `callcenter.service.ts`), plus a targeted `.update({ duration })` on exit. This satisfies the actual literal requirement ("write on entry with duration filled on exit," which matches the model column's own doc comment) without inventing a batched-write pattern that doesn't exist elsewhere in the codebase, and without touching `callcenter-history-writer.service.ts` (whose batching exists specifically for the high-volume `cc_queue_calls` table, not the comparatively low-volume per-status-transition journal).
- **Files modified:** `callcenter-ami.service.ts` only (no change to `callcenter-history-writer.service.ts`)
- **Verification:** `callcenter-ami.service.spec.ts#DIALING journal` tests assert both the entry create and the exit duration update.
- **Committed in:** `bafe9b6` (Task 1 feat commit — the journal logic is inseparable from `handleDialBegin`/`handleDialEnd`, which call it inline)

---

**Total deviations:** 2 auto-fixed (1 bug fix, 1 documented divergence from a stale plan reference)
**Impact on plan:** Both were necessary for correctness — the first prevents a visible reporting bug, the second avoids building an unused/duplicate write path based on a `read_first` pointer that didn't match the actual codebase. No scope creep; no new runtime behavior beyond what Tasks 1–3 already required.

## Known Limitations
- **CONSULT/ACW have no live producer.** `logStatusJournalEnter`/`logStatusJournalExit` accept `'CONSULT' | 'ACW'` and would journal them correctly, but nothing in the current AMI handler set detects a consult leg or an after-call-work state — those require dialplan/ChanSpy-level signals not yet built (RESEARCH flags this as open). Only DIALING has a real producer in this plan. This is a scope gap for a future phase, not a bug in what was built.
- **`made`/`missed` `sinceMidnight` resets to 0 on backend restart.** `restoreToday` reads `direction`/`disposition` from `cc_queue_calls` and *would* rebuild `made` (direction=`outbound`, disposition=`answered`) and personal `missed` (direction≠`inbound`, disposition=`abandoned`) if such rows existed — but no producer in this plan writes a `cc_queue_calls` row for a personal/outbound call (that requires correlating `DialBegin`→`DialEnd`→`Hangup` timing into a single history row, which is substantially more scope than the plan's action text called for and was not attempted). `sinceLogin` is unaffected (it's reset every login regardless) and `answered` restores correctly today because it already flows through the pre-existing `handleAgentComplete` → `historyWriter.enqueue` path. Flagged for the phase's history/directory work (09-11) to pick up if personal-call history rows become a requirement.
- **`handleNewchannel`'s ringing-state detection is unverified against live Asterisk.** Per the plan's own `<verification>` section ("Manual (deferred to 09-VALIDATION Manual-Only): verify Dial*/Hangup field casing against a live Asterisk during execution"), the exact `channelstatedesc`/`channelstate` values Asterisk 22 sends on `Newchannel` were not confirmed against a live PBX. The handler is defensive (no-op unless a ringing indicator is present) so a field-name mismatch fails safe (no personal-ring detection) rather than misfiring.

## Issues Encountered
- **[Test infra] Shared `jest.fn()` mocks across tests caused false failures.** `callcenter-ami.service.spec.ts`'s `agentEventModel`/`missedCallModel`/`queueModel` are module-level `const`s (pre-existing pattern), so call counts accumulate across tests unless explicitly cleared. Added `agentEventModel.create.mockClear()`/`.update.mockClear()` to `beforeEach` to fix a false "not.toHaveBeenCalled()" failure in the new DIALING-journal tests; did not touch the other shared mocks since no other test asserts a negative call count on them.
- **[Pre-existing, out of scope] `npx tsc -p packages/backend/tsconfig.json --noEmit` reports the same 7 errors** in `call-groups.service.spec.ts`/`ivrs.service.spec.ts`/`keyword-matcher.service.spec.ts` documented as pre-existing in 09-01-SUMMARY.md. None touch any file this plan modified; confirmed identical before/after.
- **[Pre-existing, out of scope] `callcenter-chat.service.spec.ts` and `call-groups.service.spec.ts` fail on the full `npm run test:backend` run** — both documented pre-existing failures (chat: `sender_user_id: undefined` mismatch, already logged in 09-01-SUMMARY.md; call-groups: `endpointsService.findAll` mock wiring, unrelated `TypeError`). Neither file was touched by this plan. `npx jest --testPathPattern="modules/callcenter"` and the scoped Task verify commands are green except for the same pre-existing chat failure.
- Local shell is PowerShell (Windows), which does not support `&&`/heredoc — commands were chained with `;` or run sequentially instead.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All-channel AMI listening is live; the DIALING transition, its journal, and the dual KPI counters are ready for 09-04 (status bar) and 09-08 (Queues tab) to consume `getAgentKpi`/`getAgentQueueKpi` and the `agentKpiUpdate` SSE event.
- 09-11 (history/directory) should be aware of the "Known Limitations" above if personal/outbound call history rows or CONSULT/ACW journaling become in-scope for that plan.
- No blockers identified for downstream Wave 2 plans.

## Self-Check: PASSED

All 11 modified source files verified present on disk with expected content; all 6 commit hashes (`6d2da8c`, `bafe9b6`, `ffa00af`, `8ae7397`, `1f02af0`, `0c8b11a`) verified present in `git log`. Full `callcenter` test suite: 190/191 passing (1 pre-existing unrelated failure). Backend lint: 0 errors.

---
*Phase: 09-call-center-agent-panel*
*Completed: 2026-07-22*
