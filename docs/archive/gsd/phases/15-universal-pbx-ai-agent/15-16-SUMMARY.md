---
phase: 15-universal-pbx-ai-agent
plan: 16
subsystem: api
tags: [mcp, adapters, d-12, d-15, d-22, time-groups, numbers, users]

requires:
  - phase: 15-universal-pbx-ai-agent
    provides: Adapter-over-handwritten precedence and registry-enumerated isolation suite (15-07)
provides:
  - TimeGroupsAiAdapter list and evaluate in the tenant timezone
  - NumbersAiAdapter list and describe with resolved route destination
  - UsersAiAdapter allow-listed portal user reads without secrets
  - Batch spec asserting read-only, secret-free and tenant isolation
affects:
  - 15-19 (diagnostics skill sequences number then schedule)
  - 15-23 (completeness gate sees time-groups, numbers, users)

actuals:
  tokens: 11664
  tasks: 3
  commits: 7

tech-stack:
  added: []
  patterns:
    - Schedule evaluation uses ExecIfTime interval fields in the tenant zone, not the server zone
    - Number describe resolves destination through RoutesService + pickBestAsteriskMatch
    - Portal user output is built from an explicit field allow list

key-files:
  created:
    - packages/backend/src/modules/time-groups/time-groups-ai.adapter.ts
    - packages/backend/src/modules/numbers/numbers-ai.adapter.ts
    - packages/backend/src/modules/users/users-ai.adapter.ts
    - packages/backend/src/modules/ai-platform/read-adapters-schedule-identity.spec.ts
    - packages/backend/src/skills/time-groups/SKILL.md
    - packages/backend/src/skills/numbers/SKILL.md
    - packages/backend/src/skills/users/SKILL.md
  modified:
    - packages/backend/src/modules/time-groups/time-groups.module.ts
    - packages/backend/src/modules/numbers/numbers.module.ts
    - packages/backend/src/modules/users/users.module.ts

key-decisions:
  - "evaluate_time_group answers inside/outside and the next boundary in the tenant timezone"
  - "describe_number names the matching route destination or unrouted; the model does not match patterns"
  - "Portal user fields are an allow list of uid, name, role, last_activity — never a deny list"

patterns-established:
  - "Pattern: read-only batch adapters assert proposes/destructive are absent"
  - "Pattern: secret absence is asserted on the declared output shape, not only fixtures"

requirements-completed: [D-12, D-15, D-22]

coverage:
  - id: D1
    description: Schedules are readable and evaluable in the tenant timezone with no write surface (D-12, D-15)
    requirement: D-15
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/read-adapters-schedule-identity.spec.ts#evaluates a named schedule inside its intervals and names the next boundary
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/read-adapters-schedule-identity.spec.ts#uses the tenant timezone, not the server zone
        status: pass
    human_judgment: false
  - id: D2
    description: Numbers are readable with the resolved route destination; unrouted numbers are named (D-12, D-15)
    requirement: D-15
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/read-adapters-schedule-identity.spec.ts#describes a number with the route and destination it currently reaches
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/read-adapters-schedule-identity.spec.ts#reports an unrouted number as unrouted rather than omitting it
        status: pass
    human_judgment: false
  - id: D3
    description: Portal users expose name, role and activity through an allow list with no secrets (D-15, D-22)
    requirement: D-15
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/read-adapters-schedule-identity.spec.ts#never returns a password hash, token, secret or session identifier
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/read-adapters-schedule-identity.spec.ts#asserts secret absence against the declared output shape, not only fixtures
        status: pass
    human_judgment: false
  - id: D4
    description: None of the three adapters declares a mutating tool (D-15)
    requirement: D-15
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/read-adapters-schedule-identity.spec.ts#declares no mutating tool
        status: pass
    human_judgment: false
  - id: D5
    description: Each domain returns none of another tenant's rows (D-22)
    requirement: D-22
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/read-adapters-schedule-identity.spec.ts#returns none of another tenant schedules
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/read-adapters-schedule-identity.spec.ts#returns none of another tenant numbers
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/read-adapters-schedule-identity.spec.ts#returns none of another tenant users including no aggregate count of them
        status: pass
    human_judgment: false

duration: 16min
completed: 2026-09-04
status: complete
---

# Phase 15 Plan 16: Schedule, number and portal-user read adapters Summary

**Read-only adapters for time groups (evaluate in the tenant zone), numbers (resolved destination or unrouted), and portal users (allow-listed, secret-free)**

## Performance

