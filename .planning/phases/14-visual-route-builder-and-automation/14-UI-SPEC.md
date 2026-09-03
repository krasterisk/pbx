---
phase: 14
slug: visual-route-builder-and-automation
status: draft
shadcn_initialized: false
preset: none
created: 2026-09-03
---

# Phase 14 — UI Design Contract

> Визуальный и интеракционный контракт четырёх поверхностных групп фазы:
> **блок-схема** цепочки (вкладка «Схема» в маршруте и в IVR-меню, печать и PDF браузером),
> **dry-run** (форма прогона на той же вкладке + подсветка пройденного пути; **оба хоста** - маршрут и IVR),
> **шаблоны цепочек** (кнопки в редакторе действий + раздел «Шаблоны маршрутов» с CRUD),
> **обратный звонок** (параметры шага в Sheet, настройки на странице колл-центра, заявки в панелях оператора и супервизора).
>
> Сгенерирован `gsd-ui-researcher` из зафиксированных решений `14-CONTEXT.md`
> (D-01…D-05 схема, D-29…D-32 dry-run, D-33…D-37 шаблоны, D-38…D-42 callback).
> `RESEARCH.md` для фазы не существует (research идёт позже, в plan-phase) - стек взят из
> `packages/frontend/.idea/ARCHITECTURE.md` и из фактического состояния кода.
> Отдельной `/gsd-sketch`-сессии по этой области нет: `sketch-findings-krasterisk-v4` покрывает
> Phase 2 (MohPage) и Phase 8 (Module Hub / shell) и даёт только общий визуальный язык
> (dark admin, indigo accent, плотность важнее декора).
>
> **Прямой предшественник - `12-UI-SPEC.md`.** Этот документ его *продолжает*, а не переписывает:
> те же токены, та же шкала типографики, тот же набор `shared/ui`, те же правила строки шага,
> Sheet-параметров и тенантных настроек. Все ссылки вида «Phase 12, Surface X» - нормативные.
> Второй предшественник - `09-UI-SPEC.md` (Surface 8, умный модуль пропущенных): вкладка заявок
> callback обязана читаться как его сосед, а не как чужая подсистема.
>
> **Out of scope (не проектировать здесь):** универсальный LLM-агент и его панель (Phase 15,
> отдельный UI-SPEC), полноценный граф-редактор с перетаскиванием, блок-схема в хосте
> «Справочники маршрута».

---

## Design System

| Property | Value |
|----------|-------|
| Tool | **none** - установившаяся рукописная дизайн-система, shadcn намеренно не используется. `components.json` в репозитории отсутствует (проверено). Соответствует Phase 8 / 9 / 10 / 12, все с `Tool: none` |
| Preset | not applicable |
| Component library | Radix-примитивы в обёртках `shared/ui/*` + CVA (`Dialog`, `Sheet`, `Popover`, `DropdownMenu`, `Select`, `Switch`, `Tabs`, `Tooltip`, `SegmentedControl`, `Badge`, `Card`, `DataTable`). DnD - `@dnd-kit/*` (в этой фазе не нужен: схема только для чтения) |
| Icon library | `lucide-react` - единственный источник иконок. Unicode-эмодзи запрещены (ARCHITECTURE MUST) |
| Font | `Inter` через `--font-sans` (глобально). Моноширинный текст - см. Typography, documented exception |
| Styling | SCSS-модули на компонент + токены `var(--color-*)` / `var(--radius-*)` / `var(--z-index-*)`. **Tailwind выше `shared/ui` запрещён**, inline `style`-объекты и CSS-in-JS запрещены |
| State | локальный `useState` в host-форме (черновик цепочки), RTK Query - справочники, настройки, шаблоны и заявки callback (ARCHITECTURE: Local Form State) |
| Layout движок схемы | **собственная раскладка на CSS grid, без новой зависимости** (см. Surface B). Граф-рендеры (`reactflow`, `dagre`, `elkjs`) отклонены: они позиционируют узлы через `transform` во вьюпорте с зумом, и браузерная печать (D-04) режет такой холст по границе экрана. Схема обязана печататься целиком и переноситься по страницам, а это умеет только поток документа |
| Печать / PDF | `react-to-print` (`useReactToPrint({ contentRef })`) - **уже зависимость проекта** (`packages/frontend/package.json`), не PDF-библиотека, а обёртка над `window.print()` для поддерева. D-04 соблюдён: печать и «Сохранить как PDF» делает браузер. Прецедент - `features/voiceRobots/ui/ScenarioTreePreview` |

### shadcn gate - resolved, not asked

Гейт инициализации shadcn выполнен и разрешён **без вопроса пользователю**. `components.json`
отсутствует, но `ARCHITECTURE.md` (MUST READ) прямо запрещает Tailwind-классы выше `shared/ui`
и предписывает SCSS-модули с `var(--color-*)`; Phase 8 отдельно запретила `cmdk` в пользу
`Dialog + Input`. Инициализация shadcn CLI противоречила бы канону проекта и четырём уже
одобренным UI-SPEC. Переспрашивать зафиксированное на уровне проекта решение - вне мандата
этого агента.

### Прецедент, который фаза наследует частично

`features/voiceRobots/ui/ScenarioTreePreview/ScenarioTreePreview.tsx` - единственная существующая
в проекте печатная визуализация дерева, и она даёт готовый **механизм** (`useReactToPrint` +
`break-inside: avoid` на узлах + `print-color-adjust: exact`). Её **оформление** переиспользовать
запрещено, это долг, а не образец:

- Tailwind-классы в слое `features/` (`print:p-8`, `bg-sky-500/10`) - нарушение ARCHITECTURE.
- Палитра вне токенов (`sky-500`, `emerald-500`, `amber-500`, `rose-500`) - нарушение цветового контракта.
- Инлайн `<style>{...}` с `!important` вместо SCSS-модуля.
- `style={{ marginLeft: indent * 24 }}` - инлайн-стиль вместо grid.

Блок-схема Phase 14 берёт из него только механику печати и правило `break-inside: avoid`,
а геометрию и цвет строит на токенах в SCSS-модуле.

---

## Component Inventory

Enumerated by `node -e "const fs=require('fs');const d='packages/frontend/src/shared/ui';const n=fs.readdirSync(d,{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>e.name).sort();console.log(n.length);console.log(n.join(', '))"` — 39 components — `@krasterisk/frontend@4.4.4` (рукописная система в `src/shared/ui`, отдельного npm-пакета нет) — 2026-09-03.

Полный список (39): AudioPlayer, Avatar, Badge, Button, Card, Checkbox, CommandPalette, DataTable,
Dialog, DropdownMenu, FileImportButton, Input, Label, Loader, ModuleLockedPage, MultiSelect,
Pagination, PasswordInput, Popover, Progress, RadioCards, RecordingButton, ScrollArea,
SegmentedControl, Select, Separator, Sheet, Skeleton, Sparkline, Stack, Switch, Table,
TableRowActions, Tabs, TagInput, Text, Textarea, Tooltip, WebhookAuthConfig.

Таблица ниже - **не закрытый allowlist**, а разметка «что берём под нужды этой фазы».
Обратиться к примитиву вне таблицы - ожидаемый путь, а не исключение.

| Нужда фазы | Компонент | Комментарий |
|------------|-----------|-------------|
| Узел схемы, карточка шаблона, карточка заявки | `Card` + SCSS-модуль | Узел схемы - не `Table`-строка: у него две-три исходящие связи |
| Бейджи условий, терминальности, статуса заявки, «Встроенный» | `Badge` | Варианты `default/secondary/destructive/outline`; семантические тинты - SCSS поверх `outline` |
| Вкладка «Схема» (маршрут) | существующая полоса табов `RouteFormModal` (interim Tailwind, вариант B) | Третий паттерн табов на одной модалке вводить нельзя, см. Surface A |
| Вкладка «Схема» (IVR) | существующая полоса табов `IvrFormModal` (SCSS, вариант A) | Surface C |
| Вкладка «Обратные звонки» (супервизор) | существующая полоса табов `CallCenterSupervisorPage` (SCSS `tabsRow`/`tab`/`tabActive`) | Surface N |
| Пресеты сценария dry-run, хост маршрута | `Select` (по одному на задействованный источник условия) + `Input` для значений | Surface E |
| Вход прогона, хост IVR | `Select` «Что сделал абонент» (опции выводятся из `menu_items`) + `Input type="number"` для номера прохода при `max_count > 0` | Surface E, раздел про IVR |
| Параметры шага callback | `Input` / `Select` / `Switch` через schema-driven поля Phase 12 (Surface C) | Все параметры шага - в Sheet (Phase 12, D-01) |
| Диалог «Из шаблона» / «Сохранить как шаблон» | `Dialog` + form-modal shell (ARCHITECTURE) | 2 уровня оверлеев над `RouteFormModal`, проверено M8 |
| Выбор способа применения шаблона (D-36) | `RadioCards` | Два взаимоисключающих режима с описанием последствий |
| Таблица шаблонов, таблица заявок | `DataTable` + `TableRowActions` / `TableRowAction` | ARCHITECTURE MUST для колонки действий |
| Настройки callback | `Select`, `SegmentedControl`, `Label`, `Skeleton` + `Button` «Сохранить» | Surface L - **форма с локальным состоянием и явным Save**, образец `ShiftPolicyForm`, не оптимистичный тумблер |
| Заявки в панели оператора | бейдж + dropdown по образцу `MissedCallsPanel` / `ParkedCallsIndicator` | Surface M |
| Подсказки | `Tooltip` → `InfoTooltip` | Длинный текст-подсказка под полем запрещён (ARCHITECTURE MUST) |
| Раскладка | `VStack` / `HStack` / `Flex` из `Stack` | Нативные `div` в `features/` запрещены (исключение - обёртки `scrollBody`/`formBody`/печатный root) |
| Загрузка списков | `Skeleton` (`SkeletonText`), `Loader` | Surface J, M, N |

**Новых базовых примитивов в `shared/ui` фаза не вводит.** Всё - композиция существующего внутри
`features/routes`, `features/route-templates`, `features/dialplan-apps`, `features/ivrs`,
`features/callcenter` (в т.ч. новая `CallbackSettingsForm`, монтируемая страницей
`pages/CallCenterSettingsPage`), `features/tenant-settings` (только правка строки
`settings.tenant.showFlowchartHint`, новых настроек там не появляется).

Источник истины по токенам: `packages/frontend/src/app/styles/globals.css`, блок `@theme`.
**Новых CSS custom properties фаза не добавляет.**

---

## Spacing Scale

Кратные 4, набор идентичен `09-UI-SPEC.md` / `12-UI-SPEC.md`:

| Token | Value | Использование в Phase 14 |
|-------|-------|--------------------------|
| xs | 4px | Зазор иконка↔текст в бейджах статуса и терминальности, отступ `InfoTooltip` от лейбла, зазор чипа порядка от рамки узла |
| sm | 8px | Зазор между бейджами в узле, Label↔контрол в форме dry-run, зазор между кнопками в футере редактора действий, зазор строк в dropdown заявок |
| md | 16px | Горизонтальный padding узла схемы, padding карточки шаблона, зазор между полями формы подстановки, padding секций настроек callback |
| lg | 24px | Вертикальный зазор между узлами схемы (сегмент связи), зазор между секциями диалога шаблона, padding пустого состояния, зазор между карточками секций настроек |
| xl | 32px | Отступ дорожки ветвления от спины (как grid-колонка, см. exceptions), зазор между блоками страницы «Шаблоны маршрутов» |
| 2xl | 48px | Минимальная высота пустого состояния схемы до иконки |
| 3xl | 64px | Не используется в этой фазе (зарезервировано) |

Exceptions (перечислены явно, новых «магических чисел» вводить нельзя):

- **44px** - минимальный touch-target каждой icon-only кнопки на телефоне: «Печать», сброс прогона,
  действия строки шаблона, действия строки заявки, закрытие dropdown заявок. WCAG 2.5.5,
  то же правило, что в Phase 9 / 10 / 12.
- **56px** - минимальная высота узла схемы и строки заявки. Это высота компонента, не шкала отступов;
  значение взято у строки шага `density="comfortable"` (Phase 12, Surface I), чтобы узел схемы
  и строка редактора читались как одна и та же сущность.
- **12px / 16px** - вертикальный / горизонтальный padding узла схемы (`12px 16px`). Это **та же
  documented density exception**, что у строки шага в Phase 12: 12px существует только для плотности
  строк и карточек-строк. Применять 12px где-либо ещё запрещено.
- **240px / 360px** - `minmax(240px, 360px)` ширины колонки узла. Ниже 240px summary шага перестаёт
  читаться предложением, выше 360px строка текста слишком длинная для печатной страницы.
- **32px** - отступ дорожки ветвления (branch lane) от спины. Участвует в `grid-template-columns`,
  а не в `gap` - то же правило, что для колонок номера и drag-handle в Phase 12.
- **24px** - диаметр чипа порядка выполнения (кружок с номером шага в результате dry-run).
- **1px / 2px** - толщины: 1px - рамка узла, карточки, дорожки; 2px - линия связи (спина и ветка),
  левая маркерная полоса состояния узла.
