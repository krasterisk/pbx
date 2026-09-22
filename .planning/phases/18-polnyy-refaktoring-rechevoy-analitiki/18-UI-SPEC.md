---
phase: "18"
slug: "polnyy-refaktoring-rechevoy-analitiki"
status: approved
reviewed_at: "2026-09-22T10:05:00Z"
shadcn_initialized: false
preset: none
created: "2026-09-22"
---

# Phase 18 — UI Design Contract

> Визуальный и интеракционный контракт полного рефакторинга **речевой аналитики**:
> селект проекта на маршруте, журнал «Разговоры», conversation `Sheet`, загрузка,
> редактор метрик, стандартный дашборд, API-токены, настройки модуля.
>
> Источники: `18-CONTEXT.md` (D-01…D-50), `18-RESEARCH.md`, `packages/frontend/.idea/ARCHITECTURE.md`
> (обязательный layout law), эталоны `15-UI-SPEC` / `09-UI-SPEC` / page+table канон.
>
> **Не** повторять `.planning/initiatives/ai-products/SPEECH-ANALYTICS-UX-SLICE.md`.
> **Не** переносить `DashboardBuilder`. **Не** проектировать отдельную страницу «Отчёты».
> Золотой набор / CLI eval / живой UAT harness - вне кабинетного UI (кнопки в кабинете нет).

---

## Design System

| Property | Value |
|----------|-------|
| Tool | **none** - рукописная система `packages/frontend/src/shared/ui` + Radix; `components.json` отсутствует. shadcn CLI **не** инициализировать (канон Phase 8/9/12/15 + ARCHITECTURE: Tailwind только в `shared/ui`) |
| Preset | not applicable |
| Component library | Radix-обёртки в `shared/ui/*` + CVA (`Button`, `Dialog`, `Sheet`, `Select`, `Switch`, `Tabs`, `DataTable`, `Progress`, `Card`, `Badge`, `Tooltip`/`InfoTooltip`, `AudioPlayer`, …) |
| Icon library | `lucide-react@0.475.0` only. Unicode-эмодзи в UI **запрещены** ([ARCHITECTURE.md](packages/frontend/.idea/ARCHITECTURE.md) «No emoji icons») |
| Font | `Inter` через `--font-sans` из `globals.css` `@theme` |
| Styling | В `features/` / `pages/` / `widgets/` - **только** SCSS-модули + `var(--color-*)` / `var(--radius-*)` / `var(--z-index-*)` / `color-mix()`. Tailwind utility classes в JSX этих слоёв **запрещены** |
| Layout | Только `VStack` / `HStack` / `Flex` из `@/shared/ui/Stack`. Нативные `div`/`span`/`button`/`input`/`label`/`select` выше `shared` **запрещены**, кроме documented exception `formBody` / `scrollBody` / table scroll wrapper |
| State | RTK Query для списков/мутаций; локальный `useState` для черновиков форм. Optimistic `Switch` - MUST (см. Architecture Lock) |
| i18n | `useTranslation()`; ключи в `shared/config/locales/ru.ts` **и** `en.ts`. Длинное тире `—` (U+2014) в UI-строках **запрещено** - только `-` или запятая |
| Placement | Страницы модуля под `ModuleShell` / hub `speech_analytics`; conversation detail - `Sheet` со стабильным URL, не отдельный fullscreen без shell |

### shadcn gate - resolved, not asked

`components.json` нет, но design system уже есть (`shared/ui`, 42 папки). Инициализация shadcn противоречила бы ARCHITECTURE (Tailwind выше `shared/ui` запрещён). `Tool: none`. Третьих registry-блоков нет.

### Architecture Lock (обязательно)

Каждая новая поверхность Phase 18 **обязана** соблюдать `packages/frontend/.idea/ARCHITECTURE.md`. Ниже - сжатый канон с привязкой к файлу; исполнитель читает полный документ.

