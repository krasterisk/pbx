---
phase: 18-polnyy-refaktoring-rechevoy-analitiki
plan: 08
subsystem: speech-analytics
tags: [speech-analytics, dashboard, insights, sa-charge-insights, recharts, tdd, i18n]

requires:
  - phase: 18-polnyy-refaktoring-rechevoy-analitiki
    provides: SA-CHARGE-INSIGHTS seam (18-01); journal access helpers (18-11)
provides:
  - On-demand insights with min-10 gate, cache-hit skip charge, repo skill instruction
  - Standard dashboard aggregations with access list + low-STT exclusion
  - Dashboard page layout (stats → insights → mood → success → scales → custom → dynamics)
affects:
  - 18-12 MetricEditor
  - 18-13 tokens / models settings
  - 18-14 Reports removal

actuals:
  tokens: 14650
  tasks: 2
  commits: 4

plan_head_before: 22f74d111086ebcc5e6675193557ab049657de35

tech-stack:
  added: []
  patterns:
    - "generateInsights deps inject LLM/cache/charge; <10 empty without LLM; cache hit skips invokeSaChargeInsights"
    - "aggregateDashboard filters via isJournalRowVisible; lowStt excluded from averages with count; cost = latest-run sums only"
    - "Dashboard page: on-demand insights button; Recharts in SCSS module; segment click → journal query"

key-files:
  created:
    - packages/backend/src/modules/speech-analytics/dashboard/insights.service.ts
    - packages/backend/src/modules/speech-analytics/dashboard/insights.service.spec.ts
    - packages/backend/src/modules/speech-analytics/dashboard/dashboard.service.ts
    - packages/backend/src/modules/speech-analytics/dashboard/dashboard.service.spec.ts
    - packages/backend/src/skills/speech-analytics/insights/SKILL.md
    - packages/frontend/src/pages/SpeechAnalyticsDashboardPage/SpeechAnalyticsDashboardPage.module.scss
  modified:
    - packages/frontend/src/pages/SpeechAnalyticsDashboardPage/SpeechAnalyticsDashboardPage.tsx
    - packages/frontend/src/pages/SpeechAnalyticsDashboardPage/SpeechAnalyticsDashboardPage.test.tsx
    - packages/frontend/src/features/speechAnalytics/api/speechAnalyticsApi.ts
    - packages/frontend/src/shared/config/locales/ru.ts
    - packages/frontend/src/shared/config/locales/en.ts
    - packages/backend/src/modules/speech-analytics/speech-analytics.module.ts
    - packages/backend/src/modules/speech-analytics/speech-analytics-jwt.controller.ts

key-decisions:
  - "Insights instruction is the shipped repo SKILL.md; cabinets cannot edit it (D-36)"
  - "Insights model resolves module setting else call-analysis model via resolveInsightsModelId"
  - "HTTP insights endpoint stubs LLM until a platform provider is wired; charge/cache contracts remain live"
  - "Dashboard cost cards use latest-run amounts only; insights amount stays on the insights block"

patterns-established:
  - "SA-CHARGE-INSIGHTS only on successful LLM path; cache hit must not re-invoke"
  - "Dashboard aggregations reuse journal CDR access visibility"

requirements-completed: [REQ-SA-ARCH, REQ-SA-PARITY]

coverage:
  - id: D1
    description: "Insights <10 empty without LLM; success charges once; cache hit skips charge"
    requirement: REQ-SA-PARITY
    verification:
      - kind: unit
        ref: "packages/backend/src/modules/speech-analytics/dashboard/insights.service.spec.ts#returns empty copy path and does not call the LLM when conversations < 10"
        status: pass
      - kind: unit
        ref: "packages/backend/src/modules/speech-analytics/dashboard/insights.service.spec.ts#calls invokeSaChargeInsights once on successful LLM and skips it on cache hit"
        status: pass
    human_judgment: false
  - id: D2
    description: "Dashboard page Get insights CTA is on-demand; empty <10; busy keeps cache; cost labeled not charged and excluded from cost card"
    requirement: REQ-SA-ARCH
    verification:
      - kind: unit
        ref: "packages/frontend/src/pages/SpeechAnalyticsDashboardPage/SpeechAnalyticsDashboardPage.test.tsx"
        status: pass
    human_judgment: false
  - id: D3
    description: "Dashboard aggregations exclude low-STT from averages with count; access list matches journal; latest-run cost sum"
    requirement: REQ-SA-PARITY
    verification:
      - kind: unit
        ref: "packages/backend/src/modules/speech-analytics/dashboard/dashboard.service.spec.ts#excludes low-STT conversations from averages and exposes their count"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-09-22
status: complete
---

# Phase 18 Plan 08: Dashboard + On-demand Insights Summary

**Standard dashboard with on-demand insights: min-10 gate, SA-CHARGE-INSIGHTS once per success (cache skip), access-list aggregations, and low-STT excluded from averages**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-09-22T14:01:00Z
- **Completed:** 2026-09-22T14:20:00Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments

