---
phase: 07-call-center-overhaul-professional-agent-supervisor-workspace
plan: 15
subsystem: api
tags: [nestjs, callcenter, reports, schedules, cron, notification-integration, mailer, rtk-query]

requires:
  - phase: 07-12
    provides: CallCenterReportsService.runReport + CSV/XLSX exporters + CcReportId whitelist
  - phase: 07-18
    provides: callCenterReportsApi RTK slice to extend with schedules
  - phase: 06
    provides: notification_integration credential store + NotificationDispatcherService
provides:
  - CcReportSchedule model + cc_report_schedules migration
  - CallCenterReportDeliveryService (tenant authz + email attachment / messenger summary)
  - CallCenterReportSchedulerService @Cron with MAX_PER_TICK=50
  - Supervisor-gated CRUD + run-now API and ReportSchedulesManager settings tab
affects: [phase-07-complete, scheduled-reports, UAT]

tech-stack:
  added: []
  patterns:
    - "Scheduled delivery reuses runReport + exporters; PDF remains client-only"
    - "integration.user_uid === schedule.user_uid before delivery; CRUD validates via findOne(uid, vpbx)"
    - "computeNextRun exported util shared by CRUD and scheduler (no circular DI)"

key-files:
  created:
    - packages/backend/src/modules/callcenter/models/report-schedule.model.ts
    - packages/backend/src/modules/callcenter/migrate-callcenter-report-schedules-phase7.ts
    - packages/backend/src/modules/callcenter/reports/callcenter-report-delivery.service.ts
    - packages/backend/src/modules/callcenter/reports/callcenter-report-delivery.service.spec.ts
    - packages/backend/src/modules/callcenter/reports/callcenter-report-schedules.service.ts
    - packages/backend/src/modules/callcenter/reports/callcenter-report-schedules.service.spec.ts
    - packages/backend/src/modules/callcenter/reports/callcenter-report-scheduler.service.ts
    - packages/backend/src/modules/callcenter/reports/callcenter-report-schedules.controller.ts
    - packages/backend/src/modules/callcenter/reports/dto/report-schedule.dto.ts
    - packages/frontend/src/features/callcenter/ui/ReportSchedulesManager/ReportSchedulesManager.tsx
    - packages/frontend/src/features/callcenter/ui/ReportSchedulesManager/ReportSchedulesManager.module.scss
  modified:
    - packages/backend/src/app.module.ts
    - packages/backend/src/modules/callcenter/callcenter.module.ts
    - packages/backend/src/modules/mailer/mailer.service.ts
    - packages/frontend/src/shared/api/endpoints/callCenterReportsApi.ts
    - packages/frontend/src/shared/api/rtkApi.ts
    - packages/frontend/src/pages/CallCenterSettingsPage/CallCenterSettingsPage.tsx
    - packages/frontend/src/shared/config/locales/ru.ts
    - packages/frontend/src/shared/config/locales/en.ts

key-decisions:
  - "runReport called as (reportId, user_uid, dto) matching 07-12 signature (plan arg order was swapped)"
  - "assertSupervisor uses UserLevel set membership (ADMIN-safe) like 07-05 settings"
  - "NotificationDispatcherService already exported from NotificationsModule — no change"

patterns-established:
  - "Pattern: CC scheduled delivery via notification_integration with email attachments"
  - "Pattern: Report schedule CRUD under /callcenter/report-schedules supervisor-gated"

requirements-completed: [D-35]

duration: 20min
completed: 2026-07-16
---

# Phase 07 Plan 15: Automated Report Delivery / Schedules Summary

**Supervisor-managed report schedules with cron delivery: reuse 07-12 runReport/exporters, email attachments via MailerService, messenger summaries via Phase 6 notification_integration (D-35)**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-16T03:05:07Z
- **Completed:** 2026-07-16T03:15:00Z
- **Tasks:** 4
- **Files modified:** 19

## Accomplishments

- `cc_report_schedules` model + standalone migration with due-schedule index; wired into app/CallCenter modules + MailerModule
- Delivery service: tenant mismatch guard, period presets, email XLSX/CSV attachments, messenger text summary
- Scheduler `@Cron(EVERY_10_MINUTES)` with `MAX_PER_TICK=50`, sequential try/catch, next_run_at recalculation
- Supervisor CRUD API + settings tab UI (CSV/XLSX only; PDF remains manual client export)

