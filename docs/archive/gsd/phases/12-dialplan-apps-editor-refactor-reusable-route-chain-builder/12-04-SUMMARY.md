---
phase: 12-dialplan-apps-editor-refactor-reusable-route-chain-builder
plan: 04
subsystem: api
tags: [tenant-settings, nestjs, sequelize, jwt, whitelist, d-17, d-19]

requires:
  - phase: 06-dialplan-apps
    provides: system-settings module, JwtAuthGuard, LoggerService, standalone migrate pattern
provides:
  - Tenant-scoped settings module GET/PUT /tenant-settings
  - TENANT_SETTING_KEYS whitelist with D-17 flags default true
  - Idempotent tenant_settings migration and composite unique index
  - assertDisjointKeySets against global system-settings keys
affects:
  - 12-09 tenant settings UI
  - routes editor visibility flags
  - generator / routes readers of TenantSettingsService

tech-stack:
  added: []
  patterns:
    - "tenant settings = key+value+category + vpbx_user_uid composite unique (no-change on setting noun)"
    - "empty-table getAll overlays whitelist defaults; absence of a row = default ON"
    - "unknown tenant keys rejected 400 (never silently ignored)"

key-files:
  created:
    - packages/backend/src/modules/tenant-settings/tenant-setting.model.ts
    - packages/backend/src/modules/tenant-settings/tenant-settings.keys.ts
    - packages/backend/src/modules/tenant-settings/tenant-settings.service.ts
    - packages/backend/src/modules/tenant-settings/tenant-settings.controller.ts
    - packages/backend/src/modules/tenant-settings/tenant-settings.module.ts
    - packages/backend/src/modules/tenant-settings/dto/tenant-settings.dto.ts
    - packages/backend/src/modules/tenant-settings/migrate-tenant-settings.ts
  modified:
    - packages/backend/src/app.module.ts

key-decisions:
  - "D-17 both flags default true (ON); empty-table getAll returns toBe(true)"
  - "GLOBAL_SETTING_KEYS is a live Set from system-settings MANAGED_KEYS"
  - "vpbxUserUid only as service parameter / JWT; body vpbx_user_uid is declared optional and never read"
  - "No @Roles(UserLevel.ADMIN) on tenant-settings; JwtAuthGuard only (D-19)"

patterns-established:
  - "Pattern: tenant settings module registered in all three app.module.ts points (import, models, imports)"
  - "Pattern: IsTenantSettingKeys ValidationPipe validator + service BadRequestException (defense in depth)"

requirements-completed: [D-16, D-17, D-19]

coverage:
  - id: D1
    description: Idempotent tenant_settings table + unique composite index on (vpbx_user_uid, key)
    requirement: D-19
    verification:
      - kind: unit
        ref: packages/backend/src/modules/tenant-settings/migrate-tenant-settings.spec.ts#runTenantSettingsMigrate
        status: pass
      - kind: manual_procedural
        ref: live double-run npx ts-node src/modules/tenant-settings/migrate-tenant-settings.ts
        status: pass
    human_judgment: false
  - id: D2
    description: D-17 flags live only as tenant keys with boolean default true
    requirement: D-17
    verification:
      - kind: unit
        ref: packages/backend/src/modules/tenant-settings/tenant-settings.keys.spec.ts#includes both D-17 visibility flags
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/tenant-settings/tenant-settings.service.spec.ts#returns D-17 defaults true
        status: pass
    human_judgment: false
  - id: D3
    description: Tenant key set is disjoint from global system-settings keys
    requirement: D-19
    verification:
      - kind: unit
        ref: packages/backend/src/modules/tenant-settings/tenant-settings.keys.spec.ts#does not intersect GLOBAL_SETTING_KEYS
        status: pass
    human_judgment: false
  - id: D4
    description: Unknown keys and type mismatches rejected; tenants isolated; upsert is single-row
    requirement: D-19
    verification:
      - kind: unit
        ref: packages/backend/src/modules/tenant-settings/tenant-settings.service.spec.ts#setMany
        status: pass
    human_judgment: false
  - id: D5
    description: Non-ADMIN JWT can read/write own tenant settings; body vpbx_user_uid ignored; system-settings stays ADMIN
    requirement: D-19
    verification:
      - kind: unit
        ref: packages/backend/src/modules/tenant-settings/tenant-settings.controller.spec.ts#TenantSettingsController (D-19)
        status: pass
    human_judgment: false
  - id: D6
    description: raw_dialplan column and data are not touched (D-16) — flags are visibility-only
    requirement: D-16
    verification:
      - kind: other
        ref: plan files_modified contains no routes/raw_dialplan schema or generator files
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-08-19
status: complete
---

