---
phase: 08-navigation-redesign-android-port-foundation
plan: 03
subsystem: frontend
tags: [frontend, hub, shell, navigation, ModuleHub, ModuleShell, 002-E, 003-B]

requires:
  - phase: 08-navigation-redesign-android-port-foundation
    provides: Wave 0a ModuleDef/LicenseStatus (08-01); hub-catalog RTK + licenseStatus (08-02); hub locale seeds (08-12)
provides:
  - "002-E Module Hub dense list at deep-linkable /modules (Active + Marketplace)"
  - "useHubModules merge of BASELINE_MODULES + hub-catalog licenseStatus + favorites"
  - "003-B ModuleShell topbar + registry tabs replacing Sidebar primary nav"
  - "AiChatWidget remains global; wallboard route stays outside AppLayout"
affects:
  - 08-04 Command palette + deep-link fallbacks
  - 08-06 CheckoutSheet (Buy placeholder)
  - 08-07 Mobile bottom bar

tech-stack:
  added: []
  patterns:
    - "Hub sections: Active = active+disabled; Marketplace = locked only (never Buy for disabled)"
    - "Favorites via localStorage key krasterisk.hub.favorites (RESEARCH A4)"
    - "ModuleShell logo → /modules; Overview has chip context without product tabs (D-14)"

key-files:
  created:
    - packages/frontend/src/features/modules/lib/favorites.ts
    - packages/frontend/src/features/modules/hooks/useHubModules.ts
    - packages/frontend/src/features/modules/hooks/useRoleStartRedirect.ts
    - packages/frontend/src/widgets/ModuleHub/
    - packages/frontend/src/widgets/ModuleShell/
    - packages/frontend/src/pages/ModulesHubPage/
    - packages/frontend/src/app/layouts/AppLayout.module.scss
  modified:
    - packages/frontend/src/features/modules/lib/moduleRegistry.ts
    - packages/frontend/src/features/modules/lib/moduleRegistry.test.ts
    - packages/frontend/src/features/modules/types.ts
    - packages/frontend/src/app/layouts/AppLayout.tsx
    - packages/frontend/src/app/router/router.tsx
    - packages/frontend/src/pages/LoginPage/LoginPage.tsx
    - packages/frontend/src/shared/config/locales/en.ts
    - packages/frontend/src/shared/config/locales/ru.ts

key-decisions:
  - "UI-SPEC 002-E dense list supersedes D-05 bento/dock visuals for Hub"
  - "Locale path shared/config/locales (not plan typo i18n/locales)"
  - "Buy CTA is toast placeholder until 08-06 CheckoutSheet"
  - "Sidebar/Header files kept on disk but demoted from AppLayout primary chrome"

patterns-established:
  - "useHubModules is the Hub data seam for Active/Marketplace + favorites"
  - "findModuleByPath + filterPagesByLevel drive ModuleShell tabs"
  - "ROLE_START_PENDING_KEY session flag + useRoleStartRedirect for one-shot D-16"

requirements-completed: [NAV-01, NAV-02, NAV-03, NAV-15]

duration: 20min
completed: 2026-07-16
---

# Phase 8 Plan 03: Module Hub + ModuleShell Summary

**Shipped sketch winners 002-E Hub dense list at `/modules` and 003-B ModuleShell tabs, demoting flat Sidebar while keeping AiChat global and wallboard outside the shell**

## Performance

- **Duration:** 20 min
- **Started:** 2026-07-16T16:51:26Z
- **Completed:** 2026-07-16T17:01:00Z
- **Tasks:** 3
- **Files modified:** 26

## Accomplishments

- Wired `BASELINE_MODULES` + RTK hub-catalog `licenseStatus` into `useHubModules` with favorites sorting Active and locked-only Marketplace
- Built ModuleHub 002-E (icon badge, pills, star, Open/Buy) on deep-linkable `/modules` with stagger that respects `prefers-reduced-motion`
- Replaced AppLayout Sidebar/Header primary path with ModuleShell (logo→Hub, module chip, tabs); role→start redirect after login; AiChatWidget + wallboard invariants preserved

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire moduleRegistry + favorites + license merge** - `e7a140e` (feat)
2. **Task 2: ModuleHub widget route 002-E** - `298a4d6` (feat)
3. **Task 3: ModuleShell topbar + tabs; retire Sidebar primary** - `f0a8f08` (feat)

