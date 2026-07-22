---
phase: 09-call-center-agent-panel
plan: 01
subsystem: database
tags: [sequelize-typescript, mysql, migration, callcenter]

requires: []
provides:
  - "cc_agent_events.event_type ENUM extended with DIALING/CONSULT/ACW"
  - "cc_missed_calls.client_called_back + .personal columns"
  - "cc_operator_settings granular permission/UI/notification columns"
  - "cc_settings role-default permission/UI/notification/autopause JSON columns"
  - "cc_queue_calls.direction + .call_type columns"
  - "shared cc-permissions.types.ts (PermissionSet/UiVisibility/NotificationMatrix/AutoPauseRule)"
  - "migrate-callcenter-phase9-schema.ts idempotent migration, applied to live DB"
affects: [09-03, 09-05, 09-09, 09-11, 09-13]

tech-stack:
  added: []
  patterns:
    - "Standalone idempotent migration script (migrate-missed-calls-unique.ts shape)"
    - "JSON-column role-default + per-operator-override permission storage (no new table)"

key-files:
  created:
    - packages/backend/src/modules/callcenter/models/cc-permissions.types.ts
    - packages/backend/src/modules/callcenter/migrate-callcenter-phase9-schema.ts
  modified:
    - packages/backend/src/modules/callcenter/models/agent-event.model.ts
    - packages/backend/src/modules/callcenter/models/missed-call.model.ts
    - packages/backend/src/modules/callcenter/models/queue-call.model.ts
    - packages/backend/src/modules/callcenter/models/operator-settings.model.ts
    - packages/backend/src/modules/callcenter/models/cc-settings.model.ts

key-decisions:
  - "Role-default permissions stored as JSON on the existing cc_settings tenant singleton (role_permission_defaults keyed by UserLevel), not a new cc_role_permission_defaults table (resolves RESEARCH Open Question #1)"
  - "Extracted shared PermissionSet/UiVisibility/NotificationMatrix/AutoPauseRule types into a new cc-permissions.types.ts so 09-05/09-09/09-13 import instead of redefining (deviation, Rule 2)"
  - "Missed-call number-grouping stays a read-layer concern — no unique index added on caller_id_num, per RESEARCH Pitfall 4"

patterns-established:
  - "Auto-pause rules modeled as a typed discriminated union (missed_count | idle_time | status_duration) stored as JSON, following the alert_thresholds JSON-column precedent"

requirements-completed: [D-09, D-10, D-13, D-16, D-17, D-19, D-34, D-35, D-38, D-39, D-41, D-43]

coverage:
  - id: D1
    description: "cc_agent_events.event_type ENUM accepts DIALING/CONSULT/ACW (D-09/D-13)"
    requirement: "D-09"
    verification:
      - kind: unit
        ref: "npx tsc -p packages/backend/tsconfig.json --noEmit (no new errors)"
        status: pass
      - kind: other
        ref: "migrate-callcenter-phase9-schema.ts run against live DB (ALTER TABLE MODIFY COLUMN applied, idempotent on re-run)"
        status: pass
    human_judgment: false
  - id: D2
    description: "cc_missed_calls gains client_called_back + personal columns without breaking UNIQUE(call_uniqueid) (D-16/D-17/D-19)"
    requirement: "D-16"
    verification:
      - kind: other
        ref: "migrate-callcenter-phase9-schema.ts live-DB run (ADD COLUMN applied, idempotent on re-run); UNIQUE index untouched"
        status: pass
    human_judgment: false
  - id: D3
    description: "cc_operator_settings gains can_spy/spyable/click_to_call/customize_ui/spy_modes/ui_visibility/softphone_placement/notification_matrix (D-38/D-41/D-43)"
    requirement: "D-38"
    verification:
      - kind: other
        ref: "migrate-callcenter-phase9-schema.ts live-DB run, second run reports \"already applied\" for every column"
        status: pass
    human_judgment: false
  - id: D4
    description: "cc_settings gains role_permission_defaults/ui_visibility_defaults/ui_visibility_locks/notification_defaults/notification_locks/autopause_rules (D-39/D-43)"
    requirement: "D-39"
    verification:
      - kind: other
        ref: "migrate-callcenter-phase9-schema.ts live-DB run, second run reports \"already applied\" for every column"
        status: pass
    human_judgment: false
  - id: D5
    description: "cc_queue_calls gains direction + call_type so history covers all channels (D-34/D-35)"
    requirement: "D-34"
    verification:
      - kind: other
        ref: "migrate-callcenter-phase9-schema.ts live-DB run, second run reports \"already applied\" for every column"
        status: pass
    human_judgment: false
  - id: D6
    description: "Migration script is idempotent (safe to re-run) and all five models registered in callcenter.module.ts"
    verification:
      - kind: other
        ref: "Two consecutive runs of migrate-callcenter-phase9-schema.ts; callcenter.module.ts SequelizeModule.forFeature already lists CcAgentEvent/CcMissedCall/CcOperatorSettings/CcSettings/CcQueueCall"
        status: pass
    human_judgment: false