- **60vh** - максимальная высота холста схемы на экране до внутреннего вертикального скролла.
  В печати снимается (`max-height: none`).
- **12mm** - поля печатной страницы (`@page { margin: 12mm }`). Единица печати, не шкала отступов.
- **320px** - максимальная высота блока «Итог прогона» в узком экране до внутреннего скролла.

---

## Typography

| Role | Size | Weight | Line Height | Использование в Phase 14 |
|------|------|--------|-------------|--------------------------|
| Body | 14px | 400 | 1.5 | Summary шага в узле схемы, описание шаблона, тело пустого состояния, подписи в форме dry-run, текст ошибки, строка «Следующая попытка в …» |
| Label | 12px | 600 | 1.4 | Бейджи (условие, терминальность, статус заявки, «Встроенный»), лейблы полей, подписи связей («Условие выполнено» / «Иначе» / «Кнопка 1»), чип порядка выполнения, счётчик попыток |
| Heading | 16px | 600 | 1.3 | Название типа действия в узле, заголовок диалога шаблона, заголовки секций настроек callback, заголовок пустого состояния, заголовок печатного листа |
| Display | 28px | 600 | 1.2 | `Text variant="h1"` на странице «Шаблоны маршрутов» (существующий паттерн страницы), больше нигде |

Ровно 4 размера (14 / 12 / 16 / 28), ровно 2 начертания (400 и 600) - тот же набор, что в Phase 9 / 10 / 12.
Пятого размера и третьего веса фаза не вводит. Чип порядка и счётчики попыток используют
`font-variant-numeric: tabular-nums` (это не новая роль, а свойство того же Label).

**Документированное исключение - моноширинный текст** (продолжение Phase 12): номер звонящего
в форме и результате dry-run, имя переменной канала, значение `http_result`, DTMF-кнопка,
токены нормализации (`q{номер}_{тенант}`) рендерятся моноширинным семейством.
Это **смена `font-family`, а не новая роль типографики**: размер и вес остаются Body (14 / 400),
только `font-family: ui-monospace, SFMono-Regular, Menlo, monospace`.
Моно **запрещён** для summary узла, названий шаблонов, статусов заявок и любого человекочитаемого
текста.

**Печать не меняет размеры.** Уменьшать шрифт, чтобы «влезло на лист», запрещено (D-04: печатный
вид совпадает с экранным). Длинная цепочка переносится на следующую страницу.

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `var(--color-background)` `#09090b` | Фон вкладки «Схема», фон холста схемы, фон страницы шаблонов |
| Secondary (30%) | `var(--color-card)` `#0a0a0f` + `var(--color-border)` `#27272a` | Узел схемы в покое, карточка шаблона, строка заявки, контейнер дорожки ветвления, фон формы dry-run (`color-mix(in srgb, var(--color-muted) 35%, transparent)`) |
| Accent (10%) | `var(--color-primary)` `#6366f1` | **Зарезервирован ровно для:** активный таб «Схема» / «Обратные звонки» (2px полоса); primary-CTA «Прогнать сценарий», «Применить шаблон», «Новый шаблон», «Позвонить сейчас»; **пройденный путь в результате dry-run** (2px связь + рамка узла + фон чипа порядка); focus-ring (`--color-ring`, тот же hex); активный сегмент `SegmentedControl` (порядок набора) |
| Destructive | `var(--color-destructive)` `#ef4444` | Удаление шаблона (иконка + подтверждение), отмена заявки, статус заявки «Не удалось», узел с невалидными параметрами на схеме, «Цепочка обрывается» в итоге прогона, текст ошибки поля |
| Warning | `var(--color-warning)` `#f59e0b` | Бейджи «Завершает цепочку» / «Может выйти из цепочки» (продолжение Phase 12), неизвестный тип действия на схеме, «Достигнут предел переходов» в итоге прогона, бейдж заявок callback при наличии просроченных или неудавшихся |
| Info | `var(--color-info)` `#3b82f6` | Статус заявки «Дозваниваемся», бейдж-чип перехода на другой маршрут / IVR / метку в схеме |
| Success | `var(--color-success)` `#22c55e` | Ровно два применения: статус заявки «Соединили» и итог прогона, дошедший до ответа. Больше нигде |

Accent **зарезервирован** и **не должен** протекать в: узлы схемы в покое, линии связи в покое,
подписи ветвлений, бейджи условий, иконки действий строки, заголовки секций.
Схема без прогона **не содержит ни одного акцентного узла** - ровно как строка шага в покое
в Phase 12 остаётся `--color-card` + `--color-border`.

### Правило подсветки dry-run: цвет - пятый канал, не первый (D-31)

Пройденный путь **обязан** читаться в градациях серого и при дальтонизме. Кодируется
**пятью независимыми каналами**, из которых цвет - только один:

| Канал | Пройдено | Не выполнялось | Терминальный итог |
|-------|----------|----------------|-------------------|
| 1. Номер порядка | чип с номером `1`, `2`, `3` … в порядке обхода | чипа нет | чип с итоговым номером |
| 2. Линия связи | 2px сплошная | 1px пунктирная | 2px сплошная до карточки итога |
| 3. Рамка узла | 2px | 1px | 2px |
| 4. Текстовая подпись | подпись связи «Условие выполнено» / «Иначе» остаётся | добавляется бейдж «Не выполнялось» | карточка «Итог: …» с прозой |
| 5. Цвет | `--color-primary` | `--color-muted-foreground` | по итогу (success / warning / destructive) |

Полагаться на один только цвет запрещено. Канал 1 (номера обхода) - главный: именно он
делает результат читаемым на чёрно-белой печати.

**Непройденная ветка не гасится `opacity`.** Текст переводится на `--color-muted-foreground`,
фон и границы остаются штатными. `opacity < 1` ломает контраст и делает ветку нечитаемой
в светлой теме и на печати, а прочитать её нужно именно затем, чтобы понять, почему она не сработала.

**Светлая тема:** каждый новый узел, карточка шаблона и строка заявки обязаны нести
`box-shadow: 0 1px 4px rgba(0,0,0,0.06)` поверх 1px-границы (ARCHITECTURE: `--color-border`
в светлой теме `#e4e4e7` почти невидим).

---

## Copywriting Contract

Все строки - через `useTranslation()`, обязательны словари **`ru` и `en`** в `shared/config/locales/`.
Длинное тире `—` в UI-текстах **запрещено** (ARCHITECTURE): использовать `-` или запятую.
Слово **Asterisk** в подсказках и лейблах запрещено, система называется **Krasterisk**.
Namespaces: `routes.flowchart.*`, `routes.dryrun.*`, `routes.dryrun.ivr.*`, `routes.templates.*`,
`routes.apps.callback.*`, `callcenter.settings.callback.*` (настройки на странице колл-центра,
namespace её существующих вкладок), `callcenter.callback.*` (заявки в панелях).
Namespace `settings.tenant.callback.*` **не заводится**: настройки callback не живут в тенантных
настройках (см. Surface L).

### Блок-схема (Surface A-D)

| Element | ru | en |
|---------|----|----|
| Вкладка модалки | Схема | Diagram |
| **Primary CTA** - печать | Печать | Print |
| Подсказка к печати | В окне печати выберите "Сохранить как PDF", чтобы получить файл | In the print dialog choose "Save as PDF" to get a file |
| Заголовок печатного листа | Схема маршрута "{{name}}" | Diagram of route "{{name}}" |
| Заголовок печатного листа, IVR | Схема меню IVR "{{name}}" | Diagram of IVR menu "{{name}}" |
| Печатный лист - дата | Напечатано {{date}} | Printed on {{date}} |
| Полоса режима просмотра | Схема только для просмотра. Действия меняются на вкладке "Действия" | The diagram is view only. Actions are edited on the "Actions" tab |
| Полоса о черновике | Схема строится по текущему черновику, включая несохранённые изменения | The diagram reflects the current draft, including unsaved changes |
| Empty state heading | В маршруте нет действий | The route has no actions |
| Empty state body | Добавьте действия на вкладке "Действия", и схема появится здесь | Add actions on the "Actions" tab and the diagram will appear here |
| Empty state body, IVR | Добавьте пункты меню на вкладке "Пункты", и схема появится здесь | Add menu items on the "Items" tab and the diagram will appear here |
| Подпись связи - условие выполнено | Условие выполнено | Condition met |
| Подпись связи - иначе | Иначе | Otherwise |
| Подпись связи - безусловно | Далее | Next |
| Подпись связи - кнопка IVR | Кнопка {{digit}} | Key {{digit}} |
| Подпись связи - паттерн IVR | Набор по шаблону {{pattern}} | Dialled matching {{pattern}} |
| Подпись связи - таймаут IVR (`digit` = `t`) | Не нажали кнопку | No key pressed |
| Подпись связи - неверная кнопка IVR (`digit` = `i`) | Нажали неверную кнопку | Wrong key pressed |
| Подпись связи - предел проходов IVR (`digit` = `max`) | Исчерпаны проходы по меню | Menu retries exhausted |
| Чип перехода - маршрут | Маршрут "{{name}}" | Route "{{name}}" |
| Чип перехода - IVR | Меню IVR "{{name}}" | IVR menu "{{name}}" |
| Чип перехода - метка | Метка "{{name}}" | Label "{{name}}" |
| Чип перехода - подсказка | Звонок продолжится там, эта схема дальше не показывает | The call continues there, this diagram does not follow it further |
| Badge - завершает цепочку | Завершает цепочку | Ends the chain |
| Badge - может выйти из цепочки | Может выйти из цепочки | May exit the chain |
| Badge - шаг выключен | Выключен | Disabled |
| Badge - неизвестный тип | Неизвестное действие | Unknown action |
| Error state - шаг невалиден | Заполните обязательные параметры на вкладке "Действия" | Fill in the required parameters on the "Actions" tab |
| Счётчик узлов | Действий: {{count}} | Actions: {{count}} |

### Dry-run (Surface E-F)

| Element | ru | en |
|---------|----|----|
| Заголовок формы | Проверить маршрут | Test the route |
| Подсказка к форме | Прогон считается по вашей цепочке, звонка не будет | The run is simulated from your chain, no real call is made |
| Поле номера | Номер звонящего | Caller number |
| Плейсхолдер номера | Например, 79001234567 | For example, 79001234567 |
| Заголовок группы сценария | Что произошло в звонке | What happened during the call |
| Подсказка группы сценария | Выберите исход для каждой проверки, которая есть в цепочке | Choose an outcome for every check the chain performs |
| **Primary CTA** - прогнать | Прогнать сценарий | Run the scenario |
| CTA - сбросить прогон | Сбросить прогон | Clear the run |
| Пресет - не ответили | Не ответили | No answer |
| Пресет - занято | Занято | Busy |
| Пресет - абонент недоступен | Абонент недоступен | Subscriber unavailable |
| Пресет - ответили | Ответили | Answered |
| Пресет - очередь переполнена | Очередь переполнена | The queue is full |
| Пресет - нет свободных операторов | Нет свободных операторов | No agents available |
| Пресет - никто не взял трубку | Никто не взял трубку | Nobody answered in the queue |
| Пресет - абонент не в сети | Абонент не в сети | The subscriber is offline |
| Пресет - сообщение не записано | Сообщение не записано | The message was not recorded |
| Пресет - значение переменной | Значение переменной "{{name}}" | Value of variable "{{name}}" |
| Пресет - результат HTTP-запроса | Результат HTTP-запроса | HTTP request result |
| Пресет - расписание, внутри | Время попадает в расписание | The time is inside the schedule |
| Пресет - расписание, вне | Время не попадает в расписание | The time is outside the schedule |
| Zero state формы - проверок нет | В цепочке нет проверок | The chain performs no checks |
| Zero state формы - тело | Все действия выполнятся подряд, достаточно указать номер | All actions run one after another, just enter a number |
| Заголовок результата | Путь звонка | Call path |
| Badge - не выполнялось | Не выполнялось | Not taken |
| Итог - ответили | Итог: на звонок ответили | Result: the call was answered |
| Итог - завершён | Итог: звонок завершён | Result: the call was ended |
| Итог - ушёл в очередь | Итог: звонок ушёл в очередь "{{name}}" | Result: the call went to queue "{{name}}" |
| Итог - ушёл на маршрут | Итог: звонок ушёл на маршрут "{{name}}" | Result: the call went to route "{{name}}" |
| Итог - ушёл в IVR | Итог: звонок ушёл в меню IVR "{{name}}" | Result: the call went to IVR menu "{{name}}" |
| Итог - заказан обратный звонок | Итог: абонент заказал обратный звонок | Result: the caller requested a callback |
| Итог - цепочка кончилась | Итог: действия кончились, звонок никуда не направлен | Result: the actions ran out and the call was not routed anywhere |
| Итог - предел переходов | Итог: достигнут предел переходов, {{limit}}. Проверьте метки и переходы | Result: the transition limit of {{limit}} was reached. Check your labels and jumps |
| Итог - шаг невалиден | Итог: прогон остановлен на действии {{index}}, параметры заполнены не полностью | Result: the run stopped at action {{index}}, its parameters are incomplete |
| Error state - прогон не удался | Не удалось прогнать сценарий, попробуйте ещё раз | Could not run the scenario, try again |
| Loading - идёт прогон | Считаем прогон | Running the scenario |
| aria - чип порядка | Порядок выполнения: {{n}} | Execution order: {{n}} |

