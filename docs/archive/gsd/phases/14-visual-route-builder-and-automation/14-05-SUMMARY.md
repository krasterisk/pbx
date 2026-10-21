---
phase: 14-visual-route-builder-and-automation
plan: 05
subsystem: api
tags: [d-33, d-34, d-35, route-templates, jwt, sequelize, rtk]

requires:
  - phase: 14-visual-route-builder-and-automation
    provides: D-33/D-35 decisions + typed-slot discretion from 14-CONTEXT / 14-RESEARCH
provides:
  - RouteTemplatesModule REST CRUD + POST /route-templates/:id/apply
  - Three built-in seeds (queue+failover, IVR handoff, business hours)
  - RouteTemplatesAiAdapter tools list_templates, apply_template, build_from_description
  - Frontend routeTemplateApi RTK slice for 14-07
affects:
  - 14-07 (Apply/Save dialogs + /route-templates page consume apply output and RTK)
  - Phase 15 (D-34 buildFromDescription + adapter tools)

actuals:
  tokens: 12336
  tasks: 3
  commits: 2

tech-stack:
  added: []
  patterns:
    - Built-in rows use null vpbx_user_uid; tenant mutations never touch them
    - Typed ITemplateSlot markers `__slot:<id>__` substituted on apply
    - Apply returns cloned actions only — no dialplan write

key-files:
  created:
    - packages/shared/src/types/route-template.types.ts
    - packages/backend/src/modules/route-templates/route-template.model.ts
    - packages/backend/src/modules/route-templates/route-templates.service.ts
    - packages/backend/src/modules/route-templates/route-templates.controller.ts
    - packages/backend/src/modules/route-templates/route-templates.module.ts
    - packages/backend/src/modules/route-templates/route-templates-ai.adapter.ts
    - packages/backend/src/modules/route-templates/dto/route-template.dto.ts
    - packages/backend/src/modules/route-templates/setup-route-templates-schema.ts
    - packages/backend/src/modules/route-templates/builtin-route-templates.ts
    - packages/backend/src/modules/route-templates/apply-template.util.ts
    - packages/frontend/src/shared/api/endpoints/routeTemplateApi.ts
  modified:
    - packages/shared/src/index.ts
    - packages/backend/src/app.module.ts
    - packages/frontend/src/shared/api/rtkApi.ts

key-decisions:
  - "PK is uid to match Directory/Route; plan said id"
  - "Schema lives in setup-route-templates-schema.ts because **/migrations/ is gitignored"
  - "buildFromDescription returns an empty named draft, not NotImplementedException"

patterns-established:
  - "List merges null-uid built-ins with JWT tenant rows (T-14-10)"
  - "apply validates slot target ownership before substitution (T-14-09)"
  - "AI tools take vpbxUserUid as a call argument, never a closure"

requirements-completed: [D-33, D-34, D-35]

coverage:
  - id: D1
    description: Tenant CRUD plus built-in seed of three typed-slot templates
    requirement: D-33
    verification:
      - kind: unit
        ref: packages/backend/src/modules/route-templates/route-templates.service.spec.ts
        status: pass
    human_judgment: false
  - id: D2
    description: apply clones actions, fills slot markers, mints new UUIDs, and rejects foreign entities
    requirement: D-35
    verification:
      - kind: unit
        ref: packages/backend/src/modules/route-templates/apply-template.util.spec.ts
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/route-templates/route-templates.service.spec.ts#applies a template by cloning actions
        status: pass
    human_judgment: false
  - id: D3
    description: buildFromDescription stub and AI adapter tools registered for Phase 15
    requirement: D-34
    verification:
      - kind: unit
        ref: packages/backend/src/modules/route-templates/route-templates-ai.adapter.spec.ts
        status: pass
    human_judgment: false

duration: 22min
completed: 2026-09-04
status: complete
---

# Phase 14 Plan 05: Route Templates CRUD Summary

**Tenant-scoped route_templates CRUD with three built-in seeds, slot-aware apply that returns fresh action ids, and a Phase 15 AI adapter stub plus RTK client**

## Performance

- **Duration:** 22 min
- **Started:** 2026-09-03T18:37:00Z
- **Completed:** 2026-09-03T18:59:00Z
- **Tasks:** 3
- **Files modified:** 18

