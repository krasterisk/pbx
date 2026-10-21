---
phase: 15-universal-pbx-ai-agent
plan: 15
subsystem: api
tags: [mcp, d-11, d-16, d-27, d-28, cutover, jwt]

requires:
  - phase: 15-universal-pbx-ai-agent
    provides: Adapter-over-handwritten precedence and eighteen-name inventory (15-07)
  - phase: 15-universal-pbx-ai-agent
    provides: In-process agent loop; chat proxy deleted (15-08)
provides:
  - Zero handwritten MCP registrations; dispatch is adapter-only
  - Token-only tenant on /api/mcp; service token plus tenant header rejected
  - Startup fail-fast for CC_AI_KEY_SECRET outside development
affects:
  - 15-23 (convention + coverage test owns the full new-module rule)
  - External JWT callers of /api/mcp

actuals:
  tokens: 30624
  tasks: 4
  commits: 7

tech-stack:
  added: []
  patterns:
    - McpToolsService adopts registry tools only; no handwritten reg()
    - External MCP entry uses JwtAuthGuard; session bound to establishing tenant
    - CC_AI_KEY_SECRET missing fails startup except NODE_ENV=development

key-files:
  created:
    - packages/backend/src/modules/mcp/mcp.controller.spec.ts
    - packages/backend/src/app.module.spec.ts
  modified:
    - packages/backend/src/modules/mcp/mcp-tools.service.ts
    - packages/backend/src/modules/mcp/mcp-tools.service.spec.ts
    - packages/backend/src/modules/mcp/mcp.controller.ts
    - packages/backend/src/modules/mcp/mcp-session.service.ts
    - packages/backend/src/modules/ai-chat/ai-chat.module.ts
    - packages/backend/src/app.module.ts
    - packages/backend/package.json
    - packages/backend/.idea/ARCHITECTURE.md
  deleted:
    - packages/backend/src/modules/ai-chat/ai-webhook.controller.ts
    - packages/backend/src/modules/ai-chat/knowledge-base.service.ts

key-decisions:
  - "aiPBX mcpServers callback (KRASTERISK_SERVICE_TOKEN + X-Vpbx-User-Uid) is deliberately switched off. Krasterisk now runs its own in-process agent loop (D-06 / 15-08). aiPBX and other external APIs remain LLM providers via cc_ai_providers / OpenAI-compatible chat completions — they are not tool orchestrators. Breaking the header path is expected. /api/mcp stays for future JWT callers. User confirmed 2026-09-04: will use various external LLM APIs including aiPBX as model providers, not as MCP brains."
  - "Handwritten registrations and the 15-07 precedence shim are gone; leftover names in MCP without an adapter fail the inventory"
  - "Valid JWT plus contradicting tenant header keeps the token tenant"
  - "CC_AI_KEY_SECRET fail-fast outside development names the variable"

patterns-established:
  - "Pattern: tools exist only if an adapter declared them"
  - "Pattern: MCP session id cannot be resumed under another tenant"

requirements-completed: [D-11, D-27, D-28]

coverage:
  - id: D1
    description: Zero handwritten tool registrations remain; precedence shim is gone (D-27)
    requirement: D-27
    verification:
      - kind: unit
        ref: packages/backend/src/modules/mcp/mcp-tools.service.spec.ts#registers no tools of its own
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/legacy-tool-migration.spec.ts#reports adapter-served or retired and fails on a leftover handwritten name
        status: pass
    human_judgment: false
  - id: D2
    description: Alternative tool-dispatch controller is deleted so the confirmation gate cannot be bypassed (D-27)
    requirement: D-27
    verification:
      - kind: unit
        ref: packages/backend/src/modules/mcp/mcp-tools.service.spec.ts#no source file imports deleted knowledge or webhook symbols
        status: pass
    human_judgment: false
  - id: D3
    description: External /api/mcp takes tenant only from the caller JWT; service token plus tenant header is rejected (D-28)
    requirement: D-28
    verification:
      - kind: unit
        ref: packages/backend/src/modules/mcp/mcp.controller.spec.ts#rejects a service token plus tenant header
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/mcp/mcp.controller.spec.ts#dispatches a valid user token with that token tenant
        status: pass
    human_judgment: false
  - id: D4
    description: Valid JWT plus contradicting tenant header uses the token tenant
    requirement: D-28
    verification:
      - kind: unit
        ref: packages/backend/src/modules/mcp/mcp.controller.spec.ts#ignores a contradicting tenant header and keeps the token tenant
        status: pass
    human_judgment: false
  - id: D5
    description: Nothing reads knowledge from the ignored documentation directory (D-11)
    requirement: D-11
    verification:
      - kind: unit
        ref: packages/backend/src/modules/mcp/mcp-tools.service.spec.ts#no source file imports deleted knowledge or webhook symbols
        status: pass
    human_judgment: false
  - id: D6
    description: Narrow agent test command covers platform, chat and external-entry modules
    verification:
      - kind: unit
        ref: packages/backend/src/app.module.spec.ts#narrow test:ai pattern covers platform, chat and external-entry modules
        status: pass
    human_judgment: false
  - id: D7
    description: Startup fails outside development if CC_AI_KEY_SECRET is missing
    requirement: D-16
    verification:
      - kind: unit
        ref: packages/backend/src/app.module.spec.ts#fails at startup outside development when the secret is missing
        status: pass
    human_judgment: false

