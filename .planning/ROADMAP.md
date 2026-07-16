# Roadmap

**Canonical refs (все фазы):** см. `.planning/CANONICAL_REFS.md`  
Обязательно: `packages/frontend/.idea/ARCHITECTURE.md`, `packages/backend/.idea/ARCHITECTURE.md`

## Phase 1 — MOH playlist migration

**Canonical refs (фаза):** `.docs/MOH_MODULE.md` (локально), `.idea/MOH_MODERN_DELTA_PRD.md`, `packages/backend/src/modules/moh/`, `packages/frontend/src/features/moh/`

**Status:** executed — pending verify  
**Goal:** `mode=playlist`, validation, tests, docs, UI cleanup.  
**Requirements:** REQ-001 … REQ-006

---

## Phase 2 — Redesign MohPage UI

**Canonical refs (фаза):**

- `packages/frontend/.idea/ARCHITECTURE.md` — **MUST READ** (FSD, Tailwind + shadcn, Stack, i18n, TanStack Table)
- `packages/frontend/src/pages/MohPage/MohPage.tsx` — orchestrator page (primary target)
- `packages/frontend/src/features/moh/ui/MohTable/` — table layout/states
- `packages/frontend/src/features/moh/ui/MohFormModal/` — out of scope unless discuss extends
- `packages/frontend/src/shared/ui/` — переиспользуемые компоненты (Button, Stack, Dialog…)

**Status:** Executed  
**Goal:** Предложить **3 визуальных варианта** страницы MOH, после выбора пользователем — внедрить **один** вариант в production-код без смены API/backend.

**Scope (in):**

- Визуальный и layout-редизайн `MohPage` (header, subtitle, CTA, контейнер таблицы, empty/loading при наличии)
- Адаптивность (mobile / tablet / desktop) по паттернам проекта
- i18n: все новые/изменённые строки в `ru` + `en` (минимум)
- Следование ARCHITECTURE: FSD, `shared/ui`, Tailwind + shadcn, Lucide, Motion — без кастомного UI-kit

**Scope (out):**

- Изменения `packages/backend/**`, `mohApi`, бизнес-логики MOH
- Три параллельные реализации в prod (только sketch → один winner → execute)
- Редизайн `MohFormModal` / playlist editor — отдельная фаза, если не решено иначе на discuss

**Requirements:** REQ-101 … REQ-106

**GSD workflow (рекомендуемый порядок):**

| Шаг | Команда |
|-----|---------|
| 1 | `/gsd-discuss-phase 2` |
| 2 | `/gsd-sketch MohPage redesign per @packages/frontend/.idea/ARCHITECTURE.md — 3 variants` |
| 3 | Выбор варианта пользователем → `/gsd-sketch --wrap-up` |
| 4 | `/gsd-ui-phase 2` |
| 5 | `/gsd-plan-phase 2` |
| 6 | `/gsd-execute-phase 2` |
| 7 | `/gsd-ui-review 2` + `npm run test:frontend` |
| 8 | `/gsd-verify-work 2` → `/gsd-ship 2` |

**Verification:**

- Automated: `npm run lint`, `npm run test:frontend` (если есть/добавлены тесты UI)
- Manual: `/moh` — header, CTA, таблица, responsive; визуал соответствует выбранному sketch-winner

---

## Phase 3 — IVR page & form modal UI alignment

**Canonical refs (фаза):**

- `packages/frontend/.idea/ARCHITECTURE.md` — **MUST READ** (FSD, SCSS modules, Stack, `shared/ui`, design tokens `var(--color-*)`)
- `packages/frontend/src/pages/IvrsPage/IvrsPage.tsx` — page shell (привести к паттерну MohPage / VoiceRobots)
- `packages/frontend/src/features/ivrs/ui/IvrFormModal/IvrFormModal.tsx` — табы модалки, layout
- `packages/frontend/src/features/ivrs/ui/IvrPromptsEditor/` — вкладка «Записи» (контраст с фоном)
- `packages/frontend/src/features/routes/ui/RouteFormModal/` — **эталон** табов и body (`.module.scss`, одна полоса под табами)
- `packages/frontend/src/features/ivrs/ui/IvrsTable/` — при необходимости wrapper/states на странице

**Status:** Executed (03-01/03-02 SUMMARY; verify pending)  
**Depends on:** — (независима от MOH verify; brownfield FE-only)

