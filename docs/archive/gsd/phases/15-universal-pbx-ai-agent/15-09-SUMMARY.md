---
phase: 15-universal-pbx-ai-agent
plan: 09
subsystem: api
tags: [mcp, adapters, proposals, d-15, d-18, d-21, d-22, d-27, endpoints, trunks]

requires:
  - phase: 15-universal-pbx-ai-agent
    provides: callTool persist path for proposes tools (15-05)
  - phase: 15-universal-pbx-ai-agent
    provides: adapter-over-handwritten precedence and registry isolation suite (15-07)
provides:
  - EndpointsAiAdapter create/bulk/delete as pending proposals
  - TrunksAiAdapter list/create/delete with named route dependents
  - SIP credential generation in EndpointsService.createWithGeneratedCredentials
  - Apply dispatch for the five subscriber and trunk tools
affects:
  - 15-10 (IVR and queue mutations follow the same proposal shape)
  - 15-15 (five more inventory rows are adapter-served)

actuals:
  tokens: 17800
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - Mutating adapter tools set proposes and omit secrets from summary and apply args
    - Bulk AI create is one proposal with a documented ceiling refused at tool time
    - Trunk delete re-checks route dependents at confirm via confirmTrunkDelete

key-files:
  created:
    - packages/backend/src/modules/endpoints/endpoints-ai.adapter.ts
    - packages/backend/src/modules/endpoints/endpoints-ai.adapter.spec.ts
    - packages/backend/src/modules/trunks/trunks-ai.adapter.ts
    - packages/backend/src/modules/trunks/trunks-ai.adapter.spec.ts
    - packages/backend/src/skills/endpoints/SKILL.md
    - packages/backend/src/skills/trunks/SKILL.md
  modified:
    - packages/backend/src/modules/endpoints/endpoints.service.ts
    - packages/backend/src/modules/endpoints/endpoints.module.ts
    - packages/backend/src/modules/trunks/trunks.module.ts
    - packages/backend/src/modules/ai-platform/legacy-tool-migration.spec.ts
    - packages/backend/src/modules/ai-chat/pbx-agent-diff.service.ts
    - packages/backend/src/modules/ai-chat/agent-proposals.module.ts

key-decisions:
  - "SIP passwords are generated in EndpointsService, never in the tool layer or the proposal"
  - "AI bulk create ceiling is 50, refused at tool time with the number named"
  - "confirmTrunkDelete re-reads routes and surfaces names instead of deleting a live dependent"

patterns-established:
  - "Pattern: applyPayload.args never carry a generated secret; the service generates at write time"
  - "Pattern: one confirmation card per bulk batch, not one card per item"
  - "Pattern: delete proposals name the human-visible entity and its dependents"

requirements-completed: [D-15, D-18, D-21, D-22, D-27]

