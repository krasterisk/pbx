---
phase: 13-custom-voicemail-instead-of-voicemail
plan: 11
subsystem: voicemail
tags: [voicemail, ingest, jwt, d-60, d-62, d-72, d-73, tdd]

requires:
  - phase: 13-custom-voicemail-instead-of-voicemail
    provides: D-55 hangup-handler CURL + IVoicemailMessage two-axis types + D-72 locked path
provides:
  - Idempotent voicemail_messages migrate (notify_status + transcript_status)
  - Fire-and-forget POST /internal/dialplan/voicemail (timingSafeApiKeyEqual)
  - JWT GET /voicemail tenant-scoped list + voicemailApi
affects:
  - 13-06 notify attach on the same ingest URL
  - 13-07 scanner / STT (must not move onto the hangup path)
  - 13-12 CDR tab consuming useGetVoicemailMessagesQuery

actuals:
  tokens: 6470
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - timingSafeApiKeyEqual + {accepted:true} then void ingest.catch (not DialplanNotifyController !==)
    - Model field user_uid maps to column vpbx_user_uid; UNIQUE via qi.addIndex
    - file_rel rebuilt as {vpbx_user_uid}/voicemail/{uniqueid}[-n].wav — never store caller absolute path

key-files:
  created:
    - packages/backend/src/modules/voicemail/migrate-voicemail.ts
    - packages/backend/src/modules/voicemail/voicemail-message.model.ts
    - packages/backend/src/modules/voicemail/voicemail.service.ts
    - packages/backend/src/modules/voicemail/voicemail-dialplan.controller.ts
    - packages/backend/src/modules/voicemail/voicemail-dialplan.controller.spec.ts
    - packages/backend/src/modules/voicemail/voicemail.module.ts
    - packages/backend/src/modules/voicemail/voicemail.controller.ts
    - packages/backend/src/modules/voicemail/voicemail.controller.spec.ts
    - packages/frontend/src/shared/api/endpoints/voicemailApi.ts
  modified:
    - packages/backend/src/app.module.ts
    - packages/frontend/src/shared/api/rtkApi.ts
    - packages/frontend/src/shared/api/api.ts

key-decisions:
  - "Ingest tenant id accepts vpbx_user_uid (13-02 buildCurlCall) or user_uid (plan wording)"
  - "file_rel is relative under {uid}/voicemail/; basename must match sanitized uniqueid or falls back to {uniqueid}.wav"
  - "GET /voicemail where clause uses req.user.vpbx_user_uid only — query tenant ignored"

patterns-established:
  - "Pattern: hangup ingest never awaits STT/LLM/notify; statuses start pending"
  - "Pattern: RTK tag Voicemail + getVoicemailMessages provides LIST for 13-12"

requirements-completed: [D-60, D-62, D-72, D-73]

coverage:
  - id: D1
    description: POST /internal/dialplan/voicemail returns {accepted:true} before ingest settles (D-62)
    requirement: D-62
    verification:
      - kind: unit
        ref: packages/backend/src/modules/voicemail/voicemail-dialplan.controller.spec.ts#returns before ingest completes (fire-and-forget, not awaited)
        status: pass
    human_judgment: false
  - id: D2
    description: Ingest upserts a row and does not call STT or LLM (D-60)
    requirement: D-60
    verification:
      - kind: unit
        ref: packages/backend/src/modules/voicemail/voicemail-dialplan.controller.spec.ts#upserts a pending row and does not invoke STT or LLM (D-60)
        status: pass
    human_judgment: false
  - id: D3
    description: Stored file_rel uses the locked D-72 {uid}/voicemail/ layout as a relative path
    requirement: D-72
    verification:
      - kind: unit
        ref: packages/backend/src/modules/voicemail/voicemail-dialplan.controller.spec.ts#stores a relative D-72 path even when the CURL file is absolute
        status: pass
    human_judgment: false
  - id: D4
    description: No Nest janitor/cron deletes voicemail files (D-73)
    requirement: D-73
    verification:
      - kind: other
        ref: "git grep -E \"@Interval|cron|unlink|janitor\" -- packages/backend/src/modules/voicemail"
        status: pass
    human_judgment: false
  - id: D5
    description: JWT GET /voicemail lists only req.user.vpbx_user_uid; query tenant is ignored
    verification:
      - kind: unit
        ref: packages/backend/src/modules/voicemail/voicemail.controller.spec.ts#ignores a different tenant id in the query string
        status: pass
    human_judgment: false
  - id: D6
    description: voicemailApi exports useGetVoicemailMessagesQuery with Voicemail LIST tag
    verification:
      - kind: other
        ref: packages/frontend/src/shared/api/endpoints/voicemailApi.ts#useGetVoicemailMessagesQuery
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-09-03
status: complete
---

# Phase 13 Plan 11: Ingest tracer + JWT list Summary

**Fire-and-forget `POST /internal/dialplan/voicemail` upserts `voicemail_messages` on the locked D-72 relative path without STT/LLM, and JWT `GET /voicemail` lists only the caller's tenant via `voicemailApi`**

## Performance