**Goal:** Рефакторинг `IvrsPage` и `IvrFormModal` под архитектуру проекта: SCSS-модули + токены, без «сливающихся» секций; таб-бар модалки и вкладка «Записи» визуально как `RouteFormModal`.

**Scope (in):**

- `IvrsPage`: header, CTA, карточка/контейнер таблицы по паттерну Phase 2 (MohPage), SCSS-модуль страницы
- `IvrFormModal`: табы через SCSS как `RouteFormModal` (без дублирующей `border-b` + underline на кнопках)
- `IvrPromptsEditor` (+ связанные tab-компоненты при необходимости): `var(--color-*)`, читаемый фон секции «Записи»
- i18n только для новых/изменённых строк (`ru` + `en`)
- Регрессия: сохранение create/edit/copy IVR, prompts, menu items

**Scope (out):**

- Backend, `ivrsApi`, бизнес-логика IVR
- Полный редизайн `IvrMenuItemsEditor` / dialplan — только если мешает контрасту на той же вкладке
- Sketch из 3 вариантов (не требуется — эталон RouteFormModal + MohPage)

**Requirements:** REQ-201 … REQ-206

**GSD workflow (рекомендуемый порядок):**

| Шаг | Команда |
|-----|---------|
| 1 | `/gsd-discuss-phase 3` |
| 2 | `/gsd-ui-phase 3` |
| 3 | `/gsd-plan-phase 3` |
| 4 | `/gsd-execute-phase 3` |
| 5 | `/gsd-ui-review 3` + `npm run test:frontend` |
| 6 | `/gsd-verify-work 3` → `/gsd-ship 3` |

**Verification:**

- Automated: `npm run lint`, `npm run test:frontend` (в т.ч. `IvrsTable.test.tsx` если затронуто)
- Manual: `/ivrs` — страница в одном стиле с MOH/VoiceRobots; модалка → вкладка «Записи» — секция не сливается с фоном; **одна** линия под табами (как RouteFormModal)

---

## Phase 4 — IVR «Фразы»: TTS-текст с движком и голосом на фразу

**Canonical refs (фаза):**

- `packages/frontend/.idea/ARCHITECTURE.md`, `packages/backend/.idea/ARCHITECTURE.md`
- `packages/frontend/src/features/ivrs/ui/IvrPromptsEditor/` — вкладка «Фразы»
- `packages/frontend/src/pages/TtsEnginesPage/`, `packages/frontend/src/features/tts-engines/` — справочник движков
- `packages/backend/src/modules/tts-engines/` — CRUD движков (`tts_engines`)
- `packages/backend/src/modules/voice-robots/providers/` — `TtsProviderFactory`, Yandex/Google (переиспользовать)
- `packages/backend/src/modules/ivrs/ivrs.service.ts` — генерация dialplan (`prompts`, legacy `tts:`)
- `packages/backend/src/modules/prompts/prompts.controller.ts` — `POST /prompts/synthesize` (заглушка — кандидат на реализацию)
- `.planning/phases/04-ivr-phrases-tab-tts-text-phrases-with-per-phrase-engine-voic/04-CONTEXT.md` — решения (runtime, JSON-only, preview)
- `.planning/phases/04-ivr-phrases-tab-tts-text-phrases-with-per-phrase-engine-voic/04-RESEARCH.md` — CURL play-phrase, IvrTtsService

**Status:** Executed (verify pending)  
**Plans:** `04-01` ✓ · `04-02` ✓ · `04-03` ✓  
**Depends on:** Phase 3 (UI вкладки «Фразы»)

**Goal:** На вкладке «Фразы» в IVR добавлять не только аудиозаписи из справочника, но и **текстовые фразы**, озвучиваемые через выбранный **TTS-движок** из `TtsEnginesPage`; для каждой TTS-фразы — свой **движок** и **переопределяемые параметры голоса** (voice, speed, role и т.д.), не только глобальные `settings` движка.

**Scope (in):**