**Plan metadata:** `99a87fd` (docs: complete plan)

## Files Created/Modified

- `features/modules/lib/favorites.ts` — localStorage favorites helpers
- `features/modules/hooks/useHubModules.ts` — Active/Marketplace merge hook
- `features/modules/hooks/useRoleStartRedirect.ts` — one-shot post-login role→start
- `features/modules/lib/moduleRegistry.ts` — catalog merge, hub sections, findModuleByPath
- `widgets/ModuleHub/` — 002-E dense list UI + tests
- `widgets/ModuleShell/` — 003-B topbar + tabs + tests
- `pages/ModulesHubPage/` — Hub route page
- `app/layouts/AppLayout.tsx` — ModuleShell + Outlet + AiChatWidget
- `app/router/router.tsx` — `/modules` child route; wallboard sibling unchanged
- `pages/LoginPage/LoginPage.tsx` — navigate via resolveRoleStart + pending flag
- `shared/config/locales/{en,ru}.ts` — Hub section/favorite/title copy

## Decisions Made

- Hub visual is 002-E list (UI-SPEC supersedes D-05 bento/dock)
- Overview remains chip/index only — no fabricated Overview product tabs (D-14)
- Marketplace Buy is placeholder toast until plan 08-06
- Sidebar widget retained unused for possible dense-module exception later (D-03)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Guard matchMedia in Hub motion hook for vitest**
- **Found during:** Task 2
- **Issue:** `window.matchMedia` missing in jsdom broke ModuleHub tests
- **Fix:** Guard `typeof window.matchMedia !== 'function'`
- **Files modified:** `widgets/ModuleHub/ModuleHub.tsx`
- **Committed in:** `298a4d6`

**2. [Rule 1 - Bug] Restored unrelated callGroups locale WIP after locale isolation**
- **Found during:** Task 2 commit prep
- **Issue:** Checking out clean locales to stage only Hub keys temporarily removed uncommitted callGroups Desc strings
- **Fix:** Re-applied callGroups Desc keys from backup into working tree (not committed with 08-03)
- **Files modified:** `shared/config/locales/en.ts`, `ru.ts` (WIP only)
- **Committed in:** n/a (working-tree restore)

---

**Total deviations:** 2 auto-fixed (1× Rule 3, 1× Rule 1)
**Impact on plan:** Correctness-only; no scope creep.

## Issues Encountered

None blocking. Locale path typo in plan (`i18n/locales`) resolved by using existing `shared/config/locales` (same as 08-12).

## User Setup Required

None.

## Known Stubs

| File | Line / area | Stub | Reason |
|------|-------------|------|--------|
| `ModuleHubMarketplaceCard.tsx` | Buy CTA | toast placeholder | CheckoutSheet in 08-06 |
| `ModuleShell.tsx` | ⌘K trigger | toast with placeholder copy | CommandPalette Dialog in 08-04 |

## Next Phase Readiness

- Ready for 08-04 (Command palette + deep-link locked/disabled fallbacks)
- Buy CTA ready to swap to CheckoutSheet in 08-06
- Mobile bottom bar (08-07) can reuse Hub list + shell chip model

## Self-Check: PASSED

- FOUND: `packages/frontend/src/widgets/ModuleHub/ModuleHub.tsx`
- FOUND: `packages/frontend/src/widgets/ModuleShell/ModuleShell.tsx`
- FOUND: `packages/frontend/src/pages/ModulesHubPage/ModulesHubPage.tsx`
- FOUND: `e7a140e`, `298a4d6`, `f0a8f08` in git log
- FOUND: router `path: 'modules'` and wallboard sibling outside AppLayout
- FOUND: AppLayout mounts ModuleShell + AiChatWidget; no Sidebar import
