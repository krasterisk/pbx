---
phase: 12-dialplan-apps-editor-refactor-reusable-route-chain-builder
plan: 16
subsystem: dialplan
tags: [label, goto, branch, schedule, http_request, collect_input, SSRF, D-44, D-45, D-47, D-49]

requires:
  - phase: 12-15
    provides: wave 11 complete; schema-driven editor + ConditionSource http_result
provides:
  - label/goto/branch with validateLabelRefs on save
  - schedule action reusing formatTimeGroupInterval
  - http_request → HTTP_RESULT_VAR / KRSK_HTTP_RESULT with SSRF assertSafeHttpUrl
  - collect_input Read / WaitExten into a channel variable
affects:
  - 12-17 final gate / live UAT of new action types

tech-stack:
  added: []
  patterns:
    - "t(key, fallback) when ru.ts/en.ts are dirty WIP"
    - "prefixSamePriority for named label hops"
    - "formatTimeGroupInterval shared by schedule, time-groups, routes"
    - "assertSafeHttpUrl before CURL(); emit NoOp(Invalid HTTP URL) at actionToDialplan boundary"

key-files:
  created:
    - packages/backend/src/shared/utils/dialplan-labels.util.ts
    - packages/backend/src/shared/utils/dialplan-labels.util.spec.ts
    - packages/backend/src/shared/utils/dialplan-http.util.ts
    - packages/backend/src/shared/utils/dialplan-http.util.spec.ts
    - packages/frontend/src/features/dialplan-apps/model/chainLabels.ts
    - packages/frontend/src/features/dialplan-apps/ui/LabelSelect/LabelSelect.tsx
    - packages/frontend/src/features/dialplan-apps/ui/apps/LabelApp/LabelApp.tsx
    - packages/frontend/src/features/dialplan-apps/ui/apps/GotoApp/GotoApp.tsx
    - packages/frontend/src/features/dialplan-apps/ui/apps/BranchApp/BranchApp.tsx
    - packages/frontend/src/features/dialplan-apps/ui/apps/ScheduleApp/ScheduleApp.tsx
    - packages/frontend/src/features/dialplan-apps/ui/apps/HttpRequestApp/HttpRequestApp.tsx
    - packages/frontend/src/features/dialplan-apps/ui/apps/CollectInputApp/CollectInputApp.tsx
    - packages/frontend/src/features/dialplan-apps/ui/apps/NewActionTypes.test.tsx
  modified:
    - packages/shared/src/types/route.types.ts
    - packages/shared/src/types/dialplan-params.types.ts
    - packages/shared/src/types/dialplan-action-meta.ts
    - packages/backend/src/shared/utils/dialplan.util.ts
    - packages/backend/src/shared/pipes/action-params-validation.util.ts
    - packages/backend/src/modules/routes/dto/dialplan-params/control.params.dto.ts
    - packages/backend/src/modules/routes/dto/dialplan-params/integration.params.dto.ts
    - packages/frontend/src/features/dialplan-apps/model/registry.ts
    - packages/frontend/src/features/dialplan-apps/ui/DialplanAppsEditor/DialplanAppsEditor.tsx

key-decisions:
  - "label emits NoOp(name) + prefixSamePriority so GotoIf can land on n(name)"
  - "branch condition lives in params.condition to avoid double wrapEachLine"
  - "HTTP result variable is HTTP_RESULT_VAR (KRSK_HTTP_RESULT); invalid URL at emit → NoOp(Invalid HTTP URL)"
  - "t(key, fallback) — dirty locale files not staged"
  - "ActionTypesList / DIALPLAN_ACTION_META / registry now 28 types"

patterns-established:
  - "collectLabels + validateLabelRefs wired through collectHostActionErrors"
  - "ChainLabelsProvider + LabelSelect — no free-text goto/branch targets"
  - "ScheduleIntervalsEditor uses ITimeGroupInterval, not a second schedule format"

requirements-completed: [D-44, D-45, D-47, D-49]

