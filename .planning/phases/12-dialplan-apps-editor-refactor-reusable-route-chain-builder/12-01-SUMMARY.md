---
phase: 12-dialplan-apps-editor-refactor-reusable-route-chain-builder
plan: 01
subsystem: testing
tags: [dialplan, characterization, jest, actionToDialplan, golden-tests]

requires:
  - phase: 06-dialplan-apps
    provides: actionToDialplan generator, generateGroupDialplan, phonebook binding generator
provides:
  - Wave 0 golden tests for all 29 ActionType case branches
  - Baseline of all 6 production actionToDialplan call-sites
  - D-36 Dial-count and D-37 SHELL-count literals
  - CHARACTERIZED_TYPES completeness gate
affects:
  - 12-02 tracer
  - 12-03 ActionType/DTO invariant
  - 12-05 wrapEachLine / time-group guard
  - 12-13 trunk_carousel linearity and setclid_list SHELL

tech-stack:
  added: []
  patterns:
    - "characterization (Wave 0) describe with exact toBe literals"
    - "characterizes current (defective) behaviour: prefix for Pitfall 3/4"

key-files:
  created:
    - packages/backend/src/modules/phonebooks/phonebook-dialplan.util.spec.ts
    - packages/backend/src/modules/voice-robots/voice-robots.service.spec.ts
  modified:
    - packages/backend/src/shared/utils/dialplan.util.spec.ts
    - packages/backend/src/modules/routes/routes.service.spec.ts
    - packages/backend/src/modules/ivrs/ivrs.service.spec.ts
    - packages/backend/src/modules/call-groups/call-group-dialplan.util.spec.ts

key-decisions:
  - "Wave 0 froze current generator output only — no production files changed"
  - "ActionType (shared) and ActionTypesList (DTO) already match at Wave 0; completeness test is green, not it.failing"
  - "voice-robots.service.ts:444 is max_retries_action and :456 is fallback_action (PLAN.md labels were swapped)"
  - "dialplan.util.ts Wave 0 coverage: 100% stmts/lines, 93.06% branch; all 29 case arms reached"

patterns-established:
  - "Pattern: dump actionToDialplan(action, 42) then paste exact toBe — never guess"
  - "Pattern: defective wrappers marked with characterizes current (defective) behaviour: + JSDoc Pitfall link"

requirements-completed: [D-42, D-43, D-21, D-36, D-37, D-51]

coverage:
  - id: D1
    description: Every ActionType has an exact toBe characterization; all 29 case branches reached
    requirement: D-43
    verification:
      - kind: unit
        ref: packages/backend/src/shared/utils/dialplan.util.spec.ts#characterization (Wave 0)
        status: pass
    human_judgment: false
  - id: D2
    description: Defective multi-line condition wrap and label NoOp()) frozen as defects
    requirement: D-43
    verification:
      - kind: unit
        ref: packages/backend/src/shared/utils/dialplan.util.spec.ts#characterizes current (defective) behaviour
        status: pass
    human_judgment: false
  - id: D3
    description: Empty-target ${EXTEN} output frozen for toqueue/togroup/confbridge/voicemail
    requirement: D-21
    verification:
      - kind: unit
        ref: packages/backend/src/shared/utils/dialplan.util.spec.ts#D-21 baseline
        status: pass
    human_judgment: false
  - id: D4
    description: toroute double-suffix and cmd isAdmin true/false frozen
    requirement: D-42
    verification:
      - kind: unit
        ref: packages/backend/src/shared/utils/dialplan.util.spec.ts#toroute already-suffixed
        status: pass
    human_judgment: false
  - id: D5
    description: trunk_carousel n=5 emits 25 Dial() blocks
    requirement: D-36
    verification:
      - kind: unit
        ref: packages/backend/src/shared/utils/dialplan.util.spec.ts#trunk_carousel with five trunks
        status: pass
    human_judgment: false
  - id: D6
    description: setclid_list emits 2 SHELL() calls
    requirement: D-37
    verification:
      - kind: unit
        ref: packages/backend/src/shared/utils/dialplan.util.spec.ts#setclid_list with filled list_uid
        status: pass
    human_judgment: false
  - id: D7
    description: playprompt Playback and playback Background current output frozen
    requirement: D-51
    verification:
      - kind: unit
        ref: packages/backend/src/shared/utils/dialplan.util.spec.ts#playprompt/playback
        status: pass
    human_judgment: false
  - id: D8
    description: All 6 production call-sites have time-group guard baseline
    verification:
      - kind: unit
        ref: packages/backend/src/modules/routes/routes.service.spec.ts#time_group_uid wrap
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/ivrs/ivrs.service.spec.ts#time_group_uid
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/phonebooks/phonebook-dialplan.util.spec.ts
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/voice-robots/voice-robots.service.spec.ts
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-08-18
status: complete
---

