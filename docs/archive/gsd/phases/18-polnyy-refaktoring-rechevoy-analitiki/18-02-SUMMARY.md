---
phase: 18-polnyy-refaktoring-rechevoy-analitiki
plan: 02
subsystem: speech-analytics
tags: [speech-analytics, routes, capture-policy, dialplan, vitest, jest, i18n]

requires:
  - phase: 18-polnyy-refaktoring-rechevoy-analitiki
    provides: charge spine and SA-CHARGE seams from 18-01
provides:
  - RouteGeneralTab recording-gated analytics project Select (D-01, D-02, D-22)
  - resolveCapturePolicy project-only admission with pauseNew (D-19…D-21)
  - hangup_handler_push when analyticsProjectId set in recordingDialplanLines
affects:
  - 18-03 hangup notify / STT enqueue
  - reporting.service resolveRoute callers still passing legacy mode fields

actuals:
  tokens: 9500
  tasks: 2
  commits: 5

plan_head_before: 33b968aa7683b4bbce4b6363963b431e75401686

tech-stack:
  added: []
  patterns:
    - "Route analytics: Select of tenant projects gated by module active + recording on"
    - "Capture policy: route projectId only; pauseNew blocks new autos; no company default"
    - "Dialplan: hangup_handler when analyticsProjectId set even without user webhook"

key-files:
  created:
    - packages/frontend/src/features/routes/ui/RouteFormModal/RouteGeneralTab.test.tsx
    - packages/backend/src/modules/speech-analytics/reporting/capture-policy.spec.ts
  modified:
    - packages/frontend/src/features/routes/ui/RouteFormModal/RouteGeneralTab.tsx
    - packages/frontend/src/features/routes/ui/RouteFormModal/RouteFormModal.module.scss
    - packages/frontend/src/shared/config/locales/ru.ts
    - packages/frontend/src/shared/config/locales/en.ts
    - packages/backend/src/modules/speech-analytics/reporting/capture-policy.ts
    - packages/backend/src/modules/routes/route-recording.util.ts
    - packages/backend/src/modules/routes/route-recording.util.spec.ts
    - packages/shared/src/types/speech-analytics.types.ts

key-decisions:
  - "RouteGeneralTab keeps deprecated analyticsMode props for RouteFormModal compatibility; UI ignores them"
  - "Module/projects resolved via props overrides in tests and useHubModules + useGetSaProjectsQuery in production"
  - "Foreign/saved projectId not in tenant list is omitted from options (selectValue blank) without clearing stored id"
  - "Legacy CaptureResolveInput fields remain optional and ignored so reporting.service keeps compiling"

patterns-established:
  - "speechAnalytics.routeProject* i18n keys match UI-SPEC Copywriting Contract (no U+2014)"
  - "analyticsProjectId on RecordingDialplanInput drives hangup_handler independently of hangupWebhook"

requirements-completed: [REQ-SA-ARCH, REQ-SA-PARITY]

coverage:
  - id: D1
    description: "Route form shows Analytics project Select when module active and recording on; hidden when recording off or module inactive without clearing projectId"
    requirement: REQ-SA-ARCH
    verification:
      - kind: unit
        ref: "packages/frontend/src/features/routes/ui/RouteFormModal/RouteGeneralTab.test.tsx#renders Analytics project Select when module is active and recording is on"
        status: pass
    human_judgment: false
  - id: D2
    description: "resolveCapturePolicy requires route projectId; pauseNew blocks new autos; no company default fallback"
    requirement: REQ-SA-PARITY
    verification:
      - kind: unit
        ref: "packages/backend/src/modules/speech-analytics/reporting/capture-policy.spec.ts#does not fall back to a company default project when route projectId is absent"
        status: pass
    human_judgment: false
  - id: D3
    description: "recordingDialplanLines pushes hangup_handler when analyticsProjectId set without hangup webhook; no STT in dialplan lines"
    requirement: REQ-SA-PARITY
    verification:
      - kind: unit
        ref: "packages/backend/src/modules/routes/route-recording.util.spec.ts#pushes hangup_handler when analytics projectId is set even without hangup webhook"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-09-22
status: complete
---

# Phase 18 Plan 02: Route project Select + capture policy Summary

**Recording-gated Analytics project Select on RouteGeneralTab, project-only capture policy with pauseNew, and hangup_handler when analyticsProjectId is set**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-09-22T12:26:00Z
- **Completed:** 2026-09-22T12:45:00Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Replaced inherit/off/on analytics mode UI with a tenant project Select gated by module active + recording on (D-01, D-02, D-22)
- Added ru/en Copywriting Contract strings for route project label, hint, and placeholder (no U+2014)
- Rewrote `resolveCapturePolicy` so auto admission needs entitled module, recording, and concrete route `projectId`; `pauseNew` only blocks new autos
- Extended `recordingDialplanLines` to push `hangup_handler` when `analyticsProjectId` is set even without a user webhook

