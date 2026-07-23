---
phase: 09-call-center-agent-panel
plan: 17
subsystem: api
tags: [callcenter, autopause, settings, d-15, nestjs, react, i18n]

requires:
  - phase: 09-call-center-agent-panel
    provides: CallCenterAutoPauseService + cc_settings.autopause_rules column (09-09); tenant settings GET/PUT + AlertThresholdsForm pattern (09-13/09-14)
provides:
  - sanitizeAutopauseRules whitelist write path on UpdateCcSettingsDto / updateTenantSettings
  - AutoPauseRulesForm tenant Settings tab (autoPause) with SUPERVISOR/ADMIN gate
  - ru+en i18n for callcenter.settings.autoPause.*
affects:
  - phase-09-uat-g-09-2
  - CallCenterAutoPauseService.getRules consumers

tech-stack:
  added: []
  patterns:
    - "sanitize* whitelist in CallCenterSettingsService (mirror sanitizeAlertThresholds)"
    - "AlertThresholdsForm canEdit gate reused for AutoPauseRulesForm"

key-files:
  created:
    - packages/frontend/src/features/callcenter/ui/AutoPauseRulesForm/AutoPauseRulesForm.tsx
    - packages/frontend/src/features/callcenter/ui/AutoPauseRulesForm/AutoPauseRulesForm.module.scss
  modified:
    - packages/backend/src/modules/callcenter/dto/callcenter-settings.dto.ts
    - packages/backend/src/modules/callcenter/callcenter-settings.service.ts
    - packages/backend/src/modules/callcenter/callcenter-settings.service.spec.ts
    - packages/frontend/src/shared/api/endpoints/callCenterApi.ts
    - packages/frontend/src/pages/CallCenterSettingsPage/CallCenterSettingsPage.tsx
    - packages/frontend/src/shared/config/locales/en.ts
    - packages/frontend/src/shared/config/locales/ru.ts

key-decisions:
  - "No new route — reuse PUT /callcenter/settings/tenant + assertSupervisor"
  - "RONA never accepted as writable rule type; UI shows always-on info callout"
  - "Soft cap MAX_AUTOPAUSE_RULES=20 in sanitizeAutopauseRules (T-09-17-03)"

patterns-established:
  - "Tenant JSON array settings: DTO @IsArray optional + deep sanitize in service + form full-list replace on save"

requirements-completed: [D-15]

coverage:
  - id: D1
    description: "Supervisor/admin can persist D-15 autopause_rules (missed_count/idle_time/status_duration) via PUT tenant; unknown/rona types dropped"
    requirement: D-15
    verification:
      - kind: unit
        ref: packages/backend/src/modules/callcenter/callcenter-settings.service.spec.ts#sanitizeAutopauseRules / updateTenantSettings persists sanitized
        status: pass
    human_judgment: false
  - id: D2
    description: "AutoPauseRulesForm on Call Center Settings autoPause tab; RONA info only; SUPERVISOR/ADMIN canEdit; ru+en keys"
    requirement: D-15
    verification:
      - kind: other
        ref: rg autoPause|AutoPauseRulesForm|autopause_rules across settings page, form, API, locales
        status: pass
    human_judgment: true
    rationale: "Visual UAT that tab renders and save/reload persists rules still needs a supervisor session"

duration: 44min
completed: 2026-07-23
status: complete
---

# Phase 09 Plan 17: Auto-pause Rules Settings (G-09-2) Summary

**Tenant autopause_rules write path + AutoPauseRulesForm Settings tab so supervisors can configure D-15 missed_count/idle_time/status_duration; RONA stays always-on non-editable**

## Performance

