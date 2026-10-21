---
phase: 12-dialplan-apps-editor-refactor-reusable-route-chain-builder
plan: 14
subsystem: dialplan
tags: [call-groups, exten, normalizeTarget, callerid, random, D-33, D-35]

requires:
  - phase: 12-13
    provides: per-app generator fixes; ValueSource/normalizeTarget already on togroup
provides:
  - call_groups.exten + unique (vpbx_user_uid, exten)
  - unified context group_{exten}_{uid} via normalizeTarget
  - transitional include of group_{uid}_{vpbx}
  - CALLERID(name) restore before Return()
  - generate-time full shuffle for random
affects:
  - 12-15 per-group Dial options (D-34)
  - 12-17 live UAT of group calls before/after regen

tech-stack:
  added: []
  patterns:
    - "t(key, fallback) when ru.ts/en.ts are dirty WIP"
    - "transitional include => old context name — do not delete in this phase"
    - "cidPrefixOps enter/leave in one function"

key-files:
  created:
    - packages/backend/src/modules/call-groups/migrate-call-groups-exten.ts
    - packages/backend/src/modules/call-groups/migrate-call-groups-exten.spec.ts
  modified:
    - packages/shared/src/types/call-group.types.ts
    - packages/backend/src/modules/call-groups/call-group.model.ts
    - packages/backend/src/modules/call-groups/dto/call-group.dto.ts
    - packages/backend/src/modules/call-groups/call-groups.service.ts
    - packages/backend/src/modules/call-groups/call-groups.service.spec.ts
    - packages/backend/src/modules/call-groups/call-group-dialplan.util.ts
    - packages/backend/src/modules/call-groups/call-group-dialplan.util.spec.ts
    - packages/backend/src/shared/utils/dialplan-target.util.spec.ts
    - packages/frontend/src/features/call-groups/ui/CallGroupFormModal/CallGroupFormModal.tsx
    - packages/frontend/src/features/call-groups/ui/CallGroupFormModal/CallGroupFormModal.test.tsx
    - packages/frontend/src/shared/api/endpoints/callGroupApi.ts

key-decisions:
  - "transitional-include — old group_{uid}_{vpbx} stays resolvable via include =>"
  - "Assigned existing-row exten is 6 + uid padded to 3 (uid 7 → 6007); abort on queue/internal collision"
  - "Live ALTER not run — unit tests mock QueryInterface; human must run the script"
  - "t(key, fallback) — dirty locale files not staged"
  - "random is generate-time Fisher-Yates then first-then-rest; rng injected (no Math.random literal)"

patterns-established:
  - "Group context name only via normalizeTarget('group', src, tenantUid)"
  - "KRSK_CID_NAME save/restore paired in cidPrefixOps"

requirements-completed: [D-33, D-35]

coverage:
  - id: D1
    description: idempotent four-step exten migration with collision abort and unique index
    requirement: D-33
    verification:
      - kind: unit
        ref: packages/backend/src/modules/call-groups/migrate-call-groups-exten.spec.ts#applies all four steps
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/call-groups/migrate-call-groups-exten.spec.ts#second run is a no-op
        status: pass
    human_judgment: true
    rationale: Live ALTER against MySQL was not run (autonomous false). Human must execute migrate-call-groups-exten.ts twice on the target DB.
  - id: D2
    description: context is group_{exten}_{uid}; transitional include of group_{uid}_{vpbx}; no self-include
    requirement: D-33
    verification:
      - kind: unit
        ref: packages/backend/src/modules/call-groups/call-group-dialplan.util.spec.ts#names the context group_{exten}_{uid}
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/call-groups/call-group-dialplan.util.spec.ts#emits include => of the old
        status: pass
    human_judgment: false
  - id: D3
    description: empty togroup params resolve through normalizeTarget route_pattern (group_${EXTEN}_{uid})
    requirement: D-33
    verification:
      - kind: unit
        ref: packages/backend/src/shared/utils/dialplan-target.util.spec.ts#group + route_pattern
        status: pass
      - kind: unit
        ref: packages/backend/src/shared/utils/dialplan.util.spec.ts#togroup with empty params
        status: pass
    human_judgment: false
  - id: D4
    description: CALLERID(name) saved to KRSK_CID_NAME and restored before Return(); absent prefix emits neither
    requirement: D-35
    verification:
      - kind: unit
        ref: packages/backend/src/modules/call-groups/call-group-dialplan.util.spec.ts#saves CALLERID(name) before the prefix
        status: pass
    human_judgment: false
  - id: D5
    description: random shuffles the whole member list; 200-run each-position coverage; single member safe
    requirement: D-35
    verification:
      - kind: unit
        ref: packages/backend/src/modules/call-groups/call-group-dialplan.util.spec.ts#random shuffles the whole list
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-08-20
status: complete
---

