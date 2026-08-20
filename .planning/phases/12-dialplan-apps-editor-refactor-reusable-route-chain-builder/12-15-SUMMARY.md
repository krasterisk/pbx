---
phase: 12-dialplan-apps-editor-refactor-reusable-route-chain-builder
plan: 15
subsystem: dialplan
tags: [call-groups, confirm, skip-busy, DEVICE_STATE, MOH, Dial-options, D-34]

requires:
  - phase: 12-14
    provides: unified group context + dialOpts argument default tT
provides:
  - buildConfirmMacro / confirmOption M() for external members
  - DEVICE_STATE skip-busy filter + all-busy NoOp
  - greeting Playback, MOH m/m(class), per-group dialOptions
  - migrate-call-groups-ring-options.ts (QI-mocked)
  - CallGroupRingOptions UI
affects:
  - 12-16 follow-on
  - 12-17 live UAT M7 confirm + skip busy

tech-stack:
  added: []
  patterns:
    - "t(key, fallback) when ru.ts/en.ts are dirty WIP"
    - "M() via serializeOptions, never string concat"
    - "Live ALTER unit-tested on mock QI; human runs the script"

key-files:
  created:
    - packages/backend/src/modules/call-groups/call-group-confirm.util.ts
    - packages/backend/src/modules/call-groups/call-group-confirm.util.spec.ts
    - packages/backend/src/modules/call-groups/migrate-call-groups-ring-options.ts
    - packages/backend/src/modules/call-groups/migrate-call-groups-ring-options.spec.ts
    - packages/backend/src/modules/call-groups/dto/call-group.dto.spec.ts
    - packages/frontend/src/features/call-groups/ui/CallGroupFormModal/CallGroupRingOptions.tsx
    - packages/frontend/src/features/call-groups/ui/CallGroupFormModal/CallGroupRingOptions.module.scss
    - packages/frontend/src/features/call-groups/ui/CallGroupFormModal/CallGroupRingOptions.test.tsx
  modified:
    - packages/backend/src/modules/call-groups/call-group-dialplan.util.ts
    - packages/backend/src/modules/call-groups/call-group-dialplan.util.spec.ts
    - packages/backend/src/modules/call-groups/call-group.model.ts
    - packages/backend/src/modules/call-groups/dto/call-group.dto.ts
    - packages/backend/src/modules/call-groups/call-groups.service.ts
    - packages/shared/src/types/call-group.types.ts
    - packages/frontend/src/features/call-groups/ui/CallGroupFormModal/CallGroupFormModal.tsx
    - packages/frontend/src/shared/api/endpoints/callGroupApi.ts

key-decisions:
  - "external = member_type === 'external' (same as memberInterface LOCAL/ vs PJSIP/)"
  - "Live ALTER not run — unit tests mock QueryInterface; human must run the script"
  - "t(key, fallback) — dirty locale files not staged"
  - "mixed ringall: M() on the combined Dial when any external is present (Asterisk Dial options are per-call, not per-leg)"

patterns-established:
  - "confirmOption → serializeOptions → Dial() options"
  - "skipBusy builds KRSK_CG_TARGETS once; empty list → diagnostic NoOp, not Dial(,)"

requirements-completed: [D-34]