coverage:
  - id: D1
    description: label is a named hop; goto/branch jump to existing labels; missing and duplicate labels fail save validation
    requirement: D-44
    verification:
      - kind: unit
        ref: packages/backend/src/shared/utils/dialplan-labels.util.spec.ts
        status: pass
      - kind: unit
        ref: packages/backend/src/shared/utils/dialplan.util.spec.ts#label/goto/branch
        status: pass
    human_judgment: false
  - id: D2
    description: schedule action reuses formatTimeGroupInterval and sets __KRSK_SCHEDULE via ExecIfTime
    requirement: D-45
    verification:
      - kind: unit
        ref: packages/backend/src/shared/utils/dialplan.util.spec.ts#schedule
        status: pass
    human_judgment: false
  - id: D3
    description: http_request writes KRSK_HTTP_RESULT; SSRF blocks private/localhost/metadata; timeout always present
    requirement: D-47
    verification:
      - kind: unit
        ref: packages/backend/src/shared/utils/dialplan-http.util.spec.ts
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/routes/dto/dialplan-params/dialplan-params.spec.ts#HttpRequestParamsDto
        status: pass
    human_judgment: false
  - id: D4
    description: collect_input emits Read or WaitExten+Set into the named channel variable
    requirement: D-49
    verification:
      - kind: unit
        ref: packages/backend/src/shared/utils/dialplan.util.spec.ts#collect_input
        status: pass
    human_judgment: false
  - id: D5
    description: schema-driven UI for all four types; goto/branch LabelSelect; HTTP role=alert; registry length 28
    requirement: D-44
    verification:
      - kind: automated_ui
        ref: packages/frontend/src/features/dialplan-apps/ui/apps/NewActionTypes.test.tsx
        status: pass
      - kind: automated_ui
        ref: packages/frontend/src/features/dialplan-apps/ui/UnknownActionCard/UnknownActionCard.test.tsx#keeps registry keys in sync
        status: pass
    human_judgment: false

duration: 23min
completed: 2026-08-20
status: complete
---

# Phase 12 Plan 16: New Action Types Summary

**Four schema-driven actions: named label hops (goto/branch), schedule via shared time-group intervals, HTTPS-only HTTP into `KRSK_HTTP_RESULT`, and collect-input via `Read`/`WaitExten`.**

## Performance

- **Duration:** 23 min
- **Started:** 2026-08-20T03:06:49Z
- **Completed:** 2026-08-20T03:29:27Z
- **Tasks:** 3 (all TDD RED/GREEN)
- **Files modified:** 32

## Accomplishments

- `label` is a real hop: `NoOp(name)` plus `prefixSamePriority` so `same => n(name),…`. `goto`/`branch` emit `GotoIf` to those names. Missing and duplicate labels fail in `validateLabelRefs` on save.
- `schedule` reuses `formatTimeGroupInterval` (same builder as route time groups) and sets `__KRSK_SCHEDULE` through `ExecIfTime`.
- `http_request` uses `assertSafeHttpUrl` (https; http only for `DIALPLAN_HTTP_INTERNAL_HOSTS`; no private/localhost/metadata). Result in `HTTP_RESULT_VAR` / `KRSK_HTTP_RESULT`. Timeout required on the DTO (default 5 at emit).
- `collect_input` emits `Read(var,prompt,digits,,attempts,timeout)` or `WaitExten` + `Set(var=${EXTEN})`.
- UI: `ChainLabelsProvider` + `LabelSelect` (no free-text), `ScheduleIntervalsEditor`, HTTP `role="alert"` on bad URL, collect-input schema. Completeness sets are 28 ActionTypes. D-46/D-48/D-50 types were not added.

## Task Commits

1. **Task 1 RED: labels/goto/branch/schedule tests** - `bb3f4ac` (test)
2. **Task 1 GREEN: label, goto, branch, schedule** - `3940eca` (feat)
3. **Task 2 RED: HTTP + collect-input tests** - `237f5b4` (test)
4. **Task 2 GREEN: HTTP request and collect-input** - `0874e67` (feat)
5. **Task 3 RED: UI tests for new action types** - `f9a3aa7` (test)
6. **Task 3 GREEN: UI for the four new types** - `faae09d` (feat)

**Plan metadata:** this docs commit (SUMMARY + STATE + ROADMAP)

_Note: TDD tasks have RED then GREEN commits._

## Files Created/Modified

- `packages/backend/src/shared/utils/dialplan-labels.util.ts` — `collectLabels`, `validateLabelRefs`
- `packages/backend/src/shared/utils/dialplan-http.util.ts` — `assertSafeHttpUrl`, `emitHttpRequest`
- `packages/backend/src/shared/utils/dialplan.util.ts` — emitters + exported `formatTimeGroupInterval` + `prefixSamePriority`
- `packages/backend/src/shared/pipes/action-params-validation.util.ts` — label-ref errors on host save
- `packages/backend/src/modules/routes/dto/dialplan-params/control.params.dto.ts` — Goto/Branch/Schedule DTOs
- `packages/backend/src/modules/routes/dto/dialplan-params/integration.params.dto.ts` — HttpRequest/CollectInput DTOs
- `packages/shared/src/types/route.types.ts` / `dialplan-params.types.ts` / `dialplan-action-meta.ts` — 28 ActionTypes
- `packages/frontend/src/features/dialplan-apps/model/chainLabels.ts` — label names from the current chain
- `packages/frontend/src/features/dialplan-apps/ui/LabelSelect/LabelSelect.tsx` — select-only goto/branch targets
- `packages/frontend/src/features/dialplan-apps/ui/apps/{Label,Goto,Branch,Schedule,HttpRequest,CollectInput}App/` — schema + summarize
- `packages/frontend/src/features/dialplan-apps/model/registry.ts` — wired components
- `packages/frontend/src/features/dialplan-apps/ui/DialplanAppsEditor/DialplanAppsEditor.tsx` — `ChainLabelsProvider`

