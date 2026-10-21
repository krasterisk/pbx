---
phase: 15-universal-pbx-ai-agent
plan: 05
subsystem: api
tags: [proposals, d-15, d-18, d-19, d-20, d-21, apply, precedence]

requires:
  - phase: 15-universal-pbx-ai-agent
    provides: AgentDiffProposal type and sanitizeArgs (15-01)
  - phase: 15-universal-pbx-ai-agent
    provides: AgentProposal table and audit thread_uid (15-03)
provides:
  - PbxAgentDiffService create/apply/reject with client-safe views
  - Authenticated apply/reject/pending endpoints under ai-chat/proposals
  - callTool persist path for proposes tools plus live-ops exceptions
  - Five directory write tools return AgentDiffProposal and write only on apply
  - Route precedence check refusing catch-all above specific or emergency
affects:
  - 15-07 (remaining handwritten mutations convert to proposes)
  - 15-08 (chat loop shows confirmation cards from persisted views)
  - 15-22 (evaluation suite drives checkRoutePrecedence directly)

actuals:
  tokens: 12840
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - Client view type omits applyPayload; toProposalView never copies the key
    - callTool persists AgentDiffProposal via createProposal; live-ops names invoke immediately
    - Apply is database then RouteApplyService.applyContext; switch failure leaves pending

key-files:
  created:
    - packages/backend/src/modules/ai-chat/dto/agent-diff.dto.ts
    - packages/backend/src/modules/ai-chat/pbx-agent-diff.service.ts
    - packages/backend/src/modules/ai-chat/pbx-agent-diff.service.spec.ts
    - packages/backend/src/modules/ai-chat/agent-proposals.controller.ts
    - packages/backend/src/modules/ai-chat/agent-proposals.module.ts
    - packages/backend/src/modules/ai-chat/route-precedence.util.ts
    - packages/backend/src/modules/ai-chat/route-precedence.util.spec.ts
  modified:
    - packages/backend/src/app.module.ts
    - packages/backend/src/modules/ai-platform/ai-adapter.types.ts
    - packages/backend/src/modules/mcp/mcp-tools.service.ts
    - packages/backend/src/modules/mcp/mcp-tools.service.spec.ts
    - packages/backend/src/modules/mcp/mcp.module.ts
    - packages/backend/src/modules/directories/directories-ai.adapter.ts
    - packages/backend/src/modules/directories/directories-ai.adapter.spec.ts

key-decisions:
  - "Apply payload is omitted by AgentProposalView type; call sites never delete the key"
  - "callTool persists proposes tools and invokes only cc_force_pause_agent / cc_force_unpause_agent as live-ops"
  - "READONLY apply sets denied plus audit and performs no domain write"
  - "Route apply uses RouteApplyService.applyContext only; switch failure leaves the row pending"
  - "checkRoutePrecedence is Nest-free for 15-22 fixtures"

patterns-established:
  - "Pattern: mutating adapter tools set proposes and return AgentDiffProposal; apply is the only writer"
  - "Pattern: apply where clause is proposal_id + tenant + author + pending (replay-safe)"
  - "Pattern: audit row (action_log 200 chars + cc_ai_audit_log 4000 chars) is written before the apply response"

requirements-completed: [D-15, D-18, D-19, D-20, D-21]