- Модель `prompts`: **JSON-only** `IIvrPhrase[]` (`audio` | `tts`); legacy `string[]` / `tts:` **убрать** (миграция в плане)
- UI `IvrPromptsEditor`: «Запись» / «TTS»; движок на фразу; voice/speed overrides как в `TtsEngineFormModal`; **Preview**
- Backend: **runtime TTS в dialplan** (AGI/мост), merge `engine.settings` + per-phrase overrides; **без WAV** в sounds
- TTS: **yandex + google + custom** (расширить `TtsProviderFactory` или `IvrTtsService`)
- Preview API для прослушивания в UI
- i18n `ru` + `en`, типы `@krasterisk/shared`, тесты

**Scope (out):**

- Редизайн `TtsEnginesPage` / CRUD движков (только consume)
- Materialize TTS → WAV / запись в справочник Prompts
- Streaming low-latency как у voice-robots (достаточно batch/AGI для приветствия IVR)

**Requirements:** REQ-301 … REQ-310

**GSD workflow:**

| Шаг | Команда |
|-----|---------|
| 1 | `/gsd-discuss-phase 4` — materialize vs runtime AGI, формат JSON, preview |
| 2 | `/gsd-ui-phase 4` |
| 3 | `/gsd-plan-phase 4` |
| 4 | `/gsd-execute-phase 4` |
| 5 | `/gsd-verify-work 4` |

**Verification:**

- Manual: `/ivrs` → «Фразы» → добавить TTS с движком и другим голосом → сохранить → звонок/диалплан воспроизводит обе фразы в порядке
- Automated: `npm run test:backend` (ivrs + synthesis), `npm run test:frontend` (IvrPromptsEditor)

---

## Phase 5 — Phonebooks AI: универсальные справочники, MCP tools, chat-bot

**Canonical refs (фаза):**

- `.docs/PHONEBOOKS_MODULE.md` — **MUST READ** (модель данных, lookup CURL, dialplan, vars → `PB_*`)
- `.docs/AI_CHAT_MODULE.md` — **MUST READ** (ai-tools webhooks, MCP `/api/mcp`, audit log, system prompt)
- `packages/backend/src/modules/phonebooks/` — CRUD, lookup, dialplan generation
- `packages/backend/src/modules/ai-chat/` — SSE-прокси, `ai-webhook.controller`, `pbx-context-builder`
- `packages/backend/src/modules/mcp/` — `mcp-tools.service` (расширение инструментов)
- `packages/frontend/src/features/phonebooks/` — UI справочников
- `packages/frontend/src/widgets/AiChatWidget/` — встроенный AI-ассистент

**Status:** In progress — 3/5 plans executed (05-01, 05-05, 05-02)
**Depends on:** — (brownfield; независима от verify Phase 4)

**Plans:** 5/5 plans complete

Plans:

- [x] 05-01-PLAN.md — DialplanApplyService: консолидация 4 копий AMI UpdateConfig батч-логики (routes.controller, ai-webhook.controller, mcp-tools.service, dialplan-subroutines.service) в общий сервис
- [x] 05-05-PLAN.md — Bindings backend: таблица route_phonebook_bindings + миграция, чистка invert/actions, bindings CRUD в маршрутах, per-binding dialplan `pb_bind_{uid}_{vpbx}` + прошивка apply + реген-триггеры, lookup-test endpoint
- [x] 05-02-PLAN.md — AI-платформа: каркас Domain AI Adapter (Tools/State/Knowledge), фикс cross-tenant closure в MCP, аудит MCP в action_logs, per-tenant подтверждения (default OFF, включая update_route), PhonebooksAiAdapter (7 tools + update_route), snapshot summary + KB-блок
- [x] 05-03-PLAN.md — Frontend: вкладка «Справочники» в RouteFormModal (playlist-паттерн, пресеты + custom DialplanAppsEditor), чистка PhonebookFormModal + демо-тест lookup, подраздел AI Chat в SellerSettingsForm, i18n ru/en
- [x] 05-04-PLAN.md — E2E/UAT: финальный гейт + документация .docs, checkpoint регистрации tools в aiPBX, checkpoint AI-сценариев D-21 с реальным звонком

**Goal:** Проанализировать текущую реализацию Phonebooks, улучшить её и выделить **универсальные механизмы** для проектирования и настройки справочников через AI: встроенный чат (`AiChatWidget`), webhooks `/api/ai-tools/*` и **MCP-инструменты** — чтобы простой чат-бот по запросу пользователя мог создавать/редактировать справочники, записи, actions и привязки к маршрутам.

**Scope (in):**

