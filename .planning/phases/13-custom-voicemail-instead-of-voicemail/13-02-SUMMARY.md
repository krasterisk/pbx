---
phase: 13-custom-voicemail-instead-of-voicemail
plan: 02
subsystem: dialplan
tags: [voicemail, asterisk, record, hangup-handler, d-55, d-72]

requires:
  - phase: 13-custom-voicemail-instead-of-voicemail
    provides: D-55 describe('voicemail D-55') RED contract
provides:
  - D-55 green actionToDialplan voicemail arm (push/Record/k/pop/Goto/Return)
  - D-72 locked Record path on conversation volume under voicemail/
  - IVoicemailParams expansion + shared IVoicemailMessage two-axis types
affects:
  - 13-03 CONDITION_SOURCES + ConditionEditor
  - 13-11 voicemail ingest module
  - 13-04 / 13-05 step UI schema

actuals:
  tokens: 2277
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - Extra [context] sections appended after wrapEachLine so hangup-handler bodies stay unwrapped
    - recordsBasePath static (system_settings inject later, else RECORDS_BASE_PATH, else /usr/records)

key-files:
  created:
    - packages/shared/src/types/voicemail.types.ts
  modified:
    - packages/shared/src/types/dialplan-params.types.ts
    - packages/shared/src/index.ts
    - packages/backend/src/shared/utils/dialplan.util.ts

key-decisions:
  - "D-72: proceed-locked-path — {records_base_path}/{vpbx_user_uid}/voicemail/{UNIQUEID}-%d.wav"
  - "ActionType string stays voicemail (D-54); VoiceMail() emission removed"
  - "IVoicemailMessage uses notify_status and transcript_status as separate fields"

patterns-established:
  - "Pattern: wrapStepKeepExtraContext — condition/time-group wrap stops at the first [context] header"
  - "Pattern: voicemail hangup handler is [krsk-vm-done-{uid}] ending in buildCurlCall('voicemail') + Return()"

requirements-completed: [D-54, D-55, D-72]

coverage:
  - id: D1
    description: D-55 voicemail generator arm is green (push before Record, k in options, pop before Goto, handler Return, wav path)
    requirement: D-55
    verification:
      - kind: unit
        ref: packages/backend/src/shared/utils/dialplan.util.spec.ts#voicemail D-55
        status: pass
    human_judgment: false
  - id: D2
    description: Record path uses locked D-72 prefix under {base}/{uid}/voicemail/ and ends .wav
    requirement: D-72
    verification:
      - kind: unit
        ref: packages/backend/src/shared/utils/dialplan.util.spec.ts#pushes hangup handler before Record, keeps k, pops before Goto, and emits wav path
        status: pass
    human_judgment: false
  - id: D3
    description: IVoicemailMessage exported from @krasterisk/shared with notify_status and transcript_status as separate fields
    requirement: D-54
    verification:
      - kind: other
        ref: "git grep -F \"export interface IVoicemailMessage\" -- packages/shared/src/types/voicemail.types.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: D-72 blocking-human checkpoint recorded as proceed-locked-path; generator task ran
    requirement: D-72
    verification: []
    human_judgment: true
    rationale: Checkpoint choice is a human decision already collected by the orchestrator (user_response proceed-locked-path)

duration: 12min
completed: 2026-09-03
status: complete
---

# Phase 13 Plan 02: D-55 generator arm + D-72 path Summary

**Replaced mailbox `VoiceMail()` with a D-55 hangup-handler Record() arm on the locked D-72 `{records_base_path}/{uid}/voicemail/` wav path, and shipped two-axis `IVoicemailMessage` types**

## Performance

