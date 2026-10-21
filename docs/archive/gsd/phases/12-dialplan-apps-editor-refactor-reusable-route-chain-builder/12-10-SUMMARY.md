---
phase: 12-dialplan-apps-editor-refactor-reusable-route-chain-builder
plan: 10
subsystem: dialplan
tags: [playback, emitPlayback, Progress, langoverride, dual-read, schema-fields]

requires:
  - phase: 12-06
    provides: findUnreachableSteps + emitDigitExitTransition + terminal=conditional
  - phase: 12-08
    provides: SchemaFields choice-cards + OptionsEditor + StepSheet schema wiring
provides:
  - PlaybackMode + IPlaybackParams (files/mode) in shared
  - emitPlayback(plain→Playback, control→ControlPlayback, menu→BackGround)
  - Progress() + Set(CHANNEL(language)) / BackGround langoverride
  - PlaybackApp + registry hide-from-create for playprompt
  - MediaOptions/PlaybackParamsDto mode-applicability
affects:
  - 12-11 next sequential app expansion
  - 12-12 data migration (must delete dual-read legacy branches in Task 3)

tech-stack:
  added: []
  patterns:
    - "emitPlayback switch(mode) is the only place that picks the Asterisk app"
    - "dual-read: legacy playprompt/unmoded playback keep 12-01 strings until 12-12"
    - "SchemaFields.visibleWhen hides mode-inapplicable fields; DTO rejects them too"

key-files:
  created:
    - packages/backend/src/shared/utils/dialplan-playback.util.ts
    - packages/backend/src/shared/utils/dialplan-playback.util.spec.ts
    - packages/frontend/src/features/dialplan-apps/ui/apps/PlaybackApp/PlaybackApp.tsx
    - packages/frontend/src/features/dialplan-apps/ui/apps/PlaybackApp/PlaybackApp.module.scss
    - packages/frontend/src/features/dialplan-apps/ui/apps/PlaybackApp/PlaybackApp.test.tsx
    - packages/frontend/src/features/dialplan-apps/ui/apps/PlaybackApp/playbackOptions.ts
  modified:
    - packages/shared/src/types/dialplan-params.types.ts
    - packages/backend/src/shared/utils/dialplan.util.ts
    - packages/backend/src/shared/utils/dialplan.util.spec.ts
    - packages/backend/src/modules/routes/dto/dialplan-params/media.params.dto.ts
    - packages/backend/src/modules/routes/dto/dialplan-params/dialplan-params.spec.ts
    - packages/frontend/src/features/dialplan-apps/model/registry.ts
    - packages/frontend/src/features/dialplan-apps/model/schema.types.ts
    - packages/frontend/src/features/dialplan-apps/model/types.ts
    - packages/frontend/src/features/dialplan-apps/ui/SchemaFields/SchemaFields.tsx
    - packages/frontend/src/features/dialplan-apps/ui/ActionTypeSelect/ActionTypeSelect.tsx
    - packages/frontend/src/features/dialplan-apps/ui/DialplanAppsEditor/DialplanAppsEditor.tsx
    - packages/frontend/src/features/dialplan-apps/ui/StepSheet/StepSheet.tsx

key-decisions:
  - "dual-read until 12-12: new playback.mode uses emitPlayback; playprompt and unmoded playback keep 12-01 strings"
  - "legacy branch deletion is 12-12 Task 3 duty (see this SUMMARY)"
  - "t(key, fallback) instead of staging dirty locale files"
  - "background is not an ActionType; it stays a data-only legacy value for 12-12"

patterns-established:
  - "Progress() then Set(CHANNEL(language)) then app; menu uses BackGround langoverride only"
  - "offerOnCreate:false hides dual-read types from ActionTypeSelect unless already selected"

requirements-completed: [D-38, D-51, D-52, D-53]

