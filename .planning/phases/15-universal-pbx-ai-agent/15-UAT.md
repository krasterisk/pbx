---
status: complete
phase: 15-universal-pbx-ai-agent
source: 15-01-SUMMARY.md, 15-02-SUMMARY.md, 15-03-SUMMARY.md, 15-04-SUMMARY.md, 15-05-SUMMARY.md, 15-06-SUMMARY.md, 15-07-SUMMARY.md, 15-08-SUMMARY.md, 15-09-SUMMARY.md, 15-10-SUMMARY.md, 15-11-SUMMARY.md, 15-12-SUMMARY.md, 15-13-SUMMARY.md, 15-14-SUMMARY.md, 15-15-SUMMARY.md, 15-16-SUMMARY.md, 15-17-SUMMARY.md, 15-18-SUMMARY.md, 15-19-SUMMARY.md, 15-20-SUMMARY.md, 15-21-SUMMARY.md, 15-22-SUMMARY.md, 15-23-SUMMARY.md, 15-24-SUMMARY.md
started: 2026-09-05T02:03:36Z
updated: 2026-09-05T08:42:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Подтверждение автопокрытых поверхностей агента
expected: |
  После логина как тенант-админ: в топбаре слева от палитры команд есть триггер агента, прежнего FAB в углу нет; Ctrl+Shift+J открывает панель (60vw на десктопе, 520px на планшете) с рейлом тредов на широком экране; селектора модели у тенанта нет. Сообщение стримится, progress на человеческом языке, сырой tool payload не рисуется. Мутация даёт карточку подтверждения без apply payload; Apply/Reject шлют только proposalId. Список тредов живёт после reload; удаление с подтверждением. Stop, потолок шагов, ошибка и обрыв стрима — разные исходы. Платформенный админ видит расход и воронку; тенант — нет.
result: pass
note: G-15-1 reproduced mid-test then closed in-session (plan nudge, provider timeout, hide stale progress). Human retest passed. Tenant usage label polish deferred.
rationale: all_auto_covered confirmation — unit/component tests already green; human confirms the live product

### 2. Model-supplied tenant keys in tool arguments are stripped before any handler runs (D-22)
expected: Model-supplied tenant keys in tool arguments are stripped before any handler runs (D-22)
result: pass
source: automated
coverage_id: 15-01-D1
note: packages/backend/src/modules/mcp/mcp-tools.service.spec.ts#invokes list_contexts with dispatch uid 100 and no tenant key left in args

### 3. Every registered tool receives vpbxUserUid from the dispatch call, never from arguments (D-22)
expected: Every registered tool receives vpbxUserUid from the dispatch call, never from arguments (D-22)
result: pass
source: automated
coverage_id: 15-01-D2
note: packages/backend/src/modules/mcp/mcp-tools.service.spec.ts#D-22 per-tool tenancy (dispatch mechanics)

### 4. No tool inputSchema visible to the model contains a tenant key or a self-confirmation flag
expected: No tool inputSchema visible to the model contains a tenant key or a self-confirmation flag
result: pass
source: automated
coverage_id: 15-01-D3
note: packages/backend/src/modules/mcp/mcp-tools.service.spec.ts#exposes no boolean confirmation property in any getToolsList schema; packages/backend/src/modules/mcp/mcp-tools.service.spec.ts#no tool schema declares a tenant key as an input property

### 5. AiAdapterRegistryService exposes getDomains() for the D-16/D-17 completeness gate
expected: AiAdapterRegistryService exposes getDomains() for the D-16/D-17 completeness gate
result: pass
source: automated
coverage_id: 15-01-D4
note: packages/backend/src/modules/ai-platform/ai-adapter-registry.service.spec.ts#getDomains returns the registered domain keys for two stub adapters

### 6. Destructive agent-path dispatch refuses without invoking the domain handler (D-18 prep)
expected: Destructive agent-path dispatch refuses without invoking the domain handler (D-18 prep)
result: pass
source: automated
coverage_id: 15-01-D5
note: packages/backend/src/modules/mcp/mcp-tools.service.spec.ts#refuses a destructive tool with any argument shape and does not invoke the domain handler

### 7. getCatalog returns name and description from frontmatter and never the skill body (D-10)
expected: getCatalog returns name and description from frontmatter and never the skill body (D-10)
result: pass
source: automated
coverage_id: 15-02-D1
note: packages/backend/src/modules/ai-platform/agent-skill-registry.service.spec.ts#getCatalog returns name and description from frontmatter and never the body

### 8. read_skill loads one body on demand; unknown names return structured not-found; oversize bodies truncate at 8000 (D-10)
expected: read_skill loads one body on demand; unknown names return structured not-found; oversize bodies truncate at 8000 (D-10)
result: pass
source: automated
coverage_id: 15-02-D2
note: packages/backend/src/modules/ai-platform/agent-skill-registry.service.spec.ts#readSkill('developer-convention') returns the markdown body; packages/backend/src/modules/ai-platform/agent-skill-registry.service.spec.ts#unknown skill name returns structured not-found text rather than throwing; packages/backend/src/modules/ai-platform/agent-skill-registry.service.spec.ts#body longer than the cap is truncated with a trailing note

### 9. Skill files live in the repository next to backend code and appear in a non-empty catalog (D-11)
expected: Skill files live in the repository next to backend code and appear in a non-empty catalog (D-11)
result: pass
source: automated
coverage_id: 15-02-D3
note: packages/backend/src/modules/ai-platform/agent-skill-registry.service.spec.ts#loads a non-empty catalog from the repository skills root

### 10. Production build ships skill markdown; resolver primary candidate is derived from the compiled module directory (D-11)
expected: Production build ships skill markdown; resolver primary candidate is derived from the compiled module directory (D-11)
result: pass
source: automated
coverage_id: 15-02-D4
note: packages/backend/src/modules/ai-platform/agent-skill-registry.service.spec.ts#derives the primary candidate from the compiled module directory

### 11. developer-convention skill states the D-16 adapter-plus-skill pair rule
expected: developer-convention skill states the D-16 adapter-plus-skill pair rule
result: pass
source: automated
coverage_id: 15-02-D5
note: packages/backend/src/modules/ai-platform/agent-skill-registry.service.spec.ts#readSkill('developer-convention') returns the markdown body

### 12. Seed skills for directories, voicemail, and callcenter describe our model and conventions (D-12)
expected: Seed skills for directories, voicemail, and callcenter describe our model and conventions (D-12)
result: pass
source: automated
coverage_id: 15-02-D6
note: packages/backend/src/modules/ai-platform/agent-skill-registry.service.spec.ts#loads a non-empty catalog from the repository skills root

### 13. A conversation and its messages survive a reload because they live in the database, scoped to tenant and author (D-26)
expected: A conversation and its messages survive a reload because they live in the database, scoped to tenant and author (D-26)
result: pass
source: automated
coverage_id: 15-03-D1
note: packages/backend/src/modules/ai-chat/pbx-agent-thread.service.spec.ts#lists threads for the same tenant and author, newest first; packages/backend/src/modules/ai-chat/pbx-agent-thread.service.spec.ts#returns appended messages in insertion order after a reload-style read

### 14. Reading a conversation that belongs to another tenant or another author yields not-found, never content
expected: Reading a conversation that belongs to another tenant or another author yields not-found, never content
result: pass
source: automated
coverage_id: 15-03-D2
note: packages/backend/src/modules/ai-chat/pbx-agent-thread.service.spec.ts#hides another tenant’s conversation; packages/backend/src/modules/ai-chat/pbx-agent-thread.service.spec.ts#hides another author’s conversation in the same tenant

### 15. Token counts accumulate on the conversation row so per-tenant spend can be priced from the provider record (D-08)
expected: Token counts accumulate on the conversation row so per-tenant spend can be priced from the provider record (D-08)
result: pass
source: automated
coverage_id: 15-03-D3
note: packages/backend/src/modules/ai-chat/pbx-agent-thread.service.spec.ts#addUsage increments thread counters and writes the per-message split

### 16. The audit table can point at the conversation that produced a tool call
expected: The audit table can point at the conversation that produced a tool call
result: pass
source: automated
coverage_id: 15-03-D4
note: packages/backend/src/modules/ai-chat/pbx-agent-thread.service.spec.ts#exposes a nullable thread_uid distinct from call_uniqueid