## Task Commits

Each task was committed atomically:

1. **Task 1: Model + migration + module wiring** — `73f540a` (feat)
2. **Task 2: Mailer attachments + delivery service** — `e5bdf94` (feat)
3. **Task 3: Scheduler + CRUD service/controller/DTO** — `ce86e25` (feat)
4. **Task 4: RTK schedules + ReportSchedulesManager + i18n** — `7b730ca` (feat)

**Plan metadata:** `eb34408` (docs: complete plan)

## Files Created/Modified

- `report-schedule.model.ts` / migration — `CcReportSchedule` + indexes
- `callcenter-report-delivery.service.ts` (+spec) — generate + deliver
- `callcenter-report-schedules.service.ts` (+spec) / scheduler / controller / DTO
- `mailer.service.ts` — `sendReportMail` with attachments
- `callCenterReportsApi.ts` + `rtkApi` tag `ReportSchedules`
- `ReportSchedulesManager` + settings tab + ru/en i18n

## Decisions Made

- Matched real `runReport(reportId, vpbxUserUid, query)` signature from 07-12 instead of plan’s swapped args
- Used UserLevel set membership for assertSupervisor so ADMIN is not blocked
- Left NotificationsModule exports unchanged (dispatcher already exported by prior plans)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan documented wrong runReport argument order**
- **Found during:** Task 2
- **Issue:** Plan said `runReport(schedule.user_uid, report_id, dto)`; 07-12 API is `(reportId, vpbxUserUid, query)`
- **Fix:** Call correct signature; tests assert `runReport('queue-summary', 42, …)`
- **Files modified:** `callcenter-report-delivery.service.ts`, `.spec.ts`
- **Committed in:** `e5bdf94`

**2. [Rule 2 - Correctness] assertSupervisor uses UserLevel set membership**
- **Found during:** Task 3
- **Issue:** Numeric `level >= 3` blocks ADMIN (level 1) — known Phase 07 pitfall
- **Fix:** Copied 07-05 settings controller set-membership gate
- **Files modified:** `callcenter-report-schedules.controller.ts`
- **Committed in:** `ce86e25`

**Total deviations:** 2 auto-fixed  
**Impact on plan:** Correctness only; no scope creep.

## Issues Encountered

- Pre-existing backend/frontend `tsc` errors outside this plan (ivrs/voice-robots specs; CallGroupFormModal test; NotificationIntegrationFormModal; RoutePhonebooksTab) — out of scope
- `resolvePeriod('yesterday')` ISO date depends on local TZ; test asserts window bounds, not a fixed UTC date string

## User Setup Required

- Apply migration from `packages/backend`:  
  `npx ts-node src/modules/callcenter/migrate-callcenter-report-schedules-phase7.ts`
- SMTP must already be configured for email attachments (existing MailerService env)

## Known Stubs

None — schedules load from live API; empty/error/loading states are real UI.

## Threat Flags

None beyond plan threat model (T-07-15-01…06 mitigated in Tasks 2–3).

## Next Phase Readiness

- Phase 07 last plan complete — ready for `/gsd-verify-work 7` / UAT
- Manual: create email + telegram schedules, run-now, confirm operator level 2 gets 403

## Self-Check: PASSED

- FOUND: packages/backend/src/modules/callcenter/models/report-schedule.model.ts
- FOUND: packages/backend/src/modules/callcenter/reports/callcenter-report-delivery.service.ts
- FOUND: packages/backend/src/modules/callcenter/reports/callcenter-report-scheduler.service.ts
- FOUND: packages/backend/src/modules/callcenter/reports/callcenter-report-schedules.controller.ts
- FOUND: packages/frontend/src/features/callcenter/ui/ReportSchedulesManager/ReportSchedulesManager.tsx
- FOUND commits: 73f540a, e5bdf94, ce86e25, 7b730ca
- Tests: backend delivery+schedules specs green; `npm run test:cc` frontend 34/34
