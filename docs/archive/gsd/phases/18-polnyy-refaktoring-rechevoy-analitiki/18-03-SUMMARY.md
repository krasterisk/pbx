---
phase: 18-polnyy-refaktoring-rechevoy-analitiki
plan: 03
subsystem: speech-analytics
tags: [speech-analytics, hangup, dialplan, ai-jobs, file-wait, tdd, jest]

requires:
  - phase: 18-polnyy-refaktoring-rechevoy-analitiki
    provides: charge seams from 18-01; route project Select + capture policy + hangup_handler from 18-02
provides:
  - Hangup handleOnHangup admit/enqueue via decideHangupAnalysisAdmission (D-03, D-19)
  - SaAnalysisWorker 500ms/60s stable non-empty file wait before pipeline handoff
  - Dialplan notify when SA_PROJECT set without WH_OH
affects:
  - 18-04 runAnalysis pipeline wiring from worker handoff
  - Production HangupAnalyticsPort Nest provider registration

actuals:
  tokens: 7200
  tasks: 2
  commits: 5

plan_head_before: 6b8cdfe2fd44299c275f6a5677ae0cd1003e3666

tech-stack:
  added: []
  patterns:
    - "HangupAnalyticsPort injects resolveHangupContext + enqueueAnalysisJob; STT stays out of handleOnHangup"
    - "decideHangupAnalysisAdmission = resolveCapturePolicy then admitInternalAssetReady"
    - "File wait: 500ms poll, 60s ceiling, two consecutive equal size>0 polls"

key-files:
  created:
    - packages/backend/src/modules/routes/dialplan-webhooks.service.spec.ts
    - packages/backend/src/modules/speech-analytics/jobs/sa-analysis.worker.ts
    - packages/backend/src/modules/speech-analytics/jobs/sa-analysis.worker.spec.ts
  modified:
    - packages/backend/src/modules/routes/dialplan-webhooks.service.ts
    - packages/backend/src/modules/speech-analytics/reporting/internal-admission.ts
    - packages/backend/src/modules/speech-analytics/reporting/internal-admission.spec.ts
    - packages/backend/src/shared/utils/dialplan-subroutines.util.ts
    - packages/backend/src/modules/routes/route-recording.util.ts

key-decisions:
  - "Optional HANGUP_ANALYTICS_PORT keeps RoutesModule free of SpeechAnalytics imports; unit tests inject the port"
  - "Controller fire-and-forget remains; handleOnHangup awaits admit/enqueue only (no STT)"
  - "Dialplan early Return requires WH_OH!=1 AND SA_PROJECT!=1; routes set __SA_PROJECT=1 when analytics project attached"

patterns-established:
  - "Worker handoff state ready_for_pipeline — fakeStt never counts as scored success"
  - "Timeout/empty file wait → error run without invokeSaChargeRun"

requirements-completed: [REQ-SA-PARITY]

coverage:
  - id: D1
    description: "handleOnHangup enqueues analysis when entitled, not paused, and route has projectId; skips pause/missing project; does not call STT"
    requirement: REQ-SA-PARITY
    verification:
      - kind: unit
        ref: "packages/backend/src/modules/routes/dialplan-webhooks.service.spec.ts#enqueues an analysis job when entitled, not paused, and route has projectId"
        status: pass
    human_judgment: false
  - id: D2
    description: "decideHangupAnalysisAdmission gates enqueue via capture-policy + admitInternalAssetReady"
    requirement: REQ-SA-PARITY
    verification:
      - kind: unit
        ref: "packages/backend/src/modules/speech-analytics/reporting/internal-admission.spec.ts#decideHangupAnalysisAdmission enqueues when entitled, not paused, and projectId is set"
        status: pass
    human_judgment: false
  - id: D3
    description: "Worker waits with 500ms poll / 60s ceiling / two-poll size stability; timeout or empty skips SA-CHARGE-RUN; fakeStt not scored success"
    requirement: REQ-SA-PARITY
    verification:
      - kind: unit
        ref: "packages/backend/src/modules/speech-analytics/jobs/sa-analysis.worker.spec.ts#exports a 500ms poll interval and 60s total ceiling"
        status: pass
    human_judgment: false
  - id: D4
    description: "Hangup dialplan keeps StopMixMonitor → ffmpeg → CURL and notifies when SA_PROJECT attached without WH_OH"
    requirement: REQ-SA-PARITY
    verification:
      - kind: unit
        ref: "packages/backend/src/modules/speech-analytics/jobs/sa-analysis.worker.spec.ts#orders StopMixMonitor then ffmpeg then CURL on-hangup, and notifies when analytics project is attached"
        status: pass
    human_judgment: false

