---
phase: 18-polnyy-refaktoring-rechevoy-analitiki
plan: 01
subsystem: speech-analytics
tags: [speech-analytics, charging, migrations, sa-charge-run, sa-charge-insights, tdd]

requires:
  - phase: ai-usage / billing shadow
    provides: money.ts decimal helpers and AiPriceRevision rate rows
provides:
  - Migration 0023 multi-run + charge columns (MySQL + Postgres)
  - invokeSaChargeRun persist seam (charged=false, amount 0 on missing rates)
  - invokeSaChargeInsights persist seam (insights request id key)
  - SaAnalysisRun / SaInsightsRequest charge fields
affects:
  - 18-02+ pipeline success paths that must call SA-CHARGE-RUN
  - 18-08 insights service cache-hit behavior

actuals:
  tokens: 12883
  tasks: 3
  commits: 4

plan_head_before: 7b5db516292d292c9a556eb7201c7288f061a831

tech-stack:
  added: []
  patterns:
    - "SA-CHARGE-* seams take injectable deps (findLatestRates + update*) and never import wallet helpers"
    - "Future operation keys are bare run / insights-request ids (debit later)"
    - "Migration 0023 idempotently drops uq_sa_run_initial (already removed in 0014)"

key-files:
  created:
    - packages/backend/database/migrations/0023-sa-multi-run-charges.sql
    - packages/backend/database/migrations/postgres/0023-sa-multi-run-charges.sql
    - packages/backend/src/modules/speech-analytics/charging/sa-charge-run.ts
    - packages/backend/src/modules/speech-analytics/charging/sa-charge-run.spec.ts
    - packages/backend/src/modules/speech-analytics/charging/sa-charge-insights.ts
    - packages/backend/src/modules/speech-analytics/charging/sa-charge-insights.spec.ts
  modified:
    - packages/backend/database/migrations/manifest.json
    - packages/backend/database/test/runner.test.cjs
    - packages/backend/src/modules/speech-analytics/speech-analytics.models.ts

key-decisions:
  - "D-05 approved: analytics journal stays in sa_* separate from Asterisk CDR"
  - "Charge seams persist calculated amounts with charged=false; no settleShadow / BillingBalanceService"
  - "Missing speech_analytics rates still invoke SA-CHARGE-RUN and store amount 0"

patterns-established:
  - "SA-CHARGE-RUN / SA-CHARGE-INSIGHTS are the only money-math surfaces for Phase 18 runs/insights"
  - "sa_insights_requests holds insights charge columns keyed by request id"

requirements-completed: [REQ-SA-PARITY]

coverage:
  - id: D1
    description: "Analytics journal remains separate from Asterisk CDR (D-05)"
    requirement: REQ-SA-PARITY
    verification:
      - kind: other
        ref: "checkpoint decision approve-separate-journal + migration 0023 only touches sa_*"
        status: pass
    human_judgment: false
  - id: D2
    description: "SA-CHARGE-RUN persists amount 0 with charged=false when rates missing"
    requirement: REQ-SA-PARITY
    verification:
      - kind: unit
        ref: "packages/backend/src/modules/speech-analytics/charging/sa-charge-run.spec.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Migration 0023 listed; multi-run unique gone; insights seam without GATE"
    requirement: REQ-SA-PARITY
    verification:
      - kind: unit
        ref: "node --test packages/backend/database/test/runner.test.cjs + sa-charge-insights.spec.ts"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-09-22
status: complete
---

# Phase 18 Plan 01: Charge spine + multi-run migration Summary

**SA-CHARGE-RUN/INSIGHTS persist-only seams plus migration 0023 unlock multi-run regenerate and charged=false cost storage on sa_* without touching the wallet or Asterisk CDR.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 3 (1 decision + 2 tdd)
- **Files modified:** 9

## Accomplishments

