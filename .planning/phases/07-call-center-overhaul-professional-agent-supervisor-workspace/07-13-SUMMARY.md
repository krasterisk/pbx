---
phase: 07-call-center-overhaul-professional-agent-supervisor-workspace
plan: 13
subsystem: ui
tags: [react, wallboard, sse, display-token, recharts, callcenter, rtk-query]

requires:
  - phase: 07-10
    provides: DisplayTokenGuard SSE + token CRUD + alert-config endpoints
  - phase: 07-05
    provides: CallCenterSettingsPage shell + AlertThresholdsForm + Switch
  - phase: 07-08
    provides: shared/ui Progress with tone info|success|warning|destructive
provides:
  - Public TV CallCenterWallboardPage (/callcenter/wallboard?token=)
  - useWallboardSSE (display-token from URL, never localStorage)
  - DisplayTokensManager + AlertRoutingForm on settings
affects: [07-14, TV display mode, supervisor alert routing UX]

tech-stack:
  added: []
  patterns:
    - "Public route outside AppLayout; SSE auth via opaque display-token query only"
    - "TV thresholds are visual defaults; server D-27 thresholds stay in cc_settings"

key-files:
  created:
    - packages/frontend/src/features/callcenter/lib/useWallboardSSE.ts
    - packages/frontend/src/features/callcenter/model/lib/wallboardChartData.ts
    - packages/frontend/src/features/callcenter/model/lib/wallboardChartData.spec.ts
    - packages/frontend/src/features/callcenter/ui/WallboardKpi/WallboardKpi.tsx
    - packages/frontend/src/pages/CallCenterWallboardPage/CallCenterWallboardPage.tsx
    - packages/frontend/src/features/callcenter/ui/DisplayTokensManager/DisplayTokensManager.tsx
    - packages/frontend/src/features/callcenter/ui/AlertRoutingForm/AlertRoutingForm.tsx
  modified:
    - packages/frontend/src/shared/api/endpoints/callCenterApi.ts
    - packages/frontend/src/shared/api/rtkApi.ts
    - packages/frontend/src/app/router/router.tsx
    - packages/frontend/src/pages/CallCenterSettingsPage/CallCenterSettingsPage.tsx
    - packages/frontend/src/shared/config/locales/ru.ts
    - packages/frontend/src/shared/config/locales/en.ts

key-decisions:
  - "Wallboard uses WALLBOARD_DEFAULT_THRESHOLDS locally; no JWT settings fetch on public TV"
  - "Removed AppLayout placeholder wallboard route; public top-level route only"
  - "Progress reused from 07-08 unchanged (tone union keeps info for WrapupBar)"

patterns-established:
  - "Pattern: display-token SSE hook mirrors useCallCenterSSE but token is an argument"
  - "Pattern: settings tab pairs AlertThresholdsForm (WHEN) + AlertRoutingForm (WHERE)"

requirements-completed: [D-27, D-29]

duration: 10min
completed: 2026-07-16
---

# Phase 07 Plan 13: Wallboard UI Summary

**Public TV wallboard with fixed KPI layout over display-token SSE, plus supervisor UI for token lifecycle and alert delivery routing (D-29 + D-27)**

## Performance

- **Duration:** 10 min
- **Started:** 2026-07-16T02:15:52Z
- **Completed:** 2026-07-16T02:25:22Z
- **Tasks:** 3
- **Files modified:** 20

## Accomplishments

- RTK wallboard endpoints (tokens + alert-config), `useWallboardSSE`, and tested `bucketHourlyDeltas` / `pushSample`
- Public `/callcenter/wallboard` TV page: KPI strip, live calls/hour chart, agent status strip, queue SLA bars; forced dark chrome; fullscreen auto-hide
- Settings: Display-токены tab (create/copy/revoke) and AlertRoutingForm under thresholds (closes D-27 delivery path)

## Task Commits

Each task was committed atomically:

1. **Task 1: Wallboard contracts (RTK + SSE + chart)** - `3375190` (feat)
2. **Task 2: CallCenterWallboardPage + public route** - `98bca96` (feat)
3. **Task 3: DisplayTokensManager + AlertRoutingForm** - `e08f229` (feat)

## Files Created/Modified

- `useWallboardSSE.ts` — EventSource to `/callcenter/wallboard/events?token=`
- `wallboardChartData.ts` + `.spec.ts` — pure hourly delta bucketing
- `WallboardKpi` — TV KPI card with threshold tone + critical pulse
- `CallCenterWallboardPage` — fixed layout consumer of display-token SSE
- `DisplayTokensManager` — supervisor create/copy/revoke TV links
- `AlertRoutingForm` — integration/target/enabled/cooldown routing
- `callCenterApi.ts` / `rtkApi.ts` — CcDisplayTokens / CcAlertConfig tags + endpoints
- `router.tsx` — public wallboard route outside AppLayout
- `CallCenterSettingsPage.tsx` — displayTokens tab + routing form under thresholds
- `ru.ts` / `en.ts` — `callcenter.wallboard.*`, `displayTokens.*`, `alertRouting.*`

## Decisions Made

- Visual thresholds on TV are `WALLBOARD_DEFAULT_THRESHOLDS` matching 07-05 defaults; server thresholds stay privileged
- Replaced nested RequireRole wallboard placeholder with a single public top-level route
- Did not recreate `Progress`; imported from `@/shared/ui/Progress/Progress` as in WrapupBar

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `npx tsc --noEmit` still fails on pre-existing unrelated files (CallGroupFormModal.test, NotificationIntegrationFormModal, RoutePhonebooksTab). No new errors in 07-13 files. `npm run test:cc` green (34 tests).

## User Setup Required

None

## Known Stubs

None - wallboard empty-state without token is intentional UX, not a stub.

## Threat Flags

None beyond plan threat model (T-07-13-01…05 mitigated as specified).

## Self-Check: PASSED

- FOUND: CallCenterWallboardPage.tsx, useWallboardSSE.ts, wallboardChartData.ts, DisplayTokensManager.tsx, AlertRoutingForm.tsx
- FOUND: commits 3375190, 98bca96, e08f229
