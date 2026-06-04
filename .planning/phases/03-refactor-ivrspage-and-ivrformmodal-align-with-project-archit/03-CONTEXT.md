# Phase 3: IVR page & form modal UI alignment — Context

**Gathered:** 2026-06-04  
**Status:** Ready for planning

<domain>
## Phase Boundary

Рефакторинг `IvrsPage` и `IvrFormModal` под `packages/frontend/.idea/ARCHITECTURE.md`: SCSS-модули + `var(--color-*)`, `shared/ui`, без Tailwind в `pages/`/`features/`.

**In scope:**
- Страница `/ivrs`: паритет с `MohPage` (Phase 2) — header, Card, таблица, Skeleton, empty state
- Модалка IVR: таб-бар без двойной полосы (визуал как `RouteFormModal`), UX всех вкладок, переименования вкладок
- `IvrPromptsEditor` + `IvrMenuItemsEditor`: контраст секций, кнопки на `Button`
- `IvrMainTab`: «Активно» вверху, явный главный переключатель; единые отступы/стили полей
- i18n `ru` + `en` для новых/изменённых строк

**Out of scope:**
- Backend, `ivrsApi`, логика dialplan / menu items
- Вынос общего `Tabs` в `shared/ui` (отдельная инициатива)
- Рефакторинг самого `RouteFormModal.tsx` (только как визуальный эталон)
</domain>

<decisions>
## Implementation Decisions

### IvrsPage (table shell)
- **D-01:** **Полный паритет с MohPage:** icon badge, gradient title, primary CTA с shadow, `Card` + `CardHeader` + `CardContent p-0`, `IvrsPage.module.scss`.
- **D-02:** **CardTitle** над таблицей — да; ключ i18n, напр. `ivrs.listTitle` («Список IVR» / en equivalent).
- **D-03:** Loading: **`Skeleton`** rows в `IvrsTable` (как MohTable Phase 2), не текст «Загрузка…».
- **D-04:** Empty state: **enhanced** — иконка + title + hint (паттерн `moh.empty.*`), акцент на CTA «Добавить IVR».
- **D-05:** Убрать **`motion.div`** wrapper на странице (как MOH D-09/D-10 — без page-level y-motion).

### IvrFormModal — таб-бар и shell
- **D-06:** Таб-бар: **одна** граница под табами + primary-индикатор активной вкладки (как `RouteFormModal` — без `border-b` на контейнере **и** `border-b-2` на кнопке одновременно). Реализация через **`IvrFormModal.module.scss`** + токены `var(--color-*)` (ARCHITECTURE), не дублировать Tailwind из features.
- **D-07:** Проработать **UX всей модалки**: единые отступы body/footer, `Dialog`/`DialogFooter` из `shared/ui`, SCSS для layout.
- **D-08:** Переименование вкладок (i18n only, id табов в коде можно оставить):
  - `ivrs.tabs.sounds_prompts`: **«Фразы»** (en: «Phrases» или «Prompts» — planner выбирает короткий en-вариант)
  - `ivrs.tabs.routes`: **«Пункты»** (en: «Menu items» / «Items»)
- **D-09:** Убрать em dash в placeholder селекта записей (`ivrs.prompts.selectPrompt`) — обычный дефис или без тире (ARCHITECTURE).

### Вкладка «Основные» (IvrMainTab)
- **D-10:** Чекбокс **«Активно»** — **первый элемент** вкладки, визуально выделен (главный переключатель: отдельная строка/панель, не внизу формы).
- **D-11:** Остальные поля: **общий стиль** с остальными вкладками (Label/Input/Checkbox, отступы); при рефакторе — SCSS-модуль или классы страницы модалки, `var(--color-*)` вместо Tailwind на feature-слое.

### Вкладка «Фразы» (IvrPromptsEditor)
- **D-12:** Секция **не сливается** с фоном модалки: панель `color-mix(muted)` + `border` (паттерн MohFormModal playlist / Phase 2).
- **D-13:** Кнопки up/down/remove/add → **`Button` `variant="ghost"` `size="icon"`** (и default для add), как MOH D-14.
- **D-14:** SCSS: заменить `var(--border)`, `var(--background)` на **`var(--color-*)`** из globals `@theme`.

### Вкладка «Пункты» (IvrMenuItemsEditor)
- **D-15:** Та же **визуальная оболочка секции**, что у «Фразы» (контраст с фоном модалки); без изменения логики `DialplanAppsEditor`.
- **D-16:** Стили кнопок/add/remove — по возможности **`Button`** из `shared/ui` (уже частично есть).

