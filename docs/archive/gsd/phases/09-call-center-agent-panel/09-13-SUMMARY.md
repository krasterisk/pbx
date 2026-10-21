---
phase: 09-call-center-agent-panel
plan: 13
subsystem: api
tags: [nestjs, sequelize, rbac, permissions, call-center, settings]

requires:
  - phase: 09-01
    provides: "cc_operator_settings granular permission/UI/notification columns; cc_settings role-default permission/UI/notification/lock JSON columns; cc-permissions.types.ts"
  - phase: 09-05
    provides: "CallCenterPermissionsService.getEffective(userUid, operatorUserId) — server-authoritative role-default + per-operator-override + lock merge"
provides:
  - "CallCenterSettingsService: get/update operator UI customization (ui_visibility + softphone_placement, D-05/D-06)"
  - "CallCenterSettingsService: get/update operator permissions delegating merge to CallCenterPermissionsService (D-38/D-39)"
  - "CallCenterSettingsService: get/update operator notification matrix with per-event lock enforcement (D-41/D-43)"
  - "CallCenterSettingsService: get/update tenant role defaults + locks (permissions/ui/notifications) (D-39/D-43)"
  - "CallCenterSettingsService.getPermissionsMatrix(userUid) — operators × effective rights bulk resolver (D-40)"
  - "18 new REST routes on /callcenter/settings: operator/ui, operator/permissions, operator/notifications (self + :operatorId supervisor variants), tenant/permissions-defaults, tenant/ui-defaults, tenant/notification-defaults, permissions/matrix"
affects: [09-14]

tech-stack:
  added: []
  patterns:
    - "Server-side lock enforcement on write: locked fields silently rejected/ignored per-request, merge/effective-value logic always delegated to the resolver service (CallCenterPermissionsService), never duplicated"
    - "Whitelist-and-coerce sanitizers for open-ended JSON-column patches (mirrors existing sanitizeAlertThresholds shape)"

key-files:
  created: []
  modified:
    - packages/backend/src/modules/callcenter/callcenter-settings.service.ts
    - packages/backend/src/modules/callcenter/callcenter-settings.controller.ts
    - packages/backend/src/modules/callcenter/callcenter-settings.service.spec.ts
    - packages/backend/src/modules/callcenter/dto/callcenter-settings.dto.ts

key-decisions:
  - "notification_locks (typed NotificationMatrix, same shape as the value it locks) enforced at per-event granularity, not per-channel: a non-empty locks[event] array locks the whole event, forcing the tenant default channel set for that event on write. This matches the coarser 'field'-level lock wording in the plan's Task 1 behavior spec and avoids inventing per-(event,channel) semantics the schema comment does not specify."
  - "ui_visibility_locks (flat Record<string, boolean>) doubles as the lock map for both individual tab/panel visibility keys AND the special 'softphone_placement' key — one generic UI-customization lock map, consistent with D-05/D-06 treating UI customization as a single settings category."
  - "getPermissionsMatrix returns ALL tenant users (any UserLevel), not just UserLevel.OPERATOR — per Phase 7 decision, supervisors/admins can also log in as agents, so filtering by level would incorrectly exclude valid agents from the matrix."
  - "Tenant role-default endpoints (tenant/permissions-defaults, tenant/ui-defaults, tenant/notification-defaults) gate BOTH GET and PUT with assertSupervisor, unlike the pre-existing plain 'tenant' singleton route where GET is open to any tenant user — this follows the plan's explicit 'supervisor-gated' wording for the new routes."

requirements-completed: [D-05, D-06, D-38, D-39, D-40, D-41, D-42, D-43]

