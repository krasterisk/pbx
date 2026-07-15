---
phase: 06-dialplan-apps-ring-groups-multi-channel-notifications-ux-ove
plan: 01
subsystem: api
tags: [typescript, class-validator, shared-types, dialplan, route-action-dto]

# Dependency graph
requires: []
provides:
  - Shared ICallGroup, INotificationIntegration, and action param types
  - ActionType union extended with notify, callerid, trunk_carousel
  - RouteActionDto accepts new types, array dialstatus, time_group_uid
affects:
  - 06-02-backend-dialplan-generation
  - 06-03-call-groups-crud
  - 06-04-notifications-crud
  - 06-05-frontend-dialplan-apps

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Custom class-validator constraint for scalar-or-array dialstatus"
    - "TDD RED/GREEN commits for DTO validation spec"

key-files:
  created:
    - packages/shared/src/types/call-group.types.ts
    - packages/shared/src/types/notification.types.ts
    - packages/backend/src/modules/routes/dto/route-action.dto.spec.ts
  modified:
    - packages/shared/src/types/route.types.ts
    - packages/shared/src/index.ts
    - packages/backend/src/modules/routes/dto/route-action.dto.ts

key-decisions:
  - "Used IsDialstatusOrArrayConstraint custom validator instead of stacked ValidateIf decorators for reliable array element validation"
  - "Preserved all legacy ActionType ids (setclid_custom, telegram, togroup, etc.) for backward compatibility"

patterns-established:
  - "Shared entity types (call-group, notification) follow phonebook.types.ts interface style"
  - "Route action DTO spec bootstraps class-validator via reflect-metadata + plainToInstance"

requirements-completed: [D-01, D-10, D-11, D-14, D-15, D-19]

# Metrics
duration: 25min
completed: 2026-07-15
---

# Phase 06 Plan 01: Shared Types + Route Action DTO Summary

**Contract-first shared types for call groups and notifications, plus backend DTO validation for notify/callerid/trunk_carousel, array dialstatus, and time_group_uid**

## Performance

- **Duration:** 25 min
- **Started:** 2026-07-15T10:20:00Z
- **Completed:** 2026-07-15T10:45:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Created `call-group.types.ts` with `ICallGroup`, `ICallGroupMember`, `RingStrategy`, `CallGroupMemberType`
- Created `notification.types.ts` with `INotificationIntegration`, `NotificationChannel`, and action param interfaces
- Extended `ActionType` and `DialplanAction` union with `notify`, `callerid`, `trunk_carousel`
- Extended `RouteActionDto` to accept new action types, single-or-array `dialstatus`, and `time_group_uid`
- Added 9-case DTO validation spec (all green)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add shared type modules and extend ActionType union** - `00673de` (feat)
2. **Task 2 RED: Route-action DTO validation spec** - `29769da` (test)
3. **Task 2 GREEN: Extend route-action DTO** - `dd1569b` (feat)

**Plan metadata:** pending (docs commit)

## Files Created/Modified
- `packages/shared/src/types/call-group.types.ts` - Call group entity and member types
- `packages/shared/src/types/notification.types.ts` - Notification integration and action param types
- `packages/shared/src/types/route.types.ts` - Extended ActionType and DialplanAction union
- `packages/shared/src/index.ts` - Barrel exports for new type modules
- `packages/backend/src/modules/routes/dto/route-action.dto.ts` - DTO validation for new apps and conditions
- `packages/backend/src/modules/routes/dto/route-action.dto.spec.ts` - class-validator spec

## Decisions Made
- Custom `IsDialstatusOrArrayConstraint` validator chosen over stacked `@ValidateIf` decorators because the latter silently skipped array element validation
- `reflect-metadata` imported in spec file (not globally configured in jest) to support `@Type()` metadata

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Stacked ValidateIf did not reject invalid dialstatus arrays**
- **Found during:** Task 2 (DTO implementation)
- **Issue:** `@ValidateIf` + `@IsIn({ each: true })` combination passed `['BOGUS']` without errors
- **Fix:** Replaced with `@Validate(IsDialstatusOrArrayConstraint)` custom validator validating every array element
- **Files modified:** packages/backend/src/modules/routes/dto/route-action.dto.ts
- **Verification:** `npx jest route-action.dto --silent` — 9/9 pass
- **Committed in:** `dd1569b`

**2. [Rule 3 - Blocking] reflect-metadata missing in DTO spec**
- **Found during:** Task 2 (spec bootstrap)
- **Issue:** `Reflect.getMetadata is not a function` when loading RouteActionDto decorators
- **Fix:** Added `import 'reflect-metadata'` at top of spec file
- **Files modified:** packages/backend/src/modules/routes/dto/route-action.dto.spec.ts
- **Verification:** Jest suite loads and runs
- **Committed in:** `29769da`

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes required for correct validation and test execution. No scope creep.

## Issues Encountered
None beyond auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Shared types and DTO contract ready for backend dialplan generation (06-02) and CRUD modules (06-03/06-04)
- Frontend dialplan apps can import `RingStrategy`, `NotificationChannel`, and new action param types from `@krasterisk/shared`

---
*Phase: 06-dialplan-apps-ring-groups-multi-channel-notifications-ux-ove*
*Completed: 2026-07-15*

## Self-Check: PASSED

- FOUND: packages/shared/src/types/call-group.types.ts
- FOUND: packages/shared/src/types/notification.types.ts
- FOUND: packages/backend/src/modules/routes/dto/route-action.dto.spec.ts
- FOUND: .planning/phases/06-dialplan-apps-ring-groups-multi-channel-notifications-ux-ove/06-01-SUMMARY.md
- FOUND commits: 00673de, 29769da, dd1569b
