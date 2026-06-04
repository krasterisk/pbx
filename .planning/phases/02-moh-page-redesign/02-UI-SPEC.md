---
phase: 02
slug: moh-page-redesign
status: approved
shadcn_initialized: true
preset: krasterisk-shared-ui
created: 2026-06-04
approved: 2026-06-04
sketch_winner: "001-A"
sources:
  - .planning/phases/02-moh-page-redesign/02-CONTEXT.md
  - .cursor/skills/sketch-findings-krasterisk-v4/references/moh-page-layout.md
  - packages/frontend/src/pages/VoiceRobotsPage/VoiceRobotsPage.tsx
---

# Phase 2 — UI Design Contract (MohPage redesign)

> Locks visual and interaction contracts before `/gsd-plan-phase 2`. Sketch **001 variant A** is authoritative.

---

## Scope

| In scope | Out of scope |
|----------|--------------|
| `MohPage.tsx` layout, header, CTA, card shell | Backend / `mohApi` changes |
| `MohTable.tsx` — table inside card; loading skeleton; empty row | Table search/filter UI |
| i18n `moh.*` (+ new `moh.listTitle`) | Full `MohFormModal` → Dialog migration |
| `MohFormModal` playlist action buttons only (D-14) | Hero band, page stats (sketch C) |
| Remove page-level `motion.div` y-translate | Drag-and-drop playlist |

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn (via `@/shared/ui`) |
| Preset | Project brownfield — match `VoiceRobotsPage` |
| Component library | Radix + CVA (existing) |
| Icon library | Lucide React (`Music`, `Plus`, `Pencil`, `Trash2`, `ChevronUp`, `ChevronDown`) |
| Font | Inter (project default) |
| Layout primitives | `VStack`, `HStack`, `Flex` from `@/shared/ui/Stack` — **no** layout `div` soup on page layer |
| Styling | Tailwind utility classes on shadcn primitives; table cell badges may keep `MohTable.module.scss` |

---

## Screen: `/moh` (MohPage)

### Visual hierarchy (focal points)

1. **Primary:** Page title block (gradient H1) — orients the user.
2. **Secondary:** Primary CTA «Создать класс» — main action.
3. **Tertiary:** Card section «Список классов MOH» + table content.

### Layout structure (locked — sketch A)

```
VStack gap={24} max className="flex-1"
├── Flex justify="between" align="center" className="px-2" [responsive: stack on sm]
│   ├── Flex align="center" gap="12"
│   │   ├── Flex icon badge: p-2.5 bg-indigo-500/10 rounded-xl
│   │   │   └── Music w-6 h-6 text-indigo-500
│   │   └── VStack
│   │       ├── Text variant="h1" gradient
│   │       └── Text variant="muted" mt-1
│   └── Button shadow-lg shadow-primary/20 + Plus icon
└── Card border-muted/50 shadow-sm backdrop-blur-xl bg-background/50
    ├── CardHeader border-b border-border/50 bg-muted/20 pb-4
    │   └── CardTitle text-base font-medium → moh.listTitle
    └── CardContent p-0
        └── MohTable (no outer Card)
```

**Reference implementation:** `packages/frontend/src/pages/VoiceRobotsPage/VoiceRobotsPage.tsx`

### Responsive

| Breakpoint | Header | CTA |
|------------|--------|-----|
| `< sm` | Icon + title stack; subtitle below | Full width, below title block |
| `≥ sm` | Single row, CTA right | Auto width |

Use `className="flex-col sm:flex-row gap-4"` on header row (NumbersPage pattern) or VoiceRobots `Flex justify="between"` with wrapping.

---

## Component inventory

| Component | Source | Usage |
|-----------|--------|-------|
| `VStack`, `Flex` | `@/shared/ui/Stack` | Page layout |
| `Text` | `@/shared/ui` | h1 + muted subtitle |
| `Button` | `@/shared/ui` | Create class CTA |
| `Card`, `CardHeader`, `CardTitle`, `CardContent` | `@/shared/ui` | Table shell |
| `Skeleton` | `@/shared/ui/Skeleton` | Loading state inside card body |
| `MohTable` | `@/features/moh` | TanStack table + modal host |
| `Music`, `Plus` | `lucide-react` | Header |

### MohTable constraints

- **Remove** wrapping `<Card>` from `MohTable` when page owns shell.
- Keep: column defs, `MohTable.module.scss` badges (`tracksBadge`, `sort_*`), action icon buttons in cells.
- **Loading:** 3–5 row-height `Skeleton` lines inside card body (not plain text).
- **Empty:** Single table row, centered `VStack`: `Music` 36px muted + copy (see Copywriting). No duplicate full-page empty unless planner adds CTA in row (optional FLAG).

### MohFormModal (partial)

