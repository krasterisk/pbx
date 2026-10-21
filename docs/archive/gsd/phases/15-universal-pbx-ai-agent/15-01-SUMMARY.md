---
phase: 15-universal-pbx-ai-agent
plan: 01
subsystem: api
tags: [mcp, tenancy, d-22, agent-diff-proposal, sanitize-args]

requires:
  - phase: 12-dialplan-apps-editor-refactor-reusable-route-chain-builder
    provides: D-23 uid-as-call-parameter handler contract on AiToolDefinition
provides:
  - TENANT_ARG_KEYS + sanitizeArgs as the single D-22 dispatch gate
  - AgentDiffProposal contract for 15-05 and mutating adapters
  - Bootstrap-built MCP registry with no model-visible confirm flag
  - getDomains() for the D-16/D-17 completeness gate in 15-23
  - Table-driven per-tool D-22 isolation suite that grows with the registry
affects:
  - 15-05 (replaces destructive blanket refusal with proposal persist + live-ops)
  - 15-23 (consumes getDomains for completeness)
  - every adapter plan (AgentDiffProposal return type, TENANT_ARG_KEYS schema invariant)

actuals:
  tokens: 6358
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - sanitizeArgs copies args entry-by-entry and drops TENANT_ARG_KEYS before any handler
    - Destructive agent-path dispatch refuses until 15-05 proposal persist
    - OnApplicationBootstrap builds the uid-independent tool registry
    - it.each over getToolsList names locks D-22 for every registered tool

key-files:
  created: []
  modified:
    - packages/backend/src/modules/ai-platform/ai-adapter.types.ts
    - packages/backend/src/modules/ai-platform/ai-adapter-registry.service.ts
    - packages/backend/src/modules/ai-platform/ai-adapter-registry.service.spec.ts
    - packages/backend/src/modules/mcp/mcp-tools.service.ts
    - packages/backend/src/modules/mcp/mcp-tools.service.spec.ts

key-decisions:
  - "sanitizeArgs is the single D-22 gate; uid stays the second positional parameter and is never merged into args"
  - "Destructive agent-path callTool always refuses toward the proposal card until 15-05 Task 1"
  - "Registry builds on OnApplicationBootstrap; registerAll clears then rebuilds (no lazy size===0 guard)"
  - "getDomains() returns adapter map keys for the 15-23 completeness gate"
  - "applyPayload on AgentDiffProposal is documented server-side only"

patterns-established:
  - "Pattern: TENANT_ARG_KEYS imported by sanitizeArgs; schema invariant walks getToolsList properties"
  - "Pattern: table-driven it.each reads names from the live registry so later adapters enter the run automatically"
  - "Pattern: AgentDiffProposal is a first-class handler return type alongside string | Record"

requirements-completed: [D-16, D-17, D-22]

coverage:
  - id: D1
    description: Model-supplied tenant keys in tool arguments are stripped before any handler runs (D-22)
    requirement: D-22
    verification:
      - kind: unit
        ref: packages/backend/src/modules/mcp/mcp-tools.service.spec.ts#invokes list_contexts with dispatch uid 100 and no tenant key left in args
        status: pass
    human_judgment: false
  - id: D2
    description: Every registered tool receives vpbxUserUid from the dispatch call, never from arguments (D-22)
    requirement: D-22
    verification:
      - kind: unit
        ref: packages/backend/src/modules/mcp/mcp-tools.service.spec.ts#D-22 per-tool tenancy (dispatch mechanics)
        status: pass
    human_judgment: false
  - id: D3
    description: No tool inputSchema visible to the model contains a tenant key or a self-confirmation flag
    requirement: D-22
    verification:
      - kind: unit
        ref: packages/backend/src/modules/mcp/mcp-tools.service.spec.ts#exposes no boolean confirmation property in any getToolsList schema
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/mcp/mcp-tools.service.spec.ts#no tool schema declares a tenant key as an input property
        status: pass
    human_judgment: false
  - id: D4
    description: AiAdapterRegistryService exposes getDomains() for the D-16/D-17 completeness gate
    requirement: D-16
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/ai-adapter-registry.service.spec.ts#getDomains returns the registered domain keys for two stub adapters
        status: pass
    human_judgment: false
  - id: D5
    description: Destructive agent-path dispatch refuses without invoking the domain handler (D-18 prep)
    requirement: D-22
    verification:
      - kind: unit
        ref: packages/backend/src/modules/mcp/mcp-tools.service.spec.ts#refuses a destructive tool with any argument shape and does not invoke the domain handler
        status: pass
    human_judgment: false

duration: 64min
completed: 2026-09-04
status: complete
---

# Phase 15 Plan 01: Hardened MCP Dispatch Summary

**Single sanitized `callTool()` dispatch, `AgentDiffProposal` contract, bootstrap-built registry, and a table-driven D-22 tenancy suite over every registered tool**

## Performance

- **Duration:** 64 min
- **Started:** 2026-09-04T05:51:10Z
- **Completed:** 2026-09-04T06:55:00Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- `sanitizeArgs` strips every `TENANT_ARG_KEYS` entry before any handler runs; forged `vpbxUserUid` is logged and dropped, dispatch uid stays positional
- Destructive tools no longer expose `confirm` to the model and always refuse on the agent path (15-05 will replace the blanket with proposal persist)
- Registry is built in `onApplicationBootstrap`; `registerAll()` is idempotent; boot log includes the sorted adapter domain list
- `AgentDiffProposal` is a first-class handler return type; `getDomains()` is ready for 15-23
- `it.each` over `getToolsList()` names proves D-22 for the whole registry and grows automatically as adapters land

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1 RED: forged tenant arg strip** - `f74c3ba` (test)
2. **Task 1 GREEN: sanitizeArgs + AgentDiffProposal** - `bd0856e` (feat)
3. **Task 2 RED: destructive refusal + bootstrap registry** - `71e2366` (test)
4. **Task 2 GREEN: refuse destructive dispatch, OnApplicationBootstrap** - `ef2c606` (feat)
5. **Task 3 RED: getDomains + per-tool D-22 table** - `7a084da` (test)
6. **Task 3 GREEN: getDomains()** - `cf70d9a` (feat)

