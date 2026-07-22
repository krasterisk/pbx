---
phase: 09-call-center-agent-panel
plan: 05
subsystem: api
tags: [nestjs, sequelize, rbac, permissions, asterisk-ami, call-center]

requires:
  - phase: 09-01
    provides: "cc_operator_settings can_spy/spyable/click_to_call/customize_ui/spy_modes columns; cc_settings role_permission_defaults JSON; cc-permissions.types.ts (PermissionSet/SpyMode)"
provides:
  - "CallCenterPermissionsService.getEffective(userUid, operatorUserId) — server-authoritative role-default + per-operator-override + lock merge"
  - "CallCenterPermissionsService.assert()/assertSpyMode() — ForbiddenException helpers for downstream capability gates"
  - "cc_settings.permission_locks JSON column (+ PermissionLocks type) — per-right lock flags keyed by UserLevel"
  - "CallCenterService.peerSpy(requesterUserId, targetInterface, mode, userUid) — coworker ChanSpy, permission+scope+audit gated"
  - "POST /callcenter/agent/peer-spy + PeerSpyDto"
affects: [09-08, 09-09, 09-13]

tech-stack:
  added: []
  patterns:
    - "Effective-permission resolver: role default (JSON keyed by UserLevel) overlaid by per-operator column value, short-circuited by a per-right lock flag — single service, no ad hoc merge logic per capability"
    - "Peer-scoped ChanSpy: shared-online-queue check substitutes for a dedicated 'assigned queues' table, since a supervisor's own queue membership (if logged in as an agent) already defines their peer-spy scope"

key-files:
  created:
    - packages/backend/src/modules/callcenter/callcenter-permissions.service.ts
    - packages/backend/src/modules/callcenter/callcenter-permissions.service.spec.ts
    - packages/backend/src/modules/callcenter/dto/callcenter-permissions.dto.ts
    - packages/backend/src/modules/callcenter/migrate-callcenter-permission-locks.ts
  modified:
    - packages/backend/src/modules/callcenter/callcenter.service.ts
    - packages/backend/src/modules/callcenter/callcenter.service.spec.ts
    - packages/backend/src/modules/callcenter/callcenter.controller.ts
    - packages/backend/src/modules/callcenter/callcenter.module.ts
    - packages/backend/src/modules/callcenter/models/cc-permissions.types.ts
    - packages/backend/src/modules/callcenter/models/cc-settings.model.ts

key-decisions:
  - "Added a new cc_settings.permission_locks JSON column (idempotent migration, applied to live DB) — 09-01 shipped ui_visibility_locks/notification_locks but no sibling lock column for role_permission_defaults, and this plan's own Task 1 behavior spec requires per-right lock enforcement (D-06/D-39)"
  - "peerSpy's supervisor scoping (D-25) is implemented via the same shared-online-queue check every peer uses, not a new 'assigned queues' table — no such table exists anywhere in the codebase, and per STATE.md Phase 7 decision supervisors can log in as agents themselves (/callcenter/agent unguarded), so their own AgentState.queues naturally is their peer-spy scope; the existing tenant-wide supervisor/spy endpoint is untouched and out of scope for this plan"
  - "Reused the existing Set-membership assertSupervisor idiom (callcenter-settings.controller.ts) as the reference pattern but did not touch callcenter.controller.ts's numeric-compare assertSupervisor — the peer-spy route intentionally does not call assertSupervisor at all (permission-gated in the service), so the divergence between the two existing assertSupervisor copies remains unconsolidated, as instructed"

requirements-completed: [D-21, D-22, D-23, D-24, D-25, D-26, D-38, D-39]

