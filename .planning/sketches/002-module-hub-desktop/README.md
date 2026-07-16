---
sketch: 002
name: module-hub-desktop
question: "Which Module Hub visual language (bento + dock + Locked) should Phase 8 ship?"
winner: null
tags: [hub, phase-8, navigation, marketplace, desktop]
phase: 08
---

# Sketch 002: Module Hub desktop

## Design Question

Какой визуальный язык **Module Hub** (full-screen route) даёт wow, масштабируется под marketplace и остаётся узнаваемым Krasterisk?

## How to View

Open in browser:

`.planning/sketches/002-module-hub-desktop/index.html`

## Variants

- **A: Safe — Glass bento** — Continuity with sketch 001: glass tiles, indigo accents, calm grid + dock.
- **B: Bold — Cinematic stage** — Atmospheric gradient stage, staggered large tiles, stronger Locked ghost treatment.
- **C: Bold — OS launcher** — App-launcher density, prominent bottom dock, Marketplace as sticky rail card.

## What to Look For

- Wow vs daily-driver fatigue
- Ghost Locked / Call Center / Analytics / AI readability
- Dock (Recent + Favorites) usefulness without clutter
- Fit with dark indigo tokens from 001
- Room for «Обзор» as cross-cutting tile

## Mapping to React (post-winner)

| Element | Target |
|---------|--------|
| Hub route | new Module Hub page under `pages/` or `widgets/ModuleHub` |
| Module cards | registry-driven cards (`licenseStatus`) |
| Dock | recent/favorites prefs |
| Tokens | evolve `shared` / ARCHITECTURE if winner is B/C bold |
