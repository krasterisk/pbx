---
phase: 16
slug: modul-telekonferentsiy-confbridge-webrtc
status: draft
shadcn_initialized: false
preset: none
created: 2026-09-15
---

# Phase 16 — UI Design Contract

> Визуальный и интеракционный контракт модуля телеконференций: **список комнат (CRUD)**,
> **выбор комнаты в шаге маршрута**, **живая веб-комната** (сетка видео, состояния участников,
> роли и делегированные действия), **мини-панель «вы в конференции»** и
> **гостевой вход по ссылке** с предварительным экраном.
>
> Сгенерирован `gsd-ui-researcher` из `16-CONTEXT.md` (D-01…D-41 — **LOCKED**, не перезапрашивались),
> `16-DISCUSSION-LOG.md`, skill `spike-findings-krasterisk-v4` (**заменяет отсутствующий RESEARCH.md**:
> R-ENGINE / R-VIDEO / R-CAPACITY закрыты спайками 001–004), skill `sketch-findings-krasterisk-v4`,
> `packages/frontend/.idea/ARCHITECTURE.md`, `08` / `09` / `10` / `12` / `14` / `15-UI-SPEC.md`
> и фактического кода: `features/callcenter/ui/SoftphoneWidget`, `widgets/AssistantPanel`,
> `pages/CallCenterWallboardPage`, `features/dialplan-apps`, `widgets/ModuleShell`, `widgets/ModuleHub`.
>
> **Out of scope UI:** биллинг и цена модуля в `market`-хабе (D-27), планировщик встреч,
> AI-саммари записи, «поднятая рука» и поканальное качество в списке участников (D-37),
> интерфейс общего софтфона Phase 10 (модуль надстраивается, не форкает).

> **Отклонение от формулировки задания оркестратора.** В брифе поверхностей упомянуто состояние
> «raised-hand». **D-37 явно выносит «поднятую руку» из v1** и кладёт её в `<deferred>`.
> CONTEXT.md — LOCKED, поэтому контракт состояний участника здесь ровно четыре:
> **говорит сейчас, заглушён, роль, видео вкл/выкл**. Планировщик не должен закладывать «руку».

---

## Design System

| Property | Value |
|----------|-------|
| Tool | **none** — рукописная система `packages/frontend/src/shared/ui` на Radix + CVA; `components.json` в репозитории отсутствует (проверено `Glob **/components.json` → 0 файлов). shadcn CLI **не** инициализировать |
| Preset | not applicable |
| Component library | Radix в обёртках `shared/ui/*` + CVA. Для этой фазы опорные: `Dialog`, `Sheet`, `Tabs`, `DataTable`, `Select`, `Switch`, `Badge`, `Card`, `Progress`, `AudioPlayer`, `DropdownMenu`, `Popover`, `ScrollArea`, `Tooltip`, `TableRowActions`, `PasswordInput` |
| Icon library | `lucide-react@0.475.0` only. Unicode-эмодзи в UI **запрещены** (ARCHITECTURE MUST) |
| Font | `Inter` через `var(--font-sans)`. `font-variant-numeric: tabular-nums` — таймер встречи и счётчики участников (прецедент `SoftphoneWidget.module.scss` `.callTimerDisplay`, `CallCenterWallboardPage.module.scss` `.root`) |
| Styling | SCSS-модули + `var(--color-*)` / `var(--radius-*)` / `var(--z-index-*)`. **Tailwind выше `shared/ui` запрещён.** Inline `style` и CSS-in-JS запрещены. Локальная геометрия комнаты — SCSS custom properties на корне компонента (прецедент `AssistantPanel.module.scss` `--ai-agent-panel-width`) |
| State | RTK Query — комнаты, участники, ссылки, история встреч; SSE — живые события комнаты (D-35), патчатся в тот же cache entry через `api.util.updateQueryData` (прецедент `features/callcenter/lib/useCallCenterSSE`); локальный `useState` — черновик формы комнаты, выбор устройств, раскладка панели участников |
| Placement | Список комнат и живая комната — **страницы** внутри `AppLayout` / `ModuleShell`. Мини-панель — overlay в chrome. Гостевая страница — **вне** `AppLayout` (прецедент маршрута `/callcenter/wallboard`, `app/router/router.tsx:73-77`) |

### shadcn gate — resolved, not asked

Гейт выполнен без вопроса пользователю. `components.json` нет; ARCHITECTURE.md запрещает Tailwind
выше `shared/ui`, требует собственные обёртки над сторонними компонентами и SCSS-модули в
`features/` / `pages/`. Инициализация shadcn CLI противоречила бы канону, зафиксированному в
Phase 8 (D-39) и повторённому в UI-SPEC фаз 08 / 09 / 10 / 12 / 14 / 15. `Tool: none`.
Гейт безопасности реестра — **не применим**.

---

## Component Inventory

Enumerated by `node -e "const fs=require('fs');const d='packages/frontend/src/shared/ui';const n=fs.readdirSync(d,{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>e.name).sort();console.log(n.length);console.log(n.join(', '));const pkg=require('./packages/frontend/package.json');console.log(pkg.name+'@'+pkg.version);"` — 39 components — `@krasterisk/frontend@4.4.6` (рукописная система в `src/shared/ui`, отдельного npm-пакета нет) — 2026-09-15.

Полный список (39): AudioPlayer, Avatar, Badge, Button, Card, Checkbox, CommandPalette, DataTable,
Dialog, DropdownMenu, FileImportButton, Input, Label, Loader, ModuleLockedPage, MultiSelect,
Pagination, PasswordInput, Popover, Progress, RadioCards, RecordingButton, ScrollArea,
SegmentedControl, Select, Separator, Sheet, Skeleton, Sparkline, Stack, Switch, Table,
TableRowActions, Tabs, TagInput, Text, Textarea, Tooltip, WebhookAuthConfig.

Таблица ниже — **не закрытый allowlist**, а разметка «что берём под нужды этой фазы». Проверять
компонент вне таблицы — ожидаемый путь, а не исключение.

