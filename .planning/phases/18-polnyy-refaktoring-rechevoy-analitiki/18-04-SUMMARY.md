---
phase: 18-polnyy-refaktoring-rechevoy-analitiki
plan: 04
subsystem: speech-analytics
tags: [speech-analytics, stt, diarize, scoring, sa-charge-run, tdd, jest]

requires:
  - phase: 18-polnyy-refaktoring-rechevoy-analitiki
    provides: SA-CHARGE-RUN seam (18-01); file-wait worker handoff (18-03)
provides:
  - runAnalysis orchestration ending in invokeSaChargeRun (D-46)
  - D-38 model resolution with allowlist + one silence fallback
  - Energy channel diarize with D-24 route/upload maps; dual-stt absent (D-23)
affects:
  - 18-07 upload/API runAnalysis consumers
  - 18-08 regenerate / journal success paths

actuals:
  tokens: 11489
  tasks: 2
  commits: 5

plan_head_before: 8960781b56f107cc40259c4010ba7c138e4ff15b

tech-stack:
  added: []
  patterns:
    - "runAnalysis deps inject stt/score/diarize; success → persist then invokeSaChargeRun once"
    - "D-38 resolveAnalysisModels: project override else module default; silence retries module when different; no off-list models"
    - "diarizeChannels: identical L/R → not_stereo + LLM roles; energy failure → LLM roles; never requestSecondStt"

key-files:
  created:
    - packages/backend/src/modules/speech-analytics/pipeline/run-analysis.ts
    - packages/backend/src/modules/speech-analytics/pipeline/run-analysis.spec.ts
    - packages/backend/src/modules/speech-analytics/pipeline/stt.ts
    - packages/backend/src/modules/speech-analytics/pipeline/score.ts
    - packages/backend/src/modules/speech-analytics/pipeline/channel-diarize.ts
    - packages/backend/src/modules/speech-analytics/pipeline/channel-diarize.spec.ts
  modified:
    - packages/backend/src/modules/speech-analytics/pipeline.ts
    - packages/backend/src/modules/speech-analytics/jobs/sa-analysis.worker.ts

key-decisions:
  - "Worker prefers runAnalysis when injected; legacy handoffPipeline kept so 18-03 wait specs stay green without editing worker.spec"
  - "Published version models are stamped on persistSuccess; runtime silence fallback does not rewrite the stamp (D-38)"
  - "HANGUP_ANALYTICS_PORT remains optional/unwired in RoutesModule — out of scope for 18-04"

patterns-established:
  - "Product analysis path is pipeline/runAnalysis; pipeline.ts fakeStt/runPipeline is eval-only"
  - "ROUTE_CHANNEL_MAP left=customer; UPLOAD_CHANNEL_MAP left=operator; API swap inverts upload only"

requirements-completed: [REQ-SA-PARITY]

coverage:
  - id: D1
    description: "runAnalysis success persists then calls invokeSaChargeRun once including amount 0; score failure skips charge"
    requirement: REQ-SA-PARITY
    verification:
      - kind: unit
        ref: "packages/backend/src/modules/speech-analytics/pipeline/run-analysis.spec.ts#persists transcript and metrics then calls invokeSaChargeRun once on success (incl. amount 0)"
        status: pass
    human_judgment: false
  - id: D2
    description: "D-38 model resolution uses allowlist with project override and one silence fallback to module default"
    requirement: REQ-SA-PARITY
    verification:
      - kind: unit
        ref: "packages/backend/src/modules/speech-analytics/pipeline/run-analysis.spec.ts#resolves models per D-38: project override, else module default; silence falls back once"
        status: pass
    human_judgment: false
  - id: D3
    description: "Channel maps lock route vs upload; identical channels not stereo; energy failure → LLM roles; no dual-stt export"
    requirement: REQ-SA-PARITY
    verification:
      - kind: unit
        ref: "packages/backend/src/modules/speech-analytics/pipeline/channel-diarize.spec.ts#locks route and upload channel maps (D-24)"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-09-22
status: complete
---

# Phase 18 Plan 04: Real STT + energy diarize + SA-CHARGE-RUN Summary

