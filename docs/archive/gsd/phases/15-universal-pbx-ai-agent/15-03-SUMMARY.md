---
phase: 15-universal-pbx-ai-agent
plan: 03
subsystem: database
tags: [sequelize, threads, d-08, d-26, tenant-isolation]

requires:
  - phase: 15-universal-pbx-ai-agent
    provides: AgentDiffProposal type and sanitized dispatch (15-01)
provides:
  - Tenant- and author-scoped AgentThread / AgentThreadMessage persistence
  - AgentProposal row with server-only apply_payload
  - Token counters on the conversation for D-08 spend
  - cc_ai_audit_log.thread_uid conversation reference
  - Idempotent db:setup:agent-threads migration
affects:
  - 15-04 (chat loop reads/writes threads)
  - 15-05 (writes proposals; Apply reads apply_payload)
  - 15-08 (usage / pricing from thread counters)

actuals:
  tokens: 9638
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - Every thread read/write puts vpbx_user_uid and user_uid in the where clause; no findByPk
    - Standalone ts-node migration with create-if-absent and guarded indexes
    - Usage accumulates on the thread row; per-turn split lands on the latest message

key-files:
  created:
    - packages/backend/src/modules/ai-chat/models/agent-thread.model.ts
    - packages/backend/src/modules/ai-chat/models/agent-thread-message.model.ts
    - packages/backend/src/modules/ai-chat/models/agent-proposal.model.ts
    - packages/backend/src/modules/ai-chat/pbx-agent-thread.service.ts
    - packages/backend/src/modules/ai-chat/pbx-agent-thread.service.spec.ts
    - packages/backend/src/modules/ai-chat/migrate-agent-threads.ts
  modified:
    - packages/backend/src/modules/ai-agents/models/ai-audit-log.model.ts
    - packages/backend/src/modules/ai-chat/ai-chat.module.ts
    - packages/backend/src/app.module.ts
    - packages/backend/package.json

key-decisions:
  - "Tables named ai_agent_* beside ai_chat_settings, not cc_ai_* voice-agent prefix"
  - "proposal_id is crypto.randomUUID(), not the outdated uuid package"
  - "Audit conversation ref is a new thread_uid column, not call_uniqueid reuse"
  - "test:ai regex covers ai-agents, ai-platform, and ai-chat — there is no tool-registry module path"

patterns-established:
  - "Pattern: findOwnedThread(uid, vpbxUserUid, userUid) before every message write; NotFoundException never leaks content"
  - "Pattern: addUsage increments tenant-scoped thread counters then writes the split onto the latest message"
  - "Pattern: db:setup:agent-threads mirrors db:setup:directories; not attached to the broken db:migrate runner"

requirements-completed: [D-08, D-26]

coverage:
  - id: D1
    description: A conversation and its messages survive a reload because they live in the database, scoped to tenant and author (D-26)
    requirement: D-26
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-chat/pbx-agent-thread.service.spec.ts#lists threads for the same tenant and author, newest first
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/ai-chat/pbx-agent-thread.service.spec.ts#returns appended messages in insertion order after a reload-style read
        status: pass
    human_judgment: false
  - id: D2
    description: Reading a conversation that belongs to another tenant or another author yields not-found, never content
    requirement: D-26
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-chat/pbx-agent-thread.service.spec.ts#hides another tenant’s conversation
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/ai-chat/pbx-agent-thread.service.spec.ts#hides another author’s conversation in the same tenant
        status: pass
    human_judgment: false
  - id: D3
    description: Token counts accumulate on the conversation row so per-tenant spend can be priced from the provider record (D-08)
    requirement: D-08
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-chat/pbx-agent-thread.service.spec.ts#addUsage increments thread counters and writes the per-message split
        status: pass
    human_judgment: false
  - id: D4
    description: The audit table can point at the conversation that produced a tool call
    requirement: D-08
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-chat/pbx-agent-thread.service.spec.ts#exposes a nullable thread_uid distinct from call_uniqueid
        status: pass
    human_judgment: false
  - id: D5
    description: Proposal table shape and status vocabulary are fixed for 15-05
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-chat/pbx-agent-thread.service.spec.ts#declares apply_payload and the card-badge status vocabulary
        status: pass
    human_judgment: false

duration: 35min
completed: 2026-09-04
status: complete
---

# Phase 15 Plan 03: Persistent agent threads Summary

**Sequelize conversation store with tenant+author scope, D-08 token counters, and a proposal table for 15-05**

## Performance

- **Duration:** 35 min
- **Started:** 2026-09-04T07:37:44Z
- **Completed:** 2026-09-04T08:12:23Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- Threads and messages persist in `ai_agent_threads` / `ai_agent_thread_messages`; every service query includes `vpbx_user_uid` and `user_uid`
- Cross-tenant and cross-author reads throw `NotFoundException`; `findByPk` is unused
- `addUsage` increments conversation counters and writes the per-message token split
- `AgentProposal` fixes the confirmation-card status vocabulary and documents `apply_payload` as server-side only
- `cc_ai_audit_log.thread_uid` names the conversation that produced a tool call
- `npm run db:setup:agent-threads` creates the three tables and the audit column idempotently

