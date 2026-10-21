---
phase: 15-universal-pbx-ai-agent
plan: 07
subsystem: api
tags: [mcp, adapters, d-22, d-27, contexts, cdr, precedence]

requires:
  - phase: 15-universal-pbx-ai-agent
    provides: sanitizeArgs, bootstrap registry, getDomains (15-01)
  - phase: 15-universal-pbx-ai-agent
    provides: callTool proposal persist and live-ops exceptions (15-05)
provides:
  - Adapter-over-handwritten precedence skip derived from the live registry
  - ContextsAiAdapter list_contexts with tenant as a call parameter
  - ReportsAiAdapter get_cdr_summary and find_cdr_calls with the existing search clamp
  - Registry-enumerated tenant-isolation suite and eighteen-name inventory
affects:
  - 15-09 through 15-11 (later domain slices inherit precedence and inventory)
  - 15-15 (cutover flips handwritten inventory rows to a failure)

actuals:
  tokens: 11165
  tasks: 3
  commits: 7

tech-stack:
  added: []
  patterns:
    - Handwritten reg() skips any name getAllTools already provides and logs both sources
    - Adapter tools are adopted after the skip pass so the twin never lands
    - Isolation suite enumerates the adapter registry, not a hand-maintained name list

key-files:
  created:
    - packages/backend/src/modules/contexts/contexts-ai.adapter.ts
    - packages/backend/src/modules/reports/reports-ai.adapter.ts
    - packages/backend/src/modules/reports/reports.module.ts
    - packages/backend/src/modules/ai-platform/legacy-tool-migration.spec.ts
    - packages/backend/src/skills/contexts/SKILL.md
    - packages/backend/src/skills/reports/SKILL.md
  modified:
    - packages/backend/src/modules/mcp/mcp-tools.service.ts
    - packages/backend/src/modules/contexts/contexts.module.ts
    - packages/backend/src/modules/reports/cdr/reports-cdr.module.ts

key-decisions:
  - "Skip list is derived from aiAdapterRegistry.getAllTools, never a hardcoded migrated-name list"
  - "find_cdr_calls keeps Math.min(limit || 20, 50) from the handwritten tool"
  - "apply_dialplan is inventoried as retired for 15-11, reported handwritten until routes migrate"
  - "ReportsAiAdapter is provided by ReportsCdrModule so bootstrap registers it without a new AppModule import"

patterns-established:
  - "Pattern: adapter names win; handwritten twin is skipped and warned"
  - "Pattern: migration spec enumerates getAllTools so later slices need no new assertion rows"
  - "Pattern: eighteen-name inventory reports state mid-migration and fails only on duplicate or vanished"

requirements-completed: [D-12, D-15, D-22, D-27]

coverage:
  - id: D1
    description: When an adapter provides a tool name, the handwritten twin never reaches the registry (D-27)
    requirement: D-27
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/legacy-tool-migration.spec.ts#serves list_contexts from the adapter and skips the handwritten twin
        status: pass
    human_judgment: false
  - id: D2
    description: Listing contexts is served by a domain adapter that takes tenant as a call parameter (D-22)
    requirement: D-22
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/legacy-tool-migration.spec.ts#returns disjoint context sets for two tenants
        status: pass
    human_judgment: false
  - id: D3
    description: A forged tenant key in arguments does not change which tenant's contexts or call records come back (D-22)
    requirement: D-22
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/legacy-tool-migration.spec.ts#ignores a forged tenant key in list_contexts arguments
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/legacy-tool-migration.spec.ts#proves adapter ownership, cross-tenant isolation and forged-key ignore for each registered adapter tool
        status: pass
    human_judgment: false
  - id: D4
    description: Call-record search keeps the existing upper bound of 50 and defaults to 20
    requirement: D-12
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/legacy-tool-migration.spec.ts#clamps find_cdr_calls limit to 50 and defaults to 20
        status: pass
    human_judgment: false
  - id: D5
    description: Eighteen-name inventory reports adapter-served, handwritten, or retired and fails on a vanished or duplicate name
    requirement: D-27
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/legacy-tool-migration.spec.ts#reports adapter-served, handwritten, or retired and fails on a duplicate or a vanished tool
        status: pass
    human_judgment: false

duration: 22min
completed: 2026-09-04
status: complete
---

# Phase 15 Plan 07: Read-only adapter migration Summary

**Adapter-over-handwritten precedence, contexts and CDR tools on domain adapters with a registry-enumerated isolation suite, and an eighteen-name inventory that stays green mid-migration**

## Performance

