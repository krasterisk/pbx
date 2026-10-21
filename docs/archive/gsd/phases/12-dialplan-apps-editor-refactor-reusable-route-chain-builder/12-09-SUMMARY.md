---
phase: 12-dialplan-apps-editor-refactor-reusable-route-chain-builder
plan: 09
subsystem: ui
tags: [tenant-settings, rtk-query, optimistic-toggle, settings-page, raw-dialplan, d-16, d-17, d-18, d-19]

requires:
  - phase: 12-04
    provides: GET/PUT /tenant-settings and TENANT_SETTING_KEYS D-17 defaults
  - phase: 12-07
    provides: RouteActionsTab / RawDialplanEditor host for D-16 visibility
provides:
  - tenantSettingsApi with optimistic toggle and undo
  - TenantSettingsSection on SettingsPage SECTIONS[5]
  - routes.show_raw_dialplan hides Dialplan mode without wiping raw_dialplan
affects:
  - 12-08 host wiring (flag already consumed in RouteActionsTab)
  - 12-17 UAT of settings and raw dialplan visibility

tech-stack:
  added: []
  patterns:
    - "Optimistic Switch: updateQueryData patch → replace with server data → patchResult.undo() in catch"
    - "Loading Switch omits checked until values resolve (no false default)"
    - "Public entity hooks aliased over Vpbx-prefixed RTK endpoints to avoid callCenter collision"

key-files:
  created:
    - packages/frontend/src/entities/tenantSettings/api/tenantSettingsApi.ts
    - packages/frontend/src/entities/tenantSettings/api/tenantSettingsApi.test.ts
    - packages/frontend/src/entities/tenantSettings/model/types/tenantSettings.ts
    - packages/frontend/src/entities/tenantSettings/index.ts
    - packages/frontend/src/features/tenant-settings/ui/TenantSettingsSection/TenantSettingsSection.tsx
    - packages/frontend/src/features/tenant-settings/ui/TenantSettingsSection/TenantSettingsSection.module.scss
    - packages/frontend/src/features/tenant-settings/ui/TenantSettingsSection/TenantSettingsSection.test.tsx
    - packages/frontend/src/features/tenant-settings/ui/TenantSettingsSection/index.ts
    - packages/frontend/src/features/routes/ui/RouteFormModal/RouteActionsTab.test.tsx
    - packages/frontend/src/features/routes/ui/RouteFormModal/RouteFormModal.test.tsx
  modified:
    - packages/frontend/src/shared/api/rtkApi.ts
    - packages/frontend/src/pages/SettingsPage/SettingsPage.tsx
    - packages/frontend/src/pages/SettingsPage/SettingsPage.test.tsx
    - packages/frontend/src/features/routes/ui/RouteFormModal/RouteActionsTab.tsx
    - packages/frontend/src/features/routes/ui/RouteFormModal/RouteFormModal.tsx

key-decisions:
  - "RTK endpoints named getVpbxTenantSettings/updateVpbxTenantSettings; hooks aliased as useGetTenantSettingsQuery/useUpdateTenantSettingsMutation"
  - "12-09 locales skipped — ru.ts/en.ts mixed with unrelated WIP; t(key, fallback) used"
  - "RouteFormModal also degrades editorMode when the flag is off so save payload keeps loaded raw_dialplan"

patterns-established:
  - "Do not reuse callCenter getTenantSettings endpoint names on the shared rtkApi"
  - "Visibility flags hide UI only; form state and payload retain raw_dialplan"

requirements-completed: [D-16, D-17, D-18, D-19]

