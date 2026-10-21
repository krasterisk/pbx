---
phase: 14-visual-route-builder-and-automation
plan: 09
subsystem: ui
tags: [callback, settings-form, rtk, sheet-schema, operator-badge, supervisor-tab]

requires:
  - phase: 14-visual-route-builder-and-automation
    provides: 14-08 JWT GET /callback-requests + claim/cancel and tenant callback_policy
  - phase: 14-visual-route-builder-and-automation
    provides: 14-06/14-07 locale namespaces for dry-run and templates (left untouched)
provides:
  - CallbackSettingsForm local draft + explicit Save of callback_policy on CallCenterSettingsPage tab after shifts
  - Registry callback Sheet schema (window/attempts) with summarize/validate and conditional terminal
  - Operator CallbackRequestsIndicator after MissedCalls before Parked
  - Supervisor callbacks tab filtered by existing cc:supervisor:queueFilter
affects:
  - Phase 14 verify/UAT Surfaces K L M N
  - DialplanAppsEditor route host ActionType select

actuals:
  tokens: 18182
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - ShiftPolicyForm local draft + explicit Save (not optimistic Switch) for tenant callback_policy
    - Schema-driven callback step; order/DTMF/dial_order stay on settings, not the Sheet
    - Supervisor list is tenant-wide from API; queueFilter is client-side only

key-files:
  created:
    - packages/frontend/src/features/callcenter/ui/CallbackSettingsForm/CallbackSettingsForm.tsx
    - packages/frontend/src/features/callcenter/ui/CallbackRequestsIndicator/CallbackRequestsIndicator.tsx
    - packages/frontend/src/features/callcenter/ui/CallbackRequestsList/CallbackRequestsList.tsx
    - packages/frontend/src/features/dialplan-apps/apps/CallbackApp/CallbackApp.tsx
    - packages/frontend/src/shared/api/endpoints/callbackRequestsApi.ts
  modified:
    - packages/frontend/src/pages/CallCenterSettingsPage/CallCenterSettingsPage.tsx
    - packages/frontend/src/pages/CallCenterAgentPage/CallCenterAgentPage.tsx
    - packages/frontend/src/pages/CallCenterSupervisorPage/CallCenterSupervisorPage.tsx
    - packages/frontend/src/features/dialplan-apps/model/registry.ts
    - packages/frontend/src/shared/config/locales/en.ts
    - packages/frontend/src/shared/config/locales/ru.ts
    - packages/frontend/src/shared/api/rtkApi.ts

key-decisions:
  - "Mounted CallbackRequestsIndicator on CallCenterAgentPage headerTools (Missed then Callback then Parked) because SoftphoneJournal has no those tools"
  - "Appended callback locale keys only; dry-run and template strings untouched"
  - "Call now reuses missed-callback originate (claim then callbackMissedCall + requestOutboundDial)"

patterns-established:
  - "Pattern: tenant CC policy forms use local state + Save, never write-on-change Switch"
  - "Pattern: callback Sheet fields are window/attempts only; policy lives on settings tab"

requirements-completed: [D-38, D-39, D-42, D-49, D-50]

coverage:
  - id: D1
    description: CallCenterSettingsPage callback tab saves callback_policy with explicit Save (D-49 Surface L)
    requirement: D-49
    verification:
      - kind: unit
        ref: packages/frontend/src/features/callcenter/ui/CallbackSettingsForm/CallbackSettingsForm.test.tsx#has no write-on-change Switch
        status: pass
    human_judgment: false
  - id: D2
    description: callback step Sheet schema window/attempts with summarize/validate and route-only conditional terminal (D-41 Surface K)
    requirement: D-38
    verification:
      - kind: unit
        ref: packages/frontend/src/features/dialplan-apps/apps/CallbackApp/CallbackApp.test.tsx#registers window/attempts fields
        status: pass
    human_judgment: false
  - id: D3
    description: Operator badge hidden at 0 and list dropdown (D-42 D-50 Surface M)
    requirement: D-42
    verification:
      - kind: unit
        ref: packages/frontend/src/features/callcenter/ui/CallbackRequestsIndicator/CallbackRequestsIndicator.test.tsx#hides the badge when the active count is 0
        status: pass
    human_judgment: false
  - id: D4
    description: Supervisor callbacks tab respects existing cc:supervisor:queueFilter (D-50 Surface N)
    requirement: D-50
    verification:
      - kind: unit
        ref: packages/frontend/src/pages/CallCenterSupervisorPage/callbackQueueFilter.test.ts#keeps matching queue_label
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-09-04
status: complete
---

# Phase 14 Plan 09: Callback UI Summary

