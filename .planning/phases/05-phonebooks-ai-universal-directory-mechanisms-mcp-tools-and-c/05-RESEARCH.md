# Phase 5: Phonebooks AI — универсальные справочники, MCP tools, chat-bot — Research

**Researched:** 2026-07-14
**Domain:** Asterisk dialplan generation (AMI), NestJS DI-платформа для AI tools (webhook + MCP), Sequelize data-model rework, React FSD UI
**Confidence:** HIGH (почти все выводы верифицированы чтением кода репозитория)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Справочник = **универсальная CallerID-политика**: match → enrich → act. Единый инструмент для blacklist/whitelist, подстановки `CALLERID(name)`, переназначения `CALLERID(num)`, redirect, обогащения `PB_*` — не отдельные фичи.
- **D-02:** Ключевое требование — **переиспользование**: один справочник (данные) → много применений с разным поведением на разных маршрутах.
- **D-03:** Маршрут подключает **упорядоченную цепочку политик** перед основными actions (blacklist раньше VIP и т.д.).
- **D-04:** Справочник = **чистые данные**: `name`, `description`, entries (`number` точный или Asterisk-паттерн, `vars` key-value, `comment`). **`actions` и `invert` удаляются со справочника.**
- **D-05:** Новая сущность **привязка (binding)**: `route_uid` + `phonebook_uid` + `order` + `match_mode` (`on_match` | `on_no_match` — бывший invert) + `behavior`.
- **D-06:** `behavior` = пресет ИЛИ custom actions: подставить имя (`CALLERID(name)=PB_name`), переопределить номер (`CALLERID(num)`), blacklist (Hangup), whitelist (`on_no_match` + Hangup), redirect (Goto/Dial по `PB_redirect` или фиксированный exten), vars-only (только `PB_*`), custom (`DialplanAppsEditor`).
- **D-07:** **Миграция свободная** — существующих справочников в продакшене нет; структуру БД перерабатываем смело, legacy-совместимость не нужна. `routes.options.phonebook_uids` заменяется новой моделью привязок.
- **D-08:** В `RouteFormModal` — **отдельная вкладка «Справочники»**: упорядоченный список привязок, кнопки порядка/удаления — паттерн playlist (как MOH).
- **D-09:** Preview сгенерированного dialplan **не нужен**.
- **D-10:** Нужен **демо-тест lookup**: ввод номера → показать, матчится ли и какие `vars`/`PB_*` вернутся (в UI справочника или привязки — на усмотрение plan).
- **D-11:** **Атомарные tools** (webhook + MCP): `list/create/update/delete_phonebook`, `add/remove_phonebook_entries`, `list_phonebook_entries`. Без сценарных макро-tools.
- **D-12:** Привязки меняются через **полноценный `update_route`** (новый tool AI-слоя; включает bindings с порядком и behavior).
- **D-13:** JSON-schema входов tools — по паттерну существующих 18 MCP tools; **без отдельного metadata-слоя** справочников.
- **D-14:** AI Chat строится как **платформа**. Phase 5 создаёт каркас контракта «модуль → AI» из трёх компонентов: **Tools** (единое описание → webhook + MCP), **State** (`AiStateProvider` — модуль отдаёт summary, `PbxContextBuilder` агрегирует), **Knowledge** (компактный KB-блок на модуль).
- **D-15:** **Phonebooks — референсная реализация** adapter'а. Существующие 5 доменов на новый контракт в этой фазе не переводятся, но каркас обязан поддерживать их без слома.
- **D-16:** LLM-контекст: **summary в snapshot** (имя, описание, кол-во записей, привязки с behavior) + полные entries через on-demand tool; **KB-блок 10–15 строк**.
- **D-17:** **Полная прошивка в этой фазе**: apply маршрута применяет и phonebook-контексты его привязок (AMI `UpdateConfig` + `dialplan reload` — паттерн routes.controller); изменение привязок/behavior/var-ключей → реген затронутых контекстов. Runtime-разрыв (`generateDialplan()` нигде не вызывается) закрывается обязательно.
- **D-18:** Благодаря CURL-lookup содержимое справочника читается в runtime; реген dialplan нужен только при изменении набора var-ключей, behavior или привязок.
- **D-19:** Закрыть gap: **MCP tool-вызовы логируются в `action_logs`**.
- **D-20:** **Подтверждения деструктивных AI-операций** — **настраиваемый параметр**. UI настроек: подраздел «AI Chat» в `SellerSettingsForm` (cloud-admin).
- **D-21:** Критерии успеха — диалоги с AI («создай чёрный список…», «добавь VIP-номера с redirect», «привяжи справочник к маршруту») выполняются end-to-end, включая **проверку реальным звонком**.

### Claude's Discretion

- Формат генерации суб-контекстов: per-binding контекст vs общий контекст справочника + `Gosub` с аргументами.
- Схема таблиц привязок и миграции (полная свобода — legacy нет).
- Точная структура интерфейсов Domain AI Adapter (NestJS DI-паттерн).
- Размещение демо-теста lookup в UI (страница справочника vs привязка).
- Название/размещение настроек AI Chat в SellerSettingsForm (модель хранения параметров).
- Когда именно триггерить реген dialplan (набор событий).

### Deferred Ideas (OUT OF SCOPE)

- **Match за пределами CallerID(num)** (DID/входящий exten/trunk) — отдельная фаза.
- **Новые типы справочников beyond phonebook** — после обкатки универсального слоя.
- **Рефакторинг существующих 5 AI-доменов** (endpoints/trunks/ivrs/queues/routes) на Domain AI Adapter — следующая фаза; в этой каркас лишь обязан их не ломать.
</user_constraints>

## Summary

Фаза перерабатывает phonebooks из «данные + поведение в одном» в «чистые данные + привязки с поведением», прошивает dialplan end-to-end и строит каркас Domain AI Adapter с phonebooks как референсом. Вся необходимая инфраструктура уже есть в кодовой базе: CURL-lookup (`PhonebooksService.lookupNumber` + `phonebook-lookup.controller`), рендер actions (`AsteriskDialplanUtils.actionToDialplan`), AMI-apply паттерн (`routes.controller._applyContextDialplan` — продублирован в 4 местах!), MCP-реестр (`McpToolsService.reg()`), audit (`LoggerService.logAction`), key-value настройки (`CloudSettingsService` / таблица `cloud_settings`), playlist-UI (`MohFormModal`). Новых npm-пакетов **не требуется** — фаза целиком собирается из существующего стека.