| Тема | Правило (кратко) | Цитата / якорь |
|------|------------------|----------------|
| FSD layers | UI аналитики: тонкие `pages/SpeechAnalytics*` (оркестраторы ≤50-70 строк) + логика в `features/speechAnalytics/ui/*` (+ точечные правки `features/routes`, `features/reports` CDR). Entities - атомарные бейджи/метки при необходимости. Не класть бизнес-логику в `pages/` | «Тонкие страницы», «Строгие архитектурные правила FSD» |
| shared/ui vs feature SCSS | Примитивы только из `@/shared/ui`. Кастом - `[Name].module.scss` с `var(--color-*)`, не Tailwind в feature JSX | «Стилизация», таблица Tailwind vs SCSS |
| Tailwind scope | Tailwind **только** внутри `shared/ui`. В `features/pages/widgets/entities` - запрет | таблица «Отношение Tailwind и SCSS-модулей» |
| CSS tokens | Единственный источник - `src/app/styles/globals.css` `@theme`. Запрет `hsl(var(--border))`. Прозрачность - `color-mix()`. Z-index только `var(--z-index-*)` | «Система дизайн-токенов» |
| Stack | Layout через `VStack`/`HStack`/`Flex`, не `div`+flex | «Позиционирование (Layout)» |
| Text | Весь видимый текст через `<Text>` / `<Typography>` | «Строгий отказ от базовых HTML-тегов» |
| Sheet / modal / form | Conversation detail - `Sheet` (D-06). Form create/edit - `Dialog` канон `UserFormModal` (shell / formBody / footer). Large + tabs - `DialogContent size="large"` + статичная высота оболочки | «Модальные окна форм», «scrollBody» |
| Tabs | Одна линия контейнера + 2px underline активного таба с `margin-bottom: -1px`. Предпочтительно SCSS вариант A; Radix `shared/ui/Tabs` допустим при том же визуале | «Паттерн табов в модалках» |
| Table | Журнал / токены / проекты: канон list page + `[Name]Table` + `DataTable`. Row-actions - только `TableRowActions`/`TableRowAction` (`Pencil`/`Copy`/`Trash2` без className). Hybrid overflow-x / mobile-card | «Паттерн страницы списка и таблицы», «Table row actions» |
| Optimistic Switch | Любой `Switch`, сразу пишущий на сервер из RTK cache (пауза компании, права моделей) - `onQueryStarted` + `updateQueryData` + `undo()` + toast. Не только `invalidatesTags` | «Optimistic toggles (MUST)» |
| InfoTooltip | Подсказки у неявных полей (селект проекта, шаблоны, публикация, шкалы) - `InfoTooltip` у лейбла, не длинный текст под полем. Rich text: `\n` + `**bold**`, без `—`, без dialplan-жаргона | «Подсказки - только InfoTooltip» |
| Focus ring | `ring-inset` на контролах внутри scrollBody | «Focus ring inset» |
| i18n | ru+en словари обязательны | «Локализация» |
| Responsive | 360-2560; grid 1fr на ≤640px; toolbar wrap на phone | «Адаптивность» |

**Новых CSS custom properties фаза не добавляет** (кроме локальных SCSS-переменных ширины sheet / progress в модуле фичи).

---

## Component Inventory

Enumerated by `node -e "const fs=require('fs');const d='src/shared/ui';const n=fs.readdirSync(d,{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>e.name).sort();console.log(n.length);console.log(n.join(', '));console.log(require('./package.json').name+'@'+require('./package.json').version);"` — 42 components — `@krasterisk/frontend@4.4.7` (рукописная система в `src/shared/ui`, отдельного npm design-system пакета нет) — 2026-09-22.

Полный список (42): AudioPlayer, Avatar, Badge, BulkDeleteDialog, Button, Card, Checkbox, CommandPalette, DataTable, Dialog, DropdownMenu, FileImportButton, Input, Label, Loader, ModuleLockedPage, MultiSelect, Pagination, PasswordInput, Popover, Progress, RadioCards, RecordingButton, ScrollArea, SegmentedControl, Select, Separator, Sheet, Skeleton, Sparkline, Stack, Switch, Table, TableRowActions, TableSelectionBanner, Tabs, TagInput, Text, Textarea, Tooltip, VideoSurface, WebhookAuthConfig.

Таблица ниже - **не закрытый allowlist**, а карта «что берём под нужды этой фазы».

| Нужда фазы | Компонент | Переиспользование / комментарий |
|------------|-----------|----------------------------------|
| Селект проекта на маршруте | `Select` + `Label` + `InfoTooltip` | Встраивается в `RouteFormModal` / `RouteGeneralTab` рядом с записью (D-02) |
| Журнал «Разговоры» | page shell + `DataTable` + toolbar `Button` | Канон `pages/ContextsPage` / `features/trunks/ui/TrunksPage` + `DataTable` |
| Progress upload/export | `Progress` + `Text` | Полоса «готово / всего» на журнале; waiting Excel |
| Conversation detail | `Sheet` + `Tabs` | Стабильный URL; вкладки Аналитика / Расшифровка / Стоимость |
| Плеер upload/API | `AudioPlayer` | Только вкладка «Расшифровка»; PBX - плеер остаётся в CDR |
| Upload form | `Dialog` (`UserFormModal` shell) + `FileImportButton` / file input wrapper + `Select` | Одна форма на файл и пачку (D-14) |
| Metric editor | `Dialog` `size="large"` + tabs + `Textarea`/`Input`/`Switch`/`Select` | Секции aiPBX; ссылка на `NotificationIntegrationsPage` |
| Dashboard stats | `Card` + `Text` + Recharts в feature SCSS | Стандартный экран, не builder |
| Insights block | `Card` + `Button` + `Badge` | Кнопка запуска, не auto-fetch |
| API tokens | list page + `DataTable` + `Dialog` confirm card | Секрет один раз |
| Module pause / models | `Switch` (optimistic) + `Select` | Настройки модуля |
| Module locked / entitlement | `ModuleLockedPage` | Когда модуль не куплен / нет доступа в hub |
| Row actions | `TableRowActions` / `TableRowAction` | Открыть sheet / удалить / пересобрать (по ролям) |
| Destructive confirm | `Dialog` / `BulkDeleteDialog` | Удаление разговора / проекта / revoke token |
| CDR actions | существующий CDR player + `Button` | «Аналитика», «Получить аналитику», upload на странице CDR |
| AI confirm card | существующая Phase 15 diff/confirm card | Маршрут set/clear project; секрет токена в карточке один раз |

**Новых базовых примитивов в `shared/ui` фаза не требует.** Если `Progress` не реэкспортирован из `shared/ui/index.ts` - добавить export, не дублировать Progress в feature.