coverage:
  - id: D1
    description: tenantSettingsApi optimistic patch, server-truth replace, undo on error
    requirement: D-17
    verification:
      - kind: unit
        ref: packages/frontend/src/entities/tenantSettings/api/tenantSettingsApi.test.ts#patches getVpbxTenantSettings cache before the PUT resolves
        status: pass
      - kind: unit
        ref: packages/frontend/src/entities/tenantSettings/api/tenantSettingsApi.test.ts#undo() restores the pre-mutation cache snapshot when PUT is rejected
        status: pass
      - kind: unit
        ref: packages/frontend/src/entities/tenantSettings/api/tenantSettingsApi.test.ts#replaces the optimistic patch with the server payload on success
        status: pass
    human_judgment: false
  - id: D2
    description: Settings section two Switches; loading omits checked; error copy on failed save
    requirement: D-19
    verification:
      - kind: unit
        ref: packages/frontend/src/features/tenant-settings/ui/TenantSettingsSection/TenantSettingsSection.test.tsx#loading
        status: pass
      - kind: unit
        ref: packages/frontend/src/pages/SettingsPage/SettingsPage.test.tsx#renders six sections including the tenant settings stub
        status: pass
    human_judgment: false
  - id: D3
    description: Flag hides Dialplan mode and RawDialplanEditor; leftover raw mode degrades to table
    requirement: D-16
    verification:
      - kind: unit
        ref: packages/frontend/src/features/routes/ui/RouteFormModal/RouteActionsTab.test.tsx#hides Dialplan mode button
        status: pass
      - kind: unit
        ref: packages/frontend/src/features/routes/ui/RouteFormModal/RouteActionsTab.test.tsx#degrades leftover raw editorMode
        status: pass
    human_judgment: false
  - id: D4
    description: Save payload keeps loaded raw_dialplan when the visibility flag is off
    requirement: D-16
    verification:
      - kind: unit
        ref: packages/frontend/src/features/routes/ui/RouteFormModal/RouteFormModal.test.tsx#keeps loaded raw_dialplan
        status: pass
    human_judgment: false
  - id: D5
    description: Flowchart flag is stored with a later-availability hint; no flowchart UI consumer
    requirement: D-18
    verification:
      - kind: unit
        ref: packages/frontend/src/features/tenant-settings/ui/TenantSettingsSection/TenantSettingsSection.test.tsx#flowchart switch has a later-availability hint
        status: pass
    human_judgment: false

duration: 31min
completed: 2026-08-19
status: complete
---

# Phase 12 Plan 09: Tenant settings UI Summary

**Tenant settings section with two optimistic visibility Switches; raw dialplan hides in the route form without wiping `raw_dialplan`**

## Performance

- **Duration:** 31 min
- **Started:** 2026-08-19T08:26:02Z
- **Completed:** 2026-08-19T08:57:12Z
- **Tasks:** 2 (TDD RED/GREEN each)
- **Files modified:** 15

## Accomplishments

- `tenantSettingsApi` reads/writes `GET/PUT /tenant-settings` with the three-step optimistic toggle (patch → server replace → `undo()`)
- `TenantSettingsSection` is the sixth `SECTIONS` item on `/settings`; no new route, no `RequireRole`
- Loading Switches are disabled with `checked` omitted (Surface K); error copy appears when save fails
- `routes.show_raw_dialplan` hides the Dialplan mode button and `RawDialplanEditor`; leftover `editorMode === 'raw'` degrades to table
- Save payload still sends the loaded `raw_dialplan` when the flag is off
- `routes.show_flowchart` is persisted with hint «Появится позже»; no flowchart component

## Task Commits

1. **Task 1 RED:** `597ad47` (test) — failing optimistic-toggle tests + TenantSettings tag
2. **Task 1 GREEN:** `1515272` (feat) — `onQueryStarted` patch / server-truth / undo
3. **Task 2 RED:** `4d0ee5f` (test) — section, SettingsPage, RouteActionsTab, RouteFormModal tests
4. **Task 2 GREEN:** `979dda9` (feat) — section UI, SettingsPage sixth item, flag-gated raw dialplan

**Plan metadata:** pending docs commit

_Note: TDD tasks have RED then GREEN commits_

## Files Created/Modified

- `packages/frontend/src/entities/tenantSettings/api/tenantSettingsApi.ts` — RTK slice, optimistic toggle
- `packages/frontend/src/entities/tenantSettings/api/tenantSettingsApi.test.ts` — cache patch / undo / server-truth
- `packages/frontend/src/entities/tenantSettings/model/types/tenantSettings.ts` — `TenantSettings` + D-17 defaults
- `packages/frontend/src/entities/tenantSettings/index.ts` — public FSD API (aliased hooks)
- `packages/frontend/src/shared/api/rtkApi.ts` — `TenantSettings` tag
- `packages/frontend/src/features/tenant-settings/ui/TenantSettingsSection/*` — Surface K section
- `packages/frontend/src/pages/SettingsPage/SettingsPage.tsx` — sixth SECTIONS item (`key: 'tenant'`)
- `packages/frontend/src/features/routes/ui/RouteFormModal/RouteActionsTab.tsx` — hide raw mode by flag
- `packages/frontend/src/features/routes/ui/RouteFormModal/RouteFormModal.tsx` — degrade mode; keep payload

