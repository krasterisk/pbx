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

**Status:** Planned (3 plans)  
**Plans:** `04-01` shared + IvrTtsService · `04-02` dialplan + internal + preview · `04-03` IvrPromptsEditor UI  
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
