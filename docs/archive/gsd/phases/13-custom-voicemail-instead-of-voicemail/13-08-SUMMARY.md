---
phase: 13-custom-voicemail-instead-of-voicemail
plan: 08
subsystem: voicemail
tags: [voicemail, jwt, cdr, surface-l, d-58, d-69, tdd]

requires:
  - phase: 13-custom-voicemail-instead-of-voicemail
    provides: JWT list (13-11), Surface L chrome (13-12), retryTranscript (13-07), safeVoicemailFilePath (13-05)
provides:
  - JWT GET /voicemail/:uniqueid and GET /voicemail/:uniqueid/play (audio/wav, Range, download=1)
  - POST /voicemail/:uniqueid/retry-stt gated to transcript_status=failed
  - VoicemailDetailsModal Dialog with four transcript states and JWT AudioPlayer
  - Journal Voicemail icon + tab details action opening the same Dialog
affects:
  - 13-10 VoicemailAiAdapter (reads transcript/summary already written by 13-07)
  - D-58 Surface L remaining live UAT

actuals:
  tokens: 18978
  tasks: 3
  commits: 7

tech-stack:
  added: []
  patterns:
    - viewer() tenant from req.user.vpbx_user_uid; CDR findByUniqueid for access-scope
    - JWT play URL via voicemailPlayUrl; notify /voicemail/play?token= never rendered
    - t(key, fallback) cdr.voicemail.* so dirty locales stay unstaged

key-files:
  created:
    - packages/frontend/src/features/cdr/ui/VoicemailDetailsModal/VoicemailDetailsModal.tsx
    - packages/frontend/src/features/cdr/ui/VoicemailDetailsModal/VoicemailDetailsModal.module.scss
    - packages/frontend/src/features/cdr/ui/VoicemailDetailsModal/VoicemailDetailsModal.test.tsx
    - packages/frontend/src/features/cdr/ui/CdrTable/CdrTable.test.tsx
    - packages/frontend/src/features/cdr/ui/CdrTable/CdrTable.module.scss
    - packages/frontend/src/shared/api/endpoints/voicemailApi.test.ts
  modified:
    - packages/backend/src/modules/voicemail/voicemail.controller.ts
    - packages/backend/src/modules/voicemail/voicemail.service.ts
    - packages/backend/src/modules/voicemail/voicemail.module.ts
    - packages/backend/src/modules/voicemail/voicemail-scanner.service.ts
    - packages/frontend/src/shared/api/endpoints/voicemailApi.ts
    - packages/frontend/src/shared/api/api.ts
    - packages/frontend/src/features/cdr/index.ts
    - packages/frontend/src/features/cdr/ui/CdrTable/CdrTable.tsx
    - packages/frontend/src/pages/CdrReportPage/CdrReportPage.tsx
    - packages/frontend/src/pages/CdrReportPage/CdrReportPage.test.tsx
    - packages/frontend/src/pages/CdrReportPage/CdrReportPage.module.scss

key-decisions:
  - "Detail DTO is an explicit field pick; notify token URL is never attached"
  - "retry-stt is BadRequest unless transcript_status=failed (not_configured has no retry)"
  - "Journal hasVoicemail is derived from JWT list uniqueids; voicemail query skips only on analytics"
  - "t(key, fallback) — dirty ru.ts/en.ts not staged"

patterns-established:
  - "Pattern: JWT play is /voicemail/:uniqueid/play; notify token stays /voicemail/play?token="
  - "Pattern: Surface L details is Dialog size=large, AudioPlayer not compact"

requirements-completed: [D-58, D-69]

