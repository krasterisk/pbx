---
phase: 15
slug: universal-pbx-ai-agent
status: approved
shadcn_initialized: false
preset: none
created: 2026-09-03
reviewed_at: 2026-09-03
---

# Phase 15 — UI Design Contract

> Визуальный и интеракционный контракт поверхности **универсального AI-агента по АТС**:
> **триггер в топбаре** (вместо FAB), **панель-оверлей** с тредами, **карточка диффа** с Apply/Reject,
> **стриминг + прогресс + Стоп**, **учёт расхода только для админов**.
>
> Сгенерирован `gsd-ui-researcher` из `15-CONTEXT.md` (D-06…D-28, UI: D-23…D-26),
> общего discuss-лога Phase 14/15, `08-UI-SPEC` / `09-UI-SPEC` / `14-UI-SPEC`,
> и фактического кода `widgets/AiChatWidget` + `ModuleShell` topbar.
> `RESEARCH.md` для фазы ещё нет — стек взят из ARCHITECTURE и кода.
>
> **Не redesign Phase 14.** Блок-схема / dry-run / шаблоны / callback / Where Used —
> чужие поверхности; здесь только коллизии с триггером агента и потребление dry-run/шаблонов
> как tools (без UI этих tools).
>
> **Out of scope UI:** внутренности agent loop, формат скилов, MCP-миграция, injection/guardrails
> (`/gsd-secure-phase 15` / AI-SPEC), запись тенантных настроек через агента.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | **none** — рукописная система `shared/ui` + Radix; `components.json` отсутствует. shadcn **не** инициализировать (зафиксировано оркестратором и Phase 8/9/10/12/14) |
| Preset | not applicable |
| Component library | Radix в обёртках `shared/ui/*` + CVA (`Button`, `Dialog`, `Sheet`, `Select`, `ScrollArea`, `Badge`, `Card`, `Textarea`, `Skeleton`, `Progress`, `Tooltip`, `CommandPalette`) |
| Icon library | `lucide-react` only. Unicode-эмодзи в UI **запрещены** (ARCHITECTURE MUST). Исключение: markdown-контент от модели может содержать символы — не нормализуем их на фронте в этой фазе |
| Font | `Inter` через `--font-sans`. Моноширинный — только для технических фрагментов внутри дифф-карточки (id сущностей, ключи полей), см. Typography exception |
| Styling | SCSS-модули + `var(--color-*)` / `var(--radius-*)` / `var(--z-index-*)`. **Tailwind выше `shared/ui` запрещён**. Inline `style`-объекты и CSS-in-JS для новых поверхностей **запрещены** (текущий `Select style={{…}}` в `AiChatWidget` — долг, удалить при редизайне хедера) |
| State | RTK Query — треды/сообщения/apply; локальный `useState` — черновик ввода, раскрытие tool-строк, выбранный тред; SSE/stream — живой ответ (как сейчас `streamAiChatMessage`) |
| Placement | Overlay widget поверх любой страницы шелла (D-23). Отдельный route/page для чата **не** вводится |

### shadcn gate — resolved, not asked

Гейт выполнен без вопроса: `components.json` нет, ARCHITECTURE запрещает Tailwind выше `shared/ui`.
Инициализация shadcn противоречила бы канону. `Tool: none`.

---

## Component Inventory

Enumerated by `node -e "const fs=require('fs');const d='packages/frontend/src/shared/ui';const n=fs.readdirSync(d,{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>e.name).sort();console.log(n.length);console.log(n.join(', '));const pkg=require('./packages/frontend/package.json');console.log(pkg.name+'@'+pkg.version);"` — 39 components — `@krasterisk/frontend@4.4.4` (рукописная система в `src/shared/ui`, отдельного npm-пакета нет) — 2026-09-03.