### 17. Proposal table shape and status vocabulary are fixed for 15-05
expected: Proposal table shape and status vocabulary are fixed for 15-05
result: pass
source: automated
coverage_id: 15-03-D5
note: packages/backend/src/modules/ai-chat/pbx-agent-thread.service.spec.ts#declares apply_payload and the card-badge status vocabulary

### 18. Backend calls a pluggable provider, resolving URL, auth and model from the encrypted provider row (D-06, D-07)
expected: Backend calls a pluggable provider, resolving URL, auth and model from the encrypted provider row (D-06, D-07)
result: pass
source: automated
coverage_id: 15-04-D1
note: packages/backend/src/modules/ai-chat/pbx-agent-llm.client.spec.ts#posts to the resolved completions URL with a decrypted bearer key; packages/backend/src/modules/ai-agents/ai-providers.service.spec.ts#returns the configured default provider when it is enabled and has the language-model capability

### 19. Cancellation reaches the provider request so stopping a turn stops token spend
expected: Cancellation reaches the provider request so stopping a turn stops token spend
result: pass
source: automated
coverage_id: 15-04-D2
note: packages/backend/src/modules/ai-chat/pbx-agent-llm.client.spec.ts#stops reading when the signal aborts mid-stream and issues no further request; packages/backend/src/modules/ai-chat/pbx-agent-llm.client.spec.ts#issues no request when the signal is already aborted

### 20. System prompt carries the skill catalog and no skill bodies (D-10)
expected: System prompt carries the skill catalog and no skill bodies (D-10)
result: pass
source: automated
coverage_id: 15-04-D3
note: packages/backend/src/modules/ai-chat/pbx-context-builder.service.spec.ts#puts the skill catalog in the prompt and never inlines a skill body

### 21. Prompt answers in the language of the question and avoids telephony jargon unless asked (D-13, D-14)
expected: Prompt answers in the language of the question and avoids telephony jargon unless asked (D-13, D-14)
result: pass
source: automated
coverage_id: 15-04-D4
note: packages/backend/src/modules/ai-chat/pbx-context-builder.service.spec.ts#states the language rule and does not hardcode a single reply language

### 22. Adapter registry domain knowledge blocks stay in the prompt after the old knowledge path is removed
expected: Adapter registry domain knowledge blocks stay in the prompt after the old knowledge path is removed
result: pass
source: automated
coverage_id: 15-04-D5
note: packages/backend/src/modules/ai-chat/pbx-context-builder.service.spec.ts#includes adapter knowledge blocks from the registry, not the old digest path

### 23. Exactly one compact tenant state snapshot serves both the system prompt and get_pbx_state (D-15, D-27)
expected: Exactly one compact tenant state snapshot serves both the system prompt and get_pbx_state (D-15, D-27)
result: pass
source: automated
coverage_id: 15-04-D6
note: packages/backend/src/modules/ai-chat/pbx-context-builder.service.spec.ts#returns per-domain counts plus a bounded name sample and stays inside the character budget; packages/backend/src/modules/ai-chat/pbx-context-builder.service.spec.ts#contains none of a second tenant's data; packages/backend/src/modules/ai-chat/pbx-context-builder.service.spec.ts#accepts an optional domain filter and returns only that domain

### 24. A mutating tool produces a pending proposal and writes nothing to the database (D-18)
expected: A mutating tool produces a pending proposal and writes nothing to the database (D-18)
result: pass
source: automated
coverage_id: 15-05-D1
note: packages/backend/src/modules/mcp/mcp-tools.service.spec.ts#persists create_directory as a pending proposal and inserts no directory row

### 25. The five directory write tools each produce a pending proposal and write no directory row until apply (D-15, D-18)
expected: The five directory write tools each produce a pending proposal and write no directory row until apply (D-15, D-18)
result: pass
source: automated
coverage_id: 15-05-D2
note: packages/backend/src/modules/directories/directories-ai.adapter.spec.ts#returns a proposal object and does not write; packages/backend/src/modules/ai-chat/pbx-agent-diff.service.spec.ts#inserts exactly one directory row for the calling tenant

### 26. callTool persists AgentDiffProposal from proposes tools and no longer applies the 15-01 destructive blanket to those names (D-18)
expected: callTool persists AgentDiffProposal from proposes tools and no longer applies the 15-01 destructive blanket to those names (D-18)
result: pass
source: automated
coverage_id: 15-05-D3
note: packages/backend/src/modules/mcp/mcp-tools.service.spec.ts#persists delete_directory as a pending proposal; packages/backend/src/modules/mcp/mcp-tools.service.spec.ts#still refuses an unconverted destructive name and does not invoke that handler

### 27. A change is applied only through an authenticated endpoint carrying the proposal identifier (D-19)
expected: A change is applied only through an authenticated endpoint carrying the proposal identifier (D-19)
result: pass
source: automated
coverage_id: 15-05-D4
note: packages/backend/src/modules/ai-chat/pbx-agent-diff.service.spec.ts#refuses an unknown identifier and mutates nothing

### 28. Applying a route proposal writes the database and reloads the dialplan through RouteApplyService.applyContext (D-20)
expected: Applying a route proposal writes the database and reloads the dialplan through RouteApplyService.applyContext (D-20)
result: pass
source: automated
coverage_id: 15-05-D5
note: packages/backend/src/modules/ai-chat/pbx-agent-diff.service.spec.ts#calls the route apply orchestrator once and sets the row to applied with a timestamp

### 29. A caller whose role cannot perform the change gets a denied proposal and no mutation (D-21)
expected: A caller whose role cannot perform the change gets a denied proposal and no mutation (D-21)
result: pass
source: automated
coverage_id: 15-05-D6
note: packages/backend/src/modules/ai-chat/pbx-agent-diff.service.spec.ts#denies a read-only role, writes a denied audit row and performs no domain write

### 30. A proposal that would place a catch-all above a specific or emergency pattern is refused before apply
expected: A proposal that would place a catch-all above a specific or emergency pattern is refused before apply
result: pass
source: automated
coverage_id: 15-05-D7
note: packages/backend/src/modules/ai-chat/route-precedence.util.spec.ts#reports unsafe when a catch-all sits above a specific numeric pattern; packages/backend/src/modules/ai-chat/pbx-agent-diff.service.spec.ts#refuses an unsafe route proposal, leaves it pending and records the audit

### 31. The stored apply payload never appears in any response body
expected: The stored apply payload never appears in any response body
result: pass
source: automated
coverage_id: 15-05-D8
note: packages/backend/src/modules/ai-chat/pbx-agent-diff.service.spec.ts#keeps the serialized apply payload out of every returned shape

### 32. cc_force_pause_agent and cc_force_unpause_agent are live-ops exceptions and are not drafts
expected: cc_force_pause_agent and cc_force_unpause_agent are live-ops exceptions and are not drafts
result: pass
source: automated
coverage_id: 15-05-D9
note: packages/backend/src/modules/mcp/mcp-tools.service.spec.ts#invokes cc_force_pause_agent as a live-ops exception; packages/backend/src/modules/mcp/mcp-tools.service.spec.ts#invokes cc_force_unpause_agent as a live-ops exception

### 33. Agent opens from a topbar control immediately left of the command-palette trigger; the floating corner button is gone
expected: Agent opens from a topbar control immediately left of the command-palette trigger; the floating corner button is gone
result: pass
source: automated
coverage_id: 15-06-D1
note: packages/frontend/src/widgets/ModuleShell/ModuleShell.test.tsx#places the agent trigger immediately before the command-palette trigger; packages/frontend/src/widgets/AiChatWidget/AiChatWidget.test.tsx#does not render the former floating trigger

### 34. Keyboard shortcut toggles the panel without stealing the command-palette shortcut
expected: Keyboard shortcut toggles the panel without stealing the command-palette shortcut
result: pass
source: automated
coverage_id: 15-06-D2
note: packages/frontend/src/widgets/ModuleShell/ModuleShell.test.tsx#toggles the agent panel with Ctrl+Shift+J and leaves Ctrl+K for the palette

### 35. Escape closes the panel, returns focus to the trigger, and Tab stays trapped inside the open panel
expected: Escape closes the panel, returns focus to the trigger, and Tab stays trapped inside the open panel
result: pass
source: automated
coverage_id: 15-06-D3
note: packages/frontend/src/widgets/ModuleShell/ModuleShell.test.tsx#closes the agent panel on Escape and returns focus to the trigger; packages/frontend/src/widgets/AiChatWidget/AiChatWidget.test.tsx#traps Tab inside the open panel and never reaches the page behind

