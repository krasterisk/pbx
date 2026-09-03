---
phase: 13-custom-voicemail-instead-of-voicemail
plan: 12
subsystem: ui
tags: [voicemail, cdr, surface-l, d-58, tdd]

requires:
  - phase: 13-custom-voicemail-instead-of-voicemail
    provides: useGetVoicemailMessagesQuery JWT list hook (13-11)
provides:
  - CdrUiFilters.voicemail UI-only shared field
  - CdrFilter checkbox writing voicemail=1
  - CdrReportPage third Button tab wired to 13-11 list query
affects:
  - 13-08 VoicemailDetailsModal and journal icons
  - D-58 Surface L remaining columns/player

actuals:
  tokens: 4404
  tasks: 2
  commits: 5

tech-stack:
  added: []
  patterns:
    - CdrUiFilters.voicemail === '1' is the single source for tab + checkbox
    - useGetVoicemailMessagesQuery({ skip: filters.voicemail !== '1' })
    - t(key, fallback) when locale files are dirty WIP

key-files:
  created:
    - packages/frontend/src/features/cdr/ui/CdrFilter/CdrFilter.test.tsx
  modified:
    - packages/frontend/src/features/cdr/model/lib/cdrFiltersToParams.ts
    - packages/frontend/src/features/cdr/ui/CdrFilter/CdrFilter.tsx
    - packages/frontend/src/pages/CdrReportPage/CdrReportPage.tsx
    - packages/frontend/src/pages/CdrReportPage/CdrReportPage.test.tsx

key-decisions:
  - "voicemail stays UI-only on CdrUiFilters — CdrQueryParams has no matching list param"
  - "Tab and checkbox share search-param voicemail=1; journal/analytics delete the key"
  - "t(key, fallback) — dirty ru.ts/en.ts not staged"
  - "Chrome list only: no VoicemailDetailsModal, no play-by-token URL (T-13-26)"

patterns-established:
  - "Pattern: Surface L chrome uses Button tabs, not shared/ui/Tabs"
  - "Pattern: JWT voicemail list is skipped until the shared filter is on"

requirements-completed: [D-58]

coverage:
  - id: D1
    description: CdrUiFilters.voicemail is '1' or undefined; checkbox writes the field; parse round-trips voicemail=1
    requirement: D-58
    verification:
      - kind: unit
        ref: packages/frontend/src/features/cdr/ui/CdrFilter/CdrFilter.test.tsx#writes voicemail: 1 when the checkbox is checked
        status: pass
      - kind: unit
        ref: packages/frontend/src/features/cdr/ui/CdrFilter/CdrFilter.test.tsx#parses voicemail=1 from search params
        status: pass
    human_judgment: false
  - id: D2
    description: clearAll and hasFilters include voicemail
    requirement: D-58
    verification:
      - kind: unit
        ref: packages/frontend/src/features/cdr/ui/CdrFilter/CdrFilter.test.tsx#clearAll sets voicemail to undefined
        status: pass
    human_judgment: false
  - id: D3
    description: CdrReportPage third Button tab named Голосовые сообщения; journal and analytics remain
    requirement: D-58
    verification:
      - kind: unit
        ref: packages/frontend/src/pages/CdrReportPage/CdrReportPage.test.tsx#renders a third tab named Голосовые сообщения
        status: pass
      - kind: unit
        ref: packages/frontend/src/pages/CdrReportPage/CdrReportPage.test.tsx#exposes hybrid-table overflow marker at page level
        status: pass
    human_judgment: false
  - id: D4
    description: Shared filter on calls useGetVoicemailMessagesQuery; no play-by-token URL
    requirement: D-58
    verification:
      - kind: unit
        ref: packages/frontend/src/pages/CdrReportPage/CdrReportPage.test.tsx#calls useGetVoicemailMessagesQuery when voicemail=1
        status: pass
      - kind: unit
        ref: packages/frontend/src/pages/CdrReportPage/CdrReportPage.test.tsx#clicking the voicemail tab writes voicemail=1 to search params
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-09-03
status: complete
---

# Phase 13 Plan 12: Surface L CDR tab chrome Summary

**CDR page third Button tab and CdrFilter checkbox share `CdrUiFilters.voicemail === '1'`; the voicemail tab lists via 13-11 `useGetVoicemailMessagesQuery` without a play-by-token URL**

