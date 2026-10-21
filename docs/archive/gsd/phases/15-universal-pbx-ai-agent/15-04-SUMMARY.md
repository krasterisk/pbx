---
phase: 15-universal-pbx-ai-agent
plan: 04
subsystem: api
tags: [llm-client, system-prompt, d-06, d-07, d-10, d-13, d-14, d-15, d-27]

requires:
  - phase: 15-universal-pbx-ai-agent
    provides: Skill catalog getCatalog() without bodies (15-02)
provides:
  - PbxAgentLlmClient OpenAI-compatible chat with tools, streaming, abort and structured errors
  - AiProvidersService.findDefaultLlm() with 60s cache (D-07)
  - System prompt of state snapshot + adapter knowledge + skill catalog + behavioural rules
  - PbxStateAiAdapter get_pbx_state sharing the builder snapshot (D-15, D-27)
affects:
  - 15-05 (loop consumes client, prompt, and confirmation-card rule)
  - 15-08 (imports ChatMessage from pbx-agent.types when AiChatService is deleted)
  - 15-07 (get_pbx_state adapter name wins over the handwritten tool)
  - 15-15 (KnowledgeBaseService can be deleted; adapter blocks already live in the builder)
  - 15-24 (usage from completions; default provider already resolved server-side)

actuals:
  tokens: 17018
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - fetch + AbortSignal for streaming; axios validateStatus: () => true for non-streaming
    - One toCompactSnapshot() behind both the system prompt and get_pbx_state
    - Tools capability advertised as `tools` / `function_calling`; otherwise catalog is inlined and JSON is parsed

key-files:
  created:
    - packages/backend/src/modules/ai-chat/pbx-agent.types.ts
    - packages/backend/src/modules/ai-chat/pbx-agent-llm.client.ts
    - packages/backend/src/modules/ai-chat/pbx-agent-llm.client.spec.ts
    - packages/backend/src/modules/ai-chat/pbx-context-builder.service.spec.ts
    - packages/backend/src/modules/ai-chat/pbx-state-ai.adapter.ts
  modified:
    - packages/backend/src/modules/ai-agents/ai-providers.service.ts
    - packages/backend/src/modules/ai-agents/ai-providers.service.spec.ts
    - packages/backend/src/modules/ai-chat/pbx-context-builder.service.ts
    - packages/backend/src/modules/ai-chat/ai-chat.module.ts

key-decisions:
  - "Default LLM is CC_AI_DEFAULT_PROVIDER_UID then the first enabled llm row, globals last, cached 60s"
  - "Native tools only when capabilities include tools or function_calling; otherwise warn and inline the catalog"
  - "Prompt language rule is 'same language as the question'; hardcoded Отвечай по-русски is gone"
  - "get_pbx_state and the system prompt share toCompactSnapshot so they cannot disagree"

patterns-established:
  - "Pattern: chat() never throws at the controller — AgentCompletion.error { code, message, status? }"
  - "Pattern: resolveChatCompletionsUrl + decryptSecret + auth_type bearer|api_key_header|none|custom"
  - "Pattern: prompt token estimate is chars/4; warn above 3500 before history"

requirements-completed: [D-06, D-07, D-10, D-13, D-14, D-15, D-27]