### Dry-run на хосте IVR (Surface C, E, F) - `routes.dryrun.ivr.*`

Хост IVR переиспользует **весь** словарь выше (номер, CTA, чип порядка, ошибки, loading).
Ниже - только строки, которых на маршрутном хосте нет, потому что они относятся к модели меню.

| Element | ru | en |
|---------|----|----|
| Заголовок формы | Проверить меню | Test the menu |
| Подсказка к форме | Прогон считается по вашему меню, звонка не будет | The run is simulated from your menu, no real call is made |
| Заголовок группы входа | Что сделал абонент | What the caller did |
| Подсказка группы входа | Выберите один из пунктов, которые есть в меню | Choose one of the items the menu defines |
| Опция входа - цифра | Нажал кнопку {{digit}} | Pressed key {{digit}} |
| Опция входа - паттерн | Набрал номер по шаблону {{pattern}} | Dialled a number matching {{pattern}} |
| Опция входа - таймаут | Ничего не нажал | Pressed nothing |
| Опция входа - неверная кнопка | Нажал кнопку, которой нет в меню | Pressed a key the menu does not define |
| Поле - номер прохода по меню | Какой это проход по меню | Which pass through the menu |
| Подсказка номера прохода | Меню повторяется до {{max}} раз, после этого звонок уходит по ветке "Исчерпаны проходы" | The menu repeats up to {{max}} times, after that the call follows the "retries exhausted" branch |
| Zero state формы - пунктов нет | В меню нет пунктов | The menu has no items |
| Zero state формы - тело | Добавьте пункт меню на вкладке "Пункты", и меню можно будет прогнать | Add a menu item on the "Items" tab and the menu can be tested |
| Итог - сработал пункт меню | Итог: сработал пункт "{{digit}}" | Result: item "{{digit}}" was taken |
| Итог - пункта нет и обработчика нет | Итог: такого пункта в меню нет и обработчик неверного нажатия не задан, звонок никуда не направлен | Result: the menu has no such item and no handler for a wrong key, the call was not routed anywhere |
| Итог - таймаут без обработчика | Итог: обработчик "Не нажали кнопку" не задан, звонок никуда не направлен | Result: there is no "no key pressed" handler, the call was not routed anywhere |
| Итог - предел проходов | Итог: проходы по меню исчерпаны | Result: the menu retries are exhausted |
| Итог - предел проходов без обработчика | Итог: проходы исчерпаны, обработчик не задан, звонок будет завершён | Result: retries are exhausted, no handler is defined, the call will be ended |
| Граница прогона - карточка цели | Дальше звонок уходит в "{{name}}", прогон туда не заходит | The call continues into "{{name}}", the run does not follow it |
| Подсказка границы прогона | Чтобы проверить, что будет там, откройте эту цепочку и прогоните её отдельно | To check what happens there, open that chain and run it separately |

### Шаблоны цепочек (Surface G-J)

| Element | ru | en |
|---------|----|----|
| CTA в редакторе - применить шаблон | Из шаблона | From a template |
| CTA в редакторе - сохранить шаблон | Сохранить как шаблон | Save as a template |
| Заголовок раздела | Шаблоны маршрутов | Route templates |
| **Primary CTA** раздела | Новый шаблон | New template |
| Заголовок диалога выбора | Выбор шаблона | Choose a template |
| Заголовок шага подстановки | Чем заполнить шаблон | Fill in the template |
| Заголовок шага применения | Как применить шаблон | How to apply the template |
| **Primary CTA** - применить | Применить шаблон | Apply the template |
| CTA - назад по шагам диалога | Назад | Back |
| CTA - сохранить копию встроенного | Сохранить копию | Save a copy |
| Поле - название шаблона | Название | Name |
| Поле - описание шаблона | Описание | Description |
| Поле - какая очередь | Какая очередь | Which queue |
| Поле - какая группа | Какая группа | Which group |
| Поле - какой IVR | Какой IVR | Which IVR |
| Поле - какой транк | Какой транк | Which trunk |
| Поле - какая запись | Какая запись | Which prompt |
| Подсказка к подстановке | Шаблон не привязан к конкретной очереди, выберите свою | The template is not tied to a specific queue, choose your own |
| Секция создания - что спрашивать | Что спрашивать при применении | What to ask when applying |
| Подсказка секции создания | Отмеченные значения шаблон не запомнит, а спросит каждый раз | Checked values are not stored, the template asks for them every time |
| Badge - встроенный шаблон | Встроенный | Built-in |
| Badge - шаблон тенанта | Мой | Mine |
| Счётчик действий в шаблоне | Действий: {{count}} | Actions: {{count}} |
| Счётчик подстановок | Подстановок: {{count}} | Slots: {{count}} |
| Режим применения - заменить | Заменить целиком | Replace entirely |
| Описание режима - заменить (**`_one`**) | Текущее действие будет удалено, останутся только действия шаблона | The current action will be deleted, only the template actions remain |
| Описание режима - заменить (**`_other`**) | Все {{count}} текущих действий будут удалены, останутся только действия шаблона | All {{count}} current actions will be deleted, only the template actions remain |
| Режим применения - дописать | Дописать в конец | Append to the end |
| Описание режима - дописать | Текущие действия останутся, действия шаблона встанут после них | The current actions stay and the template actions are added after them |
| Предупреждение о порядке при дописывании | Проверьте порядок: если текущая цепочка уже завершается, дописанные действия не выполнятся | Check the order: if the current chain already ends, the appended actions will not run |
| Empty state heading - шаблонов нет | Шаблонов пока нет | No templates yet |
| Empty state body - шаблонов нет | Соберите цепочку в маршруте и сохраните её как шаблон, чтобы переиспользовать | Build a chain in a route and save it as a template to reuse it |
| Empty state heading - поиск не дал результата | Ничего не найдено | Nothing found |
| Empty state body - поиск не дал результата | Попробуйте другое название | Try a different name |
| Empty state - предпросмотр не выбран | Выберите шаблон слева, чтобы увидеть его действия | Select a template on the left to see its actions |
| Error state - применение не удалось | Не удалось применить шаблон, действия маршрута не изменились | Could not apply the template, the route actions were left unchanged |
| Error state - сохранение не удалось | Не удалось сохранить шаблон, попробуйте ещё раз | Could not save the template, try again |
| Error state - имя занято | Шаблон с таким названием уже есть | A template with this name already exists |
| Error state - встроенный только для чтения | Встроенный шаблон нельзя изменить. Сохраните свою копию | A built-in template cannot be changed. Save your own copy |
| Error state - в шаблоне нет действий | Сначала добавьте хотя бы одно действие | Add at least one action first |
| **Destructive confirmation** - удалить шаблон | Удалить шаблон: шаблон "{{name}}" будет удалён. Маршруты, созданные из него, не изменятся. Продолжить? | Delete the template: template "{{name}}" will be deleted. Routes created from it stay unchanged. Continue? |
| **Destructive confirmation** - заменить цепочку (**`_one`**) | Заменить целиком: текущее действие будет удалено. Продолжить? | Replace entirely: the current action will be deleted. Continue? |
| **Destructive confirmation** - заменить цепочку (**`_other`**) | Заменить целиком: все {{count}} текущих действий будут удалены. Продолжить? | Replace entirely: all {{count}} current actions will be deleted. Continue? |

### Обратный звонок (Surface K-N)

| Element | ru | en |
|---------|----|----|
| Название действия | Обратный звонок | Callback |
| Summary действия | Обратный звонок, до {{attempts}} попыток, с {{from}} до {{to}} | Callback, up to {{attempts}} attempts, from {{from}} to {{to}} |
| Поле - дозваниваться с | Дозваниваться с | Start dialling at |
| Поле - дозваниваться до | Дозваниваться до | Stop dialling at |
| Подсказка окна дозвона | Заявки вне этого окна дождутся его начала, а не потеряются | Requests outside this window wait for it to open instead of being lost |
| Поле - количество попыток | Сколько раз пытаться | How many attempts |
| Поле - пауза между попытками | Пауза между попытками, мин | Pause between attempts, min |
| Подсказка о разделении настроек (в Sheet шага) | Режим заказа, кнопка и порядок набора - общие для тенанта, они в настройках колл-центра, на вкладке "Обратный звонок" | The request mode, the key and the dial order are tenant wide and live in call centre settings, on the "Callback" tab |
| Настройка - как заказывают | Как заказывают обратный звонок | How a callback is requested |
| Опция - по выбору абонента | По выбору абонента | At the caller's choice |
| Опция - автоматически при отбое | Автоматически, если абонент бросил трубку в очереди | Automatically when a caller abandons the queue |
| Опция - оба способа | Оба способа | Both ways |
| Настройка - кнопка заказа | Кнопка для заказа | Key to request a callback |
| Подсказка кнопки заказа | Абонент нажимает её, пока ждёт в очереди | The caller presses it while waiting in the queue |
| Настройка - порядок набора | Порядок набора | Dial order |
| Опция - сначала оператор | Сначала оператор | Agent first |
| Опция - сначала абонент | Сначала абонент | Caller first |
| Подсказка порядка набора | **Сначала оператор** - абонент услышит звонок, когда оператор уже на линии\n**Сначала абонент** - оператор подключится к уже поднятой трубке | **Agent first** - the caller rings once an agent is already on the line\n**Caller first** - the agent joins a call the caller has already picked up |
| Заголовок вкладки и панели | Обратные звонки | Callbacks |
| Колонка - номер | Номер | Number |
| Колонка - когда заказали | Заказан | Requested |
| Колонка - откуда | Откуда | Source |
| Колонка - статус | Статус | Status |
| Колонка - попытки | Попытки | Attempts |
| Статус - ожидает | Ожидает | Waiting |
| Статус - дозваниваемся | Дозваниваемся | Dialling |
| Статус - соединили | Соединили | Connected |
| Статус - не удалось | Не удалось | Failed |
| Статус - отменена | Отменена | Cancelled |
| Счётчик попыток | Попытка {{current}} из {{total}} | Attempt {{current}} of {{total}} |
| Строка - следующая попытка | Следующая попытка в {{time}} | Next attempt at {{time}} |
| Строка - ждёт окна дозвона | Ждёт начала окна дозвона в {{time}} | Waiting for the dial window to open at {{time}} |
| Строка - исчерпаны попытки | Попытки исчерпаны | No attempts left |
| **Primary CTA** - позвонить сейчас | Позвонить сейчас | Call now |
| CTA - отменить заявку | Отменить заявку | Cancel the request |
| Empty state heading - заявок нет | Заявок на обратный звонок нет | No callback requests |
| Empty state body - заявок нет | Заявки появятся здесь, когда абонент попросит перезвонить | Requests appear here once a caller asks for a callback |
| Empty state heading - выключено | Обратный звонок не настроен | Callback is not set up |
| Empty state body - выключено | Добавьте действие "Обратный звонок" в маршрут или очередь, чтобы абоненты могли его заказать | Add the "Callback" action to a route or a queue so callers can request one |
| Error state - позвонить не удалось | Не удалось начать дозвон, заявка осталась в очереди | Could not start dialling, the request stays in the queue |
| Error state - заявку уже взяли | Эту заявку уже обрабатывает другой оператор | Another agent is already handling this request |
| **Destructive confirmation** - отменить заявку | Отменить заявку: абоненту {{number}} не перезвонят. Продолжить? | Cancel the request: nobody will call {{number}} back. Continue? |

### Настройки callback на странице колл-центра (Surface L) - `callcenter.settings.callback.*`

Namespace и набор строк повторяют существующие вкладки этой страницы (`callcenter.settings.shifts.*`,
`callcenter.settings.autoPause.*`): у каждой есть `tabs.<id>`, `title`, `hint`, `readOnly`, `saved`.
Общие строки футера (`common.save`, `common.saving`, `common.saved`, `common.saveFailed`,
`common.loadFailed`, `common.retry`) переиспользуются как есть, новых не вводится.

| Element | ru | en |
|---------|----|----|
| `callcenter.settings.tabs.callback` | Обратный звонок | Callback |
| `…callback.title` | Обратный звонок | Callback |
| `…callback.hint` | Как абоненты заказывают обратный звонок и в каком порядке система соединяет их с оператором | How callers request a callback and in which order the system connects them to an agent |
| `…callback.readOnly` | Изменять эти настройки могут только супервизоры и администраторы | Only supervisors and admins can change these settings |
| `…callback.saved` | Настройки обратного звонка сохранены | Callback settings saved |
| `…callback.stepParamsNote` | Окно дозвона и число попыток задаются в самом действии "Обратный звонок", у каждого маршрута свои | The dial window and the number of attempts are set in the "Callback" action itself and differ per route |
| `…callback.disabledHint` | Пока ни в одном маршруте нет действия "Обратный звонок", эти настройки ни на что не влияют | Until some route has a "Callback" action these settings have no effect |