Полный список (39): AudioPlayer, Avatar, Badge, Button, Card, Checkbox, CommandPalette, DataTable,
Dialog, DropdownMenu, FileImportButton, Input, Label, Loader, ModuleLockedPage, MultiSelect,
Pagination, PasswordInput, Popover, Progress, RadioCards, RecordingButton, ScrollArea,
SegmentedControl, Select, Separator, Sheet, Skeleton, Sparkline, Stack, Switch, Table,
TableRowActions, Tabs, TagInput, Text, Textarea, Tooltip, WebhookAuthConfig.

Таблица ниже — **не закрытый allowlist**, а разметка «что берём под нужды этой фазы».

| Нужда фазы | Компонент | Комментарий |
|------------|-----------|-------------|
| Триггер в топбаре | `Button` `variant="ghost"` `size="icon"` или `size="sm"` | Рядом с `#shell-cmdk-trigger` в `ModuleShell` topbar; не FAB |
| Панель агента | custom fixed panel + overlay (как сейчас) **или** `Sheet` side=right | Не модальный `Dialog` на весь экран. Шире текущего 420px — см. Surface B |
| Список тредов | `ScrollArea` + строки (`Button`/`HStack`) | Не `DataTable` — список диалогов, без сортировки колонок |
| Сообщения | существующий `features/ai-chat/ui/ChatMessage` + markdown | Расширить: встроенная DiffConfirmCard |
| Карточка диффа | `Card` + `Badge` + `Button` | Primary «Применить изменения», ghost/outline «Отклонить изменения» |
| Прогресс шагов | `Progress` (опционально) + строка текста Label | D-09: прогресс строкой + «Остановить ответ» |
| Стоп / Отправить | `Button` `size="icon"` | Во время стрима — «Остановить ответ» (не Send) |
| Budget cue (admin) | `Text variant="muted"` + опционально `Badge` | Только админ; не акцентная CTA |
| Загрузка тредов | `Skeleton` / `Loader` | |
| Подтверждение очистки / отклонения | `Dialog` при destructive clear thread | |
| Раскладка | `VStack` / `HStack` / `Flex` из `Stack` | Нативные `div` в features — только scroll/panel shells |
| Подсказки | `Tooltip` | Hotkey hint на триггере |

**Новых базовых примитивов в `shared/ui` фаза не вводит** без отдельного обоснования в plan.
Diff-карточка, thread rail и progress strip — композиция в `features/ai-chat` / `widgets/AiChatWidget`.

Источник токенов: `packages/frontend/src/app/styles/globals.css` `@theme`.
**Новых CSS custom properties фаза не добавляет** (кроме локальных SCSS-переменных ширины панели в модуле виджета).

---

## Spacing Scale

Кратные 4, набор идентичен `08` / `09` / `12` / `14-UI-SPEC`:

| Token | Value | Использование в Phase 15 |
|-------|-------|--------------------------|
| xs | 4px | Зазор иконка↔текст в бейджах статуса диффа / tool-строки; отступ hotkey-hint |
| sm | 8px | Gap в header панели; gap кнопок Apply/Reject; gap input↔send; gap строк треда |
| md | 16px | Padding сообщений; padding карточки диффа; horizontal padding topbar controls |
| lg | 24px | Padding пустого состояния тредов/чата; вертикальный зазор секций в admin usage |
| xl | 32px | Не обязателен; зарезервирован для крупных секций admin settings |
| 2xl | 48px | Мин. высота пустого состояния чата до иконки |
| 3xl | 64px | Не используется |

Exceptions:

- **44px** — мин. touch-target icon-only: триггер агента в топбаре (phone), Стоп/Send, закрытие панели, «новый тред», строка треда. WCAG 2.5.5.
- **56px** — высота shell topbar (Phase 8) — не менять. Триггер агента вписывается в topbar, не увеличивает высоту.
- **12px** — только существующий topbar `gap="12"` / header density (как Phase 8 exception). Не размножать 12px в теле чата.
- **60px** — mobile bottom-nav height (Phase 8). Панель агента на phone: `padding-bottom` / safe-area так, чтобы input не уходил под bottom bar; **триггер агента не** в нижнем правом углу.
- **520px** — ширина панели на desktop (подтверждено 2026-09-03; было 420px). `max-width: 100vw`. На `<768px` — full viewport width.
- **240px** — ширина thread rail внутри панели на desktop ≥1024 (подтверждено 2026-09-03). На 768–1023 thread list — collapsible overlay поверх сообщений, не постоянная колонка.
- **1px** — границы панели, карточки диффа, разделители header/input.
- Softphone FAB / chrome (Phase 9/10) остаётся в нижнем правом; агент **не** занимает этот угол.

