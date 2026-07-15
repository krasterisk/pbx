---
phase: 07-call-center-overhaul-professional-agent-supervisor-workspace
plan: 10
subsystem: api
tags: [nestjs, callcenter, wallboard, display-token, sse, alerts, notifications, sequelize]

requires:
  - phase: 07-03
    provides: CallCenterMetricsService.getTenantQueueMetrics for live SLA/abandon metrics
  - phase: 07-05
    provides: CcSettings.alert_thresholds + CallCenterSettingsService.getTenantSettings (D-27)
provides:
  - CcDisplayToken model + DisplayTokenGuard (opaque TV auth, no level/id)
  - Wallboard SSE under DisplayTokenGuard + supervisor token CRUD
  - CcAlertConfig singleton + CallCenterAlertService @Interval evaluator with cooldown
  - NotificationDispatcherService exported for CC alert dispatch (D-28)
affects: [07-13 wallboard UI, TV display mode, supervisor alert routing]

tech-stack:
  added: []
  patterns:
    - "Separate DisplayTokenGuard auth branch from JwtAuthGuard (method-level guards)"
    - "req.user = { vpbx_user_uid, isDisplayToken: true } without level/id (Pitfall 5)"
    - "Thresholds (WHEN) in cc_settings; routing (WHERE) in cc_alert_config"

key-files:
  created:
    - packages/backend/src/modules/callcenter/models/display-token.model.ts
    - packages/backend/src/modules/callcenter/models/alert-config.model.ts
    - packages/backend/src/modules/callcenter/migrate-callcenter-wallboard-phase7.ts
    - packages/backend/src/modules/callcenter/guards/display-token.guard.ts
    - packages/backend/src/modules/callcenter/callcenter-wallboard.service.ts
    - packages/backend/src/modules/callcenter/callcenter-wallboard.controller.ts
    - packages/backend/src/modules/callcenter/callcenter-alert.service.ts
    - packages/backend/src/modules/callcenter/dto/wallboard.dto.ts
    - packages/backend/src/modules/callcenter/callcenter-wallboard.service.spec.ts
    - packages/backend/src/modules/callcenter/callcenter-alert.service.spec.ts
  modified:
    - packages/backend/src/app.module.ts
    - packages/backend/src/modules/callcenter/callcenter.module.ts
    - packages/backend/src/modules/notifications/notifications.module.ts

key-decisions:
  - "Alert-config CRUD landed in Task 2 wallboard service/controller so Task 3 focused on evaluator"
  - "CallCenterAlertService does not inject NotificationsService — tenant validation lives in updateAlertConfig"
  - "Full token string returned in listTokens intentionally for supervisor URL copy"

patterns-established:
  - "Pattern: dual-auth wallboard — DisplayTokenGuard on SSE, JwtAuthGuard+assertSupervisor on management"
  - "Pattern: alert cooldown Map keyed `${userUid}:${thresholdKey}` against flood (T-07-10-05)"

requirements-completed: [D-26, D-28]

duration: 12min
completed: 2026-07-15
---

# Phase 07 Plan 10: Wallboard Display Tokens + Alert Backend Summary

**Backend wallboard for TV: opaque display-token SSE (D-26) plus threshold alerts via Phase 6 notification_integration with cooldown (D-28)**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-15T17:07:20Z
- **Completed:** 2026-07-15T17:14:00Z
- **Tasks:** 3
- **Files modified:** 13

## Accomplishments

- Models + idempotent migration for `cc_display_tokens` and `cc_alert_config` (UNIQUE token, UNIQUE tenant alert-config)
- `DisplayTokenGuard` isolates TV access: revoked/expired rejected; `req.user` has no `level`/`id`
- Supervisor token generate/list/revoke + alert-config GET/PUT under `JwtAuthGuard` + `assertSupervisor`
- `CallCenterAlertService` @Interval evaluates SLA/abandon/agents/wait vs `cc_settings.alert_thresholds`, dispatches via `NotificationDispatcherService` with per-key cooldown

## Task Commits

Each task was committed atomically:

1. **Task 1: Models + migration + registration** - `8037f84` (feat)
2. **Task 2: DisplayTokenGuard + wallboard SSE + token CRUD** - `666a99b` (feat)
3. **Task 3: CallCenterAlertService threshold evaluator + cooldown** - `9cd2cbb` (feat)

## Files Created/Modified

- `models/display-token.model.ts` — CcDisplayToken (opaque token lifecycle)
- `models/alert-config.model.ts` — CcAlertConfig per-tenant routing singleton
- `migrate-callcenter-wallboard-phase7.ts` — idempotent CREATE + indexes
- `guards/display-token.guard.ts` — opaque query-token validation
- `callcenter-wallboard.service.ts` / `.controller.ts` — SSE + token + alert-config
- `callcenter-alert.service.ts` — @Interval evaluator + lastFired cooldown
- `dto/wallboard.dto.ts` — CreateDisplayTokenDto, UpdateAlertConfigDto
- `*.spec.ts` — token lifecycle, guard isolation, breach/cooldown/cross-tenant
- `app.module.ts` / `callcenter.module.ts` — model + provider registration
- `notifications.module.ts` — export NotificationDispatcherService

## Decisions Made

- Alert-config endpoints shipped with Task 2 wallboard surface so Task 3 could focus on the evaluator
- NotificationsService injected only into WallboardService for integration_uid tenant check (T-07-10-06)

## Deviations from Plan

### Auto-fixed Issues

None - plan executed as written with one intentional ordering tweak (alert-config CRUD in Task 2 service/controller ahead of Task 3 evaluator).

## Threat Mitigations

| Threat | Mitigation shipped |
|--------|-------------------|
| T-07-10-01 | DisplayTokenGuard only on SSE; req.user without level/id |
| T-07-10-02 | randomBytes(32); revoked_at / expires_at checks; revoke endpoint |
| T-07-10-03 | JwtAuthGuard + assertSupervisor on token/alert-config |
| T-07-10-04 | Tenant scoping on all service queries + SSE userUid from token |
| T-07-10-05 | lastFired cooldown Map per userUid:thresholdKey |
| T-07-10-06 | notificationsService.findOne(uid, userUid) on updateAlertConfig |

## Known Stubs

None — no placeholder/TODO stubs in new artifacts.

## Verification

- `npm run test:cc` — 12 suites, 108 tests passed
- `npx tsc --noEmit` — no new errors from 07-10 files (pre-existing errors in unrelated modules remain)

## Next

UI wallboard (07-13) consumes SSE `?token=` and supervisor token/alert-config APIs.

## Self-Check: PASSED

- FOUND: display-token.model.ts, alert-config.model.ts, migrate-callcenter-wallboard-phase7.ts
- FOUND: display-token.guard.ts, callcenter-wallboard.service.ts, callcenter-wallboard.controller.ts
- FOUND: callcenter-alert.service.ts, wallboard.dto.ts, both specs
- FOUND commits: 8037f84, 666a99b, 9cd2cbb
