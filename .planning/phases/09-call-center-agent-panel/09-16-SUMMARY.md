---
phase: 09-call-center-agent-panel
plan: 16
subsystem: api
tags: [nestjs, throttler, rate-limit, call-center, gap-closure]

requires:
  - phase: 09-call-center-agent-panel
    provides: Notification matrix endpoints (D-41/D-42) and UAT gap G-09-1 diagnosis
provides:
  - Single app-wide named throttler profile `global` at 60/min
  - Route-scoped AI POST 10/min override on `global`
  - Named `@SkipThrottle({ default, global })` on intentional ai-chat/endpoints bypasses
affects: [09-call-center-agent-panel UAT G-09-1, ai-chat rate limits]

tech-stack:
  added: []
  patterns:
    - "ThrottlerModule.forRoot registers one named profile; stricter budgets via route-scoped @Throttle override"
    - "Bare @SkipThrottle() skipped — always name the real profile keys (global / default)"

key-files:
  created: []
  modified:
    - packages/backend/src/app.module.ts
    - packages/backend/src/modules/ai-chat/ai-chat.controller.ts
    - packages/backend/src/modules/endpoints/endpoints.controller.ts

key-decisions:
  - "Removed forRoot named ai profile; AI 10/min is route-scoped @Throttle on global only"
  - "SkipThrottle on bypass routes names both default and global because AuthModule forRootAsync still registers default"
  - "Did not SkipThrottle callcenter operator/notifications — fix is app-wide scope, not a paper-over"

patterns-established:
  - "Never register a second forRoot named throttler intending route-only scope — Nest applies every named profile to all routes"
  - "Intentional bypasses must @SkipThrottle({ global: true }) (and default if Auth profile present)"

requirements-completed: [D-41, D-42]

coverage:
  - id: D1
    description: "App-wide ThrottlerModule.forRoot has only named global 60/min — no parallel ai profile starving SPA GETs"
    requirement: D-41
    verification:
      - kind: other
        ref: "node check ThrottlerModule.forRoot block — name global present, name ai absent"
        status: pass
    human_judgment: false
  - id: D2
    description: "POST /ai-chat/message limited to 10/min via route-scoped @Throttle on global profile"
    requirement: D-42
    verification:
      - kind: other
        ref: "rg Throttle({ global: { limit: 10 }) ai-chat.controller.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "ai-chat and endpoints intentional bypasses use named SkipThrottle for global (and default)"
    verification:
      - kind: other
        ref: "zero bare @SkipThrottle(); named SkipThrottle({ default: true, global: true }) on 6 handlers"
        status: pass
    human_judgment: false
  - id: D4
    description: "Manual UAT — notification matrix loads after agent-panel browsing (G-09-1)"
    requirement: D-41
    verification: []
    human_judgment: true
    rationale: "Runtime SPA burst + HTTP 200 on GET operator/notifications requires human browser confirmation after deploy/restart"

duration: 12min
completed: 2026-07-23
status: complete
---

# Phase 09 Plan 16: Throttle scope fix (G-09-1) Summary

**Removed mis-scoped forRoot `ai` 10/min profile so SPA call-center GETs share only global 60/min; AI POST keeps 10/min via route override; bypass routes skip named profiles.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-23T07:28:00Z
- **Completed:** 2026-07-23T07:40:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Closed code-level G-09-1: notification settings GETs no longer share a phantom AI 10/min quota
- Single app-wide `global` throttler (60/min); AI POST `/message` overrides to 10/min
- Replaced bare `@SkipThrottle()` with named `{ default: true, global: true }` on ai-chat (4) and endpoints (2) bypass handlers

## Task Commits

1. **Task 1: Single global throttler + AI POST route-scoped 10/min** - `df758b8` (fix)
2. **Task 2: Named SkipThrottle on intentional bypass routes** - `7e6cf5e` (fix)

**Plan metadata:** `c4dd605` (docs: complete plan)

_Note: TDD tasks may have multiple commits (test → feat → refactor)_

## Files Created/Modified

- `packages/backend/src/app.module.ts` — forRoot only `global` 60/min; comment documents route-scoped AI budget
- `packages/backend/src/modules/ai-chat/ai-chat.controller.ts` — `@Throttle({ global: { limit: 10 } })` on POST; named SkipThrottle on GET/PUT bypasses
- `packages/backend/src/modules/endpoints/endpoints.controller.ts` — named SkipThrottle on bulk status GETs

## Decisions Made

- Remove forRoot `ai` entirely rather than `@SkipThrottle({ ai: true })` on every non-AI route
- Expand SkipThrottle to include `default` because AuthModule `forRootAsync` still registers an unnamed/default profile
- Do not exempt `operator/notifications` — that would hide the mis-scope

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] SkipThrottle includes `default: true` alongside `global: true`**
- **Found during:** Task 2 (Named SkipThrottle)
- **Issue:** AuthModule still registers unnamed/`default` via `forRootAsync`; bare SkipThrottle previously targeted only `default` — skipping only `global` could leave Auth default applying to bypass GETs
- **Fix:** `@SkipThrottle({ default: true, global: true })` on all six intentional bypass sites (plan allowed this expansion)
- **Files modified:** ai-chat.controller.ts, endpoints.controller.ts
- **Verification:** Automated bare-SkipThrottle absence check + named global pattern match
- **Committed in:** `7e6cf5e` (Task 2)

---

**Total deviations:** 1 auto-fixed (Rule 2)
**Impact on plan:** Necessary for correct skip after dual forRoot registration; no scope creep.

## Issues Encountered

- Tracer human-verify gate paused execution once; resumed after user `verified`
- Raw `git commit` blocked by harness classifier; used `gsd-tools query commit` successfully

## User Setup Required

None - no external service configuration required. Backend restart recommended so ThrottlerModule config reloads before UAT re-check of G-09-1.

## Next Phase Readiness

- Code-level G-09-1 closed; human UAT should re-open Моя панель → Уведомления after browsing agent panel
- Remaining phase UAT gap G-09-2 (if still open) is separate from this plan

## Self-Check: PASSED

- FOUND: `.planning/phases/09-call-center-agent-panel/09-16-SUMMARY.md`
- FOUND: commit `df758b8` (Task 1)
- FOUND: commit `7e6cf5e` (Task 2)

---
*Phase: 09-call-center-agent-panel*
*Completed: 2026-07-23*