Два главных архитектурных вывода исследования: (1) **AMI UpdateConfig остаётся транспортом применения dialplan** (соответствует locked D-17), но батч-логику обязательно выделить в общий `DialplanApplyService` — сейчас она скопирована в 4 файлах, и phonebooks стал бы 5-й копией; интерфейс сервиса заодно образует шов для будущего FS-writer. (2) В `McpToolsService` найден **реальный cross-tenant баг**: реестр tools — синглтон-Map, где `uid` тенанта замкнут в closure хэндлеров, а перерегистрация происходит только при пустом реестре — контракт Domain AI Adapter обязан передавать `uid` параметром вызова, а не замыканием, и Phase 5 — правильный момент починить диспетчеризацию.

**Primary recommendation:** per-binding суб-контексты `pb_bind_{bindingUid}_{vpbx}` (Gosub из маршрута по порядку `position`), новая таблица `route_phonebook_bindings`, общий `DialplanApplyService` поверх AMI UpdateConfig, `AiAdapterRegistryService` c handler-сигнатурой `(args, uid)`, аудит MCP в единой точке `callTool`, настройки подтверждений в `cloud_settings` (ключи `ai_chat.*`).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| CRUD справочников/записей/привязок | API / Backend (NestJS) | DB (MySQL) | tenant isolation через JWT, Sequelize-модели |
| Runtime match/enrich при звонке | Asterisk dialplan (CURL) | Backend internal endpoint | D-18: значения vars читаются в runtime через `phonebook-lookup` |
| Генерация и применение dialplan | Backend | Asterisk (AMI UpdateConfig + reload) | D-17; паттерн routes.controller |
| AI tools (webhook + MCP) | Backend (ai-chat / mcp модули) | aiPBX (внешний LLM-сервер) | tool definitions регистрируются в aiPBX вручную (чеклист AI_CHAT_MODULE.md) |
| Snapshot/KB для LLM | Backend (`PbxContextBuilderService`, `KnowledgeBaseService`) | — | system prompt собирается на бэкенде при каждом сообщении |
| Вкладка «Справочники», демо-lookup, настройки AI | Frontend (React FSD) | Backend API | RTK Query, без параметров тенантности в запросах |
| Audit log | Backend (`LoggerService` → `action_logs`) | — | единая таблица, паттерн `ai_tool` |

## Validation Architecture

> `workflow.nyquist_validation` в `.planning/config.json` отсутствует → секция обязательна.

### Test Framework

| Property | Value |
|----------|-------|
| Backend | Jest 29.7 (`packages/backend`, config в package.json, spec-файлы рядом с модулями) |
| Frontend | Vitest 4.1 (`packages/frontend`) |
| Quick run (backend) | `npx jest phonebooks --silent` из `packages/backend` |
| Full suite | `npm run lint && npm run test:backend && npm run test:frontend` (из корня; обязательный verify по AGENTS.md) |
| E2E | Playwright в `e2e/` (есть `operator-happy-path.spec.ts`) — опционально |

### Phase Requirements → Test Map

REQ-ID для Phase 5 в `.planning/REQUIREMENTS.md` не заведены (файл заканчивается Phase 4). Мапим на решения CONTEXT.md:

| Decision | Behavior | Test Type | Automated Command | File Exists? |
|----------|----------|-----------|-------------------|-------------|
| D-04/D-05 | модель binding, каскады, tenant filter | unit (service) | `npx jest phonebooks -t binding` | ❌ Wave 0 (расширить `phonebooks.service.spec.ts`) |
| D-06 | пресеты behavior → корректные dialplan-строки | unit | `npx jest phonebooks -t generate` | ✅ база есть — `phonebooks.service.spec.ts` (describe `generateDialplan`) |
| D-17 | route apply включает phonebook-контексты | unit (mock AmiService) | `npx jest dialplan-apply` | ❌ Wave 0 |
| D-11/D-12 | tool-хэндлеры: CRUD phonebook, update_route c bindings | unit | `npx jest mcp-tools` / `ai-` | ❌ Wave 0 |
| D-19 | MCP-вызов пишет action_logs | unit (mock LoggerService) | `npx jest mcp` | ❌ Wave 0 |
| D-10 | lookup-test endpoint: tenant check + результат | unit | `npx jest phonebooks -t lookup` | ✅ база — describe `lookupNumber` |
| D-08 | вкладка «Справочники»: slice/интеграционный тест UI | vitest | `npm run test:frontend` | ❌ Wave 0 (требование ARCHITECTURE.md: интеграционные тесты для новых feature-компонентов) |
| D-21 | E2E диалог AI + реальный звонок | **manual-only** | — | чек-лист UAT; автоматизировать нельзя (нужен живой Asterisk + LLM) |

### Sampling Rate

- **Per task commit:** `npx jest <module> --silent` (затронутый модуль)
- **Per wave merge:** `npm run test:backend && npm run test:frontend`
- **Phase gate:** `npm run lint && npm run test:backend && npm run test:frontend` зелёные + ручной E2E (D-21)

### Wave 0 Gaps

- [ ] `phonebooks.service.spec.ts` — новые describe для binding-модели и per-binding генерации (переписать старые тесты `invert`/`actions` — поля удаляются)
- [ ] spec для нового `DialplanApplyService` (mock `AmiService.action`)
- [ ] spec для `AiAdapterRegistryService` + phonebook tool-хэндлеров
- [ ] frontend: тесты slice/компонента вкладки привязок

## 1. Форма dialplan для per-binding behavior

### Что есть сейчас

- `PhonebooksService.generateDialplan()` (`packages/backend/src/modules/phonebooks/phonebooks.service.ts:468`) строит `[phonebook_check_{uid}_{vpbx}]`: CURL-lookup → `PB_MATCH` → ветка match/nomatch (учитывает `invert`) → `Set(PB_<key>=${CUT(PB_RAW,|,N)})` для union всех var-ключей → actions справочника → `Return()`. **Нигде не вызывается** (только spec) — runtime-разрыв, который закрывает D-17.
- `RoutesService.generateRouteDialplan()` (`routes.service.ts:177-182`) эмитит `Gosub(phonebook_check_{pbUid}_{vpbx},s,1)` по `options.phonebook_uids` — этот блок заменяется на эмиссию по bindings.
- Рендер произвольных actions уже готов: `AsteriskDialplanUtils.actionToDialplan(action, vpbxUserUid, isAdmin)` (`shared/utils/dialplan.util.ts`).

### Сравнение вариантов (Claude's Discretion)

