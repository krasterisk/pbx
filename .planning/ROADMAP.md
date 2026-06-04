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

**Status:** Planned  
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
