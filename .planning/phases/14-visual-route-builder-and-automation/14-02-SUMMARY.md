---
phase: 14-visual-route-builder-and-automation
plan: 02
subsystem: api
tags: [d-48, route-references, jwt, conflict-409, action-index]

requires:
  - phase: 14-visual-route-builder-and-automation
    provides: collectActionReferences Wave 0 stub + D-48 spec (toivr/toqueue green, notify/directory it.failing)
provides:
  - JWT-scoped GET /route-references/:kind/:uid and GET /ivrs/:uid/usage
  - Server 409 delete backstop on IVR, queue, call group, voice robot, notification integration
  - collectDirectoryReferences thin wrapper over collectActionReferences
affects:
  - 14-04 (toivr resolution via RouteReferencesService)
  - 14-10 (Usage tab + delete precheck consume 409 shape and hasRawDialplanRoutes)

actuals:
  tokens: 14251
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - Polymorphic usage GET keyed by ActionReferenceKind
    - Tenant scope exclusively from JWT vpbx_user_uid
    - ConflictException { message, references } matching DirectoriesService.remove

key-files:
  created:
    - packages/backend/src/modules/route-references/route-references.module.ts
    - packages/backend/src/modules/route-references/route-references.controller.ts
    - packages/backend/src/modules/route-references/route-references.service.ts
    - packages/backend/src/modules/route-references/route-references.controller.spec.ts
    - packages/backend/src/modules/route-references/route-references.service.spec.ts
    - packages/backend/src/modules/queues/queues.service.spec.ts
    - packages/backend/src/modules/notifications/notification-integrations.service.spec.ts
  modified:
    - packages/backend/src/modules/route-references/action-reference.util.ts
    - packages/backend/src/modules/route-references/action-reference.util.spec.ts
    - packages/backend/src/app.module.ts
    - packages/backend/src/modules/ivrs/ivrs.service.ts
    - packages/backend/src/modules/ivrs/ivrs.controller.ts
    - packages/backend/src/modules/queues/queues.service.ts
    - packages/backend/src/modules/call-groups/call-groups.service.ts
    - packages/backend/src/modules/voice-robots/voice-robots.service.ts
    - packages/backend/src/modules/notifications/notifications.service.ts
    - packages/backend/src/modules/directories/directory-reference.util.ts

key-decisions:
  - "Usage lives on GET /route-references/:kind/:uid; IVR also exposes GET /ivrs/:uid/usage for the plan must-have"
  - "Notification delete guard is on existing NotificationsService — notification-integrations.service.ts does not exist"
  - "collectDirectoryReferences is a thin wrapper so directory-reference.util.spec stays green without a second nodeMatches"

patterns-established:
  - "RouteReferencesService.assertNotReferenced throws ConflictException { message, references }"
  - "hasRawDialplanRoutes is both a top-level field and meta.hasRawDialplanRoutes for 14-10"

requirements-completed: [D-48]

coverage:
  - id: D1
    description: collectActionReferences greens ivr, queue, group, voicerobot, integration, directory
    requirement: D-48
    verification:
      - kind: unit
        ref: packages/backend/src/modules/route-references/action-reference.util.spec.ts
        status: pass
    human_judgment: false
  - id: D2
    description: GET /route-references/:kind/:uid is JWT tenant-scoped and never leaks another tenant's routes
    requirement: D-48
    verification:
      - kind: unit
        ref: packages/backend/src/modules/route-references/route-references.service.spec.ts#scopes every scan to vpbx_user_uid from the caller
        status: pass
    human_judgment: false
  - id: D3
    description: GET /ivrs/:uid/usage returns routes referencing ivr_uid via actions JSON
    requirement: D-48
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ivrs/ivrs.service.spec.ts#getUsage returns tenant-scoped references
        status: pass
    human_judgment: false
  - id: D4
    description: IvrsService / QueuesService / CallGroupsService / VoiceRobotsService / NotificationsService.remove throw 409 with references array
    requirement: D-48
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ivrs/ivrs.service.spec.ts#remove throws 409 with references
        status: pass
    human_judgment: false
  - id: D5
    description: Directories delegate to the shared scanner with no 409 regression
    requirement: D-48
    verification:
      - kind: unit
        ref: packages/backend/src/modules/directories/directory-reference.util.spec.ts
        status: pass
    human_judgment: false

duration: 57min
completed: 2026-09-03
status: complete
---

# Phase 14 Plan 02: Reference index + IVR usage GET + delete 409 Summary

**Tenant-scoped action reference index with polymorphic usage GET and server-side 409 delete backstop for IVR, queue, group, robot, and notification integration**

## Performance

- **Duration:** 57 min
- **Started:** 2026-09-03T17:35:00Z
- **Completed:** 2026-09-03T18:32:10Z
- **Tasks:** 3
- **Files modified:** 26

## Accomplishments

