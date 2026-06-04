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

**Status:** Planned (03-UI-SPEC, 03-RESEARCH, 03-01/03-02 plans)  
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
