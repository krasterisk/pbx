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

**Plans:** 15/17 plans executed

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
- [x] `08-15-PLAN.md` — Wave 8c: Responsive — Apps rest (Prompts/CallGroups/Integrations/VoiceRobots)
- [x] `08-16-PLAN.md` — Wave 8d: Responsive — System rest (Settings/TTS/STT/AuditLog/Modules)
- [x] `08-17-PLAN.md` — Wave 8e: Responsive — Analytics/AI/CC orphans (CDR/ServiceRequests/AiAgents)
- [x] `08-10-PLAN.md` — Wave 9: Capacitor 8 + Secure Storage + URL flavors
- [ ] `08-11-PLAN.md` — Wave 10: FCM foundation + WebRTC notes + ARCHITECTURE/i18n

**Verification:**

- Automated: `npm run lint`, `npm run test:frontend`; Capacitor sync/build smoke (если scaffold в scope execute)
- Manual: desktop — переключение между доменами/модулями, keyboard/search; mobile — drawer/bottom nav, ключевые сценарии; Android emulator/device — открытие shell, login, 1–2 ключевых экрана, mic permission path для softphone

---

## Phase 9 — Call Center Agent Panel: softphone widget & professional call control

**Canonical refs (фаза):**

- `packages/frontend/.idea/ARCHITECTURE.md`, `packages/backend/.idea/ARCHITECTURE.md` — **MUST READ**
- `.idea/call-center/CC_WORKSPACES_CONCEPT.md` — АРМ оператора (зоны / layout)
- `.idea/call-center/CC_WEBRTC_CONCEPT.md` — WebRTC softphone
- `packages/frontend/src/pages/CallCenterAgentPage/CallCenterAgentPage.tsx` — primary target (orchestrator)
- `packages/frontend/src/features/callcenter/` — softphone, SSE, selectors, UI panels
- `packages/backend/src/modules/callcenter/` — AMI actions (transfer, chanspy, hangup, pickup), state, metrics

**Status:** Gap closure complete (09-16, 09-17) — re-UAT / `/gsd-verify-work 9`  
**Depends on:** Phase 7 (CC core + WebRTC softphone); Phase 8 agent sticky softphone / mobile shell — желательно после стабилизации layout

**Goal:** Переработать АРМ оператора (`CallCenterAgentPage`): основными становятся вкладки **Коллеги / Очереди / Текущие (ожидающие) звонки**; софтфон — компактный виджет + окно входящего вызова и кнопки управления в верхней статус-панели; статус «Готов» → «Ожидание звонка»; KPI принял/пропустил в статус-строке (все звонки, не только queue); per-queue answered/missed; transfer / ChanSpy / hangup по ролям; pickup из waiting; полный набор call-control по практикам профессиональных колл-центров.

**Scope (in):**

1. **IA / layout АРМ** — primary tabs: Коллеги (Операторы), Очереди, Текущие/ожидающие звонки; софтфон как виджет (не доминирующая «карточка ожидания»)
2. **Статус-панель оператора** — «Ожидание звонка» вместо «Готов»; counters принял / пропустил (incoming+outgoing answered; любой missed/abandoned); при активном вызове — call controls в статус-баре + окно звонка
3. **Вкладка Очереди** — все очереди оператора; per-queue answered/missed stats
4. **Вкладка Коллеги** — активные операторы в очередях; click-to-transfer; ChanSpy modes если включена прослушка; hangup — свой разговор (оператор) / разговоры своих операторов (супервизор)
5. **Вкладка Текущие/ожидающие** — таблица waiting queue calls + pickup («подобрать»)
6. **Call-control feature set** — hold, mute, DTMF, blind/attended transfer, conference/chanspy modes, hangup, pickup и прочие best-practice действия (discuss уточняет MVP vs full)
7. **Backend/AMI** — недостающие actions/events для counters, chanspy, hangup-remote, pickup; KPI semantics (не только queue-missed)
8. **i18n** — `ru` + `en`

**Scope (out):**

- Полноценный WFM / schedules
- Omnichannel очереди (chat/email) — отдельная фаза
- Полный redesign супервизорского АРМ (кроме hangup/chanspy прав, пересекающихся с коллегами)

**Requirements:** TBD (discuss → REQ / decisions)

**GSD workflow (рекомендуемый порядок):**

| Шаг | Команда |
|-----|---------|
| 1 | `/gsd-discuss-phase 9` — IA вкладок, KPI semantics, call-control MVP vs full, supervisor overlap |
| 2 | `/gsd-ui-phase 9` — status bar + tabs + softphone widget + call window |
| 3 | `/gsd-plan-phase 9` |
| 4 | `/gsd-execute-phase 9` |
| 5 | `/gsd-ui-review 9` + `npm run test:frontend` / `test:backend` |
| 6 | `/gsd-verify-work 9` → `/gsd-ship 9` |

**Plans:** 17/17 plans complete

Plans:

