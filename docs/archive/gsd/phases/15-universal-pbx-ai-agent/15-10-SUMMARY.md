---
phase: 15-universal-pbx-ai-agent
plan: 10
subsystem: api
tags: [mcp, adapters, proposals, d-15, d-18, d-21, d-22, d-27, ivrs, queues]

requires:
  - phase: 15-universal-pbx-ai-agent
    provides: callTool persist path for proposes tools (15-05)
  - phase: 15-universal-pbx-ai-agent
    provides: adapter-over-handwritten precedence and registry isolation suite (15-07)
provides:
  - IvrsAiAdapter list/create/update/delete as pending proposals with digit destination checks
  - QueuesAiAdapter list/create/update/delete as pending proposals with overflow and member checks
  - Voice-menu and queue domain skills
affects:
  - 15-11 (routes inherit the same proposal + reference-check shape)
  - 15-15 (six more inventory rows become adapter-served once those adapters are enrolled in the migration spec)

actuals:
  tokens: 16384
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - Update tools set proposes true so call handling is never a silent write
    - Digit and overflow targets are resolved against tenant entities before the proposal is returned
    - Queue name and tenant stay separate arguments; delete cards name feeding routes and menus

key-files:
  created:
    - packages/backend/src/modules/ivrs/ivrs-ai.adapter.ts
    - packages/backend/src/modules/ivrs/ivrs-ai.adapter.spec.ts
    - packages/backend/src/modules/queues/queues-ai.adapter.ts
    - packages/backend/src/modules/queues/queues-ai.adapter.spec.ts
    - packages/backend/src/skills/ivrs/SKILL.md
    - packages/backend/src/skills/queues/SKILL.md
  modified:
    - packages/backend/src/modules/ivrs/ivrs.module.ts
    - packages/backend/src/modules/queues/queues.module.ts

key-decisions:
  - "update_ivr / update_queue set proposes so D-18 treats a routing change as a draft, not a harmless write"
  - "Menu digit targets resolve to a tenant context, extension, queue or other menu before the card is returned"
  - "Queue overflow is Queue.context; members and overflow are checked against the calling tenant only"

patterns-established:
  - "Pattern: update reads the current record so the card shows a genuine before-and-after"
  - "Pattern: missing destination refusal names the digit or overflow target and returns no applyPayload"
  - "Pattern: delete_queue lists feeding route and menu names from RouteReferencesService.findUsage"

requirements-completed: [D-15, D-18, D-21, D-22, D-27]

coverage:
  - id: D1
    description: Updating a voice-menu digit returns a pending proposal with old and new destinations and writes nothing (D-18, D-27)
    requirement: D-18
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ivrs/ivrs-ai.adapter.spec.ts#returns a pending proposal whose summary states the digit, old destination and new one
        status: pass
    human_judgment: false
  - id: D2
    description: A voice-menu digit pointing at a missing tenant destination is refused before confirmation (T-15-43)
    requirement: D-18
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ivrs/ivrs-ai.adapter.spec.ts#refuses a proposal whose new destination does not exist and names the digit and the missing target
        status: pass
    human_judgment: false
  - id: D3
    description: Listing voice menus returns digit maps and does not mutate (D-15)
    requirement: D-15
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ivrs/ivrs-ai.adapter.spec.ts#returns the tenant voice menus with digit maps and does not mutate
        status: pass
    human_judgment: false
  - id: D4
    description: Queue update is proposal-gated with old/new settings; overflow that does not exist is refused (D-18)
    requirement: D-18
    verification:
      - kind: unit
        ref: packages/backend/src/modules/queues/queues-ai.adapter.spec.ts#returns a proposal whose summary names changed settings with old and new values
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/queues/queues-ai.adapter.spec.ts#refuses an overflow destination that does not exist for the tenant
        status: pass
    human_judgment: false
  - id: D5
    description: Queue delete names feeding routes and menus; strategy/membership changes name current agents (T-15-46)
    requirement: D-27
    verification:
      - kind: unit
        ref: packages/backend/src/modules/queues/queues-ai.adapter.spec.ts#is destructive and names the routes and menus that feed the queue
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/queues/queues-ai.adapter.spec.ts#names the queue current member agents when strategy or membership changes
        status: pass
    human_judgment: false
  - id: D6
    description: Each of the six mutating tools denies a read-only confirm and leaves records untouched (D-21)
    requirement: D-21
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ivrs/ivrs-ai.adapter.spec.ts#denies a read-only role and leaves records untouched
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/queues/queues-ai.adapter.spec.ts#denies a read-only role and leaves records untouched
        status: pass
    human_judgment: false
  - id: D7
    description: A call as one tenant never returns or changes another tenant menu or queue; a forged tenant key is ignored (D-22)
    requirement: D-22
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ivrs/ivrs-ai.adapter.spec.ts#never returns or changes another tenant voice menu
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/ivrs/ivrs-ai.adapter.spec.ts#ignores a forged tenant key in tool arguments
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/queues/queues-ai.adapter.spec.ts#never returns or changes another tenant queue
        status: pass
    human_judgment: false
  - id: D8
    description: Migrated names resolve to the adapter handler and the handwritten twin is skipped (D-27)
    requirement: D-27
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ivrs/ivrs-ai.adapter.spec.ts#serves create_ivr, update_ivr and delete_ivr from the adapter and skips the handwritten twin
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/queues/queues-ai.adapter.spec.ts#serves create_queue, update_queue and delete_queue from the adapter and skips the handwritten twin
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-09-04
status: complete
---

