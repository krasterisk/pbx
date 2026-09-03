---
phase: 13-custom-voicemail-instead-of-voicemail
plan: 03
subsystem: dialplan
tags: [voicemail, record-status, condition-source, d-56, tdd]

requires:
  - phase: 13-custom-voicemail-instead-of-voicemail
    provides: RECORD_STATUS_VALUES 7-member table including OPERATOR
provides:
  - Sixth CONDITION_SOURCES member record_status
  - buildConditionExpr `${RECORD_STATUS}` OR-join filtered to RECORD_STATUS_VALUES
  - ConditionEditor record: prefix presets including OPERATOR
affects:
  - 13-04 voicemail step schema/DTO
  - 13-05 ConditionEditor consumers
  - 13-11 voicemail ingest

actuals:
  tokens: 3932
  tasks: 2
  commits: 5

tech-stack:
  added: []
  patterns:
    - RECORD_STATUS_VALUES is the single allow-list for generator, DTO @IsIn, and UI presets
    - conditionMap record_status branch before http_result fallback

key-files:
  created: []
  modified:
    - packages/shared/src/types/dialplan-condition.types.ts
    - packages/backend/src/shared/utils/dialplan-condition.util.ts
    - packages/backend/src/shared/utils/dialplan-condition.util.spec.ts
    - packages/backend/src/modules/routes/dto/route-condition.dto.ts
    - packages/backend/src/modules/routes/dto/route-condition.dto.spec.ts
    - packages/frontend/src/features/dialplan-apps/model/conditionMap.ts
    - packages/frontend/src/features/dialplan-apps/ui/ConditionEditor/ConditionEditor.tsx
    - packages/frontend/src/features/dialplan-apps/ui/ConditionEditor/ConditionEditor.test.tsx

key-decisions:
  - "CONDITION_SOURCE_DTO.record_status spreads RECORD_STATUS_VALUES — no second array in the DTO"
  - "t(key, fallback) for record group/labels; dirty locale files not staged"
  - "MultiSelect has no native optgroup; record group string is the option suffix via t('routes.chain.conditions.record.group')"

patterns-established:
  - "Pattern: record_status compiler mirrors queuestatus — orJoinEq('${RECORD_STATUS}', valid)"
  - "Pattern: ConditionEditor third prefix record: keeps one source group (dial/queue/record)"

requirements-completed: [D-56]

coverage:
  - id: D1
    description: CONDITION_SOURCES length is 6 and includes record_status; ConditionSource union has record_status
    requirement: D-56
    verification:
      - kind: unit
        ref: packages/backend/src/shared/utils/dialplan-condition.util.spec.ts#RECORD_STATUS_VALUES is the D-56 set of 7 including OPERATOR
        status: pass
    human_judgment: false
  - id: D2
    description: buildConditionExpr for record_status ORs ${RECORD_STATUS} against selected values; OPERATOR ≠ DTMF; invalid values dropped
    requirement: D-56
    verification:
      - kind: unit
        ref: packages/backend/src/shared/utils/dialplan-condition.util.spec.ts#source record_status emits RECORD_STATUS comparison (D-56)
        status: pass
    human_judgment: false
  - id: D3
    description: CONDITION_SOURCE_DTO.record_status validates values with @IsIn([...RECORD_STATUS_VALUES])
    requirement: D-56
    verification:
      - kind: unit
        ref: packages/backend/src/modules/routes/dto/route-condition.dto.spec.ts#CONDITION_SOURCE_DTO.record_status accepts OPERATOR and rejects unknown values
        status: pass
    human_judgment: false
  - id: D4
    description: ConditionEditor encodes record:OPERATOR distinctly from record:DTMF; seven record: presets from RECORD_STATUS_VALUES
    requirement: D-56
    verification:
      - kind: unit
        ref: packages/frontend/src/features/dialplan-apps/ui/ConditionEditor/ConditionEditor.test.tsx#encodes record_status OPERATOR distinctly from DTMF (D-56)
        status: pass
    human_judgment: false

duration: 11min
completed: 2026-09-03
status: complete
---

# Phase 13 Plan 03: RECORD_STATUS condition source Summary

**Wired `record_status` end-to-end so OPERATOR is a first-class `${RECORD_STATUS}` preset distinct from DTMF**

## Performance

