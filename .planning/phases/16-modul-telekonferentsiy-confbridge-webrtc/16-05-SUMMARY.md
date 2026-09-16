---
phase: 16-modul-telekonferentsiy-confbridge-webrtc
plan: 05
subsystem: api
tags: [conferences, confbridge, roles, moderators, ami, tdd]

requires:
  - phase: 16-modul-telekonferentsiy-confbridge-webrtc
    provides: generateConferenceDialplan, applyRoom mask-index pair, ConferenceStateService, created_by ≠ bridge owner
provides:
  - Three ConfBridge roles via CONFBRIDGE_ROLE_FLAGS admin/marked table
  - Permanent owner/moderators in conference_room_moderators.role
  - Personal Set(CONFBRIDGE(user,...)) elevation lines in the room context
  - GET/PUT /conferences/:uid/moderators with replace-all + applyRoom
  - Live mute/kick/grant/revoke with server-side role resolution
affects:
  - 16-06 wait_marked / marked-user start of meeting
  - 16-07 self-state endpoint reuses resolveCallerRef
  - 16.3 live-room UI for roles and moderation actions

actuals:
  tokens: 15337
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - Single CONFBRIDGE_ROLE_FLAGS table; owner and moderator share admin+marked
    - Optional last generateConferenceDialplan rights arg defaults to []
    - Permanent rights in DB; one-shot grants only in ConferenceStateService memory
    - resolveCallerRef is the only JWT-sub → short-number bridge

key-files:
  created:
    - packages/backend/src/modules/conferences/conference-roles.util.ts
    - packages/backend/src/modules/conferences/conference-roles.spec.ts
    - packages/backend/src/modules/conferences/conference-state.spec.ts
    - packages/backend/src/modules/conferences/dto/conference-moderator.dto.ts
    - packages/backend/src/modules/conferences/conference-moderation.service.ts
    - packages/backend/src/modules/conferences/conference-moderation.controller.ts
    - packages/backend/src/modules/conferences/conference-moderation.spec.ts
  modified:
    - packages/backend/src/modules/conferences/setup-conferences-schema.ts
    - packages/backend/src/modules/conferences/models/conference-room-moderator.model.ts
    - packages/backend/src/modules/conferences/conference-dialplan.util.ts
    - packages/backend/src/modules/conferences/conference-dialplan.util.spec.ts
    - packages/backend/src/modules/conferences/conference-state.service.ts
    - packages/backend/src/modules/conferences/conference-rooms.service.ts
    - packages/backend/src/modules/conferences/conference-rooms.service.spec.ts
    - packages/backend/src/modules/conferences/conference-rooms.controller.ts
    - packages/backend/src/modules/conferences/conferences.module.ts
    - packages/backend/src/modules/conferences/conference-schema.spec.ts

key-decisions:
  - "Owner and moderator share admin=true/marked=true; owner vs moderator is server knowledge, not a ConfBridge flag"
  - "generateConferenceDialplan(room, vpbx) without rights stays byte-identical to an empty list — no elevation lines"
  - "One-shot grants never write conference_room_moderators and clear when the last participant leaves"

patterns-established:
  - "Pattern: personal elevation is Set(CONFBRIDGE(user,admin|marked)) gated on CALLERID(num); never CONFBRIDGE(bridge,...) per caller"
  - "Pattern: created_by is portal audit identity; ownerRef is the short endpoint number via PUT /conferences/:uid/moderators"
  - "Pattern: resolveCallerRef(user) reads users.exten then numeric login by uniqueid+vpbx_user_uid; null is Forbidden, not participant"

requirements-completed: [D-14, D-15, D-16]

coverage:
  - id: D1
    description: Exactly three roles mapped by one admin/marked table; owner is not derived from event flags
    requirement: D-14
    verification:
      - kind: unit
        ref: packages/backend/src/modules/conferences/conference-roles.spec.ts#maps owner and moderator to the same admin+marked pair
        status: pass
    human_judgment: false
  - id: D2
    description: Permanent rights emit one CALLERID(num) user-profile line each; empty/omitted rights emit none; bridge profile stays room-wide
    requirement: D-14
    verification:
      - kind: unit
        ref: packages/backend/src/modules/conferences/conference-dialplan.util.spec.ts#emits one CALLERID(num) elevation line per permanent-rights row
        status: pass
    human_judgment: false
  - id: D3
    description: Snapshot role comes from room settings for a known caller; owner+moderator listing yields a single owner row; join order is stable
    requirement: D-14
    verification:
      - kind: unit
        ref: packages/backend/src/modules/conferences/conference-state.spec.ts#gives a known caller the role from room settings
        status: pass
    human_judgment: false
  - id: D4
    description: PUT /conferences/:uid/moderators replaces permanent rights and reapplies the room category once
    requirement: D-16
    verification:
      - kind: unit
        ref: packages/backend/src/modules/conferences/conference-rooms.service.spec.ts#replaces rights and applies dialplan once
        status: pass
    human_judgment: false
  - id: D5
    description: Owner can grant a guest (no endpoint_ref) for this meeting only; grant leaves no moderator row and dies when the room empties
    requirement: D-15
    verification:
      - kind: unit
        ref: packages/backend/src/modules/conferences/conference-moderation.spec.ts#grants a guest without endpointRef
        status: pass
    human_judgment: false
  - id: D6
    description: Mute/kick require moderator; grant/revoke require owner; client-supplied caller role is ignored
    requirement: D-16
    verification:
      - kind: unit
        ref: packages/backend/src/modules/conferences/conference-moderation.spec.ts#ignores a self-declared role on the caller object
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-09-16
status: complete
---

