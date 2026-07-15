---
phase: 06-dialplan-apps-ring-groups-multi-channel-notifications-ux-ove
plan: 08
subsystem: api
tags: [notifications, dispatcher, axios, telegram, whatsapp, webhook, max, vk, email]

# Dependency graph
requires:
  - phase: 06-07
    provides: NotificationsService.findByUidInternal decrypt lookup + NotificationIntegration model
provides:
  - INotificationProvider interface + trimNotificationMessage (4096)
  - Six channel providers (telegram, email, whatsapp, webhook, max, vk)
  - NotificationDispatcherService.dispatch switch fan-out
  - Provider and dispatcher Jest specs (22 tests)
affects:
  - 06-09-dialplan-notify-wiring
  - 06-12-notifications-ui

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-channel providers: axios POST per RESEARCH Pattern 3; never throw; never log decrypted tokens"
    - "EmailProvider thin wrap over MailerService.sendNotification"
    - "WebhookProvider SSRF guard — only http:/https: URL schemes"
    - "Dispatcher decrypts via findByUidInternal then switch(channel); fire-and-forget safe"
    - "NotifyDialplanBody local interface until 06-09 formalizes NotifyDialplanDto"

key-files:
  created:
    - packages/backend/src/modules/notifications/providers/notification-provider.interface.ts
    - packages/backend/src/modules/notifications/providers/telegram.provider.ts
    - packages/backend/src/modules/notifications/providers/email.provider.ts
    - packages/backend/src/modules/notifications/providers/whatsapp.provider.ts
    - packages/backend/src/modules/notifications/providers/webhook.provider.ts
    - packages/backend/src/modules/notifications/providers/max.provider.ts
    - packages/backend/src/modules/notifications/providers/vk.provider.ts
    - packages/backend/src/modules/notifications/providers/notification-provider.spec.ts
    - packages/backend/src/modules/notifications/notification-dispatcher.service.ts
    - packages/backend/src/modules/notifications/notification-dispatcher.service.spec.ts
  modified: []

key-decisions:
  - "Local NotifyDialplanBody in dispatcher until 06-09 adds NotifyDialplanDto + module wiring"
  - "axios (not HttpService) in providers — HttpModule wiring deferred to 06-09; timeout 10s matches SMS precedent"
  - "Webhook payload_template supports {{message}}/{{target}} substitution; default body {message,target}"

patterns-established:
  - "Provider send(integration, target, message) → {success}; credentials from decrypted integration, defaults from config"
  - "target overrides config chat_id / peer_id / to / user_id when present"
  - "trimNotificationMessage shared helper for 4096 channel limit"

requirements-completed: [D-11, D-12]

# Metrics
duration: 12min
completed: 2026-07-15
---

# Phase 6 Plan 8: NotificationDispatcherService + 6 Channel Providers Summary

**Async dispatcher decrypts integrations and fans out to six axios/email providers matching RESEARCH Pattern 3 request shapes, with SSRF scheme guard and no-throw fire-and-forget semantics**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-15T11:28:01Z
- **Completed:** 2026-07-15T11:40:00Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Six channel providers form verified Pattern 3 URLs/headers/bodies (Telegram, WhatsApp Cloud v22, MAX, VK form-urlencoded, webhook, Email via MailerService)
- Webhook rejects non-http(s) schemes; all providers trim messages to 4096 and never rethrow
- NotificationDispatcherService routes via findByUidInternal + switch(channel); unknown channel and provider errors stay swallowed

## Task Commits

Each task was committed atomically:

1. **Task 1: Provider interface + 6 providers + provider spec**
   - `3bd4238` test(06-08): add failing test for notification channel providers
   - `5feb692` feat(06-08): implement six notification channel providers
2. **Task 2: Dispatcher fan-out + spec**
   - `e67aa6d` test(06-08): add failing test for notification dispatcher fan-out
   - `954efae` feat(06-08): implement notification dispatcher channel fan-out

**Plan metadata:** (see docs commit after this SUMMARY)

## Files Created/Modified
- `providers/notification-provider.interface.ts` — INotificationProvider + trim helper
- `providers/telegram.provider.ts` — bot sendMessage
- `providers/email.provider.ts` — MailerService delegation
- `providers/whatsapp.provider.ts` — Graph API v22.0 text messages
- `providers/webhook.provider.ts` — templated POST + SSRF scheme guard
- `providers/max.provider.ts` — platform-api2.max.ru messages
- `providers/vk.provider.ts` — messages.send form-urlencoded
- `providers/notification-provider.spec.ts` — 12 shape/guard/trim tests
- `notification-dispatcher.service.ts` — decrypt + switch fan-out
- `notification-dispatcher.service.spec.ts` — routing + no-throw tests

## Decisions Made
- Deferred NotifyDialplanDto and NotificationsModule provider registration to 06-09 (plan scope)
- Used direct `axios` in providers with 10s timeout (HttpModule register in 06-09)
- Webhook templating via `{{message}}` / `{{target}}` placeholders when `config.payload_template` is set

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `npx tsc --noEmit` reports pre-existing errors in unrelated specs (`ivrs.service.spec.ts`, `keyword-matcher.service.spec.ts`); notifications files are clean — logged as out of scope

## User Setup Required
None - no external service configuration required for this plan (channel credentials configured via 06-07 CRUD).

## Next Phase Readiness
- Ready for 06-09: wire providers + dispatcher into NotificationsModule, HttpModule, MailerModule, and `POST /internal/dialplan/notify`
- No blockers

## Self-Check: PASSED

- FOUND: all 10 created files
- FOUND commits: 3bd4238, 5feb692, e67aa6d, 954efae
- VERIFY: `npx jest notification-provider notification-dispatcher --silent` → 22 passed

---
*Phase: 06-dialplan-apps-ring-groups-multi-channel-notifications-ux-ove*
*Completed: 2026-07-15*
