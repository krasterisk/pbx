---
sketch: 003
name: in-module-shell
question: "How should navigation feel inside a module — dense sidebar, top tabs, or compact rail — with header context + ⌘K?"
winner: A+C
tags: [shell, phase-8, navigation, in-module]
phase: 08
---

# Sketch 003: In-module shell

## Design Question

После входа из Hub (winner **002-E** minimal list) — как выглядит chrome **внутри** модуля: dense nav, sparse tabs, или compact rail?

## How to View

`.planning/sketches/003-in-module-shell/index.html`

## Variants (original)

- **A: Dense sidebar** — Classic left nav; full height; collapse to icons.
- **B: Top tabs** — Horizontal tabs under header; more content width.
- **C: Compact icon rail** — Narrow rail + labels on expand; density between A and B.

## Winner (2026-07-17) — **A+C hybrid**

Full-height sidebar (A) with collapse to icon rail (C). Sidebar footer: module switcher + collapse. Top chrome: breadcrumbs `Главная → Раздел → Подраздел` (not a module select). Mobile: sidebar auto-collapsed.

Supersedes earlier lock of **B** (top tabs, 2026-07-16).

## Mapping to React

| Element | Target |
|---------|--------|
| Shell layout | `widgets/ModuleShell` + `AppLayout` |
| Nav | Sidebar from registry (`navVariant: 'sidebar'`) |
| Breadcrumbs | Topbar `ModuleBreadcrumbs` |
| Modules / collapse | Sidebar footer |
| ⌘K | Command palette (modules + pages) |