duration: 24min
completed: 2026-07-22
status: complete
---

# Phase 9 Plan 01: Database + Model Foundation Summary

**Extended five Sequelize call-center models (agent-event ENUM, missed-call flags, queue-call direction/type, operator/tenant settings permission-UI-notification JSON columns) and shipped+applied one idempotent MySQL migration covering every column.**

## Performance

- **Duration:** ~24 min
- **Started:** 2026-07-22T10:56:38Z (approx, per prior commit on branch)
- **Completed:** 2026-07-22T11:19:16Z
- **Tasks:** 3/3
- **Files modified:** 7 (5 modified, 2 created)

## Accomplishments
- `cc_agent_events.event_type` ENUM extended with `DIALING`/`CONSULT`/`ACW`, additive to the existing 10 members (D-09/D-13) — timeline events for the new statuses are now representable.
- `cc_missed_calls` gained `client_called_back` and `personal` boolean columns; call-level `UNIQUE(call_uniqueid)` constraint preserved — number-grouping stays a read-layer `GROUP BY` concern (D-16/D-17/D-19/D-20).
- `cc_queue_calls` gained `direction` (`inbound|outbound|personal|internal`) and `call_type` so this table can become the unified call-history source for all channels, not just queue calls (D-34/D-35).
- `cc_operator_settings` gained the full per-operator permission/UI/notification surface: `can_spy`, `spyable`, `click_to_call`, `customize_ui`, `spy_modes` (JSON), `ui_visibility` (JSON), `softphone_placement`, `notification_matrix` (JSON) (D-38/D-41/D-43).
- `cc_settings` gained the role-default half of the same surface as JSON columns keyed by `UserLevel`: `role_permission_defaults`, `ui_visibility_defaults`, `ui_visibility_locks`, `notification_defaults`, `notification_locks`, plus `autopause_rules` (D-15/D-39/D-43) — resolves RESEARCH Open Question #1 (role storage) without a new table.
- New `cc-permissions.types.ts` exports `PermissionSet`, `UiVisibility`, `NotificationMatrix`, `AutoPauseRule` (discriminated union: `missed_count | idle_time | status_duration`), `SpyMode`, `SoftphonePlacement` — single source of truth for 09-05/09-09/09-13.
- `migrate-callcenter-phase9-schema.ts` created and **run twice against the live DB**: first run applied all 20 ALTER statements (1 ENUM MODIFY + 19 ADD COLUMN/backfill), second run confirmed idempotency — every `ADD COLUMN` reported "already applied — ok", the ENUM `MODIFY` re-applied cleanly with no error either time.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend agent-event, missed-call and queue-call models** - `a351d27` (feat)
2. **Task 2: Extend operator-settings + cc-settings models for permissions, UI-customization and notifications** - `e0f07ac` (feat)
3. **Task 3: [BLOCKING] Write and run the Phase 9 idempotent migration script** - `f2414e3` (feat)

**Plan metadata:** commit pending (this SUMMARY + STATE.md/ROADMAP.md/REQUIREMENTS.md, via `gsd-tools query commit`)

## Files Created/Modified
- `packages/backend/src/modules/callcenter/models/agent-event.model.ts` - ENUM += DIALING/CONSULT/ACW
- `packages/backend/src/modules/callcenter/models/missed-call.model.ts` - += client_called_back, personal
- `packages/backend/src/modules/callcenter/models/queue-call.model.ts` - += direction, call_type
- `packages/backend/src/modules/callcenter/models/operator-settings.model.ts` - += can_spy/spyable/click_to_call/customize_ui/spy_modes/ui_visibility/softphone_placement/notification_matrix
- `packages/backend/src/modules/callcenter/models/cc-settings.model.ts` - += role_permission_defaults/ui_visibility_defaults/ui_visibility_locks/notification_defaults/notification_locks/autopause_rules
- `packages/backend/src/modules/callcenter/models/cc-permissions.types.ts` - NEW: shared PermissionSet/UiVisibility/NotificationMatrix/AutoPauseRule/SpyMode/SoftphonePlacement types
- `packages/backend/src/modules/callcenter/migrate-callcenter-phase9-schema.ts` - NEW: idempotent migration for all of the above, applied to live DB

