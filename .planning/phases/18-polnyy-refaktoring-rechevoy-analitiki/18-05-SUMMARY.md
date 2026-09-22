---
phase: 18-polnyy-refaktoring-rechevoy-analitiki
plan: 05
subsystem: speech-analytics
tags: [speech-analytics, journal, conversation-sheet, cdr-access-scope, tdd, vitest, jest]

requires:
  - phase: 18-polnyy-refaktoring-rechevoy-analitiki
    provides: SA charging seams and analysis pipeline (18-01…18-04)
provides:
  - Journal page with stable-URL ConversationSheet (Аналитика / Расшифровка / Стоимость)
  - Access-scoped journal JWT APIs (list/detail/regenerate/delete) reusing CDR access scope
affects:
  - 18-07 upload/get-analytics flows
  - 18-08 regenerate UX polish
  - 18-11 Excel export and CDR buttons
  - 18-13 batch upload progress
  - 18-14 Reports route removal

actuals:
  tokens: 21445
  tasks: 2
  commits: 4

plan_head_before: 18d82b8d31971608c729c62aea3007d70e4b62c2

tech-stack:
  added: []
  patterns:
    - "ConversationSheet: Sheet + Tabs; PBX hides player; upload/api player on Transcript only"
    - "Journal visibility: cdr-access-scope helpers + UserLevel; ADMIN/SUPERADMIN unrestricted"
    - "Regenerate/delete RBAC: ADMIN+SUPERADMIN; score edits SUPERVISOR+; no analyst role; delete never refunds"

key-files:
  created:
    - packages/frontend/src/pages/SpeechAnalyticsJournalPage/SpeechAnalyticsJournalPage.tsx
    - packages/frontend/src/pages/SpeechAnalyticsJournalPage/SpeechAnalyticsJournalPage.test.tsx
    - packages/frontend/src/features/speechAnalytics/ui/ConversationSheet/ConversationSheet.tsx
    - packages/frontend/src/features/speechAnalytics/ui/ConversationSheet/ConversationSheet.test.tsx
    - packages/frontend/src/features/speechAnalytics/ui/ConversationsTable/ConversationsTable.tsx
    - packages/backend/src/modules/speech-analytics/journal/journal.service.ts
    - packages/backend/src/modules/speech-analytics/journal/journal.service.spec.ts
  modified:
    - packages/frontend/src/features/speechAnalytics/api/speechAnalyticsApi.ts
    - packages/frontend/src/app/router/router.tsx
    - packages/backend/src/modules/speech-analytics/speech-analytics-jwt.controller.ts
    - packages/backend/src/modules/speech-analytics/speech-analytics.module.ts

key-decisions:
  - "Stable journal URL is /speech-analytics/conversations/:conversationId (Reports route kept for 18-14)"
  - "i18n uses t(key, default) Copywriting Contract strings; locale files left to 18-11+"
  - "Wallet is a test-only seam on SaJournalService; production delete never refunds"

patterns-established:
  - "Journal list/detail filter by tenant_uid then isJournalRowVisible(CDR scope)"
  - "Latest-run amount on journal rows; all runs on Cost tab ordered newest-first"

requirements-completed: [REQ-SA-PARITY, REQ-SA-ARCH]

coverage:
  - id: D1
    description: "ConversationSheet opens with locked tabs and PBX/upload player rules plus rebuild badge"
    requirement: REQ-SA-PARITY
    verification:
      - kind: unit
        ref: "packages/frontend/src/features/speechAnalytics/ui/ConversationSheet/ConversationSheet.test.tsx"
        status: pass
    human_judgment: false
  - id: D2
    description: "Journal page opens sheet at stable conversation URL"
    requirement: REQ-SA-ARCH
    verification:
      - kind: unit
        ref: "packages/frontend/src/pages/SpeechAnalyticsJournalPage/SpeechAnalyticsJournalPage.test.tsx"
        status: pass
    human_judgment: false
  - id: D3
    description: "Journal API enforces CDR access scope, ADMIN mutate RBAC, and no-refund delete"
    requirement: REQ-SA-PARITY
    verification:
      - kind: unit
        ref: "packages/backend/src/modules/speech-analytics/journal/journal.service.spec.ts"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-09-22
status: complete
---

# Phase 18 Plan 05: Journal + Conversation Sheet Summary

**Stable-URL conversations journal with three-tab sheet and CDR-scoped JWT APIs (D-05…D-13), without Excel/CDR buttons (18-11).**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-09-22T13:14:00Z
- **Completed:** 2026-09-22T13:35:00Z
- **Tasks:** 2
- **Files modified:** 14 production + TDD evidence

## Accomplishments