---

## Typography

Ровно 4 размера / 2 веса — как Phase 8/9/12/14:

| Role | Size | Weight | Line Height | Использование |
|------|------|--------|-------------|---------------|
| Body | 14px | 400 | 1.5 | Текст сообщений (базовый), описание диффа, empty/error body, progress line |
| Label | 12px | 600 | 1.4 | Бейджи статуса диффа, подписи tool-call, budget cue, timestamps, hotkey hint |
| Heading | 16px | 600 | 1.3 | Заголовок панели, заголовок дифф-карточки, заголовок empty state, имя треда в списке |
| Display | 28px | 600 | 1.2 | **Не используется** в панели агента (нет page h1). Зарезервирован; не вводить пятый размер |

**Моноширинное исключение:** ключи полей и технические id внутри раскрываемой секции диффа
(`font-family: ui-monospace, SFMono-Regular, Menlo, monospace`, размер/вес = Body 14/400).
Человекочитаемый summary диффа, заголовки и CTA — **не** моно.

Запрещено: пятый размер (в т.ч. текущие 10px/11px disclaimer/status в SCSS — привести к Label 12 или muted Body 14 при редизайне).

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `var(--color-background)` `#09090b` | Затемнение overlay; фон страницы за панелью |
| Secondary (30%) | `var(--color-card)` `#0a0a0f` + `var(--color-border)` `#27272a` | Панель агента, thread rail, bubble user (muted mix), карточка диффа в покое |
| Accent (10%) | `var(--color-primary)` `#6366f1` | **Только:** активный триггер агента (открыт / focus), primary CTA «Применить изменения» и «Отправить сообщение», focus-ring, индикатор стриминга (точка/полоска), выбранный тред (левая 2px полоса или фон `color-mix(primary 12%)`) |
| Destructive | `var(--color-destructive)` `#ef4444` | «Отклонить изменения» (текст/outline), ошибка стрима, удаление треда, баннер ошибки |
| Warning | `var(--color-warning)` `#f59e0b` | Бейдж «Ожидает подтверждения» на дифф-карточке; приближение к soft budget cue у админа (**не** hard limit) |
| Success | `var(--color-success)` `#22c55e` | Дифф применён; tool_result ok; статус «Готов» в header |
| Info | `var(--color-info)` `#3b82f6` | Нейтральные tool-call chips в процессе (опционально); не для CTA |

Accent **зарезервирован** и не протекает в: idle topbar icon (muted foreground), обычные строки тредов, markdown body, disclaimer, budget cue (budget = muted + optional warning, не primary fill).

**Светлая тема:** панель и дифф-карточка — `box-shadow: 0 1px 4px rgba(0,0,0,0.06)` поверх 1px border (ARCHITECTURE).

**Коллизия с softphone accent:** softphone FAB (Phase 9) сохраняет `--color-primary` в нижнем углу. Агент в topbar — ghost icon; accent fill только когда панель открыта или при focus — чтобы два primary-круга не конкурировали на одном экране.

---

## Copywriting Contract

Все строки через `t()` в `shared/config/locales/{ru,en}.ts`. Namespace: **`aiChat.*`** (расширить существующий). Длинное тире `—` запрещено. Слово **Asterisk** в UI-копи запрещено → **Krasterisk** / «система». Технические имена tools пользователю не показывать сырьём — человекочитаемые лейблы (как `TOOL_LABELS` сейчас, через i18n).

### Триггер и панель