### Правка существующей строки настроек

`settings.tenant.showFlowchartHint` сегодня равен «Появится позже» / «Появится позже»
(`TenantSettingsSection.tsx`, D-18 Phase 12 намеренно оставила флаг без потребителя).
Фаза **обязана** его заменить - иначе включённая функция продолжит обещать себя в будущем:

| Element | ru | en |
|---------|----|----|
| `settings.tenant.showFlowchartHint` | Показывает вкладку "Схема" в маршруте и в меню IVR | Shows the "Diagram" tab in a route and in an IVR menu |

Дублирующая строка-описание под лейблом (`cls.hint`, сегодня печатает тот же ключ) удаляется:
подсказка живёт только в `InfoTooltip`, как требует ARCHITECTURE.

### Правило подтверждений

Диалог подтверждения обязателен только там, где действие **необратимо и теряет пользовательские
данные**: удаление шаблона, применение шаблона в режиме «Заменить целиком», отмена заявки callback.
Режим «Дописать в конец» подтверждения **не требует** - он ничего не удаляет, а результат
обратим удалением дописанных шагов через штатное undo редактора (Phase 12, D-13).
Прогон dry-run подтверждения не требует вовсе: он ничего не меняет.

---

## UI Considerations

> Покрытие UI-**состояний** (empty / loading / error / populated / partial / overflow /
> zero-one-many / long-text). Тексты пустых состояний и ошибок живут в `## Copywriting Contract`
> выше - здесь только покрытие состояний со ссылкой на те строки, без дублирования копирайта.

**Провенанс.** `ui-consideration-probe.cjs` (workflow step 9.5) на момент написания этого документа
**не прогонялся** - `gsd-ui-researcher` выполняется как субагент и не владеет этим шагом.
Строки ниже author-derived: выведены из 14 поверхностей фазы и из прецедентов Phase 9 / 12.
При прогоне probe строки **заменяются целиком** (идемпотентно), а не дописываются.

Applicable state considerations resolved: **24 covered, 3 backstop, 2 unresolved**

<!-- Статусы: ✅ covered - обычная строка в must_haves.truths;
     🧪 backstop - { statement, verification: backstop }, на verify без явных доказательств
     уходит в insufficient_spec → human_needed (никогда не молчаливый pass);
     ⚠ unresolved - явное допущение планировщика. -->

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| empty | Холст схемы, цепочка пуста (list-collection) | ✅ covered | Центрированный блок с иконкой `Workflow`, Heading + Body **без CTA**: схема только для чтения (D-01), предлагать «Добавить действие» здесь нельзя. Тело различается для маршрута и для IVR (две копии в контракте) |
| empty | Форма dry-run, в цепочке нет ни одного условия (form) | ✅ covered | Группа сценария не рендерится пустой: вместо неё zero-state строка «В цепочке нет проверок» + тело; поле номера и CTA остаются активными, прогон осмыслен и без пресетов |
| empty | Список шаблонов у нового тенанта (list-collection) | ✅ covered | Встроенные шаблоны показываются всегда, поэтому «совсем пусто» невозможно; отдельная копия «Шаблонов пока нет» относится только к фильтру «Мои» и ведёт к сохранению своей цепочки, а не в никуда |
| empty | Предпросмотр шаблона до выбора строки (static-content) | ✅ covered | Правая колонка диалога рендерит muted-подсказку «Выберите шаблон слева», а не пустую рамку |
| empty | Список заявок callback, заявок нет (list-collection) | ✅ covered | Две **разные** копии: «заявок нет» (функция настроена, обращений не было) и «Обратный звонок не настроен» (в тенанте нет ни одного шага callback). Вторая ведёт к настройке, первая ничего не предлагает. Смешивать нельзя: у них разные действия пользователя |
| empty | Бейдж заявок в панели оператора при нуле заявок (interactive-control) | ✅ covered | Бейдж **не рендерится вовсе** при нуле, как `ParkedCallsIndicator` (`if (count === 0) return null`). Пустой счётчик в шапке - шум |
| loading | Прогон dry-run (interactive-control) | ✅ covered | CTA переходит в `disabled` + `Loader`, предыдущий результат **остаётся на экране** и гасится до muted, а не исчезает: мигание схемы в пустоту читается как поломка. Копия «Считаем прогон» в контракте |
| loading | Список шаблонов в диалоге выбора (list-collection) | ✅ covered | `SkeletonText` на 3 строки в левой колонке; правая колонка держит подсказку предпросмотра, высота диалога не прыгает |
| loading | Справочники в форме подстановки, очереди / группы / IVR (interactive-control) | 🧪 backstop | Три различимых состояния, ровно как Phase 12, Surface C: грузится (`disabled` + плейсхолдер загрузки), пусто после ответа (`disabled` + «Ничего не создано» + ссылка на раздел в новой вкладке), заполнено. Нужен held-out тест, отличающий «грузится» от «пусто»: без него применение шаблона молча предложит пустой список |
| loading | Настройки callback до прихода значений (form) | ✅ covered | Паттерн соседних вкладок страницы колл-центра (`ShiftPolicyForm`): пока `isLoading` - `Skeleton` заголовка и блока формы, а не поля с подставленными дефолтами. Показать дефолт и заменить его пришедшим значением на глазах пользователя нельзя: это читается как чужое вмешательство в настройки |
| error | Загрузка настроек callback не удалась (form) | ✅ covered | `common.loadFailed` + `Retry` вместо формы, как `ShiftPolicyForm`. Рендерить пустую форму поверх неизвестного состояния запрещено: Save отправит дефолты и затрёт реальные настройки |
| empty | Форма прогона IVR, в меню нет пунктов (form) | ✅ covered | Zero-state «В меню нет пунктов» + тело со ссылкой на вкладку «Пункты», CTA `disabled`. Пустой `Select` «Что сделал абонент» не рендерится: выбирать не из чего |
| partial | Прогон IVR: событие есть, обработчика нет (static-content) | ✅ covered | Входы «Ничего не нажал» и «Нажал кнопку, которой нет в меню» доступны **всегда**, даже без пунктов `t` / `i`, и дают карточку итога «обработчик не задан, звонок никуда не направлен». Это главный сценарий, ради которого прогон IVR и нужен; прятать вход, у которого нет обработчика, значит скрывать дыру |
| populated | Граница прогона на переходе в другую сущность (static-content) | 🧪 backstop | Прогон обязан остановиться на чипе перехода, назвать цель и **не** входить в её цепочку (Surface F2, `ASSUMED — confirm`). Нужен held-out тест на цепочку «IVR → маршрут → тот же IVR»: без него первая же реализация «на всякий случай» пойдёт вглубь и зациклится |
| loading | Таблица заявок callback (list-collection) | ✅ covered | `Skeleton` строк таблицы; счётчик в заголовке вкладки не рендерится, пока число неизвестно |
| error | Прогон не удался, ответ сервера (interactive-control) | ✅ covered | Destructive-строка над холстом + сохранение прежнего результата; схема при этом остаётся валидной и читаемой |
| error | Узел с невалидными параметрами на схеме (list-collection) | ✅ covered | 2px destructive-полоса + иконка `AlertCircle` + строка ошибки, отсылающая на вкладку «Действия»: править здесь нельзя (D-01), поэтому ошибка обязана называть место правки |
| error | Неизвестный тип действия на схеме (list-collection) | ✅ covered | Warning, не destructive (данные целы, вины пользователя нет): иконка `FileQuestion`, сырой тип моно-шрифтом, копия из Phase 12. Узел рисуется как терминальный **не** становится: неизвестное действие не выдаёт себя за `Hangup` |
| error | Применение шаблона отклонено сервером (form) | ✅ covered | Диалог **не закрывается**, действия маршрута не тронуты, ошибка над футером диалога. Закрыть диалог по ошибке и оставить пользователя гадать, применилось ли, запрещено |
| error | Заявку уже взял другой оператор (list-collection) | 🧪 backstop | Гонка двух панелей за одну заявку: сервер - источник истины, UI откатывает оптимистичный статус и печатает свою копию. Прецедент claim из Phase 9 есть, но у него нет теста на конфликт; нужен held-out тест |
| populated | Цепочка из 20 шагов с 8 ветвлениями на 1280px (list-collection) | ✅ covered | Grid-раскладка спины и одной дорожки ветвления без горизонтального скролла страницы; вертикальный скролл холста до 60vh; печать переносит по страницам с `break-inside: avoid` на узлах |
| partial | Шаг с частично заполненными params на схеме (list-collection) | ✅ covered | Summary строится тем же `summarize(action)` из реестра Phase 12 и деградирует до плейсхолдер-фрагмента, а не выпадает из предложения. Схема и список обязаны показывать одинаковый текст |
| partial | Результат прогона, дошедший не до конца цепочки (static-content) | ✅ covered | Карточка итога обязательна в **каждом** исходе, включая «действия кончились» и «предел переходов»: прогон без итога не отличим от незавершённого запроса |
| overflow | Больше двух уровней ветвления в цепочке (list-collection) | ✅ covered | Максимум **одна** дорожка ветвления по глубине (Surface B): вложенная ветка рендерится чипом перехода с подписью, а не третьей колонкой. Иначе схема уезжает за лист |
| overflow | Длинный список пресетов сценария (form) | ✅ covered | Форма выводит контрол **только** для тех источников условий, которые цепочка реально читает (Surface E); полный словарь пресетов на экран не выливается |
| long-text | Длинное имя очереди / файла / шаблона в узле и в строке (long-text) | ✅ covered | Узел: перенос по словам, максимум 2 строки, дальше многоточие + `title`. В печати многоточие снимается и текст переносится целиком: на бумаге нет hover, чтобы прочитать остальное |
| zero-one-many | Один шаг против двадцати, одна заявка против сотни (list-collection) | ✅ covered | Единственный узел рендерится тем же лейаутом без особого вида; плюрализация - штатными правилами i18next, строки режима применения шаблона объявлены с `_one` / `_other` и счётчиком `count` |
| overflow | Печать очень широкой схемы IVR (10+ пунктов меню) (static-content) | ⚠ unresolved | Ветка на пункт меню растёт вниз, а не вправо, поэтому ширина ограничена одной дорожкой; но подтвердить, что лист A4 portrait вмещает узел 360px + дорожку 32px при полях 12mm, можно только на реальном прогоне печати. Планировщик трактует как допущение; санкционированный fallback - `@page { size: A4 landscape }` только для хоста IVR, а не подгонка шрифта |
| overflow | Диалог шаблона поверх `RouteFormModal` (interactive-control) | ⚠ unresolved | Второй уровень оверлеев. Phase 12 M8 подтвердила живьём, что порядка монтирования порталов Radix достаточно и `.layer-modal-nested` не нужен, но там был `Sheet` над модалкой, а здесь `Dialog` над `Dialog`. Хардкод `z-index` запрещён; fallback - существующий токен `--z-index-modal-nested: 55` и класс `.layer-modal-nested`, а не инлайн-стиль |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | нет (shadcn CLI в репозитории не используется, компоненты - ручные обёртки Radix в `shared/ui`) | not applicable |
| third-party | не объявлено | not applicable |

Сторонние registry для этой фазы не объявлялись, гейт вычитки сторонних блоков не применяется.

**Новых npm-зависимостей UI-контракт не требует.** `lucide-react`, `react-to-print`, `motion`,
`@tanstack/react-table` и Radix-примитивы уже в проекте. Отдельно **запрещено** вводить:
`reactflow` / `@xyflow/react`, `dagre`, `elkjs`, `d3` (граф-раскладка - см. Design System),
`jspdf`, `html2canvas`, `puppeteer` (PDF делает браузер, D-04).
`@react-pdf/renderer` в проекте есть (клиентский PDF отчётов Phase 7), но для схемы
**не используется**: D-04 требует именно браузерную печать, а второй путь рендера гарантированно
расходится с экранным видом.

---

## Surface Specifications

Раздел разворачивает контракт по каждой поверхности фазы. Для планировщика и исполнителя он
так же обязателен, как таблицы выше.

### A. Вкладка «Схема» в модалке маршрута (D-02, D-05)

`RouteFormModal` сегодня держит `TABS = ['general', 'actions', 'directories', 'webhooks']`
и рисует их полосой табов по **варианту B** (interim Tailwind, ARCHITECTURE) с абсолютным
индикатором 2px. Добавляется пятый таб `flowchart` **тем же паттерном**: третий паттерн табов
на одной модалке вводить нельзя, миграция этой полосы на SCSS - вне scope фазы.

**Позиция таба - последняя**, после `webhooks`. Схема - производная от «Действий», и вставлять её
между вкладками ввода означает разрывать порядок заполнения формы.

**Видимость - по существующему тенантному флагу `routes.show_flowchart`** (default `true`).
Флаг выключен → таб **не рендерится вовсе**, не `disabled`. Правило дословно повторяет решение
Phase 12 для переключателя [Таблица | Dialplan]: `disabled`-вкладка, дразнящая недоступной
поверхностью, хуже её отсутствия. Значение флага читается тем же `useGetTenantSettingsQuery`,
что уже используется в `RouteActionsTab`.

