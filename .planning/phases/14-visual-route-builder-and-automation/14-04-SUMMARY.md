---
phase: 14-visual-route-builder-and-automation
plan: 04
subsystem: api
tags: [dry-run, walkDialplanGraph, exact_only, hop-budget, reask, domain-ai-adapter]

requires:
  - phase: 14-visual-route-builder-and-automation
    provides: 14-01 RED walk/exact_only specs + 14-02 RouteReferencesService tenant index
provides:
  - Production walkDialplanGraph and exactRouteResolver greening 14-01 specs
  - POST /dialplan/dry-run JWT DialplanDryRunService (draft actions / menu_items)
  - Cross-entity toivr/toroute/goto with DEFAULT_HOP_LIMIT and D-46 reason strings
  - DialplanDryRunAiAdapter tool dialplan_dry_run (vpbxUserUid arg) + FE postDryRun
affects:
  - 14-06 (FlowchartCanvas highlight consumes DryRunResult segments)
  - 15 (AI agent calls dialplan_dry_run)

actuals:
  tokens: 10378
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - Shared sync walker with injected resolveIvr / resolveRoutesInContext / resolveRoute
    - Service preloads tenant IVRs/routes/contexts; JWT uid only
    - DomainAiAdapter OnModuleInit registration matching DirectoriesAiAdapter

key-files:
  created:
    - packages/backend/src/modules/dialplan-dry-run/dialplan-dry-run.service.ts
    - packages/backend/src/modules/dialplan-dry-run/dialplan-dry-run.controller.ts
    - packages/backend/src/modules/dialplan-dry-run/dialplan-dry-run.module.ts
    - packages/backend/src/modules/dialplan-dry-run/dto/dry-run.dto.ts
    - packages/backend/src/modules/dialplan-dry-run/dialplan-dry-run-ai.adapter.ts
    - packages/frontend/src/shared/api/endpoints/dryRunApi.ts
  modified:
    - packages/shared/src/utils/dialplan-walk/walkDialplanGraph.ts
    - packages/shared/src/utils/dialplan-walk/exactRouteResolver.ts
    - packages/backend/src/app.module.ts

key-decisions:
  - "Walker stays synchronous; service preloads tenant IVRs/routes/contexts then injects callbacks"
  - "toivr uses IvrsService.findAll plus RouteReferencesService.findReferences(ivr, uid, jwtUid)"
  - "Task 1 landed inside sibling 014f316 (14-03 scooped staged files on the shared branch)"

patterns-established:
  - "Pattern: hop only on toivr/toroute/goto; callback_requested is terminal with no hop"
  - "Pattern: exact_only reasons are неоднозначность / паттерн / не-маршрутный контекст / Цель перехода выключена"
  - "Pattern: reask DTO always sets askedAfterRun: true (D-47)"

requirements-completed: [D-29, D-30, D-32, D-43, D-44, D-45, D-46, D-47, D-48, D-38]

coverage:
  - id: D1
    description: 20 passthrough playback steps consume zero hops (D-45)
    requirement: D-45
    verification:
      - kind: unit
        ref: packages/shared/src/utils/dialplan-walk/walkDialplanGraph.spec.ts#20 consecutive passthrough playback actions consume zero hops
        status: pass
    human_judgment: false
  - id: D2
    description: 11th toivr hop yields Congestion at DEFAULT_HOP_LIMIT with loop breadcrumb (D-45)
    requirement: D-45
    verification:
      - kind: unit
        ref: packages/shared/src/utils/dialplan-walk/walkDialplanGraph.spec.ts#11th resolvable toivr jump yields Congestion
        status: pass
    human_judgment: false
  - id: D3
    description: exact_only resolver covers enter, ambiguous, pattern_only, inactive, non_route_context (D-46)
    requirement: D-46
    verification:
      - kind: unit
        ref: packages/shared/src/utils/dialplan-walk/exactRouteResolver.spec.ts
        status: pass
    human_judgment: false
  - id: D4
    description: Missing QUEUESTATUS yields reask with askedAfterRun (D-47)
    requirement: D-47
    verification:
      - kind: unit
        ref: packages/backend/src/modules/dialplan-dry-run/dialplan-dry-run.service.spec.ts#returns reask with askedAfterRun
        status: pass
    human_judgment: false
  - id: D5
    description: IVR host always exposes t and i inputs (D-43)
    requirement: D-43
    verification:
      - kind: unit
        ref: packages/shared/src/utils/dialplan-walk/walkDialplanGraph.spec.ts#exposes timeout (t) and invalid (i) inputs
        status: pass
    human_judgment: false
  - id: D6
    description: Terminal callback yields callback_requested and consumes no hop (D-38)
    requirement: D-38
    verification:
      - kind: unit
        ref: packages/shared/src/utils/dialplan-walk/walkDialplanGraph.spec.ts#stops on terminal callback
        status: pass
    human_judgment: false
  - id: D7
    description: POST dry-run walks a linear draft and returns ordered node ids (D-29)
    requirement: D-29
    verification:
      - kind: unit
        ref: packages/backend/src/modules/dialplan-dry-run/dialplan-dry-run.service.spec.ts#returns ordered node ids
        status: pass
    human_judgment: false
  - id: D8
    description: Cross-entity toivr/toroute/goto with tenant-scoped loaders (D-44 D-46 D-48)
    requirement: D-44
    verification:
      - kind: unit
        ref: packages/backend/src/modules/dialplan-dry-run/dialplan-dry-run.service.spec.ts#enters toivr via tenant IVR fetch
        status: pass
    human_judgment: false
  - id: D9
    description: DialplanDryRunAiAdapter registers dialplan_dry_run with vpbxUserUid arg (D-32)
    requirement: D-32
    verification:
      - kind: unit
        ref: packages/backend/src/modules/dialplan-dry-run/dialplan-dry-run-ai.adapter.spec.ts#passes call-time vpbxUserUid
        status: pass
    human_judgment: false

