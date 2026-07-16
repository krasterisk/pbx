---
phase: 07-call-center-overhaul-professional-agent-supervisor-workspace
plan: 18
subsystem: ui
tags: [react, rtk-query, reports, react-pdf, AgentTimeline, callcenter, export]

requires:
  - phase: 07-12
    provides: CallCenterReportsService + GET /callcenter/reports/:reportId and /export (CSV/XLSX)
  - phase: 07-09
    provides: AgentTimeline presentational component + AgentTimelineSegment contract (D-36 owner)
provides:
  - callCenterReportsApi RTK slice (getReport, getAgentTimeline, exportReport)
  - Client PDF via generateReportPdf (@react-pdf/renderer, 2000-row cap)
  - CallCenterReportsPage at /callcenter/reports with 7 reports + export bar
affects: [07-15, scheduled-reports-ui]

tech-stack:
  added: []
  patterns:
    - "PDF only from already-loaded rows; CSV/XLSX via backend blob export"
    - "AgentTimeline imported from 07-09 path — never duplicated"
    - "Heatmap CSS grid with color-mix(in srgb, var(--color-primary) …)"

key-files:
  created:
    - packages/frontend/src/shared/api/endpoints/callCenterReportsApi.ts
    - packages/frontend/src/features/callcenter/lib/reportPdf.tsx
    - packages/frontend/src/pages/CallCenterReportsPage/CallCenterReportsPage.tsx
    - packages/frontend/src/pages/CallCenterReportsPage/CallCenterReportsPage.module.scss
    - packages/frontend/src/pages/CallCenterReportsPage/index.ts
  modified:
    - packages/frontend/src/app/router/router.tsx
    - packages/frontend/src/shared/config/locales/ru.ts
    - packages/frontend/src/shared/config/locales/en.ts

key-decisions:
  - "AgentTimeline reused from features/callcenter/ui/AgentTimeline (07-09); segments from getAgentTimeline API"
  - "Eager router import matches sibling CallCenter* pages (not React.lazy)"
  - "PDF row cap REPORT_PDF_MAX_ROWS=2000 with truncation note (T-07-18-01)"

patterns-established:
  - "Pattern: CC reports RTK in callCenterReportsApi.ts — 07-15 extends with schedules"
  - "Pattern: client PDF from loaded ReportResult rows via generateReportPdf"

requirements-completed: [D-33, D-34, D-36]

duration: 12min
completed: 2026-07-16
---

# Phase 07 Plan 18: Reports UI Summary

**Reports page with 7 D-33 reports, sticky filters, heatmap/timeline viz, and CSV/XLSX/PDF export — AgentTimeline reused from 07-09 (D-36)**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-16T02:45:43Z
- **Completed:** 2026-07-16T02:57:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- RTK `callCenterReportsApi` wired to backend 07-12 (`getReport`, `getAgentTimeline`, blob `exportReport`)
- Client PDF via `@react-pdf/renderer` with 2000-row DoS cap (T-07-18-01); no new packages
- `/callcenter/reports` page: 7-report switcher, filters, DataTable / heatmap / AgentTimeline, export bar
- AgentTimeline imported from 07-09 path only — not recreated
- ru/en i18n for report names, filters, export, empty/error copy

## Task Commits

Each task was committed atomically:

1. **Task 1: RTK callCenterReportsApi + reportPdf** — `f0c8981` (feat)
2. **Task 2: CallCenterReportsPage + router + i18n** — `cd3509f` (feat)

**Plan metadata:** (pending docs commit)

## Files Created/Modified

- `callCenterReportsApi.ts` — types mirror backend + getReport / getAgentTimeline / exportReport
- `reportPdf.tsx` — `generateReportPdf` → `pdf(...).toBlob()` with row cap
- `CallCenterReportsPage.tsx` + SCSS + index — reports UI surface
- `router.tsx` — replace PlaceholderPage with CallCenterReportsPage
- `ru.ts` / `en.ts` — `callcenter.reports.*` keys

## Decisions Made

- Reused existing eager import style for Call Center pages instead of adding a one-off `React.lazy` (siblings already eager)
- Timeline date uses `dateFrom` as the single day for `getAgentTimelineQuery`
- Heatmap day index matches backend `Date.getDay()` (0=Sun)

## Deviations from Plan

### Auto-fixed Issues

None - plan executed as written for in-scope files.

### Notes

- **Eager vs lazy router:** Plan mentioned lazy-import; codebase Call Center pages use eager imports — followed existing pattern (no functional impact).
- **Pre-existing `tsc` failures** in unrelated files (`CallGroupFormModal.test.tsx`, `NotificationIntegrationFormModal.tsx`, `RoutePhonebooksTab.tsx`) — out of scope; new 07-18 files have no tsc diagnostics. Logged to deferred-items.

## Issues Encountered

- Frontend `npx tsc --noEmit` exits non-zero due to pre-existing errors outside this plan; `npm run test:cc` green (34/34).

## User Setup Required

None.

## Known Stubs

None — reports load from live API; empty/error/loading states are real UI, not placeholders.

## Threat Flags

None beyond plan threat model (T-07-18-01/02/03 mitigated in Tasks 1–2).

## Next Phase Readiness

- Ready for 07-15 to extend `callCenterReportsApi` with schedules endpoints
- Manual UAT: open `/callcenter/reports`, switch reports, export CSV/XLSX/PDF, verify AgentTimeline

## Self-Check: PASSED

- FOUND: packages/frontend/src/shared/api/endpoints/callCenterReportsApi.ts
- FOUND: packages/frontend/src/features/callcenter/lib/reportPdf.tsx
- FOUND: packages/frontend/src/pages/CallCenterReportsPage/CallCenterReportsPage.tsx
- FOUND: packages/frontend/src/features/callcenter/ui/AgentTimeline/AgentTimeline.tsx (reused, not created)
- FOUND commits: f0c8981, cd3509f