- [x] 09-01-PLAN.md — Backend schema/models + Phase-9 migration + push (D-09/10/13/16/17/19/34/35/38/39/41/43)
- [x] 09-02-PLAN.md — Frontend Tabs primitive + AgentStatus enum + labels/i18n (D-01/04/07/13/44)
- [x] 09-03-PLAN.md — Backend all-channel AMI listener + dual shift/day KPI (D-08/09/11/12/13/14/31/32)
- [x] 09-04-PLAN.md — Frontend status bar redesign + KPI + call-control bar (D-03/11/12/13/14/44)
- [x] 09-05-PLAN.md — Backend PermissionsService + peer ChanSpy + audit (D-21/22/23/24/25/26/38/39)
- [x] 09-06-PLAN.md — Frontend softphone widget (FAB) + incoming call toast (D-01/02/03/44/46)
- [x] 09-07-PLAN.md — Backend call-control: park/conference/zombie-reset/warm-transfer (D-25/26/27/28/29/33)
- [x] 09-08-PLAN.md — Frontend layout/IA rework + Coworkers/Queues/Waiting tabs (D-04/05/07/21/22/23/25/26/31/32/33/44/46)
- [x] 09-09-PLAN.md — Backend smart missed-calls engine + auto-pause rules (D-10/15/16/17/18/19/20)
- [x] 09-10-PLAN.md — Frontend missed-calls UI + call-control UI + parked indicator (D-16/17/18/19/27/28/33/44)
- [x] 09-11-PLAN.md — Backend unified call history + transfer directory + BLF presence (D-34/35/36/37/45)
- [x] 09-12-PLAN.md — Frontend transfer directory + click-to-call + call-history UI (D-29/34/36/37/44)
- [x] 09-13-PLAN.md — Backend settings endpoints: permissions/notifications/UI customization (D-05/06/38/39/40/41/42/43)
- [x] 09-14-PLAN.md — Frontend settings UI + notification engine + mobile rework + i18n (D-38/39/40/41/42/43/44/46)
- [x] 09-15-PLAN.md — Gap closure: wire orphaned call-control/history components into CallCenterAgentPage — park/retrieve/zombie-reset + directory transfer + call history/click-to-call (D-05/27/28/29/34/35/36/37)
- [x] 09-16-PLAN.md — UAT gap G-09-1: single global throttler + AI POST route-scoped 10/min (D-41/D-42)
- [x] 09-17-PLAN.md — UAT gap G-09-2: tenant autopause_rules API + AutoPauseRulesForm Settings UI (D-15)

---

## Phase 10 — Full Softphone (WebRTC dial / journal / contacts)

**Canonical refs (фаза):**

- `packages/frontend/.idea/ARCHITECTURE.md`, `packages/backend/.idea/ARCHITECTURE.md` — **MUST READ**
- `.planning/phases/10-full-softphone/10-BRIEF.md` — product brief (seed from Phase 9 ARM layout)
- `.idea/call-center/CC_WEBRTC_CONCEPT.md` — WebRTC softphone (если доступен локально)
- `packages/frontend/src/features/callcenter/ui/SoftphoneWidget/` — chrome softphone shell (Dial / Journal / Contacts tabs)
- `packages/frontend/src/features/callcenter/lib/useWebRTCPhone.ts` — sip.js + WSS / re-REGISTER
- `packages/frontend/src/features/callcenter/ui/AgentStatusBar/` — softphone trigger + call controls host
- `packages/frontend/src/features/callcenter/ui/CallHistoryPanel/`, `TransferDirectory/` — journal / contacts seeds
- `packages/frontend/src/pages/CallCenterAgentPage/CallCenterAgentPage.tsx` — orchestrator (single SIP session owner)
- `packages/backend/src/modules/callcenter/` — operator history, transfer directory, BLF presence, click-to-call, WebRTC config

**Status:** Not planned — brief ready  
**Brief:** `.planning/phases/10-full-softphone/10-BRIEF.md`  
**Depends on:** Phase 9 agent panel (chrome, KPI, TransferDirectory, history API); existing `useWebRTCPhone` + PJSIP WSS; BLF / transfer directory backend

**Goal:** Сделать полнофункциональный WebRTC-софтфон отдельным продуктовым контуром внутри АРМ оператора: набор, журнал, контакты (абоненты / очереди / группы), управление вызовом и качеством связи — вшитый в chrome (status strip / header), без плавающего FAB, перекрывающего UI.

**Scope (in):**

1. **Shell / chrome** — softphone вшит в chrome АРМ (status strip / header); состояния collapsed trigger · expanded panel · mobile sticky + sheet; единый источник правды по активному вызову со status-bar call controls (без дублирования логики)
2. **Dial** — dialpad, click-to-call bridge, DTMF in-call, redial last; dial buffer / last number в sessionStorage
3. **Journal** — личный журнал звонков оператора (in/out/missed), фильтры смена/сутки, callback, открытие карточки звонка (реальные данные, не placeholder)
4. **Contacts** — единый каталог: абоненты (endpoints / phonebook), очереди, группы (ring / dial groups), BLF presence где доступно, поиск + недавно использованные; click-to-call ≤1 клик от строки
5. **Call features** — Mute / Hold / Transfer (blind + attended) / Conference add; Park / retrieve (если роль разрешает); call quality indicator (MOS / jitter / RTT / loss) + degraded UX; device picker (mic/speaker) без перелогина смены; auto-answer + zip tone до parity с softphone UX
6. **Resilience** — переподключение WSS / re-REGISTER после рестарта backend / Asterisk без потери смены; явный UI «регистрируюсь… / offline» в trigger; recover path без повторного Start shift (или одна явная кнопка Recover)
7. **i18n / a11y** — `ru` + `en`; keyboard dial + ARIA tabs

**Scope (out):**

- Video softphone
- Embedded CRM screen-pop beyond existing CallCard
- Multi-line / multi-call UI (park + switch) — только если появится в discuss
- Native mobile app softphone (Capacitor) — отдельный трек (Phase 8 Android)

