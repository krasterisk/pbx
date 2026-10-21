# Phase 3 — UI Review

**Audited:** 2026-06-04  
**Baseline:** `03-UI-SPEC.md` (approved 2026-06-04)  
**Screenshots:** Not captured (code-only audit; dev server not exercised in this pass)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Tab renames and empty i18n match spec; em dash in tooltip; hardcoded placeholders |
| 2. Visuals | 3/4 | MohPage parity achieved; FSD `div` wrappers remain in editors/modal tabs |
| 3. Color | 4/4 | SCSS uses `var(--color-*)` / `color-mix`; section panels match contract |
| 4. Typography | 3/4 | Primary CTA uses button foreground; SCSS scale consistent in modules |
| 5. Spacing | 2/4 | Modal `.body` missing UI-SPEC padding `20px 24px` |
| 6. Experience Design | 3/4 | Skeleton, bulk bar, confirms present; save errors silent; empty `\n` not rendered |

**Overall: 18/24**

**Verdict:** **PASS with fixes** — shippable for verify-work; address spacing and empty-state rendering before closing phase.

---

## Top 3 Priority Fixes

1. **Modal body padding (UI-SPEC D-07)** — Tab content sits flush against dialog edges; users lose readable margins on «Фразы»/«Пункты». Add to `IvrFormModal.module.scss` `.body`: `padding: 20px 24px` (and keep `min-height: 0` / overflow).

2. **Table empty state is one line** — `IvrsTable` passes `emptyText` with `\n` between title and hint; `DataTable` renders plain text without `white-space: pre-line`, so hint is invisible on one line. Use composite empty slot (title + hint as two `Text` blocks) or SCSS `white-space: pre-line` on empty cell via `renderHeader` / custom empty renderer.

3. **Save failure has no UI feedback** — `IvrFormModal.onSubmit` only `console.error` on API failure (lines 87–88). Add toast or inline error per project pattern so users know save failed.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

| Severity | Finding |
|----------|---------|
| WARNING | `IvrMainTab.tsx:114` — tooltip fallback contains em dash `0 — без ограничений` (violates D-09 / ARCHITECTURE typography rule for UI strings). Replace with hyphen. |
| WARNING | Hardcoded placeholders without i18n: `IvrMainTab.tsx` `5000`, `10`, `3`; `IvrMenuItemsEditor.tsx:78` `Например: 1, 2, t, i`. |
| PASS | Tab labels: `ivrs.tabs.sounds_prompts` → «Фразы», `routes` → «Пункты»; `selectPrompt` without em dash. |
| PASS | Page: `listTitle`, `empty.title`, `empty.hint`, CTA `ivrs.add`. |

### Pillar 2: Visuals (3/4)

| Severity | Finding |
|----------|---------|
| WARNING | **FSD:** Native `<div>` used for layout wrappers: `IvrFormModal` tabs (`112–126`), `IvrPromptsEditor` `.sectionPanel`, `IvrMenuItemsEditor` cards, `IvrsTable` loading wrap. Prefer `Flex`/`VStack` with SCSS class, or document exception for panel shells. |
| WARNING | `IvrMenuItemsEditor` expand/collapse icon buttons lack `title` / `aria-label` (edit/delete icons on row actions in table do have `title`). |
| PASS | Page header: GitMerge badge, gradient title, glass card — MohPage parity. |
| PASS | Tab strip: single container border + 2px primary on active tab (`border-bottom-color`) — matches ARCHITECTURE tab pattern post-fix. |
| PASS | `.sectionPanel` on Phrases and Menu items — visible contrast on light theme. |
| PASS | «Активно» first in `.activePanel` with primary-tinted background. |

### Pillar 3: Color (4/4)

| Severity | Finding |
|----------|---------|
| PASS | No `hsl(var(--border))` or legacy token names in `features/ivrs`. |
| PASS | `.sectionPanel` uses `color-mix(in srgb, var(--color-muted) 40%, transparent)` per UI-SPEC D-12. |
| PASS | Primary accent limited to badge, active tab, active panel tint, hover borders — no accent flooding. |

