---
phase: 14-visual-route-builder-and-automation
plan: 10
subsystem: ui
tags: [d-48, usage-tab, delete-precheck, route-references, 409]

requires:
  - phase: 14-visual-route-builder-and-automation
    provides: GET /route-references/:kind/:uid and 409 { message, references } from 14-02
provides:
  - UsageTab Card-row list with raw_dialplan and toroute caveats
  - routeReferencesApi getUsage RTK query
  - DeleteBlockedDialog with disabled destructive confirm when references nonempty
  - Usage tab last in edit on IVR, route, queue, voice robot, call group, notification (directory wired in working tree)
affects:
  - 14-06 (shared references.* locale keys; this plan used t(key, fallback) and did not touch locales)
  - verify-work Surface O / P UAT

actuals:
  tokens: 46388
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - Polymorphic getUsage(kind, uid) consuming 14-02 index
    - Variant B tab strip copied onto previously tabless hosts only in edit
    - Delete precheck + 409 backstop, no force-delete

key-files:
  created:
    - packages/frontend/src/features/route-references/ui/UsageTab/UsageTab.tsx
    - packages/frontend/src/features/route-references/ui/UsageTab/UsageTab.module.scss
    - packages/frontend/src/features/route-references/ui/DeleteBlockedDialog/DeleteBlockedDialog.tsx
    - packages/frontend/src/shared/api/endpoints/routeReferencesApi.ts
  modified:
    - packages/frontend/src/features/ivrs/ui/IvrFormModal/IvrFormModal.tsx
    - packages/frontend/src/features/routes/ui/RouteFormModal/RouteFormModal.tsx
    - packages/frontend/src/features/queues/ui/QueueFormModal/QueueFormModal.tsx
    - packages/frontend/src/features/voiceRobots/ui/VoiceRobotForm/VoiceRobotForm.tsx
    - packages/frontend/src/features/call-groups/ui/CallGroupFormModal/CallGroupFormModal.tsx
    - packages/frontend/src/features/notifications/ui/NotificationIntegrationFormModal/NotificationIntegrationFormModal.tsx
    - packages/frontend/src/features/tenant-settings/ui/TenantSettingsSection/TenantSettingsSection.tsx

key-decisions:
  - "Route host skips GET /route-references/route/:uid because 14-02 has no route kind; empty state plus toroute caveat is the honest D-48 surface"
  - "Directory Usage tab implemented in working tree but not committed to avoid mixing uncommitted CSV WIP"
  - "t(key, fallback) for references.* copy; locales owned by 14-06"

patterns-established:
  - "Usage tab last, edit-only, Card rows not DataTable"
  - "Delete CTA disabled while usage is loading, failed, or nonempty; 409 keeps the host modal open"

requirements-completed: [D-48]

coverage:
  - id: D1
    description: Usage tab last in edit on IVR and remaining tabbed hosts
    requirement: D-48
    verification:
      - kind: unit
        ref: packages/frontend/src/features/ivrs/ui/IvrFormModal/IvrFormModal.test.tsx#appends Usage last in edit mode only
        status: pass
    human_judgment: false
  - id: D2
    description: Empty usage shows raw_dialplan caveat when meta.hasRawDialplanRoutes
    requirement: D-48
    verification:
      - kind: unit
        ref: packages/frontend/src/features/route-references/ui/UsageTab/UsageTab.test.tsx#shows empty copy and raw_dialplan caveat
        status: pass
    human_judgment: false
  - id: D3
    description: Route usage empty state mentions toroute pattern caveat
    requirement: D-48
    verification:
      - kind: unit
        ref: packages/frontend/src/features/route-references/ui/UsageTab/UsageTab.test.tsx#shows toroute pattern caveat on the route host
        status: pass
    human_judgment: false
  - id: D4
    description: Delete destructive action disabled when references nonempty; 409 keeps modal open
    requirement: D-48
    verification:
      - kind: unit
        ref: packages/frontend/src/features/route-references/ui/DeleteBlockedDialog/DeleteBlockedDialog.test.tsx#disables destructive confirm when references are nonempty
        status: pass
    human_judgment: false

duration: 27min
completed: 2026-09-03
status: complete
---

# Phase 14 Plan 10: Usage tabs + delete precheck Summary

**Usage tab (Card rows, not DataTable) on entity hosts plus DeleteBlockedDialog precheck/409 backstop, wired to GET /route-references**

## Performance

- **Duration:** 27 min
- **Started:** 2026-09-03T19:45:43Z
- **Completed:** 2026-09-03T20:13:00Z
- **Tasks:** 3
- **Files modified:** 21

