---
phase: 18-polnyy-refaktoring-rechevoy-analitiki
plan: 09
subsystem: ai-chat
tags: [routes-ai, speech-analytics, confirm-card, dialplan-reload, D-04]
requires:
  - phase: 18-02
    provides: Route analytics projectId Select and options.analytics.projectId persistence
  - phase: 18-06
    provides: Project editor APIs for tenant projects
provides:
  - routes-ai list/set/clear analytics project tools with recording gate
  - DiffConfirmCard busy / recording-off / missing-project UX for set proposals
affects:
  - 18-15
  - speech-analytics chat skill
actuals:
  tokens: 11653
  tasks: 2
  commits: 4
plan_head_before: 43ee5c6c0949b0cfde987a22686fce377a26023c
tech-stack:
  added: []
  patterns:
    - "routes-ai analytics mutations via defineMutationTool + includesDialplanReload"
    - "DiffConfirmCard reads after.action=set_analytics_project for client-side gates"
key-files:
  created:
    - .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/tdd/18-09-t1-red-evidence.json
    - .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/tdd/18-09-t2-red-evidence.json
  modified:
    - packages/backend/src/modules/routes/routes-ai.adapter.ts
    - packages/backend/src/modules/routes/routes-ai.adapter.spec.ts
    - packages/backend/src/modules/routes/routes.module.ts
    - packages/frontend/src/features/ai-chat/ui/DiffConfirmCard/DiffConfirmCard.tsx
    - packages/frontend/src/features/ai-chat/ui/DiffConfirmCard/DiffConfirmCard.module.scss
    - packages/frontend/src/features/ai-chat/ui/DiffConfirmCard/DiffConfirmCard.test.tsx
key-decisions:
  - "Register SaProject on RoutesModule forFeature instead of importing SpeechAnalyticsModule (cycle avoidance)"
  - "Recording-off refuses at propose time (no card); DiffConfirmCard still gates recordingEnabled=false for defense-in-depth"
  - "Persist options.analytics.projectId only; do not revive inherit/off/on selection"
requirements-completed: [REQ-SA-PARITY, REQ-SA-ARCH]
coverage:
  - id: D1
    description: Chat route tools list/set/clear analytics project; set refuses when recording off; confirm reloads dialplan; tenant uid from JWT only
    requirement: REQ-SA-PARITY
    verification:
      - kind: unit
        ref: packages/backend/src/modules/routes/routes-ai.adapter.spec.ts#refuses to set analytics project when recording is off and does not propose
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/routes/routes-ai.adapter.spec.ts#proposes set analytics project with dialplan reload when recording is on
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/routes/routes-ai.adapter.spec.ts#applies set using dispatch tenant uid and ignores forged tenant args
        status: pass
    human_judgment: false
  - id: D2
    description: DiffConfirmCard blocks missing project and recording-off, ignores double confirm while busy, wraps long project names
    requirement: REQ-SA-PARITY
    verification:
      - kind: unit
        ref: packages/frontend/src/features/ai-chat/ui/DiffConfirmCard/DiffConfirmCard.test.tsx#shows recording-off refusal copy and blocks confirm for set analytics proposals
        status: pass
      - kind: unit
        ref: packages/frontend/src/features/ai-chat/ui/DiffConfirmCard/DiffConfirmCard.test.tsx#blocks confirm when the set-analytics card has no project selected
        status: pass
      - kind: unit
        ref: packages/frontend/src/features/ai-chat/ui/DiffConfirmCard/DiffConfirmCard.test.tsx#ignores a second confirm click while the first request is still in flight
        status: pass
    human_judgment: false
duration: 25min
completed: 2026-09-22
status: complete
---

# Phase 18 Plan 09: Route analytics chat tools Summary

**Routes AI chat can list/set/clear a route analytics project through Phase 15 confirm cards, with a recording-off refusal and dialplan reload on confirm (D-04).**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2/2
- **Commits:** 4 (measured from `plan_head_before`)

## Accomplishments

- Added `list_route_analytics_projects`, `set_route_analytics_project`, and `clear_route_analytics_project` on the existing routes adapter (no new chat domain)
- Set tool refuses while recording is off; successful set/clear proposals set `includesDialplanReload: true` and persist `options.analytics.projectId`
- DiffConfirmCard enforces busy in-flight lock, missing-project and recording-off copy, and wraps long project names (S10)

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 RED | Failing routes-ai analytics specs | c1d6c1e1 | `routes-ai.adapter.spec.ts`, tdd evidence |
| 1 GREEN | Analytics project tools | ea1eb3d3 | `routes-ai.adapter.ts`, `routes.module.ts` |
| 2 RED | DiffConfirmCard UX specs | 3856e5ac | `DiffConfirmCard.test.tsx`, tdd evidence |
| 2 GREEN | Confirm-card gates + wrap | 99f98f73 | `DiffConfirmCard.tsx`, `.module.scss`, test tweak |

## TDD Gate Compliance

- Task 1: RED evidence `18-09-t1-red-evidence.json` → `RED_EVIDENCE_OK` (recording-off tool undefined) then GREEN
- Task 2: RED evidence `18-09-t2-red-evidence.json` → `RED_EVIDENCE_OK` (recording-off copy missing) then GREEN

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Registered `SaProject` on RoutesModule**
- **Found during:** Task 1 GREEN
- **Issue:** Adapter needs tenant project lookup; importing `SpeechAnalyticsModule` would deepen the existing Routes↔SA cycle
- **Fix:** `SequelizeModule.forFeature([..., SaProject])` in `routes.module.ts` and `@InjectModel(SaProject)`
- **Files modified:** `routes.module.ts`, `routes-ai.adapter.ts`
- **Commit:** ea1eb3d3

## Verify Results

- `npm run test -w @krasterisk/backend -- --testPathPattern="routes-ai.adapter" --no-coverage` → 19 passed
- Direct vitest on `DiffConfirmCard.test.tsx` → 20 passed (busy, recording-off, missing-project covered)

## Known Stubs

None.

## Threat Flags

None beyond plan mitigations (T-18-09-TENANT covered by strict zod + `TENANT_ARG_FORBIDDEN`).

## Self-Check: PASSED

- FOUND: `packages/backend/src/modules/routes/routes-ai.adapter.ts`
- FOUND: `packages/frontend/src/features/ai-chat/ui/DiffConfirmCard/DiffConfirmCard.tsx`
- FOUND commits: c1d6c1e1, ea1eb3d3, 3856e5ac, 99f98f73