## Task Commits

Each task was committed atomically (TDD RED then GREEN):

1. **Task 1 RED: RouteGeneralTab Select tests** - `985143c2` (test)
2. **Task 1 GREEN: project Select + i18n** - `ac06db4b` (feat)
3. **Task 2 RED: capture-policy + hangup_handler tests** - `8de46078` (test)
4. **Task 2 GREEN: policy + dialplan** - `89ac8b83` (feat)
5. **Fix: strip unrelated locale dirt** - `53668733` (fix)

**Plan metadata:** (this SUMMARY commit)

## TDD Gate Compliance

| Task | RED evidence | Verdict | GREEN verify |
|------|--------------|---------|--------------|
| 1 | `.planning/.../tdd/route-general-tab-red-evidence.json` | RED_EVIDENCE_OK | 3/3 Vitest passed |
| 2 | `.planning/.../tdd/capture-policy-red-evidence.json` | RED_EVIDENCE_OK | 16/16 Jest passed |

## Files Created/Modified

- `RouteGeneralTab.tsx` - project Select; hides when recording/module off; does not clear stored projectId
- `RouteGeneralTab.test.tsx` - three visibility cases (D-01, D-02)
- `RouteFormModal.module.scss` - analytics Select overflow styles (`var(--color-*)`)
- `ru.ts` / `en.ts` - `speechAnalytics.routeProject*` + error/retry keys
- `capture-policy.ts` / `.spec.ts` - project-only + pauseNew rules
- `route-recording.util.ts` / `.spec.ts` - hangup_handler when analytics project set
- `speech-analytics.types.ts` - `RouteAnalyticsOptions.projectId` nullable; mode deprecated

## Decisions Made

- Kept deprecated `analyticsMode` props on RouteGeneralTab so RouteFormModal did not need a wiring commit
- Production module/projects come from hub catalog + `getSaProjects`; tests inject overrides
- Optional legacy capture-policy fields ignored rather than deleting reporting.service callers in this plan

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added SCSS for analytics Select overflow**
- **Found during:** Task 1 GREEN
- **Issue:** UI-SPEC requires long project names not to stretch the tab; styles needed a feature SCSS module class
- **Fix:** Added `.analyticsProjectField` / `.analyticsProjectSelect` to existing `RouteFormModal.module.scss`
- **Files modified:** `RouteFormModal.module.scss`
- **Verification:** Vitest RouteGeneralTab suite green
- **Committed in:** `ac06db4b`

**2. [Rule 1 - Bug] Unrelated dirty locale hunks staged with route project i18n**
- **Found during:** SUMMARY / self-check of `ac06db4b`
- **Issue:** Working-tree dirt in `en.ts`/`ru.ts` was committed with the speechAnalytics keys
- **Fix:** Restored locales from plan base `33b968aa` and re-applied only route project Copywriting Contract keys
- **Files modified:** `packages/frontend/src/shared/config/locales/en.ts`, `ru.ts`
- **Verification:** Diff vs base shows only speechAnalytics route keys
- **Committed in:** `53668733`

---

**Total deviations:** 2 auto-fixed (1 missing critical UI, 1 dirty-tree staging)
**Impact on plan:** Required for correctness of i18n commits; no product scope creep

## Issues Encountered

- `gsd-tools check tdd-red-evidence` requires TAP `# tests` / `not ok` in the `output` field (Vitest verbose alone is INVALID_RED)
- `reporting-engine.spec.ts` still asserts legacy inherit/default_off behavior; left out of this plan's file set (deferred for follow-up)
- `routes.service` does not yet pass `analyticsProjectId` into `recordingDialplanLines` (util ready; wiring expected with hangup notify in 18-03)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Route UI and capture policy enforce project-only auto analysis
- Dialplan util ready for hangup notify when callers pass `analyticsProjectId`
- Follow-ups: wire `routes.service` analyticsProjectId; update `reporting-engine.spec` / `resolveRoute` to stop using default project

## Self-Check: PASSED

- FOUND: RouteGeneralTab.tsx, RouteGeneralTab.test.tsx, capture-policy.ts, capture-policy.spec.ts, route-recording.util.ts, route-recording.util.spec.ts, speech-analytics.types.ts, ru.ts, en.ts
- FOUND commits: 985143c2, ac06db4b, 8de46078, 89ac8b83, 53668733

---
*Phase: 18-polnyy-refaktoring-rechevoy-analitiki*
*Completed: 2026-09-22*
