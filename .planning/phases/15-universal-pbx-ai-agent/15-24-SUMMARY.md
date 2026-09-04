---
phase: 15-universal-pbx-ai-agent
plan: 24
subsystem: api
tags: [ai-chat, usage, spend, superadmin, silent-write, d-07, d-08]

requires:
  - phase: 15-universal-pbx-ai-agent
    provides: Conversation token counters and proposal table (15-03)
  - phase: 15-universal-pbx-ai-agent
    provides: Provider pricing fields and findDefaultLlm (15-04 / 15-15)
provides:
  - Per-tenant token totals and spend from conversation rows
  - Platform-administrator-only usage, funnel and error endpoints
  - Silent-write detector on an in-process interval
  - Admin card default-model picker and usage view
affects:
  - gsd-secure-phase 15
  - platform admin settings

actuals:
  tokens: 12512
  tasks: 3
  commits: 7

tech-stack:
  added: []
  patterns:
    - Spend is null plus spendAvailable=false when pricing fields are absent; explicit zero pricing stays zero
    - Usage aggregation reads ai_agent_threads only
    - SuperAdminGuard on every /ai-chat/usage route
    - Silent-write scan uses @Interval like the voicemail scanner

key-files:
  created:
    - packages/backend/src/modules/ai-chat/agent-usage.service.ts
    - packages/backend/src/modules/ai-chat/agent-usage.service.spec.ts
    - packages/backend/src/modules/ai-chat/agent-usage.controller.ts
    - packages/frontend/src/features/cloud-admin/ui/AiChatSettingsCard/AiChatSettingsCard.test.tsx
  modified:
    - packages/backend/src/modules/ai-chat/ai-chat.module.ts
    - packages/frontend/src/features/cloud-admin/ui/AiChatSettingsCard/AiChatSettingsCard.tsx
    - packages/frontend/src/features/cloud-admin/ui/AiChatSettingsCard/AiChatSettingsCard.module.scss
    - packages/frontend/src/shared/api/endpoints/aiChatApi.ts
    - packages/frontend/src/shared/config/locales/en.ts
    - packages/frontend/src/shared/config/locales/ru.ts

key-decisions:
  - "Spend unavailable is distinct from zero on both the API and the admin card"
  - "Default provider uid is stored on ai_chat_settings user_uid=0; findDefaultLlm still prefers CC_AI_DEFAULT_PROVIDER_UID"
  - "Silent-write detector matches mutating audit rows to applied proposals by tenant and thread"
  - "Admin locale keys live under aiChat.admin"

patterns-established:
  - "Pattern: queryTenantUsage groups conversation rows by vpbx_user_uid and prices against CcAiProvider.pricing"
  - "Pattern: detectSilentWrites logs error with tenant, tool and audit uid, then returns the hit list"
  - "Pattern: AiChatSettingsCard returns null unless selectIsSuperAdmin"

requirements-completed: [D-07, D-08]

coverage:
  - id: D1
    description: Per-tenant token totals and spend are queryable by the platform administrator only, honest about missing pricing, and sourced from conversation rows
    requirement: D-08
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-chat/agent-usage.service.spec.ts#returns per-tenant input/output token totals and turns over a date range
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/ai-chat/agent-usage.service.spec.ts#reports spend as unavailable rather than zero when pricing is absent
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/ai-chat/agent-usage.service.spec.ts#guards the controller with JWT and SuperAdmin so a tenant-role caller is forbidden
        status: pass
    human_judgment: false
  - id: D2
    description: Proposal funnel and tool error queries return per-tenant figures, and the detector reports a mutation without a proposal trail
    requirement: D-08
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-chat/agent-usage.service.spec.ts#returns pending, applied, rejected and denied proposal counts per tenant
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/ai-chat/agent-usage.service.spec.ts#reports a mutating audit row with no matching applied proposal
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/ai-chat/agent-usage.service.spec.ts#yields an empty detector result when every mutation has an applied proposal
        status: pass
    human_judgment: false
  - id: D3
    description: The administrator picks the default model and reads per-tenant usage, spend and funnel; a tenant session renders neither
    requirement: D-07
    verification:
      - kind: unit
        ref: packages/frontend/src/features/cloud-admin/ui/AiChatSettingsCard/AiChatSettingsCard.test.tsx#renders neither the default model nor the usage view for a tenant session
        status: pass
      - kind: unit
        ref: packages/frontend/src/features/cloud-admin/ui/AiChatSettingsCard/AiChatSettingsCard.test.tsx#lets a platform administrator pick and save the default model
        status: pass
      - kind: unit
        ref: packages/frontend/src/features/cloud-admin/ui/AiChatSettingsCard/AiChatSettingsCard.test.tsx#renders unavailable spend instead of a zero amount
        status: pass
    human_judgment: false

duration: 16min
completed: 2026-09-04
status: complete
---

# Phase 15 Plan 24: Admin model, spend and silent-write detector Summary

**Platform-admin usage API and card: conversation-row spend, honest missing pricing, proposal funnel, and a scheduled silent-write detector**

## Performance

