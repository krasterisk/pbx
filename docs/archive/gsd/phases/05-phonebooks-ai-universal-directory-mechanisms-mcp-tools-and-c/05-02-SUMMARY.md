---
phase: 05-phonebooks-ai-universal-directory-mechanisms-mcp-tools-and-c
plan: 02
subsystem: api, ai
tags: [nestjs, mcp, ai-adapter, phonebooks, sequelize, audit-log]

# Dependency graph
requires:
  - phase: 05-01
    provides: DialplanApplyService (applyCategories/deleteCategories) used by delete_phonebook cleanup and update_route apply
  - phase: 05-05
    provides: route_phonebook_bindings table, RoutePhonebookBinding model, RoutesService bindings CRUD, RouteApplyService (applyContext/applyContextsForPhonebook/getAffectedContexts), ai_chat_settings table (via migrate-phonebooks-phase5.ts)
provides:
  - ai-platform module (AiToolDefinition/AiStateProvider/DomainAiAdapter contract + AiAdapterRegistryService), @Global
  - Cross-tenant MCP closure bug fixed (D-23) — handler signature (args, vpbxUserUid), uid always a call parameter
  - MCP audit logging into action_logs for every tool call (success/error) (D-19)
  - Per-tenant AI destructive-op confirmation settings (AiChatSettingsService, ai_chat_settings, default OFF) (D-20, D-25)
  - PhonebooksAiAdapter — 8 tools (list/create/update/delete_phonebook, add/remove_phonebook_entries, list_phonebook_entries, update_route), State summary, Knowledge block (D-11, D-12, D-15, D-16)
  - Generic webhook dispatch POST /api/ai-tools/call/:toolName for any Domain AI Adapter tool
