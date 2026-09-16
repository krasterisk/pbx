---
phase: 16-modul-telekonferentsiy-confbridge-webrtc
plan: 01
subsystem: api
tags: [conferences, confbridge, ami, sse, dialplan, sequelize]

requires:
  - phase: 12-dialplan-apps-editor-refactor-reusable-route-chain-builder
    provides: DialplanApplyService.applyCategories and typed route action contract
  - phase: 10-full-softphone
    provides: WebRTC stack and AMI event-forwarding pattern
provides:
  - Conference room row to tenant dialplan category krsk-conf-{room_uid}
  - Tenant ConfBridge name conf{number}_{uid} via normalizeTarget('conference')
  - Idempotent static bridge profile krsk_conf_sfu
  - AMI Confbridge* listeners to in-memory ConferenceStateService and SSE
  - Five-table conference schema with child Sequelize models and db:setup:conferences
affects:
  - 16-02 tenant CRUD and ephemeral rooms
  - 16-03 route step into conference
  - 16-05 moderators and roles

actuals:
  tokens: 18954
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - Tenant ConfBridge name via normalizeTarget('conference') with passthrough ^conf.+_{uid}$
    - Room settings delivered as Set(CONFBRIDGE(...)) plus static krsk_conf_sfu template
    - Child conference tables have no vpbx_user_uid; tenant scope is FK cascade from conference_rooms
    - AMI Confbridge* listeners resolve ConferenceStateService lazily by string token

key-files:
  created:
    - packages/backend/src/modules/conferences/setup-conferences-schema.ts
    - packages/backend/src/modules/conferences/models/conference-room.model.ts
    - packages/backend/src/modules/conferences/models/conference-room-moderator.model.ts
    - packages/backend/src/modules/conferences/models/conference-guest-token.model.ts
    - packages/backend/src/modules/conferences/models/conference-meeting.model.ts
    - packages/backend/src/modules/conferences/models/conference-meeting-participant.model.ts
    - packages/backend/src/modules/conferences/dto/create-conference-room.dto.ts
    - packages/backend/src/modules/conferences/conference-dialplan.util.ts
    - packages/backend/src/modules/conferences/conference-rooms.service.ts
    - packages/backend/src/modules/conferences/conference-rooms.controller.ts
    - packages/backend/src/modules/conferences/conferences.module.ts
    - packages/backend/src/modules/conferences/confbridge-static-profile.service.ts
    - packages/backend/src/modules/conferences/conference-state.service.ts
    - packages/backend/src/modules/conferences/conference-sse.controller.ts
    - packages/backend/src/modules/conferences/conference-spine.spec.ts
    - packages/backend/src/modules/conferences/conference-schema.spec.ts
    - packages/backend/src/modules/conferences/confbridge-static-profile.service.spec.ts
  modified:
    - packages/backend/src/modules/ami/ami.service.ts
    - packages/backend/src/shared/utils/dialplan-target.util.ts
    - packages/backend/src/app.module.ts
    - packages/backend/package.json
    - .planning/STATE.md

key-decisions:
  - "proceed-locked: D-01 ConfBridge+AMI, D-06 conf{number}_{uid} + krsk-conf-{room_uid}, D-02 Set(CONFBRIDGE(...)) + static krsk_conf_sfu"
  - "Child models carry no tenant column; isolation is FK cascade from conference_rooms"

patterns-established:
  - "Pattern: conferenceRoomContextName(roomUid) is krsk-conf-{pk}, not the public number"
  - "Pattern: created_by comes from JWT sub, never from the DTO"
  - "Pattern: db:setup:conferences sits next to db:setup:directories"

requirements-completed: [D-01, D-02, D-06, D-22, D-25, D-34, D-35, R-PROFILE]

coverage:
  - id: D1
    description: Creating a room applies a tenant dialplan category krsk-conf-{room_uid} with ConfBridge(conf{number}_{uid}, krsk_conf_sfu)
    requirement: D-01
    verification:
      - kind: unit
        ref: packages/backend/src/modules/conferences/conference-spine.spec.ts#normalizeTarget conference
        status: pass
      - kind: integration
        ref: packages/backend/src/modules/conferences/conference-spine.spec.ts#conference spine (16-01)
        status: pass
    human_judgment: false
  - id: D2
    description: Room options ride Set(CONFBRIDGE(...)) after template=krsk_conf_sfu; video_mode is never assigned in dialplan
    requirement: D-02
    verification:
      - kind: unit
        ref: packages/backend/src/modules/conferences/conference-spine.spec.ts#generateConferenceDialplan
        status: pass
    human_judgment: false
  - id: D3
    description: Synthetic ConfbridgeJoin appears in ConferenceStateService snapshot and SSE fullSnapshot
    requirement: D-34
    verification:
      - kind: unit
        ref: packages/backend/src/modules/conferences/conference-spine.spec.ts#ConferenceStateService
        status: pass
    human_judgment: false
  - id: D4
    description: Static krsk_conf_sfu bootstrap is idempotent and reloads app_confbridge.so only after a write
    requirement: R-PROFILE
    verification:
      - kind: unit
        ref: packages/backend/src/modules/conferences/confbridge-static-profile.service.spec.ts
        status: pass
    human_judgment: false
  - id: D5
    description: Five conference tables have DDL and Sequelize models; tenant column exists only on conference_rooms; db:setup:conferences is registered
    requirement: D-06
    verification:
      - kind: unit
        ref: packages/backend/src/modules/conferences/conference-schema.spec.ts#conference schema (16-01 Task 3)
        status: pass
    human_judgment: false
  - id: D6
    description: Human locked D-01 / D-02 / D-06 as proceed-locked after the tracer
    requirement: D-01
    verification: []
    human_judgment: true
    rationale: Irreversible engine, naming, and delivery decisions require an explicit human resume-signal

