---
phase: 15-universal-pbx-ai-agent
plan: 19
subsystem: api
tags: [diagnostics, ami, d-12, d-13, d-22, tenant-filter, allow-list]

requires:
  - phase: 15-universal-pbx-ai-agent
    provides: In-process agent loop and adapter-only dispatch (15-08, 15-15)
  - phase: 15-universal-pbx-ai-agent
    provides: Typed route apply and compiled context names (15-11)
provides:
  - Tenant-filtered live channel read via allow-listed CLI command
  - Bounded recent call events and owned-context compiled dialplan
  - Three read-only diagnostic tools and the evidence-order skill
affects:
  - 15-23 (diagnostics domain + skill enter the completeness inventory)
  - Agent routing-complaint answers (D-12, D-13)

actuals:
  tokens: 7900
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - Named diagnostic reads map to a fixed AMI CLI allow list; no command string from any caller
    - Shared switch output is filtered in-service from the tenant's contexts and endpoint ids
    - Diagnostic tools are read-only; truncation is reported, not silent

key-files:
  created:
    - packages/backend/src/modules/diagnostics/diagnostics.module.ts
    - packages/backend/src/modules/diagnostics/diagnostics.service.ts
    - packages/backend/src/modules/diagnostics/diagnostics.service.spec.ts
    - packages/backend/src/modules/diagnostics/diagnostics-ai.adapter.ts
    - packages/backend/src/modules/diagnostics/diagnostics-ai.adapter.spec.ts
    - packages/backend/src/skills/diagnostics/SKILL.md
  modified:
    - packages/backend/src/app.module.ts

key-decisions:
  - "Named operations only; AmiService.command never receives a caller-supplied string"
  - "Tenant filter is derived from ContextsService + EndpointsService because switch state has no tenant column"
  - "Event history reuses CdrService.findCalls (already tenant-scoped) with a 15-minute window and cap 20"
  - "Event dateFrom is ISO so the window is timezone-correct"

patterns-established:
  - "Pattern: diagnostic CLI is an allow-listed name → fixed command, then in-service tenant filter"
  - "Pattern: a cause names the supporting tool output; an absent or truncated list is not a cause"

requirements-completed: [D-12, D-13, D-15, D-22]

coverage:
  - id: D1
    description: Live channels via allow-listed command with derived tenant filter and reported cap (D-12, D-22)
    requirement: D-12
    verification:
      - kind: unit
        ref: packages/backend/src/modules/diagnostics/diagnostics.service.spec.ts#issues only the allow-listed live_channels command
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/diagnostics/diagnostics.service.spec.ts#two-tenant fixture: each tenant sees only its own live channels
        status: pass
    human_judgment: false
  - id: D2
    description: Unknown command names are refused before AMI (T-15-95)
    requirement: D-22
    verification:
      - kind: unit
        ref: packages/backend/src/modules/diagnostics/diagnostics.service.spec.ts#refuses a command name that is not on the allow list before reaching the switch
        status: pass
    human_judgment: false
  - id: D3
    description: Recent events are windowed and capped; compiled dialplan is ordered and ownership-checked (D-13)
    requirement: D-13
    verification:
      - kind: unit
        ref: packages/backend/src/modules/diagnostics/diagnostics.service.spec.ts#returns recent call events for the tenant within the bounded window and count
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/diagnostics/diagnostics.service.spec.ts#refuses a compiled dialplan read for a context the tenant does not own
        status: pass
    human_judgment: false
  - id: D4
    description: Adapter declares exactly three read tools and no mutating tool (D-15)
    requirement: D-15
    verification:
      - kind: unit
        ref: packages/backend/src/modules/diagnostics/diagnostics-ai.adapter.spec.ts#declares exactly three read tools and no mutating tool
        status: pass
    human_judgment: false
  - id: D5
    description: Diagnostics skill parses and prescribes evidence order with absent-evidence rule (D-12, D-13)
    requirement: D-13
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/agent-skill-registry.service.spec.ts#loads a non-empty catalog from the repository skills root
        status: pass
    human_judgment: false

duration: 16min
completed: 2026-09-04
status: complete
---

# Phase 15 Plan 19: Diagnostics Evidence Summary

**Allow-listed, tenant-filtered live channels, bounded CDR events and owned-context compiled dialplan as three read-only tools, plus the skill that forbids guessing a routing cause**

## Performance

- **Duration:** 16 min
- **Started:** 2026-09-04T15:56:00Z
- **Completed:** 2026-09-04T16:12:00Z
- **Tasks:** 3 (TDD RED/GREEN on 1–2)
- **Files modified:** 7

