# Krasterisk v4 — Архитектура и план разработки

> **Внимание:** Данный проект (v4) является полным переписыванием (rewrite) системы Krasterisk v3. Стек полностью меняется с legacy PHP на современный NestJS (TypeScript) для Backend и React 19 (FSD) для Frontend. Это относится ко всем модулям.

## Стек технологий

| Компонент | Технология | Версия |
|---|---|---|
| **Backend** | NestJS | 11.x |
| **Frontend** | React (FSD) | 19.x |
| **Bundler** | Vite | 6.x |
| **Стилизация** | Tailwind CSS + shadcn/ui (Radix + CVA) | 4.x |
| **State** | Redux Toolkit + RTK Query | 2.x |
| **ORM** | Sequelize | 6.x |
| **DB** | MySQL (existing Asterisk Realtime) | — |
| **Auth** | JWT + bcrypt | — |
| **Real-time** | Socket.IO (AMI events → browser) | 4.x |
| **Asterisk** | AMI (persistent TCP) + ARI (HTTP + WS) | — |
| **i18n** | i18next | 24.x |
| **Таблицы** | TanStack Table | 8.x |
| **Графики** | Recharts | 2.x |
| **Анимации** | Motion (Framer) | 12.x |
| **Иконки** | Lucide React | — |
| **TypeScript** | | 5.7+ |
| **Node.js** | | 20+ |

---

## Архитектура монорепо

```
krasterisk_v4/
├── package.json              # root workspaces
├── tsconfig.base.json        # shared TS config
├── .env.example
├── .gitignore
└── packages/
    ├── shared/               # @krasterisk/shared — types, enums, DTOs
    │   └── src/
    │       ├── enums/
    │       └── types/
    ├── backend/              # @krasterisk/backend — NestJS API
    │   └── src/
    │       ├── main.ts
    │       ├── app.module.ts
    │       └── modules/
    │           ├── auth/     # JWT login, guards, strategy
    │           ├── users/    # User model + CRUD
    │           ├── peers/    # SIP peers CRUD
    │           ├── trunks/   # (planned)
    │           ├── queues/   # (planned)
    │           ├── routes/   # (planned)
    │           ├── reports/  # CDR (planned)
    │           └── ami/      # AMI Service + WS Gateway
    └── frontend/             # @krasterisk/frontend — React FSD
        └── src/
            ├── app/          # Store, Router, Layout, Styles
            ├── pages/        # LoginPage, DashboardPage, ...
            ├── widgets/      # Sidebar, Header
            ├── features/     # Auth slice, ...
            ├── entities/     # (planned)
            └── shared/       # API (RTK Query), UI, Hooks, i18n, Lib
```

---

## Интеграция с Asterisk

### AMI (Asterisk Manager Interface)
- **Тип:** Persistent TCP connection
- **Библиотека:** `asterisk-manager`
- **Поведение:** Подключается при старте, автоматически реконнектится
- **События:** PeerStatus, QueueMemberStatus, NewChannel, Hangup
- **Поток:** AMI Event → AmiService → AmiGateway (WebSocket) → Browser

### ARI (Asterisk REST Interface)
- **Тип:** HTTP + WebSocket
- **Библиотека:** `ari-client`
- **Применение:** Originate, Spy, Transfer, Bridge management
- **Статус:** Planned (Phase 3)

### База данных
- **Подключение:** Sequelize → existing MySQL (krasterisk DB)
- **synchronize: false** — НЕ модифицирует таблицы
- **Таблицы:** users, sippeers, trunks, queue_table, cdr

---

## UI/UX дизайн

### Тема
- **Режим:** Dark-first
- **Фон:** #0c1214 (login), #09090b (app)
- **Primary:** #6366f1 (Indigo)
- **Эффекты:** Glassmorphism, glow, gradient text, floating animations
- **Шрифт:** Inter (Google Fonts)

### Дизайн-система и Стандарты (FSD)
Проект использует строгую дизайн-систему, основанную на паттернах `aiPBX`, но со своими CSS-переменными в `design-system.scss`.
- **Позиционирование (Layout):** Запрещено использование тегов `div` и `span` с inline `flex` классами на уровне компонентов фич и страниц. Для позиционирования необходимо использовать **Stack**-компоненты: `<VStack>`, `<HStack>`, `<Flex>`.
- **Строгий отказ от базовых HTML-тегов:** В слоях выше `shared` (то есть в `entities`, `features`, `widgets`, `pages`) **строго запрещено** использование нативных тегов разметки, таких как `div`, `span`, `label`, `select`, `input`, `button`. 
    - Любой текст должен рендериться через компонент `<Text>` или `<Typography>`.
    - Любые инпуты, лейблы, селекты, кнопки должны браться ИСКЛЮЧИТЕЛЬНО из `@/shared/ui/`.
    - Если нужен сложный компонент из сторонней библиотеки (фреймворка) — он **обязательно** оборачивается в собственную обертку (wrapper) внутри `shared/ui` с инкапсуляцией Public API.
- **Стилизация:** TailwindCSS используется только внутри базовых UI компонентов (`shared/ui`). На уровне бизнес-логики (`features/`, `pages/`, `widgets/`) кастомная стилизация **обязана** осуществляться через SCSS-модули с CSS-переменными из дизайн-системы.
- **Z-Index:** Хардкодирование `z-index` (например, `z-index: 100`) **строго запрещено**. Для управления слоями необходимо использовать только глобальные CSS-переменные из `globals.css` (например, `var(--z-index-dropdown)`, `var(--z-index-modal)` и т.д.). Это предотвращает конфликты перекрытия и "z-index войны".
- **Optimistic toggles (MUST):** Любой `Switch` / toggle, который **сразу пишет на сервер** (нет отдельной кнопки Save) и чей `checked` берётся из RTK Query cache, **обязан** обновлять UI мгновенно:
  1. В mutation — `async onQueryStarted` → `api.util.updateQueryData(...)` (optimistic patch).
  2. При успехе — записать ответ сервера в тот же cache entry (или оставить patch).
  3. При ошибке — `patchResult.undo()` **и** показать toast/ошибку пользователю.
  4. Не полагаться только на `invalidatesTags` + refetch: это даёт заметную задержку бегунка до ответа сети.
  - Формы с локальным `useState` + явной кнопкой «Сохранить» уже «optimistic» на уровне UI — правило про RTK-patch к ним не применяется, пока toggle не биндится напрямую к query cache.
  - Эталон: `updateMyNotifications` / `updateMyUiCustomization` в `shared/api/endpoints/callCenterApi.ts`.
