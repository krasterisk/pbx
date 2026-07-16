---
phase: 08-navigation-redesign-android-port-foundation
plan: 01
subsystem: navigation
tags: [navigation, modules, UserLevel, SUPERADMIN, registry, roleStart, nyquist]

requires:
  - phase: 07-call-center-overhaul-professional-agent-supervisor-workspace
    provides: Call Center routes (/callcenter/*) used as role→start targets
provides:
  - "UserLevel.SUPERADMIN = 0 in @krasterisk/shared (parity with backend)"
  - "ModuleDef / ModulePageDef / LicenseStatus contracts"
  - "BASELINE_MODULES Hub→page mapping + level/license helpers"
  - "resolveRoleStart D-16 defaults + CC-off / locked deep-link fallback"
  - "Wave 0 GREEN unit tests for registry + roleStart (NAV-01/NAV-05)"
affects:
  - 08-02 Module Hub
  - 08-03 ModuleShell
  - 08-04 router / role→start wiring
  - platform RequireRole SUPERADMIN gates

tech-stack:
  added: []
  patterns:
    - "Typed ModuleDef registry replaces flat buildNavigation over time"
    - "mapTenantStatusToLicenseStatus: active|trial→active, inactive|off|expired→disabled, missing→locked"
    - "resolveRoleStart(level, { callCenterEnabled, lockedDeepLink })"

key-files:
  created:
    - packages/frontend/src/features/modules/types.ts
    - packages/frontend/src/features/modules/lib/moduleRegistry.ts
    - packages/frontend/src/features/modules/lib/moduleRegistry.test.ts
    - packages/frontend/src/features/modules/lib/licenseStatus.ts
    - packages/frontend/src/features/modules/lib/roleStartResolver.ts
    - packages/frontend/src/features/modules/lib/roleStartResolver.test.ts
  modified:
    - packages/shared/src/enums/index.ts
    - packages/frontend/src/entities/User/model/consts/userConsts.ts

key-decisions:
  - "Hub module code callcenter (not call-center) for consistency with RESEARCH Pattern 1"
  - "Service Requests mapped under callcenter module (D-19)"
  - "Wallboard TV path excluded from BASELINE_MODULES pages (D-18)"
  - "LEVEL_OPTIONS omits SUPERADMIN — platform-only (D-21); LEVEL_COLORS/I18N include it"
  - "CC-off and locked deep-link both fall back via resolveRoleStart to Overview or role-default"

patterns-established:
  - "features/modules/types.ts owns LicenseStatus + ModuleDef contracts"
  - "BASELINE_MODULES + filterPagesByLevel + partitionModulesByLicense as nav transform layer"

requirements-completed: [NAV-01, NAV-05, NAV-06]

duration: 7min
completed: 2026-07-16
---

# Phase 8 Plan 01: Wave 0a Module Contracts Summary

**Shared UserLevel.SUPERADMIN=0 plus typed ModuleDef registry, licenseStatus mapper, and resolveRoleStart with GREEN Wave 0 tests**

## Performance

- **Duration:** 7 min
- **Started:** 2026-07-16T16:05:42Z
- **Completed:** 2026-07-16T16:12:30Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Aligned `@krasterisk/shared` `UserLevel` with backend (`SUPERADMIN = 0`) and updated frontend level badge consts
- Landed `ModuleDef` / `ModulePageDef` / `LicenseStatus` contracts and `BASELINE_MODULES` from RESEARCH discretion mapping
- GREEN vitest coverage for registry membership, level filters, license partition, and D-16/D-17 role→start fallbacks (11 tests)

## Task Commits

Each task was committed atomically:

1. **Task 1: UserLevel.SUPERADMIN + module type contracts** - `7cdf1be` (feat)
2. **Task 2: Registry + roleStart Wave 0 unit tests (GREEN)** - `ec3e03d` (test)

**Plan metadata:** (pending docs commit)

## Files Created/Modified

- `packages/shared/src/enums/index.ts` — `UserLevel.SUPERADMIN = 0`
- `packages/frontend/src/entities/User/model/consts/userConsts.ts` — SUPERADMIN colors/i18n keys
- `packages/frontend/src/features/modules/types.ts` — LicenseStatus, ModulePageDef, ModuleDef
- `packages/frontend/src/features/modules/lib/moduleRegistry.ts` — BASELINE_MODULES + level/license helpers
- `packages/frontend/src/features/modules/lib/licenseStatus.ts` — mapTenantStatusToLicenseStatus
- `packages/frontend/src/features/modules/lib/roleStartResolver.ts` — resolveRoleStart (D-16/D-17)
- `packages/frontend/src/features/modules/lib/moduleRegistry.test.ts` — NAV-01 unit gate
- `packages/frontend/src/features/modules/lib/roleStartResolver.test.ts` — NAV-05 unit gate

## Decisions Made

- Module code `callcenter` (single token) used consistently in BASELINE_MODULES
- Tenant `LEVEL_OPTIONS` dropdown omits SUPERADMIN; badges still render it if present
- Trial tenant status maps to Hub `active`; expired maps to `disabled` (admin-off style) alongside inactive/off

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Full `tsc --noEmit` in frontend still reports pre-existing errors in unrelated files (call-groups tests, callcenter SSE test, endpoints form, routes tab). Out of scope; our new modules files typecheck clean via vitest transform.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Wave 0a contracts unblock parallel plans 08-12 (tokenStorage/palette/locale) and 08-13 (backend Nyquist stubs), and Hub/shell waves that consume BASELINE_MODULES + resolveRoleStart.

## Self-Check: PASSED

- All 8 key files FOUND on disk
- Commits `7cdf1be` and `ec3e03d` FOUND in git log
- Vitest: 2 files, 11 tests passed

---
*Phase: 08-navigation-redesign-android-port-foundation*
*Completed: 2026-07-16*
