---
phase: 15-universal-pbx-ai-agent
plan: 22
subsystem: testing
tags: [eval, fixture-replay, d-06, d-09, d-18, d-22, agent-loop]

requires:
  - phase: 15-universal-pbx-ai-agent
    provides: In-process PbxAgentLoopService turn (15-08)
  - phase: 15-universal-pbx-ai-agent
    provides: Adapter-only dispatch, sanitizeArgs, propose-then-apply (15-15)
provides:
  - Fixture-replay harness that drives the real loop with a canned model client
  - Ten reference scenarios across read, mutating, cross-tenant, diagnostic and step-budget buckets
  - Named npm script and a guide for the remaining ten phase-gate scenarios
affects:
  - 15-23 (eval suite is the regression gate for completeness)
  - /gsd-secure-phase 15 (adversarial pair extends this same suite)
  - /gsd-verify-work 15 (path from ten to twenty)

actuals:
  tokens: 10240
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - Only the model client is substituted; McpToolsService, adapters, proposals and audit stay real
    - Scenarios are JSON data; the harness never switches on scenario id
    - Mutating evals assert a pending proposal and unchanged entity counts

key-files:
  created:
    - packages/backend/src/modules/ai-chat/pbx-agent-eval.harness.ts
    - packages/backend/src/modules/ai-chat/pbx-agent-eval.spec.ts
    - packages/backend/src/modules/ai-chat/evals/reference-scenarios.json
    - packages/backend/src/modules/ai-chat/evals/README.md
  modified:
    - packages/backend/package.json

key-decisions:
  - "Only the model client is a fixture; registry, sanitizeArgs, callTool, PbxAgentDiffService and audit are the real implementations"
  - "Scenarios live in JSON so adding one is a data change"
  - "Mutating scenarios assert both a pending proposal and no entity write"
  - "Adversarial slots 19–20 stay in this suite for /gsd-secure-phase 15"
  - "Named script is test:pbx-agent-eval; package version left untouched"

patterns-established:
  - "Pattern: eval harness drives PbxAgentLoopService.runTurn with FixtureModelClient"
  - "Pattern: assert tool sequence, not answer wording"
  - "Pattern: every audit row in a run must carry the scenario tenant"

requirements-completed: [D-06, D-09, D-18, D-22]

coverage:
  - id: D1
    description: A scenario replays canned model turns through the real agent loop with no network call (D-06)
    requirement: D-06
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-chat/pbx-agent-eval.spec.ts#replays a read scenario from data through the real loop with an asserted tool sequence
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/ai-chat/pbx-agent-eval.spec.ts#makes no outbound network request; only the model client is a fixture
        status: pass
    human_judgment: false
  - id: D2
    description: Each scenario asserts the tool sequence the agent chose, not only its final text (D-09)
    requirement: D-09
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-chat/pbx-agent-eval.spec.ts#fails with both sequences printed when the actual tool sequence differs
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/ai-chat/pbx-agent-eval.spec.ts#passes a step-budget scenario that stops at the ceiling
        status: pass
    human_judgment: false
  - id: D3
    description: Mutating scenarios assert a pending proposal and that nothing was written before confirmation (D-18)
    requirement: D-18
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-chat/pbx-agent-eval.spec.ts#passes three mutating scenarios with a pending proposal and no write
        status: pass
    human_judgment: false
  - id: D4
    description: Cross-tenant scenarios assert every audit row carries the calling tenant and a forged uid leaves the other tenant unchanged (D-22)
    requirement: D-22
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-chat/pbx-agent-eval.spec.ts#asserts the scenario tenant on every audit row
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/ai-chat/pbx-agent-eval.spec.ts#passes two cross-tenant scenarios: same tool as two tenants and a forged tenant key
        status: pass
    human_judgment: false
  - id: D5
    description: Ten bucket scenarios pass and the remaining ten are specified; the suite runs from a named script
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-chat/pbx-agent-eval.spec.ts#covers ten reference scenarios across the contract buckets
        status: pass
      - kind: other
        ref: npm run test:pbx-agent-eval -w @krasterisk/backend
        status: pass
    human_judgment: false

duration: 18min
completed: 2026-09-04
status: complete
---

# Phase 15 Plan 22: Evaluation Harness Summary