Источник токенов: `packages/frontend/src/app/styles/globals.css` `@theme`.

---

## Spacing Scale

Кратные 4, набор как Phase 8/9/15:

| Token | Value | Использование в Phase 18 |
|-------|-------|--------------------------|
| xs | 4px | Gap иконка↔лейбл `InfoTooltip`; gap в badge |
| sm | 8px | Gap поля формы (`VStack gap="8"`); gap кнопок footer; gap toolbar icons |
| md | 16px | Padding ячеек; padding card body; gap между фильтрами журнала |
| lg | 24px | Page shell `VStack gap="24"`; зазор секций дашборда / редактора |
| xl | 32px | Вертикальный ритм крупных блоков дашборда (stats → insights) |
| 2xl | 48px | Мин. высота empty-state до иконки |
| 3xl | 64px | Не обязателен |

Exceptions:

- **44px** - min touch-target icon-only (row actions на phone, закрытие Sheet, toolbar icon buttons). WCAG 2.5.5.
- **12px** - допустим только существующий `gap="12"` в page header (`HStack` title block) - не размножать в теле таблиц.
- **1px** - borders `var(--color-border)`.
- **Sheet width:** desktop `min(50vw, 40rem)` (канон Phase 12 sheet / dialplan StepSheet denseness); phone full-width `100vw` / `max-sm` safe insets. Не фиксировать произвольный `w-[720px]` без mobile fallback.
- Progress bar height **8px** track (sm), не толще 12px.

---

## Typography

Ровно 4 размера / 2 веса (канон Phase 8/9/15):

| Role | Size | Weight | Line Height | Использование |
|------|------|--------|-------------|---------------|
| Body | 14px | 400 | 1.5 | Ячейки журнала, саммари, transcript, cost rows, form helper через Text muted |
| Label | 12px | 600 | 1.4 | Badges статуса прогона, подписи осей/легенд, «не списано», timestamps, toolbar meta |
| Heading | 16px | 600 | 1.3 | Заголовки секций дашборда / sheet tabs labels / card titles / empty headings |
| Display | 28px | 600 | 1.2 | Page `Text variant="h1"` заголовки журнала / дашборда / проектов (через page shell; визуально нормализовать к Display, не плодить пятый размер) |

Запрещено: пятый размер в feature SCSS; emoji; em dash `—` в copy.

Маппинг на `Text`: Body → `default`/`muted` (14/sm); Label → `xs`/`small` + semibold через SCSS при необходимости; Heading → `h3`/`h4` осторожно (h3 в Text сейчас `text-xl` - в feature page titles использовать page-shell `.title` градиент как Trunks/Moh, не сырой `text-3xl` Tailwind в pages).

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `var(--color-background)` `#09090b` | Фон страниц модуля |
| Secondary (30%) | `var(--color-card)` `#0a0a0f` + `var(--color-border)` `#27272a` + `var(--color-muted)` `#18181b` | Cards журнала/дашборда, Sheet surface, table chrome, form secondary groups |
| Accent (10%) | `var(--color-primary)` `#6366f1` | **Только:** primary CTA (Загрузить, Получить аналитику, Опубликовать, Выпустить токен, Получить инсайты), active tab underline, focus ring, iconBadge, выбранный сегмент графика (stroke/fill active), progress fill |
| Destructive | `var(--color-destructive)` `#ef4444` | Удалить разговор/проект, отозвать токен, error rows / badge failed |
| Warning | `var(--color-warning)` `#f59e0b` | «Идёт пересборка»; soft budget exceeded cue; pause-active hint |
| Success | `var(--color-success)` `#22c55e` | Прогон успешен; publish ok; webhook test ok |
| Info | `var(--color-info)` `#3b82f6` | Нейтральные статусы in-progress / queued (не primary CTA) |

Accent **зарезервирован** и не протекает в: idle row hover, muted cost labels, transcript speaker labels (использовать muted / foreground), secondary outline buttons.

Светлая тема: card `box-shadow: 0 1px 4px rgba(0,0,0,0.06)` поверх border (ARCHITECTURE).

Семантические бейджи прогона: `success` / `warning` / `destructive` / `info` через `Badge` + `color-mix` фоны - не произвольные hex.

---

## Copywriting Contract

Все строки - ключи i18n `speechAnalytics.*` (+ точечные `routes.*` для селекта). Ниже baseline ru / en. Без `—`.