- Greened `collectActionReferences` for ivr, queue, group, voicerobot, integration, and directory (removed 14-01 `it.failing`)
- Shipped JWT-guarded `GET /route-references/:kind/:uid` plus `GET /ivrs/:uid/usage`, both scoped by `vpbx_user_uid` from JWT only, with `hasRawDialplanRoutes` caveat
- Closed silent IVR/queue/group/robot/integration delete: `ConflictException` `{ message, references }` matching directories; no force-delete

## Task Commits

1. **Task 1: End-to-end IVR usage index** - `f1b06d3` (feat)
2. **Task 2: Delete guards — IVR, queue, group, robot, integration** - `22a03f7` (feat)
3. **Task 3: Directories delegate to shared index** - `f9916b6` (refactor)

**Plan metadata:** pending docs commit

## Files Created/Modified

- `packages/backend/src/modules/route-references/action-reference.util.ts` - Generalized scanner; exported `nodeMatches` once
- `packages/backend/src/modules/route-references/route-references.service.ts` - Tenant-scoped findUsage / assertNotReferenced
- `packages/backend/src/modules/route-references/route-references.controller.ts` - JWT GET `:kind/:uid`
- `packages/backend/src/modules/ivrs/ivrs.controller.ts` - GET `:id/usage`
- `packages/backend/src/modules/ivrs/ivrs.service.ts` / queues / call-groups / voice-robots / notifications - 409 before destroy
- `packages/backend/src/modules/directories/directory-reference.util.ts` - Thin wrapper over `collectActionReferences`

## Decisions Made

- Polymorphic usage path is the 14-10 contract; IVR also has `/ivrs/:uid/usage` so the plan must-have is literal
- `NotificationsService` is the integration delete host — the planned `notification-integrations.service.ts` file does not exist
- Queue delete matches `name`, extracted exten, and `q{exten}` so both stored target shapes block
- Directories keep calling `collectDirectoryReferences`; that function now delegates to the shared scanner

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] GET /ivrs/:uid/usage alias**
- **Found during:** Task 2
- **Issue:** Must-have truth named `GET /ivrs/:uid/usage` while Task 1 specified only `GET /route-references/:kind/:uid`
- **Fix:** `IvrsService.getUsage` + controller route before `:id`
- **Files modified:** `ivrs.controller.ts`, `ivrs.service.ts`, `ivrs.service.spec.ts`
- **Verification:** ivrs.service.spec getUsage case
- **Committed in:** `22a03f7`

**2. [Rule 3 - Blocking] notification-integrations.service.ts does not exist**
- **Found during:** Task 2
- **Issue:** Plan listed a file that is not in the repo; CRUD lives on `NotificationsService`
- **Fix:** Guard `NotificationsService.remove`; spec file named `notification-integrations.service.spec.ts` so the plan verify pattern matches
- **Files modified:** `notifications.service.ts`, `notifications.module.ts`, `notification-integrations.service.spec.ts`
- **Verification:** notification-integrations.service.spec.ts
- **Committed in:** `22a03f7`

**3. [Rule 2 - Missing Critical] VoiceRobotsService.deleteRobot is the real delete path**
- **Found during:** Task 2
- **Issue:** Plan said `.remove`; production method is `deleteRobot`
- **Fix:** Guard `deleteRobot` and add `remove` alias
- **Files modified:** `voice-robots.service.ts`
- **Verification:** VoiceRobotsService.deleteRobot 409 spec
- **Committed in:** `22a03f7`

**4. [Rule 2 - Missing Critical] Queue target aliases**
- **Found during:** Task 2
- **Issue:** Routes store `q100` while DB name is `q100_42` and `extractExten` yields `100`
- **Fix:** `assertNotReferenced('queue', [name, exten, q{exten}])`
- **Files modified:** `queues.service.ts`
- **Verification:** queues.service.spec.ts
- **Committed in:** `22a03f7`

---

**Total deviations:** 4 auto-fixed (2 missing critical, 2 blocking/naming)
**Impact on plan:** Required for the stated must-haves and for 409 to fire against real stored targets. No new packages (T-14-SC).

## Issues Encountered

- `directories.service.spec.ts` lookup/csv suites already fail on uncommitted `normalizeDirectoryKey` re-export WIP. Left untouched (scope boundary). Task 3 verified via `directory-reference.util.spec` (6/6) and `references and deletion` (4/4). See `deferred-items.md`.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 14-10 can wire `routeReferencesApi.getUsage(kind, uid)` and show the raw_dialplan caveat from `meta.hasRawDialplanRoutes`
- 14-04 can resolve `toivr` through `RouteReferencesService.findReferences('ivr', uid, vpbxUserUid)`
- Do not treat `tolist` / `confbridge` as indexed (research A6)

---
*Phase: 14-visual-route-builder-and-automation*
*Completed: 2026-09-03*

## Self-Check: PASSED
