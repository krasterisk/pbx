---
phase: 09-call-center-agent-panel
plan: 02
subsystem: ui
tags: [radix-ui, react-tabs, i18n, redux-toolkit, vitest, testing-library]

requires:
  - phase: 09-01
    provides: "cc_agent_events ENUM extended with DIALING/CONSULT/ACW (backend schema); no direct frontend dependency but keeps the enum families in sync"
provides:
  - "shared/ui/Tabs — Radix-wrapped Tabs/TabsList/TabsTrigger/TabsContent primitive with the canonical single-underline SCSS contract"
  - "AgentStatus union extended to 9 members (DIALING/CONSULT/ACW)"
  - "Single authoritative status label map (agentStatusLabel) + color-family map (agentStatusColorFamily) in displayLabels.ts"
  - "callcenter.status.* + callcenter.tabs.* i18n keys in ru.ts/en.ts"
affects: ["09-04", "09-08", "09-09", "09-11"]

tech-stack:
  added: []
  patterns:
    - "Radix-wrapper forwardRef shape (mirrors shared/ui/Popover) for new shared/ui primitives"
    - "Active-tab styling driven by Radix's [data-state='active'] attribute selector instead of hand-rolled JS class toggling"
    - "Status label/color centralized in displayLabels.ts as data maps + resolver functions, consumed with an injected i18n `t` function rather than importing react-i18next into a pure lib file"

key-files:
  created:
    - packages/frontend/src/shared/ui/Tabs/Tabs.tsx
    - packages/frontend/src/shared/ui/Tabs/Tabs.module.scss
    - packages/frontend/src/shared/ui/Tabs/index.ts
    - packages/frontend/src/shared/ui/Tabs/Tabs.test.tsx
    - .planning/phases/09-call-center-agent-panel/deferred-items.md
  modified:
    - packages/frontend/src/shared/ui/index.ts
    - packages/frontend/src/features/callcenter/model/types/callCenterSchema.ts
    - packages/frontend/src/features/callcenter/lib/displayLabels.ts
    - packages/frontend/src/features/callcenter/lib/displayLabels.test.ts
    - packages/frontend/src/features/callcenter/model/slice/callCenterSlice.test.ts
    - packages/frontend/src/features/callcenter/model/selectors/callCenterSelectors.test.ts
    - packages/frontend/src/shared/config/locales/ru.ts
    - packages/frontend/src/shared/config/locales/en.ts
    - packages/frontend/src/pages/CallCenterWallboardPage/CallCenterWallboardPage.tsx

key-decisions:
  - "Tabs active-underline state is driven by Radix's own [data-state='active'] attribute, not a JS-toggled class — avoids re-deriving active-tab tracking Radix already owns, per the plan's explicit 'do not hand-roll ARIA/keyboard' instruction"
  - "displayLabels.ts exposes agentStatusLabel(status, t) taking an injected i18n t function rather than calling useTranslation() itself, keeping the module a pure/testable lib file with no React dependency"
  - "Color-family names (success/warning/destructive/info/muted) intentionally mirror the existing .statusReady/.statusPaused/.statusInCall/.statusWrapup/.statusOffline SCSS class suffixes in CallCenterAgentPage.module.scss so 09-04 can map family→class directly"

requirements-completed: [D-01, D-04, D-07, D-13, D-44]