- **Duration:** 16 min
- **Started:** 2026-09-04T16:23:00Z
- **Completed:** 2026-09-04T16:39:00Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- `GET /ai-chat/usage` sums `tokens_in` / `tokens_out` / turns from `ai_agent_threads` in a date range and prices them against `CcAiProvider.pricing`
- Missing token prices return `spendUsd: null` and `spendAvailable: false`; an explicit zero price stays zero
- `SuperAdminGuard` sits on every usage route; tenant ADMIN/OPERATOR/SUPERVISOR/READONLY are forbidden
- Funnel and tool-error queries plus an hourly `@Interval` silent-write scan log unmatched mutating audit rows
- `AiChatSettingsCard` is SuperAdmin-only: default model picker, range usage, funnel, unavailable spend copy from `aiChat.admin`

## Task Commits

Each task was committed atomically:

1. **Task 1 RED:** `c7ba5df` (test) — failing spend aggregation and tenant-role gate
2. **Task 1 GREEN:** `fa8250e` (feat) — usage service, SuperAdmin controller, module registration
3. **Task 2 RED:** `749ec0b` (test) — failing funnel, errors and silent-write detector
4. **Task 2 GREEN:** `032ee83` (feat) — funnel/errors queries and interval detector
5. **Task 3 RED:** `c0bace3` (test) — failing admin card model/usage tests
6. **Task 3 GREEN:** `8ffcd62` (feat) — default-model endpoints, RTK hooks, card and locales

**Plan metadata:** pending docs commit

## Files Created/Modified

- `packages/backend/src/modules/ai-chat/agent-usage.service.ts` — spend, funnel, errors, detector, default model
- `packages/backend/src/modules/ai-chat/agent-usage.service.spec.ts` — 17 unit tests
- `packages/backend/src/modules/ai-chat/agent-usage.controller.ts` — SuperAdmin-only `/ai-chat/usage/*`
- `packages/backend/src/modules/ai-chat/ai-chat.module.ts` — service, controller, `CcAiProvider` / `CcAiAuditLog`
- `packages/frontend/src/features/cloud-admin/ui/AiChatSettingsCard/AiChatSettingsCard.tsx` — admin model + usage
- `packages/frontend/src/features/cloud-admin/ui/AiChatSettingsCard/AiChatSettingsCard.test.tsx` — SuperAdmin vs tenant
- `packages/frontend/src/features/cloud-admin/ui/AiChatSettingsCard/AiChatSettingsCard.module.scss` — token-based layout
- `packages/frontend/src/shared/api/endpoints/aiChatApi.ts` — usage, funnel, default-model hooks
- `packages/frontend/src/shared/config/locales/en.ts` / `ru.ts` — `aiChat.admin.*`

## Decisions Made

- Conversation-row aggregation only; the voice CDR table is never read (T-15-112)
- Unavailable spend is a first-class state, not a disguised zero (T-15-111)
- Mutating tools are name-prefixed (`create_` / `update_` / `delete_` / …); live-ops pause tools are excluded
- Default provider uid is persisted on the platform `ai_chat_settings` row (`user_uid=0`). `findDefaultLlm` still prefers `CC_AI_DEFAULT_PROVIDER_UID` because that service was outside this plan's files
- Administrative copy is under `aiChat.admin`, the last wave writer of these locale files

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Source-scan test matched the comment "call-record"**
- **Found during:** Task 1 GREEN
- **Issue:** `/call.?record/i` failed on the JSDoc that said we do not read that table
- **Fix:** Reworded the comment to "voice CDR table"
- **Files modified:** `packages/backend/src/modules/ai-chat/agent-usage.service.ts`
- **Verification:** agent-usage suite green
- **Committed in:** `fa8250e`

**2. [Rule 2 - Missing Critical] Default-model GET/PUT on the usage controller**
- **Found during:** Task 3
- **Issue:** Task 3 files did not include the controller, but the card must save a default model
- **Fix:** Stored `defaultProviderUid` on `ai_chat_settings` for `user_uid=0` and exposed SuperAdmin routes
- **Files modified:** `agent-usage.service.ts`, `agent-usage.controller.ts`
- **Verification:** AiChatSettingsCard tests green
- **Committed in:** `8ffcd62`

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical)
**Impact on plan:** Correctness and the D-07 save path. No scope creep.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 15 plans are complete. Next: `/gsd-secure-phase 15`
- Runtime default LLM still follows `CC_AI_DEFAULT_PROVIDER_UID` / first enabled llm row until `findDefaultLlm` reads the saved platform uid
- No hard token limits (D-08) — spend is reported, not enforced

## TDD Gate Compliance

- Task 1: RED `c7ba5df` then GREEN `fa8250e`
- Task 2: RED `749ec0b` then GREEN `032ee83`
- Task 3: RED `c0bace3` then GREEN `8ffcd62`

## Verification

```
npm run test -w @krasterisk/backend -- --testPathPattern="agent-usage" --no-coverage
npm run test -w @krasterisk/frontend -- src/features/cloud-admin/ui/AiChatSettingsCard/AiChatSettingsCard.test.tsx
```

17 backend + 4 frontend passed.

---
## Self-Check: PASSED

All key files exist on disk. Commits `c7ba5df`, `fa8250e`, `749ec0b`, `032ee83`, `c0bace3`, `8ffcd62` are in git log.

---
*Phase: 15-universal-pbx-ai-agent*
*Completed: 2026-09-04*
