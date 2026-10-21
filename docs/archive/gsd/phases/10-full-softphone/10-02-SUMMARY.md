---
phase: 10-full-softphone
plan: 02
subsystem: api
tags: [nestjs, sse, callcenter, journal, settings, sequelize]

requires:
  - phase: 07-call-center-overhaul-professional-agent-supervisor-workspace
    provides: CallCenterHistoryWriterService buffered bulkCreate + CallCenterStateService.emitEvent
provides:
  - historyRow SSE emit after successful history writes (single + bulk) for Journal live prepend (D-05)
  - journal_depth tenant CC setting (default 50) via existing settings routes (D-04)
affects: [10-04, 10-05, phase-10-verify-work]

tech-stack:
  added: []
  patterns:
    - "Post-write SSE delta (historyRow) addressed by row.user_uid — same emitEvent signature as agentHold"
    - "Standalone migrate-callcenter-journal-depth.ts addColumn idempotent try/catch"

key-files:
  created:
    - packages/backend/src/modules/callcenter/migrate-callcenter-journal-depth.ts
  modified:
    - packages/backend/src/modules/callcenter/callcenter-history-writer.service.ts
    - packages/backend/src/modules/callcenter/callcenter-history-writer.service.spec.ts
    - packages/backend/src/modules/callcenter/models/cc-settings.model.ts
    - packages/backend/src/modules/callcenter/callcenter-settings.service.ts
    - packages/backend/src/modules/callcenter/dto/callcenter-settings.dto.ts
    - packages/backend/src/modules/callcenter/callcenter-settings.service.spec.ts

key-decisions:
  - "Added createOne() single-insert path so both write paths emit (bulk was the only path before)"
  - "When MySQL bulkCreate returns empty ids, fall back to buffered row fields for emit payload"
  - "journal_depth is tenant-only (no operator override); Min 1 / Max 500 on DTO"

patterns-established:
  - "History writer injects CallCenterStateService; emit only after successful write"

requirements-completed: [D-04, D-05]

coverage:
  - id: D1
    description: "historyRow SSE once per persisted row on bulk flush and createOne, tenant-addressed"
    requirement: "D-05"
    verification:
      - kind: unit
        ref: "callcenter-history-writer.service.spec.ts#historyRow SSE"
        status: pass
    human_judgment: false
  - id: D2
    description: "No historyRow emit when bulkCreate throws"
    requirement: "D-05"
    verification:
      - kind: unit
        ref: "callcenter-history-writer.service.spec.ts#does not emit when bulkCreate throws"
        status: pass
    human_judgment: false
  - id: D3
    description: "journal_depth column default 50 on cc_settings + tenant get/update"
    requirement: "D-04"
    verification:
      - kind: unit
        ref: "callcenter-settings.service.spec.ts#journal_depth"
        status: pass
    human_judgment: true
    rationale: "Migration must be applied to live DB before FE Journal depth reads the column"

duration: 20min
completed: 2026-07-24
status: complete
---

# Phase 10: Plan 02 Summary

**Journal backends: live `historyRow` SSE on history writes + configurable `journal_depth` (default 50).**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2/2
- **Files modified:** 7

## Accomplishments

- `CallCenterHistoryWriterService` emits `historyRow` after successful `bulkCreate` and new `createOne`.
- `journal_depth` on `CcSettings` + DTO/service + standalone migration script.

## Verification

- `callcenter-history-writer.service.spec` + `callcenter-settings.service.spec` — 37 passed

## Next

- Apply `migrate-callcenter-journal-depth.ts` to live DB when ready
- Wave 2: **10-03** SIP AMI backend