# Phase 12 Plan 01: Wave 0 Characterization Summary

**Golden tests freeze current `actionToDialplan` output for all 29 ActionType case branches plus six production call-sites before any Phase 12 production edit**

## Performance

- **Duration:** 25 min
- **Started:** 2026-08-18T17:48:00Z
- **Completed:** 2026-08-18T18:13:00Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Every `ActionType` has an exact `toBe` characterization; `CHARACTERIZED_TYPES` fails naming the missing type if the manifest drifts
- Defective condition wrap (Pitfall 3) and `label` → `NoOp())` (Pitfall 4) are marked `characterizes current (defective) behaviour:`
- Six call-sites recorded: `routes.service.ts:361` wraps multi-line `dp` with the closing `)` on the last line; IVR / phonebook / three voice-robot sites emit no `ExecIfTime|WT_` guard
- D-36 baseline: `trunk_carousel` with 5 trunks emits **25** `Dial(` blocks; D-37 baseline: `setclid_list` emits **2** `SHELL(` calls

## Task Commits

1. **Task 1: Характеризация 22 непокрытых ветвей `actionToDialplan`** - `acf114b` (test)
2. **Task 2: Baseline на все 6 production-call-site и генератор групп** - `0b3ccd7` (test)
3. **Task 3: Meta-тест полноты характеризации** - `04e404f` (test)

**Plan metadata:** (this commit)

## Files Created/Modified

- `packages/backend/src/shared/utils/dialplan.util.spec.ts` — Wave 0 characterize block + completeness gate (`ACTION_TYPES`, `CHARACTERIZED_TYPES`)
- `packages/backend/src/modules/routes/routes.service.spec.ts` — defective time-group wrap on sendmail; `buildContextName` endsWith
- `packages/backend/src/modules/ivrs/ivrs.service.spec.ts` — missing time-group guard on menu actions
- `packages/backend/src/modules/phonebooks/phonebook-dialplan.util.spec.ts` — binding happy-path `toBe` + missing guard
- `packages/backend/src/modules/voice-robots/voice-robots.service.spec.ts` — three call-site baselines
- `packages/backend/src/modules/call-groups/call-group-dialplan.util.spec.ts` — exact `toBe` per strategy + D-35 Dial count

## Production call-sites (12-05 checklist)

| # | File:line | Guard today | Wave 0 baseline |
|---|-----------|-------------|-----------------|
| 1 | `routes.service.ts:361` | yes — `ExecIf($["${WT_<uid>}"="1"]?<dp>)` | closing `)` on last sendmail line |
| 2 | `ivrs.service.ts:249` | no | `not.toMatch(/ExecIfTime\|WT_/)` |
| 3 | `phonebook-dialplan.util.ts:143` | no | `not.toMatch(/ExecIfTime\|WT_/)` |
| 4 | `voice-robots.service.ts:444` (`max_retries_action`) | no | literal `same => n,Hangup()` |
| 5 | `voice-robots.service.ts:456` (`fallback_action`) | no | literal `same => n,Busy(10)` |
| 6 | `voice-robots.service.ts:479` (`keyword.actions`) | no | literal `same => n,Goto(ivr_7,start,1)` |