affects: [05-03 (frontend bindings UI + AI chat settings UI), 05-04 (E2E/UAT of AI scenarios)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Domain AI Adapter contract (AiToolDefinition/AiStateProvider/DomainAiAdapter) — modules self-register via OnModuleInit into a @Global AiAdapterRegistryService; McpToolsService and AiWebhookController both dispatch through the same registry.getAllTools()/getToolByName(), so a tool defined once is callable from both MCP tools/call and the webhook"
    - "uid is always a handler call parameter, never captured via closure at registration time — the fix for D-23 and the invariant all new AiToolDefinition handlers must preserve"
    - "Confirmation gate is duplicated (by design, not accidentally) in two dispatch entry points — McpToolsService.callTool and AiWebhookController.callAdapterTool — since they are separate HTTP/JSON-RPC surfaces with no shared request pipeline"
    - "Per-tool destructive flag + per-tenant AiChatSettingsService.getSettings(uid).confirmDestructive, default OFF, checked before handler invocation; blocked responses are returned as text, not thrown errors"

key-files:
  created:
    - packages/backend/src/modules/ai-platform/ai-platform.module.ts
    - packages/backend/src/modules/ai-platform/ai-adapter.types.ts
    - packages/backend/src/modules/ai-platform/ai-adapter-registry.service.ts
    - packages/backend/src/modules/ai-platform/ai-adapter-registry.service.spec.ts
    - packages/backend/src/modules/ai-chat/ai-chat-settings.model.ts
    - packages/backend/src/modules/ai-chat/ai-chat-settings.service.ts
    - packages/backend/src/modules/ai-chat/ai-chat-settings.service.spec.ts
    - packages/backend/src/modules/phonebooks/phonebooks-ai.adapter.ts
    - packages/backend/src/modules/phonebooks/phonebooks-ai.adapter.spec.ts
  modified:
    - packages/backend/src/modules/mcp/mcp-tools.service.ts
    - packages/backend/src/modules/mcp/mcp-tools.service.spec.ts
    - packages/backend/src/modules/mcp/mcp.module.ts
    - packages/backend/src/modules/ai-chat/ai-chat.controller.ts
    - packages/backend/src/modules/ai-chat/ai-chat.module.ts
    - packages/backend/src/modules/ai-chat/ai-webhook.controller.ts
    - packages/backend/src/modules/ai-chat/pbx-context-builder.service.ts
    - packages/backend/src/modules/ai-chat/knowledge-base.service.ts
    - packages/backend/src/modules/phonebooks/phonebooks.module.ts

key-decisions:
  - "AiChatSettings stored per-tenant in a dedicated ai_chat_settings table (migrated in 05-05), NOT in global cloud_settings — locked decision D-25 overrides the earlier research suggestion of a global toggle"
  - "5 existing MCP domains (endpoints/trunks/ivrs/queues/routes/cdr/pbx) keep their hand-written McpToolsService.regXxx() methods — NOT migrated onto the Domain AI Adapter contract this phase (D-15); only Phonebooks uses the new contract, as the reference implementation"
  - "add_phonebook_entries/remove_phonebook_entries are implemented as read-merge-replaceAll against PhonebooksService.update() rather than adding new incremental methods to PhonebooksService — keeps phonebooks.service.ts out of this plan's file scope while still presenting an incremental API to the AI/LLM caller"
  - "list_phonebooks and buildSummary both query RoutePhonebookBinding directly (via @InjectModel) with a Route include for binding→route names, rather than adding a new PhonebooksService method — avoids widening PhonebooksService's public surface for an AI-only concern"
  - "KnowledgeBaseService.getDigest() computes adapter KB blocks on every call (not cached in onModuleInit) since adapter registration order relative to KnowledgeBaseService.onModuleInit is not guaranteed by Nest"

patterns-established:
  - "Domain AI Adapter reference implementation (PhonebooksAiAdapter) — future AI-integrated modules should follow the same shape: tools as private toolXxx() factory methods returning AiToolDefinition, a buildSummary(uid) State provider, a static getKnowledgeBlock()"

requirements-completed: [D-11, D-12, D-13, D-14, D-15, D-16, D-19, D-20, D-23, D-25]

# Metrics
duration: ~2h across 3 tasks (continuation session picked up after Task 1/2 were already committed; this session executed Task 3 fully with TDD RED/GREEN)
completed: 2026-07-14
---

# Phase 05 Plan 02: AI Platform — Domain Adapter, MCP Fixes, PhonebooksAiAdapter Summary

**Domain AI Adapter platform (AiToolDefinition/AiStateProvider/DomainAiAdapter + registry) built and proven with PhonebooksAiAdapter as the reference implementation — 8 tools, per-tenant confirmation gating, compact state summary, and a knowledge block — dispatched identically through both MCP `tools/call` and a new generic webhook endpoint, alongside a closed cross-tenant MCP closure bug and action_logs audit trail for every MCP/webhook tool call.**

## Performance

- **Tasks:** 3/3 completed
- **Files created:** 9
- **Files modified:** 9
- **Completed:** 2026-07-14

## Accomplishments

- **Task 1 (D-14, D-19, D-23):** New `ai-platform` module with `AiToolDefinition`/`AiStateProvider`/`DomainAiAdapter` contracts and `AiAdapterRegistryService` (`@Global()`). Fixed the MCP cross-tenant closure bug: every `McpToolsService.regXxx()` handler now receives `vpbxUserUid` as a call parameter instead of closing over it at registration time; a regression test calls `create_trunk` for two tenants in a row and asserts each call reaches the service with its own uid. Every `callTool()` invocation (success and error) now writes a truncated (`~200 char`) audit entry to `action_logs` via `LoggerService.logAction`, fire-and-forget so a logging failure never breaks the tool response.
- **Task 2 (D-20, D-25):** New `AiChatSettings` model/service (`ai_chat_settings`, `user_uid` unique, `confirm_destructive` default 0) with `GET`/`PUT /api/ai-chat/settings`. `McpToolsService.callTool` gates destructive tools (5 legacy deletes + any registry tool with `destructive: true`) behind the tenant's `confirmDestructive` setting: blocked without `confirm: true` when enabled, executed immediately when disabled (default). `pbx-context-builder.service.ts` adds a system-prompt rule when confirmations are enabled.
- **Task 3 (D-11, D-12, D-15, D-16) — this session:** `PhonebooksAiAdapter` implements the Domain AI Adapter contract with 8 tools (`list_phonebooks`, `create_phonebook`, `update_phonebook`, `delete_phonebook`, `add_phonebook_entries`, `remove_phonebook_entries`, `list_phonebook_entries`, `update_route`). `delete_phonebook`, `remove_phonebook_entries`, and `update_route` are marked `destructive: true` and subject to the same per-tenant confirmation gate as legacy tools. `update_route` replaces bindings and calls `RouteApplyService.applyContext` for both the new and (if changed) the old context. A `buildSummary(uid)` state provider folds a compact per-tenant phonebook block (name, description, entries count, bindings with route name/behavior/match_mode — no full entries, Pitfall 10) into the AI system prompt via `PbxContextBuilderService`. A static `getKnowledgeBlock()` (14 lines: data+binding model, 7 presets, ordering rule, match_mode semantics) is appended to `KnowledgeBaseService.getDigest()`, and the stale "contact DB, search by name" Phonebooks blurb in `operatorKnowledge` was corrected to describe the CallerID-policy model. A new generic `POST /api/ai-tools/call/:toolName` endpoint in `AiWebhookController` dispatches any registry tool with the same confirmation gate and audit-log pattern as MCP, leaving the 7 existing hand-written webhook endpoints untouched.

## Task Commits

Each task was committed atomically (TDD: test → feat, per task):

1. **Task 1: ai-platform skeleton, MCP cross-tenant fix, audit logging (D-14, D-19, D-23)** - `e0143dd` (feat) — completed in a prior session
2. **Task 2: Per-tenant AI destructive-op confirmation settings (D-20, D-25)** - `8a7eaa2` (feat) — completed in a prior session
3. **Task 3: PhonebooksAiAdapter reference implementation (D-11, D-12, D-15, D-16)** - RED `466fe71` (test) → GREEN `d60457d` (feat) → integration `b405b9d` (feat) — this session

**Plan metadata:** this commit (docs: complete plan)

## Files Created/Modified

- `packages/backend/src/modules/ai-platform/ai-adapter.types.ts` - `AiToolDefinition`/`AiStateProvider`/`DomainAiAdapter` contracts
- `packages/backend/src/modules/ai-platform/ai-adapter-registry.service.ts` - Central registry: `register`/`getAllTools`/`getStateProviders`/`getKnowledgeBlocks`/`getToolByName`
- `packages/backend/src/modules/ai-platform/ai-platform.module.ts` - `@Global()` module exporting the registry
- `packages/backend/src/modules/mcp/mcp-tools.service.ts` - Cross-tenant fix (uid as call param), audit logging, registry integration in `registerAll()`, confirmation gate in `callTool()`
- `packages/backend/src/modules/mcp/mcp.module.ts` - Imports `AiPlatformModule`, `LoggerModule`
- `packages/backend/src/modules/ai-chat/ai-chat-settings.model.ts` / `.service.ts` - Per-tenant `confirm_destructive` settings, default OFF
- `packages/backend/src/modules/ai-chat/ai-chat.controller.ts` - `GET`/`PUT /ai-chat/settings`
- `packages/backend/src/modules/ai-chat/ai-chat.module.ts` - Registers `AiChatSettings` model/service
- `packages/backend/src/modules/phonebooks/phonebooks-ai.adapter.ts` - **New.** 8 tools, `buildSummary`, `getKnowledgeBlock`, self-registers via `OnModuleInit`
- `packages/backend/src/modules/phonebooks/phonebooks-ai.adapter.spec.ts` - **New.** 22 tests: tool composition/destructive flags, tenant isolation, update_route+bindings+apply, confirmation-gate interaction, buildSummary compactness, incremental add/remove entries, delete cleanup, entries search/limit, KB block shape
- `packages/backend/src/modules/phonebooks/phonebooks.module.ts` - Registers `PhonebooksAiAdapter` provider, imports `AiPlatformModule`
- `packages/backend/src/modules/ai-chat/pbx-context-builder.service.ts` - `buildState()` aggregates `registry.getStateProviders()` summaries into `PbxStateDto.adapterSummaries`, injected into the system prompt
- `packages/backend/src/modules/ai-chat/knowledge-base.service.ts` - `getDigest()` dynamically appends `registry.getKnowledgeBlocks()`; fixed stale Phonebooks blurb
- `packages/backend/src/modules/ai-chat/ai-webhook.controller.ts` - New generic `POST /api/ai-tools/call/:toolName` dispatch (confirmation gate + audit log), 7 existing endpoints untouched

## Decisions Made

See `key-decisions` in frontmatter. The most consequential: `add_phonebook_entries`/`remove_phonebook_entries` deliberately stay out of `phonebooks.service.ts` (not in this plan's file scope) by doing a read-then-replaceAll against the existing `PhonebooksService.update()` — functionally incremental to the AI caller, implemented via the existing replace-all primitive.

## Deviations from Plan

None — Task 3 executed as written. Test 1b's behavior ("update_route without confirm=true is blocked, does not call routesService") is verified in `phonebooks-ai.adapter.spec.ts` via a small local gate harness that mirrors `McpToolsService.callTool`'s exact gate condition (`tool.destructive && args.confirm !== true && confirmDestructive`) — this avoids re-testing `McpToolsService`'s gate logic itself (already covered generically for `delete_trunk` in `mcp-tools.service.spec.ts`) while still proving `update_route`'s `destructive` flag interacts correctly with a gate consumer.

## Issues Encountered

None. Backend runs on Windows/PowerShell — `&&` command chaining is unsupported by the shell in this environment; commands were run sequentially or via the `working_directory` parameter instead.

## User Setup Required

None for code review. The `ai_chat_settings` table migration (`migrate-phonebooks-phase5.ts`) was already flagged as not-yet-run against any live database in 05-05's summary — still applies here since `AiChatSettingsService`/`PhonebooksAiAdapter` depend on it.

## Next Phase Readiness

- `npm run test:backend` — **237/237 tests pass** (23 suites), no regressions.
- `npm run lint` — **0 errors** (83 pre-existing frontend warnings, unrelated to this plan).
- MCP `tools/list` exposes 18 legacy tools + 8 `PhonebooksAiAdapter` tools (26 total); `list_phonebooks` and `update_route` present.
- `action_logs` receives `mcp:*` (MCP) and `webhook:*` (generic webhook) entries for every adapter tool call.
- Plan 05-03 (frontend: RouteFormModal bindings tab, AI Chat settings UI, PhonebookFormModal cleanup) can now build on: the bindings CRUD API (05-05), `GET/PUT /ai-chat/settings` (this plan), and the generic `POST /api/ai-tools/call/:toolName` dispatch if the frontend AI widget ever needs direct tool invocation outside the chat SSE flow.
- Plan 05-04 (E2E/UAT) can exercise `update_route` with bindings end-to-end and the confirmation-gate UX with a real chat session.

---
*Phase: 05-phonebooks-ai-universal-directory-mechanisms-mcp-tools-and-c*
*Completed: 2026-07-14*

## Self-Check: PASSED

All 9 created files verified present on disk. All 5 task commit hashes (`e0143dd`, `8a7eaa2`, `466fe71`, `d60457d`, `b405b9d`) verified present in `git log --all`. `npm run test:backend` — 237/237 passed, 23 suites. `npm run lint` — 0 errors, 83 pre-existing frontend warnings unrelated to this plan.
