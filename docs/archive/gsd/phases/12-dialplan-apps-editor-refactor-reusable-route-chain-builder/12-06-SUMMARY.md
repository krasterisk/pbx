---
phase: 12-dialplan-apps-editor-refactor-reusable-route-chain-builder
plan: 06
subsystem: dialplan-generator
tags: [ConditionSource, QUEUESTATUS, __KRSK_HOPS, findUnreachableSteps, digit-exit]

requires:
  - phase: 12-05
    provides: wrapEachLine / buildConditionExpr / Congestion() generator branch
  - phase: 12-03
    provides: ACTION_PARAM_DTO registry form; DIALPLAN_ACTION_META.terminal
  - phase: 12-01
    provides: Wave 0 DIALSTATUS characterization goldens (kept)
provides:
  - ConditionSource discriminated union + per-source value tables in packages/shared
  - buildConditionExpr switch on five D-22 sources with exhaustiveness
  - RouteConditionDto registry rejecting QUEUESTATUS=NOANSWER and injected variable names
  - __KRSK_HOPS inherited hop counter via emitHopPrologue on toroute/toivr
  - findUnreachableSteps + emitDigitExitTransition (D-53 mechanic for 12-10)
affects:
  - 12-08 ConditionsEditor presets (QUEUESTATUS_VALUES / DIALSTATUS_VALUES)
  - 12-10 unified Playback digit-exit
  - 12-16 HTTP action must write HTTP_RESULT_VAR

tech-stack:
  added: []
  patterns:
    - "CONDITION_SOURCE_DTO registry by source (same form as ACTION_PARAM_DTO)"
    - "emitHopPrologue = increment + guard in one emission; inherited __ var"
    - "findUnreachableSteps cuts only on terminal=always; conditional does not"

key-files:
  created:
    - packages/shared/src/types/dialplan-condition.types.ts
    - packages/backend/src/modules/routes/dto/route-condition.dto.ts
    - packages/backend/src/modules/routes/dto/route-condition.dto.spec.ts
    - packages/backend/src/shared/utils/dialplan-hops.util.ts
    - packages/backend/src/shared/utils/dialplan-hops.util.spec.ts
  modified:
    - packages/shared/src/index.ts
    - packages/shared/src/types/route.types.ts
    - packages/backend/src/shared/utils/dialplan-condition.util.ts
    - packages/backend/src/shared/utils/dialplan-condition.util.spec.ts
    - packages/backend/src/modules/routes/dto/route-action.dto.ts
    - packages/backend/src/shared/utils/dialplan.util.ts
    - packages/backend/src/shared/utils/dialplan.util.spec.ts

key-decisions:
  - "DEFAULT_HOP_LIMIT=10 — above any meaningful route/IVR chain (2–4 hops), below Asterisk tight-Goto CPU pain"
  - "HTTP_RESULT_VAR=KRSK_HTTP_RESULT — single name for D-22 http_result and D-47 (12-16)"
  - "DIALSTATUS_VALUES keeps the full 9-value Asterisk set so 12-01 goldens and saved routes stay valid"
  - "No tenant key routes.hop_limit — constant only, so the guard works without settings UI"
  - "Hop increment uses $[${__KRSK_HOPS} + 1] (empty=0), not an empty-string compare"

patterns-established:
  - "Pattern: one value table in shared for generator + DTO + UI presets"
  - "Pattern: emitHopPrologue wraps the real Goto as GotoIf(hops<=limit?dest); exceed falls through to NoOp+Congestion"

requirements-completed: [D-22, D-25, D-53]

