---
phase: 6
slug: dialplan-apps-ring-groups-multi-channel-notifications-ux-ove
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-15
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from 06-RESEARCH.md § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (backend)** | Jest 29.7 (`packages/backend`, spec рядом с модулями) |
| **Framework (frontend)** | Vitest 4.1 (`packages/frontend`) |
| **Config file** | `packages/backend/jest.config` / `packages/frontend` vitest config (existing) |
| **Quick run command** | `npx jest call-groups --silent` · `npx jest notifications --silent` · `npx jest dialplan --silent` (из `packages/backend`) |
| **Full suite command** | `npm run lint && npm run test:backend && npm run test:frontend` (из корня — обяз. per AGENTS.md) |
| **Estimated runtime** | backend module ~10-30s; full suite ~2-5 min |

---

## Sampling Rate

- **After every task commit:** Run `npx jest <module> --silent` (затронутый модуль)
- **After every plan wave:** Run `npm run test:backend && npm run test:frontend`
- **Before `/gsd-verify-work`:** `npm run lint && npm run test:backend && npm run test:frontend` зелёные + ручной E2E (звонок в группу; отправка уведомления в каждый настроенный канал)
- **Max feedback latency:** ~30 seconds (module-scoped jest)

---

## Per-Task Verification Map

> Task IDs assigned during planning/execution. Rows below map locked decisions (D-xx)
> to test seams identified in research; executor fills Task ID + Status.

| Decision | Behavior | Test Type | Automated Command | File Exists | Status |
|----------|----------|-----------|-------------------|-------------|--------|
| D-05/D-08 | `[group_{id}_{vpbx}]` для ringall/hunt/memoryhunt/random; всегда `Return()`, нет `Hangup` | unit (pure fn) | `npx jest call-group-dialplan` | ❌ W0 | ⬜ pending |
| D-06/D-07 | internal `PJSIP/e{ext}_{vpbx}` + external `LOCAL/{num}@{ctx}`, per-member ring_time/order | unit | `npx jest call-group-dialplan` | ❌ W0 | ⬜ pending |
| D-01/D-03 | CRUD call_group+members, tenant filter, apply на CRUD | unit (mock DialplanApplyService) | `npx jest call-groups` | ❌ W0 | ⬜ pending |
| D-10/D-11 | CRUD интеграций, encrypt/decrypt, секрет не в ответе | unit (mock cipher) | `npx jest notifications` | ❌ W0 | ⬜ pending |
| D-12 | notify endpoint: api_key check, async 200, dispatch по каналу | unit (mock providers) | `npx jest dialplan-notify` | ❌ W0 | ⬜ pending |
| D-11 | провайдеры формируют корректный request (URL/headers/body) | unit (mock axios) | `npx jest notification-provider` | ❌ W0 | ⬜ pending |
| D-14/D-15 | actionToDialplan для callerid (4 режима) и trunk_carousel | unit | `npx jest dialplan.util` | ✅ база | ⬜ pending |
| D-19 | multi-DIALSTATUS массив → OR-join; DTO принимает массив | unit | `npx jest dialplan.util -t dialstatus` / `npx jest route-action.dto` | ✅/❌ W0 | ⬜ pending |
| D-19 | time_group_uid → ExecIfTime guard | unit | `npx jest routes.service -t time` | ✅ база | ⬜ pending |
| D-19 | hangup causecode → `Hangup(N)` | unit | `npx jest dialplan.util -t hangup` | ✅ база | ⬜ pending |
| D-02/D-17 | GroupApp/NotifyApp/CallerIdApp/TrunkCarouselApp + CallGroupsPage/FormModal + Integrations page/modal | vitest (integration) | `npm run test:frontend` | ❌ W0 | ⬜ pending |
| D-21-аналог | реальный звонок через группу + доставка уведомления | manual-only | — | UAT | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `call-groups/call-group-dialplan.util.spec.ts` — строки всех 4 стратегий, internal+external mix, Return-семантика (нет `Hangup`)
- [ ] `call-groups/call-groups.service.spec.ts` — CRUD, tenant isolation, apply вызывается (mock DialplanApplyService)
- [ ] `notifications/notifications.service.spec.ts` — encrypt на save, секрет не в ответе, tenant filter
- [ ] `notifications/notification-dispatcher.service.spec.ts` + provider specs — request shapes (mock axios)
- [ ] `notifications/dialplan-notify.controller.spec.ts` — api_key, async 200
- [ ] `routes/dto/route-action.dto` spec — массив dialstatus, новые ActionType (notify/callerid/trunk_carousel)
- [ ] расширить `dialplan.util` spec — callerid режимы, trunk_carousel, dialstatus OR-join, hangup causecode
- [ ] расширить `routes.service` spec — time_group_uid эмиссия
- [ ] frontend: интеграционные тесты GroupApp/NotifyApp/CallerIdApp/TrunkCarouselApp + CallGroupsPage/CallGroupFormModal + NotificationIntegrations page/modal

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Реальный звонок в группу (ringall/hunt/memoryhunt/random), Return → следующий app | D-05/D-08 | Нужен живой Asterisk + AMI + endpoints | Стенд: создать группу, привязать к маршруту с action после togroup; позвонить; проверить обзвон по стратегии и что после недозвона выполняется следующий app |
| Доставка уведомления в каждый канал | D-11/D-12 | Нужны реальные токены внешних API | Стенд: завести интеграцию (Telegram/Email/WhatsApp/Webhook/MAX/VK), notify-app в маршруте; позвонить; проверить получение сообщения с channel vars |
| CallerID подстановка (static/phonebook/carousel) и trunk carousel random+failover | D-14/D-15 | Нужен исходящий звонок через транки | Стенд: настроить транк-карусель с per-trunk CID; исходящий звонок; проверить CID и failover |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (dialplan-gen specs, notify specs, entity specs, frontend integration)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s (module-scoped)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