coverage:
  - id: D1
    description: "getEffective merges role default with per-operator override, honouring per-right locks (D-38/D-39/D-06)"
    requirement: "D-38"
    verification:
      - kind: unit
        ref: "callcenter-permissions.service.spec.ts#getEffective (5 cases: safe defaults, pure role default, unlocked override, lock precedence, mixed lock/unlock)"
        status: pass
    human_judgment: false
  - id: D2
    description: "assert()/assertSpyMode() throw ForbiddenException when the effective right/mode is not granted"
    requirement: "D-39"
    verification:
      - kind: unit
        ref: "callcenter-permissions.service.spec.ts#assert, #assertSpyMode (4 cases)"
        status: pass
    human_judgment: false
  - id: D3
    description: "peerSpy rejects unless target IN_CALL, shared online queue, target spyable, requester can_spy, mode in spy_modes (D-21/D-22/D-23)"
    requirement: "D-21"
    verification:
      - kind: unit
        ref: "callcenter.service.spec.ts#peerSpy (5 rejection-branch cases + requester-not-logged-in case)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Audit-log row written via LoggerService.logAction before the AMI originate call; listen mode invokes ChanSpy with the quiet option (D-24)"
    requirement: "D-24"
    verification:
      - kind: unit
        ref: "callcenter.service.spec.ts#peerSpy 'writes the audit log before AMI originate...' (asserts logAction call args + invocationCallOrder before ami.originate)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Cross-tenant target rejected; supervisor peer-spy scope limited to shared queues, not tenant-wide (D-25/D-26)"
    requirement: "D-25"
    verification:
      - kind: unit
        ref: "callcenter.service.spec.ts#peerSpy 'rejects a cross-tenant target...'"
        status: pass
    human_judgment: false
  - id: D6
    description: "POST /callcenter/agent/peer-spy wired with JWT-derived ids (never client-supplied userUid), not gated by assertSupervisor"
    requirement: "D-38"
    verification:
      - kind: unit
        ref: "npx jest --testPathPattern=\"modules/callcenter\" --no-coverage (207/208 passing — 1 pre-existing unrelated failure)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Manual verification of ChanSpy option strings + event casing against a live Asterisk instance"
    verification: []
    human_judgment: true
    rationale: "RESEARCH explicitly defers AMI ChanSpy field/casing verification to 09-VALIDATION Manual-Only — cannot be confirmed without a live PBX; peerSpy reuses the exact originate()/ChanSpy(...) shape already used (and already flagged for the same manual check) by the pre-existing supervisorSpy"

duration: ~55min
completed: 2026-07-22
status: complete
---

# Phase 9 Plan 05: Granular Permissions + Peer ChanSpy Summary

**Server-authoritative `CallCenterPermissionsService.getEffective` (role default + per-operator override + per-right lock merge) and a fully-gated, audited `peerSpy` coworker ChanSpy method scoped by shared online queue.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 3/3
- **Files modified:** 10 (6 modified, 4 created)