coverage:
  - id: D1
    description: Creating one subscriber returns a pending proposal and writes no row until confirm (D-18, D-27)
    requirement: D-18
    verification:
      - kind: unit
        ref: packages/backend/src/modules/endpoints/endpoints-ai.adapter.spec.ts#returns a pending proposal naming the extension and context and creates no subscriber row
        status: pass
    human_judgment: false
  - id: D2
    description: Credential generation lives in the subscriber service and never appears in the proposal or tool result (T-15-37)
    requirement: D-18
    verification:
      - kind: unit
        ref: packages/backend/src/modules/endpoints/endpoints-ai.adapter.spec.ts#never places a generated credential in the proposal summary or the tool result
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/endpoints/endpoints-ai.adapter.spec.ts#generates the credential in the service, stores it, and returns the subscriber without the secret
        status: pass
    human_judgment: false
  - id: D3
    description: Bulk create is one bounded proposal; over-ceiling batches are refused at tool time (T-15-38)
    requirement: D-18
    verification:
      - kind: unit
        ref: packages/backend/src/modules/endpoints/endpoints-ai.adapter.spec.ts#returns one proposal for the whole batch with a per-item summary and a stated total
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/endpoints/endpoints-ai.adapter.spec.ts#refuses a batch above the documented ceiling and names that ceiling
        status: pass
    human_judgment: false
  - id: D4
    description: A caller without the write role gets a denied confirm and no rows change (D-21)
    requirement: D-21
    verification:
      - kind: unit
        ref: packages/backend/src/modules/endpoints/endpoints-ai.adapter.spec.ts#denies a read-only role confirming bulk create and changes no rows
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/endpoints/endpoints-ai.adapter.spec.ts#denies a read-only role confirming delete and changes no rows
        status: pass
    human_judgment: false
  - id: D5
    description: Delete is tenant-scoped; a foreign subscriber is not found (D-22)
    requirement: D-22
    verification:
      - kind: unit
        ref: packages/backend/src/modules/endpoints/endpoints-ai.adapter.spec.ts#confirming a delete proposal for a subscriber of another tenant is not found
        status: pass
    human_judgment: false
  - id: D6
    description: Trunk create and delete are adapter-served proposals; delete names and re-checks referencing routes (D-15, T-15-41)
    requirement: D-15
    verification:
      - kind: unit
        ref: packages/backend/src/modules/trunks/trunks-ai.adapter.spec.ts#returns a proposal naming the trunk and provider host and writes nothing
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/trunks/trunks-ai.adapter.spec.ts#is destructive and names the routes that reference the trunk
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/trunks/trunks-ai.adapter.spec.ts#confirming a delete still referenced by a route surfaces the references and does not remove
        status: pass
    human_judgment: false
  - id: D7
    description: All five migrated tools pass the registry-enumerated cross-tenant suite (D-22, D-27)
    requirement: D-22
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/legacy-tool-migration.spec.ts#proves adapter ownership, cross-tenant isolation and forged-key ignore for each registered adapter tool
        status: pass
    human_judgment: false

duration: 18min
completed: 2026-09-04
status: complete
---

# Phase 15 Plan 09: Subscriber and trunk mutations as proposals Summary

**Five subscriber and trunk tools are adapter-served proposals: credentials generate in EndpointsService, bulk is capped at 50, trunk delete names route dependents, and confirm is the only writer**

## Performance

- **Duration:** 18 min
- **Started:** 2026-09-04T12:16:00Z
- **Completed:** 2026-09-04T12:34:00Z
- **Tasks:** 3
- **Files modified:** 13

## Accomplishments

- `create_endpoint`, `create_endpoints_bulk` and `delete_endpoint` live on `EndpointsAiAdapter` and return pending proposals
- SIP passwords are generated in `EndpointsService.createWithGeneratedCredentials`; summaries and tool results never contain the secret
- Bulk create is one card with a named 50-item ceiling refused at tool time
- `create_trunk` / `delete_trunk` / `list_trunks` live on `TrunksAiAdapter`; delete names referencing routes and `confirmTrunkDelete` surfaces them if they remain
- The five tools are adapter-served in the eighteen-name inventory and pass the registry-enumerated isolation suite

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1 RED: create subscriber proposal** - `bd5efce` (test)
2. **Task 1 GREEN: service credentials + adapter** - `adfbcf0` (feat)
3. **Task 2 RED: bulk and delete** - `f2a3eac` (test)
4. **Task 2 GREEN: batch ceiling and tenant delete** - `43671bf` (feat)
5. **Task 3 RED: trunk proposals** - `4d3c5f4` (test)
6. **Task 3 GREEN: trunk adapter + apply dispatch** - `1d4d988` (feat)

**Plan metadata:** docs commit (SUMMARY + STATE + ROADMAP) follows this file

_Note: TDD tasks have multiple commits (test → feat)._

## Files Created/Modified

