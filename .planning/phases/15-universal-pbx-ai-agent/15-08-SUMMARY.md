---
phase: 15-universal-pbx-ai-agent
plan: 08
subsystem: api
tags: [agent-loop, sse, d-06, d-09, d-13, d-18, d-26]

requires:
  - phase: 15-universal-pbx-ai-agent
    provides: PbxAgentLlmClient chat() with AbortSignal (15-04)
  - phase: 15-universal-pbx-ai-agent
    provides: callTool persist path for proposes tools (15-05)
  - phase: 15-universal-pbx-ai-agent
    provides: adapter precedence so the loop sees one catalog (15-07)
provides:
  - In-process PbxAgentLoopService turn (model + McpToolsService.callTool, no chat proxy)
  - SSE framing helper with idle heartbeat
  - Turn endpoint streams loop events from the token; AiChatService deleted
affects:
  - 15-09 (panel consumes progress, proposal, cancelled, max_steps_exceeded)
  - 15-15 (proxy already gone; remaining handwritten tools still dispatch through callTool)
  - 15-24 (token usage already accumulated onto the thread row)

actuals:
  tokens: 11938
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - Manual SSE header-and-write plus comment heartbeat; not Nest @Sse
    - One callTool path with tenant from the token, never from model arguments
    - Step counted per model call; abort checked before each model call and each dispatch

key-files:
  created:
    - packages/backend/src/modules/ai-chat/pbx-agent-loop.service.ts
    - packages/backend/src/modules/ai-chat/pbx-agent-loop.service.spec.ts
    - packages/backend/src/modules/ai-chat/agent-sse.util.ts
    - packages/backend/src/modules/ai-chat/agent-sse.util.spec.ts
    - packages/backend/src/modules/ai-chat/ai-chat.controller.spec.ts
  modified:
    - packages/backend/src/modules/ai-chat/ai-chat.controller.ts
    - packages/backend/src/modules/ai-chat/ai-chat.module.ts
    - packages/backend/src/modules/mcp/mcp.module.ts
  deleted:
    - packages/backend/src/modules/ai-chat/ai-chat.service.ts

key-decisions:
  - "Progress names the tool before dispatch; ceiling default is CC_AI_MAX_AGENT_STEPS=12"
  - "Stream event for a pending draft is proposal so the existing panel parser can render the card"
  - "forwardRef between AiChatModule and McpModule so the loop injects the single callTool path"

patterns-established:
  - "Pattern: persist user/tool/assistant as they happen; accumulate usage after each completion"
  - "Pattern: invalid tool args return a structured tool error once, then tool_arg_retries_exceeded"
  - "Pattern: AbortSignal from req.close is the same signal passed to PbxAgentLlmClient.chat()"

requirements-completed: [D-06, D-09, D-13, D-18, D-26]

