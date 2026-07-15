---
phase: 07-call-center-overhaul-professional-agent-supervisor-workspace
plan: 01
subsystem: callcenter
tags: [sequelize, ami, batched-writer, nestjs, queue-history, bulkCreate]

requires:
  - phase: 06-dialplan-apps-ring-groups-multi-channel-notifications-ux-ove
    provides: Call Center AMI/state foundation (CallCenterAmiService, CallCenterStateService)
provides:
  - CcQueueCall model + cc_queue_calls table (history foundation for reports/metrics)
  - CallCenterHistoryWriterService (batched enqueue/flush with MAX_BUFFER cap)
  - Blind transfer uses callerChannel; AMI reconnect triggers loadInitialState
affects:
  - 07-02 metrics engine
  - 07-04 daily rollup / D-08
  - wallboard sparklines and agent timeline plans

tech-stack:
  added: []
  patterns:
    - "Batched-async history writer: sync enqueue + @Interval/threshold bulkCreate"
    - "AMI reconnect resync via hasConnectedOnce + delayed loadInitialState"

key-files:
  created:
    - packages/backend/src/modules/callcenter/models/queue-call.model.ts
    - packages/backend/src/modules/callcenter/migrate-callcenter-phase7.ts
    - packages/backend/src/modules/callcenter/callcenter-history-writer.service.ts
    - packages/backend/src/modules/callcenter/callcenter-history-writer.service.spec.ts
  modified:
    - packages/backend/src/app.module.ts
    - packages/backend/src/modules/callcenter/callcenter.module.ts
    - packages/backend/src/modules/callcenter/callcenter-ami.service.ts
    - packages/backend/src/modules/callcenter/callcenter-ami.service.spec.ts
    - packages/backend/src/modules/callcenter/callcenter.service.ts
    - packages/backend/src/modules/callcenter/callcenter.service.spec.ts
    - packages/backend/src/modules/ami/ami.service.ts

key-decisions:
  - "History rows written only on terminal events (AgentComplete/CallerAbandon) to honor UNIQUE call_uniqueid until upsert exists"
  - "MAX_BUFFER=5000 drops oldest rows with warn; failed flush does not re-queue (D-09 / T-07-01)"
  - "Blind Redirect uses call.callerChannel with BadRequestException if missing"

patterns-established:
  - "Pattern: AMI hot path → historyWriter.enqueue (never await Model.create for cc_queue_calls)"
  - "Pattern: AMI reconnect → delayed loadInitialState after hasConnectedOnce"

requirements-completed: [D-01, D-02, D-03, D-04, D-05, D-09]

duration: 8min
completed: 2026-07-15
---

# Phase 07 Plan 01: Call history persistence foundation Summary

**cc_queue_calls + batched history writer with buffer cap; blind transfer uses callerChannel; AMI reconnect resyncs QueueStatus**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-15T15:18:12Z
- **Completed:** 2026-07-15T15:25:45Z
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments

- Sequelize model `CcQueueCall` / table `cc_queue_calls` with tenant + date/queue/agent indexes and UNIQUE `call_uniqueid`; idempotent standalone migration
- `CallCenterHistoryWriterService` flushes by interval (1000ms) and threshold (200) with hard cap 5000; AMI `handleAgentComplete` / `handleCallerAbandon` enqueue without blocking
- Audit fixes: blind `Redirect` uses `callerChannel`; AMI reconnect schedules `loadInitialState()` after first successful connect

## Task Commits

1. **Task 1: Модель cc_queue_calls + миграция + регистрация** - `336cb6b` (feat)
2. **Task 2: Batched-async history writer + wiring AMI-хендлеров** - `cf2b13b` (feat)
3. **Task 3: Аудит-фиксы — agentTransfer + AMI reconnect resync** - `7c81b1e` (fix)

**Plan metadata:** (pending docs commit)

## Files Created/Modified

- `packages/backend/src/modules/callcenter/models/queue-call.model.ts` — CcQueueCall history model
- `packages/backend/src/modules/callcenter/migrate-callcenter-phase7.ts` — CREATE table + indexes
- `packages/backend/src/modules/callcenter/callcenter-history-writer.service.ts` — batched writer
- `packages/backend/src/modules/callcenter/callcenter-history-writer.service.spec.ts` — unit tests (threshold, flush, cap)
- `packages/backend/src/modules/callcenter/callcenter-ami.service.ts` — inject writer; enqueue on complete/abandon
- `packages/backend/src/modules/callcenter/callcenter.service.ts` — transfer channel fix
- `packages/backend/src/modules/ami/ami.service.ts` — reconnect resync
- `packages/backend/src/app.module.ts` / `callcenter.module.ts` — model + writer registration

## Decisions Made

- Terminal-only history inserts (complete/abandon) because Task 1 UNIQUE on `call_uniqueid` would collide if join/connect also bulkCreate the same uniqueid; upsert/update path deferred to later metrics/rollup plans
- Cap drop + no flush retry under systematic DB failure (threat T-07-01 / D-09)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Correctness] Skip enqueue on handleCallerJoin/handleAgentConnect**
- **Found during:** Task 2
- **Issue:** Plan listed join/connect as enqueue points, but UNIQUE `call_uniqueid` means intermediate inserts would break terminal bulkCreate
- **Fix:** Enqueue only on terminal complete/abandon (acceptance criteria greps); join/connect remain in-memory state only
- **Files modified:** `callcenter-ami.service.ts`
- **Verification:** `npm run test:cc` green; UNIQUE respected
- **Committed in:** `cf2b13b`

---

**Total deviations:** 1 auto-fixed (correctness vs UNIQUE)
**Impact on plan:** Required for D-03 uniqueness; join/connect persist remains available for a later upsert plan if needed

## Issues Encountered

- `npx tsc --noEmit` still reports pre-existing errors in unrelated specs (`ivrs.service.spec.ts`, `keyword-matcher.service.spec.ts`); no new errors from this plan's files

## User Setup Required

None - no external service configuration required. Run migration once in each environment:

`cd packages/backend && npx ts-node src/modules/callcenter/migrate-callcenter-phase7.ts`

## Next Phase Readiness

- History write path ready for metrics/rollup consumers (07-02+)
- `npm run test:cc`: 44 passed (writer + transfer regression included)

## Self-Check: PASSED

- FOUND: queue-call.model.ts, migrate-callcenter-phase7.ts, callcenter-history-writer.service.ts/.spec.ts
- FOUND commits: 336cb6b, cf2b13b, 7c81b1e

---
*Phase: 07-call-center-overhaul-professional-agent-supervisor-workspace*
*Completed: 2026-07-15*
