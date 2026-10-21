---
phase: 16-modul-telekonferentsiy-confbridge-webrtc
plan: 07
subsystem: api
tags: [conferences, confbridge, sse, dto, stale-channels, tdd]

requires:
  - phase: 16-modul-telekonferentsiy-confbridge-webrtc
    provides: ConferenceStateService snapshot/stream, waitingForModerator, resolveCallerRef, assertLiveRoomAccess
provides:
  - toConferenceParticipantDto / toConferenceRoomStateDto as the only outbound room-state mapper
  - Locked six-key participant DTO (ref, displayName, role, speaking, muted, video)
  - POST /conferences/:room_uid/me/video self-only video flag via resolveCallerRef
  - ConferenceStaleChannelSweeperService walking getActiveRoomUids
affects:
  - 16.1 guest SSE must reuse the same mapper
  - 16.3 live-room UI consumes the six-key participant DTO and room-level waitingForModerator

actuals:
  tokens: 7318
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - One outbound mapper, no guest-vs-staff argument
    - Video flag is client-reported; identity from resolveCallerRef, never from the body
    - Stale sweeper walks live rooms, strict 120s threshold, skip overlap, no AMI when disconnected

key-files:
  created:
    - packages/backend/src/modules/conferences/dto/conference-participant.dto.ts
    - packages/backend/src/modules/conferences/conference-participant-dto.spec.ts
    - packages/backend/src/modules/conferences/conference-participant.controller.ts
    - packages/backend/src/modules/conferences/conference-stale-channel-sweeper.service.ts
    - packages/backend/src/modules/conferences/conference-stale-channel-sweeper.service.spec.ts
  modified:
    - packages/backend/src/modules/conferences/conference-sse.controller.ts
    - packages/backend/src/modules/conferences/conference-state.service.ts
    - packages/backend/src/modules/conferences/conference-state.spec.ts
    - packages/backend/src/modules/conferences/conferences.module.ts

key-decisions:
  - "Staff and guests share one mapper; toConferenceParticipantDto / toConferenceRoomStateDto take no guest flag"
  - "Participant DTO is exactly six keys; raised hand and per-channel QoS stay out of v1"
  - "Video is set only for the caller resolved by ConferenceRoomsService.resolveCallerRef"
  - "Sweeper uses getActiveRoomUids; STALE_CHANNEL_THRESHOLD_MS is 120000 and strict"

patterns-established:
  - "Pattern: SSE snapshot and every room event pass through toConferenceRoomStateDto"
  - "Pattern: POST /conferences/:room_uid/me/video never reads a participant ref from the body"
  - "Pattern: ConferenceStaleChannelSweeperService copies the janitor running-flag and isConnected guard"

requirements-completed: [D-36, D-37, R-STALE]

coverage:
  - id: D1
    description: One outbound room-state mapper for staff and guests; SSE first message is the mapped DTO
    requirement: D-36
    verification:
      - kind: unit
        ref: packages/backend/src/modules/conferences/conference-participant-dto.spec.ts#opens SSE with the mapped room DTO, not the internal snapshot
        status: pass
    human_judgment: false
  - id: D2
    description: Participant object has exactly six keys and never leaks Channel, uniqueid, or conf{number}_{uid}
    requirement: D-36
    verification:
      - kind: unit
        ref: packages/backend/src/modules/conferences/conference-participant-dto.spec.ts#exposes exactly six participant keys
        status: pass
    human_judgment: false
  - id: D3
    description: Empty room snapshot uses participants []; missing name uses short number; truncation is by code points
    requirement: D-36
    verification:
      - kind: unit
        ref: packages/backend/src/modules/conferences/conference-participant-dto.spec.ts#maps an empty room to an empty participants array and a boolean wait flag
        status: pass
    human_judgment: false
  - id: D4
    description: Video flag comes from the participant via a self-only endpoint; body ref is ignored
    requirement: D-37
    verification:
      - kind: unit
        ref: packages/backend/src/modules/conferences/conference-state.spec.ts#changes video only for the caller from resolveCallerRef
        status: pass
    human_judgment: false
  - id: D5
    description: Stale-channel sweeper walks live rooms, kicks after a strict 120s silence, and stays silent when empty, overlapping, or AMI-down
    requirement: R-STALE
    verification:
      - kind: unit
        ref: packages/backend/src/modules/conferences/conference-stale-channel-sweeper.service.spec.ts#makes no AMI calls when there are no active rooms
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-09-16
status: complete
---

