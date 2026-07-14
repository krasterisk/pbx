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

**Plans:** 5 plans

Plans:
- [x] 05-01-PLAN.md — DialplanApplyService: консолидация 4 копий AMI UpdateConfig батч-логики (routes.controller, ai-webhook.controller, mcp-tools.service, dialplan-subroutines.service) в общий сервис
- [x] 05-05-PLAN.md — Bindings backend: таблица route_phonebook_bindings + миграция, чистка invert/actions, bindings CRUD в маршрутах, per-binding dialplan `pb_bind_{uid}_{vpbx}` + прошивка apply + реген-триггеры, lookup-test endpoint
- [x] 05-02-PLAN.md — AI-платформа: каркас Domain AI Adapter (Tools/State/Knowledge), фикс cross-tenant closure в MCP, аудит MCP в action_logs, per-tenant подтверждения (default OFF, включая update_route), PhonebooksAiAdapter (7 tools + update_route), snapshot summary + KB-блок
- [ ] 05-03-PLAN.md — Frontend: вкладка «Справочники» в RouteFormModal (playlist-паттерн, пресеты + custom DialplanAppsEditor), чистка PhonebookFormModal + демо-тест lookup, подраздел AI Chat в SellerSettingsForm, i18n ru/en
- [ ] 05-04-PLAN.md — E2E/UAT: финальный гейт + документация .docs, checkpoint регистрации tools в aiPBX, checkpoint AI-сценариев D-21 с реальным звонком

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
