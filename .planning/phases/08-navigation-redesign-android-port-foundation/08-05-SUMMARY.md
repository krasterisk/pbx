---
phase: 08-navigation-redesign-android-port-foundation
plan: 05
subsystem: frontend
tags: [platform-admin, tenant-modules, PlatformLayout, NAV-06, D-21, D-22, 006-B]

requires:
  - phase: 08-navigation-redesign-android-port-foundation
    provides: Hub catalog + SuperAdmin membership APIs + role-start RTK (08-02); ModuleShell System tabs (08-03); /platform stub + D-41 redirects (08-04)
provides:
  - "PlatformLayout console-chrome outside AppLayout (006-B / D-21)"
  - "/platform/tenants|modules|role-start under RequireRole SUPERADMIN"
  - "PlatformCatalogEditor + PlatformRoleStartEditor wired to SuperAdmin Hub APIs"
  - "Tenant System→Modules enable/disable + Buy stub; no membership UI (D-22)"
  - "Legacy redirects: /superadmin→/platform, /marketplace→/modules, /my-modules→/system/modules"
affects:
  - 08-06 marketplace checkout (Buy CTA stub)
  - Hub seed path for tenant_modules (/system/modules)

tech-stack:
  added: []
  patterns:
    - "Platform console = separate route tree + PlatformLayout; never ModuleShell tabs for catalog"
    - "Tenant Modules = enable/disable + Buy only; membership replace only on /platform/modules"
    - "Destructive base demotion uses marketplace.removeFromBaseConfirm UI-SPEC copy"

key-files:
  created:
    - packages/frontend/src/app/layouts/PlatformLayout.tsx
    - packages/frontend/src/app/layouts/PlatformLayout.module.scss
    - packages/frontend/src/app/layouts/PlatformLayout.test.tsx
    - packages/frontend/src/pages/platform/PlatformTenantsPage.tsx
    - packages/frontend/src/pages/platform/PlatformModulesPage.tsx
    - packages/frontend/src/pages/platform/PlatformRoleStartPage.tsx
    - packages/frontend/src/features/platform-admin/ui/PlatformCatalogEditor.tsx
    - packages/frontend/src/features/platform-admin/ui/PlatformRoleStartEditor.tsx
    - packages/frontend/src/pages/SystemModulesPage/SystemModulesPage.tsx
    - packages/frontend/src/features/modules/ui/TenantModulesPanel/TenantModulesPanel.tsx
  modified:
    - packages/frontend/src/app/router/router.tsx
    - packages/frontend/src/shared/api/endpoints/cloudAdminApi.ts
    - packages/frontend/src/features/modules/lib/moduleRegistry.ts
    - packages/frontend/src/shared/config/locales/en.ts
    - packages/frontend/src/shared/config/locales/ru.ts

key-decisions:
  - "Platform routes live outside AppLayout with dedicated console-chrome (006-B)"
  - "Tenant Modules path is /system/modules under System module tabs; /my-modules redirects there"
  - "Marketplace browse remains /modules Hub; Buy stub toasts + navigates Hub until 08-06"
  - "Base Hub modules cannot be toggled off from tenant UI (Switch disabled for kind=base)"

patterns-established:
  - "features/platform-admin owns SuperAdmin catalog/membership/role-start editors"
  - "features/modules/ui/TenantModulesPanel owns tenant enablement surface only"

requirements-completed: [NAV-06]

duration: 11min
completed: 2026-07-16
---

# Phase 8 Plan 05: Platform vs Tenant Modules Admin Summary

**Separate `/platform/*` SuperAdmin console (catalog/membership/role→start) from tenant System→Modules enable/Buy, folding legacy SuperAdmin/Marketplace/MyModules URLs into the new IA (006-B)**

## Performance

- **Duration:** 11 min
- **Started:** 2026-07-16T17:18:00Z
- **Completed:** 2026-07-16T17:29:00Z
- **Tasks:** 3
- **Files modified:** 22

## Accomplishments

