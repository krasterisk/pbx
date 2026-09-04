---
phase: 15-universal-pbx-ai-agent
plan: 17
subsystem: api
tags: [mcp, adapters, d-12, d-15, d-22, tenant-settings, system-settings, sms, telegram]

requires:
  - phase: 15-universal-pbx-ai-agent
    provides: Adapter-over-handwritten precedence and registry-enumerated isolation suite (15-07)
provides:
  - TenantSettingsAiAdapter allow-listed reads grouped by area with secrets as presence only
  - SystemSettingsAiAdapter tenant-scoped default-excluding platform projection
  - SmsAiAdapter and TelegramAiAdapter channel and delivery reads with no send
  - Batch spec asserting read-only, secret-free and tenant isolation
affects:
  - 15-19 (diagnostics may read a limit or channel before blaming a route)
  - 15-23 (completeness gate sees tenant-settings, system-settings, sms, telegram)

actuals:
  tokens: 11738
  tasks: 3
  commits: 7

tech-stack:
  added: []
  patterns:
    - Settings output is built from an explicit allow list; secrets report configured/not configured
    - Platform settings reach the agent only through a named per-tenant projection
    - Messaging deliveries strip body, token and webhook secret from the declared shape

key-files:
  created:
    - packages/backend/src/modules/tenant-settings/tenant-settings-ai.adapter.ts
    - packages/backend/src/modules/system-settings/system-settings-ai.adapter.ts
    - packages/backend/src/modules/sms/sms-ai.adapter.ts
    - packages/backend/src/modules/telegram/telegram-ai.adapter.ts
    - packages/backend/src/modules/ai-platform/read-adapters-settings-messaging.spec.ts
    - packages/backend/src/skills/settings/SKILL.md
    - packages/backend/src/skills/messaging/SKILL.md
  modified:
    - packages/backend/src/modules/tenant-settings/tenant-settings.module.ts
    - packages/backend/src/modules/system-settings/system-settings.module.ts
    - packages/backend/src/modules/sms/sms.module.ts
    - packages/backend/src/modules/sms/sms.service.ts
    - packages/backend/src/modules/telegram/telegram.module.ts
    - packages/backend/src/modules/telegram/telegram.service.ts

key-decisions:
  - "Tenant settings are an allow list grouped by area; secret keys report presence only"
  - "Platform settings are a default-excluding per-tenant projection, never findAll or getServerConfigRaw"
  - "Messaging tools never send; delivery bodies are excluded (preview length 0)"

patterns-established:
  - "Pattern: secret absence is asserted on the declared output shape, not only fixtures"
  - "Pattern: a platform setting absent from PLATFORM_TENANT_PROJECTION does not appear"

requirements-completed: [D-12, D-15, D-22]

coverage:
  - id: D1
    description: Tenant settings are readable by allow list with secrets as presence only and no write surface (D-15)
    requirement: D-15
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/read-adapters-settings-messaging.spec.ts#builds output from an explicit allow list and never returns encrypted, token or secret values
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/read-adapters-settings-messaging.spec.ts#reports a secret-valued setting as configured or not configured, never by value
        status: pass
    human_judgment: false
  - id: D2
    description: Platform settings reach the agent only through an explicit per-tenant projection (D-15, D-22)
    requirement: D-15
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/read-adapters-settings-messaging.spec.ts#returns only the platform settings that describe the calling tenant limits and capabilities
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/read-adapters-settings-messaging.spec.ts#does not include a platform setting absent from the explicit projection
        status: pass
    human_judgment: false
  - id: D3
    description: SMS and Telegram are diagnosable without tokens, bodies or send tools (D-12, D-15)
    requirement: D-12
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/read-adapters-settings-messaging.spec.ts#reports whether the sms channel is configured and enabled without its token
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/read-adapters-settings-messaging.spec.ts#excludes message bodies from delivery results or truncates to the documented preview length
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/read-adapters-settings-messaging.spec.ts#declares no tool that sends a message
        status: pass
    human_judgment: false
  - id: D4
    description: None of the four adapters declares a mutating tool (D-15)
    requirement: D-15
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/read-adapters-settings-messaging.spec.ts#declares no mutating tool
        status: pass
    human_judgment: false
  - id: D5
    description: Each domain returns none of another tenant's settings, projection, channel state or deliveries (D-22)
    requirement: D-22
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/read-adapters-settings-messaging.spec.ts#returns none of another tenant settings
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/read-adapters-settings-messaging.spec.ts#returns each tenant its own projection
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/read-adapters-settings-messaging.spec.ts#returns none of another tenant sms channel state or deliveries
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-09-04
status: complete
---

# Phase 15 Plan 17: Settings and messaging read adapters Summary

**Read-only adapters for tenant settings (allow-listed, secrets as presence), platform settings (default-excluding per-tenant projection), and SMS/Telegram (channel + delivery, no send, no bodies)**

## Performance

- **Duration:** 12 min
- **Started:** 2026-09-04T13:14:00Z
- **Completed:** 2026-09-04T13:26:00Z
- **Tasks:** 3
- **Files modified:** 13

## Accomplishments

