---
phase: 14-visual-route-builder-and-automation
plan: 07
subsystem: ui
tags: [d-33, d-36, d-37, d-51, d-46, route-templates, dialplan-editor]

requires:
  - phase: 14-visual-route-builder-and-automation
    provides: routeTemplateApi CRUD + apply with new UUIDs from 14-05; dry-run locale keys from 14-06
provides:
  - DialplanAppsEditor template footer only on RouteActionsTab host route
  - ApplyTemplateDialog (slots, append default, confirm on replace)
  - SaveAsTemplateDialog with auto-detected slots
  - /route-templates page + RouteTemplateFormModal create/edit/copy
affects:
  - 14-09 (callback UI stays out of this plan)
  - 14-10 (UsageTab / FormModal usage tabs untouched)
  - verify-work Surfaces G–J

actuals:
  tokens: 25260
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - showTemplateActions && host === 'route' && !readOnly gates template CTAs
    - Apply merges API-cloned actions client-side (replace | append)
    - Template CRUD modal uses local modalMode state, not a new Redux slice

key-files:
  created:
    - packages/frontend/src/features/route-templates/ui/ApplyTemplateDialog/ApplyTemplateDialog.tsx
    - packages/frontend/src/features/route-templates/ui/SaveAsTemplateDialog/SaveAsTemplateDialog.tsx
    - packages/frontend/src/features/route-templates/ui/RouteTemplateFormModal/RouteTemplateFormModal.tsx
    - packages/frontend/src/features/route-templates/ui/RouteTemplatesPage/RouteTemplatesPage.tsx
    - packages/frontend/src/pages/RouteTemplatesPage/RouteTemplatesPage.tsx
  modified:
    - packages/frontend/src/features/dialplan-apps/ui/DialplanAppsEditor/DialplanAppsEditor.tsx
    - packages/frontend/src/features/routes/ui/RouteFormModal/RouteActionsTab.tsx
    - packages/frontend/src/app/router/router.tsx
    - packages/frontend/src/features/modules/lib/moduleRegistry.ts
    - packages/frontend/src/widgets/Sidebar/lib/buildNavigation.ts
    - packages/frontend/src/shared/config/locales/en.ts
    - packages/frontend/src/shared/config/locales/ru.ts

key-decisions:
  - "Template buttons render only when showTemplateActions is set by RouteActionsTab and host is route"
  - "Apply mode is client-side merge; backend apply still returns cloned actions only"
  - "RouteTemplateFormModal is owned by the page via local create|edit|copy state"
  - "Appended routes.templates + nav.routeTemplates only; dryRun strings left untouched"

patterns-established:
  - "Surface G footer: Add → Paste → From template → Save as template; mobile overflow uses MoreVertical"
  - "Built-in rows disable Edit/Delete with Tooltip; Copy stays active"

requirements-completed: [D-33, D-36, D-37, D-51, D-46]

coverage:
  - id: D1
    description: Template footer buttons only on RouteActionsTab host route; absent on IVR host
    requirement: D-51
    verification:
      - kind: unit
        ref: packages/frontend/src/features/dialplan-apps/ui/DialplanAppsEditor/DialplanAppsEditor.test.tsx#shows template footer buttons only for the route host
        status: pass
    human_judgment: false
  - id: D2
    description: Apply dialog fills slots, defaults to append, and confirms replace
    requirement: D-36
    verification:
      - kind: unit
        ref: packages/frontend/src/features/route-templates/ui/ApplyTemplateDialog/ApplyTemplateDialog.test.tsx#requires a confirm dialog before replace
        status: pass
    human_judgment: false
  - id: D3
    description: Save-as detects entity refs and POSTs a tenant template with slot markers
    requirement: D-33
    verification:
      - kind: unit
        ref: packages/frontend/src/features/route-templates/ui/SaveAsTemplateDialog/SaveAsTemplateDialog.test.tsx#creates a tenant template with auto-detected slots checked by default
        status: pass
    human_judgment: false
  - id: D4
    description: /route-templates registered after routes with LayoutTemplate
    requirement: D-51
    verification:
      - kind: unit
        ref: packages/frontend/src/features/modules/lib/moduleRegistry.test.ts#maps Hub modules to expected page paths
        status: pass
    human_judgment: false
  - id: D5
    description: RouteTemplateFormModal create/edit/copy with full DialplanAppsEditor and built-in guard
    requirement: D-37
    verification:
      - kind: unit
        ref: packages/frontend/src/features/route-templates/ui/RouteTemplateFormModal/RouteTemplateFormModal.test.tsx#blocks built-in edit and offers save a copy
        status: pass
    human_judgment: false
  - id: D6
    description: TableRowActions Edit/Copy/Delete with title and aria-label; built-in Edit/Delete disabled
    requirement: D-37
    verification:
      - kind: unit
        ref: packages/frontend/src/features/route-templates/ui/RouteTemplatesPage/RouteTemplatesPage.test.tsx#exposes TableRowActions with title and aria-label; built-in edit/delete are disabled
        status: pass
    human_judgment: false

