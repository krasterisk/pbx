---
phase: 13-custom-voicemail-instead-of-voicemail
plan: 13
subsystem: voicemail
tags: [voicemail, hangup-curl, notify, d-62, d-59, token-play, gap-closure]

requires:
  - phase: 13-custom-voicemail-instead-of-voicemail
    provides: emitVoicemailDialplan hangup CURL + ingest notify_dispatch (13-06) + mintPlayToken (13-05)
provides:
  - Hangup-handler CURL carries step notify.integration_uid / body / target / subject and stt_engine_uid / llm_provider_uid
  - Ingest persists notify_dispatch snapshot and next_notify_at when integration uid is present
  - GET /voicemail/play registered before JWT GET /voicemail/:uniqueid
affects:
  - Production Record hangup path (D-62)
  - Opaque 7-day play links (D-59 / CR-01)
  - Scanner resolveEngine / pickLlm step override (D-63)

actuals:
  tokens: 3392
  tasks: 3
  commits: 2

tech-stack:
  added: []
  patterns:
    - emitVoicemailDialplan copies params.notify through sanitizeDialplanInput into buildCurlCall('voicemail')
    - notify_dispatch JSON is the snapshot column for notify + step engine uids (no new migrate)
    - VoicemailLinkController listed before JWT VoicemailController so literal play wins over :uniqueid

key-files:
  created: []
  modified:
    - packages/backend/src/shared/utils/dialplan.util.ts
    - packages/backend/src/shared/utils/dialplan.util.spec.ts
    - packages/backend/src/shared/utils/dialplan-curl.util.ts
    - packages/backend/src/modules/voicemail/voicemail.service.ts
    - packages/backend/src/modules/voicemail/voicemail.service.spec.ts
    - packages/backend/src/modules/voicemail/voicemail-scanner.service.ts
    - packages/backend/src/modules/voicemail/voicemail.module.ts
    - packages/backend/src/modules/voicemail/voicemail-link.controller.spec.ts

key-decisions:
  - "Implementation landed in /gsd-code-review --fix (CR-01 / CR-02); this plan did not rewrite those commits"
  - "Static notify/engine uids go through sanitizeDialplanInput + existing URIENCODE/encodeURIComponent"
  - "No new columns — stt_engine_uid / llm_provider_uid live in notify_dispatch JSON"
  - "Route order fix preferred over changing mintPlayToken path"

patterns-established:
  - "Pattern: hangup CURL is the production notify path — Sheet notify must appear on the handler after krsk-vm-done"
  - "Pattern: Nest static GET play is registered before parameterized JWT :uniqueid"

requirements-completed: [D-62, D-59, D-60, D-54, D-63]