- Insights service enforces D-35/D-47: no LLM under 10 conversations; `invokeSaChargeInsights` once on success; cache hit skips charge; instruction from repo skill (D-36).
- Dashboard page ships standard layout (stat cards → insights → mood → success → scales → custom metrics → dynamics) with Recharts in an SCSS module and segment click → journal filters.
- Dashboard aggregations honor journal CDR access scope, exclude low-STT from averages with count, and sum latest-run costs only.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED:** `f4525e52` (test) — failing insights min-10 / cache-charge specs + skill + frontend tests
2. **Task 1 GREEN:** `6709b18a` (feat) — insights service, dashboard page, insights API mutation, Nest wiring
3. **Task 2 RED:** `29184999` (test) — failing dashboard low-STT / access-list specs
4. **Task 2 GREEN:** `57cde257` (feat) — dashboard aggregations + dashboard/insights i18n keys

_Note: TDD tasks used RED → GREEN commits._

## Files Created/Modified

- `packages/backend/src/modules/speech-analytics/dashboard/insights.service.ts` — on-demand insights + charge seam
- `packages/backend/src/modules/speech-analytics/dashboard/insights.service.spec.ts` — min-10 / cache / skill tests
- `packages/backend/src/modules/speech-analytics/dashboard/dashboard.service.ts` — D-34 aggregations
- `packages/backend/src/modules/speech-analytics/dashboard/dashboard.service.spec.ts` — low-STT / access / cost tests
- `packages/backend/src/skills/speech-analytics/insights/SKILL.md` — non-editable insights instruction
- `packages/frontend/src/pages/SpeechAnalyticsDashboardPage/*` — standard dashboard UI + tests + SCSS
- `packages/frontend/src/features/speechAnalytics/api/speechAnalyticsApi.ts` — `requestSaInsights` mutation + richer dashboard type
- `packages/frontend/src/shared/config/locales/{ru,en}.ts` — dashboard/insights Copywriting Contract keys
- `packages/backend/src/modules/speech-analytics/speech-analytics.module.ts` — InsightsService + DashboardService providers
- `packages/backend/src/modules/speech-analytics/speech-analytics-jwt.controller.ts` — `POST /insights`

## Decisions Made

- Repo skill is the only insights instruction; project system prompt is business context only.
- Nest HTTP insights path uses a stub LLM so charge/cache contracts work until a platform provider is injected.
- Wired `speechAnalyticsApi.requestSaInsights` and controller endpoint (Rule 2) so the page mutation is real.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Wired insights HTTP + RTK mutation + Nest providers**
- **Found during:** Task 1 GREEN
- **Issue:** Page needed a real insights mutation; Nest required `InsightsService` / `DashboardService` registration
- **Fix:** Added `POST /speech-analytics/insights`, `useRequestSaInsightsMutation`, module providers, and `SaInsightsRequest` model registration
- **Files modified:** `speechAnalyticsApi.ts`, `speech-analytics-jwt.controller.ts`, `speech-analytics.module.ts`
- **Verification:** Frontend + backend unit tests pass
- **Committed in:** `6709b18a`, `57cde257`

**2. [Rule 1 - Bug] Vitest mock state used `vi.hoisted` for insights busy assertion**
- **Found during:** Task 1 GREEN frontend tests
- **Issue:** Mutable mock state outside `vi.hoisted` was not visible to the mock factory; ResizeObserver missing for Recharts
- **Fix:** `vi.hoisted` state + ResizeObserver stub; busy case seeds loading+cache data
- **Files modified:** `SpeechAnalyticsDashboardPage.test.tsx`
- **Verification:** 3/3 frontend tests pass
- **Committed in:** `6709b18a`

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 bug)
**Impact on plan:** Required for Nest/RTK wiring and stable Vitest; no scope creep into MetricEditor/tokens/Reports.

## Issues Encountered

- Windows `npm run test -w @krasterisk/frontend` runs the full chunked suite; single-file verify used `npx vitest run <file>` (same assertions).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Dashboard + insights ready for verify-work / UAT.
- MetricEditor (18-12), tokens (18-13), Reports removal (18-14) remain separate.
- Live LLM provider for insights can replace the Nest stub without changing charge/cache contracts.

## Self-Check: PASSED

- FOUND: `packages/backend/src/modules/speech-analytics/dashboard/insights.service.ts`
- FOUND: `packages/backend/src/modules/speech-analytics/dashboard/dashboard.service.ts`
- FOUND: `packages/backend/src/skills/speech-analytics/insights/SKILL.md`
- FOUND: `packages/frontend/src/pages/SpeechAnalyticsDashboardPage/SpeechAnalyticsDashboardPage.tsx`
- FOUND: `18-08-SUMMARY.md` (this file)
- FOUND commits: `f4525e52`, `6709b18a`, `29184999`, `57cde257`

---
*Phase: 18-polnyy-refaktoring-rechevoy-analitiki*
*Completed: 2026-09-22*