- **Duration:** 11 min
- **Started:** 2026-09-03T01:32:00Z
- **Completed:** 2026-09-03T01:43:11Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- `CONDITION_SOURCES` is length 6 and includes `record_status`; `ConditionSource` union gained `{ source: 'record_status'; values: RecordStatusValue[] }`
- `buildConditionExpr` ORs `${RECORD_STATUS}` against values filtered through `RECORD_STATUS_VALUES` (T-13-07); OPERATOR and DTMF emit distinct comparisons
- `CONDITION_SOURCE_DTO.record_status` validates with `@IsIn([...RECORD_STATUS_VALUES], { each: true })` — no duplicated allow-list
- ConditionEditor `record:` prefix maps all seven shared values; `sourceToSelection` OPERATOR ≠ DTMF; `conditionMap` has an explicit `record_status` branch before the `http_result` fallback

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Shared union + generator + DTO specs** - `b2b2de2` (test)
2. **Task 1 GREEN: record_status compiler + DTO** - `c01c17e` (feat)
3. **Task 2 RED: record: OPERATOR vs DTMF specs** - `d23bbad` (test)
4. **Task 2 GREEN: ConditionEditor record: presets + conditionMap** - `0429bcd` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `packages/shared/src/types/dialplan-condition.types.ts` - sixth CONDITION_SOURCES member + ConditionSource arm
- `packages/backend/src/shared/utils/dialplan-condition.util.ts` - `buildFromSource` `record_status` case
- `packages/backend/src/shared/utils/dialplan-condition.util.spec.ts` - length-6 + OPERATOR/DTMF + drop-invalid
- `packages/backend/src/modules/routes/dto/route-condition.dto.ts` - RecordStatusSourceDto on CONDITION_SOURCE_DTO
- `packages/backend/src/modules/routes/dto/route-condition.dto.spec.ts` - DTO accepts OPERATOR, rejects NOANSWER
- `packages/frontend/src/features/dialplan-apps/model/conditionMap.ts` - record_status before http_result fallback
- `packages/frontend/src/features/dialplan-apps/ui/ConditionEditor/ConditionEditor.tsx` - RECORD_PREFIX + seven presets
- `packages/frontend/src/features/dialplan-apps/ui/ConditionEditor/ConditionEditor.test.tsx` - record:OPERATOR vs record:DTMF

## Decisions Made
- DTO `@IsIn([...RECORD_STATUS_VALUES])` — 13-01 table remains the single source
- `t(key, fallback)` for `routes.chain.conditions.record.*`; dirty `en.ts`/`ru.ts` not staged
- MultiSelect has no native `<optgroup>`; the group string is applied as the option suffix (same shape as dial/queue suffixes)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added RouteConditionDto record_status spec**
- **Found during:** Task 1 (DTO registry)
- **Issue:** Plan `files_modified` omitted `route-condition.dto.spec.ts`, but `<behavior>` requires `@IsIn` validation of OPERATOR vs unknown values
- **Fix:** Added a DTO `it` that accepts OPERATOR/DTMF and rejects `NOANSWER`
- **Files modified:** packages/backend/src/modules/routes/dto/route-condition.dto.spec.ts
- **Verification:** Jest `route-condition.dto.spec.ts` pass
- **Committed in:** `b2b2de2` (Task 1 RED)

**2. [Rule 2 - Missing Critical] selectionToSource three-prefix grouping**
- **Found during:** Task 2 (ConditionEditor)
- **Issue:** Plan named `sourceToSelection` only; without `selectionToSource` handling `record:`, a UI pick would be treated as dial and drop
- **Fix:** Pivot prefix is record/queue/dial; one group kept
- **Files modified:** packages/frontend/src/features/dialplan-apps/ui/ConditionEditor/ConditionEditor.tsx
- **Verification:** ConditionEditor helper round-trip it pass
- **Committed in:** `0429bcd` (Task 2 GREEN)

---

**Total deviations:** 2 auto-fixed (2 missing critical)
**Impact on plan:** Required for DTO/UI correctness. No scope creep (no voicemail schema/DTO, no ingest).

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
Ready for 13-04 (voicemail step schema/DTO). Do not implement ingest (13-11). OPERATOR is selectable and generates a `${RECORD_STATUS}` comparison distinct from DTMF.

## TDD Gate Compliance
- Task 1 RED: `test(13-03): add failing test for record_status condition source` (`b2b2de2`)
- Task 1 GREEN: `feat(13-03): implement record_status condition source` (`c01c17e`)
- Task 2 RED: `test(13-03): add failing test for record: OPERATOR vs DTMF` (`d23bbad`)
- Task 2 GREEN: `feat(13-03): implement record: ConditionEditor presets` (`0429bcd`)

## Self-Check: PASSED
- FOUND: packages/shared/src/types/dialplan-condition.types.ts
- FOUND: packages/backend/src/shared/utils/dialplan-condition.util.ts
- FOUND: packages/backend/src/modules/routes/dto/route-condition.dto.ts
- FOUND: packages/frontend/src/features/dialplan-apps/model/conditionMap.ts
- FOUND: packages/frontend/src/features/dialplan-apps/ui/ConditionEditor/ConditionEditor.tsx
- FOUND: packages/frontend/src/features/dialplan-apps/ui/ConditionEditor/ConditionEditor.test.tsx
- FOUND: b2b2de2
- FOUND: c01c17e
- FOUND: d23bbad
- FOUND: 0429bcd

---
*Phase: 13-custom-voicemail-instead-of-voicemail*
*Completed: 2026-09-03*