| Критерий | A: per-binding контекст `pb_bind_{bindingUid}_{vpbx}` | B: общий `phonebook_check_{pbUid}` + Gosub(ARG) | C: lookup-контекст общий + behavior инлайн в маршруте |
|---|---|---|---|
| Передача behavior | вшита при генерации | ❌ ARG-и Gosub — скаляры, произвольный action-список через них не передать | инлайн-строки в контексте маршрута |
| Labels/ветвление | локальны для контекста — чисто | — | ❌ label-коллизии при нескольких привязках в одном exten, нужны уникальные суффиксы |
| Реген при изменении binding | 1 категория в 1 файле | — | весь контекст маршрута (он и так регенерится при apply) |
| Знание контекста маршрута (для redirect) | ✅ можно вшить (binding знает route) | ❌ | ✅ |
| Простота кода | самая высокая (эволюция текущего `generateDialplan`) | низкая | средняя, но грязные labels |

**Рекомендация: вариант A — per-binding суб-контекст.** Gosub с ARG отпадает принципиально: behavior — это список произвольных dialplan-приложений, его нельзя параметризовать аргументами. Инлайн в маршруте (C) ломается на labels и раздувает контекст маршрута.

### Рекомендуемая форма (шаблон)

```ini
; файл: krasterisk/phonebooks/pb_{vpbx}.conf  (категория = контекст привязки)
[pb_bind_{bindingUid}_{vpbx}]
exten => s,1,NoOp(PB binding {bindingUid}: {phonebook.name} / {behaviorType})
same => n,Set(PB_RAW=${CURL(<base>/internal/dialplan/phonebook-lookup?phonebook_uid={pbUid}&api_key=...&number=${URIENCODE(${CALLERID(num)})})})
same => n,GotoIf($["${PB_RAW}" = ""]?nomatch)          ; backend недоступен → пропуск
same => n,Set(PB_MATCH=${CUT(PB_RAW,|,1)})
; match_mode=on_match  → act при PB_MATCH=1;  on_no_match → act при PB_MATCH=0
same => n,GotoIf($["${PB_MATCH}" = "1"]?{act|nomatch}:{nomatch|act})
same => n(act),NoOp(PB {name}: acting)
same => n,Set(PB_name=${CUT(PB_RAW,|,3)})               ; union var-ключей, только при on_match
; --- behavior lines (пресет или custom actions) ---
same => n,Return()
same => n(nomatch),Return()
```

Из маршрута (`generateRouteDialplan`, вместо блока `phonebook_uids`):

```ini
same => n,Gosub(pb_bind_{bindingUid}_{vpbx},s,1)   ; по одной строке на binding, order = position ASC
```

Важно: при `match_mode=on_no_match` строки `Set(PB_<key>=…)` эмитить **не нужно** (совпадения нет — CUT вернёт пустое/чужое). Разбор `PB_RAW` ставится только в ветку фактического совпадения.

### Пресеты behavior → dialplan-строки

| Preset | Params (JSON `behavior_params`) | Строки в ветке `act` |
|---|---|---|
| `set_name` | `var_key` (default `name`) | `ExecIf($["${PB_name}" != ""]?Set(CALLERID(name)=${PB_name}))` |
| `set_number` | `var_key` (default `clid`) ИЛИ `fixed` | `ExecIf($["${PB_clid}" != ""]?Set(CALLERID(num)=${PB_clid}))` или `Set(CALLERID(num)=<fixed>)` |
| `blacklist` | — | `Hangup()` |
| `whitelist` | — | UI принудительно ставит `match_mode=on_no_match`; строка — `Hangup()` |
| `redirect` | `var_key` (default `redirect`) ИЛИ `fixed_exten`; `target_context` (default = tenanted-контекст маршрута, известен при генерации) | `ExecIf($["${PB_redirect}" != ""]?Goto({ctx},${PB_redirect},1))` или `Goto({ctx},<fixed>,1)` |
| `vars_only` | — | (пусто — vars уже установлены) |
| `custom` | — (`actions` JSON колонки binding) | `AsteriskDialplanUtils.actionToDialplan(a, vpbx, isAdmin)` на каждый action |

Все фиксированные параметры прогонять через `AsteriskDialplanUtils.sanitizeDialplanInput`. Redirect через `Goto` — консистентно с action `toroute` (`Goto(${ctx}${vpbx},${dest},1)`, dialplan.util.ts:208). Семантика цепочки сохраняется как в `.docs/PHONEBOOKS_MODULE.md`: `Hangup`/`Goto` прерывают каскад, `Set` — последний выигрывает.

### Размещение в файлах и реген

