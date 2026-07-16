---
phase: 08-navigation-redesign-android-port-foundation
plan: 02
subsystem: backend
tags: [backend, catalog, billing-hooks, licenseStatus, role-start, Hub, SuperAdminGuard]

requires:
  - phase: 08-navigation-redesign-android-port-foundation
    provides: Wave 0a ModuleDef/LicenseStatus contracts (08-01); SuperAdminGuard Nyquist (08-13)
provides:
  - "hub_modules + hub_module_pages additive tables with D-15/D-19 seed membership"
  - "GET /marketplace/hub-catalog with server-computed licenseStatus (active|locked|disabled)"
  - "Platform SuperAdmin Hub CRUD + page membership replace (D-21)"
  - "Tenant JWT-bound hub enable/disable (D-22)"
  - "role_start_defaults + tenant_role_start + RoleStartService.resolveStart"
  - "RTK hooks: getHubCatalog, getMyHubModules, getRoleStart, platform/tenant role-start mutations"
affects:
  - 08-03 ModuleShell / Hub UI
  - 08-04 router role→start wiring
  - 08-05 platform admin console
  - 08-06 marketplace purchase

tech-stack:
  added: []
  patterns:
    - "Additive Hub tables over page-level MODULES_SEED (Pitfall 1 — no parallel marketplace)"
    - "licenseStatus computed server-side from tenant_modules + hub kind/requires_cloud; never from client"
    - "resolveStart: tenant override → platform default → D-16 hardcoded; CC-off → Overview"

key-files:
  created:
    - packages/backend/src/modules/cloud-admin/hub-modules.seed.ts
    - packages/backend/src/modules/cloud-admin/migrate-hub-modules-phase8.ts
    - packages/backend/src/modules/cloud-admin/models/hub-module.model.ts
    - packages/backend/src/modules/cloud-admin/models/hub-module-page.model.ts
    - packages/backend/src/modules/cloud-admin/models/role-start.model.ts
    - packages/backend/src/modules/cloud-admin/models/tenant-role-start.model.ts
    - packages/backend/src/modules/cloud-admin/hub-modules.controller.ts
    - packages/backend/src/modules/cloud-admin/role-start.service.ts
    - packages/backend/src/modules/cloud-admin/role-start.controller.ts
    - packages/backend/src/modules/cloud-admin/dto/hub-module.dto.ts
    - packages/backend/src/modules/cloud-admin/dto/role-start.dto.ts
    - packages/backend/src/modules/cloud-admin/migrate-hub-modules-phase8.spec.ts
    - packages/backend/src/modules/cloud-admin/modules-registry.service.spec.ts
    - packages/backend/src/modules/cloud-admin/hub-modules.controller.spec.ts
    - packages/backend/src/modules/cloud-admin/role-start.service.spec.ts
  modified:
    - packages/backend/src/modules/cloud-admin/modules-registry.service.ts
    - packages/backend/src/modules/cloud-admin/tenant-modules.controller.ts
    - packages/backend/src/modules/cloud-admin/cloud-admin.module.ts
    - packages/backend/src/app.module.ts
    - packages/frontend/src/shared/api/endpoints/cloudAdminApi.ts
    - packages/frontend/src/features/modules/lib/roleStartResolver.ts
    - packages/frontend/src/features/modules/lib/roleStartResolver.test.ts

key-decisions:
  - "Hub catalog is additive — modules_registry page codes retained for ModuleAccessGuard"
  - "Legacy page codes (service_requests, cdr, voice_robot) map into hub licenseStatus until tenants use hub codes"
  - "BOX: base + non-cloud market → active; requires_cloud market → locked"
  - "role_start tables created in same migrate-hub-modules-phase8 script as Hub tables"
  - "RTK getMyHubModules aliases hub-catalog for Hub Active wiring"

patterns-established:
  - "Platform Hub writes: JwtAuthGuard + SuperAdminGuard on /cloud-admin/hub-modules*"
  - "Tenant Hub/role-start writes bind tenant_id from JWT only"
  - "Frontend resolveRoleStart accepts apiPath with local D-16 offline fallback"

requirements-completed: [NAV-05, NAV-06, NAV-07]

duration: 25min
completed: 2026-07-16
---

# Phase 8 Plan 02: Hub Catalog + licenseStatus + Role→Start Summary

**Evolved cloud-admin into Hub modules with page membership, server-computed licenseStatus, SuperAdmin-only membership CRUD, and role→start defaults/overrides with RTK hooks**

## Performance

- **Duration:** 25 min
- **Started:** 2026-07-16T16:36:57Z
- **Completed:** 2026-07-16T16:48:00Z
- **Tasks:** 3
- **Files modified:** 22

## Accomplishments

- Additive `hub_modules` / `hub_module_pages` + idempotent seed (Core/Apps/System/Call Center/Analytics/AI + Overview; queues→Apps, service-requests→Call Center)
- `GET /marketplace/hub-catalog` returns `licenseStatus`; platform `/cloud-admin/hub-modules*` SuperAdmin-only; tenant enable/disable JWT-bound
- `role_start_defaults` + `tenant_role_start` with `RoleStartService.resolveStart`; RTK catalog/role-start hooks ready for shell wiring

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1: Hub modules schema + migration + seed**
   - `e08f7d9` (test) — failing seed contract
   - `2019a82` (feat) — models, migrate-hub-modules-phase8, module registration
2. **Task 2: licenseStatus APIs + platform Hub catalog CRUD**
   - `051172e` (test) — licenseStatus + SuperAdmin membership gate
   - `fad5867` (feat) — getHubCatalogForTenant, HubModulesController, tenant enable/disable
3. **Task 3: Role→start matrix API + RTK hooks**
   - `1d8eba8` (test) — RoleStartService resolve contract
   - `9014d40` (feat) — role-start models/service/controllers + cloudAdminApi + apiPath resolver

**Plan metadata:** (docs commit after SUMMARY)

## Files Created/Modified

- `hub-modules.seed.ts` / `migrate-hub-modules-phase8.ts` — baseline Hub + role_start tables
- `models/hub-module*.ts`, `models/role-start.model.ts` — Sequelize models
- `modules-registry.service.ts` — Hub catalog CRUD + licenseStatus
- `hub-modules.controller.ts` / `role-start.controller.ts` — platform + marketplace APIs
- `cloudAdminApi.ts` — getHubCatalog, getRoleStart, platform/tenant mutations
- `roleStartResolver.ts` — consumes `apiPath` with offline D-16 fallback

## Decisions Made

- Kept page-level `MODULES_SEED` intact; Hub membership maps hub_code→page_code for nav remap without breaking ModuleAccessGuard
- LicenseStatus for market hubs also checks legacy codes (`service_requests`, `cdr`, `voice_robot`) so existing activations surface correctly
- Role-start migration co-located with Hub migrate script (single Phase 8 cloud-admin migrate)

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- `npx jest --testPathPattern="modules-registry|hub-module|superadmin.guard|role-start|migrate-hub-modules"` — PASS
- `npx vitest run src/features/modules/lib/roleStartResolver.test.ts` — PASS (7)
- `tsc --noEmit` — pre-existing errors in unrelated specs only (call-groups/ivrs/keyword-matcher); no new errors in 08-02 files

## Known Stubs

None — purchase remains NotImplemented in 08-13 (owned by 08-06); activateModule still works for SuperAdmin.

## Self-Check: PASSED

- All key artifacts FOUND on disk
- All task commits FOUND: e08f7d9, 2019a82, 051172e, fad5867, 1d8eba8, 9014d40