- **Duration:** 12 min
- **Started:** 2026-09-03T01:17:00Z
- **Completed:** 2026-09-03T01:29:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- D-72 checkpoint resolved as **proceed-locked-path** (user; blocking-human). Generator task ran after that choice.
- `actionToDialplan('voicemail')` now emits optional greeting `Playback` → `hangup_handler_push` → `Record(…/voicemail/${UNIQUEID}-%d.wav,…,k…)` → `hangup_handler_pop` → `Goto(krsk-vm-done-{uid})` plus `[krsk-vm-done-{uid}]` with fire-and-forget CURL to `internal/dialplan/voicemail` and `Return()`
- Expanded `IVoicemailParams` (`greeting`, `max_duration` default 120, `silence_timeout`, `record_options` without user `k`, `notify`, `stt_engine_uid`, `llm_provider_uid`) while keeping deprecated `exten`/`target` reads
- Exported `IVoicemailMessage` with `notify_status` and `transcript_status` as separate fields (not a single status)
- `describe('voicemail D-55')` from 13-01 is green without rewriting its assertions

## Task Commits

Each task was committed atomically:

1. **Task 1: Confirm D-72 on-disk path** - (checkpoint; no code commit) — recorded `proceed-locked-path`
2. **Task 2: Green D-55 generator arm + shared voicemail types** - `7057a08` (feat)

**Plan metadata:** (this commit)

_Note: TDD GREEN for the 13-01 RED `test(13-01)` commit `b4ec577`._

## Files Created/Modified
- `packages/shared/src/types/voicemail.types.ts` - NotifyStatus, TranscriptStatus, IVoicemailMessage
- `packages/shared/src/types/dialplan-params.types.ts` - IVoicemailRecordOptions + expanded IVoicemailParams
- `packages/shared/src/index.ts` - re-export voicemail.types
- `packages/backend/src/shared/utils/dialplan.util.ts` - emitVoicemailDialplan + wrapStepKeepExtraContext

## Decisions Made
- **D-72 proceed-locked-path:** on-disk and Record() path is `{records_base_path}/{vpbx_user_uid}/voicemail/{UNIQUEID}-%d.wav` (add-alongside on the conversation volume, one identity). Undo after first ingest is a file+row migration.
- ActionType string stays `voicemail` (D-54). The Asterisk app `VoiceMail()` is gone from the generator.
- `k` is always emitted; it is not a user `record_options` field.
- Base path resolution in the static generator: `AsteriskDialplanUtils.recordsBasePath` (injectable) → `RECORDS_BASE_PATH` → `/usr/records`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Extra `[context]` must not be wrapEachLine'd**
- **Found during:** Task 2 (Green D-55 generator)
- **Issue:** A DIALSTATUS/time-group condition would wrap `[krsk-vm-done-{uid}]` and handler lines in `ExecIf`, breaking the Asterisk context and double-ingest pop contract
- **Fix:** `wrapStepKeepExtraContext` wraps only lines before the first `\n[`; used at the end of `actionToDialplan` and in `renderActionChain`
- **Files modified:** packages/backend/src/shared/utils/dialplan.util.ts
- **Verification:** `npm run test -w @krasterisk/backend -- --testPathPattern=dialplan.util` — 218 passed, including D-55 and balanced-parens voicemail
- **Committed in:** 7057a08 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Required for a correct hangup-handler context when the step has a condition. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
Ready for 13-03 (CONDITION_SOURCES + `record_status`) in the same wave, and later 13-11 ingest. Do not add `migrate-voicemail.ts` or `voicemail.module.ts` until 13-11. Do not implement LLM here.

## TDD Gate Compliance
- RED commit present from 13-01: `test(13-01): add failing test for voicemail D-55 generator order` (`b4ec577`)
- GREEN commit this plan: `feat(13-02): implement D-55 voicemail generator arm` (`7057a08`)
- No REFACTOR commit (implementation stayed minimal)

## Authentication Gates
None

## Known Stubs
None

## Self-Check: PASSED
- FOUND: packages/shared/src/types/voicemail.types.ts
- FOUND: packages/shared/src/types/dialplan-params.types.ts
- FOUND: packages/shared/src/index.ts
- FOUND: packages/backend/src/shared/utils/dialplan.util.ts
- FOUND: 7057a08
- ABSENT (expected): migrate-voicemail.ts, voicemail.module.ts

---
*Phase: 13-custom-voicemail-instead-of-voicemail*
*Completed: 2026-09-03*
