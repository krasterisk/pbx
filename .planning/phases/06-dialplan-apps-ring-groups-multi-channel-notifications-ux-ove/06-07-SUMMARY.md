---
phase: 06-dialplan-apps-ring-groups-multi-channel-notifications-ux-ove
plan: 07
subsystem: api
tags: [notifications, encryption, nestjs, sequelize, jwt, credentials, multi-channel]

# Dependency graph
requires:
  - phase: 06-01
    provides: NotificationChannel, INotificationIntegration shared types
provides:
  - NotificationIntegration model with encrypted_credentials column
  - migrate-notifications-phase6.ts idempotent table creation
  - NotificationsService CRUD with encrypt-on-save and masked reads
  - findByUidInternal decrypt lookup for dispatcher (06-08)
  - JWT NotificationsController under /notifications
  - NotificationsModule exported for dispatcher injection
affects:
  - 06-08-notification-dispatcher
  - 06-09-dialplan-notify-wiring
  - 06-12-notifications-ui

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Reuse ai-agents secret-cipher.util (AES-256-GCM, CC_AI_KEY_SECRET) for credential encryption"
    - "CRUD strips encrypted_credentials; credentials supplied only on create/update body"
    - "findByUidInternal: no tenant filter — uid globally unique, dispatcher resolves from tenant-scoped route"
    - "Standalone migrate-notifications-phase6.ts (synchronize: false pattern)"

key-files:
  created:
    - packages/backend/src/modules/notifications/notification-integration.model.ts
    - packages/backend/src/modules/notifications/migrate-notifications-phase6.ts
    - packages/backend/src/modules/notifications/dto/notification-integration.dto.ts
    - packages/backend/src/modules/notifications/notifications.service.ts
    - packages/backend/src/modules/notifications/notifications.service.spec.ts
    - packages/backend/src/modules/notifications/notifications.controller.ts
    - packages/backend/src/modules/notifications/notifications.module.ts
  modified:
    - packages/backend/src/app.module.ts

key-decisions:
  - "Reuse existing encryptSecret/decryptSecret from ai-agents (same CC_AI_KEY_SECRET key derivation)"
  - "findByUidInternal intentionally skips tenant filter — documented for dispatcher-only use"
  - "MCP/AI tools for notification_integrations deferred per CONTEXT (ARCHITECTURE §6 exception)"

patterns-established:
  - "Six-channel ENUM: telegram, email, whatsapp, webhook, max, vk"
  - "config JSON for non-secret defaults; credentials object encrypted as JSON blob"
  - "toPublic() helper strips encrypted_credentials from all HTTP-facing responses"

requirements-completed: [D-10, D-11]

# Metrics
duration: 30min
completed: 2026-07-15
---

# Phase 6 Plan 7: Notification Integration Store Summary

**Tenant-scoped notification_integrations with AES-256-GCM encrypted credentials, JWT CRUD, and internal decrypt lookup for the dispatcher**

## Performance

- **Duration:** 30 min
- **Started:** 2026-07-15T11:20:00Z
- **Completed:** 2026-07-15T11:50:00Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- `NotificationIntegration` model with six-channel enum and `encrypted_credentials` TEXT column
- Idempotent `migrate-notifications-phase6.ts` creates `notification_integrations` + `user_uid` index
- `NotificationsService` encrypts credentials on create/update, strips secrets from CRUD responses
- `findByUidInternal(uid)` decrypts credentials for dispatcher (not HTTP-exposed)
- JWT `NotificationsController` CRUD under `/notifications` with tenant `vpbx_user_uid` scoping
- `NotificationsModule` registered in `app.module.ts`, exports service for 06-08 dispatcher

## Task Commits

Each task was committed atomically:

1. **Task 1: Model + migration** - `b7f3681` (feat)
2. **Task 2: DTO + service + spec (TDD)** - `702e971` (test), `6598feb` (feat)
3. **Task 3: Controller + module + app.module** - `823efa7` (feat)

**Plan metadata:** `pending` → will be set after docs commit

## Files Created/Modified

- `packages/backend/src/modules/notifications/notification-integration.model.ts` - Sequelize model
- `packages/backend/src/modules/notifications/migrate-notifications-phase6.ts` - Phase 6 migration script
- `packages/backend/src/modules/notifications/dto/notification-integration.dto.ts` - Create/Update DTOs
- `packages/backend/src/modules/notifications/notifications.service.ts` - CRUD + internal decrypt
- `packages/backend/src/modules/notifications/notifications.service.spec.ts` - 7 unit tests (encrypt, mask, tenant, internal)
- `packages/backend/src/modules/notifications/notifications.controller.ts` - JWT CRUD endpoints
- `packages/backend/src/modules/notifications/notifications.module.ts` - Module wiring + export
- `packages/backend/src/app.module.ts` - Model + module registration

## Decisions Made

- Reused `secret-cipher.util` from ai-agents module (same encryption key as provider API keys)
- `findByUidInternal` has no tenant filter — integration uid is globally unique; dispatcher resolves from tenant-scoped route context
- MCP/AI tools for `notification_integrations` intentionally deferred to a future plan per CONTEXT

## Deviations from Plan

None - plan executed exactly as written.

## Known Gaps (Intentional)

- **MCP/AI tools** for notification integrations not implemented (deferred per plan note and ARCHITECTURE §6 exception)
- **Dispatcher/providers/dialplan-notify.controller** wiring deferred to plans 06-08/06-09

## Issues Encountered

- Pre-existing `tsc --noEmit` errors in unrelated `ivrs.service.spec.ts` and `keyword-matcher.service.spec.ts` — out of scope; new notifications module compiles and tests pass

## User Setup Required

**Production deployments MUST set `CC_AI_KEY_SECRET`** — without it the dev fallback key is used (logged at boot). Same requirement as AI provider keys.

None - no external service configuration required beyond existing env.

## Next Phase Readiness

- Integration credential store ready for 06-08 dispatcher (inject `NotificationsService.findByUidInternal`)
- Migration script ready: `npx ts-node src/modules/notifications/migrate-notifications-phase6.ts` from `packages/backend`
- UI work (06-12) can consume `/notifications` CRUD API

## Self-Check: PASSED

- FOUND: packages/backend/src/modules/notifications/notification-integration.model.ts
- FOUND: packages/backend/src/modules/notifications/migrate-notifications-phase6.ts
- FOUND: packages/backend/src/modules/notifications/notifications.service.ts
- FOUND: packages/backend/src/modules/notifications/notifications.service.spec.ts
- FOUND: packages/backend/src/modules/notifications/notifications.controller.ts
- FOUND: packages/backend/src/modules/notifications/notifications.module.ts
- FOUND: b7f3681
- FOUND: 702e971
- FOUND: 6598feb
- FOUND: 823efa7

---
*Phase: 06-dialplan-apps-ring-groups-multi-channel-notifications-ux-ove*
*Completed: 2026-07-15*