# Phase 15 Plan 10: Voice-menu and queue adapters Summary

**Voice-menu and queue mutations are adapter-served proposals with before-and-after cards, tenant destination checks, and skipped handwritten twins**

## Performance

- **Duration:** 12 min
- **Started:** 2026-09-04T12:29:00Z
- **Completed:** 2026-09-04T12:41:00Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- `create_ivr` / `update_ivr` / `delete_ivr` and `create_queue` / `update_queue` / `delete_queue` set `proposes` and return `AgentDiffProposal`
- A menu digit whose target does not exist for the tenant is refused at tool time with the digit and the missing destination named
- Queue overflow and membership are validated against the calling tenant; strategy/membership cards name current agents
- `delete_queue` names inbound routes and menus that feed the queue
- `list_ivrs` and `list_queues` read without mutation
- Per-tool READONLY deny, cross-tenant isolation, forged-key ignore, and adapter-over-handwritten skip

## Task Commits

Each task was committed atomically (TDD RED → GREEN; Task 3 test-only):

1. **Task 1 RED: voice-menu digit proposal** - `7c626f1` (test)
2. **Task 1 GREEN: IVR adapter + destination check** - `9c60936` (feat)
3. **Task 2 RED: queue adapter proposals** - `04252d9` (test)
4. **Task 2 GREEN: queue adapter + overflow check** - `89b1243` (feat)
5. **Task 3: role and tenant fixtures** - `da91448` (test)

**Plan metadata:** docs commit (SUMMARY + STATE + ROADMAP) follows this file

_Note: TDD tasks have multiple commits (test → feat). Task 3 added fixtures on already-green adapters._

## Files Created/Modified

- `packages/backend/src/modules/ivrs/ivrs-ai.adapter.ts` — list/create/update/delete; digit destination validation
- `packages/backend/src/modules/ivrs/ivrs-ai.adapter.spec.ts` — D-15/D-18/D-21/D-22/D-27 fixtures
- `packages/backend/src/modules/ivrs/ivrs.module.ts` — registers the adapter; catalog services for destination checks
- `packages/backend/src/modules/queues/queues-ai.adapter.ts` — list/create/update/delete; overflow and feeder names
- `packages/backend/src/modules/queues/queues-ai.adapter.spec.ts` — D-15/D-18/D-21/D-22/D-27 fixtures
- `packages/backend/src/modules/queues/queues.module.ts` — registers the adapter
- `packages/backend/src/skills/ivrs/SKILL.md` — digit map, destination kinds, `t`/`i`, inbound reach
- `packages/backend/src/skills/queues/SKILL.md` — strategies, timeout/overflow, membership, live state

## Decisions Made

- **Update is always a proposal.** The handwritten `update_ivr` / `update_queue` were non-destructive while rewriting call handling; `proposes: true` is what D-18 removes.
- **Destination check is at proposal time.** A menu digit or queue overflow that does not resolve for the tenant never becomes a card.
- **Queue identity stays name + tenant.** Handlers pass the queue name through and the tenant separately; a forged tenant key in args is ignored.
- **Apply dispatch stays in 15-05's service.** Confirm in these specs applies via the domain service (same as 15-09 adapter specs). `PbxAgentDiffService.executePayload` was out of this plan's `files_modified`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- PowerShell cannot run bash heredoc commits; used `-F` message files under `.tmp/` (not staged).
- Task 3 had no RED implementation gap: role isolation and precedence already held after Tasks 1–2, so the task is a fixture commit.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Six of the eighteen handwritten tools are adapter-served when the domain module is loaded; 15-07 precedence skips the twin
- 15-11 can migrate routes the same way (proposal + reference check)
- Enrolling `IvrsAiAdapter` / `QueuesAiAdapter` in `legacy-tool-migration.spec.ts` will flip those inventory rows to adapter-served (out of this plan's file list)
- `PbxAgentDiffService.executePayload` still needs `create_ivr` / `update_ivr` / `delete_ivr` / `create_queue` / `update_queue` / `delete_queue` cases before a UI confirm writes through apply

## TDD Gate Compliance

Plan frontmatter is `type: execute` with per-task `tdd="true"`. Task 1 and Task 2 each have a `test(15-10)` RED commit followed by a `feat(15-10)` GREEN commit. Task 3 is spec-only (`test(15-10)`) because the handlers already satisfied D-21/D-22. Tracer feedback gate re-ran `ivrs-ai.adapter` after Task 1 (11 passed) and continued.

## Verification

```
npm run test -w @krasterisk/backend -- --testPathPattern="ivrs-ai.adapter|queues-ai.adapter|legacy-tool-migration" --no-coverage
```

48 passed.

## Self-Check: PASSED

- FOUND: `packages/backend/src/modules/ivrs/ivrs-ai.adapter.ts`
- FOUND: `packages/backend/src/modules/queues/queues-ai.adapter.ts`
- FOUND: `packages/backend/src/skills/ivrs/SKILL.md`
- FOUND: `packages/backend/src/skills/queues/SKILL.md`
- FOUND: commits `7c626f1`, `9c60936`, `04252d9`, `89b1243`, `da91448`