**One-STT `runAnalysis` path with D-38 model fallback, D-24 channel maps, energy/LLM diarize, and a single `invokeSaChargeRun` on success (including amount 0)**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-09-22T13:03:45Z
- **Completed:** 2026-09-22T13:20:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Replaced product fakeStt success path with injectable `runAnalysis` (STT → diarize → score → persist → SA-CHARGE-RUN)
- Ported energy channel diarize with locked route/upload maps; identical channels and energy failure use LLM roles without a second STT
- Wired worker to prefer `runAnalysis` after the 500ms/60s file wait while keeping legacy handoff for 18-03 specs

## TDD Gate Compliance

| Task | RED | GREEN | REFACTOR |
|------|-----|-------|----------|
| 1 runAnalysis | `10a4ba09` | `6f4cf1ee` | — |
| 2 channel-diarize | `2bac2162` | `65431cfe` | — |

RED evidence: `tdd/run-analysis-red-evidence.json`, `tdd/channel-diarize-red-evidence.json` (`RED_EVIDENCE_OK`).

## Task Commits

1. **Task 1 RED:** `10a4ba09` — `test(18-04): add failing runAnalysis SA-CHARGE-RUN specs`
2. **Task 1 GREEN:** `6f4cf1ee` — `feat(18-04): implement runAnalysis with SA-CHARGE-RUN`
3. **Task 2 RED:** `2bac2162` — `test(18-04): add failing channel-diarize map and energy specs`
4. **Task 2 GREEN:** `65431cfe` — `feat(18-04): port energy channel diarize with D-24 maps`
5. **Plan metadata:** (this SUMMARY commit)

## Files Created/Modified

- `pipeline/run-analysis.ts` — orchestration + `resolveAnalysisModels` (D-38/D-46)
- `pipeline/run-analysis.spec.ts` — charge once / error skip / model fallback / no fakeStt
- `pipeline/stt.ts` / `pipeline/score.ts` — provider ports (no wallet imports)
- `pipeline/channel-diarize.ts` — energy diarize + D-24 maps
- `pipeline/channel-diarize.spec.ts` — identical / energy failure / maps / no dual-stt
- `pipeline.ts` — documents `runPipeline`/`fakeStt` as eval-only
- `jobs/sa-analysis.worker.ts` — prefers `runAnalysis`; documents unwired `HANGUP_ANALYTICS_PORT`

## Decisions Made

- Kept `handoffPipeline` optional so 18-03 worker specs remain valid without touching `worker.spec.ts`
- Stamp published version models on success persist; silence fallback chooses runtime models only
- Did not register production `HANGUP_ANALYTICS_PORT` provider (explicit keep_from_18_03 / plan scope)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Preserved legacy handoffPipeline alongside runAnalysis**
- **Found during:** Task 1 GREEN (worker wire)
- **Issue:** Replacing handoff with runAnalysis-only would break 18-03 `sa-analysis.worker.spec.ts`, which is outside this plan's `files_modified`
- **Fix:** Prefer `deps.runAnalysis` when present; else legacy handoff with fakeStt demotion
- **Files modified:** `jobs/sa-analysis.worker.ts`
- **Verification:** worker suite 6/6 pass; run-analysis 5/5 pass
- **Committed in:** `6f4cf1ee`

---

**Total deviations:** 1 auto-fixed (Rule 2)
**Impact on plan:** Necessary compatibility; no scope creep beyond plan files

## Issues Encountered

None beyond the worker API compatibility note above.

## Known Stubs

- `pipeline/stt.ts` `transcribeAudio` and `pipeline/score.ts` `scoreTranscript` are thin provider ports — Nest provider wiring is later; unit tests inject mocks into `runAnalysis`
- `HANGUP_ANALYTICS_PORT` still unwired in RoutesModule (documented; intentional)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Upload/API/regenerate plans can call `runAnalysis` → SA-CHARGE-RUN
- Energy diarize ready for stereo fixtures; LLM-role path covers mono / identical / energy failure

## Self-Check: PASSED

- FOUND: `pipeline/run-analysis.ts`, `pipeline/channel-diarize.ts`, `pipeline/run-analysis.spec.ts`, `pipeline/channel-diarize.spec.ts`
- FOUND commits: `10a4ba09`, `6f4cf1ee`, `2bac2162`, `65431cfe`

---
*Phase: 18-polnyy-refaktoring-rechevoy-analitiki*
*Completed: 2026-09-22*
