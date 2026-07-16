---
sketch: 003
name: in-module-shell
question: "How should navigation feel inside a module — dense sidebar, top tabs, or compact rail — with header chip + ⌘K?"
winner: null
tags: [shell, phase-8, navigation, in-module]
phase: 08
---

# Sketch 003: In-module shell

## Design Question

После входа из Hub (winner **002-E** minimal list) — как выглядит chrome **внутри** модуля: dense nav, sparse tabs, или compact rail — при общем header (logo→Hub, module chip, ⌘K)?

## How to View

`.planning/sketches/003-in-module-shell/index.html`

## Variants

- **A: Dense sidebar** — Classic left nav for PBX/System (many pages); collapse to icons.
- **B: Top tabs** — Horizontal tabs for sparse modules (e.g. Analytics); more content width.
- **C: Compact icon rail** — Narrow icon rail + labels on hover/expand; density between A and B.

All variants share: header with Krasterisk logo (→ Hub), **module chip** (opens mini switcher), **⌘K** palette (modules + pages).

## What to Look For

- Does dense sidebar still feel right after a minimal Hub?
- Tabs vs sidebar for 8+ PBX pages
- Chip + ⌘K discoverability without stealing focus from work
- Continuity with Hub E (minimal, fast, not cinematic)

## Mapping to React (post-winner)

| Element | Target |
|---------|--------|
| Shell layout | evolve `AppLayout` / new `ModuleShell` |
| Nav registry | per-module nav contributors (dense vs tabs) |
| Chip / ⌘K | header widgets + command palette |
