---
phase: 09-call-center-agent-panel
plan: 12
subsystem: ui
tags: [react, rtk-query, sse, i18n, call-center]

requires:
  - phase: 09-call-center-agent-panel (09-11)
    provides: getTransferDirectory/getOperatorCallHistory backend endpoints + presenceUpdate SSE (D-36/D-37/D-45)
  - phase: 09-call-center-agent-panel (09-10)
    provides: CallControlBar full-variant onConferenceAdd callback prop, awaiting a concrete handler
provides:
  - TransferDirectory (transfer/conference-add/call modes) with live BLF presence
  - CallHistoryPanel (all-direction, shift/day, callback, open-card)
  - getTransferDirectory/getOperatorCallHistory RTK queries + clickToCall mutation
  - presenceUpdate SSE listener patching the directory cache in place
affects: [09-14, call-center-supervisor]

tech-stack:
  added: []
  patterns:
    - "One component, three call sites (mode prop) instead of three bespoke pickers (D-29)"
    - "Unfiltered RTK Query cache entry + client-side filtering, so SSE deltas patch a single known cache key (D-45)"

key-files:
  created:
    - packages/frontend/src/features/callcenter/ui/TransferDirectory/TransferDirectory.tsx
    - packages/frontend/src/features/callcenter/ui/TransferDirectory/TransferDirectory.module.scss
    - packages/frontend/src/features/callcenter/ui/TransferDirectory/index.ts
    - packages/frontend/src/features/callcenter/ui/CallHistoryPanel/CallHistoryPanel.tsx
    - packages/frontend/src/features/callcenter/ui/CallHistoryPanel/CallHistoryPanel.module.scss
    - packages/frontend/src/features/callcenter/ui/CallHistoryPanel/index.ts
  modified:
    - packages/frontend/src/shared/api/endpoints/callCenterApi.ts
    - packages/frontend/src/shared/api/rtkApi.ts
    - packages/frontend/src/features/callcenter/lib/useCallCenterSSE.ts
    - packages/frontend/src/features/callcenter/ui/SoftphoneWidget/SoftphoneWidget.tsx
    - packages/frontend/src/features/callcenter/ui/SoftphoneWidget/SoftphoneWidget.module.scss
    - packages/frontend/src/features/callcenter/index.ts
    - packages/frontend/src/pages/CallCenterAgentPage/CallCenterAgentPage.tsx
    - packages/frontend/src/shared/config/locales/en.ts
    - packages/frontend/src/shared/config/locales/ru.ts

key-decisions:
  - "TransferDirectory always queries getTransferDirectory unfiltered and filters client-side, so a single cache entry stays targetable by the presenceUpdate SSE patch"
  - "SoftphoneWidget gets its own built-in conference-add control (Users icon) opening TransferDirectory in a Sheet, rather than refactoring SoftphoneWidget onto CallControlBar's full variant — avoids an unplanned structural change"
  - "useCallCenterSSE dispatch switched from plain useDispatch to the typed useAppDispatch, required for RTK Query's util.updateQueryData thunk to type-check"
  - "CallHistoryPanel's open-card action fetches getCardByCall + matches the template client-side and renders the existing CallCardPopup directly, instead of routing through useCallCardPopup (which is scoped to the operator's current active call, not arbitrary history rows)"

patterns-established:
  - "Directory/CallHistory RTK tags follow the same providesTags-only (no invalidation) shape as other read-mostly SSE-backed lists in this phase"

requirements-completed: [D-29, D-34, D-36, D-37, D-44]