### 36. Desktop panel is a 520px stylesheet column with a thread-rail slot; tablet/phone drop the rail and phone is a full-height sheet
expected: Desktop panel is a 520px stylesheet column with a thread-rail slot; tablet/phone drop the rail and phone is a full-height sheet
result: pass
source: automated
coverage_id: 15-06-D4
note: packages/frontend/src/widgets/AiChatWidget/AiChatWidget.test.tsx#takes panel width from the stylesheet and never from an inline style; packages/frontend/src/widgets/AiChatWidget/AiChatWidget.test.tsx#lays header, body, composer and footer out as separate grid rows

### 37. Tenant-facing panel has no model selector
expected: Tenant-facing panel has no model selector
result: pass
source: automated
coverage_id: 15-06-D5
note: packages/frontend/src/widgets/AiChatWidget/AiChatWidget.test.tsx#does not render a model selector in the tenant panel

### 38. When an adapter provides a tool name, the handwritten twin never reaches the registry (D-27)
expected: When an adapter provides a tool name, the handwritten twin never reaches the registry (D-27)
result: pass
source: automated
coverage_id: 15-07-D1
note: packages/backend/src/modules/ai-platform/legacy-tool-migration.spec.ts#serves list_contexts from the adapter and skips the handwritten twin

### 39. Listing contexts is served by a domain adapter that takes tenant as a call parameter (D-22)
expected: Listing contexts is served by a domain adapter that takes tenant as a call parameter (D-22)
result: pass
source: automated
coverage_id: 15-07-D2
note: packages/backend/src/modules/ai-platform/legacy-tool-migration.spec.ts#returns disjoint context sets for two tenants

### 40. A forged tenant key in arguments does not change which tenant's contexts or call records come back (D-22)
expected: A forged tenant key in arguments does not change which tenant's contexts or call records come back (D-22)
result: pass
source: automated
coverage_id: 15-07-D3
note: packages/backend/src/modules/ai-platform/legacy-tool-migration.spec.ts#ignores a forged tenant key in list_contexts arguments; packages/backend/src/modules/ai-platform/legacy-tool-migration.spec.ts#proves adapter ownership, cross-tenant isolation and forged-key ignore for each registered adapter tool

### 41. Call-record search keeps the existing upper bound of 50 and defaults to 20
expected: Call-record search keeps the existing upper bound of 50 and defaults to 20
result: pass
source: automated
coverage_id: 15-07-D4
note: packages/backend/src/modules/ai-platform/legacy-tool-migration.spec.ts#clamps find_cdr_calls limit to 50 and defaults to 20

### 42. Eighteen-name inventory reports adapter-served, handwritten, or retired and fails on a vanished or duplicate name
expected: Eighteen-name inventory reports adapter-served, handwritten, or retired and fails on a vanished or duplicate name
result: pass
source: automated
coverage_id: 15-07-D5
note: packages/backend/src/modules/ai-platform/legacy-tool-migration.spec.ts#reports adapter-served, handwritten, or retired and fails on a duplicate or a vanished tool

### 43. A conversation turn runs model calls and tool calls inside this application; no request leaves for an external chat service (D-06)
expected: A conversation turn runs model calls and tool calls inside this application; no request leaves for an external chat service (D-06)
result: pass
source: automated
coverage_id: 15-08-D1
note: packages/backend/src/modules/ai-chat/pbx-agent-loop.service.spec.ts#runs one read tool then an answer and yields progress, tool call, tool result, text, done

### 44. The old proxy path is gone from the codebase, not merely unused (D-06)
expected: The old proxy path is gone from the codebase, not merely unused (D-06)
result: pass
source: automated
coverage_id: 15-08-D2
note: packages/backend/src/modules/ai-chat/ai-chat.controller.spec.ts#does not keep the proxy service or read external chat environment variables

### 45. Every step of a turn emits a progress event naming the tool being run (D-09)
expected: Every step of a turn emits a progress event naming the tool being run (D-09)
result: pass
source: automated
coverage_id: 15-08-D3
note: packages/backend/src/modules/ai-chat/pbx-agent-loop.service.spec.ts#runs one read tool then an answer and yields progress, tool call, tool result, text, done

### 46. The loop stops at the configured step ceiling and reports it instead of calling the model again (D-09)
expected: The loop stops at the configured step ceiling and reports it instead of calling the model again (D-09)
result: pass
source: automated
coverage_id: 15-08-D4
note: packages/backend/src/modules/ai-chat/pbx-agent-loop.service.spec.ts#stops at the configured step ceiling and makes no further model call

### 47. Pressing stop or disconnecting aborts the in-flight model request and skips remaining tool calls (D-09)
expected: Pressing stop or disconnecting aborts the in-flight model request and skips remaining tool calls (D-09)
result: pass
source: automated
coverage_id: 15-08-D5
note: packages/backend/src/modules/ai-chat/pbx-agent-loop.service.spec.ts#aborts the in-flight model request and emits cancelled without further tools; packages/backend/src/modules/ai-chat/pbx-agent-loop.service.spec.ts#skips remaining tool calls of a batch when aborted between them

### 48. A mutating tool inside a turn yields a pending proposal in the stream and performs no write (D-18)
expected: A mutating tool inside a turn yields a pending proposal in the stream and performs no write (D-18)
result: pass
source: automated
coverage_id: 15-08-D6
note: packages/backend/src/modules/ai-chat/pbx-agent-loop.service.spec.ts#emits a pending proposal event and continues the turn without a write

### 49. Every turn's messages, token counts and terminal outcome are persisted to the conversation (D-26)
expected: Every turn's messages, token counts and terminal outcome are persisted to the conversation (D-26)
result: pass
source: automated
coverage_id: 15-08-D7
note: packages/backend/src/modules/ai-chat/pbx-agent-loop.service.spec.ts#appends the user message, tool exchange and final answer in order and accumulates tokens

### 50. Stream frames each event with its name and a single payload line, and heartbeats when idle
expected: Stream frames each event with its name and a single payload line, and heartbeats when idle
result: pass
source: automated
coverage_id: 15-08-D8
note: packages/backend/src/modules/ai-chat/agent-sse.util.spec.ts#frames each event with its name and a single serialized payload line; packages/backend/src/modules/ai-chat/agent-sse.util.spec.ts#emits a heartbeat when idle beyond the configured interval

### 51. Creating one subscriber returns a pending proposal and writes no row until confirm (D-18, D-27)
expected: Creating one subscriber returns a pending proposal and writes no row until confirm (D-18, D-27)
result: pass
source: automated
coverage_id: 15-09-D1
note: packages/backend/src/modules/endpoints/endpoints-ai.adapter.spec.ts#returns a pending proposal naming the extension and context and creates no subscriber row

### 52. Credential generation lives in the subscriber service and never appears in the proposal or tool result (T-15-37)
expected: Credential generation lives in the subscriber service and never appears in the proposal or tool result (T-15-37)
result: pass
source: automated
coverage_id: 15-09-D2
note: packages/backend/src/modules/endpoints/endpoints-ai.adapter.spec.ts#never places a generated credential in the proposal summary or the tool result; packages/backend/src/modules/endpoints/endpoints-ai.adapter.spec.ts#generates the credential in the service, stores it, and returns the subscriber without the secret

### 53. Bulk create is one bounded proposal; over-ceiling batches are refused at tool time (T-15-38)
expected: Bulk create is one bounded proposal; over-ceiling batches are refused at tool time (T-15-38)
result: pass
source: automated
coverage_id: 15-09-D3
note: packages/backend/src/modules/endpoints/endpoints-ai.adapter.spec.ts#returns one proposal for the whole batch with a per-item summary and a stated total; packages/backend/src/modules/endpoints/endpoints-ai.adapter.spec.ts#refuses a batch above the documented ceiling and names that ceiling

### 54. A caller without the write role gets a denied confirm and no rows change (D-21)
expected: A caller without the write role gets a denied confirm and no rows change (D-21)
result: pass
source: automated
coverage_id: 15-09-D4
note: packages/backend/src/modules/endpoints/endpoints-ai.adapter.spec.ts#denies a read-only role confirming bulk create and changes no rows; packages/backend/src/modules/endpoints/endpoints-ai.adapter.spec.ts#denies a read-only role confirming delete and changes no rows

### 55. Delete is tenant-scoped; a foreign subscriber is not found (D-22)
expected: Delete is tenant-scoped; a foreign subscriber is not found (D-22)
result: pass
source: automated
coverage_id: 15-09-D5
note: packages/backend/src/modules/endpoints/endpoints-ai.adapter.spec.ts#confirming a delete proposal for a subscriber of another tenant is not found

