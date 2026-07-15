---
phase: 06-dialplan-apps-ring-groups-multi-channel-notifications-ux-ove
plan: 04
subsystem: database
tags: [sequelize, call-groups, migration, tenant-isolation, ring-strategy]

# Dependency graph
requires:
  - phase: 06-01
    provides: ICallGroup, ICallGroupMember, RingStrategy, CallGroupMemberType shared types
provides:
  - CallGroup Sequelize model (call_groups table)
  - CallGroupMember Sequelize model (call_group_members table)
  - Idempotent migrate-call-groups-phase6.ts standalone script
affects:
  - 06-05-call-group-dialplan-util
  - 06-06-call-groups-crud
  - 06-10-frontend-rtk-apis
  - 06-11-call-groups-page

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lightweight entity+members schema mirroring queues without agent/MOH columns"
    - "Tenant column vpbx_user_uid mapped to user_uid in models (queue.model precedent)"
    - "Standalone ifNotExists migration with try/catch indexes and FK ALTER"

key-files:
  created:
    - packages/backend/src/modules/call-groups/call-group.model.ts
    - packages/backend/src/modules/call-groups/call-group-member.model.ts
    - packages/backend/src/modules/call-groups/migrate-call-groups-phase6.ts
  modified: []

key-decisions:
  - "Used vpbx_user_uid DB column with field mapping (queue.model precedent) for tenant isolation"
  - "Added idx_call_group_members_group_uid index beyond plan minimum for FK lookup performance"
  - "Deferred MCP/AI tools for call_group entity per CONTEXT (Domain AI Adapter phase)"

patterns-established:
  - "call_groups: uid PK autoincrement, strategy ENUM, ring_time default 25, optional external_context/cid_prefix"
  - "call_group_members: FK call_group_uid ON DELETE CASCADE, position + per-member ring_time default 20"

requirements-completed: [D-01, D-03, D-06, D-07]

# Metrics
duration: 12min
completed: 2026-07-15
---

# Phase 06 Plan 04: Call Group Models + Migration Summary

**Tenant-scoped call_groups and call_group_members Sequelize models with idempotent phase-6 migration (FK cascade, strategy ENUM, ordered members)**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-15T11:13:00Z
- **Completed:** 2026-07-15T11:25:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- `CallGroup` model: `call_groups` table with RingStrategy ENUM, ring_time, external_context, cid_prefix, tenant column
- `CallGroupMember` model: member_type internal/external, value, position, ring_time, tenant column
- `migrate-call-groups-phase6.ts`: idempotent createTable + user_uid indexes + FK ON DELETE CASCADE
- Models typed against shared `ICallGroup` / `ICallGroupMember` from 06-01

## Task Commits

Each task was committed atomically:

1. **Task 1: Create CallGroup and CallGroupMember models** - `7ecee78` (feat)
2. **Task 2: Standalone migration for call_groups + call_group_members** - `5ed299d` (feat)

**Plan metadata:** pending (docs commit)

## Files Created/Modified
- `packages/backend/src/modules/call-groups/call-group.model.ts` - CallGroup Sequelize model
- `packages/backend/src/modules/call-groups/call-group-member.model.ts` - CallGroupMember Sequelize model
- `packages/backend/src/modules/call-groups/migrate-call-groups-phase6.ts` - Standalone idempotent migration

## Decisions Made
- Followed queue.model.ts tenant column pattern (`field: 'vpbx_user_uid'`) for both tables
- Migration uses `vpbx_user_uid` column name to match model field mapping
- Added secondary index on `call_group_uid` for member lookups (Rule 2 tenant/FK correctness)

## Deferred Gaps

**MCP/AI tools for call_group entity:** Backend ARCHITECTURE §6 requires an MCP/AI tool per new entity. CONTEXT explicitly defers AI/MCP for new apps to a later Domain AI Adapter phase. Not implemented in this plan.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Full-project `tsc --noEmit` reports pre-existing errors in ivrs/voice-robots specs (unrelated); new call-groups files compile cleanly
- `gsd-tools` CLI unavailable in this environment; STATE/ROADMAP updated manually

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Schema foundation ready for 06-05 (dialplan util TDD) and 06-06 (CRUD service + module registration)
- Run migration on stand/prod: `npx ts-node src/modules/call-groups/migrate-call-groups-phase6.ts` from packages/backend

## Self-Check: PASSED
- FOUND: packages/backend/src/modules/call-groups/call-group.model.ts
- FOUND: packages/backend/src/modules/call-groups/call-group-member.model.ts
- FOUND: packages/backend/src/modules/call-groups/migrate-call-groups-phase6.ts
- FOUND: commit 7ecee78
- FOUND: commit 5ed299d

---
*Phase: 06-dialplan-apps-ring-groups-multi-channel-notifications-ux-ove*
*Completed: 2026-07-15*
