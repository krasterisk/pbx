---
phase: 07-call-center-overhaul-professional-agent-supervisor-workspace
plan: 02
subsystem: ui
tags: [react-router, redux, i18n, sidebar, role-gate, callcenter]

requires:
  - phase: 07-call-center-overhaul-professional-agent-supervisor-workspace
    provides: CallCenterAgentPage and CallCenterSupervisorPage mounted at legacy paths
provides:
  - /callcenter/* route namespace with legacy /operator and /supervisor redirects (D-37)
  - RequireRole client-side gate for supervisor/wallboard/reports/settings routes (D-38)
  - buildNavigation role-filtered Sidebar Колл-центр group (D-38/D-39)
  - CallCenterSettingsPage five-tab shell at /callcenter/settings (D-40)
affects:
  - 07-05 operator settings tab
  - 07-06 / 07-11 card templates tab
  - 07-10 / 07-13 display tokens + wallboard route
  - 07-12 reports route
  - 07-08 / 07-09 agent/supervisor workspace enhancements

tech-stack:
  added: []
  patterns:
    - "RequireRole: selectUserLevel set-membership gate with Navigate to / (defense-in-depth only)"
    - "buildNavigation(t, level): UserLevel enum set checks, never numeric level >= comparisons"
    - "CallCenterSettingsPage: local CcSettingsTabId state + primary underline tab bar"

key-files:
  created:
    - packages/frontend/src/app/router/RequireRole.tsx
    - packages/frontend/src/widgets/Sidebar/lib/buildNavigation.ts
    - packages/frontend/src/pages/CallCenterSettingsPage/CallCenterSettingsPage.tsx
    - packages/frontend/src/pages/CallCenterSettingsPage/CallCenterSettingsPage.module.scss
    - packages/frontend/src/pages/CallCenterSettingsPage/index.ts
  modified:
    - packages/frontend/src/app/router/router.tsx
    - packages/frontend/src/widgets/Sidebar/Sidebar.tsx
    - packages/frontend/src/shared/config/locales/ru.ts
    - packages/frontend/src/shared/config/locales/en.ts

key-decisions:
  - "UserLevel set membership (OPERATOR/SUPERVISOR/ADMIN) instead of numeric comparisons due to enum inversion (ADMIN=1 highest)"
  - "/callcenter/agent intentionally unguarded so supervisors/admins can work as operators (D-39)"
  - "service-requests nav item stays ungated; CC divider omitted for READONLY/undefined levels"

patterns-established:
  - "Pattern: CC nav/routes use explicit UserLevel allow lists; server JwtAuthGuard remains authoritative"
  - "Pattern: settings tabs are placeholder shells filled by downstream plans 07-05 through 07-11"

requirements-completed: [D-37, D-38, D-39, D-40]

duration: 18min
completed: 2026-07-15
---

# Phase 07 Plan 02: CC namespace, role nav, settings shell Summary

**/callcenter/* routes with legacy redirects, RequireRole guards, role-filtered Sidebar, and five-tab settings shell**

## Performance

- **Duration:** 18 min
- **Started:** 2026-07-15T15:28:00Z
- **Completed:** 2026-07-15T15:46:00Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- Migrated call center routes to `/callcenter/agent|supervisor|wallboard|reports|settings` with `<Navigate replace />` from `/operator` and `/supervisor` (D-37)
- Added `RequireRole` wrapping supervisor-tier and admin-only routes; agent route stays open for supervisor-as-operator (D-38/D-39)
- Rebuilt Sidebar navigation via `buildNavigation(t, level)` with Колл-центр items filtered by `UserLevel` set membership
- Created `CallCenterSettingsPage` with five localized tabs and placeholder panels (D-40)

## Task Commits

1. **Task 1: Migrate CC routes to /callcenter/* + legacy redirects + RequireRole guard** - `d4b912a` (feat)
2. **Task 2: /callcenter/settings tabbed page skeleton + i18n** - `8dc790b` (feat)
3. **Task 3: Role-based Sidebar navigation (from scratch) + supervisor-as-operator entry** - `059d464` (feat)

**Plan metadata:** `a609d3e` (docs: complete plan)

## Self-Check: PASSED

- FOUND: packages/frontend/src/app/router/RequireRole.tsx
- FOUND: packages/frontend/src/widgets/Sidebar/lib/buildNavigation.ts
- FOUND: packages/frontend/src/pages/CallCenterSettingsPage/CallCenterSettingsPage.tsx
- FOUND: .planning/phases/07-call-center-overhaul-professional-agent-supervisor-workspace/07-02-SUMMARY.md
- FOUND commits: d4b912a, 8dc790b, 059d464

## Files Created/Modified

- `packages/frontend/src/app/router/RequireRole.tsx` - Client-side role gate using `selectUserLevel`
- `packages/frontend/src/app/router/router.tsx` - Five `/callcenter/*` routes, legacy redirects, guarded elements
- `packages/frontend/src/pages/CallCenterSettingsPage/*` - Tabbed settings shell (placeholder tab bodies)
- `packages/frontend/src/widgets/Sidebar/lib/buildNavigation.ts` - Role-aware nav builder
- `packages/frontend/src/widgets/Sidebar/Sidebar.tsx` - Consumes `buildNavigation(t, level)`
- `packages/frontend/src/shared/config/locales/ru.ts` / `en.ts` - `nav.wallboard`, `nav.ccReports`, `nav.ccSettings`, `callcenter.settings.*`

## Decisions Made

- Used explicit `UserLevel.OPERATOR | SUPERVISOR | ADMIN` checks because lower enum values mean higher privilege (ADMIN=1)
- Kept `/service-requests` visible for all levels; CC divider only when user has CC role access
- Settings tab bodies render localized placeholder text until downstream plans wire CRUD

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Minimal CallCenterSettingsPage stub in Task 1**
- **Found during:** Task 1 (router imports CallCenterSettingsPage before Task 2 creates it)
- **Issue:** TypeScript would fail on missing page export when wiring `/callcenter/settings` route
- **Fix:** Added minimal stub export in Task 1; Task 2 replaced with full tabbed implementation
- **Files modified:** `CallCenterSettingsPage.tsx`, `index.ts`
- **Committed in:** `d4b912a` (Task 1), expanded in `8dc790b` (Task 2)

**2. [Minor ordering] Nav i18n keys committed with Task 2**
- **Found during:** Task 2 locale edits
- **Issue:** `nav.wallboard`, `nav.ccReports`, `nav.ccSettings` were added while editing locales for settings keys
- **Fix:** Keys present in both locales before Task 3; Task 3 verified without re-editing locales
- **Committed in:** `8dc790b`

---

**Total deviations:** 2 (1 blocking auto-fix, 1 minor ordering)
**Impact on plan:** No scope change; all acceptance criteria met.

## Known Stubs

| File | Location | Reason |
|------|----------|--------|
| `CallCenterSettingsPage.tsx` | Tab panel body | Intentional placeholder per D-40; filled by plans 07-05, 07-06, 07-10, 07-11 |
| `router.tsx` | `callcenter/wallboard`, `callcenter/reports` | PlaceholderPage until 07-12/07-13 |

## Issues Encountered

- Pre-existing `tsc --noEmit` failures in unrelated files (`CallGroupFormModal.test.tsx`, `NotificationIntegrationFormModal.tsx`, `RoutePhonebooksTab.tsx`); touched files lint clean
- `npm run lint` exits 0 with warnings only (none in new files)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Route shells and nav layer ready for 07-08/07-09 workspace UI, 07-12 reports, 07-13 wallboard
- Settings tab IDs (`cardTemplates`, `pauseReasons`, `alertThresholds`, `operatorSettings`, `displayTokens`) defined for downstream mount points

---
*Phase: 07-call-center-overhaul-professional-agent-supervisor-workspace*
*Completed: 2026-07-15*