**Requirements:** TBD (discuss → REQ / decisions)

**Success criteria (draft):**

1. Оператор набирает, принимает и переводит звонок только из softphone chrome — FAB нигде не перекрывает таблицы
2. Вкладки Journal и Contacts показывают реальные данные (не placeholder)
3. После F5 / смены вкладки / краткого рестарта backend смена и регистрация WebRTC восстанавливаются без повторного «Start shift», либо с одной явной кнопкой Recover
4. Контакты: поиск ≤300ms perceived; click-to-call ≤1 клик от строки
5. i18n ru/en; a11y: keyboard dial + ARIA tabs

**GSD workflow (рекомендуемый порядок):**

| Шаг | Команда |
|-----|---------|
| 1 | `/gsd-discuss-phase 10` — journal source, contact sources, multi-call, quality metrics MVP |
| 2 | `/gsd-ui-phase 10` — chrome softphone surfaces (Dial / Journal / Contacts) |
| 3 | `/gsd-plan-phase 10` |
| 4 | `/gsd-execute-phase 10` |
| 5 | `/gsd-ui-review 10` + `npm run test:frontend` / `test:backend` |
| 6 | `/gsd-verify-work 10` → `/gsd-ship 10` |

**Requirements:** D-01 … D-35 (locked decisions in `.planning/phases/10-full-softphone/10-CONTEXT.md`; no REQ-IDs, same convention as Phases 5-9)

**Plans:** 9/9 plans executed

Plans:

- [x] 10-01-PLAN.md — cc_contacts backend: new table + model + migration + DTO + tenant/ownership-gated CRUD (D-11…D-15)
- [x] 10-02-PLAN.md — Journal SSE emit (historyRow) on history writer + journal_depth tenant setting (D-04/D-05)
- [x] 10-03-PLAN.md — SIP backend: AMI PlayDTMF + validated sendDtmf + my-endpoint registration-state (D-32/D-33/D-35)
- [x] 10-04-PLAN.md — Frontend foundation: RTK endpoints/types/tags + historyRow prepend + shiftSession dial buffer + full ru/en copy (D-04/D-05/D-11…D-14/D-16/D-18/D-19/D-32/D-35)
- [x] 10-05-PLAN.md — SoftphoneJournal live blended feed (callback/open-card, N cap, empty+error) + journal_depth settings UI (D-01…D-05)
- [x] 10-06-PLAN.md — SoftphoneContacts 5-section unified catalog + ContactBookForm inline CRUD (ownership-gated) (D-11…D-14/D-25)
- [x] 10-07-PLAN.md — ARM CallHistoryPanel: Queue/Outbound/Personal segments + per-segment search (D-06…D-10)
- [x] 10-08-PLAN.md — SoftphoneWidget shell rework: remove fab + Tabs + mode prop + mount Journal/Contacts + redial/restore + registration/Recover + quality/devices (D-16…D-24/D-26/D-27/D-34)
- [x] 10-09-PLAN.md — Dual-mode SIP: useSipPhoneAmi facade + CallCenterAgentPage isSip branch + live-Asterisk checkpoint (D-24/D-31…D-35)

**Waves:** W1 {10-01, 10-02} · W2 {10-03} · W3 {10-04} · W4 {10-05, 10-06, 10-07} · W5 {10-08} · W6 {10-09}

---

## Phase 11 — Harness Layer (external black-box infrastructure)

**Canonical refs (фаза):**

- `packages/frontend/.idea/ARCHITECTURE.md`, `packages/backend/.idea/ARCHITECTURE.md` — MUST READ (public API / auth / multi-tenant conventions)
- Existing seed: `e2e/` (Playwright operator happy-path) + `.github/workflows/e2e.yml`
- Public surfaces only: HTTP `/api/*`, SSE `/api/callcenter/events`, Socket.IO AMI gateway, UI routes — **no** imports from `packages/*/src`

**Status:** Context gathered (2026-08-04) — ready for `/gsd-plan-phase 11`  
**Depends on:** — (независима от product-фаз; может идти параллельно с Phase 10 verify)

**Goal:** Построить отдельный каталог `/harness` вокруг production-приложения: Runner, Environment, Scenarios, Assertions, Metrics, Reporter, Observability. Harness работает как внешний пользователь (HTTP/UI/SSE/AMI), не меняет бизнес-логику, минимально трогает `packages/*`.

**Locked (D-H01…D-H06):** absorb `e2e/`; assertions API+SSE+UI (SQL точечно); Asterisk/realtime in plan; Vitest@harness / Jest@backend; harness-only OTel v1; minimal `GET /api/health`.

**Scope (in):**

- Корневой пакет `harness/` (TypeScript, npm workspace или standalone package)
- Backend black-box: API scenarios + Testcontainers/Compose environment + fixtures via public API
- Frontend black-box: Playwright scenarios (миграция/абсорбция существующего `e2e/`)
- Metrics + reporters (markdown / JSON / JUnit)
- Harness-side OpenTelemetry + structured logging
- CI wiring (эволюция `.github/workflows/e2e.yml`)

**Scope (out):**

- Переписывание unit/integration тестов внутри `packages/*`
- Миграция Jest → Vitest в backend package
- Внедрение OTel SDK внутрь NestJS/React без отдельного approval (только harness-side в v1; app OTel — v2)

**Asterisk / realtime (in scope for planning, staged delivery):**

