---
phase: 06-dialplan-apps-ring-groups-multi-channel-notifications-ux-ove
plan: 16
subsystem: ui
tags: [dialplan-apps, InfoTooltip, CallerIdApp, TrunkCarouselApp, gap-closure, D-16]

requires:
  - phase: 06-14
    provides: CallerIdApp + TrunkCarouselApp with MODE_HINT_KEYS / trunkCarousel.hint
provides:
  - Single-surface mode/app hints via InfoTooltip on labelRow (NotifyApp pattern)
  - Duplicate inline Text hint removed from CallerIdApp and TrunkCarouselApp
affects: [uat-phase-06, dialplan-apps-ux]

tech-stack:
  added: []
  patterns:
    - "NotifyApp labelRow + InfoTooltip only — no sibling Text with the same hint string"

key-files:
  created: []
  modified:
    - packages/frontend/src/features/dialplan-apps/ui/apps/CallerIdApp/CallerIdApp.tsx
    - packages/frontend/src/features/dialplan-apps/ui/apps/CallerIdApp/CallerIdApp.module.scss
    - packages/frontend/src/features/dialplan-apps/ui/apps/CallerIdApp/CallerIdApp.test.tsx
    - packages/frontend/src/features/dialplan-apps/ui/apps/TrunkCarouselApp/TrunkCarouselApp.tsx
    - packages/frontend/src/features/dialplan-apps/ui/apps/TrunkCarouselApp/TrunkCarouselApp.module.scss
    - packages/frontend/src/features/dialplan-apps/ui/apps/TrunkCarouselApp/TrunkCarouselApp.test.tsx

key-decisions:
  - "Prefer tooltip-on-label (NotifyApp) over dual Text+InfoTooltip for D-16 hints"
  - "Keep MODE_HINT_KEYS / MODE_HINT_FALLBACKS and trunkCarousel.hint content; change presentation only"

patterns-established:
  - "Dialplan app help: short label + InfoTooltip on .labelRow; never duplicate the same i18n string as visible Text"

requirements-completed: [D-16]

duration: 5min
completed: 2026-07-16
---

# Phase 06 Plan 16: Duplicate Hint Gap Closure Summary

**CallerIdApp and TrunkCarouselApp now show D-16 help once via InfoTooltip on a labelRow — matching NotifyApp and removing the dual Text+tooltip that wasted vertical space in UAT Tests 5–6**

## Performance

- **Duration:** 5 min
- **Started:** 2026-07-16T05:49:20Z
- **Completed:** 2026-07-16T05:54:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- CallerIdApp mode hint is InfoTooltip-only next to the "CallerID mode" label; MODE_HINT_KEYS content preserved
- TrunkCarouselApp app hint is InfoTooltip-only next to a "Trunks" label; routes.apps.trunkCarousel.hint preserved
- Vitest asserts each hint string appears exactly once (tooltip mock)

## Task Commits

Each task was committed atomically:

1. **Task 1: CallerIdApp — single mode hint via InfoTooltip on mode row** - `b9d09a3` (fix)
2. **Task 2: TrunkCarouselApp — single app hint via InfoTooltip on label row** - `c21ac79` (fix)

**Plan metadata:** `0bfc1d5` (docs: complete plan)

## Files Created/Modified

- `packages/frontend/src/features/dialplan-apps/ui/apps/CallerIdApp/CallerIdApp.tsx` - labelRow + InfoTooltip; removed dual Text hint
- `packages/frontend/src/features/dialplan-apps/ui/apps/CallerIdApp/CallerIdApp.module.scss` - .modeField / .labelRow; dropped .hint
- `packages/frontend/src/features/dialplan-apps/ui/apps/CallerIdApp/CallerIdApp.test.tsx` - single-surface hint assertion
- `packages/frontend/src/features/dialplan-apps/ui/apps/TrunkCarouselApp/TrunkCarouselApp.tsx` - labelRow + InfoTooltip; removed dual Text hint
- `packages/frontend/src/features/dialplan-apps/ui/apps/TrunkCarouselApp/TrunkCarouselApp.module.scss` - .labelRow; dropped .hint
- `packages/frontend/src/features/dialplan-apps/ui/apps/TrunkCarouselApp/TrunkCarouselApp.test.tsx` - single-surface hint assertion

## Decisions Made

- Followed NotifyApp pattern (tooltip on label) rather than keeping only inline Text — D-16 explanations stay reachable without eating vertical space
- Presentation-only change; i18n keys and fallbacks unchanged

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- UAT Tests 5–6 cosmetic gap closed; re-check CallerID / Trunk Carousel in dialplan editor
- Phase 06 gap_closure plan 16 complete; remaining Phase 06 work is re-UAT / verify as needed

## Self-Check: PASSED

- FOUND: CallerIdApp.tsx, TrunkCarouselApp.tsx, 06-16-SUMMARY.md
- FOUND: commits b9d09a3, c21ac79

---
*Phase: 06-dialplan-apps-ring-groups-multi-channel-notifications-ux-ove*
*Completed: 2026-07-16*