coverage:
  - id: D1
    description: "TransferDirectory renders one searchable list mixing endpoints/queues/groups with type icons, BLF presence dot, and free-operator counts"
    requirement: "D-36"
    verification:
      - kind: unit
        ref: "npx tsc -p packages/frontend/tsconfig.json --noEmit"
        status: pass
    human_judgment: true
    rationale: "Live BLF dot color/behavior and visual layout need a human to confirm against a running instance; no component test exists for this new UI"
  - id: D2
    description: "presenceUpdate SSE patches a single directory endpoint's presence in the RTK Query cache without a full refetch"
    requirement: "D-37"
    verification:
      - kind: unit
        ref: "npx tsc -p packages/frontend/tsconfig.json --noEmit"
        status: pass
    human_judgment: true
    rationale: "No automated test exercises the SSE listener end-to-end against a live EventSource; behavior verified by code review only"
  - id: D3
    description: "TransferDirectory serves three call sites (transfer target, conference-add via SoftphoneWidget, click-to-call) through a single mode prop"
    requirement: "D-29"
    verification:
      - kind: unit
        ref: "npx tsc -p packages/frontend/tsconfig.json --noEmit"
        status: pass
    human_judgment: true
    rationale: "Wiring correctness (SoftphoneWidget Sheet, disabled states) needs a human click-through; no e2e/UI test harness exists for this panel"
  - id: D4
    description: "CallHistoryPanel lists all call directions with a shift/day SegmentedControl filter, correct direction icon/color, callback and open-call-card actions"
    requirement: "D-34"
    verification:
      - kind: unit
        ref: "npx tsc -p packages/frontend/tsconfig.json --noEmit"
        status: pass
    human_judgment: true
    rationale: "Row rendering, icon/color mapping and CallCardPopup reuse need visual/functional human verification; no component test exists"

duration: ~40min
completed: 2026-07-23
status: complete
---

# Phase 9 Plan 12: Unified Transfer Directory + Call History Panel Summary

**TransferDirectory (one searchable endpoints/queues/groups list with live BLF presence, reused for transfer/conference-add/click-to-call) + CallHistoryPanel (all-direction shift/day history with callback and call-card reuse), consuming the 09-11 backend.**

## Performance

- **Duration:** ~40 min
- **Tasks:** 3/3
- **Files modified:** 14 (6 created, 8 modified)

## Accomplishments

- `TransferDirectory`: one searchable list mixing internal endpoints (BLF presence dot), queues and call groups (free-operator counts), driven by a single `mode` prop (`transfer` | `conference-add` | `call`) instead of three bespoke pickers (D-29/D-36/D-37).
- `useCallCenterSSE` gained a `presenceUpdate` listener that patches the single unfiltered `getTransferDirectory` cache entry in place — one BLF dot changes without a full-list refetch (D-45).
- Closed the 09-10→09-12 key link: `SoftphoneWidget` now has a built-in "Add to conference" control that opens `TransferDirectory` in `conference-add` mode inside a `Sheet`, wired to the operator's own active-call `uniqueid` from `CallCenterAgentPage`.
- `CallHistoryPanel`: reverse-chronological all-direction list (inbound/outbound/personal/internal) from `getOperatorCallHistory`, with a shift/day `SegmentedControl`, direction icon/color per outcome, click-to-callback (`clickToCall`), and open-call-card reusing the existing `CallCardPopup` (no new viewer).
- `getTransferDirectory`, `getOperatorCallHistory` queries and `clickToCall` mutation added to `callCenterApi`, backed by the 09-11/09-07 endpoints; `Directory`/`CallHistory` RTK tags added.
- ru/en `callcenter.directory.*` and `callcenter.history.*` i18n strings (locked copy: "Позвонить"/"Call", "Нет ожидающих"-style empty states).

## Task Commits

1. **Task 1: Directory + history queries + presenceUpdate SSE listener** - `b101fc8` (feat)
2. **Task 2: TransferDirectory component (3 modes, BLF, search)** - `98b5732` (feat)
3. **Task 3: CallHistoryPanel (all directions, shift/day, callback, open card)** - `c2ad786` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `packages/frontend/src/features/callcenter/ui/TransferDirectory/TransferDirectory.tsx` - Unified endpoints/queues/groups list, BLF dot, 3 modes
- `packages/frontend/src/features/callcenter/ui/TransferDirectory/TransferDirectory.module.scss` - Presence dot/free-count/empty-state styles
- `packages/frontend/src/features/callcenter/ui/TransferDirectory/index.ts` - Barrel export
- `packages/frontend/src/features/callcenter/ui/CallHistoryPanel/CallHistoryPanel.tsx` - All-direction history list with callback + card open
- `packages/frontend/src/features/callcenter/ui/CallHistoryPanel/CallHistoryPanel.module.scss` - Row/icon/tag styles, 44px touch targets
- `packages/frontend/src/features/callcenter/ui/CallHistoryPanel/index.ts` - Barrel export
- `packages/frontend/src/shared/api/endpoints/callCenterApi.ts` - `IDirectoryEndpoint/Queue/Group`, `ITransferDirectory`, `IOperatorHistoryRow` types + `getTransferDirectory`/`getOperatorCallHistory`/`clickToCall` + exported `callCenterApi` object
- `packages/frontend/src/shared/api/rtkApi.ts` - Added `Directory`, `CallHistory` tag types
- `packages/frontend/src/features/callcenter/lib/useCallCenterSSE.ts` - `presenceUpdate` listener + switched to typed `useAppDispatch`
- `packages/frontend/src/features/callcenter/ui/SoftphoneWidget/SoftphoneWidget.tsx` - Built-in conference-add control + `Sheet` hosting `TransferDirectory`
- `packages/frontend/src/features/callcenter/ui/SoftphoneWidget/SoftphoneWidget.module.scss` - `.conferenceSheet` styles
- `packages/frontend/src/features/callcenter/index.ts` - Export `TransferDirectory`
- `packages/frontend/src/pages/CallCenterAgentPage/CallCenterAgentPage.tsx` - Pass `activeCall.uniqueid` into `SoftphoneWidget`
- `packages/frontend/src/shared/config/locales/en.ts` / `ru.ts` - `callcenter.directory.*` + `callcenter.history.*` strings

