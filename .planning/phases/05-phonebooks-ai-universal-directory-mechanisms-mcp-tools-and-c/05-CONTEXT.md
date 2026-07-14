# Phase 5: Phonebooks AI — универсальные справочники, MCP tools, chat-bot — Context

**Gathered:** 2026-07-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Универсальный механизм **переиспользуемых справочников CallerID** для маршрутизации (match → enrich → act) + AI-платформа для управления ими через chat/MCP.

Справочник = чистые данные (номера/паттерны + произвольные `vars`). Поведение задаётся **в точке использования** — привязкой к маршруту (order + match_mode + behavior-пресет или custom actions). AI (встроенный чат + MCP) умеет создавать/править справочники, записи и привязки; интеграция строится как **референсная реализация универсального платформенного контракта «модуль → AI» (Domain AI Adapter)**.

**In scope:** переработка модели phonebooks (данные/привязки), пресеты поведения, вкладка «Справочники» в RouteFormModal, полная прошивка dialplan (AMI apply), AI tools (CRUD + update_route), summary в snapshot + KB-блок, каркас Domain AI Adapter, audit log MCP, настраиваемые подтверждения AI-операций, E2E-сценарии с реальным звонком.

**Out of scope:** новые типы справочников beyond phonebook; match по DID/trunk (только CallerID(num)); рефакторинг существующих 5 AI-доменов на adapter (каркас обязан их поддерживать, но перевод — отдельная фаза); полный редизайн PhonebooksPage; собственный LLM.

</domain>

<decisions>
## Implementation Decisions

### Концепция справочников (D-01…D-03)
- **D-01:** Справочник = **универсальная CallerID-политика**: match → enrich → act. Единый инструмент для blacklist/whitelist, подстановки `CALLERID(name)`, переназначения `CALLERID(num)`, redirect, обогащения `PB_*` — не отдельные фичи.
- **D-02:** Ключевое требование — **переиспользование**: один справочник (данные) → много применений с разным поведением на разных маршрутах.
- **D-03:** Маршрут подключает **упорядоченную цепочку политик** перед основными actions (blacklist раньше VIP и т.д.).

### Модель данных: данные отделены от поведения (D-04…D-07)
- **D-04:** Справочник = **чистые данные**: `name`, `description`, entries (`number` точный или Asterisk-паттерн, `vars` key-value, `comment`). **`actions` и `invert` удаляются со справочника.**
- **D-05:** Новая сущность **привязка (binding)**: `route_uid` + `phonebook_uid` + `order` + `match_mode` (`on_match` | `on_no_match` — бывший invert) + `behavior`.
- **D-06:** `behavior` = пресет ИЛИ custom actions: подставить имя (`CALLERID(name)=PB_name`), переопределить номер (`CALLERID(num)`), blacklist (Hangup), whitelist (`on_no_match` + Hangup), redirect (Goto/Dial по `PB_redirect` или фиксированный exten), vars-only (только `PB_*`), custom (`DialplanAppsEditor`).
- **D-07:** **Миграция свободная** — существующих справочников в продакшене нет; структуру БД перерабатываем смело (удаление/изменение полей, любые миграции), legacy-совместимость не нужна. `routes.options.phonebook_uids` заменяется новой моделью привязок.

### UI (D-08…D-10)
- **D-08:** В `RouteFormModal` — **отдельная вкладка «Справочники»**: упорядоченный список привязок (строка = справочник + match_mode + behavior + параметры), кнопки порядка/удаления — паттерн playlist (как MOH).
- **D-09:** Preview сгенерированного dialplan **не нужен**.
- **D-10:** Нужен **демо-тест lookup**: ввод номера → показать, матчится ли и какие `vars`/`PB_*` вернутся (в UI справочника или привязки — на усмотрение plan).

### AI tools (D-11…D-13)
- **D-11:** **Атомарные tools** (webhook + MCP): `list/create/update/delete_phonebook`, `add/remove_phonebook_entries`, `list_phonebook_entries` (on-demand детали). Без сценарных макро-tools — AI комбинирует сам.
- **D-12:** Привязки меняются через **полноценный `update_route`** (новый tool AI-слоя; включает bindings с порядком и behavior), не через узкий bind-tool.
- **D-13:** JSON-schema входов tools — по паттерну существующих 18 MCP tools; **без отдельного metadata-слоя** справочников (не overengineering).

### Платформа Domain AI Adapter (D-14…D-16)
- **D-14:** AI Chat строится как **платформа**, не набор ad-hoc интеграций: aiPBX — универсальный конструктор офисной АТС через генеративные модели. Phase 5 создаёт каркас контракта «модуль → AI» из трёх компонентов: **Tools** (единое описание → webhook + MCP), **State** (`AiStateProvider` — модуль отдаёт summary, `PbxContextBuilder` агрегирует), **Knowledge** (компактный KB-блок на модуль).
- **D-15:** **Phonebooks — референсная реализация** adapter'а. Существующие 5 доменов на новый контракт в этой фазе не переводятся, но каркас обязан поддерживать их без слома.
- **D-16:** LLM-контекст: **summary в snapshot** (имя, описание, кол-во записей, привязки с behavior) + полные entries через on-demand tool; **KB-блок 10–15 строк** (модель данные+привязка+пресеты, правила порядка).