- Environment profile `asterisk` (AMI/ARI/WSS endpoints via env)
- Scenarios gated by `requires: ['asterisk']` — skip when unreachable, run when `HAS_ASTERISK=1` / live lab
- SSE + Socket.IO `/ami-events` assertions as first-class (not deferred out of roadmap)
- Delivery still staged: PR env stub → PR live-lab scenarios (после доступа к подготовленному Asterisk)

**Requirements:** TBD (discuss → ADR / REQ после утверждения архитектуры)

**GSD workflow:**

| Шаг | Команда |
|-----|---------|
| 1 | Утверждение архитектуры (этот чат) |
| 2 | `/gsd-discuss-phase 11` — сценарии MVP, env strategy, CI |
| 3 | `/gsd-plan-phase 11` |
| 4 | `/gsd-execute-phase 11` — по PR-этапам |
| 5 | `/gsd-verify-work 11` |

**Status:** Planned (2026-08-04) — plan-checker PASSED; ready to execute  

**Plans:** 6/8 plans executed

Plans:

- [x] 11-01-PLAN.md — PR-1 Scaffold: harness workspace, Runner/registry, GET /api/health (D-H06, D-21)
- [x] 11-02-PLAN.md — PR-2 Environment: Testcontainers MySQL, readiness, API seed/teardown (D-08, D-15, D-16)
- [x] 11-03-PLAN.md — PR-3 Backend scenarios: auth + MOH CRUD + http assertions (D-01, D-02)
- [x] 11-04-PLAN.md — PR-4 Frontend absorb: e2e→harness UI + SSE heartbeat; keep e2e/ until CI green (D-H01, D-03, D-04)
- [x] 11-05-PLAN.md — PR-5 Metrics + Reporter: md/json/junit triad (D-11)
- [x] 11-06-PLAN.md — PR-6 Observability: harness-side OTel + structured logs (D-H05)
- [ ] 11-07-PLAN.md — PR-7 Asterisk/realtime: gated originate, ami-events, sql opt-in, harness-asterisk.yml (D-05–D-07, D-H03)
- [ ] 11-08-PLAN.md — PR-8 CI harden: harness.yml Node 22, workers=1, artifacts; then delete e2e/ (D-09, D-12, D-23, D-24)

**Waves:** W1 {11-01} · W2 {11-02} · W3 {11-03} · W4 {11-04} · W5 {11-05} · W6 {11-06} · W7 {11-07} · W8 {11-08}

---

## Phase 12 — DialplanAppsEditor refactor: reusable route-chain builder

**Canonical refs (фаза):**

- `packages/frontend/.idea/ARCHITECTURE.md` — **MUST READ** (FSD, SCSS-модули + токены `var(--color-*)`, `shared/ui`, Optimistic toggles, i18n)
- `packages/frontend/src/features/dialplan-apps/ui/DialplanAppsEditor/DialplanAppsEditor.tsx` — **primary target** (orchestrator: add/remove/update/reorder)
- `packages/frontend/src/features/dialplan-apps/ui/SortableActionItem/SortableActionItem.tsx` — строка действия (сейчас все параметры inline)
- `packages/frontend/src/features/dialplan-apps/model/registry.ts`, `model/types.ts` — реестр приложений (`IDialplanAppConfig`, `defaultParams`)
- `packages/frontend/src/features/dialplan-apps/ui/apps/*` — 13 app-компонентов (Group, Notify, CallerId, TrunkCarousel, Queue, Ivr, Prompt, ToRoute, Trunk, Exten, VoiceRobot, Hangup, Generic)
- `packages/frontend/src/features/dialplan-apps/ui/ActionTypeSelect/`, `ActionConditionFilters/`, `DialstatusSelect/`, `TimeGroupSelect/`
- **Consumers (все 3 host-а):** `features/routes/ui/RouteFormModal/RouteActionsTab.tsx`, `features/routes/ui/RouteFormModal/RoutePhonebooksTab.tsx`, `features/ivrs/ui/IvrMenuItemsEditor/IvrMenuItemsEditor.tsx`
- `packages/shared` — `IRouteAction`, `ActionType`, `DialStatus`
- `packages/frontend/src/features/routes/ui/RouteFormModal/` — эталон табов/модалок (Phase 3)
- Предыдущая фаза по этой области: Phase 6 (`06-13`/`06-14`/`06-16` — apps + registry + inline group editor)

**Status:** In Progress — 17 планов, waves 0…13 (`12-01`…`12-17`)
**Plans:** 2/17 plans executed

- [x] 12-01-PLAN.md
- [ ] 12-02-PLAN.md
- [ ] 12-03-PLAN.md
- [x] 12-04-PLAN.md
- [ ] 12-05-PLAN.md
- [ ] 12-06-PLAN.md
- [ ] 12-07-PLAN.md
- [ ] 12-08-PLAN.md
- [ ] 12-09-PLAN.md
- [ ] 12-10-PLAN.md
- [ ] 12-11-PLAN.md
- [ ] 12-12-PLAN.md
- [ ] 12-13-PLAN.md
- [ ] 12-14-PLAN.md
- [ ] 12-15-PLAN.md
- [ ] 12-16-PLAN.md
- [ ] 12-17-PLAN.md

**Depends on:** Phase 6 (registry + apps + call groups / notifications стабилизированы) — brownfield, не блокируется verify Phases 1–11