| Element | ru | en |
|---------|----|----|
| Primary CTA - journal upload | Загрузить запись | Upload recording |
| Primary CTA - Excel export | Выгрузить Excel | Export Excel |
| Primary CTA - get analytics (CDR) | Получить аналитику | Get analytics |
| Primary CTA - open analytics (CDR/journal) | Аналитика | Analytics |
| Primary CTA - publish project | Опубликовать проект | Publish project |
| Primary CTA - create project | Создать проект | Create project |
| Primary CTA - insights | Получить инсайты | Get insights |
| Primary CTA - create token | Выпустить токен | Create token |
| Primary CTA - upload submit busy | Загрузка... | Uploading... |
| Excel button busy | Выгрузка... | Exporting... |
| Sheet close (icon-only) | Закрыть | Close |
| Sheet tab Analytics | Аналитика | Analytics |
| Sheet tab Transcript | Расшифровка | Transcript |
| Sheet tab Cost | Стоимость | Cost |
| Cost not charged label | Посчитано, не списано | Calculated, not charged |
| Rebuild in progress badge | Идёт пересборка | Rebuild in progress |
| Journal progress | Готово {{done}} из {{total}} | {{done}} of {{total}} done |
| Empty journal heading | Разговоров пока нет | No conversations yet |
| Empty journal body | Загрузите запись или дождитесь разбора звонка с маршрута, где выбран проект. | Upload a recording or wait for a route call with a project selected. |
| Empty projects heading | Проектов пока нет | No projects yet |
| Empty projects body | Создайте проект и опубликуйте метрики, чтобы маршруты и загрузки могли брать этот набор. | Create a project and publish metrics so routes and uploads can use this set. |
| Empty tokens heading | Токенов пока нет | No API tokens yet |
| Empty tokens body | Выпустите токен для внешнего API - один токен привязан к одному проекту. | Create a token for the external API - one token is bound to one project. |
| Empty dashboard heading | Недостаточно данных | Not enough data |
| Empty dashboard body | Нужны разобранные разговоры за выбранный период. Откройте журнал или загрузите записи. | Need analyzed conversations for the selected period. Open the journal or upload recordings. |
| Empty insights (<10) | Для инсайтов нужно минимум 10 разговоров | Insights need at least 10 conversations |
| Empty integrations link | Нет интеграций. Настройте их на странице Интеграции. | No integrations. Configure them on the Integrations page. |
| Error load journal | Не удалось загрузить журнал. Обновите страницу или повторите позже. | Could not load the journal. Refresh or try again later. |
| Error upload | Не удалось загрузить файл. Проверьте формат (mp3/wav/ogg/m4a) и размер до 50 МБ. | Upload failed. Check format (mp3/wav/ogg/m4a) and size up to 50 MB. |
| Error export | Не удалось выгрузить Excel. Повторите попытку. | Excel export failed. Try again. |
| Error insights | Не удалось получить инсайты. Повторите запрос. | Could not get insights. Try again. |
| Error module off write | Модуль выключен. Доступен только просмотр уже посчитанного. | Module is off. Only already calculated data is available to view. |
| Destructive - delete conversation | Удалить разговор | Delete conversation |
| Destructive confirm - conversation | Удалить этот разговор и историю прогонов? Отменить нельзя. Списания нет - возврата средств тоже нет. | Delete this conversation and its run history? This cannot be undone. There is no charge and no refund. |
| Destructive - delete project | Удалить проект | Delete project |
| Destructive confirm - project | Удалить проект? Разговоры останутся. Если проект стоит на маршрутах, он будет снят, авторазбор остановится, токены отзовутся. | Delete the project? Conversations stay. If it is used on routes, it will be cleared, auto-analysis stops, and tokens are revoked. |
| Destructive - revoke token | Отозвать токен | Revoke token |
| Destructive confirm - token | Отозвать токен «{{name}}»? Запросы с этим секретом перестанут работать. | Revoke token "{{name}}"? Requests with this secret will stop working. |
| Token secret once title | Сохраните секрет токена | Save the token secret |
| Token secret once body | Секрет показывается один раз. Скопируйте его сейчас - позже увидеть нельзя. | The secret is shown once. Copy it now - you cannot view it later. |
| Route project select label | Проект аналитики | Analytics project |
| Route project hint | **Не выбран** - авторазбора нет\n**Проект** - после звонка закрытая запись уходит в разбор этого проекта\nНужна включённая запись на маршруте | **None** - no auto-analysis\n**Project** - after the call the closed recording is analyzed with this project\nRecording must be enabled on the route |
| Project select placeholder | Без проекта | No project |
| Ask project before CDR analyze | Выберите проект аналитики | Select an analytics project |
| Pause company label | Пауза новых авторазборов | Pause new auto-analysis |
| Models admin-only hint | Смену моделей включает суперадмин | Model changes are enabled by a superadmin |

**A11y для icon-only:** закрытие Sheet и icon-only кнопки тулбара/row-actions обязаны иметь и `title`, и `aria-label` (тексты из Copywriting / `common.*` / TableRowActions канон). Одного touch-target 44px недостаточно. Visible-text кнопки (Загрузить, Выгрузить Excel) этого не требуют сверх видимой подписи.

**Запрещено в copy:** слово Asterisk (кроме raw dialplan surfaces, которых здесь нет); emoji; «списано с кошелька» как будто charge уже живой; обещание refund.

---

## Surface Contracts

Каждая поверхность называет **reuse-паттерн** и состояния. Вне scope UI: golden eval CLI, `SA-CHARGE-*` internals, analyze-url API без кабинета.

### S1 - RouteFormModal: селект проекта (D-01, D-02, D-22)