- Аудит `phonebooks` backend + frontend vs `.docs/PHONEBOOKS_MODULE.md` (gaps, tech debt)
- Универсальный контракт «справочник» (schema/metadata для AI: поля vars, actions, invert, patterns)
- AI tools: `create_phonebook`, `update_phonebook`, `add_phonebook_entries`, `list_phonebooks`, … (webhook + MCP)
- Расширение `PbxContextBuilderService` / system prompt — snapshot справочников для LLM
- Регистрация tools в aiPBX + MCP (по паттерну существующих 16 инструментов)
- Audit log (`action_logs`) для phonebook tool calls
- E2E-сценарии: «создай чёрный список», «добавь VIP-номера с redirect», «привяжи справочник к маршруту»

**Scope (out):**

- Новые типы справочников beyond phonebook (отдельная фаза после универсального слоя)
- Полный редизайн `PhonebooksPage` UI (только если audit выявит блокеры)
- Собственный LLM / замена aiPBX

**Requirements:** D-01 … D-26 (locked decisions в `.planning/phases/05-phonebooks-ai-universal-directory-mechanisms-mcp-tools-and-c/05-CONTEXT.md`; REQ-ID для фазы не заводились)

**GSD workflow (рекомендуемый порядок):**

| Шаг | Команда |
|-----|---------|
| 1 | `/gsd-discuss-phase 5` — универсальный контракт, tool surface, MCP vs webhook |
| 2 | `/gsd-plan-phase 5` |
| 3 | `/gsd-execute-phase 5` |
| 4 | `/gsd-verify-work 5` |

**Verification:**

- Automated: `npm run test:backend` (phonebooks + ai-tools + mcp), `npm run lint`
- Manual: AI Chat / MCP — создать справочник и записи по текстовому запросу; lookup + dialplan работают

---

## Phase 6 — Dialplan Apps: ring groups, multi-channel notifications, UX overhaul

**Canonical refs (фаза):**

- `packages/frontend/.idea/ARCHITECTURE.md`, `packages/backend/.idea/ARCHITECTURE.md`
- `packages/frontend/src/features/dialplan-apps/ui/DialplanAppsEditor/DialplanAppsEditor.tsx` — **primary target**
- `packages/frontend/src/features/routes/ui/RouteFormModal/` — редактор маршрута (возможный host для CRUD групп)
- Backend dialplan generation для apps (routes / dialplan-apps modules — уточнить на research)
- Текущие apps: groups, call lists, telegram, email — аудит реальной реализации vs UI

**Status:** Complete — 16/16 plans executed (incl. gap closures 06-15, 06-16)  
**Depends on:** Phase 5 (DialplanAppsEditor уже используется во вкладке «Справочники»; желательно после стабилизации bindings)

**Goal:** Переработать `DialplanAppsEditor` и набор dialplan-приложений: (1) объединённое гибкое приложение **групп/списков вызовов** с стратегиями ring и CRUD из маршрута; (2) конфигурируемые **multi-channel уведомления** (мессенджеры/соцсети, channel vars, пресеты); (3) аудит текущих apps + UX маршрутизации и предложения дополнительных приложений.

**Scope (in):**

1. **Ring groups / call lists (объединённое app)**
   - Инструмент создания/редактирования группы вызовов (в т.ч. прямо в редакторе маршрута)
   - Участники: внутренние и внешние номера
   - Стратегии: ringall, sequential, progressive, memory/last-answered и др. (best practices телефонии)
   - Research + варианты решений на discuss; креативные UX-паттерны

2. **Multi-channel notifications**
   - Замена/расширение отдельных telegram/email apps → единое конфигурируемое приложение
   - Каналы: мессенджеры, соцсети и т.д.; гибкая настройка интеграций
   - Шаблоны с любыми переменными канала; пресеты; интуитивный UX

3. **Аудит + UX overhaul DialplanAppsEditor**
   - Проверка реальной реализации всех текущих приложений
   - Варианты улучшения редактора маршрутизации (полнофункциональный UX)
   - Предложения дополнительных dialplan apps

**Scope (out):**

- Полная замена ядра Asterisk dialplan engine
- Несвязанный редизайн RouteFormModal целиком (только интеграция групп/apps)
- Собственный LLM / AI Chat tools для dialplan apps (отдельная фаза при необходимости)

**Requirements:** TBD (discuss → REQ / decisions)