- `packages/backend/src/modules/endpoints/endpoints-ai.adapter.ts` — create / bulk / delete as drafts
- `packages/backend/src/modules/endpoints/endpoints.service.ts` — `generateSipPassword` + `createWithGeneratedCredentials`
- `packages/backend/src/modules/endpoints/endpoints.module.ts` — registers the adapter
- `packages/backend/src/modules/trunks/trunks-ai.adapter.ts` — list / create / delete; `confirmTrunkDelete`
- `packages/backend/src/modules/trunks/trunks.module.ts` — registers the adapter, imports RoutesModule
- `packages/backend/src/skills/endpoints/SKILL.md` — extension, context, ask-don't-guess, no password in chat
- `packages/backend/src/skills/trunks/SKILL.md` — auth vs ip, provider fields, live-call impact
- `packages/backend/src/modules/ai-platform/legacy-tool-migration.spec.ts` — enrols the five tools
- `packages/backend/src/modules/ai-chat/pbx-agent-diff.service.ts` — apply cases for the five tools
- `packages/backend/src/modules/ai-chat/agent-proposals.module.ts` — EndpointsModule + TrunksModule

## Decisions Made

- **One generator, in the subscriber service.** The existing `crypto.randomBytes` helper is the only source; the MCP tool no longer invents a password.
- **AI bulk ceiling is 50.** The interface path may still create larger ranges; an unbounded agent batch behind one click is the blast radius this phase refuses.
- **Trunk confirm re-reads routes.** The card names dependents up front; if they still exist at apply, the result surfaces the names and does not delete.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Apply dispatch for the five tools**
- **Found during:** Task 3 GREEN
- **Issue:** `PbxAgentDiffService.executePayload` only knew directory and route tools. Confirming a subscriber or trunk card would throw `Unsupported apply tool`.
- **Fix:** Added endpoint and trunk cases, inject the two services, and reuse `confirmTrunkDelete` for referenced-trunk apply.
- **Files modified:** `packages/backend/src/modules/ai-chat/pbx-agent-diff.service.ts`, `packages/backend/src/modules/ai-chat/pbx-agent-diff.service.spec.ts`, `packages/backend/src/modules/ai-chat/agent-proposals.module.ts`
- **Verification:** `pbx-agent-diff.service` + adapter suites passed (49 tests)
- **Committed in:** `1d4d988`

**2. [Rule 3 - Blocking] Isolation suite must register the new adapters**
- **Found during:** Task 3 GREEN
- **Issue:** D-22 requires every registered adapter tool to pass the enumerated suite; without registering endpoints/trunks the five tools would stay untested.
- **Fix:** Registered both adapters in `legacy-tool-migration.spec.ts` and flipped inventory rows to adapter-served.
- **Files modified:** `packages/backend/src/modules/ai-platform/legacy-tool-migration.spec.ts`
- **Verification:** isolation + inventory tests passed
- **Committed in:** `1d4d988`

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 blocking)
**Impact on plan:** Required for confirm and D-22. No scope creep.

## Issues Encountered

- PowerShell cannot run bash heredoc commits; used `-F` message files under `.tmp/` (not staged).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 15-10 can migrate IVR and queue mutations with the same `proposes` + apply-switch pattern
- Inventory stays green; five more names are adapter-served
- Handwritten `create_endpoint` / `create_trunk` twins are skipped by 15-07 precedence

## TDD Gate Compliance

Plan frontmatter is `type: execute` with per-task `tdd="true"`. Each task has a `test(15-09)` RED commit followed by a `feat(15-09)` GREEN commit. Tracer feedback gate re-ran `endpoints-ai.adapter` after Task 1 (8 passed) and continued.

## Verification

```
npm run test -w @krasterisk/backend -- --testPathPattern="endpoints-ai.adapter|trunks-ai.adapter|legacy-tool-migration|pbx-agent-diff.service" --no-coverage
```

49 passed.

## Self-Check: PASSED

- FOUND: `packages/backend/src/modules/endpoints/endpoints-ai.adapter.ts`
- FOUND: `packages/backend/src/modules/trunks/trunks-ai.adapter.ts`
- FOUND: `packages/backend/src/skills/endpoints/SKILL.md`
- FOUND: `packages/backend/src/skills/trunks/SKILL.md`
- FOUND: commits `bd5efce`, `adfbcf0`, `f2a3eac`, `43671bf`, `4d3c5f4`, `1d4d988`

---
*Phase: 15-universal-pbx-ai-agent*
*Completed: 2026-09-04*