### Claude's Discretion
- Точная разметка «Активно» (Card-like row vs bordered HStack с accent).
- En-переводы для «Фразы» / «Пункты» / `ivrs.listTitle`.
- Нужен ли отдельный `IvrMainTab.module.scss`.
- Минимальные правки `IvrsTable.tsx` vs только SCSS.

### Areas not discussed (defaults from roadmap)
- **Modal tabs implementation detail:** SCSS по `.module.scss` RouteFormModal, не общий `Tabs` в shared (D-06).
- **Sketch / 3 variants:** не требуется — эталоны MohPage + RouteFormModal.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture & planning
- `packages/frontend/.idea/ARCHITECTURE.md` — FSD, SCSS modules, `var(--color-*)`, Stack, `shared/ui`, i18n, no em dash
- `.planning/CANONICAL_REFS.md`
- `.planning/ROADMAP.md` — Phase 3
- `.planning/REQUIREMENTS.md` — REQ-201 … REQ-206
- `.planning/phases/02-moh-page-redesign/02-CONTEXT.md` — MohPage/Modal patterns (D-01…D-16 carry-forward)

### Primary code targets
- `packages/frontend/src/pages/IvrsPage/IvrsPage.tsx` + `IvrsPage.module.scss` (new)
- `packages/frontend/src/features/ivrs/ui/IvrFormModal/IvrFormModal.tsx` + `IvrFormModal.module.scss` (new)
- `packages/frontend/src/features/ivrs/ui/IvrMainTab/IvrMainTab.tsx`
- `packages/frontend/src/features/ivrs/ui/IvrPromptsEditor/IvrPromptsEditor.tsx` + `.module.scss`
- `packages/frontend/src/features/ivrs/ui/IvrMenuItemsEditor/IvrMenuItemsEditor.tsx`
- `packages/frontend/src/features/ivrs/ui/IvrsTable/IvrsTable.tsx`
- `packages/frontend/src/shared/config/locales/ru.ts`, `en.ts` — `ivrs.*`

### Visual references
- `packages/frontend/src/pages/MohPage/MohPage.tsx` + `MohPage.module.scss` — page shell
- `packages/frontend/src/features/moh/ui/MohFormModal/` — playlist panel + Button pattern
- `packages/frontend/src/features/routes/ui/RouteFormModal/RouteFormModal.tsx` — tab underline pattern (single border)
- `packages/frontend/src/features/routes/ui/RouteFormModal/RouteFormModal.module.scss` — tab SCSS tokens

</canonical_refs>

<code_context>
## Existing Code Insights

### Problems today
- `IvrFormModal`: `HStack` с `border-b` + `Button` с `border-b-2` на active → **двойная полоса**
- `IvrPromptsEditor.module.scss`: shadcn-legacy vars (`var(--border)`, `var(--primary)`) → плохой контраст на светлой теме
- `IvrsPage`: Tailwind + `motion.div`; нет Card shell как MohPage
- `IvrMainTab`: «Активно» внизу списка полей

### Reusable assets
- `MohPage` / `MohTable` / `MohFormModal` после Phase 2
- `Table`, `Skeleton`, `Button`, `Dialog`, `Card` from `@/shared/ui`
- `RouteFormModal` tab indicator: absolute 2px primary bar under active tab (replicate in SCSS)

### Integration points
- Tab ids in code: `main`, `sounds_prompts`, `routes` — менять только labels в i18n unless planner prefers key rename
- `IvrsTable.test.tsx` — run after table changes

</code_context>

<specifics>
## Specific Ideas

- Пользователь: раздел «Записи» сливается с фоном → вкладка переименовать в **«Фразы»**
- «Вложенные маршруты» → **«Пункты»**
- «Активно» — главный переключатель, **вверху** вкладки «Основные»
- Страница как MohPage; таблица со Skeleton и rich empty state

</specifics>

<deferred>
## Deferred Ideas

- Общий компонент `ModalTabs` в `shared/ui` для Route + IVR + будущих модалок
- Полный SCSS-рефактор `RouteFormModal.tsx` (сейчас Tailwind в TSX)
- Редизайн dialplan editor внутри «Пункты»

</deferred>

---

*Phase: 03-refactor-ivrspage-and-ivrformmodal-align-with-project-archit*  
*Context gathered: 2026-06-04*