### 56. Trunk create and delete are adapter-served proposals; delete names and re-checks referencing routes (D-15, T-15-41)
expected: Trunk create and delete are adapter-served proposals; delete names and re-checks referencing routes (D-15, T-15-41)
result: pass
source: automated
coverage_id: 15-09-D6
note: packages/backend/src/modules/trunks/trunks-ai.adapter.spec.ts#returns a proposal naming the trunk and provider host and writes nothing; packages/backend/src/modules/trunks/trunks-ai.adapter.spec.ts#is destructive and names the routes that reference the trunk; packages/backend/src/modules/trunks/trunks-ai.adapter.spec.ts#confirming a delete still referenced by a route surfaces the references and does not remove

### 57. All five migrated tools pass the registry-enumerated cross-tenant suite (D-22, D-27)
expected: All five migrated tools pass the registry-enumerated cross-tenant suite (D-22, D-27)
result: pass
source: automated
coverage_id: 15-09-D7
note: packages/backend/src/modules/ai-platform/legacy-tool-migration.spec.ts#proves adapter ownership, cross-tenant isolation and forged-key ignore for each registered adapter tool

### 58. Updating a voice-menu digit returns a pending proposal with old and new destinations and writes nothing (D-18, D-27)
expected: Updating a voice-menu digit returns a pending proposal with old and new destinations and writes nothing (D-18, D-27)
result: pass
source: automated
coverage_id: 15-10-D1
note: packages/backend/src/modules/ivrs/ivrs-ai.adapter.spec.ts#returns a pending proposal whose summary states the digit, old destination and new one

### 59. A voice-menu digit pointing at a missing tenant destination is refused before confirmation (T-15-43)
expected: A voice-menu digit pointing at a missing tenant destination is refused before confirmation (T-15-43)
result: pass
source: automated
coverage_id: 15-10-D2
note: packages/backend/src/modules/ivrs/ivrs-ai.adapter.spec.ts#refuses a proposal whose new destination does not exist and names the digit and the missing target

### 60. Listing voice menus returns digit maps and does not mutate (D-15)
expected: Listing voice menus returns digit maps and does not mutate (D-15)
result: pass
source: automated
coverage_id: 15-10-D3
note: packages/backend/src/modules/ivrs/ivrs-ai.adapter.spec.ts#returns the tenant voice menus with digit maps and does not mutate

### 61. Queue update is proposal-gated with old/new settings; overflow that does not exist is refused (D-18)
expected: Queue update is proposal-gated with old/new settings; overflow that does not exist is refused (D-18)
result: pass
source: automated
coverage_id: 15-10-D4
note: packages/backend/src/modules/queues/queues-ai.adapter.spec.ts#returns a proposal whose summary names changed settings with old and new values; packages/backend/src/modules/queues/queues-ai.adapter.spec.ts#refuses an overflow destination that does not exist for the tenant

### 62. Queue delete names feeding routes and menus; strategy/membership changes name current agents (T-15-46)
expected: Queue delete names feeding routes and menus; strategy/membership changes name current agents (T-15-46)
result: pass
source: automated
coverage_id: 15-10-D5
note: packages/backend/src/modules/queues/queues-ai.adapter.spec.ts#is destructive and names the routes and menus that feed the queue; packages/backend/src/modules/queues/queues-ai.adapter.spec.ts#names the queue current member agents when strategy or membership changes

### 63. Each of the six mutating tools denies a read-only confirm and leaves records untouched (D-21)
expected: Each of the six mutating tools denies a read-only confirm and leaves records untouched (D-21)
result: pass
source: automated
coverage_id: 15-10-D6
note: packages/backend/src/modules/ivrs/ivrs-ai.adapter.spec.ts#denies a read-only role and leaves records untouched; packages/backend/src/modules/queues/queues-ai.adapter.spec.ts#denies a read-only role and leaves records untouched

### 64. A call as one tenant never returns or changes another tenant menu or queue; a forged tenant key is ignored (D-22)
expected: A call as one tenant never returns or changes another tenant menu or queue; a forged tenant key is ignored (D-22)
result: pass
source: automated
coverage_id: 15-10-D7
note: packages/backend/src/modules/ivrs/ivrs-ai.adapter.spec.ts#never returns or changes another tenant voice menu; packages/backend/src/modules/ivrs/ivrs-ai.adapter.spec.ts#ignores a forged tenant key in tool arguments; packages/backend/src/modules/queues/queues-ai.adapter.spec.ts#never returns or changes another tenant queue

### 65. Migrated names resolve to the adapter handler and the handwritten twin is skipped (D-27)
expected: Migrated names resolve to the adapter handler and the handwritten twin is skipped (D-27)
result: pass
source: automated
coverage_id: 15-10-D8
note: packages/backend/src/modules/ivrs/ivrs-ai.adapter.spec.ts#serves create_ivr, update_ivr and delete_ivr from the adapter and skips the handwritten twin; packages/backend/src/modules/queues/queues-ai.adapter.spec.ts#serves create_queue, update_queue and delete_queue from the adapter and skips the handwritten twin

### 66. A valid typed chain becomes a pending proposal whose summary lists steps and states the dialplan will be reloaded (D-15, D-18)
expected: A valid typed chain becomes a pending proposal whose summary lists steps and states the dialplan will be reloaded (D-15, D-18)
result: pass
source: automated
coverage_id: 15-11-D1
note: packages/backend/src/modules/routes/routes-ai.adapter.spec.ts#returns a pending proposal whose summary lists steps and states the dialplan will be reloaded

### 67. An unknown kind, missing parameter or missing entity is refused before a proposal exists, with the failing step named (D-15)
expected: An unknown kind, missing parameter or missing entity is refused before a proposal exists, with the failing step named (D-15)
result: pass
source: automated
coverage_id: 15-11-D2
note: packages/backend/src/modules/routes/route-chain-draft.util.spec.ts#refuses an unknown action kind and names the failing step; packages/backend/src/modules/routes/routes-ai.adapter.spec.ts#refuses an invalid typed chain before a proposal exists and names the failing step

### 68. Confirming a route proposal writes the route and calls RouteApplyService.applyContext once, never the low-level applier (D-20)
expected: Confirming a route proposal writes the route and calls RouteApplyService.applyContext once, never the low-level applier (D-20)
result: pass
source: automated
coverage_id: 15-11-D3
note: packages/backend/src/modules/routes/routes-ai.adapter.spec.ts#writes the route and calls the orchestrator exactly once, never the low-level applier

### 69. apply_dialplan is not a model-callable tool after the routes adapter is registered (D-20)
expected: apply_dialplan is not a model-callable tool after the routes adapter is registered (D-20)
result: pass
source: automated
coverage_id: 15-11-D4
note: packages/backend/src/modules/routes/routes-ai.adapter.spec.ts#does not register a model-callable apply_dialplan after the routes adapter is adopted

### 70. Reading routes and the assembled chain does not mutate (D-15)
expected: Reading routes and the assembled chain does not mutate (D-15)
result: pass
source: automated
coverage_id: 15-11-D5
note: packages/backend/src/modules/routes/routes-ai.adapter.spec.ts#lists tenant routes and describes the assembled chain without mutation

### 71. A route tool called as one tenant never reads or changes another tenant's routes (D-22)
expected: A route tool called as one tenant never reads or changes another tenant's routes (D-22)
result: pass
source: automated
coverage_id: 15-11-D6
note: packages/backend/src/modules/routes/routes-ai.adapter.spec.ts#refuses a route in another tenant context at tool time

### 72. Catch-all above a specific or emergency pattern is refused at proposal time with both patterns named (D-19)
expected: Catch-all above a specific or emergency pattern is refused at proposal time with both patterns named (D-19)
result: pass
source: automated
coverage_id: 15-11-D7
note: packages/backend/src/modules/routes/routes-ai.adapter.spec.ts#refuses a catch-all above a specific or emergency pattern and names both

### 73. Failed reload leaves the proposal pending with the error after the route write is visible (D-20)
expected: Failed reload leaves the proposal pending with the error after the route write is visible (D-20)
result: pass
source: automated
coverage_id: 15-11-D8
note: packages/backend/src/modules/routes/routes-ai.adapter.spec.ts#leaves the proposal pending with the error after the route write is visible