| Нужда фазы | Компонент / путь | Комментарий |
|------------|------------------|-------------|
| Список комнат | `DataTable` (`shared/ui/DataTable`) | Канон страницы списка: `ConferencesTable` рендерит свой `Card`, страница второй `Card` не оборачивает |
| Действия строки | `TableRowActions` + `TableRowAction` | Порядок Edit → Copy → Delete; иконки `Pencil` / `Copy` / `Trash2` без `size`/`className` |
| Форма комнаты | `Dialog` + `Tabs` + `Input` / `Select` / `Switch` / `PasswordInput` | `DialogContent size="large"` + `.scrollBody`; PIN только через `PasswordInput` |
| Подсказки полей | `Tooltip` / `InfoTooltip` | Обязателен на каждом неявном поле (строгость входа, поведение до модератора, режим записи) |
| Живая комната: панель участников | `ScrollArea` + строки на `HStack` / `Text` / `Badge` | Не `DataTable`: живой список без сортировки колонок |
| Живая комната: видео-плитка | **NEW** `shared/ui/VideoSurface` | Тонкая обёртка над `<video autoPlay playsInline>` с `ref`, по образцу `shared/ui/AudioPlayer` (обёртка над `<audio>`). Нужна, потому что нативные теги в `features/` запрещены |
| Смешанный звук комнаты | `<audio ref autoPlay hidden />` в корне страницы | Санкционированное исключение-«слив потока», прецедент `pages/CallCenterAgentPage/CallCenterAgentPage.tsx:1104` |
| Панель управления комнатой | `Button size="icon"` в SCSS-раскладке | Композиция по образцу `features/callcenter/ui/CallControlBar` |
| Приглашение абонента / номера | `Sheet` (phone) / `DropdownMenu` + `Popover` (desktop) | Образец `SoftphoneWidget` add-to-conference `Sheet` (`.conferenceSheet`) |
| Мини-панель «вы в конференции» | Композиция: chrome-триггер + выпадающая панель; на phone — sticky bar | Геометрия 1:1 с `SoftphoneWidget.module.scss` `.chromeTrigger` / `.chromePanel` / `.stickyBar` |
| Гостевой шелл | **NEW** `widgets/ConferenceGuestShell` | Минимальный шелл с логотипом тенанта (D-28). Образец «фиксированная поверхность вне шелла» — `pages/CallCenterWallboardPage.module.scss` `.root` |
| Предварительный экран гостя | `Card` + `Input` + `PasswordInput` + `Select` | Выбор устройств — тот же паттерн, что `SoftphoneWidget` `.devicePicker` / `.deviceRow` |
| Ёмкость / лимит | `Text variant="muted"` | Строка D-20, дословно. Никаких прогресс-баров «загрузка сервера» |
| Запись встречи | `Badge` (индикатор) + `Button` (старт/стоп) + `AudioPlayer` (история) | `AudioPlayer` уже используется для записей CDR и голосовой почты |
| Загрузка | `Skeleton` / `Loader` / `Loader2` + `@keyframes spin` в SCSS | `animate-spin` запрещён |
| Выбор комнаты в шаге маршрута | `Select` внутри `ValueSourceField` (mode `queue`) | Тот же контрол, что у очередей: каталог + маска + переменная |
| Подтверждение деструктива | `Dialog` | Исключение участника, завершение конференции, удаление комнаты, отзыв ссылки |
| Переключатель раскладки панели участников | `SegmentedControl` (опционально) | Только если планирование решит показывать «сетка / список» |

**Новых примитивов в `shared/ui` фаза вводит ровно один** — `VideoSurface`. Всё остальное
(`VideoGrid`, `ParticipantTile`, `ParticipantRow`, `RoomControlBar`, `ConferenceMiniPanel`,
`ConferencePreJoinCard`, `RoomLinksManager`) — композиция в `features/conferences`.

Источник токенов: `packages/frontend/src/app/styles/globals.css` `@theme`.
**Новых глобальных CSS custom properties фаза не добавляет**; геометрия комнаты — локальные
SCSS-переменные на корне компонента.

---

## Spacing Scale

Кратные 4, набор идентичен `08` / `09` / `12` / `14` / `15-UI-SPEC`:

| Token | Value | Использование в Phase 16 |
|-------|-------|--------------------------|
| xs | 4px | Зазор иконка↔текст в бейджах роли и состояния, подпись под плиткой, gap в строке участника |
| sm | 8px | Gap плиток в сетке видео; gap кнопок панели управления; gap полей внутри группы формы; gap строк списка участников |
| md | 16px | Padding плитки и панели участников; padding мини-панели; padding тела формы; horizontal padding гостевого хедера |
| lg | 24px | Вертикальный зазор блоков страницы списка; padding пустых состояний; padding карточки предварительного экрана |
| xl | 32px | Зазор крупных секций внутри вкладок формы комнаты |
| 2xl | 48px | Мин. высота пустого состояния до иконки |
| 3xl | 64px | Не используется |

Exceptions (каждое — либо кратно 4, либо унаследовано из отгруженного кода):

- **44px** — мин. touch-target icon-only: микрофон, камера, выход, запись, приглашение, строка участника, триггер мини-панели. WCAG 2.5.5. Прецедент `SoftphoneWidget.module.scss` `.chromeTrigger` / `.ringingBtn`.
- **48px** — основная CTA предварительного экрана гостя («Присоединиться»), прецедент `.dialCallBtn`.
- **56px** — высота topbar `ModuleShell` (Phase 8) и высота хедера гостевого шелла. Не менять.
- **60px** — mobile bottom-nav (Phase 8). Sticky-элементы комнаты на phone считают `bottom` от него + `env(safe-area-inset-bottom)`.
- **72px** — высота sticky-бара софтфона на phone (`$softphone-bar-height`). Мини-бар конференции складывается **над** ним, см. `## Collision contracts`.
- **12px** — только density chrome/topbar и `gap="12"` в шапке страницы (то же исключение, что в Phase 8/15). Не размножать 12px внутри комнаты.
- **160px** — `--conf-tile-min-width`: минимальная ширина плитки участника на desktop. На `max-width: 640px` — **120px**.
- **320px** — ширина панели участников на desktop (`≥1024px`) и ширина выпадающей мини-панели `min(320px, calc(100vw - 32px))` (прецедент `.chromePanel`).
- **1px** — границы плиток, панели, разделители. В светлой теме плитка и панель дополнительно получают `box-shadow: 0 1px 4px rgba(0,0,0,0.06)` (ARCHITECTURE).
- **2px** — обводка активного говорящего и полоса активной вкладки формы.

---

## Typography

Ровно 4 размера / 2 веса — как Phase 8 / 9 / 12 / 14 / 15:

| Role | Size | Weight | Line Height | Использование |
|------|------|--------|-------------|---------------|
| Body | 14px | 400 | 1.5 | Имя участника в списке, тело пустых и ошибочных состояний, описания полей формы, строка ёмкости D-20, подписи в истории встреч |
| Label | 12px | 600 | 1.4 | Бейджи роли (Организатор / Модератор / Участник), состояния («Говорит», «Микрофон выключен», «Камера выключена», «Идёт запись»), подпись имени на плитке, счётчик участников, TTL ссылки |
| Heading | 16px | 600 | 1.3 | Заголовок живой комнаты, заголовок мини-панели, заголовки секций формы, заголовок карточки предварительного экрана, заголовки пустых состояний |
| Display | 28px | 600 | 1.2 | Таймер встречи (`font-variant-numeric: tabular-nums`) в живой комнате и в мини-панели. Прецедент `SoftphoneWidget.module.scss` `.callTimerDisplay` (28px/600/1.2) |