coverage:
  - id: D1
    description: plain/control/menu emit Playback / ControlPlayback / BackGround
    requirement: D-51
    verification:
      - kind: unit
        ref: packages/backend/src/shared/utils/dialplan-playback.util.spec.ts#plain mode emits Playback
        status: pass
    human_judgment: false
  - id: D2
    description: language Set for plain/control; BackGround langoverride for menu without Set
    requirement: D-52
    verification:
      - kind: unit
        ref: packages/backend/src/shared/utils/dialplan-playback.util.spec.ts#menu mode with language
        status: pass
    human_judgment: false
  - id: D3
    description: noanswer emits Progress() before the app; absent otherwise
    requirement: D-52
    verification:
      - kind: unit
        ref: packages/backend/src/shared/utils/dialplan-playback.util.spec.ts#noanswer emits Progress
        status: pass
    human_judgment: false
  - id: D4
    description: playback.terminal is conditional; findUnreachableSteps does not cut the tail
    requirement: D-53
    verification:
      - kind: unit
        ref: packages/backend/src/shared/utils/dialplan-playback.util.spec.ts#marks unified playback as conditional
        status: pass
    human_judgment: false
  - id: D5
    description: DTO rejects DTMF p on plain and accepts it on control
    requirement: D-38
    verification:
      - kind: unit
        ref: packages/backend/src/modules/routes/dto/dialplan-params/dialplan-params.spec.ts#rejects DTMF-control option p when mode is plain
        status: pass
    human_judgment: false
  - id: D6
    description: PlaybackApp three mode cards; langoverride hidden unless menu
    requirement: D-51
    verification:
      - kind: unit
        ref: packages/frontend/src/features/dialplan-apps/ui/apps/PlaybackApp/PlaybackApp.test.tsx#renders exactly three mode cards
        status: pass
    human_judgment: false
  - id: D7
    description: playprompt hidden from create select; registry entry still renders
    requirement: D-51
    verification:
      - kind: unit
        ref: packages/frontend/src/features/dialplan-apps/ui/apps/PlaybackApp/PlaybackApp.test.tsx#omits playprompt and background
        status: pass
    human_judgment: false
  - id: D8
    description: Live Progress()+language on a real call
    requirement: D-52
    verification: []
    human_judgment: true
    rationale: Early media and CHANNEL(language) need a live SIP/Asterisk call (plan 12-17)

duration: 25min
completed: 2026-08-19
status: complete
---

# Phase 12 Plan 10: Unified Playback Summary

**Одно действие «Воспроизведение» с режимами plain/control/menu порождает Playback / ControlPlayback / BackGround, плюс Progress() и язык; dual-read сохраняет 12-01 строки старых типов до миграции 12-12.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-08-19T09:33:01Z
- **Completed:** 2026-08-19T09:47:50Z
- **Tasks:** 3/3 (decision dual-read + TDD Task 1 + TDD Task 2)
- **Files modified:** 19

## Accomplishments

- `emitPlayback` выбирает приложение Asterisk по `PlaybackMode`; порядок строк `Progress()` → `Set(CHANNEL(language)=…)` → приложение.
- Режим menu передаёт язык штатным аргументом `BackGround` и не эмитит `Set(CHANNEL(language)=`.
- `PlaybackApp` / schema-driven `choice-cards` без имён Asterisk; `playprompt` скрыт из создания.
- DTO отвергает `p` вне `control` и `langoverride` вне `menu`; путь в `files` не принимается.

## Task Commits

1. **Checkpoint dual-read** - no code commit (decision recorded here)
2. **Task 1 RED** - `94d39d8` (test)
3. **Task 1 GREEN** - `f316c82` (feat)
4. **Task 2 RED** - `fa02e88` (test)
5. **Task 2 GREEN** - `c32e872` (feat)

**Plan metadata:** pending docs commit

## Files Created/Modified

- `packages/backend/src/shared/utils/dialplan-playback.util.ts` - emitPlayback
- `packages/backend/src/shared/utils/dialplan-playback.util.spec.ts` - D-51/D-52/D-53
- `packages/shared/src/types/dialplan-params.types.ts` - PlaybackMode, IPlaybackParams.files/mode
- `packages/backend/src/shared/utils/dialplan.util.ts` - playback.mode → emitPlayback; dual-read legacy
- `packages/backend/src/modules/routes/dto/dialplan-params/media.params.dto.ts` - applicability + files + Max(digittimeout)
- `packages/frontend/src/features/dialplan-apps/ui/apps/PlaybackApp/PlaybackApp.tsx` - unified UI
- `packages/frontend/src/features/dialplan-apps/model/registry.ts` - playback schema; playprompt.offerOnCreate=false