- Файл: `krasterisk/phonebooks/pb_{vpbx}.conf` — один на тенанта, категория на binding. Путь обязан быть **двухуровневым** — `extensions.conf` включает по glob `#include krasterisk/*/*.conf` (см. комментарий в `dialplan-subroutines.service.ts:24-28`).
- Реген-триггеры (Claude's Discretion, рекомендация): (1) apply контекста маршрута (D-17 — вместе с контекстами применяются binding-контексты всех его маршрутов); (2) CRUD binding (create/update/delete/reorder — через re-apply контекста маршрута); (3) update/import справочника, если **изменился union var-ключей** (сравнить `collectAllVarKeys` до/после — D-18) → re-apply всех routes с привязками этого справочника; (4) delete справочника → re-apply затронутых маршрутов + DelCat осиротевших категорий.

## 2. КРИТИЧЕСКИЙ ВОПРОС: AMI UpdateConfig vs прямая запись в ФС

### Проверенные факты из кодовой базы

1. **AMI UpdateConfig-паттерн скопирован в 4 местах** (DelCat → NewCat → Append батчами по 20 → `dialplan reload`): `routes.controller.ts:66-166` (`_applyContextDialplan`), `ai-webhook.controller.ts:214-299`, `mcp-tools.service.ts:334-368`, `dialplan-subroutines.service.ts:46-138`. Phonebooks стал бы 5-й копией. [VERIFIED: codebase grep]
2. **Backend УЖЕ пишет медиа-файлы для Asterisk через fs**: `prompts.service.ts` (`fs.writeFile` в `records_base_path`, default `/usr/records`), `ivr-tts-cache.service.ts` («deployment must mount cache for Asterisk»), MixMonitor/ffmpeg-пути в `generateRouteDialplan`. То есть **для медиа-функций общий FS backend↔Asterisk уже является требованием деплоймента**. [VERIFIED: codebase]
3. Но: медиа-функции **деградируют мягко** (нет промптов/записей — АТС звонит), а dialplan — ядро. `AMI_HOST` конфигурируем (`.env.example`: «Must match manager.conf on your Asterisk server»), `DIALPLAN_BACKEND_URL` явно документирует сценарий «Remote host». Базовая маршрутизация с удалённым Asterisk сегодня работает **без единого FS-предположения**. [VERIFIED: .env.example, ami.service.ts]
4. Деплой — PM2 на Linux (`ecosystem.config.js`, `/opt/krasterisk_v4`), docker-compose в репо нет. Дефолты (`AMI_HOST=127.0.0.1`, `DIALPLAN_BACKEND_URL=http://127.0.0.1:5010/api`) — same-host. [VERIFIED: ecosystem.config.js, .env.example]
5. `dialplan reload` в любом варианте выполняется через AMI (`amiService.command`). [VERIFIED: codebase]
6. Объём phonebook-контекста мал: ~10 строк заголовка + 1 строка на var-ключ + 1-5 строк behavior ≈ **15–40 строк на binding** → 1–2 AMI-батча. Проблема размера, актуальная для больших route-контекстов, здесь почти не проявляется. [VERIFIED: расчёт по шаблону выше]

### Сравнительная таблица

| Критерий | AMI UpdateConfig (текущий) | Прямая запись FS (temp+rename) | Гибрид (DialplanWriter interface, выбор по env) |
|---|---|---|---|
| Удалённый Asterisk (ценно для пользователя) | ✅ работает out-of-the-box | ❌ нужен shared mount (NFS/SSHFS) или same-host | ✅ (AMI-режим) |
| Атомарность | ❌ DelCat→NewCat→N×Append; сбой в середине = полузаписанный контекст до следующего apply | ✅ write tmp + rename | зависит от режима |
| Скорость | ~N/20 запросов; для phonebook-контекстов — 2-4 запроса, незаметно | мгновенно | — |
| Точность контента | ❌ комментарии/пустые строки выкидываются; Var/Value-эвристика (`=>` split) | ✅ байт-в-байт, легко diff'ить | — |
| Права/деплой | ✅ ничего нового | ❌ нужны права записи в /etc/asterisk/... для node-процесса, новый env | ❌ два пути тестирования |
| Соответствие locked D-17 | ✅ прямо предписан | ❌ противоречит | частично |
| Проверенность в проде | ✅ 4 модуля живут на этом | ❌ ноль использований для конфигов | — |

### Рекомендация (экспертная)

**Остаться на AMI UpdateConfig в Phase 5** — это и locked decision (D-17 явно фиксирует «AMI UpdateConfig + dialplan reload — паттерн routes.controller»), и рационально: контексты phonebooks маленькие, паттерн проверен, деплой не меняется, сценарий «панель управляет удалённым Asterisk» сохраняется в чистом виде.

**Обязательный сопутствующий шаг:** выделить дублированную логику в общий инжектируемый сервис — например `DialplanApplyService` в модуле `ami` (или новый `dialplan` shared-модуль) с методом вида `applyCategories(filename, categories: {name, lines[]}[], {reload})`, и перевести на него `routes.controller`, `ai-webhook.controller`, `mcp-tools.service` и новый phonebooks-apply. Это (а) убирает 4-кратную копипасту, (б) даёт одну точку для error handling/логирования, (в) образует **шов**: будущий FS-writer добавляется как альтернативная реализация за env-флагом, не трогая вызывающих. Полноценный `DialplanWriter`-интерфейс с FS-реализацией в этой фазе **не делать** (YAGNI: ни одного запроса на такой деплой, D-17 не требует).

**Decision proposal для пользователя:** «Phase 5 применяет phonebook-контексты через AMI UpdateConfig (как маршруты), но батч-код выделяется в единый DialplanApplyService. Прямую запись в ФС не внедряем: медиа-файлы и так требуют общего диска, но dialplan-ядро остаётся работоспособным с удалённым Asterisk чисто по AMI; FS-writer можно добавить позже как реализацию того же интерфейса, если появится same-host-инсталляция с очень большими контекстами». Замечание для честности: аргумент «remote Asterisk» частично ослаблен тем, что prompts/записи уже пишутся через fs, — но именно *частично*: без общего диска теряются только медиа-фичи, а не маршрутизация.

## 3. Модель данных привязок

### Как управляется схема БД в этом репо

Миграционного фреймворка нет: `app.module.ts` — `synchronize: false` («never auto-sync»), есть два паттерна: (1) standalone-скрипты `migrate-*.ts` в `cloud-admin` (raw `Sequelize` + `QueryInterface.createTable(..., { ifNotExists: true })` + `addIndex` в try/catch, запуск через ts-node) — [VERIFIED: `cloud-admin/migrate-phase2.ts`]; (2) ad-hoc `src/sync.ts` c `Model.sync({ alter: true })` (содержит хардкод-креды — как образец НЕ брать). **Рекомендация: паттерн (1)** — `packages/backend/src/modules/phonebooks/migrate-phonebooks-phase5.ts`, читает `.env` через dotenv.

### DDL (рекомендация)

```sql
CREATE TABLE route_phonebook_bindings (
  uid INT AUTO_INCREMENT PRIMARY KEY,
  route_uid INT NOT NULL,
  phonebook_uid INT NOT NULL,
  position INT NOT NULL DEFAULT 0,
  match_mode VARCHAR(16) NOT NULL DEFAULT 'on_match',   -- 'on_match' | 'on_no_match'
  behavior_type VARCHAR(32) NOT NULL DEFAULT 'vars_only', -- set_name|set_number|blacklist|whitelist|redirect|vars_only|custom
  behavior_params JSON DEFAULT NULL,                    -- {var_key?, fixed?, fixed_exten?, target_context?}
  actions JSON DEFAULT NULL,                            -- IRouteAction[] при behavior_type='custom'
  user_uid INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_pb_bind_route (route_uid),
  INDEX idx_pb_bind_pb (phonebook_uid),
  INDEX idx_user_uid (user_uid),                        -- обязателен по чек-листу ARCHITECTURE.md
  CONSTRAINT fk_pbb_route FOREIGN KEY (route_uid) REFERENCES routes(uid) ON DELETE CASCADE,
  CONSTRAINT fk_pbb_pb FOREIGN KEY (phonebook_uid) REFERENCES route_phonebooks(uid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

Обоснования: `position` — как MOH (`musiconhold_entry` composite (name, position)) и `routes.priority` (reorder-паттерн `routes.service.reorder`); `user_uid` дублируется на binding намеренно (canonical чек-лист тенантности + прямые запросы без JOIN); FK CASCADE в обе стороны + **сервисный** хук: перед destroy справочника собрать затронутые route_uid и re-apply их контексты (иначе в dialplan останутся Gosub на удалённые контексты).

Изменения существующих таблиц (D-07, миграция свободная): `ALTER TABLE route_phonebooks DROP COLUMN invert, DROP COLUMN actions;` — и удалить их из `phonebook.model.ts`, `ICreatePhonebookDto`, `IRoutePhonebook` (`packages/shared/src/types/phonebook.types.ts`), UI. `routes.options.phonebook_uids` — удалить из `IRouteOptions` (`route.types.ts:181`) и из `generateRouteDialplan`; данные в JSON чистить не обязательно (ключ просто перестаёт читаться), но скрипт миграции может его вычищать для чистоты.

Sequelize-модель — по образцу `phonebook-entry.model.ts` (`@Table({ tableName: 'route_phonebook_bindings', timestamps: false — либо timestamps: true, underscored })`, `@ForeignKey(() => Route)`, `@BelongsTo`, `@HasMany` на Route/RoutePhonebook). API маршрута: включать `bindings` в GET-ответы (include association с order position ASC) и принимать массив bindings в create/update (replace-all стратегия, как entries в `PhonebooksService.update`).

⚠️ `routes.controller` использует `ValidationPipe({ whitelist: true })` с `CreateRouteDto/UpdateRouteDto` — новое поле `bindings` обязано быть описано в DTO, иначе будет молча вырезано из body.

## 4. Каркас Domain AI Adapter

### Найденный контракт текущего AI-слоя

- **MCP**: `McpToolsService.reg(name, description, inputSchema /* плоский объект JSON-schema properties */, handler)` → Map; `McpSessionService.dispatch` вызывает `getToolsList(uid)` / `callTool(name, args, uid)` (stateless JSON-RPC, без SDK-сессий). [VERIFIED: mcp-tools.service.ts, mcp-session.service.ts]
- **Webhook**: `AiWebhookController` — отдельный endpoint на tool, `JwtOrServiceTokenGuard`, аудит вручную в каждом методе. [VERIFIED: ai-webhook.controller.ts]
- **State**: `PbxContextBuilderService.buildState()` — Promise.all по 5 сервисам, `buildSystemPrompt(state)` — конкатенация строк. [VERIFIED]
- **Knowledge**: `KnowledgeBaseService` — хардкод `buildOperatorKnowledge()` (в нём про Phonebooks сейчас **устаревшие 2 строки** — «база контактов, поиск по имени») + digest из `.docs`. [VERIFIED: knowledge-base.service.ts:112-114]

### 🔴 Найденный cross-tenant баг (обязан быть учтён каркасом)

`McpToolsService.toolRegistry` — **синглтон-Map**; `registerAll(_, uid)` замыкает `uid` в хэндлеры, но вызывается из `getToolsList`/`callTool` только **если Map пуст** (`if (this.toolRegistry.size === 0)`). После первого запроса тенанта A все последующие вызовы тенанта B исполняют closures с `uid`-ом A. [VERIFIED: mcp-tools.service.ts:73-95]. Вывод для каркаса: **handler-сигнатура нового контракта — `(args, uid) => …`, uid передаётся при вызове**, реестр общий и uid-независимый. Починку диспетчеризации логично включить в фазу (переопределить `callTool` так, чтобы uid шёл в handler параметром; существующие 5 доменов можно адаптировать тонкой обёрткой без переписывания — либо признать их перевод отдельной фазой и как минимум задокументировать/закрыть баг re-register-ом на каждый вызов).

### Рекомендуемая структура (минимальная, NestJS DI)

```typescript
// packages/backend/src/modules/ai-platform/ (новый лёгкий модуль без зависимостей на домены)
export interface AiToolDefinition {
  name: string;                                  // snake_case
  description: string;                           // по паттерну 18 существующих tools (D-13)
  inputSchema: Record<string, any>;              // плоские JSON-schema properties, как в reg()
  entityType: string;                            // для action_logs (D-19), напр. 'phonebook'|'route'
  destructive?: boolean;                         // для confirmation-gate (D-20)
  handler: (args: Record<string, any>, vpbxUserUid: number) => Promise<string | object>;
}

export interface AiStateProvider {
  domain: string;                                                  // 'phonebooks'
  buildSummary(vpbxUserUid: number): Promise<string>;              // блок текста в system prompt
}

export interface DomainAiAdapter {
  domain: string;
  getTools(): AiToolDefinition[];
  getStateProvider?(): AiStateProvider;
  getKnowledgeBlock?(): string;                                    // 10-15 строк (D-16)
}

@Injectable() export class AiAdapterRegistryService {
  private adapters = new Map<string, DomainAiAdapter>();
  register(a: DomainAiAdapter): void { this.adapters.set(a.domain, a); }
  getAllTools(): AiToolDefinition[] { /* flatMap */ }
  getStateProviders(): AiStateProvider[] { … }
  getKnowledgeBlocks(): string[] { … }
}
```

Регистрация — **явная, через `OnModuleInit`** в `PhonebooksModule`: `PhonebooksAiAdapter implements DomainAiAdapter, OnModuleInit { onModuleInit() { this.registry.register(this); } }`. Это проще и предсказуемее, чем DiscoveryService-сканирование декораторов, и не требует новых пакетов. `AiPlatformModule` объявить `@Global()` (или экспортировать и импортировать в phonebooks/ai-chat/mcp) — циклических зависимостей нет, т.к. платформа не знает о доменах.

Точки интеграции (существующие 5 доменов не трогаются):
- `McpToolsService.registerAll()` — в конце добавить `for (const t of registry.getAllTools()) this.reg(t.name, t.description, t.inputSchema, (args) => t.handler(args, uid))` (+ аудит, см. §5).
- `AiWebhookController` — один generic endpoint `POST /api/ai-tools/call/:toolName` (guard тот же `JwtOrServiceTokenGuard`), диспетчеризующий в registry; существующие 7 endpoints не меняются. В aiPBX новые webhook-tools регистрируются на этот URL (ручной шаг чеклиста).
- `PbxContextBuilderService.buildSystemPrompt()` — после блока «ТЕКУЩЕЕ СОСТОЯНИЕ АТС» вставить `for (const p of registry.getStateProviders()) … await p.buildSummary(uid)`.
- `KnowledgeBaseService.getDigest()` → конкатенация с `registry.getKnowledgeBlocks()` (и поправить устаревшие строки про Phonebooks в operatorKnowledge).

## 5. AI tools: схемы, apply, аудит, подтверждения

### Набор tools и JSON-схемы (стиль = существующие 18: плоский объект properties)

| Tool | inputSchema (ключевое) | Handler → сервис |
|---|---|---|
| `list_phonebooks` | `{}` | `phonebooksService.findAll(uid)` → компакт: uid, name, description, entriesCount, bindings summary |
| `create_phonebook` | `name` (string, req), `description`, `entries: {type:'array', description:'[{number, comment?, vars?}]'}` | `create(dto, uid)` |
| `update_phonebook` | `uid` (number), `name?`, `description?`, `entries?` (replace-all) | `update(uid, dto, userUid)` + реген при смене var-key-set |
| `delete_phonebook` | `uid` | destroy + re-apply затронутых маршрутов; `destructive: true` |
| `add_phonebook_entries` | `uid`, `entries[]` | bulkCreate (инкрементально, НЕ replace) + реген при новых var-ключах |
| `remove_phonebook_entries` | `uid`, `numbers: string[]` (или `entry_uids`) | destroy where; `destructive: true` |
| `list_phonebook_entries` | `uid`, `limit?`, `search?` | on-demand детали (D-16) |
| `update_route` | `uid` (number, req), `name?`, `extensions?: string[]`, `actions?: array`, `options?: object`, `active?`, `bindings?: {type:'array', description:'[{phonebook_uid, position, match_mode: on_match|on_no_match, behavior_type, behavior_params?, actions?}]'}` | `routesService.update` + синхронизация bindings + **re-apply** |

`update_route` и триггер apply: хэндлер после сохранения вызывает общий `DialplanApplyService.applyContext(route.context_uid, uid)` — который по D-17 применяет и binding-контексты маршрутов этого контекста (то же поведение, что `routes.controller.update` делает сегодня через `_applyContextDialplan`). Отдельный `apply_dialplan`-tool уже существует и остаётся.

### Аудит MCP (D-19)

Единая точка — `McpToolsService.callTool()` (через неё идут ВСЕ MCP-вызовы, см. `mcp-session.service.ts:84`). После успешного/неуспешного handler: `this.loggerService.logAction(0, 'ai_tool', entityType, entityId ?? null, uid, "mcp:{name}: {краткие args}", status).catch(() => {})` — зеркало паттерна webhook-пути (`ai-webhook.controller.ts:100-104`: fire-and-forget промис, не блокирует ответ). `entityType` брать из `AiToolDefinition.entityType`, для legacy-tools — статическая мапа имя→entity. `McpModule` потребуется импорт `LoggerModule`.

### Подтверждения деструктивных операций (D-20)

Хранение (Claude's Discretion): **`cloud_settings`** через существующий `CloudSettingsService.get/set` — key-value паттерн как `billing.seller.*` (`cloud-admin/cloud-settings.service.ts`). Ключи: `ai_chat.confirm_destructive` ('1'/'0', default '1'), опционально `ai_chat.confirm_tools` (csv-перечень). Это глобальные настройки инсталляции — консистентно с размещением UI в SellerSettingsForm (cloud-admin, D-20).

Механизм — **двухфазный на уровне tool** (детерминированный, не зависит от дисциплины LLM): деструктивные tools получают опциональный параметр `confirm: {type:'boolean'}`; если настройка включена и `confirm !== true`, handler возвращает текст «⚠️ Требуется подтверждение: будет удалён справочник "X" (N записей, привязан к маршрутам Y). Повтори вызов с confirm=true после согласия пользователя». Дополнительно `PbxContextBuilderService.buildSystemPrompt` вставляет правило «деструктивные операции — только после явного согласия пользователя» при включённой настройке. UI: в `SellerSettingsForm.tsx` добавить секцию/Card «AI Chat» (паттерн секций уже в файле), endpoints в `cloudAdminApi.ts` + `cloud-settings.controller.ts`.

## 6. Frontend

### Вкладка «Справочники» в RouteFormModal

- `RouteFormModal.tsx`: `const TABS = ['general', 'actions', 'webhooks']` → добавить `'phonebooks'`; таб-бар уже соответствует «interim Tailwind» эталону (ARCHITECTURE.md, Вариант B) — новый таб ничего не меняет в разметке. Новый компонент `RoutePhonebooksTab.tsx` рядом с `RouteGeneralTab.tsx`.
- Паттерн упорядоченного списка — **`MohFormModal.tsx`**: локальный `useState` массива, `handleMoveUp/handleMoveDown` (swap по индексу), `handleRemoveTrack`, кнопки `ChevronUp/ChevronDown/Trash2` (lucide), Select+кнопка Plus для добавления. Позиции проставляются индексом при сохранении.
- Строка привязки: Select справочника (данные из `useGetPhonebooksQuery` в `phonebookApi.ts`) + Select `match_mode` + Select пресета behavior + условные параметры (var_key input / fixed exten input) + для `custom` — существующий `DialplanAppsEditor` (`features/dialplan-apps`, уже используется в `RouteActionsTab`) в раскрывашке.
- Из `RouteGeneralTab` удалить `PhonebookSelect` (multi-select по `options.phonebook_uids`) — заменяется вкладкой. `phonebookUids` state и его отправка в options удаляются из `RouteFormModal.handleSave`; вместо этого `bindings` включаются в payload create/update.
- RTK Query: `routeApi.ts` — тэги уже есть; убедиться, что update route инвалидирует и phonebook-теги при необходимости (bindings приходят в составе route).
- Стили: новые компоненты — SCSS-модули с `var(--color-*)` (Tailwind в features запрещён), `<VStack>/<HStack>`, компоненты только из `@/shared/ui`. Без em dash и эмодзи в строках. i18n `ru.ts` + `en.ts` (namespace `routes.phonebooks.*` / `phonebooks.*`).

### Демо-тест lookup (D-10)

Существующий internal endpoint (`/api/internal/dialplan/phonebook-lookup`) не подходит для UI: авторизация — `DIALPLAN_API_KEY` query-параметром, **и он не проверяет тенанта** (см. Pitfalls). Нужен новый JWT-endpoint в `phonebooks.controller.ts`: `POST /api/phonebooks/:id/lookup-test { number }` → `findOne(uid, userUid)` (проверка владения) → `lookupNumber(uid, number)` → распарсить pipe-строку в `{ matched: boolean, vars: Record<string,string> }` для UI. Размещение UI (Claude's Discretion): **в PhonebookFormModal** (вкладка «Номера» — поле «Проверить номер» с кнопкой и результатом: matched-бейдж + таблица `PB_*`), т.к. тест логически относится к данным справочника, а не к каждой привязке; на вкладке привязок он дублировался бы N раз.

### SellerSettingsForm

`SellerSettingsForm.tsx` — карточная форма (Card/CardHeader/CardContent, поля через `set(field)`, `useGetSellerInfoQuery`/`useUpdateSellerInfoMutation` из `cloudAdminApi.ts`). Секция «AI Chat» — либо вторая Card в этой же форме, либо соседний компонент `AiChatSettingsForm` на той же странице; бэкенд — расширение `cloud-settings.controller` (новые ключи в `CloudSettingsService`).

## 7. Common Pitfalls

### Pitfall 1: cross-tenant closure в MCP-реестре
**Что:** `McpToolsService` регистрирует handlers с uid в замыкании и не перерегистрирует их для другого тенанта (см. §4). Новые phonebook-tools, добавленные «по образцу», унаследуют баг.
**Как избежать:** контракт adapter — uid параметром вызова; в `callTool` uid прокидывать в handler. Warning sign: интеграционный тест с двумя uid подряд.

### Pitfall 2: lookup без tenant-фильтра
**Что:** `PhonebooksService.lookupNumber(phonebookUid, number)` не фильтрует по `user_uid` (для internal-endpoint с API-ключом это осознанно). Если демо-тест UI вызовет его без проверки владения — доступ к чужому справочнику по перебору uid.
**Как избежать:** новый JWT-endpoint сначала `findOne(uid, userUid)` (бросает NotFound), потом lookup.

### Pitfall 3: ValidationPipe whitelist съедает bindings
**Что:** `routes.controller` create/update используют `ValidationPipe({ whitelist: true })` — поля не из DTO молча удаляются. `bindings` в body без описания в `CreateRouteDto/UpdateRouteDto` просто исчезнут.
**Как избежать:** описать bindings-DTO с class-validator; тест на прохождение поля.

### Pitfall 4: AMI UpdateConfig — батчи и неатомарность
**Что:** лимит ~32 header'ов на запрос (в коде — батчи по 20); DelCat→NewCat→Append не транзакционны — сбой в середине оставляет полуконтекст; комментарии и пустые строки не переносятся; строки парсятся эвристикой первого `=>`/`=`.
**Как избежать:** генерировать только «чистые» строки (как сейчас); в общем `DialplanApplyService` — проверка `res.response === 'Error'` на каждом батче (как в `_applyContextDialplan`) + повторный полный apply как ретрай; `reload: 'no'` на промежуточных шагах, один `dialplan reload` в конце.

### Pitfall 5: устаревшие Gosub-цели после изменений
**Что:** удаление binding/справочника без re-apply контекста маршрута оставляет `Gosub(pb_bind_…)` на несуществующий контекст → «context not found» в звонке. Симметрично: добавление binding без записи binding-контекста.
**Как избежать:** единый порядок apply: сначала phonebook-файл (`pb_{vpbx}.conf`), затем контекст маршрута, затем reload; все мутации bindings идут через re-apply маршрута (паттерн уже принят: create/update/delete route делают apply в try/catch).

### Pitfall 6: реген при изменении набора var-ключей
**Что:** `Set(PB_<key>=CUT(...))` генерируется по union ключей на момент генерации (D-18). CSV-импорт или добавление entry с новым ключом делает dialplan неполным (новый ключ не парсится) — значения же обновляются в runtime без регена.
**Как избежать:** после update/import/add_entries сравнивать `collectAllVarKeys` до/после; при изменении — re-apply всех маршрутов с привязками этого справочника. Порядок ключей фиксировать сортировкой (`collectAllVarKeys` уже сортирует) — позиции CUT детерминированы.

### Pitfall 7: `dialplan reload` и in-flight звонки
**Что:** reload глобально заменяет контексты; активные каналы продолжают исполняться, но следующий шаг ищется уже в новом dialplan — при удалении контекста мид-колл возможен обрыв.
**Как избежать:** не удалять контексты, на которые могут ссылаться активные звонки, без замены (DelCat+NewCat в одном apply); это же поведение сегодня принято для маршрутов — риск известен и признан приемлемым; в E2E не проверять «горячее» изменение во время звонка.

### Pitfall 8: порядок привязок
**Что:** blacklist должен исполняться раньше VIP (D-03, рекомендации в PHONEBOOKS_MODULE.md); UI-swap без персиста position или неупорядоченная выборка ломают семантику.
**Как избежать:** `ORDER BY position ASC` во всех выборках bindings; при сохранении — позиции по индексу массива (паттерн `routes.service.reorder`).

### Pitfall 9: aiPBX-регистрация — ручной шаг
**Что:** MCP-tools подхватываются автоматически через `tools/list`, но webhook-tools требуют создания definitions в aiPBX вручную (чеклист AI_CHAT_MODULE.md). E2E (D-21) не заработает без этого шага.
**Как избежать:** включить в план явный checkpoint:human-verify с чеклистом регистрации.

### Pitfall 10: раздувание system prompt
**Что:** summary в snapshot + KB-блок добавляются в каждый запрос к LLM. Полные entries в snapshot взорвут контекст (у справочника могут быть тысячи записей).
**Как избежать:** D-16 — в summary только имя/описание/кол-во записей/привязки; entries — только через `list_phonebook_entries` с limit; KB-блок ≤ 15 строк.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Матчинг Asterisk-паттернов | свой парсер | `PhonebooksService.matchAsteriskPattern/asteriskPatternToRegex` | уже есть, покрыт спеками |
| Рендер custom actions | свой рендер behavior | `AsteriskDialplanUtils.actionToDialplan` + sanitize-хелперы | 25+ типов действий, санитизация инъекций |
| AMI batch-запись конфига | новый цикл батчей | извлечённый `DialplanApplyService` (из `_applyContextDialplan`) | 4 существующих копии — консолидация, не 5-я |
| Аудит | своя таблица/логика | `LoggerService.logAction` → `action_logs` | паттерн `ai_tool` уже принят |
| Настройки инсталляции | новая таблица | `CloudSettingsService` (key-value `cloud_settings`) | готовый upsert/чтение |
| Ordered-list UI | DnD-библиотека | up/down-кнопки как в `MohFormModal` | паттерн проекта, без новых зависимостей |
| JSON-schema tools | zod-слой в MCP | плоские объекты properties как в `reg()` | D-13; реестр уже сериализует их в `tools/list` |

## Runtime State Inventory (rename/refactor-фаза)

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | `route_phonebooks.invert/actions` (DROP), `routes.options.phonebook_uids` (JSON-ключ перестаёт читаться) | migrate-скрипт: CREATE bindings-таблица + ALTER route_phonebooks; данных в проде нет (D-07) — конвертация не нужна |
| Live service config | Файлы на Asterisk: `krasterisk/routes/extensions_*.conf` могут содержать старые `Gosub(phonebook_check_…)`; контексты `phonebook_check_*` в проде отсутствуют (generateDialplan никогда не вызывался — [VERIFIED: grep]) | re-apply контекстов после релиза убирает старые Gosub-строки; отдельной чистки не нужно |
| Live service config (aiPBX) | Tool definitions в aiPBX (webhook) — вне git | ручной шаг: регистрация новых tools (checkpoint) |
| OS-registered state | Нет — verified: pm2-процесс не переименовывается, задач планировщика фаза не создаёт | none |
| Secrets/env vars | Нет новых обязательных env; `DIALPLAN_API_KEY`, `AIPBX_*`, `KRASTERISK_SERVICE_TOKEN` не меняются | none |
| Build artifacts | Нет — verified: пакеты не переименовываются | none |

## Package Legitimacy Audit

Фаза **не устанавливает внешних пакетов** — все потребности закрыты текущими зависимостями (`@modelcontextprotocol/sdk@1.29`, `sequelize-typescript`, jest/vitest, lucide-react). slopcheck не запускался — нечего проверять. **Packages removed: none. Packages flagged: none.**

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| MySQL (krasterisk DB) | миграция, CRUD | ✓ (проект работает на ней) | — | — |
| Asterisk + AMI | apply dialplan, E2E (D-21) | ✓ на прод/стенде; ✗ на dev-машине Windows | — | unit-тесты с mock AmiService; E2E — только на стенде |
| aiPBX-сервер | E2E AI-диалогов | внешний, конфигурируется env | — | MCP можно дернуть напрямую (JSON-RPC POST /api/mcp) без aiPBX |
| Node 20+, npm workspaces | сборка/тесты | ✓ | — | — |

**Blocking:** нет. E2E-часть (D-21) выполняется только на стенде с живым Asterisk + aiPBX — в плане это ручной checkpoint, не автоматизируемая задача.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Лимит AMI UpdateConfig «~32 headers/request» — из комментария в коде проекта; официальная документация Asterisk точное число не фиксирует | §2, Pitfall 4 | Низкий: батч 20 консервативен и проверен в проде |
| A2 | Поведение in-flight звонков при `dialplan reload` (продолжение по новому dialplan) — по обучающим данным Asterisk, не перепроверено на текущей версии | Pitfall 7 | Низкий: риск уже принят существующим route-apply |
| A3 | aiPBX подхватывает новые MCP-tools автоматически через `tools/list`, а webhook-tools требует ручной регистрации | §5, Pitfall 9 | Средний: если и MCP требует ручных действий в aiPBX — добавить в чеклист (уже есть ручной checkpoint) |
| A4 | Настройки AI-подтверждений глобальные (cloud_settings), не per-tenant — вывод из размещения UI в SellerSettingsForm (cloud-admin) | §5 | Средний: если нужно per-tenant — хранить в `tenants`/`tenant_modules.config`; уточнить при планировании |

## Open Questions

1. **Чинить ли cross-tenant баг MCP-реестра для 16 legacy-tools в этой фазе?** Каркас (D-14) обязан «не ломать» их; минимальный фикс — принудительный `registerAll(uid)` на каждый вызов (дешёво, но N регистраций) либо прокидывание uid параметром. Рекомендация: включить минимальный фикс в задачу каркаса — это security-баг.
2. **`match_mode=on_no_match` + vars:** при несовпадении PB_* переменных нет — пресеты set_name/set_number/redirect по var-ключу бессмысленны в этом режиме. Рекомендация: UI ограничивает выбор пресетов для on_no_match (whitelist/vars-only смысла нет → blacklist-like Hangup, custom, fixed-redirect).
3. **`user_uid` колонка справочников** называется `user_uid` и хранит vpbx_user_uid (комментарий в PHONEBOOKS_MODULE.md) — новая таблица следует той же конвенции; план не должен «исправлять» это попутно.

## Sources

### Primary (HIGH — код репозитория, читался в этой сессии)
- `packages/backend/src/modules/phonebooks/*` (service, models, lookup-controller, spec)
- `packages/backend/src/modules/routes/routes.service.ts`, `routes.controller.ts`, `route.model.ts`, dto
- `packages/backend/src/shared/utils/dialplan.util.ts`
- `packages/backend/src/modules/ai-chat/*` (pbx-context-builder, ai-webhook, knowledge-base)
- `packages/backend/src/modules/mcp/*` (mcp-tools, mcp-session)
- `packages/backend/src/modules/system-settings/dialplan-subroutines.service.ts`
- `packages/backend/src/modules/cloud-admin/cloud-settings.service.ts`, `migrate-phase2.ts`
- `packages/backend/src/modules/moh/*`, `packages/backend/src/modules/prompts/prompts.service.ts`, `ivrs/ivr-tts-cache.service.ts`
- `packages/frontend/src/features/routes/ui/RouteFormModal/*`, `features/moh/ui/MohFormModal/*`, `features/cloud-admin/ui/SellerSettingsForm/*`
- `packages/shared/src/types/phonebook.types.ts`, `route.types.ts`
- `.docs/PHONEBOOKS_MODULE.md`, `.docs/AI_CHAT_MODULE.md`, `packages/{frontend,backend}/.idea/ARCHITECTURE.md`
- `.env.example`, `ecosystem.config.js`, корневой `package.json`

### Secondary / Tertiary
- Поведение Asterisk AMI UpdateConfig и dialplan reload — обучающие данные, помечено [ASSUMED] в Assumptions Log (A1, A2). Внешние источники не привлекались: фаза не вводит новых технологий.

## Metadata

**Confidence breakdown:**
- Dialplan-форма и apply: HIGH — эволюция существующего кода, все точки верифицированы
- AMI vs FS рекомендация: HIGH — все деплой-факты проверены по репо; остаточная неопределённость только в A1/A2
- Data model / миграции: HIGH — паттерн migrate-скриптов найден в репо
- Adapter каркас: HIGH по интеграционным точкам; MEDIUM по выбору registry-паттерна (архитектурный вкус, альтернатива — DiscoveryService)
- Frontend: HIGH — эталоны (MohFormModal, RouteFormModal, SellerSettingsForm) прочитаны

**Research date:** 2026-07-14
**Valid until:** 2026-08-14 (стек стабилен, внешних зависимостей нет)