coverage:
  - id: D1
    description: A mutating tool produces a pending proposal and writes nothing to the database (D-18)
    requirement: D-18
    verification:
      - kind: unit
        ref: packages/backend/src/modules/mcp/mcp-tools.service.spec.ts#persists create_directory as a pending proposal and inserts no directory row
        status: pass
    human_judgment: false
  - id: D2
    description: The five directory write tools each produce a pending proposal and write no directory row until apply (D-15, D-18)
    requirement: D-15
    verification:
      - kind: unit
        ref: packages/backend/src/modules/directories/directories-ai.adapter.spec.ts#returns a proposal object and does not write
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/ai-chat/pbx-agent-diff.service.spec.ts#inserts exactly one directory row for the calling tenant
        status: pass
    human_judgment: false
  - id: D3
    description: callTool persists AgentDiffProposal from proposes tools and no longer applies the 15-01 destructive blanket to those names (D-18)
    requirement: D-18
    verification:
      - kind: unit
        ref: packages/backend/src/modules/mcp/mcp-tools.service.spec.ts#persists delete_directory as a pending proposal
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/mcp/mcp-tools.service.spec.ts#still refuses an unconverted destructive name and does not invoke that handler
        status: pass
    human_judgment: false
  - id: D4
    description: A change is applied only through an authenticated endpoint carrying the proposal identifier (D-19)
    requirement: D-19
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-chat/pbx-agent-diff.service.spec.ts#refuses an unknown identifier and mutates nothing
        status: pass
    human_judgment: false
  - id: D5
    description: Applying a route proposal writes the database and reloads the dialplan through RouteApplyService.applyContext (D-20)
    requirement: D-20
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-chat/pbx-agent-diff.service.spec.ts#calls the route apply orchestrator once and sets the row to applied with a timestamp
        status: pass
    human_judgment: false
  - id: D6
    description: A caller whose role cannot perform the change gets a denied proposal and no mutation (D-21)
    requirement: D-21
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-chat/pbx-agent-diff.service.spec.ts#denies a read-only role, writes a denied audit row and performs no domain write
        status: pass
    human_judgment: false
  - id: D7
    description: A proposal that would place a catch-all above a specific or emergency pattern is refused before apply
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-chat/route-precedence.util.spec.ts#reports unsafe when a catch-all sits above a specific numeric pattern
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/ai-chat/pbx-agent-diff.service.spec.ts#refuses an unsafe route proposal, leaves it pending and records the audit
        status: pass
    human_judgment: false
  - id: D8
    description: The stored apply payload never appears in any response body
    requirement: D-18
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-chat/pbx-agent-diff.service.spec.ts#keeps the serialized apply payload out of every returned shape
        status: pass
    human_judgment: false
  - id: D9
    description: cc_force_pause_agent and cc_force_unpause_agent are live-ops exceptions and are not drafts
    requirement: D-18
    verification:
      - kind: unit
        ref: packages/backend/src/modules/mcp/mcp-tools.service.spec.ts#invokes cc_force_pause_agent as a live-ops exception
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/mcp/mcp-tools.service.spec.ts#invokes cc_force_unpause_agent as a live-ops exception
        status: pass
    human_judgment: false

duration: 39min
completed: 2026-09-04
status: complete
---

# Phase 15 Plan 05: Propose-then-apply Summary

**Human-confirmed AgentDiffProposal drafts: callTool persists, apply is the only writer, RouteApplyService is the only dialplan path, READONLY is denied, catch-all-over-specific is refused**

## Performance

- **Duration:** 39 min
- **Started:** 2026-09-04T10:30:00Z
- **Completed:** 2026-09-04T11:09:00Z
- **Tasks:** 3
- **Files modified:** 14

## Accomplishments

- Mutating tools return a pending proposal; apply of that id is the only database write
- Five directory write tools set `proposes` and no longer call create/update/remove
- `callTool` persists `AgentDiffProposal` and keeps the 15-01 refusal only for unconverted destructive names
- `cc_force_pause_agent` / `cc_force_unpause_agent` invoke immediately (live-ops)
- Route apply goes through `RouteApplyService.applyContext`; switch failure leaves the row pending
- READONLY apply sets `denied` plus audit and mutates nothing
- Catch-all above a specific or emergency pattern is refused before write

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1 RED: propose-then-apply** - `666f08a` (test)
2. **Task 1 GREEN: persist and apply** - `acdfbec` (feat)
3. **Task 2 RED: permission and audit** - `d816531` (test)
4. **Task 2 GREEN: deny READONLY, write audit** - `fe69969` (feat)
5. **Task 3 RED: route precedence** - `5c66497` (test)
6. **Task 3 GREEN: refuse unsafe order** - `069940d` (feat)

**Plan metadata:** docs commit (SUMMARY + STATE + ROADMAP) follows this file

_Note: TDD tasks have multiple commits (test → feat)._