coverage:
  - id: D1
    description: "Operator can read/write own UI-visibility, softphone placement, permission-visible flags and notification matrix; locked items cannot be self-overridden (D-05/D-06/D-43)"
    requirement: "D-05"
    verification:
      - kind: unit
        ref: "callcenter-settings.service.spec.ts#getOperatorUiCustomization / updateOperatorUiCustomization (3 cases), #getOperatorPermissions / updateOperatorPermissions (3 cases), #getOperatorNotifications / updateOperatorNotifications (1 case)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Supervisor can read/write role defaults + per-item locks and per-operator overrides via :operatorId routes (D-06/D-39/D-40)"
    requirement: "D-39"
    verification:
      - kind: unit
        ref: "callcenter-settings.service.spec.ts#tenant role defaults (D-39/D-43) (3 cases: whitelist UserLevel keys, boolean coercion, event/channel whitelist)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Bulk permissions matrix endpoint returns operators × rights for the tenant (D-40)"
    requirement: "D-40"
    verification:
      - kind: unit
        ref: "callcenter-settings.service.spec.ts#getPermissionsMatrix (D-40)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Self routes take id from JWT, never a client param (IDOR-safe); :operatorId/tenant routes assertSupervisor"
    requirement: "D-38"
    verification:
      - kind: unit
        ref: "npx jest --testPathPattern=\"modules/callcenter\" --no-coverage (249/250 passing — 1 pre-existing unrelated failure)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Controller route registration order does not let the operator/:operatorId wildcard shadow the new exact-path self routes (operator/ui, operator/permissions, operator/notifications)"
    verification:
      - kind: other
        ref: "Manual review: all exact self routes grouped before the operator/:operatorId wildcard block in callcenter-settings.controller.ts; no automated route-matching test exists for this controller"
        status: pass
    human_judgment: true
    rationale: "No e2e/HTTP-level test harness exists for this controller (existing suite is unit-level only); the fix (reordering routes) was verified by code review and Express/Nest route-matching semantics, not by an executed request. 09-VALIDATION or 09-14's UI integration should exercise these routes end-to-end."

duration: ~35min
completed: 2026-07-23
status: complete
---

# Phase 9 Plan 13: Call-Center Settings API — UI Customization, Granular Permissions, Notification Matrix Summary

**Extended `CallCenterSettingsService`/`CallCenterSettingsController` with 18 new self/:operatorId/tenant/matrix routes for D-05/D-06 UI customization, D-38...D-40 granular permissions, and D-41...D-43 notification matrix — all merge/lock logic delegated to `CallCenterPermissionsService.getEffective` from 09-05, never reimplemented.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 2/2
- **Files modified:** 4 (0 created)

## Accomplishments
- `CallCenterSettingsService` gained six new capability groups, each following the same shape (get = read-merge tenant-default + operator-override; update = whitelist + reject-locked-fields + delegate-to-merge-service for the response):
  - **UI customization (D-05/D-06):** `getOperatorUiCustomization`/`updateOperatorUiCustomization` — merges `cc_settings.ui_visibility_defaults` with the per-operator `ui_visibility`/`softphone_placement` override; any key present in `cc_settings.ui_visibility_locks` (including the special `softphone_placement` key) is silently rejected on write.
  - **Granular permissions (D-38/D-39):** `getOperatorPermissions` delegates entirely to `CallCenterPermissionsService.getEffective` (no duplicate merge); `updateOperatorPermissions` looks up the operator's role, resolves `cc_settings.permission_locks[level]`, writes only unlocked fields, then returns the freshly-resolved effective set.
  - **Bulk matrix (D-40):** `getPermissionsMatrix(userUid)` lists every tenant user and resolves each one's effective `PermissionSet` via the same `getEffective` call — one merge implementation, used both for single-operator reads and the bulk matrix.
  - **Notification matrix (D-41/D-42/D-43):** `getOperatorNotifications`/`updateOperatorNotifications` — per-event lock granularity: an event present (non-empty) in `cc_settings.notification_locks` is forced to the tenant's `notification_defaults` channel set on write, ignoring the operator's requested value for that whole event.
  - **Tenant role defaults + locks (D-39/D-43):** three independent get/update pairs — `*PermissionsDefaults` (role_permission_defaults + permission_locks, keyed by `UserLevel`), `*UiDefaults` (flat ui_visibility_defaults/locks), `*NotificationDefaults` (flat notification_defaults/locks) — each with its own whitelist-and-coerce sanitizer mirroring the existing `sanitizeAlertThresholds` pattern.