### Dialplan (D-17…D-18)
- **D-17:** **Полная прошивка в этой фазе**: apply маршрута применяет и phonebook-контексты его привязок (AMI `UpdateConfig` + `dialplan reload` — паттерн routes.controller); изменение привязок/behavior/var-ключей → реген затронутых контекстов. Сейчас `generateDialplan()` не вызывается нигде — этот runtime-разрыв закрывается обязательно.
- **D-18:** Благодаря CURL-lookup содержимое справочника (номера, значения vars) читается в runtime; реген dialplan нужен только при изменении набора var-ключей, behavior или привязок.

### Аудит и безопасность AI (D-19…D-20)
- **D-19:** Закрыть gap: **MCP tool-вызовы логируются в `action_logs`** (сейчас логируются только webhook-вызовы).
- **D-20:** **Подтверждения деструктивных AI-операций** (delete_phonebook, update_route и т.п.) — **настраиваемый параметр**. UI настроек: подраздел «AI Chat» в `packages/frontend/src/features/cloud-admin/ui/SellerSettingsForm` (параметры работы с чатом).

### E2E-приёмка (D-21)
- **D-21:** Критерии успеха — диалоги с AI: «создай чёрный список …», «добавь VIP-номера с redirect», «привяжи справочник к маршруту» — все выполняются end-to-end, включая **проверку реальным звонком** (политика срабатывает в dialplan).

### Claude's Discretion
- Формат генерации суб-контекстов: per-binding контекст vs общий контекст справочника + `Gosub` с аргументами.
- Схема таблиц привязок и миграции (полная свобода — legacy нет).
- Точная структура интерфейсов Domain AI Adapter (NestJS DI-паттерн).
- Размещение демо-теста lookup в UI (страница справочника vs привязка).
- Название/размещение настроек AI Chat в SellerSettingsForm (модель хранения параметров).
- Когда именно триггерить реген dialplan (набор событий).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Архитектура (обязательно для всех фаз)
- `packages/frontend/.idea/ARCHITECTURE.md` — FSD, Tailwind + shadcn, SCSS modules, i18n, паттерны страниц/модалок
- `packages/backend/.idea/ARCHITECTURE.md` — NestJS-модули, Sequelize, AMI, guards, tenant isolation
- `.planning/CANONICAL_REFS.md` — общий индекс

### Модульная документация (MUST READ)
- `.docs/PHONEBOOKS_MODULE.md` — текущая модель данных, lookup CURL (pipe-delimited), dialplan `[phonebook_check_*]`, `PB_*` vars, CSV import
- `.docs/AI_CHAT_MODULE.md` — архитектура AI Chat (SSE-прокси → aiPBX), 7 webhook tools `/api/ai-tools/*`, MCP `/api/mcp` (18 tools), audit log, system prompt

### Backend (точки изменения)
- `packages/backend/src/modules/phonebooks/` — `phonebooks.service.ts` (CRUD, lookup, generateDialplan — сейчас не прошит), модели `phonebook.model.ts`, `phonebook-entry.model.ts`
- `packages/backend/src/modules/routes/routes.service.ts` — `generateRouteDialplan` (эмиссия Gosub), `generateContextDialplan`
- `packages/backend/src/modules/routes/routes.controller.ts` — `_applyContextDialplan` (эталон AMI UpdateConfig apply)
- `packages/backend/src/modules/ai-chat/` — `pbx-context-builder.service.ts` (snapshot/prompt), `ai-webhook.controller.ts` (webhook tools + audit)
- `packages/backend/src/modules/mcp/mcp-tools.service.ts` — реестр MCP tools (`registerAll`), паттерн добавления
- `packages/shared/src/types/phonebook.types.ts`, `packages/shared/src/types/route.types.ts` — типы к переработке

### Frontend (точки изменения)
- `packages/frontend/src/features/routes/ui/RouteFormModal/` — модалка маршрута (новая вкладка «Справочники»); эталон табов
- `packages/frontend/src/features/phonebooks/` — UI справочников (`PhonebookFormModal`, `PhonebooksTable`, `PhonebookSelect` — заменяется списком привязок)
- `packages/frontend/src/features/dialplan-apps/` — `DialplanAppsEditor` (custom behavior)
- `packages/frontend/src/features/cloud-admin/ui/SellerSettingsForm/SellerSettingsForm.tsx` — подраздел настроек «AI Chat» (подтверждения и параметры)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `_applyContextDialplan` (routes.controller): готовый паттерн AMI `UpdateConfig` (DelCat → NewCat → Append батчами → reload) — применить для phonebook-контекстов
- `PhonebooksService.lookupNumber` + pattern-matching (Asterisk-паттерны → regex) — ядро lookup остаётся; использовать и для демо-теста в UI
- `AsteriskDialplanUtils.actionToDialplan` — рендер custom actions привязки
- Паттерн MCP `reg(name, schema, handler)` в `mcp-tools.service.ts` — 18 существующих tools как образец
- `loggerService.logAction(…, 'ai_tool', …)` из webhook-пути — перенести в MCP dispatch
- Playlist-редактор MOH (`MohFormModal`) — паттерн упорядоченного списка для вкладки привязок

