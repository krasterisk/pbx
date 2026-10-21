---
phase: 18-polnyy-refaktoring-rechevoy-analitiki
plan: 20
subsystem: api
tags: [speech-analytics, ai-adapter, mergeConfig, D-27, CR-01, nestjs, jest]

requires:
  - phase: 18-16
    provides: hangup/idempotency baseline; AI adapter edit_speech_analytics_project tool contract
provides:
  - "edit_speech_analytics_project.apply merges live draft with partial config before applyEditorUpdate"
  - "Metric-only confirm preserves topics/webhooks/digest/alerts/budget/prompts (CR-01 / D-27)"
  - "stale_draft revalidate + partial applyPayload regression specs"
affects:
  - speech-analytics AI chat confirm
  - 18 verification truth 21
  - gap CR-01

actuals:
  tokens: 7099
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "apply-time re-merge: getEditorState(ctx.vpbxUserUid) then mergeConfig({ ...state.draft, ...args.config })"
    - "applyPayload keeps partial input.config; full merge deferred to apply against live draft"

key-files:
  created: []
  modified:
    - packages/backend/src/modules/speech-analytics/speech-analytics-ai.adapter.ts
    - packages/backend/src/modules/speech-analytics/speech-analytics-ai.adapter.spec.ts

key-decisions:
  - "Apply reloads tenant draft and merges partial onto draft instead of stuffing full snapshot into applyPayload (revalidate still checks expected_revision against live draft)"
  - "Tenant scope remains ctx.vpbxUserUid only for getEditorState and applyEditorUpdate"

patterns-established:
  - "Partial AI applyPayload + apply-time draft merge (D-27 / CR-01)"

requirements-completed: [REQ-SA-PARITY, REQ-SA-ARCH]

coverage:
  - id: D1
    description: "Metric-only AI confirm preserves non-metric draft sections (topics, webhooks, digest, alerts, budget, prompts)"
    requirement: REQ-SA-PARITY
    verification:
      - kind: unit
        ref: "packages/backend/src/modules/speech-analytics/speech-analytics-ai.adapter.spec.ts#metric-only apply merges onto live draft and preserves non-metric sections (CR-01, D-27)"
        status: pass
    human_judgment: false
  - id: D2
    description: "revalidate rejects stale_draft; applyPayload stays partial; tenant uid from ctx only"
    requirement: REQ-SA-ARCH
    verification:
      - kind: unit
        ref: "packages/backend/src/modules/speech-analytics/speech-analytics-ai.adapter.spec.ts#revalidate rejects stale draft revision and keeps applyPayload as partial config (D-27)"
        status: pass
    human_judgment: false

duration: 4min
completed: 2026-09-23
status: complete
plan_head_before: d48bfba120537fad5c65f61eb2efabb50bdaddcd
---

# Phase 18 Plan 20: AI apply draft merge (CR-01 / D-27) Summary

**edit_speech_analytics_project.apply теперь мержит partial config на живой tenant draft (`mergeConfig({ ...state.draft, ...args.config })`), поэтому metric-only confirm больше не обнуляет topics/webhooks/digest/alerts/budget/prompts.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-09-23T04:19:31Z
- **Completed:** 2026-09-23T04:23:27Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Закрыт CR-01 / D-27: apply AI-чата больше не вызывает `mergeConfig(args.config)` поверх `defaultSaProjectConfig`.
- Metric-only confirm сохраняет нетронутые секции draft и при смене метрик по-прежнему публикует (`publish: true`).
- `applyPayload` остаётся partial; revalidate по `expected_revision` отклоняет `stale_draft`.
- Tenant scope только `ctx.vpbxUserUid` (без settleShadow / wallet / analyst role / dual-STT).

## Task Commits

1. **Task 1 RED: failing metric-only preserve test** - `2d571875` (test)
2. **Task 1 GREEN: merge onto live draft** - `7f8a7436` (fix)
3. **Task 2: stale revision + partial applyPayload gates** - `8d57d0a5` (test)
4. **Plan metadata:** _(this SUMMARY commit)_

## Files Created/Modified

- `packages/backend/src/modules/speech-analytics/speech-analytics-ai.adapter.ts` — apply loads `getEditorState` and merges `{ ...state.draft, ...args.config }` before `applyEditorUpdate`
- `packages/backend/src/modules/speech-analytics/speech-analytics-ai.adapter.spec.ts` — CR-01 wipe-proof + stale_draft / partial payload specs

## Decisions Made

- Prefer apply-time re-merge over stuffing the full merged snapshot into `applyPayload`, so confirmation still revalidates `expected_revision` against the live draft.
- Keep propose publish decision via `stampChanged` on the same draft+partial merge (unchanged).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Jest RED evidence mapped to TAP summary fields for `check tdd-red-evidence` (Jest does not emit node:test TAP natively).

## User Setup Required

None - no external service configuration required.

## TDD Gate Compliance

- **RED:** Spec `metric-only apply merges onto live draft...` failed — `getEditorState` call count 0 (apply used partial-only merge). `RED_EVIDENCE_OK`.
- **GREEN:** apply loads draft and merges; 8/8 tests pass.
- **REFACTOR:** Not needed.

## Gap Closure

- **CR-01 / D-27 / verification truth 21:** closed.

## Next Phase Readiness

- Ready for remaining gap-closure plans 18-21 / 18-22.
- No module wiring changes; `speech-analytics.module.ts` untouched.

## Self-Check: PASSED

- FOUND: packages/backend/src/modules/speech-analytics/speech-analytics-ai.adapter.ts
- FOUND: packages/backend/src/modules/speech-analytics/speech-analytics-ai.adapter.spec.ts
- FOUND: 2d571875, 7f8a7436, 8d57d0a5

---
*Phase: 18-polnyy-refaktoring-rechevoy-analitiki*
*Completed: 2026-09-23*
