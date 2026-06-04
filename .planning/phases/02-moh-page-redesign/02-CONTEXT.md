# Phase 2: MohPage redesign — Context

**Gathered:** 2026-06-04  
**Status:** Ready for planning

<domain>
## Phase Boundary

Визуальный и layout-редизайн страницы `/moh`: header (иконка, заголовок, подзаголовок, CTA), контейнер таблицы, loading/empty, motion по решениям ниже. Три sketch-варианта → выбор пользователем → **одна** production-реализация.

**Расширено на discuss:** улучшение кнопок playlist editor в `MohFormModal` (не полный редизайн modal).

**Вне фазы:** backend/API MOH, три параллельные prod-реализации, drag-and-drop playlist, поиск/фильтр таблицы, полный редизайн modal shell.
</domain>

<decisions>
## Implementation Decisions

### Sketch strategy (3 variants)
- **D-01:** Три варианта: **1 безопасный** (близко к паттерну VoiceRobots) + **2 смелее** по компоновке/визуалу.
- **D-02:** Свой **MOH-стиль** в рамках `packages/frontend/.idea/ARCHITECTURE.md` — не копия 1:1 другой страницы.
- **D-03:** Primary CTA «Создать класс» — **разный в каждом sketch**; финальный выбор при `sketch --wrap-up` / UI-SPEC.
- **D-04:** Акцент header-иконки: **indigo** badge (`bg-indigo-500/10`, иконка `text-indigo-500`) — как VoiceRobots / ServiceRequests.

### Page layout & table shell
- **D-05:** Размещение `Card` (page vs `MohTable`) — **может отличаться между sketch-вариантами**; граница page/table фиксируется **победившим** вариантом.
- **D-06:** **CardHeader** с заголовком секции над таблицей — **да** (эталон: VoiceRobots `CardTitle`).
- **D-07:** Объём рефакторинга `MohTable` (убрать outer Card или только classNames) — **planner по winner sketch**.
- **D-08:** Поиск/фильтр в таблице — **не в phase 2** (backlog).

### Motion & loading
- **D-09:** Page-level `motion.div` на `MohPage` — **только если есть в sketch**; prod следует winner.
- **D-10:** Анимация контента таблицы: **лёгкий fade** (opacity), **без** translate `y`.
- **D-11:** Loading: **`Skeleton`** из `@/shared/ui` вместо текста «Загрузка…», если winner/sketch предполагает card-shell.
- **D-12:** `prefers-reduced-motion` — на усмотрение planner (рекомендуется отключать motion при winner с анимацией).

### MohFormModal (partial — phase 2)
- **D-13:** **Полный** редизайн modal (custom overlay/`.module.scss` shell → shadcn `Dialog`) — **отдельная фаза**, не сейчас.
- **D-14:** **В scope phase 2:** переделать **кнопки playlist editor** (up/down/remove/add track) на паттерны `shared/ui` (`Button` / icon buttons), убрать raw `<button className={cls.moveBtn}>` где возможно; сохранить текущую логику reorder без DnD.
- **D-15:** **Допустимо при необходимости:** padding/spacing modal, заголовок и footer-кнопки (Cancel/Save) — без перестройки playlist UI и без смены полей формы.
- **D-16:** Playlist picker (`<select>`), radio sort, empty playlist block — **не менять** в этой фазе (кроме стилей, затронутых D-14).

### Claude's Discretion
- Точная структура `MohTable` после winner (Card location, SCSS vs Tailwind).
- `prefers-reduced-motion` implementation detail.
- Нужны ли точечные правки D-15 после page redesign (только если визуально ломается).

### Areas not discussed (defaults)
- **Empty state** таблицы: не обсуждалось — planner может усилить (иконка + CTA) только если входит в winner sketch; иначе оставить текущий row empty или улучшить минимально под новый card.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture & GSD
- `packages/frontend/.idea/ARCHITECTURE.md` — FSD, shadcn, Stack, i18n, TanStack Table, Motion
- `.planning/CANONICAL_REFS.md` — индекс
- `.planning/ROADMAP.md` — Phase 2 scope, REQ-101…106
- `.planning/REQUIREMENTS.md` — REQ-101…106
- `.planning/phases/01-moh-playlist/CONTEXT.md` — brownfield MOH, не переписывать API

### Primary code targets
- `packages/frontend/src/pages/MohPage/MohPage.tsx`
- `packages/frontend/src/features/moh/ui/MohTable/MohTable.tsx`
- `packages/frontend/src/features/moh/ui/MohTable/MohTable.module.scss`
- `packages/frontend/src/features/moh/ui/MohFormModal/MohFormModal.tsx` — playlist buttons only (D-14, D-15)
- `packages/frontend/src/shared/ui/Skeleton/Skeleton.tsx`
- `packages/frontend/src/shared/config/locales/ru.ts`, `en.ts` — ключи `moh.*`

### Visual reference pages (patterns, not copy-paste)
- `packages/frontend/src/pages/VoiceRobotsPage/VoiceRobotsPage.tsx` — safe sketch baseline
- `packages/frontend/src/pages/ServiceRequestsPage/ServiceRequestsPage.tsx` — card + header pattern

### Product
- `.idea/MOH_MODERN_DELTA_PRD.md` — MOH delta context (no backend change in phase 2)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Card`, `CardHeader`, `CardTitle`, `CardContent` — `@/shared/ui` (VoiceRobots pattern)
- `Text` variant `h1` / `muted` — gradient title pattern
- `Skeleton` — `@/shared/ui/Skeleton`
- `Button`, `VStack`, `HStack`, `Flex` — layout/actions
- `MohTable` — TanStack Table, empty row, loading in Card
- `MohFormModal` — custom overlay modal; playlist uses SCSS buttons `moveBtn`, `removeBtn`, `addBtn`

### Established Patterns
- Новые list-страницы: icon in tinted rounded box + gradient title + glass Card with section header
- Старый MOH/Numbers: plain `h1` + `motion.div` wrapper — **заменяется** winner direction
- `MohFormModal` still custom div overlay — **не мигрировать на Dialog** в phase 2

### Integration Points
- `MohPage` dispatches `mohActions.openCreateModal()` — CTA unchanged semantically
- `MohTable` renders `MohFormModal` — modal stays mounted from table feature
- i18n: `moh.title`, `moh.subtitle`, `moh.add`, table keys already in locales

</code_context>

<specifics>
## Specific Ideas

- Sketch: 1 safe (VoiceRobots-like) + 2 experimental layouts/skins
- Indigo icon badge for MOH page identity
- Compare CTA styles across sketches before lock-in
- Modal: improve playlist control buttons in this phase; full modal UX later

</specifics>

<deferred>
## Deferred Ideas

- Полный редизайн `MohFormModal` (Dialog, playlist UX overhaul) — отдельная фаза
- Drag-and-drop playlist ordering
- Table search/global filter UI
- Приоритет между deferred items — **без предпочтения** (любой порядок)

### Reviewed Todos (not folded)
- None

</deferred>

---

*Phase: 02-moh-page-redesign*  
*Context gathered: 2026-06-04*
