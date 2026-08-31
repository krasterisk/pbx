---
phase: 11-harness-layer-external-scenario-runner-environment-observabi
plan: 08
subsystem: testing
tags: [github-actions, playwright, vitest, ci, harness]

requires:
  - phase: 11-07
    provides: Asterisk dispatch workflow and lab-gated scenarios
provides:
  - PR CI workflow harness.yml on Node 22
  - Artifact upload of playwright-report + reports triad
  - Nyquist validation sign-off for Wave 0
affects: [verify-work-11, e2e-absorb]

actuals:
  tokens: 4200
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns: [harness.yml as canonical PR gate; e2e absorb only after first green CI]

key-files:
  created:
    - .github/workflows/harness.yml
    - .planning/phases/11-harness-layer-external-scenario-runner-environment-observabi/11-08-SUMMARY.md
  modified:
    - harness/README.md
    - .planning/phases/11-harness-layer-external-scenario-runner-environment-observabi/11-VALIDATION.md

key-decisions:
  - "Did not delete e2e/ or e2e.yml — D-H01/D-23 requires harness.yml green; local npm run harness is not that gate"
  - "Local :5010 is not treated as CI-equivalent MySQL; full CRUD harness must not run against a live tenant"
  - "Root harness scripts and Playwright workers=1 were already in tree; Task 1 added only harness.yml"

patterns-established:
  - "PR CI waits on /api/health then npm test in harness/"
  - "e2e absorb is a follow-up after first green harness.yml, not a same-commit deletion"

requirements-completed: [D-09, D-10, D-11, D-12, D-13, D-17, D-24]

coverage:
  - id: D1
    description: harness.yml runs on push/PR to main/develop with Node 22 and health wait
    requirement: D-09
    verification:
      - kind: other
        ref: ".github/workflows/harness.yml#node-version: '22'"
        status: pass
    human_judgment: false
  - id: D2
    description: Playwright workers=1 on CI; no sharding
    requirement: D-12
    verification:
      - kind: other
        ref: "harness/playwright.config.ts#workers process.env.CI ? 1"
        status: pass
    human_judgment: false
  - id: D3
    description: Artifact harness-reports uploads playwright-report and reports
    requirement: D-11
    verification:
      - kind: other
        ref: ".github/workflows/harness.yml#upload-artifact harness-reports"
        status: pass
    human_judgment: false
  - id: D4
    description: Root scripts harness / harness:ui / harness:api / harness:asterisk replace test:e2e
    requirement: D-17
    verification:
      - kind: other
        ref: "package.json#scripts.harness"
        status: pass
    human_judgment: false
  - id: D5
    description: Delete e2e/ and retire e2e.yml after first green harness.yml
    requirement: D-H01
    verification: []
    human_judgment: true
    rationale: "Destructive absorb is gated on isolated CI green; local stack refused :5010 during health-smoke"

duration: 12min
completed: 2026-08-31
status: complete
---

# Phase 11: Plan 08 Summary

**PR CI `harness.yml` on Node 22 with health wait and report artifacts; `e2e/` absorb left until the first green CI run**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-31T08:11:00Z
- **Completed:** 2026-08-31T08:23:00Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Canonical PR workflow `.github/workflows/harness.yml` (push/PR `main`/`develop`, `workflow_dispatch`, Node 22, MySQL service, migrate, wait `/api/health` + frontend, `npm test` in `harness/`)
- Artifact `harness-reports` (`playwright-report` + `reports`, 14 days)
- `11-VALIDATION.md` Wave 0 signed (`nyquist_compliant: true`); README documents CI matrix and phase gate

## Task Commits

1. **Task 1: End-to-end CI workflow — harness job on Node 22** - `268b146` (feat)
2. **Task 2: CI artifacts, retire e2e workflow, delete e2e/** - `bf10120` (feat) — artifacts + README only
3. **Task 3: Nyquist validation sign-off and phase gate script** - `a3f0ee6` (docs)

**Plan metadata:** (this commit)

## Files Created/Modified

- `.github/workflows/harness.yml` — PR CI gate
- `harness/README.md` — CI matrix, D-12/D-13, phase gate, e2e absorb note
- `.planning/phases/11-harness-layer-external-scenario-runner-environment-observabi/11-VALIDATION.md` — Nyquist sign-off

## Decisions Made

- Treat GitHub `harness.yml` (isolated MySQL) as the green gate for deleting `e2e/`, not a local `:5010` that may be a live tenant or down (`ECONNREFUSED` on health-smoke fetch)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule — Blocking] Did not delete `e2e/` or `e2e.yml`**
- **Found during:** Task 2
- **Issue:** Plan requires local `npm run harness` equivalent to CI before one-way absorb. Isolated CI MySQL is not running here; health-smoke `fetch` to `:5010` failed with `ECONNREFUSED`.
- **Fix:** Shipped artifacts + docs; left `e2e/` in place; documented follow-up in VALIDATION.md and README.
- **Files modified:** `harness/README.md`, `11-VALIDATION.md`
- **Verification:** `test -d e2e` still true; `e2e.yml` still present
- **Committed in:** `bf10120`, `a3f0ee6`

---

**Total deviations:** 1 (destructive absorb deferred)
**Impact on plan:** D-09/D-11/D-12/D-17/D-24 met. D-H01/D-23 incomplete until first green `harness.yml`.

## Issues Encountered

- PowerShell `Invoke-WebRequest` to `:5010` returned 200 once; Node `fetch` in Vitest then got `ECONNREFUSED` — do not treat the workstation as CI.

## User Setup Required

None for the workflow YAML. First green GitHub Actions run on `harness.yml` is required before deleting `e2e/`.

## Next Phase Readiness

- `/gsd-verify-work 11` can run; expect D-H01/D-23 and live API WINDOWS as remaining debt
- After first green `harness.yml`: delete `e2e/` and `.github/workflows/e2e.yml`

---
*Phase: 11-harness-layer-external-scenario-runner-environment-observabi*
*Completed: 2026-08-31*
