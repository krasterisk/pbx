---
phase: 03
slug: refactor-ivrspage-and-ivrformmodal-align-with-project-archit
status: approved
shadcn_initialized: true
preset: krasterisk-brownfield-scss
created: 2026-06-04
approved: 2026-06-04
sources:
  - .planning/phases/03-refactor-ivrspage-and-ivrformmodal-align-with-project-archit/03-CONTEXT.md
  - packages/frontend/src/pages/MohPage/MohPage.tsx
  - packages/frontend/src/features/routes/ui/RouteFormModal/RouteFormModal.tsx
---

# Phase 3 — UI Design Contract (IVR page & modal)

> Locks visual contracts before `/gsd-execute-phase 3`. No sketch — etalons **MohPage** (page) + **RouteFormModal** (tabs) + **MohFormModal** (section panel).

---

## Scope

| In scope | Out of scope |
|----------|--------------|
| `IvrsPage` + `IvrsPage.module.scss` | Backend / `ivrsApi` |
| `IvrsTable` — remove outer Card; loading skeleton; empty copy | `DataTable` component rewrite |
| `IvrFormModal` + `IvrFormModal.module.scss` — tabs, body, footer | Shared `ModalTabs` in `shared/ui` |
| `IvrMainTab` — Active first, prominent | RouteFormModal Tailwind cleanup |
| `IvrPromptsEditor` + `IvrMenuItemsEditor` section panels | Dialplan logic changes |
| i18n tab renames + `ivrs.listTitle` + `ivrs.empty.*` | |

---

## Design System

| Property | Value |
|----------|-------|
| Components | `@/shared/ui` (Dialog, Card, Button, Text, Stack, DataTable, Skeleton) |
| Icons | Lucide: `GitMerge`, `Plus`, `FileEdit`, `Copy`, `Trash2`, chevrons |
| Layout | `VStack`, `HStack`, `Flex` — no layout `div` on page/feature JSX |
| Styling | **SCSS modules** + `var(--color-*)`, `var(--radius-*)` on `pages/` and `features/` |
| Reference page | `MohPage.tsx` + `MohPage.module.scss` |
| Reference modal tabs | `RouteFormModal.tsx` visual (single border + 2px primary underline) implemented in SCSS |

---

## Screen: `/ivrs` (IvrsPage)

### Layout (locked — MohPage parity D-01)

```
VStack.page (gap 24, flex-1)
├── Flex.header — icon badge GitMerge + gradient h1 + muted subtitle
│   └── Button.createBtn — primary + shadow (SCSS)
└── Card.listCard
    ├── CardHeader — ivrs.listTitle
    └── CardContent p-0
        └── IvrsTable (no Card wrapper)
```

### IvrsTable inside card

| State | Contract |
|-------|----------|
| Loading | 5× `Skeleton` rows in `IvrsTable.module.scss` heights (no DataTable) |
| Data | `DataTable` with `selectable`, bulk delete toolbar **above** table when `selectedCount > 0` |
| Empty | Custom `emptyText` or `renderHeader` — use `ivrs.empty.title` + hint in enhanced empty (planner: pass composite message or slot) |
| Bulk bar | `HStack` destructive Button — was in old CardHeader; moves to toolbar row inside `CardContent` |

**Remove:** `IvrsTable` outer `Card`, `CardHeader` with count/GitMerge duplicate of page header.

**Keep:** row actions, modal host, selection, export.

### Motion

- **No** `motion.div` on `IvrsPage` (D-05).

### Responsive

- Header: `flex-wrap`, column on `max-width: 640px` in `IvrsPage.module.scss` (mirror MohPage).

---

## Modal: IvrFormModal (`Dialog` size `large`)

### Tab bar (D-06 — RouteFormModal pattern)

| Rule | Value |
|------|-------|
| Container | One `border-bottom: 1px solid var(--color-border)` on `.tabs` row |
| Active indicator | `::after` or child bar `height: 2px; background: var(--color-primary)` under label — **not** `border-b-2` on tab button |
| Tab control | `button.tab` / `button.tabActive` in SCSS (may wrap `Button variant="ghost"` stripped of borders) |
| Scroll | `overflow-x: auto` on tab row for narrow modals |

**Anti-pattern:** `border-b` on row **and** `border-b-2` on active tab.

### Body & footer (D-07)

| Zone | SCSS class | Padding |
|------|------------|---------|
| Body | `.body` | `20px 24px`, `overflow-y: auto`, `flex: 1` |
| Footer | `.footer` | `border-top: 1px solid var(--color-border)`, `pt-16px`, Cancel outline + Save primary |

### Tab labels (i18n D-08)

| Key | RU | EN |
|-----|----|----|
| `ivrs.tabs.main` | Основные | General |
| `ivrs.tabs.sounds_prompts` | **Фразы** | **Phrases** |
| `ivrs.tabs.routes` | **Пункты** | **Menu items** |
| `ivrs.listTitle` | Список IVR | IVR list |
| `ivrs.empty.title` | Нет голосовых меню | No IVR menus |
| `ivrs.empty.hint` | Нажмите «Добавить IVR», чтобы создать первое меню | Click "Add IVR" to create your first menu |
| `ivrs.prompts.selectPrompt` | Выберите запись | Select a recording |

No em dash in placeholders (D-09).

---

## Tab: Основные (IvrMainTab)

### Active switch (D-10)

- **First** block in tab: `.activePanel` — full width, `border: 1px solid var(--color-border)`, `background: color-mix(in srgb, var(--color-primary) 8%, transparent)` or muted panel, checkbox + label + tooltip.
- Typography: label `font-weight: 600`, `color: var(--color-foreground)`.

### Field order (after Active)

1. Name  
2. Exten  
3. Timeout  
4. Max count  
5. Direct dial (secondary checkbox row — same row style as today but SCSS tokens)

Remove Tailwind `border-border` classes → `IvrMainTab.module.scss` optional.

---

## Tab: Фразы (IvrPromptsEditor)

### Section panel (D-12 — MohFormModal `.playlistBox`)

```scss
.sectionPanel {
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-muted) 40%, transparent);
  padding: 0.75rem;
  min-height: 120px;
}
```

### Controls (D-13)

| Action | Component |
|--------|-----------|
| Move up/down | `Button variant="ghost" size="icon"` + ChevronUp/Down |
| Remove | `Button variant="ghost" size="icon"` + Trash2, hover destructive |
| Add | `Button` + Plus + label |
| Select | `Select` from `@/shared/ui` |

Migrate all `var(--border)` → `var(--color-border)` etc. (D-14).

---

## Tab: Пункты (IvrMenuItemsEditor)

- Wrap editor content in **same** `.sectionPanel` class (shared partial or duplicated SCSS compose).
- Keep `DialplanAppsEditor` behavior; style list rows with `var(--color-*)` (D-15, D-16).

---

## Spacing scale

| Token | px |
|-------|-----|
| Page gap | 24 |
| Field gap | 16 |
| Tab body padding | 20 / 24 |
| Section panel padding | 12 |

---

## Accessibility

- Tab buttons: `type="button"`, focus ring from shared Button or SCSS `:focus-visible`
- Icon buttons: `title` from i18n `common.*`
- Active checkbox: associated `Label` + `id`

---

## Verification (manual)

1. `/ivrs` — page matches Moh visual weight (badge, card, list title).  
2. Open modal — **one** line under tabs; active tab has primary underline only.  
3. Tab «Фразы» — panel visible on light theme; list items readable.  
4. Tab «Основные» — «Активно» is first and visually dominant.  
5. Create/edit/copy IVR still saves.

---

*Approved for planning — 2026-06-04*
