---
phase: 13-custom-voicemail-instead-of-voicemail
plan: 04
subsystem: dialplan
tags: [voicemail, dto, schema, d-56, d-74, tdd]

requires:
  - phase: 13-custom-voicemail-instead-of-voicemail
    provides: IVoicemailParams expansion + generator already reads expanded params
provides:
  - VoicemailParamsDto matching IVoicemailParams (greeting, max_duration, silence_timeout, record_options, notify, STT/LLM uids)
  - RecordOptionsDto flags q o x y n s u only (k generator-only)
  - schemas/voicemail.tsx + registry defaultParams.max_duration 120
affects:
  - 13-05 voicemail step UI consumers
  - 13-11 voicemail ingest module (not implemented here)

actuals:
  tokens: 5663
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - RecordOptionsDto is a dedicated class — not IMediaOptions / leftover RecordParamsDto
    - Nested voicemail notify reuses NotifyParamsDto
    - SchemaFields is flat-key; nested record_options/notify are written via custom render

key-files:
  created:
    - packages/frontend/src/features/dialplan-apps/model/schemas/voicemail.tsx
    - packages/frontend/src/features/dialplan-apps/model/schemas/voicemail.test.tsx
  modified:
    - packages/backend/src/modules/routes/dto/dialplan-params/address.params.dto.ts
    - packages/backend/src/modules/routes/dto/dialplan-params/dialplan-params.spec.ts
    - packages/frontend/src/features/dialplan-apps/model/registry.ts
    - packages/frontend/src/shared/config/locales/ru.ts
    - packages/frontend/src/shared/config/locales/en.ts

key-decisions:
  - "greeting is a SAFE prompt id /^[A-Za-z0-9._-]*$/ — no absolute path (T-13-09)"
  - "k is not a RecordOptionsDto property and not a schema key (D-56)"
  - "Surgical routes.apps.voicemail.* locale keys only; directory/csv locale WIP not staged"

patterns-established:
  - "Pattern: voicemail Sheet schema + VoicemailParamsDto + 13-02 generator share IVoicemailParams"
  - "Pattern: defaultParams.max_duration === 120 (D-74); terminal stays conditional from DIALPLAN_ACTION_META"

requirements-completed: [D-56, D-74]

coverage:
  - id: D1
    description: VoicemailParamsDto validates greeting, max_duration (>=1), record_options, nested notify, STT/LLM uids
    requirement: D-56
    verification:
      - kind: unit
        ref: packages/backend/src/modules/routes/dto/dialplan-params/dialplan-params.spec.ts#voicemail D-56 / D-74 DTO
        status: pass
    human_judgment: false
  - id: D2
    description: RecordOptionsDto has no k; record_options.k is whitelist-stripped
    requirement: D-56
    verification:
      - kind: unit
        ref: packages/backend/src/modules/routes/dto/dialplan-params/dialplan-params.spec.ts#ignores record_options.k and does not declare k on RecordOptionsDto
        status: pass
    human_judgment: false
  - id: D3
    description: registry defaultParams.max_duration === 120 (D-74)
    requirement: D-74
    verification:
      - kind: unit
        ref: packages/frontend/src/features/dialplan-apps/model/schemas/voicemail.test.tsx#defaultParams.max_duration is 120 (D-74)
        status: pass
    human_judgment: false
  - id: D4
    description: Schema includes greeting, flags qoxy nsu, notify block, optional STT/LLM; no k; terminal stays conditional
    requirement: D-56
    verification:
      - kind: unit
        ref: packages/frontend/src/features/dialplan-apps/model/schemas/voicemail.test.tsx#schema exposes greeting, duration, Record flags, notify, STT/LLM — and no k
        status: pass
    human_judgment: false

duration: 21min
completed: 2026-09-03
status: complete
---

# Phase 13 Plan 04: Voicemail step schema + DTO Summary

**Schema-driven voicemail Sheet plus VoicemailParamsDto matching IVoicemailParams — default duration 120 s, Record flag k is generator-only**

## Performance

