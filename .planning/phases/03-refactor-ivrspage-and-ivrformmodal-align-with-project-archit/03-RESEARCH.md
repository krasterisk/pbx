# Phase 3: IVR UI alignment — Research

**Researched:** 2026-06-04  
**Phase:** 03-refactor-ivrspage-and-ivrformmodal-align-with-project-archit  
**Status:** Complete

## Objective

Brownfield refactor: align IVR page/modal with ARCHITECTURE.md (SCSS tokens), fix tab double-border and «Фразы» contrast — no API changes.

## Standard stack (confirmed)

| Layer | Choice | Notes |
|-------|--------|-------|
| Page | `IvrsPage` + SCSS module | Copy structure from `MohPage` post Phase 2 |
| Table | `DataTable` (TanStack) | Keep; drop duplicate Card shell |
| Modal | `Dialog` `size="large"` | Already used |
| Tabs | Local SCSS in `IvrFormModal.module.scss` | Match Route **visual**, not extract shared component |
| Tokens | `var(--color-*)` from `globals.css` @theme | Replace legacy `var(--border)` in IvrPromptsEditor |

## Current vs target

| Area | Today | Target |
|------|-------|--------|
| IvrsPage | Tailwind + motion + plain header | MohPage SCSS shell, no motion |
| IvrsTable | Own Card + count header | Fragment: bulk bar + DataTable / skeleton |
| IvrFormModal tabs | HStack `border-b` + Button `border-b-2` | SCSS tabs + underline indicator |
| IvrPromptsEditor | Legacy CSS vars, low contrast | `.sectionPanel` like Moh playlist |
| IvrMainTab | Active at bottom | Active panel first |

## Reference files

| Pattern | File |
|---------|------|
| Page shell | `MohPage.tsx`, `MohPage.module.scss` |
| Modal section panel | `MohFormModal.module.scss` → `.playlistBox` |
| Tab underline | `RouteFormModal.tsx` lines 201-219 (`-mb-[1px]` + absolute 2px bar) — reimplement in SCSS |
| Table skeleton (non-DataTable) | `MohTable.tsx` loading branch |

## DataTable loading strategy

`DataTable` has no `isLoading` prop. **Pattern:** when `isLoading`, render `VStack` of 5 `Skeleton` bars with `IvrsTable.module.scss` widths instead of mounting `DataTable`.

## Bulk selection UX

Selection state stays in `IvrsTable`. Toolbar:

```tsx
{selectedCount > 0 && (
  <HStack className={cls.bulkBar}>...</HStack>
)}
<DataTable ... />
```

Placed inside page `CardContent` after shell move.

## i18n changes (exact keys)

- `ivrs.tabs.sounds_prompts`: RU «Фразы», EN «Phrases»
- `ivrs.tabs.routes`: RU «Пункты», EN «Menu items»
- Add: `listTitle`, `empty.title`, `empty.hint`
- Fix: `ivrs.prompts.selectPrompt` — no em dash

## Risks

| Risk | Mitigation |
|------|------------|
| DataTable empty vs enhanced empty | Use `emptyText` multiline or custom empty component if DataTable supports; else `renderHeader` + zero rows styling |
| Regression IvrsTable.test | Run `npm run test:frontend` — update selectors only if copy changes |
| Modal tab keyboard | Keep native `button` elements in tab row for a11y |

## Plan split recommendation

| Plan | Wave | Focus |
|------|------|-------|
| 03-01 | 1 | i18n + IvrsPage + IvrsTable |
| 03-02 | 2 | IvrFormModal + MainTab + Prompts + MenuItems editors |

---

*Research complete — ready for 03-01/03-02 plans*