# Phase 16 Plan 05: ConfBridge roles and two-level rights Summary

**Three fixed ConfBridge roles on one admin/marked table, permanent owner/moderators in room settings, and in-memory one-shot grants that never persist**

## Performance

- **Duration:** 12 min
- **Started:** 2026-09-16T02:10:33Z
- **Completed:** 2026-09-16T02:22:00Z
- **Tasks:** 3
- **Files modified:** 17

## Accomplishments

- Single `CONFBRIDGE_ROLE_FLAGS` table: owner and moderator both `{ admin: true, marked: true }`, participant both false; `roleFromConfbridgeFlags` never returns `owner`
- `conference_room_moderators.role` ENUM plus idempotent ALTER; `generateConferenceDialplan` optional rights arg emits personal `CALLERID(num)` user-profile lines and never per-caller bridge profile
- `GET/PUT /conferences/:uid/moderators` replace-all with `CONFERENCE_OWNER_DUPLICATE` / `CONFERENCE_MODERATOR_DUPLICATE`; `applyRoom` reads rights and keeps the 16-03 room+mask-index pair
- Live mute/kick/grant/revoke: `resolveCallerRef` from `users.exten` or numeric `login`; null identity is Forbidden; guest grant uses the live participant ref; grants clear when the room empties

## Task Commits

Each task was committed atomically (TDD RED then GREEN):

1. **Task 1 RED: failing tests for roles/dialplan/state** - `b348726` (test)
2. **Task 1 GREEN: roles util, schema, dialplan, state** - `5fb01b9` (feat)
3. **Task 2 RED: failing tests for permanent room moderators** - `6f13077` (test)
4. **Task 2 GREEN: permanent room moderator CRUD** - `6561d64` (feat)
5. **Task 3 RED: failing tests for live moderation grants** - `27d4912` (test)
6. **Task 3 GREEN: live moderation and one-shot grants** - `24106f5` (feat)

_Note: TDD tasks have RED then GREEN commits_

## Files Created/Modified

- `conference-roles.util.ts` — `ConferenceRole`, `CONFBRIDGE_ROLE_FLAGS`, `roleFromConfbridgeFlags`, `resolveRoleForCaller`
- `conference-roles.spec.ts` — flag table and caller-resolution cases
- `setup-conferences-schema.ts` — `role` on CREATE plus `alterIdempotent` ADD COLUMN
- `conference-room-moderator.model.ts` — `role` ENUM default `moderator`
- `conference-dialplan.util.ts` — optional permanent-rights argument, personal user-profile lines
- `conference-dialplan.util.spec.ts` — CALLERID elevation and omitted-arg identity
- `conference-state.service.ts` — settings role, join-time sort, live grant map
- `conference-state.spec.ts` — first dedicated state-service spec
- `dto/conference-moderator.dto.ts` — `endpointRef` `/^\d{1,32}$/`, role `owner|moderator`
- `conference-rooms.service.ts` — `get/setRoomModerators`, `resolveCallerRef`, `applyRoom` reads rights
- `conference-rooms.controller.ts` — `GET/PUT :uid/moderators`
- `conference-rooms.service.spec.ts` — permanent-rights CRUD cases
- `conference-moderation.service.ts` — `assertCanModerate`, mute/unmute/kick/grant/revoke
- `conference-moderation.controller.ts` — live participant action routes
- `conference-moderation.spec.ts` — bridge, mute/kick, guest grant, empty-room reset
- `conferences.module.ts` — User model, moderation service/controller
- `conference-schema.spec.ts` — forFeature now includes `User`

## Decisions Made

- Owner vs moderator is server knowledge (room settings + live grants), not a distinct ConfBridge flag pair — both are admin+marked so a moderator also starts a wait_marked meeting (D-13 / 16-06)
- `generateConferenceDialplan` third argument is optional and defaults to `[]` so Task 1 compiles before `applyRoom` starts reading rights
- Portal `created_by` still does not auto-create an owner row; the only write path is `PUT /conferences/:uid/moderators`
- Unresolved `resolveCallerRef` is Forbidden, never a silent participant — there is no number to compare

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] forFeature completeness test after adding User**
- **Found during:** Task 3
- **Issue:** Plan required `User` in `SequelizeModule.forFeature` so `resolveCallerRef` can read `users`. The 16-01 schema spec asserted exactly five models.
- **Fix:** Assertion now requires the five conference models plus `User`
- **Files modified:** `packages/backend/src/modules/conferences/conference-schema.spec.ts`
- **Verification:** `conference-schema.spec.ts` green
- **Committed in:** `24106f5` (Task 3 GREEN)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Required for Nest to inject `User`; no scope creep.

## Issues Encountered

- Plan verify `npm run lint` exits non-zero on pre-existing `preserve-caught-error` failures in `read-adapters-operations.spec.ts` and `read-adapters-speech.spec.ts` (ai-platform, not this plan). Conference-module eslint is clean. Logged in `deferred-items.md`.

## TDD Gate Compliance

- RED commits: `b348726`, `6f13077`, `27d4912`
- GREEN commits: `5fb01b9`, `6561d64`, `24106f5`
- Sequence holds for all three tasks

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 16-06 can rely on marked flags for both owner and moderator
- 16-07 should call `ConferenceRoomsService.resolveCallerRef` rather than invent a second JWT→number map
- Live DTMF admin menu after a one-shot grant still needs a re-join (engine limit, documented in the plan assumptions)

## Self-Check: PASSED

---
*Phase: 16-modul-telekonferentsiy-confbridge-webrtc*
*Completed: 2026-09-16*