| | |
|--|--|
| **Reuse** | `features/routes/ui/RouteFormModal` + `RouteGeneralTab`; контролы `Select`/`Label`/`InfoTooltip` из `@/shared/ui`; стили - SCSS модуля вкладки (не новый inherit/off/on) |
| **Interaction** | Рядом с блоком записи: если модуль активен **и** запись не «Не записывать» - показать `Select` проектов (+ опция «Без проекта»). Иначе селект **скрыт** (не disabled placeholder). Пустой выбор = нет авторазбора. |
| **Tooltips** | `InfoTooltip` обязателен (неявное поле) - copy из таблицы выше |
| **Module off** | Селект скрыт; сохранённый projectId не стирать в UI-модели при открытии read-only чужих экранов маршрута - поле просто не показывают |
| **Permission** | Редакторы маршрута как сейчас; отдельной роли аналитика нет |
| **Conflict note** | CONTEXT требует селект; ARCHITECTURE запрещает Tailwind/`<select>` в features. **Решение:** сохранить interaction D-02; реализация формы - `Select` + SCSS + InfoTooltip. Существующий interim Tailwind в `RouteFormModal` не расширять новыми utility-классами для этого поля |

### S2 - Journal «Разговоры» (D-05, D-15, D-16, D-37)

| | |
|--|--|
| **Reuse** | Page shell как `TrunksPage`/`ContextsPage` (iconBadge + gradient title + CTA). Таблица - `DataTable` + feature `ConversationsTable` (имя на усмотрение плана). Toolbar: поиск/фильтры + `Загрузить запись` + `Выгрузить Excel` |
| **Hub** | Заменить/убрать stub `/speech-analytics/reports`; Excel **только** кнопка тулбара журнала. Отдельной Reports page **нет** |
| **Excel** | Кнопка с waiting (`Loader2` + disabled + copy «Выгрузка...»). Выгрузка **всей** текущей выборки (фильтры + access list), не одной страницы. Не `DataTable.exportCsv` для этого потока (backend `exceljs`) - но визуально кнопка живёт в том же toolbar reserved-slot духе (не прыгает layout) |
| **Upload progress** | Под тулбаром / над таблицей: `Progress` + `Text` «Готово {{done}} из {{total}}»; переживает reload (server job counter) |
| **Row click / action** | Открывает conversation Sheet по стабильному URL (D-06). Row-actions: открыть; удалить/пересобрать только ADMIN/SUPERADMIN (D-09) через `TableRowActions` |
| **Empty / loading / error** | Empty - copy таблицы; loading - `Loader2`/`Skeleton` строк; error - Text error + retry Button |
| **Module off** | Read-only: таблица и Excel доступны для уже посчитанного; upload/delete/rebuild скрыты или disabled с copy module-off |
| **Permission-hidden** | Строки вне CDR access list не видны (API); UI не показывает «чужие» placeholder rows |

### S3 - Conversation Sheet (D-06…D-13)

| | |
|--|--|
| **Reuse** | `Sheet` + `SheetHeader`/`SheetContent` + `Tabs` (shared). Контент аналитики - паритет информативности `ReportShowAnalytics` (aiPBX), сверстанный Stack+SCSS |
| **URL** | Стабильный deep-link; CDR «Аналитика» и строка журнала открывают тот же адрес |
| **Tabs** | `Аналитика` \| `Расшифровка` \| `Стоимость` - один underline-канон |
| **Player** | PBX call: **нет** второго `AudioPlayer` в Sheet (плеер в CDR). Upload/API: `AudioPlayer` на вкладке «Расшифровка» |
| **Cost** | Список прогонов + суммы; каждая/итог с Label «Посчитано, не списано». Колонка журнала = последний прогон |
| **Rebuild** | Пока идёт новый прогон - показывать **предыдущий** готовый результат + Badge warning «Идёт пересборка» |
| **Edit scores/topics** | SUPERVISOR + ADMIN + SUPERADMIN; READONLY - view; OPERATOR не оценивает чужие |
| **Delete** | Confirm Dialog (copy выше); после успеха sheet закрывается, URL очищается |
| **Overflow** | Transcript - `ScrollArea`; длинные цитаты - wrap; sheet body `min-height: 0` + scroll |
| **Close a11y** | Icon-only close: `title` + `aria-label` = «Закрыть» / «Close» (Copywriting) |

### S4 - CDR row + CDR page upload (D-05, D-16, D-18)

| | |
|--|--|
| **Reuse** | Существующий CDR report UI + player; добавить actions без поломки hybrid overflow (Phase 8) |
| **Buttons** | При наличии записи журнала - «Аналитика» (navigate/open sheet URL). «Получить аналитику» - только если есть recording **и** модуль активен; иначе скрыта |
| **Project ask** | Если на маршруте проекта нет - перед стартом `Dialog`/`Select` «Выберите проект аналитики» |
| **Upload** | Та же upload-форма, что в журнале; создаёт journal row, **не** Asterisk CDR |
| **Pause** | Ручной get-analytics во время паузы компании **работает** (D-19) |

### S5 - Upload form (D-14, D-15, D-24)

| | |
|--|--|
| **Reuse** | `Dialog` compact/`large` по объёму полей - канон `UserFormModal`; `FileImportButton` или shared file control; поля `Select` project (required), operator (user or name), optional language/phone |
| **One form** | Один и пачка - одни поля; один файл = пачка из одного |
| **No channel swap UI** | Форма **не** спрашивает swap каналов (только API) |
| **Busy** | Submit → «Загрузка...»; после accept - закрыть/свернуть и показать journal progress |
| **Errors** | Per-file error rows in journal; form-level toast/Text для reject до enqueue |
| **Module off** | Entry points скрыты |