## Decisions Made
- **Role storage (RESEARCH Open Question #1):** stored role defaults as `role_permission_defaults: Partial<Record<UserLevel, Partial<PermissionSet>>>` JSON on the existing `cc_settings` tenant singleton rather than a new `cc_role_permission_defaults` table — mirrors the existing `alert_thresholds` JSON-column precedent exactly and avoids a schema shape the effective-permissions merge (09-05) would need to join across two tables.
- **Shared types file (deviation, Rule 2):** the plan allowed "either inline or a small colocated types file" for `PermissionSet`/`UiVisibility`/`NotificationMatrix`/`AutoPauseRule`; created `cc-permissions.types.ts` as a dedicated file (not listed in the plan's `files_modified` frontmatter) since three downstream plans (09-05, 09-09, 09-13) need to import the exact same shapes — inlining into `operator-settings.model.ts` would force those plans to import from a models file or redefine the types, risking drift.
- **Missed-call grouping:** did not add a unique/secondary index on `caller_id_num` — per RESEARCH Pitfall 4, grouping-by-number for the "smart missed calls" UI (09-09) must happen in the read/query layer (`GROUP BY caller_id_num`), never by relaxing the existing `UNIQUE(call_uniqueid)` invariant.
- **JSON column defaults:** MySQL cannot carry a non-`NULL` literal default cleanly for the `spy_modes` JSON column across all target MySQL versions in this repo's toolchain, so the migration adds the column as nullable and backfills existing rows with `'["listen"]'` in a follow-up `UPDATE ... WHERE spy_modes IS NULL` statement instead of a column-level `DEFAULT`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added dedicated `cc-permissions.types.ts` file (not in plan's `files_modified` list)**
- **Found during:** Task 2
- **Issue:** Plan's action text explicitly asked for "clear TS types/interfaces... either inline or in a small colocated types file so 09-05/09-09/09-13 import them rather than redefining," but the plan frontmatter's `files_modified` list did not enumerate a new types file.
- **Fix:** Created `packages/backend/src/modules/callcenter/models/cc-permissions.types.ts` exporting `PermissionSet`, `UiVisibility`, `NotificationEvent`, `NotificationChannel`, `NotificationMatrix`, `AutoPauseRule`, `SpyMode`, `SoftphonePlacement`; imported by both `operator-settings.model.ts` and `cc-settings.model.ts`.
- **Files modified:** packages/backend/src/modules/callcenter/models/cc-permissions.types.ts (new), operator-settings.model.ts, cc-settings.model.ts
- **Verification:** `npx tsc -p packages/backend/tsconfig.json --noEmit` — no new errors.
- **Committed in:** `e0f07ac` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 — missing critical functionality: shared types for downstream plans)
**Impact on plan:** Necessary to satisfy the plan's own stated intent ("so 09-05/09-09/09-13 import them rather than redefining"). No scope creep — no new runtime behavior, purely TS type declarations.

## Issues Encountered
- **[Pre-existing, out of scope] `npx tsc -p packages/backend/tsconfig.json --noEmit` reports 7 errors in unrelated spec files** (`call-groups.service.spec.ts`, `ivrs.service.spec.ts`, `keyword-matcher.service.spec.ts`) — none touch any file this plan modified. Confirmed the same error set appears both before and after every task's changes in this plan (diffed via repeated tsc runs after each task). Logged to `.planning/phases/09-call-center-agent-panel/deferred-items.md` per scope-boundary rule; not fixed.
- **[Pre-existing, out of scope] `npm run test:cc -w @krasterisk/backend` reports 1 failing test** — `callcenter-chat.service.spec.ts › emitEvent ccChatMessage with recipientUserIds on direct send` fails on `sender_user_id: undefined` / `channel_key: "dm:NaN:NaN"` mismatch. This spec exercises chat messaging, a feature untouched by this plan (models/migration only). Logged to deferred-items.md; not fixed — out of this plan's scope per the deviation rules' "SCOPE BOUNDARY" (only auto-fix issues directly caused by the current task's changes).
- Local shell is PowerShell (Windows), which does not support bash `&&`/heredoc syntax used by the gsd-tools reference commands — commits were made with `git add`/`git commit -F <tmpfile>` instead of chained `&&`/heredoc, with equivalent atomic-commit-per-task effect.
- The live-DB migration run (Task 3) required explicit human approval via the auto-review "smart mode" gate (repository policy treats DB-mutating commands as requiring sign-off) — approved, migration ran successfully, verified idempotent via a second run.

## User Setup Required
None - no external service configuration required. The migration was already applied to the live DB during this plan's execution; no manual DB step remains for the operator.

## Next Phase Readiness
- Live schema now matches all extended models; downstream waves (09-03 AMI/KPI listener, 09-05 permissions/spy, 09-09 missed-calls, 09-11 history/directory, 09-13 settings endpoints) are unblocked on schema — no `[BLOCKING]` schema push remains for any of them.
- `cc-permissions.types.ts` is ready for 09-05/09-09/09-13 to import directly.
- No blockers identified for Wave 2 (09-03 onward).

---
*Phase: 09-call-center-agent-panel*
*Completed: 2026-07-22*