duration: 75min
completed: 2026-09-04
status: complete
---

# Phase 15 Plan 15: Hard Migration Cutover Summary

**Handwritten MCP tools and both bypass paths deleted; /api/mcp is JWT-only with session-bound tenant; CC_AI_KEY_SECRET fails fast outside development**

## Performance

- **Duration:** 75 min
- **Started:** 2026-09-04T15:38:00Z
- **Completed:** 2026-09-04T16:53:00Z
- **Tasks:** 4 (checkpoint + 3 implementation)
- **Files modified:** 14

## Accomplishments

- Eighteen handwritten registrations and the 15-07 skip shim are gone; registry size equals adapter declarations
- `AiWebhookController` and `KnowledgeBaseService` deleted; prompt knowledge stays on adapters + versioned skills
- `/api/mcp` uses `JwtAuthGuard`; tenant from the token; contradicting header ignored; service-token path rejected
- MCP session id is bound to the establishing tenant; cross-tenant resume is 401
- `test:ai` includes `mcp`; architecture notes no longer tell contributors to register tools by hand
- Missing `CC_AI_KEY_SECRET` throws at startup except in development (warn + fallback)

## External service

aiPBX mcpServers callback (KRASTERISK_SERVICE_TOKEN + X-Vpbx-User-Uid) is deliberately switched off. Krasterisk now runs its own in-process agent loop (D-06 / 15-08). aiPBX and other external APIs remain LLM providers via cc_ai_providers / OpenAI-compatible chat completions — they are not tool orchestrators. Breaking the header path is expected. /api/mcp stays for future JWT callers. User confirmed 2026-09-04: will use various external LLM APIs including aiPBX as model providers, not as MCP brains.

## Task Commits

Each task was committed atomically:

1. **Checkpoint: external service tool-server** — recorded in this SUMMARY (no code commit; human confirmed 2026-09-04)
2. **Task 1 RED: handwritten cutover** - `0d1f324` (test)
3. **Task 1 GREEN: delete registrations and bypasses** - `82bbfdd` (feat)
4. **Task 2 RED: token-only tenant** - `49d8ae4` (test)
5. **Task 2 GREEN: JwtAuthGuard + session bind** - `713be8e` (feat)
6. **Task 3: fail-fast, test:ai, architecture notes** - `e2e9e78` (feat)

**Plan metadata:** docs commit follows this file

_Note: TDD tasks have test → feat commits._

## Files Created/Modified

- `packages/backend/src/modules/mcp/mcp-tools.service.ts` — adapter adopt only; sanitizeArgs + callTool remain
- `packages/backend/src/modules/mcp/mcp-tools.service.spec.ts` — four end-state assertions
- `packages/backend/src/modules/ai-platform/legacy-tool-migration.spec.ts` — leftover handwritten fails
- `packages/backend/src/modules/ai-chat/ai-chat.module.ts` — webhook and knowledge service unregistered
- `packages/backend/src/modules/ai-chat/ai-webhook.controller.ts` — deleted
- `packages/backend/src/modules/ai-chat/knowledge-base.service.ts` — deleted
- `packages/backend/src/modules/mcp/mcp.controller.ts` — JwtAuthGuard
- `packages/backend/src/modules/mcp/mcp.controller.spec.ts` — D-28 cases
- `packages/backend/src/modules/mcp/mcp-session.service.ts` — tenant-bound Mcp-Session-Id
- `packages/backend/src/app.module.ts` — `assertProviderKeySecret`
- `packages/backend/src/app.module.spec.ts` — fail-fast + test:ai pattern
- `packages/backend/package.json` — `test:ai` includes `mcp` (version unchanged)
- `packages/backend/.idea/ARCHITECTURE.md` — adapter+skill rule, JWT-only MCP, audit locations

