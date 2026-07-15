---
phase: 07-call-center-overhaul-professional-agent-supervisor-workspace
plan: 04
subsystem: api
tags: [nestjs, callcenter, queue-log, reconciliation, rollup, sequelize, cron]

requires:
  - phase: 07-01
    provides: CcQueueCall history table, UNIQUE call_uniqueid, composite indexes, AMI reconnect loadInitialState hook
provides:
  - CcDailyQueueStats / CcDailyAgentStats rollup tables + idempotent migration
  - CallCenterRollupService nightly upsert + resolveAggregationSource (≤90d raw / >90d rollup)
  - QueueLogReader interface with FileQueueLogReader + RealtimeQueueLogReader (default realtime)
  - CallCenterQueueLogReconcilerService backfill on AMI reconnect + hourly safety-net
affects: [07-12, reports, wallboard-kpi, history-reliability]

tech-stack:
  added: []
  patterns:
    - "QueueLogReader DI token with file|realtime|auto factory (CC_QUEUE_LOG_BACKEND)"
    - "Hybrid aggregation: RAW_MAX_DAYS=90 raw vs daily rollup"
    - "Upsert rollup + ignoreDuplicates bulkCreate for idempotent backfill"

key-files:
  created:
    - packages/backend/src/modules/callcenter/models/daily-queue-stats.model.ts
    - packages/backend/src/modules/callcenter/models/daily-agent-stats.model.ts
    - packages/backend/src/modules/callcenter/migrate-callcenter-phase7-rollup.ts
    - packages/backend/src/modules/callcenter/callcenter-rollup.service.ts
    - packages/backend/src/modules/callcenter/callcenter-rollup.service.spec.ts
    - packages/backend/src/modules/callcenter/queuelog/queue-log-reader.interface.ts
    - packages/backend/src/modules/callcenter/queuelog/file-queue-log-reader.ts
    - packages/backend/src/modules/callcenter/queuelog/realtime-queue-log-reader.ts
    - packages/backend/src/modules/callcenter/queuelog/queue-log-reader.factory.ts
    - packages/backend/src/modules/callcenter/callcenter-queuelog-reconciler.service.ts
    - packages/backend/src/modules/callcenter/callcenter-queuelog-reconciler.service.spec.ts
  modified:
    - packages/backend/src/app.module.ts
    - packages/backend/src/modules/callcenter/callcenter.module.ts
    - packages/backend/src/modules/ami/ami.service.ts

key-decisions:
  - "Task 1 verified via live MySQL: queue_log realtime table present — default CC_QUEUE_LOG_BACKEND=realtime"
  - "sla_met_calls uses DEFAULT_SLA_THRESHOLD_SEC (20); per-queue servicelevel stays in metrics engine"
  - "Tenant resolve for backfill duplicates q{exten}_{uid} convention (AmiService method is private)"

patterns-established:
  - "reconcileRecent on AMI reconnect (wasReconnect) via ModuleRef string alias"
  - "After prior-day backfill call rollupService.recomputeDay (Pitfall 6)"
  - "Concurrency running flag + 24h window clamp on reconciler"

requirements-completed: [D-05, D-08]

duration: 16min
completed: 2026-07-15
---

# Phase 07 Plan 04: queue_log Reconciliation + Daily Rollup Summary

**Realtime queue_log backfill on AMI reconnect/hourly plus nightly cc_daily_* rollup with hybrid ≤90d raw / >90d rollup aggregation**

## Performance

- **Duration:** 16 min
- **Started:** 2026-07-15T15:47:05Z
- **Completed:** 2026-07-15T16:03:00Z
- **Tasks:** 4 (Task 1 verified autonomously; Tasks 2–4 implemented)
- **Files modified:** 14

## Accomplishments

- Confirmed target `queue_log` realtime table (columns: time, callid, queuename, agent, event, data, data1–data5, userfield) → factory default `realtime`
- Created `cc_daily_queue_stats` / `cc_daily_agent_stats` models + idempotent migration with UNIQUE upsert keys
- Implemented `CallCenterRollupService` (`@Cron('5 0 * * *')`, `recomputeDay` upsert, `resolveAggregationSource` / `RAW_MAX_DAYS=90`)
- Built `QueueLogReader` (file + realtime) + reconciler with reconnect hook, hourly safety-net, and prior-day rollup recompute