**Tenant callback settings tab, route Sheet schema, operator badge+list, and supervisor DataTable tab filtered by the existing queue filter**

## Performance

- **Duration:** 20 min
- **Started:** 2026-09-03T21:32:14Z
- **Completed:** 2026-09-03T21:52:00Z
- **Tasks:** 3
- **Files modified:** 21

## Accomplishments

- `CallbackSettingsForm` mirrors `ShiftPolicyForm`: local draft, explicit Save of `callback_policy`, no write-on-change Switch; tab sits after `shifts`.
- Registry `callback` Sheet fields are `window_start` / `window_end` / `max_attempts` / `pause_minutes` with summarize + validate; terminal badge stays conditional (may leave the chain).
- Operator `CallbackRequestsIndicator` (PhoneOutgoing) sits after MissedCalls and before Parked; badge hidden at count 0; claim/cancel + missed-callback originate.
- Supervisor `callbacks` tab uses DataTable and `filterCallbackRowsByQueue` against `cc:supervisor:queueFilter` — no second queue filter.

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end callback settings save** - `9f518ac` (feat)
2. **Task 2: callback action Sheet + registry** - `dc1a0ef` (feat)
3. **Task 3: Operator indicator + supervisor tab** - `be74c0d` (feat)

**Plan metadata:** `docs(14-09)` via gsd-tools query commit

## Files Created/Modified

- `packages/frontend/src/features/callcenter/ui/CallbackSettingsForm/*` — tenant policy form (D-49)
- `packages/frontend/src/pages/CallCenterSettingsPage/CallCenterSettingsPage.tsx` — tab `callback` after shifts
- `packages/frontend/src/features/dialplan-apps/apps/CallbackApp/CallbackApp.tsx` — Sheet schema / summarize / validate
- `packages/frontend/src/features/dialplan-apps/model/registry.ts` — wired callback schema
- `packages/frontend/src/shared/config/locales/en.ts` / `ru.ts` — appended callback keys only
- `packages/frontend/src/shared/api/endpoints/callbackRequestsApi.ts` — list/claim/cancel RTK
- `packages/frontend/src/features/callcenter/ui/CallbackRequestsIndicator/*` — operator badge
- `packages/frontend/src/features/callcenter/ui/CallbackRequestsList/*` — dropdown rows + originate
- `packages/frontend/src/pages/CallCenterAgentPage/CallCenterAgentPage.tsx` — mount after MissedCalls
- `packages/frontend/src/pages/CallCenterSupervisorPage/CallCenterSupervisorPage.tsx` — callbacks tab
- `packages/frontend/src/pages/CallCenterSupervisorPage/callbackQueueFilter.ts` — D-50 client filter
- `packages/frontend/src/shared/api/rtkApi.ts` — `CallbackRequests` tag

## Decisions Made

- Indicator mounts on the agent header tools row, not SoftphoneJournal — Missed/Parked already live there (D-50 position).
- Locale edits append `routes.apps.callback.*`, `callcenter.settings.callback.*`, and `callcenter.callback.*` only.
- Supervisor cancel lives on the DataTable; operator Call now reuses `callbackMissedCall`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Mounted indicator on CallCenterAgentPage**
- **Found during:** Task 3
- **Issue:** Plan listed SoftphoneJournal, but MissedCalls/Parked live on `CallCenterAgentPage` `headerTools`. Mounting in the journal would miss D-50.
- **Fix:** Inserted `CallbackRequestsIndicator` after `MissedCallsPanel` and before `ParkedCallsIndicator`. SoftphoneJournal unchanged.
- **Files modified:** `CallCenterAgentPage.tsx`, `CallCenterAgentPage.test.tsx`
- **Verification:** Agent page tests still pass; indicator unit tests pass
- **Committed in:** `be74c0d`

**2. [Rule 2 - Missing Critical] Added CallbackRequests RTK tag**
- **Found during:** Task 3
- **Issue:** New list/claim/cancel cache needs a tag type on `rtkApi`.
- **Fix:** Appended `CallbackRequests` to `tagTypes`.
- **Files modified:** `packages/frontend/src/shared/api/rtkApi.ts`
- **Verification:** hooks compile; indicator tests pass
- **Committed in:** `be74c0d`

---

**Total deviations:** 2 auto-fixed (2 missing critical)
**Impact on plan:** Required for D-50 placement and RTK invalidation. No scope creep.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Surfaces K L M N shipped. Phase 14 Wave 6 last plan is done; remaining Phase 14 work is verify/UAT.

---
*Phase: 14-visual-route-builder-and-automation*
*Completed: 2026-09-04*

## Self-Check: PASSED
