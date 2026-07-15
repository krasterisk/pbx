# Phase 6: Dialplan Apps — ring groups, multi-channel notifications, UX overhaul - Research

**Researched:** 2026-07-15
**Domain:** Asterisk dialplan generation (AMI UpdateConfig), NestJS entity/CRUD + async HTTP dispatch, Sequelize new tables + migration, React FSD (dedicated page + inline editor + registry-driven apps)
**Confidence:** HIGH (almost every finding verified by reading repo code in this session; external channel APIs verified against official docs)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Группа вызовов — модель и CRUD**
- **D-01:** Новая сущность `call_group` (tenant-scoped `user_uid`/`vpbx_user_uid`), объединяющая текущие `togroup` и `tolist`. `tolist` (тупой ringall) и orphaned `togroup` (Gosub в несуществующий контекст) заменяются одним приложением.
- **D-02:** Гибридный CRUD: отдельный раздел «Группы вызовов» (паттерн страницы «Очереди») И быстрый inline-редактор в модалке маршрута (Select группы + кнопка создать/править, открывающая ту же форму).
- **D-03:** Приложение группы лёгкое (не как очередь): без агентов, статистики, MOH-очереди. Функциональность = стратегии + участники + таймеры + failover.
- **D-04:** Не копировать FreePBX/Elastix 1:1 — взять лучшие практики (ringall/hunt/memoryhunt/random), сделать простую и гибкую версию.

**Ring-стратегии v1**
- **D-05:** Стратегии v1: `ringall` (все одновременно), `hunt` (по очереди по одному), `memoryhunt` (по нарастающей 1, 1+2, 1+2+3…), `random` (случайный порядок через Asterisk RANDOM). Суффикс `-prim` и `firstavailable/firstnotonphone` — не в v1.