## Decisions Made

- **dual-read** (checkpoint option `dual-read`, not `migrate-first`): новый `playback` с `mode` идёт в `emitPlayback`; `playprompt` и `playback` без `mode` оставляют байт-в-байт строки 12-01 (`Playback(...)` / `Background(...)`). Откат 12-12 безопасен. **Удаление legacy-ветвей генератора и скрытых записей реестра - обязанность 12-12 Task 3** (см. `12-12-PLAN.md` Task 3 и этот SUMMARY).
- `migrate-first` отвергнут: миграция писала бы форму, которую ещё некому читать, а откат слияния оставлял бы переписанные данные без читателя.
- i18n: `t(key, fallback)` без стейджа `ru.ts`/`en.ts` (файлы смешаны с чужим WIP), как в 12-08/12-09.

## Characterization rewrite (12-01 branches)

| Branch | 12-01 string | After 12-10 | Reason |
|--------|--------------|-------------|--------|
| `playprompt` `{file:'welcome'}` | `Playback(/usr/records/42/sounds/welcome)` | same | dual-read lock |
| `playback` `{file:'menu'}` no mode | `Background(/usr/records/42/sounds/menu)` | same | dual-read lock; `Background` casing kept |
| `playback` `{mode:'menu'}` | (did not exist) | `BackGround(...)` | new unified path uses plan spelling |
| `text2speech` / `asr` / `keywords` | 12-01 `toBe` | unchanged | D-51 does not fold Say*/Read/MOH |

`read`, `musiconhold` and `Say*` were never ActionTypes and were not added as `PlaybackMode` values.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ControlPlayback contains the substring Playback(**
- **Found during:** Task 1 GREEN
- **Issue:** Negative `not.toContain('Playback(')` failed on `ControlPlayback(`
- **Fix:** Assert `not.toMatch(/(?:^|[^a-zA-Z])Playback\(/)` instead
- **Files modified:** `dialplan-playback.util.spec.ts`
- **Committed in:** `f316c82`

**2. [Rule 2 - Missing Critical] Schema visibleWhen + offerOnCreate + prompts refs + maybe-exit banner**
- **Found during:** Task 2
- **Issue:** Plan requires schema-driven visibility, hide-from-create, prompt catalog, and D-53 tail warning; those hooks were absent
- **Fix:** `FieldSchema.visibleWhen`, `offerOnCreate`, StepSheet `refs.prompts`, DialplanAppsEditor maybe-skip banner
- **Files modified:** schema.types.ts, SchemaFields.tsx, types.ts, ActionTypeSelect.tsx, StepSheet.tsx, DialplanAppsEditor.tsx
- **Committed in:** `c32e872`

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical)
**Impact on plan:** Required for the written acceptance tests. No architectural change.

## Issues Encountered

- `npm run test -w @krasterisk/backend -- --testPathPattern=...` on Windows PowerShell is swallowed by npm; ran `npx jest --testPathPattern=...` inside `packages/backend`.
- `background` is not an `ActionType` (confirmed by 12-12): not added to the registry; ActionTypeSelect already omits it.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for **12-11**. 12-12 must keep dual-read until its Task 2 rewrite, then Task 3 removes `playprompt` registry + unmoded playback generator branch.
- Live call check of `Progress()` / language deferred to 12-17.

## Self-Check: PASSED

- FOUND: `packages/backend/src/shared/utils/dialplan-playback.util.ts`
- FOUND: `packages/frontend/src/features/dialplan-apps/ui/apps/PlaybackApp/PlaybackApp.tsx`
- FOUND: `12-10-SUMMARY.md`
- FOUND: `94d39d8`, `f316c82`, `fa02e88`, `c32e872`

---
*Phase: 12-dialplan-apps-editor-refactor-reusable-route-chain-builder*
*Completed: 2026-08-19*
