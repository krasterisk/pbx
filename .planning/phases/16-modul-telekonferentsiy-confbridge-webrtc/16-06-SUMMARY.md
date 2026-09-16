---
phase: 16-modul-telekonferentsiy-confbridge-webrtc
plan: 06
subsystem: api
tags: [conferences, confbridge, entry-strictness, pin, wait-marked, tdd]

requires:
  - phase: 16-modul-telekonferentsiy-confbridge-webrtc
    provides: generateConferenceDialplan privileged vs participant branch, CONFBRIDGE_ROLE_FLAGS, ConferenceStateService snapshot stream
provides:
  - conferenceEntryPolicy as the only strictness → user-profile decision function
  - PIN / wait_marked / end_marked personal ConfBridge lines from room settings
  - CONFERENCE_PIN_REQUIRED on create/update when PIN is promised but empty
  - waitingForModerator room-level snapshot flag (no fifth participant state)
affects:
  - 16-07 self-state / DTO mapper reuses waitingForModerator
  - 16.3 live-room UI lobby banner from the room snapshot

actuals:
  tokens: 6965
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - conferenceEntryPolicy is the only place entry_strictness becomes PIN/wait/end decisions
    - wait_marked / end_marked emit only on CONF_ROLE=participant
    - assertEntryPolicyConsistent runs before the DB write

key-files:
  created:
    - packages/backend/src/modules/conferences/conference-entry-policy.util.ts
    - packages/backend/src/modules/conferences/conference-entry-policy.spec.ts
  modified:
    - packages/backend/src/modules/conferences/conference-dialplan.util.ts
    - packages/backend/src/modules/conferences/conference-dialplan.util.spec.ts
    - packages/backend/src/modules/conferences/dto/create-conference-room.dto.ts
    - packages/backend/src/modules/conferences/dto/update-conference-room.dto.ts
    - packages/backend/src/modules/conferences/conference-rooms.service.ts
    - packages/backend/src/modules/conferences/conference-rooms.service.spec.ts
    - packages/backend/src/modules/conferences/conference-state.service.ts
    - packages/backend/src/modules/conferences/conference-state.spec.ts

key-decisions:
  - "conferenceEntryPolicy is the only translator from room settings to PIN/wait/end; the generator never reads those columns directly"
  - "Wait requirement is strictness token_name_pin_moderator OR the wait_marked column — strictness raises, never cancels"
  - "PIN line emits only when the level requires PIN and the sanitized value is non-empty"
  - "waitingForModerator is a room snapshot flag, not a fifth participant state (D-37)"

patterns-established:
  - "Pattern: personal wait_marked/end_marked are ExecIf CONF_ROLE=participant — never assigned to owner/moderator"
  - "Pattern: CONFERENCE_PIN_REQUIRED is a 400 body code checked before create/update persist"
  - "Pattern: registerRoom caches conferenceEntryPolicy; getSnapshot derives waitingForModerator from policy + privileged roles"

requirements-completed: [D-11, D-13]

coverage:
  - id: D1
    description: Three entry levels map to PIN/wait decisions; wait_marked column still raises wait at token_name
    requirement: D-11
    verification:
      - kind: unit
        ref: packages/backend/src/modules/conferences/conference-entry-policy.spec.ts#requires PIN and wait at token_name_pin_moderator
        status: pass
    human_judgment: false
  - id: D2
    description: PIN-required category emits exactly one user,pin line; empty PIN emits none; token_name emits neither pin nor wait
    requirement: D-11
    verification:
      - kind: unit
        ref: packages/backend/src/modules/conferences/conference-dialplan.util.spec.ts#emits exactly one user,pin line for token_name_pin with PIN 1234
        status: pass
    human_judgment: false
  - id: D3
    description: wait_marked and end_marked emit once after the role line and only on the participant branch
    requirement: D-13
    verification:
      - kind: unit
        ref: packages/backend/src/modules/conferences/conference-dialplan.util.spec.ts#emits wait_marked only after the role line for token_name_pin_moderator
        status: pass
    human_judgment: false
  - id: D4
    description: create/update reject a PIN-required room without PIN with CONFERENCE_PIN_REQUIRED; ASCII digits 4..32 only
    requirement: D-11
    verification:
      - kind: unit
        ref: packages/backend/src/modules/conferences/conference-rooms.service.spec.ts#rejects create without PIN when strictness requires it
        status: pass
    human_judgment: false
  - id: D5
    description: Room snapshot reports waitingForModerator from policy + absence of privileged roles; participant keys unchanged
    requirement: D-13
    verification:
      - kind: unit
        ref: packages/backend/src/modules/conferences/conference-state.spec.ts#reports waiting when wait policy is on and only a participant is present
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-09-16
status: complete
---