- **Duration:** 16 min
- **Started:** 2026-09-04T13:02:00Z
- **Completed:** 2026-09-04T13:18:00Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- `list_time_groups` / `evaluate_time_group` answer inside-or-outside and the next boundary in the tenant timezone
- `list_numbers` / `describe_number` resolve the current route destination; a number with no match is `unrouted`
- `list_portal_users` / `describe_portal_user` return only `uid`, `name`, `role`, `last_activity`
- All three domains declare no mutating tool and leak none of another tenant's rows
- Domain skills document timezone-sensitive evaluation, destination resolution, and the role read-only boundary

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1 RED: schedule adapter** - `d12f136` (test)
2. **Task 1 GREEN: list, evaluate, skill** - `92a8025` (feat)
3. **Task 2 RED: number destination** - `58bd6cd` (test)
4. **Task 2 GREEN: list, describe, unrouted, skill** - `52069a2` (feat)
5. **Task 3 RED: portal users** - `f4c8334` (test)
6. **Task 3 GREEN: allow list, skill** - `9cfb346` (feat)

**Plan metadata:** docs commit (SUMMARY + STATE + ROADMAP) follows this file

_Note: TDD tasks have multiple commits (test → feat)._

## Files Created/Modified

- `packages/backend/src/modules/time-groups/time-groups-ai.adapter.ts` — list + evaluate in tenant zone
- `packages/backend/src/modules/time-groups/time-groups.module.ts` — registers the adapter
- `packages/backend/src/modules/numbers/numbers-ai.adapter.ts` — list + describe with route destination
- `packages/backend/src/modules/numbers/numbers.module.ts` — registers the adapter, imports RoutesModule
- `packages/backend/src/modules/users/users-ai.adapter.ts` — allow-listed portal user reads
- `packages/backend/src/modules/users/users.module.ts` — registers the adapter
- `packages/backend/src/modules/ai-platform/read-adapters-schedule-identity.spec.ts` — read-only, secret-free, isolation
- `packages/backend/src/skills/time-groups/SKILL.md` — intervals, holidays, timezone, routing questions
- `packages/backend/src/skills/numbers/SKILL.md` — format, status, describe already resolves
- `packages/backend/src/skills/users/SKILL.md` — roles, describe access, never change it

## Decisions Made

- **Evaluate, do not dump intervals.** `evaluate_time_group` answers inside/outside and the next boundary so the model does not do weekday arithmetic.
- **Tenant zone, not server zone.** Timezone comes from tenant settings (`timezone` / `time_zone`) with `Europe/Moscow` as the default when the key is absent.
- **Destination is one tool call.** `describe_number` uses `RoutesService.findAll` and `pickBestAsteriskMatch`; unrouted is explicit.
- **Allow list, not deny list.** Portal user views are exactly `PORTAL_USER_FIELDS`. Role changes are the wrong shape, not a later write.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Default timezone when tenant settings have no zone key**
- **Found during:** Task 1 GREEN
- **Issue:** No `timezone` key exists in `TENANT_SETTING_KEYS`, and that file was out of plan scope. Evaluation still must not use the server zone.
- **Fix:** Read `timezone` / `time_zone` from `TenantSettingsService.getAll` when present; otherwise `Europe/Moscow`. Tests inject per-tenant zones.
- **Files modified:** `packages/backend/src/modules/time-groups/time-groups-ai.adapter.ts`
- **Verification:** timezone test passes (Moscow evening is outside, same instant in America/New_York is inside)
- **Committed in:** `92a8025`

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Required for T-15-76. No new setting key and no scope creep.

## Issues Encountered

- PowerShell cannot run bash heredoc commits; used `-F` message files under `.tmp/` (not staged).
- Task 3 GREEN needed an absolute `-F` path after the first relative path miss.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Diagnostics (15-19) can sequence number destination then schedule state
- Completeness gate (15-23) will see `time-groups`, `numbers`, `users`
- Writing these domains stays out of this phase's write boundary

## TDD Gate Compliance

Plan frontmatter is `type: execute` with per-task `tdd="true"`. Each task has a `test(15-16)` RED commit followed by a `feat(15-16)` GREEN commit. Tracer feedback gate re-ran `read-adapters-schedule-identity` after Task 1 (7 passed) and continued (`human_verify_mode` default end-of-phase, automated-only verify).

## Verification

```
npm run test -w @krasterisk/backend -- --testPathPattern="read-adapters-schedule-identity|legacy-tool-migration" --no-coverage
```

Task 1: 7 passed. Task 2: 13 passed. Task 3: 33 passed (identity + legacy-tool-migration).

## Self-Check: PASSED

- FOUND: `packages/backend/src/modules/time-groups/time-groups-ai.adapter.ts`
- FOUND: `packages/backend/src/modules/numbers/numbers-ai.adapter.ts`
- FOUND: `packages/backend/src/modules/users/users-ai.adapter.ts`
- FOUND: `packages/backend/src/modules/ai-platform/read-adapters-schedule-identity.spec.ts`
- FOUND: `packages/backend/src/skills/time-groups/SKILL.md`
- FOUND: `packages/backend/src/skills/numbers/SKILL.md`
- FOUND: `packages/backend/src/skills/users/SKILL.md`
- FOUND: commits `d12f136`, `92a8025`, `58bd6cd`, `52069a2`, `f4c8334`, `9cfb346`
