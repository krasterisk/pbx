---
phase: 12-dialplan-apps-editor-refactor-reusable-route-chain-builder
plan: 05
subsystem: dialplan-generator
tags: [wrapEachLine, renderActionChain, normalizeTarget, Congestion, numberManipulation, parseOptions]

requires:
  - phase: 12-03
    provides: congestion ActionType + four registries; per-type params DTOs
  - phase: 12-02
    provides: normalizeTarget + ValueSource
  - phase: 12-01
    provides: Wave 0 characterization goldens
provides:
  - wrapEachLine / buildConditionExpr apply step conditions to every generated line
  - renderActionChain as the only production path for 6 actionToDialplan call-sites
  - Congestion() generator branch and cmd_apply action_logs
  - normalizeTarget on toexten / togroup / toroute; D-26 numberManipulation; D-27 options round-trip
affects:
  - 12-06 unreachable-tail / hop counter
  - 12-07 registry schema (strip/prepend already on trunk-dialing types)
  - 12-10 / 12-13 multiline new actions

tech-stack:
  added: []
  patterns:
    - "wrapEachLine wraps the application, not the same => n, prefix; Goto → GotoIf"
    - "renderActionChain: step condition inner, time-group WT_ expr outer"
    - "cmd apply → ActionLog.create (action_logs), not Nest Logger.debug"

key-files:
  created:
    - packages/backend/src/shared/utils/dialplan-condition.util.ts
    - packages/backend/src/shared/utils/dialplan-condition.util.spec.ts
    - packages/backend/src/shared/utils/dialplan-number.util.ts
    - packages/backend/src/shared/utils/dialplan-number.util.spec.ts
    - packages/backend/src/shared/utils/dialplan-options.util.ts
    - packages/backend/src/shared/utils/dialplan-options.util.spec.ts
  modified:
    - packages/backend/src/shared/utils/dialplan.util.ts
    - packages/backend/src/shared/utils/dialplan.util.spec.ts
    - packages/backend/src/shared/utils/dialplan-target.util.ts
    - packages/backend/src/modules/routes/routes.service.ts
    - packages/backend/src/modules/ivrs/ivrs.service.ts
    - packages/backend/src/modules/phonebooks/phonebook-dialplan.util.ts
    - packages/backend/src/modules/voice-robots/voice-robots.service.ts
    - packages/shared/src/types/dialplan-params.types.ts
    - packages/backend/src/modules/routes/dto/dialplan-params/address.params.dto.ts
    - packages/frontend/src/features/dialplan-apps/model/registry.ts

key-decisions:
  - "cmd_apply writes ActionLog.create (same table as LoggerService.logAction) from the static generator"
  - "toivr stays Goto(ivr_{uid},start,1) without tenant suffix — IVR contexts are not tenant-named"
  - "totrunk dest is a PSTN/ValueSource number, not normalizeTarget('exten') / pjsipDialTarget"
  - "Empty congestion params emit Congestion() with no default timeout"

patterns-established:
  - "Pattern: only wrapEachLine(buildConditionExpr(condition), dp) at the end of actionToDialplan"
  - "Pattern: all hosts call renderActionChain; time_group_uid → WT_{uid} per-line wrap"

requirements-completed: [D-21, D-26, D-27, D-42, D-43]

coverage:
  - id: D1
    description: wrapEachLine applies the step condition to every line of a multiline action
    requirement: D-43
    verification:
      - kind: unit
        ref: packages/backend/src/shared/utils/dialplan-condition.util.spec.ts#wrapEachLine wraps every application
        status: pass
    human_judgment: false
  - id: D2
    description: label emits balanced ExecIf(...?NoOp()); ActionTypesList paren-balance it.each
    requirement: D-43
    verification:
      - kind: unit
        ref: packages/backend/src/shared/utils/dialplan.util.spec.ts#emits balanced parentheses
        status: pass
    human_judgment: false
  - id: D3
    description: congestion emits Congestion(); cmd apply writes action_logs
    requirement: D-42
    verification:
      - kind: unit
        ref: packages/backend/src/shared/utils/dialplan.util.spec.ts#congestion (D-42 generator branch)
        status: pass
    human_judgment: false
  - id: D4
    description: All 6 production call-sites go through renderActionChain; time-group guard on every host
    requirement: D-42
    verification:
      - kind: unit
        ref: packages/backend/src/modules/voice-robots/voice-robots.service.spec.ts#max_retries_action (line 444)
        status: pass
    human_judgment: false
  - id: D5
    description: Address kinds tenant-scoped via normalizeTarget; numberManipulation strip then prepend
    requirement: D-21
    verification:
      - kind: unit
        ref: packages/backend/src/shared/utils/dialplan.util.spec.ts#address kinds tenant-suffix
        status: pass
    human_judgment: false
  - id: D6
    description: parseOptions/serializeOptions round-trip including U() L() and unknown flags
    requirement: D-27
    verification:
      - kind: unit
        ref: packages/backend/src/shared/utils/dialplan-options.util.spec.ts#round-trips
        status: pass
    human_judgment: false