## Decisions Made

- Kept `TransferDirectory` always querying `getTransferDirectory` unfiltered and filtering client-side, so the presence SSE patch always targets a single known cache key regardless of what the operator typed in search.
- Gave `SoftphoneWidget` its own conference-add control rather than refactoring it onto `CallControlBar`'s full variant — the plan's key link only required wiring the concrete handler, and rebuilding `SoftphoneWidget` around `CallControlBar` would have been an unplanned architectural change.
- Switched `useCallCenterSSE`'s dispatch from plain `useDispatch()` to the app-typed `useAppDispatch()` — required for `callCenterApi.util.updateQueryData(...)` (an RTK Query thunk) to satisfy `Dispatch`'s type, not a behavior change.
- `CallHistoryPanel`'s "open card" action calls `getCardByCall` + resolves the template from `getCardTemplates` directly, rather than reusing `useCallCardPopup` (that hook is scoped to the operator's live active call, not an arbitrary past history row) — renders the same `CallCardPopup` component so there is still only one card viewer in the codebase.

## Deviations from Plan

None - plan executed exactly as written. The only implementation-level adjustment (SoftphoneWidget owning its own conference-add control instead of routing through `CallControlBar`'s full variant) is documented above as a Decision, not a deviation from the plan's acceptance criteria — the plan's actual requirement ("SoftphoneWidget host provides the concrete `onConferenceAdd` handler... opens TransferDirectory as a shared/ui Sheet in mode=conference-add") is satisfied verbatim.

## Issues Encountered

- `npx tsc --noEmit` initially failed because `useCallCenterSSE`'s plain `useDispatch()` dispatch wasn't typed to accept RTK Query's `updateQueryData` thunk action. Fixed by switching to the existing `useAppDispatch` hook from `shared/hooks/useAppStore` (Rule 3 — blocking type error, not a behavior change).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `TransferDirectory` and `CallHistoryPanel` are both built and type-check/lint clean, but `CallHistoryPanel` is not yet mounted into `CallCenterAgentPage` (no tab/surface wires it in per this plan's `files_modified` scope) — the same "component built standalone, mounting deferred to a later plan" precedent already used for `SoftphoneWidget` (09-04/09-08) and `ParkedCallsIndicator`/`CallControlBar` full variant (09-10).
- `getTransferDirectory`'s optional `search` server-side param exists on the backend but is unused by the frontend by design (client-side filtering keeps the SSE cache patch targetable) — a future plan should not "fix" this by wiring the search param through.
- 09-14 (or a later settings/permissions plan) is the natural next consumer of the granular-permissions/notification-matrix backend already shipped in 09-13.

## Self-Check: PASSED

- FOUND: packages/frontend/src/features/callcenter/ui/TransferDirectory/TransferDirectory.tsx
- FOUND: packages/frontend/src/features/callcenter/ui/CallHistoryPanel/CallHistoryPanel.tsx
- FOUND: b101fc8, 98b5732, c2ad786 (all present in `git log --oneline --all`)

---
*Phase: 09-call-center-agent-panel*
*Completed: 2026-07-23*
