---
phase: 13-custom-voicemail-instead-of-voicemail
plan: 05
subsystem: voicemail
tags: [voicemail, opaque-token, wav, d-59, d-67, tdd]

requires:
  - phase: 13-custom-voicemail-instead-of-voicemail
    provides: D-60 ingest table + JWT list (13-11); DisplayToken guard analog
provides:
  - vm_access_tokens table + unique token index
  - VoicemailLinkGuard (?token=, req.user without sub/level)
  - mintPlayToken 7-day APP_URL play link
  - GET /voicemail/play streams audio/wav with Range
affects:
  - 13-06 notify attach (calls mintPlayToken)
  - 13-08 JWT stream (reuses safeVoicemailFilePath)

actuals:
  tokens: 6857
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - Copy DisplayTokenGuard onto a dedicated vm_access_tokens table (never cc_display_tokens)
    - req.user is { vpbx_user_uid, isDisplayToken } only — no JWT session fields
    - safeVoicemailFilePath copies CDR .. / startsWith guards but never appends .mp3

key-files:
  created:
    - packages/backend/src/modules/voicemail/voicemail-access-token.model.ts
    - packages/backend/src/modules/voicemail/voicemail-link.guard.ts
    - packages/backend/src/modules/voicemail/voicemail-link.guard.spec.ts
    - packages/backend/src/modules/voicemail/voicemail-link.controller.ts
    - packages/backend/src/modules/voicemail/voicemail-link.controller.spec.ts
    - packages/backend/src/modules/voicemail/voicemail.service.spec.ts
  modified:
    - packages/backend/src/modules/voicemail/migrate-voicemail.ts
    - packages/backend/src/modules/voicemail/voicemail.service.ts
    - packages/backend/src/modules/voicemail/voicemail.module.ts
    - packages/backend/src/app.module.ts

key-decisions:
  - "Play tokens live in vm_access_tokens, not cc_display_tokens"
  - "Expired tokens return 401 (UnauthorizedException), matching DisplayTokenGuard"
  - "records_base_path comes from SystemSettingsService.getServerConfigRaw like CDR"

patterns-established:
  - "Pattern: notify-link auth is VoicemailLinkGuard-only; JWT list stays on VoicemailController"
  - "Pattern: mintPlayToken is the only place that builds /api/voicemail/play?token="

requirements-completed: [D-59, D-67]

coverage:
  - id: D1
    description: VoicemailLinkGuard rejects missing/unknown/revoked (401) and expired (401/410); valid req.user is only vpbx_user_uid + isDisplayToken (D-59)
    requirement: D-59
    verification:
      - kind: unit
        ref: packages/backend/src/modules/voicemail/voicemail-link.guard.spec.ts#sets req.user to only vpbx_user_uid and isDisplayToken for a valid token
        status: pass
    human_judgment: false
  - id: D2
    description: migrate-voicemail.ts creates vm_access_tokens idempotently with a unique token index
    requirement: D-59
    verification:
      - kind: unit
        ref: packages/backend/src/modules/voicemail/voicemail-link.guard.spec.ts#creates vm_access_tokens idempotently with unique token index
        status: pass
    human_judgment: false
  - id: D3
    description: mintPlayToken inserts expires_at = now+7d and returns ${APP_URL}/api/voicemail/play?token= (D-67)
    requirement: D-67
    verification:
      - kind: unit
        ref: packages/backend/src/modules/voicemail/voicemail.service.spec.ts#inserts a 7-day token and returns an APP_URL play link
        status: pass
    human_judgment: false
  - id: D4
    description: safeVoicemailFilePath rejects .. and does not append .mp3
    requirement: D-59
    verification:
      - kind: unit
        ref: packages/backend/src/modules/voicemail/voicemail.service.spec.ts#rejects a relative path that contains ..
        status: pass
    human_judgment: false
  - id: D5
    description: GET /voicemail/play is VoicemailLinkGuard-only and streams audio/wav with Range 206
    requirement: D-59
    verification:
      - kind: unit
        ref: packages/backend/src/modules/voicemail/voicemail-link.controller.spec.ts#streamByPlayToken sets Content-Type audio/wav and supports Range 206
        status: pass
    human_judgment: false
  - id: D6
    description: JWT list/detail JSON and IVoicemailMessage have no token URL
    requirement: D-59
    verification:
      - kind: unit
        ref: packages/backend/src/modules/voicemail/voicemail.controller.spec.ts#list JSON has no play-by-token URL field
        status: pass
    human_judgment: false

duration: 9min
completed: 2026-09-03
status: complete
---

# Phase 13 Plan 05: Opaque play tokens + wav resolver Summary

**7-day `vm_access_tokens` + `VoicemailLinkGuard` mint `${APP_URL}/api/voicemail/play?token=` and stream `audio/wav` with Range — no JWT session fields, no `cc_display_tokens` reuse**

## Performance

