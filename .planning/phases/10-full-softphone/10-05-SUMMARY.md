---
phase: 10-full-softphone
plan: 05
subsystem: ui
tags: [softphone, journal, rtk-query, vitest, call-center]

requires:
  - phase: 10-04
    provides: getOperatorCallHistory + historyRow SSE prepend + journal_depth on ICcSettings + callcenter.journal.* i18n
provides:
  - SoftphoneJournal blended live feed (N-capped, callback + open-card)
  - journal_depth admin field on tenant alert-thresholds form
  - SoftphoneJournal vitest coverage (empty/error/cap/actions)
affects: [10-08 SoftphoneWidget mount]

tech-stack:
  added: []
  patterns:
    - "Client-slice getOperatorCallHistory to journal_depth; live via 10-04 cache prepend"
    - "directionVisual copied from CallHistoryPanel for blended feed icons"

key-files:
  created:
    - packages/frontend/src/features/callcenter/ui/SoftphoneWidget/SoftphoneJournal.tsx
    - packages/frontend/src/features/callcenter/ui/SoftphoneWidget/SoftphoneJournal.module.scss
    - packages/frontend/src/features/callcenter/ui/SoftphoneWidget/SoftphoneJournal.test.tsx
  modified:
    - packages/frontend/src/features/callcenter/ui/AlertThresholdsForm/AlertThresholdsForm.tsx
    - packages/frontend/src/shared/config/locales/en.ts
    - packages/frontend/src/shared/config/locales/ru.ts

key-decisions:
  - "journal_depth UI lives in AlertThresholdsForm (tenant SLA/alerts form), not operator CallCenterSettings myPanel"
  - "SoftphoneJournal not mounted yet - 10-08 wires it into SoftphoneWidget tabs"

patterns-established:
  - "SoftphoneJournal: period=shift history query + settings journal_depth slice + exactly two row actions"

requirements-completed: [D-01, D-02, D-03, D-04, D-05]

coverage:
  - id: D1
    description: "Blended most-recent-first Journal feed with direction icons (in/out/missed)"
    requirement: D-02
    verification:
      - kind: unit
        ref: packages/frontend/src/features/callcenter/ui/SoftphoneWidget/SoftphoneJournal.test.tsx#renders a blended most-recent-first feed
        status: pass
    human_judgment: false
  - id: D2
    description: "Feed capped at journal_depth N (default 50)"
    requirement: D-04
    verification:
      - kind: unit
        ref: packages/frontend/src/features/callcenter/ui/SoftphoneWidget/SoftphoneJournal.test.tsx#caps the feed at journal_depth N
        status: pass
    human_judgment: false
  - id: D3
    description: "Exactly two row actions - callback and open-card"
    requirement: D-03
    verification:
      - kind: unit
        ref: packages/frontend/src/features/callcenter/ui/SoftphoneWidget/SoftphoneJournal.test.tsx#exposes exactly two row actions
        status: pass
    human_judgment: false
  - id: D4
    description: "Empty + error(retry) states and More in History footnote at N cap"
    requirement: D-01
    verification:
      - kind: unit
        ref: packages/frontend/src/features/callcenter/ui/SoftphoneWidget/SoftphoneJournal.test.tsx#error state with retry
        status: pass
    human_judgment: false
  - id: D5
    description: "Admin journal_depth numeric field bound to updateTenantSettings"
    requirement: D-04
    verification:
      - kind: other
        ref: AlertThresholdsForm journal_depth Input + update payload
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-07-24
status: complete
---

# Phase 10 Plan 05: SoftphoneJournal + journal_depth Summary

**Live blended personal Journal component (N-capped, callback + open-card, empty/error/footnote) plus admin journal_depth on the tenant thresholds form - not yet mounted in SoftphoneWidget.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-24T14:59:10Z
- **Completed:** 2026-07-24T15:06:00Z
- **Tasks:** 2/2
- **Files modified:** 6

## Accomplishments

- SoftphoneJournal consumes `useGetOperatorCallHistoryQuery({ period: 'shift' })`, slices to `journal_depth ?? 50`, reuses CallHistoryPanel `directionVisual`, two actions only (clickToCall + CallCardPopup).
- Empty / error+retry / More-in-History footnote per Copywriting Contract; 8 vitest cases green including error-retry backstop.
- `journal_depth` editable next to default SLA in AlertThresholdsForm, saved via `updateTenantSettings`.

## Task Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1+2 | d87eb0c | SoftphoneJournal + journal_depth settings field + missing i18n labels |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] journal_depth UI target file**
- **Found during:** Task 2
- **Issue:** Plan named `CallCenterSettings.tsx`, but that component is operator "My panel" and has no `default_sla_threshold` / tenant mutation. The sibling tenant form with SLA is `AlertThresholdsForm.tsx` (CallCenterSettingsPage alertThresholds tab).
- **Fix:** Added `journal_depth` to `AlertThresholdsForm` near `default_sla_threshold`, bound to `updateTenantSettings`.
- **Files modified:** `AlertThresholdsForm.tsx`
- **Commit:** d87eb0c

**2. [Rule 2 - Missing critical] journalDepth locale keys**
- **Found during:** Task 2
- **Issue:** Plan assumed 10-04 added localized labels for journal_depth; they were absent.
- **Fix:** Added `callcenter.settings.alerts.journalDepth` / `journalDepthHint` to en.ts and ru.ts (allowed when keys are truly missing).
- **Files modified:** `en.ts`, `ru.ts`
- **Commit:** d87eb0c

## Verification

- `npx vitest run --root packages/frontend SoftphoneJournal` - 8/8 passed
- `npx tsc -p packages/frontend/tsconfig.json --noEmit` - pre-existing errors only (AgentDetailModal, AgentStatusBar, PauseReasonModal, WallboardPage, callCenterSlice.test); none in SoftphoneJournal / AlertThresholdsForm

## Known Stubs

None - SoftphoneJournal is intentionally unmounted until 10-08 (plan scope).

## Threat Flags

None new beyond plan threat model (clickToCall + self-scoped history remain server-enforced).

## Self-Check: PASSED

- FOUND: SoftphoneJournal.tsx / .module.scss / .test.tsx
- FOUND: AlertThresholdsForm journal_depth field
- FOUND: commit d87eb0c