> **Граница фазы расширена в ходе `/gsd-discuss-phase 12` (2026-08-18).**
> Исходно фаза была FE-only. Пользователь явно включил бэкенд в scope и добавил две крупные темы:
> типизацию/валидацию `params` через весь стек и подсистему тенантных настроек. Полный список
> зафиксированных решений (D-01…D-59) — в `.planning/phases/12-.../12-CONTEXT.md`.

> **Граница сужена в ходе `/gsd-plan-phase 12` (2026-08-18).**
> Планировщик вернул `PHASE SPLIT RECOMMENDED`: 59 решений не помещаются в бюджет одного набора планов.
> Независимо к тому же выводу пришёл research (`12-RESEARCH.md` § `Phase Sizing Assessment`).
> Пользователь подтвердил разделение, отменив тем самым своё более раннее решение `vm_phase: full_in_12`:
> - **Кастомная голосовая почта (D-54…D-59) → Phase 12b.** Критический путь в самом конце (зависит от типов,
>   `RECORD_STATUS` в условиях и `notify`), новый класс данных со своей моделью угроз, плюс два вопроса дизайна
>   остались нерешёнными.
> - **D-46 (шаблоны цепочек), D-48 (dry-run), D-50 (обратный звонок) → Phase 13.** Ни одна из 12 поверхностей
>   утверждённого `12-UI-SPEC.md` их не покрывает — это самостоятельные экраны, а не поля в Sheet. Планировать их
>   здесь означало бы либо изобрести UI-контракт в обход approved-гейта, либо выпустить backend-only полуфичи.
> - **D-44, D-45, D-47, D-49 остаются в Phase 12** — это новые типы действий на generic schema-driven поверхности C.
>
> Также по итогам research исправлены два фактических дефекта в залоченных решениях: **D-55** (опции `k`
> недостаточно — нужен `hangup_handler_push` перед `Record()`) и **D-56** (`RECORD_STATUS` имеет 7 значений,
> пропущено `OPERATOR`). Оба уехали в Phase 12b вместе с голосовой почтой.

**Goal:** Отрефакторить `DialplanAppsEditor` в простой, функциональный и **переиспользуемый** конструктор цепочек маршрутов АТС: параметры приложения переезжают из перегруженной inline-строки в Sheet настройки шага, строка становится сканируемым «summary», редактор получает явный типизированный контракт и конфигурируемость (набор разрешённых действий, read-only, лимиты) для всех host-ов — маршруты, справочники маршрута, IVR-меню. **Плюс** — довести dialplan-приложения до конкурентного уровня: типизировать `params` через весь стек (shared → DTO → генератор), починить найденные баги генерации, обеспечить тенант-скоупинг целей набора и расширить функциональность приложений.

**Известные слабые стороны (гипотезы для research/discuss — подтвердить кодом):**

| # | Проблема | Где |
|---|----------|-----|
| W1 | `updateAction(id, field, value: any)` — stringly-typed путь (`params.*` / `condition.*`) вместо типизированного контракта; типы теряются на границе редактор↔app | `DialplanAppsEditor.tsx`, все `apps/*` |
| W2 | `useCallback` с зависимостью `[actions]` пересоздаёт `updateAction`/`removeAction` при любом изменении → `memo` на `SortableActionItem` не работает, перерисовываются все строки на каждое нажатие клавиши | `DialplanAppsEditor.tsx` |
| W3 | Все параметры приложения inline в строке → горизонтальный `overflow-x-auto`, `max-sm:` костыли, тесно на планшете/мобиле | `SortableActionItem.tsx` |
| W4 | Строку нельзя «прочитать»: нет summary шага (что реально делает действие), нет свёрнутого/развёрнутого состояния | `SortableActionItem.tsx`, `registry.ts` |
| W5 | Fallback `registry[action.type] \|\| registry.hangup` — неизвестный/новый тип молча рендерится как Hangup (риск порчи данных вместо явной ошибки) | `DialplanAppsEditor.tsx` |
| W6 | Нет валидации: пустой `type: ''` и незаполненные обязательные params сохраняются молча; нет per-step ошибок | editor + hosts |
| W7 | Хардкод Tailwind `bg-black/20` / `border-white/10` вместо design-токенов `var(--color-*)` — расхождение с ARCHITECTURE и Phase 3 | `SortableActionItem.tsx` |
| W8 | Нулевая конфигурируемость под host: нельзя ограничить набор действий (IVR-меню ≠ маршрут), нет read-only, нет `maxSteps`, нет override заголовков/i18n | props = только `{ actions, onChange }` |
| W9 | Нет операций продуктивности: дублировать шаг, вкл/выкл шаг, копировать/вставить, undo удаления | editor |
| W10 | DnD без `DragOverlay` / ограничения по вертикальной оси и без a11y-анонсов; `id` через `Date.now()+Math.random()` вместо `crypto.randomUUID()` | `DialplanAppsEditor.tsx` |
| W11 | Нет тестов на сам editor и на `SortableActionItem` (тесты есть только у части `apps/*`) | `features/dialplan-apps` |

**Scope (in):**