duration: 35min
completed: 2026-09-04
status: complete
---

# Phase 14 Plan 07: Templates Frontend Summary

**Route-host template footer plus Apply/Save dialogs and a /route-templates CRUD page with create/edit/copy DialplanAppsEditor**

## Performance

- **Duration:** 35 min
- **Started:** 2026-09-03T20:52:00Z
- **Completed:** 2026-09-03T21:27:00Z
- **Tasks:** 3
- **Files modified:** 32

## Accomplishments

- `DialplanAppsEditor` shows «Из шаблона» / «Сохранить как шаблон» only when `RouteActionsTab` sets `showTemplateActions` on host `route`; IVR and read-only hosts stay clean
- `ApplyTemplateDialog` walks choose → slot Selects → append/replace (append default); replace requires a confirm dialog (T-14-12 / D-36) then merges API actions with new UUIDs
- `SaveAsTemplateDialog` auto-detects queue/group/ivr/trunk/recording/directory refs, checks them by default, and POSTs slot markers via `routeTemplateApi`
- `/route-templates` is registered after routes (`LayoutTemplate`) in `moduleRegistry`, sidebar, and a lazy router entry; form modal edits chain + slots with a built-in read-only guard

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end apply template into route draft** - `672baaf` (feat)
2. **Task 2: Save-as-template dialog** - `9df135d` (feat)
3. **Task 3 RED: failing CRUD page tests** - `94e7ed0` (test)
4. **Task 3 GREEN: route templates CRUD page** - `7653719` (feat)

**Plan metadata:** `f81315b` (docs: complete plan)

## Files Created/Modified

- `packages/frontend/src/features/route-templates/ui/ApplyTemplateDialog/*` - three-step apply dialog
- `packages/frontend/src/features/route-templates/ui/SaveAsTemplateDialog/*` - save-as with slot checklist
- `packages/frontend/src/features/route-templates/ui/RouteTemplateFormModal/*` - create/edit/copy form
- `packages/frontend/src/features/route-templates/ui/RouteTemplatesPage/*` - SCSS CRUD page + TableRowActions
- `packages/frontend/src/features/route-templates/model/detectTemplateSlots.ts` - slot candidates from chain refs
- `packages/frontend/src/features/dialplan-apps/ui/DialplanAppsEditor/DialplanAppsEditor.tsx` - footer + empty-state CTA
- `packages/frontend/src/features/routes/ui/RouteFormModal/RouteActionsTab.tsx` - `showTemplateActions`
- `packages/frontend/src/app/router/router.tsx` - lazy `/route-templates`
- `packages/frontend/src/features/modules/lib/moduleRegistry.ts` - page after routes
- `packages/frontend/src/widgets/Sidebar/lib/buildNavigation.ts` - PBX item after routes
- `packages/frontend/src/shared/config/locales/{en,ru}.ts` - appended `routes.templates` + `nav.routeTemplates`

## Decisions Made

- Gate template CTAs with `showTemplateActions && host === 'route' && !readOnly` so IVR/directory hosts cannot render them even if the prop leaks
- Keep apply merge on the client; 14-05 apply already mints UUIDs and ignores mode
- Own modalMode on the page instead of adding a Redux slice
- Append template locale keys only; dry-run copy from 14-06 was not rewritten

## Deviations from Plan

### Auto-fixed Issues

None - plan executed as written. Sequencing note (not a Rule 1–3 fix): apply/save locale keys landed with Task 1 because the tracer dialogs need them; Task 3 only appended page/nav keys.

---

**Total deviations:** 0 auto-fixed
**Impact on plan:** No scope creep. UsageTab / callback UI were not touched.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Surfaces G–J are wired to `routeTemplateApi`; 14-09 can add callback without colliding with this footer
- 14-10 Usage tabs remain independent

## TDD Gate Compliance

Task 3 followed RED (`94e7ed0`) then GREEN (`7653719`).

## Self-Check: PASSED

---
*Phase: 14-visual-route-builder-and-automation*
*Completed: 2026-09-04*