coverage:
  - id: D1
    description: Backend calls a pluggable provider, resolving URL, auth and model from the encrypted provider row (D-06, D-07)
    requirement: D-06
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-chat/pbx-agent-llm.client.spec.ts#posts to the resolved completions URL with a decrypted bearer key
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/ai-agents/ai-providers.service.spec.ts#returns the configured default provider when it is enabled and has the language-model capability
        status: pass
    human_judgment: false
  - id: D2
    description: Cancellation reaches the provider request so stopping a turn stops token spend
    requirement: D-06
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-chat/pbx-agent-llm.client.spec.ts#stops reading when the signal aborts mid-stream and issues no further request
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/ai-chat/pbx-agent-llm.client.spec.ts#issues no request when the signal is already aborted
        status: pass
    human_judgment: false
  - id: D3
    description: System prompt carries the skill catalog and no skill bodies (D-10)
    requirement: D-10
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-chat/pbx-context-builder.service.spec.ts#puts the skill catalog in the prompt and never inlines a skill body
        status: pass
    human_judgment: false
  - id: D4
    description: Prompt answers in the language of the question and avoids telephony jargon unless asked (D-13, D-14)
    requirement: D-14
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-chat/pbx-context-builder.service.spec.ts#states the language rule and does not hardcode a single reply language
        status: pass
    human_judgment: false
  - id: D5
    description: Adapter registry domain knowledge blocks stay in the prompt after the old knowledge path is removed
    requirement: D-10
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-chat/pbx-context-builder.service.spec.ts#includes adapter knowledge blocks from the registry, not the old digest path
        status: pass
    human_judgment: false
  - id: D6
    description: Exactly one compact tenant state snapshot serves both the system prompt and get_pbx_state (D-15, D-27)
    requirement: D-27
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-chat/pbx-context-builder.service.spec.ts#returns per-domain counts plus a bounded name sample and stays inside the character budget
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/ai-chat/pbx-context-builder.service.spec.ts#contains none of a second tenant's data
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/ai-chat/pbx-context-builder.service.spec.ts#accepts an optional domain filter and returns only that domain
        status: pass
    human_judgment: false

duration: 22min
completed: 2026-09-04
status: complete
---

# Phase 15 Plan 04: Model Client and System Prompt Summary

**In-process OpenAI-compatible LLM client with abort, plus a catalog-only system prompt and one compact state snapshot shared with get_pbx_state**

## Performance

- **Duration:** 22 min
- **Started:** 2026-09-04T09:56:00Z
- **Completed:** 2026-09-04T10:18:00Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- `PbxAgentLlmClient.chat()` posts to `resolveChatCompletionsUrl`, decrypts the key, streams tokens, accumulates fragmented tool-call arguments, and returns structured errors instead of throwing
- `findDefaultLlm()` honours `CC_AI_DEFAULT_PROVIDER_UID`, otherwise the first enabled `llm` row with global templates last, cached 60s
- System prompt is four blocks: compact state, `getKnowledgeBlocks()`, skill catalog (name + description, `read_skill` for bodies), behavioural rules (language, no jargon, confirmation card, data-vs-instruction)
- `PbxStateAiAdapter` registers `get_pbx_state` from the same `toCompactSnapshot()` the prompt uses; optional domain filter; tenant uid is a handler argument

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1 RED: LLM client and default provider** - `7f0531b` (test)
2. **Task 1 GREEN: PbxAgentLlmClient + findDefaultLlm** - `4d5ab98` (feat)
3. **Task 2 RED: system prompt and state snapshot** - `cc6d2b3` (test)
4. **Task 2 GREEN: prompt rebuild + PbxStateAiAdapter** - `016e8d7` (feat)
5. **Task 3 RED: provider errors and cancellation** - `326eccf` (test)
6. **Task 3 GREEN: missing-llm, tools fallback, axios non-stream** - `7a29743` (feat)

**Plan metadata:** docs commit (SUMMARY + STATE + ROADMAP) follows this file

_Note: TDD tracer/auto tasks have two commits each (test → feat)._

## Files Created/Modified

- `packages/backend/src/modules/ai-chat/pbx-agent.types.ts` — ChatMessage, AgentToolCall, AgentCompletion, SSE event names
- `packages/backend/src/modules/ai-chat/pbx-agent-llm.client.ts` — streaming fetch + non-streaming axios, abort, tools fallback
- `packages/backend/src/modules/ai-chat/pbx-agent-llm.client.spec.ts` — URL/auth, stream+tools, abort, structured errors
- `packages/backend/src/modules/ai-agents/ai-providers.service.ts` — `findDefaultLlm()` + 60s cache
- `packages/backend/src/modules/ai-agents/ai-providers.service.spec.ts` — default id, tenant-over-global, cache
- `packages/backend/src/modules/ai-chat/pbx-context-builder.service.ts` — four-block prompt, `toCompactSnapshot()`
- `packages/backend/src/modules/ai-chat/pbx-context-builder.service.spec.ts` — catalog, knowledge, language, HITL, snapshot tool
- `packages/backend/src/modules/ai-chat/pbx-state-ai.adapter.ts` — `get_pbx_state` with optional domain filter
- `packages/backend/src/modules/ai-chat/ai-chat.module.ts` — client, adapter, AiAgentsModule