- **Table row actions (MUST):** Колонка действий в `DataTable` / списках (edit / copy / delete) **обязана** использовать `TableRowActions` + `TableRowAction` из `@/shared/ui`.
  - Нельзя: нативный `<button>` / Tailwind `hover:bg-white/5` / `hover:bg-accent` на иконках — фон кнопки сливается с hover строки, иконка «пропадает».
  - Визуал: muted иконка → на hover только смена цвета (`foreground` / `destructive` для `danger`), **без** заливки фона.
  - Обязательны `title` и `aria-label`.
  - Эталоны: `features/users/ui/UsersTable/useUsersTableColumns.tsx`, `features/routes/ui/RoutesTable/RoutesTable.tsx`.
  - Компонент: `shared/ui/TableRowActions`.

```tsx
import { TableRowActions, TableRowAction } from '@/shared/ui';
import { Pencil, Trash2 } from 'lucide-react';

<TableRowActions>
  <TableRowAction title={t('common.edit')} aria-label={t('common.edit')} onClick={onEdit}>
    <Pencil />
  </TableRowAction>
  <TableRowAction danger title={t('common.delete')} aria-label={t('common.delete')} onClick={onDelete}>
    <Trash2 />
  </TableRowAction>
</TableRowActions>
```

- **No emoji icons (MUST):** Unicode-эмодзи **запрещены** как иконки UI (кнопки, лейблы, бейджи, tooltips, empty states, tab triggers). Для иконок используется **только Lucide React** (`lucide-react`). Подсказки у полей — текст (`Text` / `InfoTooltip` с Lucide), не символы вроде ℹ️ / ❓ / ✅.
  - Эталон без emoji-иконок у лейблов: `features/users/ui/UserFormModal/UserFormModal.tsx`.
- **Password fields (MUST):** Поля пароля с возможностью просмотра используют `PasswordInput` из `@/shared/ui` — toggle «показать/скрыть» **внутри** поля (Eye/EyeOff), не отдельной кнопкой рядом. Генерация пароля (если нужна) — соседняя action-кнопка вне инпута.
  - Компонент: `shared/ui/PasswordInput`. Эталон: `features/users/ui/UserFormModal/UserFormModal.tsx`.

---

### Система дизайн-токенов и стилизация через SCSS-модули

#### Источник токенов

Все дизайн-токены проекта определены в `src/app/styles/globals.css` в директиве `@theme` (Tailwind v4). Это **единственный источник правды** для цветов, скруглений и z-индексов.

```css
/* globals.css */
@theme {
  --color-background: #09090b;
  --color-foreground: #fafafa;
  --color-card:       #0a0a0f;
  --color-border:     #27272a;  /* light: #e4e4e7 */
  --color-primary:    #6366f1;
  --color-muted:      #18181b;
  --color-muted-foreground: #71717a;
  --color-destructive: #ef4444;
  --color-success:    #22c55e;
  --color-warning:    #f59e0b;
  --color-info:       #3b82f6;
  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;
}
```

#### Правила использования токенов в SCSS-модулях

**✅ Правильно** — использовать `var(--color-*)` и `var(--radius-*)` напрямую:

```scss
/* features/my-feature/ui/MyCard/MyCard.module.scss */
.card {
  background:    var(--color-card);      /* НЕ hsl(var(--card)) */
  border:        1px solid var(--color-border);
  border-radius: var(--radius-lg);
  transition:    box-shadow 0.2s ease;

  &:hover {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  }
}

.icon { color: var(--color-primary); }
.label { color: var(--color-muted-foreground); }
```

**❌ Запрещено** — старый shadcn/ui синтаксис через `hsl(var(--border))`:

```scss
/* ❌ НЕПРАВИЛЬНО — такие переменные в этом проекте не существуют */
.card {
  border: 1px solid hsl(var(--border));    /* ❌ --border не определён */
  background: hsl(var(--card));            /* ❌ --card не определён */
  color: hsl(var(--muted-foreground));     /* ❌ --muted-foreground не определён */
}
```

#### Прозрачные варианты токенов: `color-mix()`

Для создания полупрозрачных вариантов токенных цветов используется CSS `color-mix()`. Это современный стандарт, работающий в Chrome 111+, Firefox 113+, Safari 16.2+.

```scss
/* ✅ Правильно — прозрачность через color-mix() */
.tabsRow {
  background: color-mix(in srgb, var(--color-muted) 30%, transparent);
  border-bottom: 1px solid var(--color-border);
}

.badgeDanger {
  background: color-mix(in srgb, var(--color-destructive) 12%, transparent);
  color:       var(--color-destructive);
  border-color: color-mix(in srgb, var(--color-destructive) 25%, transparent);
}

/* ❌ Запрещено — произвольные rgba() без токенов */
.card {
  background: rgba(10, 10, 15, 0.7); /* ❌ хардкод цвета вне системы */
}
```

#### Отношение Tailwind и SCSS-модулей

| Слой | Tailwind в JSX | SCSS-модули |
|------|---------------|-------------|
| `shared/ui` | ✅ Разрешено | ✅ Разрешено |
| `entities/` | ❌ Запрещено | ✅ Обязательно |
| `features/` | ❌ Запрещено | ✅ Обязательно |
| `widgets/`  | ❌ Запрещено | ✅ Обязательно |
| `pages/`    | ❌ Запрещено | ✅ Обязательно |