## Performance

- **Duration:** 8 min
- **Started:** 2026-09-03T02:50:00Z
- **Completed:** 2026-09-03T02:58:08Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- `CdrUiFilters.voicemail?: '1'` parsed from search params; kept out of `filtersToQueryParams` (no CDR API field)
- CdrFilter checkbox `t('cdr.filter.voicemail', 'Голосовые сообщения')` writes the same field; `clearAll` / `hasFilters` include it
- Third CDR Button tab (lucide `Voicemail`) shares that field; journal/analytics clear it
- When the filter is on, the page calls `useGetVoicemailMessagesQuery` with `skip: false`

## Task Commits

Each task was committed atomically:

1. **Task 1: Shared voicemail filter field + checkbox** - `fa73f00` (test RED) + `face4ad` (feat GREEN)
2. **Task 2: CdrReportPage third Button tab** - `a2ce7a7` (test RED) + `c21ba47` (feat GREEN)

**Plan metadata:** (this commit)

_Note: TDD tasks have test → feat commits_

## Files Created/Modified
- `packages/frontend/src/features/cdr/model/lib/cdrFiltersToParams.ts` - `voicemail?: '1'` + search-param parse
- `packages/frontend/src/features/cdr/ui/CdrFilter/CdrFilter.tsx` - checkbox, clearAll, hasFilters
- `packages/frontend/src/features/cdr/ui/CdrFilter/CdrFilter.test.tsx` - checkbox on/off, clearAll, parse
- `packages/frontend/src/pages/CdrReportPage/CdrReportPage.tsx` - third tab + JWT list chrome
- `packages/frontend/src/pages/CdrReportPage/CdrReportPage.test.tsx` - third-tab + query skip assertions

## Decisions Made
- `voicemail` is UI-only: `CdrQueryParams` has no voicemail list param, so it is not forwarded to cdrApi.
- Tab and checkbox are one field (`searchParams.voicemail=1`), not two pieces of React state.
- Locale keys use `t(key, fallback)` so dirty `ru.ts`/`en.ts` WIP stays unstaged.
- Tab body is a chrome list (caller/exten/duration/status). Details Dialog and player stay 13-08. No `file_rel` or token URL is rendered (T-13-26).

## Deviations from Plan

None - plan executed exactly as written.

**Total deviations:** 0 auto-fixed
**Impact on plan:** None

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
Surface L chrome is on the CDR page. Ready for 13-08 (details Dialog / journal icons / player) and remaining wave plans (13-06 notify, 13-07 STT). Do not add play-by-token UI here.

## TDD Gate Compliance
- Task 1 RED: `test(13-12): add failing test for shared voicemail filter` (`fa73f00`)
- Task 1 GREEN: `feat(13-12): implement shared voicemail filter field` (`face4ad`)
- Task 2 RED: `test(13-12): add failing test for CDR voicemail tab` (`a2ce7a7`)
- Task 2 GREEN: `feat(13-12): add CDR voicemail tab chrome` (`c21ba47`)
- No REFACTOR commits (implementation stayed minimal)

## Authentication Gates
None

## Known Stubs
None — voicemail tab list is chrome only; details/player intentionally deferred to 13-08.

## Self-Check: PASSED
- FOUND: packages/frontend/src/features/cdr/ui/CdrFilter/CdrFilter.test.tsx
- FOUND: packages/frontend/src/features/cdr/model/lib/cdrFiltersToParams.ts
- FOUND: packages/frontend/src/features/cdr/ui/CdrFilter/CdrFilter.tsx
- FOUND: packages/frontend/src/pages/CdrReportPage/CdrReportPage.tsx
- FOUND: packages/frontend/src/pages/CdrReportPage/CdrReportPage.test.tsx
- FOUND: fa73f00
- FOUND: face4ad
- FOUND: a2ce7a7
- FOUND: c21ba47
- VERIFY: `npm run test -w @krasterisk/frontend -- src/pages/CdrReportPage src/features/cdr/ui/CdrFilter/CdrFilter.test.tsx` — 9 passed
- D-58 not marked Complete in REQUIREMENTS.md (blocked: sibling plan still open)