Унаследованные исключения (**не вводятся этой фазой**, а приходят из отгруженного канона):

- **Заголовок страницы списка** — `Text variant="h1"` = `text-3xl font-bold` (30px / 700 / tight). Обязателен каноном «Паттерн страницы списка и таблицы» в ARCHITECTURE.md; единственное место, где встречается третий вес.
- **`clamp()` на гостевом экране** — запрещён. TV-масштабирование (`clamp(16px, 1.5vw, 24px)`) — свойство wallboard, а не гостевой комнаты: гость чаще на телефоне (D-29).

Запрещено: пятый размер; 10px/11px микротекст; моноширинный шрифт для имён участников и номеров
комнат (тенант видит короткий номер как обычный текст).

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `var(--color-background)` `#09090b` | Фон страницы списка; **стейдж видео** живой комнаты (плитки читаются как более светлые объекты на тёмном стейдже); фон гостевого шелла |
| Secondary (30%) | `var(--color-card)` `#0a0a0f` + `var(--color-border)` `#27272a` | Плитка участника, панель участников, `Card` таблицы, модалка формы, мини-панель, карточка предварительного экрана, хедер гостевого шелла |
| Accent (10%) | `var(--color-primary)` `#6366f1` | **Только:** CTA «Создать комнату», CTA «Войти в конференцию», CTA «Присоединиться» (гость); focus-ring (`--color-ring`); открытое состояние триггера мини-панели; полоса активной вкладки формы; `iconBadge` в шапке страницы; выбранная комната в `Select` шага маршрута |
| Destructive | `var(--color-destructive)` `#ef4444` | «Выйти из конференции», «Завершить конференцию», «Исключить участника», удаление комнаты, отзыв ссылки, индикатор «Идёт запись» (точка + бейдж), баннеры ошибок |
| Warning | `var(--color-warning)` `#f59e0b` | «Ждём организатора» и «Ждём одобрения модератора» (комната ожидания, D-13); «Слабое соединение, качество видео снижено»; «Видео не подключилось» |
| Success | `var(--color-success)` `#22c55e` | **Обводка активного говорящего (2px) и индикатор микрофона**; точка «вы в конференции» в мини-панели; «Ссылка скопирована»; участник подключился |
| Info | `var(--color-info)` `#3b82f6` | Нейтральные чипы: счётчик участников, бейдж роли «Участник», бейдж «Телефон» у не-веб участника. Никогда не CTA |

Accent **зарезервирован** и не протекает в: плитки участников в покое, бейджи ролей, строку ёмкости
D-20, иконки панели управления в покое (muted foreground), строки истории встреч, кнопки
«Скопировать ссылку».

**Почему говорящий — `success`, а не `primary`.** Focus-ring системы и primary CTA уже `#6366f1`;
обводка говорящего меняется несколько раз в секунду и на одном экране с primary-кнопкой
«Пригласить» читалась бы как фокус. Индикатор речи — `--color-success` 2px + мягкое
`box-shadow` (по образцу `.glow-success` в `globals.css`), состояния «заглушён» / «камера
выключена» — `muted-foreground` иконка на плитке.

**Светлая тема.** Стейдж видео остаётся тёмным всегда: плитка, панель участников и мини-панель
получают `1px border` + `box-shadow: 0 1px 4px rgba(0,0,0,0.06)`, а стейдж фиксирует локальный
тёмный контекст на корне компонента комнаты (прецедент `CallCenterWallboardPage.module.scss`
`.root` — локальные переопределения `--color-*` + `color-scheme: dark`). Остальные поверхности
фазы (список, форма, история) темы не форсируют.

---

## Copywriting Contract

Все строки через `t()` в `shared/config/locales/ru.ts` **и** `en.ts` (оба словаря обязательны,
ARCHITECTURE). Namespace фазы — **`conferences.*`** (новый top-level блок, рядом с `queues` /
`callGroups`), плюс точечные дополнения: `nav.conferences`, `routes.chain.confbridge.*`,
`hub.*` не трогаем.

Жёсткие правила копирайтинга, действующие на каждую строку ниже:

- Длинное тире `—` **запрещено** (ARCHITECTURE «Типографика»). Только `-` или запятая.
- Слово **Asterisk** запрещено. Система называется **Krasterisk**.
- **D-36 / D-06:** тенантное имя комнаты (`conf{номер}_{uid}`), имена каналов, `uniqueid` и
  внутренние идентификаторы **не показываются никому**, включая админа тенанта. Пользователь видит
  короткий номер комнаты и имена участников.
- **D-20 дословно:** строка ёмкости — `Максимальное число участников: {{count}}`. Формулировки
  «Сейчас доступно», «Нагрузка сервера», «Свободно мест на сервере» **запрещены**. Окружающий
  текст не обещает, что число постоянно.
- Эмодзи запрещены; иконки только `lucide-react`.

### Основное

| Element | Copy |
|---------|------|
| Primary CTA (список) | `Создать комнату` |
| Primary CTA (живая комната) | `Войти в конференцию` |
| Primary CTA (гость) | `Присоединиться` |
| Заголовок страницы | `Конференции` |
| Подзаголовок страницы | `Комнаты телеконференций, роли участников и записи встреч` |
| Empty state heading | `Комнат пока нет` |
| Empty state body | `Создайте комнату, чтобы собирать участников по короткому номеру или по ссылке приглашения.` |
| Error state (загрузка списка) | `Не удалось загрузить комнаты. Проверьте соединение и повторите попытку.` + кнопка `Повторить` |
| Destructive confirmation (удаление комнаты) | `Удалить комнату "{{name}}"?` / тело: `Комната перестанет принимать звонки, а выданные ссылки приглашений станут недействительными. Записи прошедших встреч сохранятся.` / кнопки `Отмена` + `Удалить` |

### Ключи локалей (`conferences.*`)

| Ключ | ru |
|------|-----|
| `title` | `Конференции` |
| `subtitle` | `Комнаты телеконференций, роли участников и записи встреч` |
| `addRoom` | `Создать комнату` |
| `createRoom` | `Создать комнату` |
| `editRoom` | `Редактировать комнату` |
| `copyRoom` | `Копировать комнату` |
| `noRooms` | `Комнат пока нет` |
| `noRoomsHint` | `Создайте комнату, чтобы собирать участников по короткому номеру или по ссылке приглашения.` |
| `loadFailed` | `Не удалось загрузить комнаты. Проверьте соединение и повторите попытку.` |
| `confirmDelete` | `Удалить комнату "{{name}}"?` |
| `confirmDeleteBody` | `Комната перестанет принимать звонки, а выданные ссылки приглашений станут недействительными. Записи прошедших встреч сохранятся.` |
| `count_one` / `count_few` / `count_many` / `count_other` | `{{count}} комната` / `{{count}} комнаты` / `{{count}} комнат` / `{{count}} комнат` |
| `number` | `Номер комнаты` |
| `numberHint` | `Короткий номер комнаты внутри вашей АТС.\nПо этому номеру комнату выбирают в шаге маршрута.` |
| `name` | `Название` |
| `namePlaceholder` | `Планёрка отдела продаж` |
| `kindPermanent` | `Постоянная` |
| `kindEphemeral` | `Разовая` |
| `maxMembers` | `Максимальное число участников: {{count}}` |
| `maxMembersHint` | `Значение зависит от вашего тарифа и может отличаться при следующем открытии формы.` |
| `tabGeneral` | `Основные` |
| `tabAccess` | `Доступ` |
| `tabRoles` | `Роли` |
| `tabRecord` | `Запись` |
| `tabLinks` | `Ссылки` |
| `tabHistory` | `История встреч` |