# Phase 12 Plan 04: Tenant settings module Summary

**Per-tenant settings module with whitelist keys, D-17 visibility flags default ON, JWT-scoped GET/PUT, and an idempotent `tenant_settings` migration**

## Performance

- **Duration:** 15 min
- **Started:** 2026-08-19T01:13:58+07:00
- **Completed:** 2026-08-19T01:28:15+07:00
- **Tasks:** 3 (plus approved live-migrate checkpoint)
- **Files modified:** 12

## Accomplishments

- Standalone idempotent migration creates `tenant_settings` + unique index `tenant_settings_vpbx_key_uniq` on `(vpbx_user_uid, key)`; live double-run approved (create then skip).
- `TENANT_SETTING_KEYS` is the only source of tenant keys; both D-17 flags default `true`; `assertDisjointKeySets` fails if a key collides with `system-settings` `MANAGED_KEYS`.
- `GET/PUT /tenant-settings` is JwtAuthGuard-only (no ADMIN role); tenant always from `req.user.vpbx_user_uid`; writes logged via `LoggerService`.
- Module registered in all three `app.module.ts` points: import, `SequelizeModule.forRoot({ models })`, `imports`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Модель tenant_settings + идемпотентная standalone-миграция** - `9bc2fba` (test) / `d2bd660` (feat)
2. **Checkpoint: live double-run migrate-tenant-settings** - approved (orchestrator, no commit)
3. **Task 2: Whitelist ключей, сервис и DTO** - `795950d` (test) / `0223cc2` (feat)
4. **Task 3: Контроллер, модуль и регистрация в app.module.ts** - `9cc2881` (test) / `3f7cffa` (feat)

**Plan metadata:** pending `docs(12-04): complete tenant-settings plan`

_Note: TDD tasks have RED then GREEN commits._

## Files Created/Modified

- `packages/backend/src/modules/tenant-settings/tenant-setting.model.ts` - Sequelize model; `key` is not unique alone
- `packages/backend/src/modules/tenant-settings/migrate-tenant-settings.ts` - standalone `runTenantSettingsMigrate(qi)`
- `packages/backend/src/modules/tenant-settings/migrate-tenant-settings.spec.ts` - mock queryInterface create/idempotent
- `packages/backend/src/modules/tenant-settings/tenant-settings.keys.ts` - whitelist + GLOBAL_SETTING_KEYS + assertDisjointKeySets
- `packages/backend/src/modules/tenant-settings/tenant-settings.keys.spec.ts` - disjoint sets and D-17 defaults
- `packages/backend/src/modules/tenant-settings/tenant-settings.service.ts` - getAll/get/setMany with type checks and upsert
- `packages/backend/src/modules/tenant-settings/tenant-settings.service.spec.ts` - defaults, isolation, whitelist, count=1
- `packages/backend/src/modules/tenant-settings/dto/tenant-settings.dto.ts` - UpdateTenantSettingsDto + IsTenantSettingKeys
- `packages/backend/src/modules/tenant-settings/tenant-settings.controller.ts` - GET/PUT, JwtAuthGuard, no ADMIN
- `packages/backend/src/modules/tenant-settings/tenant-settings.controller.spec.ts` - JWT tenant, ignored body uid, 403 regression
- `packages/backend/src/modules/tenant-settings/tenant-settings.module.ts` - forFeature + LoggerModule, exports service
- `packages/backend/src/app.module.ts` - three-point registration

## Decisions Made