- **Duration:** 8 min
- **Started:** 2026-09-03T02:10:39Z
- **Completed:** 2026-09-03T02:18:30Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Idempotent `migrate-voicemail.ts` creates `voicemail_messages` (`ifNotExists`) with UNIQUE `(vpbx_user_uid, uniqueid)` and two-axis `notify_status` + `transcript_status`
- Hangup CURL is accepted with `{accepted:true}` before ingest settles; key checked via `timingSafeApiKeyEqual` (T-13-03)
- Ingest sanitizes uniqueid, stores a relative D-72 `file_rel`, both statuses `pending` — no STT, LLM, notify, or file janitor
- JWT `GET /voicemail` + `useGetVoicemailMessagesQuery` for 13-12; query tenant cannot widen the where clause

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end ingest — CURL accepts, row exists, no STT** - `6799201` (feat)
2. **Task 2: JWT list + voicemailApi** - `dde2425` (test RED) + `df37604` (feat GREEN)

**Plan metadata:** (this commit)

## Files Created/Modified
- `packages/backend/src/modules/voicemail/migrate-voicemail.ts` - idempotent table + unique index
- `packages/backend/src/modules/voicemail/voicemail-message.model.ts` - Sequelize row (`user_uid` → `vpbx_user_uid`)
- `packages/backend/src/modules/voicemail/voicemail.service.ts` - ingest upsert + `list(vpbxUserUid)`
- `packages/backend/src/modules/voicemail/voicemail-dialplan.controller.ts` - internal POST, fire-and-forget
- `packages/backend/src/modules/voicemail/voicemail-dialplan.controller.spec.ts` - D-60 / D-62 / D-72
- `packages/backend/src/modules/voicemail/voicemail.controller.ts` - JWT GET /voicemail
- `packages/backend/src/modules/voicemail/voicemail.controller.spec.ts` - tenant isolation
- `packages/backend/src/modules/voicemail/voicemail.module.ts` - internal + JWT controllers
- `packages/backend/src/app.module.ts` - VoicemailMessage + VoicemailModule; `synchronize: false`
- `packages/frontend/src/shared/api/endpoints/voicemailApi.ts` - `getVoicemailMessages`
- `packages/frontend/src/shared/api/rtkApi.ts` - tag `Voicemail`
- `packages/frontend/src/shared/api/api.ts` - re-export `useGetVoicemailMessagesQuery`

## Decisions Made
- Tenant id on ingest accepts `vpbx_user_uid` (what `buildCurlCall` actually stamps) and `user_uid` (plan wording).
- `file_rel` is always `{vpbx_user_uid}/voicemail/{uniqueid}[-n].wav` — absolute CURL `file` is never stored.
- JWT list never reads tenant from the query string.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `ingest()` must be `async` so 401 is a rejected promise**
- **Found during:** Task 1 (controller spec)
- **Issue:** Synchronous throw failed `expect(...).rejects.toThrow` (notify analog is `async`)
- **Fix:** Marked the controller method `async` without awaiting ingest
- **Files modified:** packages/backend/src/modules/voicemail/voicemail-dialplan.controller.ts
- **Verification:** voicemail-dialplan Jest — 7 passed
- **Committed in:** 6799201 (Task 1)

**2. [Rule 2 - Missing Critical] Accept `vpbx_user_uid` from the 13-02 CURL**
- **Found during:** Task 1 (read `buildCurlCall`)
- **Issue:** Plan said `user_uid`; generator writes `vpbx_user_uid=`
- **Fix:** `parseTenantUid(body.vpbx_user_uid ?? body.user_uid)`
- **Files modified:** packages/backend/src/modules/voicemail/voicemail.service.ts
- **Verification:** ingest spec accepts both fields
- **Committed in:** 6799201 (Task 1)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical)
**Impact on plan:** Required for hangup CURL to land a row. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. Ops still run `migrate-voicemail.ts` against MySQL (same as other standalone migrates).

## Next Phase Readiness
Ready for 13-06 (notify attach on the same ingest URL/table) and 13-12 (CDR tab). Do not add STT/LLM/scanner here — 13-07. Do not add play-by-token — 13-05 / 13-08.

## TDD Gate Compliance
- RED commit present: `test(13-11): add failing test for JWT voicemail list` (`dde2425`)
- GREEN commit: `feat(13-11): implement JWT voicemail list and voicemailApi` (`df37604`)
- No REFACTOR commit (implementation stayed minimal)
- Task 1 is tracer (not `type: tdd`); tests shipped with the feat commit

## Authentication Gates
None

## Known Stubs
None — notify send is intentionally deferred to 13-06 (ingest URL and table stay unchanged).

## Self-Check: PASSED
- FOUND: packages/backend/src/modules/voicemail/migrate-voicemail.ts
- FOUND: packages/backend/src/modules/voicemail/voicemail.module.ts
- FOUND: packages/frontend/src/shared/api/endpoints/voicemailApi.ts
- FOUND: 6799201
- FOUND: dde2425
- FOUND: df37604
- VERIFY: `npm run test -w @krasterisk/backend -- --testPathPattern="voicemail.controller|voicemail-dialplan" --no-coverage` — 10 passed
- `synchronize: false` unchanged
