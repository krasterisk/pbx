---
phase: 12-dialplan-apps-editor-refactor-reusable-route-chain-builder
plan: 12
subsystem: dialplan
tags: [migration, migrateAction, ValueSource, playback, notify, hard-remove]

requires:
  - phase: 12-10
    provides: emitPlayback + dual-read playprompt until this plan
  - phase: 12-11
    provides: emitNotifyDialplan + dual-read sendmail/telegram until this plan
provides:
  - migrateAction pure rewrite (D-12/D-20/D-28/D-51)
  - migrate-dialplan-actions-phase12.ts with --dry-run and .backup/
  - hard-remove tofax/asr/keywords plus dual-read playprompt/sendmail/sendmailpeer/telegram
affects:
  - 12-13 per-app expansion on the post-migration ActionType set
  - 12-17 live UAT of migrated chains

tech-stack:
  added: []
  patterns:
    - "migrateAction is the only rewrite; the script only walks rows and writes"
    - "unknown-state: unmapped types stay in data and surface as UnknownActionCard"
    - "dual-read ends here: generator/registry no longer accept folded aliases"

key-files:
  created:
    - packages/backend/src/modules/routes/dialplan-actions-migration.util.ts
    - packages/backend/src/modules/routes/dialplan-actions-migration.util.spec.ts
    - packages/backend/src/modules/routes/migrate-dialplan-actions-phase12.ts
    - packages/backend/src/modules/routes/migrate-dialplan-actions-phase12.spec.ts
  modified:
    - packages/shared/src/types/route.types.ts
    - packages/shared/src/types/dialplan-action-meta.ts
    - packages/backend/src/modules/routes/dto/route-action.dto.ts
    - packages/backend/src/modules/routes/dto/dialplan-params/index.ts
    - packages/backend/src/modules/routes/dto/dialplan-params/integration.params.dto.ts
    - packages/backend/src/shared/utils/dialplan.util.ts
    - packages/frontend/src/features/dialplan-apps/model/registry.ts
    - packages/frontend/src/features/dialplan-apps/ui/apps/GenericApp/GenericApp.tsx
    - packages/frontend/src/features/dialplan-apps/ui/apps/ExtenApp/ExtenApp.tsx
    - .gitignore
  deleted:
    - packages/frontend/src/features/dialplan-apps/ui/apps/PromptApp/PromptApp.tsx

key-decisions:
  - "unknown-state: asr/tofax/keywords stay in data as unmapped (not dropped)"
  - "voicemail is not removed — Phase 12b"
  - "live write approved with the word write after --dry-run"
  - "t(key, fallback) — dirty locale files not staged"

patterns-established:
  - "JSON action-chain inventory is 6 columns / 5 tables; raw_dialplan is never rewritten"
  - ".backup/ is gitignored and holds all-tenant JSON until migration is confirmed"

requirements-completed: [D-12, D-20, D-28, D-29, D-51]

coverage:
  - id: D1
    description: migrateAction rewrites ValueSource, playback fold, notify fold; remainder keys kept; unmapped unchanged
    requirement: D-12
    verification:
      - kind: unit
        ref: packages/backend/src/modules/routes/dialplan-actions-migration.util.spec.ts#is idempotent
        status: pass
    human_judgment: false
  - id: D2
    description: __USE_EXTEN__ becomes target.route_pattern; sentinel remains only in migrateAction + spec
    requirement: D-20
    verification:
      - kind: unit
        ref: packages/backend/src/modules/routes/dialplan-actions-migration.util.spec.ts#D-20 toexten sentinel
        status: pass
    human_judgment: false
  - id: D3
    description: playprompt→plain, playback→control, background→menu
    requirement: D-51
    verification:
      - kind: unit
        ref: packages/backend/src/modules/routes/dialplan-actions-migration.util.spec.ts#D-51 playprompt
        status: pass
    human_judgment: false
  - id: D4
    description: sendmail/sendmailpeer/telegram fold into notify channels
    requirement: D-28
    verification:
      - kind: unit
        ref: packages/backend/src/modules/routes/dialplan-actions-migration.util.spec.ts#D-28 sendmail
        status: pass
    human_judgment: false
  - id: D5
    description: dry-run/write script walks 6 targets, backups, idempotent second pass
    requirement: D-12
    verification:
      - kind: unit
        ref: packages/backend/src/modules/routes/migrate-dialplan-actions-phase12.spec.ts#calls migrateAction once per action
        status: pass
      - kind: other
        ref: npx ts-node migrate-dialplan-actions-phase12.ts --dry-run after write → rowsChanged=0
        status: pass
    human_judgment: false
  - id: D6
    description: tofax/asr/keywords + dual-read aliases removed; ActionType/DTO/registry sets match at 23; voicemail remains
    requirement: D-29
    verification:
      - kind: unit
        ref: packages/backend/src/modules/routes/dto/dialplan-params/dialplan-params.spec.ts#DIALPLAN_ACTION_META keys match ActionTypesList
        status: pass
      - kind: unit
        ref: packages/frontend/src/features/dialplan-apps/ui/UnknownActionCard/UnknownActionCard.test.tsx#keeps registry keys in sync
        status: pass
    human_judgment: false

duration: 90min
completed: 2026-08-20
status: complete
---

# Phase 12 Plan 12: Params migration + legacy hard-remove Summary

**Idempotent `migrateAction` + live rewrite of 6 JSON action-chain columns, then hard-remove of `tofax`/`asr`/`keywords` and dual-read aliases**

## Performance