- D-17 LOCKED: both `routes.show_raw_dialplan` and `routes.show_flowchart` default `true` (empty table = ON).
- `GLOBAL_SETTING_KEYS` imported from `MANAGED_KEYS` so disjointness stays live when global keys change.
- Body `vpbx_user_uid` is an optional unused DTO field so global `forbidNonWhitelisted` does not 400; service never reads it.
- No `@Roles(UserLevel.ADMIN)` on the new controller (D-19). Writes are limited to the whitelist.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] JwtAuthGuard unit 401 assertion**
- **Found during:** Task 3 (controller GREEN)
- **Issue:** Instantiating `JwtAuthGuard` without Passport throws `TypeError`, not `UnauthorizedException`. `supertest` is not in the repo; installing it is forbidden by Rule 3.
- **Fix:** Assert the guard does not grant access without a token; keep class-level `JwtAuthGuard` metadata + system-settings ADMIN 403 via `RolesGuard`.
- **Files modified:** `tenant-settings.controller.spec.ts`
- **Verification:** controller spec 6/6 pass
- **Committed in:** `3f7cffa` (Task 3)

**2. [Rule 2 - Missing Critical] LoggerModule on TenantSettingsModule**
- **Found during:** Task 3
- **Issue:** Plan module scaffold omitted `LoggerModule`, but T-12-04-05 requires `LoggerService.logAction` on writes.
- **Fix:** Import `LoggerModule` and inject `LoggerService` in the controller.
- **Files modified:** `tenant-settings.module.ts`, `tenant-settings.controller.ts`
- **Verification:** PUT test expects `logAction` with tenant + changed keys
- **Committed in:** `3f7cffa` (Task 3)

**3. [Rule 2 - Security] Optional `vpbx_user_uid` on DTO**
- **Found during:** Task 3
- **Issue:** Global `ValidationPipe` uses `forbidNonWhitelisted: true`, so an undeclared `vpbx_user_uid` would 400 instead of being ignored.
- **Fix:** Declare `@IsOptional() vpbx_user_uid?: unknown` on the DTO; controller/service still take tenant only from JWT.
- **Files modified:** `dto/tenant-settings.dto.ts`
- **Verification:** PUT test calls `setMany(42, settings)` and never `999`
- **Committed in:** `3f7cffa` (Task 3)

---

**Total deviations:** 3 auto-fixed (1 bug, 2 missing-critical)
**Impact on plan:** All required for correctness/security. HTTP-level supertest not added (no package). No scope creep.

## Issues Encountered

- Windows `npm run test -w ... --testPathPattern=` ran the full suite; tests were invoked via `npx jest --testPathPattern=` inside `packages/backend`.
- Pre-existing `tsc` errors in unrelated specs (call-groups, ivrs, callcenter, voice-robots) — out of scope; no tenant-settings TS errors.

## User Setup Required

None - no external service configuration required. Table is created by the already-approved live migrate script.

## Next Phase Readiness

- 12-09 can consume `GET/PUT /tenant-settings` for Surface K switches.
- `TenantSettingsService` is exported for generator/routes readers.
- `raw_dialplan` data path unchanged (D-16).

## TDD Gate Compliance

- Task 1: RED `9bc2fba` → GREEN `d2bd660`
- Task 2: RED `795950d` → GREEN `0223cc2`
- Task 3: RED `9cc2881` → GREEN `3f7cffa`

## Self-Check: PASSED

- FOUND: packages/backend/src/modules/tenant-settings/tenant-setting.model.ts
- FOUND: packages/backend/src/modules/tenant-settings/migrate-tenant-settings.ts
- FOUND: packages/backend/src/modules/tenant-settings/tenant-settings.keys.ts
- FOUND: packages/backend/src/modules/tenant-settings/tenant-settings.service.ts
- FOUND: packages/backend/src/modules/tenant-settings/tenant-settings.controller.ts
- FOUND: packages/backend/src/modules/tenant-settings/tenant-settings.module.ts
- FOUND: packages/backend/src/modules/tenant-settings/dto/tenant-settings.dto.ts
- FOUND: 9bc2fba, d2bd660, 795950d, 0223cc2, 9cc2881, 3f7cffa

---
*Phase: 12-dialplan-apps-editor-refactor-reusable-route-chain-builder*
*Completed: 2026-08-19*