coverage:
  - id: D1
    description: Five ConditionSource kinds emit nonempty expressions; DIALSTATUS regression matches legacy
    requirement: D-22
    verification:
      - kind: unit
        ref: packages/backend/src/shared/utils/dialplan-condition.util.spec.ts#source dialstatus matches the legacy DIALSTATUS expression
        status: pass
    human_judgment: false
  - id: D2
    description: QUEUESTATUS=NOANSWER rejected; FULL accepted; injected variable names rejected
    requirement: D-22
    verification:
      - kind: unit
        ref: packages/backend/src/modules/routes/dto/route-condition.dto.spec.ts#accepts QUEUESTATUS FULL and rejects DIALSTATUS value NOANSWER
        status: pass
    human_judgment: false
  - id: D3
    description: toroute/toivr emit Set(__KRSK_HOPS) and guard in one branch; limit+1 exceeds
    requirement: D-25
    verification:
      - kind: unit
        ref: packages/backend/src/shared/utils/dialplan-hops.util.spec.ts#simulates a chain of limit hops then exceeds on limit+1
        status: pass
    human_judgment: false
  - id: D4
    description: findUnreachableSteps returns [2,3] after hangup; digit-exit playback does not cut the tail
    requirement: D-53
    verification:
      - kind: unit
        ref: packages/backend/src/shared/utils/dialplan.util.spec.ts#marks steps after an always-terminal hangup as unreachable
        status: pass
    human_judgment: false

duration: 30min
completed: 2026-08-19
status: complete
---

# Phase 12 Plan 06: ConditionSource, hops, unreachable tail Summary

**Step conditions expand beyond DIALSTATUS via a shared ConditionSource union; toroute/toivr inherit `__KRSK_HOPS` with a 10-hop Congestion() guard; digit-exit is a GotoIf and does not false-flag the chain tail.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-08-19T08:25:00Z
- **Completed:** 2026-08-19T08:55:00Z
- **Tasks:** 3/3 (TDD RED/GREEN each)
- **Files modified:** 13 (locales left unstaged)

## Accomplishments

- `ConditionSource` covers `dialstatus | queuestatus | device_state | variable | http_result`; `QUEUESTATUS_VALUES` is exactly the D-22 five
- DTO registry rejects `{ source: 'queuestatus', values: ['NOANSWER'] }` and `{ source: 'variable', name: '${EVIL}; exten' }`
- Legacy `{ dialstatus: ... }` still emits the same expression — 12-01 DIALSTATUS goldens unchanged
- `emitHopPrologue` increments `__KRSK_HOPS` and guards in one string; missing var is arithmetic 0
- `findUnreachableSteps` cuts only after `terminal === 'always'`; `emitDigitExitTransition` is GotoIf-only

## Task Commits

1. **Task 1 RED** - `c81f554` — `test(12-06): add failing tests for ConditionSource`
2. **Task 1 GREEN** - `96e07a6` — `feat(12-06): implement ConditionSource and RouteConditionDto`
3. **Task 2 RED** - `e282aec` — `test(12-06): add failing tests for __KRSK_HOPS loop guard`
4. **Task 2 GREEN** - `dee8e05` — `feat(12-06): emit __KRSK_HOPS prologue on toroute/toivr`
5. **Task 3 RED** - `08de5ae` — `test(12-06): add failing tests for unreachable tail and digit-exit`
6. **Task 3 GREEN** - `dd81278` — `feat(12-06): add findUnreachableSteps and digit-exit GotoIf`

## Files Created/Modified

- `packages/shared/src/types/dialplan-condition.types.ts` — ConditionSource, value tables, `HTTP_RESULT_VAR`, `DigitExitParams`
- `packages/backend/src/shared/utils/dialplan-condition.util.ts` — exhaustive `buildFromSource` switch
- `packages/backend/src/modules/routes/dto/route-condition.dto.ts` — `CONDITION_SOURCE_DTO` + `RouteConditionDto`
- `packages/backend/src/shared/utils/dialplan-hops.util.ts` — `HOPS_VAR`, `DEFAULT_HOP_LIMIT=10`, `emitHopPrologue`
- `packages/backend/src/shared/utils/dialplan.util.ts` — hop prologue on toroute/toivr; `findUnreachableSteps`; `emitDigitExitTransition`

## Decisions Made