> **Почему нельзя Tailwind в `features/pages`?**  
> Tailwind v4 + `@tailwindcss/vite` и SCSS-модули компилируются раздельно. `@apply` в SCSS не работает с этим стеком. Tailwind-классы в JSX выше `shared/ui` создают смешение ответственностей: дизайн-система "вытекает" из компонентного слоя в бизнес-логику, что затрудняет рефакторинг темы.

#### Структура SCSS-модуля (обязательный шаблон)

```scss
/* ─────────────────────────────────────────────────────
   [ComponentName] — краткое описание
   Design tokens: var(--color-*) from globals.css @theme
   ───────────────────────────────────────────────────── */

/* 1. Layout — position, flex/grid, sizing */
.wrapper { ... }

/* 2. Visual — colors, border, shadow */
.card {
  background:    var(--color-card);
  border:        1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

/* 3. States — hover, active, disabled */
.card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.1); }

/* 4. Variants — color modifiers */
.danger { color: var(--color-destructive); }

/* 5. Animations — keyframes */
@keyframes spin { ... }
```

#### Теневая видимость в светлой теме

В светлой теме `--color-border: #e4e4e7` (светло-серый). Для элементов, которые должны быть чётко видны на белом фоне, **обязательно** добавлять `box-shadow`:

```scss
.card {
  border: 1px solid var(--color-border);
  /* Важно для светлой темы — делает карточку видимой */
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}
```

---

- **Локализация:** Все текстовые строки должны выводиться через хук `useTranslation()`. **Важно:** нельзя просто добавлять i18n ключи в JSX — разработчик обязан убедиться в наличии словарей (namespaces). Если словаря или ключей нет в `shared/config/locales/` (как `ru.ts`, так и `en.ts`), их необходимо создать и добавить переводы для **всех поддерживаемых языков**. Хардкод текста в вызовах `t()` как фоллбэк разрешен только временно, окончательный маппинг в словарях — обязателен.
- **Иконки:** Использование эмодзи-иконок (🎲, ☎, 📊 и т.д.) в UI **строго запрещено**. Для иконографии использовать только SVG-иконки из `lucide-react` или собственные SVG-ассеты, размещённые в `shared/assets/`. Это обеспечивает консистентность, масштабируемость и одинаковый вид на всех платформах.
- **Типографика (тире):** Использование длинного тире `—` (em dash, U+2014) в UI-текстах, placeholder-ах, option-ах и fallback-строках `t()` **строго запрещено**. Вместо него используется обычный дефис-минус `-` или запятая. Примеры: `'Выберите действие'` вместо `'— Выберите действие —'`; `'16 - Normal Clearing'` вместо `'16 — Normal Clearing'`. В JSDoc-комментариях допускается.
- **Адаптивность (Responsive Design):** Все компоненты **обязаны** корректно отображаться на экранах от 360px (мобильный) до 2560px (десктоп). Адаптивность не опция, а архитектурное требование, проверяемое на этапе ревью.

#### Брейкпоинты
Проект использует стандартные Tailwind v4 брейкпоинты:

| Токен | Значение | Использование |
|-------|----------|---------------|
| `max-sm:` | `@media (max-width: 639px)` | Мобильные устройства |
| `sm:` | `@media (min-width: 640px)` | Планшет portrait |
| `md:` | `@media (min-width: 768px)` | Планшет landscape |
| `lg:` | `@media (min-width: 1024px)` | Десктоп |

#### Обязательные правила

1. **Grid-лейауты** с фиксированными колонками (`grid-template-columns: 1fr 1fr`) **обязаны** содержать `@media (max-width: 640px) { grid-template-columns: 1fr; }` в SCSS-модуле.

2. **Flex-контейнеры** с горизонтальным расположением (row) **обязаны** использовать `flex-wrap` или переключаться на `flex-direction: column` через `max-sm:` / `@media`, если суммарная ширина дочерних элементов может превысить ширину экрана.

3. **Фиксированные ширины** (`w-[200px]`, `w-[220px]`) допускаются только в паре с `min-w-[...]` и `max-sm:w-full max-sm:basis-full` для мобильной адаптации.

4. **`DialogContent`** — все размеры (`xl`, `2xl`, `3xl`, `large`) автоматически адаптируются к мобильным через базовые классы: `max-sm:max-h-[95dvh] max-sm:max-w-[calc(100vw-1rem)] max-sm:p-4`. Вариант `large` использует `max-sm:h-[90dvh]` и `min-h-0` вместо фиксированного `min-h-[600px]`.

5. **Контейнеры со скроллом** — для предотвращения горизонтального переполнения используется `overflow-x-auto` + `min-w-0` на flex-контейнерах.

6. **Таблицы** внутри модалок и карточек должны быть обёрнуты в контейнер с `overflow-x-auto` для горизонтального скролла на узких экранах.

7. **Кнопки-группы** (action buttons) в заголовках секций оборачиваются в контейнер с `flex-wrap`, чтобы на мобильных кнопки переносились на новую строку.

#### Паттерны адаптивности в SCSS-модулях

```scss
// Пример: formGrid в модалке
.formGrid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
}

// Пример: entry row с удалением
.entryRow {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 0.5rem;

  @media (max-width: 640px) {
    grid-template-columns: 1fr auto;
  }
}
```

#### Паттерны адаптивности в Tailwind-классах

```tsx
// Flex-контейнер с flex-wrap
<Flex className="flex-wrap" gap="12">
  <VStack className="w-[200px] min-w-[140px] max-sm:w-[calc(100%-50px)]">
    ...
  </VStack>
  <VStack className="flex-1 min-w-[180px] max-sm:w-full max-sm:basis-full">
    ...
  </VStack>
</Flex>
```

#### Запрещено
- Горизонтальный скролл страницы (body overflow-x)
- Фиксированные ширины без мобильного fallback
- `min-height` на модалках, превышающий viewport мобильных устройств

### Паттерны оформления UI

#### Модальные окна форм (MUST) — эталон `UserFormModal`