| Element | ru | en |
|---------|----|-----|
| **Primary CTA** (открыть агента) | AI-ассистент | AI Assistant |
| aria-label триггера | Открыть AI-ассистента | Open AI Assistant |
| Hotkey hint (tooltip) | {{mod}}+Shift+J | {{mod}}+Shift+J |
| Заголовок панели | AI-ассистент | AI Assistant |
| Статус idle | Готов | Ready |
| Статус streaming | Думаю… | Thinking… |
| Статус tools | Выполняю шаг {{current}} из {{max}}… | Running step {{current}} of {{max}}… |
| Закрыть панель | Закрыть панель | Close panel |
| Новый тред | Новый разговор | New conversation |
| Список тредов (heading) | Разговоры | Conversations |
| Threads toggle aria/tooltip | Список разговоров | Conversation list |
| Input placeholder | Спросите о настройке АТС… | Ask about PBX setup… |
| Send message | Отправить сообщение | Send message |
| **Stop generating** | Остановить ответ | Stop generating |
| Disclaimer | AI может ошибаться. Проверяйте критические изменения. | AI can make mistakes. Review critical changes. |
| Welcome (empty thread) | Привет! Я помогу настроить АТС: абоненты, транки, IVR, маршруты, справочники и очереди. Опишите задачу своими словами. | Hi! I can help set up the PBX: extensions, trunks, IVR, routes, directories, and queues. Describe the task in your own words. |

Suggestions (empty thread chips) — i18n keys, не хардкод RU в компоненте:

| ru | en |
|----|-----|
| Показать конфигурацию АТС | Show PBX configuration |
| Создать абонентов | Create extensions |
| Добавить транк | Add a trunk |
| Настроить IVR-меню | Set up an IVR menu |

### Треды

| Element | ru | en |
|---------|----|-----|
| Empty state heading | Пока нет разговоров | No conversations yet |
| Empty state body | Начните новый разговор. История сохранится и будет доступна после перезагрузки. | Start a new chat. History is saved and available after reload. |
| Thread untitled | Без названия | Untitled |
| Delete thread | Удалить разговор | Delete conversation |
| Destructive confirmation | Удалить разговор? Сообщения этого разговора будут удалены. | Delete this conversation? Its messages will be removed. |
| Confirm delete | Удалить разговор | Delete conversation |
| Keep conversation | Оставить разговор | Keep conversation |
| Loading threads | Загрузка разговоров… | Loading conversations… |
| Error threads | Не удалось загрузить разговоры. Попробуйте ещё раз. | Could not load conversations. Try again. |

### Дифф-карточка (D-18…D-20)

| Element | ru | en |
|---------|----|-----|
| Card title | Предлагаемые изменения | Proposed changes |
| Badge pending | Нужно подтверждение | Needs confirmation |
| Badge applied | Применено | Applied |
| Badge rejected | Отклонено | Rejected |
| Badge denied | Недостаточно прав | Permission denied |
| Summary lead | Вот что изменится: | Here is what will change: |
| Apply CTA | Применить изменения | Apply changes |
| Apply hint (tooltip) | Сохранит в базу и применит на АТС | Saves to the database and applies on the PBX |
| Reject CTA | Отклонить изменения | Reject changes |
| Applying | Применяю изменения… | Applying changes… |
| Apply success | Изменения применены | Changes applied |
| Apply error | Не удалось применить. {{reason}} | Could not apply. {{reason}} |
| Empty diff (should not ship) | Нет изменений для применения | Nothing to apply |

### Стриминг / ошибки

| Element | ru | en |
|---------|----|-----|
| Error state | Не удалось получить ответ. Проверьте сеть и повторите. | Could not get a reply. Check the network and retry. |
| Retry request | Повторить запрос | Retry request |
| Stopped by user | Остановлено | Stopped |
| Step ceiling reached | Достигнут лимит шагов. Уточните задачу или начните новый разговор. | Step limit reached. Narrow the task or start a new chat. |
| Permission denied (agent=human RBAC) | У вас нет прав на это действие. | You do not have permission for this action. |

### Budget / usage (admin only, D-08)

