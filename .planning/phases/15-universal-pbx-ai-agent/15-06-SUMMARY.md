---
phase: 15-universal-pbx-ai-agent
plan: 06
subsystem: ui
tags: [ai-agent, topbar, module-shell, focus-trap, i18n, d-23, d-24, d-25]

requires:
  - phase: 08-navigation-redesign-android-port-foundation
    provides: ModuleShell topbar + CommandPalette Ctrl/Cmd+K listener
  - phase: 09-call-center-agent-panel
    provides: softphone ownership of the bottom-right corner
provides:
  - Topbar agent trigger immediately left of #shell-cmdk-trigger
  - Shell-owned open state + Ctrl/Meta+Shift+J shortcut
  - 520px grid panel with 240px thread-rail slot and no tenant model selector
  - First-writer aiChat locale keys for later frontend plans
affects:
  - 15-12 (fills the thread rail)
  - 15-13 (threads in the rail slot)
  - 15-14 (diff cards inside the conversation column)
  - 15-18 (streaming / stop in the composer)
  - 15-24 (platform default-model control)

actuals:
  tokens: 10106
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - Agent open state lives in ModuleShell; the widget receives open + onClose
    - Shortcut uses the same raw window keydown listener as the command palette
    - Panel geometry is stylesheet tokens only; no inline layout styles

key-files:
  created:
    - packages/frontend/src/widgets/AiChatWidget/AiChatWidget.test.tsx
  modified:
    - packages/frontend/src/widgets/ModuleShell/ModuleShell.tsx
    - packages/frontend/src/widgets/ModuleShell/ModuleShell.module.scss
    - packages/frontend/src/widgets/ModuleShell/ModuleShell.test.tsx
    - packages/frontend/src/widgets/AiChatWidget/AiChatWidget.tsx
    - packages/frontend/src/widgets/AiChatWidget/AiChatWidget.module.scss
    - packages/frontend/src/shared/config/locales/en.ts
    - packages/frontend/src/shared/config/locales/ru.ts
    - packages/frontend/src/app/layouts/AppLayout.tsx

key-decisions:
  - "Agent trigger sits immediately left of #shell-cmdk-trigger; open state is held by ModuleShell"
  - "Ctrl/Meta+Shift+J toggles the panel; Ctrl/Cmd+K stays the palette shortcut"
  - "Floating corner FAB and its positioning rules are deleted so the softphone owns bottom-right"
  - "Panel width 520px and rail 240px are stylesheet tokens; tenant model selector is gone"
  - "AppLayout no longer mounts AiChatWidget - the shell owns the overlay so D-23 survives route changes"

patterns-established:
  - "Pattern: shell-agent-trigger - #shell-agent-trigger precedes #shell-cmdk-trigger and owns panel open state"
  - "Pattern: later frontend plans append inside aiChat.* rather than restructuring the namespace"

requirements-completed: [D-23, D-24, D-25]

coverage:
  - id: D1
    description: Agent opens from a topbar control immediately left of the command-palette trigger; the floating corner button is gone
    requirement: D-24
    verification:
      - kind: unit
        ref: packages/frontend/src/widgets/ModuleShell/ModuleShell.test.tsx#places the agent trigger immediately before the command-palette trigger
        status: pass
      - kind: unit
        ref: packages/frontend/src/widgets/AiChatWidget/AiChatWidget.test.tsx#does not render the former floating trigger
        status: pass
    human_judgment: false
  - id: D2
    description: Keyboard shortcut toggles the panel without stealing the command-palette shortcut
    requirement: D-24
    verification:
      - kind: unit
        ref: packages/frontend/src/widgets/ModuleShell/ModuleShell.test.tsx#toggles the agent panel with Ctrl+Shift+J and leaves Ctrl+K for the palette
        status: pass
    human_judgment: false
  - id: D3
    description: Escape closes the panel, returns focus to the trigger, and Tab stays trapped inside the open panel
    requirement: D-23
    verification:
      - kind: unit
        ref: packages/frontend/src/widgets/ModuleShell/ModuleShell.test.tsx#closes the agent panel on Escape and returns focus to the trigger
        status: pass
      - kind: unit
        ref: packages/frontend/src/widgets/AiChatWidget/AiChatWidget.test.tsx#traps Tab inside the open panel and never reaches the page behind
        status: pass
    human_judgment: false
  - id: D4
    description: Desktop panel is a 520px stylesheet column with a thread-rail slot; tablet/phone drop the rail and phone is a full-height sheet
    requirement: D-25
    verification:
      - kind: unit
        ref: packages/frontend/src/widgets/AiChatWidget/AiChatWidget.test.tsx#takes panel width from the stylesheet and never from an inline style
        status: pass
      - kind: unit
        ref: packages/frontend/src/widgets/AiChatWidget/AiChatWidget.test.tsx#lays header, body, composer and footer out as separate grid rows
        status: pass
    human_judgment: false
  - id: D5
    description: Tenant-facing panel has no model selector
    requirement: D-25
    verification:
      - kind: unit
        ref: packages/frontend/src/widgets/AiChatWidget/AiChatWidget.test.tsx#does not render a model selector in the tenant panel
        status: pass
    human_judgment: false

duration: 37min
completed: 2026-09-04
status: complete
---

# Phase 15 Plan 06: Topbar Agent Trigger And Panel Geometry Summary