## Decisions Made

- **Default provider is administrator-only.** `CC_AI_DEFAULT_PROVIDER_UID` wins when that row is enabled and has `llm`; otherwise tenant rows beat `user_uid=0` templates.
- **Tool calling is an advertised capability.** Native `tools` only when the row lists `tools` or `function_calling`. Otherwise the catalog is serialized into the system message and a single JSON object is parsed from the reply, with a warning so eval can flag degraded mode.
- **Prompt is language-neutral.** The model answers in the question language and falls back to the UI locale; skill files stay single-language.
- **One snapshot implementation.** `toCompactSnapshot()` is the source for both the prompt block and `get_pbx_state`, so they cannot drift.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test fixture used `/v1` which the existing URL resolver treats as a prefix**
- **Found during:** Task 1 GREEN
- **Issue:** `https://api.openai.com/v1` becomes `.../v1/v1/chat/completions`
- **Fix:** Fixture uses `https://api.openai.com`; resolver appends `/v1/chat/completions`
- **Files modified:** `pbx-agent-llm.client.spec.ts`
- **Committed in:** `4d5ab98`

**2. [Rule 3 - Blocking] Native `ReadableStream` + `Response` locks the body in Node**
- **Found during:** Task 1 GREEN
- **Issue:** `new Response(stream)` then `body.getReader()` threw `ReadableStream is locked`
- **Fix:** Tests use a fake `{ getReader() }` body; production still reads `fetch` streams
- **Files modified:** `pbx-agent-llm.client.spec.ts`
- **Committed in:** `4d5ab98`

**3. [Rule 2 - Missing Critical] Invalidate the 60s default-LLM cache on provider writes**
- **Found during:** Task 1 GREEN
- **Issue:** An admin enable/disable would otherwise serve a stale row for a minute
- **Fix:** `create` / `update` / `remove` clear the cache
- **Files modified:** `ai-providers.service.ts`
- **Committed in:** `4d5ab98`

---

**Total deviations:** 3 auto-fixed (1 bug, 1 blocking, 1 missing critical)
**Impact on plan:** All required for correctness of URL resolution, stream tests, and provider cache. No scope creep.

## Issues Encountered

- PowerShell cannot run bash heredoc commits; used `-F` message files under `.tmp/` (not staged). Same as 15-01–15-03.

## User Setup Required

None - no external service configuration required. Administrators already manage `cc_ai_providers` and may set `CC_AI_DEFAULT_PROVIDER_UID`.

## Next Phase Readiness

- 15-05 / 15-08 can call `PbxAgentLlmClient.chat()` with an `AbortSignal` and persist `usage` onto thread rows from 15-03
- 15-07 handwritten `get_pbx_state` should yield to this adapter (same tool name)
- 15-15 can delete `KnowledgeBaseService`; adapter knowledge already comes from the registry

## TDD Gate Compliance

Plan frontmatter is `type: execute` with all three tasks `tdd="true"`. RED commits `7f0531b`, `cc6d2b3`, `326eccf` failed before implementation. GREEN commits `4d5ab98`, `016e8d7`, `7a29743` passed. Tracer verify after Task 1 re-ran `pbx-agent-llm|ai-providers` (20 passed) and continued (`human_verify_mode` default end-of-phase). Overall verify: 34 passed.

## Self-Check: PASSED

- FOUND: `packages/backend/src/modules/ai-chat/pbx-agent-llm.client.ts` (`chat`, `signal`)
- FOUND: `packages/backend/src/modules/ai-chat/pbx-agent.types.ts` (`ChatMessage`, `AgentToolCall`)
- FOUND: `packages/backend/src/modules/ai-chat/pbx-context-builder.service.ts` (`getCatalog`, `getKnowledgeBlocks`, language rule)
- FOUND: `packages/backend/src/modules/ai-chat/pbx-state-ai.adapter.ts` (`get_pbx_state`)
- FOUND: commits `7f0531b`, `4d5ab98`, `cc6d2b3`, `016e8d7`, `326eccf`, `7a29743`

---
*Phase: 15-universal-pbx-ai-agent*
*Completed: 2026-09-04*