**Эталон:** `features/users/ui/UserFormModal/UserFormModal.tsx` + `UserFormModal.module.scss`.

Новые и рефакторимые form-модалки (create/edit) **обязаны** следовать этой композиции. Крупные модалки с табами (`size="large"`) дополнительно используют паттерн `scrollBody` и табы ниже.

##### 1. Оболочка: высота viewport, скролл только у тела

`DialogContent` по умолчанию — `grid` без надёжного скролла на коротких экранах. Для form-модалки:

| Зона | Поведение |
|------|-----------|
| **Shell** | `flex flex-col`, `overflow: hidden`, `max-height: min(90vh, 90dvh)`, `max-width: min(<ширина>, calc(100vw - 1rem))`, `gap: 0` |
| **Header** | `flex-shrink: 0`, `padding-right` под кнопку Close |
| **Form** | `flex: 1`, `min-height: 0`, column; внутри: **formBody** + **footer** |
| **formBody** | единственная зона со `overflow-y: auto` + `overscroll-behavior: contain` |
| **Footer** | `flex-shrink: 0`, `border-top: 1px solid var(--color-border)`, кнопки всегда видны |

```tsx
<Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
  <DialogContent className={`flex flex-col gap-0 overflow-hidden max-h-[min(90vh,90dvh)] ${styles.dialogContent}`}>
    <DialogHeader className={`shrink-0 ${styles.header}`}>
      <DialogTitle>{isEditing ? t('…edit') : t('…add')}</DialogTitle>
    </DialogHeader>
    <form onSubmit={handleSubmit} className={styles.form} autoComplete="off">
      <div className={styles.formBody}>
        <VStack gap="16" max>{/* поля */}</VStack>
      </div>
      <DialogFooter className={styles.footer}>
        <HStack gap="8" justify="end" max>
          <Button type="button" variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit">{t('common.save')}</Button>
        </HStack>
      </DialogFooter>
    </form>
  </DialogContent>
</Dialog>
```

```scss
.dialogContent {
  max-width: min(560px, calc(100vw - 1rem));
  gap: 0;
}

.form {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  gap: 0;
}

.formBody {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-block: 0.75rem 0.5rem;
  padding-right: 0.25rem;
}

.footer {
  flex-shrink: 0;
  padding-top: 0.75rem;
  border-top: 1px solid var(--color-border);
}
```

**❌ Запрещено:** растягивать модалку выше viewport без внутреннего скролла; прятать Cancel/Save/Close за краем экрана; скроллить весь `DialogContent` целиком (крестик и футер уезжают).

##### 2. Поля формы

- Поле = `<VStack gap="8" max className={styles.field}>` → `Label` + контрол (`Input` / `Select` / `PasswordInput`).
- Обязательные поля: суффикс ` *` в лейбле.
- Лейблы: muted (`var(--color-muted-foreground)`), кроме **primary-поля** (ключевой селект/роль) — `foreground` + `font-weight: 600`.
- Ряды с action-кнопкой (пароль + generate): input `flex: 1; min-width: 0`, кнопка `flex-shrink: 0`.
- Пароль: только `PasswordInput`; генерация — соседняя `Button variant="outline" size="icon"`.

##### 3. Подсказки — только `InfoTooltip`

Длинный текст-подсказка **под** полем **запрещён**. Подсказки — `InfoTooltip` рядом с лейблом (`HStack gap="4" align="center"`).

Текст подсказки: понятный язык для пользователя, без жаргона (не «гранты», не «Hub», если можно сказать «какие модули видит пользователь»).

```tsx
<HStack gap="4" align="center">
  <Label htmlFor="…" className={styles.fieldLabel}>{t('…')}</Label>
  <InfoTooltip text={t('….hint')} />
</HStack>
```

**Оформление текста подсказки (MUST):** `InfoTooltip` / `Tooltip` рендерят строки через `formatRichTooltipText` (`shared/ui/Tooltip/Tooltip.tsx`). В locale / fallback:

- Каждый смысловой пункт — **с новой строки** (`\n`). Не склеивать варианты в одно предложение через точку.
- Ключевые имена параметров / режимов / примеров — в `**жирный**` (маркеры `**…**`, без HTML в строках i18n).
- Без длинного тире `—` (см. типографику выше); обычный дефис `-` или запятая.
- Без dialplan-внутренностей (`Queue(…)`, `PB_*`, tenant-суффиксы), если пользователь их не настраивает руками.

```ts
// ✅
'**Статичная очередь** - из списка\n**По маске** - номер набранного exten\n**Из переменной** - имя канала без ${}'

// ❌ одна простыня без акцентов
'Статичная очередь - из списка. По маске - номер exten. Из переменной - имя канала.'
```

```tsx
<InfoTooltip
  text={t(
    'routes.chain.source.variableHint',
    'Имя переменной канала **без ${}**\n**Пример:** MY_QUEUE\nЗначения переменной задаются ранее в цепочке маршрута, либо в webhook',
  )}
/>
```

##### 4. Вторичная группа полей — сворачиваемый блок

Доп. параметры (редко нужные) — в bordered-группе, **по умолчанию свёрнутой** (при edit можно открыть, если значения уже заданы):

- Фон: `color-mix(in srgb, var(--color-muted) 35%, transparent)`.
- Заголовок: toggle-кнопка + `ChevronDown` (rotate при open) + `InfoTooltip` **снаружи** toggle (клик по `?` не сворачивает секцию).
- `aria-expanded` / `aria-controls` на toggle.

##### 5. Медиа / аватар

- Блок по центру (`VStack align="center"`).
- Лейбл действия и upload — **одна** кнопка (напр. «Загрузить аватар»), рядом `InfoTooltip` и опционально remove.

##### 6. Валидация

- HTML-атрибуты по типу (`type="email"`, `inputMode="email"`) + явная проверка перед submit.
- Ошибка — текст под полем (`styles.fieldError` / `var(--color-destructive)`), `aria-invalid` + `aria-describedby`.
- Пустое опциональное поле = валидно.

##### 7. Footer-кнопки

