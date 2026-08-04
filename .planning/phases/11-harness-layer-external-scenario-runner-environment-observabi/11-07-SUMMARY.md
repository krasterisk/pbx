---
phase: 11-harness-layer-external-scenario-runner-environment-observabi
plan: 07
subsystem: testing
tags: [harness, asterisk, ami, ari, socket.io, workflow_dispatch, sql-helper]

requires:
  - phase: 11-06
    provides: Runner observability and metrics in finally block
provides:
  - Asterisk lab readiness gates (AMI TCP + ARI /asterisk/info)
  - Gated asterisk-originate and ami-events realtime scenarios
  - Opt-in SQL assertion helper for CC side-effects
  - Separate harness-asterisk.yml workflow_dispatch CI job
affects:
  - 11-08 (harness.yml PR CI cutover — asterisk stays separate per D-10)

tech-stack:
  added: [asterisk-manager@^0.2.0, socket.io-client@^4.8.3, mysql2@^3.12.0]
  patterns:
    - describe.skipIf(skipIfNoAsterisk()) for D-06 clean skip without lab
    - Runner skips waitForAppReady when all selected scenarios are asterisk-tagged and HAS_ASTERISK unset
    - sql.ts opt-in only — never imported by default API scenarios

key-files:
  created:
    - harness/environment/asterisk.ts
    - harness/scenarios/realtime/asterisk-originate.test.ts
    - harness/scenarios/realtime/ami-events.test.ts
    - harness/assertions/sql.ts
    - .github/workflows/harness-asterisk.yml
  modified:
    - harness/runner/registry.ts
    - harness/runner/index.ts
    - harness/environment/readiness.ts
    - harness/package.json
    - harness/.env.harness.example
    - package.json

key-decisions:
  - "describe.skipIf(skipIfNoAsterisk()) at suite level — exit 0 without backend when HAS_ASTERISK unset"
  - "Originate scenario supports ami (default) and click-to-call modes via HARNESS_ORIGINATE_MODE"
  - "harness-asterisk.yml copied from e2e.yml structure with workflow_dispatch + nightly cron only"

requirements-completed: [D-05, D-06, D-07, D-H02, D-H03, D-10]

coverage:
  - id: D1
    description: "Asterisk scenarios skip cleanly when HAS_ASTERISK is not 1"
    requirement: D-06
    verification:
      - kind: e2e
        ref: "HAS_ASTERISK=0 npm run harness:asterisk — exit 0, 2 skipped"
        status: pass
    human_judgment: false
  - id: D2
    description: "Lab readiness probes AMI TCP and ARI /asterisk/info"
    requirement: D-07
    verification:
      - kind: unit
        ref: "harness/environment/asterisk.ts amiTcpReady + ariInfoReady exports"
        status: pass
    human_judgment: false
  - id: D3
    description: "Originate happy-path scenario implemented with hangup in finally"
    requirement: D-05
    verification: []
    human_judgment: true
    rationale: "Live lab originate/answer requires physical Asterisk lab — checkpoint task 4"
  - id: D4
    description: "ami-events receives newChannel or hangup during telephony"
    requirement: D-H03
    verification: []
    human_judgment: true
    rationale: "Socket.IO event receipt requires live AMI traffic — checkpoint task 4"
  - id: D5
    description: "SQL helper opt-in only, not default assertion path"
    requirement: D-H02
    verification:
      - kind: other
        ref: "harness/assertions/sql.ts header + no imports from api/moh scenarios"
        status: pass
    human_judgment: false
  - id: D6
    description: "Separate harness-asterisk.yml workflow exists, PR CI unchanged"
    requirement: D-10
    verification:
      - kind: other
        ref: ".github/workflows/harness-asterisk.yml workflow_dispatch trigger"
        status: pass
    human_judgment: false

duration: 35min
completed: 2026-08-04
status: checkpoint-pending
---

# Phase 11 Plan 07: Asterisk Lab Harness Summary

**Gated Asterisk originate and ami-events scenarios with AMI/ARI readiness probes, opt-in SQL helper, and separate workflow_dispatch CI — auto tasks complete, human lab verify pending**