**GSD workflow (рекомендуемый порядок):**

| Шаг | Команда |
|-----|---------|
| 1 | `/gsd-discuss-phase 6` — стратегии ring groups, каналы уведомлений, scope UX |
| 2 | `/gsd-plan-phase 6` |
| 3 | `/gsd-execute-phase 6` |
| 4 | `/gsd-verify-work 6` |

**Plans:** 16/16 plans complete

Plans:

- [x] 06-01-PLAN.md — Shared types (call-group/notification) + ActionType + route-action DTO (array dialstatus, time_group_uid, new types) [D-19]
- [x] 06-02-PLAN.md — dialplan.util: DIALSTATUS OR-join + hangup causecode + notify/callerid/trunk_carousel cases [D-12/14/15/19]
- [x] 06-03-PLAN.md — routes.service: inline ExecIfTime guard for time_group_uid [D-19]
- [x] 06-04-PLAN.md — call_group + call_group_member models + migration [D-01/03/06/07]
- [x] 06-05-PLAN.md — call-group-dialplan.util (TDD): 4 strategies, Gosub/Return semantics [D-05/06/07/08]
- [x] 06-06-PLAN.md — CallGroupsService (CRUD + apply) + controller + module [D-01/02/03/08]
- [x] 06-07-PLAN.md — notification_integration store (encrypted credentials) + service + controller [D-10/11]
- [x] 06-08-PLAN.md — Notification dispatcher + 6 channel providers [D-11/12]
- [x] 06-09-PLAN.md — /internal/dialplan/notify endpoint (async 200) + module wiring [D-12]
- [x] 06-10-PLAN.md — Frontend RTK apis (callGroupApi/notificationApi) + tagTypes [D-01/02/10/11]
- [x] 06-11-PLAN.md — Call Groups page + form modal + members editor [D-02/03/04/05/06/07]
- [x] 06-12-PLAN.md — Notification Integrations page + channel-driven form modal [D-10/11/13/16]
- [x] 06-13-PLAN.md — GroupApp + NotifyApp + registry + inline group editor [D-02/12/13/17/18]
- [x] 06-14-PLAN.md — CallerIdApp (4 modes) + TrunkCarouselApp + registry [D-14/15/16/17/18]
- [x] 06-15-PLAN.md — Gap closure: AMI CreateConfig before UpdateConfig + CallGroups post-commit rollback fix [D-01/D-08]
- [x] 06-16-PLAN.md — Gap closure: single-surface hints in CallerIdApp + TrunkCarouselApp [D-16]

**Waves:** W1 {06-01,06-02,06-03} · W2 {06-04,06-05,06-07,06-10} · W3 {06-06,06-08,06-11} · W4 {06-09,06-12} · W5 {06-13} · W6 {06-14} · W7-gap {06-15,06-16}

**Known deferred gap:** per backend ARCHITECTURE §6 new entities (call_group, notification_integration) should get MCP/AI tools; CONTEXT defers this to a later Domain AI Adapter phase (not implemented in Phase 6).

**Verification:**

- Automated: `npm run lint`, `npm run test:backend`, `npm run test:frontend`
- Manual: RouteFormModal → dialplan apps — создать ring group с стратегией; настроить multi-channel notification с channel vars; проверить dialplan apply

---

## Phase 7 — Call Center overhaul: корпоративный колл-центр (workspaces, wallboard, call cards, отчётность, AI-ready)

**Canonical refs (фаза):**

- `packages/frontend/.idea/ARCHITECTURE.md`, `packages/backend/.idea/ARCHITECTURE.md` — **MUST READ**
- `.idea/call-center/CALLCENTER_MODULE_PLAN.md` — экспертный план модуля (архитектура SSE + in-memory state, фазы CC-1…CC-5)
- `.idea/call-center/CC_IMPLEMENTATION_CHECKLIST.md` — текущий прогресс (~55%: backend core 100%, панели 55–75%, CC-2…CC-5 = 0%)
- `.idea/call-center/CC_WORKSPACES_CONCEPT.md` — АРМ оператора (4 зоны) / супервизора (KPI + tabs) / wallboard
- `.idea/call-center/CC_CALL_CARD_CONCEPT.md` — конфигурируемые карточки звонка (templates, field types, auto-populate)
- `.idea/call-center/CC_WEBRTC_CONCEPT.md` — WebRTC softphone (SIP.js + PJSIP WSS, двойной режим SIP/WebRTC)
- `.docs/CALLCENTER_MODULE.md` — документация текущей реализации
- `packages/backend/src/modules/callcenter/` — state store, AMI, SSE, agent/supervisor API (реализовано)
- `packages/frontend/src/features/callcenter/`, `pages/CallCenterAgentPage/`, `pages/CallCenterSupervisorPage/` — текущие панели