- **Duration:** 9 min
- **Started:** 2026-09-03T02:24:05Z
- **Completed:** 2026-09-03T02:32:57Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Dedicated `vm_access_tokens` table (opaque `randomBytes(32)` hex, unique token index) — not `cc_display_tokens`
- `VoicemailLinkGuard` on `?token=`: missing/unknown/revoked/expired → 401; valid `req.user` is only `{ vpbx_user_uid, isDisplayToken: true }`
- `mintPlayToken` writes `expires_at = now+7d` and returns `${APP_URL}/api/voicemail/play?token=`
- `GET /voicemail/play` is guard-only (no `JwtAuthGuard`), streams `audio/wav` with Range/206/416
- `safeVoicemailFilePath` copies CDR `..` / `startsWith` guards and never appends `.mp3`

## Task Commits

Each task was committed atomically:

1. **Task 1: vm_access_tokens + VoicemailLinkGuard** - `5928dbe` (test RED) + `f7a846f` (feat GREEN)
2. **Task 2: Token play route + mintPlayToken + wav path resolver** - `e9581ff` (test RED) + `d7dd96b` (feat GREEN)

**Plan metadata:** (this commit)

_Note: TDD tasks have RED → GREEN commits_

## Files Created/Modified
- `packages/backend/src/modules/voicemail/voicemail-access-token.model.ts` - `vm_access_tokens` Sequelize model
- `packages/backend/src/modules/voicemail/voicemail-link.guard.ts` - `?token=` lookup, no `sub`/`level`
- `packages/backend/src/modules/voicemail/voicemail-link.guard.spec.ts` - missing/unknown/revoked/expired/valid + migrate source assert
- `packages/backend/src/modules/voicemail/voicemail-link.controller.ts` - `GET /voicemail/play`, guard-only
- `packages/backend/src/modules/voicemail/voicemail-link.controller.spec.ts` - guard metadata + wav Range + no cdr-public
- `packages/backend/src/modules/voicemail/voicemail.service.ts` - `safeVoicemailFilePath`, `mintPlayToken`, `streamByPlayToken`
- `packages/backend/src/modules/voicemail/voicemail.service.spec.ts` - traversal / no-mp3 / 7-day APP_URL mint
- `packages/backend/src/modules/voicemail/voicemail.module.ts` - token model, link controller/guard, SystemSettingsModule
- `packages/backend/src/modules/voicemail/migrate-voicemail.ts` - second `createTable(..., { ifNotExists: true })` + unique token index
- `packages/backend/src/app.module.ts` - register `VoicemailAccessToken`

## Decisions Made
- Expired tokens use `UnauthorizedException` (401), same as `DisplayTokenGuard`; D-67 also allows 410.
- `records_base_path` is read from `SystemSettingsService.getServerConfigRaw()` so token play and CDR share the same volume.
- Token URL is minted only by `mintPlayToken` — `IVoicemailMessage` and JWT list JSON are unchanged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Stream spec cannot spy `fs.createReadStream`**
- **Found during:** Task 2 GREEN
- **Issue:** `jest.spyOn(fs, 'createReadStream')` throws `Cannot redefine property` on this Node/Jest combo
- **Fix:** Pipe the real range stream into a `PassThrough` and collect chunks
- **Files modified:** packages/backend/src/modules/voicemail/voicemail-link.controller.spec.ts
- **Verification:** voicemail Jest — 31 passed
- **Committed in:** d7dd96b (Task 2 GREEN)

**2. [Rule 2 - Missing Critical] Import SystemSettingsModule for records_base_path**
- **Found during:** Task 2
- **Issue:** Path resolver needs the same DB-backed volume as CDR; ConfigService-only would miss UI-set `records_base_path`
- **Fix:** Inject `SystemSettingsService` and import `SystemSettingsModule` in `VoicemailModule`
- **Files modified:** packages/backend/src/modules/voicemail/voicemail.module.ts, voicemail.service.ts
- **Verification:** stream test uses mocked `getServerConfigRaw`
- **Committed in:** d7dd96b (Task 2 GREEN)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical)
**Impact on plan:** Required for a working wav stream against the real records volume. No scope creep (notify attach and JWT stream left to 13-06 / 13-08).

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. Ops still run `migrate-voicemail.ts` against MySQL so `vm_access_tokens` exists (`ifNotExists`).

## Next Phase Readiness
Ready for 13-06 (notify attach calls `mintPlayToken`) and 13-08 (JWT stream reuses `safeVoicemailFilePath`). Do not return the token URL from JWT list/detail.

## TDD Gate Compliance
- RED commits present: `5928dbe`, `e9581ff`
- GREEN commits: `f7a846f`, `d7dd96b`
- No REFACTOR commit (implementation stayed minimal)

## Authentication Gates
None

## Known Stubs
None — notify send is 13-06; JWT `/voicemail/:id/play` is 13-08.

## Self-Check: PASSED
- FOUND: packages/backend/src/modules/voicemail/voicemail-access-token.model.ts
- FOUND: packages/backend/src/modules/voicemail/voicemail-link.guard.ts
- FOUND: packages/backend/src/modules/voicemail/voicemail-link.controller.ts
- FOUND: 5928dbe
- FOUND: f7a846f
- FOUND: e9581ff
- FOUND: d7dd96b
- VERIFY: `npm run test -w @krasterisk/backend -- --testPathPattern="voicemail" --no-coverage` — 31 passed
- `cdr-public.controller` not imported from voicemail module