## Accomplishments

- Shipped `UsageTab` with Card rows, location Badge, ExternalLink, loading/error/empty states, and D-48 caveats (`hasRawDialplanRoutes` + toroute)
- Mounted Usage last in edit on IVR, route, queue, voice robot, call group, and notification hosts (variant B strip on the two previously tabless hosts)
- Added `DeleteBlockedDialog` and prefetch on IVR/queue edit so delete is blocked client-side and 409 keeps the modal open; replaced the leftover «Появится позже» flowchart hint

## Task Commits

1. **Task 1: End-to-end IVR usage tab** - `d40d34f` (feat)
2. **Task 2: Wire remaining hosts + variant B tabs** - `a9da179` (feat)
3. **Task 3: Delete precheck + settings hint** - `270322c` (feat)

**Plan metadata:** pending docs commit

## Files Created/Modified

- `packages/frontend/src/shared/api/endpoints/routeReferencesApi.ts` - `getUsage` + 409 `extractRouteReferences`
- `packages/frontend/src/features/route-references/ui/UsageTab/UsageTab.tsx` - Surface O list
- `packages/frontend/src/features/route-references/ui/DeleteBlockedDialog/DeleteBlockedDialog.tsx` - Surface P confirm with disabled force-delete
- `packages/frontend/src/features/ivrs/ui/IvrFormModal/IvrFormModal.tsx` - Usage last + delete precheck
- `packages/frontend/src/features/routes/ui/RouteFormModal/RouteFormModal.tsx` - Usage last + toroute caveat
- `packages/frontend/src/features/queues/ui/QueueFormModal/QueueFormModal.tsx` - Usage last + delete precheck
- `packages/frontend/src/features/voiceRobots/ui/VoiceRobotForm/VoiceRobotForm.tsx` - Usage last in edit
- `packages/frontend/src/features/call-groups/ui/CallGroupFormModal/CallGroupFormModal.tsx` - variant B strip in edit
- `packages/frontend/src/features/notifications/ui/NotificationIntegrationFormModal/NotificationIntegrationFormModal.tsx` - variant B strip in edit
- `packages/frontend/src/features/directories/ui/DirectoryFormModal/DirectoryFormModal.tsx` - Usage tab in working tree (not in Task 2 commit)
- `packages/frontend/src/features/tenant-settings/ui/TenantSettingsSection/TenantSettingsSection.tsx` - Schema-tab hint, duplicate body copy removed

## Decisions Made

- Route kind is UI-only: 14-02 `ActionReferenceKind` has no `route`, so the client skips the GET and shows the toroute honesty empty state
- Directory Usage tab was not committed with Task 2 because `DirectoryFormModal` already carried unrelated CSV WIP
- Copy uses `t(key, fallback)` from UI-SPEC; locale files were not touched (14-06)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated host tests that assumed Schema was last**
- **Found during:** Task 1 / Task 2
- **Issue:** Existing IVR and Route tests asserted Schema as the last tab
- **Fix:** Tests now expect Usage last in edit; Schema stays immediately before it
- **Files modified:** `IvrFormModal.test.tsx`, `RouteFormModal.test.tsx`
- **Verification:** host tests pass
- **Committed in:** `d40d34f` / `a9da179`

**2. [Rule 3 - Blocking] Directory Usage left unstaged**
- **Found during:** Task 2 commit
- **Issue:** `DirectoryFormModal` already had uncommitted CSV/import WIP from another stream
- **Fix:** Usage tab is implemented in the working tree; file not staged to avoid mixing plans
- **Files modified:** `DirectoryFormModal.tsx` (working tree only)
- **Verification:** DirectoryFormModal test for Usage tab passes locally
- **Committed in:** none (deviation)

---

**Total deviations:** 2 auto-fixed (1 test update, 1 staging boundary)
**Impact on plan:** Six of seven hosts are committed; directory Usage exists in the working tree and needs a follow-up commit once CSV WIP is settled.

## Issues Encountered

- Backend 14-02 does not accept `kind=route`; client treats that host as caveat-only rather than calling a 400 endpoint
- QueueFormModal test needed a radix Dialog mock to avoid a Presence update-depth loop

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Surface O/P UI is ready for verify-work; directory Usage should be committed with the directories WIP or a follow-up
- 14-06 should seed `references.*` and the updated `settings.tenant.showFlowchartHint` strings

---
*Phase: 14-visual-route-builder-and-automation*
*Completed: 2026-09-03*

## Self-Check: PASSED