# Phase 16 Plan 07: Outbound room-state mapper, self-only video, stale sweeper Summary

**One mapper turns internal conference state into a six-field participant DTO for staff and guests; video is self-reported through resolveCallerRef; a minute sweeper kicks channels silent longer than 120s.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-09-16T02:31:32Z
- **Completed:** 2026-09-16T02:46:00Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- `toConferenceParticipantDto` / `toConferenceRoomStateDto` are the only outbound room-state functions; SSE snapshot and events go through them
- Participant payload is locked to `ref`, `displayName`, `role`, `speaking`, `muted`, `video`; Channel / uniqueid / `conf{number}_{uid}` / `vpbx_user_uid` stay inside state
- `POST /conferences/:room_uid/me/video` sets video only for the caller from `resolveCallerRef`; a body `ref` is ignored
- `ConferenceStaleChannelSweeperService` walks `getActiveRoomUids`, uses `STALE_CHANNEL_THRESHOLD_MS = 120000` strictly, skips overlapping ticks, and makes zero AMI calls when there are no rooms or AMI is down

## Task Commits

Each task was committed atomically (TDD RED then GREEN):

1. **Task 1 RED: failing tests for room-state mapper** - `609a39c` (test)
2. **Task 1 GREEN: mapper + SSE wiring** - `4c81ca5` (feat)
3. **Task 2 RED: failing tests for self-only video** - `404584e` (test)
4. **Task 2 GREEN: setVideoState + me/video endpoint** - `0937b17` (feat)
5. **Task 3 RED: failing tests for stale-channel sweeper** - `eb5f4c9` (test)
6. **Task 3 GREEN: sweeper on live rooms** - `e7115d1` (feat)

_Note: TDD tasks have RED then GREEN commits_

## Files Created/Modified

- `dto/conference-participant.dto.ts` — `ConferenceParticipantDto`, `ConferenceRoomStateDto`, code-point truncation
- `conference-participant-dto.spec.ts` — six-key lock, leak tests, empty room, SSE first message
- `conference-sse.controller.ts` — snapshot and stream events mapped through `toConferenceRoomStateDto`
- `conference-state.service.ts` — `video` on join, `setVideoState`, `isStale`, `getLiveChannelPairs`, `getRoomIdentity`
- `conference-state.spec.ts` — video flag and self-state controller cases
- `conference-participant.controller.ts` — `POST :room_uid/me/video`
- `conference-stale-channel-sweeper.service.ts` — `@Cron('*/1 * * * *')` janitor form
- `conference-stale-channel-sweeper.service.spec.ts` — empty/down/overlap/threshold cases
- `conferences.module.ts` — participant controller and sweeper provider

## Decisions Made

- One mapper, no guest-vs-staff argument — two shapes would leak Asterisk names on the forgotten path (D-36)
- Participant keys stay exactly six; raised hand and per-channel QoS stay out of v1 (D-37)
- `waitingForModerator` remains a room-level flag from 16-06, not a fifth participant state
- Video identity is `resolveCallerRef(req.user)` only; the body may contain `enabled` and nothing else that is trusted
- Sweeper source of rooms is in-memory `getActiveRoomUids`; no `ConfbridgeListRooms` on each tick (R-STALE)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Plan-level `npm run test:backend` is red on 15 pre-existing suites outside `conferences` (ai-platform, directories, trunks, adapters). Targeted conference verify is 60/60 green.
- Plan-level `npm run test:frontend` is red on 3 pre-existing `directories.locales` tests (dirty locale WIP). 205/206 files passed. Not fixed (out of scope).
- Full-repo `npm run lint` was not relied on: conference files in this plan pass eslint. Pre-existing `preserve-caught-error` failures stay in `deferred-items.md`.

## TDD Gate Compliance

- RED commits: `609a39c`, `404584e`, `eb5f4c9`
- GREEN commits: `4c81ca5`, `0937b17`, `e7115d1`
- Sequence holds for all three tasks

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 16 core plans 16-01…16-07 are complete; ready for `/gsd-verify-work 16`
- Guest SSE in 16.1 must call `toConferenceRoomStateDto` — do not add a second payload builder
- Live-room UI (16.3) can render the six-key participant DTO and the room-level lobby banner

## Self-Check: PASSED

---
*Phase: 16-modul-telekonferentsiy-confbridge-webrtc*
*Completed: 2026-09-16*