coverage:
  - id: D1
    description: "shared/ui/Tabs renders Radix tab semantics (tablist/tab/tabpanel), switches panels, applies the active-underline SCSS contract, and supports keyboard arrow navigation via Radix"
    requirement: "D-04"
    verification:
      - kind: unit
        ref: "packages/frontend/src/shared/ui/Tabs/Tabs.test.tsx (3 tests: default panel render, click-switch + data-state, keyboard ArrowRight nav)"
        status: pass
    human_judgment: false
  - id: D2
    description: "AgentStatus union extended to 9 members (added DIALING/CONSULT/ACW); flows through slice/selectors unchanged with no crashes"
    requirement: "D-13"
    verification:
      - kind: unit
        ref: "packages/frontend/src/features/callcenter/model/slice/callCenterSlice.test.ts#flows the three new D-13 statuses (DIALING/CONSULT/ACW) through unchanged"
        status: pass
      - kind: unit
        ref: "packages/frontend/src/features/callcenter/model/selectors/callCenterSelectors.test.ts#selectAvailableAgents excludes the three new D-13 statuses"
        status: pass
      - kind: other
        ref: "npx tsc --noEmit -p packages/frontend/tsconfig.json (0 errors attributable to this plan; 1 pre-existing unrelated error logged to deferred-items.md)"
        status: pass
    human_judgment: false
  - id: D3
    description: "READY status label relabelled to 'Ожидание звонка' / 'Waiting for call' in both the authoritative label map and the ru/en locale files"
    requirement: "D-13"
    verification:
      - kind: unit
        ref: "packages/frontend/src/features/callcenter/lib/displayLabels.test.ts#relabels READY to the \"Waiting for call\" copy (D-13), not \"Ready\""
        status: pass
    human_judgment: false
  - id: D4
    description: "Status label map (i18n key + fallback) and dot-color-family map cover all 9 statuses; ru/en locales carry callcenter.status.dialing|consult|acw and the relabelled ready key with symmetrical key paths"
    requirement: "D-44"
    verification:
      - kind: unit
        ref: "packages/frontend/src/features/callcenter/lib/displayLabels.test.ts (describe block 'agentStatusLabel / agentStatusColorFamily (D-13/D-44)', 7 tests)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Wave-0 test scaffolds shipped for Tabs, slice/selectors status handling, and displayLabels per 09-VALIDATION"
    verification:
      - kind: unit
        ref: "npx vitest run packages/frontend/src/shared/ui/Tabs packages/frontend/src/features/callcenter/model packages/frontend/src/features/callcenter/lib/displayLabels.test.ts (4 files, 44 tests, all pass)"
        status: pass
    human_judgment: false

duration: 42min
completed: 2026-07-22
status: complete
---

# Phase 9 Plan 02: Tabs Primitive + AgentStatus Model Foundation Summary

**New `shared/ui/Tabs` Radix wrapper with the canonical single-underline SCSS contract, plus the extended 9-member `AgentStatus` model (DIALING/CONSULT/ACW) with a single authoritative label + color-family map and matching ru/en i18n keys.**

## Performance

- **Duration:** ~42 min
- **Started:** 2026-07-22T11:28:00Z (approx)
- **Completed:** 2026-07-22T12:10:00Z (approx)
- **Tasks:** 3/3
- **Files modified:** 14 (5 created, 9 modified)

## Accomplishments
- `shared/ui/Tabs` ships thin `forwardRef` wrappers over `@radix-ui/react-tabs` (`Tabs`/`TabsList`/`TabsTrigger`/`TabsContent`), mirroring the `Popover.tsx` wrapper shape and barrel-exported from `shared/ui/index.ts` — unblocks both the desktop panel toggle and the phone Coworkers/Queues/Waiting switcher (09-08) with one canonical component.
- Canonical single-underline SCSS contract (`tabsWrap`/`tabsRow`/`tab`/`tabActive`) implemented with `var(--color-*)` tokens only, no new custom properties; active-state styling driven by Radix's own `[data-state='active']` attribute so no ARIA/keyboard logic was hand-rolled.
- `AgentStatus` union extended from 6 to 9 members (`DIALING`/`CONSULT`/`ACW`, D-13); verified the slice and selectors already flow every status through unchanged (no branching to patch), so the union edit alone was sufficient at that layer.
- New authoritative status model in `displayLabels.ts`: `AGENT_STATUS_LABEL_KEYS`/`agentStatusLabel(status, t)` (i18n key + fallback per status, READY relabelled) and `AGENT_STATUS_COLOR_FAMILY`/`agentStatusColorFamily(status)` (success/warning/destructive/info/muted — two-color busy system, no 6th color, matches UI-SPEC and the existing `CallCenterAgentPage.module.scss` class families) covering all 9 statuses.
- `ru.ts`/`en.ts` gained `callcenter.status.dialing|consult|acw`, the relabelled `callcenter.status.ready` ("Ожидание звонка"/"Waiting for call"), and a new `callcenter.tabs.coworkers|queues|waiting` namespace for 09-08's phone tab labels — symmetrical key paths, no em dash.
- Wave-0 tests: 3 new Tabs tests, 7 new displayLabels tests, 1 new slice test, 1 new selectors test — 44 tests total across the plan's scope, all passing.

## Task Commits

Each task was committed atomically:

1. **Task 1: Build shared/ui/Tabs Radix wrapper + test** - `51a69a5` (feat)
2. **Task 2: Extend AgentStatus union + status label/color maps + selectors** - `989d524` (feat)
3. **Task 3: Add ru+en i18n keys for new statuses and Tabs labels** - `f6b4cc4` (feat)