- **Duration:** 21 min
- **Started:** 2026-09-03T01:47:11Z
- **Completed:** 2026-09-03T02:08:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Expanded `VoicemailParamsDto` with SAFE greeting, `@Min(1)` duration/silence, `RecordOptionsDto` (q o x y n s u only), nested `NotifyParamsDto`, optional STT/LLM uids; kept `target`/`exten`
- Registry `voicemail` is no longer a stub: `defaultParams.max_duration === 120`, schema + `summarizeVoicemail` via `t(key, fallback)`
- `k` is absent from DTO and schema keys; terminal meta stays `conditional`

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: failing VoicemailParamsDto tests** - `036b74d` (test)
2. **Task 1 GREEN: expand VoicemailParamsDto** - `11f5a19` (feat)
3. **Task 2 RED: failing voicemail schema tests** - `73d08c2` (test)
4. **Task 2 GREEN: schema + registry + surgical locales** - `7abd84a` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `packages/backend/src/modules/routes/dto/dialplan-params/address.params.dto.ts` - RecordOptionsDto + expanded VoicemailParamsDto
- `packages/backend/src/modules/routes/dto/dialplan-params/dialplan-params.spec.ts` - D-56/D-74 DTO cases + ACTION_PARAM_DTO fixtures
- `packages/frontend/src/features/dialplan-apps/model/schemas/voicemail.tsx` - buildVoicemailSchema / summarizeVoicemail
- `packages/frontend/src/features/dialplan-apps/model/schemas/voicemail.test.tsx` - D-74 default and no-k assertions
- `packages/frontend/src/features/dialplan-apps/model/registry.ts` - wired voicemail schema/defaultParams/summarize
- `packages/frontend/src/shared/config/locales/ru.ts` - surgical `routes.apps.voicemail.*` only
- `packages/frontend/src/shared/config/locales/en.ts` - surgical `routes.apps.voicemail.*` only

## Decisions Made
- Greeting is a prompt identifier (`SAFE_GREETING`), not a free path (T-13-09)
- `k` stays generator-only — not a DTO field and not a Sheet checkbox
- Nested `record_options` / `notify` are written through custom SchemaFields renders because the renderer is flat-key
- Locale keys added surgically on top of HEAD; directory/csv WIP in ru.ts/en.ts was not staged

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Nested record_options/notify via custom render**
- **Found during:** Task 2 (schema)
- **Issue:** SchemaFields reads `params[field.key]` as a flat key; `kind: 'toggle'` / `kind: 'select'` would persist `record_options.o` and `notify.integration_uid` as dotted top-level keys, which the DTO whitelist strips
- **Fix:** Field keys stay `record_options.*` / `notify.*`; custom renders patch nested objects so PUT + generator see IVoicemailParams
- **Files modified:** packages/frontend/src/features/dialplan-apps/model/schemas/voicemail.tsx
- **Verification:** voicemail.test.tsx + dialplan-apps Vitest 244 passed
- **Committed in:** 7abd84a (Task 2 GREEN)

**2. [Rule 3 - Blocking] Surgical locale keys for registryI18n.test.ts**
- **Found during:** Task 2 verify (`voicemail declares only keys that exist in ru/en`)
- **Issue:** New `routes.apps.voicemail.*` labelKeys failed the existing i18n coverage suite
- **Fix:** Added only the voicemail block under `routes.apps`; staged HEAD+keys via index blob so directory/csv locale WIP stayed uncommitted
- **Files modified:** packages/frontend/src/shared/config/locales/ru.ts, en.ts
- **Verification:** registryI18n.test.ts passed
- **Committed in:** 7abd84a (Task 2 GREEN)

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 blocking)
**Impact on plan:** Both required for persist/i18n correctness. No ingest module, no new npm packages.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
Ready for 13-05 (voicemail step UI consumers). Do not implement ingest (`voicemail.module.ts`) until 13-11.

## TDD Gate Compliance
- Task 1 RED `036b74d` then GREEN `11f5a19`
- Task 2 RED `73d08c2` then GREEN `7abd84a`
- No REFACTOR commits

## Authentication Gates
None

## Known Stubs
None

## Self-Check: PASSED
- FOUND: packages/backend/src/modules/routes/dto/dialplan-params/address.params.dto.ts
- FOUND: packages/backend/src/modules/routes/dto/dialplan-params/dialplan-params.spec.ts
- FOUND: packages/frontend/src/features/dialplan-apps/model/schemas/voicemail.tsx
- FOUND: packages/frontend/src/features/dialplan-apps/model/schemas/voicemail.test.tsx
- FOUND: packages/frontend/src/features/dialplan-apps/model/registry.ts
- FOUND: 036b74d
- FOUND: 11f5a19
- FOUND: 73d08c2
- FOUND: 7abd84a
- ABSENT (expected): voicemail.module.ts, migrate-voicemail.ts

---
*Phase: 13-custom-voicemail-instead-of-voicemail*
*Completed: 2026-09-03*
