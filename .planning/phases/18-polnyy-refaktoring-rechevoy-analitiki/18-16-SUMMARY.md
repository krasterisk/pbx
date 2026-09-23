---
phase: 18-polnyy-refaktoring-rechevoy-analitiki
plan: 16
subsystem: speech-analytics
tags: [speech-analytics, nest, hangup, ai-jobs, runAnalysis, ai-adapter, gap-closure]

requires:
  - phase: 18-polnyy-refaktoring-rechevoy-analitiki
    provides: HangupAnalyticsPort types + dialplan enqueue gate (18-03); runAnalysis pipeline (18-04); ModuleSettings pause (18-15)
provides:
  - Production HangupAnalyticsPort Nest provider exported into RoutesModule (G-18-01)
  - Nest SaAnalysisWorker with mandatory runAnalysis after 500ms/60s file wait (G-18-02)
  - SpeechAnalyticsAiAdapter + ModuleSettings + AI ports in SpeechAnalyticsModule.providers (G-18-04)
affects:
  - phase-18 verification / remaining gap plans
  - production on-hangup → ai_jobs → STT path

actuals:
  tokens: 11346
  tasks: 3
  commits: 3

plan_head_before: 61a1d6c0223e4b23494c98c414a465772cc3f94f

tech-stack:
  added: []
  patterns:
    - "HANGUP_ANALYTICS_PORT provided/exported from SpeechAnalyticsModule; RoutesModule forwardRef imports SA"
    - "SA_ANALYSIS_WORKER factory always injects runAnalysis; handoffPipeline left for legacy unit tests only"
    - "SpeechAnalyticsAiAdapter registered like Endpoints/Autodial via OnModuleInit + AiPlatformModule"

key-files:
  created:
    - packages/backend/src/modules/speech-analytics/hangup-analytics.port.ts
    - packages/backend/src/modules/speech-analytics/hangup-analytics.port.spec.ts
    - packages/backend/src/modules/speech-analytics/jobs/sa-analysis.worker.nest.ts
  modified:
    - packages/backend/src/modules/speech-analytics/speech-analytics.module.ts
    - packages/backend/src/modules/routes/routes.module.ts
    - packages/backend/src/modules/routes/dialplan-webhooks.service.spec.ts
    - packages/backend/src/modules/speech-analytics/jobs/sa-analysis.worker.ts
    - packages/backend/src/modules/speech-analytics/jobs/sa-analysis.worker.spec.ts
    - packages/backend/src/modules/speech-analytics/speech-analytics-ai.adapter.ts
    - packages/backend/src/modules/speech-analytics/speech-analytics-ai.adapter.spec.ts

key-decisions:
  - "Hangup enqueue creates sa_recording/run + AiJobAdmission with originKey idempotency; worker is fire-and-forget"
  - "knownOrigins loaded from sa_recording_relations hangup_origin rows for REQ-SA-PARITY concurrency"
  - "Nest worker omits handoffPipeline; STT/score providers may still return null until later wiring (error path, no charge)"
  - "SaAiProjectsPort / SaAiTokensPort bound via useFactory to SaProject models and IntegrationCredentialsService"

patterns-established:
  - "Cross-module hangup port: SA owns provide/export; Routes imports via forwardRef only"
  - "Gap-closure sole ownership of speech-analytics.module.ts for provider appends"

requirements-completed: [REQ-SA-PARITY, REQ-SA-ARCH]

coverage:
  - id: D1
    description: "Hangup Nest port enqueues on project+recording; skips recording off / missing project; duplicate origin is idempotent (G-18-01)"
    requirement: REQ-SA-PARITY
    verification:
      - kind: unit
        ref: "packages/backend/src/modules/routes/dialplan-webhooks.service.spec.ts#enqueues an analysis job when entitled, not paused, and route has projectId"
        status: pass
      - kind: unit
        ref: "packages/backend/src/modules/routes/dialplan-webhooks.service.spec.ts#skips chargeable enqueue when knownOrigins already has the origin (idempotent)"
        status: pass
      - kind: unit
        ref: "packages/backend/src/modules/speech-analytics/hangup-analytics.port.spec.ts#duplicate origin replays without a second chargeable admit/run"
        status: pass
    human_judgment: false
  - id: D2
    description: "Nest SaAnalysisWorker always has runAnalysis; 500ms/60s wait; no charge on wait failure (G-18-02)"
    requirement: REQ-SA-PARITY
    verification:
      - kind: unit
        ref: "packages/backend/src/modules/speech-analytics/jobs/sa-analysis.worker.spec.ts#exports a 500ms poll interval and 60s total ceiling"
        status: pass
      - kind: unit
        ref: "packages/backend/src/modules/speech-analytics/jobs/sa-analysis.worker.spec.ts#Nest factory always injects runAnalysis so handoffPipeline is unreachable"
        status: pass
    human_judgment: false
  - id: D3
    description: "SpeechAnalyticsAiAdapter and ModuleSettingsService are Nest providers; token secret once; no analyst role (G-18-04)"
    requirement: REQ-SA-ARCH
    verification:
      - kind: unit
        ref: "packages/backend/src/modules/speech-analytics/speech-analytics-ai.adapter.spec.ts#SpeechAnalyticsModule providers list includes SpeechAnalyticsAiAdapter and ModuleSettingsService (G-18-04)"
        status: pass
      - kind: unit
        ref: "packages/backend/src/modules/speech-analytics/speech-analytics-ai.adapter.spec.ts#issues a token with secret only in apply result; proposal and chat history omit the secret (D-33)"
        status: pass
    human_judgment: false