coverage:
  - id: D-62
    description: Hangup-handler CURL from emitVoicemailDialplan carries step params.notify.integration_uid (and optional body/target/subject); ingest persists notify_dispatch so sendFirstNotify / retryNotify can run
    requirement: D-62
    verification:
      - kind: unit
        ref: packages/backend/src/shared/utils/dialplan.util.spec.ts#stamps notify and step engine uids onto the hangup-handler CURL
        status: pass
      - kind: unit
        ref: packages/backend/src/shared/utils/dialplan.util.spec.ts#omits integration_uid when notify is missing
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/voicemail/voicemail.service.spec.ts#persists notify_dispatch from generated hangup CURL and sets next_notify_at
        status: pass
    human_judgment: false
  - id: D-59
    description: GET /voicemail/play?token= is registered before JWT GET /voicemail/:uniqueid; token play uses VoicemailLinkGuard only
    requirement: D-59
    verification:
      - kind: unit
        ref: packages/backend/src/modules/voicemail/voicemail-link.controller.spec.ts#registers VoicemailLinkController before JWT VoicemailController
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/voicemail/voicemail-link.controller.spec.ts#VoicemailLinkController guard metadata
        status: pass
    human_judgment: false
  - id: D-60
    description: Hangup ingest still does not invoke STT or LLM; first notify can run after accepted without transcription
    requirement: D-60
    verification:
      - kind: unit
        ref: packages/backend/src/modules/voicemail/voicemail.service.spec.ts#persists notify_dispatch from generated hangup CURL and sets next_notify_at
        status: pass
    human_judgment: false
  - id: D-54
    description: ActionType string stays voicemail; emitVoicemailDialplan still calls buildCurlCall('voicemail')
    requirement: D-54
    verification:
      - kind: unit
        ref: packages/backend/src/shared/utils/dialplan.util.spec.ts#voicemail D-55
        status: pass
      - kind: unit
        ref: packages/backend/src/shared/utils/dialplan.util.spec.ts#voicemail D-62 hangup notify fields
        status: pass
    human_judgment: false
  - id: D-63
    description: stt_engine_uid / llm_provider_uid on the step are forwarded on the ingest body and stored on the notify_dispatch snapshot the scanner reads before tenant default
    requirement: D-63
    verification:
      - kind: unit
        ref: packages/backend/src/shared/utils/dialplan.util.spec.ts#stamps notify and step engine uids onto the hangup-handler CURL
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/voicemail/voicemail.service.spec.ts#persists notify_dispatch from generated hangup CURL and sets next_notify_at
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/voicemail/voicemail-scanner.service.spec.ts#uses stt_engine_uid from notify_dispatch before tenant default (D-63)
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-09-03
status: complete
---

# Phase 13 Plan 13: Hangup notify + token play gap Summary

**Hangup CURL now carries Sheet notify + step STT/LLM uids into ingest `notify_dispatch`; token play is registered before JWT `:uniqueid`**

## Performance

- **Duration:** 6 min (verify + SUMMARY only; production code already in --fix)
- **Started:** 2026-09-03T05:54:05Z
- **Completed:** 2026-09-03T06:00:00Z
- **Tasks:** 3
- **Files modified:** 10 (in prior --fix commits; this close-out adds SUMMARY + ROADMAP tick)

## Accomplishments
- `emitVoicemailDialplan` stamps sanitized `notify.integration_uid` / body / target / subject and `stt_engine_uid` / `llm_provider_uid` onto the hangup-handler CURL after `krsk-vm-done` (D-62 / D-63)
- Ingest of a generator-derived body persists `notify_dispatch` JSON and sets `next_notify_at = now` when an integration uid is present so `sendFirstNotify` / scanner `retryNotify` have a snapshot
- Hangup ingest still does not call STT or LLM (D-60); ActionType string remains `voicemail` (D-54)
- `VoicemailModule` controllers are `[VoicemailDialplanController, VoicemailLinkController, VoicemailController]` so minted `/api/voicemail/play?token=` hits `VoicemailLinkGuard` instead of JWT `:uniqueid` (CR-01 / D-59)

## Task Commits

Implementation landed in `/gsd-code-review --fix` before this executor ran. This close-out did not rewrite those commits and did not start a new RED/GREEN cycle (verify was already green).

1. **Tasks 1–2: URIENCODE notify and engine uids on hangup CURL** - `99b7bd3` (fix) — CR-02 / D-62 / D-63
2. **Task 3: Token play route before JWT :uniqueid** - `a6a4aba` (fix) — CR-01 / D-59

**Plan metadata:** pending docs commit

_Note: TDD RED/GREEN were combined inside the --fix commits rather than separate `test(13-13)` / `feat(13-13)` commits._

## Files Created/Modified
- `packages/backend/src/shared/utils/dialplan.util.ts` - hangup CURL notify + engine uid payload
- `packages/backend/src/shared/utils/dialplan.util.spec.ts` - D-62 hangup notify field its
- `packages/backend/src/shared/utils/dialplan-curl.util.ts` - nested URIENCODE(${VAR}) balance so D-62 decode works
- `packages/backend/src/modules/voicemail/voicemail.service.ts` - ingest snapshot + next_notify_at
- `packages/backend/src/modules/voicemail/voicemail.service.spec.ts` - generator-derived ingest persist it
- `packages/backend/src/modules/voicemail/voicemail-scanner.service.ts` - resolveEngine / pickLlm read step uids from snapshot
- `packages/backend/src/modules/voicemail/voicemail.module.ts` - LinkController before JWT controller
- `packages/backend/src/modules/voicemail/voicemail-link.controller.spec.ts` - registration-order it