- **Duration:** 22 min
- **Started:** 2026-09-04T11:39:00Z
- **Completed:** 2026-09-04T12:01:00Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- Handwritten `reg()` consults `getAllTools()` and skips any name an adapter already owns, logging handwritten vs adapter
- `list_contexts` is served by `ContextsAiAdapter`; tenant is a handler parameter, not a closure
- `get_cdr_summary` and `find_cdr_calls` are served by `ReportsAiAdapter`; search clamp stays `Math.min(limit || 20, 50)`
- Shared spec enumerates the adapter registry for isolation and forged-key ignore; later slices enrol by registering
- Eighteen-name inventory reports adapter-served / handwritten / retired; `apply_dialplan` is retired with a 15-11 reason

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1 RED: contexts precedence** - `9df729a` (test)
2. **Task 1 GREEN: contexts adapter + skip** - `8238df8` (feat)
3. **Task 2 RED: call-records adapter** - `bcb9475` (test)
4. **Task 2 GREEN: summary, search clamp, skill** - `2d334b4` (feat)
5. **Task 3 RED: eighteen-name inventory** - `72b2f7b` (test)
6. **Task 3 GREEN: inventory reporter** - `771b1e8` (feat)

**Plan metadata:** docs commit (SUMMARY + STATE + ROADMAP) follows this file

_Note: TDD tasks have multiple commits (test → feat)._

## Files Created/Modified

- `packages/backend/src/modules/mcp/mcp-tools.service.ts` — skip handwritten names the adapter registry already provides; adopt adapter tools after the skip pass
- `packages/backend/src/modules/contexts/contexts-ai.adapter.ts` — `list_contexts` with uid as a call parameter
- `packages/backend/src/modules/contexts/contexts.module.ts` — registers the adapter
- `packages/backend/src/modules/reports/reports-ai.adapter.ts` — CDR summary and capped search
- `packages/backend/src/modules/reports/reports.module.ts` — adapter-hosting module
- `packages/backend/src/modules/reports/cdr/reports-cdr.module.ts` — provides the adapter so bootstrap loads it
- `packages/backend/src/modules/ai-platform/legacy-tool-migration.spec.ts` — precedence, isolation table, inventory
- `packages/backend/src/skills/contexts/SKILL.md` — naming, tenant scope, relation to routes
- `packages/backend/src/skills/reports/SKILL.md` — dispositions, search cap

## Decisions Made

- **Skip list is the live adapter registry.** A hardcoded migrated-name list would be the second source of truth D-27 removes.
- **Search clamp is unchanged.** `Math.min(args.limit || 20, 50)` is the only bound that keeps a model-chosen page size out of the prompt.
- **`apply_dialplan` is inventoried as retired**, not vanished. Absence is asserted only after the routes domain registers; until then the row is handwritten.
- **`ReportsAiAdapter` is provided by `ReportsCdrModule`.** `reports.module.ts` did not exist and AppModule was out of scope; the already-loaded CDR module is what makes `OnModuleInit` run.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Adapter must be a provider on a loaded Nest module**
- **Found during:** Task 2 GREEN
- **Issue:** Plan listed `reports.module.ts`, which did not exist and is not imported by AppModule. An adapter that only lives there would never register at bootstrap.
- **Fix:** Created `reports.module.ts` as specified and also provided `ReportsAiAdapter` from `ReportsCdrModule`, which AppModule already imports.
- **Files modified:** `packages/backend/src/modules/reports/cdr/reports-cdr.module.ts`, `packages/backend/src/modules/reports/reports.module.ts`
- **Verification:** migration spec registers the adapter via `onModuleInit`; production path matches directories
- **Committed in:** `2d334b4`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Required for the adapter to exist at bootstrap. No scope creep.

## Issues Encountered

- PowerShell cannot run bash heredoc commits; used `-F` message files under `.tmp/` (not staged).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Remaining handwritten tools can migrate domain by domain; precedence keeps one live implementation
- Inventory stays green while later slices flip rows from handwritten to adapter-served
- 15-15 can flip handwritten rows to a hard failure once all eighteen are gone

## TDD Gate Compliance

Plan frontmatter is `type: execute` with per-task `tdd="true"`. Each task has a `test(15-07)` RED commit followed by a `feat(15-07)` GREEN commit. Tracer feedback gate re-ran `legacy-tool-migration|mcp-tools` after Task 1 (48 passed) and continued (`human_verify_mode` default end-of-phase, automated-only verify).

## Verification

```
npm run test -w @krasterisk/backend -- --testPathPattern="legacy-tool-migration|mcp-tools" --no-coverage
```

Task 1: 48 passed (migration + mcp-tools). Task 2–3: 14 passed in `legacy-tool-migration.spec.ts`.

## Self-Check: PASSED

- FOUND: `packages/backend/src/modules/mcp/mcp-tools.service.ts` (handwritten skip)
- FOUND: `packages/backend/src/modules/contexts/contexts-ai.adapter.ts`
- FOUND: `packages/backend/src/modules/reports/reports-ai.adapter.ts`
- FOUND: `packages/backend/src/modules/ai-platform/legacy-tool-migration.spec.ts`
- FOUND: `packages/backend/src/skills/contexts/SKILL.md`
- FOUND: `packages/backend/src/skills/reports/SKILL.md`
- FOUND: commits `9df729a`, `8238df8`, `bcb9475`, `2d334b4`, `72b2f7b`, `771b1e8`