# Phase 12 Plan 14: Call-group exten + unified context Summary

**Call groups gain a tenant-unique `exten`, contexts are `group_{exten}_{uid}` with a transitional `include` of the old uid-keyed name, CallerID no longer leaks past `Return()`, and `random` is a full generate-time permutation.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-08-20T02:23:01Z
- **Completed:** 2026-08-20T02:37:18Z
- **Tasks:** 4 (decision + 3 auto; Tasks 2–3 TDD RED/GREEN)
- **Files modified:** 13

## Accomplishments

- `ICallGroup.exten` is required; DTO validates 2–8 digits; form field uses `t(key, fallback)`.
- Idempotent migration: addColumn (nullable) → fill `6`+padded uid → unique index `call_groups_vpbx_exten_uniq` → NOT NULL. Collisions with `queue_table` / `ps_endpoints` abort with a listed conflict.
- Context name is only `normalizeTarget('group', …)`. New context includes `include => group_{uid}_{vpbx}` unless names coincide.
- `cidPrefixOps` both sets and restores `CALLERID(name)` via `KRSK_CID_NAME`.
- `random` Fisher-Yates shuffles the member list (injected `rng`), then emits first-then-rest. `ringall` / `hunt` / `memoryhunt` match the 12-01 baseline when `exten === String(uid)`.

## Task Commits

1. **Checkpoint: transitional-include** — no commit (must_haves / RESEARCH)
2. **Task 1: exten column + migration** - `f701836` (feat)
3. **Task 2 RED: unified context tests** - `2d16a3b` (test)
4. **Task 2 GREEN: normalizeTarget + include** - `5393eb1` (feat)
5. **Task 3 RED: CID restore + shuffle tests** - `dbdc5f5` (test)
6. **Task 3 GREEN: cidPrefixOps + generate-time random** - `e40ecf2` (feat)

**Plan metadata:** (this file)

## Files Created/Modified

- `packages/backend/src/modules/call-groups/migrate-call-groups-exten.ts` — four-step idempotent migrate
- `packages/backend/src/modules/call-groups/migrate-call-groups-exten.spec.ts` — QI-mocked double-run + collision
- `packages/shared/src/types/call-group.types.ts` — required `exten`
- `packages/backend/src/modules/call-groups/call-group.model.ts` — `STRING(8)` column
- `packages/backend/src/modules/call-groups/dto/call-group.dto.ts` — `CALL_GROUP_EXTEN_PATTERN`
- `packages/backend/src/modules/call-groups/call-groups.service.ts` — uniqueness vs group/queue/internal
- `packages/backend/src/modules/call-groups/call-group-dialplan.util.ts` — name, include, CID, shuffle
- `packages/frontend/src/features/call-groups/ui/CallGroupFormModal/CallGroupFormModal.tsx` — required number field
- `packages/frontend/src/shared/api/endpoints/callGroupApi.ts` — create/update `exten`

## Decisions Made

