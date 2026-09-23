---
phase: 18-polnyy-refaktoring-rechevoy-analitiki
plan: 18
subsystem: speech-analytics
tags: [sa-charge-insights, nestjs, sequelize, billing-shadow, insights]

requires:
  - phase: 18-08
    provides: InsightsService HTTP entry, SaInsightsRequest model registration, invokeSaChargeInsights seam
provides:
  - "HTTP requestForTenant persists SA-CHARGE-INSIGHTS with charged=false (G-18-05)"
  - "Real findLatestRates from AiPriceRevision / sequelize registry"
  - "Tenant-scoped updateInsightsRequest create-or-patch"
affects: [phase-18-verification, sa-insights-billing]

actuals:
  tokens: 3374
  tasks: 2
  commits: 4

plan_head_before: 2f60a1c1b8fb8eebd92fb57b9233784e3f4176cb

tech-stack:
  added: []
  patterns:
    - "Insights HTTP path wires SaChargeInsightsDeps to Sequelize models without wallet helpers"
    - "Optional InjectModel(AiPriceRevision) with sequelize.models fallback when forFeature omits prices"

key-files:
  created:
    - .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/18-18-SUMMARY.md
  modified:
    - packages/backend/src/modules/speech-analytics/dashboard/insights.service.ts
    - packages/backend/src/modules/speech-analytics/dashboard/insights.service.spec.ts

key-decisions:
  - "Persist via update-then-create scoped by insightsRequestId AND tenantUid; charged forced false"
  - "AiPriceRevision injected Optional so speech-analytics.module.ts stays unchanged; rates fall back to sequelize.models"
  - "No settleShadow / BillingBalanceService on HTTP insights path (D-47…D-49)"

patterns-established:
  - "HTTP insights charge: findLatestRates + updateInsightsRequest closed over projectId for row create"

requirements-completed: [REQ-SA-PARITY, REQ-SA-ARCH]

coverage:
  - id: D1
    description: "HTTP insights persist SA-CHARGE-INSIGHTS amount with charged=false"
    requirement: REQ-SA-ARCH
    verification:
      - kind: unit
        ref: packages/backend/src/modules/speech-analytics/dashboard/insights.service.spec.ts#persists amount with charged=false via invokeSaChargeInsights when conversationCount >= 10
        status: pass
    human_judgment: false
  - id: D2
    description: "Missing rates still persist amount 0 with charged=false"
    requirement: REQ-SA-ARCH
    verification:
      - kind: unit
        ref: packages/backend/src/modules/speech-analytics/dashboard/insights.service.spec.ts#persists amount 0 with charged=false when depot rates are missing
        status: pass
    human_judgment: false
  - id: D3
    description: "Cache hit skips second SA-CHARGE-INSIGHTS invoke; below-min skips charge"
    requirement: REQ-SA-PARITY
    verification:
      - kind: unit
        ref: packages/backend/src/modules/speech-analytics/dashboard/insights.service.spec.ts#skips a second SA-CHARGE-INSIGHTS invoke on cache hit (refresh false)
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/speech-analytics/dashboard/insights.service.spec.ts#returns empty without charge invoke when below INSIGHTS_MIN_CONVERSATIONS
        status: pass
    human_judgment: false
  - id: D4
    description: "Wallet helpers unused from insights HTTP module source"
    requirement: REQ-SA-ARCH
    verification:
      - kind: unit
        ref: packages/backend/src/modules/speech-analytics/dashboard/insights.service.spec.ts#does not reference settleShadow or BillingBalanceService in the HTTP insights module
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-09-23
status: complete
gap_ids_closed: [G-18-05]
---

# Phase 18 Plan 18: HTTP SA-CHARGE-INSIGHTS Persistence Summary

**HTTP `requestForTenant` now invokes `invokeSaChargeInsights` with real depot rates and tenant-scoped `sa_insights_requests` patches (`charged=false`), closing G-18-05 / WR-04.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-09-23T01:51:00Z
- **Completed:** 2026-09-23T02:03:00Z
- **Tasks:** 2
- **Files modified:** 2 (+ SUMMARY)

## Accomplishments

- Replaced stub `findLatestRates` / `updateInsightsRequest` on the HTTP insights entry with Sequelize-backed implementations.
- Specs prove persistence (`charged=false`), missing-rates → amount `0`, cache-hit skip, below-min empty path, and no wallet helper identifiers.
- G-18-05 closed without wallet debit, Reports page, analyst role, or dual-STT.

## Task Commits

1. **Task 1 RED: End-to-end HTTP insights persists SA-CHARGE-INSIGHTS** - `4fbed368` (test)
2. **Task 1 GREEN: Persist SA-CHARGE-INSIGHTS from HTTP path** - `044f364d` (feat)
3. **Task 2: Lock cache-skip and no-wallet contracts** - `45d1e91b` (test)
4. **Rule 3 fix: Nest Optional InjectModel default** - `e23ac0a1` (fix)

**Plan metadata:** (this SUMMARY commit)

## Files Created/Modified

- `packages/backend/src/modules/speech-analytics/dashboard/insights.service.ts` — InjectModel wiring; `findLatestRates`; tenant-scoped `updateInsightsRequest` create-or-patch
- `packages/backend/src/modules/speech-analytics/dashboard/insights.service.spec.ts` — HTTP persistence / cache / no-wallet contracts

## Decisions Made

- Update-then-create so the charge patch target exists without changing `generateInsights` sync `newInsightsRequestId`.
- Optional `AiPriceRevision` injection keeps `speech-analytics.module.ts` out of ownership; registry fallback covers runtime when prices are registered app-wide.
- `charged` forced `false` on every write (T-18-18-TAMPER).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed defaulted Optional constructor param**
- **Found during:** Post-GREEN Nest DI review
- **Issue:** Default `= null` on `@Optional() @InjectModel(AiPriceRevision)` can skip Nest injection
- **Fix:** Use optional property without default value
- **Files modified:** `insights.service.ts`
- **Commit:** `e23ac0a1`

## Verification Results

```text
npm run test -w @krasterisk/backend -- --testPathPattern="insights.service|sa-charge-insights" --no-coverage
→ 2 suites, 16 passed
```

## Gap Closure

| Gap | Status |
|-----|--------|
| G-18-05 | **closed** — HTTP insights persist SA-CHARGE-INSIGHTS with `charged=false`; no wallet debit |

## Known Stubs

None that block the plan goal. LLM path remains a skill-bounded stub insight (pre-existing 18-08); charge/cache/persistence contracts are live.

## Self-Check: PASSED

- FOUND: `packages/backend/src/modules/speech-analytics/dashboard/insights.service.ts`
- FOUND: `packages/backend/src/modules/speech-analytics/dashboard/insights.service.spec.ts`
- FOUND: commits `4fbed368`, `044f364d`, `45d1e91b`, `e23ac0a1`