## Decisions Made

- **aiPBX as model provider, not MCP brain.** Verbatim user confirmation 2026-09-04: "aiPBX mcpServers callback (KRASTERISK_SERVICE_TOKEN + X-Vpbx-User-Uid) is deliberately switched off. Krasterisk now runs its own in-process agent loop (D-06 / 15-08). aiPBX and other external APIs remain LLM providers via cc_ai_providers / OpenAI-compatible chat completions — they are not tool orchestrators. Breaking the header path is expected. /api/mcp stays for future JWT callers. User confirmed 2026-09-04: will use various external LLM APIs including aiPBX as model providers, not as MCP brains."
- **Constructor deps kept** on `McpToolsService` so out-of-plan adapter specs keep compiling; unused params are unprefixed fields no longer stored.
- **Inventory `absent`** is valid for migrate names the fixture did not register — leftover-in-MCP is the failure.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Session bind lives in McpSessionService**
- **Found during:** Task 2
- **Issue:** Plan file list omitted `mcp-session.service.ts`, but cross-tenant resume cannot be enforced without a session map.
- **Fix:** Store `Mcp-Session-Id → tenant` and throw `UnauthorizedException` on mismatch.
- **Files modified:** `packages/backend/src/modules/mcp/mcp-session.service.ts`
- **Verification:** mcp.controller.spec resume test
- **Committed in:** `713be8e`

**2. [Rule 1 - Bug] Banned-symbol scan hit comments and the spec itself**
- **Found during:** Task 1 GREEN
- **Issue:** `dialplan-apply.service.ts` still named the deleted webhook file; the spec file names the symbols it forbids.
- **Fix:** Drop the comment mention; exclude `*.spec.ts` from the walk.
- **Files modified:** `packages/backend/src/modules/ami/dialplan-apply.service.ts`, `mcp-tools.service.spec.ts`
- **Verification:** absence assertion green
- **Committed in:** `82bbfdd`

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Required for D-28 session bind and a verifiable deletion assertion. No scope creep.

## Issues Encountered

- PowerShell cannot run bash heredoc commits; used `-F` message files under `.tmp/` (not staged).
- `packages/backend/.idea/` is gitignored; `ARCHITECTURE.md` is already tracked and staged without `-f`.

## User Setup Required

None — the aiPBX tool-server callback is deliberately switched off (see External service). No dashboard repoint. JWT callers of `/api/mcp` need a per-tenant user token.

## Next Phase Readiness

- Ready for remaining Phase 15 plans (15-19 / 15-22+). 15-23 still owns the full D-16 convention text and coverage test.
- `/api/mcp` remains for future JWT tool clients; do not restore the service-token header path.

## TDD Gate Compliance

Plan frontmatter is `type: execute` with Tasks 1–2 `tdd="true"`. RED commits `0d1f324`, `49d8ae4` failed before implementation. GREEN commits `82bbfdd`, `713be8e` passed. Task 3 is `type="auto"` without TDD.

## Verification

```
npm run test -w @krasterisk/backend -- --testPathPattern="mcp-tools|mcp.controller|legacy-tool-migration|app.module" --no-coverage
```

52 passed (4 suites).

## Self-Check: PASSED

- FOUND: `packages/backend/src/modules/mcp/mcp-tools.service.ts` (no handwritten `reg(`)
- FOUND: `packages/backend/src/modules/mcp/mcp.controller.ts` (`JwtAuthGuard`)
- FOUND: `packages/backend/src/app.module.ts` (`assertProviderKeySecret`)
- MISSING (intentional): `packages/backend/src/modules/ai-chat/ai-webhook.controller.ts`
- MISSING (intentional): `packages/backend/src/modules/ai-chat/knowledge-base.service.ts`
- FOUND: commits `0d1f324`, `82bbfdd`, `49d8ae4`, `713be8e`, `e2e9e78`

---
*Phase: 15-universal-pbx-ai-agent*
*Completed: 2026-09-04*