## Task Commits

Each task was committed atomically:

1. **Task 1 RED:** `fa89353` (test) — failing tests for tenant-scoped threads
2. **Task 1 GREEN:** `4476388` (feat) — AgentThread, AgentThreadMessage, PbxAgentThreadService
3. **Task 2 RED:** `05e5b48` (test) — failing tests for usage, proposal shape, audit link
4. **Task 2 GREEN:** `5699dd5` (feat) — addUsage split, AgentProposal, audit thread_uid
5. **Task 3:** `eca0e70` (feat) — migrate-agent-threads.ts and test:ai coverage

## Files Created/Modified

- `packages/backend/src/modules/ai-chat/models/agent-thread.model.ts` — conversation row with tenant, author, token counters
- `packages/backend/src/modules/ai-chat/models/agent-thread-message.model.ts` — denormalized tenant on every message
- `packages/backend/src/modules/ai-chat/models/agent-proposal.model.ts` — pending change proposal; apply_payload never for the browser
- `packages/backend/src/modules/ai-chat/pbx-agent-thread.service.ts` — scoped CRUD, rename-from-first-message, addUsage
- `packages/backend/src/modules/ai-chat/pbx-agent-thread.service.spec.ts` — isolation, order, usage, model-shape tests
- `packages/backend/src/modules/ai-chat/migrate-agent-threads.ts` — standalone create-if-absent migration
- `packages/backend/src/modules/ai-agents/models/ai-audit-log.model.ts` — nullable thread_uid
- `packages/backend/src/modules/ai-chat/ai-chat.module.ts` — models + exported PbxAgentThreadService
- `packages/backend/src/app.module.ts` — Sequelize registration (sync off)
- `packages/backend/package.json` — `db:setup:agent-threads`; broader `test:ai` (version left at 4.4.1)

## Decisions Made

- Table names follow `ai_chat_settings`, not the voice-agent `cc_ai_*` prefix — one-way once rows exist
- `proposal_id` uses `crypto.randomUUID()`, not the outdated `uuid` dependency
- Audit conversation reference is a new `thread_uid` column; `call_uniqueid` stays the voice-agent call id
- `listMessages` is a first-class service method so a reload can re-read insertion order after `getThread` proves ownership
- `addUsage` writes the split onto the latest message in the scoped thread (signature has no message uid)
- Optional SQL copies under `packages/backend/migrations/` were skipped because `**/migrations/` is gitignored

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Registered AgentProposal in Sequelize lists during Task 2**
- **Found during:** Task 2
- **Issue:** Task 1 said “register all three models” but the proposal model is Task 2; leaving it unregistered would hide the table from the connection
- **Fix:** Added `AgentProposal` to `app.module.ts` and `ai-chat.module.ts` with the other two models
- **Files modified:** `packages/backend/src/app.module.ts`, `packages/backend/src/modules/ai-chat/ai-chat.module.ts`
- **Verification:** unit suite still green
- **Committed in:** `5699dd5`

**2. [Rule 2 - Missing Critical] Kept backend package version at 4.4.1**
- **Found during:** Task 3
- **Issue:** Working tree had an unrelated 4.4.1 → 4.4.3 bump
- **Fix:** Script edits only; version stayed at HEAD 4.4.1
- **Files modified:** `packages/backend/package.json`
- **Verification:** `git diff HEAD` for version is empty
- **Committed in:** `eca0e70`

---

**Total deviations:** 2 auto-fixed (2 missing critical)
**Impact on plan:** Registration and dirty-tree hygiene only. No scope creep.

## Issues Encountered

- Plan asked `test:ai` to cover a “tool-registry” path; that directory does not exist. Coverage is `ai-agents|ai-platform|ai-chat` (platform holds the adapter registry).
- `**/migrations/` is gitignored, so optional engine SQL files were not added.

## User Setup Required

None - no external service configuration required. An operator applies schema with `npm run db:setup:agent-threads -w @krasterisk/backend` when ready.

## Next Phase Readiness

- Ready for 15-04 (agent loop can persist turns) and 15-05 (proposal write / Apply)
- Tables are not auto-created (`synchronize: false`); the setup script must be run on each environment
- Retention/purge of persisted personal data remains `/gsd-secure-phase 15` (T-15-14)

## TDD Gate Compliance

- Task 1: RED `fa89353` then GREEN `4476388`
- Task 2: RED `05e5b48` then GREEN `5699dd5`
- Task 3: not TDD (migration + scripts)

## Verification

```
npm run test -w @krasterisk/backend -- --testPathPattern="pbx-agent-thread" --no-coverage
```

9 passed (Task 1 tracer re-run + Task 2 + Task 3).

---
## Self-Check: PASSED

All key files exist on disk. Commits `fa89353`, `4476388`, `05e5b48`, `5699dd5`, `eca0e70` are in git log.

---
*Phase: 15-universal-pbx-ai-agent*
*Completed: 2026-09-04*