### Pillar 4: Typography (3/4)

| Severity | Finding |
|----------|---------|
| PASS | `IvrsPage` create button: label inside `Button` (inherits `text-primary-foreground`) — aligned with VoiceRobotsPage. |
| WARNING | `IvrPromptsEditor` `.promptIndex` uses `0.7rem` — slightly off common `0.8125rem` / `text-sm` scale used elsewhere in module. |
| PASS | Active label `font-weight: 600` on `.activeLabel` per D-10. |

### Pillar 5: Spacing (2/4)

| Severity | Finding |
|----------|---------|
| **WARNING** | **UI-SPEC gap:** `.body` in `IvrFormModal.module.scss` has only `padding-right: 0.25rem`; contract requires `20px 24px` body padding (D-07). |
| PASS | Page `gap: 24` via `VStack`; `IvrMainTab` field gap `16` / `1rem`; section panel `padding: 0.75rem`. |
| PASS | `IvrsPage.module.scss` responsive header `max-width: 640px` column stack. |
| PASS | Tab row `margin-bottom: -1px` overlap with container border. |

### Pillar 6: Experience Design (3/4)

| Severity | Finding |
|----------|---------|
| **WARNING** | Save error path silent (`IvrFormModal.tsx:87–88`). |
| WARNING | Submit with empty name: early `return` with no user message (`IvrFormModal.tsx:65`). |
| PASS | Loading: 5× `Skeleton` in `IvrsTable`, not empty DataTable. |
| PASS | Bulk delete: toolbar + `confirm` + disabled state while `isDeleting`. |
| PASS | Row delete/copy/edit with `title` on icon buttons. |
| PASS | Phrases: reorder, remove, add with disabled add when no selection. |
| PASS | Menu items: expand/collapse, add empty state copy. |

---

## UI-SPEC Checklist (manual verification)

| # | Criterion | Code audit |
|---|-----------|------------|
| 1 | `/ivrs` Moh visual weight | PASS |
| 2 | Modal single tab line + primary underline | PASS (after tab SCSS fix) |
| 3 | «Фразы» panel readable on light theme | PASS |
| 4 | «Основные» — «Активно» first & dominant | PASS |
| 5 | Create/edit/copy saves | Not runtime-tested — verify in `/gsd-verify-work 3` |

---

## Registry Safety

Skipped — no third-party shadcn registries in `03-UI-SPEC.md`.

---

## Files Audited

- `packages/frontend/src/pages/IvrsPage/IvrsPage.tsx`
- `packages/frontend/src/pages/IvrsPage/IvrsPage.module.scss`
- `packages/frontend/src/features/ivrs/ui/IvrsTable/IvrsTable.tsx`
- `packages/frontend/src/features/ivrs/ui/IvrsTable/IvrsTable.module.scss`
- `packages/frontend/src/features/ivrs/ui/IvrFormModal/IvrFormModal.tsx`
- `packages/frontend/src/features/ivrs/ui/IvrFormModal/IvrFormModal.module.scss`
- `packages/frontend/src/features/ivrs/ui/IvrMainTab/IvrMainTab.tsx`
- `packages/frontend/src/features/ivrs/ui/IvrMainTab/IvrMainTab.module.scss`
- `packages/frontend/src/features/ivrs/ui/IvrPromptsEditor/IvrPromptsEditor.tsx`
- `packages/frontend/src/features/ivrs/ui/IvrPromptsEditor/IvrPromptsEditor.module.scss`
- `packages/frontend/src/features/ivrs/ui/IvrMenuItemsEditor/IvrMenuItemsEditor.tsx`
- `packages/frontend/src/features/ivrs/ui/IvrMenuItemsEditor/IvrMenuItemsEditor.module.scss`
- `packages/frontend/src/shared/config/locales/ru.ts` (ivrs namespace)
- `packages/frontend/src/shared/config/locales/en.ts` (ivrs namespace)

---

*Phase: 03-refactor-ivrspage-and-ivrformmodal-align-with-project-archit*