- Locked D-05: analytics journal stays separate from Asterisk CDR; uploads never create CDR rows.
- `invokeSaChargeRun` loads latest `speech_analytics` rates, writes amount/currency/audio_ms/provider_tokens with `charged=false`, including amount `0` when rates are missing.
- Future operation key helpers return bare run id / insights request id.
- Migration `0023-sa-multi-run-charges.sql` (+ Postgres twin) adds charge columns, creates `sa_insights_requests`, and idempotently drops `uq_sa_run_initial` (already removed in 0014).
- Manifest + `runner.test.cjs` list 0023 after 0022 for full-pbx and standalone AI profiles.
- `invokeSaChargeInsights` mirrors the run seam for provider_tokens; no SA-CHARGE-GATE export.

## Task Commits

| Hash | Message |
|------|---------|
| (decision) | Task 1: approve-separate-journal — no files |
| `71273c19` | test(18-01): add failing SA-CHARGE-RUN seam tests |
| `ab74e377` | feat(18-01): implement SA-CHARGE-RUN persist seam |
| `c53679b8` | test(18-01): add failing SA-CHARGE-INSIGHTS seam tests |
| `1c8b0485` | feat(18-01): add migration 0023 and SA-CHARGE-INSIGHTS seam |

## TDD Gate Compliance

| Task | RED | GREEN | Notes |
|------|-----|-------|-------|
| Tracer SA-CHARGE-RUN | `71273c19` | `ab74e377` | RED_EVIDENCE_OK for missing-rates amount 0 |
| Migration + INSIGHTS | `c53679b8` | `1c8b0485` | RED_EVIDENCE_OK for insights amount persist |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Wallet-forbid test matched comment text**
- **Found during:** Tracer GREEN
- **Issue:** Spec banned the substring `settleShadow`, which also appeared in a comment.
- **Fix:** Narrowed assertions to import/call patterns; reworded the comment.
- **Files modified:** `sa-charge-run.ts`, `sa-charge-run.spec.ts`
- **Commit:** `ab74e377`

**2. [Rule 2 - Missing functionality] Idempotent drop of `uq_sa_run_initial`**
- **Found during:** Migration task
- **Issue:** Index already dropped in 0014; a bare MySQL `DROP INDEX` would fail on clean apply.
- **Fix:** MySQL uses information_schema conditional prepare; Postgres uses `DROP CONSTRAINT IF EXISTS`.
- **Files modified:** `0023-sa-multi-run-charges.sql` (both dialects)
- **Commit:** `1c8b0485`

## Auth Gates

None.

## Known Stubs

None — seams are fully wired for persist via injectable deps; wallet debit remains intentionally out of scope (D-49).

## Threat Flags

None beyond plan register (wallet still unreachable; seams write sa_* only).

## Verification Results

- `npm run test -w @krasterisk/backend -- --testPathPattern=sa-charge-run --no-coverage` — PASS (4 tests)
- `npm run test -w @krasterisk/backend -- --testPathPattern=sa-charge-insights --no-coverage` — PASS (5 tests)
- `node --test packages/backend/database/test/runner.test.cjs` — PASS (20 tests; last id 0023)
- `node packages/backend/database/run-migrations.cjs --list` — includes `0023-sa-multi-run-charges.sql`

## Orchestrator note

STATE.md and ROADMAP.md were left unstaged (dirty with unrelated edits). Orchestrator must record plan progress for 18-01.

## Self-Check: PASSED

- FOUND: `packages/backend/database/migrations/0023-sa-multi-run-charges.sql`
- FOUND: `packages/backend/database/migrations/postgres/0023-sa-multi-run-charges.sql`
- FOUND: `packages/backend/src/modules/speech-analytics/charging/sa-charge-run.ts`
- FOUND: `packages/backend/src/modules/speech-analytics/charging/sa-charge-insights.ts`
- FOUND: commits `71273c19`, `ab74e377`, `c53679b8`, `1c8b0485`