1. **Модалка настройки шага** — параметры приложения и условия (`dialstatus`, `time_group_uid`) переносятся в модалку/Sheet на базе `shared/ui/Dialog`; строка в списке остаётся компактной: номер, drag-handle, тип, summary, badges условий, действия строки
2. **Summary-контракт в registry** — расширение `IDialplanAppConfig`: человекочитаемый `summarize(action)` (i18n) + `validate(action)` + метаданные полей; строка и модалка питаются из одного источника
3. **Типизированный контракт редактора** — уход от `(id, field: string, value: any)` к типизированным обновлениям (patch action / patch params / patch condition); стабильные колбэки (`useCallback` без зависимости от всего массива, functional `onChange` или ref-паттерн) → отсутствие каскадных ре-рендеров
4. **Переиспользуемость** — props: `allowedTypes` / `excludedTypes`, `readOnly`, `maxSteps`, `labels`/i18n-namespace, `emptyState`; все 3 host-а (`RouteActionsTab`, `RoutePhonebooksTab`, `IvrMenuItemsEditor`) переводятся на новый контракт без регрессий
5. **UX цепочки** — сканируемый список шагов, дублирование шага, вкл/выкл шага, undo удаления, явная валидация с per-step ошибкой и блокировкой сохранения в host-е, понятный empty state, hint про порядок выполнения
6. **Явная обработка неизвестных типов** — вместо silent-fallback на Hangup: отдельное «unknown action» состояние, сохраняющее исходные `params` без потери данных
7. **Design tokens + a11y** — `var(--color-*)` / SCSS-модуль по паттерну проекта; `DragOverlay` + вертикальное ограничение, keyboard-reorder с ARIA-анонсами, focus-management при открытии/закрытии модалки
8. **Тесты + i18n** — unit/RTL на editor (add/remove/reorder/validate/readOnly/allowedTypes) и на summary/validate в registry; `ru` + `en` для всех новых строк
9. **Типизация `params` через весь стек** (D-08/D-09) — discriminated union в `packages/shared` → per-type DTO-валидация вместо `Record<string, any>` → выравнивание всех действующих `ActionType` с генератором dialplan
10. **Тенант-скоупинг целей набора** (D-21) — `${EXTEN}` не попадает в `Dial()`/`Queue()`/`Gosub()` напрямую; единая функция нормализации (`q{exten}_{uid}`, `e{exten}_{uid}`, `group_{exten}_{uid}`). Закрывает запрос «вызвать очередь/группу по маске маршрута»
11. **Фиксы генератора dialplan** (D-42/D-43) — условие в multi-line действиях применяется только к первой строке; битый `label`; отсутствующий time-group guard в IVR/phonebook-биндингах; теряемые params у `setclid_*`; двойной суффикс контекста в `toroute`
12. **Расширение условий шага** (D-22/D-23) — за пределы `DIALSTATUS`: `QUEUESTATUS`, `DEVICE_STATE`, переменная канала, результат `CURL`; UI = пресеты понятным языком + expert-режим
13. **Per-app усиление функциональности** (D-32…D-39) — `QUEUE_PRIO` и `announceoverride` у очереди; номер (`exten`) у групп вызова + подтверждение вызова, пропуск занятых, приветствие/MOH; линейная карусель транков; фикс двойного `SHELL()` в CallerID; корректные опции медиа-приложений
14. **Подсистема тенантных настроек** (D-19) — глобальные (ADMIN-guard) + тенантные, не пересекающиеся; на ней стоят флаги видимости raw-dialplan и блок-схемы (D-16/D-17)
15. **Чистка legacy** (D-28…D-31) — `tofax`/`asr`/`keywords` hard-remove; `sendmail`/`sendmailpeer`/`telegram` → `notify`; `text2speech` → внутренние TTS; PHP через `SHELL()`/`System()` → `CURL` → Nest
16. **Единое приложение «Воспроизведение»** (D-51…D-53) — складывает `Playback` + `BackGround` + `ControlPlayback`, приложение Asterisk выбирается по режиму; генератор берёт на себя язык (`langoverride` vs `Set(CHANNEL(language))`) и `Progress()` при `noanswer`; режим «выход по цифре» маркируется как меняющий поток управления. Устраняет инверсию имён `playprompt`/`playback`
17. **Новые типы действий на generic-поверхности** (D-44, D-45, D-47, D-49) — логические примитивы (метка / переход / ветвление, делает `label` осмысленным), расписание как действие, HTTP-запрос → переменная (результат доступен в условиях по D-22), сбор ввода пользователя (`Read` / `WaitExten`). Все четыре едут на schema-driven поверхность C из UI-SPEC, отдельных экранов не требуют

**Scope (out):**

- **Кастомная голосовая почта (D-54…D-59) — Phase 12b** (вынесено при планировании: критический путь в конце, новый класс данных со своей моделью угроз, два нерешённых вопроса дизайна). Старый тип действия `voicemail` до Phase 12b остаётся как есть
- **Шаблоны цепочек (D-46), dry-run маршрута (D-48), обратный звонок (D-50) — Phase 13** (нет поверхностей в утверждённом `12-UI-SPEC.md`)
- Граф-редактор / блок-схема dialplan с печатью и экспортом в PDF — **Phase 13** (в Phase 12 только флаг видимости)
- MCP-сервер + построение и редактирование маршрутов с помощью LLM — **Phase 13**
- ConfBridge как полноценный модуль (профили, PIN, admin/marked, запись, DTMF-меню) со своим UI — **отдельная фаза** (D-41)
- MWI (индикатор нового сообщения на телефоне) и прослушивание голосовой почты с трубки (аналог `VoiceMailMain`) — вне фазы; в проекте отсутствуют и сейчас
- ~~Тенантный контекст ящиков voicemail~~ — **снято:** `VoiceMail()` удаляется целиком (D-54), тенантность решается по построению
- Полный редизайн `RouteFormModal` целиком (только вкладки-потребители редактора)
- Удаление колонки `raw_dialplan` — **отменено** в discuss: колонка и UI остаются, видимость через настройку (D-16)