**Plan metadata:** docs commit (SUMMARY + STATE + ROADMAP) follows this file

_Note: TDD tasks have multiple commits (test → feat)._

## Files Created/Modified

- `packages/backend/src/modules/ai-platform/ai-adapter.types.ts` — `TENANT_ARG_KEYS`, `AgentDiffProposal`, widened handler return
- `packages/backend/src/modules/ai-platform/ai-adapter-registry.service.ts` — `getDomains()`
- `packages/backend/src/modules/ai-platform/ai-adapter-registry.service.spec.ts` — two-adapter `getDomains` assertion
- `packages/backend/src/modules/mcp/mcp-tools.service.ts` — `sanitizeArgs`, destructive refusal, bootstrap registry, emoji strip on returns
- `packages/backend/src/modules/mcp/mcp-tools.service.spec.ts` — tracer, D-18 refusal, bootstrap, D-22 `it.each` table

## Decisions Made

- **sanitizeArgs is the only D-22 argument gate.** Tenant keys are copied out, never merged back; uid is the second positional parameter.
- **Destructive agent-path always refuses.** Model-visible `confirm` is gone; 15-05 Task 1 replaces this blanket inside `callTool()` with `proposes` persist plus the two live-ops names.
- **No lazy registry.** `OnApplicationBootstrap` → `registerAll()`; `registerAll()` clears then rebuilds. Tests that inject adapter tools re-call `registerAll()` after the mock.
- **`applyPayload` is server-side only** — documented on the type so 15-05 / UI never serialize it to the model or browser.
- **D-22 table stubs handlers and clears `destructive`** so dispatch mechanics stay observable after the Task 2 refusal. Content-level "tenant A sees no tenant B rows" stays in domain adapter specs.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Obsolete D-20/D-25 confirm=true tests inverted by Task 2**
- **Found during:** Task 2 GREEN
- **Issue:** Existing specs expected `confirm=true` to execute deletes and a `confirm` schema property. Task 2 inverts that meaning.
- **Fix:** Replaced the old gate describe with a non-destructive passthrough case; new D-18 tests own the refusal.
- **Files modified:** `packages/backend/src/modules/mcp/mcp-tools.service.spec.ts`
- **Verification:** mcp-tools suite 15 passed after GREEN
- **Committed in:** `ef2c606`

**2. [Rule 2 - Missing Critical] Emoji stripped at the callTool return boundary**
- **Found during:** Task 2
- **Issue:** Plan requires no emoji in any text this service returns; handlers still emit ✅/❌/❓ in source strings.
- **Fix:** `stripEmoji` / `plainText` on every `callTool` return path so the model never sees emoji even if a handler string still contains one.
- **Files modified:** `packages/backend/src/modules/mcp/mcp-tools.service.ts`
- **Verification:** destructive refusal test asserts no emoji; error path still contains `Ошибка`
- **Committed in:** `ef2c606`

**3. [Rule 3 - Blocking] D-22 it.each must observe handlers after Task 2 refusal**
- **Found during:** Task 3
- **Issue:** Destructive tools never reach the handler after Task 2, so a naive `it.each` could not assert uid + clean args.
- **Fix:** Per-name stub replaces the handler and clears `destructive` so the suite proves dispatch mechanics (sanitize + positional uid) for every tool. Domain row isolation stays in adapter specs.
- **Files modified:** `packages/backend/src/modules/mcp/mcp-tools.service.spec.ts`
- **Verification:** 18 `it.each` cases pass
- **Committed in:** `7a084da`

---

**Total deviations:** 3 auto-fixed (1 bug, 1 missing critical, 1 blocking)
**Impact on plan:** All required for the Task 2/3 behavior change. No scope creep.

## Issues Encountered

- PowerShell cannot run bash heredoc commits; used `-F` message files under `.tmp/` (not staged).
- `aiChatSettingsService` is unused inside `callTool` after the destructive inversion. Left injected — 15-05 may still need settings, and removing the constructor slot is out of scope.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 15-05 can persist `AgentDiffProposal` from `callTool` and replace the destructive blanket
- 15-23 can call `getDomains()` for the completeness gate
- Adapter plans inherit `TENANT_ARG_KEYS` + the growing D-22 table automatically

## TDD Gate Compliance

Plan frontmatter is `type: execute` with per-task `tdd="true"`. Each task has a `test(15-01)` RED commit followed by a `feat(15-01)` GREEN commit. Tracer feedback gate re-ran `mcp-tools` after Task 1 (pass) and continued (`human_verify_mode` default end-of-phase, automated-only verify).

## Self-Check: PASSED

- FOUND: `packages/backend/src/modules/ai-platform/ai-adapter.types.ts` (`AgentDiffProposal`, `TENANT_ARG_KEYS`)
- FOUND: `packages/backend/src/modules/mcp/mcp-tools.service.ts` (`sanitizeArgs`)
- FOUND: `packages/backend/src/modules/mcp/mcp-tools.service.spec.ts` (D-22 table)
- FOUND: `packages/backend/src/modules/ai-platform/ai-adapter-registry.service.ts` (`getDomains`)
- FOUND: commits `f74c3ba`, `bd0856e`, `71e2366`, `ef2c606`, `7a084da`, `cf70d9a`

---
*Phase: 15-universal-pbx-ai-agent*
*Completed: 2026-09-04*
