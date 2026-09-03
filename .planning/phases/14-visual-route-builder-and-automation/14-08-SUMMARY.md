---
phase: 14-visual-route-builder-and-automation
plan: 08
subsystem: api
tags: [callback, action-type, curl-enqueue, interval-scanner, dtmf, queue-abandon, jwt, claim-409]

requires:
  - phase: 14-visual-route-builder-and-automation
    provides: 14-02 RouteReferencesService and Phase 12 ActionType META / CURL ingest patterns
provides:
  - ActionType callback with CallbackParamsDto and CURL enqueue to POST /internal/callback-requests/enqueue
  - Queue DTMF WaitExten and abandon hangup_handler enqueue (order_mode subscriber|queue_abandon|both)
  - CallbackScannerService @Interval 30s mutex batch 20 originate via AMI krsk-click-to-call
  - cc_settings.callback_policy JSON (order_mode, dtmf_digit, dial_order)
  - JWT GET /callback-requests plus POST claim/cancel for 14-09 RTK
affects:
  - 14-09 (CallbackSettingsForm, callbackRequestsApi, CallbackRequestsList)
  - 14-06 (dry-run callback_requested outcome already defined)

actuals:
  tokens: 23817
  tasks: 4
  commits: 6

tech-stack:
  added: []
  patterns:
    - Dialplan ingest via DIALPLAN_API_KEY + timingSafeApiKeyEqual (voicemail-style), not JWT
    - Standalone migrate-callback-requests.ts (no database/migrations/ framework)
    - Operator REST JWT sub/vpbx_user_uid only; claim update-where-unclaimed 409

key-files:
  created:
    - packages/backend/src/modules/callback-requests/callback-dialplan.controller.ts
    - packages/backend/src/modules/callback-requests/callback-requests.controller.ts
    - packages/backend/src/modules/callback-requests/callback-requests.service.ts
    - packages/backend/src/modules/callback-requests/callback-scanner.service.ts
    - packages/backend/src/modules/callback-requests/callback-request.model.ts
    - packages/backend/src/modules/callback-requests/migrate-callback-requests.ts
    - packages/backend/src/modules/queues/queue-dialplan.util.ts
    - packages/backend/src/modules/callback-requests/dto/callback-request.dto.ts
  modified:
    - packages/shared/src/types/route.types.ts
    - packages/shared/src/types/dialplan-params.types.ts
    - packages/backend/src/shared/utils/dialplan.util.ts
    - packages/backend/src/modules/callcenter/callcenter-settings.service.ts
    - packages/frontend/src/features/dialplan-apps/model/registry.ts

key-decisions:
  - "Enqueue URL is /internal/callback-requests/enqueue via buildCurlCall endpoint (voicemail ingest, not JWT)"
  - "queue_name persisted because queue_table has no numeric PK; operator filter uses cc_agent_queues names"
  - "Supervisor list is tenant-wide; 14-09 applies cc:supervisor:queueFilter client-side (no queues query param)"
  - "Scanner originates via AMI krsk-click-to-call; CallCenterService.originateDial stays private to avoid a module cycle"

patterns-established:
  - "Pattern: dialplan CURL + Interval scanner mutex like voicemail"
  - "Pattern: claim 409 { message: Callback request already claimed } as list-collection race backstop"
  - "Pattern: callback_policy merges on PUT /callcenter/settings/tenant like shift_policy"

requirements-completed: [D-38, D-40, D-41, D-42, D-49, D-50]

coverage:
  - id: D1
    description: ActionType callback present in META, ActionTypesList, and CallbackParamsDto
    requirement: D-41
    verification:
      - kind: unit
        ref: packages/backend/src/modules/routes/dto/dialplan-params/dialplan-params.spec.ts
        status: pass
    human_judgment: false
  - id: D2
    description: actionToDialplan callback emits CURL to internal enqueue with API key
    requirement: D-41
    verification:
      - kind: unit
        ref: packages/backend/src/shared/utils/dialplan.util.spec.ts
        status: pass
    human_judgment: false
  - id: D3
    description: Queue DTMF and abandon hooks enqueue by order_mode (D-38 D-49)
    requirement: D-38
    verification:
      - kind: unit
        ref: packages/backend/src/modules/callback-requests/callback-queue-runtime.spec.ts
        status: pass
    human_judgment: false
  - id: D4
    description: Interval scanner mutex, window skip, and attempt cap (D-40)
    requirement: D-40
    verification:
      - kind: unit
        ref: packages/backend/src/modules/callback-requests/callback-scanner.service.spec.ts
        status: pass
    human_judgment: false
  - id: D5
    description: callback_policy round-trips on tenant CC settings
    requirement: D-49
    verification:
      - kind: unit
        ref: packages/backend/src/modules/callcenter/callcenter-settings.service.spec.ts
        status: pass
    human_judgment: false
  - id: D6
    description: JWT list/claim/cancel with tenant isolation, queue memberships, and 409 second claim
    requirement: D-42
    verification:
      - kind: unit
        ref: packages/backend/src/modules/callback-requests/callback-requests.controller.spec.ts
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/callback-requests/callback-requests.service.spec.ts
        status: pass
    human_judgment: false