| Element | ru | en |
|---------|----|-----|
| Usage label | Расход за период: {{tokens}} ток. | Usage this period: {{tokens}} tok. |
| Usage unavailable | Учёт расхода недоступен | Usage unavailable |
| Model settings (platform) | Модель и провайдеры | Models and providers |
| Model settings hint | Выбор модели доступен только администратору платформы | Model selection is available to platform admins only |

Обычный тенант **не** видит имя модели, pricing и usage strip.

---

## Surfaces

### Surface A — Topbar trigger + hotkey (D-24)

**Где:** `packages/frontend/src/widgets/ModuleShell/ModuleShell.tsx` header `.topbar`, **сразу слева или справа от** `#shell-cmdk-trigger` (⌘K). Предпочтение: **слева от ⌘K** (поиск → ассистент → lang → theme → user), чтобы ⌘K остался привычным якорем справа от spacer.

**Что убрать:** FAB `.triggerBtn` (`fixed; bottom: 28px; right: 28px; z-index: popover`) из `AiChatWidget`. Нижний правый угол **полностью** остаётся softphone (Phase 9/10).

**Вид:** `Button` ghost icon (`Sparkles` или `Bot`, 16–18px). `aria-label` + `Tooltip` с hotkey. Когда панель открыта — `aria-pressed="true"` и лёгкий accent tint (`color-mix(primary 12%)`), не второй FAB.

**Hotkey:** `Ctrl+Shift+J` / `Meta+Shift+J` (подтверждено 2026-09-03). Не `Ctrl/Cmd+K` (занято CommandPalette). Не перехватывать, когда фокус в `input`/`textarea`/`contenteditable` **другого** поля, кроме как toggle по явному chord (как ⌘K сейчас). Документировать в tooltip.

**Mobile:** тот же topbar trigger. **Не** дублировать в bottom nav (Phase 8). Не перекрывать softphone sticky bar.

**Коллизии (нормативные):**

| Поверхность | Контракт |
|-------------|----------|
| Softphone FAB / sticky (09/10) | Нижний правый / над bottom-nav — только softphone. Agent FAB удалён |
| Mobile bottom nav (08) | Agent не в bottom bar; panel bottom inset учитывает 60px + safe-area |
| CommandPalette (08) | Сосед в topbar; отдельные hotkeys |
| Phase 14 flowchart/dry-run/templates | Без изменений; agent overlay z-index modal поверх страницы, не ломает печать Phase 14 |

**Z-index:** panel `var(--z-index-modal)` (50); overlay backdrop `var(--z-index-backdrop)` (35). Softphone остаётся на `var(--z-index-toast)` (100) — входящий звонок **поверх** панели агента (не наоборот).

### Surface B — Agent panel redesign (D-23, D-25)

**Focal point (primary screen):** лента сообщений + поле ввода. Когда в ленте есть pending diff-карточка, фокус внимания и клавиатурный tab-stop смещаются на карточку «Применить изменения» (не на Send).

**Layout desktop (≥768):** fixed right sheet-panel, width **520px** (подтверждено), full viewport height under (or including) topbar — панель может начинаться от `top: 0` как сейчас. Внутри:

```
[ Header: avatar | title+status | new-thread | threads-toggle | close ]
[ optional Thread rail 240px | Messages column ]
[ Progress strip (when streaming / tools) ]
[ Diff cards live inside message list ]
[ Input: textarea + Send/Stop ]
[ Disclaimer ]
[ Admin usage strip — only if platform admin ]
```

**threads-toggle:** icon-only `Button`; обязательны `aria-label` и `Tooltip` из строки «Список разговоров» / «Conversation list».

**Dismiss / a11y:** `Escape` закрывает панель (и не удаляет тред). Пока панель открыта — **focus trap** внутри панели (Tab циклит header → messages → input → footer). Overlay click закрывает панель (как сейчас), не сбрасывает тред. Softphone поверх панели по z-index остаётся достижим кликом вне trap только через toast layer — входящий звонок не блокируется.

**Убрать из tenant header:** `Select` модели (D-07 / D-25). Модель — только platform admin settings (существующие `/ai-agents` providers + расширение `AiChatSettingsCard` / platform console — plan выбирает точный mount; UI-контракт: **в панели чата модели нет**).

