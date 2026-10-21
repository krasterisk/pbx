---
phase: 18-polnyy-refaktoring-rechevoy-analitiki
plan: 15
subsystem: speech-analytics
tags: [module-settings, optimistic-switch, ai-adapter, skill, D-19, D-27, D-33, D-38]
requires:
  - phase: 18-05
    provides: speechAnalyticsApi RTK base and capture-policy mutations
  - phase: 18-06
    provides: project editor stampChanged / publish when metrics change
  - phase: 18-09
    provides: DiffConfirmCard confirm UX for chat mutations
  - phase: 18-13
    provides: locale keys pauseCompanyLabel / modelsAdminOnlyHint / chatConfirm*
provides:
  - ModuleSettings optimistic pause Switch + D-38 model select gating
  - module-settings.service canEditModels / pause + model defaults
  - SpeechAnalyticsAiAdapter + skills/speech-analytics/SKILL.md (pause, edit project, issue token)
affects:
  - 18-10
  - speech-analytics Nest module wiring of adapter providers
actuals:
  tokens: 46400
  tasks: 2
  commits: 4
plan_head_before: 6fadb1d453dad8fd24065f53fad58b6914e1342d
tech-stack:
  added: []
  patterns:
    - "Optimistic pause via local Switch state + RTK onQueryStarted undo"
    - "D-38 canEditModels(SUPERADMIN always, ADMIN+right, SUPERVISOR never)"
    - "Token secret in apply result only; toChatHistoryProposal redacts (D-33)"
key-files:
  created:
    - packages/backend/src/modules/speech-analytics/module-settings.service.ts
    - packages/backend/src/modules/speech-analytics/module-settings.service.spec.ts
    - packages/backend/src/modules/speech-analytics/speech-analytics-ai.adapter.ts
    - packages/backend/src/modules/speech-analytics/speech-analytics-ai.adapter.spec.ts
    - packages/backend/src/skills/speech-analytics/SKILL.md
    - packages/frontend/src/features/speechAnalytics/ui/ModuleSettings/ModuleSettings.tsx
    - packages/frontend/src/features/speechAnalytics/ui/ModuleSettings/ModuleSettings.test.tsx
    - packages/frontend/src/features/speechAnalytics/ui/ModuleSettings/ModuleSettings.module.scss
    - .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/tdd/18-15-t1-red-evidence.json
    - .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/tdd/18-15-t1-frontend-red-evidence.json
    - .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/tdd/18-15-t2-red-evidence.json
  modified:
    - packages/frontend/src/features/speechAnalytics/api/speechAnalyticsApi.ts
key-decisions:
  - "Module settings store is in-memory on ModuleSettingsService for unit tests; Nest HTTP endpoints remain for a later wiring slice"
  - "Adapter depends on SaAiProjectsPort / SaAiTokensPort ports so tests mock without owning speech-analytics.module.ts"
  - "Locale keys consumed via t() defaults from 18-13; no locale file edits"
requirements-completed: [REQ-SA-PARITY, REQ-SA-ARCH]
coverage:
  - id: D1
    description: Optimistic pause Switch rolls back on failure and shows error; model selects gated by D-38
    requirement: REQ-SA-ARCH
    verification:
      - kind: unit
        ref: packages/backend/src/modules/speech-analytics/module-settings.service.spec.ts#allows SUPERADMIN always; SUPERVISOR never; ADMIN only with tenant right
        status: pass
      - kind: unit
        ref: packages/frontend/src/features/speechAnalytics/ui/ModuleSettings/ModuleSettings.test.tsx#optimistic pause Switch rolls back on failure and shows error text
        status: pass
    human_judgment: false
  - id: D2
    description: Module AI adapter + skill; token secret omitted from chat history; project edit publishes when metrics change
    requirement: REQ-SA-PARITY
    verification:
      - kind: unit
        ref: packages/backend/src/modules/speech-analytics/speech-analytics-ai.adapter.spec.ts#issues a token with secret only in apply result; proposal and chat history omit the secret (D-33)
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/speech-analytics/speech-analytics-ai.adapter.spec.ts#publishes project edit when metrics change and uses dispatch tenant uid only (D-27, T-18-15-TENANT)
        status: pass
    human_judgment: false
duration: 55min
completed: 2026-09-22
status: complete
---

# Phase 18 Plan 15: Module settings + AI adapter Summary