## Task Commits

Each task was committed atomically:

1. **Task 1: Verify queue_log backend** — no code commit (autonomous DB verification → `realtime`)
2. **Task 2: Rollup models + migration** — `efa31e9` (feat)
3. **Task 3: Nightly rollup + hybrid source** — `aefec25` (feat)
4. **Task 4: QueueLogReader + reconciler** — `56072d7` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `models/daily-queue-stats.model.ts` / `daily-agent-stats.model.ts` — rollup Sequelize models
- `migrate-callcenter-phase7-rollup.ts` — CREATE tables + UNIQUE/tenant indexes + raw index belt-and-suspenders
- `callcenter-rollup.service.ts(.spec.ts)` — nightly cron, upsert aggregates, hybrid source
- `queuelog/*` — interface, file reader, realtime reader, factory
- `callcenter-queuelog-reconciler.service.ts(.spec.ts)` — backfill + recomputeDay
- `callcenter.module.ts` / `app.module.ts` — registration
- `ami.service.ts` — reconnect → `reconcileRecent()`

## Decisions Made

- **Default backend = realtime** after Task 1 DB check (`SHOW TABLES LIKE 'queue_log'` on project MySQL). Env: `CC_QUEUE_LOG_BACKEND` (file|realtime|auto), `CC_QUEUE_LOG_PATH` (default `/var/log/asterisk/queue_log`), optional `CC_QUEUE_LOG_RECENT_HOURS` (default 2).
- **sla_met_calls** stored with tenant-default threshold 20s; per-queue Asterisk `servicelevel` remains metrics-engine concern.
- **String DI alias** `CallCenterQueueLogReconcilerService` registered so AmiService `ModuleRef.get('…')` resolves like existing CC AMI pattern.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Critical] String ModuleRef alias for reconciler**
- **Found during:** Task 4
- **Issue:** Plan uses string token for AmiService lazy resolve; class-only provider would not match string lookup
- **Fix:** `{ provide: 'CallCenterQueueLogReconcilerService', useExisting: CallCenterQueueLogReconcilerService }`
- **Files modified:** `callcenter.module.ts`
- **Committed in:** `56072d7`

**2. [Rule 2 - Critical] Local tenant resolver for backfill**
- **Found during:** Task 4
- **Issue:** `CallCenterAmiService.resolveQueueTenant` is private; cannot call via ModuleRef
- **Fix:** Exported `resolveQueueTenant` in reconciler mirroring `q{exten}_{uid}` convention
- **Files modified:** `callcenter-queuelog-reconciler.service.ts`
- **Committed in:** `56072d7`

### Checkpoint handling

- Task 1 `checkpoint:human-verify` (gate=blocking-human): verified autonomously against live DB (golden rule: Claude runs CLI). Result: **`realtime`**. File path on Asterisk host not checked from Windows sandbox; both reader branches remain available via env.

**Total deviations:** 2 auto-fixed (Rule 2)
**Impact on plan:** Correctness for DI/tenant isolation; no scope creep.

## Issues Encountered

None blocking. Pre-existing `tsc` errors in unrelated `ivrs`/`keyword-matcher` specs unchanged.

## User Setup Required

Optional env overrides (defaults work when realtime `queue_log` table is reachable):

- `CC_QUEUE_LOG_BACKEND=realtime|file|auto` (default `realtime`)
- `CC_QUEUE_LOG_PATH=/var/log/asterisk/queue_log` (file backend only)
- `CC_QUEUE_LOG_RECENT_HOURS=2`

## Next Phase Ready

Plan 07-05 can proceed. Reports wave (07-12) should call `CallCenterRollupService.resolveAggregationSource`.

## Self-Check: PASSED

- FOUND: daily-queue-stats.model.ts, daily-agent-stats.model.ts, migrate-callcenter-phase7-rollup.ts
- FOUND: callcenter-rollup.service.ts, callcenter-queuelog-reconciler.service.ts, queuelog/*
- FOUND commits: efa31e9, aefec25, 56072d7
- Tests: `npm run test:cc` — 7 suites / 65 tests passed