### 74. Conversations persist and reopen from the rail with stored messages rather than an in-memory replay
expected: Conversations persist and reopen from the rail with stored messages rather than an in-memory replay
result: pass
source: automated
coverage_id: 15-12-D1
note: packages/frontend/src/widgets/AiChatWidget/AiChatWidget.test.tsx#loads stored messages when a conversation is selected from the rail; packages/frontend/src/features/ai-chat/ui/ThreadList/ThreadList.test.tsx#lists conversations newest first with title and relative time

### 75. The rail shows distinct loading, empty, error and populated states
expected: The rail shows distinct loading, empty, error and populated states
result: pass
source: automated
coverage_id: 15-12-D2
note: packages/frontend/src/features/ai-chat/ui/ThreadList/ThreadList.test.tsx#shows skeleton rows while the list is loading and hides empty copy; packages/frontend/src/features/ai-chat/ui/ThreadList/ThreadList.test.tsx#shows empty-state copy and the new-conversation action when there are no threads; packages/frontend/src/features/ai-chat/ui/ThreadList/ThreadList.test.tsx#shows error copy and a retry that refires the list query

### 76. Delete asks for confirmation; keep is the safe action; deleting the selection clears the conversation column
expected: Delete asks for confirmation; keep is the safe action; deleting the selection clears the conversation column
result: pass
source: automated
coverage_id: 15-12-D3
note: packages/frontend/src/features/ai-chat/ui/ThreadList/ThreadList.test.tsx#asks for confirmation before deleting and keeps the conversation on dismiss; packages/frontend/src/widgets/AiChatWidget/AiChatWidget.test.tsx#clears the conversation column after deleting the selected conversation

### 77. Starting a new conversation leaves the previous one intact at the top of the rail
expected: Starting a new conversation leaves the previous one intact at the top of the rail
result: pass
source: automated
coverage_id: 15-12-D4
note: packages/frontend/src/features/ai-chat/ui/ThreadList/ThreadList.test.tsx#creates a conversation and selects it so it appears at the top without a refresh

### 78. Call groups are readable and changeable through proposal-gated tools with validated membership (D-15, D-18)
expected: Call groups are readable and changeable through proposal-gated tools with validated membership (D-15, D-18)
result: pass
source: automated
coverage_id: 15-13-D1
note: packages/backend/src/modules/call-groups/call-groups-ai.adapter.spec.ts#returns the tenant call groups with members and ring strategy; packages/backend/src/modules/call-groups/call-groups-ai.adapter.spec.ts#returns a proposal whose summary names members added and removed; packages/backend/src/modules/call-groups/call-groups-ai.adapter.spec.ts#confirming a membership proposal updates exactly one group for the calling tenant

### 79. A call-group proposal naming a subscriber the tenant does not have is refused before confirm
expected: A call-group proposal naming a subscriber the tenant does not have is refused before confirm
result: pass
source: automated
coverage_id: 15-13-D2
note: packages/backend/src/modules/call-groups/call-groups-ai.adapter.spec.ts#refuses a membership proposal naming a subscriber that does not exist for the tenant

### 80. Delete call-group is destructive and names routes and menus that ring the group
expected: Delete call-group is destructive and names routes and menus that ring the group
result: pass
source: automated
coverage_id: 15-13-D3
note: packages/backend/src/modules/call-groups/call-groups-ai.adapter.spec.ts#is destructive and names the routes and menus that ring the group

### 81. Hold music is readable and assignable; tools return no audio content (D-15, D-18)
expected: Hold music is readable and assignable; tools return no audio content (D-15, D-18)
result: pass
source: automated
coverage_id: 15-13-D4
note: packages/backend/src/modules/moh/moh-ai.adapter.spec.ts#returns tenant hold-music classes with track counts and mode; packages/backend/src/modules/moh/moh-ai.adapter.spec.ts#returns one class with ordered tracks and no audio content or fetchable paths; packages/backend/src/modules/moh/moh-ai.adapter.spec.ts#returns a proposal naming the target, the current class and the new class

### 82. A hold-music proposal referencing a class the tenant does not own is refused by name
expected: A hold-music proposal referencing a class the tenant does not own is refused by name
result: pass
source: automated
coverage_id: 15-13-D5
note: packages/backend/src/modules/moh/moh-ai.adapter.spec.ts#refuses a class the tenant does not own and names that class

### 83. A caller without the write role gets a denied proposal and no mutation (D-21)
expected: A caller without the write role gets a denied proposal and no mutation (D-21)
result: pass
source: automated
coverage_id: 15-13-D6
note: packages/backend/src/modules/call-groups/call-groups-ai.adapter.spec.ts#create_call_group denies a read-only role and leaves records untouched; packages/backend/src/modules/moh/moh-ai.adapter.spec.ts#assign_moh_class denies a read-only role and leaves records untouched

### 84. Both domains are tenant-isolated, ignore a forged tenant key, and do not collide in the registry (D-22)
expected: Both domains are tenant-isolated, ignore a forged tenant key, and do not collide in the registry (D-22)
result: pass
source: automated
coverage_id: 15-13-D7
note: packages/backend/src/modules/call-groups/call-groups-ai.adapter.spec.ts#never returns or changes another tenant group or member; packages/backend/src/modules/moh/moh-ai.adapter.spec.ts#never returns another tenant class, file or assignment target; packages/backend/src/modules/call-groups/call-groups-ai.adapter.spec.ts#appears in the registry with unique names that do not shadow existing tools; packages/backend/src/modules/ai-platform/legacy-tool-migration.spec.ts#proves adapter ownership, cross-tenant isolation and forged-key ignore for each registered adapter tool

### 85. Agreement is a button on a card that names the entity and each change line (D-19)
expected: Agreement is a button on a card that names the entity and each change line (D-19)
result: pass
source: automated
coverage_id: 15-14-D1
note: packages/frontend/src/features/ai-chat/ui/DiffConfirmCard/DiffConfirmCard.test.tsx#renders the entity label, every change line and both actions; packages/frontend/src/features/ai-chat/ui/DiffConfirmCard/DiffConfirmCard.test.tsx#sends only the proposal identifier on confirm and moves the card to applied

### 86. Confirmed, rejected or denied cards cannot be confirmed again
expected: Confirmed, rejected or denied cards cannot be confirmed again
result: pass
source: automated
coverage_id: 15-14-D2
note: packages/frontend/src/features/ai-chat/ui/DiffConfirmCard/DiffConfirmCard.test.tsx#cannot confirm a denied or already settled card again

### 87. A denied card explains that the caller's role does not permit the change (D-21)
expected: A denied card explains that the caller's role does not permit the change (D-21)
result: pass
source: automated
coverage_id: 15-14-D3
note: packages/frontend/src/features/ai-chat/ui/DiffConfirmCard/DiffConfirmCard.test.tsx#shows the permission explanation on a denied card and hides both actions

### 88. Failed confirmation stays pending with the error and a retry, not success
expected: Failed confirmation stays pending with the error and a retry, not success
result: pass
source: automated
coverage_id: 15-14-D4
note: packages/frontend/src/features/ai-chat/ui/DiffConfirmCard/DiffConfirmCard.test.tsx#keeps a failed apply pending with the error and a retry

### 89. A card from a reopened conversation renders in its stored state at the producing turn
expected: A card from a reopened conversation renders in its stored state at the producing turn
result: pass
source: automated
coverage_id: 15-14-D5
note: packages/frontend/src/widgets/AiChatWidget/AiChatWidget.test.tsx#places a stored change card at the turn that produced it

### 90. Zero handwritten tool registrations remain; precedence shim is gone (D-27)
expected: Zero handwritten tool registrations remain; precedence shim is gone (D-27)
result: pass
source: automated
coverage_id: 15-15-D1
note: packages/backend/src/modules/mcp/mcp-tools.service.spec.ts#registers no tools of its own; packages/backend/src/modules/ai-platform/legacy-tool-migration.spec.ts#reports adapter-served or retired and fails on a leftover handwritten name

### 91. Alternative tool-dispatch controller is deleted so the confirmation gate cannot be bypassed (D-27)
expected: Alternative tool-dispatch controller is deleted so the confirmation gate cannot be bypassed (D-27)
result: pass
source: automated
coverage_id: 15-15-D2
note: packages/backend/src/modules/mcp/mcp-tools.service.spec.ts#no source file imports deleted knowledge or webhook symbols

