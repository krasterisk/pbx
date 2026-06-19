---
phase: 03-refactor-ivrspage-and-ivrformmodal-align-with-project-archit
plan: 01
subsystem: ui
tags: [react, scss-modules, i18n, ivr]
requires: []
provides:
  - IvrsPage MohPage-parity shell with GitMerge badge and gradient title
  - IvrsTable without nested Card; Skeleton loading; enhanced empty state
  - ivrs i18n keys (listTitle, empty.*, tab labels Фразы/Пункты)
affects: [03-02 modal tabs use updated i18n]
tech-stack:
  added: []
  patterns: [MohPage shell SCSS; table bulk bar; Skeleton loading rows]
key-files:
  created:
    - packages/frontend/src/pages/IvrsPage/IvrsPage.module.scss
    - packages/frontend/src/features/ivrs/ui/IvrsTable/IvrsTable.module.scss
  modified:
    - packages/frontend/src/pages/IvrsPage/IvrsPage.tsx
    - packages/frontend/src/features/ivrs/ui/IvrsTable/IvrsTable.tsx
    - packages/frontend/src/shared/config/locales/ru.ts
    - packages/frontend/src/shared/config/locales/en.ts
key-decisions:
  - "GitMerge badge and MohPage layout for /ivrs list parity"
patterns-established:
  - "Page shell: SCSS module + Stack/Text/Button; no motion wrapper"
requirements-completed: [REQ-203, REQ-204, REQ-205]
completed: 2026-06-04
---

# Plan 03-01 Summary

**IVR list page and table aligned to MohPage: SCSS shell, Skeleton loading, i18n empty state and tab label prep**

## Accomplishments

- `IvrsPage`: MohPage-like header (GitMerge badge, gradient title, shadow CTA), glass Card + `ivrs.listTitle`; removed `motion.div`
- `IvrsTable`: removed outer Card; bulk selection bar; 5-row Skeleton while loading; `ivrs.empty.title` / `hint`; actions via `HStack` + `Button`
- i18n: `listTitle`, `empty.*`, tabs «Фразы»/«Пункты», `selectPrompt` without em dash; full `ivrs` block added to `en.ts`

## Verification

- `npm run build -w @krasterisk/frontend` — pass
- `vitest run IvrsTable.test` — 2 passed

## Deviations from Plan

None — plan executed as written.

## Issues Encountered

None.

---
*Phase: 03-refactor-ivrspage-and-ivrformmodal-align-with-project-archit*
*Completed: 2026-06-04*
