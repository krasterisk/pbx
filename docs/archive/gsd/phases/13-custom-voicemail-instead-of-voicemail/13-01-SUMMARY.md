---
phase: 13-custom-voicemail-instead-of-voicemail
plan: 01
subsystem: dialplan
tags: [voicemail, asterisk, record, riff, tdd]

requires:
  - phase: 12-dialplan-apps-editor-refactor-reusable-route-chain-builder
    provides: D-54 D-55 D-56 locked decisions and Wave 0 mailbox characterization
provides:
  - D-55 describe('voicemail D-55') order+pop+k+wav assertions (RED vs mailbox arm)
  - RECORD_STATUS_VALUES 7-member table including OPERATOR
  - parseWavPcm16 RIFF chunk walker with LIST-before-data coverage
affects:
  - 13-02 generator arm
  - 13-03 CONDITION_SOURCES + ConditionEditor
  - 13-07 scanner STT input

actuals:
  tokens: 2688
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - Wave 0 RED generator contract before production dialplan change
    - Shared value table exported without extending CONDITION_SOURCES
    - RIFF chunk walk instead of first-44-bytes WAV slice

key-files:
  created:
    - packages/backend/src/modules/voicemail/wav-pcm.util.ts
    - packages/backend/src/modules/voicemail/wav-pcm.util.spec.ts
  modified:
    - packages/backend/src/shared/utils/dialplan.util.spec.ts
    - packages/shared/src/types/dialplan-condition.types.ts
    - packages/backend/src/shared/utils/dialplan-condition.util.spec.ts

key-decisions:
  - "D-55 specs replace mailbox VoiceMail() goldens; production dialplan.util.ts unchanged"
  - "RECORD_STATUS_VALUES exported next to QUEUESTATUS_VALUES; record_status not added to CONDITION_SOURCES (13-03)"
  - "parseWavPcm16 implemented as 13-RESEARCH chunk walk; sampleRate returned from fmt, not assumed 8000"

patterns-established:
  - "Pattern: generator line-order assertions use indexOf(push) < indexOf(Record() < indexOf(pop) < indexOf(Goto()"
  - "Pattern: shared status tables land in Wave 0 before the condition-source union expands"

requirements-completed: [D-54, D-55, D-56, D-71]

coverage:
  - id: D1
    description: D-55 voicemail generator contract describe exists with push/Record/k/pop/Goto/Return/wav assertions (its stay RED until 13-02)
    requirement: D-55
    verification:
      - kind: other
        ref: "git grep -F \"describe('voicemail D-55')\" -- packages/backend/src/shared/utils/dialplan.util.spec.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: RECORD_STATUS_VALUES is a 7-member table including OPERATOR, exported from packages/shared
    requirement: D-56
    verification:
      - kind: unit
        ref: packages/backend/src/shared/utils/dialplan-condition.util.spec.ts#RECORD_STATUS_VALUES is the D-56 set of 7 including OPERATOR
        status: pass
    human_judgment: false
  - id: D3
    description: parseWavPcm16 walks RIFF chunks; LIST-before-data returns PCM; bits!==16 throws; sampleRate returned
    requirement: D-71
    verification:
      - kind: unit
        ref: packages/backend/src/modules/voicemail/wav-pcm.util.spec.ts#parseWavPcm16 (D-71)
        status: pass
    human_judgment: false
  - id: D4
    description: Production dialplan.util.ts unchanged; ActionType string stays voicemail
    requirement: D-54
    verification:
      - kind: other
        ref: "git diff --exit-code -- packages/backend/src/shared/utils/dialplan.util.ts"
        status: pass
    human_judgment: false

duration: 7min
completed: 2026-09-02
status: complete
---

# Phase 13 Plan 01: Wave 0 D-55 specs + RECORD_STATUS + parseWavPcm16 Summary