coverage:
  - id: D1
    description: confirm macro + M() only on Dial lines that include external members; internals-only has no M(
    requirement: D-34
    verification:
      - kind: unit
        ref: packages/backend/src/modules/call-groups/call-group-confirm.util.spec.ts
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/call-groups/call-group-dialplan.util.spec.ts#adds M(confirm)
        status: pass
    human_judgment: false
  - id: D2
    description: DEVICE_STATE filter omits busy internals from Dial() argument; all-busy emits diagnostic NoOp
    requirement: D-34
    verification:
      - kind: unit
        ref: packages/backend/src/modules/call-groups/call-group-dialplan.util.spec.ts#omits a DEVICE_STATE-busy member
        status: pass
    human_judgment: false
  - id: D3
    description: greeting Playback before Dial; MOH m/m(class); default dialOptions tT matches 12-01 baseline
    requirement: D-34
    verification:
      - kind: unit
        ref: packages/backend/src/modules/call-groups/call-group-dialplan.util.spec.ts#plays greetingPrompt
        status: pass
    human_judgment: false
  - id: D4
    description: DTO rejects unclosed dialOptions and path-like greetingPrompt/mohClass
    requirement: D-34
    verification:
      - kind: unit
        ref: packages/backend/src/modules/call-groups/call-group.dto.spec.ts
        status: pass
    human_judgment: false
  - id: D5
    description: idempotent ring-options migration with defaults equivalent to current behaviour
    requirement: D-34
    verification:
      - kind: unit
        ref: packages/backend/src/modules/call-groups/migrate-call-groups-ring-options.spec.ts
        status: pass
    human_judgment: true
    rationale: Live ALTER against MySQL was not run (same as 12-14). Human must execute migrate-call-groups-ring-options.ts twice on the target DB.
  - id: D6
    description: CallGroupRingOptions exposes confirm/skip/greeting/MOH/Dial options with catalog states
    requirement: D-34
    verification:
      - kind: unit
        ref: packages/frontend/src/features/call-groups/ui/CallGroupFormModal/CallGroupRingOptions.test.tsx
        status: pass
    human_judgment: false

duration: 21min
completed: 2026-08-20
status: complete
---

# Phase 12 Plan 15: Ring Group options Summary

**Call groups reach FreePBX Ring Group level: external confirm via Dial `M(macro)`, skip-busy via `${DEVICE_STATE()}`, greeting Playback, MOH instead of ringback, and per-group Dial options defaulting to `tT`.**

## Performance

- **Duration:** 21 min
- **Started:** 2026-08-20T02:41:21Z
- **Completed:** 2026-08-20T03:02:00Z
- **Tasks:** 3 (all TDD RED/GREEN)
- **Files modified:** 16

## Accomplishments

- External members can be required to press a digit before the group treats the call as answered. Operator voicemail no longer "answers" for the group.
- Busy internals are filtered with `${DEVICE_STATE(PJSIP/e{ext}_{vpbx})}` before `Dial()`. An empty list emits `NoOp(Call group: all members busy)` instead of `Dial(,)`.
- Per-group greeting (`emitPlayback` plain), MOH `m` / `m(class)`, and `dialOptions` (default `tT`). Existing groups keep the 12-01 baseline when flags stay off.
- Form exposes all five settings. Confirm hint states the reason. MOH class stays visible but disabled until the toggle is on. Invalid Dial options block save.

## External member definition

`member.member_type === 'external'` — the same flag `memberInterface` already uses to emit `LOCAL/{num}@{ctx}` instead of `PJSIP/e{ext}_{vpbx}`. Internals never get `M()`.

## Characterization expectations changed

None of the four 12-01 strategy baselines changed when `confirmExternal` and `skipBusy` are off and `dialOptions` is omitted (still `tT`). New lines appear only when the new flags are on.

## Task Commits

1. **Task 1 RED: confirm + skip-busy tests** - `0506178` (test)
2. **Task 1 GREEN: confirm macro + DEVICE_STATE filter** - `aa6442a` (feat)
3. **Task 2 RED: greeting/MOH/DTO/migrate tests** - `7d1db96` (test)
4. **Task 2 GREEN: fields, migrate, generator** - `0b2484a` (feat)
5. **Task 3 RED: ring options UI tests** - `693990f` (test)
6. **Task 3 GREEN: CallGroupRingOptions + form wiring** - `d581c79` (feat)

**Plan metadata:** (this file)

## Files Created/Modified

- `packages/backend/src/modules/call-groups/call-group-confirm.util.ts` — `buildConfirmMacro`, `confirmOption`
- `packages/backend/src/modules/call-groups/call-group-dialplan.util.ts` — confirm, skip-busy, greeting, MOH
- `packages/backend/src/modules/call-groups/migrate-call-groups-ring-options.ts` — idempotent ALTER
- `packages/backend/src/modules/call-groups/call-group.model.ts` / DTO / shared types — six new fields
- `packages/frontend/.../CallGroupRingOptions.tsx` — form section
- `packages/frontend/src/shared/api/endpoints/callGroupApi.ts` — create/update payload fields

## Decisions Made

- **external** is `member_type === 'external'`.
- Live MySQL ALTER is not run here (12-14 precedent + orchestrator note). Human runs `npx ts-node packages/backend/src/modules/call-groups/migrate-call-groups-ring-options.ts` twice.
- Mixed `ringall`: `M()` is attached to the combined `Dial()` when any external is present. Asterisk options are per-call, not per-leg; hunt applies `M()` only on the external step.
- Locales stay unstaged; UI uses `t(key, fallback)`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Apply confirm macro as an extra category**
- **Found during:** Task 1
- **Issue:** `M(name)` does nothing unless `[macro-name]` is written to the groups file. `applyCategories` uses `category.name` and strips `[` headers, so the macro cannot live inside the group category.
- **Fix:** `generateGroupDialplan` returns `extras`; service applies `[category, ...extras]`.
- **Files modified:** `call-group-dialplan.util.ts`, `call-groups.service.ts`
- **Committed in:** `aa6442a`

**2. [Rule 3 - Blocking] Live migrate verify replaced with mocked QI**
- **Found during:** Task 2
- **Issue:** Plan verify ran the script against live MySQL. 12-14 ALTER may still be unrun; orchestrator forbade blocking on live DB.
- **Fix:** Same pattern as 12-14: `runCallGroupsRingOptionsMigrate` + jest harness. Second run reports columns already exist.
- **Files modified:** `migrate-call-groups-ring-options.ts`, `.spec.ts`
- **Committed in:** `0b2484a`

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 blocking)
**Impact on plan:** Required for the confirm macro to actually run and to avoid touching live MySQL. No scope creep.

## Issues Encountered

- npm `--testPathPattern` is swallowed as an npm config on this workspace; jest was invoked via `npx jest` in `packages/backend`.
- Form tests needed a `ResizeObserver` stub for Radix Switch.

## User Setup Required

Human must run on the target DB (after 12-14 exten migrate if that is still pending):

```
npx ts-node packages/backend/src/modules/call-groups/migrate-call-groups-ring-options.ts
npx ts-node packages/backend/src/modules/call-groups/migrate-call-groups-ring-options.ts
```

Second run should print that columns already exist (exit 0). Live confirm on a real mobile number is plan 12-17 (M7).

## Next Phase Readiness

- 12-16 can proceed. D-34 generator + UI are in place.
- Do not block 12-16 on the live ALTER; 12-17 UAT M7 needs the columns on the live DB.

## Threat Flags

None beyond the plan register. `dialOptions` is validated with `parseOptions` + balanced parens; `greetingPrompt` / `mohClass` are identifier-only; `DEVICE_STATE` arguments are tenant-scoped `PJSIP/e{ext}_{vpbx}`.

## Self-Check: PASSED
