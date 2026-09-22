---
phase: 18-polnyy-refaktoring-rechevoy-analitiki
plan: 06
subsystem: speech-analytics
tags: [speech-analytics, project-editor, draft-publish, budget, webhooks, tdd, jest]

requires:
  - phase: 18-polnyy-refaktoring-rechevoy-analitiki
    provides: Journal JWT APIs and SA charge run amounts (18-05, 18-11, 18-01)
provides:
  - Expanded SaProjectConfig with aiPBX editor sections (D-25)
  - Draft/publish version stamp rules and publisher RBAC (D-26, D-27)
  - Soft budget calculator, Integrations-linked digest/alerts validation, event webhooks, delete project (D-28…D-31)
affects:
  - 18-12 MetricEditor UI
  - 18-15 model override settings UI
  - 18-08 (not started by this plan)

actuals:
  tokens: 17561
  tasks: 2
  commits: 4

plan_head_before: e0094fbc71ee95eea02350141a94cd9ef2aa2152

tech-stack:
  added: []
  patterns:
    - "Draft save never mutates published run config; publish bumps version_no only for metrics/topics/prompt/hiddenDefaultScales"
    - "Digest/alert recipients are notification_integrations uids scoped to JWT tenant"
    - "SA event delivery reuses WebhookQueueService; Test button uses real HTTP"

key-files:
  created:
    - packages/backend/src/modules/speech-analytics/projects/project-editor.service.ts
    - packages/backend/src/modules/speech-analytics/projects/project-editor.service.spec.ts
    - packages/backend/src/modules/speech-analytics/projects/budget.ts
    - packages/backend/src/modules/speech-analytics/projects/budget.spec.ts
    - packages/backend/src/modules/speech-analytics/projects/event-webhooks.ts
    - packages/backend/src/modules/speech-analytics/projects/event-webhooks.spec.ts
  modified:
    - packages/shared/src/types/speech-analytics.types.ts
    - packages/backend/src/modules/speech-analytics/speech-analytics.service.ts
    - packages/backend/src/modules/speech-analytics/speech-analytics-jwt.controller.ts
    - packages/backend/src/modules/speech-analytics/speech-analytics.module.ts

key-decisions:
  - "Non-stamp publish updates the active SaProjectVersion config in place instead of inventing a parallel stamp"
  - "Delete archives the project row, keeps recordings/runs, clears route analytics.projectId, revokes project tokens, never refunds"
  - "Model override fields accepted only for SUPERADMIN until tenant right lands in 18-15; existing overrides are preserved"

patterns-established:
  - "Project editor domain helpers live under speech-analytics/projects/* and are unit-tested without Nest DI"
  - "JWT project delete/webhook-test/budget-evaluate sit beside journal routes on speech-analytics-jwt.controller"

requirements-completed: [REQ-SA-PARITY]

coverage:
  - id: D1
    description: "Draft/publish stamp rules and publisher RBAC (D-25…D-27)"
    requirement: REQ-SA-PARITY
    verification:
      - kind: unit
        ref: "packages/backend/src/modules/speech-analytics/projects/project-editor.service.spec.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Soft budget sums SA-CHARGE-RUN only; zero = no limit; never stops analyses (D-28)"
    requirement: REQ-SA-PARITY
    verification:
      - kind: unit
        ref: "packages/backend/src/modules/speech-analytics/projects/budget.spec.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Integrations tenant check, webhook enqueue/test, delete effects (D-29…D-31)"
    requirement: REQ-SA-PARITY
    verification:
      - kind: unit
        ref: "packages/backend/src/modules/speech-analytics/projects/event-webhooks.spec.ts"
        status: pass
    human_judgment: false

duration: 55min
completed: 2026-09-22
status: complete
---

# Phase 18 Plan 06: Project Editor Backend Summary

**aiPBX-parity project editor backend with draft/publish stamp rules, soft budget, Integrations-linked alerts, event webhooks, and safe delete — UI deferred to 18-12.**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-09-22T13:46:00Z
- **Completed:** 2026-09-22T14:45:00Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Expanded `SaProjectConfigV1` with industry templates, custom metrics, hideable scales, prompt, topics, webhook, digest, alerts, and soft budget.
- Locked draft-then-publish semantics: published run config unchanged by draft; stamp grows only for metrics/topics/prompt/visible scales; no old-version reactivation.
- Soft budget + webhook helpers and JWT endpoints for delete, webhook test, and budget evaluate; journal/export paths left intact.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: draft/publish stamp tests** - `760a08c9` (test)
2. **Task 1 GREEN: draft/publish implementation** - `ddbf9291` (feat)
3. **Task 2 RED: budget/webhook/delete tests** - `4496f56b` (test)
4. **Task 2 GREEN: budget, webhooks, delete + JWT wiring** - `4e6cb296` (feat)

**Plan metadata:** (this SUMMARY commit)

## TDD Gate Compliance

| Task | RED commit | GREEN commit | RED evidence |
|------|------------|--------------|--------------|
| 1 draft/publish | `760a08c9` | `ddbf9291` | `tdd/project-editor-t1-red-evidence.json` → RED_EVIDENCE_OK |
| 2 budget/webhooks/delete | `4496f56b` | `4e6cb296` | `tdd/project-editor-t2-red-evidence.json` → RED_EVIDENCE_OK |

## Files Created/Modified

- `packages/shared/src/types/speech-analytics.types.ts` — editor section types + defaults
- `packages/backend/src/modules/speech-analytics/projects/project-editor.service.ts` — stamp/RBAC helpers + Nest provider
- `packages/backend/src/modules/speech-analytics/projects/budget.ts` — SA-CHARGE-RUN soft limit
- `packages/backend/src/modules/speech-analytics/projects/event-webhooks.ts` — enqueue/test/integrations/delete plan
- `packages/backend/src/modules/speech-analytics/speech-analytics.service.ts` — publish stamp, delete, webhook test, budget evaluate
- `packages/backend/src/modules/speech-analytics/speech-analytics-jwt.controller.ts` — project delete / webhook test / budget evaluate
- `packages/backend/src/modules/speech-analytics/speech-analytics.module.ts` — ProjectEditorService + Routes/Notification wiring

## Decisions Made

- Non-stamp publish mutates the active version row in place so version_no stays stable for historical conversation stamps.
- Model override writes are SUPERADMIN-only until the tenant right from D-38/18-15 exists; existing overrides are never cleared.
- Delete archives the project instead of hard-deleting so recording FKs and metric-set stamps remain.

## Deviations from Plan

None - plan executed exactly as written.

## Threat Flags

None beyond plan mitigations (headers stay server-side; foreign integration uids rejected).

## Verify Results

```
npm run test -w @krasterisk/backend -- --testPathPattern="project-editor|budget|event-webhooks" --no-coverage
→ Test Suites: 3 passed; Tests: 12 passed
```

## Self-Check: PASSED

- FOUND: packages/backend/src/modules/speech-analytics/projects/project-editor.service.ts
- FOUND: packages/backend/src/modules/speech-analytics/projects/budget.ts
- FOUND: packages/backend/src/modules/speech-analytics/projects/event-webhooks.ts
- FOUND: 760a08c9, ddbf9291, 4496f56b, 4e6cb296