**Состав и параметры группы**
- **D-06:** Участники — внутренние (extensions) + внешние номера в одном упорядоченном списке. Внешние вызываются через LOCAL-канал (`LOCAL/{num}@{context}`), не напрямую через транк. В форме группы выбрать через какой контекст маршрутизируются внешние номера (tenant-aware, по образцу `ctx-{vpbxUserUid}`).
- **D-07:** Per-member ring time и порядок — обязательны (нужны для `hunt`/`memoryhunt`).
- **D-08:** Реализация через `Gosub` в сгенерированный контекст `group_{id}_{vpbx}`. При `Return` (никто не ответил) вызов продолжает текущие правила dialplan — следующее приложение в DialplanAppsEditor. Группа НЕ завершает вызов принудительно, а отдаёт управление обратно.
- **D-09:** Доп. параметры (Claude's discretion по деталям): call confirmation для внешних, CID name prefix, per-group failover — желательны, но не блокирующие; приоритет — стратегии + участники + Return-семантика.

**Multi-channel уведомления**
- **D-10:** Отдельная сущность «Интеграции уведомлений» (tenant-scoped): пользователь один раз заводит подключение (тип канала + credentials). Notify-app в маршруте выбирает подключение + шаблон сообщения — токены не дублируются.
- **D-11:** Каналы v1: Telegram (bot token + chat_id), Email (перенести MailerService-путь в единую модель), WhatsApp (Cloud API: phone_id + token), generic Webhook (произвольный HTTP POST + шаблон payload), MAX/VK (российские мессенджеры). Slack — deferred.
- **D-12:** Доставка через единый CURL → Nest endpoint для ВСЕХ каналов (по образцу `sendmail`: `Set(__K*)` + `CURL(...URIENCODE...)`). PHP-скрипты (`telegram.php`, `sendmailpeer.php`) убираются. Channel vars работают через `sanitizeTemplate` + `URIENCODE`. Отправка в backend — асинхронная.
- **D-13:** Шаблоны используют любые переменные канала; предусмотреть пресеты («входящий», «пропущенный» и т.д.) и интуитивный UX с подсказками по каждому параметру интеграции.

**Редактор CallerID**
- **D-14:** Универсальное приложение «Редактор CallerID» — чистая модификация `CALLERID(num)`/`CALLERID(name)`. Консолидирует `setclid_custom` и `setclid_list` в одно приложение с выбором режима. Режимы: static, из справочника phonebook (Phase 5), из списка setclid (`exten_setclid.php`), CID-карусель (ротация/random из пула номеров, random + failover среди CID).
- **D-15:** Отдельное приложение «Карусель транков» — выбор транка (`random_then_failover`: случайный транк, при недозвоне → следующий) с источником CallerID на каждый транк: статичный номер ИЛИ справочник phonebook. Это НЕ часть редактора CallerID.
- **D-16:** UX интуитивный для обоих: подсказки/описания к каждому режиму и параметру.

**UX overhaul редактора**
- **D-17:** Все текущие возможности `DialplanAppsEditor` сохраняются; новые app встраиваются как компоненты в `dialplanAppsRegistry`.
- **D-18:** GenericApp остаётся fallback для редких apps (webhook, cmd, label, tofax, asr, keywords, confbridge, voicemail, text2speech) — dedicated UI в этой фазе только для: группа вызовов, notify, редактор CallerID, карусель транков.
- **D-19:** Починить известные баги: multi-DIALSTATUS (UI хранит массив, backend ждёт строку с `IsIn`), неиспользуемый `time_group_uid` (сохраняется, но не эмитится в dialplan), игнорируемый `hangup` causecode.

### Claude's Discretion
- Схема таблиц `call_group`/участников/`notification_integration`, миграции (legacy `togroup`/`tolist` данных в проде нет — свобода).
- Точный dialplan для каждой стратегии (`hunt`/`memoryhunt`/`random`) и корректная `Return`-семантика в `group_{id}_{vpbx}`.
- Конкретный контракт Nest endpoint уведомлений (единый vs per-channel handler внутри) и провайдеры WhatsApp/MAX/VK.
- Точный ActionType-набор: расширить/переименовать `togroup`/`tolist` в один или ввести новый id; новый id для notify; консолидация `setclid_custom`/`setclid_list` в один `callerid` vs сохранение id для обратной совместимости; отдельный id для карусели транков.
- CID-карусель: как хранить пул номеров и реализовать random+failover.
- Детали call confirmation / CID prefix / failover группы.
- Формат хранения credentials (шифрование токенов на уровне БД).

### Deferred Ideas (OUT OF SCOPE)
- Slack-канал уведомлений (не v1).
- Стратегии `-prim` / `firstavailable` / `firstnotonphone` для групп.
- AI Chat / MCP tools для новых apps (отдельная фаза, по паттерну Phase 5 Domain AI Adapter).
- Dedicated UI для остальных GenericApp (webhook, cmd, tofax, asr, keywords, confbridge, voicemail, text2speech).
- setclid-list как источник CallerID для карусели транков (v1 карусели транков — static + phonebook).
</user_constraints>

<phase_requirements>
## Phase Requirements

`.planning/REQUIREMENTS.md` заканчивается на Phase 4 — REQ-IDs для Phase 6 не заведены. Требования мапятся на locked decisions CONTEXT.md (см. `<user_constraints>` и Validation Architecture ниже). Планировщик должен трактовать D-01…D-19 как обязательные требования фазы.
</phase_requirements>

## Summary

Фаза перерабатывает `DialplanAppsEditor` из «набор ad-hoc apps + PHP System() + orphaned togroup» в четыре dedicated приложения поверх двух новых tenant-scoped сущностей (`call_group` + `call_group_member`, `notification_integration`) плюс аудит и багфиксы. Вся необходимая инфраструктура уже существует в кодовой базе и была верифицирована в этой сессии:

- **Единый apply dialplan через AMI** уже консолидирован в `DialplanApplyService.applyCategories(filename, categories, {reload})` (`ami/dialplan-apply.service.ts`) — Phase 5 закрыл 4-кратную копипасту. Новые контексты групп применяются той же функцией.
- **Sub-context + Gosub/Return паттерн** уже отработан на phonebook bindings (`phonebook-dialplan.util.generateBindingDialplan` → `pb_bind_{uid}_{vpbx}`, apply через `RouteApplyService`). Контекст группы `group_{uid}_{vpbx}` строится по тому же принципу и обязан заканчиваться `Return()` (D-08).
- **CURL → Nest notify endpoint** уже существует (`mailer/dialplan-notify.controller.ts` + `sendmail` case в `dialplan.util.ts`: `Set(__KMAIL_*)` + `CURL(...URIENCODE...)`). Multi-channel notify — это его обобщение на N каналов с per-channel провайдерами.
- **AES-256-GCM шифрование секретов** уже есть: `ai-agents/util/secret-cipher.util.ts` (`encryptSecret`/`decryptSecret`, ключ из `CC_AI_KEY_SECRET`) + образец колонки `encrypted_api_key TEXT` в `cc_ai_providers`. Credentials интеграций хранятся тем же способом.
- **HTTP-клиент** — `axios@^1.16.0` и `@nestjs/axios` уже в зависимостях. Новых npm-пакетов фаза НЕ требует.
- **Entity+members+page+form паттерн** — очереди (`queue.model` + `queue_member.model` + `QueuesService` transaction, `QueuesPage`/`QueueFormModal`) — эталон 1:1 для `call_group`.
- **Migration паттерн** — standalone `migrate-*.ts` скрипт (`phonebooks/migrate-phonebooks-phase5.ts`: `QueryInterface.createTable(..., {ifNotExists})` + `addIndex` в try/catch + `ALTER … ADD CONSTRAINT` FK). Новые таблицы создаются точно так же.
- **time-groups.service.generateDialplan** уже умеет строить `[tgroup_{uid}]` (ExecIfTime → `__WORKTIME_{uid}`), но контекст нигде не применяется и `condition.time_group_uid` нигде не эмитится — runtime-разрыв, аналогичный phonebook-разрыву Phase 5. Багфикс D-19 его закрывает.

**Primary recommendation:** (1) `call_group`+`call_group_member` (образец queues) → контекст `group_{uid}_{vpbx}` в `krasterisk/groups/group_{vpbx}.conf`, apply на group CRUD через `DialplanApplyService`, самодостаточный (заканчивается `Return()`); (2) `notification_integration` с `encrypted_credentials` (переиспользовать `secret-cipher.util`) → generic endpoint `POST /api/internal/dialplan/notify` → `NotificationDispatcherService` с per-channel провайдерами (axios), async fire-and-forget; (3) unified `CallerIdApp` (режимы static/phonebook/setclid_list/carousel через nested `${CID_${RAND()}}`) + отдельный `TrunkCarouselApp`; (4) багфиксы: DIALSTATUS OR-join + массив в DTO, `time_group_uid` через inline ExecIfTime-guard, `Hangup(${causecode})`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| CRUD call_group / members, notification_integration | API/Backend (NestJS + Sequelize) | DB (MySQL) | tenant isolation по JWT, паттерн queues; секреты шифруются в сервисе |
| Генерация контекста `group_{id}_{vpbx}` | Backend (`CallGroupsService.generateDialplan`) | Asterisk (AMI UpdateConfig + reload) | образец `phonebook-dialplan.util` + `time-groups.service` |
| Применение контекстов группы в Asterisk | Backend (`DialplanApplyService`) | Asterisk (AMI) | уже существует, D-17-совместимо |
| Ring-стратегии (ringall/hunt/memoryhunt/random) | Asterisk dialplan (Dial/ExecIf/RAND) | Backend (генератор строк) | вся логика обзвона — в dialplan, backend лишь эмитит строки |
| Доставка уведомлений | Backend (`NotificationDispatcherService` + провайдеры) | внешние API (Telegram/WhatsApp/VK/MAX/webhook) | async в backend, dialplan только триггерит CURL (D-12) |
| Триггер уведомления из звонка | Asterisk dialplan (CURL) | Backend internal endpoint | по образцу sendmail: fire CURL, не блокировать канал |
| Модификация CALLERID (static/phonebook/list/carousel) | Asterisk dialplan (Set/CURL/RAND) | Backend (генератор) + Phase 5 lookup CURL | CID устанавливается в runtime на канале |
| Карусель транков (random_then_failover) | Asterisk dialplan (Dial loop + RAND) | Backend (генератор) | выбор транка + per-trunk CID — в dialplan |
| Дедик. страницы (Группы вызовов, Интеграции) + inline-редактор группы | Frontend (React FSD) | Backend API (RTK Query) | паттерн QueuesPage/QueueFormModal + RoutePhonebooksTab inline |
| Багфиксы генерации (DIALSTATUS/time_group/hangup) | Backend (`dialplan.util` + `routes.service`) | Shared types + DTO | шов генерации строк — чисто unit-тестируемо |

## Standard Stack

Фаза целиком собирается из существующего стека — **новых зависимостей не требуется.**

### Core (уже в проекте)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@nestjs/*` | 11.x | Модули/DI/guards/ValidationPipe | ядро backend |
| `sequelize-typescript` | 6.x | Модели `call_group*`, `notification_integration` | паттерн всех сущностей |
| `axios` + `@nestjs/axios` | 1.16 / 4.0 | HTTP-дispatch в Telegram/WhatsApp/VK/MAX/webhook | уже используется в 10+ модулях (sms, ari, billing) |
| `node-telegram-bot-api` | — | Telegram-провайдер (или прямой axios на Bot API) | уже подключён в `TelegramModule` |
| `nodemailer` | — | Email-провайдер (переиспользовать `MailerService`) | уже в `MailerModule` |
| React 19 + RTK Query 2.x | — | `callGroupApi`, `notificationApi`, страницы/модалки | паттерн queueApi/routeApi |
| `@dnd-kit` + lucide-react | — | строки редактора, up/down в формах | уже в dialplan-apps/moh |

### Supporting (переиспользуемые внутренние утилиты)
| Utility | File | Purpose |
|---------|------|---------|
| `AsteriskDialplanUtils` | `shared/utils/dialplan.util.ts` | `actionToDialplan`, `sanitizeTemplate`, `sanitizeDialplanInput`, `sanitizeFilePath`, `backendBaseUrl`, `dialplanApiKey` |
| `DialplanApplyService` | `ami/dialplan-apply.service.ts` | `applyCategories()` / `deleteCategories()` через AMI UpdateConfig |
| `encryptSecret`/`decryptSecret` | `ai-agents/util/secret-cipher.util.ts` | AES-256-GCM для credentials интеграций |
| `PhonebooksService.lookupNumber` + `/internal/dialplan/phonebook-lookup` | `phonebooks/*` | phonebook-режим CallerID и per-trunk CID в карусели |
| `TimeGroupsService.generateDialplan` | `time-groups/time-groups.service.ts` | образец ExecIfTime для фикса `time_group_uid` |
| queues entity+members | `queues/*` | эталон модели/сервиса/формы для `call_group` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Контекст группы + `Gosub`/`Return` (D-08) | инлайн `Dial(...)` прямо в контексте маршрута (как `tolist` сейчас) | ❌ не даёт reuse группы между маршрутами, нет отдельной страницы, ломает стратегии hunt/memoryhunt (нужны labels) |
| `axios` для провайдеров | `HttpService` из `@nestjs/axios` | оба доступны; `HttpService` даёт DI+timeout config (образец `billing.module` `HttpModule.register`). Рекомендация: `HttpModule.register({timeout})` в `NotificationModule` |
| Шифрование `secret-cipher.util` (AES-GCM, `CC_AI_KEY_SECRET`) | `cloud_settings`/plaintext | ❌ токены в открытом виде — недопустимо (D-10 credential store) |
| `${RAND()}` в dialplan для random | shuffle на backend при генерации | ❌ backend-shuffle фиксируется на момент apply (не «случайно каждый звонок») |

**Installation:** нет установки — все пакеты присутствуют.

**Version verification:** `axios@1.16.0` и `@nestjs/axios@4.0.1` подтверждены в `packages/backend/package.json` [VERIFIED: codebase]. Новых пакетов не добавляется.

## Package Legitimacy Audit

Фаза **не устанавливает внешних пакетов** — все потребности (HTTP, шифрование, Telegram, email, ORM, UI) закрыты текущими зависимостями. slopcheck не запускался (нечего проверять). **Packages removed: none. Packages flagged: none.**

## Architecture Patterns

### System Architecture Diagram

```
                         ┌─────────────────────── FRONTEND (React FSD) ───────────────────────┐
  Группы вызовов page ───┤ CallGroupsPage / CallGroupFormModal (strategy + members + timers)   │
                         │ RouteFormModal → DialplanAppsEditor:                                 │
                         │    GroupApp (Select группы + inline «создать/править»)               │
                         │    NotifyApp (Select интеграции + шаблон + пресеты)                  │
                         │    CallerIdApp (mode: static|phonebook|setclid_list|carousel)        │
                         │    TrunkCarouselApp (trunks + per-trunk CID source)                  │
  Интеграции page   ─────┤ NotificationIntegrationsPage / FormModal (channel + credentials)     │
                         └───────────────┬─────────────────────────────────────────────────────┘
                                         │ RTK Query (callGroupApi / notificationApi / routeApi)
                         ┌───────────────▼──────────────── BACKEND (NestJS) ───────────────────┐
                         │ CallGroupsController/Service ──► generateDialplan([group_{id}_{vpbx}])│
                         │        │                              │                              │
                         │        │  (CRUD, tenant filter)       ▼                              │
                         │        │                    DialplanApplyService.applyCategories     │
                         │        │                     (AMI UpdateConfig → group_{vpbx}.conf)  │
                         │        ▼                              │                              │
                         │  RoutesService.actionToDialplan ──────┘  emits:                      │
                         │    togroup  → Gosub(group_{id}_{vpbx},start,1)   (Return → next act) │
                         │    notify   → Set(__K*) + CURL(/internal/dialplan/notify …)          │
                         │    callerid → Set(CALLERID(...)) / CURL(phonebook-lookup) / RAND     │
                         │    trunk_carousel → Dial loop over trunks (RAND + failover)          │
                         │                                                                       │
                         │  DialplanNotifyController POST /internal/dialplan/notify              │
                         │        └─► NotificationDispatcherService (async, fire-and-forget)     │
                         │              ├─ TelegramProvider   (api.telegram.org/bot{t}/sendMessage)
                         │              ├─ EmailProvider      (MailerService)                    │
                         │              ├─ WhatsAppProvider   (graph.facebook.com/v22.0/{id}/…)  │
                         │              ├─ WebhookProvider     (POST configured URL + payload)    │
                         │              ├─ MaxProvider        (platform-api2.max.ru/messages)    │
                         │              └─ VkProvider         (api.vk.com/method/messages.send)  │
                         └───────────────┬───────────────────────────────────────────────────────┘
                                         │  AMI (persistent TCP) + internal CURL over HTTP
                         ┌───────────────▼──────────── ASTERISK ──────────────────────────────┐
                         │ [ctx{vpbx}] route → Gosub(group_..) → [group_{id}_{vpbx}] Dial/RAND │
                         │   → Return → next action; CURL notify (async); LOCAL/{num}@ctx-{vpbx}│
                         └────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
packages/backend/src/modules/
├── call-groups/                       # NEW (образец: queues/)
│   ├── call-group.model.ts            # call_groups table
│   ├── call-group-member.model.ts     # call_group_members table
│   ├── call-groups.service.ts         # CRUD (transaction) + generateDialplan() + apply
│   ├── call-groups.controller.ts      # JwtAuthGuard, req.user.vpbx_user_uid
│   ├── call-group-dialplan.util.ts    # generateGroupDialplan(group, members, vpbx) → category
│   ├── call-groups.module.ts
│   ├── migrate-call-groups-phase6.ts  # standalone (образец migrate-phonebooks-phase5.ts)
│   └── *.spec.ts
├── notifications/                     # NEW (credential store + dispatch)
│   ├── notification-integration.model.ts   # notification_integrations table (encrypted_credentials)
│   ├── notifications.service.ts       # CRUD (encrypt/decrypt), tenant filter
│   ├── notifications.controller.ts    # JWT CRUD for the "Интеграции" page
│   ├── notification-dispatcher.service.ts  # async per-channel send
│   ├── providers/{telegram,email,whatsapp,webhook,max,vk}.provider.ts
│   ├── dialplan-notify.controller.ts  # extend/replace mailer's controller: POST /internal/dialplan/notify
│   └── *.spec.ts
├── mailer/                            # sendmail path folded into EmailProvider (keep MailerService)
packages/shared/src/types/
├── call-group.types.ts               # NEW: ICallGroup, ICallGroupMember, RingStrategy
├── notification.types.ts             # NEW: INotificationIntegration, NotificationChannel
└── route.types.ts                    # MODIFY: ActionType (+notify,+callerid,+trunk_carousel), condition.dialstatus already string|string[]
packages/frontend/src/
├── pages/CallGroupsPage/, pages/NotificationIntegrationsPage/
├── features/call-groups/             # CallGroupsPage table + CallGroupFormModal (образец queues/)
├── features/notifications/           # integrations page + form modal
└── features/dialplan-apps/ui/apps/
    ├── GroupApp/         # NEW dedicated (было GenericApp)
    ├── NotifyApp/        # NEW
    ├── CallerIdApp/      # NEW (consolidates setclid_custom + setclid_list)
    └── TrunkCarouselApp/ # NEW
    (registry.ts: togroup→GroupApp, notify→NotifyApp, callerid→CallerIdApp, trunk_carousel→TrunkCarouselApp)
```

### Pattern 1: Ring-group context with Gosub/Return (D-08)

**What:** Самодостаточный контекст `[group_{uid}_{vpbx}]`, вызываемый `Gosub(...,start,1)` из маршрута; при недозвоне заканчивается `Return()` → следующий action маршрута исполняется. Группа НЕ делает Hangup.

**Return-семантика (VERIFIED against repo):** `togroup` уже эмитит `Gosub(group_${group}_${vpbxUserUid},start,1)` (`dialplan.util.ts:180-183`) — контекст-приёмник просто отсутствует (runtime-разрыв, тот же класс, что закрыл Phase 5 для phonebooks). После `Gosub`, `generateRouteDialplan` продолжает эмитить остальные actions строками `same => n,...` (`routes.service.ts:301-304`). Asterisk `Gosub` кладёт кадр в стек; `Return()` возвращает управление на строку **после** Gosub → следующий action. Ключевое правило генератора контекста: **никогда не эмитить `Hangup()`; всегда завершать `Return()`**. Если участник ответил — `Dial` соединяет канал, и по завершении разговора Asterisk сам разрывает; чтобы после ответа НЕ выполнялся следующий action, после успешного Dial ставить `Return()` (или использовать тот факт, что после Hangup бридж-канала dialplan останавливается). Рекомендация — явный `ExecIf($["${DIALSTATUS}"="ANSWER"]?Return())` после каждого Dial-шага.

**Строки по стратегиям** (member internal → `PJSIP/e{ext}_{vpbx}`, external → `LOCAL/{num}@{group.external_context}`; `RT` = per-member ring_time, `OPTS` — Dial options, напр. `tT`):

```ini
; ── ringall — все одновременно, один Dial ──
[group_15_42]
exten => start,1,NoOp(Call group: Отдел продаж [ringall])
same => n,Dial(PJSIP/e101_42&PJSIP/e102_42&LOCAL/79001234567@ctx-42,25,tT)
same => n,Return()          ; никто не ответил / отбой без Hangup → назад в маршрут

; ── hunt — по очереди, по одному, per-member ring time ──
[group_15_42]
exten => start,1,NoOp(Call group: Отдел продаж [hunt])
same => n,Dial(PJSIP/e101_42,20,tT)
same => n,ExecIf($["${DIALSTATUS}" = "ANSWER"]?Return())
same => n,Dial(PJSIP/e102_42,15,tT)
same => n,ExecIf($["${DIALSTATUS}" = "ANSWER"]?Return())
same => n,Dial(LOCAL/79001234567@ctx-42,30,tT)
same => n,Return()

; ── memoryhunt — по нарастающей (1, 1+2, 1+2+3) ──
[group_15_42]
exten => start,1,NoOp(Call group: Отдел продаж [memoryhunt])
same => n,Dial(PJSIP/e101_42,20,tT)
same => n,ExecIf($["${DIALSTATUS}" = "ANSWER"]?Return())
same => n,Dial(PJSIP/e101_42&PJSIP/e102_42,20,tT)
same => n,ExecIf($["${DIALSTATUS}" = "ANSWER"]?Return())
same => n,Dial(PJSIP/e101_42&PJSIP/e102_42&LOCAL/79001234567@ctx-42,25,tT)
same => n,Return()

; ── random — случайный первый участник, затем остальные по порядку (v1) ──
[group_15_42]
exten => start,1,NoOp(Call group: Отдел продаж [random])
same => n,Set(GRP_PICK=${RAND(1,3)})
same => n,GotoIf($["${GRP_PICK}" = "1"]?m1)
same => n,GotoIf($["${GRP_PICK}" = "2"]?m2)
same => n,Goto(m3)
same => n(m1),Dial(PJSIP/e101_42,20,tT)
same => n,ExecIf($["${DIALSTATUS}" = "ANSWER"]?Return())
same => n,Dial(PJSIP/e102_42&LOCAL/79001234567@ctx-42,25,tT)
same => n,Return()
same => n(m2),Dial(PJSIP/e102_42,20,tT)
same => n,ExecIf($["${DIALSTATUS}" = "ANSWER"]?Return())
same => n,Dial(PJSIP/e101_42&LOCAL/79001234567@ctx-42,25,tT)
same => n,Return()
same => n(m3),Dial(LOCAL/79001234567@ctx-42,30,tT)
same => n,ExecIf($["${DIALSTATUS}" = "ANSWER"]?Return())
same => n,Dial(PJSIP/e101_42&PJSIP/e102_42,20,tT)
same => n,Return()
```

Notes / discretion (D-09):
- **Random полноценный shuffle** всех N! порядков — экспоненциальный dialplan. v1 = «случайный первый + остальные по порядку» (простая GotoIf-таблица на N веток). Задокументировать как упрощение; полный shuffle — deferred. `${RAND(min,max)}` — стандартная Asterisk-функция [VERIFIED: используется в проекте? нет; ASSUMED из Asterisk func_rand — широко известна, CITED docs.asterisk.org func_rand].
- **Call confirmation для внешних** (D-09, optional): `Dial(...,${RT},tTb(...)` c gosub-подтверждением или опция `Dial` `A()`/confirm-макрос — вне v1-приоритета, оставить точкой расширения.
- **CID name prefix** (D-09, optional): `Set(CALLERID(name)=[Группа] ${CALLERID(name)})` перед Dial.
- **Per-group failover** (D-09): последний `Return()` естественно передаёт управление следующему action маршрута — это и есть failover-назначение (следующий app в редакторе).

**Where the id comes from:** `togroup` params должны хранить `group` = `call_group.uid` (число), чтобы `Gosub(group_${uid}_${vpbx})` совпал с генерируемым `[group_${uid}_${vpbx}]`. Сейчас `params.group` — свободная строка; GroupApp обязан класть туда `uid` выбранной группы.

### Pattern 2: Group context apply & regen triggers

**What:** Контекст группы самодостаточен (не зависит от конкретного маршрута), поэтому применяется на CRUD группы — по образцу `QueuesService.reloadQueues()` (queue reload на каждый create/update/delete), но через `DialplanApplyService.applyCategories` (dialplan, не queue).

```typescript
// call-groups.service.ts (образец queues.service transaction + phonebook apply)
private groupFile(vpbx: number) { return `krasterisk/groups/group_${vpbx}.conf`; }

async applyGroup(group: CallGroup, members: CallGroupMember[], vpbx: number) {
  const category = generateGroupDialplan(group, members, vpbx); // {name:`group_${group.uid}_${vpbx}`, lines}
  await this.dialplanApplyService.applyCategories(this.groupFile(vpbx), [category], { reload: true });
}
// on remove: this.dialplanApplyService.deleteCategories(this.groupFile(vpbx), [`group_${uid}_${vpbx}`], {reload:true})
```

Триггеры регена: create/update группы, изменение участников/стратегии/таймеров, delete (DelCat). **Файл двухуровневый** — `extensions.conf` инклюдит по glob `#include krasterisk/*/*.conf` (подтверждено комментарием в `dialplan-subroutines.service.ts` из Phase 5 research) → путь `krasterisk/groups/group_{vpbx}.conf` обязателен, не `krasterisk/group_{vpbx}.conf`.

### Pattern 3: Multi-channel notify — single CURL → generic Nest endpoint (D-12)

**What:** Один endpoint для всех каналов; провайдер выбирается по `integration_uid`. Dialplan лишь fires CURL с шаблоном (async, backend отвечает 200 сразу и шлёт в фоне).

**Dialplan (`notify` case в actionToDialplan, образец `sendmail:231-254`):**
```ini
same => n,Set(__KNOTIFY_MSG=Входящий звонок от ${CALLERID(num)} на ${EXTEN})
same => n,Set(NOTIFY_RESULT=${CURL(https://backend/api/internal/dialplan/notify,integration_uid=15&message=${URIENCODE(${KNOTIFY_MSG})}&target=${URIENCODE(${KNOTIFY_TARGET})}&clid=${URIENCODE(${CALLERID(num)})}&exten=${URIENCODE(${EXTEN})}&uniqueid=${URIENCODE(${UNIQUEID})}&api_key=…)})
```
`message` пропускается через `sanitizeTemplate` (разрешает `${VAR}`, блокирует `${SHELL}`/`${SYSTEM}`/`${AGI}`, вырезает `\n`/`;`/`\`). `target` — опциональный override (chat_id/phone/peer_id); если пусто — берётся дефолт из интеграции.

**Backend endpoint (extend `mailer/dialplan-notify.controller.ts` или новый `notifications/dialplan-notify.controller.ts`):**
```typescript
@Post('notify')
@HttpCode(200)
async notify(@Headers('x-api-key') hk: string, @Body() body: NotifyDialplanDto & {api_key?: string}) {
  const key = hk || body.api_key;
  if (this.apiKey && key !== this.apiKey) throw new UnauthorizedException();
  // async — не блокировать канал: schedule and return immediately
  this.dispatcher.dispatch(body).catch((e) => this.logger.error(`notify dispatch failed: ${e?.message}`));
  return { accepted: true };
}
```

**Dispatcher (async, per-channel):**
```typescript
async dispatch(body: NotifyDialplanDto) {
  const integ = await this.notificationsService.findByUidInternal(body.integration_uid); // includes decrypt
  const msg = body.message ?? '';
  switch (integ.channel) {
    case 'telegram': return this.telegram.send(integ, body.target, msg);
    case 'email':    return this.email.send(integ, body.target, msg);
    case 'whatsapp': return this.whatsapp.send(integ, body.target, msg);
    case 'webhook':  return this.webhook.send(integ, body, msg);
    case 'max':      return this.max.send(integ, body.target, msg);
    case 'vk':       return this.vk.send(integ, body.target, msg);
  }
}
```

**Provider request shapes (verified against official docs, 2026):**

| Channel | Endpoint | Auth | Body | Creds needed from user |
|---------|----------|------|------|------------------------|
| Telegram | `POST https://api.telegram.org/bot{token}/sendMessage` | token in URL | `{chat_id, text}` | bot token + chat_id [CITED: core.telegram.org/bots/api sendMessage] |
| Email | `MailerService.sendNotification({to,subject,text})` | SMTP (`.env`) | — | to (target) [VERIFIED: mailer.service.ts:52] |
| WhatsApp Cloud | `POST https://graph.facebook.com/v22.0/{phone_number_id}/messages` | `Authorization: Bearer {token}` | `{messaging_product:"whatsapp", to, type:"text", text:{body}}` | phone_number_id + access token [CITED: developers.facebook.com/docs/whatsapp/cloud-api/messages/text-messages] |
| Webhook | `POST {configured_url}` | as configured | шаблон payload (JSON) с подстановкой переменных | url (+ опц. headers) [ASSUMED — generic] |
| MAX | `POST https://platform-api2.max.ru/messages?user_id={id}` (или `chat_id`) | `Authorization: {access_token}` (header, не query) | `{text}` | access_token (MasterBot) + user_id/chat_id [CITED: dev.max.ru/docs-api/methods/POST/messages; домен `platform-api2.max.ru` c 19.07.2026] |
| VK | `POST https://api.vk.com/method/messages.send?access_token={t}&v=5.199` | token в URL | form-urlencoded: `peer_id, message, random_id` | community access_token + peer_id [CITED: dev.vk.com/method/messages.send] |

Все текст-сообщения ограничены 4096 символами (Telegram/WhatsApp/VK) — валидировать/тримить в провайдере.

### Pattern 4: CallerID editor modes (D-14) & Trunk carousel (D-15)

**Static** (= текущий `setclid_custom`, `dialplan.util.ts:221-224`):
```ini
same => n,Set(CALLERID(num)=79001112233)      ; sanitizeDialplanInput
same => n,Set(CALLERID(name)=Отдел продаж)    ; опционально
```

**From phonebook (Phase 5 lookup)** — переиспользовать `/internal/dialplan/phonebook-lookup` (pipe-delimited response, CUT по позиции var-ключа):
```ini
same => n,Set(PB_RAW=${CURL(https://backend/api/internal/dialplan/phonebook-lookup?phonebook_uid=7&api_key=…&number=${URIENCODE(${CALLERID(num)})})})
same => n,ExecIf($["${CUT(PB_RAW,|,1)}" = "1"]?Set(CALLERID(num)=${CUT(PB_RAW,|,3)}))
```
(позиция CUT — по индексу выбранного var-ключа, как `generateBindingDialplan`: `1|key1|val1|key2|val2|…`).

**From setclid list** (= текущий `setclid_list`, `dialplan.util.ts:226-229`) — **сохранить механизм `exten_setclid.php`** (D-14 «консолидируется, не удаляется»):
```ini
same => n,ExecIf($["${SHELL(/usr/scripts/exten_setclid.php "5" "${CLIDNUM}")}" != ""]?Set(CALLERID(num)=${SHELL(/usr/scripts/exten_setclid.php "5" "${CLIDNUM}")}))
```

**CID-carousel (pool + random)** — nested variable expansion `${CID_${RAND(1,N)}}` (изящно, без GotoIf-таблицы):
```ini
same => n,Set(CID_1=79001112233)
same => n,Set(CID_2=79004445566)
same => n,Set(CID_3=79007778899)
same => n,Set(CALLERID(num)=${CID_${RAND(1,3)}})
```
random+failover среди CID (D-14) требует повторного Dial с другим CID → это ближе к карусели транков; для v1 CallerID-карусели достаточно случайного выбора (failover — точка расширения, зафиксировать в Assumptions).

**Trunk carousel (random_then_failover, per-trunk CID)** — отдельный app `trunk_carousel`. Цикл Dial по транкам; перед каждым — установить CID (static или phonebook lookup); при `ANSWER` → `Return()`, иначе следующий транк:
```ini
; random первый транк + failover по остальным (аналог random-стратегии группы)
same => n,Set(TC_PICK=${RAND(1,2)})
same => n,GotoIf($["${TC_PICK}" = "1"]?t1)
same => n,Goto(t2)
same => n(t1),Set(CALLERID(num)=79001112233)                 ; per-trunk static CID
same => n,Dial(PJSIP/trunkA/${EXTEN},60,tT)
same => n,ExecIf($["${DIALSTATUS}" = "ANSWER"]?Return())
same => n,Set(CALLERID(num)=${CURL(…phonebook-lookup…)})     ; per-trunk phonebook CID
same => n,Dial(PJSIP/trunkB/${EXTEN},60,tT)
same => n,Return()
same => n(t2),Set(CALLERID(num)=${CURL(…phonebook-lookup…)})
same => n,Dial(PJSIP/trunkB/${EXTEN},60,tT)
same => n,ExecIf($["${DIALSTATUS}" = "ANSWER"]?Return())
same => n,Set(CALLERID(num)=79001112233)
same => n,Dial(PJSIP/trunkA/${EXTEN},60,tT)
same => n,Return()
```
Реализация — в `actionToDialplan` (self-contained строки, не отдельный контекст), т.к. per-route параметры (список транков/CID) хранятся в action.params. Транки берутся из `trunk.types` (`ITrunk.name`), формат Dial-строки транка — как в `totrunk` case (`Dial(${trunk}/${dest},…)`).

### Anti-Patterns to Avoid
- **Hangup() в контексте группы** — ломает D-08 (следующий action не выполнится). Всегда `Return()`.
- **Хранение токенов в plaintext** — использовать `encryptSecret`. Не логировать decrypted значения.
- **Блокирующая отправка уведомления в endpoint** — dialplan CURL ждёт ответ; отвечать 200 сразу, слать в фоне (D-12).
- **`params.group` = имя вместо uid** — Gosub не совпадёт с `[group_{uid}_{vpbx}]`.
- **Новый цикл AMI-батчей** — использовать `DialplanApplyService.applyCategories`, не копипастить.
- **Tailwind в features/pages** — только SCSS-модули с `var(--color-*)`; компоненты из `@/shared/ui`; без нативных `div/select/input/button`; без em dash и эмодзи (см. Project Constraints).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| AMI batch-запись конфига | новый цикл DelCat/NewCat/Append | `DialplanApplyService.applyCategories/deleteCategories` | консолидировано в Phase 5, обрабатывает лимит ~20 header/req |
| Шифрование credentials | свой crypto | `encryptSecret`/`decryptSecret` (`ai-agents/util/secret-cipher.util`) | AES-256-GCM, ключ из `CC_AI_KEY_SECRET`, покрыт spec |
| Санитизация шаблона уведомления | свой фильтр | `AsteriskDialplanUtils.sanitizeTemplate` | разрешает `${VAR}`, блокирует SHELL/SYSTEM/AGI, покрыт паттерном sendmail |
| Санитизация CID/номеров/путей | своё | `sanitizeDialplanInput` / `sanitizeShellInput` / `sanitizeFilePath` | anti-injection, уже применяются везде |
| Рендер custom-actions | свой | `AsteriskDialplanUtils.actionToDialplan` | 25+ типов, санитизация |
| Email-отправка | новый transporter | `MailerService.sendNotification` | nodemailer уже сконфигурирован |
| Phonebook lookup для CID | свой парсер номеров | `/internal/dialplan/phonebook-lookup` + CUT | Phase 5, pipe-протокол, tenant-aware через api_key |
| Entity+members CRUD + reload | с нуля | образец `QueuesService` (transaction, destroy+bulkCreate, reload) | 1:1 паттерн для call_group |
| Migration | Sequelize sync/alter | standalone `migrate-*.ts` (`createTable ifNotExists` + FK) | образец `migrate-phonebooks-phase5.ts` |
| Ordered members / pool UI | DnD-либа | up/down-кнопки (`RoutePhonebooksTab`/`MohFormModal`) или существующий QueueMembers | паттерн проекта |
| HTTP к внешним API | fetch-обёртки | `axios` / `HttpModule.register({timeout})` | уже в проекте (billing/ai-chat образцы) |

**Key insight:** каждая «новая» подсистема фазы имеет прямой прекедент в кодовой базе (queues=call_group, sendmail=notify, phonebook-lookup=CallerID phonebook, cc_ai_providers=encrypted credentials, tgroup=time_group fix). Ручной код почти не нужен — фаза это композиция и обобщение существующего.

## Runtime State Inventory

> Фаза частично rename/consolidate (togroup/tolist/setclid_* → новые apps; удаление PHP-скриптов). Legacy-данных `togroup`/`tolist`/`call_group` в проде нет (D-01, свобода миграции).

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | Существующие `routes.actions` JSON могут содержать `togroup`(group=строка), `tolist`, `setclid_custom`, `setclid_list`, `telegram`, `sendmailpeer`. Прод-данных групп нет (D-01). | Registry/actionToDialplan сохраняют обратную совместимость id (см. ActionType-стратегия). Для `togroup` со строковым group — GroupApp мигрирует на uid при редактировании; старые записи без соответствующей `call_group` дают «context not found» — план должен либо мигрировать, либо оставить как есть (данных нет). Notify/callerid — новые id, старые (`telegram`/`sendmailpeer`/`setclid_*`) остаются рабочими до ручной пересборки маршрута. |
| Live service config | Asterisk-файлы: `krasterisk/routes/extensions_*.conf` содержат старые `Gosub(group_…)`/`Dial(LOCAL…)`/`System(…telegram.php)`. Новый файл `krasterisk/groups/group_{vpbx}.conf` появляется при первом apply группы. | re-apply контекстов маршрутов после релиза перезапишет строки; apply групп создаст их контексты. Отдельной чистки не нужно (перезапись категорий). |
| Live service config (внешние API) | Telegram bot token/chat_id, WhatsApp phone_id/token, VK/MAX access_token, webhook URL — вводятся пользователем в UI «Интеграции», хранятся в БД (encrypted). Вне git. | Не rename — новые данные. `.env` `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` остаются для admin-логирования (`TelegramService`), не для dialplan-уведомлений. |
| OS-registered state | PHP-скрипты `/usr/scripts/telegram.php`, `/usr/scripts/sendmailpeer.php` на сервере Asterisk (D-12: убираются из dialplan). `exten_setclid.php` — СОХРАНЯЕТСЯ (D-14). | Код перестаёт эмитить `System(telegram.php/sendmailpeer.php)`. Физическое удаление файлов — ручной ops-шаг (не блокирует). `exten_setclid.php` не трогать. |
| Secrets/env vars | Новый смысл у `CC_AI_KEY_SECRET` (теперь шифрует и notification credentials) — ключ тот же, значение не меняется. `DIALPLAN_API_KEY` переиспользуется для notify endpoint. | Документировать, что `CC_AI_KEY_SECRET` обязателен в проде (иначе dev-fallback ключ). Новых обязательных env нет. |
| Build artifacts | Нет — пакеты не переименовываются. | none |

**Канонический вопрос:** после релиза все старые `Gosub(group_…)` на несуществующие контексты станут валидными только когда пользователь создаст `call_group` и она примёнится. Прод-групп нет → риск нулевой; план должен обеспечить apply группы на её CRUD (Pattern 2).

## Common Pitfalls

### Pitfall 1: Группа делает Hangup вместо Return
**Что:** если генератор группы завершает контекст `Hangup()` (или Dial без явного Return после ANSWER-ветки в неверном месте), следующий action маршрута не выполнится — нарушение D-08.
**Как избежать:** контекст группы ВСЕГДА заканчивается `Return()`; после каждого Dial-шага `ExecIf($["${DIALSTATUS}"="ANSWER"]?Return())`. Unit-тест: сгенерированные строки не содержат `Hangup`, последняя строка = `Return()`.

### Pitfall 2: `params.group` — строка вместо uid
**Что:** `togroup` сейчас кладёт свободную строку; `Gosub(group_{str}_{vpbx})` не совпадёт с `[group_{uid}_{vpbx}]`.
**Как избежать:** GroupApp сохраняет `params.group = String(call_group.uid)`; генератор группы использует `uid`. Тест на согласованность Gosub-цели и имени категории.

### Pitfall 3: Runtime-разрыв — контекст группы не применён
**Что:** маршрут ссылается на группу, контекст которой не сгенерирован/не reloaded → «context not found» мид-колл.
**Как избежать:** apply группы на каждый CRUD (Pattern 2); на delete — `deleteCategories` + предупредить/заблокировать удаление группы, используемой в маршрутах (или мягко: Gosub в отсутствующий контекст → задокументировать). Симметрично phonebook Pitfall 5 (Phase 5).

### Pitfall 4: Блокирующая отправка уведомления
**Что:** CURL в dialplan синхронный (ждёт ответ, дефолтные CURLOPT-таймауты). Если endpoint шлёт в Telegram/WhatsApp синхронно перед ответом — канал висит.
**Как избежать:** endpoint отвечает 200 немедленно, `dispatcher.dispatch(...).catch(...)` в фоне (D-12). Опционально задать короткие `CURLOPT(timeout)` вокруг CURL (образец custom-webhook `routes.service.ts:280-285`).

### Pitfall 5: Credentials в plaintext / в логах
**Что:** токены попадают в БД открытым текстом или в `logger.log`.
**Как избежать:** `encryptSecret` при сохранении, `decryptSecret` только в момент отправки; НЕ логировать decrypted; в API-ответах CRUD не возвращать секреты (маскировать, паттерн `cc_ai_providers.encrypted_api_key` не отдаётся в открытом виде).

### Pitfall 6: multi-DIALSTATUS — рассинхрон UI/DTO/генератора
**Что:** UI (`DialstatusSelect`) уже отдаёт **массив** `DialStatus[]`, `route.types` уже типизирует `dialstatus?: DialStatus | DialStatus[] | ''`, но `RouteActionConditionDto` требует `@IsIn(ValidDialstatuses)` (одиночная строка → массив режется/падает), а `actionToDialplan` строит wrapper только для одной строки (`dialplan.util.ts:104-112`).
**Как избежать:** (1) DTO — принять `string | string[]` с валидацией каждого элемента (кастомный `@IsIn` each или `@ValidateIf`+`@IsArray`); (2) `actionToDialplan` — при массиве строить OR-join `ExecIf($["${DIALSTATUS}"="A" | "${DIALSTATUS}"="B"]?...)` (Asterisk `|` = логическое ИЛИ в `$[]`), whitelist каждый статус. Unit-тесты на массив/строку/пустое.

### Pitfall 7: `time_group_uid` не эмитится
**Что:** `condition.time_group_uid` сохраняется и есть в типах/UI (`ActionConditionFilters`/`TimeGroupSelect`), но `actionToDialplan` его игнорирует (только dialstatus). `TimeGroupsService.generateDialplan` строит `[tgroup_{uid}]`/`__WORKTIME_{uid}`, но НИКОГДА не применяется и не вызывается из route-генерации (runtime-разрыв).
**Как избежать (рекомендация — inline, self-contained):** в `generateRouteDialplan` собрать distinct `time_group_uid` из actions, для каждого один раз эмитить перед actions:
```ini
same => n,Set(__WT_12=0)
same => n,ExecIfTime(09:00-18:00,mon-fri,*,*?Set(__WT_12=1))   ; по интервалу из TimeGroup.intervals
```
затем каждый action с `time_group_uid=12` оборачивать `ExecIf($["${WT_12}"="1"]?<app>)`, комбинируя с DIALSTATUS-wrapper. Требует инъекции `TimeGroup` данных в `RoutesService` (сейчас `actionToDialplan` статичен) — передавать map `{uid:intervals}` параметром или собирать guard-строки в `generateRouteDialplan`. Альтернатива: применять `[tgroup_{uid}]` контексты + `Gosub` (сложнее, ещё один apply). Рекомендация — inline (без нового apply). Формат интервала — `${time_start}-${time_end},${days_of_week},${days_of_month},${months}` (VERIFIED: `time-groups.service.ts:70-72`).

### Pitfall 8: `hangup` игнорирует causecode
**Что:** HangupApp хранит `params.causecode` (`HangupApp.tsx:36,53`), но `actionToDialplan` `hangup` case эмитит голый `Hangup()` (`dialplan.util.ts:305-306`).
**Как избежать:** `Hangup(${sanitizeDialplanInput(causecode)})` при непустом causecode, иначе `Hangup()`. Тест на оба варианта.

### Pitfall 9: ValidationPipe whitelist режет новые поля
**Что:** `routes.controller` create/update — `ValidationPipe({whitelist:true})`; новые поля action.params для notify/callerid/trunk_carousel идут внутри `params: Record<string,any>` (`@IsObject`) — OK. Но новые типы обязаны быть в `ActionTypesList` (`route-action.dto.ts:4-12`), иначе `@IsIn(ActionTypesList)` отклонит.
**Как избежать:** добавить `notify`, `callerid`, `trunk_carousel` в `ActionTypesList` (DTO) И в `ActionType` union (`route.types.ts`) И в `dialplanAppsRegistry` (frontend). Тест на прохождение нового type.

### Pitfall 10: dialplan reload и in-flight звонки
**Что:** reload глобально заменяет контексты; активный звонок, вошедший в старый `group_…`, продолжит по нему, но новый шаг ищется в новом dialplan.
**Как избежать:** не удалять контекст без замены (DelCat+NewCat в одном apply, что и делает `applyCategories`); риск известен и принят для маршрутов (Phase 5 Pitfall 7). E2E не проверять горячее изменение группы во время звонка.

### Pitfall 11: MCP/AI tools для новых сущностей (архитектурное правило vs D)
**Что:** `backend/.idea/ARCHITECTURE.md §6` — ОБЯЗАТЕЛЬНОЕ правило: новая сущность → новый MCP tool + webhook endpoint. Но CONTEXT (Deferred) явно откладывает AI/MCP для новых apps.
**Как избежать:** зафиксировать как осознанное отступление (deferred в отдельную фазу по паттерну Phase 5 Domain AI Adapter). План должен упомянуть это как known gap, не реализуя в v1. См. Open Questions.

## Code Examples

### Add new action types (DTO + shared + registry)
```typescript
// packages/shared/src/types/route.types.ts — ActionType union
export type ActionType =
  | 'totrunk' | 'toexten' | 'toqueue' | 'togroup' | 'tolist'
  | 'toivr' | 'toroute' | 'playprompt' | 'playback'
  | 'setclid_custom' | 'setclid_list' | 'callerid'      // + callerid (unified)
  | 'sendmail' | 'sendmailpeer' | 'telegram' | 'notify' // + notify (multi-channel)
  | 'trunk_carousel'                                     // + trunk carousel
  | 'voicemail' | 'text2speech' | 'voicerobot' | 'asr' | 'keywords'
  | 'webhook' | 'confbridge' | 'cmd' | 'tofax'
  | 'label' | 'busy' | 'hangup';
```

### DIALSTATUS OR-join wrapper (Pitfall 6 fix)
```typescript
// dialplan.util.ts — replace single-string wrapper
const statuses: string[] = Array.isArray(condition.dialstatus)
  ? condition.dialstatus
  : condition.dialstatus ? [condition.dialstatus] : [];
const valid = statuses.filter((s) => VALID_DIALSTATUSES.includes(s));
if (valid.length) {
  const expr = valid.map((s) => `"\${DIALSTATUS}" = "${s}"`).join(' | ');
  wrapper = `ExecIf($[${expr}]?`;
  closing = ')';
}
```

### Encrypted credentials model (образец cc_ai_providers)
```typescript
// notification-integration.model.ts
@Table({ tableName: 'notification_integrations', timestamps: false })
export class NotificationIntegration extends Model {
  @Column({ primaryKey: true, autoIncrement: true, type: DataType.INTEGER }) declare uid: number;
  @Column({ type: DataType.STRING(128), allowNull: false }) declare name: string;
  @Column({ type: DataType.ENUM('telegram','email','whatsapp','webhook','max','vk'), allowNull: false })
  declare channel: string;
  /** Non-secret config: default chat_id/peer_id/phone_id, webhook url, payload template */
  @Column({ type: DataType.JSON, allowNull: true }) declare config: Record<string, any>;
  /** AES-256-GCM(JSON of secrets) — encryptSecret(JSON.stringify({token, api_key, ...})) */
  @Column({ type: DataType.TEXT, allowNull: true }) declare encrypted_credentials: string;
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 }) declare user_uid: number;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `System(/usr/scripts/telegram.php …)` | CURL → Nest `/internal/dialplan/notify` → axios provider | Phase 6 (D-12) | нет зависимости от PHP на сервере Asterisk; async; multi-channel |
| `System(/usr/scripts/sendmailpeer.php …)` | Email через `MailerService` (уже используется для `sendmail`) | Phase 6 | единый notify pipeline |
| orphaned `togroup` (Gosub в никуда) + dumb `tolist` (`Dial(LOCAL…)`) | `call_group` entity + `[group_{id}_{vpbx}]` со стратегиями | Phase 6 (D-01) | reuse групп, hunt/memoryhunt/random, per-member ring time |
| `setclid_custom` + `setclid_list` (2 app) | unified `callerid` app (4 режима) | Phase 6 (D-14) | один UX, + phonebook и carousel режимы |
| MAX API домен `platform-api.max.ru` | `platform-api2.max.ru` (обяз. до 19.07.2026) + Минцифры-сертификат | 2026 | использовать новый домен сразу [CITED dev.max.ru] |
| WhatsApp Cloud API v16-v18 | v22.0 (актуальна, примеры docs на v25) | 2026 | endpoint `graph.facebook.com/v22.0/{phone_id}/messages` [CITED developers.facebook.com] |

**Deprecated/outdated:**
- PHP System()-скрипты для telegram/sendmailpeer — заменяются (D-12).
- Одиночная строка DIALSTATUS в DTO/генераторе — заменяется массивом (D-19).

## Validation Architecture

> `.planning/config.json` не содержит `workflow.nyquist_validation` → секция включается (absent = enabled). Существующий тест-инфраструктура: `route-apply.service.spec.ts`, `routes.service.spec.ts`, `dialplan-apply.service.spec.ts`, `phonebooks.service.spec.ts` — образцы.

### Test Framework
| Property | Value |
|----------|-------|
| Backend | Jest 29.7 (`packages/backend`, spec рядом с модулями) |
| Frontend | Vitest 4.1 (`packages/frontend`) |
| Quick run (backend) | `npx jest call-groups --silent` / `npx jest notifications --silent` / `npx jest dialplan --silent` (из `packages/backend`) |
| Full suite (обяз. verify, AGENTS.md) | `npm run lint && npm run test:backend && npm run test:frontend` (из корня) |
| E2E | Playwright `e2e/` — только на стенде с живым Asterisk (опц.) |

### Phase Requirements → Test Map
| Decision | Behavior | Test Type | Automated Command | File Exists? |
|----------|----------|-----------|-------------------|-------------|
| D-05/D-08 | генерация `[group_{id}_{vpbx}]` для ringall/hunt/memoryhunt/random; всегда `Return()`, нет `Hangup` | unit (pure fn) | `npx jest call-group-dialplan` | ❌ Wave 0 (`call-group-dialplan.util.spec.ts`) |
| D-06/D-07 | internal `PJSIP/e{ext}_{vpbx}` + external `LOCAL/{num}@{ctx}`, per-member ring_time/order | unit | `npx jest call-group-dialplan` | ❌ Wave 0 |
| D-01/D-03 | CRUD call_group+members, tenant filter, apply на CRUD | unit (mock DialplanApplyService) | `npx jest call-groups` | ❌ Wave 0 (`call-groups.service.spec.ts`) |
| D-10/D-11 | CRUD интеграций, encrypt/decrypt, секрет не в ответе | unit (mock cipher) | `npx jest notifications` | ❌ Wave 0 |
| D-12 | notify endpoint: api_key check, async 200, dispatch по каналу | unit (mock providers) | `npx jest dialplan-notify` | ❌ Wave 0 (расширить mailer spec) |
| D-11 | провайдеры формируют корректный request (URL/headers/body) | unit (mock axios) | `npx jest notification-provider` | ❌ Wave 0 |
| D-14/D-15 | actionToDialplan для callerid (4 режима) и trunk_carousel | unit | `npx jest dialplan.util` (расширить) | ✅ база есть |
| D-19 | multi-DIALSTATUS массив → OR-join; DTO принимает массив | unit | `npx jest dialplan.util -t dialstatus` / `npx jest route-action.dto` | ✅ база (`dialplan.util`) / ❌ dto spec |
| D-19 | time_group_uid → ExecIfTime guard; интервалы корректны | unit | `npx jest routes.service -t time` | ✅ база (`routes.service.spec.ts`) |
| D-19 | hangup causecode → `Hangup(N)` | unit | `npx jest dialplan.util -t hangup` | ✅ база |
| D-02/D-17 | GroupApp/NotifyApp/CallerIdApp/TrunkCarouselApp рендер + onUpdate; CallGroupsPage/FormModal | vitest (integration) | `npm run test:frontend` | ❌ Wave 0 (ARCHITECTURE: интеграционные тесты для новых feature-компонентов обязательны) |
| D-21-аналог | реальный звонок через группу + доставка уведомления | manual-only | — | UAT checkpoint (живой Asterisk + внешние API) |

### Sampling Rate
- **Per task commit:** `npx jest <module> --silent` (затронутый модуль).
- **Per wave merge:** `npm run test:backend && npm run test:frontend`.
- **Phase gate:** `npm run lint && npm run test:backend && npm run test:frontend` зелёные + ручной E2E (звонок в группу; отправка уведомления в каждый настроенный канал).

### Wave 0 Gaps
- [ ] `call-groups/call-group-dialplan.util.spec.ts` — строки всех 4 стратегий, internal+external mix, Return-семантика
- [ ] `call-groups/call-groups.service.spec.ts` — CRUD, tenant isolation, apply вызывается (mock DialplanApplyService)
- [ ] `notifications/notifications.service.spec.ts` — encrypt на save, секрет не в ответе, tenant filter
- [ ] `notifications/notification-dispatcher.service.spec.ts` + provider specs — request shapes (mock axios)
- [ ] `notifications/dialplan-notify.controller.spec.ts` — api_key, async 200
- [ ] `routes/dto/route-action.dto` spec — массив dialstatus, новые ActionType
- [ ] расширить `dialplan.util` spec — callerid режимы, trunk_carousel, dialstatus OR-join, hangup causecode
- [ ] расширить `routes.service` spec — time_group_uid эмиссия
- [ ] frontend: интеграционные тесты GroupApp/NotifyApp/CallerIdApp/TrunkCarouselApp + CallGroupsPage/CallGroupFormModal + NotificationIntegrations page/modal

## Security Domain

> `security_enforcement` не задан явно → включено.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `JwtAuthGuard` на CRUD-контроллерах; `DIALPLAN_API_KEY` на internal notify endpoint (образец `DialplanNotifyController`) |
| V4 Access Control | yes | tenant filter `where:{user_uid:userUid}`; `delete dto.user_uid` в update/create; интеграция/группа другого тенанта недоступна |
| V5 Input Validation | yes | class-validator DTO (`@IsIn`, `@IsNumber`); `sanitizeDialplanInput`/`sanitizeTemplate`/`sanitizeShellInput` для всех значений, попадающих в dialplan |
| V6 Cryptography | yes | `secret-cipher.util` AES-256-GCM для credentials — НЕ hand-roll; `CC_AI_KEY_SECRET` обязателен в проде |
| V9 Communications | yes | внешние API по HTTPS (Telegram/WhatsApp/VK/MAX); MAX требует Минцифры-сертификат в доверенных |

### Known Threat Patterns for {NestJS + Asterisk dialplan}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Dialplan injection через шаблон уведомления / CID | Tampering | `sanitizeTemplate` (блок SHELL/SYSTEM/AGI, вырез `\n;\`) / `sanitizeDialplanInput` |
| Cross-tenant доступ к интеграции/группе | Elevation | `findOne(uid, userUid)` перед действием; `user_uid` в каждом where |
| Утечка токенов (БД/логи/API-ответ) | Information Disclosure | encrypt at rest; не возвращать секреты в CRUD-ответах; не логировать decrypted |
| Notify endpoint без auth → спам/абьюз | Spoofing | `DIALPLAN_API_KEY` (header или body), как в sendmail |
| SSRF через generic webhook URL | — | webhook URL задаёт владелец тенанта; допустимо, но валидировать схему (http/https), не резолвить в internal-адреса (по возможности) |
| CURL из dialplan синхронно висит | DoS | async endpoint (200 сразу) + короткие CURLOPT-таймауты |

## Project Constraints (from .cursor/rules/ и AGENTS.md)
- **Verify перед «готово»:** `npm run lint`, `npm run test:backend`, `npm run test:frontend` (AGENTS.md).
- **npm-пакеты:** перед установкой проверять `npm show <pkg> version dist-tags` (backend ARCHITECTURE §0). В этой фазе новых пакетов нет.
- **Tenancy:** JWT `req.user.vpbx_user_uid`; колонка `user_uid` (наши таблицы) или `field:'vpbx_user_uid'` (Asterisk Realtime); сервис `where:{user_uid}`; `delete dto.user_uid`; миграция с `user_uid INT NOT NULL DEFAULT 0` + `INDEX`. Frontend НЕ передаёт tenant.
- **FSD/UI:** Tailwind запрещён в `features/pages` — SCSS-модули + `var(--color-*)`; только `@/shared/ui`; `<VStack>/<HStack>`; без `div/select/input/button` в features; без эмодзи; без em dash (использовать `-`); z-index через переменные; responsive 360-2560px; i18n `ru`+`en` для всех строк; интеграционные тесты для новых feature-компонентов обязательны.
- **Табы модалок:** одна линия под табами + 2px под активным (образцы RouteFormModal interim Tailwind / IvrFormModal SCSS).
- **Copy/Duplicate паттерн:** триадный `modalMode: create|edit|copy` для новых страниц с дублированием.
- **Новая сущность → MCP tool:** правило backend ARCHITECTURE §6; в этой фазе осознанно отложено (Deferred) — зафиксировать как known gap.

## Environment Availability
| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| MySQL (krasterisk) | миграции, CRUD | ✓ | — | — |
| Asterisk + AMI | apply контекстов групп, звонки, E2E | ✓ стенд/прод; ✗ dev Windows | — | unit c mock AmiService; E2E только на стенде |
| axios / @nestjs/axios | провайдеры уведомлений | ✓ | 1.16 / 4.0 | — |
| `CC_AI_KEY_SECRET` | шифрование credentials | ⚠ опц. (dev-fallback ключ) | — | dev-fallback (небезопасно) — прод ДОЛЖЕН задать |
| Внешние API (Telegram/WhatsApp/VK/MAX) | реальная доставка | внешние | — | unit c mock axios; настоящая проверка — UAT с реальными credentials |
| SMTP (`.env`) | email-канал | ✓ (уже для sendmail/auth) | — | — |

**Blocking:** нет для разработки/юнит-тестов. Реальная доставка в каждый канал проверяется на UAT (нужны реальные токены — ручной checkpoint).

## Assumptions Log
| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `${RAND(min,max)}` и nested `${CID_${RAND(...)}}` работают в текущей версии Asterisk | Patterns 1,4 | Средний: RAND/func_rand — стандартны, но nested expansion зависит от версии; проверить на стенде (UAT). Fallback — GotoIf-таблица |
| A2 | `Gosub`/`Return` возвращает управление на строку после Gosub → следующий action (D-08) | Pattern 1 | Низкий: подтверждено паттерном phonebook bindings в проде (Phase 5) |
| A3 | AMI `$[expr1 | expr2]` = логическое ИЛИ для OR-join DIALSTATUS | Pitfall 6 | Низкий: стандартный Asterisk expr; проверить в тесте генерации + на стенде |
| A4 | Webhook-канал (generic) — произвольный JSON payload с подстановкой; точная схема — на усмотрение | Pattern 3 | Низкий: generic, определяется пользователем |
| A5 | MAX bot API `platform-api2.max.ru`, header-auth, `{text}` body | Pattern 3 | Средний: домен меняется до 19.07.2026; требует Минцифры-сертификат — проверить на стенде [CITED dev.max.ru] |
| A6 | WhatsApp Cloud API service-message требует активного 24h окна (иначе только template) | Pattern 3 | Средний: для исходящих уведомлений «на холодную» может понадобиться template message API вместо text — уточнить с пользователем сценарий [CITED developers.facebook.com] |
| A7 | Telegram-провайдер шлёт per-integration token/chat_id (не глобальный `.env`) | Pattern 3 | Низкий: соответствует D-10 (credential store) |
| A8 | time_group_uid лучше решать inline ExecIfTime, а не Gosub в tgroup-контекст | Pitfall 7 | Низкий: обе рабочие; inline не требует второго apply |

## Open Questions
1. **ActionType-стратегия для togroup/tolist/setclid_*.** Рекомендация: репёрпоузить `togroup` → GroupApp (group=uid), добавить `notify`/`callerid`/`trunk_carousel`; `tolist` пометить deprecated (мигрировать на группу или оставить рабочим, данных нет); `setclid_custom`/`setclid_list` — оставить рабочими id, но в registry указывать на новый `CallerIdApp` (режим инферится по params), новые записи создавать как `callerid`. Финальное решение — за планировщиком/пользователем.
2. **WhatsApp «на холодную».** Service (text) messages требуют 24h customer-service окна; для инициативных уведомлений о звонке может потребоваться approved **template** message (иной payload). Уточнить у пользователя: уведомления идут клиентам (нужен template) или внутренним сотрудникам (окно может быть открыто)? [CITED developers.facebook.com]
3. **AI/MCP для новых сущностей.** backend ARCHITECTURE §6 требует MCP tools для новых сущностей; CONTEXT откладывает. Рекомендация: явно deferred в отдельную фазу (Domain AI Adapter, Phase 5 паттерн), в плане — known gap, не блокер.
4. **Удаление группы, используемой в маршрутах.** Блокировать delete с предупреждением (какие маршруты ссылаются) или разрешать (Gosub в отсутствующий контекст)? Рекомендация: предупреждать (найти маршруты по `actions` содержащим `togroup` с этим uid), но не жёстко блокировать; на delete — `deleteCategories`.
5. **random-стратегия — глубина рандомизации.** v1 = случайный первый + остальные по порядку (GotoIf-таблица). Полный shuffle — deferred. Подтвердить достаточность.

## Sources

### Primary (HIGH — код репозитория, прочитан в этой сессии)
- `packages/backend/src/shared/utils/dialplan.util.ts` (actionToDialplan, sanitizers, sendmail/togroup/tolist/setclid/telegram)
- `packages/backend/src/modules/routes/{routes.service,routes.controller,route-apply.service}.ts`, `dto/route-action.dto.ts`
- `packages/backend/src/modules/ami/dialplan-apply.service.ts`
- `packages/backend/src/modules/phonebooks/phonebook-dialplan.util.ts` (generateBindingDialplan — sub-context образец)
- `packages/backend/src/modules/mailer/{dialplan-notify.controller,mailer.service}.ts`
- `packages/backend/src/modules/telegram/telegram.service.ts`
- `packages/backend/src/modules/queues/{queue.model,queue-member.model,queues.service}.ts`
- `packages/backend/src/modules/time-groups/{time-group.model,time-groups.service}.ts`
- `packages/backend/src/modules/ai-agents/util/secret-cipher.util.ts`, `models/ai-provider.model.ts`
- `packages/backend/src/modules/phonebooks/migrate-phonebooks-phase5.ts` (migration образец)
- `packages/frontend/src/features/dialplan-apps/**` (registry, types, DialplanAppsEditor, HangupApp, QueueApp, ActionConditionFilters, DialstatusSelect)
- `packages/frontend/src/features/queues/ui/{QueuesPage,QueueFormModal}` + `packages/frontend/src/features/routes/ui/RouteFormModal/**` (RouteFormModal, RoutePhonebooksTab — inline sub-entity editor)
- `packages/shared/src/types/{route,phonebook,trunk,timeGroup}.types.ts`
- `packages/{frontend,backend}/.idea/ARCHITECTURE.md`, `AGENTS.md`, `.planning/phases/05-*/05-RESEARCH.md`, `06-CONTEXT.md`, `.planning/config.json`, `packages/backend/package.json`

### Secondary (MEDIUM/verified official docs, 2026)
- WhatsApp Cloud API text messages — developers.facebook.com/docs/whatsapp/cloud-api/messages/text-messages (v22.0, Bearer token, phone_number_id)
- MAX bot API — dev.max.ru/docs-api/methods/POST/messages (`platform-api2.max.ru`, header auth, `{text}`)
- VK messages.send — dev.vk.com/method/messages.send (`api.vk.com/method/messages.send`, access_token+v, peer_id+random_id)
- Telegram Bot API sendMessage — core.telegram.org/bots/api (well-known; `api.telegram.org/bot{token}/sendMessage`)

### Tertiary (LOW / ASSUMED)
- Asterisk `${RAND()}`, nested var expansion, `$[a|b]` OR-семантика, Gosub/Return — обучающие данные + аналогия с прод-паттернами репо; помечено A1–A3, A8. Проверить на стенде (UAT).

## Metadata

**Confidence breakdown:**
- Call-group dialplan + apply: HIGH — прямая эволюция phonebook-binding + queues паттернов; RAND-детали MEDIUM (A1).
- Multi-channel notify (endpoint + dispatch): HIGH по архитектуре (sendmail-образец, axios, cipher); provider request-shapes MEDIUM (verified docs, WhatsApp template-нюанс A6).
- CallerID/trunk carousel: HIGH для static/phonebook/list; MEDIUM для carousel RAND (A1).
- Data model / migrations / tenancy: HIGH — паттерн queues + migrate-скрипт verified.
- Bug fixes (DIALSTATUS/time_group/hangup): HIGH — точки багов локализованы построчно в коде.
- Frontend: HIGH — эталоны (QueueFormModal, RouteFormModal, RoutePhonebooksTab, registry) прочитаны.

**Research date:** 2026-07-15
**Valid until:** 2026-08-15 (стек стабилен; внешние API — сверять MAX-домен ≤ 19.07.2026 и WhatsApp API version)