- **transitional-include** (checkpoint:decision, gate=blocking): RESEARCH + plan must_haves. Existing calls keep resolving the old name. **Debt: delete the transitional `include` in a later phase after confirming the old name is unused** (do not leave it forever).
- Existing-row numbers: prefix `6` + `uid` padded to 3 digits (`7` → `6007`, `15` → `6015`). Chosen to stay off typical internals (`1xx`/`1xxx`). Same number in another tenant is not a conflict. Collision with `q{exten}_{vpbx}` or `e{exten}_{vpbx}` fails the fill step with every conflict listed.
- Live MySQL ALTER was **not** executed (plan `autonomous: false`). Repeat `npx ts-node src/modules/call-groups/migrate-call-groups-exten.ts` from `packages/backend` on the target DB; second run must print all four steps already applied.
- Locales not staged; copy via `t('callGroups.exten', 'Номер')` etc.

## Characterization deltas vs 12-01

| Expectation | 12-01 baseline | After 12-14 | Why |
|-------------|----------------|-------------|-----|
| Context name | `group_{uid}_{vpbx}` | `group_{exten}_{uid}` + optional `include => group_{uid}_{vpbx}` | D-33 |
| `DIAL_OPTS` | module const `'tT'` | argument default `'tT'` | unblock 12-15 / D-34 |
| `CALLERID(name)` after Return | leaked prefix (defect) | restored from `KRSK_CID_NAME` | D-35 |
| `random` | Asterisk `RAND` + random-first, tail original order; 10 Dial() for 5 members | generate-time full shuffle, then first-then-rest; 2 Dial() for 5 members | D-35 |
| `ringall` / `hunt` / `memoryhunt` | exact Wave 0 `toBe` | unchanged when `exten` equals `uid` (no include) | D-33/D-35 scope |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Required `exten` on API types and form test**
- **Found during:** Task 1
- **Issue:** `ICreateCallGroup` and the form test would not compile/submit after `exten` became required
- **Fix:** added `exten` to `callGroupApi.ts`; form test fills «Номер»
- **Files modified:** `callGroupApi.ts`, `CallGroupFormModal.test.tsx`
- **Committed in:** `f701836`

**2. [Rule 2 - Missing Critical] Skip self-include when names coincide**
- **Found during:** Task 2
- **Issue:** `exten === String(uid)` would `include` the same context
- **Fix:** emit `include` only when it differs from the new name
- **Committed in:** `5393eb1`

### Intentional skips

**3. Live migrate script not run** — user/plan `autonomous: false`. Covered by mocked QI tests. Human must run the script on the live DB before 12-17 group-call UAT.

**4. `ru.ts` / `en.ts` not staged** — dirty WIP; `t(key, fallback)` per 12-13 pattern.

---

**Total deviations:** 2 auto-fixed (Rule 3, Rule 2) + 2 intentional skips
**Impact on plan:** Live column still absent until the human runs the script. Generator/API/UI are ready.

## Issues Encountered

- `npm run test -w @krasterisk/backend -- --testPathPattern=…` on Windows is eaten by npm; used `npx jest --testPathPattern=…` inside `packages/backend`.
- `CallGroupsService` spec needed `listWebrtcEnabledExtensions` + extra internal `102` after EndpointsService was wired.

## Auth Gates

None.

## Known Stubs

None.

## User Setup Required

Run the migration against the target MySQL (from `packages/backend`):

```
npx ts-node src/modules/call-groups/migrate-call-groups-exten.ts
npx ts-node src/modules/call-groups/migrate-call-groups-exten.ts
```

Second run must print that all four steps are already applied. Then regenerate group dialplan (save a group or apply). Manual in-call check is 12-17.

## Next Phase Readiness

- 12-15 can take per-group Dial options (`dialOpts` is already an argument).
- Do not remove the transitional `include` until old names are confirmed unused.
- Live `exten` backfill is the remaining human step for D-33 data.

---
*Phase: 12-dialplan-apps-editor-refactor-reusable-route-chain-builder*
*Completed: 2026-08-20*

## Self-Check: PASSED