- **DEFAULT_HOP_LIMIT = 10.** Meaningful IVR/route chains are 2–4 hops; 10 is visibly above that and far below a tight-Goto CPU loop. Not a tenant setting yet so the guard is on even without UI.
- **HTTP_RESULT_VAR = `KRSK_HTTP_RESULT`.** Plan 12-16 must write this exact name; a second name would make `http_result` conditions never fire.
- **DIALSTATUS_VALUES is the full 9-value Asterisk set** (including DONTCALL / TORTURE / INVALIDARGS), not only the six UI presets in the plan text. One table still serves generator + DTO + UI; 12-01 DIALSTATUS expects stay byte-identical.

## Rewritten Wave 0 characterization expects (toroute / toivr only)

12-01 DIALSTATUS expects were **not** rewritten. These five were rewritten because hop-prologue was added (plan-required).

| # | Spec | Why rewritten |
|---|------|----------------|
| 1 | `toivr with filled ivr_uid` | hop-prologue before `ivr_7,start,1` |
| 2 | `toroute with filled context` (D-42) | hop-prologue before `sip-out42,100,1` |
| 3 | `toroute with already-suffixed context` (D-21) | same prologue; dest unchanged |
| 4 | `toroute with registry defaultParams` | hop-prologue before `sip-in42,${EXTEN},1` |
| 5 | `address kinds` IVR exact `toBe('Goto(ivr_7,start,1)')` | now `toContain` the guarded GotoIf |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Asterisk `${}` eaten by JS template literals in hop increment**
- **Found during:** Task 2 GREEN
- **Issue:** `` `Set(${HOPS_VAR}=$[${HOPS_VAR} + 1])` `` interpolated the name but omitted `${}` around the variable, emitting `$[__KRSK_HOPS + 1]` (bare word, counter never reads the channel var)
- **Fix:** `` `$[\${${HOPS_VAR}} + 1]` `` → `Set(__KRSK_HOPS=$[${__KRSK_HOPS} + 1])`
- **Files modified:** `dialplan-hops.util.ts`, `dialplan-hops.util.spec.ts`
- **Verification:** characterization `toBe` matches the `${__KRSK_HOPS}` form
- **Committed in:** `dee8e05`

**2. [Rule 2 - Missing Critical] Digit-exit dest kept commas**
- **Found during:** Task 3 GREEN
- **Issue:** `sanitizeDialplanInput` strips `,` so `ivr_7,start,1` would become `ivr_7start1`
- **Fix:** dest-specific sanitize keeps commas; digits restricted to `0-9*#A-D`
- **Files modified:** `dialplan.util.ts`
- **Committed in:** `dd81278`

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical)
**Impact on plan:** Both required for a working hop counter and a valid Goto dest. No scope creep.

## Issues Encountered

- Full `npm run test:backend` not run — caller constraint: callcenter WIP is red and out of scope. Focused suite: 195 passed (`dialplan-condition|route-condition|route-action.dto|dialplan-hops|dialplan.util`).
- `npm` on this host swallows `--testPathPattern` via `npm run test -w`; used `npx jest --testPathPattern=...` from `packages/backend`.

## Known Stubs

None — no placeholder UI, empty data sources, or TODO/FIXME added in plan files.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 12-08 can import `QUEUESTATUS_VALUES` / `DIALSTATUS_VALUES` for presets
- 12-10 should call `emitDigitExitTransition` from `emitPlayback` mode `menu` and keep `findUnreachableSteps` for Surface H
- 12-16 must persist HTTP results into `HTTP_RESULT_VAR` (`KRSK_HTTP_RESULT`)

## Self-Check: PASSED

- FOUND: packages/shared/src/types/dialplan-condition.types.ts
- FOUND: packages/backend/src/shared/utils/dialplan-hops.util.ts
- FOUND: packages/backend/src/modules/routes/dto/route-condition.dto.ts
- FOUND: commits c81f554, 96e07a6, e282aec, dee8e05, 08de5ae, dd81278

---
*Phase: 12-dialplan-apps-editor-refactor-reusable-route-chain-builder*
*Completed: 2026-08-19*