**Plan metadata:** commit pending (this SUMMARY + STATE.md/ROADMAP.md, via `gsd-tools query commit`)

_Note: no TDD RED/GREEN split was needed — tests were authored alongside each task's implementation and committed together, consistent with 09-01's precedent (PowerShell/non-worktree sequential execution, not a Claude-Code TDD RED/GREEN gate plan)._

## Files Created/Modified
- `packages/frontend/src/shared/ui/Tabs/Tabs.tsx` - Radix-wrapper forwardRef components (Tabs/TabsList/TabsTrigger/TabsContent)
- `packages/frontend/src/shared/ui/Tabs/Tabs.module.scss` - canonical tabsWrap/tabsRow/tab/tabActive SCSS contract
- `packages/frontend/src/shared/ui/Tabs/index.ts` - named exports
- `packages/frontend/src/shared/ui/Tabs/Tabs.test.tsx` - NEW: 3 tests (render, click-switch, keyboard nav)
- `packages/frontend/src/shared/ui/index.ts` - barrel-export Tabs alongside Popover/SegmentedControl
- `packages/frontend/src/features/callcenter/model/types/callCenterSchema.ts` - AgentStatus += DIALING/CONSULT/ACW
- `packages/frontend/src/features/callcenter/lib/displayLabels.ts` - += agentStatusLabel/agentStatusColorFamily + backing maps
- `packages/frontend/src/features/callcenter/lib/displayLabels.test.ts` - += 7 tests for the new status maps
- `packages/frontend/src/features/callcenter/model/slice/callCenterSlice.test.ts` - += 1 test (new statuses flow through unchanged)
- `packages/frontend/src/features/callcenter/model/selectors/callCenterSelectors.test.ts` - += 1 test (selectAvailableAgents excludes new statuses)
- `packages/frontend/src/shared/config/locales/ru.ts` - += status.dialing/consult/acw, ready relabel, tabs.* namespace
- `packages/frontend/src/shared/config/locales/en.ts` - += status.dialing/consult/acw, ready relabel, tabs.* namespace
- `packages/frontend/src/pages/CallCenterWallboardPage/CallCenterWallboardPage.tsx` - [deviation] fixed Record<AgentStatus,...> literal + statusKey() switch after the union extension
- `.planning/phases/09-call-center-agent-panel/deferred-items.md` - NEW: consolidated pre-existing/out-of-scope issue log (09-01 + 09-02 findings)

## Decisions Made
- **Active-tab styling via `[data-state='active']`, not a JS-toggled class:** the plan's canonical SCSS contract names a `tabActive` class, but adding it conditionally from JS would require reading Radix's internal "is this trigger selected" state outside its public API. Kept `tabActive` as a class in the SCSS (via a shared `%tab-active-underline` placeholder extended by both `.tab[data-state='active']` and `.tabActive`) for contract parity, while the actual runtime styling is driven by Radix's own `data-state` attribute — zero hand-rolled active-tracking, fully idiomatic Radix usage.
- **`agentStatusLabel`/`agentStatusColorFamily` take an injected `t`/return a plain family string** rather than `displayLabels.ts` importing `react-i18next` or CSS classes directly — keeps the file a pure, framework-agnostic lib (consistent with its existing `agentDisplayName`/`queueDisplayName` style) that 09-04's status bar and other consumers can call from any component tree.
- **Color family naming mirrors existing SCSS class suffixes** (`success`/`warning`/`destructive`/`info`/`muted` ↔ `.statusReady`/`.statusPaused`/`.statusInCall`/`.statusWrapup`/`.statusOffline`) so 09-04 can look up the right existing class by family name instead of re-deriving the status→color logic.
- **No functional changes to `callCenterSlice.ts` or `callCenterSelectors.ts` (source, not tests):** both already treat `status` as an opaque field with no per-status branching, so the three new statuses flow through unchanged automatically — verified via new test cases rather than requiring code edits, per the plan's own "if reducers/selectors branch on status" conditional.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed `CallCenterWallboardPage.tsx` compile break caused by the `AgentStatus` union extension**
- **Found during:** Task 2
- **Issue:** `CallCenterWallboardPage.tsx` (not in this plan's `files_modified` list) has a `const counts: Record<AgentStatus, number> = { READY: 0, IN_CALL: 0, ... }` object literal and a `statusKey()` switch. Extending `AgentStatus` to 9 members made the `Record` literal fail to type-check (`error TS2739: ... missing DIALING, CONSULT, ACW`) — a direct, mechanical consequence of Task 2's schema change, not a pre-existing issue.
- **Fix:** Added `DIALING: 0, CONSULT: 0, ACW: 0` to the `Record` literal and matching cases to `statusKey()`'s switch (mapping to `dialing`/`consult`/`acw` i18n keys, consistent with the new `displayLabels.ts` keys). Did not add the three statuses to the visible `AGENT_STATUSES` chip-strip array — expanding the wallboard's visual agent-status strip is a UI decision out of this plan's scope (data-model foundation only), so the new statuses are counted but not yet rendered as a chip; a later wave can opt them into the strip.
- **Files modified:** `packages/frontend/src/pages/CallCenterWallboardPage/CallCenterWallboardPage.tsx`
- **Verification:** `npx tsc --noEmit -p packages/frontend/tsconfig.json` — error resolved; `npx vitest run src/pages/CallCenterWallboardPage` — no test file exists for this page, but the callcenter+wallboard test run (60 tests) still passes with the file imported.
- **Committed in:** `989d524` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug fix mechanically required by the union extension)
**Impact on plan:** Necessary to keep the frontend type-checking; no scope creep — no new runtime behavior beyond making the pre-existing wallboard KPI counter correctly account for the three new statuses instead of failing to compile.