### S6 - Metric editor / projects (D-25…D-31, D-38)

| | |
|--|--|
| **Reuse** | List page проектов (канон table) + editor `Dialog size="large"` или dedicated `SpeechAnalyticsProjectPage` orchestrator с feature tabs. **Не** rebuild `NotificationIntegrationsPage` - только `Button variant="link"` / router link на Интеграции |
| **Sections** | Шаблоны отраслей, свои метрики, standard scales visibility, system prompt, topics, event webhook (+ test button), digest, alerts, soft budget, model overrides (если право) |
| **Tooltips** | InfoTooltip на шаблонах, публикации, неявных enum |
| **Empty** | Heading/body из Copywriting (`Empty projects *`); CTA страницы - «Создать проект»; после черновика - «Опубликовать проект» |
| **Publish** | Primary «Опубликовать проект»; draft не влияет на звонки до publish |
| **Models** | Поля STT/scoring: ADMIN видит editors только если суперадмин включил tenant right; SUPERADMIN always; SUPERVISOR never |
| **Delete project** | Confirm с последствиями маршрутов/токенов |
| **Module off** | Editor write paths недоступны; list read optional per D-22 (проекты на маршрутах сохраняются - UI редактора metrics недоступен) |

### S7 - Dashboard (D-34…D-36)

| | |
|--|--|
| **Reuse** | Page shell + grid of `Card` stats; charts via Recharts в feature SCSS (цвета из tokens). **Запрещён** DashboardBuilder / widget library |
| **Layout order** | Stat cards → Insights block → mood/success/scales/custom metrics/dynamics |
| **Segment click** | Ведёт в journal с соответствующим фильтром (query params) |
| **Insights** | Кнопка «Получить инсайты» (не mount-fetch). Cost на блоке отдельно + «Посчитано, не списано»; не входит в conversation totals. <10 conversations - empty copy, кнопка disabled или no-op с empty |
| **Poor ASR** | Исключены из averages; показать count |
| **Pause Switch** | Может жить в settings; если на дашборде - **optimistic** MUST |
| **Module off** | Read-only dashboard of calculated data |

### S8 - API token list (D-32, D-33)

| | |
|--|--|
| **Reuse** | List page + `DataTable` columns: name, project, last used; actions revoke/create via `TableRowActions` / toolbar |
| **Empty** | Heading/body из Copywriting (`Empty tokens *`); CTA - «Выпустить токен» (скрыт для SUPERVISOR) |
| **Secret** | После create - `Dialog` confirm card с секретом + copy button; **не** писать секрет в AI chat history (chat path shows once in confirm card only) |
| **Roles** | Create: ADMIN + SUPERADMIN; SUPERVISOR cannot |
| **Module off** | Tokens remain listed; API fails server-side; UI may show read-only + hint |

### S9 - Module settings (D-19, D-38)

| | |
|--|--|
| **Reuse** | Settings section/page pattern (Switch+Select like other module settings); link from hub |
| **Fields** | Company pause (`Switch` optimistic); insights model; STT/scoring defaults (gated by tenant right) |
| **Cabinet admin** | Без right - model editors **скрыты** (не disabled tease), pause остаётся |

### S10 - AI chat confirm cards (D-04, D-27, D-33)

| | |
|--|--|
| **Reuse** | Phase 15 proposal/confirm card UI - не новая chrome-система |
| **Copy** | «Поставить проект» / «Убрать проект»; recording-off → сообщение что нужна запись; token secret once in card |

### Out of UI scope (explicit)

- Отдельная страница Reports / DashboardBuilder / robot Excel columns
- Role `analyst` UI
- Golden-set button in cabinet
- Wallet charge UX / balance gate

---

## UI Considerations

Виды зафиксированы с добавлениями: sheet = вкладки + плеер + список прогонов; CDR = список + кнопки + плеер; дашборд = список + кнопки + текст карточек; карточка чата = форма, не список.

