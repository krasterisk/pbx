---
phase: 18-polnyy-refaktoring-rechevoy-analitiki
plan: 13
subsystem: ui
tags: [speech-analytics, upload, api-tokens, i18n, tdd, vitest]

requires:
  - phase: 18-polnyy-refaktoring-rechevoy-analitiki
    provides: Cabinet/JWT upload allocate-content-complete + analysis-runs; hash-only SA token service APIs (18-07)
  - phase: 18-polnyy-refaktoring-rechevoy-analitiki
    provides: Projects UI and journal shell (18-12 / journal plans)
provides:
  - UploadForm shared dialog (project required, busy «Загрузка...», no channel swap)
  - TokensTable empty/loading/error + one-time secret dialog
  - ru/en Copywriting keys for upload, tokens, pause, models hint, chat confirms
affects:
  - 18-15 Module settings UI (consumes pause/models/chat locale keys)
  - Future tokens page / CDR upload entry mount

actuals:
  tokens: 13128
  tasks: 2
  commits: 4

plan_head_before: 8d166bba85c1fc8a728effe7e329381d2fc8280b

tech-stack:
  added: []
  patterns:
    - "Feature UploadForm/TokensTable with SCSS modules + VStack/HStack; RTK compose for cabinet upload"
    - "One-time secret held only in component state until dialog close (never in list columns)"

key-files:
  created:
    - packages/frontend/src/features/speechAnalytics/ui/UploadForm/UploadForm.tsx
    - packages/frontend/src/features/speechAnalytics/ui/UploadForm/UploadForm.test.tsx
    - packages/frontend/src/features/speechAnalytics/ui/UploadForm/UploadForm.module.scss
    - packages/frontend/src/features/speechAnalytics/ui/TokensTable/TokensTable.tsx
    - packages/frontend/src/features/speechAnalytics/ui/TokensTable/TokensTable.test.tsx
    - packages/frontend/src/features/speechAnalytics/ui/TokensTable/TokensTable.module.scss
  modified:
    - packages/frontend/src/features/speechAnalytics/api/speechAnalyticsApi.ts
    - packages/frontend/src/pages/SpeechAnalyticsJournalPage/SpeechAnalyticsJournalPage.tsx
    - packages/frontend/src/pages/SpeechAnalyticsJournalPage/SpeechAnalyticsJournalPage.test.tsx
    - packages/frontend/src/shared/config/locales/ru.ts
    - packages/frontend/src/shared/config/locales/en.ts

key-decisions:
  - "Cabinet upload RTK mutation composes JWT allocate → content → complete → analysis-runs (no wallet)"
  - "TokensTable is prop-driven for issue/list/revoke; secret only in one-time dialog state"
  - "Locale pause/models/chat keys owned here for 18-15 consumers"

patterns-established:
  - "Upload left=operator channel map with no UI swap control"
  - "Empty tokens CTA hidden for supervisor via canIssue=false"

requirements-completed: [REQ-SA-PARITY, REQ-SA-ARCH]

coverage:
  - id: D1
    description: "UploadForm requires project, busy Загрузка..., no channel swap; batch shares one field set"
    requirement: REQ-SA-PARITY
    verification:
      - kind: unit
        ref: "packages/frontend/src/features/speechAnalytics/ui/UploadForm/UploadForm.test.tsx#requires project and shows uploading busy label without channel swap"
        status: pass
    human_judgment: false
  - id: D2
    description: "TokensTable empty copy, supervisor CTA hidden, secret shown once then gone"
    requirement: REQ-SA-PARITY
    verification:
      - kind: unit
        ref: "packages/frontend/src/features/speechAnalytics/ui/TokensTable/TokensTable.test.tsx#shows empty copy and hides issue CTA for supervisor; secret dialog once"
        status: pass
    human_judgment: false

duration: 14min
completed: 2026-09-22
status: complete
---

# Phase 18 Plan 13: UploadForm and TokensTable Summary

