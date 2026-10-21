---
phase: 15-universal-pbx-ai-agent
plan: 21
subsystem: api
tags: [mcp, adapters, d-12, d-15, d-22, notifications, prompts, service-requests, claims]

requires:
  - phase: 15-universal-pbx-ai-agent
    provides: Adapter-over-handwritten precedence and registry-enumerated isolation suite (15-07)
provides:
  - NotificationsAiAdapter list_notifications with shared count ceiling and body preview
  - PromptsAiAdapter list_audio_prompts metadata and IVR references, no audio or paths
  - ServiceRequestsAiAdapter and KomandorClaimsAiAdapter bounded subject listings
  - Shared operations skill plus batch spec for read-only, content-bounded and per-tool isolation
affects:
  - 15-23 (completeness gate sees notifications, prompts, service-requests, komandor-claims; shared skill operations)

actuals:
  tokens: 11800
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - Four operational domains share OPERATIONS_RESULT_CEILING and OPERATIONS_PREVIEW_LENGTH
    - Media reads return metadata and references only
    - Request/claim reads emit status, timestamp and truncated subject only
    - Four adapter domains share one skill file (operations) for the 15-23 coverage rule

key-files:
  created:
    - packages/backend/src/modules/notifications/notifications-ai.adapter.ts
    - packages/backend/src/modules/prompts/prompts-ai.adapter.ts
    - packages/backend/src/modules/service-requests/service-requests-ai.adapter.ts
    - packages/backend/src/modules/komandor-claims/komandor-claims-ai.adapter.ts
    - packages/backend/src/modules/ai-platform/read-adapters-operations.spec.ts
    - packages/backend/src/skills/operations/SKILL.md
  modified:
    - packages/backend/src/modules/notifications/notifications.module.ts
    - packages/backend/src/modules/prompts/prompts.module.ts
    - packages/backend/src/modules/service-requests/service-requests.module.ts
    - packages/backend/src/modules/komandor-claims/komandor-claims.module.ts

key-decisions:
  - "Shared ceiling 20 and preview 120 live on the notifications adapter and are imported by the other three"
  - "Notification list maps over existing findAll; history-shaped rows keep kind/status/timestamp, integrations map channel to kind"
  - "Prompt reads omit filename, audio and paths; IVR scan supplies referencedBy"
  - "Request and claim subjects use topic then truncated free text; phones, addresses and full bodies stay out"
  - "Four domains share skills/operations so 15-23 does not demand per-module stub files"

patterns-established:
  - "Pattern: operational free-text domains share one result ceiling and one preview length"
  - "Pattern: media domains answer with metadata and who references them, never bytes or paths"
  - "Pattern: four adapter domains may share one skill when the read-only operational story is the same"

requirements-completed: [D-12, D-15, D-22]

coverage:
  - id: D1
    description: Notifications are readable, count-clamped, body-truncated and tenant-isolated, with no write surface (D-12, D-15)
    requirement: D-15
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/read-adapters-operations.spec.ts#returns the tenant recent notifications with kind, status and timestamp
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/read-adapters-operations.spec.ts#clamps a requested result count above the documented ceiling
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/read-adapters-operations.spec.ts#truncates notification bodies to the documented preview length
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/read-adapters-operations.spec.ts#declares no mutating tool
        status: pass
    human_judgment: false
  - id: D2
    description: Audio prompts, service requests and claims are readable, bounded, media-free and tenant-isolated, with no write surface (D-15)
    requirement: D-15
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/read-adapters-operations.spec.ts#lists the tenant audio prompts with name, duration and referencing entities
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/read-adapters-operations.spec.ts#returns no audio content and no fetchable path
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/read-adapters-operations.spec.ts#lists requests with status, timestamps and a truncated subject using shared bounds
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/read-adapters-operations.spec.ts#lists claims with status, timestamps and a truncated subject using shared bounds
        status: pass
    human_judgment: false
  - id: D3
    description: One shared operational skill parses and all four domains have per-tool cross-tenant assertions (D-12, D-22)
    requirement: D-22
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/read-adapters-operations.spec.ts#ships one operations skill covering all four domains, preview and the read-only boundary
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/read-adapters-operations.spec.ts#proves per-tool cross-tenant isolation and forged-key ignore for every operations adapter tool
        status: pass
    human_judgment: false

duration: 18min
completed: 2026-09-04
status: complete
---

# Phase 15 Plan 21: Operational read adapters Summary

**Last four tenant-facing domains — notifications, audio prompts, service requests and claims — readable with a shared count ceiling and preview length, no write surface, and a shared operations skill**

## Performance

- **Duration:** 18 min
- **Started:** 2026-09-04T13:37:00Z
- **Completed:** 2026-09-04T13:55:00Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- `list_notifications` returns kind, status, timestamp and a 120-char preview; count above 20 is clamped
- `list_audio_prompts` returns name, duration and IVR references; no audio bytes and no fetchable path
- `list_service_requests` and `list_claims` return status, timestamps and a truncated subject using the same ceiling and preview
- None of the four adapters declares a mutating tool
- Shared `skills/operations/SKILL.md` covers all four module directories for the 15-23 shared-skill rule
- Per-tool isolation and forged-key ignore cover all four list tools