## Decisions Made

- Endpoint names are `getVpbxTenantSettings` / `updateVpbxTenantSettings` because `callCenterApi` already owns `getTenantSettings` (`/callcenter/settings/tenant`) on the same `rtkApi`. Public hooks stay `useGetTenantSettingsQuery` / `useUpdateTenantSettingsMutation` via `index.ts`.
- Locale files were not staged (`ru.ts` / `en.ts` mixed with unrelated WIP). UI uses `t(key, fallback)` from the Copywriting Contract.
- `RouteFormModal` (not only `RouteActionsTab`) degrades `editorMode` when the flag is off so `handleSave` sends the loaded `raw_dialplan` without a second `ensureCdr` pass.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Renamed RTK endpoints to avoid callCenter collision**
- **Found during:** Task 1
- **Issue:** `callCenterApi` already injects `getTenantSettings` / `updateTenantSettings` for `/callcenter/settings/tenant`. Reusing those names on the shared `rtkApi` would skip or overwrite the new `/tenant-settings` slice.
- **Fix:** Internal names `getVpbxTenantSettings` / `updateVpbxTenantSettings`; public aliases match the plan hooks.
- **Files modified:** `tenantSettingsApi.ts`, `index.ts`, tests
- **Verification:** 5/5 tenantSettingsApi tests pass; call-center hooks unchanged
- **Committed in:** `597ad47` / `1515272`

**2. [Rule 3 - Blocking] Skipped dirty locale files**
- **Found during:** Task 2
- **Issue:** `ru.ts` / `en.ts` contain unrelated WIP (same as 12-02 / 12-03 / 12-07).
- **Fix:** `t(key, fallback)` with Copywriting Contract strings; locales not staged.
- **Files modified:** none in locales
- **Verification:** tests mock `t` with fallback
- **Committed in:** `979dda9`

**3. [Rule 2 - Missing Critical] Degrade editorMode in RouteFormModal as well**
- **Found during:** Task 2
- **Issue:** Payload test mocks `RouteActionsTab`. If only the tab degrades mode, `handleSave` still treats `editorMode === 'raw'` and re-runs `ensureCdr`, diverging from the loaded value.
- **Fix:** `RouteFormModal` reads the flag, degrades to `table`, and sends `rawDialplan` as-is when the flag is off.
- **Files modified:** `RouteFormModal.tsx`
- **Verification:** RouteFormModal payload test `toEqual` loaded value
- **Committed in:** `979dda9`

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 missing critical)
**Impact on plan:** Required for correctness on the shared `rtkApi` and for the D-16 payload invariant. No scope creep.

## Issues Encountered

- `upsertQueryData` left a `pending` cache entry in isolated test stores; tests seed via a mocked GET `initiate().unwrap()` so `updateQueryData` has an existing entry.
- Parallel 12-06 commits landed on `main` between 12-09 RED and GREEN; 12-09 files were staged individually.

## Auth Gates

None.

## Known Stubs

None that block the plan goal. The flowchart Switch hint «Появится позже» is the intentional D-18 non-implementation (no empty flowchart container).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Wave 4 consumer of 12-04 is done. Next after wave 4: **12-08** (host wiring / conditions Sheet).
- Manual UAT of the settings section and raw dialplan visibility is planned in 12-17.

## Self-Check: PASSED

- FOUND: `packages/frontend/src/entities/tenantSettings/api/tenantSettingsApi.ts`
- FOUND: `packages/frontend/src/features/tenant-settings/ui/TenantSettingsSection/TenantSettingsSection.tsx`
- FOUND: `597ad47`, `1515272`, `4d0ee5f`, `979dda9`

---
*Phase: 12-dialplan-apps-editor-refactor-reusable-route-chain-builder*
*Completed: 2026-08-19*