## Decisions Made

- Jump target is `GotoIf(...?start)` plus priority `same => n(start),NoOp(start)`.
- Branch condition is `params.condition`, not `action.condition`, so `wrapEachLine` does not wrap twice.
- `actionToDialplan('http_request')` catches SSRF and emits `NoOp(Invalid HTTP URL)` so Wave 0 empty-params characterization does not throw; `emitHttpRequest` itself still throws.
- Locales not staged (`t(key, fallback)`), same as 12-08…12-15.
- Frontend registry stubs from Tasks 1–2 were replaced by real apps in Task 3.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] validateLabelRefs on host save**
- **Found during:** Task 1 (GREEN)
- **Issue:** Plan files listed the util; save-path wiring was required so missing/duplicate labels never reach Asterisk.
- **Fix:** `collectLabelChains` + `validateLabelRefs` inside `collectHostActionErrors`.
- **Files modified:** `action-params-validation.util.ts`
- **Verification:** label util + DTO/generator tests
- **Committed in:** `3940eca`

**2. [Rule 2 - Missing Critical] prefixSamePriority on IVR / voice-robot / route emitters**
- **Found during:** Task 1 (GREEN)
- **Issue:** Named hops only work if every host uses the same priority prefix.
- **Fix:** Call sites updated to `prefixSamePriority`.
- **Files modified:** `routes.service.ts`, `ivrs.service.ts`, `voice-robots.service.ts`
- **Verification:** generator tests
- **Committed in:** `3940eca`

**3. [Rule 3 - Blocking] formatTimeGroupInterval extracted and reused**
- **Found during:** Task 1 (GREEN)
- **Issue:** D-45 forbids a second schedule format; time-groups/routes already built the expression inline.
- **Fix:** Exported `formatTimeGroupInterval` from `dialplan.util.ts`; time-groups and routes import it.
- **Files modified:** `dialplan.util.ts`, `time-groups.service.ts`, `routes.service.ts`
- **Verification:** grep/shared builder + schedule tests
- **Committed in:** `3940eca`

**4. [Rule 1 - Bug] Completeness test length 23 → 28**
- **Found during:** Task 3 (GREEN)
- **Issue:** `UnknownActionCard` still asserted 23 meta keys after five new types.
- **Fix:** Length updated to 28.
- **Files modified:** `UnknownActionCard.test.tsx`
- **Verification:** vitest dialplan-apps NewActionTypes + UnknownActionCard (14 passed)
- **Committed in:** `faae09d`

**5. [Rule 1 - Bug] i18next t() optional fallback on new apps**
- **Found during:** Task 3 (GREEN)
- **Issue:** `(key, fallback) => t(key, fallback)` fails `tsc` when fallback is `string | undefined`.
- **Fix:** `(key, fallback = '') => t(key, fallback)` on the five new apps.
- **Files modified:** Label/Goto/Branch/HttpRequest/CollectInput App
- **Verification:** typecheck of those files; remaining `tsc` failures are pre-existing WIP (callcenter, users, GenericApp)
- **Committed in:** `faae09d`

---

**Total deviations:** 5 auto-fixed (2 missing critical, 1 blocking, 2 bugs)
**Impact on plan:** Correctness/security wiring only. Locales still skipped. D-46/D-48/D-50 not started.

## Issues Encountered

- `npx vitest --config packages/frontend/vitest.config.ts` is wrong; run `npm run test` from `packages/frontend`.
- Full `tsc --noEmit -p packages/frontend/tsconfig.json` is dirty from unrelated WIP (callcenter, users, ProfilePage). New 12-16 files are not in that set after the t() wrap fix.
- Backend jest via `npm run test -w @krasterisk/backend -- --testPathPattern=...` can be swallowed by npm 11; prefer `npx jest` from `packages/backend`. Out-of-scope failures (callcenter history/chat, voice-robots golden) were not fixed.

## User Setup Required

None - no external service configuration required. Optional: set `DIALPLAN_HTTP_INTERNAL_HOSTS` if HTTP over plain http to an allowlisted internal host is needed.

## Next Phase Readiness

- 12-17 is the final gate of phase 12 (UAT of the schema-driven editor including these four types).
- Live confirm of label hops, schedule, HTTP, and collect-input on a real Asterisk is for 12-17, not this plan.

---
*Phase: 12-dialplan-apps-editor-refactor-reusable-route-chain-builder*
*Completed: 2026-08-20*

## Self-Check: PASSED
