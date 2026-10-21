---
phase: 18-polnyy-refaktoring-rechevoy-analitiki
plan: 14
subsystem: ui
tags: [speech-analytics, router, hub-seed, D-37, reports-redirect]

requires:
  - phase: 18-11
    provides: Journal Excel toolbar export and conversations route ownership
  - phase: 18-08
    provides: Dashboard product surface
provides:
  - /speech-analytics/reports redirects to journal (D-37)
  - Hub seed without Reports product path; conversations + dashboard retained
affects:
  - phase-18 verify-work / UAT for Reports removal
  - Module Hub speech-analytics nav

actuals:
  tokens: 2606
  tasks: 2
  commits: 4
plan_head_before: bdc854b95150f341d04581bcf1f0479fa2ccddad

tech-stack:
  added: []
  patterns:
    - "Legacy SA Reports path uses Navigate replace to journal; stub page remains on disk"
    - "HUB_MODULE_PAGES_SEED advertises conversations not reports for speech_analytics"

key-files:
  created:
    - packages/frontend/src/app/router/speechAnalyticsReportsRoute.test.tsx
  modified:
    - packages/frontend/src/app/router/router.tsx
    - packages/frontend/src/pages/SpeechAnalyticsReportsPage/SpeechAnalyticsReportsPage.tsx
    - packages/backend/src/modules/cloud-admin/hub-modules.seed.ts
    - packages/backend/src/modules/cloud-admin/migrate-hub-modules-phase8.spec.ts

key-decisions:
  - "Redirect /speech-analytics/reports → /speech-analytics/conversations (not dashboard)"
  - "Keep SpeechAnalyticsReportsPage stub on disk; do not mount it as a product route"
  - "Replace speech_analytics_reports hub seed with speech_analytics_conversations"

patterns-established:
  - "Router product-surface removal via Navigate + route-config unit assertion"
  - "Hub seed D-37 guard: no /speech-analytics/reports and no speech_analytics_reports page_code"

requirements-completed: [REQ-SA-ARCH, REQ-SA-PARITY]

coverage:
  - id: D1
    description: /speech-analytics/reports redirects to journal; SpeechAnalyticsReportsPage is not a live product route
    requirement: REQ-SA-ARCH
    verification:
      - kind: unit
        ref: packages/frontend/src/app/router/speechAnalyticsReportsRoute.test.tsx#does not mount SpeechAnalyticsReportsPage as a live product route at /speech-analytics/reports
        status: pass
      - kind: unit
        ref: packages/frontend/src/app/router/speechAnalyticsReportsRoute.test.tsx#keeps dashboard and journal product routes
        status: pass
    human_judgment: false
  - id: D2
    description: Hub seed has no Reports path/page_code; dashboard and conversations journal entries present
    requirement: REQ-SA-ARCH
    verification:
      - kind: unit
        ref: packages/backend/src/modules/cloud-admin/migrate-hub-modules-phase8.spec.ts#does not advertise speech-analytics Reports as a product hub path (D-37)
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-09-22
status: complete
---

# Phase 18 Plan 14: Reports Route Removal Summary

**D-37 deproductization: `/speech-analytics/reports` Navigate-redirects to the journal, and the hub seed no longer advertises a Reports page.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-09-22T14:48:24Z
- **Completed:** 2026-09-22T14:52:45Z
- **Tasks:** 2
- **Files modified:** 5 (+ 2 RED evidence records)

## Accomplishments

- Router redirects `/speech-analytics/reports` to `/speech-analytics/conversations`; dashboard/journal/projects routes untouched
- Route unit test fails if Reports is remounted as a live product element
- Hub seed drops `speech_analytics_reports` / `/speech-analytics/reports` and seeds `speech_analytics_conversations`
- Excel remains a journal toolbar action (18-11); ReportsPage stub kept on disk only

## Task Commits

Each task was committed atomically (RED then GREEN):

1. **Task 1 RED: reports route assertion** - `451a850e` (test)
2. **Task 1 GREEN: redirect reports to journal** - `be3c6501` (feat)
3. **Task 2 RED: hub seed Reports assertion** - `3853cd56` (test)
4. **Task 2 GREEN: drop Reports hub path** - `755b3e3e` (feat)

**Plan metadata:** *(this SUMMARY commit)*

## TDD Gate Compliance

| Task | RED evidence | Verdict | GREEN |
|------|--------------|---------|-------|
| 1 | `tdd/18-14-t1-red-evidence.json` | RED_EVIDENCE_OK | route tests 2/2 pass |
| 2 | `tdd/18-14-t2-red-evidence.json` | RED_EVIDENCE_OK | migrate-hub-modules-phase8 8/8 pass |

## Files Created/Modified

- `packages/frontend/src/app/router/speechAnalyticsReportsRoute.test.tsx` — asserts Navigate to journal, not ReportsPage
- `packages/frontend/src/app/router/router.tsx` — reports → conversations redirect
- `packages/frontend/src/pages/SpeechAnalyticsReportsPage/SpeechAnalyticsReportsPage.tsx` — deproductization note on legacy stub
- `packages/backend/src/modules/cloud-admin/hub-modules.seed.ts` — conversations replaces reports
- `packages/backend/src/modules/cloud-admin/migrate-hub-modules-phase8.spec.ts` — D-37 seed guard

## Decisions Made

- Redirect target is journal (`/speech-analytics/conversations`), matching Excel-on-journal (D-37)
- Stub page file retained (same pattern as D-41 legacy redirects)
- Hub retarget: add conversations entry at former reports sort_order 17

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] Seed journal conversations entry when removing Reports**
- **Found during:** Task 2
- **Issue:** Plan/orchestrator required keeping journal + dashboard hub entries; seed had dashboard but no conversations path after Reports removal
- **Fix:** Replaced `speech_analytics_reports` with `speech_analytics_conversations` at `/speech-analytics/conversations`
- **Files modified:** `hub-modules.seed.ts`, assertion in `migrate-hub-modules-phase8.spec.ts`
- **Verification:** migrate-hub-modules-phase8 8 passed
- **Committed in:** `755b3e3e` / `3853cd56`

**Total deviations:** 1 auto-fixed (Rule 2)
**Impact on plan:** Necessary for D-37 hub nav; no scope creep beyond seed retarget

## Issues Encountered

- Windows `npm run test -w @krasterisk/frontend` runs full vitest-run-src chunk suite; Task 1 verify used direct `vitest.mjs run` on the single file (same assertions)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Reports product surface removed from router and hub. Ready for phase verify-work / remaining wave plans. Excel journal toolbar from 18-11 unchanged.

## Self-Check: PASSED

- FOUND files: route test, router, ReportsPage stub, hub seed, migrate-hub-modules-phase8.spec, 18-14-SUMMARY.md
- FOUND commits: `451a850e`, `be3c6501`, `3853cd56`, `755b3e3e`

---
*Phase: 18-polnyy-refaktoring-rechevoy-analitiki*
*Completed: 2026-09-22*