## Issues Encountered
- **[Pre-existing, out of scope] `packages/frontend/src/features/callcenter/model/slice/callCenterSlice.test.ts(123,64)`** — `updateAgent({ ..., pauseReason: null })` doesn't type-check against the action payload's `pauseReason?: string` (the runtime code correctly branches on `pauseReason === null`, but the payload type never declared `| null`). Confirmed via `git diff` that this exact line predates 09-02 (not part of my edits) and predates 09-01 (introduced whenever this test was first written). Logged to `deferred-items.md`, not fixed — belongs to whichever plan next touches `callCenterSlice.ts`'s action payload typing.
- Local shell is PowerShell (Windows), which doesn't support bash `&&`/heredoc syntax used by the gsd-tools reference commands — commits were made with `git add <files>; git commit -m $msg` (semicolon-separated) instead of chained `&&`, with equivalent atomic-commit-per-task effect. `.planning/phases/09-call-center-agent-panel/deferred-items.md` did not exist despite being referenced by 09-01-SUMMARY.md as already populated — created it now and back-filled 09-01's two logged issues alongside 09-02's finding, so the ledger is consolidated in one place.

## User Setup Required
None - no external service configuration required.

## State Update Notes
- `gsd-tools query requirements.mark-complete D-01 D-04 D-07 D-13 D-44` returned `not_found` for all five IDs — `.planning/REQUIREMENTS.md`'s traceability table doesn't contain Phase 9's `D-xx` decision IDs (those live in `09-CONTEXT.md`/`09-VALIDATION.md` instead, per this phase's actual requirement-tracking scheme). No REQUIREMENTS.md edit was made; this is a pre-existing structural mismatch between the tool and this phase's requirement scheme, not something 09-02 introduced or can fix.
- `gsd-tools query state.advance-plan` / `state.update-progress` both errored (`Cannot parse Current Plan or Total Plans in Phase from STATE.md` / `Progress field not found`) — this STATE.md uses free-form prose position tracking instead of the structured `Current Plan: X / Total Plans: Y` fields those verbs expect (same as 09-01). Updated the "Current position" prose section manually instead.

## Next Phase Readiness
- `shared/ui/Tabs` is ready for 09-08's hybrid tabs/panels layout (desktop panel toggle + phone Coworkers/Queues/Waiting switcher) with no further primitive work needed.
- `AgentStatus`, `agentStatusLabel`, and `agentStatusColorFamily` are ready for 09-04 (status bar) to consume directly instead of re-deriving per-status label/color logic inline (as `CallCenterAgentPage.tsx` currently does with its own local `statusLabel`/`statusClass` maps — 09-04 should migrate those call sites onto the new authoritative maps rather than maintaining a second copy, though that migration itself is 09-04's scope, not this plan's).
- `callcenter.tabs.coworkers|queues|waiting` i18n keys are ready for 09-08 to consume for the phone tab labels.
- No blockers identified for Wave 1's remaining/later plans.

## Self-Check: PASSED

All 5 created files and the SUMMARY.md itself verified present on disk; all 3 task commit hashes (`51a69a5`, `989d524`, `f6b4cc4`) verified present in `git log`.

---
*Phase: 09-call-center-agent-panel*
*Completed: 2026-07-22*