## Accomplishments
- `CallCenterPermissionsService.getEffective(userUid, operatorUserId)` is now the single server-authoritative resolver for `can_spy`/`spyable`/`spy_modes`/`click_to_call`/`customize_ui`: role default (`cc_settings.role_permission_defaults`, keyed by the operator's `UserLevel`) overlaid by the per-operator column value on `cc_operator_settings`, unless a per-right lock is set — in which case the role default always wins, even if the operator's own column already holds a different value (D-06/D-38/D-39). Missing operator row → pure role default; missing role default → hardcoded safe defaults (`spyable=true`, everything else `false`, `spy_modes=['listen']`).
- `assert(userUid, operatorUserId, right)` and `assertSpyMode(userUid, operatorUserId, mode)` throw `ForbiddenException` when the effective right/mode is not granted — the reusable gate every downstream capability (this plan's `peerSpy`, and later click-to-call/customize_ui) consults instead of re-deriving the merge logic.
- Added a `permission_locks` JSON column to `cc_settings` (idempotent migration, applied twice-verified-pattern to the live DB) — 09-01 shipped `ui_visibility_locks`/`notification_locks` for the other two settings categories but no sibling lock column for `role_permission_defaults`, and this plan's own Task 1 behavior spec requires lock enforcement to be testable and real, not a stub.
- `CallCenterService.peerSpy(requesterUserId, targetInterface, mode, userUid)` adds coworker↔coworker ChanSpy with the full gate the existing supervisor-only `supervisorSpy` lacks: target must be `IN_CALL` → requester and target share an online queue → target `spyable` → requester `can_spy` → `mode ∈` requester's `spy_modes` → an audit-log row (`LoggerService.logAction`, D-24) written *before* the AMI `originate()` call → `ChanSpy(target,q|w|B)` via the exact same `originate()`/dialplan-app shape `supervisorSpy` already uses (no second/raw AMI path). Listen mode never signals the target (D-24's "classic silent QA" requirement holds because `ChanSpy`'s `q` option is inherently silent — no extra suppression logic needed).
- `POST /callcenter/agent/peer-spy` (+ `PeerSpyDto`) is wired with ids exclusively from the JWT (`req.user.sub`/`req.user.vpbx_user_uid`) — never client-supplied — and is deliberately **not** gated by `assertSupervisor`; the permission gate lives entirely in the service, so a supervisor calling this route gets no special bypass beyond their own queue membership.
- Noted, but did not touch, the pre-existing divergence between the two `assertSupervisor` implementations in this codebase (`callcenter.controller.ts`'s numeric `level < 3` vs. `callcenter-settings.controller.ts`'s `Set`-membership version) — per the plan's explicit instruction, flagged here for future consolidation rather than silently rewritten mid-phase.

## Task Commits

Each task was committed atomically:

1. **Task 1: CallCenterPermissionsService (role-default + override + lock merge)** - `d3705f0` (feat)
2. **Task 2: peerSpy service method with permission + scope + audit gate** - `1b337c2` (feat)
3. **Task 3: peer-spy endpoint + DTO** - `c8e1f69` (feat)

**Plan metadata:** commit pending (this SUMMARY + STATE.md/ROADMAP.md, via `gsd-tools query commit`)

## Files Created/Modified
- `packages/backend/src/modules/callcenter/callcenter-permissions.service.ts` - NEW: `getEffective`/`assert`/`assertSpyMode`
- `packages/backend/src/modules/callcenter/callcenter-permissions.service.spec.ts` - NEW: 9 unit tests (merge, lock precedence, missing rows, assert throwing)
- `packages/backend/src/modules/callcenter/models/cc-permissions.types.ts` - += `PermissionLocks` type
- `packages/backend/src/modules/callcenter/models/cc-settings.model.ts` - += `permission_locks` column
- `packages/backend/src/modules/callcenter/migrate-callcenter-permission-locks.ts` - NEW: idempotent migration, applied to live DB
- `packages/backend/src/modules/callcenter/callcenter.service.ts` - += `peerSpy`; new `CallCenterPermissionsService`/`LoggerService` constructor deps
- `packages/backend/src/modules/callcenter/callcenter.service.spec.ts` - += 8 `peerSpy` test cases; updated constructor stub wiring
- `packages/backend/src/modules/callcenter/callcenter.controller.ts` - += `POST /callcenter/agent/peer-spy`
- `packages/backend/src/modules/callcenter/dto/callcenter-permissions.dto.ts` - NEW: `PeerSpyDto`
- `packages/backend/src/modules/callcenter/callcenter.module.ts` - registers `CallCenterPermissionsService`; imports `LoggerModule`

## Decisions Made
- **`permission_locks` schema gap (deviation, Rule 2/3):** see key-decisions above — added the missing sibling lock column following the exact `ui_visibility_locks`/`notification_locks` pattern 09-01 already established, rather than inventing a different lock-storage shape or skipping lock enforcement.
- **Supervisor scope via shared-queue check, not a new table (D-25):** no "assigned queues" table exists anywhere in this codebase for supervisors; since Phase 7 already allows supervisors to log in as agents (`/callcenter/agent` unguarded), their own `AgentState.queues` is the natural, already-existing definition of "assigned queues" for the peer-spy path. This avoids a Rule-4 architectural addition (new table) the plan did not ask for, and keeps the existing tenant-wide `supervisor/spy` endpoint (which this plan does not touch) as the separate, broader tool it already is.
- **Requester's own logged-in interface used for the spy channel**, not a `User.extension` lookup like `supervisorSpy` does — `peerSpy`'s requester is, by construction, already a logged-in `AgentState` (the shared-queue check requires it), so `requesterAgent.interface` is the more accurate originate-from channel than re-deriving it from the `users` table.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2/3 - Missing Critical / Blocking] Added `cc_settings.permission_locks` column (not in the plan's `files_modified` list)**
- **Found during:** Task 1
- **Issue:** The plan's Task 1 `<behavior>` explicitly requires "UNLESS the tenant lock for that right is set (locked → role default wins, override ignored)" and its acceptance criteria require lock precedence to be unit-tested. No column stores per-right lock flags for `PermissionSet` anywhere in the schema — 09-01 added `ui_visibility_locks`/`notification_locks` for the other two settings categories but not a sibling for `role_permission_defaults`.
- **Fix:** Added `permission_locks: Partial<Record<UserLevel, PermissionLocks>> | null` to `CcSettings`, a `PermissionLocks` type to `cc-permissions.types.ts`, and a new idempotent migration script (`migrate-callcenter-permission-locks.ts`, following the exact `alterIdempotent`/dotenv/try-catch pattern from `migrate-callcenter-phase9-schema.ts`) — run against the live DB (`[migration] cc_settings.permission_locks: applied`).
- **Files modified:** `models/cc-permissions.types.ts`, `models/cc-settings.model.ts`, `migrate-callcenter-permission-locks.ts` (new)
- **Verification:** `callcenter-permissions.service.spec.ts` lock-precedence tests pass; live migration ran successfully with the same guarded idempotent-ALTER pattern already proven twice in 09-01.
- **Committed in:** `d3705f0` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2/3 — missing schema column required by this task's own stated behavior)
**Impact on plan:** Necessary to satisfy Task 1's own explicit lock-precedence requirement and acceptance criteria. No scope creep — purely a sibling column to two already-shipped lock columns of the identical shape, for the identical purpose (D-06 self-override prevention).

## Issues Encountered
- Did not re-run the `permission_locks` migration a second time to reconfirm idempotency (the guard's auto-review policy treats a second live-DB-mutating pass as unnecessary risk once the first run already succeeded) — the `alterIdempotent` helper is byte-for-byte the same guarded pattern 09-01 already verified idempotent twice for 20 other columns, so this is a low-risk, well-precedented gap, not an unverified change.
- **[Pre-existing, out of scope] `callcenter-chat.service.spec.ts` fails** — same `sender_user_id: undefined` / `channel_key: "dm:NaN:NaN"` mismatch already documented as pre-existing in 09-01-SUMMARY.md and 09-03-SUMMARY.md. Not touched by this plan.
- **[Pre-existing, out of scope] `npx tsc -p packages/backend/tsconfig.json --noEmit` reports the same 7 errors** documented as pre-existing in 09-01/09-03 SUMMARYs (`call-groups.service.spec.ts`, `ivrs.service.spec.ts`, `keyword-matcher.service.spec.ts`) — confirmed identical before and after every task's changes in this plan.
- Local shell is PowerShell (Windows), which does not support bash heredoc syntax used by the reference commit commands — commits were made via `git commit -F <tmpfile>` instead, with equivalent atomic-commit-per-task effect.

## User Setup Required
None - no external service configuration required. The `permission_locks` migration was already applied to the live DB during this plan's execution; no manual DB step remains for the operator.

## Next Phase Readiness
- `CallCenterPermissionsService.getEffective`/`assert`/`assertSpyMode` are ready for 09-08 (Coworkers tab ChanSpy trigger UI), 09-09 (click-to-call gating), and 09-13 (permissions settings endpoints/UI) to consume directly — no further merge-logic work needed downstream.
- `peerSpy` + `POST /callcenter/agent/peer-spy` are ready for 09-08's Coworkers-tab ChanSpy mode picker to call.
- Manual verification of ChanSpy option strings/event casing against a live Asterisk instance remains deferred to 09-VALIDATION (Manual-Only), same as the pre-existing `supervisorSpy` — `peerSpy` reuses the identical `originate()`/`ChanSpy(...)` invocation shape, so it carries the same (already-flagged) manual-verification need, not a new one.
- No blockers identified for downstream Wave 2+ plans (09-04, 09-06, 09-07, 09-08, 09-09, 09-13 can all proceed).

## Self-Check: PASSED

All 10 created/modified source files verified present on disk with expected content; all 3 task commit hashes (`d3705f0`, `1b337c2`, `c8e1f69`) verified present in `git log`. `npx jest --testPathPattern="modules/callcenter" --no-coverage`: 207/208 passing (1 pre-existing unrelated failure, documented above). `npx tsc -p packages/backend/tsconfig.json --noEmit`: same 7 pre-existing unrelated errors, no new errors introduced.

---
*Phase: 09-call-center-agent-panel*
*Completed: 2026-07-22*