**Пока значение флага неизвестно (`isLoading`), таб не рендерится.** Флаг дефолтится в `true`,
поэтому отрисовка дефолта до резолва запроса даёт видимое появление и исчезание вкладки.

**Источник данных - черновик, не сохранённый маршрут.** Схема строится из того же локального
состояния `actions`, что редактирует `RouteActionsTab` (ARCHITECTURE: Local Form State).
Это делает её мгновенным зеркалом правок и требует явной полосы-подсказки о черновике
(копия в контракте). Читать маршрут заново с сервера для схемы запрещено: два источника
разойдутся ровно в тот момент, когда пользователь смотрит на схему после правки.

**Состав тела вкладки, сверху вниз, порядок фиксирован:**

1. Полоса режима просмотра (muted, `Body 14/400`) + полоса о черновике. Обе - строки, не toast.
2. Тулбар: счётчик действий (`Label 12/600`, слева) и справа кнопка «Печать»
   (`Button variant="outline" size="sm"`, иконка `Printer`) с `InfoTooltip` про «Сохранить как PDF».
3. Форма dry-run (Surface E) - сворачиваемая группа, **по умолчанию свёрнута**.
4. Холст схемы (Surface B) - `max-height: 60vh`, внутренний вертикальный скролл,
   `overscroll-behavior: contain`.

**Скролл.** Вкладка живёт внутри `RouteFormModal`, у которой уже есть единственная зона скролла
между header и футером. Холст добавляет **вторую** вложенную зону, и это допустимо только с
`max-height: 60vh` + `overscroll-behavior: contain`: без ограничения высоты холст растянет тело
модалки и уведёт футер с кнопкой «Сохранить» за край экрана.

**Печать не требует сохранения маршрута.** Кнопка «Печать» активна и на несохранённом черновике -
печатается то, что на экране. Требовать сохранения ради печати означало бы заставлять
пользователя коммитить черновик, чтобы его же и посмотреть.

### B. Раскладка блок-схемы: узел, спина, ветвление (D-01, D-03)

Собственная раскладка на CSS grid. **Никакого измерения DOM, никакого JS-позиционирования** -
геометрия целиком декларативна, потому что только поток документа корректно переносится
по печатным страницам.

**Модель графа.** Цепочка Phase 12 - линейный список шагов, у каждого из которых может быть
условие и признак терминальности. Отсюда форма схемы:

```
[ Входящий звонок, маска 7495… ]
              │  Далее
      ┌───────┴───────┐
      │  Действие 1   │  ← узел: тип, summary, бейджи
      └───────┬───────┘
              │  Условие выполнено          ┌──────────────────┐
      ┌───────┴───────┐                     │  Иначе:          │
      │  Действие 2   │ ─ ─ Иначе ─ ─ ─ ─ ─ │  Действие 3      │
      └───────┬───────┘                     └──────────────────┘
              │                                      │
      ┌───────┴───────┐                     [ Маршрут "Ночь" ]  ← чип перехода
      │  Завершение   │  ← терминальный узел
      └───────────────┘
```

- **Спина (main spine)** - вертикальная колонка узлов в порядке выполнения, соединённых
  2px линией. Порядок сверху вниз, ровно как «Действия выполняются сверху вниз» в списке.
- **Корневой узел** - «Входящий звонок» с маской маршрута (для IVR - см. Surface C).
  Он не действие, а точка входа, и рисуется тем же узлом с иконкой `PhoneIncoming`.
- **Узел с условием** имеет **две подписанные исходящие связи**: «Условие выполнено» продолжает
  спину вниз, «Иначе» уходит в дорожку ветвления (см. ниже). Линейная лента отвергнута (D-03).
- **Безусловный узел** имеет одну связь с подписью «Далее».
- **Терминальный узел** (`hangup`, переход на маршрут / IVR / метку) закрывает ветку:
  ниже него связей нет, бейдж «Завершает цепочку» (warning, продолжение Phase 12, Surface H).
  Условный выход получает бейдж «Может выйти из цепочки» и **пунктирную** warning-границу:
  утверждать, что он всегда завершает, значит врать пользователю.

**Grid.** `grid-template-columns: minmax(240px, 360px) 32px 1fr` →
`[спина] [отступ дорожки] [дорожка ветвления]`. Дорожка ветвления - **одна по глубине**.
Ветка, которая сама содержит условие, рендерит **чип перехода** с подписью, а не третью колонку:
две вложенности уже уводят схему за границу листа, а третья превращает её в кашу.

**Чип перехода** (`Badge` + иконка `CornerDownRight`, info-тинт) - способ показать связь,
которую невыгодно рисовать линией: переход на другой маршрут, в IVR, на метку внутри цепочки
(D-44/D-45 Phase 12), а также вложенная ветка. Он несёт имя цели и `InfoTooltip`
«Звонок продолжится там, эта схема дальше не показывает». Длинные линии через полстраницы
запрещены: на печати они нечитаемы, а на экране требуют зума.

**Содержимое узла** (повторяет зону «тип + summary» строки шага Phase 12, Surface A, дословно):
`Heading 16/600` - человекочитаемое название типа; под ним `Body 14/400`
`--color-muted-foreground` - одно предложение summary из того же `summarize(action)` реестра.
Справа/ниже - бейджи условий (максимум 2 + «ещё {{count}}» с Tooltip) и терминальности.
Номер шага - `Label 12/600` в левом верхнем углу узла.

**Схема и список обязаны говорить одинаково.** Название типа и summary берутся из реестра
Phase 12, а не форматируются заново. Расхождение текста между вкладками «Действия» и «Схема» -
дефект, а не вариант оформления. Страховка - completeness-тест по образцу Phase 12
(`ActionType` против реестра): **каждый** `ActionType` обязан уметь рисоваться узлом.

**Узел не интерактивен** (D-01). Нет `role="button"`, нет `tabIndex`, нет hover-эффекта смены
фона, нет курсора `pointer`, нет DnD. Единственные интерактивные элементы холста - `Tooltip`
на бейдже переполнения и на чипе перехода. Клик по узлу **не** открывает Sheet и **не** уводит
на вкладку «Действия»: обещать редактирование там, где его нет, хуже, чем не обещать ничего.

**Семантика.** Холст - `<figure>` с `<figcaption>` (заголовок печатного листа, визуально скрыт
на экране, показан в печати). Спина - `role="list"`, узлы - `role="listitem"`.
Порядок обхода для скринридера совпадает с порядком выполнения; дорожка ветвления читается
сразу после своего родительского узла, а не в конце документа.

**Мобильная раскладка (<768px).** Дорожка ветвления **не** уезжает в горизонтальный скролл
(ARCHITECTURE: горизонтальный скролл страницы запрещён). Grid переходит в одну колонку,
ветка «Иначе» рендерится вложенным блоком с отступом 32px, левой 2px пунктирной полосой
и явным префиксом-подписью «Иначе». Обязательный `@media (max-width: 640px)` на grid,
как требует ARCHITECTURE.

### C. Вкладка «Схема» в IVR-меню (D-05)

`IvrFormModal` держит табы `main | sounds_prompts | routes` (лейблы «Основные» / «Фразы» /
«Пункты») и рисует их по **варианту A** (SCSS-модуль, `cls.tabsRow` / `cls.tab` / `cls.tabActive`).
Добавляется четвёртый таб `flowchart` тем же паттерном и с тем же флагом `routes.show_flowchart`.

**Состав тела вкладки - тот же, что у маршрутного хоста** (Surface A, пункты 1-4): полосы
режима просмотра и черновика, тулбар с «Печатью», **свёрнутая форма прогона** и холст схемы.
Вкладка IVR несёт полноценный прогон, а не только печать (user input, 2026-09-03).

**Модель, из которой строится граф** (проверено по коду, не по памяти):
`IIvrMenuItem = { digit: string; actions: IRouteAction[] }` - у пункта меню ровно два поля,
причём `digit` - **свободная строка-паттерн**, а не цифра из фиксированного набора.
Сам IVR несёт `timeout` (WaitExten), `timeout_response`, `timeout_digit`, `max_count`.
Генератор диалплана (`ivrs.service.ts`) раскладывает каждый пункт в `exten => <digit>`,
подставляет `i` вместо пустого `digit`, а при `max_count > 0` добавляет счётчик проходов
и переход на `exten => max` (если пункта `max` нет - фоллбэк `Hangup()`).

**Форма графа для IVR** - тот же узел и та же дорожка, другой корень и другие подписи связей:

- **Корневой узел** - «Меню IVR "{{name}}"», иконка `AppWindow`, под ним - таймауты меню
  (`Label 12/600`, моно для чисел).
- **По одной ветке на пункт меню**, подпись связи - «Кнопка {{digit}}» для одиночного нажатия
  и «Набор по шаблону {{pattern}}», если `digit` - паттерн, а не одиночный символ. Внутри ветки -
  цепочка действий этого пункта (тот же `DialplanAppsEditor`-контракт, host `IvrMenuItemsEditor`).
  Ветвление по пунктам наглядно ровно так же, как ветвление по условию (D-05).
- **Служебные ветки - это те же пункты меню, а не отдельная сущность.** В модели они
  закодированы значением `digit` по конвенции диалплана, и схема обязана переводить их на
  человеческий язык: `t` → «Не нажали кнопку», `i` → «Нажали неверную кнопку»,
  `max` → «Исчерпаны проходы по меню». Рендерятся **после** цифровых, в этом порядке.
- **Служебной ветки, которой нет в `menu_items`, схема не рисует.** Пункт `t` / `i` / `max`
  существует только если пользователь его создал; дорисовывать несуществующую ветку значит
  показывать поведение, которого в диалплане не будет. Единственное исключение -
  при `max_count > 0` и отсутствии пункта `max` рендерится **терминальный** узел
  «Исчерпаны проходы по меню → звонок завершён»: этот фоллбэк генератор добавляет сам,
  и он реально исполняется.
- Флаг `direct_dial` **на схеме не отражается**. Он есть в модели (`ivr.model.ts`), но ни одной
  строки диалплана не порождает - в генераторе у него нет потребителя. Рисовать ветку
  «Набрали номер напрямую» значило бы обещать маршрутизацию, которой нет.
- Ветки растут **вниз**, а не вправо: 10 пунктов в ряд не печатаются ни в какой ориентации.

### D. Печать и PDF (D-04)

**Драйвер** - `useReactToPrint({ contentRef })` из `react-to-print` (уже зависимость).
Он печатает **только поддерево холста**, а не страницу. Это принципиально: схема живёт внутри
`Dialog` с оверлеем, блокировкой скролла body и порталом Radix, и обычный `window.print()`
в этих условиях печатает затемнённый оверлей и обрезанное тело модалки.

**Правила печатного вида - в SCSS-модуле холста, в блоке `@media print`.** Инлайн `<style>`
с `!important` (как в `ScenarioTreePreview`) запрещён.

**Печать = светлая тема, а не инверсия.** Приложение dark-first; печатать `#09090b` на бумаге -
это залитый тонером лист и нечитаемый текст. Печатный root переопределяет **ровно тот набор
переменных, который уже объявлен для класса `.light` в `globals.css`**:

```scss
@media print {
  .canvas {
    --color-background: #ffffff;
    --color-card: #ffffff;
    --color-foreground: #09090b;
    --color-muted: #f4f4f5;
    --color-border: #e4e4e7;
    /* семантические токены не трогаются: primary / warning / destructive / info / success
       остаются собой, поэтому пройденный путь на бумаге того же цвета, что на экране */
  }
}
```

Это не хардкод цвета вне системы, а применение существующего светлого набора токенов.
Формулировка D-04 «печатный вид совпадает с экранным» выполняется буквально в том смысле,
который проверяем: печать - это **та же схема в светлой теме**, с той же геометрией, теми же
узлами, теми же подписями, теми же номерами обхода и без единого скрытого или добавленного
элемента, кроме печатного заголовка.

**Обязательные правила печати:**

| Правило | Значение |
|---------|----------|
| Поля страницы | `@page { margin: 12mm }`, ориентация portrait (fallback landscape - только хост IVR, см. UI Considerations) |
| Цвета тинтов | `print-color-adjust: exact` + `-webkit-print-color-adjust: exact` на холсте, иначе браузер выбросит фоны бейджей и тинт пройденного пути |
| Разрыв узла | `break-inside: avoid` на каждом узле и на каждой карточке итога: узел, разрезанный по середине summary, бесполезен |
| Разрыв ветки | `break-inside: avoid` на дорожке ветвления целиком, если она короче 1/3 листа |
| Скрывается в печати | тулбар, кнопка «Печать», форма dry-run, полоса режима просмотра, полоса о черновике, кнопки закрытия модалки, скроллбары |
| Показывается только в печати | `<figcaption>`: название маршрута или меню + дата печати + счётчик действий; при наличии результата прогона - строка с номером и пресетами прогона, иначе распечатка с подсветкой не объяснит, откуда подсветка |
| Не меняется | размеры шрифтов, ширина узла, отступ дорожки, толщины линий, номера обхода |
| Скролл | `max-height: none; overflow: visible` на холсте |
| Многоточие | `text-overflow` снимается, длинный текст переносится целиком: на бумаге нет hover и нет `title` |

