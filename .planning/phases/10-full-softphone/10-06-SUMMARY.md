---
phase: 10-full-softphone
plan: 06
subsystem: ui
tags: [softphone, contacts, click-to-call, sheet, ownership, callcenter]

requires:
  - phase: 10-full-softphone/10-04
    provides: getMyContacts CRUD hooks, ICcContact, callcenter.contacts.* i18n, softphone.addContact
provides:
  - SoftphoneContacts 5-section unified-search catalog (Recent/Subscribers/Queues/Groups/Book)
  - ContactBookForm inline Sheet create/edit + ownership-gated delete confirm variants
  - SoftphoneContacts.test coverage for sections/search/Recent/Book dial/ownership/error-retry
affects: [10-08]

tech-stack:
  added: []
  patterns:
    - "TransferDirectory mode=call CTA-only dial (whole row not clickable)"
    - "Recent = client dedup-by-number slice of getOperatorCallHistory"
    - "D-13 UI gate createdBy===myUserId || supervisor/admin; server remains boundary"

key-files:
  created:
    - packages/frontend/src/features/callcenter/ui/SoftphoneWidget/SoftphoneContacts.tsx
    - packages/frontend/src/features/callcenter/ui/SoftphoneWidget/SoftphoneContacts.module.scss
    - packages/frontend/src/features/callcenter/ui/SoftphoneWidget/SoftphoneContacts.test.tsx
    - packages/frontend/src/features/callcenter/ui/ContactBookForm/ContactBookForm.tsx
    - packages/frontend/src/features/callcenter/ui/ContactBookForm/ContactBookForm.module.scss
    - packages/frontend/src/features/callcenter/ui/ContactBookForm/index.ts
  modified: []

key-decisions:
  - "Queues/Groups keep free-count chips and gain Call CTAs (click-to-call catalog, not transfer picker)"
  - "SoftphoneContacts not mounted in SoftphoneWidget (deferred to 10-08)"
  - "ContactBookForm is Sheet+delete Dialog only; SoftphoneContacts owns Book rows and ownership buttons"

requirements-completed: [D-11, D-12, D-13, D-14, D-25]

coverage:
  - id: D1
    description: "Five sticky sections Recent/Subscribers/Queues/Groups/Book with unified search collapsing empty headers"
    requirement: "D-11, D-14"
    verification:
      - kind: unit
        ref: "SoftphoneContacts.test.tsx#renders five ordered sections / unified search"
        status: pass
    human_judgment: false
  - id: D2
    description: "Endpoints/Queues/Groups + Book dial via CTA-only click-to-call; Recent dedup slice"
    requirement: "D-25, D-11"
    verification:
      - kind: unit
        ref: "SoftphoneContacts.test.tsx#Recent dedup / Book CTA dials"
        status: pass
    human_judgment: false
  - id: D3
    description: "ContactBookForm Sheet CRUD + per-row ownership gate + own vs supervisor delete copy"
    requirement: "D-12, D-13"
    verification:
      - kind: unit
        ref: "SoftphoneContacts.test.tsx#canManageContact / hides edit-delete on non-owned"
        status: pass
    human_judgment: false
  - id: D4
    description: "Contacts load error banner with retry re-firing getMyContacts"
    requirement: "D-14"
    verification:
      - kind: unit
        ref: "SoftphoneContacts.test.tsx#shows contacts load error with retry"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-07-24
status: complete
---

# Phase 10 Plan 06: SoftphoneContacts + ContactBookForm Summary

**Unified 5-section Contacts catalog with click-to-call CTAs, Recent history slice, and ownership-gated shared-book Sheet CRUD.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-24T14:59:20Z
- **Completed:** 2026-07-24T15:06:00Z
- **Tasks:** 2/2
- **Files created:** 6

## Accomplishments

- SoftphoneContacts renders Recent → Subscribers → Queues → Groups → Book with sticky headers, one search input, and empty-header collapse.
- Endpoints reuse TransferDirectory presence-dot + CTA dial; Queues/Groups show free-count + Call CTA; Book dials via CTA only (whole row not clickable).
- Recent is `buildRecentContacts` dedup-by-number over `useGetOperatorCallHistoryQuery` (limit 8).
- ContactBookForm Sheet create/edit + delete Dialog with own vs supervisor confirmation copy; Pencil/Trash gated by `canManageContact`.
- Error banner "Could not load contacts" + Retry; component not mounted in SoftphoneWidget (10-08).

## Task Commits

1. **Task 1+2: SoftphoneContacts + ContactBookForm** - `23419ac` (feat)
2. **Plan metadata** - (docs SUMMARY commit follows)

## Files Created/Modified

- `SoftphoneContacts.tsx` / `.module.scss` / `.test.tsx` - sectioned catalog + tests
- `ContactBookForm.tsx` / `.module.scss` / `index.ts` - Sheet CRUD + `canManageContact`

## Decisions Made

- Queues/Groups include Call CTAs (Contacts is dial-only) while keeping TransferDirectory free-count chips.
- Book ownership UI gate only; server where-clause from 10-01 remains the security boundary.
- Mount deferred to 10-08 per plan.

## Deviations from Plan

None - plan executed as written. Single `feat(10-06)` commit covers both tasks per orchestrator instruction; STATE.md/ROADMAP.md left untouched.

### Auto-fixed Issues

None.

## Verification

- `npx vitest run --root packages/frontend SoftphoneContacts` — **9 passed**
- `npx tsc -p packages/frontend/tsconfig.json --noEmit` — pre-existing errors only (AgentDetailModal/AgentStatusBar TFunction, Wallboard OUTBOUND_WORK, callCenterSlice.test); **none in 10-06 files**

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: SoftphoneContacts.tsx, SoftphoneContacts.module.scss, SoftphoneContacts.test.tsx
- FOUND: ContactBookForm.tsx, ContactBookForm.module.scss, index.ts
- FOUND commit: `23419ac`

## Next

- **10-08** mounts SoftphoneContacts into SoftphoneWidget Contacts tab