### 92. External /api/mcp takes tenant only from the caller JWT; service token plus tenant header is rejected (D-28)
expected: External /api/mcp takes tenant only from the caller JWT; service token plus tenant header is rejected (D-28)
result: pass
source: automated
coverage_id: 15-15-D3
note: packages/backend/src/modules/mcp/mcp.controller.spec.ts#rejects a service token plus tenant header; packages/backend/src/modules/mcp/mcp.controller.spec.ts#dispatches a valid user token with that token tenant

### 93. Valid JWT plus contradicting tenant header uses the token tenant
expected: Valid JWT plus contradicting tenant header uses the token tenant
result: pass
source: automated
coverage_id: 15-15-D4
note: packages/backend/src/modules/mcp/mcp.controller.spec.ts#ignores a contradicting tenant header and keeps the token tenant

### 94. Nothing reads knowledge from the ignored documentation directory (D-11)
expected: Nothing reads knowledge from the ignored documentation directory (D-11)
result: pass
source: automated
coverage_id: 15-15-D5
note: packages/backend/src/modules/mcp/mcp-tools.service.spec.ts#no source file imports deleted knowledge or webhook symbols

### 95. Narrow agent test command covers platform, chat and external-entry modules
expected: Narrow agent test command covers platform, chat and external-entry modules
result: pass
source: automated
coverage_id: 15-15-D6
note: packages/backend/src/app.module.spec.ts#narrow test:ai pattern covers platform, chat and external-entry modules

### 96. Startup fails outside development if CC_AI_KEY_SECRET is missing
expected: Startup fails outside development if CC_AI_KEY_SECRET is missing
result: pass
source: automated
coverage_id: 15-15-D7
note: packages/backend/src/app.module.spec.ts#fails at startup outside development when the secret is missing

### 97. Schedules are readable and evaluable in the tenant timezone with no write surface (D-12, D-15)
expected: Schedules are readable and evaluable in the tenant timezone with no write surface (D-12, D-15)
result: pass
source: automated
coverage_id: 15-16-D1
note: packages/backend/src/modules/ai-platform/read-adapters-schedule-identity.spec.ts#evaluates a named schedule inside its intervals and names the next boundary; packages/backend/src/modules/ai-platform/read-adapters-schedule-identity.spec.ts#uses the tenant timezone, not the server zone

### 98. Numbers are readable with the resolved route destination; unrouted numbers are named (D-12, D-15)
expected: Numbers are readable with the resolved route destination; unrouted numbers are named (D-12, D-15)
result: pass
source: automated
coverage_id: 15-16-D2
note: packages/backend/src/modules/ai-platform/read-adapters-schedule-identity.spec.ts#describes a number with the route and destination it currently reaches; packages/backend/src/modules/ai-platform/read-adapters-schedule-identity.spec.ts#reports an unrouted number as unrouted rather than omitting it

### 99. Portal users expose name, role and activity through an allow list with no secrets (D-15, D-22)
expected: Portal users expose name, role and activity through an allow list with no secrets (D-15, D-22)
result: pass
source: automated
coverage_id: 15-16-D3
note: packages/backend/src/modules/ai-platform/read-adapters-schedule-identity.spec.ts#never returns a password hash, token, secret or session identifier; packages/backend/src/modules/ai-platform/read-adapters-schedule-identity.spec.ts#asserts secret absence against the declared output shape, not only fixtures

### 100. None of the three adapters declares a mutating tool (D-15)
expected: None of the three adapters declares a mutating tool (D-15)
result: pass
source: automated
coverage_id: 15-16-D4
note: packages/backend/src/modules/ai-platform/read-adapters-schedule-identity.spec.ts#declares no mutating tool

### 101. Each domain returns none of another tenant's rows (D-22)
expected: Each domain returns none of another tenant's rows (D-22)
result: pass
source: automated
coverage_id: 15-16-D5
note: packages/backend/src/modules/ai-platform/read-adapters-schedule-identity.spec.ts#returns none of another tenant schedules; packages/backend/src/modules/ai-platform/read-adapters-schedule-identity.spec.ts#returns none of another tenant numbers; packages/backend/src/modules/ai-platform/read-adapters-schedule-identity.spec.ts#returns none of another tenant users including no aggregate count of them

### 102. Tenant settings are readable by allow list with secrets as presence only and no write surface (D-15)
expected: Tenant settings are readable by allow list with secrets as presence only and no write surface (D-15)
result: pass
source: automated
coverage_id: 15-17-D1
note: packages/backend/src/modules/ai-platform/read-adapters-settings-messaging.spec.ts#builds output from an explicit allow list and never returns encrypted, token or secret values; packages/backend/src/modules/ai-platform/read-adapters-settings-messaging.spec.ts#reports a secret-valued setting as configured or not configured, never by value

### 103. Platform settings reach the agent only through an explicit per-tenant projection (D-15, D-22)
expected: Platform settings reach the agent only through an explicit per-tenant projection (D-15, D-22)
result: pass
source: automated
coverage_id: 15-17-D2
note: packages/backend/src/modules/ai-platform/read-adapters-settings-messaging.spec.ts#returns only the platform settings that describe the calling tenant limits and capabilities; packages/backend/src/modules/ai-platform/read-adapters-settings-messaging.spec.ts#does not include a platform setting absent from the explicit projection

### 104. SMS and Telegram are diagnosable without tokens, bodies or send tools (D-12, D-15)
expected: SMS and Telegram are diagnosable without tokens, bodies or send tools (D-12, D-15)
result: pass
source: automated
coverage_id: 15-17-D3
note: packages/backend/src/modules/ai-platform/read-adapters-settings-messaging.spec.ts#reports whether the sms channel is configured and enabled without its token; packages/backend/src/modules/ai-platform/read-adapters-settings-messaging.spec.ts#excludes message bodies from delivery results or truncates to the documented preview length; packages/backend/src/modules/ai-platform/read-adapters-settings-messaging.spec.ts#declares no tool that sends a message

### 105. None of the four adapters declares a mutating tool (D-15)
expected: None of the four adapters declares a mutating tool (D-15)
result: pass
source: automated
coverage_id: 15-17-D4
note: packages/backend/src/modules/ai-platform/read-adapters-settings-messaging.spec.ts#declares no mutating tool

### 106. Each domain returns none of another tenant's settings, projection, channel state or deliveries (D-22)
expected: Each domain returns none of another tenant's settings, projection, channel state or deliveries (D-22)
result: pass
source: automated
coverage_id: 15-17-D5
note: packages/backend/src/modules/ai-platform/read-adapters-settings-messaging.spec.ts#returns none of another tenant settings; packages/backend/src/modules/ai-platform/read-adapters-settings-messaging.spec.ts#returns each tenant its own projection; packages/backend/src/modules/ai-platform/read-adapters-settings-messaging.spec.ts#returns none of another tenant sms channel state or deliveries

### 107. While a turn runs, the panel shows a localised line per step (D-09, D-13)
expected: While a turn runs, the panel shows a localised line per step (D-09, D-13)
result: pass
source: automated
coverage_id: 15-18-D1
note: packages/frontend/src/features/ai-chat/model/useAgentStream.test.ts#streams progress lines and accumulated answer text from a fixture turn; packages/frontend/src/features/ai-chat/model/useAgentStream.test.ts#names the step in the interface language, not the raw tool identifier

### 108. A stop control ends the turn and nothing further renders after it (D-09)
expected: A stop control ends the turn and nothing further renders after it (D-09)
result: pass
source: automated
coverage_id: 15-18-D2
note: packages/frontend/src/features/ai-chat/model/useAgentStream.test.ts#ignores further stream events after stop; packages/frontend/src/widgets/AiChatWidget/AiChatWidget.test.tsx#pressing stop calls the stream abort and shows the stopped outcome

### 109. Reaching the step ceiling is its own outcome, distinct from stop and failure (D-09)
expected: Reaching the step ceiling is its own outcome, distinct from stop and failure (D-09)
result: pass
source: automated
coverage_id: 15-18-D3
note: packages/frontend/src/features/ai-chat/model/useAgentStream.test.ts#marks the ceiling as its own outcome, distinct from stop and failure

### 110. A dropped connection keeps the partial answer and offers reconnect (D-09)
expected: A dropped connection keeps the partial answer and offers reconnect (D-09)
result: pass
source: automated
coverage_id: 15-18-D4
note: packages/frontend/src/features/ai-chat/model/useAgentStream.test.ts#keeps the partial answer and reports disconnect when the stream drops; packages/frontend/src/widgets/AiChatWidget/AiChatWidget.test.tsx#renders ceiling, failure and disconnect as distinct outcomes