**Status:** Gap closure executed (07-21, 07-22) — re-UAT / verify remaining

**Depends on:** Phase 6 (dialplan apps / call groups стабилизированы; независимо от verify Phases 1–5)

**Goal:** Переработать и развить начатый модуль колл-центра до уровня современного корпоративного инструмента: экспертный аудит реализованного (~55%) vs концепции, редизайн АРМ оператора/супервизора по CC_WORKSPACES_CONCEPT, wallboard + metrics engine (SLA/AHT/ASA/Occupancy), конфигурируемые карточки звонка, полная отчётность и аналитика, WebRTC softphone — с архитектурным заделом под AI (голосовые ассистенты, речевая аналитика, autonomous agents).

**Scope (in):**

1. **Аудит + rework ядра** — экспертная оценка текущей реализации (backend core, SSE, state store, панели) vs best practices (Genesys, NICE, QueueMetrics); tech debt: graceful SSE disconnect, unit-тесты callcenter-state/service, role-based menu
2. **АРМ оператора (доработка)** — 4-зонный layout по концепции: client card из phonebook, pick call, drag&drop transfer, missed calls badge, звуковые + browser notifications, расширенная pause modal
3. **АРМ супервизора (доработка)** — grid↔table toggle, agent detail modal (timeline), queue management modal (add/remove/penalty), bulk actions, live calls actions, internal chat, sparklines
4. **Wallboard + Metrics engine** — `/callcenter/wallboard`, KPI-карточки, live charts, heatmap очередей, алерты порогов; вычисление SLA/ASR/AHT/ASA/Occupancy/Abandon из AMI событий с накоплением в state
5. **Call Cards** — конфигурируемые шаблоны (cc_card_templates/fields/data), конструктор (drag&drop), auto-populate из phonebook, привязка к очередям и CDR, авто-карточка при пропущенном, webhook → CRM
6. **Отчётность + аналитика** — `/callcenter/reports`: сводка очередей, детализация звонков, статистика операторов, отчёт по паузам, почасовая heatmap, agent timeline (визуализация дня), CSV/XLSX экспорт
7. **WebRTC softphone** — SIP.js + PJSIP WSS, двойной режим (SIP-устройство / браузер), audio devices, DTMF, call quality indicator
8. **AI-ready foundation** — архитектурные точки расширения: event bus / стриминг аудио под STT-транскрипцию, sentiment, подсказки оператору, auto wrap-up notes; контракты под голосовых ассистентов и autonomous agent (замена человека); MCP/AI tools для CC-сущностей (per backend ARCHITECTURE §6)

**Scope (out):**

- Сама реализация AI-модулей (STT/речевая аналитика/голосовые ассистенты) — отдельные фазы; здесь только архитектурный задел и контракты
- Полноценный WFM (прогноз нагрузки, расписания смен) — кандидат в backlog
- Omnichannel (чаты, email, соцсети как каналы очередей) — отдельная фаза
- Callback / skill-based routing — по итогам discuss (возможно вынести в следующую фазу)

**Requirements:** TBD (discuss → REQ / decisions; ожидается разбиение на подфазы или waves из-за объёма)

**GSD workflow (рекомендуемый порядок):**

| Шаг | Команда |
|-----|---------|
| 1 | `/gsd-discuss-phase 7` — аудит-приоритеты, scope-резка (waves/подфазы), AI-ready контракты |
| 2 | `/gsd-ui-phase 7` — workspaces/wallboard/call cards UI |
| 3 | `/gsd-plan-phase 7` |
| 4 | `/gsd-execute-phase 7` |
| 5 | `/gsd-ui-review 7` + `npm run test:frontend` |
| 6 | `/gsd-verify-work 7` → `/gsd-ship 7` |

**Plans:** 22/22 plans executed

Plans:

