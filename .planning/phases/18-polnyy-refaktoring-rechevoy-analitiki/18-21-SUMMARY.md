---
phase: 18-polnyy-refaktoring-rechevoy-analitiki
plan: 21
subsystem: api
tags: [speech-analytics, hangup, charging, audioMs, nest-worker, D-46, CR-02]

requires:
  - phase: 18-16
    provides: HangupAnalyticsPort + Nest SaAnalysisWorker wiring with runAnalysis
provides:
  - SaAnalysisJob.durationSec / audioMs from hangup enqueue
  - Nest runAnalysis audioMs from duration, never waitForFile bytes
  - runAnalysis STT durationSec*1000 fallback when hangup audioMs unknown/zero
affects:
  - 18-22
  - SA-CHARGE-RUN audio_ms accuracy on hangup route

actuals:
  tokens: 2804
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Hangup durationSec*1000 on SaAnalysisJob; Nest never maps wait bytes to audioMs"
    - "Charge audioMs: positive hangup wins, else STT durationSec→ms; charged=false"

key-files:
  created: []
  modified:
    - packages/backend/src/modules/speech-analytics/jobs/sa-analysis.worker.ts
    - packages/backend/src/modules/speech-analytics/jobs/sa-analysis.worker.spec.ts
    - packages/backend/src/modules/speech-analytics/jobs/sa-analysis.worker.nest.ts
    - packages/backend/src/modules/speech-analytics/hangup-analytics.port.ts
    - packages/backend/src/modules/speech-analytics/hangup-analytics.port.spec.ts
    - packages/backend/src/modules/speech-analytics/pipeline/run-analysis.ts
    - packages/backend/src/modules/speech-analytics/pipeline/run-analysis.spec.ts

key-decisions:
  - "audioMs preference: job.audioMs, else durationSec*1000, else 0 for Nest→pipeline (STT fallback in runAnalysis)"
  - "STT fallback uses Math.round(durationSec*1000); hangup positive audioMs always wins"
  - "charged remains false; no settleShadow / BillingBalanceService on this path"

patterns-established:
  - "CR-02: waitForFile bytes are diagnostics only; charge duration comes from hangup or STT"
  - "TDD RED→GREEN per gap task with intentional bytes-as-ms regression specs"

requirements-completed: [REQ-SA-PARITY]

coverage:
  - id: D1
    description: "Nest hangup runAnalysis passes audioMs from durationSec/audioMs, never waitForFile byte size (CR-02 / D-46)"
    requirement: REQ-SA-PARITY
    verification:
      - kind: unit
        ref: "packages/backend/src/modules/speech-analytics/jobs/sa-analysis.worker.spec.ts#Nest runAnalysis passes audioMs from durationSec not waitForFile bytes (CR-02, D-46)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Hangup enqueue puts durationSec and audioMs=durationSec*1000 onto processJob"
    requirement: REQ-SA-PARITY
    verification:
      - kind: unit
        ref: "packages/backend/src/modules/speech-analytics/hangup-analytics.port.spec.ts#enqueueAnalysisJob creates recording/run + AiJobAdmission and schedules worker async"
        status: pass
    human_judgment: false
  - id: D3
    description: "When hangup audioMs is 0/unknown, SA-CHARGE-RUN uses STT durationSec*1000; positive hangup wins"
    requirement: REQ-SA-PARITY
    verification:
      - kind: unit
        ref: "packages/backend/src/modules/speech-analytics/pipeline/run-analysis.spec.ts#uses STT durationSec*1000 for SA-CHARGE-RUN when hangup audioMs is 0 or unknown (D-46)"
        status: pass
      - kind: unit
        ref: "packages/backend/src/modules/speech-analytics/pipeline/run-analysis.spec.ts#prefers positive hangup audioMs over STT duration for SA-CHARGE-RUN (D-46)"
        status: pass
    human_judgment: false

duration: 4min
completed: 2026-09-23
status: complete
plan_head_before: d4b6c79977e045efa6843aa62fb2209cdda42303
commits: 4
---

# Phase 18 Plan 21: Hangup audioMs duration (CR-02 / D-46) Summary

**Nest hangup worker передаёт в SA-CHARGE-RUN длительность аудио (durationSec×1000 / STT), а не размер файла в байтах**

## Performance

- **Duration:** 4min
- **Started:** 2026-09-23T11:25:26Z
- **Completed:** 2026-09-23T11:29:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Закрыт CR-02 / D-46: `createSaAnalysisWorker` больше не мапит `waitForFile` bytes → `audioMs`
- `HangupAnalyticsPort.enqueueAnalysisJob` кладёт `durationSec` и `audioMs=durationSec*1000` в `processJob`
- При неизвестной/нулевой hangup-длительности charge берёт `Math.round(stt.durationSec*1000)`; положительный hangup `audioMs` побеждает
- `charged` остаётся false; settleShadow / BillingBalanceService не добавлены; wait 500ms / 60s сохранён

## Task Commits

1. **Task 1 RED:** `acf77159` (test) — failing specs for bytes-as-ms + hangup duration payload
2. **Task 1 GREEN:** `cf74b1a4` (feat) — SaAnalysisJob duration fields, hangup enqueue, nest audioMs fix
3. **Task 2 RED:** `60341b31` (test) — failing STT fallback + hangup-wins specs
4. **Task 2 GREEN:** `ebf8d46e` (feat) — runAnalysis charge audioMs selection with STT fallback

**Plan metadata:** (this SUMMARY commit)

## TDD Gate Compliance

- Task 1: RED evidence OK (`audioMs` Expected 45000 / Received 4194304) → GREEN
- Task 2: RED evidence OK (`audioMs` Expected 37400 / Received 0) → GREEN
- Plan frontmatter `type: execute` (tasks `tdd=true`); no REFACTOR commits needed

## Files Created/Modified

- `sa-analysis.worker.ts` — optional `durationSec` / `audioMs` on `SaAnalysisJob`
- `sa-analysis.worker.nest.ts` — resolve audioMs from job duration; `_bytes` unused for charge
- `hangup-analytics.port.ts` — enqueue passes `durationSec` and `audioMs`
- `run-analysis.ts` — charge prefers hangup audioMs, else STT ms
- Matching `*.spec.ts` — CR-02 / D-46 regression coverage

## Decisions Made

- Nest: `job.audioMs` → else `durationSec*1000` → else `0` (lets pipeline STT fallback run)
- Pipeline: `hangupAudioMs > 0` wins; else `Math.round(stt.durationSec*1000)`
- No wallet debit / settleShadow on this path (D-46 / D-49 unchanged)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- CR-02 / D-46 / verification truth 22 closed for hangup Nest charge duration
- Ready for remaining gap plans (18-22)

## Gap closure

- **CR-02:** closed
- **D-46 (hangup audio_ms units):** closed

## Self-Check: PASSED

- Owned source files present and committed
- Commits `acf77159`, `cf74b1a4`, `60341b31`, `ebf8d46e` on HEAD ancestry
- Full verify: 3 suites / 20 tests passed
- No stubs / settleShadow / BillingBalanceService on owned paths

---
*Phase: 18-polnyy-refaktoring-rechevoy-analitiki*
*Completed: 2026-09-23*