### E. Форма dry-run на вкладке «Схема», оба хоста (D-29, D-30)

Сворачиваемая группа («Проверить маршрут» на хосте маршрута, «Проверить меню» на хосте IVR)
на вкладке «Схема», **по умолчанию свёрнута**
(паттерн вторичной группы полей из ARCHITECTURE: заголовок-toggle + `ChevronDown` +
обязательный `tooltip` секции, `aria-expanded` / `aria-controls`).
Фон `color-mix(in srgb, var(--color-muted) 35%, transparent)`.

**Состав, сверху вниз:**

1. Поле «Номер звонящего» - `Input`, моно-шрифт, `inputMode="tel"`, плейсхолдер-пример.
2. Группа «Что произошло в звонке» - контролы пресетов (см. ниже).
3. `HStack`: primary-CTA «Прогнать сценарий» + текстовая кнопка «Сбросить прогон»
   (рендерится только когда результат есть).

**Форма выводится из цепочки, а не из полного словаря пресетов.** Для каждого источника условия,
который цепочка **реально читает**, рендерится ровно один контрол:

| Источник условия (`ConditionSourceKind`) | Контрол | Опции |
|------------------------------------------|---------|-------|
| `dialstatus` | `Select` | «Ответили» / «Не ответили» / «Занято» / «Абонент недоступен» |
| `queuestatus` | `Select` | «Никто не взял трубку» / «Очередь переполнена» / «Нет свободных операторов» / «Ответили» |
| `device_state` | `Select` на устройство | «Абонент не в сети» / «Абонент свободен» / «Абонент занят» |
| `record_status` | `Select` | «Сообщение записано» / «Сообщение не записано» |
| `variable` | `Input` (моно) на имя переменной | свободное значение |
| `http_result` | `Input` (моно) | свободное значение |
| расписание (`TimeGroupSelect`) | `SegmentedControl` | «Время попадает в расписание» / «Время не попадает» |

Обоснование: условия в проекте шире `DIALSTATUS` (D-30, Phase 12 D-22), и полный словарь
пресетов на экране - это десяток контролов, из которых цепочке нужны один-два. Форма, которая
спрашивает только про существующие в цепочке проверки, объясняет заодно, **что** маршрут проверяет.
Если цепочка не проверяет ничего - zero-state строка (копия в контракте), поле номера и CTA остаются.

**Формулировки пресетов - те же, что в редакторе условий Phase 12** (D-30 дословно: «ровно те же
пресеты»). Ключи `routes.chain.conditions.*` переиспользуются, **новых формулировок для тех же
исходов не вводится**: «не ответили» на схеме и «Не ответили» в редакторе условий обязаны быть
одной строкой из одного ключа. Строки `routes.dryrun.preset.*` в контракте выше - только для
исходов, у которых в Phase 12 пресета не было (например «Ответили» как положительный исход).

**Один набор пресетов на источник, а не на шаг.** Прогон детерминирован (D-29): выбранный исход
применяется ко всем шагам, читающим этот источник. Спрашивать исход отдельно для каждого шага
означало бы форму из 20 полей ради одного прогона.

**Результат не открывает новую поверхность.** Нажатие CTA подсвечивает путь на холсте ниже
(Surface F) и скроллит холст к первому узлу пути. Отдельной панели результата нет (D-31).

#### E2. Вход прогона на хосте IVR (user input, 2026-09-03)

Тот же компонент формы, тот же CTA, тот же результат-на-холсте. Отличается **только состав
входных контролов**, и он выводится из модели меню по тому же принципу, что состав пресетов
выводится из цепочки: контрол существует, если меню реально его читает.

| Контрол | Когда рендерится | Опции / значение |
|---------|------------------|------------------|
| «Номер звонящего» (`Input`, моно) | всегда | тот же контрол, что на маршрутном хосте |
| «Что сделал абонент» (`Select`) | когда `menu_items` не пуст | **по одной опции на существующий пункт меню**: «Нажал кнопку {{digit}}» для одиночного символа, «Набрал номер по шаблону {{pattern}}» для паттерна, «Ничего не нажал» для пункта `t`, «Нажал кнопку, которой нет в меню» для пункта `i` |
| «Нажал кнопку, которой нет в меню» (доп. опция того же `Select`) | **всегда**, даже если пункта `i` нет | это не пункт меню, а входное событие: абонент физически может нажать что угодно. Именно этот вход показывает, что при отсутствии `i` звонок никуда не уходит |
| «Ничего не нажал» (доп. опция того же `Select`) | **всегда**, даже если пункта `t` нет | то же обоснование: таймаут наступает независимо от того, обработан он или нет |
| «Какой это проход по меню» (`Input type="number"`, 1…`max_count`) | только при `max_count > 0` | иначе ветка `max` недостижима и спрашивать номер прохода нечего |

**Один `Select`, а не клавиатура из 12 кнопок.** DTMF-клавиатура выглядит уместнее, но `digit` -
свободный паттерн: пункт может быть `_XXX` или `t`, и такой пункт на клавиатуре не нажимается.
`Select`, собранный из фактических `menu_items`, покрывает любой `digit` и заодно показывает,
из чего меню вообще состоит.

**Два входных события всегда доступны, даже когда обработчика нет.** Это осознанная асимметрия
с маршрутным хостом: там форма спрашивает **только** про то, что цепочка читает, а здесь
«ничего не нажал» и «нажал не то» - не проверки цепочки, а поведение абонента, которое
случается вне зависимости от настройки меню. Прогон, который не даёт проверить необработанный
таймаут, скрывает самую частую дыру в IVR.

**Если `menu_items` пуст** - zero-state строка «В меню нет пунктов» + тело со ссылкой на вкладку
«Пункты», CTA `disabled`. Прогонять меню без пунктов нечего, и это не ошибка, а незаполненность.

### F. Результат dry-run: подсветка пути на схеме (D-31)

Результат - это **состояние того же холста**, а не второй холст и не второй компонент.

**Что меняется на холсте при наличии результата:**

1. **Чипы порядка обхода** - кружок 24px с номером (`Label 12/600`, tabular-nums) на каждом
   пройденном узле, в порядке выполнения. `aria-label` - «Порядок выполнения: {{n}}».
   Это главный канал: он один работает на чёрно-белой печати.
2. **Пройденные связи** - 2px сплошные, `--color-primary`. **Непройденные** - 1px пунктирные,
   `--color-muted-foreground`.
3. **Пройденные узлы** - рамка 2px `--color-primary` + тинт
   `color-mix(in srgb, var(--color-primary) 6%, transparent)` (та же формула, что у выбранной
   строки в Phase 12). **Непройденные** - штатная рамка 1px, текст в `--color-muted-foreground`,
   плюс бейдж «Не выполнялось».
4. **Карточка итога** - в конце пройденного пути, обязательна в каждом исходе.
   Тинт по смыслу: success (ответили), warning (предел переходов, цепочка кончилась),
   destructive (шаг невалиден, цепочка обрывается). Заголовок `Heading 16/600` - строка «Итог: …»
   из контракта; тело - `Body 14/400` с деталью (имя очереди, номер шага, значение предела).
5. **Заголовок результата** - «Путь звонка» + повтор входных данных прогона (номер моно + выбранные
   пресеты как `Badge outline`). Без него распечатка со подсветкой не объясняет, откуда подсветка.

**Непройденная ветка остаётся на схеме.** Скрывать её запрещено: половина ценности прогона -
увидеть, **какая** ветка не сработала и почему. Пункт 3 выше даёт ей muted-состояние, а не `display: none`.

**Повторный прогон заменяет результат целиком**, не накапливает подсветку. Смена цепочки на
вкладке «Действия» **сбрасывает** результат: подсвеченный путь по устаревшей цепочке - ложь.
Сброс сопровождается возвратом холста в состояние покоя, молча оставлять чипы порядка нельзя.

**Прогон - не валидация.** Итог «шаг невалиден» ничего не блокирует и не мешает сохранить маршрут:
блокировка сохранения принадлежит валидации Phase 12 (Surface F), у которой свои правила.

#### F2. Результат прогона на хосте IVR (user input, 2026-09-03)

**Визуальный язык не удваивается.** Пятиканальный контракт из раздела Color (чипы порядка,
толщина и пунктир линии, толщина рамки, текстовый бейдж, цвет последним) применяется к схеме IVR
**дословно**, без единого нового канала и без второго набора состояний узла. Второй визуальный
язык для второго хоста - это две схемы, которые надо учить по отдельности.

Что подсвечивается на схеме IVR:

1. **Корневой узел меню** всегда пройден (чип `1`): звонок дошёл до меню по определению.
2. **Ветка выбранного пункта** пройдена целиком до своего терминального узла или до чипа
   перехода; чипы порядка продолжают нумерацию с `2`.
3. **Остальные ветки** переходят в непройденное состояние: 1px пунктир, muted-текст,
   бейдж «Не выполнялось». Как и на маршрутном хосте, они **не скрываются и не гасятся
   `opacity`**: половина ценности прогона IVR - увидеть, какой пункт не сработал.
4. **Карточка итога** обязательна в каждом исходе, включая четыре исхода, которых нет
   на маршрутном хосте: сработал пункт, пункта нет и обработчика `i` нет, таймаут без
   обработчика `t`, проходы исчерпаны (с обработчиком `max` и без него). Копии - в контракте.

**Граница прогона: он останавливается на разрешении самого меню.** `ASSUMED — confirm`.

Прогон отвечает на вопрос «какой пункт меню сработает и куда уйдёт звонок», **называет цель
перехода по имени и на этом заканчивается**. Внутрь цепочки целевого маршрута, IVR или очереди
он не заходит. Последний узел пройденного пути - чип перехода (Surface B) плюс карточка
«Дальше звонок уходит в "{{name}}", прогон туда не заходит» с подсказкой открыть эту цепочку
и прогнать её отдельно.

Обоснование, почему взят более узкий вариант: `14-CONTEXT.md` определяет вход прогона (D-30)
и способ показа результата (D-31), но **не определяет модель перехода между сущностями** -
ни как показывать чужую цепочку на этом холсте, ни что делать с зацикливанием
«IVR → маршрут → тот же IVR», ни откуда брать её тенантные настройки. Сквозной прогон требует
собственных решений по всем трём пунктам, и принимать их молча внутри UI-контракта нельзя.
Узкий вариант при этом **уже полезен**: он проверяет ровно то, что настроено на этой вкладке,
и совпадает с правилом Surface B, где переход на другую сущность рисуется чипом, а не линией.
То же правило действует и на маршрутном хосте: итог «звонок ушёл на маршрут "{{name}}"»
не разворачивает цепочку того маршрута.

### G. Кнопки шаблонов в редакторе действий (D-37)

Футер `DialplanAppsEditor` (`styles.footer`, `Flex gap="8"`) сегодня несёт «Добавить действие»
и «Вставить скопированный шаг». Добавляются две кнопки того же вида
(`Button variant="outline" size="sm"`):

| Кнопка | Иконка | `disabled` когда | Tooltip при `disabled` |
|--------|--------|------------------|------------------------|
| «Из шаблона» | `LayoutTemplate` | достигнут `maxSteps` | копия лимита из Phase 12 |
| «Сохранить как шаблон» | `Save` | цепочка пуста | «Сначала добавьте хотя бы одно действие» |

**Порядок в футере:** «Добавить действие» → «Вставить скопированный шаг» → «Из шаблона» →
«Сохранить как шаблон». Primary-акцент остаётся только у «Добавить действие»
(в пустом состоянии - у него же); кнопки шаблонов - `outline`.

**Переполнение на <768px.** Четыре кнопки в футере на 375px не помещаются. Инлайн остаются
«Добавить действие» и `DropdownMenu` (`MoreVertical`), в котором «Вставить скопированный шаг»,
«Из шаблона», «Сохранить как шаблон». Правило переполнения дословно повторяет
Phase 12, Surface A (не более 2 hit-target в строке на телефоне).

**Кнопки живут только в хостах, где шаблон осмыслен.** `readOnly`-режим редактора их не рендерит
(не `disabled`). В хостах `RoutePhonebooksTab` и `IvrMenuItemsEditor` (`density="compact"`,
сокращённый `allowedTypes`, `maxSteps: 10`) кнопки шаблонов **не рендерятся**: шаблон, собранный
для полного набора типов, применённый в сокращённый host, даст шаги с бейджем
«Недоступно в этом контексте», то есть заведомо сломанный результат. Шаблоны - для
`RouteActionsTab`. Это ограничение обязательно проговорить, иначе планировщик разложит
кнопки во все три host-а.

**Пустое состояние цепочки** получает вторую, текстовую кнопку «Из шаблона» под primary-CTA
«Добавить действие»: пустой маршрут - самый вероятный момент, когда шаблон нужен, и прятать
его в футер, которого в пустом состоянии нет, значит спрятать функцию.

### H. Диалог «Из шаблона»: выбор → подстановка → применение (D-35, D-36)