Applicable state considerations resolved: **65 covered, 2 backstop, 0 unresolved**

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| empty | селект проекта на маршруте | ✅ covered | Селект проекта скрыт, когда запись выключена или модуль выключен. Это не пустой список. |
| loading | селект проекта на маршруте | ✅ covered | Пока проекты грузятся, Select в состоянии загрузки и маршрут нельзя сохранить с новым проектом. |
| error | селект проекта на маршруте | ✅ covered | Ошибка списка проектов показывает текст ошибки и повтор. Чужой проект в селект не подставляется. |
| partial | селект проекта на маршруте | ✅ covered | При выключенном модуле поле скрыто, сохранённый projectId в модели маршрута не стирается. |
| long-text | селект проекта на маршруте | ✅ covered | Длинное имя проекта переносится или обрезается внутри Select и не раздвигает вкладку маршрута. |
| empty | журнал «Разговоры» | ✅ covered | Пустой журнал показывает copy пустого состояния и CTA загрузки из Copywriting Contract. |
| loading | журнал «Разговоры» | ✅ covered | Строки журнала показывают Skeleton или Loader2, тулбар остаётся на месте. |
| error | журнал «Разговоры» | ✅ covered | Ошибка журнала показывает текст ошибки и кнопку повтора. |
| populated | журнал «Разговоры» | ✅ covered | Таблица показывает текущую выборку. Клик по строке открывает sheet по стабильному URL. |
| partial | журнал «Разговоры» | ✅ covered | Полоса прогресса показывает «Готово N из M». Ошибка одного файла не скрывает остальные строки пачки. |
| overflow | журнал «Разговоры» | ✅ covered | Широкая таблица скроллится по горизонтали. На узком экране строки становятся карточками, как в каноне таблиц ARCHITECTURE. |
| zero-one-many | журнал «Разговоры» | ✅ covered | Ноль, одна и много строк используют i18n. Тулбар не прыгает при смене числа строк. |
| long-text | журнал «Разговоры» | 🧪 backstop | Подписи кнопок тулбара переносятся. Ячейка Excel с расшифровкой длиннее лимита обрезается сервером так же, как truncateCell в aiPBX. Это проверяет фикстура выгрузки. |
| empty | sheet разговора | ✅ covered | У загрузки и API без файла плеер заменяется на «Нет аудио». Вкладка стоимости без прогонов показывает пустой список, не нули. |
| loading | sheet разговора | ✅ covered | Sheet остаётся открытым, содержимое вкладки показывает Skeleton, пока разговор грузится. |
| error | sheet разговора | ✅ covered | Ошибка загрузки разговора показывает текст и повтор. Sheet сам не закрывается. |
| populated | sheet разговора | ✅ covered | Три вкладки: Аналитика, Расшифровка, Стоимость. У звонка АТС второго плеера нет. У загрузки и API плеер только на вкладке Расшифровка. |
| partial | sheet разговора | ✅ covered | Пока идёт пересборка, виден предыдущий готовый разбор и badge «Идёт пересборка». |
| overflow | sheet разговора | ✅ covered | Расшифровка в ScrollArea. Тело sheet с min-height 0, длинное содержимое скроллится внутри, не страница. |
| zero-one-many | sheet разговора | ✅ covered | Вкладка стоимости показывает ноль прогонов, один прогон и список всех прогонов. Колонка журнала остаётся суммой последнего. |
| long-text | sheet разговора | ✅ covered | Длинные цитаты и саммари переносятся в sheet и не обрезаются без ScrollArea. |
| empty | строка CDR | ✅ covered | Без записи кнопка «Получить аналитику» скрыта. Без строки журнала кнопка «Аналитика» скрыта. |
| loading | строка CDR | ✅ covered | «Получить аналитику» в состоянии busy. Если на маршруте нет проекта, сначала диалог выбора проекта. |
| error | строка CDR | ✅ covered | Ошибка старта показывает текст. Строка CDR и её плеер остаются. |
| populated | строка CDR | ✅ covered | Плеер строки CDR остаётся. Если журнал уже есть, рядом кнопка «Аналитика» на тот же URL sheet. |
| partial | строка CDR | ✅ covered | Пауза компании не скрывает ручные «Получить аналитику» и загрузку. |
| overflow | строка CDR | ✅ covered | Новые actions не ломают hybrid overflow таблицы CDR. |
| zero-one-many | строка CDR | ✅ covered | Одна строка и много строк показывают actions только для звонков, которые видит список доступа. |
| long-text | строка CDR | ✅ covered | Подписи кнопок не выталкивают плеер. Длинный номер остаётся в ячейке CDR по текущему канону отчёта. |
| empty | форма загрузки | ✅ covered | Пустая форма допустима до отправки. Без проекта отправка заблокирована. |
| loading | форма загрузки | ✅ covered | Кнопка отправки показывает «Загрузка...» и disabled. |
| error | форма загрузки | ✅ covered | Отказ до постановки в очередь показывается в форме. Ошибка файла становится строкой журнала и не останавливает пачку. |
| partial | форма загрузки | ✅ covered | Один файл и пачка делят одни поля. Один файл считается пачкой из одного. |
| long-text | форма загрузки | ✅ covered | Длинное имя оператора и имя файла переносятся в полях и не раздвигают диалог по горизонтали. |
| empty | проекты и редактор | ✅ covered | Пустой список проектов показывает «Проектов пока нет» и CTA «Создать проект» из Copywriting Contract. |
| loading | проекты и редактор | ✅ covered | Список и редактор показывают loader. Кнопка «Опубликовать проект» disabled, пока сохранение не закончилось. |
| error | проекты и редактор | ✅ covered | Ошибка сохранения или публикации показывает текст и повтор. Черновик не становится опубликованной версией. |
| populated | проекты и редактор | ✅ covered | Редактор содержит шаблоны, метрики, шкалы, промпт, темы, вебхук, дайджест, алерты и бюджет. Ссылка на Интеграции не встраивает вторую страницу каналов. |
| partial | проекты и редактор | ✅ covered | Черновик не влияет на звонки до «Опубликовать проект». Поля моделей скрыты, если у администратора кабинета нет права. |
| overflow | проекты и редактор | ✅ covered | Вкладки редактора скроллятся по горизонтали, тело формы по вертикали. Оболочка страницы высоту не теряет. |
| zero-one-many | проекты и редактор | ✅ covered | Ноль, один и много проектов читаются как таблица с тем же CTA. Число не прячет кнопку создания. |
| long-text | проекты и редактор | ✅ covered | Промпт и заголовки вебхука вводятся в Textarea и переносятся. В строках нет символа длинного тире. |
| empty | дашборд | ✅ covered | Пустой период и меньше 10 разговоров показывают copy пустого дашборда и инсайтов. Кнопка инсайтов не запускает запрос без достаточного числа разговоров. |
| loading | дашборд | ✅ covered | Карточки показывают Skeleton. Кнопка инсайтов показывает spinner и оставляет прошлый кэш на экране. |
| error | дашборд | ✅ covered | Ошибка инсайтов показывает текст и повтор. Карточки разговоров не обнуляются. |
| populated | дашборд | ✅ covered | Порядок: карточки, блок инсайтов, настроение, успех, шкалы, свои метрики, динамика. Клик по сегменту открывает журнал с этим фильтром. |
| partial | дашборд | 🧪 backstop | Звонки с плохим распознаванием не входят в средние, их число показано. Суммы дашборда совпадают с журналом того же списка доступа. Совпадение проверяется отдельным прогоном API и UI. |
| overflow | дашборд | ✅ covered | Сетка карточек переносится на узкой ширине. График не вылезает за Card. |
| zero-one-many | дашборд | ✅ covered | Ноль, один и много разговоров не ломают подписи шкал и не подменяют пустое состояние нулями без copy. |
| long-text | дашборд | ✅ covered | Текст инсайта переносится внутри карточки. Его стоимость показана на блоке отдельно и подписана «Посчитано, не списано». |
| empty | список токенов | ✅ covered | Пустой список токенов показывает «Токенов пока нет» и CTA «Выпустить токен». У супервизора CTA скрыт. |
| loading | список токенов | ✅ covered | Таблица токенов показывает Skeleton. |
| error | список токенов | ✅ covered | Ошибка списка показывает текст и повтор. Секрет повторно не показывается. |
| populated | список токенов | ✅ covered | Колонки: имя, проект, время последнего использования. Отзыв в TableRowActions. |
| partial | список токенов | ✅ covered | При выключенном модуле список остаётся для чтения, выпуск нового токена скрыт. |
| overflow | список токенов | ✅ covered | Широкая таблица токенов скроллится по горизонтали. |
| zero-one-many | список токенов | ✅ covered | Ноль, один и много токенов используют один шаблон таблицы и empty-copy только для нуля. |
| empty | настройки модуля | ✅ covered | Если в allowlist нет моделей, селекты моделей скрыты. Переключатель паузы остаётся. |
| loading | настройки модуля | ✅ covered | Пауза переключается сразу и откатывается, если запрос не удался. Это optimistic Switch. |
| error | настройки модуля | ✅ covered | Ошибка сохранения паузы возвращает Switch в прежнее положение и показывает текст ошибки. |
| partial | настройки модуля | ✅ covered | Без права администратор кабинета не видит поля моделей. Пауза остаётся видимой. |
| long-text | настройки модуля | ✅ covered | Длинное имя модели обрезается или переносится внутри Select и не раздвигает страницу настроек. |
| empty | карточка чата | ✅ covered | Если проект не выбран, карточку подтверждения нельзя применить. Текст говорит, что нужен проект. |
| loading | карточка чата | ✅ covered | Повторный клик по подтверждению не отправляет второй запрос, пока первый не закончился. |
| error | карточка чата | ✅ covered | Если запись маршрута выключена, карточка говорит, что нужна запись, и проект не ставится. |
| partial | карточка чата | ✅ covered | Секрет токена показывается один раз в карточке и в историю чата не пишется. |
| long-text | карточка чата | ✅ covered | Длинное имя проекта в карточке переносится и не обрезается без возможности прочитать его в карточке. |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none (CLI not used) | not required |
| third-party shadcn registries | none | not applicable |