duration: 55min
completed: 2026-09-22
status: complete
---

# Phase 18 Plan 03: Hangup enqueue + file-wait worker Summary

**Hangup admits and enqueues analysis jobs without STT; worker polls 500ms up to 60s for a stable non-empty recording before pipeline handoff**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-09-22T12:47:00Z
- **Completed:** 2026-09-22T13:00:00Z
- **Tasks:** 2
- **Files modified:** 8 (+ TDD evidence under `.planning/.../tdd/`)

## Accomplishments

- Extended `handleOnHangup` to run capture/admission then enqueue via injectable `HangupAnalyticsPort` without STT/scoring/SA-CHARGE-RUN
- Added `decideHangupAnalysisAdmission` combining `resolveCapturePolicy` + `admitInternalAssetReady` (pause/project skip)
- Implemented `SaAnalysisWorker` / `waitForStableNonEmptyFile` with 500ms poll, 60s ceiling, two-poll size stability
- Dialplan `[krsk-hangup-handler]` notifies when `SA_PROJECT=1` even if `WH_OH` unset; routes set `__SA_PROJECT=1` when analytics project is attached

## Task Commits

Each task was committed atomically (TDD RED then GREEN):

1. **Task 1 RED: hangup enqueue specs** - `3f3945ea` (test)
2. **Task 1 GREEN: hangup admit/enqueue** - `6b9d3a2b` (feat)
3. **Task 2 RED: worker file-wait specs** - `e8e622f3` (test)
4. **Task 2 GREEN: worker wait + dialplan SA_PROJECT** - `bf6d7844` (feat)

**Plan metadata:** (this SUMMARY commit)

## TDD Gate Compliance

| Task | RED evidence | Verdict | GREEN verify |
|------|--------------|---------|--------------|
| 1 | `.planning/.../tdd/hangup-enqueue-red-evidence.json` | RED_EVIDENCE_OK | 12/12 Jest passed |
| 2 | `.planning/.../tdd/sa-analysis-worker-red-evidence.json` | RED_EVIDENCE_OK | 6/6 Jest passed |

## Files Created/Modified

- `dialplan-webhooks.service.ts` / `.spec.ts` — hangup analytics port + enqueue path; no STT
- `internal-admission.ts` / `.spec.ts` — `decideHangupAnalysisAdmission`
- `sa-analysis.worker.ts` / `.spec.ts` — file wait + error without charge; dialplan order assertion
- `dialplan-subroutines.util.ts` — WH_OH ∧ SA_PROJECT early Return
- `route-recording.util.ts` — `__SA_PROJECT=1` when analytics project set (Rule 2)

## Decisions Made

- Optional Nest token `HANGUP_ANALYTICS_PORT` for unit-test injection; production provider registration deferred to composition wiring
- Await admit/enqueue inside `handleOnHangup` while controller still `void`s the handler (Asterisk non-blocking)
- Optimistic `speechDetected` from duration ≥400ms at hangup; empty file fails in worker wait

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Set `__SA_PROJECT=1` in recording dialplan lines**
- **Found during:** Task 2 GREEN
- **Issue:** Subroutine early Return now checks `SA_PROJECT`, but routes never set the channel var — analytics-only hangups would still skip CURL
- **Fix:** `recordingDialplanLines` sets `Set(__SA_PROJECT=1)` when `analyticsProjectId` is present
- **Files modified:** `packages/backend/src/modules/routes/route-recording.util.ts`
- **Verification:** `sa-analysis.worker` dialplan order test + existing route-recording.util specs
- **Committed in:** `bf6d7844`

---

**Total deviations:** 1 auto-fixed (missing critical dialplan flag)
**Impact on plan:** Required for analytics notify without webhook; no scope creep into STT/charge

## Issues Encountered

- Production `HangupAnalyticsPort` Nest provider is not registered in this plan (optional inject); unit path is proven; wiring expected when SA composition binds the port to AiJobAdmission + capture policy models

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Worker handoff state `ready_for_pipeline` is ready for 18-04 `runAnalysis`
- Do not treat `fakeStt` as scored success; charge seam stays out of wait failures

## Self-Check: PASSED

- FOUND: dialplan-webhooks.service.ts, dialplan-webhooks.service.spec.ts, internal-admission.ts, internal-admission.spec.ts, sa-analysis.worker.ts, sa-analysis.worker.spec.ts, dialplan-subroutines.util.ts, route-recording.util.ts
- FOUND commits: 3f3945ea, 6b9d3a2b, e8e622f3, bf6d7844

---
*Phase: 18-polnyy-refaktoring-rechevoy-analitiki*
*Completed: 2026-09-22*
