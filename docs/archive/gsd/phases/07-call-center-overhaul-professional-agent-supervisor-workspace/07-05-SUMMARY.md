---
phase: 07-call-center-overhaul-professional-agent-supervisor-workspace
plan: 05
subsystem: api
tags: [callcenter, settings, sequelize, nestjs, rtk-query, rbac, idor]

requires:
  - phase: 07-call-center-overhaul-professional-agent-supervisor-workspace
    provides: CallCenterSettingsPage five-tab shell at /callcenter/settings (07-02)
provides:
  - cc_operator_settings per-operator model + migration (D-22)
  - cc_settings per-tenant singleton + migration (D-07/D-27)
  - CallCenterSettingsService/Controller with IDOR-safe own endpoints and supervisor tenant write
  - OperatorSettingsForm + AlertThresholdsForm tabs on /callcenter/settings
affects:
  - 07-08 agent workspace (auto-answer, wrap-up, sounds from operator settings)
  - 07-03 / 07-10 metrics and wallboard (default SLA + alert thresholds)
  - 07-13 wallboard display

tech-stack:
  added: []
  patterns:
    - "Operator id from req.user.id only; DTO omits operator_user_id/user_uid (IDOR)"
    - "assertSupervisor via UserLevel set membership (ADMIN/SUPERVISOR/SUPERADMIN)"
    - "alert_thresholds whitelist sanitize in service (T-07-05-04)"

key-files:
  created:
    - packages/backend/src/modules/callcenter/models/operator-settings.model.ts
    - packages/backend/src/modules/callcenter/models/cc-settings.model.ts
    - packages/backend/src/modules/callcenter/migrate-callcenter-settings-phase7.ts
    - packages/backend/src/modules/callcenter/callcenter-settings.service.ts
    - packages/backend/src/modules/callcenter/callcenter-settings.controller.ts
    - packages/backend/src/modules/callcenter/dto/callcenter-settings.dto.ts
    - packages/backend/src/modules/callcenter/callcenter-settings.service.spec.ts
    - packages/frontend/src/shared/ui/Switch/Switch.tsx
    - packages/frontend/src/features/callcenter/ui/OperatorSettingsForm/OperatorSettingsForm.tsx
    - packages/frontend/src/features/callcenter/ui/AlertThresholdsForm/AlertThresholdsForm.tsx
  modified:
    - packages/backend/src/app.module.ts
    - packages/backend/src/modules/callcenter/callcenter.module.ts
    - packages/frontend/src/shared/api/endpoints/callCenterApi.ts
    - packages/frontend/src/shared/api/rtkApi.ts
    - packages/frontend/src/pages/CallCenterSettingsPage/CallCenterSettingsPage.tsx
    - packages/frontend/src/shared/config/locales/ru.ts
    - packages/frontend/src/shared/config/locales/en.ts

key-decisions:
  - "GET without row returns defaults (no create on read)"
  - "assertSupervisor uses set membership so ADMIN (level 1) can write tenant settings"
  - "AlertThresholdsForm canEdit via SUPERVISOR|ADMIN (not numeric level < 3)"

patterns-established:
  - "Pattern: settings CRUD — own endpoints from session id; supervisor :operatorId; tenant singleton PUT gated"
  - "Pattern: Switch shared/ui on existing @radix-ui/react-switch"

requirements-completed: [D-22, D-27]

duration: 16min
completed: 2026-07-15
---

# Phase 07 Plan 05: CC operator + tenant settings Summary

**Per-operator `cc_operator_settings` and tenant `cc_settings` with IDOR-safe CRUD, plus functional settings tabs on `/callcenter/settings`**

## Performance

- **Duration:** 16 min
- **Started:** 2026-07-15T15:58:20Z
- **Completed:** 2026-07-15T16:14:00Z
- **Tasks:** 3
- **Files modified:** 22

## Accomplishments