`Tool: none` - third-party registry vetting не применяется. Новые UI-блоки не тянутся через `npx shadcn add`.

---

## CONTEXT ↔ ARCHITECTURE conflicts (resolved)

| # | Tension | Follow |
|---|---------|--------|
| C1 | D-02 селект в `RouteFormModal`, где historically interim Tailwind | Interaction из CONTEXT; **shape** из ARCHITECTURE (`Select`+SCSS+InfoTooltip, без новых feature Tailwind classes) |
| C2 | D-37 Excel на тулбаре vs CRUD `DataTable.exportCsv` | Excel button + waiting (CONTEXT); CSV-ref API не использовать для SA journal export |
| C3 | D-06 Sheet vs row-expand | Sheet + stable URL (оба согласны с shared `Sheet`) |
| C4 | Dashboard/settings `Switch` pause vs naive Switch в skeleton | Optimistic RTK MUST (ARCHITECTURE) |
| C5 | formBody native `div` vs no-div rule | Documented ARCHITECTURE exception for scroll shells only |
| C6 | Stub Reports page / hub `/speech-analytics/reports` vs D-37 | Remove/retarget hub entry; no Reports UI |
| C7 | Cost label «не списано» vs em dash habit | Copy with hyphen/comma only |
| C8 | SPEECH-ANALYTICS-UX-SLICE visuals | Out of scope; do not implement |

Silent override of CONTEXT interaction **запрещён**. Silent invent of parallel tokens/Tailwind system **запрещён**.

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS
- [x] Dimension 7 Inventory Provenance: PASS

**Approval:** approved 2026-09-22