## Coverage handoff for 15-23

After this plan every tenant-facing module directory is either adapter-covered or belongs on the classification list with a reason. The four remainders from D-15 — `notifications`, `prompts`, `service-requests`, `komandor-claims` — now have adapters. 15-23 can write the completeness rule against this set rather than a moving target. The four share `skills/operations` so the skill rule should declare a shared skill instead of requiring stub files per directory.

## Task Commits

Each task was committed atomically (TDD RED → GREEN where required):

1. **Task 1 RED: notifications read** - `3007924` (test)
2. **Task 1 GREEN: notifications adapter** - `b6754b9` (feat)
3. **Task 2 RED: prompts, requests, claims** - `517faba` (test)
4. **Task 2 GREEN: three read adapters** - `50c67b0` (feat)
5. **Task 3: shared skill and isolation** - `b767d24` (feat)

**Plan metadata:** docs commit (SUMMARY + STATE + ROADMAP) follows this file

_Note: TDD tasks have multiple commits (test → feat)._

## Files Created/Modified

- `packages/backend/src/modules/notifications/notifications-ai.adapter.ts` — `list_notifications`, shared ceiling/preview constants
- `packages/backend/src/modules/notifications/notifications.module.ts` — registers the adapter
- `packages/backend/src/modules/prompts/prompts-ai.adapter.ts` — metadata-only prompt list with IVR references
- `packages/backend/src/modules/prompts/prompts.module.ts` — registers the adapter
- `packages/backend/src/modules/service-requests/service-requests-ai.adapter.ts` — bounded request list
- `packages/backend/src/modules/service-requests/service-requests.module.ts` — registers the adapter
- `packages/backend/src/modules/komandor-claims/komandor-claims-ai.adapter.ts` — bounded claim list
- `packages/backend/src/modules/komandor-claims/komandor-claims.module.ts` — registers the adapter
- `packages/backend/src/modules/ai-platform/read-adapters-operations.spec.ts` — read-only, content-bounded and isolation assertions
- `packages/backend/src/skills/operations/SKILL.md` — shared skill for the four domains

## Decisions Made

- **Shared bounds live on the notifications adapter.** `OPERATIONS_RESULT_CEILING = 20` and `OPERATIONS_PREVIEW_LENGTH = 120` are the single source the other three import, so the four do not drift.
- **Notification list uses existing `findAll`.** There is no delivery-history table; the mapper accepts history-shaped rows (kind/status/timestamp/body) and maps integration `channel` to kind when those fields are absent.
- **Prompt output is metadata only.** Filename, filesystem path, TTS script and audio bytes stay out; `referencedBy` comes from a tenant-scoped IVR prompt scan.
- **Subject, not correspondence.** Requests and claims expose `topic` (else a truncated comment/description). Phones, addresses, production notes and full bodies never enter the tool result.
- **One skill file for four directories.** Same justification as `speech-engines`: a stub per module would satisfy 15-23 without teaching the model anything.

## Deviations from Plan

None - plan executed exactly as written.

---

**Total deviations:** 0
**Impact on plan:** None.

## Issues Encountered

- PowerShell cannot run bash heredoc commits; used `-F` message files under `.tmp/` (not staged).
- `NotificationsService` has no persisted delivery log. The adapter still lists over `findAll` as specified; fixtures supply history-shaped rows.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 15-23 can classify every module directory: these four are covered and share `operations`
- No mutating operational tools were opened; send/create/update stay on their human screens
- Completeness rule no longer needs an exceptions list for these remainders

## TDD Gate Compliance

Plan frontmatter is `type: execute` with per-task `tdd="true"` on Tasks 1–2. Each of those has a `test(15-21)` RED commit followed by a `feat(15-21)` GREEN commit. Tracer feedback gate re-ran `read-adapters-operations` after Task 1 (5 passed) and continued (`human_verify_mode` default end-of-phase, automated-only verify). Task 3 is not TDD.

## Verification

```
npm run test -w @krasterisk/backend -- --testPathPattern="read-adapters-operations|legacy-tool-migration" --no-coverage
```

Task 1: 5 passed. Task 2: 15 passed. Task 3: 39 passed (`read-adapters-operations` + `agent-skill-registry` + `legacy-tool-migration`).

## Self-Check: PASSED

- FOUND: `packages/backend/src/modules/notifications/notifications-ai.adapter.ts`
- FOUND: `packages/backend/src/modules/prompts/prompts-ai.adapter.ts`
- FOUND: `packages/backend/src/modules/service-requests/service-requests-ai.adapter.ts`
- FOUND: `packages/backend/src/modules/komandor-claims/komandor-claims-ai.adapter.ts`
- FOUND: `packages/backend/src/modules/ai-platform/read-adapters-operations.spec.ts`
- FOUND: `packages/backend/src/skills/operations/SKILL.md`
- FOUND: commits `3007924`, `b6754b9`, `517faba`, `50c67b0`, `b767d24`

