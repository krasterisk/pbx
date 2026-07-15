---
phase: 06-dialplan-apps-ring-groups-multi-channel-notifications-ux-ove
plan: 11
subsystem: ui
tags: [react, rtk-query, redux, vitest, scss-modules, call-groups]

requires:
  - phase: 06-dialplan-apps-ring-groups-multi-channel-notifications-ux-ove
    provides: callGroupApi RTK hooks from 06-10
provides:
  - CallGroupsPage list with create/edit/copy modal
  - CallGroupMembersEditor with ordered internal/external members
  - call-groups route and callGroups.* i18n (ru+en)
affects: [06-13]

tech-stack:
  added: []
  patterns:
    - "Queues-page FSD mirror for call-groups feature slice"
    - "useGetContextsQuery for external_context Select with ctx-{vpbxUserUid} fallback Input"

key-files:
  created:
    - packages/frontend/src/features/call-groups/ui/CallGroupsPage/CallGroupsPage.tsx
    - packages/frontend/src/features/call-groups/ui/CallGroupsTable/CallGroupsTable.tsx
    - packages/frontend/src/features/call-groups/ui/CallGroupFormModal/CallGroupFormModal.tsx
    - packages/frontend/src/features/call-groups/ui/CallGroupFormModal/CallGroupMembersEditor.tsx
    - packages/frontend/src/features/call-groups/model/slice/callGroupsPageSlice.ts
    - packages/frontend/src/features/call-groups/ui/CallGroupFormModal/CallGroupFormModal.test.tsx
  modified:
    - packages/frontend/src/app/router/router.tsx
    - packages/frontend/src/app/store/store.ts
    - packages/frontend/src/shared/config/locales/en.ts
    - packages/frontend/src/shared/config/locales/ru.ts

key-decisions:
  - "external_context Select uses useGetContextsQuery; falls back to validated Input pre-filled ctx-{vpbxUserUid} when contexts list is empty"
  - "Call groups keyed by uid in slice/API (not queue-style name) matching backend CRUD"
  - "Members submitted with position = array index on create/update"

patterns-established:
  - "CallGroupFormModal triadic create|edit|copy mirrors queues modal pattern with @/shared/ui + SCSS modules"
  - "CallGroupMembersEditor reorder via withPositions + up/down handlers from RoutePhonebooksTab"

requirements-completed: [D-02, D-03, D-04, D-05, D-06, D-07]

duration: 8min
completed: 2026-07-15
---

# Phase 06 Plan 11: Call Groups UI Summary

**Dedicated Call Groups page with create/edit/copy modal, strategy selector, ordered internal/external members editor, and callGroupApi persistence**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-15T11:38:00Z
- **Completed:** 2026-07-15T11:46:00Z
- **Tasks:** 3
- **Files modified:** 15

## Accomplishments

- Call Groups list page at `/call-groups` with table (name, strategy, member count, actions)
- `CallGroupFormModal` supports create/edit/copy with ringall/hunt/memoryhunt/random strategy, ring_time, external_context, optional cid_prefix
- `CallGroupMembersEditor` adds/reorders/removes internal and external members with per-member ring_time
- Integration test covers strategy options, member add/reorder, and create mutation payload shape
- i18n keys under `callGroups.*` in both `en.ts` and `ru.ts`

## Task Commits

Each task was committed atomically:

1. **Task 1: Page + table + slice + route + i18n scaffolding** - `6685b4a` (feat)
2. **Task 2: Form modal + members editor** - `632d9ed` (feat)
3. **Task 3: Integration test for CallGroupFormModal** - `0aa8164` (test)

**Plan metadata:** skipped (commit_docs per project config)

## Files Created/Modified

- `packages/frontend/src/features/call-groups/` - Full FSD feature (page, table, modal, members editor, slice, selectors)
- `packages/frontend/src/app/router/router.tsx` - `call-groups` route
- `packages/frontend/src/app/store/store.ts` - `callGroupsPage` reducer registration
- `packages/frontend/src/shared/config/locales/en.ts` / `ru.ts` - `callGroups.*` and `nav.callGroups`

## Decisions Made

- `external_context` populated from `useGetContextsQuery`; when empty, validated Input defaults to `ctx-${vpbxUserUid}` (same pattern as RouteFormModal tenant context)
- UID-based selection for edit/copy/delete (backend uses numeric uid, unlike queues name-keyed API)
- Lightweight form: no queue-style agent/MOH/penalty fields (D-03)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed modal reset effect infinite re-render loop**
- **Found during:** Task 3 (integration test)
- **Issue:** Dual `useEffect` hooks on `externalContext` caused maximum update depth in Dialog tests
- **Fix:** Consolidated reset logic into single effect; removed redundant externalContext watcher
- **Files modified:** `CallGroupFormModal.tsx`
- **Verification:** `npx vitest run CallGroupFormModal` green
- **Committed in:** `0aa8164`

**2. [Rule 3 - Blocking] Removed unsupported DataTable isLoading prop**
- **Found during:** Task 1 (tsc verify)
- **Issue:** `DataTable` does not accept `isLoading` prop
- **Fix:** Removed prop from `CallGroupsTable`
- **Files modified:** `CallGroupsTable.tsx`
- **Verification:** No call-groups tsc errors
- **Committed in:** `6685b4a` (before commit, included in task 1 files)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes required for compile/test correctness. No scope creep.

## Issues Encountered

- Pre-existing `tsc --noEmit` failures in unrelated files (`registry.ts`, `RoutePhonebooksTab.tsx`) remain out of scope; call-groups files compile clean

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `CallGroupFormModal` ready for inline reuse from route editor in 06-13
- Call Groups CRUD UI complete; list refreshes via RTK invalidatesTags

## Self-Check: PASSED

- FOUND: packages/frontend/src/features/call-groups/ui/CallGroupsPage/CallGroupsPage.tsx
- FOUND: packages/frontend/src/features/call-groups/ui/CallGroupFormModal/CallGroupFormModal.tsx
- FOUND: packages/frontend/src/features/call-groups/ui/CallGroupFormModal/CallGroupFormModal.test.tsx
- FOUND: .planning/phases/06-dialplan-apps-ring-groups-multi-channel-notifications-ux-ove/06-11-SUMMARY.md
- FOUND: 6685b4a
- FOUND: 632d9ed
- FOUND: 0aa8164

---
*Phase: 06-dialplan-apps-ring-groups-multi-channel-notifications-ux-ove*
*Completed: 2026-07-15*
