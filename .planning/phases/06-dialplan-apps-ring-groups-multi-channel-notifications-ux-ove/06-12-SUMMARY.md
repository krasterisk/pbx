---
phase: 06-dialplan-apps-ring-groups-multi-channel-notifications-ux-ove
plan: 12
subsystem: ui
tags: [react, redux, rtk-query, notifications, vitest, i18n]

requires:
  - phase: 06-10
    provides: notificationApi RTK hooks and Notifications cache tags
provides:
  - NotificationIntegrationsPage with list/table and create/edit/copy modal
  - channelFields descriptor map for six channels with secret flags and hints
  - /integrations route with ru/en i18n
affects:
  - 06-13-notify-app
  - 06-14-dialplan-apps

tech-stack:
  added: []
  patterns:
    - "Channel-driven form fields via CHANNEL_FIELDS descriptor map"
    - "Write-only credentials: password inputs empty on edit, merged into credentials on save"

key-files:
  created:
    - packages/frontend/src/features/notifications/config/channelFields.ts
    - packages/frontend/src/features/notifications/ui/NotificationIntegrationsPage/NotificationIntegrationsPage.tsx
    - packages/frontend/src/features/notifications/ui/NotificationIntegrationsTable/NotificationIntegrationsTable.tsx
    - packages/frontend/src/features/notifications/ui/NotificationIntegrationFormModal/NotificationIntegrationFormModal.tsx
    - packages/frontend/src/features/notifications/model/slice/notificationsPageSlice.ts
  modified:
    - packages/frontend/src/app/router/router.tsx
    - packages/frontend/src/app/store/store.ts
    - packages/frontend/src/shared/api/endpoints/notificationApi.ts
    - packages/frontend/src/shared/config/locales/en.ts
    - packages/frontend/src/shared/config/locales/ru.ts

key-decisions:
  - "Non-secret channel params live in config; secret tokens map to credentials object on save"
  - "Edit mode keeps channel locked and secret fields blank with keep-existing hint"

patterns-established:
  - "Per-channel field descriptors: { key, labelKey, hintKey, secret } in channelFields.ts"
  - "QueuesPage analog: page slice + table + modal wired through Redux modalMode"

requirements-completed: [D-10, D-11, D-13, D-16]

duration: 7min
completed: 2026-07-15
---

# Phase 06 Plan 12: Notification Integrations UI Summary

**Dedicated `/integrations` page with channel-driven create/edit/copy modal, per-field hints, masked write-only secrets, and notificationApi persistence**

## Performance

- **Duration:** 7 min
- **Started:** 2026-07-15T11:38:00Z
- **Completed:** 2026-07-15T11:45:00Z
- **Tasks:** 2
- **Files modified:** 16

## Accomplishments

- Built `CHANNEL_FIELDS` descriptor map covering all six notification channels with `secret` flags on token/key fields
- Added `NotificationIntegrationsPage`, table (name/channel/actions), Redux slice, and `/integrations` route
- Implemented `NotificationIntegrationFormModal` with dynamic fields, `InfoTooltip` hints, password inputs for secrets, and create/update via `notificationApi`
- Added Vitest integration tests for channel switching, hints, masked secrets, and submit payload shape

## Task Commits

1. **Task 1: Channel field descriptors + page + table + slice + route + i18n** - `b3fca44` (feat)
2. **Task 2: Form modal (channel-driven fields + hints) + integration test** - `c7b0865` (feat)

## Files Created/Modified

- `packages/frontend/src/features/notifications/config/channelFields.ts` - Per-channel field descriptors
- `packages/frontend/src/features/notifications/ui/NotificationIntegrationsPage/NotificationIntegrationsPage.tsx` - Page shell mirroring QueuesPage
- `packages/frontend/src/features/notifications/ui/NotificationIntegrationsTable/NotificationIntegrationsTable.tsx` - DataTable with edit/copy/delete
- `packages/frontend/src/features/notifications/ui/NotificationIntegrationFormModal/NotificationIntegrationFormModal.tsx` - Channel-driven modal with hints and secrets
- `packages/frontend/src/features/notifications/model/slice/notificationsPageSlice.ts` - Modal state slice
- `packages/frontend/src/app/router/router.tsx` - `integrations` route
- `packages/frontend/src/shared/config/locales/en.ts` / `ru.ts` - `notifications.*` keys and field hints
- `packages/frontend/src/shared/api/endpoints/notificationApi.ts` - credentials typed as object

## Decisions Made

- Secret fields populate `credentials` on save; non-secret fields populate `config`, matching backend DTO
- Channel selector disabled in edit mode to avoid orphan config when switching providers
- Exported `buildIntegrationSubmitPayload` for testable config/credentials separation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Registered notificationsPageReducer in store**
- **Found during:** Task 1
- **Issue:** Slice created but store not wired; modal/page dispatch would fail at runtime
- **Fix:** Added reducer import and `notificationsPage` key in `store.ts`
- **Files modified:** `packages/frontend/src/app/store/store.ts`
- **Committed in:** `b3fca44`

**2. [Rule 1 - Bug] Fixed notificationApi credentials type**
- **Found during:** Task 2
- **Issue:** Frontend API typed `credentials` as `string`; backend expects `Record<string, unknown>`
- **Fix:** Updated create/update DTO interfaces to object type
- **Files modified:** `packages/frontend/src/shared/api/endpoints/notificationApi.ts`
- **Committed in:** `c7b0865`

**3. [Rule 3 - Blocking] Stabilized modal reset effect and test Tooltip mock**
- **Found during:** Task 2 (Vitest)
- **Issue:** Radix Tooltip inside Dialog caused infinite update depth in tests
- **Fix:** Removed unstable `t` dep from reset effect; mocked `InfoTooltip` in test file
- **Files modified:** `NotificationIntegrationFormModal.tsx`, `NotificationIntegrationFormModal.test.tsx`
- **Committed in:** `c7b0865`

---

**Total deviations:** 3 auto-fixed (1 missing critical, 1 bug, 1 blocking)
**Impact on plan:** All required for correct API contract and test stability. No scope creep.

## Issues Encountered

- `gsd-tools` SDK not built locally; STATE/ROADMAP updated manually
- Pre-existing `tsc` errors in unrelated files (call-groups, dialplan registry, routes) remain out of scope

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Integrations UI ready for NotifyApp dialplan editor (06-13) to pick `integration_uid`
- Sidebar nav link to `/integrations` not added (route only); can be wired in a follow-up UX pass

## Self-Check: PASSED

- FOUND: `.planning/phases/06-dialplan-apps-ring-groups-multi-channel-notifications-ux-ove/06-12-SUMMARY.md`
- FOUND: `packages/frontend/src/features/notifications/ui/NotificationIntegrationFormModal/NotificationIntegrationFormModal.tsx`
- FOUND: `packages/frontend/src/features/notifications/config/channelFields.ts`
- FOUND: commit `b3fca44`
- FOUND: commit `c7b0865`

---
*Phase: 06-dialplan-apps-ring-groups-multi-channel-notifications-ux-ove*
*Completed: 2026-07-15*