duration: 26min
completed: 2026-09-03
status: complete
---

# Phase 14 Plan 08: Callback ActionType, scanner, and operator REST Summary

**Callback ActionType with CURL enqueue, queue DTMF/abandon hooks, 30s Interval scanner, tenant callback_policy, and JWT list/claim/cancel**

## Performance

- **Duration:** 26 min
- **Started:** 2026-09-03T19:10:00Z
- **Completed:** 2026-09-03T19:36:00Z
- **Tasks:** 4
- **Files modified:** 37

## Accomplishments

- ActionType `callback` is in the shared union, `DIALPLAN_ACTION_META`, DTO completeness, and `actionToDialplan` CURL to `POST /internal/callback-requests/enqueue` (API key, tenant uid on the row).
- Queue runtime emits DTMF `WaitExten` and/or abandon hangup_handler CURL by `callback_policy.order_mode`; rows store `queue_name` plus window/attempt copy.
- `CallbackScannerService` scans due pending rows every 30s (mutex, batch 20), respects callback windows, originates `krsk-click-to-call`.
- JWT `GET /callback-requests` and `POST :id/claim|:id/cancel` are ready for 14-09 RTK (operator queue memberships; supervisor tenant-wide for client `cc:supervisor:queueFilter`).

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end callback enqueue** - `884e194` (feat)
2. **Task 2: Queue DTMF + abandon enqueue** - `1ff7843` (test RED), `27e0bb8` (feat GREEN)
3. **Task 3: Interval scanner and callback_policy** - `4ff3cba` (feat)
4. **Task 4: Operator REST list/claim/cancel** - `d2580a5` (test RED), `ca856d8` (feat GREEN)

**Plan metadata:** docs commit via `gsd-tools query commit` (SUMMARY + STATE + ROADMAP + WINDOWS)

## TDD Gate Compliance

RED (`test(14-08): …`) then GREEN (`feat(14-08): …`) commits exist for Task 2 and Task 4.

## Files Created/Modified

- `packages/backend/src/modules/callback-requests/*` — persistence, dialplan ingest, scanner, JWT operator REST
- `packages/backend/src/modules/queues/queue-dialplan.util.ts` — DTMF/abandon fragments
- `packages/backend/src/shared/utils/dialplan.util.ts` — callback CURL case
- `packages/shared/src/types/dialplan-params.types.ts` — `ICallbackPolicy` / `DEFAULT_CALLBACK_POLICY`
- `packages/frontend/src/features/dialplan-apps/model/registry.ts` — completeness stub (schema fields in 14-09)

## Decisions Made

- Enqueue uses voicemail-style `DIALPLAN_API_KEY`, not JWT, on `/internal/callback-requests/enqueue`.
- Persist `queue_name` so operator membership filter works without a numeric queue PK.
- Supervisor list has no `queues` query param; 14-09 reuses `cc:supervisor:queueFilter`.
- Scanner AMI originate avoids importing `CallCenterService.originateDial` (private, cycle).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Critical] Persist queue_name for operator scope**
- **Found during:** Task 4
- **Issue:** `queue_table` has string PK `name`; `queue_uid` alone cannot match `cc_agent_queues.queue_name`.
- **Fix:** Added `queue_name` column, persist from CURL body, filter list/cancel by memberships.
- **Files modified:** `callback-request.model.ts`, `callback-requests.service.ts`, `migrate-callback-requests.ts`
- **Verification:** operator REST specs green
- **Committed in:** `ca856d8`

**2. [Rule 2 - Critical] CURL path uses dedicated enqueue URL**
- **Found during:** Task 1
- **Issue:** Plan/research said internal bridge; voicemail ingest is API-key CURL, not `/internal/dialplan/...`.
- **Fix:** Extended `buildCurlCall` with `endpoint: 'internal/callback-requests/enqueue'`.
- **Files modified:** `dialplan-curl.util.ts`, `dialplan.util.ts`, `callback-dialplan.controller.ts`
- **Verification:** dialplan.util + dialplan controller specs
- **Committed in:** `884e194`

---

**Total deviations:** 2 auto-fixed (Rule 2 × 2)
**Impact on plan:** Required for correct enqueue auth and operator queue isolation. No scope creep; FlowchartCanvas / DryRunForm / route-templates FE untouched.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. Live DB needs `migrate-callback-requests.ts` when applying schema (`cc_callback_requests` + `cc_settings.callback_policy` + `queue_name`).

## Next Phase Readiness

14-09 can wire `callbackRequestsApi` to `GET /callback-requests?status=active|completed`, `POST /callback-requests/:id/claim`, `POST /callback-requests/:id/cancel`, and `CallbackSettingsForm` to `callback_policy`. Registry `callback.schema` is still empty — 14-09 should add window/attempt fields.

## Known Stubs

| File | Line | Reason |
|------|------|--------|
| `packages/frontend/src/features/dialplan-apps/model/registry.ts` | 444 | `schema: []` completeness stub; 14-09 CallbackSettingsForm / action card fields |

## Self-Check: PASSED

- SUMMARY path exists
- Commits `884e194`, `1ff7843`, `27e0bb8`, `4ff3cba`, `d2580a5`, `ca856d8` exist
