---
phase: 14-visual-route-builder-and-automation
plan: 11
subsystem: ui
tags: [g-14-2, template-preview, tenant-display, usage-labels, callback-chrome]
gap_closure: true
gap_ids: [G-14-2]
requires:
  - phase: 14-visual-route-builder-and-automation
    provides: 14-07 template dialogs + 14-10 UsageTab
provides:
  - sanitizeParamsForPreview before registry summarize
  - tenant queue/exten display normalize (q700_0 → 700)
  - human UsageTab / delete-blocked labels
  - operator callback badge only when requests exist; icon-only chrome
affects:
  - verify-work 14 (UAT Test 2)
actuals:
  tasks: 1
  commits: 1
status: complete
completed: 2026-09-04
---

# Phase 14 Plan 11: UAT gap G-14-2 + live chrome Summary

**Template preview no longer leaks `__slot:` tokens; route/IVR summaries show bare queue and extension numbers; usage rows name the route or IVR and the action.**

## Accomplishments

- `sanitizeParamsForPreview` replaces slot markers with labels before `summarize`; stored JSON still uses `templateSlotMarker`
- Apply-template persist uses catalog uid; queue lookup accepts `q{exten}_{tenant}`
- Display normalize: `q700_0` / `e101_0` → `700` / `101` in step row, flowchart, selects
- Usage index scans IVR menus; cards show `Маршрут «…»` / `IVR «…»` and `Действие N — IVR`
- Callback operator badge hidden at count 0; header chrome is icon-only (chat unread count stays)

## UAT

- Test 2 live pass; G-14-2 resolved
- Phase 14 UAT: 27/27