- Journal page at `/speech-analytics/conversations` opens `ConversationSheet` via stable `:conversationId` URL with tabs Аналитика / Расшифровка / Стоимость and locked cost/rebuild copy
- PBX conversations hide the sheet player; upload/API play only on Transcript; rebuild keeps prior result with «Идёт пересборка»
- `SaJournalService` lists/details with CDR access-list visibility, regenerate/delete for ADMIN/SUPERADMIN only, and delete without refund

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1 RED: sheet/page failing tests** - `acbee887` (test)
2. **Task 1 GREEN: journal page + ConversationSheet + RTK journal endpoints + routes** - `5bd71b92` (feat)
3. **Task 2 RED: journal.service access/RBAC failing tests** - `5452c9ed` (test)
4. **Task 2 GREEN: journal API + ConversationsTable + controller/module wire** - `539bfe58` (feat)

**Plan metadata:** (SUMMARY commit follows)

## TDD Gate Compliance

| Task | RED evidence | Verdict | GREEN verify |
|------|--------------|---------|--------------|
| 1 | `tdd/conversation-sheet-red-evidence.json` | RED_EVIDENCE_OK | 7/7 Vitest passed |
| 2 | `tdd/journal-service-red-evidence.json` | RED_EVIDENCE_OK | 9/9 Jest passed |

## Files Created/Modified

- `packages/frontend/src/pages/SpeechAnalyticsJournalPage/*` - Journal shell, empty/loading/error, deep-link sheet
- `packages/frontend/src/features/speechAnalytics/ui/ConversationSheet/*` - Three-tab sheet, player rules, rebuild badge
- `packages/frontend/src/features/speechAnalytics/ui/ConversationsTable/*` - Wide scroll table + mobile cards + progress strip
- `packages/frontend/src/features/speechAnalytics/api/speechAnalyticsApi.ts` - journal list/detail/regenerate/delete endpoints
- `packages/frontend/src/app/router/router.tsx` - conversations routes (Reports kept)
- `packages/backend/src/modules/speech-analytics/journal/journal.service.ts` - access-scoped journal + RBAC
- `packages/backend/src/modules/speech-analytics/speech-analytics-jwt.controller.ts` - JWT journal routes
- `packages/backend/src/modules/speech-analytics/speech-analytics.module.ts` - SaJournalService + User/NumberList models

## Decisions Made

- Stable URL path `/speech-analytics/conversations/:conversationId` shared by journal row clicks (CDR «Аналитика» ships in 18-11)
- Copy via `t(key, default)` only; do not stage `ru.ts` / `en.ts`
- Wallet is a test seam only; delete returns `{ refunded: false }` and never calls refund/settleShadow

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Wired router for stable conversation URLs**
- **Found during:** Task 1
- **Issue:** Plan `files_modified` omitted `router.tsx`, but D-06 stable URL requires routes
- **Fix:** Added `/speech-analytics/conversations` and `/:conversationId` without removing Reports
- **Files modified:** `packages/frontend/src/app/router/router.tsx`
- **Verification:** Journal page Vitest deep-link test
- **Committed in:** `5bd71b92`

**2. [Rule 2 - Missing critical functionality] Registered SaJournalService + User/NumberList in module**
- **Found during:** Task 2
- **Issue:** Controller injection and CDR access lookup need Nest providers/models
- **Fix:** Provide `SaJournalService`; `SequelizeModule.forFeature([User, NumberList, …])`
- **Files modified:** `packages/backend/src/modules/speech-analytics/speech-analytics.module.ts`
- **Verification:** journal.service Jest suite green
- **Committed in:** `539bfe58`

**3. [Rule 1 - Bug] Cost-tab assertion needed tab activation under Radix Tabs**
- **Found during:** Task 1 GREEN
- **Issue:** Inactive `TabsContent` unmounts; cost label not in DOM on Analytics tab
- **Fix:** Test clicks Стоимость before asserting «Посчитано, не списано»
- **Files modified:** `ConversationSheet.test.tsx`
- **Verification:** Vitest green
- **Committed in:** `5bd71b92`

**Total deviations:** 3 auto-fixed (2× Rule 2, 1× Rule 1)
**Impact on plan:** Required for stable URL and Nest DI; no Excel/CDR scope creep

## Issues Encountered

- Frontend `npm run test -w` on Windows runs the full chunked suite; targeted Vitest CLI used for plan verifies
- None blocking

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for 18-11 (Excel + CDR analytics buttons), 18-07 upload/get-analytics, and later progress-strip population from upload jobs (18-13). Reports stub remains until 18-14.

## Self-Check: PASSED

- FOUND: ConversationSheet, JournalPage, ConversationsTable, journal.service, JWT journal routes
- FOUND commits: acbee887, 5bd71b92, 5452c9ed, 539bfe58
- Verify: frontend 7/7 pass; backend journal.service 9/9 pass