**Success criteria (draft):**

1. Строка шага читается без открытия: тип + summary параметров + условия; список из 8+ шагов не требует горизонтального скролла на 1280px и не ломается на 375px
2. Все параметры действия редактируются в модалке; сохранение/отмена модалки не теряет изменения остальных шагов
3. Ввод в модалке одного шага не вызывает ре-рендер остальных строк (проверяемо тестом/профилем) — W2 закрыт
4. `DialplanAppsEditor` используется всеми 3 host-ами через один контракт; IVR-меню видит только разрешённый набор действий
5. Пустой тип и незаполненные обязательные params явно подсвечены и блокируют сохранение в host-е
6. Неизвестный `action.type` отображается как unknown-шаг с сохранением `params` (не как Hangup)
7. `npm run lint`, `npm run test:frontend` зелёные; новые тесты покрывают add/remove/reorder/validate/readOnly/allowedTypes
8. i18n `ru` + `en` для всех новых/изменённых строк

**Requirements:** Locked decisions **D-01…D-53 + D-44, D-45, D-47, D-49** в `.planning/phases/12-dialplan-apps-editor-refactor-reusable-route-chain-builder/12-CONTEXT.md` (**49 отслеживаемых** — уточнено `check.decision-coverage-plan`; ROADMAP ранее указывал 48). Вне фазы: D-46/D-48/D-50 (Phase 13), D-54…D-59 (Phase 12b), D-40 (отменено самим CONTEXT), D-41 (сознательно частичное — только перевод действия на схему параметров)

**Plans:**

- [x] `12-01-PLAN.md` — Wave 0: characterization-тесты генератора (22 непокрытые ветви → 29/29)
- [ ] `12-02-PLAN.md` — tracer: «очередь по маске маршрута» сквозь все слои
- [ ] `12-03-PLAN.md` — discriminated union `params` + 29 per-type DTO + реестр DTO
- [x] `12-04-PLAN.md` — подсистема тенантных настроек (backend + миграция)
- [ ] `12-05-PLAN.md` — ядро генератора: multi-line условия, `label`, 5 call-site, `normalizeTarget`
- [ ] `12-06-PLAN.md` — расширенные условия шага + защита от петель и недостижимые шаги
- [ ] `12-07-PLAN.md` — ядро FE-редактора: reducer, undo, clipboard, unknown-тип
- [ ] `12-08-PLAN.md` — Sheet целиком: schema-поля, опции, условия, проекция ошибок
- [ ] `12-09-PLAN.md` — UI тенантных настроек с optimistic toggle
- [ ] `12-10-PLAN.md` — единое приложение «Воспроизведение» (backend + UI)
- [ ] `12-11-PLAN.md` — чистка legacy: PHP → внутренние endpoint'ы, `notify`, внутренние TTS
- [ ] `12-12-PLAN.md` — миграция данных `params` + hard-remove типов
- [ ] `12-13-PLAN.md` — per-app фиксы: транки, CallerID, очередь, exten, confbridge
- [ ] `12-14-PLAN.md` — `exten` у групп вызова + единая схема контекста с переходным `include`
- [ ] `12-15-PLAN.md` — группы вызова уровня Ring Group: подтверждение, пропуск занятых, MOH
- [ ] `12-16-PLAN.md` — новые типы действий: метка/переход/ветвление, расписание, HTTP, сбор ввода
- [ ] `12-17-PLAN.md` — финальный гейт: ручные проверки M1, M4…M9, M12 + полный прогон

**GSD workflow (рекомендуемый порядок):**

| Шаг | Команда |
|-----|---------|
| 1 | ~~`/gsd-discuss-phase 12`~~ — **done 2026-08-18**, решения D-01…D-59 в `12-CONTEXT.md` |
| 2 | ~~`/gsd-ui-phase 12`~~ — **done 2026-08-18**, `12-UI-SPEC.md` approved (12 поверхностей A…L) |
| 3 | `/gsd-plan-phase 12` — **research + PATTERNS + VALIDATION готовы 2026-08-18**; границы сужены |
| 4 | `/gsd-execute-phase 12` |
| 5 | `/gsd-ui-review 12` + `npm run test:frontend` |
| 6 | `/gsd-verify-work 12` → `/gsd-ship 12` |

**Verification:**

- Automated: `npm run lint`, `npm run test:frontend` (editor + SortableActionItem + registry summarize/validate + существующие `apps/*` тесты + `RoutePhonebooksTab.test.tsx`), `npm run test:backend` (per-type DTO-валидация + `dialplan.util.spec.ts` на все ветви генератора — **22 из 29 не покрыты** (уточнено research; ROADMAP ранее указывал 21) + `call-group-dialplan.util`)
- Manual: `/routes` → маршрут → «Действия» — собрать цепочку из 5+ шагов (queue → group → notify → hangup), настроить параметры в Sheet, переупорядочить drag и клавиатурой, дублировать и выключить шаг, сохранить → dialplan применяется как раньше; «Справочники» маршрута и IVR-меню — тот же редактор без регрессий; проверить 375px / 768px / 1280px
- Manual (Asterisk): маршрут с маской `_2XX` + действие «очередь по маске» → набор 201 попадает в очередь `q201_{uid}`; то же для группы; условие «очередь переполнена» отрабатывает через `QUEUESTATUS`; `dialplan show` подтверждает, что условие применяется ко всем строкам multi-line действий
- Manual-only чеклист M1…M12 (живой Asterisk, `packages/harness` отсутствует) — в `12-VALIDATION.md`. В Phase 12 закрываются **M1, M4…M9, M12** (план `12-17`); **M2, M3, M10, M11** относятся к голосовой почте и перенесены в Phase 12b