- **Duration:** 44 min
- **Started:** 2026-07-23T07:51:42Z
- **Completed:** 2026-07-23T08:35:44Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Exported `sanitizeAutopauseRules` with triad whitelist, finite coercion, non-array → `[]`, soft cap 20; wired into `updateTenantSettings` and `DEFAULT_TENANT_SETTINGS.autopause_rules: []`
- Extended `UpdateCcSettingsDto` with optional `autopause_rules`; existing PUT tenant + `assertSupervisor` unchanged (no new route)
- Shipped `AutoPauseRulesForm` on dedicated `autoPause` Settings tab with RONA info callout, add/edit/remove rules, pause-reason select, SUPERVISOR/ADMIN canEdit
- Added `ICcSettings.autopause_rules` and ru+en `callcenter.settings.tabs.autoPause` / `settings.autoPause.*`

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED):** `685357a` — test(09-17): add failing test for autopause_rules sanitize/write
2. **Task 1 (GREEN):** `ee48e08` — feat(09-17): implement autopause_rules tenant write path
3. **Task 2:** `b585209` — feat(09-17): add AutoPauseRulesForm tenant settings UI

**Plan metadata:** `49235b6` (docs: complete plan)

_Note: TDD Task 1 used RED→GREEN commits; tracer verify re-ran settings service spec (27 passed) before UI expansion._

## Files Created/Modified

- `packages/backend/src/modules/callcenter/dto/callcenter-settings.dto.ts` — optional `autopause_rules` on `UpdateCcSettingsDto`
- `packages/backend/src/modules/callcenter/callcenter-settings.service.ts` — `sanitizeAutopauseRules`, defaults, update patch
- `packages/backend/src/modules/callcenter/callcenter-settings.service.spec.ts` — sanitize + persist coverage
- `packages/frontend/src/shared/api/endpoints/callCenterApi.ts` — `AutoPauseRule` + `ICcSettings.autopause_rules`
- `packages/frontend/src/features/callcenter/ui/AutoPauseRulesForm/*` — tenant editor
- `packages/frontend/src/pages/CallCenterSettingsPage/CallCenterSettingsPage.tsx` — `autoPause` tab
- `packages/frontend/src/shared/config/locales/{en,ru}.ts` — tabs + form copy

## Decisions Made

- Reuse existing supervisor-gated PUT `/callcenter/settings/tenant` instead of a dedicated autopause route
- RONA remains engine-fixed; API drops unknown types including fabricated `rona`; UI shows always-on info, never an editable RONA row
- Soft-cap sanitized arrays at 20 rules (T-09-17-03)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Soft cap on autopause_rules array length**
- **Found during:** Task 1 (GREEN)
- **Issue:** Threat model T-09-17-03 suggested optional soft cap for DoS via large JSON arrays
- **Fix:** `MAX_AUTOPAUSE_RULES = 20` in `sanitizeAutopauseRules`
- **Files modified:** `callcenter-settings.service.ts`
- **Verification:** Unit suite still passes; excess entries truncated
- **Committed in:** `ee48e08`

**2. [Bundled WIP] Pre-existing `getOperatorLevel` uniqueid lookup already in working tree**
- **Found during:** Task 1 commit staging
- **Issue:** Uncommitted 09-16-era `id` → `uniqueid` fix sat in the same service file
- **Fix:** Included in Task 1 GREEN commit (correct User PK lookup); not introduced by this plan’s autopause work
- **Files modified:** `callcenter-settings.service.ts`
- **Committed in:** `ee48e08`

---

**Total deviations:** 1 plan-aligned soft cap + 1 bundled pre-existing fix
**Impact on plan:** Soft cap strengthens T-09-17-03; uniqueid bundling is harmless correctness already needed for permissions path

## Issues Encountered

- Shell cwd drifted into `packages/backend` after jest (pathspec miss on first commit attempt) — recommitted from repo root
- AlertThresholdsForm vitest path has no tests (plan verify expected); rg marker check used instead

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- G-09-2 configuration surface closed; manual UAT: supervisor opens Settings → Auto-pause, saves rules, reload persists; engine reads via `getRules` on next evaluation
- Controller file listed in plan required no code change (assertSupervisor already on PUT tenant)

## Self-Check: PASSED

- FOUND: `packages/frontend/src/features/callcenter/ui/AutoPauseRulesForm/AutoPauseRulesForm.tsx`
- FOUND: `sanitizeAutopauseRules` + `autopause_rules` patch in settings service
- FOUND commits: `685357a`, `ee48e08`, `b585209`

---
*Phase: 09-call-center-agent-panel*
*Completed: 2026-07-23*