**Overlaps:** header controls не должны наезжать друг на друга: min gaps sm (8px); на узкой панели secondary actions в `DropdownMenu` «⋯».

**Mobile (<768):** panel `width: 100vw`; thread list — полноэкранный subview или Sheet поверх панели (не две колонки). Input выше bottom-nav inset.

### Surface C — Conversational threads (D-26)

**Данные:** персист в БД per tenant+user. Redux больше не единственный source of truth после reload.

**Список:** newest-first; показать title (auto из первого user message, truncate 1 line), relative time Label 12. Выбранный тред — accent marker.

**Действия:** New chat; open prior; delete with Dialog confirm (copy выше).

**Состояния:** см. UI Considerations (empty / loading / error / populated / overflow).

**Clear messages:** либо «новый тред», либо delete текущего — не молчаливый wipe без персиста. Иконка Trash в header = удалить/очистить текущий тред с confirm, не «забыть локально».

### Surface D — Diff confirmation card (D-18…D-20)

**Где:** внутри ленты сообщений как block-level card (не отдельный modal). Агент **не** принимает согласие текстом «да».

**Содержание (human-readable):**
- Заголовок + badge статуса
- 3–8 bullet summary на языке пользователя (что создаётся / меняется / удаляется) — **не** raw JSON dump
- Опционально `<details>` «Подробности» с моно id/полей для power users
- Кнопки **Применить изменения** | **Отклонить изменения**

**Apply:** один confirm → DB write + Asterisk/Krasterisk reload path (D-20). Кнопка disabled + «Применяю изменения…» на время мутации. Успех → badge Applied, кнопки скрыть. Ошибка → banner + «Повторить запрос».

**Reject:** статус Rejected, кнопки скрыть; агент может предложить альтернативу в следующем сообщении.

**Rights (D-21):** если у человека нет права — карточка с badge Denied, без Apply (или Apply → 403 с copy Permission denied). Агент не обходит RBAC.

**Jargon:** summary без dialplan-инструкций и внутренних имён tools; техника — только в раскрываемых подробностях / по запросу пользователя (D-13).

### Surface E — Streaming UX (D-09)

- SSE/stream chunks в bubble (как сейчас)
- Thinking dots пока нет текста и нет tools
- Tool rows: человекочитаемый label + spinner / check / alert
- **Progress line:** «Выполняю шаг N из M…» (M = step ceiling; точное M — discretion backend, UI показывает оба числа когда известны)
- **«Остановить ответ»** заменяет Send на время стрима; abort через существующий `AbortController`
- После stop — частичный ответ остаётся; статус Stopped

### Surface F — Admin budget / usage cues (D-08)

Паттерн из discuss: **только учёт расхода, без жёстких лимитов** («budget_visible» / count display, не gate).

| Роль | Видит usage strip в панели | Видит имя модели в панели | Настраивает провайдеров |
|------|----------------------------|---------------------------|-------------------------|
| Ordinary tenant user | Нет | Нет | Нет |
| Tenant admin | Нет в chat (usage только platform; подтверждено 2026-09-03) | Нет | Нет |
| Platform admin / SUPERADMIN | Да, footer strip | Нет в chat (смотрит в settings) | Да, platform AI settings |

Usage strip только для platform-level admin (подтверждено 2026-09-03); tenant admin смотрит агрегаты (если появятся) в platform/console, не в chat chrome. Цель D-08 — «показывается админу», без засорения tenant UX.

Hard token limits / billing UI — out of scope (deferred).

### Surface G — Model picker relocation (D-07, D-25)

Удалить model `Select` из `AiChatWidget` header.
Монтировать выбор default provider/model в **platform admin** UI рядом с существующими AI providers (`aiAgentsApi` / cloud-admin), не в tenant chat.
`AiChatSettingsCard` (tenant confirm_destructive) остаётся tenant-scoped; **не** место для выбора модели.

---

## Interaction & motion