- [x] 07-01 … 07-12, 07-17 — prior waves (see phase SUMMARY files)
- [x] 07-13-PLAN.md — Wallboard UI: TV page + display tokens + alert routing [D-27/D-29]
- [x] 07-14-PLAN.md — WebRTC softphone: sip.js + ShiftLoginModal + ICE config [D-14…D-17]
- [x] 07-16-PLAN.md — AI-ready foundation: event bus + CallCenterAiAdapter + media PCM skeleton [D-41…D-45]
- [x] 07-18-PLAN.md — Reports UI: 7 reports + CSV/XLSX/PDF + AgentTimeline reuse [D-33/D-34/D-36]
- [x] 07-15-PLAN.md — Automated report delivery / schedules via notification_integration [D-35]
- [x] 07-19-PLAN.md — Gap closure: PauseReasonsManager + operator settings picker [D-40/D-22]
- [x] 07-20-PLAN.md — Gap closure: track SIP MuteAudio as DEF-07-MUTE-AMI [D-14]
- [x] 07-21-PLAN.md — Gap closure: setMyAgentInterface on shift login + require ≥1 queue [D-14/D-15]
- [x] 07-22-PLAN.md — Gap closure: ASTERISK_WSS_URL docs + clear missing-WSS UI [D-14/D-17]

**Verification:**

- Automated: `npm run lint`, `npm run test:backend` (callcenter), `npm run test:frontend`
- Manual: `/callcenter/agent`, `/callcenter/supervisor`, `/callcenter/wallboard` — сценарий: login → входящий из очереди → карточка авто-открылась с данными phonebook → hold/transfer → wrap-up → отчёты показывают звонок; WebRTC-режим — звонок полностью в браузере

---

## Phase 8 — Navigation redesign & Android port foundation

**Canonical refs (фаза):**

- `packages/frontend/.idea/ARCHITECTURE.md` — **MUST READ** (FSD, Tailwind + shadcn, Stack, i18n, design tokens)
- `packages/frontend/src/widgets/Sidebar/` — текущая навигация (`buildNavigation`, `Sidebar`, `SidebarItem`)
- `packages/frontend/src/app/layouts/AppLayout.tsx` — shell (sidebar + content)
- `packages/frontend/src/app/router/router.tsx` — маршруты модулей
- `packages/frontend/package.json` — стек (React 19 + Vite + Tailwind 4; **нет** Capacitor / RN)

**Status:** Planned  
**Depends on:** Phase 7 (стабильный App shell / role-based menu; независимо от verify Phases 1–6)

**Goal:** Заменить плоское Tailwind-меню на масштабируемую модульную навигацию (Module Hub 002-E + ModuleShell tabs + marketplace/billing skeleton + platform vs tenant admin + full responsive + Capacitor Android foundation), с современным UX и полноценной mobile-адаптацией.

**Scope (in):**

1. **IA / информационная архитектура** — группировка модулей (workspaces / domains), role-based visibility, deep-link совместимость с текущими routes; поиск по разделам (command palette / omnibox) как first-class способ перехода при росте меню
2. **Редизайн навигации** — несколько визуальных/функциональных вариантов (sketch → выбор → один winner): collapsible rail + module switcher, dual-rail (domains → pages), mega-menu / flyout, bottom bar (mobile) + drawer; современные паттерны (density, keyboard, recent/favorites, contextual secondary nav)
3. **Design-system touchpoints** — токены/паттерны shell (AppLayout, nav density, focus rings, motion); без полной смены UI-kit; согласование с `shared/ui` + Tailwind + shadcn
4. **Mobile-first адаптация** — breakpoints, touch targets, safe areas, drawer/sheet вместо sidebar, сохранение контекста при ротации; smoke на ключевых страницах (dashboard, routes, callcenter agent/supervisor)
5. **Android port foundation** — выбор оболочки (рекомендуемый baseline: **Capacitor** над существующим Vite/React SPA); gap-анализ стека; scaffold `android/`; env/build pipelines; WebView constraints (auth storage, SSE, WebRTC/mic/camera permissions, deep links, push notifications stub); документация «что добавить / чего не хватает»
6. **i18n** — все новые строки `ru` + `en`

**Scope (out):**

- Полный редизайн всех внутренних страниц модулей (только shell + navigation + critical mobile breakpoints)
- Публикация в Google Play / store listing / production signing — только подготовка и checklist
- Нативный React Native rewrite (если discuss выберет Capacitor — RN out of scope)
- iOS port (можно заложить в backlog / следующую фазу после Android foundation)
- Backend API changes кроме минимально необходимых для mobile auth/push (обсуждается на discuss)