coverage:
  - id: D1
    description: A conversation turn runs model calls and tool calls inside this application; no request leaves for an external chat service (D-06)
    requirement: D-06
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-chat/pbx-agent-loop.service.spec.ts#runs one read tool then an answer and yields progress, tool call, tool result, text, done
        status: pass
    human_judgment: false
  - id: D2
    description: The old proxy path is gone from the codebase, not merely unused (D-06)
    requirement: D-06
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-chat/ai-chat.controller.spec.ts#does not keep the proxy service or read external chat environment variables
        status: pass
    human_judgment: false
  - id: D3
    description: Every step of a turn emits a progress event naming the tool being run (D-09)
    requirement: D-09
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-chat/pbx-agent-loop.service.spec.ts#runs one read tool then an answer and yields progress, tool call, tool result, text, done
        status: pass
    human_judgment: false
  - id: D4
    description: The loop stops at the configured step ceiling and reports it instead of calling the model again (D-09)
    requirement: D-09
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-chat/pbx-agent-loop.service.spec.ts#stops at the configured step ceiling and makes no further model call
        status: pass
    human_judgment: false
  - id: D5
    description: Pressing stop or disconnecting aborts the in-flight model request and skips remaining tool calls (D-09)
    requirement: D-09
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-chat/pbx-agent-loop.service.spec.ts#aborts the in-flight model request and emits cancelled without further tools
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/ai-chat/pbx-agent-loop.service.spec.ts#skips remaining tool calls of a batch when aborted between them
        status: pass
    human_judgment: false
  - id: D6
    description: A mutating tool inside a turn yields a pending proposal in the stream and performs no write (D-18)
    requirement: D-18
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-chat/pbx-agent-loop.service.spec.ts#emits a pending proposal event and continues the turn without a write
        status: pass
    human_judgment: false
  - id: D7
    description: Every turn's messages, token counts and terminal outcome are persisted to the conversation (D-26)
    requirement: D-26
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-chat/pbx-agent-loop.service.spec.ts#appends the user message, tool exchange and final answer in order and accumulates tokens
        status: pass
    human_judgment: false
  - id: D8
    description: Stream frames each event with its name and a single payload line, and heartbeats when idle
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-chat/agent-sse.util.spec.ts#frames each event with its name and a single serialized payload line
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/ai-chat/agent-sse.util.spec.ts#emits a heartbeat when idle beyond the configured interval
        status: pass
    human_judgment: false

duration: 50min
completed: 2026-09-04
status: complete
---

# Phase 15 Plan 08: In-Process Agent Turn Summary

**In-process Nest agent loop with per-tool progress, step ceiling, working cancel, pending-proposal events, and the aiPBX chat proxy deleted**

## Performance

- **Duration:** 50 min
- **Started:** 2026-09-04T12:01:00Z
- **Completed:** 2026-09-04T12:51:00Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- A turn runs `PbxAgentLlmClient` + `McpToolsService.callTool` in this process; tenant comes from the turn context
- Progress names the tool before dispatch; tool results stay out of the answer text
- `CC_AI_MAX_AGENT_STEPS` (default 12) stops the loop before the next model call
- Client disconnect / abort cancels the in-flight model request and skips remaining tools
- A pending proposal is emitted as `event: proposal`; invalid args retry once then end the turn
- `AiChatService` and `AIPBX_*` reads are gone; POST `/ai-chat/message` streams the loop

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1 RED: in-process turn + SSE framing** - `4e72128` (test)
2. **Task 1 GREEN: loop + heartbeat helper** - `fa9bcc9` (feat)
3. **Task 2 RED: ceiling, cancel, proposals, arg retries** - `30a4a95` (test)
4. **Task 2 GREEN: enforce D-09 / D-18 loop gates** - `6933c04` (feat)
5. **Task 3 RED: turn endpoint and proxy removal** - `9696941` (test)
6. **Task 3 GREEN: rewire controller, delete proxy** - `faffed1` (feat)

**Plan metadata:** docs commit (SUMMARY + STATE + ROADMAP) follows this file

_Note: TDD tracer/auto tasks have two commits each (test → feat)._

## Files Created/Modified

- `packages/backend/src/modules/ai-chat/pbx-agent-loop.service.ts` — in-process turn: model, callTool, ceiling, cancel, proposals
- `packages/backend/src/modules/ai-chat/pbx-agent-loop.service.spec.ts` — fixture-driven event sequence, abort, ceiling, validation
- `packages/backend/src/modules/ai-chat/agent-sse.util.ts` — named SSE frames + idle heartbeat
- `packages/backend/src/modules/ai-chat/agent-sse.util.spec.ts` — framing and heartbeat
- `packages/backend/src/modules/ai-chat/ai-chat.controller.ts` — token-scoped turn; proxy path removed
- `packages/backend/src/modules/ai-chat/ai-chat.controller.spec.ts` — abort forward, identity reject, proxy-absence assertion
- `packages/backend/src/modules/ai-chat/ai-chat.module.ts` — registers loop; drops AiChatService
- `packages/backend/src/modules/mcp/mcp.module.ts` — `forwardRef` to break the Nest cycle
- `packages/backend/src/modules/ai-chat/ai-chat.service.ts` — deleted

