---
phase: 18-polnyy-refaktoring-rechevoy-analitiki
plan: 22
subsystem: api
tags: [speech-analytics, public-ingest, upload, url-ingest, fire-and-forget, D-17, D-40, CR-03]

requires:
  - phase: 18-17
    provides: UUID createJournalRow / createRun wiring for public upload/URL
provides:
  - UploadService accepted path schedules runAnalysis without awaiting score
  - UrlIngestService mirror fire-and-forget for sync≠true / multi-item
  - Specs proving accepted returns before deferred analysis settles
affects:
  - public HTTP latency for batch ingest
  - 18 verification truth 23 / CR-03 closure

actuals:
  tokens: 4012
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Accepted: void runAnalysis(...).catch(); push ok:true + journalId immediately"
    - "sync=true && count===1 still awaits scored sync_result"

key-files:
  created: []
  modified:
    - packages/backend/src/modules/speech-analytics/ingest/upload.service.ts
    - packages/backend/src/modules/speech-analytics/ingest/upload.service.spec.ts
    - packages/backend/src/modules/speech-analytics/ingest/url-download.ts
    - packages/backend/src/modules/speech-analytics/ingest/url-download.spec.ts
    - packages/backend/src/modules/speech-analytics/speech-analytics-public.controller.spec.ts

key-decisions:
  - "When wait=false, background analysis failures do not flip HTTP item ok; they surface via run state"
  - "Batch item HTTP failures remain persist/download/validation errors; one failure continues the loop"
  - "No wallet debit / settleShadow / CDR; charged stays false; success ids stay UUIDs"

patterns-established:
  - "CR-03 / D-17 / D-40: apiWaitsForResult / urlApiWaitsForResult gate await vs schedule"
  - "TDD: submitDone assertion after 30ms while deferred runAnalysis still pending"

requirements-completed: [REQ-SA-UAT, REQ-SA-PARITY]

coverage:
  - id: D1
    description: "Public upload sync≠true returns accepted with UUID journalId before deferred runAnalysis resolves (CR-03 / D-17)"
    requirement: REQ-SA-PARITY
    verification:
      - kind: unit
        ref: "packages/backend/src/modules/speech-analytics/ingest/upload.service.spec.ts#API without sync returns accepted before deferred runAnalysis resolves (CR-03 / D-17)"
        status: pass
    human_judgment: false
  - id: D2
    description: "sync=true single file still awaits scored sync_result"
    requirement: REQ-SA-PARITY
    verification:
      - kind: unit
        ref: "packages/backend/src/modules/speech-analytics/ingest/upload.service.spec.ts#API single file sync=true waits for scored result and stores bytes"
        status: pass
    human_judgment: false
  - id: D3
    description: "URL sync≠true / incomplete skip+continue without awaiting score (D-40 / D-42)"
    requirement: REQ-SA-UAT
    verification:
      - kind: unit
        ref: "packages/backend/src/modules/speech-analytics/ingest/url-download.spec.ts#sync≠true returns accepted before deferred runAnalysis resolves (CR-03 / D-40)"
        status: pass
      - kind: unit
        ref: "packages/backend/src/modules/speech-analytics/ingest/url-download.spec.ts#incomplete download skips runAnalysis/SA-CHARGE-RUN and continues the batch"
        status: pass
    human_judgment: false

duration: 18min
completed: 2026-09-23
status: complete
plan_head_before: 7021d07a1ddf2343c004a00e189c4fc0515cc2a5
commits: 4
---

# Phase 18 Plan 22: Public accepted without awaiting score (CR-03 / D-17) Summary

**Public upload/URL при sync≠true или multi-item сразу возвращает UUID-пачку accepted, не дожидаясь scored analysis на HTTP-потоке**

## Performance

- **Duration:** 18min
- **Started:** 2026-09-23T11:31:11Z
- **Completed:** 2026-09-23T11:49:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Закрыт CR-03 / D-17: `UploadService.submit` при `apiWaitsForResult === false` делает `void runAnalysis(...).catch()` и сразу пушит `ok:true` + `journalId`
- Зеркало D-40 в `UrlIngestService` через `urlApiWaitsForResult`
- sync=true + ровно один элемент по-прежнему await и `kind: sync_result` со scored summary
- Ошибки >50MB / format / incomplete download остаются per-item; батч продолжается; два submit одного файла → две journal-строки
- Token project binding, no CDR, no settleShadow / wallet debit — без изменений

## Task Commits

1. **Task 1 RED:** `dd441586` (test) — failing upload accepted-before-score specs
2. **Task 1 GREEN:** `2f9c6d44` (feat) — UploadService fire-and-forget accepted path
3. **Task 2 RED:** `8a22a527` (test) — failing URL accepted-before-score + controller helper docs
4. **Task 2 GREEN:** `d158dcca` (feat) — UrlIngestService fire-and-forget accepted path

**Plan metadata:** (this SUMMARY commit)

## TDD Gate Compliance

- Task 1: RED_EVIDENCE_OK (`submitDone` Expected true / Received false) → GREEN
- Task 2: RED_EVIDENCE_OK (`submitDone` Expected true / Received false) → GREEN
- Plan frontmatter `type: execute` (tasks `tdd=true`); REFACTOR не потребовался
- Tracer Task 1: automated verify re-run passed; end-of-phase human_verify — без blocking checkpoint

## Files Created/Modified

- `upload.service.ts` — wait vs schedule split for runAnalysis
- `upload.service.spec.ts` — CR-03 deferred-analysis + persist-failure continue + duplicate submit
- `url-download.ts` — same wait vs schedule for URL ingest
- `url-download.spec.ts` — D-40 deferred + D-42 incomplete continue
- `speech-analytics-public.controller.spec.ts` — urlApiWaitsForResult helper assertions

## Decisions Made

- На accepted HTTP-ответе фоновые ошибки analysis не меняют `ok` (только UUID journalId); сбои persist/download/validation остаются item errors
- `speech-analytics.module.ts` и production controller не трогались
- Success ids остаются UUID (не `journal:` stubs)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- CR-03 / D-17 / D-40 / verification truth 23 closed for public accepted batches
- Ready for remaining gap plans

## Gap closure

- **CR-03:** closed
- **D-17 (upload accepted without awaiting score):** closed
- **D-40 (URL accepted without awaiting score):** closed

## Self-Check: PASSED

- Owned source files present and committed
- Commits `dd441586`, `2f9c6d44`, `8a22a527`, `d158dcca` on HEAD ancestry
- Full verify: 3 suites / 23 tests passed (`upload.service|url-download|speech-analytics-public.controller`)
- No stubs / settleShadow / BillingBalanceService / CDR writes on owned paths

---
*Phase: 18-polnyy-refaktoring-rechevoy-analitiki*
*Completed: 2026-09-23*
