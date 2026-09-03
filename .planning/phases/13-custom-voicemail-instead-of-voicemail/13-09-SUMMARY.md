---
phase: 13-custom-voicemail-instead-of-voicemail
plan: 09
subsystem: voicemail
tags: [voicemail, migration, d-54, dry-run, json-actions]

requires:
  - phase: 13-custom-voicemail-instead-of-voicemail
    provides: IVoicemailParams max_duration + ActionType voicemail (13-02)
  - phase: 12-dialplan-apps-editor-refactor-reusable-route-chain-builder
    provides: PHASE12_ACTION_TARGETS six-column inventory + exten→target lift
provides:
  - migrateVoicemailParams pure rewrite (type stays voicemail, max_duration 120)
  - migrate-voicemail-actions.ts --dry-run script over six JSON columns
affects:
  - 13-06 notify (reads expanded params, not implemented here)
  - 13-12 CDR tab
  - ops dry-run against tenant JSON before write

actuals:
  tokens: 3737
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - Dedicated migrateVoicemailParams; Phase 12 migrateAction folds stay untouched
    - Import PHASE12_ACTION_TARGETS instead of forking a seventh column
    - routes.raw_dialplan is SELECT/log of VoiceMail( only — never UPDATE

key-files:
  created:
    - packages/backend/src/modules/voicemail/migrate-voicemail-actions.ts
  modified:
    - packages/backend/src/modules/routes/dialplan-actions-migration.util.ts
    - packages/backend/src/modules/routes/dialplan-actions-migration.util.spec.ts

key-decisions:
  - "migrateVoicemailParams is a dedicated export; migrateAction Phase 12 folds stay untouched"
  - "Script walks PHASE12_ACTION_TARGETS only; backup is phase13-voicemail-actions-<timestamp>.json"
  - "raw_dialplan VoiceMail( hits are logged, never rewritten"

patterns-established:
  - "Pattern: voicemail step migration keeps ActionType voicemail and fills max_duration 120"
  - "Pattern: leftover param keys including telegram channel string are kept (Pitfall 12)"

requirements-completed: [D-54]

coverage:
  - id: D1
    description: migrateVoicemailParams keeps type voicemail, maps exten→target, defaults max_duration 120, is idempotent, passes non-voicemail through, keeps leftover keys
    requirement: D-54
    verification:
      - kind: unit
        ref: packages/backend/src/modules/routes/dialplan-actions-migration.util.spec.ts#migrateVoicemailParams (D-54)
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/routes/migrate-dialplan-actions-phase12.spec.ts#lists exactly the six JSON action-chain columns
        status: pass
    human_judgment: false
  - id: D2
    description: Standalone script imports PHASE12_ACTION_TARGETS (six columns), documents --dry-run first, and never UPDATE-pairs raw_dialplan
    requirement: D-54
    verification:
      - kind: other
        ref: "node -e verify PHASE12_ACTION_TARGETS + six column names + no raw_dialplan UPDATE"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-09-03
status: complete
---

# Phase 13 Plan 09: Voicemail action-params migration Summary

**Pure `migrateVoicemailParams` plus a `--dry-run` script that expands stored `type:'voicemail'` params (`max_duration` 120, exten→target) across the Phase 12 six JSON columns without rewriting `raw_dialplan`**

## Performance

- **Duration:** 8 min
- **Started:** 2026-09-03T02:37:00Z
- **Completed:** 2026-09-03T02:45:14Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Exported `migrateVoicemailParams`: ActionType stays `voicemail`; `exten` lifts to `target`; missing `max_duration` becomes 120; leftover keys (including telegram channel string) stay
- Specs cover empty params, exten-only, already-new idempotence, non-voicemail passthrough; Phase 12 migration suites still pass
- Standalone `migrate-voicemail-actions.ts` walks `PHASE12_ACTION_TARGETS` (routes.actions, route_phonebook_bindings.actions, ivrs.menu_items, voice_robot_keywords.actions, voice_robots.fallback_action, voice_robots.max_retries_action), backups to `.backup/phase13-voicemail-actions-<timestamp>.json` before write, logs `VoiceMail(` hits on `routes.raw_dialplan` without UPDATE

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: migrateVoicemailParams failing specs** - `d9142b4` (test)
2. **Task 1 GREEN: implement migrateVoicemailParams** - `c293b4f` (feat)
3. **Task 2: Standalone --dry-run script over six columns** - `a6f5db5` (feat)

**Plan metadata:** pending docs commit

_Note: TDD Task 1 produced RED then GREEN; no REFACTOR commit (implementation was already minimal)._

## Files Created/Modified
- `packages/backend/src/modules/routes/dialplan-actions-migration.util.ts` - `migrateVoicemailParams` + `VOICEMAIL_DEFAULT_MAX_DURATION`
- `packages/backend/src/modules/routes/dialplan-actions-migration.util.spec.ts` - D-54 describe (empty / exten-only / already-new / leftovers / passthrough / idempotent)
- `packages/backend/src/modules/voicemail/migrate-voicemail-actions.ts` - Phase 12-shaped runner; `--dry-run` first; six-column walk; raw_dialplan log-only

## Decisions Made
- Dedicated `migrateVoicemailParams` export rather than folding voicemail defaults into `migrateAction`, so the ops script only expands voicemail params and Phase 12 folds stay untouched
- Script imports `PHASE12_ACTION_TARGETS` (no seventh column); backup filename is `phase13-voicemail-actions-<timestamp>.json`
- Default mode writes (match Phase 12); header requires `--dry-run` first; `raw_dialplan` is SELECT/log of `VoiceMail(` only

## Deviations from Plan

None - plan executed exactly as written.

**Total deviations:** 0 auto-fixed
**Impact on plan:** None

## Issues Encountered
None

## User Setup Required

None - no external service configuration required. Ops must run `--dry-run` before write against a tenant DB (verify-phase, not this plan). Script was not executed against a live database.

## Next Phase Readiness
Ready for remaining Wave 3 plans (13-06 notify, 13-07/13-08 JWT surfaces, 13-10 UI, 13-12 CDR). Do not run `migrate-voicemail-actions.ts` against a live database from this plan.

## TDD Gate Compliance
RED commit `d9142b4` (`test(13-09):`) preceded GREEN `c293b4f` (`feat(13-09):`). No REFACTOR commit (not required).

## Self-Check: PASSED
- FOUND: `packages/backend/src/modules/routes/dialplan-actions-migration.util.ts`
- FOUND: `packages/backend/src/modules/routes/dialplan-actions-migration.util.spec.ts`
- FOUND: `packages/backend/src/modules/voicemail/migrate-voicemail-actions.ts`
- FOUND: `d9142b4` test(13-09): add failing test for migrateVoicemailParams
- FOUND: `c293b4f` feat(13-09): implement migrateVoicemailParams
- FOUND: `a6f5db5` feat(13-09): add voicemail actions dry-run migration script

---
*Phase: 13-custom-voicemail-instead-of-voicemail*
*Completed: 2026-09-03*