duration: 55min
completed: 2026-08-19
status: complete
---

# Phase 12 Plan 05: Generator core Summary

**wrapEachLine + renderActionChain unify step conditions and time-group guards across all six production hosts; Congestion() lands; address kinds go through normalizeTarget; numberManipulation and option round-trip are shared.**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-08-19T07:32:26Z
- **Completed:** 2026-08-19T08:12:00Z
- **Tasks:** 3/3 (TDD RED/GREEN for Tasks 1–2; Task 3 combined feat)
- **Files modified:** 22 (locales left unstaged)

## Accomplishments

- Step conditions wrap every application line; `Goto`/`GotoIf` stay GotoIf-compatible; empty condition is a byte-identical no-op
- `label` no longer emits `NoOp())`; `it.each(ActionTypesList)` asserts `(` === `)`
- `congestion` emits `Congestion()`; `cmd` with `isAdmin` writes `action_logs` (`cmd_apply` / `dialplan_action`)
- All six production `actionToDialplan` call-sites go through `renderActionChain`
- `numberManipulation` is in shared + address DTOs + registry schema; `applyNumberManipulation` is strip → prepend and throws when strip ≥ length

## Task Commits

1. **Task 1 RED** - `ff96d86` — `test(12-05): add failing test for wrapEachLine, Congestion, and cmd log`
2. **Task 1 GREEN** - `b3cc6cd` — `feat(12-05): implement wrapEachLine, Congestion, and cmd action_logs`
3. **Task 2 RED** - `715573a` — `test(12-05): add failing test for renderActionChain time-group guards`
4. **Task 2 GREEN** - `2cadd8e` — `feat(12-05): route all six call-sites through renderActionChain`
5. **Task 3** - `f7bd715` — `feat(12-05): normalizeTarget on address kinds, numberManipulation, options round-trip`

## Rewritten Wave 0 characterization expects (15)

Each row is a changed `expect` vs 12-01 / 12-03 goldens.

| # | Spec | Why rewritten |
|---|------|----------------|
| 1 | `dialplan.util.spec.ts` congestion | 12-03 froze `NoOp(Unknown action: congestion)`; generator branch now emits `Congestion()` |
| 2 | totrunk DIALTO + Return | Pitfall 3 — `wrapEachLine` now wraps the unwrapped `Return()` |
| 3 | sendmail + dialstatus | Pitfall 3 — all 4 lines wrapped, not only the first Set |
| 4 | label + dialstatus | Pitfall 4 — `NoOp())` → `ExecIf(...?NoOp())` |
| 5 | toexten DIALTO + Return | Pitfall 3 — same as totrunk |
| 6 | notify + dialstatus | Pitfall 3 — all 3 lines wrapped |
| 7 | callerid + dialstatus | Pitfall 3 — both Set lines wrapped |
| 8 | trunk_carousel + dialstatus | Pitfall 3 — every line; `Goto` → `GotoIf` |
| 9 | `routes.service.spec.ts` sendmail + time_group | Pitfall 3 defect #2 — per-line `WT_` wrap, no `?same =>` |
| 10 | `ivrs.service.spec.ts` time_group | Guard appeared where it was absent |
| 11 | `phonebook-dialplan.util.spec.ts` time_group | Guard appeared where it was absent |
| 12 | voice-robots `:444` max_retries | Guard appeared where it was absent |
| 13 | voice-robots `:456` fallback | Guard appeared where it was absent |
| 14 | voice-robots `:479` keywords | Guard appeared where it was absent |
| 15 | toroute already-suffixed context | D-21 — `normalizeTarget` endsWith guard; `sip-out4242` → `sip-out42` |

## Production call-sites (12-01 checklist — all 6 translated)

| # | 12-01 File:line | Status |
|---|-----------------|--------|
| 1 | `routes.service.ts:361` | переведён на `renderActionChain` (`host: 'route'`) |
| 2 | `ivrs.service.ts:249` | переведён на `renderActionChain` (`host: 'ivr'`) |
| 3 | `phonebook-dialplan.util.ts:143` | переведён на `renderActionChain` (`host: 'phonebook'`) |
| 4 | `voice-robots.service.ts:444` (`max_retries_action`) | переведён на `renderActionChain` (`host: 'robot'`) |
| 5 | `voice-robots.service.ts:456` (`fallback_action`) | переведён на `renderActionChain` (`host: 'robot'`) |
| 6 | `voice-robots.service.ts:479` (`keyword.actions`) | переведён на `renderActionChain` (`host: 'robot'`) |

