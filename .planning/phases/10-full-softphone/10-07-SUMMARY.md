---
phase: 10-full-softphone
plan: 07
subsystem: ui
tags: [callcenter, history, segmented-control, client-filter, vitest]

requires:
  - phase: 10-full-softphone/10-04
    provides: history segment/search i18n keys (segmentQueue/Outbound/Personal, searchPlaceholder*)
provides:
  - CallHistoryPanel Queue/Outbound/Personal segment tabs (D-07, no Missed)
  - Per-segment client-side search over getOperatorCallHistory rows (D-10)
  - CallHistoryPanel.test.tsx covering segment + search filters
affects: [10-verify, softphone journal contrast D-01/D-06]

tech-stack:
  added: []
  patterns:
    - "Second SegmentedControl + TransferDirectory .searchRow for ARM History filters"
    - "Client-side direction/queueName/disposition filter — no new history API"

key-files:
  created:
    - packages/frontend/src/features/callcenter/ui/CallHistoryPanel/CallHistoryPanel.test.tsx
  modified:
    - packages/frontend/src/features/callcenter/ui/CallHistoryPanel/CallHistoryPanel.tsx
    - packages/frontend/src/features/callcenter/ui/CallHistoryPanel/CallHistoryPanel.module.scss

key-decisions:
  - "Queue = inbound with real queueName; Personal = personal + direct inbound + internal"
  - "Status search haystack uses answered/not answered (+ ru) without new locale keys"
  - "Period SegmentedControl and callback/open-card handlers left unchanged (D-08/D-09)"

patterns-established:
  - "Export matchesHistorySegment / matchesHistorySearch for unit-tested filter correctness"

requirements-completed: [D-06, D-07, D-08, D-09, D-10]

coverage:
  - id: D1
    description: "Queue / Outbound / Personal segments; no Missed segment"
    requirement: "D-07"
    verification:
      - kind: unit
        ref: "CallHistoryPanel.test.tsx#renders Queue / Outbound / Personal segments and no Missed segment"
        status: pass
    human_judgment: false
  - id: D2
    description: "Client-side segment filter over existing history rows"
    requirement: "D-07"
    verification:
      - kind: unit
        ref: "CallHistoryPanel.test.tsx#filters rows by segment client-side"
        status: pass
    human_judgment: false
  - id: D3
    description: "Per-segment search (queue: number/name/queue; out/personal: number/name/status)"
    requirement: "D-10"
    verification:
      - kind: unit
        ref: "CallHistoryPanel.test.tsx#Outbound/Personal search matches number / name / status"
        status: pass
    human_judgment: false
  - id: D4
    description: "Shift/day period control preserved"
    requirement: "D-08"
    verification:
      - kind: unit
        ref: "CallHistoryPanel.test.tsx#keeps shift/day period control"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-07-24
status: complete
---

# Phase 10 Plan 07: ARM History Segments Summary

**CallHistoryPanel now filters existing operator history client-side into Queue / Outbound / Personal with per-segment search, keeping shift/day and row actions.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-24T14:59:24Z
- **Completed:** 2026-07-24T15:08:00Z
- **Tasks:** 1/1
- **Files modified:** 3

## Accomplishments

- Added independent Queue / Outbound / Personal `SegmentedControl` (no Missed segment).
- Per-segment search Input (TransferDirectory `.searchRow` shape): Queue → number/name/queue; Outbound/Personal → number/name/status.
- Preserved shift/day period control and CallCard/callback row actions.
- Vitest coverage for helper filters + UI segment/search behavior (7 tests).

## Task Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | `8ba996c` | feat(10-07): ARM History Queue/Outbound/Personal segments + search |

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: `packages/frontend/src/features/callcenter/ui/CallHistoryPanel/CallHistoryPanel.tsx`
- FOUND: `packages/frontend/src/features/callcenter/ui/CallHistoryPanel/CallHistoryPanel.test.tsx`
- FOUND: commit `8ba996c`