### Доступ и ссылки (D-11, D-12, D-13)

| Ключ | ru |
|------|-----|
| `strictness` | `Строгость входа` |
| `strictnessHint` | `**Ссылка и имя** - гость вводит только имя\n**Ссылка, имя и PIN** - дополнительно нужен PIN комнаты\n**Одобрение модератором** - гость ждёт в комнате ожидания, пока его не пустят` |
| `pin` | `PIN комнаты` |
| `pinHint` | `Код, который гость вводит перед входом. Оставьте пустым, чтобы не спрашивать PIN.` |
| `beforeHost` | `Пока модератора нет` |
| `beforeHostHint` | `**Ждать модератора** - участники слушают музыку до его прихода\n**Пускать свободно** - разговор начинается без модератора` |
| `endWithHost` | `Завершать конференцию при выходе модератора` |
| `links.shared` | `Общая ссылка комнаты` |
| `links.personal` | `Именные приглашения` |
| `links.copy` | `Скопировать ссылку` |
| `links.copied` | `Ссылка скопирована` |
| `links.revoke` | `Отозвать ссылку` |
| `links.confirmRevoke` | `Отозвать приглашение для "{{name}}"?` |
| `links.confirmRevokeBody` | `Гость по этой ссылке больше не сможет войти. Остальные приглашения продолжат работать.` |
| `links.expires` | `Действует до {{date}}` |
| `links.noLinks` | `Приглашений пока нет` |
| `links.noLinksHint` | `Создайте общую ссылку комнаты или именное приглашение, чтобы позвать участников со стороны.` |
| `links.create` | `Создать приглашение` |
| `links.inviteeName` | `Кого приглашаем` |

### Живая комната (D-14…D-17, D-21, D-31, D-37, D-40)

| Ключ | ru |
|------|-----|
| `live.join` | `Войти в конференцию` |
| `live.leave` | `Выйти из конференции` |
| `live.end` | `Завершить конференцию` |
| `live.confirmEnd` | `Завершить конференцию для всех?` |
| `live.confirmEndBody` | `Все участники будут отключены. Запись, если она идёт, остановится и сохранится.` |
| `live.participants` | `Участники` |
| `live.participantsCount` | `Участников: {{count}}` |
| `live.speaking` | `Говорит` |
| `live.micOff` | `Микрофон выключен` |
| `live.camOff` | `Камера выключена` |
| `live.micMute` | `Выключить микрофон` |
| `live.micUnmute` | `Включить микрофон` |
| `live.camOn` | `Включить камеру` |
| `live.camDisable` | `Выключить камеру` |
| `live.roleOwner` | `Организатор` |
| `live.roleModerator` | `Модератор` |
| `live.roleMember` | `Участник` |
| `live.viaPhone` | `Телефон` |
| `live.muteMember` | `Заглушить участника` |
| `live.unmuteMember` | `Разрешить говорить` |
| `live.promote` | `Сделать модератором` |
| `live.demote` | `Снять права модератора` |
| `live.kick` | `Исключить участника` |
| `live.confirmKick` | `Исключить "{{name}}" из конференции?` |
| `live.confirmKickBody` | `Участник отключится сразу. Он сможет войти снова, если у него есть действующая ссылка или доступ по номеру.` |
| `live.rename` | `Изменить имя` |
| `live.renameField` | `Как вас представить` |
| `live.renameHint` | `Имя видят только участники этой встречи. Карточка абонента и справочники не меняются.` |
| `live.inviteMember` | `Пригласить абонента` |
| `live.inviteExternal` | `Пригласить внешний номер` |
| `live.inviteExternalHint` | `Исходящий вызов оплачивается по вашему тарифу.` |
| `live.inviteSent` | `Звоним участнику` |
| `live.inviteFailed` | `Не удалось дозвониться. Проверьте номер и попробуйте снова.` |
| `live.recordStart` | `Начать запись` |
| `live.recordStop` | `Остановить запись` |
| `live.recording` | `Идёт запись` |
| `live.recordNotice` | `Встреча записывается` |
| `live.emptyRoom` | `В комнате пока никого нет` |
| `live.emptyRoomHint` | `Позовите участников по короткому номеру или отправьте ссылку приглашения.` |
| `live.waitingHost` | `Ждём организатора` |
| `live.waitingHostHint` | `Разговор начнётся, когда подключится организатор.` |
| `live.full` | `В комнате нет свободных мест` |
| `live.fullHint` | `Попробуйте подключиться позже или попросите организатора освободить место.` |
| `live.videoFailed` | `Видео не подключилось` |
| `live.videoRetry` | `Повторить` |
| `live.weakLink` | `Слабое соединение, качество видео снижено` |
| `live.mediaDenied` | `Браузер не дал доступ к микрофону` |
| `live.mediaDeniedHint` | `Разрешите доступ к микрофону и камере в настройках сайта, затем обновите страницу.` |
| `live.disconnected` | `Связь с комнатой прервана` |
| `live.reconnecting` | `Переподключаемся` |
| `live.adminJoinNotice` | `Вход администратора в эту встречу записывается в журнал событий.` |
| `mini.inConference` | `Вы в конференции` |
| `mini.open` | `Открыть комнату` |
| `mini.title` | `Конференция` |

### Гостевой вход (D-10…D-13, D-28, D-29)

| Ключ | ru |
|------|-----|
| `guest.title` | `Вход в конференцию` |
| `guest.nameField` | `Как вас представить` |
| `guest.namePlaceholder` | `Иван Петров` |
| `guest.namePlaceholderHint` | `Это имя увидят участники встречи.` |
| `guest.pinField` | `PIN комнаты` |
| `guest.join` | `Присоединиться` |
| `guest.micDevice` | `Микрофон` |
| `guest.camDevice` | `Камера` |
| `guest.lobby` | `Ждём одобрения модератора` |
| `guest.lobbyHint` | `Не закрывайте страницу. Мы подключим вас, как только модератор разрешит вход.` |
| `guest.linkInvalid` | `Ссылка недействительна или истекла` |
| `guest.linkInvalidHint` | `Попросите организатора отправить новое приглашение.` |
| `guest.pinWrong` | `Неверный PIN комнаты` |
| `guest.nameRequired` | `Укажите имя` |
| `guest.leave` | `Покинуть конференцию` |
| `guest.left` | `Вы вышли из конференции` |
| `guest.leftHint` | `Страницу можно закрыть. Чтобы вернуться, откройте ссылку приглашения снова.` |

