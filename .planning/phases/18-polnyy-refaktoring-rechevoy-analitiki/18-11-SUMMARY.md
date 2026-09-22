---
phase: 18-polnyy-refaktoring-rechevoy-analitiki
plan: 11
subsystem: ui
tags: [speech-analytics, exceljs, cdr, journal, i18n, truncateCell]

requires:
  - phase: 18-05
    provides: Journal JWT list/detail spine and /speech-analytics/conversations route
provides:
  - Journal Excel export with truncateCell and CDR access scope (D-37)
  - CDR Аналитика / Получить аналитику actions (D-05, D-16, D-18, D-19)
  - Copywriting Contract journal/CDR i18n keys (ru/en)
affects:
  - 18-07 upload and get-analytics pipeline
  - 18-14 Reports route removal

actuals:
  tokens: 18500
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "exceljs journal export with EXCEL_CELL_CHAR_LIMIT truncateCell parity"
    - "CDR recording-cell analytics actions that preserve hybrid overflow and player"

key-files:
  created:
    - packages/backend/src/modules/speech-analytics/journal/excel-export.ts
    - packages/backend/src/modules/speech-analytics/journal/excel-export.spec.ts
  modified:
    - packages/backend/src/modules/speech-analytics/journal/journal.service.ts
    - packages/backend/src/modules/speech-analytics/speech-analytics-jwt.controller.ts
    - packages/frontend/src/features/cdr/ui/CdrTable/CdrTable.tsx
    - packages/frontend/src/features/cdr/ui/CdrTable/useCdrTableColumns.tsx
    - packages/frontend/src/features/cdr/ui/CdrTable/CdrTable.module.scss
    - packages/frontend/src/features/cdr/ui/CdrTable/CdrTable.test.tsx
    - packages/frontend/src/shared/config/locales/ru.ts
    - packages/frontend/src/shared/config/locales/en.ts

key-decisions:
  - "Excel export is pure buildJournalExcel plus SaJournalService.exportExcel reusing list access scope"
  - "JWT GET journal/export registered before journal/:id"
  - "CDR actions live in the recording cell; companyPaused never hides Get analytics"
  - "Router journal path left as-is from 18-05; Reports route untouched (18-14)"

patterns-established:
  - "truncateCell at 32767 chars for SA journal Excel transcripts"
  - "filterExportRowsByAccess wraps isJournalRowVisible for export IDOR mitigation"

requirements-completed: [REQ-SA-PARITY, REQ-SA-ARCH]

coverage:
  - id: D1
    description: Journal Excel exports full filtered selection with D-37 columns, truncateCell, no robot KPIs
    requirement: REQ-SA-PARITY
    verification:
      - kind: unit
        ref: packages/backend/src/modules/speech-analytics/journal/excel-export.spec.ts#truncates transcripts longer than the Excel cell limit
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/speech-analytics/journal/excel-export.spec.ts#never includes robot KPI columns
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/speech-analytics/journal/excel-export.spec.ts#keeps only rows visible under the same CDR access scope as the journal list
        status: pass
    human_judgment: false
  - id: D2
    description: CDR shows Аналитика / Получить аналитику with recording, module, project, and pause rules
    requirement: REQ-SA-ARCH
    verification:
      - kind: unit
        ref: packages/frontend/src/features/cdr/ui/CdrTable/CdrTable.test.tsx#shows Аналитика when a journal row exists and keeps the CDR player
        status: pass
      - kind: unit
        ref: packages/frontend/src/features/cdr/ui/CdrTable/CdrTable.test.tsx#shows Получить аналитику when recording exists and module is active, even if company is paused
        status: pass
      - kind: unit
        ref: packages/frontend/src/pages/SpeechAnalyticsJournalPage/SpeechAnalyticsJournalPage.test.tsx
        status: pass
    human_judgment: false

duration: 75min
completed: 2026-09-22
status: complete
plan_head_before: fdbfa6bf005f2f919988064d889854399d1fa2bf
commits: 4
---

# Phase 18 Plan 11: Journal Excel + CDR analytics actions Summary

**Access-scoped journal Excel export (truncateCell, D-37 columns) and CDR Аналитика / Получить аналитику entry points with Copywriting Contract i18n.**

## Performance

- **Duration:** ~75 min
- **Started:** 2026-09-22T13:33:00Z
- **Completed:** 2026-09-22T13:45:00Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Excel export builds the full access-scoped selection with journal columns, summary, transcript (truncated), STT quality, topics, rationales, and project scales; robot KPI columns excluded; cost from latest run
- JWT `GET /speech-analytics/journal/export` returns xlsx beside existing journal routes
- CDR recording cell keeps the player and adds visibility-gated Аналитика / Получить аналитику (project ask dialog when route has no project; pause does not hide Get analytics)
- ru/en Copywriting Contract keys for journal/CDR added without U+2014

