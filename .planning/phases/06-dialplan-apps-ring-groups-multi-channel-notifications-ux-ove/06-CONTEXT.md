# Phase 6: Dialplan Apps — ring groups, multi-channel notifications, UX overhaul - Context

**Gathered:** 2026-07-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Переработка `DialplanAppsEditor` и набора dialplan-приложений в три новых полнофункциональных app + аудит/чистка редактора. Все существующие возможности редактора сохраняются — новое встраивается как приложения внутри него (registry-driven).

**In scope:**
1. **Группа вызовов (call group)** — новая сущность + объединённое приложение вместо orphaned `togroup` и «тупого» `tolist`. Стратегии обзвона, внутренние + внешние участники, реализация через `Gosub` с `Return` → продолжение текущего dialplan.
2. **Multi-channel уведомления** — единое конфигурируемое приложение поверх новой сущности «Интеграции уведомлений» (tenant-scoped credential store). Каналы: Telegram, Email, WhatsApp, generic Webhook, MAX/VK. Доставка через единый CURL → Nest endpoint.
3. **Карусель номеров** — приложение выбора транка (random + failover) с per-trunk CallerID (статичный номер или phonebook lookup).
4. **Аудит + UX overhaul** редактора: dedicated UI для group/notify/carousel; GenericApp остаётся fallback для редких apps; попутный фикс известных багов (multi-DIALSTATUS, `time_group_uid`, hangup causecode).

**Out of scope:**
- Полная замена ядра Asterisk dialplan engine / очередей (`toqueue` остаётся для тяжёлых сценариев с агентами и статистикой).
- Dedicated UI для ВСЕХ apps (только group/notify/carousel в этой фазе).
- Полный клон FreePBX/Elastix ring-group модуля — берём лучшие практики, делаем проще и гибче.
- AI Chat / MCP tools для новых apps (отдельная фаза при необходимости).
- Slack как канал v1 (deferred).

</domain>

<decisions>
## Implementation Decisions

### Группа вызовов — модель и CRUD (D-01…D-04)
- **D-01:** **Новая сущность `call_group`** (tenant-scoped: `user_uid` / `vpbx_user_uid`), объединяющая текущие `togroup` и `tolist`. `tolist` как «тупой ringall» и orphaned `togroup` (Gosub в несуществующий контекст) заменяются одним приложением.
- **D-02:** **Гибридный CRUD:** отдельный раздел «Группы вызовов» (по паттерну страницы «Очереди») **И** быстрый inline-редактор прямо в модалке маршрута — Select группы + кнопка «создать/править», открывающая ту же форму. Цель: не терять функционал, но быстро править из маршрута.
- **D-03:** Приложение группы должно быть **лёгким** (не как очередь): без агентов, статистики, MOH-очереди. Функциональность = стратегии + участники + таймеры + failover.
- **D-04:** Не копировать FreePBX/Elastix 1:1 — взять лучшие практики (ringall/hunt/memoryhunt/random), сделать улучшенную, **простую и гибкую** версию.

### Ring-стратегии v1 (D-05)
- **D-05:** Стратегии v1: **`ringall`** (все одновременно), **`hunt`** (по очереди, по одному), **`memoryhunt`** (по нарастающей: 1, 1+2, 1+2+3…), **`random`** (случайный порядок обзвона через Asterisk RANDOM). Суффикс `-prim` и `firstavailable/firstnotonphone` — **не в v1** (упрощение; можно добавить позже).

