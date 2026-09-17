# Phase 17: Модуль Автообзвон — Context

**Gathered:** 2026-09-17  
**Status:** Ready for execution — decisions locked in brainstorming + approved plan

<domain>
## Phase Boundary

Коммерческий глобальный модуль «Автообзвон» (marketplace code `autodial`): клиентские базы с пользовательской схемой полей и настраиваемым импортом CSV/XLSX; кампании с Progressive / Power / Agentless пейсингом; сценарий после ответа через переиспользуемый `DialplanAppsEditor` (новый host `autodial`); онлайн-монитор; KPI и отчётность.

**Вне фазы (отложено / 17.5 частично):** полноценный Predictive с Erlang (частично в 17.5); Preview-режим; отдельный AMD-движок поверх stock Asterisk AMD; биллинг по звонкам.
</domain>

<decisions>
## Implementation Decisions

### Транспорт и соединение

- **D-01:** Транспорт набора — **ARI** (`POST /channels/create` + `/dial` + `continueInDialplan`), не AMI `Originate`. Корреляция через наш `channelId` (`ac-{campaign}-{task}-{attempt}`).
- **D-02:** Набор напрямую `PJSIP/{trunkId}/{number}` (не Local@from-internal). Выбор транка/CID в TypeScript по логике trunk carousel.
- **D-03:** После ответа — `continueInDialplan` в `krsk-ac-{campaignUid}`; сценарий = `IRouteAction[]` из DialplanAppsEditor.
- **D-04:** Соединение с оператором — через шаг `toqueue` → `Queue()`. Гонку гасит резервирование ёмкости в пейсере.
- **D-05:** Три источника результата попытки: ARI events (pre-answer) → hangup_handler CURL `attempt-result` (post-answer) → CDR-реконсилер.

### Режимы и пейсинг

- **D-06:** Режимы v1: Progressive (1:1), Power (ratio N:1), Agentless. Predictive — 17.5.
- **D-07:** Пейсер берёт `min()` по провайдерам: `static`, `queue_agents`, `trunk_channels`, `tenant_cap`.
- **D-08:** `queue_agents` читает `CallCenterStateService.getQueue(...).agents.available` (READY).

### Комплаенс

- **D-09:** DNC: scope `global | campaign | base`.
- **D-10:** Разрешённые часы с учётом `tz_offset_min` абонента.
- **D-11:** AMD через stock Asterisk `AMD()` в преамбуле контекста кампании.

### Данные и UI

- **D-12:** Таблицы с префиксом `ac_`; tenant column `vpbx_user_uid`.
- **D-13:** Клиентская база по образцу directories: JSON `values` по `field_uid`; телефоны в `ac_contact_phones`.
- **D-14:** Импорт через переиспользуемые `ac_import_profiles` (CSV + XLSX / exceljs).
- **D-15:** `DialplanHost` расширяется значением `autodial`.
- **D-16:** Marketplace: code `autodial`, `kind: market`, `@RequiresModule('autodial')` на всех контроллерах.
- **D-17:** Обязательны AI-адаптер + `skills/autodial/SKILL.md` + coverage (гейт D-16/D-17 Phase 15) — в 17.5.
- **D-18:** Диспозиции: `new`, `dialing`, `success`, `answered_short`, `no_answer`, `busy`, `congestion`, `failed`, `amd_machine`, `voicemail`, `invalid_number`, `dnc`, `max_attempts`, `callback_scheduled`, `cancelled`, `excluded`.
- **D-19:** При повторном запуске кампании — выбор контактов по прежним диспозициям.
- **D-20:** Лизинг задач tenant-scoped + свипер залипших `dialing`/leases.
</decisions>

<subphases>
| Sub | Scope |
|-----|--------|
| 17.1 | Bases, fields, contacts, phones, import profiles/runs, FE `/autodial/bases` |
| 17.2 | Campaigns, schedules, DNC, tasks, DialplanHost, dialplan apply, scheduler |
| 17.3 | ARI engine, pacer, attempts, SSE, AMD, marketplace gate |
| 17.4 | Monitor, metrics, rollup, reports |
| 17.5 | AI adapter, Predictive, trunk channel limit |
</subphases>