- Models + idempotent migration for `cc_operator_settings` (UNIQUE tenant+operator) and `cc_settings` (UNIQUE tenant singleton)
- REST API with operator own GET/PUT from `req.user.id`, supervisor `:operatorId`, tenant write behind assertSupervisor; alert_thresholds whitelist
- Frontend: RTK endpoints, Switch primitive, OperatorSettingsForm + AlertThresholdsForm wired into settings shell tabs

## Task Commits

1. **Task 1: Models + migration + registration** - `67733f2` (feat)
2. **Task 2: CRUD service + controller + spec** - `3abcc68` (feat)
3. **Task 2b: assertSupervisor ADMIN fix** - `cd13059` (fix)
4. **Task 3: Frontend RTK + forms + tabs** - `bb39918` (feat)

**Plan metadata:** `d26fdd4` (docs: complete plan)

## Files Created/Modified

- `operator-settings.model.ts` / `cc-settings.model.ts` - Sequelize models
- `migrate-callcenter-settings-phase7.ts` - standalone CREATE + UNIQUE indexes
- `callcenter-settings.service.ts` / `.controller.ts` / `.dto.ts` / `.spec.ts` - CRUD + RBAC + tests
- `Switch.tsx` - Radix switch primitive
- `OperatorSettingsForm` / `AlertThresholdsForm` - settings tab UIs
- `CallCenterSettingsPage.tsx` - mounts operator + alert tabs
- `callCenterApi.ts` / `rtkApi.ts` / `ru.ts` / `en.ts` - API + i18n

## Decisions Made

- Defaults on GET without persisting a row until first PUT
- Fixed assertSupervisor to UserLevel set membership (ADMIN must write tenant settings; numeric `>= 3` was wrong for inverted enum)
- Frontend canEdit uses SUPERVISOR|ADMIN set check matching 07-02 nav pattern

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Critical] assertSupervisor blocked ADMIN**
- **Found during:** Task 2/3 (RBAC for D-27 / D-38)
- **Issue:** Plan duplicated `user.level < 3` from callcenter.controller; with UserLevel ADMIN=1 that blocks admins and would allow READONLY=5 under `>= 3`
- **Fix:** Allowed SUPERADMIN | ADMIN | SUPERVISOR via set membership
- **Files modified:** `callcenter-settings.controller.ts`
- **Committed in:** `cd13059`

---

**Total deviations:** 1 auto-fixed (Rule 2)
**Impact on plan:** Correct RBAC for tenant settings write; no scope creep.

## Issues Encountered

- Pre-existing `tsc --noEmit` failures in unrelated frontend/backend files; new files typecheck clean within filtered errors
- Migration idempotent on re-run (index duplicate caught in try/catch)

## Known Stubs

| File | Location | Reason |
|------|----------|--------|
| `CallCenterSettingsPage.tsx` | cardTemplates, pauseReasons, displayTokens panels | Still placeholder text; filled by 07-06/07-10/07-11 |

## User Setup Required

None - no external service configuration required. Run migration once per environment:

`npx ts-node src/modules/callcenter/migrate-callcenter-settings-phase7.ts` (from packages/backend)

## Next Phase Readiness

- Operator settings ready for 07-08 ARM consumption
- Tenant SLA defaults + alert thresholds ready for metrics/wallboard consumers

## Self-Check: PASSED

- FOUND: packages/backend/src/modules/callcenter/models/operator-settings.model.ts
- FOUND: packages/backend/src/modules/callcenter/callcenter-settings.service.ts
- FOUND: packages/frontend/src/features/callcenter/ui/OperatorSettingsForm/OperatorSettingsForm.tsx
- FOUND: packages/frontend/src/features/callcenter/ui/AlertThresholdsForm/AlertThresholdsForm.tsx
- FOUND commits: 67733f2, 3abcc68, cd13059, bb39918

---
*Phase: 07-call-center-overhaul-professional-agent-supervisor-workspace*
*Completed: 2026-07-15*