- **Duration:** ~90 min active (paused overnight on live DB write)
- **Started:** 2026-08-19T10:53:45Z
- **Completed:** 2026-08-20T01:55:00Z
- **Tasks:** 3/3 (decision + TDD util + script + hard-remove)
- **Files modified:** 22

## Accomplishments

- Checkpoint: **unknown-state** (unmapped steps stay visible) + **voicemail not deleted**. Live write approved with `write`.
- `migrateAction` covers D-20 ValueSource, D-51 playback fold, D-28 notify fold, remainder-key keep, idempotency, unmapped passthrough.
- Script inventory (grep + RESEARCH, **6 columns / 5 tables**):
  1. `routes.actions`
  2. `route_phonebook_bindings.actions`
  3. `ivrs.menu_items` (nested `actions`)
  4. `voice_robot_keywords.actions`
  5. `voice_robots.fallback_action`
  6. `voice_robots.max_retries_action`
  `routes.raw_dialplan` is not rewritten.
- Live write 2026-08-20:

```
[routes.actions] rows=8 changed=5 converted=6 unmapped=0
[route_phonebook_bindings.actions] rows=1 changed=0 converted=0 unmapped=0
[ivrs.menu_items] rows=1 changed=1 converted=1 unmapped=0
[voice_robot_keywords.actions] rows=21 changed=0 converted=0 unmapped=0
[voice_robots.fallback_action] rows=1 changed=0 converted=0 unmapped=0
[voice_robots.max_retries_action] rows=1 changed=0 converted=0 unmapped=0
[backup] 6 row(s) → .backup/phase12-actions-2026-08-20T01-44-04-411Z.json
[summary] rowsChanged=6 actionsConverted=7 unmapped=0 dryRun=false
```

- Second `--dry-run`: `rowsChanged=0`. Backup holds all-tenant JSON — delete after confirm (T-12-12-04). `.backup/` is gitignored.
- ActionType set is now **23** (was 30): removed `tofax`/`asr`/`keywords` and folded `playprompt`/`sendmail`/`sendmailpeer`/`telegram`. `PromptApp` deleted. `GenericApp` and `voicemail` remain.

## Removed 12-01 characterization cases

Deleted with the generator branches: playprompt Playback baseline; unmoded playback Background; sendmail/sendmailpeer/telegram notify dual-read; asr/keywords Record; tofax `__faxmail`. Voicemail `VoiceMail(101@default,u)` `toBe` is unchanged.

## Task Commits

1. **Task 1 RED:** `59f31c4` test(12-12): add failing test for migrateAction
2. **Task 1 GREEN:** `29e640b` feat(12-12): implement migrateAction pure rewrite
3. **Task 2:** `1552db4` feat(12-12): add dry-run action migration script
4. **Task 3:** `e9635bb` feat(12-12): hard-remove tofax asr keywords and dual-read types
5. **Plan metadata:** (docs commit after this file)

## Files Created/Modified

- `dialplan-actions-migration.util.ts` — pure rewrite
- `migrate-dialplan-actions-phase12.ts` — walk / backup / UPDATE
- `route.types.ts` + `dialplan-action-meta.ts` + `ActionTypesList` + registry — 23-type set
- `dialplan.util.ts` — playback always `emitPlayback`; legacy cases removed
- `PromptApp.tsx` — deleted

## Decisions Made

- **unknown-state** over drop-steps (T-12-12-03).
- **voicemail** stays until Phase 12b.
- Human **`write`** authorized the live UPDATE after dry-run.
- Locales not staged (`t(key, fallback)`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] ExtenApp still used `__USE_EXTEN__`**
- **Found during:** Task 1 acceptance grep
- **Issue:** Sentinel would remain in frontend after D-20
- **Fix:** ExtenApp writes `target: { source }`
- **Files modified:** `ExtenApp.tsx`
- **Committed in:** `29e640b`

**2. [Rule 3 - Blocking] Live write blocked then approved**
- **Found during:** Task 2 write
- **Issue:** Auto-review blocked UPDATE until human `write`
- **Fix:** Ran write + confirmed `rowsChanged=0`
- **Committed in:** n/a (data only)

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 blocking)
**Impact on plan:** Required for D-20 grep and gated live write. No scope creep.

## Issues Encountered

- Full `npm run test:backend` / `test:frontend` still fail on **unrelated WIP** (callcenter, call-groups, voice-robots characterization). Plan-scoped suites are green.
- Acceptance grep `'keywords'` also hits `voice-robots.service.ts` attribute `['keywords']` (column name, not ActionType). Left untouched (12-11 leftover / out of scope).

## User Setup Required

None. After confirming migrated routes look correct, delete `.backup/phase12-actions-2026-08-20T01-44-04-411Z.json` (all-tenant data).

## Next Phase Readiness

Ready for **12-13** (wave 9 per-app expansion on the post-migration ActionType set).

## Self-Check: PASSED

- FOUND: packages/backend/src/modules/routes/dialplan-actions-migration.util.ts
- FOUND: packages/backend/src/modules/routes/migrate-dialplan-actions-phase12.ts
- FOUND: .planning/phases/12-dialplan-apps-editor-refactor-reusable-route-chain-builder/12-12-SUMMARY.md
- FOUND: 59f31c4 test(12-12): add failing test for migrateAction
- FOUND: 29e640b feat(12-12): implement migrateAction pure rewrite
- FOUND: 1552db4 feat(12-12): add dry-run action migration script
- FOUND: e9635bb feat(12-12): hard-remove tofax asr keywords and dual-read types

---
*Phase: 12-dialplan-apps-editor-refactor-reusable-route-chain-builder*
*Completed: 2026-08-20*
