# Phase 2: MohPage redesign — Research

**Researched:** 2026-06-04  
**Phase:** 02-moh-page-redesign  
**Status:** Complete

## Objective

What must the planner/executor know to implement sketch winner **A** without API changes?

## Standard Stack (confirmed)

| Layer | Choice | Notes |
|-------|--------|-------|
| UI | React 19 FSD | `pages/MohPage` orchestrates; `features/moh` owns table/modal |
| Layout | `VStack`, `Flex` from `@/shared/ui/Stack` | ARCHITECTURE forbids layout `div` on page |
| Components | shadcn via `@/shared/ui` | `Card`, `Button`, `Text`, `Skeleton` |
| Icons | lucide-react | `Music`, `Plus`, row actions unchanged |
| i18n | i18next | `packages/frontend/src/shared/config/locales/{ru,en}.ts` |
| Styling | Tailwind + existing `MohTable.module.scss` | Badges stay in SCSS per D-07 discretion |
| Motion | Remove page `motion.div`; optional opacity fade only | D-09/10 |

## Reference implementations

| Pattern | File | Apply to |
|---------|------|----------|
| Page header + glass card | `VoiceRobotsPage.tsx` | `MohPage.tsx` — copy structure, swap copy/keys |
| Table loading skeleton | `AuditLogTable.tsx` | `MohTable.tsx` — 5 skeleton rows in `<tbody>` |
| Row icon actions | `QueuesTable.tsx` | `MohFormModal` playlist `Button size="icon"` |
| Sketch contract | `02-UI-SPEC.md`, `sketch-findings-krasterisk-v4` | Locked visuals |

## Architecture decisions (implementation)

### MohPage owns Card shell (D-05)

- **Today:** `MohPage` → `motion.div` → `MohTable` → inner `Card`.
- **Target:** `MohPage` renders `Card`/`CardHeader`/`CardContent p-0`; `MohTable` returns fragment: loading skeleton OR `<table>` + `MohFormModal`.
- **Export:** No change to `features/moh` public API; only internal JSX.

### MohTable loading (D-11)

Replace:

```tsx
<Card><div className={cls.loading}>...</div></Card>
```

With skeleton rows inside existing `<table>` (columns: №, name, tracks, sort, actions) — no shadcn `Table` migration required this phase.

### MohTable empty (UI-SPEC)

Replace `common.noData` row with:

- `t('moh.empty.title')` + `t('moh.empty.hint')` in centered cell
- Keep `Music` icon 36px (existing `cls.emptyIcon`)

### MohFormModal (D-14)

Replace `.moveBtn`, `.removeBtn` raw buttons with:

```tsx
<Button variant="ghost" size="icon" type="button" ...>
```

`addBtn` already partially styled — align to `Button variant="default"` or `outline` with `Plus`.

**Do not** replace custom overlay/`cls.modal` with `Dialog`.

### i18n additions

```ts
moh: {
  listTitle: '...',
  empty: { title: '...', hint: '...' },
}
```

RU/EN per UI-SPEC copy table.

## Out of scope (do not research/implement)

- `mohApi`, backend modules
- Table filter UI, drag-and-drop playlist
- Full modal redesign, Dialog migration
- Hero band / stats (sketch C)

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Double Card if both page and table wrap | Remove `Card` from `MohTable` only |
| Regression on modal open | CTA still `dispatch(mohActions.openCreateModal())` |
| Visual drift from VoiceRobots | Use exact classNames from UI-SPEC / VoiceRobotsPage |
| SCSS module conflicts | Keep `MohTable.module.scss`; page uses Tailwind only |

## REQ traceability

| REQ | Research conclusion |
|-----|---------------------|
| REQ-101 | Satisfied — sketch 001 + wrap-up + skill exist |
| REQ-102 | User selected variant A — locked in UI-SPEC |
| REQ-103 | Implement MohPage + MohTable per reference files |
| REQ-104 | FSD + shared/ui only |
| REQ-105 | i18n keys + responsive header classes |
| REQ-106 | No backend file touches |

## Validation Architecture

| Property | Value |
|----------|-------|
| Framework | Vitest (frontend workspace) |
| Quick run | `npm run lint` |
| Full suite | `npm run test:frontend` |
| Manual | `/moh` — header, card, table, CTA, modal playlist buttons, 375px width |

**Automated per task:** lint after each commit; full frontend tests after wave complete.

**Manual-only:** Visual match to sketch A (glass card, indigo badge, shadow CTA).