**Locked the voicemail generator contract as RED D-55 specs, exported the 7-value RECORD_STATUS table, and shipped a RIFF-chunk PCM16 parser**

## Performance

- **Duration:** 7 min
- **Started:** 2026-09-02T16:08:21Z
- **Completed:** 2026-09-02T16:15:21Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Replaced mailbox `VoiceMail()` goldens with `describe('voicemail D-55')` asserting hangup_handler_push before Record(, options contain `k`, hangup_handler_pop after Record( and before Goto(, handler `krsk-vm-done-42` includes Return(), path contains `/voicemail/` and `.wav`, greeting Playback before push
- Exported `RECORD_STATUS_VALUES` / `RecordStatusValue` from `@krasterisk/shared` (DTMF, SILENCE, SKIP, TIMEOUT, HANGUP, ERROR, OPERATOR) without adding `record_status` to `CONDITION_SOURCES`
- Implemented `parseWavPcm16` as a RIFF chunk walk (not first-44-bytes); LIST-before-data, non-16-bit throw, missing data, truncated clamp, sampleRate returned

## Task Commits

Each task was committed atomically:

1. **Task 1: D-55 target specs for the voicemail generator arm** - `b4ec577` (test)
2. **Task 2: RECORD_STATUS_VALUES + parseWavPcm16** - `f20ff70` (feat)

**Plan metadata:** (this commit)

_Note: Task 1 is TDD RED only — generator stays mailbox until 13-02. Task 2 GREEN in one feat commit (table + parser + specs)._

## Files Created/Modified
- `packages/backend/src/shared/utils/dialplan.util.spec.ts` - `describe('voicemail D-55')` replaces two mailbox toBe goldens
- `packages/shared/src/types/dialplan-condition.types.ts` - RECORD_STATUS_VALUES + RecordStatusValue
- `packages/backend/src/shared/utils/dialplan-condition.util.spec.ts` - length-7 + OPERATOR + CONDITION_SOURCES unchanged
- `packages/backend/src/modules/voicemail/wav-pcm.util.ts` - parseWavPcm16 chunk walker
- `packages/backend/src/modules/voicemail/wav-pcm.util.spec.ts` - LIST / bits / sampleRate / clamp / non-RIFF cases

## Decisions Made
- D-55 specs replace mailbox VoiceMail() goldens; production `dialplan.util.ts` unchanged so 13-02 can green the same assertions
- RECORD_STATUS_VALUES exported next to QUEUESTATUS_VALUES; `record_status` not added to CONDITION_SOURCES (13-03 owns the union)
- parseWavPcm16 implemented as the 13-RESEARCH chunk walk; sampleRate comes from `fmt `, not assumed 8000

## Deviations from Plan

None - plan executed exactly as written.

**Total deviations:** 0 auto-fixed
**Impact on plan:** None

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
Ready for 13-02 (green the D-55 describe by replacing the VoiceMail() generator arm). RECORD_STATUS_VALUES and parseWavPcm16 are importable. Do not add `record_status` to CONDITION_SOURCES until 13-03.

## TDD Gate Compliance
- Task 1 RED commit present: `test(13-01): add failing test for voicemail D-55 generator order` (`b4ec577`)
- Task 1 GREEN deferred by plan: production generator must stay unchanged until 13-02
- Task 2 shipped GREEN specs + implementation in `feat(13-01)` (`f20ff70`); no separate RED commit (utilities did not exist)

## Self-Check: PASSED
- FOUND: packages/backend/src/shared/utils/dialplan.util.spec.ts
- FOUND: packages/shared/src/types/dialplan-condition.types.ts
- FOUND: packages/backend/src/modules/voicemail/wav-pcm.util.ts
- FOUND: packages/backend/src/modules/voicemail/wav-pcm.util.spec.ts
- FOUND: b4ec577
- FOUND: f20ff70

---
*Phase: 13-custom-voicemail-instead-of-voicemail*
*Completed: 2026-09-02*
