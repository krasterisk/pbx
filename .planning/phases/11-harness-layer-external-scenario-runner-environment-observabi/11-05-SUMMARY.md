---
phase: 11-harness-layer-external-scenario-runner-environment-observabi
plan: 05
subsystem: testing
tags: [harness, metrics, junit, reporters, ci-artifacts, vitest, playwright]

requires:
  - phase: 11-04
    provides: Playwright UI smoke, SSE scenarios, runner CLI with registry
provides:
  - Metrics module with per-scenario duration and pass/fail counters (D-19 sequential timing)
  - Report triad markdown/JSON/JUnit under harness/reports/ (D-11)
  - aggregateReporters wired in runner finally block
affects:
  - 11-06+ (observability, Asterisk lab)
  - 11-08 (CI workflow artifact upload paths documented)

tech-stack:
  added: []
  patterns:
    - Per-scenario vitest runs emit junit-partial-{id}.xml merged to junit-api.xml
    - Failure snippets truncated to 500 chars with Bearer token redaction (T-11-05-01)
    - Runner sequential loop with startScenario/endScenario around each registry entry

key-files:
  created:
    - harness/metrics/index.ts
    - harness/reporters/index.ts
    - harness/reporters/markdown.ts
    - harness/reporters/json.ts
    - harness/reporters/junit-merge.ts
    - harness/reports/.gitkeep
    - harness/.gitignore
  modified:
    - harness/vitest.config.ts
    - harness/playwright.config.ts
    - harness/runner/index.ts
    - harness/README.md

key-decisions:
  - "Per-scenario vitest invocations write partial JUnit files merged post-run to preserve D-19 timing without losing D-11 junit-api.xml completeness"
  - "aggregateReporters runs in runner finally so summaries emit even when scenarios fail"
  - "Process RSS metrics deferred; duration-only MVP documented in README"

patterns-established:
  - "reports/summary.md + summary.json + junit-api.xml + junit-ui.xml artifact set for CI"
  - "GITHUB_SHA optional field in summary.json for CI traceability"

requirements-completed: [D-11]

coverage:
  - id: D1
    description: "Single harness run produces JUnit XML for API vitest scenarios"
    requirement: D-11
    verification:
      - kind: e2e
        ref: "npm run harness:api; harness/reports/junit-api.xml contains testcase elements"
        status: pass
    human_judgment: false
  - id: D2
    description: "Markdown and JSON summary reports written under harness/reports/"
    requirement: D-11
    verification:
      - kind: e2e
        ref: "harness/reports/summary.md and summary.json after npm run harness:api"
        status: pass
    human_judgment: false
  - id: D3
    description: "Per-scenario duration and pass/fail captured in metrics module"
    requirement: D-11
    verification:
      - kind: unit
        ref: "npx tsx metrics smoke; runner startScenario/endScenario instrumentation"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-08-04
status: complete
---

# Phase 11 Plan 05: Metrics and Reporters Summary

**D-11 report triad (markdown, JSON, JUnit) with per-scenario metrics wired into harness runner post-suite aggregation**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-08-04T13:21:00Z
- **Completed:** 2026-08-04T13:27:00Z
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments

- Vitest and Playwright emit JUnit to `reports/junit-api.xml` and `reports/junit-ui.xml`
- `harness/metrics` records scenario id, tags, durationMs, and pass/fail status
- `aggregateReporters` writes `reports/summary.md` and `reports/summary.json` after every run
- Generated artifacts gitignored; CI upload paths documented for plan 08

## Task Commits

1. **Task 1: End-to-end JUnit output** - `235b7b3` (feat)
2. **Task 2: Metrics timers and scenario counters** - `e749d88` (feat)
3. **Task 3: Markdown and JSON aggregate reporters** - `4154fe2` (feat)

## Files Created/Modified

- `harness/metrics/index.ts` - ScenarioMetrics, startScenario/endScenario, getRunSummary
- `harness/reporters/markdown.ts` - Human-readable summary with failure section
- `harness/reporters/json.ts` - Machine-readable payload with optional GITHUB_SHA
- `harness/reporters/junit-merge.ts` - Merge partial JUnit files from per-scenario runs
- `harness/reporters/index.ts` - aggregateReporters entry point
- `harness/runner/index.ts` - Sequential per-scenario execution + finally aggregation
- `harness/vitest.config.ts` / `playwright.config.ts` - JUnit reporter config
- `harness/.gitignore` - Ignore reports, playwright-report, test-results
- `harness/README.md` - D-11 artifact table and CI upload note

## Decisions Made

- Partial JUnit per scenario merged at end — required after runner refactor for accurate per-scenario timing
- Bearer token redaction in failure snippets per threat model T-11-05-01
- No process RSS sampling in MVP (documented as future enhancement)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] JUnit overwrite on per-scenario vitest runs**
- **Found during:** Task 3 (runner instrumentation from Task 2)
- **Issue:** Sequential per-scenario vitest runs overwrote `junit-api.xml` each time
- **Fix:** Added `junit-partial-{scenarioId}.xml` per run and `mergePartialJunitReports` before aggregation
- **Files modified:** harness/runner/index.ts, harness/reporters/junit-merge.ts, harness/reporters/index.ts
- **Committed in:** `4154fe2`

---

**Total deviations:** 1 auto-fixed (Rule 1)
**Impact on plan:** Necessary for D-11 junit completeness with D-19 sequential timing.

## Issues Encountered

- Local auth 401 for admin/admin causes non-zero harness:api exit; health-smoke and report generation still succeed
- Playwright junit-ui.xml only produced when UI scenarios run

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Report triad ready for plan 08 CI artifact upload
- Metrics foundation ready for plan 06 observability hooks
- Full green harness:api requires seeded PW_USER/PW_PASS against running stack

## Self-Check: PASSED

- FOUND: harness/metrics/index.ts
- FOUND: harness/reporters/index.ts
- FOUND: harness/reports/.gitkeep
- FOUND: commit 235b7b3
- FOUND: commit e749d88
- FOUND: commit 4154fe2

---
*Phase: 11-harness-layer-external-scenario-runner-environment-observabi*
*Completed: 2026-08-04*