| Control | Contract |
|---------|----------|
| Move up/down | `Button variant="outline" size="icon"` or `ghost` + `ChevronUp`/`ChevronDown`, `aria-label` from i18n |
| Remove track | `Button variant="ghost" size="icon"` + destructive tint on hover, `Trash2` |
| Add track | Keep `Button` + `Plus` (already shared); align spacing with playlist row |
| Modal shell | **Do not** migrate to `Dialog` this phase |

---

## Spacing Scale

Declared values (multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps in cells, action button gap |
| sm | 8px | Inline stacks in table cells |
| md | 16px | Card header padding horizontal |
| lg | 24px | **Page section gap** (`VStack gap="24"`) |
| xl | 32px | — |
| 2xl | 48px | — |

Exceptions: icon badge `p-2.5` (10px) — match VoiceRobots exactly.

---

## Typography

| Role | Size | Weight | Line Height | Tailwind / component |
|------|------|--------|-------------|----------------------|
| Display (page title) | 24px | 700 | 1.2 | `Text variant="h1"` + gradient classes |
| Section title | 16px | 500 | 1.4 | `CardTitle className="text-base font-medium"` |
| Body (table cells) | 14px | 400–500 | 1.5 | table / `.td` |
| Label (table headers) | 12px | 600 | 1.2 | `.th` uppercase |

**Max 4 sizes** — no additional display sizes this phase.

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#09090b` / `bg-background` | App canvas behind page |
| Secondary (30%) | `bg-background/50` + `border-muted/50` | Glass card, header muted text |
| Accent (10%) | `#6366f1` (indigo-500) | Icon badge bg tint, **not** entire UI |
| Primary CTA | `bg-primary` + `shadow-primary/20` | «Создать класс» only on page header |
| Destructive | theme `destructive` | Delete row action hover; modal remove track |

**Accent reserved for:**

- MOH header icon (`text-indigo-500`, `bg-indigo-500/10`)
- Primary page CTA shadow glow
- Track count pill (`tracksBadge` — existing primary tint)
- Focus rings on interactive controls (browser default + theme)

**Not accent:** table text, sort badges (keep purple/teal SCSS semantics), section header text (foreground).

---

## Motion

| Element | Behavior |
|---------|----------|
| Page wrapper | **No** `motion.div` with `y` translate (remove current MohPage) |
| Table mount | Optional `opacity` 0→1 over 200–300ms; **no** `y` offset |
| `prefers-reduced-motion: reduce` | Disable table fade |

---

## Copywriting Contract

| Element | RU | EN (i18n key) |
|---------|-----|----------------|
| Page title | Музыка на удержании | `moh.title` |
| Page subtitle | Управление классами Music On Hold | `moh.subtitle` |
| Primary CTA | **Создать класс** | `moh.add` |
| Section header | **Список классов MOH** | `moh.listTitle` (**new**) |
| Empty state heading | (inline in row) Нет классов Music On Hold | `moh.empty.title` (**new**) |
| Empty state body | Нажмите «Создать класс», чтобы добавить первый плейлист | `moh.empty.hint` (**new**) |
| Loading | (no copy — skeleton only) | — |
| Table: Name / Tracks / Sort / Actions | existing `moh.table.*`, `common.actions` | |
| Delete row confirm | Удалить класс «{{name}}»? | `moh.confirmDelete` |
| Destructive confirmation | `window.confirm` — keep existing pattern | |

**Modal (unchanged copy this phase):** `moh.edit`, `moh.add` titles; `common.cancel`; submit uses `common.save` — out of page contract scope.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official (project `shared/ui`) | Card, Button, Text, Skeleton | not required |
| Third-party | none | n/a |

---

## Implementation checklist (executor)

- [ ] Refactor `MohPage.tsx` to VoiceRobots header + card shell
- [ ] Move `Card` off `MohTable`; render table in `CardContent`
- [ ] Add `moh.listTitle`, `moh.empty.title`, `moh.empty.hint` in `ru.ts` + `en.ts`
- [ ] Replace loading text with `Skeleton` rows
- [ ] Remove `motion.div` y-animation from page
- [ ] Playlist buttons in `MohFormModal` → `Button` icon variants
- [ ] `npm run lint` + `npm run test:frontend`

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS — specific CTA, empty copy with next step
- [x] Dimension 2 Visuals: PASS — focal hierarchy declared
- [x] Dimension 3 Color: PASS — 60/30/10 + explicit accent list
- [x] Dimension 4 Typography: PASS — 4 sizes, 2 weights
- [x] Dimension 5 Spacing: PASS — 4px grid, exceptions noted
- [x] Dimension 6 Registry Safety: PASS — shared/ui only

**Approval:** approved 2026-06-04 (orchestrator self-check aligned with CONTEXT + sketch A)