## Files Created/Modified

- `packages/backend/src/modules/ai-chat/dto/agent-diff.dto.ts` — validated proposal + client view type
- `packages/backend/src/modules/ai-chat/pbx-agent-diff.service.ts` — create/getPending/apply/reject
- `packages/backend/src/modules/ai-chat/pbx-agent-diff.service.spec.ts` — persist, refusals, audit, precedence
- `packages/backend/src/modules/ai-chat/agent-proposals.controller.ts` — JWT apply/reject/pending
- `packages/backend/src/modules/ai-chat/agent-proposals.module.ts` — isolated module for 15-08
- `packages/backend/src/modules/ai-chat/route-precedence.util.ts` — Nest-free catch-all check
- `packages/backend/src/modules/ai-chat/route-precedence.util.spec.ts` — safe/unsafe fixtures
- `packages/backend/src/modules/mcp/mcp-tools.service.ts` — proposes persist + live-ops
- `packages/backend/src/modules/directories/directories-ai.adapter.ts` — five write tools as drafts
- `packages/backend/src/modules/ai-platform/ai-adapter.types.ts` — optional `proposes`
- `packages/backend/src/app.module.ts` / `mcp.module.ts` — wire AgentProposalsModule

## Decisions Made

- **Client view omits `applyPayload` by type.** `toProposalView` builds a new object; no call site deletes the key.
- **Live-ops scope is exactly two names.** Unconverted destructive tools still refuse.
- **READONLY is the interface-parity deny.** Directories/routes endpoints are JWT-only; a read-only role cannot apply.
- **Switch failure stays pending.** Batched AMI writes cannot roll back; the card can retry.
- **Precedence is a pure function.** 15-22 can import `checkRoutePrecedence` without Nest.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Existing directory adapter tests expected immediate writes**
- **Found during:** Task 1 GREEN
- **Issue:** Tenant-isolation and record-tool specs still asserted `create`/`update` on the five write tools.
- **Fix:** Specs now assert a proposal object and that write methods are not called.
- **Files modified:** `packages/backend/src/modules/directories/directories-ai.adapter.spec.ts`
- **Verification:** directories-ai.adapter suite passed
- **Committed in:** `acdfbec`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Required for the D-18 behavior change. No scope creep. CSV/WIP in other directory files was left unstaged.

## Issues Encountered

- PowerShell cannot run bash heredoc commits; used `-F` message files under `.tmp/` (not staged).
- `directories-ai.adapter.ts` working tree had unrelated lookup-copy WIP; those lines were restored to HEAD before the Task 1 GREEN commit.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 15-07 can mark remaining handwritten mutations `proposes` and return `AgentDiffProposal`
- 15-08 can render confirmation cards from `getPending` / apply/reject
- 15-22 can drive `checkRoutePrecedence` with regression fixtures
- Unconverted destructive tools (`delete_trunk`, `delete_route`, …) still refuse until those adapters convert

## TDD Gate Compliance

Plan frontmatter is `type: execute` with per-task `tdd="true"`. Each task has a `test(15-05)` RED commit followed by a `feat(15-05)` GREEN commit.

## Verification

```
npm run test -w @krasterisk/backend -- --testPathPattern="pbx-agent-diff|route-precedence|mcp-tools|directories-ai.adapter" --no-coverage
```

75 passed.

## Self-Check: PASSED

- FOUND: `packages/backend/src/modules/ai-chat/pbx-agent-diff.service.ts` (`applyContext`, `createProposal`)
- FOUND: `packages/backend/src/modules/ai-chat/agent-proposals.controller.ts`
- FOUND: `packages/backend/src/modules/ai-chat/route-precedence.util.ts`
- FOUND: `packages/backend/src/modules/mcp/mcp-tools.service.ts` (`createProposal`)
- FOUND: `packages/backend/src/modules/directories/directories-ai.adapter.ts` (`proposes`)
- FOUND: commits `666f08a`, `acdfbec`, `d816531`, `fe69969`, `5c66497`, `069940d`

---
*Phase: 15-universal-pbx-ai-agent*
*Completed: 2026-09-04*