duration: 12min
completed: 2026-09-16
status: complete
---

# Phase 16 Plan 01: Conference spine Summary

**Tenant ConfBridge rooms generate `krsk-conf-{room_uid}` dialplan, join AMI events reach SSE, and all five domain tables have models plus `db:setup:conferences`.**

## Performance

- **Duration:** 12 min (continuation Tasks 2–3; Task 1 already committed)
- **Started:** 2026-09-16T01:15:00Z
- **Completed:** 2026-09-16T01:27:00Z
- **Tasks:** 3
- **Files modified:** 22

## Accomplishments

- Room create writes a tenant ConfBridge name `conf{number}_{uid}` and applies category `krsk-conf-{room_uid}` with static profile `krsk_conf_sfu`.
- Synthetic `confbridgejoin` updates `ConferenceStateService.getSnapshot` and the SSE `fullSnapshot`; bootstrap of `krsk_conf_sfu` is idempotent.
- User replied `approved` — D-01 / D-02 / D-06 are proceed-locked in STATE.md.
- Four child Sequelize models (no tenant column), five-model `forFeature`, and `db:setup:conferences`.

## Task Commits

1. **Task 1: Спина end-to-end** - `e030d2d` (test RED), `2e005b7` (feat GREEN)
2. **Task 2: Checkpoint D-01 / D-02 / D-06** - `2aceb6e` (docs)
3. **Task 3: Child models and schema setup** - `5b94d23` (test RED), `a6a5a40` (feat GREEN)

**Plan metadata:** pending `docs(16-01): complete conference spine plan`

_Note: TDD tasks have RED then GREEN commits._

## Files Created/Modified

- `packages/backend/src/modules/conferences/setup-conferences-schema.ts` - Five `CREATE TABLE IF NOT EXISTS` statements
- `packages/backend/src/modules/conferences/models/conference-room.model.ts` - Root room model with `user_uid` → `vpbx_user_uid`
- `packages/backend/src/modules/conferences/models/conference-room-moderator.model.ts` - Child moderator rows
- `packages/backend/src/modules/conferences/models/conference-guest-token.model.ts` - Opaque `token` STRING(64)
- `packages/backend/src/modules/conferences/models/conference-meeting.model.ts` - Meeting history with nullable `ended_at`
- `packages/backend/src/modules/conferences/models/conference-meeting-participant.model.ts` - Meeting participants
- `packages/backend/src/modules/conferences/conference-dialplan.util.ts` - Category generator
- `packages/backend/src/modules/conferences/conference-rooms.service.ts` / `conference-rooms.controller.ts` - Create/read + JWT `created_by`
- `packages/backend/src/modules/conferences/confbridge-static-profile.service.ts` - Idempotent `krsk_conf_sfu` bootstrap
- `packages/backend/src/modules/conferences/conference-state.service.ts` / `conference-sse.controller.ts` - In-memory state + SSE
- `packages/backend/src/modules/ami/ami.service.ts` - Lowercase `confbridge*` listeners
- `packages/backend/src/shared/utils/dialplan-target.util.ts` - `TargetKind` `'conference'`
- `packages/backend/package.json` - `db:setup:conferences`

## Decisions Made

- proceed-locked after Task 2: keep D-01 (ConfBridge+AMI), D-06 (`conf{number}_{uid}` + `krsk-conf-{room_uid}`), D-02 (`Set(CONFBRIDGE(...))` + static `krsk_conf_sfu`). User replied `approved`. Do not amend naming, delivery, or engine.

## Deviations from Plan

None - plan executed exactly as written.

Workspace `npm run lint` is red on pre-existing `packages/backend/src/modules/ai-platform/read-adapters-*.spec.ts` `preserve-caught-error` findings. Conference files lint clean (`eslint src/modules/conferences/**/*.ts --max-warnings 0`). Not fixed (out of scope).

---

**Total deviations:** 0 auto-fixed
**Impact on plan:** None

## Issues Encountered

None on the conference path. Full-workspace lint is already red outside this plan.

## TDD Gate Compliance

- Task 1 RED `e030d2d` then GREEN `2e005b7`
- Task 3 RED `5b94d23` then GREEN `a6a5a40`

## User Setup Required

None - no external service configuration required.

Live Asterisk check from the plan (`confbridge show profile bridge krsk_conf_sfu` after backend start) is deferred to `/gsd-verify-work` and does not block this commit.

## Next Phase Readiness

- Wave 2 (`16-02`) can start: CRUD re-apply/delete, ephemeral rooms, absorb `addToConference`.
- Naming and delivery are locked; later plans must not rename `conf{number}_{uid}` or `krsk-conf-{room_uid}`.

---
*Phase: 16-modul-telekonferentsiy-confbridge-webrtc*
*Completed: 2026-09-16*

## Self-Check: PASSED
