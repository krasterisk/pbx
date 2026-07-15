---
phase: 07-call-center-overhaul-professional-agent-supervisor-workspace
plan: 06
subsystem: callcenter
tags: [sequelize, nestjs, call-cards, webhook, extraVars, tenant-isolation, crm]

requires:
  - phase: 07-call-center-overhaul-professional-agent-supervisor-workspace
    provides: Call center module foundation (07-01 history/models pattern)
  - phase: 06-dialplan-apps-ring-groups-multi-channel-notifications-ux-ove
    provides: notification_integration + WebhookProvider credential store (D-13)
provides:
  - CcCardTemplate/CcCardField/CcCardData models + migrate-callcenter-cards-phase7.ts
  - CallCenterCardsService/Controller REST CRUD for templates and card data
  - WebhookProvider.send extraVars for CRM payload on card save (D-13)
affects:
  - 07-11 Call Cards DnD builder + runtime popup frontend
  - 07-08 agent workspace auto-open card per auto_open_on

tech-stack:
  added: []
  patterns:
    - "Call card templates: supervisor-only mutations via assertSupervisor; reads agent-level"
    - "CRM webhook: findByUidInternal + mandatory integ.user_uid === vpbx guard before send"
    - "extraVars merged into applyTemplate vars — string substitution only, no eval"

key-files:
  created:
    - packages/backend/src/modules/callcenter/models/card-template.model.ts
    - packages/backend/src/modules/callcenter/models/card-field.model.ts
    - packages/backend/src/modules/callcenter/models/card-data.model.ts
    - packages/backend/src/modules/callcenter/migrate-callcenter-cards-phase7.ts
    - packages/backend/src/modules/callcenter/dto/callcenter-cards.dto.ts
    - packages/backend/src/modules/callcenter/callcenter-cards.service.ts
    - packages/backend/src/modules/callcenter/callcenter-cards.controller.ts
    - packages/backend/src/modules/callcenter/callcenter-cards.service.spec.ts
    - packages/backend/src/modules/notifications/providers/webhook.provider.spec.ts
  modified:
    - packages/backend/src/app.module.ts
    - packages/backend/src/modules/callcenter/callcenter.module.ts
    - packages/backend/src/modules/notifications/providers/webhook.provider.ts
    - packages/backend/src/modules/notifications/notifications.module.ts

key-decisions:
  - "auto_open_on ENUM uses manual not never per locked D-12 (overrides CC_CALL_CARD_CONCEPT never)"
  - "v1 field types: 14 types; file upload excluded from ENUM with model comment (D-11)"
  - "dispatchWebhook never throws — card persist succeeds even if CRM webhook fails"

patterns-established:
  - "Pattern: saveCard → dispatchWebhook via notification_integration (no duplicate credential store)"
  - "Pattern: cross-tenant integration guard on findByUidInternal callers (T-07-06-02)"

requirements-completed: [D-11, D-12, D-13]

duration: 15min
completed: 2026-07-15
---

# Phase 07 Plan 06: Call Cards backend Summary

**Configurable call card schema (14 field types), tenant-scoped CRUD, CRM webhook on save via Phase 6 extraVars — no new credential store**

## Performance

- **Duration:** 15 min
- **Started:** 2026-07-15T16:12:00Z
- **Completed:** 2026-07-15T16:27:00Z
- **Tasks:** 3
- **Files modified:** 15

## Accomplishments

- Three Sequelize models (`cc_card_templates`, `cc_card_fields`, `cc_card_data`) with idempotent standalone migration; `auto_open_on` answer/ring/manual (D-12); 14 v1 field types without file (D-11)
- `CallCenterCardsService` + controller: template CRUD (supervisor mutations only), card data CRUD, all queries filtered by `user_uid` from JWT
- `WebhookProvider.send` extended with optional `extraVars`; `saveCard` dispatches CRM payload through existing `notification_integration` with tenant guard (D-13)

## Task Commits

1. **Task 1: Модели cc_card_* + миграция + регистрация** - `c87f473` (feat)
2. **Task 2: CRUD шаблонов/полей/данных — service + controller + DTO** - `b9c9ffd` (feat)
3. **Task 3: extraVars в WebhookProvider + CRM webhook при сохранении** - `778f816` (feat)

**Plan metadata:** pending (docs commit)

## Files Created/Modified

- `card-template.model.ts` / `card-field.model.ts` / `card-data.model.ts` — Sequelize models with tenant column
- `migrate-callcenter-cards-phase7.ts` — CREATE ×3 + indexes + FK ON DELETE CASCADE
- `callcenter-cards.dto.ts` — validated DTOs (14 field types, auto_open_on, card status)
- `callcenter-cards.service.ts` — CRUD + `dispatchWebhook` with cross-tenant guard
- `callcenter-cards.controller.ts` — `/callcenter/card-templates` and `/callcenter/cards` REST
- `webhook.provider.ts` — 4th param `extraVars` merged before `applyTemplate`
- `callcenter-cards.service.spec.ts` / `webhook.provider.spec.ts` — dispatch and extraVars tests

## Decisions Made

- Follow D-12 `manual` instead of concept doc `never` for auto_open_on ENUM
- Exclude `file` field type from v1 ENUM (storage/limits deferred)
- Export `WebhookProvider` from NotificationsModule for direct CC injection (not via dispatcher)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `npx tsc --noEmit` reports pre-existing errors in unrelated spec files; no new errors from this plan's files
- gsd-tools SDK not present in repo — STATE/ROADMAP updated manually

## User Setup Required

Run migration once per environment:

`cd packages/backend && npx ts-node src/modules/callcenter/migrate-callcenter-cards-phase7.ts`

## Next Phase Readiness

- Backend API ready for 07-11 frontend (TemplateBuilder + CallCardPopup)
- `npm run test:cc`: 84 passed; webhook.provider.spec: 3 passed

## Self-Check: PASSED

- FOUND: card-template.model.ts, card-field.model.ts, card-data.model.ts, migrate-callcenter-cards-phase7.ts, callcenter-cards.service.ts, callcenter-cards.controller.ts, callcenter-cards.service.spec.ts, webhook.provider.spec.ts
- FOUND commits: c87f473, b9c9ffd, 778f816

---
*Phase: 07-call-center-overhaul-professional-agent-supervisor-workspace*
*Completed: 2026-07-15*