- `get_tenant_settings` returns settings grouped by area from `TENANT_SETTINGS_ALLOW_LIST`; secret keys are `configured` / not configured
- `get_platform_settings` is a named projection (`recordings_available`, `recordings_tenant_prefix`, `webhook_configured`); `findAll` and `getServerConfigRaw` are never called
- `get_sms_channel` / `list_sms_deliveries` and `get_telegram_channel` / `list_telegram_deliveries` expose presence and status/timestamp only
- No adapter declares a mutating or send tool; none leaks another tenant's rows
- Settings and messaging skills document the read-only boundary and hidden bodies

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1 RED: tenant settings** - `39eb7dd` (test)
2. **Task 1 GREEN: allow list, presence, skill** - `2e4a94b` (feat)
3. **Task 2 RED: platform projection** - `1cfc428` (test)
4. **Task 2 GREEN: tenant-scoped projection** - `5bcb5c5` (feat)
5. **Task 3 RED: messaging channels** - `50715b4` (test)
6. **Task 3 GREEN: SMS/Telegram reads, skill** - `0fa0f36` (feat)

**Plan metadata:** docs commit (SUMMARY + STATE + ROADMAP) follows this file

_Note: TDD tasks have multiple commits (test → feat)._

## Files Created/Modified

- `packages/backend/src/modules/tenant-settings/tenant-settings-ai.adapter.ts` — allow-listed settings grouped by area
- `packages/backend/src/modules/tenant-settings/tenant-settings.module.ts` — registers the adapter
- `packages/backend/src/modules/system-settings/system-settings-ai.adapter.ts` — tenant-scoped platform projection
- `packages/backend/src/modules/system-settings/system-settings.module.ts` — registers the adapter
- `packages/backend/src/modules/sms/sms-ai.adapter.ts` — channel + deliveries, no send
- `packages/backend/src/modules/sms/sms.module.ts` — registers the adapter
- `packages/backend/src/modules/sms/sms.service.ts` — `getChannelStatus` / `listDeliveries` without returning the token
- `packages/backend/src/modules/telegram/telegram-ai.adapter.ts` — channel + deliveries, no send
- `packages/backend/src/modules/telegram/telegram.module.ts` — registers the adapter
- `packages/backend/src/modules/telegram/telegram.service.ts` — `getChannelStatus` / `listDeliveries` without returning the token
- `packages/backend/src/modules/ai-platform/read-adapters-settings-messaging.spec.ts` — read-only, secret-free, isolation
- `packages/backend/src/skills/settings/SKILL.md` — flags, presence-only secrets, settings screen
- `packages/backend/src/skills/messaging/SKILL.md` — both channels, delivery status, no send

## Decisions Made

- **Allow list, not deny list.** A new tenant-settings column is invisible until listed. Secret-valued keys on the list report presence only.
- **Projection, not pass-through.** Platform settings have no tenant column; `getServerConfig()` is reduced to three named fields. A setting added next year does not appear.
- **Bodies excluded.** `DELIVERY_BODY_PREVIEW_LENGTH = 0` — delivery history is status and timestamp only.
- **Read methods on the send services.** Adapters never call `sendSms` / `sendMessage` or read env tokens into the result.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] SMS and Telegram services had no read API**
- **Found during:** Task 3 GREEN
- **Issue:** `SmsService` / `TelegramService` only send. Adapters cannot report channel presence or deliveries without either calling send or leaking `ConfigService.get(token)`.
- **Fix:** Added `getChannelStatus(uid)` (boolean presence, never the token) and `listDeliveries(uid)` (empty until a log exists).
- **Files modified:** `packages/backend/src/modules/sms/sms.service.ts`, `packages/backend/src/modules/telegram/telegram.service.ts`
- **Verification:** batch spec plus `legacy-tool-migration` — 38 passed
- **Committed in:** `0fa0f36`

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Required so adapters stay read-only and secret-free. No scope creep.

## Issues Encountered

- PowerShell cannot run bash heredoc commits; used `-F` message files under `.tmp/` (not staged).

## Known Stubs

| File | Line | Stub | Reason |
|------|------|------|--------|
| `packages/backend/src/modules/sms/sms.service.ts` | `listDeliveries` | returns `[]` | No SMS delivery log table exists; tool shape is proven with mocks |
| `packages/backend/src/modules/telegram/telegram.service.ts` | `listDeliveries` | returns `[]` | No Telegram delivery log table exists; tool shape is proven with mocks |

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Diagnostics can read a flag, quota-shaped projection or channel presence before blaming a route
- 15-23 completeness will see `tenant-settings`, `system-settings`, `sms`, `telegram`
- Delivery history stays empty in production until a later store is added; the tool contract is already tenant-scoped and body-free

## TDD Gate Compliance

Plan frontmatter is `type: execute` with per-task `tdd="true"`. Each task has a `test(15-17)` RED commit followed by a `feat(15-17)` GREEN commit. Tracer feedback gate re-ran `read-adapters-settings-messaging` after Task 1 (7 passed) and continued.

## Verification

```
npm run test -w @krasterisk/backend -- --testPathPattern="read-adapters-settings-messaging|legacy-tool-migration" --no-coverage
```

Task 1: 7 passed. Task 2: 12 passed. Task 3: 38 passed (24 batch + 14 migration).

## Self-Check: PASSED

- FOUND: `packages/backend/src/modules/tenant-settings/tenant-settings-ai.adapter.ts`
- FOUND: `packages/backend/src/modules/system-settings/system-settings-ai.adapter.ts`
- FOUND: `packages/backend/src/modules/sms/sms-ai.adapter.ts`
- FOUND: `packages/backend/src/modules/telegram/telegram-ai.adapter.ts`
- FOUND: `packages/backend/src/modules/ai-platform/read-adapters-settings-messaging.spec.ts`
- FOUND: `packages/backend/src/skills/settings/SKILL.md`
- FOUND: `packages/backend/src/skills/messaging/SKILL.md`
- FOUND: commits `39eb7dd`, `2e4a94b`, `1cfc428`, `5bcb5c5`, `50715b4`, `0fa0f36`