- Shipped `PlatformLayout` with warning-emphasis console-chrome and SUPERADMIN-gated `/platform/*` tree (tenants/modules/role-start)
- Platform catalog editor: reorder, base/market badges (`color-mix`), membership MultiSelect → `PUT .../pages`, destructive base→market confirm
- Tenant `SystemModulesPage` at `/system/modules` with enable/disable + Buy stub; no membership mutation UI; legacy redirects updated

## Task Commits

Each task was committed atomically:

1. **Task 1: PlatformLayout + /platform routes** - `5f4fa92` (feat)
2. **Task 2: Platform catalog + membership + role→start editors** - `b9e980d` (feat)
3. **Task 3: Tenant System→Modules page + fold Marketplace/MyModules** - `8dff692` (feat)

**Plan metadata:** _(see final docs commit)_

## Self-Check: PASSED

- FOUND: `PlatformLayout.tsx`, `SystemModulesPage.tsx`, `PlatformCatalogEditor.tsx`, `08-05-SUMMARY.md`
- FOUND commits: `5f4fa92`, `b9e980d`, `8dff692`

## Files Created/Modified

- `packages/frontend/src/app/layouts/PlatformLayout.tsx` — platform console shell + nav
- `packages/frontend/src/pages/platform/*` — tenants/modules/role-start pages
- `packages/frontend/src/features/platform-admin/*` — catalog + role-start editors + tests
- `packages/frontend/src/shared/api/endpoints/cloudAdminApi.ts` — platform Hub RTK endpoints
- `packages/frontend/src/pages/SystemModulesPage/` + `TenantModulesPanel` — tenant Modules UI
- `packages/frontend/src/features/modules/lib/moduleRegistry.ts` — System tab → `/system/modules`
- `packages/frontend/src/app/router/router.tsx` — platform tree + redirects
- `packages/frontend/src/shared/config/locales/{en,ru}.ts` — `platform.*` copy keys

## Decisions Made

- Kept platform and tenant Surfaces on separate layouts/route trees so tenant admins never see catalog tabs
- Buy CTA stubs to Hub (`/modules`) until checkout Sheet in 08-06
- Base modules are not disable-togglable from tenant UI (server still authoritative)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Platform Hub RTK CRUD endpoints**
- **Found during:** Task 2
- **Issue:** 08-02 exposed backend `/cloud-admin/hub-modules*` but frontend RTK only had tenant enable/disable + role-start
- **Fix:** Added `getPlatformHubModules`, create/update/reorder/replacePages/delete mutations
- **Files modified:** `cloudAdminApi.ts`
- **Verification:** platform-admin vitest suite green
- **Committed in:** `b9e980d`

**2. [Rule 2 - Correctness] Locale keys for platform chrome**
- **Found during:** Task 1/3
- **Issue:** Plan listed i18n under Task 2; PlatformLayout needed `platform.*` keys
- **Fix:** Added `platform` locale block (ru+en) including UI-SPEC destructive copy parity via `marketplace.removeFromBaseConfirm`
- **Files modified:** `shared/config/locales/en.ts`, `ru.ts`
- **Verification:** strings match UI-SPEC; tests use fallbacks
- **Committed in:** `8dff692`

---

**Total deviations:** 2 auto-fixed (Rule 2 ×2)
**Impact on plan:** Necessary for wiring SuperAdmin APIs and console i18n; no scope creep.

## Issues Encountered

None blocking. Locale working-tree had unrelated WIP; platform keys committed from HEAD base to avoid bundling unrelated call-group strings into this plan.

## User Setup Required

None

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| Buy CTA → toast + `/modules` | `TenantModulesPanel.tsx` | Checkout Sheet owned by 08-06 |
| Hub marketplace Buy still toast | `ModuleHubMarketplaceCard.tsx` (pre-existing) | Same 08-06 ownership |

## Threat Flags

None — `/platform` gated by `RequireRole SUPERADMIN` (T-08-08); tenant panel has no membership mutation UI (T-08-09); no new packages (T-08-SC).

## Next Phase Preview

08-06 — Marketplace checkout Sheet; replace Buy stubs with real purchase flow.