- `CallCenterSettingsController` gained 18 new routes under `/callcenter/settings`, split self / `:operatorId` (supervisor) / tenant / matrix exactly like the pre-existing operator-settings routes — one controller, one IDOR-mitigation pattern, no parallel controller created.
- **Route-ordering fix (caught before commit):** the new exact-path self routes (`operator/ui`, `operator/permissions`, `operator/notifications`) had to be moved ahead of the pre-existing `operator/:operatorId` wildcard in the controller — Express/Nest matches routes in registration order, so `GET /callcenter/settings/operator/ui` would otherwise have been intercepted by the `:operatorId` wildcard (treating `"ui"` as the id, then failing `ParseIntPipe` with a 400). All self routes are now grouped first; the `:operatorId` 2-segment wildcard and the new 3-segment `:operatorId/ui|permissions|notifications` routes never collide with each other regardless of order.
- Four new DTOs (`UpdateUiCustomizationDto`, `UpdatePermissionsDto`, `UpdateNotificationMatrixDto`, `UpdateRoleDefaultsDto`) with tight `class-validator` field types — `spy_modes` validated as a `SpyMode[]` via `@IsIn(..., { each: true })`, `softphone_placement` via `@IsIn` against the 3-member enum; `UpdateRoleDefaultsDto` is one shared shape reused across all three `tenant/*-defaults` PUT bodies (each endpoint only reads the fields relevant to it).
- 20 new/updated unit tests in `callcenter-settings.service.spec.ts` covering: UI-customization lock rejection (both `ui_visibility` keys and `softphone_placement`), permission-lock rejection (boolean rights + `spy_modes`), notification-matrix per-event lock forcing, bulk matrix resolution delegating to the mocked `getEffective`, and whitelist/coercion behavior for all three tenant-defaults sanitizers.

## Task Commits

Each task was committed atomically:

1. **Task 1: Settings service methods for UI/permissions/notifications (self, by-id, tenant, matrix)** - `964faed` (feat)
2. **[Rule 1 - Bug, found during Task 1's own `tsc --noEmit` verification] Narrow PERMISSION_BOOLEAN_KEYS type** - `1ed8836` (fix)
3. **Task 2: Settings controller routes (self / :operatorId / tenant / matrix) + DTOs** - `00bf9ed` (feat)
4. **[Lint cleanup, found during Task 2's lint pass] Remove unused type alias** - `d142287` (style)

**Plan metadata:** commit pending (this SUMMARY + STATE.md/ROADMAP.md/REQUIREMENTS.md, via `gsd-tools query commit`)

## Files Created/Modified
- `packages/backend/src/modules/callcenter/callcenter-settings.service.ts` - += 6 capability groups (UI customization, permissions, notifications, 3× tenant defaults) + 5 sanitizer helpers + `getPermissionsMatrix`
- `packages/backend/src/modules/callcenter/callcenter-settings.controller.ts` - += 18 routes; reordered self routes ahead of the `operator/:operatorId` wildcard
- `packages/backend/src/modules/callcenter/callcenter-settings.service.spec.ts` - += 20 test cases across 6 new `describe` blocks; constructor now takes `userModel`/`permissionsService` mocks
- `packages/backend/src/modules/callcenter/dto/callcenter-settings.dto.ts` - += `UpdateUiCustomizationDto`, `UpdatePermissionsDto`, `UpdateNotificationMatrixDto`, `UpdateRoleDefaultsDto`

## Decisions Made
See `key-decisions` in frontmatter — summarized: (1) notification locks are per-event, not per-channel; (2) `ui_visibility_locks` doubles as the lock map for `softphone_placement`; (3) the permissions matrix returns all tenant users regardless of level; (4) the three new tenant-defaults routes gate GET as well as PUT (unlike the pre-existing plain `tenant` route).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `PERMISSION_BOOLEAN_KEYS` typed too broadly, breaking `entry[key] = boolean` assignment**
- **Found during:** Task 1's own verification (`npx tsc -p packages/backend/tsconfig.json --noEmit`, run in addition to the plan's `<automated>` jest check, since jest/ts-jest does not type-check transformed files)
- **Issue:** `const PERMISSION_BOOLEAN_KEYS: (keyof PermissionSet)[] = [...]` widened the loop variable's type to the full `keyof PermissionSet` union (including `spy_modes`), so `entry[key] = Boolean(...)` in `sanitizeRolePermissionDefaults` failed to compile (`TS2322: Type 'boolean' is not assignable to type '(boolean & SpyMode[]) | undefined'`).
- **Fix:** Declared the const with `as const` instead of an explicit widened array type, letting TS infer the narrow 4-member literal union.
- **Files modified:** `callcenter-settings.service.ts`
- **Verification:** `npx tsc -p packages/backend/tsconfig.json --noEmit` — 0 new errors (same 7 pre-existing unrelated errors as 09-01/09-05); jest suite still green.
- **Committed in:** `1ed8836`

**2. [Lint cleanup, no functional impact] Removed unused `PermissionBooleanKey` type alias**
- **Found during:** Task 2's lint pass (`npx eslint`)
- **Issue:** A type alias derived from the fixed `PERMISSION_BOOLEAN_KEYS` const was declared but never referenced (TS infers the narrow type from the `as const` array directly wherever needed).
- **Fix:** Removed the unused alias.
- **Files modified:** `callcenter-settings.service.ts`
- **Verification:** `npx eslint` — 0 problems (was 1 warning).
- **Committed in:** `d142287`

---

**Total deviations:** 2 auto-fixed (1 Rule 1 bug caught by an extra `tsc` pass, 1 lint-only cleanup)
**Impact on plan:** Both fixes are compile-time/lint-time only — no runtime behavior change, no scope creep. The Rule 1 bug would have broken production builds without the extra `tsc` check (jest/ts-jest passed despite the type error).

## Issues Encountered
- **[Pre-existing, out of scope] `callcenter-chat.service.spec.ts` fails** — same `sender_user_id: undefined` / `channel_key: "dm:NaN:NaN"` mismatch already documented as pre-existing in 09-01/09-05-SUMMARY.md. Not touched by this plan; confirmed present both before and after this plan's changes.
- **[Pre-existing, out of scope] `npx tsc -p packages/backend/tsconfig.json --noEmit` reports the same 7 errors** documented as pre-existing in 09-01/09-05 SUMMARYs (`call-groups.service.spec.ts`, `ivrs.service.spec.ts`, `keyword-matcher.service.spec.ts`) — confirmed identical before and after this plan's changes.
- No end-to-end/HTTP-level test harness exists for `CallCenterSettingsController` (the existing suite is unit-level, testing the service directly) — the route-ordering fix (self routes ahead of the `:operatorId` wildcard) was verified by code review against Express/Nest route-matching semantics, not by an executed HTTP request. Flagged as coverage item D5 (`human_judgment: true`) for 09-VALIDATION or manual verification once 09-14's settings UI can exercise these routes end-to-end.
- Local shell is PowerShell (Windows), which does not support bash `&&`/heredoc syntax used by the gsd-tools reference commands — commands were run sequentially instead of chained with `&&`, with equivalent effect.

## User Setup Required
None - no external service configuration required. No schema/migration changes in this plan (09-01/09-05 already shipped and applied all columns this plan reads/writes).

## Next Phase Readiness
- All settings endpoints (`operator/ui`, `operator/permissions`, `operator/notifications`, their `:operatorId` supervisor variants, `tenant/permissions-defaults`, `tenant/ui-defaults`, `tenant/notification-defaults`, `permissions/matrix`) are live and ready for 09-14's settings UI (`useUiCustomization`/`usePermissions` hooks, `PermissionsMatrix`/`NotificationMatrixForm` components per `09-PATTERNS.md`) to consume directly.
- No merge/lock logic needs to be re-derived client-side — every effective-value response is server-computed.
- Recommend 09-14 or 09-VALIDATION add at least a light HTTP-level smoke test (e.g., supertest) exercising `GET /callcenter/settings/operator/ui` to lock in the route-ordering fix as a regression test, since no such test currently exists for this controller.

## Self-Check: PASSED

All 4 modified files verified present on disk with expected content; all 4 commit hashes (`964faed`, `1ed8836`, `00bf9ed`, `d142287`) verified present in `git log`. `npx jest --testPathPattern="modules/callcenter" --no-coverage`: 249/250 passing (1 pre-existing unrelated failure, documented above). `npx tsc -p packages/backend/tsconfig.json --noEmit`: same 7 pre-existing unrelated errors, no new errors introduced. `npx eslint` on all 4 modified files: 0 problems.

---
*Phase: 09-call-center-agent-panel*
*Completed: 2026-07-23*
