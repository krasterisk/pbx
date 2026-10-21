---
phase: 06-dialplan-apps-ring-groups-multi-channel-notifications-ux-ove
plan: 14
subsystem: ui
tags: [react, dialplan-apps, CallerIdApp, TrunkCarouselApp, registry, callerid, trunk-carousel, vitest, i18n]

requires:
  - phase: 06-10
    provides: phonebookApi RTK hooks for phonebook selects
  - phase: 06-13
    provides: dialplan registry pattern + GenericApp fallback established
provides:
  - CallerIdApp with 4 modes (static / phonebook / setclid_list / carousel RAND-only)
  - TrunkCarouselApp with ordered trunks + per-trunk CID + random_then_failover
  - registry callerid→CallerIdApp, trunk_carousel→TrunkCarouselApp; setclid_*→CallerIdApp
  - i18n routes.apps.callerid.* and routes.apps.trunkCarousel.* (ru+en)
affects: [phase-6 verify, route editor dialplan UX]

tech-stack:
  added: []
  patterns:
    - mode-driven dialplan app (Select mode → conditional fields + per-mode hint)
    - ordered list edit with up/down/remove mirrored from RoutePhonebooksTab
    - legacy action-type mode inference (setclid_custom→static, setclid_list→setclid_list)

key-files:
  created:
    - packages/frontend/src/features/dialplan-apps/ui/apps/CallerIdApp/CallerIdApp.tsx
    - packages/frontend/src/features/dialplan-apps/ui/apps/CallerIdApp/CallerIdApp.module.scss
    - packages/frontend/src/features/dialplan-apps/ui/apps/CallerIdApp/CallerIdApp.test.tsx
    - packages/frontend/src/features/dialplan-apps/ui/apps/TrunkCarouselApp/TrunkCarouselApp.tsx
    - packages/frontend/src/features/dialplan-apps/ui/apps/TrunkCarouselApp/TrunkCarouselApp.module.scss
    - packages/frontend/src/features/dialplan-apps/ui/apps/TrunkCarouselApp/TrunkCarouselApp.test.tsx
  modified:
    - packages/frontend/src/features/dialplan-apps/model/registry.ts
    - packages/frontend/src/shared/config/locales/en.ts
    - packages/frontend/src/shared/config/locales/ru.ts

key-decisions:
  - "CallerIdApp is a PURE CallerID modifier; carousel mode is random/rotation only — no re-dial/failover (failover lives in TrunkCarouselApp)"
  - "setclid_custom/setclid_list ids preserved; registry points both at CallerIdApp with mode inference for legacy records"
  - "trunk_carousel defaultParams.mode = random_then_failover with empty trunks array"

patterns-established:
  - "resolveCallerIdMode(actionType, params) for backward-compatible legacy setclid rendering"
  - "Dedicated dialplan apps + SCSS modules + InfoTooltip hints per D-16"

requirements-completed: [D-14, D-15, D-16, D-17, D-18]

duration: 9min
completed: 2026-07-15
---

# Phase 06 Plan 14: CallerIdApp + TrunkCarouselApp Summary

**Unified 4-mode CallerIdApp (CID-only; carousel RAND without failover) and separate TrunkCarouselApp wired into the dialplan registry with legacy setclid ids preserved**

## Performance

- **Duration:** 9 min
- **Started:** 2026-07-15T11:57:54Z
- **Completed:** 2026-07-15T12:07:08Z
- **Tasks:** 3/3
- **Files modified:** 9

## Accomplishments

- CallerIdApp offers mode Select (static | phonebook | setclid_list | carousel) with mode-specific fields and D-16 hints; carousel pool supports add/remove/reorder; **no** CID-level failover loop
- TrunkCarouselApp manages ordered trunks with per-trunk CID source (static | phonebook), timeout/options, and `mode: random_then_failover`
- Registry: `callerid` → CallerIdApp, `trunk_carousel` → TrunkCarouselApp; `setclid_custom` / `setclid_list` → CallerIdApp (ids + labelKeys kept); GenericApp fallback unchanged for all other apps (D-17/D-18)
- Integration tests green (11); i18n ru+en for both apps

## Task Commits

1. **Task 1: CallerIdApp (4 modes) + registry wiring** - `3b2c20e` (feat)
2. **Task 2: TrunkCarouselApp + registry wiring** - `d82fbef` (feat)
3. **Task 3: Integration tests** - `77e020e` (test)

**Plan metadata:** `fa71f4e` (docs: complete plan)

## Files Created/Modified

- `CallerIdApp.tsx` — 4-mode CallerID editor + `resolveCallerIdMode` for legacy setclid
- `TrunkCarouselApp.tsx` — ordered trunk list + per-trunk CID + failover hint
- `registry.ts` — callerid / trunk_carousel / setclid_* wiring
- `en.ts` / `ru.ts` — `routes.apps.callerid.*` and `routes.apps.trunkCarousel.*`
- `*.test.tsx` — Vitest coverage for mode fields, pool reorder, trunks onUpdate

## Decisions Made

- **SCOPE NOTE (D-14):** CallerIdApp carousel = `${CID_${RAND(1,N)}}` rotation only; failover exclusively in TrunkCarouselApp
- Legacy `setclid_*` remain valid ActionType ids pointing at CallerIdApp; new routes use `callerid`
- Per-mode / trunk-carousel hints document behavior so operators do not confuse CID rotation with Dial failover

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Aria-labels used i18n interpolation incompatible with Vitest mock**
- **Found during:** Task 3
- **Issue:** `t(key, 'Trunk {{n}}', { n })` returned literal `Trunk {{n}}` under the project’s `t(key, fallback)` mock, breaking `getByLabelText`
- **Fix:** Use non-interpolated aria-label fallbacks (`Trunk`, `CID source`, `Pool number`)
- **Files modified:** CallerIdApp.tsx, TrunkCarouselApp.tsx, en.ts, ru.ts
- **Committed in:** `77e020e`

## Requirements satisfaction (D-14..D-18)

| ID | Status | Evidence |
|----|--------|----------|
| D-14 | Satisfied | CallerIdApp consolidates modes; pure CID modifier; carousel random-only |
| D-15 | Satisfied | TrunkCarouselApp separate; random_then_failover + per-trunk CID |
| D-16 | Satisfied | Per-mode / app hints via Text + InfoTooltip |
| D-17 | Satisfied | Dedicated components for callerid + trunk_carousel |
| D-18 | Satisfied | setclid ids preserved; GenericApp still covers remaining types |

## Deferred (phase-wide, unchanged)

- **MCP/AI tools** for `call_group` / `notification_integrations` remain deferred per CONTEXT and ARCHITECTURE §6 Domain AI Adapter exception (same gap listed in 06-04 / 06-07 summaries). This plan does not close that gap.

## Self-Check: PASSED

- FOUND: `CallerIdApp.tsx`, `TrunkCarouselApp.tsx`, `registry.ts` CallerIdApp/TrunkCarouselApp entries
- FOUND commits: `3b2c20e`, `d82fbef`, `77e020e`
- VERIFY: `npx vitest run CallerIdApp TrunkCarouselApp` → 11 passed