coverage:
  - id: D1
    description: Cross-tenant uniqueid returns 404; play MIME is audio/wav; detail DTO has no token URL
    requirement: D-58
    verification:
      - kind: unit
        ref: packages/backend/src/modules/voicemail/voicemail.service.spec.ts#findByUniqueid 404s when the row belongs to another tenant
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/voicemail/voicemail.service.spec.ts#play sets audio/wav, supports Range, and download=1 sets .wav disposition
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/voicemail/voicemail.service.spec.ts#detail DTO has no token or play-by-token URL field
        status: pass
    human_judgment: false
  - id: D2
    description: retry-stt calls scanner only when transcript_status is failed, not not_configured
    requirement: D-58
    verification:
      - kind: unit
        ref: packages/backend/src/modules/voicemail/voicemail.service.spec.ts#retryStt calls scanner.retryTranscript only when transcript_status is failed
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/voicemail/voicemail.service.spec.ts#retryStt rejects not_configured and does not retry
        status: pass
    human_judgment: false
  - id: D3
    description: VoicemailDetailsModal Dialog large with four transcript states; not_configured has no retry
    requirement: D-58
    verification:
      - kind: unit
        ref: packages/frontend/src/features/cdr/ui/VoicemailDetailsModal/VoicemailDetailsModal.test.tsx#renders a large Dialog, not a Sheet
        status: pass
      - kind: unit
        ref: packages/frontend/src/features/cdr/ui/VoicemailDetailsModal/VoicemailDetailsModal.test.tsx#not_configured has STT settings link and no retry button
        status: pass
    human_judgment: false
  - id: D4
    description: notify_status=failed is a details meta line only, not a toast (D-69)
    requirement: D-69
    verification:
      - kind: unit
        ref: packages/frontend/src/features/cdr/ui/VoicemailDetailsModal/VoicemailDetailsModal.test.tsx#notify_status=failed is a meta line, not a toast or alert
        status: pass
    human_judgment: false
  - id: D5
    description: Journal RecordingButton stays conversation; Voicemail icon opens details; tab keeps shared filter
    requirement: D-58
    verification:
      - kind: unit
        ref: packages/frontend/src/features/cdr/ui/CdrTable/CdrTable.test.tsx#keeps RecordingButton for conversation and adds a Voicemail details icon
        status: pass
      - kind: unit
        ref: packages/frontend/src/pages/CdrReportPage/CdrReportPage.test.tsx#details action opens VoicemailDetailsModal without a token URL
        status: pass
      - kind: unit
        ref: packages/frontend/src/pages/CdrReportPage/CdrReportPage.test.tsx#calls useGetVoicemailMessagesQuery when voicemail=1
        status: pass
    human_judgment: false

duration: 29min
completed: 2026-09-03
status: complete
---

# Phase 13 Plan 08: JWT stream + details Dialog + journal icons Summary

**JWT uniqueid play/detail/retry-stt with tenant + CDR access-scope, Surface L Dialog four transcript states, and journal/tab Voicemail icons that never render the notify token URL**

## Performance

- **Duration:** 29 min
- **Started:** 2026-09-03T03:38:50Z
- **Completed:** 2026-09-03T04:08:00Z
- **Tasks:** 3
- **Files modified:** 19

## Accomplishments

- JWT `GET /voicemail/:uniqueid` and `GET /voicemail/:uniqueid/play` (audio/wav, Range, `?download=1` → `.wav`); cross-tenant and access-scope 404
- `POST /voicemail/:uniqueid/retry-stt` calls `retryTranscript` only when `transcript_status=failed`
- `VoicemailDetailsModal` Dialog `size="large"`, AudioPlayer not compact, four STT states, notify failure as meta only
- Journal keeps RecordingButton for conversation; Voicemail info icon and tab «Детали сообщения» open the same Dialog

## Task Commits

Each task was committed atomically (TDD RED then GREEN):

1. **Task 1 RED:** `9c2708b` (test) — failing JWT detail/play/retry specs
2. **Task 1 GREEN:** `a30fb7a` (feat) — viewer routes + stream + retry gate + voicemailApi
3. **Task 2 RED:** `ae68fa6` (test) — failing four-state Dialog specs
4. **Task 2 GREEN:** `294239c` (feat) — VoicemailDetailsModal
5. **Task 3 RED:** `2bef5b0` (test) — failing journal icon + tab details specs
6. **Task 3 GREEN:** `d08976c` (feat) — journal icon + tab table + modal open

**Plan metadata:** pending docs commit

_Note: TDD tasks have test → feat commits_

## Files Created/Modified

