---
sketch: 004
name: module-hub-mobile
question: "How should Hub-first phone + tablet dual-pane feel with Hub E (list) and in-module tabs (003-B)?"
winner: B
tags: [mobile, phase-8, hub, shell]
phase: 08
---

# Sketch 004: Module Hub mobile

## Design Question

Adaptive shell: **phone = Hub-first** (list like 002-E) + chip→sheet + logo→Hub; **tablet ≈ dual-pane**. In-module pages use **top tabs** (003-B). What mobile composition feels right?

## How to View

`.planning/sketches/004-module-hub-mobile/index.html`  
Use toolbar Phone / Tablet / Desktop, or device width.

## Variants

- **A: Hub list + bottom sheet switcher** — Phone Hub as minimal list; enter module → tabs; chip opens sheet of modules.
- **B: Hub list + persistent bottom module bar** — 4–5 primary modules on bottom bar; Hub still list for full catalog.
- **C: Split tablet-first** — Phone same as A; tablet shows list Hub | module preview pane (dual-pane).

## What to Look For

- Thumb reach for chip / tabs / softphone sticky zone (reserved)
- Does bottom bar compete with Hub-first mental model?
- Tablet dual-pane usefulness for admin PBX work
- Continuity with winners 002-E + 003-B

## Winner (2026-07-16)

**Variant B — Hub list + bottom bar.** Phone Hub remains minimal list (002-E); primary modules also reachable via persistent bottom bar; chip/sheet still available inside a module. Dual-pane (C) not baseline.

## Mapping to React (post-winner)

| Element | Target |
|---------|--------|
| Phone Hub | Module Hub route, list layout |
| Sheet switcher | Sheet / Drawer from `shared/ui` |
| Tabs | Module shell (003-B) |
| Breakpoints | evolve `useIsMobile` + tablet band |