Один `Dialog` (не `Sheet`) с тремя шагами внутри, поверх `RouteFormModal`. Shell - form-modal
паттерн ARCHITECTURE (header `shrink-0` / `scrollBody` / footer `shrink-0`), ширина
`min(720px, calc(100vw - 1rem))`.

**Почему `Dialog`, а не `Sheet`:** `Sheet` в этой подсистеме занят параметрами шага (Phase 12,
D-01), и правило «Sheet не открывает Sheet и не открывает Dialog» держит глубину стека.
Кнопка «Из шаблона» живёт в теле вкладки, а не в Sheet, поэтому `Dialog` над модалкой - это
2 уровня, ровно как проверенный M8-стек.

**Шаг 1 - «Выбор шаблона».** Две колонки (`grid-template-columns: 280px 1fr`, на <640px - одна):

- Слева: `Input` поиска по названию + список шаблонов. Каждая строка: название (`Heading 16/600`),
  бейдж «Встроенный» / «Мой», счётчики «Действий: N» и «Подстановок: N» (`Label 12/600`).
  Фильтр `SegmentedControl` [Все | Встроенные | Мои] над списком.
- Справа: предпросмотр - **read-only список шагов** шаблона тем же строчным лейаутом, что
  редактор в `density="compact"`, без действий и без handle. Места подстановки в summary
  рендерятся моно-чипом с именем слота, а не пустотой: пользователь должен видеть, что именно
  у него спросят.

**Шаг 2 - «Чем заполнить шаблон» (D-35).** Форма по слотам шаблона. Каждый слот - штатное поле
schema-driven контракта (Phase 12, Surface C): `Label` + `InfoTooltip` + `Select` из справочника
(очереди / группы / IVR / транки / записи). Три состояния справочного `Select` обязательны
(грузится / пусто после ответа / заполнено) - правило Phase 12, Surface C, включая ссылку на
раздел создания **в новой вкладке** (`target="_blank"`): здесь несохранённый черновик маршрута,
и уход в той же вкладке стоил бы пользователю всей цепочки.

Слот **обязателен**: применить шаблон с незаполненным слотом нельзя, CTA `disabled` с
Tooltip-объяснением. Шаблон без слотов пропускает шаг 2 целиком, а не показывает пустую форму.

**Шаг 3 - «Как применить шаблон» (D-36).** Рендерится **только если в цепочке уже есть шаги**;
в пустой маршрут шаблон применяется сразу после шага 2.

- `RadioCards` из двух опций: «Заменить целиком» и «Дописать в конец», каждая с описанием
  последствий (плюрализованные строки в контракте, `_one` / `_other` со счётчиком текущих шагов).
- Опция по умолчанию - **«Дописать в конец»**: она не теряет данные. Предвыбранное «Заменить
  целиком» превращает диалог в ловушку для того, кто жмёт Enter.
- При «Дописать в конец» - warning-строка о порядке: если текущая цепочка уже завершается,
  дописанное не выполнится. Это то же предупреждение о недостижимых шагах, что Phase 12,
  Surface H, и оно предсказуемо срабатывает именно при дописывании.
- **«Заменить целиком» дополнительно требует подтверждения** (копия в контракте) - это
  необратимая потеря пользовательских данных. «Дописать в конец» подтверждения не требует.
  Молча терять шаги запрещено (D-36).

**Результат применения** попадает в черновик редактора через тот же типизированный `onChange`,
что и любая правка. Шаги получают новые `crypto.randomUUID()`-идентификаторы (правило Phase 12);
переиспользовать id из шаблона запрещено - два шага с одним id ломают выделение и undo.
После применения диалог закрывается, редактор скроллится к первому пришедшему шагу,
и правка **обратима штатным undo** редактора.

**Ошибка применения** оставляет диалог открытым и цепочку нетронутой (см. UI Considerations).

### I. Диалог «Сохранить как шаблон» (D-33, D-35)

`Dialog`, ширина `min(560px, calc(100vw - 1rem))`, form-modal shell.

**Состав:**

1. «Название» (обязательное, суффикс ` *`) + «Описание» (`Textarea`, опционально).
2. Секция «Что спрашивать при применении» - **автоопределённые кандидаты в слоты**.
   Каждая ссылка на очередь / группу / IVR / транк / запись в цепочке даёт строку:
   `Checkbox` + человекочитаемое имя цели + тип. Отмеченное значение шаблон **не запоминает**,
   а спрашивает при применении (D-35). По умолчанию **отмечены все** найденные ссылки:
   шаблон со ссылкой на конкретную очередь одноразовый (прямая формулировка D-35), поэтому
   параметризация - это дефолт, а не опция для внимательных.
3. Предпросмотр: read-only список шагов, где отмеченные значения уже показаны моно-чипом слота.
   Пользователь видит будущий шаблон до сохранения.

**Кандидатов не найдено** (цепочка из `hangup` и воспроизведения) - секция 2 не рендерится вовсе,
ни пустой, ни свёрнутой. Пустая секция обещает содержимое, которого нет (правило Phase 12, Surface D).

**Встроенный шаблон только для чтения.** Попытка сохранить поверх встроенного отклоняется с
копией «Встроенный шаблон нельзя изменить. Сохраните свою копию» и предлагает CTA «Сохранить копию».

### J. Раздел «Шаблоны маршрутов» (D-37)

Новая страница, штатный паттерн CRUD-страницы проекта (эталон композиции - `RoutesPage`:
иконка + `Text variant="h1"` + фильтр + primary-CTA, ниже таблица, ниже модалки).
**Стилизация - SCSS-модуль**, а не Tailwind в `pages/`: `RoutesPage` использует Tailwind-классы
как унаследованный долг, тиражировать его в новой странице ARCHITECTURE запрещает.

**Регистрация в навигации** - в двух местах, оба обязательны:

- `features/modules/lib/moduleRegistry.ts`, модуль `core` (`nav.pbx`), сразу после `routes`.
- `widgets/Sidebar/lib/buildNavigation.ts`, блок PBX, сразу после «Маршрутизация».

Путь `/route-templates`, иконка `LayoutTemplate` (отличается от `Route` у маршрутов -
две одинаковые иконки в соседних пунктах меню неразличимы).

**Таблица** - `DataTable` (клиентские сортировка / фильтр / пагинация, как везде в проекте).
Колонки: название, описание (обрезка в одну строку + `title`), «Действий», «Подстановок»,
источник (бейдж «Встроенный» / «Мой»), обновлён, действия.

**Колонка действий - только `TableRowActions` + `TableRowAction`** (ARCHITECTURE MUST):
«Изменить» (`Pencil`), «Копировать» (`Copy`), «Удалить» (`Trash2`, `danger`).
У встроенного шаблона «Изменить» и «Удалить` - `disabled` с Tooltip-объяснением,
«Копировать» активна: копия встроенного - штатный способ его подстроить.
У каждой обязательны `title` и `aria-label`.

**Форма шаблона** (create / edit / copy) - `Dialog` по form-modal паттерну, с триадным
`modalMode: 'create' | 'edit' | 'copy'` (ARCHITECTURE, паттерн копирования). При `copy`
очищается **название** (остальное копируется полностью) - то же правило, что у Trunks и Routes.
Тело формы: название, описание, редактор цепочки (`DialplanAppsEditor`, полный набор типов,
`density="comfortable"`) и секция слотов из Surface I.

**Редактор внутри формы шаблона - полноценный**, не read-only: раздел существует ровно затем,
чтобы шаблон можно было править вне маршрута (D-37, «полный CRUD»). Это не противоречит D-01:
D-01 запрещает второй редактор **одной цепочки маршрута**, а цепочка шаблона - отдельная сущность.

**Мобильная раскладка** - штатное правило ARCHITECTURE для таблиц: карточные строки на телефоне
для основных данных, `overflow-x-auto` только для вторичных таблиц.

### K. Callback: параметры шага в Sheet (D-41)

Новый `ActionType` `callback` в реестре Phase 12. Все параметры шага - **в Sheet**
(Phase 12, D-01, дословно), никаких контролов в строке шага.

**Поля (schema-driven, маппинг Phase 12, Surface C):**

| Поле | Контрол | Примечание |
|------|---------|------------|
| «Дозваниваться с» / «Дозваниваться до» | два `Input type="time"` | Пара коротких полей - допустимая вторая колонка при ≥640px с обязательным `1fr`-фоллбэком |
| «Сколько раз пытаться» | `Input type="number" inputMode="numeric"` | |
| «Пауза между попытками, мин» | `Input type="number" inputMode="numeric"` | |

Каждое поле - неявное по классификации ARCHITECTURE (окно дозвона без объяснения читается как
«во сколько звонить один раз»), поэтому `InfoTooltip` **обязателен** у окна дозвона
(копия в контракте). Числовые поля с единицей в лейбле - явные, tooltip не нужен.

**Summary шага** - одно предложение из реестра (копия в контракте), не `key=value`.

**Что на шаге не настраивается** (D-38 / D-39: это настройки, а не параметры шага):
режим заказа, DTMF-кнопка, порядок набора. Раскладывать их ещё и на шаг означало бы два
источника истины на один вопрос. Sheet шага несёт `InfoTooltip` с копией
«Режим заказа, кнопка и порядок набора - общие для тенанта, они в настройках колл-центра,
на вкладке "Обратный звонок"» и ссылку на эту страницу **в новой вкладке** (`target="_blank"`):
здесь несохранённый черновик маршрута, и уход в той же вкладке стоил бы пользователю цепочки.
Контролы настроек в Sheet **не дублируются**.

**Разделение «настройки против параметров» проговаривается в обе стороны.** Пользователь видит
его как «одинаковое для всех маршрутов - в настройках, своё у каждого маршрута - в шаге»:
кнопка заказа и порядок набора у тенанта ровно одни, а окно дозвона у ночного маршрута
и у дневного разные, поэтому они и живут на шаге. Обе поверхности несут по одной строке
об этом (`…callback.stepParamsNote` на странице настроек, подсказка выше - в Sheet), так что
разделение читается как замысел, а не как рассинхрон.

**Терминальность.** Шаг callback уводит вызов из цепочки (абонент кладёт трубку и ждёт звонка),
поэтому он получает бейдж «Может выйти из цепочки» (warning, условный выход, Phase 12, Surface H),
а **не** «Завершает цепочку»: при отказе абонента от заказа цепочка продолжается.

### L. Callback: настройки на странице колл-центра (D-38, D-39; хост - user input, 2026-09-03)

**Хост - страница настроек колл-центра, не тенантные настройки.** Настройки callback едут
в `pages/CallCenterSettingsPage` новой вкладкой `callback`; секция `routes` в
`features/tenant-settings/ui/TenantSettingsSection` для callback **не создаётся**.
Тенантный флаг `routes.show_flowchart` остаётся там, где он есть - его эта поверхность
не касается вовсе.

Обоснование: callback - это работа колл-центра (очереди, операторы, дозвон), и настраивает его
тот же супервизор, который на этой же странице держит `AutoPauseRulesForm`, `ShiftPolicyForm`
и пороги алертов. `TenantSettingsSection` - поверхность флагов и лимитов платформы, а не
операционных политик колл-центра.

**Механика страницы, в которую надо встроиться** (проверено по коду):

- `CallCenterSettingsPage` держит `CcSettingsTabId` и `TAB_IDS`, рисует табы по **варианту A**
  (SCSS `styles.tabsRow` / `styles.tab` / `styles.tabActive`) и в `renderPanel()` монтирует
  по одному feature-компоненту на таб. Добавляется `'callback'` в `CcSettingsTabId` и `TAB_IDS`.
- **Позиция таба** - сразу после `'shifts'` и перед `'alertThresholds'`: `shifts` и `callback` -
  обе операционные политики тенанта, а дальше начинаются алерты и персональные настройки.
- Страница различает **два уровня**: per-operator (`useGetMyUiCustomizationQuery`,
  `useGetMyNotificationsQuery`, вкладки `myPanel` / `operatorSettings`, матрица уведомлений
  с `locks`) и **tenant** (`useGetTenantSettingsQuery` / `useUpdateTenantSettingsMutation`,
  тип `ICcSettings`, эндпоинт `/callcenter/settings/tenant`, вкладки `shifts` / `autoPause` /
  `alertThresholds`).

**Уровень настроек callback - тенантный.** Это поведение маршрута и очереди, одинаковое для всех,
кто их обслуживает; персонального смысла у «какую кнопку нажимает абонент» нет.
Технически - новое поле в `ICcSettings` (по образцу `shift_policy`), читается
`useGetTenantSettingsQuery`, пишется `useUpdateTenantSettingsMutation`.
**Lock-aware механика (`ui_visibility_locks`, `permission_locks`, `locks` матрицы уведомлений)
здесь не применяется**: она существует для того, чтобы супервизор ограничивал персональные
настройки оператора, а у тенантной настройки нет персонального уровня, который можно запирать.
Вводить для callback третий уровень locks запрещено.

**Компонент - `features/callcenter/ui/CallbackSettingsForm`, слепок `ShiftPolicyForm`**
(та же вкладка, тот же уровень, та же аудитория - значит и тот же паттерн, а не новый):

| Элемент паттерна | Контракт |
|------------------|----------|
| Права | `canEdit = level === SUPERVISOR \|\| level === ADMIN`; иначе все контролы `disabled` + muted-строка `…callback.readOnly` (не скрывать форму: посмотреть, как настроено, полезно и оператору) |
| Заголовок | `…callback.title` (`Heading 16/600`) + `…callback.hint` (`Body 14/400`, muted) |
| Состояние формы | локальный `useState` + `patch(partial)`, синхронизация из `data` через `useEffect` - **не** RTK-патч на каждый чих |
| Сохранение | явная кнопка в футере, состояния `common.save` / `common.saving` / `common.saved`, `toast.success` на `…callback.saved`, `toast.error` на `common.saveFailed` |
| Loading | `Skeleton` (заголовок + блок формы), как `ShiftPolicyForm` |
| Error | `Text variant="error"` с `common.loadFailed` + `Button variant="outline" size="sm"` с `common.retry` |
| `data-testid` | `callback-settings-form` (страница уже так тестируется: `shift-policy-form`, `cc-settings-responsive`) |

**Оптимистичного write-on-change здесь нет, и это не отступление от ARCHITECTURE.**
Правило Optimistic toggles адресует контрол, чей `checked` берётся из RTK-кэша и который пишет
**без** кнопки Save. Здесь черновик живёт в локальном состоянии и уходит одним `PUT` по кнопке -
ровно как в `ShiftPolicyForm` и `AutoPauseRulesForm` на соседних вкладках. Второй паттерн
сохранения на одной странице настроек хуже, чем следование её собственному.

**Три поля:**

| Настройка | Контрол | Опции |
|-----------|---------|-------|
| «Как заказывают обратный звонок» | `Select` | «По выбору абонента» / «Автоматически, если абонент бросил трубку в очереди» / «Оба способа» |
| «Кнопка для заказа» | `Select` | `0`…`9`, `*`, `#` (моно-шрифт в опциях) |
| «Порядок набора» | `SegmentedControl` | «Сначала оператор» / «Сначала абонент» |