## Task Commits

Each task was committed atomically (TDD RED then GREEN):

1. **Task 1 RED:** `ddcd3dbc` (test) — failing excel-export truncateCell / column / access tests
2. **Task 1 GREEN:** `db89f459` (feat) — excel-export + journal.exportExcel + JWT export route
3. **Task 2 RED:** `dd870d41` (test) — failing CDR analytics visibility tests
4. **Task 2 GREEN:** `ddd1e65b` (feat) — CDR actions + journal/CDR i18n keys

**Plan metadata:** (pending docs commit)

## TDD Gate Compliance

| Task | RED evidence | Verdict | GREEN verify |
|------|--------------|---------|--------------|
| 1 Excel export | `tdd/excel-export-red-evidence.json` | RED_EVIDENCE_OK | 6/6 excel-export passed |
| 2 CDR actions | `tdd/cdr-analytics-actions-red-evidence.json` | RED_EVIDENCE_OK | 9/9 CdrTable + journal page passed |

## Files Created/Modified

- `packages/backend/src/modules/speech-analytics/journal/excel-export.ts` — truncateCell, buildJournalExcel, access filter
- `packages/backend/src/modules/speech-analytics/journal/excel-export.spec.ts` — D-37 / IDOR unit tests
- `packages/backend/src/modules/speech-analytics/journal/journal.service.ts` — exportExcel orchestration
- `packages/backend/src/modules/speech-analytics/speech-analytics-jwt.controller.ts` — GET journal/export
- `packages/frontend/src/features/cdr/ui/CdrTable/*` — analytics actions + tests + SCSS
- `packages/frontend/src/shared/config/locales/{ru,en}.ts` — journal/CDR Copywriting Contract keys

## Decisions Made

- Export data assembly lives on `SaJournalService.exportExcel` calling pure `buildJournalExcel` so access scope stays in one place
- CDR Get analytics is UI-wired only (busy, project ask, error text); full start/wallet pipeline remains 18-07
- Journal router path not duplicated; Reports route left for 18-14

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] exportExcel on journal.service**
- **Found during:** Task 1 (Excel export)
- **Issue:** Plan `files_modified` listed only excel-export + controller, but a correct access-scoped export needs tenant/CDR-scoped row assembly with transcript and latest-run cost
- **Fix:** Added `SaJournalService.exportExcel` that filters via `filterExportRowsByAccess` and enriches from runs/results/segments
- **Files modified:** `journal.service.ts`
- **Verification:** excel-export + journal.service specs pass
- **Committed in:** `db89f459`

**2. [Rule 3 - Blocking] INVALID_RED stub for missing module**
- **Found during:** Task 1 RED
- **Issue:** Import of missing `./excel-export` is INVALID_RED (suite crash)
- **Fix:** Stub module with intentional wrong behavior so assertions fail
- **Files modified:** `excel-export.ts` (stub then replaced in GREEN)
- **Verification:** `check tdd-red-evidence` → RED_EVIDENCE_OK
- **Committed in:** `ddcd3dbc`

**3. [Already present] router.tsx not modified**
- **Found during:** Task 2
- **Issue:** Plan listed `router.tsx`; 18-05 already registered `/speech-analytics/conversations` and kept Reports
- **Fix:** No second journal route; Reports left in place
- **Files modified:** none
- **Verification:** journal page route tests pass

**Total deviations:** 3 (Rule 2 ×1, Rule 3 ×1, already-present skip ×1)
**Impact on plan:** Required for correct export and valid TDD RED; no scope creep into 18-07/18-14

## Issues Encountered

None beyond INVALID_RED stub adjustment above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for 18-07 (upload / get-analytics server start + wallet) to consume CDR `onGetAnalytics` and for 18-14 to remove the Reports stub. Journal toolbar Excel button wiring can call `GET /speech-analytics/journal/export` from the 18-05 page when desired.

## Self-Check: PASSED

- FOUND: `packages/backend/src/modules/speech-analytics/journal/excel-export.ts`
- FOUND: `packages/backend/src/modules/speech-analytics/journal/excel-export.spec.ts`
- FOUND: commits `ddcd3dbc`, `db89f459`, `dd870d41`, `ddd1e65b`
- FOUND: SUMMARY path for this plan

---
*Phase: 18-polnyy-refaktoring-rechevoy-analitiki*
*Completed: 2026-09-22*
