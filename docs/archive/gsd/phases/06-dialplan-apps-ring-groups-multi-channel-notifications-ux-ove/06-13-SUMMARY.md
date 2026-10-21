---
phase: 06-dialplan-apps-ring-groups-multi-channel-notifications-ux-ove
plan: 13
subsystem: ui
tags: [react, dialplan-apps, GroupApp, NotifyApp, registry, call-groups, notifications, vitest, i18n]

requires:
  - phase: 06-10
    provides: callGroupApi + notificationApi RTK hooks
  - phase: 06-11
    provides: CallGroupFormModal for inline reuse
provides:
  - GroupApp with call-group Select (params.group = String(uid)) + inline CallGroupFormModal create/edit
  - NotifyApp with integration Select + message template + presets + optional target
  - notifyPresets channel-var templates
  - registry togroup→GroupApp, notify→NotifyApp (GenericApp preserved for other apps)
affects: [06-14 CallerIdApp/TrunkCarouselApp, route editor dialplan UX]

tech-stack:
  added: []
  patterns:
    - dialplan-app Select + RTK query + SCSS modules (QueueApp analog)
    - inline sub-entity editor via shared CallGroupFormModal + onSaved callback
    - notify presets fill params.message with Asterisk channel vars

key-files:
  created:
    - packages/frontend/src/features/dialplan-apps/ui/apps/GroupApp/GroupApp.tsx
    - packages/frontend/src/features/dialplan-apps/ui/apps/GroupApp/GroupApp.module.scss
    - packages/frontend/src/features/dialplan-apps/ui/apps/GroupApp/GroupApp.test.tsx
    - packages/frontend/src/features/dialplan-apps/ui/apps/NotifyApp/NotifyApp.tsx
    - packages/frontend/src/features/dialplan-apps/ui/apps/NotifyApp/NotifyApp.module.scss
    - packages/frontend/src/features/dialplan-apps/ui/apps/NotifyApp/NotifyApp.test.tsx
    - packages/frontend/src/features/dialplan-apps/config/notifyPresets.ts
  modified:
    - packages/frontend/src/features/dialplan-apps/model/registry.ts
    - packages/frontend/src/features/call-groups/ui/CallGroupFormModal/CallGroupFormModal.tsx
    - packages/frontend/src/features/call-groups/index.ts
    - packages/frontend/src/shared/config/locales/en.ts
    - packages/frontend/src/shared/config/locales/ru.ts

key-decisions:
  - "params.group always String(call_group.uid) for Gosub name consistency (Pitfall 2)"
  - "CallGroupFormModal gained optional onSaved so GroupApp refreshes selection after create/edit"
  - "callerid + trunk_carousel registered as GenericApp placeholders until 06-14 dedicated apps"

patterns-established:
  - "Inline route-editor create/edit: mount modal in dialplan app + dispatch slice actions + onSaved → onUpdate"
  - "Notify presets: config maps preset key → channel-var template; UI labels via i18n"

requirements-completed: [D-02, D-12, D-13, D-17, D-18]

duration: 12min
completed: 2026-07-15
---

# Phase 06 Plan 13: GroupApp + NotifyApp Summary

**Dedicated GroupApp (uid Select + inline CallGroupFormModal) and NotifyApp (integration + template + presets) wired into the dialplan registry**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-15T11:47:34Z
- **Completed:** 2026-07-15T11:54:00Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments

- Replaced orphaned `togroup` GenericApp with GroupApp: call-group Select via `useGetCallGroupsQuery`, stores `params.group` as string uid, create/edit opens `CallGroupFormModal` inline
- Added NotifyApp: integration Select via `useGetNotificationsQuery`, message textarea + channel-var InfoTooltip, presets dropdown, optional target override
- Registry wires `togroup`→GroupApp and `notify`→NotifyApp; remaining apps keep prior components / GenericApp fallback (D-18)
- Vitest integration tests green (6 tests)

## Task Commits

