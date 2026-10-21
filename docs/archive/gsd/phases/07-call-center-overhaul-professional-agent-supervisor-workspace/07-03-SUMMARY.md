---
phase: 07-call-center-overhaul-professional-agent-supervisor-workspace
plan: 03
subsystem: api
tags: [nestjs, callcenter, metrics, sla, sse, sequelize, in-memory]

requires:
  - phase: 07-01
    provides: CcQueueCall history table, batched writer, cc_queue_calls indexes
provides:
  - CallCenterMetricsService with SLA/ASR/AHT/ASA/Occupancy/Abandon formulas
  - restoreToday from cc_queue_calls on startup (D-06)
  - Per-queue SLA threshold from queue.servicelevel with DEFAULT_SLA_THRESHOLD_SEC fallback (D-07)
  - Live AMI integration publishing queueMetrics SSE events
  - GET /callcenter/metrics/queues tenant-scoped endpoint
affects: [07-09, 07-12, 07-13, wallboard, supervisor-sparklines, reports]

tech-stack:
  added: []
  patterns:
    - "In-memory per-tenant accumulators keyed ${userUid}:${queueName}"
    - "Real-time metrics never query DB in AMI hot path"
    - "restoreToday rebuilds today accumulators from cc_queue_calls on module init"

key-files:
  created:
    - packages/backend/src/modules/callcenter/callcenter-metrics.service.ts
    - packages/backend/src/modules/callcenter/callcenter-metrics.service.spec.ts
  modified:
    - packages/backend/src/modules/callcenter/callcenter.module.ts
    - packages/backend/src/modules/callcenter/callcenter-ami.service.ts
    - packages/backend/src/modules/callcenter/callcenter-ami.service.spec.ts
    - packages/backend/src/modules/callcenter/callcenter.controller.ts

key-decisions:
  - "Tasks 1+2 committed together — restoreToday lives in same service file as accumulators"
  - "resolveSlaThreshold sync fallback uses cache or DEFAULT_SLA_THRESHOLD_SEC in hot path; async ensureSlaThreshold populates cache"
  - "idleSeconds for Occupancy not restored after restart — accumulates from module start only"

patterns-established:
  - "queueMetrics SSE event carries computed metrics snapshot after each answered/abandoned call"
  - "QueueState.sla/avgWait/avgTalk synced from metrics engine for backward-compatible queueUpdate consumers"

requirements-completed: [D-03, D-06, D-07]

duration: 22min
completed: 2026-07-15
---

# Phase 07 Plan 03: Call Center Metrics Engine Summary

**In-memory CallCenterMetricsService computing SLA/ASR/AHT/ASA/Occupancy/Abandon from AMI events and cc_queue_calls restore, with tenant-scoped GET /callcenter/metrics/queues and queueMetrics SSE**

## Performance

- **Duration:** 22 min
- **Started:** 2026-07-15T15:36:00Z
- **Completed:** 2026-07-15T15:58:00Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Built `CallCenterMetricsService` with per-queue/per-agent accumulators and all six §4.6 formulas
- Implemented `restoreToday()` from `cc_queue_calls` on module init for accurate post-restart metrics (D-06)
- Per-queue SLA threshold from `queue.servicelevel` with `DEFAULT_SLA_THRESHOLD_SEC=20` fallback (D-07)
- Wired AMI handlers to sync-increment accumulators and publish `queueMetrics` SSE + updated QueueState SLA
- Added tenant-scoped `GET /callcenter/metrics/queues` (no userUid from query/body — T-07-03-01)

## Task Commits

Each task was committed atomically:

1. **Task 1+2: CallCenterMetricsService — accumulators, formulas, restore** - `e1165a0` (feat)
2. **Task 3: Live metrics integration via AMI and REST** - `34ab083` (feat)

_Note: Tasks 1 and 2 share one commit because restoreToday is in the same service file as the accumulator engine._

## Files Created/Modified

- `packages/backend/src/modules/callcenter/callcenter-metrics.service.ts` - Metrics engine, formulas, restore, record* methods
- `packages/backend/src/modules/callcenter/callcenter-metrics.service.spec.ts` - Unit tests (formulas, threshold, tenant isolation, restore)
- `packages/backend/src/modules/callcenter/callcenter.module.ts` - Register and export CallCenterMetricsService
- `packages/backend/src/modules/callcenter/callcenter-ami.service.ts` - AMI integration, queueMetrics SSE, recordAgentStatus
- `packages/backend/src/modules/callcenter/callcenter-ami.service.spec.ts` - Mock metricsService in constructor
- `packages/backend/src/modules/callcenter/callcenter.controller.ts` - GET metrics/queues endpoint

## Decisions Made

- Tasks 1+2 merged into one commit (shared service file; restore is inseparable from accumulator types)
- Hot-path `recordAnswered` uses sync SLA cache lookup; async `ensureSlaThreshold` warms cache without blocking AMI
- Occupancy `idleSeconds` not restored from DB after restart (documented limitation; talk/counts fully restored)

## Deviations from Plan

### Task commit grouping

- **Found during:** Task 2 commit step
- **Issue:** `restoreToday()` and accumulator types live in the same new file created in Task 1
- **Fix:** Committed Tasks 1+2 together in `e1165a0`; Task 3 in separate commit `34ab083`
- **Impact:** No functional deviation; all acceptance criteria met

Otherwise: None — plan executed as written.

## Issues Encountered

- PowerShell does not support bash heredoc for git commit messages — used `-m` repeated flags instead
- Pre-existing `tsc` errors in ivrs/voice-robots spec files unrelated to this plan (out of scope)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Wallboard (07-13), supervisor sparklines (07-09), and reports (07-12) can consume `getTenantQueueMetrics` and `queueMetrics` SSE
- Tenant-level configurable SLA default deferred to 07-05 (`cc_settings`); `resolveSlaThreshold` ready for substitution
- Load calibration under peak AMI event rate (RESEARCH A5) remains a future verification note

## Self-Check: PASSED

- FOUND: packages/backend/src/modules/callcenter/callcenter-metrics.service.ts
- FOUND: packages/backend/src/modules/callcenter/callcenter-metrics.service.spec.ts
- FOUND: commit e1165a0
- FOUND: commit 34ab083

---
*Phase: 07-call-center-overhaul-professional-agent-supervisor-workspace*
*Completed: 2026-07-15*