### Шаг маршрута «Конференции» (D-08)

Существующие ключи `routes.chain.confbridge.*` **переписываются**: сегодняшняя подсказка
(`packages/frontend/src/features/dialplan-apps/model/schemas/confBridge.tsx:27`) документирует
принятый риск T-12-03-05, который эта фаза закрывает.

| Ключ | ru (новое значение) |
|------|---------------------|
| `routes.chain.confbridge.room` | `Комната` |
| `routes.chain.confbridge.roomHint` | `**Комната из списка** - настройки, роли и лимит берутся из выбранной комнаты\n**B-номер маршрута** - номер, который набрал абонент, подбирает комнату с таким номером\n**Из переменной** - номер комнаты из переменной канала\nКомната должна быть создана заранее в разделе "Конференции".` |
| `routes.chain.catalog.conferencesSection` | `Конференции` |
| `conferences.orphanRoom` | `{{room}} (нет в списке)` |
| `conferences.selectRoom` | `Выберите комнату` |

### Навигация

| Ключ | ru |
|------|-----|
| `nav.conferences` | `Конференции` |

---

## Surfaces

### Surface A — Список комнат `/conferences` (R-01, R-02, D-17, D-27)

- **Место в продукте:** страница базового хаба `apps` (D-27). Регистрация:
  `features/modules/lib/moduleRegistry.ts` → блок `apps.pages`, запись
  `{ id: 'conferences', path: '/conferences', labelKey: 'nav.conferences', icon: Video }`
  после `call-groups` (`moduleRegistry.ts:109`); зеркальная запись в бэкенд-сиде
  `hub-modules.seed.ts` → `{ hub_code: 'apps', page_code: 'conferences', path: '/conferences', sort_order: 65 }`.
  В `market`-хаб и в прайс модуль **не** попадает.
- **Раскладка:** канон «Паттерн страницы списка и таблицы» без отклонений: `iconBadge` (`Video size={24}`)
  + `Text variant="h1"` градиентный заголовок + `Text variant="muted"` подзаголовок +
  CTA `Plus size={16}` «Создать комнату» с primary-тенью; обёртка таблицы
  `Flex direction="column" align="stretch" max`.
- **Колонки:** номер комнаты (короткий, D-06), название, тип (`Постоянная` / `Разовая`, `Badge`),
  строгость входа (`Badge`), запись (`Badge` `Авто` / `По кнопке` / `Выключена`),
  «сейчас в комнате» (счётчик, info-чип, живой через SSE), действия.
- **Действия строки:** Edit → Copy → Delete через `TableRowActions`. `Copy` присутствует **только**
  если slice заводит `openCopyModal` (канон копирования: очищается номер и название).
- **Живая колонка «сейчас в комнате»:** значение приходит из SSE-патча в тот же RTK cache entry,
  что и список, без отдельного refetch.
- **Hybrid (D-29):** desktop `data-hybrid="overflow-x-auto"` + `.tableScroll`; phone —
  карточки `data-hybrid="mobile-card"` с `TableRowActions` внутри карточки.
- **Права:** админ тенанта видит и правит все комнаты тенанта (D-17). Ограничение «только свои»
  на этой поверхности **не** вводится.

### Surface B — Форма комнаты (модалка, D-02…D-05, D-11…D-14, D-18…D-21, D-30…D-32, D-39)

- `Dialog` `size="large"`, тело в `.scrollBody`, футер `Отмена` → `Сохранить`. Табы по варианту A
  (SCSS-модуль): одна линия контейнера + 2px полоса активного таба, `margin-bottom: -1px`.
