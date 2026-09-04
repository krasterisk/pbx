---
phase: 15-universal-pbx-ai-agent
plan: 11
subsystem: api
tags: [mcp, adapters, proposals, d-15, d-18, d-19, d-20, d-22, d-27, routes, dialplan]

requires:
  - phase: 15-universal-pbx-ai-agent
    provides: Propose-then-apply, RouteApplyService.applyContext, checkRoutePrecedence (15-05)
  - phase: 15-universal-pbx-ai-agent
    provides: Adapter-over-handwritten skip and apply_dialplan inventoried as retired (15-07)
provides:
  - RoutesAiAdapter list/describe/create/delete with typed chain drafts
  - validateRouteChainDraft pure function against the shared action contract
  - Routes domain skill with precedence inversion example and optional Phase 14 tools
affects:
  - 15-15 (create_route/delete_route become adapter-served; apply_dialplan retired once routes is enrolled)
  - 15-22 (proposal-time precedence plus checkRoutePrecedence fixtures)

actuals:
  tokens: 12172
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - Model drafts are validated to DialplanAction before a proposal card exists
    - Confirmation reloads only through RouteApplyService.applyContext
    - apply_dialplan is skipped from MCP when the routes domain is registered

key-files:
  created:
    - packages/backend/src/modules/routes/route-chain-draft.util.ts
    - packages/backend/src/modules/routes/route-chain-draft.util.spec.ts
    - packages/backend/src/modules/routes/routes-ai.adapter.ts
    - packages/backend/src/modules/routes/routes-ai.adapter.spec.ts
    - packages/backend/src/skills/routes/SKILL.md
  modified:
    - packages/backend/src/modules/routes/routes.module.ts
    - packages/backend/src/modules/mcp/mcp-tools.service.ts

key-decisions:
  - "create_route accepts a typed action chain, never raw app plus appdata"
  - "Confirmation calls RouteApplyService.applyContext only; the adapter never rebuilds the context name"
  - "Handwritten apply_dialplan is skipped once the routes adapter domain is registered"
  - "Phase 14 dry-run and template tools are mentioned only as optional in the routes skill"

patterns-established:
  - "Pattern: validateRouteChainDraft returns ok+chain or stepIndex+reason; invalid drafts have no applyPayload"
  - "Pattern: resulting pattern order is checked at proposal time with both patterns named"
  - "Pattern: inbound/catch-all cards carry an impact note assembled from the tenant's own patterns"

requirements-completed: [D-15, D-18, D-19, D-20, D-22, D-27]

coverage:
  - id: D1
    description: A valid typed chain becomes a pending proposal whose summary lists steps and states the dialplan will be reloaded (D-15, D-18)
    requirement: D-15
    verification:
      - kind: unit
        ref: packages/backend/src/modules/routes/routes-ai.adapter.spec.ts#returns a pending proposal whose summary lists steps and states the dialplan will be reloaded
        status: pass
    human_judgment: false
  - id: D2
    description: An unknown kind, missing parameter or missing entity is refused before a proposal exists, with the failing step named (D-15)
    requirement: D-15
    verification:
      - kind: unit
        ref: packages/backend/src/modules/routes/route-chain-draft.util.spec.ts#refuses an unknown action kind and names the failing step
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/routes/routes-ai.adapter.spec.ts#refuses an invalid typed chain before a proposal exists and names the failing step
        status: pass
    human_judgment: false
  - id: D3
    description: Confirming a route proposal writes the route and calls RouteApplyService.applyContext once, never the low-level applier (D-20)
    requirement: D-20
    verification:
      - kind: unit
        ref: packages/backend/src/modules/routes/routes-ai.adapter.spec.ts#writes the route and calls the orchestrator exactly once, never the low-level applier
        status: pass
    human_judgment: false
  - id: D4
    description: apply_dialplan is not a model-callable tool after the routes adapter is registered (D-20)
    requirement: D-20
    verification:
      - kind: unit
        ref: packages/backend/src/modules/routes/routes-ai.adapter.spec.ts#does not register a model-callable apply_dialplan after the routes adapter is adopted
        status: pass
    human_judgment: false
  - id: D5
    description: Reading routes and the assembled chain does not mutate (D-15)
    requirement: D-15
    verification:
      - kind: unit
        ref: packages/backend/src/modules/routes/routes-ai.adapter.spec.ts#lists tenant routes and describes the assembled chain without mutation
        status: pass
    human_judgment: false
  - id: D6
    description: A route tool called as one tenant never reads or changes another tenant's routes (D-22)
    requirement: D-22
    verification:
      - kind: unit
        ref: packages/backend/src/modules/routes/routes-ai.adapter.spec.ts#refuses a route in another tenant context at tool time
        status: pass
    human_judgment: false
  - id: D7
    description: Catch-all above a specific or emergency pattern is refused at proposal time with both patterns named (D-19)
    requirement: D-19
    verification:
      - kind: unit
        ref: packages/backend/src/modules/routes/routes-ai.adapter.spec.ts#refuses a catch-all above a specific or emergency pattern and names both
        status: pass
    human_judgment: false
  - id: D8
    description: Failed reload leaves the proposal pending with the error after the route write is visible (D-20)
    requirement: D-20
    verification:
      - kind: unit
        ref: packages/backend/src/modules/routes/routes-ai.adapter.spec.ts#leaves the proposal pending with the error after the route write is visible
        status: pass
    human_judgment: false

duration: 18min
completed: 2026-09-04
status: complete
---

# Phase 15 Plan 11: Typed Route Chains Summary