## Checkpoint Status

**CHECKPOINT PENDING** — Task 4 (human-verify) not executed. Auto tasks 1–3 complete.

| Task | Name | Status | Commit |
|------|------|--------|--------|
| 1 | End-to-end skip gate | complete | `f115003` |
| 2 | Originate + ami-events | complete | `2010e88` |
| 3 | SQL helper + CI workflow | complete | `218a5ca` |
| 4 | Human verify lab | **PENDING** | — |

## Performance

- **Duration:** 35 min
- **Tasks completed:** 3/4 (auto only)
- **Files modified:** 11

## Accomplishments

- `harness/environment/asterisk.ts` — AMI TCP + ARI `/asterisk/info` readiness, `skipIfNoAsterisk()`, lab AMI originate helper
- `asterisk-originate.test.ts` — agent login, originate (AMI or click-to-call), SSE wait, hangup in finally; skips without lab
- `ami-events.test.ts` — Socket.IO client on `/ami-events`, asserts `newChannel` or `hangup`
- `harness/assertions/sql.ts` — opt-in parameterized `assertSqlRowCount` (D-H02)
- `.github/workflows/harness-asterisk.yml` — workflow_dispatch + cron 03:00 UTC, separate from PR CI (D-10)
- `HAS_ASTERISK=0 npm run harness:asterisk` exits 0 with all asterisk tests skipped

## Task Commits

1. **Task 1: End-to-end skip gate** — `f115003` (feat)
2. **Task 2: Originate + ami-events** — `2010e88` (feat)
3. **Task 3: SQL helper + workflow** — `218a5ca` (feat)

## Files Created/Modified

- `harness/environment/asterisk.ts` — Lab readiness and AMI originate helper
- `harness/scenarios/realtime/asterisk-originate.test.ts` — D-05 happy-path scenario
- `harness/scenarios/realtime/ami-events.test.ts` — D-H03 Socket.IO assertions
- `harness/assertions/sql.ts` — Opt-in SQL row count helper
- `.github/workflows/harness-asterisk.yml` — Lab-only CI workflow
- `harness/runner/registry.ts` — Registered asterisk-originate and ami-events
- `harness/runner/index.ts` — Skip readiness when no lab for asterisk tag
- `harness/environment/readiness.ts` — Asterisk profile polling
- `harness/package.json` — test:asterisk script + deps
- `package.json` — harness:asterisk wired

## Decisions Made

- Runner skips `waitForAppReady` when all selected scenarios carry `asterisk` tag and `HAS_ASTERISK !== '1'` — enables D-06 verify without running backend
- Lab exten/context marked ASSUMED A5 with `HARNESS_ORIGINATE_EXTEN` override per RESEARCH
- `harness-asterisk.yml` based on `e2e.yml` (not plan 08 harness.yml) per user constraint

## Deviations from Plan

None - plan executed exactly as written for auto tasks 1–3.

## Issues Encountered

None

## User Setup Required

For live lab verification (checkpoint task 4):

1. Copy `harness/.env.harness.example` to `.env.harness.local`
2. Set `HAS_ASTERISK=1` and configure `AMI_*` / `ARI_*` vars
3. Set `HARNESS_ORIGINATE_EXTEN`, `HARNESS_AGENT_INTERFACE` for your lab extension
4. Ensure backend running with matching AMI/ARI env

## Next Phase Readiness

- Plan 11-08 can proceed with harness.yml PR CI cutover
- Asterisk lab human verify blocks full plan 07 completion until checkpoint approved

## Self-Check: PASSED

- FOUND: harness/environment/asterisk.ts
- FOUND: harness/scenarios/realtime/asterisk-originate.test.ts
- FOUND: harness/scenarios/realtime/ami-events.test.ts
- FOUND: harness/assertions/sql.ts
- FOUND: .github/workflows/harness-asterisk.yml
- FOUND: f115003, 2010e88, 218a5ca

---
*Phase: 11-harness-layer-external-scenario-runner-environment-observabi*
*Auto tasks completed: 2026-08-04*
*Checkpoint: PENDING*