### Состав и параметры группы (D-06…D-09)
- **D-06:** Участники — **внутренние (extensions) + внешние номера** в одном упорядоченном списке. Внешние вызываются **через LOCAL-канал** (`LOCAL/{num}@{context}`), **не** напрямую через транк. В форме группы нужно выбрать **через какой контекст** маршрутизируются внешние номера (выбор контекста, tenant-aware, по образцу `ctx-{vpbxUserUid}`).
- **D-07:** **Per-member ring time и порядок** — обязательны (нужны для `hunt`/`memoryhunt`).
- **D-08:** **Реализация через `Gosub`** в сгенерированный контекст `group_{id}_{vpbx}`. При **`Return`** (никто не ответил / отбой без Hangup) вызов **продолжает текущие правила dialplan** — следующее приложение в `DialplanAppsEditor`, если оно есть. Т.е. группа НЕ завершает вызов принудительно, а отдаёт управление обратно.
- **D-09:** Дополнительные параметры (Claude's discretion по деталям): call confirmation для внешних, CID name prefix, per-group failover-назначение — желательны, но не блокирующие; приоритет — стратегии + участники + Return-семантика.

### Multi-channel уведомления (D-10…D-13)
- **D-10:** **Отдельная сущность «Интеграции уведомлений»** (tenant-scoped): пользователь один раз заводит подключение (тип канала + credentials: token/api key/webhook URL/chat_id и т.д.). Notify-app в маршруте лишь **выбирает подключение + шаблон сообщения** — токены не дублируются и не светятся в каждом маршруте.
- **D-11:** Каналы v1: **Telegram** (bot token + chat_id), **Email** (перенести существующий MailerService-путь в единую модель), **WhatsApp** (Cloud API / провайдер: phone_id + token), **generic Webhook** (произвольный HTTP POST + шаблон payload), **MAX/VK** (российские мессенджеры). Slack — deferred.
- **D-12:** **Доставка через единый CURL → Nest endpoint** для ВСЕХ каналов (по образцу текущего `sendmail`: `Set(__K*)` + `CURL(...URIENCODE...)`). PHP-скрипты (`telegram.php`, `sendmailpeer.php`) **убираются**. Channel vars (`${CALLERID(num)}`, `${EXTEN}` и любые) работают через `sanitizeTemplate` + `URIENCODE`. Отправка в backend — **асинхронная** (не блокировать dialplan).
- **D-13:** Шаблоны сообщений используют **любые переменные канала**; предусмотреть **пресеты** («входящий звонок», «пропущенный» и т.д.) и интуитивный UX с подсказками по каждому параметру интеграции (что нужно от пользователя: API/токены/ключи).

### Карусель номеров (D-14…D-16)
- **D-14:** Приложение «Карусель» = список пар **{транк + источник CallerID}**. Режим выбора транка по умолчанию — **`random_then_failover`**: случайный транк, при недозвоне/недоступности → следующий из оставшихся.
- **D-15:** Источник CallerID **на каждый транк**: **статичный номер** (ввод вручную) **ИЛИ** **справочник phonebook** (динамический CID по lookup — переиспользуем механику Phase 5). setclid-list — не в v1.
- **D-16:** UX интуитивный: подсказки/описания к каждому параметру (зачем нужен, что подставится), чтобы был понятен смысл random+failover и per-trunk CallerID.

### UX overhaul редактора (D-17…D-19)
- **D-17:** Все текущие возможности `DialplanAppsEditor` сохраняются; новые app встраиваются как компоненты в `dialplanAppsRegistry`.
- **D-18:** **GenericApp остаётся fallback** для редких apps (webhook, cmd, label, tofax, asr, keywords, confbridge, voicemail, text2speech) — dedicated UI в этой фазе только для group/notify/carousel.
- **D-19:** Попутно **починить известные баги** редактора/генерации: multi-DIALSTATUS (UI хранит массив, backend ждёт строку с `IsIn`), неиспользуемый `time_group_uid` (сохраняется, но не эмитится в dialplan), игнорируемый `hangup` causecode.

### Claude's Discretion
- Схема таблиц `call_group` / участников / `notification_integration`, миграции (legacy `togroup`/`tolist` данных в проде нет — свобода).
- Точный dialplan для каждой стратегии (`hunt`/`memoryhunt`/`random`) и корректная `Return`-семантика в `group_{id}_{vpbx}`.
- Конкретный контракт Nest endpoint уведомлений (единый vs per-channel handler внутри) и провайдеры WhatsApp/MAX/VK.
- Точный ActionType-набор: расширить/переименовать `togroup`/`tolist` в один `togroup` (call group) или ввести новый id; новые id для notify (`notify`) и carousel (`carousel`).
- Детали call confirmation / CID prefix / failover группы.
- Формат хранения credentials (шифрование токенов на уровне БД — учесть безопасность).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Архитектура (обязательно)
- `packages/frontend/.idea/ARCHITECTURE.md` — FSD, Tailwind + shadcn, SCSS modules, i18n, паттерны страниц/модалок, DnD-редакторы
- `packages/backend/.idea/ARCHITECTURE.md` — NestJS-модули, Sequelize, AMI, guards, tenant isolation, internal dialplan endpoints
- `.planning/CANONICAL_REFS.md` — общий индекс

### Модульная документация
- `.docs/PHONEBOOKS_MODULE.md` — lookup CURL (pipe-delimited), `PB_*` vars — база для per-trunk CallerID в карусели
- `.docs/AI_CHAT_MODULE.md` — контекст (не требуется менять в этой фазе, но notify/group снапшот может понадобиться позже)

### Frontend (точки изменения)
- `packages/frontend/src/features/dialplan-apps/ui/DialplanAppsEditor/DialplanAppsEditor.tsx` — **primary target**, DnD-список приложений
- `packages/frontend/src/features/dialplan-apps/model/registry.ts` — `dialplanAppsRegistry` (регистрация новых app: group, notify, carousel)
- `packages/frontend/src/features/dialplan-apps/model/types.ts` — `IDialplanAppProps` / `IDialplanAppConfig`
- `packages/frontend/src/features/dialplan-apps/ui/apps/` — образцы dedicated app (TrunkApp, QueueApp, HangupApp…), сюда добавить GroupApp/NotifyApp/CarouselApp
- `packages/frontend/src/features/dialplan-apps/ui/apps/GenericApp/GenericApp.tsx` — остаётся fallback
- `packages/frontend/src/features/routes/ui/RouteFormModal/` — inline-редактор группы; эталон табов/модалки
- `packages/frontend/src/features/queues/ui/QueuesPage/` + `QueueFormModal` — паттерн отдельного раздела «Группы вызовов» и формы стратегий
- `packages/frontend/src/features/phonebooks/` — выбор справочника для CallerID карусели
- `packages/frontend/src/shared/config/locales/{en,ru}.ts` — i18n (`routes.action.*`, `routes.apps.*`, `routes.categories.*`, новые ключи)

### Backend (точки изменения)
- `packages/backend/src/shared/utils/dialplan.util.ts` — **`AsteriskDialplanUtils.actionToDialplan()`** switch (togroup/tolist/telegram/sendmail — точки переработки; фикс hangup causecode, DIALSTATUS)
- `packages/backend/src/modules/routes/routes.service.ts` — `generateRouteDialplan` / `generateContextDialplan` (генерация контекста `group_{id}_{vpbx}`, Return-семантика, time_group_uid)
- `packages/backend/src/modules/routes/dto/route-action.dto.ts` — валидация action (multi-DIALSTATUS массив vs `IsIn`)
- `packages/backend/src/modules/queues/queue.model.ts` + `queue-member.model.ts` — образец модели сущности + участников (для `call_group`)
- `packages/backend/src/modules/ami/dialplan-apply.service.ts` — применение сгенерированного dialplan (AMI UpdateConfig) для контекстов группы
- `packages/backend/src/modules/mailer/dialplan-notify.controller.ts` + `MailerService` — образец CURL→Nest endpoint; расширить до multi-channel `dialplan/notify`
- `packages/backend/src/modules/telegram/` (`TelegramService`) — сейчас admin-логирование; переиспользовать/расширить для dialplan-уведомлений

### Shared types
- `packages/shared/src/types/route.types.ts` — `ActionType`, `IRouteActionCondition`, `IGroupActionParams`, `IListActionParams`, `ITelegramActionParams`, union `IRouteAction`
- `packages/shared/src/types/trunk.types.ts` — транки для карусели
- `packages/shared/src/types/phonebook.types.ts` — привязка справочника к CallerID

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AsteriskDialplanUtils.actionToDialplan` — единый switch app→dialplan; `sanitizeTemplate` (разрешает `${VAR}`, блокирует SHELL/SYSTEM/AGI) — модель для notify channel vars
- `sendmail` case (dialplan.util.ts): `Set(__KMAIL_*)` + `CURL(...URIENCODE...)` — **эталон** доставки для всех каналов уведомлений
- Очереди: `queue.model.ts` (strategy, timeout, MOH), `queue-member.model.ts`, `QueuesPage`/`QueueFormModal` — паттерн сущности + участников + страницы для `call_group`
- `setclid_list` / `exten_setclid.php` — существующая подстановка CallerID из списка (референс для карусели, хотя v1 использует static + phonebook)
- `PhonebooksService.lookupNumber` (Phase 5) — динамический CallerID lookup для карусели
- `_applyContextDialplan` / `dialplan-apply.service.ts` — AMI UpdateConfig apply для новых контекстов
- `SortableActionItem` + `ActionTypeSelect` (optgroups) + `@dnd-kit` — chrome строки редактора для новых app

### Established Patterns
- Tenant isolation: `user_uid` / `vpbx_user_uid` на всех операциях; внешние LOCAL-вызовы через `ctx-{vpbxUserUid}`; internal endpoints — `DIALPLAN_API_KEY`
- RTK Query endpoints + invalidatesTags (routeApi/queueApi образцы для callGroupApi/notificationApi)
- Модалки: SCSS-модули, одна полоса под табами (эталон RouteFormModal)
- i18n `ru` + `en` для всех новых строк; без em dash в UI-тексте

### Integration Points
- `togroup` → `Gosub(group_{group}_{vpbx},start,1)` **уже эмитится**, но контекст нигде не генерируется — этот runtime-разрыв закрывается (генератор контекста группы + apply)
- `tolist` → simultaneous `Dial(LOCAL/n@ctx-{vpbx}&…)` — заменяется приложением группы
- `telegram`/`sendmailpeer` PHP System() пути — заменяются CURL→Nest
- registry.ts: `togroup`/`tolist`/`sendmail`/`sendmailpeer`/`telegram` сейчас `GenericApp` → dedicated компоненты
- Route action pipeline: следующее приложение после группы выполняется при `Return` (не Hangup)

</code_context>

<specifics>
## Specific Ideas

- «Группа вызовов не сильно тяжёлая» — быстрый inline-редактор из маршрута + опциональный отдельный раздел (как «Очереди»), без потери функционала.
- Уведомления — «сразу продумать механизмы интеграции, что нужно от пользователя (api, токены, ключи доступа)»: UX с подсказками к каждому полю подключения; пресеты сообщений.
- Карусель — «различные транки часто просят подставлять определённый CallerID перед набором» → per-trunk CallerID (static или справочник phonebook); random + failover.
- Референсы: FreePBX/Sangoma Ring Groups (ringall/hunt/memoryhunt, call confirmation, CID prefix, external numbers), Asterisk RANDOM для случайной стратегии/карусели — как источник лучших практик, НЕ 1:1 клон.

</specifics>

<deferred>
## Deferred Ideas

- **Slack-канал** уведомлений — не v1, добавить в multi-channel позже.
- **Стратегии `-prim` / `firstavailable` / `firstnotonphone`** для групп — расширение после v1.
- **AI Chat / MCP tools** для управления группами/уведомлениями/каруселью через чат — отдельная фаза (по паттерну Phase 5 Domain AI Adapter).
- **Dedicated UI для остальных GenericApp** (webhook, cmd, tofax, asr, keywords, confbridge, voicemail, text2speech) — отдельная фаза UX.
- **setclid-list как источник CallerID** карусели — возможно позже (v1: static + phonebook).

</deferred>

---

*Phase: 6-dialplan-apps-ring-groups-multi-channel-notifications-ux-ove*
*Context gathered: 2026-07-15*