**Stack gaps (стартовая гипотеза для research/discuss):**

| Область | Сейчас | Нужно для Android |
|---------|--------|-------------------|
| Shell | Vite SPA в браузере | Capacitor 6/7 + `@capacitor/android` |
| Permissions | browser APIs | Capacitor plugins: Camera/Mic, Push, App, StatusBar, SplashScreen, Keyboard |
| Softphone | sip.js + WSS в браузере | проверка WebView WebRTC / audio focus / background constraints |
| Realtime | SSE / socket.io | keep-alive / reconnect политики под mobile network |
| Auth | JWT / localStorage | Secure storage plugin; refresh UX offline |
| Build | `vite build` | Gradle wrapper, CI artifact AAB/APK, env flavors |

**Requirements:** NAV-01…NAV-16 (derived; see `08-RESEARCH.md` `<phase_requirements>` — REQUIREMENTS.md has no Phase 8 IDs)

**GSD workflow (рекомендуемый порядок):**

| Шаг | Команда |
|-----|---------|
| 1 | `/gsd-discuss-phase 8` — done |
| 2 | `/gsd-sketch` — done (winners Hub E, tabs B, mobile B, marketplace B, admin B) |
| 3 | `/gsd-ui-phase 8` — done (`08-UI-SPEC.md`) |
| 4 | `/gsd-plan-phase 8` — done |
| 5 | `/gsd-execute-phase 8` |
| 6 | `/gsd-ui-review 8` + `npm run test:frontend` |
| 7 | `/gsd-verify-work 8` → `/gsd-ship 8` |

**Plans:** 12/17 plans executed

Plans:

- [x] `08-01-PLAN.md` — Wave 0a: SUPERADMIN enum + module contracts + registry/roleStart tests
- [x] `08-12-PLAN.md` — Wave 0b: tokenStorage + CommandPalette filter + locale seeds
- [x] `08-13-PLAN.md` — Wave 0c: backend Nyquist stubs (SuperAdminGuard / purchase / device-token)
- [x] `08-02-PLAN.md` — Wave 1: Hub catalog + membership + licenseStatus + role→start API
- [x] `08-03-PLAN.md` — Wave 2: Module Hub 002-E + ModuleShell 003-B
- [x] `08-04-PLAN.md` — Wave 3: ⌘K palette, deep-link fallback, legacy redirects
- [x] `08-05-PLAN.md` — Wave 4: Platform `/platform/*` vs tenant System→Modules
- [x] `08-06-PLAN.md` — Wave 5: Billing checkout skeleton (charge + activate)
- [x] `08-07-PLAN.md` — Wave 6: Phone bottom bar 004-B + chip Sheet
- [x] `08-08-PLAN.md` — Wave 7: Users/Roles/Numbers + role→start admin
- [x] `08-09-PLAN.md` — Wave 8a: Responsive — Dashboard/Core critical + CC agent sticky softphone
- [x] `08-14-PLAN.md` — Wave 8b: Responsive — Core rest (Trunks/Contexts/TimeGroups/ProvisionTemplates)
- [ ] `08-15-PLAN.md` — Wave 8c: Responsive — Apps rest (Prompts/CallGroups/Integrations/VoiceRobots)
- [ ] `08-16-PLAN.md` — Wave 8d: Responsive — System rest (Settings/TTS/STT/AuditLog/Modules)
- [ ] `08-17-PLAN.md` — Wave 8e: Responsive — Analytics/AI/CC orphans (CDR/ServiceRequests/AiAgents)
- [ ] `08-10-PLAN.md` — Wave 9: Capacitor 8 + Secure Storage + URL flavors
- [ ] `08-11-PLAN.md` — Wave 10: FCM foundation + WebRTC notes + ARCHITECTURE/i18n

**Verification:**

- Automated: `npm run lint`, `npm run test:frontend`; Capacitor sync/build smoke (если scaffold в scope execute)
- Manual: desktop — переключение между доменами/модулями, keyboard/search; mobile — drawer/bottom nav, ключевые сценарии; Android emulator/device — открытие shell, login, 1–2 ключевых экрана, mic permission path для softphone
