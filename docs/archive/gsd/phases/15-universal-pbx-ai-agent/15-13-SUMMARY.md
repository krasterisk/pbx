---
phase: 15-universal-pbx-ai-agent
plan: 13
subsystem: api
tags: [call-groups, moh, adapters, d-15, d-18, d-21, d-22, proposals]

requires:
  - phase: 15-universal-pbx-ai-agent
    provides: callTool persist path for proposes tools (15-05)
  - phase: 15-universal-pbx-ai-agent
    provides: Registry-enumerated tenant-isolation suite (15-07)
provides:
  - CallGroupsAiAdapter list/create/membership/delete as proposal-gated tools
  - MohAiAdapter list/describe/assign with metadata-only results
  - Domain skills for call-groups and hold music
affects:
  - 15-15 (cutover inventory stays green; new names are additive)
  - 15-23 (completeness gate sees call-groups and moh domains)

actuals:
  tokens: 13572
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - Membership cards state added and removed sets, not the resulting list
    - Hold-music tools return filenames only; never bytes or fetchable paths
    - New domain names are asserted collision-free against the live handwritten registry

key-files:
  created:
    - packages/backend/src/modules/call-groups/call-groups-ai.adapter.ts
    - packages/backend/src/modules/call-groups/call-groups-ai.adapter.spec.ts
    - packages/backend/src/modules/moh/moh-ai.adapter.ts
    - packages/backend/src/modules/moh/moh-ai.adapter.spec.ts
    - packages/backend/src/skills/call-groups/SKILL.md
    - packages/backend/src/skills/moh/SKILL.md
  modified:
    - packages/backend/src/modules/call-groups/call-groups.module.ts
    - packages/backend/src/modules/moh/moh.module.ts

key-decisions:
  - "Membership summaries name added and removed sets, not the resulting member list"
  - "Hold-music assign binds a queue musiconhold or route options.musiconhold; upload stays out of the write boundary"
  - "New tool names are proven collision-free against the live handwritten registry"

patterns-established:
  - "Pattern: new write domains enrol by OnModuleInit; isolation fixtures live on the domain spec"
  - "Pattern: media domains answer in descriptions — basename only, no paths"

requirements-completed: [D-15, D-18, D-21, D-22]

coverage:
  - id: D1
    description: Call groups are readable and changeable through proposal-gated tools with validated membership (D-15, D-18)
    requirement: D-15
    verification:
      - kind: unit
        ref: packages/backend/src/modules/call-groups/call-groups-ai.adapter.spec.ts#returns the tenant call groups with members and ring strategy
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/call-groups/call-groups-ai.adapter.spec.ts#returns a proposal whose summary names members added and removed
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/call-groups/call-groups-ai.adapter.spec.ts#confirming a membership proposal updates exactly one group for the calling tenant
        status: pass
    human_judgment: false
  - id: D2
    description: A call-group proposal naming a subscriber the tenant does not have is refused before confirm
    requirement: D-18
    verification:
      - kind: unit
        ref: packages/backend/src/modules/call-groups/call-groups-ai.adapter.spec.ts#refuses a membership proposal naming a subscriber that does not exist for the tenant
        status: pass
    human_judgment: false
  - id: D3
    description: Delete call-group is destructive and names routes and menus that ring the group
    requirement: D-18
    verification:
      - kind: unit
        ref: packages/backend/src/modules/call-groups/call-groups-ai.adapter.spec.ts#is destructive and names the routes and menus that ring the group
        status: pass
    human_judgment: false
  - id: D4
    description: Hold music is readable and assignable; tools return no audio content (D-15, D-18)
    requirement: D-15
    verification:
      - kind: unit
        ref: packages/backend/src/modules/moh/moh-ai.adapter.spec.ts#returns tenant hold-music classes with track counts and mode
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/moh/moh-ai.adapter.spec.ts#returns one class with ordered tracks and no audio content or fetchable paths
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/moh/moh-ai.adapter.spec.ts#returns a proposal naming the target, the current class and the new class
        status: pass
    human_judgment: false
  - id: D5
    description: A hold-music proposal referencing a class the tenant does not own is refused by name
    requirement: D-18
    verification:
      - kind: unit
        ref: packages/backend/src/modules/moh/moh-ai.adapter.spec.ts#refuses a class the tenant does not own and names that class
        status: pass
    human_judgment: false
  - id: D6
    description: A caller without the write role gets a denied proposal and no mutation (D-21)
    requirement: D-21
    verification:
      - kind: unit
        ref: packages/backend/src/modules/call-groups/call-groups-ai.adapter.spec.ts#create_call_group denies a read-only role and leaves records untouched
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/moh/moh-ai.adapter.spec.ts#assign_moh_class denies a read-only role and leaves records untouched
        status: pass
    human_judgment: false
  - id: D7
    description: Both domains are tenant-isolated, ignore a forged tenant key, and do not collide in the registry (D-22)
    requirement: D-22
    verification:
      - kind: unit
        ref: packages/backend/src/modules/call-groups/call-groups-ai.adapter.spec.ts#never returns or changes another tenant group or member
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/moh/moh-ai.adapter.spec.ts#never returns another tenant class, file or assignment target
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/call-groups/call-groups-ai.adapter.spec.ts#appears in the registry with unique names that do not shadow existing tools
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/legacy-tool-migration.spec.ts#proves adapter ownership, cross-tenant isolation and forged-key ignore for each registered adapter tool
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-09-04
status: complete
---