### Established Patterns
- Tenant isolation: `user_uid` / `vpbx_user_uid` на всех операциях; internal endpoints — `DIALPLAN_API_KEY`
- RTK Query endpoints + invalidatesTags (`routeApi.ts`, `phonebookApi.ts`)
- Модалки: SCSS-модули, одна полоса под табами (эталон RouteFormModal / Phase 3)
- i18n `ru` + `en` для всех новых строк

### Integration Points
- `routes.options.phonebook_uids` → заменяется моделью привязок (миграция свободная, legacy нет)
- `PbxContextBuilderService.buildState()` → рефакторинг на агрегацию `AiStateProvider`
- `AiChatModule` / `McpModule` → импорт `PhonebooksModule`
- aiPBX: регистрация новых tool definitions (ручной шаг по чеклисту AI_CHAT_MODULE.md)

### Known Gaps (закрыть в фазе)
- `PhonebooksService.generateDialplan()` нигде не вызывается — Gosub-цели могут отсутствовать в runtime
- Phonebooks отсутствуют в `PbxStateDto` / `get_pbx_state` / KB
- MCP-вызовы не пишутся в `action_logs`
- В AI-слое нет `update_route` и каких-либо phonebook tools

</code_context>

<specifics>
## Specific Ideas

- «Хотелось бы видеть какой-то универсальный инструмент для гибкой маршрутизации» — match по CallerID → подстановка `CALLERID(name)`, проверка чёрный/белый список, переназначение `CALLERID(num)` и т.д.
- Демо-тест поиска: пользователь вводит номер и видит результат lookup (вместо dialplan preview)
- Настройки AI Chat — по образцу существующего `SellerSettingsForm` (cloud-admin)
- aiPBX = «универсальный конструктор телефонии для офисных АТС с помощью генеративных моделей» — платформенное мышление во всех решениях фазы

</specifics>

<deferred>
## Deferred Ideas

- **Match за пределами CallerID(num)** (DID/входящий exten/trunk) — расширение матчера, отдельная фаза
- **Новые типы справочников beyond phonebook** — после обкатки универсального слоя
- **Рефакторинг существующих 5 AI-доменов** (endpoints/trunks/ivrs/queues/routes) на Domain AI Adapter — следующая фаза; в этой каркас лишь обязан их не ломать

</deferred>

<post_research_decisions>
## Post-Research Decisions (после 05-RESEARCH.md, подтверждены пользователем)

- **D-22 — AMI + DialplanApplyService:** phonebook-контексты применяются через AMI UpdateConfig (подтверждает D-17). Обязательный шаг: извлечь дублированную батч-логику (DelCat→NewCat→Append→reload, скопирована в 4 файлах: `routes.controller`, `ai-webhook.controller`, `mcp-tools.service`, `dialplan-subroutines.service`) в общий инжектируемый `DialplanApplyService`; перевести на него все 4 места + новый phonebooks-apply. FS-writer в этой фазе НЕ делать (интерфейс сервиса — шов на будущее).
- **D-23 — Cross-tenant баг MCP:** фиксим в этой фазе минимальным фиксом для 16 legacy MCP-tools (uid тенанта передаётся параметром вызова, не через closure при первой регистрации). Контракт Domain AI Adapter обязан передавать uid параметром.
- **D-24 — match_mode:** привязка имеет `match_mode: 'on_match' | 'on_no_match'` (поле в `route_phonebook_bindings`, выбирается в UI). `on_no_match` нужен для whitelist-сценариев. При `on_no_match` vars записи недоступны — UI сужает выбор пресетов (скрывает vars-only и «имя из переменной»; доступны: блокировка, редирект, фиксированное имя, custom).
- **D-25 — Настройки подтверждений AI — per-tenant:** НЕ глобальные. Каждый tenant (vpbx_user) сам включает/выключает подтверждения деструктивных AI-операций. **По умолчанию — выключены.** Хранение — per-tenant (не глобальный ключ в `cloud_settings`).
- **D-26 — Поведение привязки в UI:** пресеты = простой селект + 1-2 поля параметров (НЕ DialplanAppsEditor). Пресет `custom` раскрывает переиспользуемый `DialplanAppsEditor` (тот же `IRouteAction[]`, компиляция через `actionToDialplan`). Привязки отрабатывают до основных действий маршрута, в порядке списка.

</post_research_decisions>

---

*Phase: 05-phonebooks-ai-universal-directory-mechanisms-mcp-tools-and-c*
*Context gathered: 2026-07-14, дополнен после research: 2026-07-14*
