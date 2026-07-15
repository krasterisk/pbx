---
phase: 06-dialplan-apps-ring-groups-multi-channel-notifications-ux-ove
plan: 06
subsystem: api
tags: [call-groups, nestjs, crud, dialplan-apply, jwt, sequelize, tenant-isolation]

# Dependency graph
requires:
  - phase: 06-04
    provides: CallGroup / CallGroupMember Sequelize models with vpbx_user_uid tenant column
  - phase: 06-05
    provides: generateGroupDialplan pure function returning {name, lines[]}
provides:
  - CallGroupsService tenant-scoped CRUD with transactional member replace-all
  - Dialplan apply/delete on every CRUD via DialplanApplyService (Pattern 2)
  - JWT CallGroupsController under /call-groups with ParseIntPipe uid
  - CallGroupsModule registered in AppModule (AmiModule + models)
affects:
  - 06-11-call-groups-page
  - 06-08-togroup-gosub

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Queues-style transaction + destroy/bulkCreate for member replace-all"
    - "delete dto.user_uid then force user_uid from JWT vpbx (time-groups precedent)"
    - "groupFile = krasterisk/groups/group_<vpbx>.conf; category = group_<uid>_<vpbx>"
    - "Never hand-roll AMI UpdateConfig — DialplanApplyService only"

key-files:
  created:
    - packages/backend/src/modules/call-groups/dto/call-group.dto.ts
    - packages/backend/src/modules/call-groups/call-groups.service.ts
    - packages/backend/src/modules/call-groups/call-groups.controller.ts
    - packages/backend/src/modules/call-groups/call-groups.module.ts
    - packages/backend/src/modules/call-groups/call-groups.service.spec.ts
  modified:
    - packages/backend/src/app.module.ts

key-decisions:
  - "Member replace on update only when members !== undefined (queues idiom); otherwise re-apply existing members"
  - "Null external_context coerced to empty string before generateGroupDialplan"
  - "applyCategories/deleteCategories always with { reload: true }"

patterns-established:
  - "Call-groups Pattern 2: generateGroupDialplan → DialplanApplyService on every CRUD"
  - "JWT controller passes req.user.vpbx_user_uid; service filters every query by user_uid"

requirements-completed: [D-01, D-02, D-03, D-08]

# Metrics
duration: 10min
completed: 2026-07-15
---

# Phase 6 Plan 6: CallGroupsService CRUD+Apply Summary

**Tenant-scoped call-group CRUD with transactional member replace and DialplanApplyService apply/delete on every mutation**

## Performance

- **Duration:** 10 min
- **Started:** 2026-07-15T11:27:53Z
- **Completed:** 2026-07-15T11:36:00Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- `CallGroupsService` with findAll/findOne/create/update/remove — all tenant-filtered by `user_uid`
- Transactional member replace (destroy + bulkCreate) on update; create bulkCreates members
- Private `applyGroup` / `removeGroupContext` call `generateGroupDialplan` + `DialplanApplyService` (no hand-rolled AMI)
- JWT `CallGroupsController` under `/call-groups` with `ParseIntPipe` on `:uid`
- `CallGroupsModule` wired with models + `AmiModule`, registered in `AppModule`
- Service spec green: apply/delete file+category, tenant isolation, NotFound for foreign uid

## Task Commits

Each task was committed atomically:

1. **Task 1: Create call-group DTOs + service** - `bd62df7` (feat)
2. **Task 2: Controller + module wiring + app.module registration** - `efb8a69` (feat)
3. **Task 3: Service spec (CRUD, tenant isolation, apply called)** - `3ed6bf8` (test)

**Plan metadata:** _(pending final docs commit)_

## Files Created/Modified

- `packages/backend/src/modules/call-groups/dto/call-group.dto.ts` — Create/Update DTOs + nested member DTO
- `packages/backend/src/modules/call-groups/call-groups.service.ts` — CRUD + dialplan apply/delete
- `packages/backend/src/modules/call-groups/call-groups.controller.ts` — JWT CRUD endpoints
- `packages/backend/src/modules/call-groups/call-groups.module.ts` — module wiring
- `packages/backend/src/modules/call-groups/call-groups.service.spec.ts` — unit coverage
- `packages/backend/src/app.module.ts` — CallGroupsModule import

## Decisions Made

- Followed queues transaction/member-sync idiom rather than always destroying members when the DTO omits `members`
- Coerce `external_context: null` → `''` for the dialplan generator's `ICallGroup` contract
- Threat mitigations T-06-15..17 applied: JwtAuthGuard, tenant where clauses, numeric-only groupFile/category names

## Deviations from Plan

None - plan executed exactly as written.

## TDD Gate Compliance

Task 3 is `tdd="true"` but the service was implemented in Tasks 1–2 (plan structure). Spec commit `3ed6bf8` verifies create/update apply, remove deleteCategories, and tenant isolation. No separate RED-before-GREEN commit sequence for Task 3 because the SUT already existed.

## Issues Encountered

- `npx tsc --noEmit` reports pre-existing errors in unrelated modules (ivrs.service.spec, notification providers not yet built, keyword-matcher specs). Call-groups sources have no tsc errors; out of scope per executor rules.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Backend call-groups API ready for frontend page (06-11) and `togroup` Gosub consumers
- Module registered; AMI apply path closes runtime gap so `togroup` can resolve `group_<uid>_<vpbx>`

---
*Phase: 06-dialplan-apps-ring-groups-multi-channel-notifications-ux-ove*
*Completed: 2026-07-15*
