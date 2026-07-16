---
phase: 06-dialplan-apps-ring-groups-multi-channel-notifications-ux-ove
plan: 15
subsystem: api
tags: [ami, CreateConfig, dialplan, call-groups, sequelize, gap-closure]

requires:
  - phase: 06-06
    provides: CallGroupsService CRUD + DialplanApplyService apply path
provides:
  - AMI CreateConfig ensure-file before UpdateConfig for first-time krasterisk/*/*.conf
  - CallGroups post-commit AMI apply without rollback-after-commit
  - Ops mkdir note beside #include krasterisk/*/*.conf contract
affects: [uat-phase-06, dialplan-apply, call-groups, routes]

tech-stack:
  added: []
  patterns:
    - "ensureConfigFile via AMI CreateConfig once per applyCategories; swallow already-exists"
    - "committed boolean — rollback only when commit has not finished; post-commit AMI errors logged not rethrown"

key-files:
  created: []
  modified:
    - packages/backend/src/modules/ami/dialplan-apply.service.ts
    - packages/backend/src/modules/ami/dialplan-apply.service.spec.ts
    - packages/backend/src/modules/call-groups/call-groups.service.ts
    - packages/backend/src/modules/call-groups/call-groups.service.spec.ts
    - packages/backend/src/modules/system-settings/dialplan-subroutines.service.ts

key-decisions:
  - "CreateConfig once per applyCategories (not per category); deleteCategories skips CreateConfig"
  - "AMI failure after CallGroups commit returns DB success (queues reloadQueues swallow pattern)"
  - "Do not treat escalated-privileges as file-exists — still means missing parent dir or true restriction"

patterns-established:
  - "DialplanApplyService: CreateConfig → DelCat → NewCat → Append → optional reload"
  - "Post-commit side effects outside rollback path with committed guard"

requirements-completed: [D-01, D-08]

duration: 8min
completed: 2026-07-16
---

# Phase 06 Plan 15: AMI CreateConfig + CallGroups Rollback Summary

**Gap closure: DialplanApplyService ensures conf files via AMI CreateConfig before UpdateConfig; CallGroupsService never rolls back after commit so AMI failure no longer masks DB success with Sequelize state:commit**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-16T05:39:06Z
- **Completed:** 2026-07-16T05:47:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- First apply to never-created `krasterisk/*/*.conf` issues CreateConfig once, then DelCat/NewCat/Append (unblocks groups + routes UAT)
- Idempotent CreateConfig: already-exists swallowed; real failures (e.g. missing parent dir / privileges) logged and rethrown before UpdateConfig
- Call group create/update/remove use `committed` guard — AMI apply/remove errors logged, API returns persisted DB result
- Ops mkdir for `krasterisk/{groups,routes,phonebooks,subroutines}` documented beside `#include krasterisk/*/*.conf` in dialplan-subroutines JSDoc

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1 RED:** `0fd7fa2` — test(06-15): add failing CreateConfig ensure-file tests
2. **Task 1 GREEN:** `89f4acd` — feat(06-15): ensure AMI CreateConfig before UpdateConfig
3. **Task 2 RED:** `9b9c3b4` — test(06-15): add failing post-commit AMI rollback tests
4. **Task 2 GREEN:** `ca9ab4c` — fix(06-15): never rollback CallGroups after commit

**Plan metadata:** (pending docs commit)

## Files Created/Modified

- `packages/backend/src/modules/ami/dialplan-apply.service.ts` — `ensureConfigFile` + CreateConfig sequence
- `packages/backend/src/modules/ami/dialplan-apply.service.spec.ts` — CreateConfig once / already-exists / abort / call-count updates
- `packages/backend/src/modules/call-groups/call-groups.service.ts` — post-commit AMI outside rollback path
- `packages/backend/src/modules/call-groups/call-groups.service.spec.ts` — AMI-after-commit and pre-commit rollback cases
- `packages/backend/src/modules/system-settings/dialplan-subroutines.service.ts` — ops mkdir note next to `#include` contract

## Decisions Made

- CreateConfig once per `applyCategories` call (not per category); `deleteCategories` unchanged (no CreateConfig)
- Post-commit AMI failures: log + return DB success (do not rethrow) — mirrors queues `reloadQueues` swallow intent
- `"File requires escalated privileges"` is never treated as already-exists success

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- RED false-positive: "already exists" test initially passed without CreateConfig because it only asserted NewCat ran — tightened to assert first action is CreateConfig before RED commit

## User Setup Required

**Asterisk host (once per stand):** AMI CreateConfig cannot create parent directories.

```bash
mkdir -p $AST_CONFIG_DIR/krasterisk/{groups,routes,phonebooks,subroutines} && chown -R asterisk:asterisk $AST_CONFIG_DIR/krasterisk
```

Then retest UAT Test 1 / 10 / 11 (call groups + first-time route confs).

## Next Phase Readiness

- Ready for UAT retest of call-group save and first-time route conf creation after ops mkdir
- Plan 06-16 (CallerId/TrunkCarousel single-surface hints) remains for remaining gap closure

## TDD Gate Compliance

- RED commits: `0fd7fa2`, `9b9c3b4`
- GREEN commits: `89f4acd`, `ca9ab4c`
- No REFACTOR commits needed

## Self-Check: PASSED

- All 5 modified source/doc files present
- Commits `0fd7fa2`, `89f4acd`, `9b9c3b4`, `ca9ab4c` present in git log
- Verification: 19/19 tests passed (`dialplan-apply` + `call-groups` specs)

---
*Phase: 06-dialplan-apps-ring-groups-multi-channel-notifications-ux-ove*
*Completed: 2026-07-16*