PLAN.md labeled 444 as fallback and 456 as max_retries — **source is the opposite**. Tests follow the source.

## Coverage (Wave 0 gate)

- `dialplan.util.ts`: **100% stmts / 100% lines / 93.06% branch / 100% funcs**
- **29 `case` arms** of `actionToDialplan` all reached (gate is set-completeness, not a constant %)
- Remaining branch holes are intra-case alternatives (raw `exten` with `/`, empty `trunk_carousel`, phonebook CID path, etc.) — not missing ActionTypes
- Completeness test names the missing type (`Uncharacterized ActionType(s): hangup` when `hangup` was removed, then restored)

## ActionType / ActionTypesList

Invariant test is **green**. Shared `ActionType` and DTO `ActionTypesList` are the same 29-value set at Wave 0. D-08 in 12-03 still owns keeping them a single source; the test will go red if they drift.

## Decisions Made

- Expectations taken from a live `actionToDialplan(..., 42)` dump with `backendBaseUrl=http://backend.test/api` and `dialplanApiKey=wave0-key`
- Registry `dest: '${EXTEN}'` is sanitized to `EXTEN` (no `${}`); empty dest falls back to literal `${EXTEN}` — both frozen
- Existing `call-group-dialplan.util.spec.ts` (Phase 06) kept; Wave 0 exact `toBe` appended rather than replaced
- Repo-wide `npm run lint` still fails on a pre-existing frontend `preserve-caught-error`; Wave 0 `*.spec.ts` files lint clean

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Restored existing call-group spec instead of overwriting**
- **Found during:** Task 2
- **Issue:** `call-group-dialplan.util.spec.ts` already had 10 Phase-06 tests; a first draft replaced the file
- **Fix:** Restored HEAD content and appended Wave 0 exact `toBe` / Dial-count cases
- **Files modified:** `packages/backend/src/modules/call-groups/call-group-dialplan.util.spec.ts`
- **Verification:** 64 Task-2 specs green including original strategy/sanitization cases
- **Committed in:** `0b3ccd7`

**2. [Rule 2 - Missing Critical] Added intra-case characterization for leftover branches**
- **Found during:** Task 3 coverage
- **Issue:** After 29 case arms were hit, Istanbul still showed holes in `useExten`, empty CID carousel, unknown callerid mode, default unknown type, `U(krsk-on-answer)`
- **Fix:** Extra `toBe` cases in the Wave 0 block (still spec-only)
- **Files modified:** `packages/backend/src/shared/utils/dialplan.util.spec.ts`
- **Verification:** 100% stmts/lines; branch 93.06%
- **Committed in:** `04e404f`

---

**Total deviations:** 2 auto-fixed (1 blocking restore, 1 coverage completeness)
**Impact on plan:** No production changes. Completeness gate stronger than the 29-case minimum.

## Issues Encountered

- `npm run test -w @krasterisk/backend -- --testPathPattern=...` on Windows ignores the pattern (npm config). Targeted runs used `npx jest --testPathPattern=...` from `packages/backend`.
- PLAN.md 444/456 labels for voice-robot call-sites do not match the source; documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Tracer 12-02 can edit production against these goldens
- 12-05 must rewrite every `characterizes current (defective) behaviour:` expectation
- 12-13 compares Dial count 25 → linear and SHELL count 2 → 1

## Self-Check: PASSED

- FOUND: `packages/backend/src/shared/utils/dialplan.util.spec.ts`
- FOUND: `packages/backend/src/modules/phonebooks/phonebook-dialplan.util.spec.ts`
- FOUND: `packages/backend/src/modules/voice-robots/voice-robots.service.spec.ts`
- FOUND: `packages/backend/src/modules/call-groups/call-group-dialplan.util.spec.ts`
- FOUND: `acf114b` Task 1
- FOUND: `0b3ccd7` Task 2
- FOUND: `04e404f` Task 3

---
*Phase: 12-dialplan-apps-editor-refactor-reusable-route-chain-builder*
*Completed: 2026-08-18*
