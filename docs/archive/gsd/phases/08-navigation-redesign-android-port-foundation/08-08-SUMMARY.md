---
phase: 08-navigation-redesign-android-port-foundation
plan: 08
subsystem: frontend
tags: [users, roles, numbers, system, role-start, NAV-16, NAV-05, D-20, D-04]

requires:
  - phase: 08-navigation-redesign-android-port-foundation
    provides: Hub moduleRegistry (08-03); role_start APIs + RTK (08-02); PlatformRoleStartEditor scaffold (08-05); System→Modules page (08-05)
provides:
  - "Hub-aware Roles access-profile editor with v2 grant JSON + legacy table_module_* mapping"
  - "Users SUPERADMIN awareness + role/numbers_id linkage polish"
  - "Numbers hybrid mobile cards + JSON access-list form"
  - "Tenant System→Modules Role→start tab (tenant_role_start) + platform defaults precedence UX"
affects:
  - ModuleAccessGuard grant consumption of Hub role JSON (future)
  - Post-login role→start UX (NAV-05)

tech-stack:
  added: []
  patterns:
    - "roles.role TEXT JSON v2 `{ version: 2, hub: { moduleCode: pageId[] } }` with frontend migrate-on-read"
    - "PLATFORM_LEVEL_OPTIONS for SuperAdmin Users UI; LEVEL_OPTIONS remain tenant-safe"
    - "role→start precedence: tenant override → platform default → local D-16 (CC-off → Overview)"

key-files:
  created:
    - packages/frontend/src/features/roles/lib/roleGrants.ts
    - packages/frontend/src/features/roles/lib/roleGrants.test.ts
    - packages/frontend/src/features/roles/ui/RoleFormModal/RoleFormModal.tsx
    - packages/frontend/src/features/numbers/ui/NumberFormModal/NumberFormModal.tsx
    - packages/frontend/src/features/modules/ui/TenantRoleStartEditor/TenantRoleStartEditor.tsx
    - packages/frontend/src/entities/User/model/consts/userConsts.test.ts
  modified:
    - packages/frontend/src/pages/RolesPage/RolesPage.tsx
    - packages/frontend/src/pages/UsersPage/UsersPage.tsx
    - packages/frontend/src/pages/NumbersPage/NumbersPage.tsx
    - packages/frontend/src/pages/SystemModulesPage/SystemModulesPage.tsx
    - packages/frontend/src/features/platform-admin/ui/PlatformRoleStartEditor.tsx
    - packages/frontend/src/features/modules/lib/roleStartResolver.ts
    - packages/frontend/src/shared/config/locales/en.ts
    - packages/frontend/src/shared/config/locales/ru.ts
    - packages/backend/src/modules/roles/role.model.ts

key-decisions:
  - "Keep backend roles.role TEXT column; map Hub grants in frontend (no DB migration)"
  - "Tenant role→start lives as System→Modules tab (ADMIN+), not a separate Hub page"
  - "SUPERADMIN level option only when acting user is SuperAdmin (PLATFORM_LEVEL_OPTIONS)"

patterns-established:
  - "parseRoleGrants / serializeRoleGrants as single mapping layer for access profiles"
  - "D-29 hybrid: Numbers cards on phone, overflow-x-auto table on desktop"

requirements-completed: [NAV-16, NAV-05]

duration: 12min
completed: 2026-07-16
---

# Phase 8 Plan 08: Users/Roles/Numbers + Role→Start Admin Summary

**Hub-aware access-profile editor, System Users/Numbers polish, and tenant+platform role→start editors with documented precedence (D-20 / D-04)**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-16T17:55:56Z
- **Completed:** 2026-07-16T18:08:00Z
- **Tasks:** 3
- **Files modified:** 28

## Accomplishments

- Roles editor grants Hub modules/pages from `BASELINE_MODULES`; saves v2 JSON; migrates legacy `table_module_*` on load; «Интерфейсы» → Access profiles / Профили доступа
- Users expose SUPERADMIN via `PLATFORM_LEVEL_OPTIONS` for platform actors; role + Numbers linkage clarified in form/table
- Numbers keeps JSON model with form modal; phone card branch + desktop `overflow-x-auto` (D-29)
- Platform `/platform/role-start` and tenant System→Modules «Role → start» tab both save via 08-02 APIs; resolver tests cover tenant-over-platform and CC-off

## Task Commits

Each task was committed atomically:

1. **Task 1: Roles access profiles → Hub modules/pages**
   - `bc2d1a0` (test) — failing grant serialization tests
   - `e500721` (feat) — roleGrants mapping + RoleFormModal + i18n
2. **Task 2: Users + Numbers System polish** - `90360fc` (feat)
3. **Task 3: Role→start admin UI completion** - `fa1b8ce` (feat)

**Plan metadata:** `1e68954` (docs: complete plan)

## Files Created/Modified

- `features/roles/lib/roleGrants.ts` — parse/serialize/toggle Hub grants + legacy migrate
- `features/roles/ui/RoleFormModal/` — checkbox editor over registry modules/pages
- `entities/User/.../userConsts.ts` — `PLATFORM_LEVEL_OPTIONS` + SUPERADMIN i18n key
- `features/numbers/` — NumberFormModal + hybrid NumbersTable
- `features/modules/ui/TenantRoleStartEditor/` — tenant_role_start ADMIN UI
- `SystemModulesPage` — Modules | Role → start tabs
- `roleStartResolver.ts` — apiPath → tenantOverride → platformDefault → D-16
- Locales en/ru — roles/numbers/system/platform precedence copy (no em dash)

## Decisions Made

- Prefer frontend mapping layer over additive DB migration for role grant keys
- Empty tenant override paths persist as `/` on save (same as platform editor defaults)
- Numbers JSON default scaffold: `{ queues, operators, cdr }`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Role/Number form modals were missing**
- **Found during:** Task 1 / Task 2
- **Issue:** Slice opened create/edit modals but no RoleFormModal or NumberFormModal existed
- **Fix:** Implemented both modals wired to existing RTK create/update mutations
- **Files modified:** RoleFormModal, NumberFormModal, RolesPage, NumbersPage
- **Committed in:** `e500721`, `90360fc`

**Total deviations:** 1 auto-fixed (Rule 2)
**Impact on plan:** Required for plan acceptance (editor must save); no scope creep beyond D-20/D-04.

## Issues Encountered

None beyond the missing modal wiring above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Wave 7 System access UX complete; subsequent plans can consume Hub grant JSON server-side if ModuleAccessGuard needs it
- Role→start admin surfaces reachable for platform SuperAdmin and tenant ADMIN

## Known Stubs

None that block plan goals. Numbers JSON is free-form by design (model kept).

## Self-Check: PASSED

- FOUND: `roleGrants.ts`, `RoleFormModal.tsx`, `TenantRoleStartEditor.tsx`, `08-08-SUMMARY.md`
- FOUND commits: `bc2d1a0`, `e500721`, `90360fc`, `fa1b8ce`

---
*Phase: 08-navigation-redesign-android-port-foundation*
*Completed: 2026-07-16*