# Phase 16 Plan 06: Entry strictness and wait-for-moderator Summary

**Three entry-strictness levels become personal ConfBridge user-profile lines; wait/end marked only on participants; PIN-required rooms cannot be saved without a PIN**

## Performance

- **Duration:** 12 min
- **Started:** 2026-09-16T02:23:22Z
- **Completed:** 2026-09-16T02:35:00Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- `conferenceEntryPolicy(room)` is the single translator for `token_name` / `token_name_pin` / `token_name_pin_moderator` into PIN, wait, end, and `pinRequiredButMissing`
- `generateConferenceDialplan` emits `user,pin` only when the level requires a non-empty sanitized PIN; `wait_marked` / `end_marked` only on `CONF_ROLE=participant` after the role line
- `assertEntryPolicyConsistent` rejects create/update with `CONFERENCE_PIN_REQUIRED` before the DB write; DTO PIN is ASCII digits 4..32
- `ConferenceRoomSnapshot.waitingForModerator` is computed from cached entry policy and privileged roles; participant field set stays the four D-37 keys

## Task Commits

Each task was committed atomically (TDD RED then GREEN):

1. **Task 1 RED: failing tests for entry policy** - `fd59a47` (test)
2. **Task 1 GREEN: entry policy and user-profile lines** - `153a366` (feat)
3. **Task 2 RED: failing tests for PIN consistency** - `a7f9a2d` (test)
4. **Task 2 GREEN: reject rooms that promise a PIN without one** - `26893c9` (feat)
5. **Task 3 RED: failing tests for waiting-for-moderator snapshot** - `b8b7eaf` (test)
6. **Task 3 GREEN: expose waiting-for-moderator on the room snapshot** - `de17091` (feat)

_Note: TDD tasks have RED then GREEN commits_

## Files Created/Modified

- `conference-entry-policy.util.ts` — `ConferenceEntryStrictness`, `conferenceEntryPolicy`
- `conference-entry-policy.spec.ts` — three levels, inconsistency, column-raised wait
- `conference-dialplan.util.ts` — policy-driven PIN; participant-only wait/end
- `conference-dialplan.util.spec.ts` — three-level line composition
- `create-conference-room.dto.ts` / `update-conference-room.dto.ts` — `CONFERENCE_PIN_PATTERN`
- `conference-rooms.service.ts` — `CONFERENCE_PIN_REQUIRED`, `assertEntryPolicyConsistent`
- `conference-rooms.service.spec.ts` — create/update/DTO PIN cases
- `conference-state.service.ts` — `waitingForModerator` on snapshot from cached policy
- `conference-state.spec.ts` — wait flag and one-event transitions

## Decisions Made

- `conferenceEntryPolicy` does not throw and does not know dialplan — it only translates settings
- Wait is a logical OR of `token_name_pin_moderator` and the `wait_marked` column
- A PIN stored on a `token_name` room is kept but does not emit `user,pin`
- Empty PIN at a PIN-required level is inconsistency, not a silent downgrade
- Owner/moderator never receive `wait_marked` / `end_marked` (D-13)
- `waitingForModerator` is room-level; participant keys stay `channel`, `callerIdNum`, `role`, `talking`, `muted`, `joinedAt`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Full-repo `npm run lint` was not relied on: conference files in this plan pass eslint. Pre-existing `preserve-caught-error` failures outside this plan stay in `deferred-items.md` from 16-05.

## TDD Gate Compliance

- RED commits: `fd59a47`, `a7f9a2d`, `b8b7eaf`
- GREEN commits: `153a366`, `26893c9`, `de17091`
- Sequence holds for all three tasks

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 16-07 can read `waitingForModerator` from the same snapshot/stream as participants
- Live-room UI (16.3) can show a room-level lobby banner without a fifth participant state
- PIN-required rooms are refused at write time; the generator will not emit a silent no-PIN line

## Self-Check: PASSED

---
*Phase: 16-modul-telekonferentsiy-confbridge-webrtc*
*Completed: 2026-09-16*