## Accomplishments

- Live channels issue only `core show channels concise`; hangup/reload/originate names are refused before AMI
- Two-tenant fixture: each tenant sees only channels whose context or endpoint id it owns; cap 25 reports `truncated`
- Recent events come from `CdrService.findCalls` (15-minute window, cap 20); compiled dialplan is `dialplan show` after ownership check, in evaluation order
- Adapter registers `get_live_channels`, `get_recent_call_events`, `get_compiled_dialplan` — no mutating tool
- Diagnostics skill sequences number → destination → schedule → compiled dialplan → events, then a named cause; absent or truncated lists are not a cause

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: live channel filter** - `2deb827` (test)
2. **Task 1 GREEN: allow list + tenant filter + module** - `60a4808` (feat)
3. **Task 2 RED: events, dialplan, adapter** - `6656d6c` (test)
4. **Task 2 GREEN: events, dialplan, read-only adapter** - `07a56b2` (feat)
5. **Task 3: diagnostics skill** - `e8c23f0` (feat)

**Plan metadata:** docs commit follows this file

_Note: TDD tasks have test → feat commits._

## Files Created/Modified

- `packages/backend/src/modules/diagnostics/diagnostics.service.ts` — named reads, allow list, derived tenant filter, caps
- `packages/backend/src/modules/diagnostics/diagnostics.service.spec.ts` — two-tenant fixture, refusal, bounds
- `packages/backend/src/modules/diagnostics/diagnostics-ai.adapter.ts` — three read tools; uid is a handler argument
- `packages/backend/src/modules/diagnostics/diagnostics-ai.adapter.spec.ts` — no mutating tool; call-time tenant
- `packages/backend/src/modules/diagnostics/diagnostics.module.ts` — AMI, contexts, endpoints, CDR, adapter
- `packages/backend/src/app.module.ts` — `DiagnosticsModule` import
- `packages/backend/src/skills/diagnostics/SKILL.md` — evidence order and absent-evidence rule

## Decisions Made

- **No command string from any caller.** Public API is `readLiveChannels` / `readRecentEvents` / `readCompiledDialplan`. `resolveDiagnosticCommand` maps a name to a fixed CLI string; unknown names throw before `ami.command`.
- **Filter is built, not assumed.** Switch output has no tenant column; membership is context name or PJSIP endpoint id from existing services.
- **Events reuse CDR.** There is no AMI event buffer; `CdrService.findCalls` is already tenant-scoped. Window 15 minutes, cap 20.
- **ISO `dateFrom`.** Naive `YYYY-MM-DD HH:mm:ss` without zone made `Date.parse` skew by the local offset; ISO keeps the window honest.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Event window dateFrom uses ISO**
- **Found during:** Task 2 GREEN
- **Issue:** SQL-shaped timestamp without timezone parsed as local time; the asserted 15-minute window looked like ~7 hours.
- **Fix:** Pass `dateFrom` as `toISOString()`; CDR already accepts timestamps longer than 10 characters.
- **Files modified:** `packages/backend/src/modules/diagnostics/diagnostics.service.ts`
- **Verification:** event-window unit test
- **Committed in:** `07a56b2`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Required for a correct time bound. No scope creep.

## Issues Encountered

- PowerShell cannot run bash heredoc commits; used `-F` message files under `.tmp/` (not staged).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for remaining Phase 15 plans. 15-23 completeness should treat `diagnostics` as a covered domain with this skill.
- Tools are read-only; do not add a command-string argument or a mutating AMI action here.

## TDD Gate Compliance

Plan frontmatter is `type: execute` with Tasks 1–2 `tdd="true"`. RED commits `2deb827`, `6656d6c` failed before implementation. GREEN commits `60a4808`, `07a56b2` passed. Task 3 is `type="auto"` without TDD.

## Verification

```
npm run test -w @krasterisk/backend -- --testPathPattern="diagnostics|agent-skill-registry" --no-coverage
```

21 passed (3 suites). Registry load includes `diagnostics`.

## Self-Check: PASSED

- FOUND: `packages/backend/src/modules/diagnostics/diagnostics.service.ts`
- FOUND: `packages/backend/src/modules/diagnostics/diagnostics-ai.adapter.ts`
- FOUND: `packages/backend/src/skills/diagnostics/SKILL.md`
- FOUND: `packages/backend/src/app.module.ts` (`DiagnosticsModule`)
- FOUND: commits `2deb827`, `60a4808`, `6656d6c`, `07a56b2`, `e8c23f0`

---
*Phase: 15-universal-pbx-ai-agent*
*Completed: 2026-09-04*
