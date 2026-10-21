# Phase 8: Navigation redesign & Android port foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-16
**Phase:** 8-navigation-redesign-android-port-foundation
**Areas discussed:** Desktop nav shell, IA / module grouping, Mobile navigation, Android foundation, Platform/billing/DS extras

---

## Desktop nav shell

| Option | Description | Selected |
|--------|-------------|----------|
| Icon rail + secondary | VS Code / Linear dual rail | |
| Module switcher + list | Switcher then flat list | |
| Evolve sidebar | Collapse + favorites in current sidebar | |
| User vision | Module worlds + marketplace-scaling switcher | ✓ |

**User's choice:** Module system with wow switcher; enter module then in-module nav; marketplace must scale global navigator.
**Notes:** Hybrid Hub (full-screen) + quick switcher; in-module nav per type via registry; role-aware landing; bento+dock; chip+⌘K; ghost Locked; Hub route + overlay switcher; cinematic short motion; logo→Hub; recent+favorites.

---

## IA / module grouping

| Option | Description | Selected |
|--------|-------------|----------|
| PBX+Apps+System base | | |
| + Analytics base | | |
| Core+Apps+System; CC/Analytics/AI marketplace | Configurable | ✓ |
| Catalog API only | | |
| Catalog + full Modules admin UI | | ✓ |
| Dashboard in Core | | |
| Cross-cutting Overview | | ✓ |
| Mapping baseline #1 + research | | ✓ |
| Role matrix configurable max flex | | ✓ |
| Smart deep-link fallback | | ✓ |
| Wallboard: config in CC + TV outside shell | | ✓ |

**Notes:** Research must study Users/Roles/Numbers pages; item membership editable in admin.

---

## Mobile navigation

| Option | Description | Selected |
|--------|-------------|----------|
| Adaptive phone Hub-first / tablet dual-pane | | ✓ |
| Chip sheet + logo Hub | | ✓ |
| In-module hybrid by type | | ✓ |
| Full responsive pass all pages | | ✓ |
| CC agent stacked tabs + sticky softphone | | ✓ |
| Tables hybrid cards/scroll | | ✓ |

---

## Android foundation

| Option | Description | Selected |
|--------|-------------|----------|
| Capacitor | | ✓ |
| Scaffold + bridges + WebRTC validation | | ✓ |
| FCM foundation | | ✓ |
| Secure Storage for tokens | | ✓ |
| URL flavors + override | | ✓ |
| Offline banner+retry; document constraints | | ✓ |
| Background strategy after WebRTC research | | ✓ |
| iOS Capacitor structure only | | ✓ |

---

## Extra gray areas

| Topic | Decision |
|-------|----------|
| Super-admin | Platform operator outside tenant; creates/manages tenants; only they configure module catalog composition |
| Tenant admin | Enable/disable + purchase; no catalog structure edit |
| Billing | Real billing skeleton in Phase 8 |
| Sketch | 3 Hub/shell variants |
| Orphan nav items | Claude/research baseline; admin can reassign module |
| Design language | Shell refresh + bold Hub; FSD stays; update ARCHITECTURE if DS changes |
| AiChatWidget | Global all modules |
| Legacy redirects | Transition period only |

---

## Claude's Discretion

- Orphan route baseline mapping; queues/reports split; payment provider; background call after spike; Users/Roles/Numbers rework depth in waves.

## Deferred Ideas

- Play Store production release, full iOS QA, deep offline, Telecom ConnectionService, RN rewrite, payment hardening beyond skeleton
