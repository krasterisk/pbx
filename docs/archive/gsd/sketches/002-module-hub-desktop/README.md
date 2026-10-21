---
sketch: 002
name: module-hub-desktop
question: "Which Module Hub visual language (bento + dock + Locked) should Phase 8 ship?"
winner: E
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

**Round 1 — dramatic:**
- **A: Safe — Glass bento** — Continuity with sketch 001: glass tiles, indigo accents, calm grid + dock.
- **B: Bold — Cinematic stage** — Atmospheric gradient stage, staggered large tiles, stronger Locked ghost treatment.
- **C: Bold — OS launcher** — App-launcher density, prominent bottom dock, Marketplace as sticky rail card.

**Round 2 — more directions:**
- **D: Command rail + filters** — Slim persistent left rail (All / Base / Marketplace / Recent+Favorites) filters the bento live; hybrid between Hub and persistent nav.
- **E: Minimal workspace list** — No card chrome; dense single-column rows (Linear/Notion switcher feel); dock replaced by inline row actions.
- **F: Orbit** — Modules arranged radially around a central "K" core; experimental high-wow take; degrades to grid on narrow viewports.

**Round 3 — synthesis:**
- **G: Synthesis — switchable view** — One Hub, one shared header/dock; a segmented control (Rail / List / Orbit) swaps the module-display layout in place, no page reload. Lets you compare D/E/F feel side-by-side without losing the same module set/state (favorites persist across views).

## What to Look For

- Wow vs daily-driver fatigue
- Ghost Locked / Call Center / Analytics / AI readability
- Dock (Recent + Favorites) usefulness without clutter
- Fit with dark indigo tokens from 001
- Room for «Обзор» as cross-cutting tile
- D: does live filtering help or add a layer of navigation to learn?
- E: is minimal list too plain for the "wow" goal, or refreshingly fast?
- F: is orbit delightful once, then annoying daily — or genuinely fun to keep?
- G: does offering a switchable view add value (personal preference / different tasks), or is it just complexity? Would one of Rail/List/Orbit alone be enough?

## Winner (2026-07-16)

**Variant E — Minimal workspace list.** Dense single-column rows without card chrome; dock de-emphasized (hidden in E). Fast daily switcher feel over cinematic wow. Synthesis G keeps List as one of three modes if product later wants user preference — but baseline Hub ship is E.

## Mapping to React (post-winner)

| Element | Target |
|---------|--------|
| Hub route | new Module Hub page under `pages/` or `widgets/ModuleHub` |
| Module cards | registry-driven cards (`licenseStatus`) |
| Dock | recent/favorites prefs |
| Tokens | evolve `shared` / ARCHITECTURE if winner is B/C bold |