Раскладка ряда - `Label` + `InfoTooltip` сверху, контрол под ним, вертикальный ритм 16px
(`styles.field` / `styles.row` соседних форм этой страницы). Ряд `HStack justify="between"`
из `TenantSettingsSection` здесь **не** используется: это чужая поверхность со своим ритмом.

**«Кнопка для заказа» скрывается**, когда режим - «Автоматически»: спрашивать про кнопку там,
где кнопки нет, значит собирать заведомо неиспользуемое значение. Не `disabled`, а не рендерится
(то же правило, что у переключателя dialplan в Phase 12).

**Порядок набора требует расширенной подсказки.** Разница между «сначала оператор» и «сначала
абонент» - не косметика, она определяет, кто услышит тишину. `InfoTooltip` перечисляет **оба**
режима построчно с `**жирным**` именем режима (формат `formatRichTooltipText`, копия в контракте).

**Форма обязана сказать, чего она не настраивает.** Под полями - muted-строка
`…callback.stepParamsNote` про окно дозвона и число попыток, которые задаются в самом действии
«Обратный звонок» (D-41, Surface K). Без неё супервизор ищет окно дозвона здесь, не находит
и считает настройку неполной.

**Настройки без единого шага callback ни на что не влияют.** Если в тенанте нет ни одного
действия «Обратный звонок», над формой рендерится muted-строка `…callback.disabledHint`.
Это **не** блокирует поля: настроить заранее - нормальный порядок работы.

### M. Callback: заявки в панели оператора (D-42)

Панель оператора (`CallCenterAgentPage`) держит инструменты шапки в `styles.headerTools`:
`MissedCallsPanel`, `ParkedCallsIndicator`, `SoftphoneWidget`, `ChatPanelHost`.
Заявки callback встают **соседним инструментом того же вида** - бейдж со счётчиком + dropdown,
по образцу `ParkedCallsIndicator`, который сам «mirrors MissedCallsPanel 1:1».
Это и есть «рядом с пропущенными из Phase 9» (D-42).

**Позиция** - сразу после `MissedCallsPanel`, перед `ParkedCallsIndicator`: пропущенные и
обратные звонки - две половины одной работы «кому мы должны перезвонить», и разрывать их
парковкой нельзя.

**Бейдж:**

- Иконка `PhoneOutgoing` - отличается и от `PhoneMissed` (пропущенные), и от `ParkingCircle`
  (парковка). Один значок на две сущности - прямой путь к тому, что оператор откроет не тот список.
- Счётчик - число активных заявок в его очередях.
- **Тинт по срочности, не по сущности:** muted при обычных ожидающих заявках, warning при наличии
  просроченных (окно дозвона истекает) или неудавшихся. Правило дословно повторяет эскалацию
  бейджа пропущенных из Phase 9, Surface 8: цвет поднимается только тогда, когда «кто-то должен
  действовать».
- При нуле заявок бейдж **не рендерится** (`ParkedCallsIndicator` precedent).

**Dropdown** - header (иконка + заголовок + кнопка закрытия), `SegmentedControl`
[Активные | Завершённые] (тот же контрол и та же логика, что у пропущенных), список строк.

**Строка заявки:** номер (моно, `Heading 16/600`), имя если известно, бейдж статуса,
чип источника (очередь / маршрут), время заказа относительным форматом
(`fmtAgo`, уже реализован в `MissedCallsPanel`), счётчик «Попытка N из M» и строка
«Следующая попытка в HH:MM» либо «Ждёт начала окна дозвона в HH:MM».

**Действия строки:** «Позвонить сейчас» (primary, `size="sm"`) и «Отменить заявку»
(`variant="outline"`, требует подтверждения). «Позвонить сейчас» использует тот же
WebRTC / PJSIP-механизм, что callback пропущенного из Phase 9 (D-18): отдельного визуального
трактования не требует, потому что механизм идентичен.

**Одна логика списка, две обёртки.** Список строк и все его состояния живут в **одном**
компоненте (`CallbackRequestsList`), который панель оператора монтирует в dropdown, а панель
супервизора - в тело вкладки (Surface N). Двух разных таблиц одной сущности быть не должно.

### N. Callback: вкладка в панели супервизора (D-42)

`CallCenterSupervisorPage` держит настоящие табы `agents | calls | queues | history`
(SCSS `tabsRow` / `tab` / `tabActive`, вариант A). Добавляется **пятый таб** `callbacks`
тем же паттерном, с иконкой `PhoneOutgoing` и заголовком «Обратные звонки».

Прецедент формы - `{activeTab === 'history' && <CallHistoryPanel source="supervisor" … />}`:
тот же приём, один компонент с параметром области видимости. Вкладка рендерит
`CallbackRequestsList` в табличном виде (`DataTable`), а не в узком dropdown-виде.

**Область видимости** - заявки тенанта, **под тем же фильтром очередей**, что уже действует на
странице (`QUEUE_FILTER_KEY`, `cc:supervisor:queueFilter`). Заводить вкладке собственный,
второй фильтр очередей запрещено: два фильтра на одной странице дают взаимно противоречащие
состояния (ровно та ошибка, которую Phase 12, Surface L закрывала одним источником истины
для вкладки и чекбокса CDR).

**Дополнительно к операторскому виду** вкладка показывает колонку «Оператор»
(кто взял заявку) и позволяет отменить любую заявку тенанта. Действия - `TableRowActions`.

**Счётчик в заголовке таба** рендерится только когда число известно и больше нуля
(`Обратные звонки`, рядом - `Badge` с числом). `Обратные звонки: 0` шумит, ничего не сообщая -
то же правило, что у счётчика условий в Phase 12, Surface E.

---

## Motion & Accessibility

- **Схема не анимируется.** Появление узлов, «прорисовка» связей и анимированный обход пути
  запрещены: схема - документ, который печатают, а не презентация. Единственный переход -
  смена состояния узла при появлении результата прогона (`transition: border-color, background
  0.15s ease`), и он отключается под `prefers-reduced-motion: reduce`.
- **`prefers-reduced-motion: reduce`** также снимает: анимацию раскрытия группы dry-run,
  slide диалогов шаблонов (остаётся мгновенное появление), появление dropdown заявок.
  Образец правил - `SoftphoneWidget.module.scss`.
- **Фокус.** Диалог «Из шаблона» ставит фокус на поле поиска (шаг 1), на первый слот (шаг 2),
  на выбранный `RadioCards` (шаг 3). При закрытии фокус возвращается на кнопку «Из шаблона».
  Диалог «Сохранить как шаблон» - на поле «Название». Focus-ring везде через `--color-ring`,
  ad hoc outline запрещён; у полей внутри скролл-контейнеров обводка обязана быть `ring-inset`
  (ARCHITECTURE MUST).
- **Холст схемы фокусируем как регион скролла** (`tabIndex={0}` на скролл-контейнере,
  `aria-label` с названием маршрута): иначе клавиатурный пользователь не может его прокрутить.
  Сами узлы при этом не фокусируемы - они не интерактивны (D-01).
- **Результат прогона объявляется скринридеру.** Контейнер результата - `aria-live="polite"`,
  первым читается итог («Итог: …»), а не первый узел пути: пользователю нужен ответ, а не обход.
- **Touch:** 44px минимум для каждой icon-only кнопки на телефоне без исключений, включая
  «Печать», сброс прогона, закрытие dropdown заявок и действия строк в таблицах.
- **Icon-only контролы:** `title` **и** `aria-label` обязательны (ARCHITECTURE MUST).
- **Иконки:** только `lucide-react`; эмодзи запрещены везде, включая пустые состояния и бейджи.
- **Копирайт:** длинное тире `—` в UI-строках запрещено; в JSDoc допустимо.
- **Контраст и дальтонизм:** состояния узла и статусы заявок несут форму (чип порядка, толщина
  и пунктир линии, иконка, текстовый бейдж) в дополнение к цвету; непройденная ветка не гасится
  через `opacity`.
- **Адаптивность:** обязательная проверка на 375px, 768px и 1280px; все grid с фиксированными
  колонками (холст схемы, две колонки диалога выбора, пара полей окна дозвона) несут
  `@media (max-width: 640px) { grid-template-columns: 1fr }`.
- **Печать - тоже режим доступности:** контракт Surface D запрещает уменьшать шрифт под лист
  и требует снимать многоточие, потому что на бумаге нет ни hover, ни `title`.

---

## Открытые вопросы (`ASSUMED — confirm`)

### Подтверждено пользователем 2026-09-03 - вопросов больше нет

| Решение | Где в спеке | Итог |
|---------|-------------|------|
| Драйвер печати - `react-to-print`, а не голый `window.print()` | Design System, Surface D | подтверждено (Claude's Discretion по CONTEXT) |
| Форма dry-run выводится из цепочки, по одному контролу на реально читаемый источник условия | Surface E | подтверждено |
| Заявки callback в панели оператора - соседний инструмент шапки (бейдж + dropdown по образцу `ParkedCallsIndicator`) | Surface M | подтверждено |
| Вкладка супервизора подчиняется существующему фильтру очередей страницы (`cc:supervisor:queueFilter`) | Surface N | подтверждено |
| Кнопки шаблонов - только в хосте `RouteActionsTab` | Surface G | подтверждено |
| Раздел шаблонов - `/route-templates`, блок PBX после «Маршрутизация», иконка `LayoutTemplate` | Surface J | подтверждено |
| **Настройки callback - на странице настроек колл-центра**, не в тенантных настройках | Surface L (переделан) | решено **против** первоначальной рекомендации |
| **Dry-run на хосте IVR входит в фазу**, вход - что сделал абонент | Surface C, E2, F2 (переделаны) | решено **против** первоначальной рекомендации |

### Остаётся одно допущение, требующее подтверждения

1. **Граница прогона IVR: он останавливается на разрешении самого меню.** `ASSUMED — confirm`,
   Surface F2.

   Прогон определяет сработавший пункт меню, называет цель перехода по имени и **не заходит
   внутрь её цепочки**; последний элемент пути - чип перехода плюс карточка «Дальше звонок
   уходит в "{{name}}", прогон туда не заходит».

   Почему взят более узкий вариант: `14-CONTEXT.md` задаёт вход прогона (D-30) и способ показа
   результата (D-31), но **не задаёт модель перехода между сущностями** - ни отрисовки чужой
   цепочки на этом холсте, ни защиты от цикла «IVR → маршрут → тот же IVR», ни источника её
   тенантных настроек. Сквозной прогон требует трёх собственных решений, которых в CONTEXT нет.
   Узкий вариант уже полезен (проверяет ровно то, что настроено на этой вкладке) и согласован
   с Surface B, где переход на другую сущность рисуется чипом, а не линией. То же ограничение
   действует и на маршрутном хосте.

   Альтернатива, если пользователь захочет сквозной прогон: он становится отдельной задачей
   с собственным контрактом (лимит глубины переходов, обнаружение цикла, показ чужой цепочки
   свёрнутым блоком) и в этот UI-SPEC не вписывается точечной правкой.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS
- [ ] Dimension 7 Inventory Provenance: PASS

**Approval:** pending