**Agent opens from a topbar control next to the command palette, with a 520px grid panel, focus trap, and no floating corner button**

## Performance

- **Duration:** 37 min
- **Started:** 2026-09-04T08:43:31Z
- **Completed:** 2026-09-04T09:20:00Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- The agent trigger lives in the ModuleShell topbar immediately left of `#shell-cmdk-trigger`, with `Ctrl/Meta+Shift+J` toggling the panel and `Ctrl/Cmd+K` still opening the palette
- The floating corner FAB and its positioning rules are gone; the bottom-right corner is free for the softphone at every breakpoint
- The panel is a stylesheet-owned 520px column (full-height sheet below 768px) with named grid rows and a 240px thread-rail slot above 1024px
- Tenant model selector is removed; `aiChat.*` locale keys now match the design-contract copy in ru and en

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: failing tests for topbar trigger / shortcut / focus** - `e32d65e` (test)
2. **Task 1 GREEN: topbar trigger, shortcut, Escape, focus trap** - `75a51f1` (feat)
3. **Task 2 RED: failing tests for panel geometry** - `4727205` (test)
4. **Task 2 GREEN: 520px grid, rail slot, no model selector** - `11813e6` (feat)
5. **Task 3: agent locale keys** - `6d3c7fc` (feat)

**Plan metadata:** `46c46f6` (docs: complete plan)

_Note: TDD tasks produced RED then GREEN commits_

## Files Created/Modified

- `packages/frontend/src/widgets/ModuleShell/ModuleShell.tsx` - Agent trigger, shortcut listener, shell-owned open state, mounts the widget
- `packages/frontend/src/widgets/ModuleShell/ModuleShell.module.scss` - Active-state tint for the topbar trigger
- `packages/frontend/src/widgets/ModuleShell/ModuleShell.test.tsx` - Trigger position, shortcut isolation, Escape focus return
- `packages/frontend/src/widgets/AiChatWidget/AiChatWidget.tsx` - Controlled panel, focus trap, grid chrome, no FAB
- `packages/frontend/src/widgets/AiChatWidget/AiChatWidget.module.scss` - 520px / 240px tokens, grid areas, tablet sheet
- `packages/frontend/src/widgets/AiChatWidget/AiChatWidget.test.tsx` - Geometry, trap, locale key parity
- `packages/frontend/src/shared/config/locales/en.ts` - First-writer `aiChat.*` contract copy
- `packages/frontend/src/shared/config/locales/ru.ts` - Matching Russian keys from the UI-SPEC
- `packages/frontend/src/app/layouts/AppLayout.tsx` - Removed the second widget mount (Rule 2)

## Decisions Made

- Open state is held by ModuleShell, not Redux/`AiChatWidget`, so the shortcut and route changes share one source of truth (D-23)
- Shortcut is a second raw `window` keydown effect, same pattern as the palette, gated on modifier + Shift + `j`
- `AppLayout` must not keep a sibling `<AiChatWidget />` or the floating trigger / double panel would return
- Thread rail is an empty labelled slot; 15-12 / 15-13 fill it without changing the grid

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Removed AiChatWidget from AppLayout**
- **Found during:** Task 1 (topbar trigger)
- **Issue:** Plan `files_modified` omitted `AppLayout.tsx`, but the widget was mounted there as a floating sibling. Leaving it would keep a second panel (or a required-props type error) and recreate the D-24 corner collision.
- **Fix:** Mount the widget only inside ModuleShell; drop the AppLayout instance.
- **Files modified:** `packages/frontend/src/app/layouts/AppLayout.tsx`
- **Verification:** ModuleShell tests render the panel from the shell; `#ai-chat-trigger` is absent
- **Committed in:** `75a51f1` (Task 1 GREEN)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Required for D-23/D-24. No scope creep.

## Issues Encountered

- jsdom has no `scrollIntoView`; tests stub it, and the widget calls it optionally so the suite does not throw

## Known Stubs

| File | Line | Stub | Reason |
|------|------|------|--------|
| `packages/frontend/src/widgets/AiChatWidget/AiChatWidget.tsx` | 212 | Empty labelled thread rail + `aiChat.railPlaceholder` | Planned gap; 15-12 / 15-13 fill real threads without changing layout |

## TDD Gate Compliance

- Task 1: RED `e32d65e` then GREEN `75a51f1`
- Task 2: RED `4727205` then GREEN `11813e6`
- Task 3: locale-only auto task, no TDD cycle required

## Auth Gates

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Shell chrome and panel geometry are ready for 15-12 (thread list), 15-14 (diff cards), and 15-18 (streaming)
- Later frontend plans must append keys inside `aiChat.*`, not restructure the namespace
- 15-04 / 15-05 remain the next backend plans on the sequential wave; this UI plan does not unblock them

---
## Self-Check: PASSED

- FOUND: `.planning/phases/15-universal-pbx-ai-agent/15-06-SUMMARY.md`
- FOUND: `e32d65e` `75a51f1` `4727205` `11813e6` `6d3c7fc`
- FOUND: `packages/frontend/src/widgets/AiChatWidget/AiChatWidget.test.tsx`
- FOUND: `packages/frontend/src/widgets/ModuleShell/ModuleShell.tsx`

---
*Phase: 15-universal-pbx-ai-agent*
*Completed: 2026-09-04*