**Deterministic in-repo replay of canned model turns through the real PbxAgentLoopService, with ten bucket scenarios and a named script**

## Performance

- **Duration:** 18 min
- **Started:** 2026-09-04T16:12:00Z
- **Completed:** 2026-09-04T16:30:00Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- A fixture model client feeds canned turns into the real loop; `fetch` is never called
- Tool sequence, pending proposals, no-write counts, forged-uid isolation and the step ceiling are asserted from JSON
- `npm run test:pbx-agent-eval` runs the suite alone; the remaining ten slots are listed for the phase gate

## Task Commits

Each task was committed atomically (TDD RED → GREEN where required):

1. **Task 1 RED: failing read-scenario replay** - `488c0e3` (test)
2. **Task 1 GREEN: real-loop fixture harness** - `0ed8edb` (feat)
3. **Task 2 RED: failing ten-bucket coverage** - `f306231` (test)
4. **Task 2 GREEN: ten reference scenarios** - `a98484c` (feat)
5. **Task 3: named script and remaining-ten guide** - `fcbeb9c` (docs)

**Plan metadata:** docs commit (SUMMARY + STATE + ROADMAP) follows this file

_Note: TDD tracer/auto tasks have two commits each (test → feat)._

## Files Created/Modified

- `packages/backend/src/modules/ai-chat/pbx-agent-eval.harness.ts` — fixture client + real loop/MCP/adapters; sequence, proposal, no-write, audit and terminal matchers
- `packages/backend/src/modules/ai-chat/pbx-agent-eval.spec.ts` — data-driven assertions for the ten scenarios
- `packages/backend/src/modules/ai-chat/evals/reference-scenarios.json` — first ten scenarios
- `packages/backend/src/modules/ai-chat/evals/README.md` — how to add a scenario and the remaining ten
- `packages/backend/package.json` — `test:pbx-agent-eval` only (version untouched)

## Decisions Made

- **Substitute only the model client.** Registry, sanitisation, dispatch, `PbxAgentDiffService` and `logAction` are the real ones so a regression in any of them fails a scenario (T-15-100).
- **Scenarios are data.** The harness never mentions a scenario id; adding a case is a JSON edit.
- **Proposal and no-write together.** A write-plus-propose implementation must fail (T-15-101 / D-18).
- **Forged uid is a behaviour, not a sanitiser unit test.** The model supplies `vpbxUserUid` / `tenantId`; tenant 200's counts stay put (T-15-102).
- **Adversarial pair stays here.** Slots 19–20 belong to `/gsd-secure-phase 15` but extend this suite.

## Deviations from Plan

None - plan executed exactly as written.

---

**Total deviations:** 0
**Impact on plan:** None.

## Issues Encountered

None. PowerShell commits used `-F` message files under `.tmp/` (not staged), same as 15-04–15-19.

## User Setup Required

None - no external service configuration required. The suite is offline.

## Next Phase Readiness

- Ready for 15-23 completeness / remaining adapter inventory
- Phase gate still needs the remaining ten scenarios listed in `evals/README.md`
- After all 24 plans: `/gsd-secure-phase 15` fills adversarial slots 19–20

## TDD Gate Compliance

Plan frontmatter is `type: execute`. Task 1 (tracer) and Task 2 (`tdd="true"`) have RED then GREEN commits. Task 3 is docs/script only. Tracer verify after Task 1 re-ran `pbx-agent-eval` (5 passed) and continued. Overall verify: 11 passed via `npm run test:pbx-agent-eval`.

## Verification

```
npm run test:pbx-agent-eval -w @krasterisk/backend
```

11 passed.

## Self-Check: PASSED

- FOUND: `packages/backend/src/modules/ai-chat/pbx-agent-eval.harness.ts` (`runScenario`, `assertToolSequence`, fixture model client)
- FOUND: `packages/backend/src/modules/ai-chat/evals/reference-scenarios.json` (10 scenarios)
- FOUND: `packages/backend/src/modules/ai-chat/evals/README.md` (remaining ten)
- FOUND: `packages/backend/package.json` (`test:pbx-agent-eval`)
- FOUND: commits `488c0e3`, `0ed8edb`, `f306231`, `a98484c`, `fcbeb9c`

---
*Phase: 15-universal-pbx-ai-agent*
*Completed: 2026-09-04*