## Decisions Made

- **Progress names the tool.** D-09 in this plan is a line before dispatch, not only `{step,maxSteps}` before the LLM call.
- **Proposal event name is `proposal`.** Matches the existing frontend SSE parser (`onProposal`).
- **Ceiling is 12 model calls.** `CC_AI_MAX_AGENT_STEPS`; stop is before the next call.
- **Arg retries = 1.** First invalid schema returns a tool error to the model; a second failure on the same tool ends the turn.
- **Module cycle uses `forwardRef`.** The loop must call `McpToolsService`; McpModule already imported AiChatModule.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Abort-during-model test raced the loop's pre-call abort check**
- **Found during:** Task 2 GREEN
- **Issue:** Two microtasks were not enough; abort sometimes fired before `llm.chat`, so the mock never ran.
- **Fix:** Test waits for `chat` to start, then aborts.
- **Files modified:** `pbx-agent-loop.service.spec.ts`
- **Verification:** abort-in-flight test passes
- **Committed in:** `6933c04`

**2. [Rule 3 - Blocking] Circular Nest import AiChatModule ↔ McpModule**
- **Found during:** Task 3 GREEN
- **Issue:** The loop injects `McpToolsService`; McpModule already imports AiChatModule.
- **Fix:** `forwardRef` on both sides. `mcp.module.ts` is outside the plan file list but required for boot.
- **Files modified:** `ai-chat.module.ts`, `mcp.module.ts`
- **Verification:** controller + loop suites pass
- **Committed in:** `faffed1`

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Required for a reliable cancel test and for Nest to resolve `callTool`. No scope creep.

## Issues Encountered

- PowerShell cannot run bash heredoc commits; used `-F` message files under `.tmp/` (not staged). Same as 15-04–15-07.
- Task 2 RED first hung on an unbounded loop fixture; safety text completions were added so RED fails instead of hanging.

## User Setup Required

None - no external service configuration required. Administrators already manage `cc_ai_providers`. Optional: `CC_AI_MAX_AGENT_STEPS` (default 12), `CC_AI_TOOL_ARG_RETRIES` (default 1).

## Next Phase Readiness

- Ready for 15-09 (remaining handwritten mutations → proposals) and later UI work that already listens for `proposal` / `progress`
- GET `/ai-chat/models` now returns `[]` (D-07: tenants do not pick a model)
- Client may send optional `threadUid`; otherwise the turn creates a thread

## TDD Gate Compliance

Plan frontmatter is `type: execute` with all three tasks `tdd="true"`. RED commits `4e72128`, `30a4a95`, `9696941` failed before implementation. GREEN commits `fa9bcc9`, `6933c04`, `faffed1` passed. Tracer verify after Task 1 re-ran `pbx-agent-loop|agent-sse` (4 passed) and continued (`human_verify_mode` default end-of-phase). Overall verify: 13 passed.

## Verification

```
npm run test -w @krasterisk/backend -- --testPathPattern="pbx-agent-loop|agent-sse|ai-chat.controller" --no-coverage
```

13 passed.

## Self-Check: PASSED

- FOUND: `packages/backend/src/modules/ai-chat/pbx-agent-loop.service.ts` (`runTurn`, `callTool`, `max_steps_exceeded`, `cancelled`)
- FOUND: `packages/backend/src/modules/ai-chat/agent-sse.util.ts` (`formatSseEvent`, `SseStreamSession`)
- FOUND: `packages/backend/src/modules/ai-chat/ai-chat.controller.ts` (`runTurn`, abort on `close`)
- MISSING (intentional): `packages/backend/src/modules/ai-chat/ai-chat.service.ts`
- FOUND: commits `4e72128`, `fa9bcc9`, `30a4a95`, `6933c04`, `9696941`, `faffed1`

---
*Phase: 15-universal-pbx-ai-agent*
*Completed: 2026-09-04*