## Accomplishments

- `route_templates` persists built-in (`vpbx_user_uid` null) and tenant rows; list merges both, mutations are tenant-only
- Seed catalog is exactly three templates: queue+failover, IVR handoff, business hours — each with typed slots
- `POST /route-templates/:id/apply` deep-clones actions, substitutes `__slot:<id>__` markers, assigns `crypto.randomUUID()` ids, and validates slot targets against tenant entities
- `buildFromDescription` plus `RouteTemplatesAiAdapter` (`list_templates`, `apply_template`, `build_from_description`) are callable for Phase 15; `routeTemplateApi` is ready for 14-07

## Task Commits

1. **Task 1: End-to-end template CRUD — one tenant template path (D-33)** - `efa4589` (feat)
2. **Task 2: Apply with slot substitution (D-35)** - folded into `bee7607` (feat). Standalone `263ac37` was created but is not on current HEAD after parallel 14-03/14-04 commits; apply sources landed with Task 3
3. **Task 3: buildFromDescription stub + AI adapter + RTK (D-34, D-32)** - `bee7607` (feat)

## Files Created/Modified

- `packages/shared/src/types/route-template.types.ts` - `IRouteTemplate`, `ITemplateSlot`, slot marker helpers, apply result
- `packages/shared/src/index.ts` - export route-template types only
- `packages/backend/src/modules/route-templates/*` - model, CRUD, apply, seed, AI adapter, tests
- `packages/backend/src/app.module.ts` - register RouteTemplate + RouteTemplatesModule
- `packages/frontend/src/shared/api/endpoints/routeTemplateApi.ts` - list/create/update/delete/apply
- `packages/frontend/src/shared/api/rtkApi.ts` - `RouteTemplates` tag

## Decisions Made

- Used `uid` as the primary key to match the rest of the platform (plan column name was `id`)
- Schema + idempotent seed live in `setup-route-templates-schema.ts` (same pattern as directories); `**/migrations/` is gitignored so the planned `src/database/migrations/*` path cannot be committed
- Slot markers are `__slot:<id>__` strings inside action params, not mustache
- `buildFromDescription` returns `{ actions: [], slots: [], name }` so Phase 15 can call it without catching NotImplemented

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Schema path vs gitignore**
- **Found during:** Task 1
- **Issue:** Plan listed `packages/backend/src/database/migrations/*`, but `**/migrations/` is gitignored
- **Fix:** Idempotent `setup-route-templates-schema.ts` in the module folder, matching directories
- **Files modified:** `packages/backend/src/modules/route-templates/setup-route-templates-schema.ts`
- **Verification:** seed-statement unit test
- **Committed in:** `efa4589`

**2. [Rule 3 - Blocking] Parallel-wave commit fold**
- **Found during:** Task 2/3
- **Issue:** 14-03/14-04 committed on the same branch between Task 1 and Task 3; Task 2 hash `263ac37` is not an ancestor of HEAD
- **Fix:** Re-included apply sources in the Task 3 commit so HEAD has CRUD + apply + adapter
- **Files modified:** apply util/service/controller
- **Verification:** 15 passing route-templates tests
- **Committed in:** `bee7607`

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** No scope creep. Apply and AI surfaces are on HEAD.

## Issues Encountered

- Jest `require`s `@krasterisk/shared` from `dist/`; rebuilt shared after adding runtime exports (`TEMPLATE_SLOT_KINDS`, `templateSlotMarker`)
- Did not touch FlowchartCanvas, locales, or dialplan-walk sources

## Known Stubs

| File | Line | Stub | Reason |
|------|------|------|--------|
| `packages/backend/src/modules/route-templates/route-templates.service.ts` | 137 | `buildFromDescription` returns empty `actions`/`slots` | Intentional D-34 stub; Phase 15 fills via LLM |

## User Setup Required

None - no external service configuration required. Apply schema with:

`npx ts-node -r tsconfig-paths/register src/modules/route-templates/setup-route-templates-schema.ts` (from `packages/backend`)

## Next Phase Readiness

- 14-07 can wire Apply/Save dialogs and `/route-templates` to `routeTemplateApi`
- Phase 15 can replace `buildFromDescription` body and keep the same tool names
- Live DB still needs the setup script run once

## Self-Check: PASSED