duration: 26min
completed: 2026-09-03
status: complete
---

# Phase 14 Plan 04: Dry-run walker + DialplanDryRunService Summary

**Shared walkDialplanGraph greened against 14-01 specs, Nest POST /dialplan/dry-run with cross-entity hops, and dialplan_dry_run AI tool plus RTK postDryRun**

## Performance

- **Duration:** 26 min
- **Started:** 2026-09-03T18:39:13Z
- **Completed:** 2026-09-03T19:05:00Z
- **Tasks:** 3
- **Files modified:** 15

## Accomplishments

- Greened `walkDialplanGraph` / `resolveExactRoute` (10/10 shared specs): hop ≠ step, Congestion at `DEFAULT_HOP_LIMIT`, reask, IVR `t`/`i`, `callback_requested`
- `POST /dialplan/dry-run` accepts draft `actions` / `menu_items`; JWT `vpbx_user_uid` only; class-validator whitelist
- Cross-entity walk: `toivr` via tenant IVR + `RouteReferencesService.findReferences`, `toroute` exact_only with specific reason strings, `goto` same-segment hop
- `DialplanDryRunAiAdapter` tool `dialplan_dry_run` (uid is handler arg) and FE `dryRunApi.postDryRun` for 14-06

## Task Commits

1. **Task 1: End-to-end linear route dry-run** - `014f316` (feat — mixed into sibling 14-03 commit; see Deviations)
2. **Task 2: Cross-entity walk toivr/toroute/goto** - `2a80abc` (feat)
3. **Task 3: Reask + AI adapter + RTK endpoint** - `a770473` (feat)

**Plan metadata:** pending docs commit

## Files Created/Modified

- `packages/shared/src/utils/dialplan-walk/walkDialplanGraph.ts` - Production walker (hops, reask, IVR, callback, toivr/toroute/goto)
- `packages/shared/src/utils/dialplan-walk/exactRouteResolver.ts` - exact_only D-46
- `packages/backend/src/modules/dialplan-dry-run/*` - Nest module, HTTP, service loaders, AI adapter
- `packages/backend/src/app.module.ts` - DialplanDryRunModule
- `packages/frontend/src/shared/api/endpoints/dryRunApi.ts` - RTK `postDryRun` for 14-06

## Decisions Made

- Walker stays sync; service preloads tenant-scoped IVRs/routes/contexts
- toivr resolution = `IvrsService.findAll(uid)` plus inverse `findReferences('ivr', ivrUid, uid)` (T-14-06)
- Callback outcome label is the UI-SPEC ru string `Итог: абонент заказал обратный звонок`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Task 1 commit scooped by parallel 14-03 on the shared branch**
- **Found during:** Task 1 commit
- **Issue:** Staged 14-04 walker + dry-run files were committed as `014f316 feat(14-03): add CSS-grid flowchart canvas…` by a sibling executor. A later 14-05 rebase also dropped an intermediate 14-04 Task 2 hash (`e6f7a7a`); Task 2 was recommitted as `2a80abc`.
- **Fix:** Did not rewrite `014f316` (not our commit). Verified Task 1 files are in that commit; Task 2/3 committed as `feat(14-04)`.
- **Files modified:** none additional
- **Verification:** shared walk 10/10 green; dry-run suites green
- **Committed in:** `014f316` / `2a80abc`

---

**Total deviations:** 1 process (shared-branch race)
**Impact on plan:** No functional gap. Task 1 hash is shared with 14-03 flowchart files.

## Issues Encountered

- Parallel wave executors share `feat/universal-dialplan-directories`. Staging is not isolated; commit immediately after verify.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 14-06 can POST `postDryRun` and paint `segments[].nodes` on FlowchartCanvas
- Phase 15 can call `dialplan_dry_run` with `vpbxUserUid` as the tool argument
- Did not touch FlowchartCanvas/locales or route-templates

---
*Phase: 14-visual-route-builder-and-automation*
*Completed: 2026-09-03*

## Self-Check: PASSED