1. **Task 1: GroupApp with inline call-group create/edit + registry wiring** - `6cf93c1` (feat)
2. **Task 2: NotifyApp (integration + template + presets) + registry wiring** - `0f32c1b` (feat)
3. **Task 3: Integration tests for GroupApp and NotifyApp** - `72ef108` (test)

**Plan metadata:** `89f18fa` (docs: complete plan)

## Files Created/Modified

- `GroupApp.tsx` / `.module.scss` / `.test.tsx` — call group picker + inline modal
- `NotifyApp.tsx` / `.module.scss` / `.test.tsx` — notify params UI
- `notifyPresets.ts` — channel-var preset templates
- `registry.ts` — togroup/notify wiring + GenericApp stubs for callerid/trunk_carousel
- `CallGroupFormModal.tsx` — optional `onSaved` callback for inline hosts
- `call-groups/index.ts` — public exports for modal + page actions
- `en.ts` / `ru.ts` — `routes.apps.group.*`, `routes.apps.notify.*`, action labels

## Decisions Made

- Store `params.group` / `params.integration_uid` as strings (consistent with other dialplan apps and Gosub naming)
- Extend CallGroupFormModal with `onSaved` rather than duplicating form markup in GroupApp
- Register `callerid` and `trunk_carousel` as GenericApp so `Record<ActionType, …>` typechecks until 06-14

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] CallGroupFormModal onSaved callback**
- **Found during:** Task 1 (GroupApp)
- **Issue:** Modal closed after save without returning uid; GroupApp could not refresh selection after create/edit
- **Fix:** Added optional `onSaved?: (group: ICallGroup) => void`; invoke after successful create/update unwrap
- **Files modified:** `CallGroupFormModal.tsx`, `call-groups/index.ts`
- **Verification:** GroupApp test simulates save → `onUpdate(..., 'params.group', '99')`
- **Committed in:** `6cf93c1`

**2. [Rule 3 - Blocking] Registry missing ActionType keys**
- **Found during:** Task 1 (tsc)
- **Issue:** `ActionType` includes `notify`, `callerid`, `trunk_carousel` but registry omitted them → TS2739
- **Fix:** Added entries; Task 2 wired `notify`→NotifyApp; `callerid`/`trunk_carousel` remain GenericApp until 06-14
- **Files modified:** `registry.ts`, locales for action labels
- **Verification:** Registry satisfies `Record<ActionType, IDialplanAppConfig>`
- **Committed in:** `6cf93c1` / `0f32c1b`

**Total deviations:** 2 auto-fixed (1× Rule 2, 1× Rule 3)
**Impact on plan:** Required for D-02 selection refresh and TypeScript completeness; no scope creep beyond ActionType stubs.

## Issues Encountered

Pre-existing `tsc --noEmit` errors remain outside this plan's files (`CallGroupFormModal.test.tsx` tuple typing, `NotificationIntegrationFormModal` credentials type, `RoutePhonebooksTab` Text title prop). Registry missing-keys error from this wave is fixed. Vitest for GroupApp/NotifyApp is green.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for 06-14 (CallerIdApp / TrunkCarouselApp) to replace GenericApp stubs for `callerid` and `trunk_carousel`
- Route editor can use GroupApp/NotifyApp via existing DialplanAppsEditor registry lookup

## Self-Check: PASSED

- FOUND: packages/frontend/src/features/dialplan-apps/ui/apps/GroupApp/GroupApp.tsx
- FOUND: packages/frontend/src/features/dialplan-apps/ui/apps/NotifyApp/NotifyApp.tsx
- FOUND: packages/frontend/src/features/dialplan-apps/config/notifyPresets.ts
- FOUND: packages/frontend/src/features/dialplan-apps/model/registry.ts (GroupApp + NotifyApp)
- FOUND: commit 6cf93c1
- FOUND: commit 0f32c1b
- FOUND: commit 72ef108

---
*Phase: 06-dialplan-apps-ring-groups-multi-channel-notifications-ux-ove*
*Completed: 2026-07-15*
