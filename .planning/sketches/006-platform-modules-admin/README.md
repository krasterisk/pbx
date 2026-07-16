---
sketch: 006
name: platform-modules-admin
question: "How should super-admin catalog vs tenant enable/purchase admin UIs differ?"
winner: null
tags: [admin, platform, phase-8, modules]
phase: 08
---

# Sketch 006: Platform Modules admin

## Design Question

Два мира админки модулей:
- **Super-admin (platform, вне тенанта):** catalog structure, item membership, defaults, что base vs marketplace.
- **Tenant admin:** enable/disable + покупка (005-B); без правки состава catalog.

Как развести UI, чтобы это было очевидно и не путало?

## How to View

`.planning/sketches/006-platform-modules-admin/index.html`

## Variants

- **A: Dual workspace tabs** — «Platform catalog» | «Tenant modules» as top-level admin tabs; different density/tools per role (role gate hides Platform for tenant).
- **B: Separate apps** — Platform console (`/platform/...`) vs tenant System → Modules; no shared chrome.
- **C: Single Modules page, role-adaptive** — One route; super-admin sees catalog editor + tenant preview; tenant sees only enable/buy list.

## What to Look For

- Clear mental model: who can edit composition vs who can buy
- Drag/reassign page→module (CONTEXT: membership editable)
- Role→start matrix entry point (light touch)
- Continuity with Hub E + Marketplace B

## Mapping to React (post-winner)

| Element | Target |
|---------|--------|
| Platform console | new routes / System vs platform shell |
| Catalog editor | backend module catalog API |
| Tenant Modules | System module page |
| Users/Roles/Numbers | research rework touchpoints |