Порядок: **Отмена** (`variant="outline"`) → **Сохранить** (primary, `type="submit"`). При loading — disable обеих, на Save — `Loader2`.

---

- **Скролл тела модалки (`scrollBody`, large / tabs):** для `DialogContent size="large"` контент между header и footer **обязан** оборачиваться в скролл-контейнер. Имя класса в эталонах с табами — `.scrollBody`; в компактных form-модалках (см. выше) — `.formBody`. Суть одна:

  ```scss
  .scrollBody /* или .formBody */ {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding-right: 0.25rem;

    > * {
      flex-shrink: 0;
    }
  }
  ```

  **Обоснование:** без `min-height: 0` flex-дети не сжимаются; без `> * { flex-shrink: 0 }` (где применимо) дочерние блоки сжимаются вместо скролла. Нативный `<div>` для layout в `features/` нежелателен — предпочтительны Stack; исключение — обёртка `formBody`/`scrollBody`, если Stack ломает flex-сжатие.

- **Табы в модалках:** Если форма сложная (>150 строк или сложная логика), она декомпозируется на «умный» родитель-модалку и дочерние компоненты-вкладки (напр. `[Feature]GeneralTab.tsx`, `[Feature]PromptsTab.tsx`).
- **Table row actions:** Колонка иконок действий в таблицах — только `TableRowActions` / `TableRowAction` (см. MUST выше в «Дизайн-система и Стандарты»). Не дублировать `.actionBtn` в feature SCSS.

#### Паттерн табов в модалках (обязательный)

**Эталоны (SCSS):** `features/ivrs/ui/IvrFormModal/IvrFormModal.module.scss`, `features/ai-agents/ui/AiAgentModal/AiAgentModal.module.scss`.

**Эталоны (interim Tailwind, до миграции на SCSS):** `features/routes/ui/RouteFormModal/RouteFormModal.tsx`, `features/endpoints/ui/EndpointFormModal/EndpointFormModal.tsx`, `features/trunks/ui/TrunkFormModal/TrunkFormModal.tsx`.

В слоях `features/` и `pages/` табы **обязаны** давать **одну** общую линию под строкой табов и **одну** полосу 2px под активным табом. Двойное подчёркивание (линия контейнера + `border-b-2` на кнопке без overlap) **запрещено**.

**Визуальная модель:**

```
┌─────────────────────────────────────────────────────────┐
│  [Основные]   Сеть   Расширенные                        │
│  ══════════                                             │  ← 2px primary на активном табе
│─────────────────────────────────────────────────────────│  ← 1px border у контейнера
│  контент вкладки (scrollBody / body)                    │
└─────────────────────────────────────────────────────────┘
```

**Ключевые правила:**

| Элемент | Поведение |
|---------|-----------|
| Контейнер | `border-bottom: 1px` (`var(--color-border)` или `border-border/50`), `margin-bottom` до контента |
| Ряд табов | `margin-bottom: -1px` — полоса активного таба **перекрывает** линию контейнера |
| Активный таб | Полоса **2px** `primary` — через `border-bottom-color` (SCSS) или абсолютный индикатор (Tailwind) |
| Скролл | `overflow-x: auto` + скрытый scrollbar на узких экранах |

**❌ Запрещено:**

- `border-b` на контейнере **и** `border-b-2` на кнопке без `-1px` overlap (две полосы).
- Только класс `tabActive` без базового `tab` (SCSS).
- Отдельный блок-индикатор под **всей** строкой табов вместо подчёркивания активной кнопки.

##### Вариант A — SCSS-модуль (предпочтительный для новых модалок)

Tailwind на полосе табов в JSX **не использовать**. Стили — в `[Modal].module.scss`.

```scss
.tabsWrap {
  margin-bottom: 1.5rem;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.tabsRow {
  display: flex;
  gap: 0.5rem;
  margin-bottom: -1px;
  overflow-x: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.tab {
  position: relative;
  display: inline-flex;
  align-items: center;
  padding: 0.75rem 0.25rem;
  border: none;
  border-bottom: 2px solid transparent;
  background: transparent;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-muted-foreground);
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: color 0.15s ease, border-color 0.15s ease;

  &:hover {
    color: var(--color-foreground);
  }
}

.tabActive {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}
```

```tsx
<div className={cls.tabsWrap}>
  <div className={cls.tabsRow} role="tablist">
    {tabs.map((tab) => (
      <button
        key={tab.id}
        type="button"
        role="tab"
        aria-selected={activeTab === tab.id}
        className={[cls.tab, activeTab === tab.id && cls.tabActive].filter(Boolean).join(' ')}
        onClick={() => setActiveTab(tab.id)}
      >
        {tab.label}
      </button>
    ))}
  </div>
</div>
```

##### Вариант B — interim Tailwind (существующие Radix-модалки до рефакторинга)

Допустим только в модалках, которые ещё не переведены на SCSS. Визуальный результат **должен совпадать** с вариантом A.

```tsx
<VStack className="border-b border-border/50 mb-6 shrink-0" max>
  <HStack
    gap="8"
    className="-mb-[1px] flex overflow-x-auto flex-nowrap [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
  >
    {tabs.map((tab) => (
      <Button
        key={tab.id}
        variant="ghost"
        onClick={() => setActiveTab(tab.id)}
        className={`relative py-3 px-1 rounded-none text-sm font-medium transition-colors whitespace-nowrap shrink-0 outline-none ${
          activeTab === tab.id
            ? 'text-primary bg-transparent hover:bg-transparent hover:text-primary'
            : 'text-muted-foreground bg-transparent hover:text-foreground hover:bg-transparent'
        }`}
      >
        {tab.label}
        {activeTab === tab.id && (
          <VStack className="absolute left-0 right-0 bottom-0 h-[2px] bg-primary rounded-t-[1px]">{''}</VStack>
        )}
      </Button>
    ))}
  </HStack>
</VStack>
```