# Phase 15 Plan 13: Call groups and hold music adapters Summary

**Call-group and hold-music adapters with proposal-gated writes, membership/class validation, metadata-only MOH results, and per-tool role plus tenant-isolation fixtures**

## Performance

- **Duration:** 12 min
- **Started:** 2026-09-04T12:52:00Z
- **Completed:** 2026-09-04T13:04:00Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- Call groups are listed and changed through `list_call_groups`, `create_call_group`, `update_call_group_members` and `delete_call_group`; mutations set `proposes` and do not write
- Membership cards name added and removed extensions; a missing tenant subscriber is refused by number before confirm
- Delete names routes and menus that ring the group via `RouteReferencesService.findUsage`
- Hold music lists and describes classes with track counts, mode and ordered filenames — no bytes and no fetchable paths
- `assign_moh_class` proposes binding a class to a queue or a route and refuses a class the tenant does not own
- Per-tool READONLY deny, cross-tenant and forged-key fixtures; new names do not shadow the handwritten registry

## Task Commits

Each task was committed atomically (TDD RED → GREEN; Task 3 test-only):

1. **Task 1 RED: call-group membership** - `3c2c72d` (test)
2. **Task 1 GREEN: call-group tools + skill** - `e57b485` (feat)
3. **Task 2 RED: hold-music assign** - `872b241` (test)
4. **Task 2 GREEN: hold-music tools + skill** - `9938e51` (feat)
5. **Task 3: role, isolation, collision** - `5d3f726` (test)

**Plan metadata:** docs commit (SUMMARY + STATE + ROADMAP) follows this file

_Note: TDD tasks have multiple commits (test → feat). Task 3 is fixtures over behavior already landed in Tasks 1–2._

## Files Created/Modified

- `packages/backend/src/modules/call-groups/call-groups-ai.adapter.ts` — list/create/membership/delete, subscriber validation, added/removed summary
- `packages/backend/src/modules/call-groups/call-groups-ai.adapter.spec.ts` — D-15/D-18/D-21/D-22 fixtures
- `packages/backend/src/modules/call-groups/call-groups.module.ts` — registers the adapter
- `packages/backend/src/modules/moh/moh-ai.adapter.ts` — list/describe/assign, class ownership, metadata-only tracks
- `packages/backend/src/modules/moh/moh-ai.adapter.spec.ts` — D-15/D-18/D-21/D-22 fixtures
- `packages/backend/src/modules/moh/moh.module.ts` — registers the adapter; imports queues and routes for assign
- `packages/backend/src/skills/call-groups/SKILL.md` — strategies, group vs queue, numbering
- `packages/backend/src/skills/moh/SKILL.md` — class meaning, play mode, assign-only write boundary

## Decisions Made

- **Membership cards name added and removed sets.** A resulting list hides a dropped member; "adding 205, removing 203" is the decision.
- **Assign binds queue `musiconhold` or route `options.musiconhold`.** Upload stays out of this phase's write boundary.
- **Collision is checked against the live handwritten registry.** These are new domains; 15-07 precedence would not catch a shadowed name.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- PowerShell cannot run bash heredoc commits; used `-F` message files under `.tmp/` (not staged).
- Task 3 TDD RED would have passed immediately: isolation already landed in Tasks 1–2. Fixtures were added as a single `test(15-13)` commit.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `call-groups` and `moh` register at bootstrap; 15-23 completeness can see both domains
- Apply of these tool names is not yet in `PbxAgentDiffService.executePayload` (same as queues/IVR until that dispatcher is extended)
- New names are additive; the eighteen-name inventory stays green

## TDD Gate Compliance

Plan frontmatter is `type: execute` with per-task `tdd="true"`. Tasks 1–2 have `test(15-13)` RED then `feat(15-13)` GREEN. Task 3 is test-only fixtures. Tracer feedback gate re-ran `call-groups-ai.adapter` after Task 1 (10 passed) and continued (`human_verify_mode` default end-of-phase, automated-only verify).

## Verification

```
npm run test -w @krasterisk/backend -- --testPathPattern="call-groups-ai.adapter|moh-ai.adapter|legacy-tool-migration" --no-coverage
```

43 passed.

## Self-Check: PASSED

- FOUND: `packages/backend/src/modules/call-groups/call-groups-ai.adapter.ts`
- FOUND: `packages/backend/src/modules/moh/moh-ai.adapter.ts`
- FOUND: `packages/backend/src/skills/call-groups/SKILL.md`
- FOUND: `packages/backend/src/skills/moh/SKILL.md`
- FOUND: commits `3c2c72d`, `e57b485`, `872b241`, `9938e51`, `5d3f726`

---
*Phase: 15-universal-pbx-ai-agent*
*Completed: 2026-09-04*
