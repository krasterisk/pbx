# Phase 6: Dialplan Apps — ring groups, multi-channel notifications, UX overhaul - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-15
**Phase:** 6-dialplan-apps-ring-groups-multi-channel-notifications-ux-ove
**Areas discussed:** Ring group model & CRUD, Ring strategies, Group members, Notification integrations & channels, Notification delivery, GenericApp fate, Carousel app & CallerID, Carousel mode

---

## Ring group — модель и CRUD

| Option | Description | Selected |
|--------|-------------|----------|
| Гибрид | Новая сущность + отдельный раздел «Группы вызовов» (как Очереди) + inline-редактор в модалке маршрута | ✓ |
| Только inline | Группа в самом action маршрута, без сущности/страницы | |
| Только раздел | Отдельный раздел, в маршруте лишь выбор группы | |

**User's choice:** Гибрид (both)
**Notes:** «Групповые вызовы не сильно тяжёлыми, чтобы быстро зайти и поправить в самом маршруте, но не терять функционал. Проанализируй FreePBX — там групповые звонки без очередей, но функциональные, со стратегиями.»

---

## Ring-стратегии v1

| Option | Description | Selected |
|--------|-------------|----------|
| ringall | Все одновременно | ✓ |
| hunt | По очереди, по одному | ✓ |
| memoryhunt | По нарастающей (1, 1+2, 1+2+3…) | ✓ |
| -prim | Первый participant primary | |
| firstavailable/firstnotonphone | Первый свободный канал | |
| random | Случайный порядок (Asterisk RANDOM) | ✓ |

**User's choice:** ringall, hunt, memoryhunt, random
**Notes:** «Не обязательно делать аналог FreePBX/Elastix. Взять лучшие практики, сделать улучшенную, но простую и гибкую версию.»

---

## Состав группы и параметры участников

| Option | Description | Selected |
|--------|-------------|----------|
| Внутренние + внешние | Extensions + внешние номера в одном списке | ✓ |
| Per-member ring time + порядок | Для hunt/memoryhunt | ✓ |
| Call confirmation | Callee подтверждает приём (внешние) | (discretion) |
| CID name prefix | Префикс к имени звонящего | (discretion) |
| Failover-назначение | Куда уходит вызов после группы | (discretion) |

**User's choice:** Внутренние + внешние (+ per-member time/порядок, остальное на усмотрение)
**Notes:** «Внешние — не через транк, а через LOCAL канал; выбрать через какой контекст. Учитывать тенантность. Группа через Gosub; если вызов вернётся (Return) — продолжает правила текущего dialplan (следующее приложение в редакторе, если есть).»

---

## Multi-channel уведомления — хранение интеграций

| Option | Description | Selected |
|--------|-------------|----------|
| Сущность «Интеграции» | Tenant-scoped connections; app выбирает подключение + шаблон | ✓ |
| Креды в action | Токены прямо в маршруте | |
| SellerSettings | Глобальные креды на тенант | |

**User's choice:** Отдельная сущность «Интеграции уведомлений»
**Notes:** «Гибко создать интеграцию с разными сервисами (telegram, email, whatsapp, slack, webhook). Сразу продумать механизмы интеграции, что нужно от пользователя (api, токены, ключи доступа).»

---

## Каналы уведомлений v1

| Option | Description | Selected |
|--------|-------------|----------|
| Telegram | bot token + chat_id | ✓ |
| Email | перенести MailerService в единую модель | ✓ |
| WhatsApp | Cloud API / провайдер | ✓ |
| Slack | incoming webhook / bot token | |
| Generic Webhook | HTTP POST + шаблон payload | ✓ |
| MAX/VK | российские мессенджеры | ✓ |

**User's choice:** telegram, email, whatsapp, webhook, max_vk (Slack — deferred)

---

## Доставка уведомлений из dialplan

| Option | Description | Selected |
|--------|-------------|----------|
| CURL → Nest | Единый endpoint для всех каналов, ${VAR}+URIENCODE, async | ✓ |
| PHP-скрипты | Оставить существующие, новые каналы отдельно | |

**User's choice:** Единый CURL → Nest endpoint

---

## Судьба GenericApp и редких apps

| Option | Description | Selected |
|--------|-------------|----------|
| Keep GenericApp | Fallback; dedicated UI только group/notify/carousel | ✓ |
| All dedicated | Dedicated UI для всех apps | |
| Fix gaps | GenericApp + фикс багов (multi-DIALSTATUS, time_group_uid, hangup causecode) | ✓ |

**User's choice:** A и C (GenericApp fallback + попутный фикс багов)

---

## Карусель номеров — выбор транка и CallerID

| Option | Description | Selected |
|--------|-------------|----------|
| Trunk+CID map | Список {транк + источник CallerID}, random/weighted/failover | ✓ |
| Random only | Случайный транк, общий CallerID | |
| Sequential failover | Перебор по порядку с failover | |

**User's choice:** Trunk+CID map
**Notes:** «Пометь, чтобы было интуитивно понятно — подсказки, описания к параметрам.» CallerID источник: статичный номер ИЛИ справочник phonebook (A и B).

---

## Режим выбора транка в карусели

| Option | Description | Selected |
|--------|-------------|----------|
| Random | Равновероятный случайный | |
| Weighted | С весами | |
| Random + failover | Случайный, при недозвоне → следующий | ✓ |

**User's choice:** Random + failover

---

## Claude's Discretion

- Схема таблиц `call_group` / участников / `notification_integration` + миграции (legacy данных нет).
- Точный dialplan для стратегий (hunt/memoryhunt/random) и Return-семантика в `group_{id}_{vpbx}`.
- Контракт Nest endpoint уведомлений (единый vs per-channel handler); провайдеры WhatsApp/MAX/VK.
- ActionType-набор: расширить togroup/tolist в один id или ввести новые (notify, carousel).
- Call confirmation / CID prefix / failover группы.
- Шифрование credentials в БД.
- Источник CallerID карусели — детали static + phonebook.

## Deferred Ideas

- Slack-канал уведомлений.
- Стратегии -prim / firstavailable / firstnotonphone.
- AI Chat / MCP tools для новых apps (Domain AI Adapter, по Phase 5).
- Dedicated UI для остальных GenericApp (webhook, cmd, tofax, asr, keywords, confbridge, voicemail, text2speech).
- setclid-list как источник CallerID карусели.