## Decisions Made
- Close 13-13 by verifying the --fix commits rather than re-implementing (orchestrator instruction)
- Keep `mintPlayToken` URL `/api/voicemail/play?token=` — reorder controllers instead of a new public prefix
- Store step STT/LLM uids in existing `notify_dispatch` TEXT — no migrate
- `extractCurlInvocation` balances nested `URIENCODE(${VAR})` so decoded hangup bodies match what Asterisk would POST

## Deviations from Plan

### Process

**1. Implementation arrived via code-review --fix, not this plan's per-task TDD commits**
- **Found during:** Executor start (wave 8)
- **Issue:** Tasks 1–3 were already true in HEAD (`99b7bd3`, `a6a4aba`) from `/gsd-code-review --fix`
- **Fix:** Confirmed source + specs; ran plan verify commands; wrote SUMMARY only. No extra code commits.
- **Files modified:** none in this executor session (production files unchanged)
- **Verification:** three plan verify commands all passed (see Self-Check)
- **Committed in:** `99b7bd3`, `a6a4aba` (prior --fix)

---

**Total deviations:** 1 process (no Rules 1–3 code auto-fixes)
**Impact on plan:** Goal met; commit graph differs from planned RED then GREEN task commits.

## Issues Encountered
None — verify was green on first run.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 13 plans 13-01…13-13 all have SUMMARYs after this close-out
- Ready for `/gsd-verify-work 13` then `/gsd-secure-phase 13`
- REVIEW warnings CR-03…CR-06 remain out of this plan

## TDD Gate Compliance
- Plan frontmatter is `type: execute` (not `type: tdd`); tasks had `tdd="true"` but production work was already committed
- RED+GREEN for Tasks 1–2: combined in `99b7bd3` `fix(13): CR-02 URIENCODE notify and engine uids on hangup CURL`
- RED+GREEN for Task 3: combined in `a6a4aba` `fix(13): CR-01 register token play route before JWT :uniqueid`
- This executor did not add a new `test(13-13)` / `feat(13-13)` pair because verify was already green

---
*Phase: 13-custom-voicemail-instead-of-voicemail*
*Completed: 2026-09-03*

## Self-Check: PASSED

- FOUND: packages/backend/src/shared/utils/dialplan.util.ts
- FOUND: packages/backend/src/shared/utils/dialplan.util.spec.ts
- FOUND: packages/backend/src/modules/voicemail/voicemail.service.ts
- FOUND: packages/backend/src/modules/voicemail/voicemail-scanner.service.ts
- FOUND: packages/backend/src/modules/voicemail/voicemail.module.ts
- FOUND: packages/backend/src/modules/voicemail/voicemail-link.controller.spec.ts
- FOUND: .planning/phases/13-custom-voicemail-instead-of-voicemail/13-13-SUMMARY.md
- FOUND: 99b7bd3 fix(13): CR-02 URIENCODE notify and engine uids on hangup CURL
- FOUND: a6a4aba fix(13): CR-01 register token play route before JWT :uniqueid
- Verify 1: npm run test -w @krasterisk/backend -- --testPathPattern="dialplan.util" --no-coverage → 4 suites / 220 tests pass
- Verify 2: npm run test -w @krasterisk/backend -- --testPathPattern="dialplan.util|voicemail.service|voicemail-scanner|voicemail-dialplan.controller" --no-coverage → 7 suites / 256 tests pass
- Verify 3: npm run test -w @krasterisk/backend -- --testPathPattern="voicemail-link.controller|voicemail.controller" --no-coverage → 2 suites / 13 tests pass
- Extra code commits this session: none