- Panel open/close: transform ≤300ms; уважать `prefers-reduced-motion: reduce` (без slide — мгновенный toggle).
- Streaming cursor / thinking dots: выключить при reduced-motion (статичный Label «Думаю…»).
- Не блокировать softphone toast анимации.

---

## FSD placement

| Surface | Layer | Path (indicative) |
|---------|-------|-------------------|
| Topbar trigger | `widgets/ModuleShell` | кнопка + hotkey wiring |
| Panel shell | `widgets/AiChatWidget` | overlay + panel chrome |
| Messages / diff / threads UI | `features/ai-chat` | `ChatMessage`, `DiffConfirmCard`, `ThreadList` |
| RTK + stream | `shared/api` + `features/ai-chat/model` | threads CRUD, apply diff |
| Model/providers admin | `features/cloud-admin` или `pages` platform | не tenant chat |
| Locales | `shared/config/locales` | `aiChat.*` |

---

## UI Considerations

Applicable state considerations resolved: **14 covered, 2 backstop, 0 unresolved**

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| empty | thread list | ✅ covered | Empty threads → Copywriting empty state + CTA «Новый разговор» |
| empty | message list (new thread) | ✅ covered | Welcome message + suggestion chips (i18n) |
| loading | thread list | ✅ covered | Skeleton rows (3) in rail / subview |
| loading | messages reopen | ✅ covered | Skeleton bubbles until RTK resolve |
| loading | Apply in flight | ✅ covered | Apply disabled + «Применяю изменения…»; Reject disabled |
| error | thread list | ✅ covered | Inline error + Retry (copy Error threads) |
| error | stream failure | ✅ covered | Error banner + Retry last user message |
| error | Apply failure | ✅ covered | Card stays pending; error text + retry Apply |
| populated | thread list | ✅ covered | Newest-first titles + relative time; selected accent marker |
| populated | messages | ✅ covered | Scrollable list; auto-scroll on new chunks unless user scrolled up (подтверждено 2026-09-03: stick-to-bottom unless user scroll) |
| partial | streaming assistant | ✅ covered | Partial markdown + tool rows + progress line; Stop available |
| partial | diff without details | ✅ covered | Summary bullets required; details optional collapse |
| overflow | thread titles | ✅ covered | Single-line ellipsis |
| overflow | message list | ✅ covered | Column `overflow-y: auto`; panel body `min-height: 0` |
| overflow | long diff summary | ✅ covered | Card max-height 40vh + internal scroll before Apply row sticky at card bottom |
| zero-one-many | threads | ✅ covered | 0 → empty; 1 → list one row; many → scroll rail |
| long-text | markdown reply | 🧪 backstop | Markdown wraps; code blocks horizontal scroll; visual test held-out |
| long-text | diff field values | 🧪 backstop | Mono values truncate with expand; held-out UI-state test |

---

## Collision contracts (cross-phase)

| Peer | Rule |
|------|------|
| Phase 8 topbar / ⌘K / bottom nav | Trigger lives in topbar next to ⌘K; never in bottom nav; panel respects bottom-nav inset on phone |
| Phase 9/10 softphone | Lower-right + toast z-100 owned by softphone; agent FAB removed |
| Phase 14 surfaces | No redesign; agent may open overlay above route/IVR modals at z-modal; print flows of Phase 14 unchanged |
| Incoming call | Toast/softphone above agent panel |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not applicable — `Tool: none` |
| third-party registries | none | not applicable |

---

## Решения (подтверждено пользователем 2026-09-03)

1. **Hotkey** — Ctrl/Meta+Shift+J (не пересекается с ⌘K).
2. **Desktop panel width** — 520px; mobile always 100vw.
3. **Thread rail** — 240px column ≥1024 + toggle/overlay 768–1023.
4. **Usage strip** — только platform admin в футере чата.
5. **Stick-to-bottom while streaming** — auto-scroll unless user scrolled up.

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS
- [x] Dimension 7 Inventory Provenance: PASS

**Approval:** approved 2026-09-03 (revision 1 after Cancel BLOCK fix)
