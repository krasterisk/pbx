---
status: testing
phase: 03-refactor-ivrspage-and-ivrformmodal-align-with-project-archit
source: 03-01-SUMMARY.md, 03-02-SUMMARY.md, 03-UI-SPEC.md
started: 2026-06-04T18:32:00.000Z
updated: 2026-06-04T18:32:00.000Z
---

## Current Test

number: 1
name: IVR list page shell
expected: Open /ivrs — GitMerge badge, gradient title, muted subtitle, primary «Добавить IVR» (light text), Card «Список IVR» with table only (no duplicate header in table).
awaiting: user response

## Tests

### 1. IVR list page shell
expected: GitMerge badge, gradient h1, muted subtitle, light-text primary CTA, single Card with listTitle and table (no duplicate header in table)
result: [pending]

### 2. Open create modal
expected: Click «Добавить IVR» — large dialog opens, title «Создать IVR», three tabs Основные / Фразы / Пункты
result: [pending]

### 3. Modal tab underline
expected: One gray line under the tab row; active tab has a 2px primary (indigo) underline overlapping that line — not a double stripe
result: [pending]

### 4. Main tab — Active first
expected: On «Основные», «Активно» is the first block in a highlighted panel (border + light primary tint), then name/exten/timeout fields
result: [pending]

### 5. Phrases tab — section panel
expected: On «Фразы», content sits in a bordered muted panel; empty state or phrase rows are readable on light theme; add row uses Select + Add button
result: [pending]

### 6. Menu items tab — section panel
expected: On «Пункты», bordered panel with title and «Добавить пункт»; items expand for dialplan actions
result: [pending]

### 7. Create and save IVR
expected: Fill name + exten on Основные, Save — modal closes, new row appears in table (or list refreshes)
result: [pending]

### 8. Edit and copy actions
expected: Row actions: edit opens modal with data; copy opens modal with cleared name/exten but copied options
result: [pending]

### 9. Technical — build and unit tests
expected: npm run build -w @krasterisk/frontend passes; IvrsTable.test passes
result: [pending]

## Summary

total: 9
passed: 0
issues: 0
pending: 9
skipped: 0
blocked: 0

## Gaps

[none yet]