При рефакторинге модалки на SCSS — удалить Tailwind с полосы табов и перейти на вариант A.
- **Инпуты и текстовые поля:** Строго компоненты `<Input>`, `<Select>`, `<Label>` из `@/shared/ui`. Запрет на использование сырой HTML разметки `<input>`, `<select>` в слое `features`.

### Паттерн копирования (Copy/Duplicate Modal)

Все модули, поддерживающие функцию дублирования записей, **обязаны** следовать единому паттерну (эталон: `features/trunks`):

#### 1. Slice — триадный `modalMode`
```typescript
// model/types/[Name]Schema.ts
interface FeatureSchema {
  isModalOpen: boolean;
  modalMode: 'create' | 'edit' | 'copy';  // ← 'copy' обязателен
  selectedItem: Item | null;
}
```

```typescript
// model/slice/[Name]Slice.ts — три reducer-а:
openCreateModal(state) {
  state.isModalOpen = true;
  state.modalMode = 'create';
  state.selectedItem = null;
},
openEditModal(state, action: PayloadAction<Item>) {
  state.isModalOpen = true;
  state.modalMode = 'edit';
  state.selectedItem = action.payload;
},
openCopyModal(state, action: PayloadAction<Item>) {
  state.isModalOpen = true;
  state.modalMode = 'copy';
  state.selectedItem = action.payload;
},
```

#### 2. Таблица — кнопка Copy
```tsx
// Кнопка копирования располагается между Edit и Delete:
<Button variant="ghost" size="icon"
  onClick={() => dispatch(actions.openCopyModal(item))}
  title={t('common.copy')}>
  <Copy className="w-4 h-4" />
</Button>
```
**Важно:** кнопка Copy **не выполняет** API-запрос напрямую — она только открывает модалку через dispatch.

#### 3. Модалка — обработка mode
```tsx
// useEffect: prefill из selectedItem, но clear name/id при copy
if ((mode === 'edit' || mode === 'copy') && selectedItem) {
  setName(mode === 'copy' ? '' : selectedItem.name);
  // ... остальные поля копируются полностью
}

// submit: copy → create API
const isCreateMode = mode === 'create' || mode === 'copy';
if (isCreateMode) await createMutation(data);
else await updateMutation({ uid, data });

// title: три варианта
{mode === 'edit' ? t('edit') : mode === 'copy' ? t('copy') : t('create')}
```

#### Реализация по модулям

| Модуль | Что копируется | Что очищается |
|--------|---------------|---------------|
| **Trunks** | host, type, codecs, auth, advanced | name |
| **IVR** | timeout, prompts, menu_items, options | name, exten |
| **Queues** | strategy, members, announcements, advanced | exten, display_name (+ суффикс) |
| **Routes** | extensions, actions, webhooks, options | name |
| **Time Groups** | intervals, comment | name |

### Паттерны (из aiPBX)
- Glass card с `backdrop-filter: blur(24px)`
- Floating logo с CSS-анимацией (6s ease-in-out infinite)
- Gradient border overlay (`::after` pseudo-element)
- Radial gradient background decoration
- LangSwitcher в header
- Sidebar с collapsible animation (Motion)
- Active indicator с `layoutId` (shared animation key)

### Строгие архитектурные правила FSD (Feature-Sliced Design)
Чтобы поддерживать консистентность и избегать монолитности, весь код (включая `shared/ui`) подчиняется следующим правилам:
### 1. **Структура UI-компонентов**:
   Каждый компонент (в `shared/ui`, `entities`, `features`, `widgets`) **обязан** создаваться в собственной папке.
   Обязательный состав:
   - `[ComponentName].tsx` — логика и разметка.
   - `[ComponentName].module.scss` — локализованные стили (Tailwind разрешён только для utility-нужд, базовая стилизация по БЭМ/модулям).
   - `index.ts` — Public API компонента (`export * from './[ComponentName]'`).
2. **Слой API (RTK Query)**:
   - Базовый API-инстанс создаётся один в `shared/api/rtkApi.ts`.
   - Эндпоинты разбиваются по сущностям (`shared/api/endpoints/userApi.ts` и т.д.) и инжектятся через `.injectEndpoints()`.
   - Все хуки запросов используют строгую типизацию из `@krasterisk/shared`.
3. **Redux Store, Slices и State**:
   - Глобальный стейт делится на слайсы `features` (неглубокие, общие компоненты) и стейт-кэш `rtkApi`.
   - **Строгое правило (Local Form State):** В глобальном Redux стейте запрещено хранить временные данные форм редактирования (черновики названий, параметры и т.д.). Для управления состоянием активной страницы редактирования/форм-конструктора (например при переходе на `path/:id`) используется локальный `useState` или `react-hook-form` вместе с контекстом, а данные сохраняются в бэкенд через мутации.
   - Для каждого слайса создается схема состояний (`model/types/[Name]Schema.ts`).
   - Используются четко выделенные `selectors` (`model/selectors/[Name]Selectors.ts`) — прямое использование `state => state.xxx` внутри компонентов UI допускается только в крайних случаях.
4. **Entities (Сущности)**:
   - Бизнес-сущности (User, Peer, Number) изолируются в `entities/`.
   - Включают свои типы, константы (напр. маппинги цветов/i18n), атомарные компоненты (например, Badge статуса).
   - Каждая сущность обязана предоставлять `index.ts` с Public API, сокрытием внутренней логики.
5. **Тонкие страницы (Pages as Orchestrators)**:
   - Страницы в `pages/` не должны содержать сложной бизнес-логики.
   - Их задача — собирать воедино Widgets и Features, размечая структуру (≤50-70 строк).
   - Любое всплывающее UI, формы редактирования и таблицы выносятся в слой `features/`.
6. **Тестирование (Testing Rules)**:
   - Для всех Redux Slices и Selectors обязательно покрытие unit-тестами.
   - **Для всех вновь создаваемых UI компонентов (features, widgets) обязательно написание интеграционных тестов** в том же модуле. Это архитектурное требование проекта.

---

## Мультитенантность (Multi-Tenant Isolation)

