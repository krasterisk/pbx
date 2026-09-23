---
phase: 18-polnyy-refaktoring-rechevoy-analitiki
plan: 19
subsystem: testing
tags: [speech-analytics, public-api, UUID, UAT, G-18-06, D-50]

requires:
  - phase: 18-17
    provides: public-ingest.wiring with sa_* createRun (no journal: stubs)
provides:
  - Automated UUID journalId/recordingId/runId proof for public uploadBatch (G-18-06)
  - 18-UAT-API-RECHECK.md — approved checklist for later live API UUID evidence refresh
affects:
  - live speech-analytics-uat-live.json api section (manual later)
  - REQ-SA-UAT verification path

actuals:
  tokens: 2544
  tasks: 2
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Success journalId must equal createRun.recordingId UUID; journal: prefix is never success"
    - "Live API UUID evidence is a human checklist follow-up, not CI catalog crawl"

key-files:
  created:
    - .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/18-UAT-API-RECHECK.md
  modified:
    - packages/backend/src/modules/speech-analytics/speech-analytics-public.controller.spec.ts
    - packages/backend/src/modules/speech-analytics/ingest/public-ingest.wiring.spec.ts

key-decisions:
  - "G-18-06 automated gate = unit UUID proof; live evidence refresh is later manual per 18-UAT-API-RECHECK.md"
  - "Human approved checklist 2026-09-23: one mono + one stereo, no full Z:\\temp catalog, charged=false, no wallet debit, no plaintext tokens in git"

patterns-established:
  - "Pattern: public success asserts journalId === mocked createRun.recordingId and both recordingId/runId are UUIDs"
  - "Pattern: UAT API re-check docs stay out of automated verify; secrets never committed"

requirements-completed: [REQ-SA-UAT]

coverage:
  - id: D1
    description: "Automated unit proof: public uploadBatch success journalId is UUID from createRun; no journal: prefix; recordingId/runId UUIDs"
    requirement: REQ-SA-UAT
    verification:
      - kind: unit
        ref: "npm run test -w @krasterisk/backend -- --testPathPattern=\"speech-analytics-public.controller|public-ingest.wiring\" --no-coverage (20 passed)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Checklist 18-UAT-API-RECHECK.md for later live API UUID evidence (small sample, no full catalog)"
    requirement: REQ-SA-UAT
    verification: []
    human_judgment: true
    rationale: "live UUID evidence is a later manual re-check, user approved the checklist on 2026-09-23"

plan_head_before: d2b9316f3f645e670ac9aa82033e129246761082
duration: 40min
completed: 2026-09-23
status: complete
---

# Phase 18 Plan 19: Public API UUID proof + UAT re-check Summary

**Автотесты фиксируют UUID `journalId`/`recordingId`/`runId` на success публичного API (G-18-06); живой evidence refresh — одобренный чеклист 18-UAT-API-RECHECK.md, не полный каталог Z:\\temp.**

## Performance

- **Duration:** ~40 min (включая human-verify gate)
- **Started:** 2026-09-23T02:04:00Z
- **Completed:** 2026-09-23T02:44:00Z
- **Tasks:** 2 (1 auto + 1 human-verify approved)
- **Files modified:** 3

## Accomplishments

- Усилены unit-спеки: success `journalId` = UUID из mocked `createRun.recordingId`; запрет префикса `journal:`; `recordingId`/`runId` — UUID
- Добавлен `18-UAT-API-RECHECK.md` (RU): один published-project токен; POST batch с одним mono + одним stereo; UUID в `sa_recordings` / `sa_analysis_runs`; `charged=false` / без wallet debit; опциональный refresh evidence; plaintext токены не коммитить
- Human approved чеклист 2026-09-23 как план later live API UUID re-check
- G-18-06 automated gate закрыт; live evidence refresh остаётся ручным follow-up вне этого execute

## Task Commits

1. **Task 1: Automated UUID proof + checklist** — `a7a0efa0` (test) — specs + 18-UAT-API-RECHECK.md
2. **Task 2: Human-verify** — approved (no code commit)

**Plan metadata:** (SUMMARY commit follows)

## Files Created/Modified

- `packages/backend/src/modules/speech-analytics/speech-analytics-public.controller.spec.ts` — G-18-06 UUID / no-`journal:` assertions
- `packages/backend/src/modules/speech-analytics/ingest/public-ingest.wiring.spec.ts` — journalId === createRun.recordingId + runId UUID
- `.planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/18-UAT-API-RECHECK.md` — later live re-check checklist

## Decisions Made

- Automated gate closes G-18-06 for CI; live `speech-analytics-uat-live.json` api refresh is manual later
- Checklist sample budget: one mono + one stereo only — no full `Z:\temp\speech-analytics-samples` in this plan
- No wallet debit / settleShadow; plaintext tokens never committed

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None for this execute. Later live re-check (outside this plan) needs a lab SA API token — never commit plaintext.

## Next Phase Readiness

- Automated G-18-06 proof landed (`a7a0efa0`, 20 tests passed)
- Live API UUID evidence refresh follows `18-UAT-API-RECHECK.md` when ready
- Production code / wiring unchanged in this plan

## Gap Closure

- **G-18-06:** automated gate closed; live evidence refresh = later manual follow-up

## Self-Check: PASSED

- FOUND: `packages/backend/src/modules/speech-analytics/speech-analytics-public.controller.spec.ts`
- FOUND: `packages/backend/src/modules/speech-analytics/ingest/public-ingest.wiring.spec.ts`
- FOUND: `.planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/18-UAT-API-RECHECK.md`
- FOUND: commit `a7a0efa0`

---
*Phase: 18-polnyy-refaktoring-rechevoy-analitiki*
*Completed: 2026-09-23*