---

## Phase 12b — Кастомная голосовая почта вместо `VoiceMail()`

**Canonical refs (фаза):**

- `.planning/phases/12-dialplan-apps-editor-refactor-reusable-route-chain-builder/12-CONTEXT.md` — **залоченные решения D-54…D-59 живут здесь** (не дублируются, чтобы не разошлись)
- `.planning/phases/12-.../12-RESEARCH.md` — Pitfall по `Record()`/hangup handler, разбор `stt-engines`, `safeRecordFilePath`, WAV→PCM16, Open Questions 2–5
- `.planning/phases/12-.../12-PATTERNS.md` — scaffold модуля (`modules/notifications/`), `cc_display_tokens` + `DisplayTokenGuard`, AES-паттерн ключей провайдера
- `.planning/phases/12-.../12-UI-SPEC.md` — **Surface L переносится в эту фазу целиком**
- `packages/backend/src/modules/reports/cdr/` — `hasRecording`/`streamRecording`/access-scope, на которые садится вкладка сообщений
- `packages/backend/src/modules/stt-engines/`, `packages/backend/src/modules/ai-agents/`

**Status:** Pending (вынесено из Phase 12 при планировании 2026-08-18)
**Depends on:** Phase 12 (типизация `params`, `RECORD_STATUS` в расширенных условиях D-22, слияние notify D-28)

**Goal:** Заменить приложение Asterisk `VoiceMail()` собственной голосовой почтой: опциональное приветствие → `Record()` → уведомление через `notify` → расшифровка и саммаризация через `stt-engines` + LLM. Доступ к сообщениям — вкладка/фильтр в CDR-отчёте с кнопкой «Детализация» и плеером. Старый тип действия `voicemail` — hard-remove с миграцией существующих шагов.

**Scope (in):** D-54…D-59.

**Известные ловушки, зафиксированные до планирования:**

| # | Ловушка |
|---|---------|
| 1 | Опция `k` у `Record()` сохраняет **файл**, но канал всё равно завершается на отбое. Без `Set(CHANNEL(hangup_handler_push)=…)` **перед** `Record()` уведомление, запись в БД и расшифровка не запустятся ровно в том сценарии, ради которого `k` и вводится (D-55) |
| 2 | `RECORD_STATUS` имеет **7** значений, включая `OPERATOR` (опция `o`). Без него «нажал 0 для оператора» неотличимо от «нажал `#`» (D-56) |
| 3 | LLM-клиента в проекте **нет** — `ai-agents` это CRUD-реестр провайдеров, `ai-chat` зовёт внешний aiPBX. Нужен тонкий OpenAI-совместимый клиент с AES-ключом по паттерну `CcAiProvider.encrypted_api_key` |
| 4 | `safeRecordFilePath` жёстко добавляет `.mp3` и отдаёт `audio/mpeg` — прямой реюз даст 404 на `.wav`. Access-scope и `Range` переиспользуются, резолвер пути — нет |
| 5 | STT ждёт headerless PCM16 8 kHz — заголовок WAV снимать разбором чанков, не «первыми 44 байтами» |
| 6 | Для токен-ссылки (D-59) в проекте есть лучший прецедент, чем второй JWT `audience`: `cc_display_tokens` + `DisplayTokenGuard` (opaque-токен с TTL и отзывом, `req.user` без `sub`/`level`). `cdr-public.controller.ts` для голосовой почты **запрещён** |

**Открытые вопросы к discuss:** чем триггерить STT/LLM (очередь против inline); числовой порог «вложение против ссылки»; политика ретраев; формат записи (`wav` рекомендован); подтверждение владельцем инфраструктуры, что сообщения лежат на том же томе, что записи разговоров.

**GSD workflow:** `/gsd-discuss-phase 12b` → `/gsd-plan-phase 12b` → `/gsd-execute-phase 12b` → `/gsd-secure-phase 12b` (новый класс персональных данных) → `/gsd-verify-work 12b`

---

## Phase 13 — Визуальный конструктор маршрутов и автоматизация

**Status:** Pending (собирает отложенное из Phase 12)

**Goal:** Визуальное представление и автоматизация построения маршрутов поверх редактора, доведённого в Phase 12.

**Scope (in):**

1. **Блок-схема dialplan** — визуальное отображение цепочки с печатью и экспортом в PDF (в Phase 12 сделан только флаг видимости, D-18)
2. **MCP-сервер + построение и редактирование маршрутов с помощью LLM** — анализ и развитие действующего MCP на бэкенде
3. **Шаблоны цепочек маршрутов** (D-46) — самостоятельная поверхность, отсутствует в `12-UI-SPEC.md`
4. **Dry-run / тест маршрута без реального звонка** (D-48) — самостоятельная поверхность результата
5. **Обратный звонок (callback) как действие маршрута** (D-50) — требует своего экрана настройки

**Requirements:** D-46, D-48, D-50 из `12-CONTEXT.md` + решения собственного discuss.

**Depends on:** Phase 12 (типизированный контракт редактора и корректный генератор — основание и для схемы, и для LLM-построения)

**GSD workflow:** `/gsd-discuss-phase 13` → `/gsd-ui-phase 13` (три новых поверхности) → `/gsd-plan-phase 13`