Система работает как **виртуальная АТС** — данные каждого тенанта (vpbx_user) полностью изолированы от других. Все модули **обязаны** соблюдать следующие правила тенантности:

### Канонические имена

| Уровень | Каноническое имя | Пример | Обоснование |
|---------|-----------------|--------|-------------|
| **JWT payload** | `vpbx_user_uid` | `req.user.vpbx_user_uid` | Установлено в AuthModule, не менять |
| **Колонка БД** (наши таблицы) | `user_uid` | `@Column user_uid` | Единый стандарт проекта |
| **Колонка БД** (Asterisk Realtime) | `vpbx_user_uid` | Маппинг через Sequelize `field:` | Нельзя менять схему Asterisk |
| **Параметр сервиса** | `userUid` | `findAll(userUid: number)` | camelCase в TypeScript |
| **Sequelize where** | `user_uid` | `where: { user_uid: userUid }` | Совпадает с TS-свойством модели |

### Правила для Backend

#### 1. Модель (Sequelize)
```typescript
// Наши таблицы — колонка называется user_uid:
@Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
declare user_uid: number;

// Legacy/Asterisk таблицы (колонка vpbx_user_uid в БД) — field маппинг:
@Column({ type: DataType.INTEGER, defaultValue: 0, field: 'vpbx_user_uid' })
declare user_uid: number;  // TS-свойство ВСЕГДА user_uid
```

#### 2. Контроллер
```typescript
@Get()
findAll(@Req() req) {
  // ВСЕГДА извлекаем из JWT одинаково:
  return this.service.findAll(req.user.vpbx_user_uid);
}

// ❌ ЗАПРЕЩЕНО — fallback chains:
// const userUid = req.user?.vpbx_user_uid || req.user?.user_uid || 0;
```

#### 3. Сервис
```typescript
async findAll(userUid: number) {
  return this.model.findAll({ where: { user_uid: userUid } });
}

async create(dto: CreateDto, userUid: number) {
  return this.model.create({ ...dto, user_uid: userUid });
}

async update(uid: number, dto: UpdateDto, userUid: number) {
  const entity = await this.model.findOne({ where: { uid, user_uid: userUid } });
  if (!entity) throw new NotFoundException();
  // КРИТИЧНО: запретить подмену тенанта через DTO
  delete dto.user_uid;
  return entity.update(dto);
}

async remove(uid: number, userUid: number) {
  const deleted = await this.model.destroy({ where: { uid, user_uid: userUid } });
  if (!deleted) throw new NotFoundException();
}
```

#### 4. Миграции (новые таблицы)
```sql
CREATE TABLE new_module (
  uid INT AUTO_INCREMENT PRIMARY KEY,
  -- ... бизнес-поля ...
  user_uid INT NOT NULL DEFAULT 0,    -- ОБЯЗАТЕЛЬНО
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_uid (user_uid)       -- ОБЯЗАТЕЛЬНО для производительности
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### Правила для Frontend

- Frontend **не хранит и не передаёт** `user_uid` / `vpbx_user_uid` в запросах.
- Тенантность обеспечивается **исключительно** JWT-токеном на бэкенде.
- RTK Query запросы **не содержат** параметров тенантности — бэкенд извлекает их из токена.

### Чек-лист для нового модуля

- [ ] Модель: `declare user_uid: number` с `@Column`
- [ ] Миграция: `user_uid INT NOT NULL DEFAULT 0` + `INDEX`
- [ ] Контроллер: `req.user.vpbx_user_uid` в каждом методе
- [ ] Сервис: `where: { user_uid: userUid }` во всех запросах
- [ ] Сервис: `delete dto.user_uid` в методах `update`/`create`
- [ ] Тест: проверка что данные другого тенанта недоступны

---


## Фазы разработки

### ✅ Phase 1: Foundation (DONE)
- [x] Monorepo scaffold (npm workspaces)
- [x] Shared package (types, enums)
- [x] Backend: NestJS + Auth + Users + Peers + AMI
- [x] Frontend: Vite + React 19 + Tailwind 4 + shadcn/ui
- [x] RTK Query API layer
- [x] i18n (ru/en)
- [x] Login page (aiPBX design)
- [x] Dashboard page (stats cards + panels)
- [x] App layout (Sidebar + Header)

### ✅ Phase 2: Core Modules (DONE)
- [x] **Users UI** — Управление пользователями, CRUD, назначение ролей и прав
- [x] **Roles module** — Роли и уровни доступа, матрица прав
- [x] **Numbers module** — Управление номерами (DID)
- [x] **Peers UI** — TanStack Table, CRUD forms, bulk actions
- [x] **Trunks module** — Backend + Frontend (CRUD)
- [x] **Routes module** — Inbound/Outbound routing rules
- [x] **Contexts module** — Контексты диалплана
- [ ] **Peers live status** — AMI PeerStatus → WebSocket → UI badges
- [ ] **Queues module** — Queue config + member management

### 🔲 Phase 3: AI PBX & Voice Modules
- [x] **IVR Management** — Визуальный редактор, иерархия меню (DTMF)
- [x] **Prompts Management** — Загрузка аудио, запись по телефону, стримминг
- [x] **TTS Engines** — Интеграция OmniVoice, Google, Yandex
- [x] **STT Engines** — Распознавание речи
- [ ] **Operator Panel** — Real-time call dashboard, spy/whisper
- [ ] **Supervisor Panel** — Agent monitoring, queue stats
- [ ] **Reports (CDR)** — Call log with filters, date range, export
- [ ] **ARI integration** — Call control (originate, transfer, park)

### 🔲 Phase 4: FSD Standardization & Advanced Features
- [ ] **FSD Slices & Testing** — Перенос всего стейта таблиц в Redux, 100% покрытие unit и интеграционными тестами
- [x] **Provisioning** — Auto-config for IP phones (Yealink, Snom)
- [ ] **Phonebook** — Contact management
- [ ] **Recordings** — Call recording playback + download
- [ ] **Backups** — DB backup/restore
- [ ] **Multi-tenant** — User hierarchy (vpbx_user_uid)

### 🔲 Phase 5: aiPBX Integration
- [ ] Merge Krasterisk modules into aiPBX monorepo
- [ ] Shared auth (JWT tokens compatible)
- [ ] Unified sidebar navigation
- [ ] Cross-linking between PBX management and AI features

---

## Порты и URL

| Сервис | Порт | URL |
|---|---|---|
| Backend API | 5010 | http://localhost:5010/api |
| Swagger Docs | 5010 | http://localhost:5010/api/docs |
| Frontend | 3010 | http://localhost:3010 |
| WebSocket (AMI) | 5010 | ws://localhost:5010/ami-events |

---

## Команды

```bash
# Из корня (monorepo)
npm run dev:backend      # NestJS dev server
npm run dev:frontend     # Vite dev server
npm run build            # Build all packages