- **Вкладки (раскладка — Claude's Discretion, зафиксировано здесь):**
  1. **Основные** — номер, название, тип (постоянная / разовая), музыка ожидания,
     объявления входа-выхода, строка ёмкости D-20.
  2. **Доступ** — строгость входа (3 уровня, D-11), PIN, поведение до модератора и завершение
     при его выходе (D-13), кто может приглашать внешний номер (D-39).
  3. **Роли** — постоянные модераторы комнаты (`MultiSelect` по абонентам тенанта, D-16).
  4. **Запись** — автозапись, разрешение кнопки модератора, уведомление участников (D-30…D-32).
  5. **Ссылки** — общая ссылка комнаты с TTL и отзывом + список именных приглашений (D-12).
     Доступна только в режиме редактирования; в `create` таб скрыт.
  6. **История встреч** — только в режиме редактирования (см. Surface G).
- **Строка ёмкости (D-20):** `Text variant="muted"` со строкой `conferences.maxMembers`, рядом
  `InfoTooltip` с `conferences.maxMembersHint`. **Не** прогресс-бар, **не** `Progress`,
  никаких упоминаний сервера, тарифа как числа или «свободных мест».
- **PIN:** только `PasswordInput` (toggle внутри поля). Генерация PIN, если нужна, — соседняя
  `Button variant="outline" size="icon"`.
- **Неявные поля обязаны иметь `InfoTooltip`** с перечислением каждой опции по строкам
  (`**Опция** - что делает`): строгость входа, поведение до модератора, режим записи,
  кто приглашает внешний номер. Длинный текст-подсказка под полем запрещён.
- **Вторичные параметры** внутри вкладки — свёрнутая bordered-группа с обязательным `tooltip`
  секции и `ChevronDown` без текста «Раскрыть».

### Surface C — Выбор комнаты в шаге маршрута (R-05, D-07, D-08)

- Правится `features/dialplan-apps/model/schemas/confBridge.tsx`: поле `room` остаётся
  `kind: 'value-source'`, но получает `optionsSource: 'conferenceRooms'` и
  `valueSourceMode: 'queue'` — ровно тот контрол, что у очередей: `optgroup` «Динамичная»
  (`B-номер маршрута` для маски D-07, `Из переменной`) + `optgroup` «Статичная» (каталог комнат).
- **Обязательная тройка регистрации** (иначе `RefSelect` покажет «Ничего не создано»):
  `OptionsSource` в `model/schema.types.ts:18`, резолвер в `model/useSchemaRefs.ts`,
  запись в `CATALOG_DEFAULTS` (`ui/StepSheet` / `SchemaFields`). Прямые `useGetXQuery`
  в `StepSheet` и в полях запрещены.
- **Пустой каталог:** placeholder `Ничего не создано` + ссылка
  `Открыть раздел «Конференции»` на `/conferences` в новой вкладке (образец
  `ValueSourceField.tsx:340-349`).
- **Ортодоксальная подсказка:** `roomHint` переписывается (см. Copywriting) — упоминание о том,
  что два тенанта попадают в одну конференцию, удаляется, потому что D-06 это закрывает.
- Второе поле `options` (имя bridge-профиля) на схеме **не появляется**: профили живут в модуле.

### Surface D — Живая веб-комната `/conferences/:uid/room` (R-04, R-05, D-22…D-26, D-37)

Полноэкранная страница внутри `ModuleShell` (D-26). Три зоны:

1. **Хедер комнаты** (56px): название и короткий номер комнаты, таймер встречи (Display 28px,
   tabular), бейдж «Идёт запись» (destructive), счётчик участников (info-чип), `Users size={20}`
   toggle панели участников на 768–1023px.
2. **Стейдж — сетка видео (D-24).** CSS-grid, без graph/video-библиотек:
   `grid-template-columns: repeat(auto-fit, minmax(var(--conf-tile-min-width, 160px), 1fr))`,
   `gap: 8px`, плитка `aspect-ratio: 16 / 9`, `--conf-tile-min-width: 120px` на `max-width: 640px`.
   Плитка — `VideoSurface` + слой подписи: имя (Label 12/600, `text-overflow: ellipsis`),
   иконки состояния (`MicOff` / `VideoOff`), бейдж роли. Участник без видео (телефон или
   несогласованный поток) рисуется той же плиткой с `Avatar` по центру и бейджем `Телефон`.
   Обводка говорящего — 2px `--color-success` + мягкий glow; при `prefers-reduced-motion: reduce`
   пульсация отключается (прецедент `.stickyDot` / `.chromeTriggerRinging`).
3. **Панель участников** (320px, `ScrollArea`): строка участника = имя + бейдж роли + иконки
   состояния + `DropdownMenu` делегированных действий (заглушить, разрешить говорить, сделать
   модератором, снять права, исключить). Меню видно только владельцу и модераторам (D-14…D-16);
   у участника строка read-only. `≥1024px` — постоянная колонка; `768…1023px` — `Sheet` по toggle;
   `<768px` — `Sheet` (D-29: комната на телефоне полноценная).

**Панель управления (`RoomControlBar`)**, композиция по образцу `CallControlBar`:

| Кнопка | Иконка | Вид | Условие |
|--------|--------|-----|---------|
| Микрофон | `Mic` / `MicOff` | `outline`, 44px | всегда |
| Камера | `Video` / `VideoOff` | `outline`, 44px | всегда |
| Пригласить абонента | `UserPlus` | `outline` | владелец / модератор |
| Пригласить внешний номер | `PhoneOutgoing` | `outline` | по настройке комнаты (D-39) |
| Запись | `Disc` | `outline`, активная — destructive | модератор, если разрешено настройкой (D-31) |
| Участники | `Users` | `ghost` | `<1024px` |
| Выйти | `LogOut` | `destructive outline` | всегда |
| Завершить для всех | `PhoneOff` | `destructive` + `Dialog` | владелец / модератор |

На `<768px` панель — sticky внизу над bottom-nav и safe-area; все кнопки ≥44px; подписи скрыты,
`title` + `aria-label` обязательны (иконочные кнопки).

**Смена своего имени (D-40):** `Изменить имя` в меню собственной строки → `Dialog` с полем
`Как вас представить` + `InfoTooltip` `live.renameHint`. Гостю имя запоминается по токену, своим —
на время встречи; ни справочники, ни карточка абонента не переписываются.

**Вход администратора (D-17):** при открытии живой чужой комнаты админ тенанта видит однократный
`warning`-баннер `live.adminJoinNotice`. Баннер информативный, не блокирующий.

### Surface E — Мини-панель «вы в конференции» (D-26)

Геометрия и поведение копируются с отгруженного софтфона, **не** изобретаются:

- **Desktop:** триггер в chrome `ModuleShell` topbar (`.chromeTrigger`, 44×44, `Video` +
  `success`-точка, `.regBadge`-паттерн); клик разворачивает панель
  `min(320px, calc(100vw - 32px))`, `max-height: min(560px, calc(100vh - 96px))`,
  `z-index: var(--z-index-toast)`, содержимое: название комнаты, таймер (Display 28px),
  счётчик участников, микрофон / камера / выйти, CTA `Открыть комнату`.
- **Phone:** sticky bar 72px (структурно другое дерево, а не тот же триггер) —
  точка состояния + название комнаты + таймер + микрофон + `Открыть комнату`.
- Панель показывается **только когда пользователь в комнате и ушёл с её страницы**. На самой
  странице комнаты мини-панель скрыта.

### Surface F — Гостевой вход `/conf/:token` (R-07, D-10…D-13, D-28, D-29)

- **Маршрут вне `AppLayout`** — рядом с `/callcenter/wallboard` в `app/router/router.tsx`.
  Ни сайдбара, ни хлебных крошек, ни `CommandPalette`, ни `AssistantPanel`, ни софтфона.
- **`ConferenceGuestShell`** (NEW widget): хедер 56px с логотипом тенанта + название комнаты
  (короткое, без внутреннего имени) + `LangSwitcher`; тело на всю высоту; футер отсутствует.
  Фон `--color-background`; тему не форсируем на шелле, только стейдж комнаты тёмный.
- **Предварительный экран (pre-join).** `Card`, `max-width: 480px`, по центру:
  превью собственного видео (`VideoSurface` `muted` `mirrored`), поле `Как вас представить`
  (обязательное), `PIN комнаты` (только при соответствующей строгости, `PasswordInput`),
  два `Select` устройств (микрофон, камера), CTA 48px `Присоединиться`.
- **Комната ожидания (lobby, D-11 уровень 3 / D-13 `wait_marked`):** тот же `Card`, состояние
  `warning`: заголовок `Ждём одобрения модератора` (или `Ждём организатора`), тело-подсказка,
  `Loader`. Кнопка `Присоединиться` заменяется на disabled-состояние; выход — `Покинуть конференцию`.
- **После входа** — тот же компонент живой комнаты, что у Surface D (**один** компонент, не форк),
  с урезанной панелью управления по роли. D-36: гость получает ровно тот же поток событий, что
  свои; внутренние идентификаторы не отдаются никому.
- **Ошибочные состояния как отдельный экран `Card`:** `Ссылка недействительна или истекла`,
  `Неверный PIN комнаты`, `В комнате нет свободных мест` (D-21 — отказ с объяснением,
  не «вход без видео»), `Браузер не дал доступ к микрофону`.

### Surface G — История встреч и записи (D-30, D-33)

- Внутри формы комнаты — вкладка `История встреч`: список встреч (дата, длительность,
  число участников, наличие записи), раскрытие строки даёт список участников и `AudioPlayer`.
- `AudioPlayer` берётся как есть (`shared/ui/AudioPlayer`) — та же механика, что у записей CDR и
  голосовой почты; собственного плеера фаза не пишет.
- Дубль в CDR-отчёте (D-33) — чужая поверхность: этот UI-SPEC её не редизайнит, только требует,
  чтобы копирайтинг факта записи конференции в CDR шёл из `conferences.*`, а не дублировался.

---

## Interaction & motion

- **Optimistic toggles (ARCHITECTURE MUST).** Любой `Switch`, пишущий сразу (в т.ч. включение
  комнаты в таблице, уведомление о записи, автозапись при инлайн-правке), обязан
  `onQueryStarted` → `updateQueryData` → `patchResult.undo()` + toast при ошибке.
  Эталон: `updateMyNotifications` в `shared/api/endpoints/callCenterApi.ts`.
- **Живые действия модератора** (заглушить, исключить, повысить) — оптимистичный патч кэша
  участников с откатом и `toast.error` при отказе сервера. Кнопка на время запроса disabled.
- **SSE-события комнаты** патчат тот же cache entry, что и первичный `GET` участников
  (прецедент `useCallCenterSSE` + `updateQueryData` через типизированный `useAppDispatch`).
- **Запись** — не toggle на кэше, а действие с состоянием pending: кнопка disabled + `Loader2`
  до подтверждения от сервера, затем бейдж `Идёт запись`.
- **Анимации** — только CSS `@keyframes` в SCSS-модуле; `motion.div` в `features/` / `pages/`
  запрещён. Каждая пульсация (говорящий, «Переподключаемся», индикатор записи) обязана иметь
  `@media (prefers-reduced-motion: reduce) { animation: none; }`.
- **Toast** — `react-toastify` (`toast.error` / `toast.success`), как во всём проекте.
- **Фокус** — `focus:ring-inset` на всех новых контролах; модалка и `Sheet` не обрезают обводку.
- **Клавиатура** — иконочные кнопки панели управления обязаны иметь `title` + `aria-label`;
  `aria-expanded` / `aria-controls` на toggle панели участников и на свёрнутых секциях формы.
  Горячих клавиш фаза **не** вводит: `Ctrl/Cmd+K` занят палитрой, `Ctrl/Meta+Shift+J` — агентом.

---

## FSD placement

| Путь | Содержимое | Статус |
|------|-----------|--------|
| `shared/ui/VideoSurface/` | `VideoSurface.tsx` + `.module.scss` + `index.ts` + тест | **NEW** (единственный новый примитив) |
| `shared/api/endpoints/conferenceApi.ts` | RTK-эндпоинты; теги `Conferences`, `ConferenceParticipants`, `ConferenceLinks`, `ConferenceMeetings` | **NEW** |
| `entities/conference/` | типы комнаты / участника / роли, карты `roleLabel` и `roleColorFamily` (образец `agentStatusLabel` из 09-02) | **NEW** |
| `features/conferences/model/` | slice (`isModalOpen`, `modalMode: create/edit/copy`, `selectedRoom`), селекторы, схема состояния | **NEW** |
| `features/conferences/ui/ConferencesTable/` | таблица + `useConferencesTableColumns.tsx` + `.module.scss` + тест | **NEW** |
| `features/conferences/ui/ConferenceRoomFormModal/` | модалка + вкладки (`*GeneralTab`, `*AccessTab`, `*RolesTab`, `*RecordTab`, `*LinksTab`, `*HistoryTab`) | **NEW** |
| `features/conferences/ui/LiveRoom/` | `LiveRoom`, `VideoGrid`, `ParticipantTile`, `ParticipantList`, `ParticipantRow`, `RoomControlBar`, `InviteSheet` | **NEW** |
| `features/conferences/ui/ConferenceMiniPanel/` | chrome-триггер + панель + sticky bar на phone | **NEW** |
| `features/conferences/ui/ConferencePreJoinCard/` | предварительный экран и lobby гостя | **NEW** |
| `features/conferences/lib/useConferenceRoom.ts` | WebRTC-сессия комнаты: собственный `SessionDescriptionHandler` (спайк 002: стоковый `sip.js` останавливает прежние удалённые видеотреки), сбор клиентской телеметрии качества | **NEW** |
| `widgets/ConferenceGuestShell/` | минимальный шелл с логотипом тенанта | **NEW** |
| `pages/ConferencesPage/` | тонкий оркестратор (≤70 строк) | **NEW** |
| `pages/ConferenceRoomPage/` | тонкий оркестратор живой комнаты | **NEW** |
| `pages/ConferenceGuestPage/` | тонкий оркестратор гостевой поверхности | **NEW** |
| `features/modules/lib/moduleRegistry.ts` | запись страницы в `apps` | правка |
| `features/dialplan-apps/model/schemas/confBridge.tsx`, `model/schema.types.ts`, `model/useSchemaRefs.ts`, `ui/StepSheet` `CATALOG_DEFAULTS` | выбор комнаты (Surface C) | правка |
| `shared/config/locales/ru.ts`, `en.ts` | блок `conferences.*`, `nav.conferences`, перезапись `routes.chain.confbridge.*` | правка |
| `app/router/router.tsx` | `/conferences`, `/conferences/:uid/room`, `/conf/:token` (последний — вне `AppLayout`) | правка |

Каждый новый UI-компонент — в собственной папке с `[Name].tsx` + `[Name].module.scss` +
`index.ts` + интеграционным тестом (архитектурное требование, не опция).

---

## UI Considerations

Применимые state-рассмотрения: **23 covered, 2 backstop, 2 unresolved**.

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| empty | Список комнат (`list-collection`) | ✅ covered | Нулевой список рендерит `conferences.noRooms` + `noRoomsHint` + CTA «Создать комнату» (см. Copywriting Contract) |
| empty | Живая комната (`media`, `list-collection`) | ✅ covered | Комната без участников рендерит `live.emptyRoom` + `live.emptyRoomHint` вместо пустой сетки |
| empty | Список приглашений (`list-collection`) | ✅ covered | `links.noLinks` + `links.noLinksHint` + CTA `links.create` |
| empty | Каталог комнат в шаге маршрута (`form`) | ✅ covered | Placeholder «Ничего не создано» + ссылка `Открыть раздел «Конференции»`, образец `ValueSourceField.tsx:340-349` |
| empty | История встреч (`list-collection`, `media`) | ✅ covered | Комната без встреч рендерит заголовок пустого состояния той же типографикой Heading 16/600; плеер не монтируется без файла записи |
| loading | Список комнат | ✅ covered | `Skeleton` строк таблицы; `Loader2` + `@keyframes spin` в SCSS, `animate-spin` запрещён |
| loading | Предварительный экран гостя (`form`) | ✅ covered | CTA `Присоединиться` disabled с `Loader2` до получения медиа-разрешений и ответа сервера |
| loading | Плитка участника до первого кадра (`media`) | ✅ covered | Плитка держит `aspect-ratio: 16/9` и показывает `Avatar` + имя; layout не прыгает при появлении кадра |
| loading | Панель управления во время действия (`interactive-control`) | ✅ covered | Кнопка disabled + `Loader2`; запись не считается optimistic toggle |
| error | Список комнат | ✅ covered | `conferences.loadFailed` + кнопка `Повторить` |
| error | Гостевая ссылка (`form`) | ✅ covered | Отдельный экран `Card`: `guest.linkInvalid` + `guest.linkInvalidHint`; `guest.pinWrong` как ошибка поля с `aria-invalid` + `aria-describedby` |
| error | Медиа-разрешения (`interactive-control`) | ✅ covered | `live.mediaDenied` + `live.mediaDeniedHint` с конкретным следующим шагом (настройки сайта, обновить страницу) |
| error | Отказ по ёмкости (`form`) | ✅ covered | D-21: `live.full` + `live.fullHint`; деградация «пустить без видео» запрещена |
| error | Обрыв SSE / медиа (`media`) | ✅ covered | `live.disconnected` / `live.reconnecting` баннером warning поверх стейджа, сетка не размонтируется |
| error | Отказ живого действия модератора (`interactive-control`) | ✅ covered | `patchResult.undo()` + `toast.error`; строка участника возвращается в прежнее состояние |
| populated | Сетка видео (`media`) | ✅ covered | `repeat(auto-fit, minmax(160px, 1fr))`, `gap: 8px`, `aspect-ratio: 16/9`; типичный объём по спайку 004 - до 12 участников на 100 Мбит/с |
| populated | Панель участников (`list-collection`) | ✅ covered | `ScrollArea` фиксированной ширины 320px; строки 44px, скролл внутри панели, не у страницы |
| partial | Участник вошёл без видео (`media`) | ✅ covered | Спайк 004: примерно каждый двенадцатый вход приходит без видео. Плитка показывает `Avatar` + `live.videoFailed` + кнопка `live.videoRetry` (повторное согласование), а не пустой чёрный прямоугольник |
| partial | Форма комнаты в режиме `copy` (`form`) | ✅ covered | Канон копирования: номер и название очищаются, остальные настройки переносятся; заголовок модалки - третий вариант `copyRoom` |
| overflow | Сетка видео на максимуме комнаты (`media`, `list-collection`) | 🧪 backstop | Раскладка при 12 и при 36 плитках (границы бюджета полосы из спайка 004) проверяется held-out UI-state тестом на `VideoGrid`: плитки не уходят за viewport, `--conf-tile-min-width` понижается на phone |
| overflow | Панель управления на 360px (`interactive-control`) | 🧪 backstop | Восемь кнопок ≥44px не влезают в 360px одной строкой; контракт - `flex-wrap` + скрытие подписей, проверяется UI-state тестом на 360px |
| overflow | Табы формы комнаты (`nav`) | ✅ covered | `.tabsRow { overflow-x: auto; scrollbar-width: none }` (вариант A канона табов); шесть табов на 360px скроллятся горизонтально |
| long-text | Имя участника (`form`, `static-content`) | ✅ covered | Участник задаёт имя сам (D-40). Подпись плитки и строка панели - одна строка с `text-overflow: ellipsis` + `title` с полным значением |
| long-text | Название комнаты в хедере и мини-панели (`static-content`) | ✅ covered | `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` (образец `.stickyCaller`); короткий номер никогда не обрезается |
| zero-one-many | Счётчик комнат и участников (`list-collection`) | ✅ covered | Русские плюральные формы `count_one` / `count_few` / `count_many` / `count_other`; `live.participantsCount` через i18n-интерполяцию |
| zero-one-many | Сетка при одном участнике (`media`) | ⚠ unresolved | Один участник в `auto-fit`-сетке растягивается на всю ширину стейджа и выглядит сломанно. Ограничение `max-width` плитки при `count === 1` планировщик принимает как assumption |
| partial | Ёмкость упала ниже текущего числа участников (`static-content`) | ⚠ unresolved | Следствие D-20: число считается динамически и меняется между просмотрами. Что показывать, когда в комнате уже больше людей, чем текущее `N`, discuss не решал. Планировщик принимает как assumption; правило «не обещать, что число постоянно» соблюдается в любом случае |

---

## Collision contracts (cross-phase)

| Чужая поверхность | Контракт |
|-------------------|----------|
| Софтфон (Phase 9 / 10) | Софтфон владеет chrome-триггером и нижним правым углом; на phone его sticky bar стоит на `bottom: calc(60px + safe-area)`. Мини-панель конференции **не** занимает этот слот: на desktop это **второй** chrome-триггер в topbar, на phone — мини-бар, складывающийся **над** баром софтфона (`bottom: calc(60px + 72px + env(safe-area-inset-bottom))`). Два primary-круга в одном углу запрещены |
| Ad hoc конференция колл-центра (D-03) | `SoftphoneWidget` add-to-conference `Sheet` (`.conferenceSheet`) остаётся точкой входа оператора, но ведёт в эфемерную комнату модуля. Вторую схему комнат UI не показывает |
| AI-агент (Phase 15) | `AssistantPanel` — правый док `60vw`, `z-index: var(--z-index-modal)`, триггер слева от `#shell-cmdk-trigger`, хоткей `Ctrl/Meta+Shift+J`. Конференция — страница, не оверлей; её мини-панель использует `--z-index-toast` (как chrome софтфона) и не конкурирует за док |
| Command palette (Phase 8) | Страница `/conferences` попадает в палитру автоматически через `moduleRegistry`. `Ctrl/Cmd+K` фаза не переопределяет |
| Публичный wallboard (Phase 7) | Прецедент маршрута вне `AppLayout` и локального тёмного контекста переиспользуется, но `clamp()`-TV-типографика гостевой комнате не наследуется (D-29: телефон) |
| DialplanAppsEditor (Phase 12 / 14) | Правится **только** схема `confBridge` и три точки регистрации каталога. Персональных React-компонентов приложения не появляется (в проекте так уже пропало 46 файлов в `ui/apps/*`) |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not applicable — `Tool: none`, `components.json` отсутствует, shadcn CLI не инициализируется |
| third-party | none declared | not applicable |

Новых npm-зависимостей UI фаза **не вводит**: сетка — CSS-grid, видео — нативный
`RTCPeerConnection` через уже закреплённый `sip.js@0.21.2`, иконки — `lucide-react@0.475.0`,
плеер записей — существующий `shared/ui/AudioPlayer`. Любая попытка внести видео-SDK,
grid-библиотеку или UI-kit — отклонение, требующее отдельного обоснования в плане.

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
