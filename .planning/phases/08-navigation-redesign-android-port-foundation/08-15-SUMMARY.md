---
phase: 08-navigation-redesign-android-port-foundation
plan: 15
subsystem: frontend
tags: [responsive, hybrid-table, apps, NAV-09, D-27, D-29]

requires:
  - phase: 08-navigation-redesign-android-port-foundation
    provides: ModuleShell + MobileBottomBar (08-03/08-07); hybrid marker contract from 08-09
provides:
  - "D-27 wave C page-level overflow hybrid on Prompts, Call Groups, Notification Integrations"
  - "Voice Robots list hybrid + edit phone stack / no page bleed"
affects:
  - 08-16 System rest responsive
  - 08-17 Analytics/AI/CC orphans responsive

tech-stack:
  added: []
  patterns:
    - "data-testid=hybrid-table + data-hybrid=overflow-x-auto for Apps secondary lists"
    - "data-testid=voice-robot-edit-responsive + data-edit-stack=phone for edit containment"

key-files:
  created:
    - packages/frontend/src/pages/PromptsPage/PromptsPage.test.tsx
    - packages/frontend/src/pages/PromptsPage/PromptsPage.module.scss
    - packages/frontend/src/features/call-groups/ui/CallGroupsPage/CallGroupsPage.test.tsx
    - packages/frontend/src/features/call-groups/ui/CallGroupsPage/CallGroupsPage.module.scss
    - packages/frontend/src/features/notifications/ui/NotificationIntegrationsPage/NotificationIntegrationsPage.module.scss
    - packages/frontend/src/pages/VoiceRobotsPage/VoiceRobotsPage.test.tsx
    - packages/frontend/src/pages/VoiceRobotsPage/VoiceRobotsPage.module.scss
    - packages/frontend/src/pages/VoiceRobotEditPage/VoiceRobotEditPage.test.tsx
    - packages/frontend/src/pages/VoiceRobotEditPage/VoiceRobotEditPage.module.scss
  modified:
    - packages/frontend/src/pages/PromptsPage/PromptsPage.tsx
    - packages/frontend/src/features/call-groups/ui/CallGroupsPage/CallGroupsPage.tsx
    - packages/frontend/src/features/call-groups/ui/CallGroupFormModal/CallGroupFormModal.module.scss
    - packages/frontend/src/features/notifications/ui/NotificationIntegrationsPage/NotificationIntegrationsPage.tsx
    - packages/frontend/src/pages/VoiceRobotsPage/VoiceRobotsPage.tsx
    - packages/frontend/src/pages/VoiceRobotEditPage/VoiceRobotEditPage.tsx

key-decisions:
  - "Apps remaining lists use page-level overflow hybrid (08-09 secondary pattern), not phone cards"
  - "VoiceRobotEditPage containment at page dir only; VoiceRobotForm left unchanged (tabs already overflow-x-auto)"
  - "Scoped strictly to Prompts/CallGroups/Notifications/VoiceRobots pages — did not rework 08-09/08-14"

patterns-established:
  - "Hybrid marker contract reused from 08-09 for Apps rest wave C"
  - "Edit stack marker data-edit-stack=phone for phone usability smoke"

requirements-completed: [NAV-09]

duration: 8min
completed: 2026-07-16
---

# Phase 8 Plan 15: Apps Rest Responsive Summary

**Prompts, Call Groups, Notification Integrations, and Voice Robots list+edit 360px hybrid pass completing Apps Hub routes beyond 08-09 (NAV-09 / D-27 wave C)**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-16T18:36:31Z
- **Completed:** 2026-07-16T18:44:00Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments

- Prompts / Call Groups / Integrations: page-level `overflow-x-auto` hybrid markers, `min-w-0` bleed guards, full-width CTAs under 640px; CallGroup modal width fix on phone
- Voice Robots list: same hybrid overflow pattern + phone header/CTA stack
- Voice Robot edit: `data-edit-stack=phone` with page overflow containment (scroll stays in panels)
- RTL/class smokes green for Prompts, Call Groups, Voice Robots list, and edit stack

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1 RED:** `59959ce` (test) — Prompts + Call Groups failing hybrid smokes
2. **Task 1 GREEN:** `e945b0f` (feat) — Prompts/CallGroups/Integrations page hybrid
3. **Task 2 RED:** `c88cabd` (test) — VoiceRobots list + edit failing smokes
4. **Task 2 GREEN:** `3671aa8` (feat) — VoiceRobots list hybrid + edit phone stack

**Plan metadata:** _(docs commit follows)_

## Files Created/Modified

### Task 1 — Prompts / Call Groups / Integrations
- `packages/frontend/src/pages/PromptsPage/` — overflow hybrid + header CTA stack + smoke test
- `packages/frontend/src/features/call-groups/ui/CallGroupsPage/` — overflow hybrid + create CTA + smoke test
- `packages/frontend/src/features/call-groups/ui/CallGroupFormModal/CallGroupFormModal.module.scss` — phone full-width dialog
- `packages/frontend/src/features/notifications/ui/NotificationIntegrationsPage/` — overflow hybrid + create CTA

### Task 2 — Voice Robots
- `packages/frontend/src/pages/VoiceRobotsPage/` — overflow hybrid + smoke test
- `packages/frontend/src/pages/VoiceRobotEditPage/` — edit stack marker + containment + smoke test

## Decisions Made

- Secondary Apps lists keep feature tables unchanged and wrap at page level (matches 08-09/08-14 secondary pattern)
- Edit usability constrained to page shell; form tabs already scroll horizontally inside the form card
- Did not touch Ivrs/Moh/Phonebooks (08-09) or Core rest (08-14)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None

## Known Stubs

None — hybrid and edit-stack markers are wired to real layout branches (no placeholder UI).

## Threat Flags

None — UI-only layout; no new trust boundaries (matches plan T-08-15c / T-08-SC accept).

## Next Phase Preview

Plans 08-16 (System rest) and 08-17 (Analytics/AI/CC orphans) continue D-27; 08-10/08-11 continue Android/Capacitor.

## Self-Check: PASSED

- SUMMARY path exists: `.planning/phases/08-navigation-redesign-android-port-foundation/08-15-SUMMARY.md`
- Commits present: `59959ce`, `e945b0f`, `c88cabd`, `3671aa8`
- Key artifacts: Prompts hybrid test, CallGroups hybrid test, VoiceRobots hybrid test, VoiceRobotEdit stack test