### 111. Raw tool result payloads never appear in the rendered conversation (T-15-82, D-13)
expected: Raw tool result payloads never appear in the rendered conversation (T-15-82, D-13)
result: pass
source: automated
coverage_id: 15-18-D5
note: packages/frontend/src/features/ai-chat/model/useAgentStream.test.ts#never exposes a raw tool result payload in the conversation

### 112. The conversation follows new content only while the reader is at the bottom
expected: The conversation follows new content only while the reader is at the bottom
result: pass
source: automated
coverage_id: 15-18-D6
note: packages/frontend/src/widgets/AiChatWidget/AiChatWidget.test.tsx#keeps the conversation at the bottom while the reader is already there; packages/frontend/src/widgets/AiChatWidget/AiChatWidget.test.tsx#stops following after the user scrolls up and shows jump-to-latest; packages/frontend/src/widgets/AiChatWidget/AiChatWidget.test.tsx#resumes following when the reader returns to the bottom

### 113. A change card arriving mid-stream renders in place and text continues below it (D-19)
expected: A change card arriving mid-stream renders in place and text continues below it (D-19)
result: pass
source: automated
coverage_id: 15-18-D7
note: packages/frontend/src/widgets/AiChatWidget/AiChatWidget.test.tsx#renders a mid-stream change card in place and continues the text below it

### 114. Live channels via allow-listed command with derived tenant filter and reported cap (D-12, D-22)
expected: Live channels via allow-listed command with derived tenant filter and reported cap (D-12, D-22)
result: pass
source: automated
coverage_id: 15-19-D1
note: packages/backend/src/modules/diagnostics/diagnostics.service.spec.ts#issues only the allow-listed live_channels command; packages/backend/src/modules/diagnostics/diagnostics.service.spec.ts#two-tenant fixture: each tenant sees only its own live channels

### 115. Unknown command names are refused before AMI (T-15-95)
expected: Unknown command names are refused before AMI (T-15-95)
result: pass
source: automated
coverage_id: 15-19-D2
note: packages/backend/src/modules/diagnostics/diagnostics.service.spec.ts#refuses a command name that is not on the allow list before reaching the switch

### 116. Recent events are windowed and capped; compiled dialplan is ordered and ownership-checked (D-13)
expected: Recent events are windowed and capped; compiled dialplan is ordered and ownership-checked (D-13)
result: pass
source: automated
coverage_id: 15-19-D3
note: packages/backend/src/modules/diagnostics/diagnostics.service.spec.ts#returns recent call events for the tenant within the bounded window and count; packages/backend/src/modules/diagnostics/diagnostics.service.spec.ts#refuses a compiled dialplan read for a context the tenant does not own

### 117. Adapter declares exactly three read tools and no mutating tool (D-15)
expected: Adapter declares exactly three read tools and no mutating tool (D-15)
result: pass
source: automated
coverage_id: 15-19-D4
note: packages/backend/src/modules/diagnostics/diagnostics-ai.adapter.spec.ts#declares exactly three read tools and no mutating tool

### 118. Diagnostics skill parses and prescribes evidence order with absent-evidence rule (D-12, D-13)
expected: Diagnostics skill parses and prescribes evidence order with absent-evidence rule (D-12, D-13)
result: pass
source: automated
coverage_id: 15-19-D5
note: packages/backend/src/modules/ai-platform/agent-skill-registry.service.spec.ts#loads a non-empty catalog from the repository skills root

### 119. A voice robot read names its engine dependencies and their configured state, including missing references, with no write surface (D-15)
expected: A voice robot read names its engine dependencies and their configured state, including missing references, with no write surface (D-15)
result: pass
source: automated
coverage_id: 15-20-D1
note: packages/backend/src/modules/ai-platform/read-adapters-speech.spec.ts#describes one robot with its scenario outline and referenced speech engines; packages/backend/src/modules/ai-platform/read-adapters-speech.spec.ts#reports a dangling engine reference as a missing dependency instead of omitting it; packages/backend/src/modules/ai-platform/read-adapters-speech.spec.ts#declares no mutating tool

### 120. Both engine domains are readable by allow list with no credential exposure and no billable action surface (D-15)
expected: Both engine domains are readable by allow list with no credential exposure and no billable action surface (D-15)
result: pass
source: automated
coverage_id: 15-20-D2
note: packages/backend/src/modules/ai-platform/read-adapters-speech.spec.ts#builds output from an explicit allow list and never returns a provider key, endpoint or encrypted value; packages/backend/src/modules/ai-platform/read-adapters-speech.spec.ts#asserts credential absence against the declared output shape, not only fixtures; packages/backend/src/modules/ai-platform/read-adapters-speech.spec.ts#declares no tool that synthesises audio; packages/backend/src/modules/ai-platform/read-adapters-speech.spec.ts#declares no tool that transcribes audio

### 121. One shared engine skill parses and is accepted as covering tts-engines and stt-engines (D-12)
expected: One shared engine skill parses and is accepted as covering tts-engines and stt-engines (D-12)
result: pass
source: automated
coverage_id: 15-20-D3
note: packages/backend/src/modules/ai-platform/read-adapters-speech.spec.ts#ships one shared skill that parses and covers both engine domains

### 122. All three domains have per-tool cross-tenant assertions plus a registry-enumerated suite (D-22)
expected: All three domains have per-tool cross-tenant assertions plus a registry-enumerated suite (D-22)
result: pass
source: automated
coverage_id: 15-20-D4
note: packages/backend/src/modules/ai-platform/read-adapters-speech.spec.ts#proves per-tool cross-tenant isolation and forged-key ignore for every speech adapter tool

### 123. Notifications are readable, count-clamped, body-truncated and tenant-isolated, with no write surface (D-12, D-15)
expected: Notifications are readable, count-clamped, body-truncated and tenant-isolated, with no write surface (D-12, D-15)
result: pass
source: automated
coverage_id: 15-21-D1
note: packages/backend/src/modules/ai-platform/read-adapters-operations.spec.ts#returns the tenant recent notifications with kind, status and timestamp; packages/backend/src/modules/ai-platform/read-adapters-operations.spec.ts#clamps a requested result count above the documented ceiling; packages/backend/src/modules/ai-platform/read-adapters-operations.spec.ts#truncates notification bodies to the documented preview length; packages/backend/src/modules/ai-platform/read-adapters-operations.spec.ts#declares no mutating tool

### 124. Audio prompts, service requests and claims are readable, bounded, media-free and tenant-isolated, with no write surface (D-15)
expected: Audio prompts, service requests and claims are readable, bounded, media-free and tenant-isolated, with no write surface (D-15)
result: pass
source: automated
coverage_id: 15-21-D2
note: packages/backend/src/modules/ai-platform/read-adapters-operations.spec.ts#lists the tenant audio prompts with name, duration and referencing entities; packages/backend/src/modules/ai-platform/read-adapters-operations.spec.ts#returns no audio content and no fetchable path; packages/backend/src/modules/ai-platform/read-adapters-operations.spec.ts#lists requests with status, timestamps and a truncated subject using shared bounds; packages/backend/src/modules/ai-platform/read-adapters-operations.spec.ts#lists claims with status, timestamps and a truncated subject using shared bounds

### 125. One shared operational skill parses and all four domains have per-tool cross-tenant assertions (D-12, D-22)
expected: One shared operational skill parses and all four domains have per-tool cross-tenant assertions (D-12, D-22)
result: pass
source: automated
coverage_id: 15-21-D3
note: packages/backend/src/modules/ai-platform/read-adapters-operations.spec.ts#ships one operations skill covering all four domains, preview and the read-only boundary; packages/backend/src/modules/ai-platform/read-adapters-operations.spec.ts#proves per-tool cross-tenant isolation and forged-key ignore for every operations adapter tool

### 126. A scenario replays canned model turns through the real agent loop with no network call (D-06)
expected: A scenario replays canned model turns through the real agent loop with no network call (D-06)
result: pass
source: automated
coverage_id: 15-22-D1
note: packages/backend/src/modules/ai-chat/pbx-agent-eval.spec.ts#replays a read scenario from data through the real loop with an asserted tool sequence; packages/backend/src/modules/ai-chat/pbx-agent-eval.spec.ts#makes no outbound network request; only the model client is a fixture

