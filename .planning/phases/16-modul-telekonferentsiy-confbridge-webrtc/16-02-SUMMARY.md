---
phase: 16-modul-telekonferentsiy-confbridge-webrtc
plan: 02
subsystem: api
tags: [conferences, ephemeral-rooms, callcenter, audit, confbridge]

requires:
  - phase: 16-modul-telekonferentsiy-confbridge-webrtc
    provides: ConferenceRoomsService create/find, krsk-conf-{room_uid}, ConferenceStateService, created_by from JWT
provides:
  - Tenant-isolated conference room update/remove with dialplan re-apply and deleteCategories
  - ConferenceEphemeralService ensureRoomForCall / collectIfEmpty
  - CallCenterService.addToConference absorbed into the conference room schema
  - assertLiveRoomAccess audit when a tenant admin enters another portal user's live room
affects:
  - 16-03 mask-index and route step into conference
  - 16-05 moderators and ConfBridge roles
  - 16-07 stale-channel sweeper for leftover ephemeral rooms

actuals:
  tokens: 11958
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - Ephemeral rooms are conference_rooms rows with kind=ephemeral, not a second table
    - collectIfEmpty is invoked lazily from ConferenceStateService.handleLeave via ModuleRef string token
    - Live-room "someone else's meeting" is created_by !== JWT sub; NULL created_by is not audited

key-files:
  created:
    - packages/backend/src/modules/conferences/conference-ephemeral.service.ts
    - packages/backend/src/modules/conferences/dto/update-conference-room.dto.ts
    - packages/backend/src/modules/conferences/conference-ephemeral.service.spec.ts
    - packages/backend/src/modules/conferences/conference-rooms.service.spec.ts
  modified:
    - packages/backend/src/modules/conferences/conference-rooms.service.ts
    - packages/backend/src/modules/conferences/conference-rooms.controller.ts
    - packages/backend/src/modules/conferences/conference-state.service.ts
    - packages/backend/src/modules/conferences/conference-sse.controller.ts
    - packages/backend/src/modules/conferences/conferences.module.ts
    - packages/backend/src/modules/callcenter/callcenter.service.ts
    - packages/backend/src/modules/callcenter/callcenter.module.ts
    - packages/backend/src/modules/callcenter/callcenter.service.spec.ts

key-decisions:
  - "addToConference redirects into krsk-conf-{uid} exten s; it no longer builds a ConfBridge name from uniqueid"
  - "created_by=NULL is a synthetic empty path and is not treated as someone else's meeting"
  - "ConferenceStateService resolves ConferenceEphemeralService lazily by string token to avoid a provider cycle"

patterns-established:
  - "Pattern: UpdateConferenceRoomDto is Create fields all optional; tenant fields are never declared and are deleted before update"
  - "Pattern: ephemeral number is uniqueid digits only, truncated to 32, empty after filter is CONFERENCE_NUMBER_INVALID"
  - "Pattern: SSE live-room subscribe goes through assertLiveRoomAccess so admin entry is audited on the same path as the browser"

requirements-completed: [D-03, D-04, D-17]

coverage:
  - id: D1
    description: Tenant-isolated update/remove re-applies room dialplan and deletes krsk-conf-{uid} via deleteCategories
    requirement: D-04
    verification:
      - kind: unit
        ref: packages/backend/src/modules/conferences/conference-rooms.service.spec.ts#update
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/conferences/conference-rooms.service.spec.ts#remove
        status: pass
    human_judgment: false
  - id: D2
    description: Ephemeral room is created from uniqueid digits, reused for the same tenant, and collected after last leave
    requirement: D-04
    verification:
      - kind: unit
        ref: packages/backend/src/modules/conferences/conference-ephemeral.service.spec.ts#ensureRoomForCall
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/conferences/conference-ephemeral.service.spec.ts#collectIfEmpty
        status: pass
    human_judgment: false
  - id: D3
    description: addToConference obtains the room from ensureRoomForCall(uniqueid, userUid, userId) and redirects into its context
    requirement: D-03
    verification:
      - kind: unit
        ref: packages/backend/src/modules/callcenter/callcenter.service.spec.ts#addToConference
        status: pass
    human_judgment: false
  - id: D4
    description: Tenant admin entry into a live room whose created_by is another portal user writes LoggerService.logAction; NULL created_by is not audited
    requirement: D-17
    verification:
      - kind: unit
        ref: packages/backend/src/modules/conferences/conference-rooms.service.spec.ts#assertLiveRoomAccess
        status: pass
    human_judgment: false

duration: 9min
completed: 2026-09-16
status: complete
---

# Phase 16 Plan 02: Full room CRUD, ephemeral rooms, absorb addToConference Summary

**Tenant conference rooms now have isolated update/remove with dialplan cleanup, ephemeral rooms are ordinary `conference_rooms` rows collected after the last leave, and operator ad hoc conference plus admin live-room entry go through that single schema.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-09-16T01:24:15Z
- **Completed:** 2026-09-16T01:32:48Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments

- Full room CRUD is tenant-scoped from JWT; `update` re-applies the room category; `remove` deletes `krsk-conf-{uid}` and does not roll back the DB row if AMI fails.
- `ConferenceEphemeralService` creates `kind=ephemeral` rooms from uniqueid digits, reuses them, and `handleLeave` collects an empty ephemeral room only.
- `CallCenterService.addToConference` calls `ensureRoomForCall(uniqueid, userUid, userId)` and redirects both legs into that context; tenant-admin live-room subscribe audits via `assertLiveRoomAccess` when `created_by` is another portal user.

## Task Commits

Each task was committed atomically:

1. **Task 1: Полный CRUD комнаты** - `85e10a9` (test RED), `1096233` (feat GREEN)
2. **Task 2: Эфемерные комнаты** - `1a8e3d8` (test RED), `f55cd09` (feat GREEN)
3. **Task 3: Поглощение addToConference и аудит** - `2375374` (test RED), `fefe68f` (feat GREEN)

**Plan metadata:** pending `docs(16-02): complete full room CRUD plan`

_Note: TDD tasks have RED then GREEN commits._

## Files Created/Modified

- `packages/backend/src/modules/conferences/dto/update-conference-room.dto.ts` - Optional Create fields, no tenant properties
- `packages/backend/src/modules/conferences/conference-rooms.service.ts` - `update`, `remove`, `assertLiveRoomAccess`
- `packages/backend/src/modules/conferences/conference-rooms.controller.ts` - PUT/DELETE with tenant from JWT
- `packages/backend/src/modules/conferences/conference-ephemeral.service.ts` - `ensureRoomForCall` / `collectIfEmpty`
- `packages/backend/src/modules/conferences/conference-state.service.ts` - lazy collect after last leave
- `packages/backend/src/modules/conferences/conference-sse.controller.ts` - subscribe via `assertLiveRoomAccess`
- `packages/backend/src/modules/conferences/conferences.module.ts` - ephemeral provider + LoggerModule
- `packages/backend/src/modules/callcenter/callcenter.service.ts` - addToConference uses ensureRoomForCall
- `packages/backend/src/modules/callcenter/callcenter.module.ts` - imports ConferencesModule
- Specs for rooms, ephemeral rooms, and the rewritten addToConference contract

## Decisions Made

- Redirect target is the room context `krsk-conf-{uid}` extension `s`, not a ConfBridge app-string in the agent context.
- `created_by = NULL` stays a synthetic empty path and is not "someone else's meeting".
- `ConferenceStateService` keeps an optional `ModuleRef` so existing zero-arg test constructions still work.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Source-scan tests were too strict for multiline calls and rxjs imports**
- **Found during:** Task 3 GREEN
- **Issue:** `startWith` appears in the SSE controller import list before `assertLiveRoomAccess`; `ensureRoomForCall` is formatted across lines with a trailing comma
- **Fix:** Scan the `events(` body only; allow multiline `ensureRoomForCall(uniqueid, userUid, userId)`
- **Files modified:** `packages/backend/src/modules/conferences/conference-rooms.service.spec.ts`
- **Verification:** `conference-rooms.service` 16/16 green
- **Committed in:** `fefe68f` (Task 3 GREEN)

**2. [Rule 3 - Blocking] callcenter.service.spec.ts had to describe the new Redirect contract**
- **Found during:** Task 3 RED
- **Issue:** The existing success case expected `ConfBridge(U1)` in the agent context; leaving it would regress after absorb
- **Fix:** Mock `ConferenceEphemeralService` and assert Context=`krsk-conf-88`, Exten=`s`, third arg=`userId`
- **Files modified:** `packages/backend/src/modules/callcenter/callcenter.service.spec.ts`
- **Verification:** callcenter 440/440 green, including the cross-tenant guard
- **Committed in:** `2375374` (Task 3 RED)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both required for GREEN and for the existing call-center suite. No scope creep.

## Issues Encountered

Workspace `npm run lint` still reports pre-existing unused-var warnings in `callcenter.service.ts` (SendDtmfDto, unused `userUid`, unused `events`). Conference files lint clean (`eslint src/modules/conferences/**/*.ts --max-warnings 0`). Not fixed (out of scope).

`ConferencesModule` imported into `CallCenterModule` without `forwardRef` — no module cycle appeared.

## TDD Gate Compliance

- Task 1 RED `85e10a9` then GREEN `1096233`
- Task 2 RED `1a8e3d8` then GREEN `f55cd09`
- Task 3 RED `2375374` then GREEN `fefe68f`

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Wave 3 (`16-03`) can start: tenant mask-index and route step into a conference. Do not rename `conf{number}_{uid}` or `krsk-conf-{room_uid}`.
- Mask-index was not touched. No frontend was added.

---
*Phase: 16-modul-telekonferentsiy-confbridge-webrtc*
*Completed: 2026-09-16*

## Self-Check: PASSED