**Typed route drafts validated before the card, confirmed through RouteApplyService only, standalone apply_dialplan retired**

## Performance

- **Duration:** 18 min
- **Started:** 2026-09-04T12:40:00Z
- **Completed:** 2026-09-04T12:58:00Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Routes are proposed as a typed action chain the interface editor can open
- Invalid drafts are refused before a card exists, with the failing step named
- Confirmation writes the route and reloads through `RouteApplyService.applyContext` once
- `apply_dialplan` is no longer model-callable once the routes adapter is registered
- Catch-all-over-specific is refused at proposal time; inbound/catch-all cards carry an impact note
- Failed reload stays pending with the error after the database write is visible

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1 RED: typed route proposal** - `d43bbdc` (test)
2. **Task 1 GREEN: chain validator + adapter** - `14d464a` (feat)
3. **Task 2 RED: precedence and retired apply** - `c046a3d` (test)
4. **Task 2 GREEN: proposal-time check + skip apply_dialplan** - `ba8d621` (feat)
5. **Task 3: routes domain skill** - `9de6a44` (docs)

**Plan metadata:** docs commit (SUMMARY + STATE + ROADMAP) follows this file

_Note: TDD tasks have multiple commits (test → feat)._

## Files Created/Modified

- `packages/backend/src/modules/routes/route-chain-draft.util.ts` — pure draft → DialplanAction or step refusal
- `packages/backend/src/modules/routes/route-chain-draft.util.spec.ts` — unknown kind, missing param, missing entity
- `packages/backend/src/modules/routes/routes-ai.adapter.ts` — list, describe chain, propose create/delete
- `packages/backend/src/modules/routes/routes-ai.adapter.spec.ts` — confirm, tenant, precedence, failed reload, no apply tool
- `packages/backend/src/modules/routes/routes.module.ts` — registers RoutesAiAdapter
- `packages/backend/src/modules/mcp/mcp-tools.service.ts` — skip handwritten apply_dialplan after routes migrate
- `packages/backend/src/skills/routes/SKILL.md` — precedence example, optional Phase 14 tools

## Decisions Made

- **Typed chain only.** Raw `app`/`appdata` is refused so the editor can round-trip the same payload.
- **Orchestrator-only reload.** The adapter never calls `DialplanApplyService` and never rebuilds the tenanted context name.
- **Retire apply by skip, not a twin tool.** Registering a dummy `apply_dialplan` would keep it model-callable.
- **Phase 14 tools stay optional.** A hard instruction to call a missing dry-run tool would stall an otherwise working domain.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Skip handwritten apply_dialplan in mcp-tools.service.ts**
- **Found during:** Task 2 GREEN
- **Issue:** `files_modified` did not include `mcp-tools.service.ts`, but handwritten `regApplyDialplan` still registers a model-callable apply after the routes adapter exists. Inventory and D-20 require it gone.
- **Fix:** `reg()` skips `apply_dialplan` when the adapter registry already has domain `routes`.
- **Files modified:** `packages/backend/src/modules/mcp/mcp-tools.service.ts`
- **Verification:** routes-ai.adapter suite — apply_dialplan absent after adapter adopt
- **Committed in:** `ba8d621`

**2. [Rule 1 - Bug] Happy-path create moved off a context that already ends with `_X.`**
- **Found during:** Task 2
- **Issue:** Creating a specific DID after an existing catch-all is the inversion the new check refuses.
- **Fix:** Safe create/confirm fixtures use empty context `5`; context `3` stays the inversion case (`_X.` then `112`).
- **Files modified:** `packages/backend/src/modules/routes/routes-ai.adapter.spec.ts`
- **Verification:** adapter suite passed
- **Committed in:** `c046a3d`

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 bug)
**Impact on plan:** Required for D-20 and for the precedence check not to fail its own happy path. No scope creep. Unrelated dirty files left unstaged.

## Issues Encountered

- PowerShell cannot run bash heredoc commits; used `-F` message files under `.tmp/` (not staged).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 15-15 can treat `create_route` / `delete_route` as adapter-served and `apply_dialplan` as retired once the migration spec constructs `RoutesAiAdapter`
- 15-22 can keep driving `checkRoutePrecedence` plus the proposal-time refusal
- Handwritten create/delete twins are skipped by the existing adapter-name gate

## TDD Gate Compliance

Plan frontmatter is `type: execute` with per-task `tdd="true"` on Tasks 1–2. Each has a `test(15-11)` RED commit followed by a `feat(15-11)` GREEN commit. Tracer feedback gate re-ran `route-chain-draft|routes-ai.adapter` after Task 1 (12 passed) and continued (`human_verify_mode` default end-of-phase, automated-only verify).

## Verification

```
npm run test -w @krasterisk/backend -- --testPathPattern="routes-ai.adapter|route-chain-draft|agent-skill-registry" --no-coverage
```

Task 1: 12 passed (validator + adapter). Task 2: 12 passed in `routes-ai.adapter.spec.ts`. Task 3: 8 passed; catalog loads `routes`.

## Self-Check: PASSED

- FOUND: `packages/backend/src/modules/routes/route-chain-draft.util.ts`
- FOUND: `packages/backend/src/modules/routes/routes-ai.adapter.ts`
- FOUND: `packages/backend/src/skills/routes/SKILL.md`
- FOUND: commits `d43bbdc`, `14d464a`, `c046a3d`, `ba8d621`, `9de6a44`

---
*Phase: 15-universal-pbx-ai-agent*
*Completed: 2026-09-04*