**ModuleSettings ships an optimistic pause Switch with D-38 model rights, and SpeechAnalyticsAiAdapter pairs with a repo skill for pause / project edit / one-time token secret (D-19, D-27, D-33, D-38).**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-09-22T15:54:00Z
- **Completed:** 2026-09-22T16:05:00Z
- **Tasks:** 2
- **Files modified:** 11 owned + tdd evidence

## Accomplishments

- Optimistic pause Switch: local flip + rollback + error text; RTK `setSaCapturePolicy` / `getSaModuleSettings` also undo on failure
- D-38 model gating: SUPERADMIN always; ADMIN only with tenant right; SUPERVISOR never; empty allowlist hides selects; right-off keeps existing defaults
- AI adapter + `skills/speech-analytics/SKILL.md`: pause, edit project (publish when metrics change), issue token (secret only in apply; `toChatHistoryProposal` redacts)

## TDD Gate Compliance

| Task | RED commit | GREEN commit | RED evidence |
|------|------------|--------------|--------------|
| 1 ModuleSettings / module-settings | `c5d4bc83` | `b401fb0a` | `tdd/18-15-t1-red-evidence.json` + `tdd/18-15-t1-frontend-red-evidence.json` → RED_EVIDENCE_OK |
| 2 AI adapter + skill | `5840d061` | `8314dfc6` | `tdd/18-15-t2-red-evidence.json` → RED_EVIDENCE_OK |

## Task Commits

1. **Task 1 RED** - `c5d4bc83` (test)
2. **Task 1 GREEN** - `b401fb0a` (feat)
3. **Task 2 RED** - `5840d061` (test)
4. **Task 2 GREEN** - `8314dfc6` (feat)

## Files Created/Modified

- `module-settings.service.ts` — canEditModels, pause + model defaults, visibility helpers
- `ModuleSettings.tsx` + SCSS — pause Switch, gated Selects, long-name wrap
- `speechAnalyticsApi.ts` — getSaModuleSettings / setSaModuleModels; capture-policy optimistic undo also patches module settings cache
- `speech-analytics-ai.adapter.ts` — pause / edit / issue-token proposing tools
- `skills/speech-analytics/SKILL.md` — module skill (insights skill untouched)

## Decisions Made

- In-memory ModuleSettingsService for testable D-38 rights without a new migration in this plan's owned files
- Adapter ports (`SaAiProjectsPort`, `SaAiTokensPort`) avoid editing `speech-analytics.module.ts` (not owned); Nest provider registration is a follow-up
- Consumed 18-13 locale keys via `t(key, default)`; did not open ru.ts/en.ts

## Deviations from Plan

### Auto-fixed Issues

None beyond planned TDD stub→implementation.

### Other Deviations

**1. Frontend verify via vitest single-file (orchestrator-allowed)**
- **Found during:** Task 1 verify
- **Issue:** Plan lists `npm run test -w @krasterisk/frontend -- --run …`; gate accepted direct vitest on the ModuleSettings file
- **Fix:** Ran `node ../../node_modules/vitest/vitest.mjs run --config vite.config.ts src/features/speechAnalytics/ui/ModuleSettings/ModuleSettings.test.tsx` (3 passed)
- **Files modified:** none

**2. Nest module wiring deferred**
- **Found during:** Task 2
- **Issue:** `speech-analytics.module.ts` is outside owned_files; adapter registers when constructed with a live registry
- **Fix:** Documented as follow-up; unit tests cover register + tools
- **Files modified:** none

## Verify Results

```
npm run test -w @krasterisk/backend -- --testPathPattern="module-settings" --no-coverage
→ Test Suites: 1 passed; Tests: 5 passed

node …/vitest.mjs run … ModuleSettings.test.tsx
→ Test Files: 1 passed; Tests: 3 passed

npm run test -w @krasterisk/backend -- --testPathPattern="speech-analytics-ai.adapter" --no-coverage
→ Test Suites: 1 passed; Tests: 5 passed
```

## Self-Check: PASSED

- FOUND: packages/backend/src/modules/speech-analytics/module-settings.service.ts
- FOUND: packages/frontend/src/features/speechAnalytics/ui/ModuleSettings/ModuleSettings.tsx
- FOUND: packages/backend/src/modules/speech-analytics/speech-analytics-ai.adapter.ts
- FOUND: packages/backend/src/skills/speech-analytics/SKILL.md
- FOUND: c5d4bc83, b401fb0a, 5840d061, 8314dfc6
