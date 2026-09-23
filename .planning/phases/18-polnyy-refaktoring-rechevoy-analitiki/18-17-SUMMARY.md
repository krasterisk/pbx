---
phase: 18-polnyy-refaktoring-rechevoy-analitiki
plan: 17
subsystem: api
tags: [speech-analytics, public-api, createRun, ingest, sa-recordings, G-18-03]

requires:
  - phase: 18-07
    provides: UploadService / UrlIngestService + SpeechAnalyticsService allocate/createRun
provides:
  - buildPublicUploadDeps / buildPublicUrlDeps — real sa_* createRun wiring
  - Public uploadBatch and analyzeUrl without journal: / journal-url: stubs
  - G-18-03 closed (UUID recording ids on public success)
affects:
  - 18-19 (UAT API re-check / UUID proof hardening)
  - live speech-analytics-uat-live API channel

actuals:
  tokens: 9388
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Public ingest deps factory binds allocate→complete→createRun→runAnalysis"
    - "Unique idempotencyKey + externalCallId per submit item (double upload → two conversations)"

key-files:
  created:
    - packages/backend/src/modules/speech-analytics/ingest/public-ingest.wiring.ts
    - packages/backend/src/modules/speech-analytics/ingest/public-ingest.wiring.spec.ts
  modified:
    - packages/backend/src/modules/speech-analytics/speech-analytics-public.controller.ts
    - packages/backend/src/modules/speech-analytics/speech-analytics-public.controller.spec.ts

key-decisions:
  - "createJournalRow returns recordingId UUID from SpeechAnalyticsService.createRun with createsCdr:false"
  - "runAnalysis calls pipeline/run-analysis (or injectable runScoredAnalysis); never analyzed:journalId"
  - "speech-analytics.module.ts left untouched (owned by 18-16)"

patterns-established:
  - "Pattern: buildPublicUploadDeps / buildPublicUrlDeps share pending asset + runByRecording maps"
  - "Pattern: public controller only resolves token project then delegates to UploadService/UrlIngestService"

requirements-completed: [REQ-SA-PARITY, REQ-SA-UAT]

coverage:
  - id: D1
    description: "uploadBatch success returns UUID journal/recording id backed by createRun (no journal: stubs)"
    requirement: REQ-SA-PARITY
    verification:
      - kind: unit
        ref: "packages/backend/src/modules/speech-analytics/speech-analytics-public.controller.spec.ts#uploadBatch success path returns UUID journal ids via createRun"
        status: pass
      - kind: unit
        ref: "packages/backend/src/modules/speech-analytics/ingest/public-ingest.wiring.spec.ts#createJournalRow persists via createRun"
        status: pass
    human_judgment: false
  - id: D2
    description: "body.projectId cannot override token project; >50MB skips createRun; double upload → two UUIDs"
    requirement: REQ-SA-UAT
    verification:
      - kind: unit
        ref: "packages/backend/src/modules/speech-analytics/ingest/public-ingest.wiring.spec.ts#file over MAX_UPLOAD_BYTES / two submits"
        status: pass
    human_judgment: false
  - id: D3
    description: "analyzeUrl uses same sa_* path; incomplete URL skips runAnalysis and continues batch"
    requirement: REQ-SA-PARITY
    verification:
      - kind: unit
        ref: "packages/backend/src/modules/speech-analytics/ingest/public-ingest.wiring.spec.ts#incomplete download skips runAnalysis"
        status: pass
      - kind: unit
        ref: "packages/backend/src/modules/speech-analytics/ingest/url-download.spec.ts#incomplete download skips runAnalysis"
        status: pass
    human_judgment: false

plan_head_before: d487fbf41e7fba52d6effc29a3d40d3692b0d36a
duration: 6min
completed: 2026-09-23
status: complete
---

# Phase 18 Plan 17: Public ingest → sa_* UUID Summary

**Публичные `uploads/batch` и `analyze-url` пишут реальные sa_* recording через `createRun` и возвращают UUID, а не stubs `journal:` / `journal-url:` (G-18-03 закрыт).**

## Performance

- **Duration:** 6 min
- **Started:** 2026-09-23T01:56:55Z
- **Completed:** 2026-09-23T02:02:47Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Вынесен `buildPublicUploadDeps` / `buildPublicUrlDeps`: allocate → put → complete → `createRun` → scored `runAnalysis`
- `uploadBatch` и `analyzeUrl` больше не возвращают синтетические id; success id = UUID `recordingId`
- Спеки покрывают override проекта, >50MB, два одинаковых файла → два id, incomplete URL без SA-CHARGE-RUN

## Task Commits

1. **Task 1 RED:** `58216195` (test) — failing UUID specs for public upload wiring
2. **Task 1 GREEN:** `9aad66c7` (feat) — `buildPublicUploadDeps` + uploadBatch wired to createRun
3. **Task 2 RED:** `a99755a9` (test) — failing analyzeUrl UUID / incomplete-batch specs
4. **Task 2 GREEN:** `b267eeff` (feat) — analyzeUrl wired via `buildPublicUrlDeps`

**Plan metadata:** (SUMMARY commit follows)

## Files Created/Modified

- `packages/backend/src/modules/speech-analytics/ingest/public-ingest.wiring.ts` — shared public ingest deps
- `packages/backend/src/modules/speech-analytics/ingest/public-ingest.wiring.spec.ts` — G-18-03 unit coverage
- `packages/backend/src/modules/speech-analytics/speech-analytics-public.controller.ts` — non-stub batch/URL
- `packages/backend/src/modules/speech-analytics/speech-analytics-public.controller.spec.ts` — source + UUID proof

## Decisions Made

- `createJournalRow` → `SpeechAnalyticsService.createRun` с уникальными `idempotencyKey` / `externalCallId` на каждый item; `{ id: recordingId, createsCdr: false }`
- `runAnalysis` вызывает `pipeline/run-analysis` (или injectable `runScoredAnalysis`); charge через `invokeSaChargeRun` с `charged=false`; без wallet / settleShadow
- `speech-analytics.module.ts` не трогали (владелец 18-16)
- `defaultUrlFetch` сохраняет insecure TLS (`rejectUnauthorized: false`)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- G-18-03 закрыт: публичный API создаёт sa_* UUID recordings
- Готово к 18-19 (автоматический UUID proof hardening + manual UAT API re-check checklist)
- Production STT/score ports по-прежнему инжектируются через `runScoredAnalysis` / `pipelineDeps`; без портов default pipeline может завершиться error после успешного createRun (journal UUID уже создан)

## Gap Closure

- **G-18-03:** closed

## Self-Check: PASSED

- FOUND: `packages/backend/src/modules/speech-analytics/ingest/public-ingest.wiring.ts`
- FOUND: `packages/backend/src/modules/speech-analytics/ingest/public-ingest.wiring.spec.ts`
- FOUND: `packages/backend/src/modules/speech-analytics/speech-analytics-public.controller.ts`
- FOUND: commits `58216195`, `9aad66c7`, `a99755a9`, `b267eeff`

---
*Phase: 18-polnyy-refaktoring-rechevoy-analitiki*
*Completed: 2026-09-23*