**Cabinet UploadForm and TokensTable ship against 18-07 APIs with Copywriting Contract locale keys for upload, tokens, pause, models, and chat confirms.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-09-22T15:38:00Z
- **Completed:** 2026-09-22T15:52:00Z
- **Tasks:** 2/2
- **Files modified:** 13

## Accomplishments

- Shared `UploadForm` with required project, busy submit label, mp3/wav/ogg/m4a validation, no channel-swap UI; mounted on journal upload CTAs
- `TokensTable` with empty/Skeleton/error+retry, horizontal scroll, revoke in `TableRowActions`, one-time secret dialog
- `ru.ts` / `en.ts` keys for upload, tokens, `pauseCompanyLabel`, `modelsAdminOnlyHint`, and S10 chat confirm strings (for 18-15)

## Task Commits

1. **Task 1 RED: UploadForm failing tests** - `d168e913` (test)
2. **Task 1 GREEN: UploadForm + journal mount + upload locales** - `3c4958c5` (feat)
3. **Task 2 RED: TokensTable failing tests** - `fbcf0193` (test)
4. **Task 2 GREEN: TokensTable + remaining locale keys** - `63b17787` (feat)

**Plan metadata:** (this SUMMARY commit)

## TDD Gate Compliance

| Task | RED commit | RED evidence | GREEN commit | Verdict |
|------|------------|--------------|--------------|---------|
| 1 UploadForm | `d168e913` | `tdd/18-13-t1-red-evidence.json` (`RED_EVIDENCE_OK`) | `3c4958c5` | pass |
| 2 TokensTable | `fbcf0193` | `tdd/18-13-t2-red-evidence.json` (`RED_EVIDENCE_OK`) | `63b17787` | pass |

## Files Created/Modified

- `UploadForm/*` - Shared upload dialog for journal (and reusable for CDR)
- `TokensTable/*` - API token list + one-time secret UX
- `speechAnalyticsApi.ts` - `uploadSaCabinetBatch` RTK mutation composing JWT upload APIs
- `SpeechAnalyticsJournalPage.tsx` - Opens UploadForm from toolbar/empty CTAs
- `ru.ts` / `en.ts` - Upload + token + pause/models/chat Copywriting keys

## Decisions Made

- Cabinet upload uses composed JWT allocate/content/complete/analysis-runs in RTK `queryFn` (never wallet)
- TokensTable accepts `canIssue` / `moduleActive` props so supervisors and module-off hide issue CTA while keeping the list readable
- Pause/models/chat locale keys land in this plan so 18-15 is not a second locale owner

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Cabinet upload HTTP as composed JWT steps**
- **Found during:** Task 1
- **Issue:** 18-07 `UploadService` supports `channel: 'cabinet'`, but JWT controller exposes allocate/content/complete rather than a single cabinet `uploads/batch` route
- **Fix:** Frontend `uploadSaCabinetBatch` composes those JWT endpoints per file; per-file failure continues the batch
- **Files modified:** `speechAnalyticsApi.ts`
- **Commit:** `3c4958c5`

**2. [Rule 3 - Blocking] Journal test mocks extended for new hooks**
- **Found during:** Task 1
- **Issue:** Mounting UploadForm required `useGetSaProjectsQuery` / `useUploadSaCabinetBatchMutation` mocks
- **Fix:** Extended journal page test mocks
- **Files modified:** `SpeechAnalyticsJournalPage.test.tsx`
- **Commit:** `3c4958c5`

### Deferred

- CDR page upload button not mounted: no existing speech-analytics upload entry on CDR UI in this tree; `UploadForm` is reusable when that surface adds an entry point
- Tokens HTTP issue/list routes for `issueSpeechAnalyticsToken` are service-level from 18-07; TokensTable is prop-driven for a later page to wire RTK

## Threat Flags

None beyond plan threat model. Secret stays in ephemeral dialog state only (T-18-13-SECRET mitigated).

## Known Stubs

None that block the plan goal.

## Self-Check: PASSED

- UploadForm / TokensTable / tests / SCSS / locales present
- Commits `d168e913`, `3c4958c5`, `fbcf0193`, `63b17787` on branch
- Vitest: UploadForm 2/2 pass; TokensTable 2/2 pass