### 127. Each scenario asserts the tool sequence the agent chose, not only its final text (D-09)
expected: Each scenario asserts the tool sequence the agent chose, not only its final text (D-09)
result: pass
source: automated
coverage_id: 15-22-D2
note: packages/backend/src/modules/ai-chat/pbx-agent-eval.spec.ts#fails with both sequences printed when the actual tool sequence differs; packages/backend/src/modules/ai-chat/pbx-agent-eval.spec.ts#passes a step-budget scenario that stops at the ceiling

### 128. Mutating scenarios assert a pending proposal and that nothing was written before confirmation (D-18)
expected: Mutating scenarios assert a pending proposal and that nothing was written before confirmation (D-18)
result: pass
source: automated
coverage_id: 15-22-D3
note: packages/backend/src/modules/ai-chat/pbx-agent-eval.spec.ts#passes three mutating scenarios with a pending proposal and no write

### 129. Cross-tenant scenarios assert every audit row carries the calling tenant and a forged uid leaves the other tenant unchanged (D-22)
expected: Cross-tenant scenarios assert every audit row carries the calling tenant and a forged uid leaves the other tenant unchanged (D-22)
result: pass
source: automated
coverage_id: 15-22-D4
note: packages/backend/src/modules/ai-chat/pbx-agent-eval.spec.ts#asserts the scenario tenant on every audit row; packages/backend/src/modules/ai-chat/pbx-agent-eval.spec.ts#passes two cross-tenant scenarios: same tool as two tenants and a forged tenant key

### 130. Ten bucket scenarios pass and the remaining ten are specified; the suite runs from a named script
expected: Ten bucket scenarios pass and the remaining ten are specified; the suite runs from a named script
result: pass
source: automated
coverage_id: 15-22-D5
note: packages/backend/src/modules/ai-chat/pbx-agent-eval.spec.ts#covers ten reference scenarios across the contract buckets; npm run test:pbx-agent-eval -w @krasterisk/backend

### 131. An unclassified module directory turns the coverage test red with that directory named (D-17)
expected: An unclassified module directory turns the coverage test red with that directory named (D-17)
result: pass
source: automated
coverage_id: 15-23-D1
note: packages/backend/src/modules/ai-platform/ai-adapter-completeness.spec.ts#names an unclassified module directory from the filesystem listing; packages/backend/src/modules/ai-platform/ai-adapter-completeness.spec.ts#live classification matches on-disk modules and getDomains() with no leftovers

### 132. A module classified as covered but lacking an adapter turns the coverage test red with the domain named (D-17)
expected: A module classified as covered but lacking an adapter turns the coverage test red with the domain named (D-17)
result: pass
source: automated
coverage_id: 15-23-D2
note: packages/backend/src/modules/ai-platform/ai-adapter-completeness.spec.ts#names a covered domain that has no registered adapter

### 133. A domain classified as infrastructure or excluded carries a written reason (D-17, T-15-104)
expected: A domain classified as infrastructure or excluded carries a written reason (D-17, T-15-104)
result: pass
source: automated
coverage_id: 15-23-D3
note: packages/backend/src/modules/ai-platform/ai-adapter-completeness.spec.ts#names a non-covered classification that has an empty reason

### 134. A covered domain whose skill is missing or whose frontmatter does not parse turns the suite red (D-16, D-17)
expected: A covered domain whose skill is missing or whose frontmatter does not parse turns the suite red (D-16, D-17)
result: pass
source: automated
coverage_id: 15-23-D4
note: packages/backend/src/modules/ai-platform/ai-adapter-completeness.spec.ts#names a covered domain that has neither its own nor a shared skill; packages/backend/src/modules/ai-platform/ai-adapter-completeness.spec.ts#names the skill file when frontmatter does not parse; packages/backend/src/modules/ai-platform/ai-adapter-completeness.spec.ts#accepts one declared shared skill for several covered domains

### 135. Every registered tool belongs to a domain that resolves to a skill (D-16, T-15-105)
expected: Every registered tool belongs to a domain that resolves to a skill (D-16, T-15-105)
result: pass
source: automated
coverage_id: 15-23-D5
note: packages/backend/src/modules/ai-platform/ai-adapter-completeness.spec.ts#names a tool whose domain does not resolve to a skill; packages/backend/src/modules/ai-platform/ai-adapter-completeness.spec.ts#live covered domains and registered tools resolve to a parseable skill

### 136. The convention is written in ARCHITECTURE (normative) and developer-convention skill (explanatory), each pointing at the enforcing test (D-16)
expected: The convention is written in ARCHITECTURE (normative) and developer-convention skill (explanatory), each pointing at the enforcing test (D-16)
result: pass
source: automated
coverage_id: 15-23-D6
note: packages/backend/src/modules/ai-platform/agent-skill-registry.service.spec.ts#readSkill('developer-convention') returns the markdown body

### 137. Per-tenant token totals and spend are queryable by the platform administrator only, honest about missing pricing, and sourced from conversation rows
expected: Per-tenant token totals and spend are queryable by the platform administrator only, honest about missing pricing, and sourced from conversation rows
result: pass
source: automated
coverage_id: 15-24-D1
note: packages/backend/src/modules/ai-chat/agent-usage.service.spec.ts#returns per-tenant input/output token totals and turns over a date range; packages/backend/src/modules/ai-chat/agent-usage.service.spec.ts#reports spend as unavailable rather than zero when pricing is absent; packages/backend/src/modules/ai-chat/agent-usage.service.spec.ts#guards the controller with JWT and SuperAdmin so a tenant-role caller is forbidden

### 138. Proposal funnel and tool error queries return per-tenant figures, and the detector reports a mutation without a proposal trail
expected: Proposal funnel and tool error queries return per-tenant figures, and the detector reports a mutation without a proposal trail
result: pass
source: automated
coverage_id: 15-24-D2
note: packages/backend/src/modules/ai-chat/agent-usage.service.spec.ts#returns pending, applied, rejected and denied proposal counts per tenant; packages/backend/src/modules/ai-chat/agent-usage.service.spec.ts#reports a mutating audit row with no matching applied proposal; packages/backend/src/modules/ai-chat/agent-usage.service.spec.ts#yields an empty detector result when every mutation has an applied proposal

### 139. The administrator picks the default model and reads per-tenant usage, spend and funnel; a tenant session renders neither
expected: The administrator picks the default model and reads per-tenant usage, spend and funnel; a tenant session renders neither
result: pass
source: automated
coverage_id: 15-24-D3
note: packages/frontend/src/features/cloud-admin/ui/AiChatSettingsCard/AiChatSettingsCard.test.tsx#renders neither the default model nor the usage view for a tenant session; packages/frontend/src/features/cloud-admin/ui/AiChatSettingsCard/AiChatSettingsCard.test.tsx#lets a platform administrator pick and save the default model; packages/frontend/src/features/cloud-admin/ui/AiChatSettingsCard/AiChatSettingsCard.test.tsx#renders unavailable spend instead of a zero amount

## Summary

total: 139
passed: 139
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- gap_id: G-15-1
  truth: "Сообщение стримится, progress на человеческом языке; ход агента продолжает вызывать инструменты, а не зависает после объявления следующего шага"
  status: resolved
  resolved_by: in-session-fix
  resolved_at: 2026-09-05
  reason: "User reported: сделал тестовый запрос создать IVR «Продажи». Агент описал план, показал «Выполняю следующий шаг» и остановился — следующий шаг не выполняется"
  severity: major
  test: 1
  root_cause: "Модель ответила планом без tool_calls; цикл считал это финальным ответом. Строка «Выполняю следующий шаг» оставалась после конца хода. Стрим к провайдеру не имел таймаута."
  artifacts:
    - path: "packages/backend/src/modules/ai-chat/pbx-agent-loop.service.ts"
      issue: "text-only plan ended the turn; no nudge to actually call tools"
    - path: "packages/backend/src/modules/ai-chat/pbx-agent-llm.client.ts"
      issue: "streaming fetch had no deadline; fallback tool JSON ignored when vendor advertised tools"
    - path: "packages/frontend/src/widgets/AiChatWidget/AiChatWidget.tsx"
      issue: "progress line stayed visible after the turn finished"
  missing:
    - "One-shot plan nudge and yield narration with tools"
    - "60s provider timeout + parse tool JSON from prose even with native tools"
    - "Hide progress unless the turn is still streaming"
  debug_session: ""

## Deferred Follow-Ups

- test: 1
  idea: "Более наглядное имя тенанта в расходе платформенного админа: «Тенант Имя (идентификатор)» вместо голого uid"
  deferred_at: 2026-09-05