Without a time group, the six 12-01 happy-path `toBe` baselines stay byte-identical.

## Decisions Made

- `cmd_apply` uses `ActionLog.create` from the static generator (same `action_logs` row `LoggerService.logAction` would write). Avoids injecting `LoggerModule` into `RoutesModule` and a static Nest logger.
- `toivr` is **not** passed through `normalizeTarget('context')` — live IVR contexts are `[ivr_{uid}]` without a tenant suffix. Tenant-scoping here would miss the room (Chesterton; contrast D-41 confbridge).
- `totrunk` dest is a dialed number / ValueSource, not `normalizeTarget('exten')` (that would emit `PJSIP/e…` and break PSTN).
- Empty `congestion` params emit `Congestion()` (plan literal), not `Congestion(10)`.
- Registry strip/prepend schema for `totrunk` / `toexten` / `togroup` uses `t(key, fallback)`-ready `labelKey`s; no locale files staged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Correctness] toivr not tenant-suffixed**
- **Found during:** Task 3
- **Issue:** `normalizeTarget('context', ivr_N)` would emit `ivr_N{uid}` but `IvrsService` still writes `[ivr_{uid}]`.
- **Fix:** keep `Goto(ivr_{ivrUid},start,1)`; 12-01 `toBe` stays green.
- **Files modified:** `dialplan.util.ts`
- **Commit:** `f7bd715`

**2. [Rule 2 - Correctness] totrunk dest is not kind exten**
- **Found during:** Task 3
- **Issue:** Plan said `dial` / `totrunk` use `normalizeTarget('exten')`. There is no `dial` ActionType; trunk dest is a PSTN number.
- **Fix:** dest via `resolveValueSource` + `applyNumberManipulation` on fixed values only.
- **Commit:** `f7bd715`

**3. [Rule 3 - Blocking] cmd log without LoggerService DI**
- **Found during:** Task 1
- **Issue:** `actionToDialplan` is static; `RoutesModule` does not import `LoggerModule`.
- **Fix:** `ActionLog.create` fire-and-forget; tests spy the model (plan-allowed).
- **Commit:** `b3cc6cd`

**4. [Rule 2 - Grep scope] routes.service still contains ExecIf**
- **Found during:** Task 2
- **Issue:** Plan prohibition grepped any `ExecIf(` in `routes.service.ts`. Pre-existing blacklist / ORIG* / before_dial guards are unrelated to the defective `${dp}` wrap.
- **Fix:** only the multiline `ExecIf($["${WT_…}"]?${dp})` wrap was removed.
- **Commit:** `2cadd8e`

---

**Total deviations:** 4 auto-fixed (3 correctness/blocking, 1 grep-scope)
**Impact on plan:** Required so IVR/PSTN/logging keep working. No new ActionType. No confbridge tenant-scope.

## Issues Encountered

- `npm run test -w @krasterisk/backend -- --testPathPattern=...` drops jest args on this npm; ran `npx jest --testPathPattern=...` inside `packages/backend`.
- Sibling 12-07 committed `registry.ts` in parallel; strip/prepend schema is present on HEAD (no extra 12-05 registry commit).
- Task 3 was a single `feat` commit (tests + impl together).
- Full `npx jest --no-coverage` in `packages/backend`: 82 passed / 3 failed (8 tests). Failures are pre-existing dirty-tree callcenter WIP (`callcenter-history-writer`, `callcenter-chat`) — out of scope for 12-05 (deviation Rule 1, do not fix). Focused dialplan suites stay green.

## User Setup Required

None.

## Next Phase Readiness

- 12-06 can add hop-counter / unreachable-tail on top of `renderActionChain` and `DIALPLAN_ACTION_META.terminal`.
- Do not start 12-06 from this close-out unless the orchestrator says so.
- `pjsipDialTarget` still concatenates `_${vpbxUserUid}` inside `dialplan.util.ts` (used by `normalizeTarget` kind `exten`). `tolist` still uses `ctx-${vpbxUserUid}`.

## TDD Gate Compliance

- Task 1: RED `ff96d86` then GREEN `b3cc6cd`
- Task 2: RED `715573a` then GREEN `2cadd8e`
- Task 3: combined `feat` `f7bd715` (no separate RED commit)

## Self-Check: PASSED

- SUMMARY written; 5 task commits exist (`ff96d86`, `b3cc6cd`, `715573a`, `2cadd8e`, `f7bd715`).
- Created files exist: `dialplan-condition.util.ts` + spec, `dialplan-number.util.ts` + spec, `dialplan-options.util.ts` + spec.
- Registry `strip`/`prepend` schema present on `totrunk` / `toexten` / `togroup`.
- Focused generator suites green; full backend suite failures are unrelated callcenter WIP.