- `packages/backend/src/modules/voicemail/voicemail.controller.ts` — viewer() GET detail/play + POST retry-stt
- `packages/backend/src/modules/voicemail/voicemail.service.ts` — findByUniqueid / streamByUniqueid / retryStt + explicit DTO
- `packages/backend/src/modules/voicemail/voicemail.module.ts` — ReportsCdrModule for access-scope
- `packages/frontend/src/shared/api/endpoints/voicemailApi.ts` — getByUniqueid, retry mutation, voicemailPlayUrl
- `packages/frontend/src/features/cdr/ui/VoicemailDetailsModal/*` — Surface L details Dialog
- `packages/frontend/src/features/cdr/ui/CdrTable/CdrTable.tsx` — Voicemail icon beside RecordingButton
- `packages/frontend/src/pages/CdrReportPage/CdrReportPage.tsx` — tab columns + modal state

## Decisions Made

- Detail JSON is a picked DTO (no `notify_dispatch`, no token/play URL fields).
- `not_configured` never retries; UI links to `/settings/stt-engines`.
- Journal `hasVoicemail` is a uniqueid join against the JWT list; list query skips only on the analytics tab.
- Locales stay `t(key, fallback)` so dirty `ru.ts`/`en.ts` WIP is not staged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] forwardRef on scanner ↔ service**
- **Found during:** Task 1 (Nest circular DI after injecting scanner into VoicemailService)
- **Issue:** Scanner already injects VoicemailService; adding the reverse inject needed forwardRef
- **Fix:** `@Inject(forwardRef(() => VoicemailScannerService))` and matching scanner wrap
- **Files modified:** `voicemail.service.ts`, `voicemail-scanner.service.ts`
- **Verification:** full `--testPathPattern=voicemail` 62 passed
- **Committed in:** `a30fb7a`

**2. [Rule 3 - Blocking] Export new voicemailApi hooks from api.ts**
- **Found during:** Task 1 (13-11 already re-exports from api.ts)
- **Issue:** New hooks would be invisible to existing import path
- **Fix:** export `useGetVoicemailByUniqueidQuery`, `useRetryVoicemailSttMutation`, `voicemailPlayUrl`
- **Files modified:** `packages/frontend/src/shared/api/api.ts`
- **Verification:** voicemailApi.test.ts passed
- **Committed in:** `a30fb7a`

**3. [Rule 2 - Missing Critical] Fetch voicemail list on journal for hasVoicemail**
- **Found during:** Task 3 (journal icon needs a uniqueid join; backend CDR hasVoicemail flag is out of files_modified)
- **Issue:** 13-12 skipped the list until `voicemail=1`, so journal rows could not show the icon
- **Fix:** skip only when `currentTab === 'analytics'`; map `hasVoicemail` from list uniqueids
- **Files modified:** `CdrReportPage.tsx`
- **Verification:** CdrTable + CdrReportPage tests passed
- **Committed in:** `d08976c`

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 missing critical)
**Impact on plan:** Required for Nest boot, hook exports, and journal icons. No new npm packages. No scope creep.

## Issues Encountered

None

## Authentication Gates

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for 13-10 (read-only VoicemailAiAdapter). Token play URL stays notify-only. Live UAT should open a message in-app via JWT and confirm four transcript states.

## TDD Gate Compliance

- Task 1 RED `9c2708b` / GREEN `a30fb7a`
- Task 2 RED `ae68fa6` / GREEN `294239c`
- Task 3 RED `2bef5b0` / GREEN `d08976c`
- No REFACTOR commits

## Known Stubs

None

## Self-Check: PASSED

- FOUND: packages/frontend/src/features/cdr/ui/VoicemailDetailsModal/VoicemailDetailsModal.tsx
- FOUND: packages/backend/src/modules/voicemail/voicemail.controller.ts
- FOUND: 13-08-SUMMARY.md
- FOUND: 9c2708b, a30fb7a, ae68fa6, 294239c, 2bef5b0, d08976c
- VERIFY: backend `--testPathPattern=voicemail` 62 passed; frontend `src/features/cdr` + `src/pages/CdrReportPage` 21 passed
- D-58 not marked Complete in REQUIREMENTS.md (blocked: 13-10 still open)
- D-69 already complete from 13-07 (mark-complete: not_found)