duration: 9min
completed: 2026-09-23
status: complete
---

# Phase 18 Plan 16: Nest hangup / worker / AI adapter wiring Summary

**Production Nest wiring for HangupAnalyticsPort enqueue, SaAnalysisWorker→runAnalysis, and SpeechAnalyticsAiAdapter OnModuleInit registration — closes G-18-01, G-18-02, G-18-04**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-09-23T02:45:57Z
- **Completed:** 2026-09-23T02:53:58Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- Registered `HangupAnalyticsPortService` as `HANGUP_ANALYTICS_PORT` in `SpeechAnalyticsModule` and imported SA into `RoutesModule` via `forwardRef` (no hard cycle)
- Hangup enqueue creates sa_* recording/run + `AiJobAdmission` (`speech_analytics` / `analyze`) with `originKey` idempotency, then fire-and-forget worker (STT stays out of dialplan HTTP)
- Nest `SA_ANALYSIS_WORKER` factory always injects `runAnalysis` (500ms poll / 60s ceiling / two stable polls); wait failure skips charge
- `SpeechAnalyticsAiAdapter`, `ModuleSettingsService`, and AI ports boot like Endpoints/Autodial; token secret once / digest path unchanged; no analyst role

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end Nest hangup enqueue via HANGUP_ANALYTICS_PORT (G-18-01)** - `382e759d` (feat)
2. **Task 2: Register SaAnalysisWorker Nest provider with mandatory runAnalysis (G-18-02)** - `2c89a3da` (feat)
3. **Task 3: Register SpeechAnalyticsAiAdapter in SpeechAnalyticsModule providers (G-18-04)** - `528d18d4` (feat)

**Plan metadata:** (this SUMMARY commit)

## Files Created/Modified

- `hangup-analytics.port.ts` / `.spec.ts` — production port: resolveHangupContext + enqueueAnalysisJob
- `jobs/sa-analysis.worker.nest.ts` — Nest factory binding worker → `runAnalysis`
- `jobs/sa-analysis.worker.ts` / `.spec.ts` — Nest comment + factory coverage
- `speech-analytics.module.ts` — sole gap owner: hangup port, worker, AI adapter providers
- `routes.module.ts` — `forwardRef(() => SpeechAnalyticsModule)`
- `dialplan-webhooks.service.spec.ts` — recording-off + duplicate-origin skips
- `speech-analytics-ai.adapter.ts` / `.spec.ts` — Inject tokens + module wiring assertion

## Decisions Made

- Populate `knownOrigins` from `sa_recording_relations` (`hangup_origin`) so duplicate hangups skip before a second chargeable admit
- Keep legacy `handoffPipeline` injectable only in unit tests; Nest factory never sets it
- Bind `SaAiProjectsPort` / `SaAiTokensPort` via `useFactory` (models + `IntegrationCredentialsService`) rather than inventing an analyst role surface

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## Gap Closure

| Gap | Status |
|-----|--------|
| G-18-01 | **closed** — HangupAnalyticsPort registered/exported; RoutesModule forwardRef; enqueue vs skip vs duplicate proven |
| G-18-02 | **closed** — Nest worker provider with mandatory runAnalysis; wait 500ms/60s; no charge on wait error |
| G-18-04 | **closed** — SpeechAnalyticsAiAdapter + ModuleSettingsService (+ AI ports) in providers |

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- On-hangup Nest path can enqueue analysis when admitted; worker waits then runs real `runAnalysis` wrapper
- Remaining gaps (if any) outside this sole-owner module file can proceed without rewriting SA module providers

## Self-Check: PASSED

- FOUND: `packages/backend/src/modules/speech-analytics/hangup-analytics.port.ts`
- FOUND: `packages/backend/src/modules/speech-analytics/jobs/sa-analysis.worker.nest.ts`
- FOUND: commits `382e759d`, `2c89a3da`, `528d18d4`
- FOUND: verification suite 4 passed / 24 passed

---
*Phase: 18-polnyy-refaktoring-rechevoy-analitiki*
*Completed: 2026-09-23*