# Из packages/backend/
npm run start:dev        # NestJS watch mode
npm run start:prod       # Production mode

# Из packages/frontend/
npm run dev              # Vite dev server :3010
npm run build            # Production build
```

---

## Переменные окружения (.env)

```env
# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=krasterisk
DB_PASSWORD=***
DB_NAME=krasterisk

# JWT
JWT_SECRET=your-secret
JWT_EXPIRES_IN=24h

# AMI
AMI_HOST=127.0.0.1
AMI_PORT=5038
AMI_LOGIN=krasterisk
AMI_SECRET=***

# ARI
ARI_HOST=127.0.0.1
ARI_PORT=8088
ARI_USER=krasterisk
ARI_PASSWORD=***

# Server
BACKEND_PORT=5010
FRONTEND_PORT=3010
```

## Архитектура UI Модуля Endpoints

В рамках Feature-Sliced Design (FSD) модуль управления абонентами (PJSIP Endpoints) спроектирован с учетом следующих UI-паттернов:

### 1. Dynamic Form Builder (Advanced Settings)
Модальное окно редактирования абонента разделено на базовые вкладки (Основные, Сеть, Группы). Для редких и нестандартных параметров PJSIP (более 100 ключей) реализован `AdvancedSettingsBuilder`.
- Пользователь динамически выбирает ключ из селекта (группированного по категориям: media, timers и т.д).
- Ключ добавляется в стейт, и для него рендерится текстовое поле (Key-Value UI).
- Все ключи валидируются и упаковываются в один JS объект `advanced` для отправки на сервер. Это предотвращает создание сотен неиспользуемых полей в UI.

### 2. Client-Side Таблицы (`DataTable.tsx`)
Используется обобщенный UI-компонент на базе `TanStack Table` (v8).
- Пагинация, сортировка и "живой" фильтр работают на стороне клиента в браузере (Client-side), обеспечивая микросекундную задержку при поиске абонента по Extension/Name в масштабах до 10 000 строк.
- Для выгрузки данных `DataTable` экспонирует `useImperativeHandle(ref)`, позволяя внешнему родительскому компоненту (`EndpointsTable`) вызывать `tableRef.current?.exportCsv()`, а не навязывать жесткую верстку своих кнопок внутри таблицы.
- Колонка row-actions (edit/copy/delete): **только** `TableRowActions` + `TableRowAction` из `@/shared/ui` (см. MUST «Table row actions» выше).

### 3. Индикация Bulk-операций
Для отображения прогресса работы фоновых Bulk-Job бэкенда используется Long Polling. `EndpointsTable` вызывает сервис состояния `useGetBulkJobStatusQuery` через RTK-Query с флагом `pollingInterval: 1000`, и плавно отрисовывает ProgressBar поверх таблицы до тех пор, пока бэкенд не закончит обработку.

---

## Module Hub / ModuleShell / Platform (Phase 8, D-39)

Phase 8 replaces the legacy single-Sidebar IA with a **Module Hub** entry and an in-module **ModuleShell**.

### Surfaces

| Surface | Route / widget | Role |
|---------|----------------|------|
| **Module Hub** | `/modules` → `widgets/ModuleHub` | Dense list of active + marketplace modules (sketch **002-E**); favorites; open / buy |
| **ModuleShell** | wraps module pages | Full-height sidebar (desktop) + topbar breadcrumbs + ⌘K; phone: bottom bar + More sheet |
| **Platform console** | `/platform/*` outside `AppLayout` | SuperAdmin-only catalog / tenants / role→start (console-chrome, not tenant Hub) |
| **Tenant modules** | `/system/modules` | Tenant enable/disable + role→start overrides |

### Design-system rules (unchanged, applied to shell)

- Shell chrome uses SCSS modules + Stack/Text from `shared/ui` (no feature-level Tailwind `div` layouts).
- Command palette is `shared/ui/CommandPalette` built from Dialog + Input (**no `cmdk`**).
- Copy lives in `shared/config/locales/{ru,en}.ts` under `hub`, `marketplace`, `commandPalette`, `license`, `platform` — no em dash (`—`) in UI strings (NAV-14 / UI-SPEC Copywriting Contract).

### Capacitor Android foundation (NAV-10…13)

- Capacitor **8.x** under `packages/frontend` (`capacitor.config.ts`, `webDir=dist`). Native projects: `android/`, `ios/`.
- Auth tokens on native: `@aparajita/capacitor-secure-storage` via `features/auth/lib/tokenStorage` (web remains `localStorage`).
- URL flavors + optional Preferences override: `shared/lib/capacitor/envUrls`.
- Offline: banner + retry only (`offlineBanner`) — no action queue (D-35).
- FCM skeleton: `shared/lib/capacitor/push` → `POST /marketplace/device-token` (requires gitignored `google-services.json`).
- Softphone WebView constraints: `docs/ANDROID_WEBRTC_NOTES.md` (foreground-only D-36; `RECORD_AUDIO` + `MODIFY_AUDIO_SETTINGS`).

Node.js **22+** is required for Capacitor 8 CLI/sync.

---

*Last updated: 2026-08-17 (UserFormModal form-modal patterns)*
