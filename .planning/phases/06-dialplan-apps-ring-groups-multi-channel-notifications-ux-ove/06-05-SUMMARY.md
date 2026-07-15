---
phase: 06-dialplan-apps-ring-groups-multi-channel-notifications-ux-ove
plan: 05
subsystem: api
tags: [asterisk, dialplan, call-groups, ringall, hunt, memoryhunt, random, tdd]

# Dependency graph
requires:
  - phase: 06-01
    provides: ICallGroup, ICallGroupMember, RingStrategy shared types
  - phase: 06-04
    provides: CallGroup model schema with strategy, ring_time, external_context, cid_prefix
provides:
  - generateGroupDialplan pure function returning {name, lines[]} for group_<uid>_<vpbx> contexts
  - Strategy line builders for ringall, hunt, memoryhunt, random with Gosub/Return semantics
  - Comprehensive unit spec covering all strategies, member types, sanitization, Return contract
affects:
  - 06-06-call-groups-crud
  - 06-11-call-groups-page

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure dialplan generator mirroring phonebook-dialplan {name, lines[]} return shape"
    - "Context idiom: [group_uid_vpbx] + exten => start,1,NoOp + same => n + Return()"
    - "Never Hangup in group context; ExecIf ANSWER Return after per-member Dial steps"
    - "Random v1: RAND pick + GotoIf branches (random first + remaining in order per RESEARCH A1)"

key-files:
  created:
    - packages/backend/src/modules/call-groups/call-group-dialplan.util.ts
    - packages/backend/src/modules/call-groups/call-group-dialplan.util.spec.ts
  modified: []

key-decisions:
  - "memoryhunt growing sets use the newly-added member's ring_time per step"
  - "random remaining-members combined Dial uses group.ring_time (per RESEARCH Pattern 1)"
  - "cid_prefix sanitized via sanitizeDialplanInput; brackets stripped from user prefix"
  - "Call confirmation deferred as extension point (not implemented per plan)"

patterns-established:
  - "Internal member → PJSIP/e<ext>_<vpbx>; external → LOCAL/<num>@<external_context>"
  - "All four strategies terminate with Return(); spec asserts absence of Hangup substring"

requirements-completed: [D-04, D-05, D-06, D-07, D-08, D-09]

# Metrics
duration: 25min
completed: 2026-07-15
---

# Phase 6 Plan 5: Call Group Dialplan Generator Summary

**Pure generateGroupDialplan for four ring strategies with guaranteed Return() semantics and comprehensive TDD coverage**

## Performance

- **Duration:** 25 min
- **Started:** 2026-07-15T11:13:00Z
- **Completed:** 2026-07-15T11:38:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Implemented `generateGroupDialplan(group, members, vpbx)` returning `{ name: 'group_<uid>_<vpbx>', lines }`
- All four strategies (ringall, hunt, memoryhunt, random) emit correct Dial patterns per RESEARCH Pattern 1
- Internal/external member rendering with `sanitizeDialplanInput` on all user values
- Guaranteed `Return()` termination; spec asserts no `Hangup` in any strategy output
- Optional `cid_prefix` emits `Set(CALLERID(name)=...)` before Dial lines

## Task Commits

Each task was committed atomically:

1. **Task 1: RED - spec for all 4 strategies + Return semantics** - `2a86a45` (test)
2. **Task 2: GREEN - implement generateGroupDialplan** - `ec368d2` (feat)

**Plan metadata:** `0e6a4d5` (docs: complete plan)

## Files Created/Modified

- `packages/backend/src/modules/call-groups/call-group-dialplan.util.ts` - Pure dialplan generator for all four ring strategies
- `packages/backend/src/modules/call-groups/call-group-dialplan.util.spec.ts` - 13 tests covering strategies, members, sanitization, Return contract

## Decisions Made

- memoryhunt uses per-step ring_time of the member added at that step (honors D-07 per-member ring_time)
- random strategy v1 uses GotoIf branches per RESEARCH A1 (documented inline); full shuffle deferred
- cid_prefix test uses sanitized prefix without bracket metacharacters (sanitizeDialplanInput strips `[]`)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Escaped Asterisk variable in cid_prefix template literal**
- **Found during:** Task 2 (GREEN implementation)
- **Issue:** `${CALLERID(name)}` in template literal caused ReferenceError at runtime
- **Fix:** Escaped as `\${CALLERID(name)}` in emitted dialplan line
- **Files modified:** packages/backend/src/modules/call-groups/call-group-dialplan.util.ts
- **Committed in:** ec368d2

**2. [Rule 1 - Bug] cid_prefix test used unsanitizable bracket characters**
- **Found during:** Task 2 (GREEN verification)
- **Issue:** Test expected `[Sales]` prefix but sanitizeDialplanInput strips brackets
- **Fix:** Updated test to use `Sales` prefix matching sanitized output
- **Files modified:** packages/backend/src/modules/call-groups/call-group-dialplan.util.spec.ts
- **Committed in:** ec368d2

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes necessary for correct dialplan emission and test accuracy. No scope creep.

## TDD Gate Compliance

- RED commit `2a86a45` (test) exists before GREEN commit `ec368d2` (feat)
- All 13 spec cases pass: `npx jest call-group-dialplan --silent`

## Issues Encountered

- gsd-tools CLI not found at `.cursor/gsd-tools/cli.js`; STATE/ROADMAP updated manually

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `generateGroupDialplan` ready for wiring in CallGroupsService.applyGroup (06-06)
- Category name `group_<uid>_<vpbx>` matches existing `togroup` Gosub target in dialplan.util

## Self-Check: PASSED

- FOUND: packages/backend/src/modules/call-groups/call-group-dialplan.util.ts
- FOUND: packages/backend/src/modules/call-groups/call-group-dialplan.util.spec.ts
- FOUND: 2a86a45
- FOUND: ec368d2

---
*Phase: 06-dialplan-apps-ring-groups-multi-channel-notifications-ux-ove*
*Completed: 2026-07-15*
