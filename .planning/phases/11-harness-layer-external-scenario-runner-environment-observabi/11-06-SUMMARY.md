---
phase: 11-harness-layer-external-scenario-runner-environment-observabi
plan: 06
subsystem: testing
tags: [harness, opentelemetry, pino, observability, tracing, structured-logs]

requires:
  - phase: 11-05
    provides: Runner with metrics/reporters in finally block
provides:
  - Harness-side OpenTelemetry scenario spans (D-H05)
  - Structured JSON logs with trace_id and scenario_id correlation
  - Secret redaction in harness log serializer
affects:
  - 11-07 (Asterisk lab)
  - 11-08 (CI may upload trace/log artifacts)

tech-stack:
  added: [@opentelemetry/sdk-node@0.221.0, @opentelemetry/api@1.9.1, @opentelemetry/exporter-trace-otlp-http@0.221.0, pino@^9]
  patterns:
    - initTracing once at runner startup; ConsoleSpanExporter when OTLP endpoint unset
    - withScenarioSpan wraps each registry scenario with scenario.id/tags attributes
    - pino mixin injects trace_id from active OTel span and scenario_id from AsyncLocalStorage

key-files:
  created:
    - harness/observability/tracing.ts
    - harness/observability/logger.ts
  modified:
    - harness/runner/index.ts
    - harness/package.json
    - package.json

key-decisions:
  - "ConsoleSpanExporter default keeps local/CI debuggable without collector; OTLP when OTEL_EXPORTER_OTLP_ENDPOINT set"
  - "pino mixin (not bindings formatter) for per-log trace_id correlation inside active spans"
  - "Root harness:api forwards CLI args via trailing -- for --tag/--scenario filters"

patterns-established:
  - "Observability v1 harness-only — zero @opentelemetry in packages/*"
  - "REDACTED serializer for token/password/secret/authorization keys and PW_PASS/accessToken substrings"

requirements-completed: [D-H05]

coverage:
  - id: D1
    description: "Each scenario run creates an OpenTelemetry span visible in console when OTLP endpoint unset"
    requirement: D-H05
    verification:
      - kind: e2e
        ref: "npm run harness:api -- --tag auth; console span output with scenario.id attribute"
        status: pass
    human_judgment: false
  - id: D2
    description: "Structured JSON logs include trace_id and scenario_id fields"
    requirement: D-H05
    verification:
      - kind: e2e
        ref: "npm run harness:api -- --tag health; pino JSON lines contain trace_id"
        status: pass
    human_judgment: false
  - id: D3
    description: "No OpenTelemetry SDK added to packages/backend or packages/frontend"
    requirement: D-H05
    verification:
      - kind: other
        ref: "rg @opentelemetry/sdk-node packages/backend packages/frontend — zero matches"
        status: pass
    human_judgment: false

duration: 18min
completed: 2026-08-04
status: complete
---

# Phase 11 Plan 06: Harness Observability Summary

**Harness-side OTel scenario spans with pino JSON logs correlated by trace_id — zero app instrumentation**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-08-04T13:29:00Z
- **Completed:** 2026-08-04T13:47:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- `@opentelemetry/sdk-node` initialized in harness with `service.name=krasterisk-harness`
- `withScenarioSpan` wraps each scenario; ConsoleSpanExporter emits spans locally, OTLP when env set
- pino logger adds `trace_id` and `scenario_id` on every in-span log line
- Sensitive keys and `PW_PASS`/`accessToken` substrings redacted to `[REDACTED]`
- Runner uses structured logger for selection, lifecycle, reports, and fatal errors

## Task Commits

1. **Task 1: End-to-end scenario span — one API run** - `1fab747` (feat)
2. **Task 2: Structured logger with trace_id correlation** - `589e76b` (feat)

**Plan metadata:** `78647a3` (docs: complete plan)

## Files Created/Modified

- `harness/observability/tracing.ts` - OTel NodeSDK init, withScenarioSpan, trace_id helper
- `harness/observability/logger.ts` - pino JSON logger with redaction and trace correlation
- `harness/runner/index.ts` - initTracing, span wrapping, structured logging
- `harness/package.json` - OTel and pino dependencies (harness workspace only)
- `package.json` - harness:api forwards CLI args

## Decisions Made

- Used pino `mixin()` for per-log trace_id (bindings formatter only runs once at logger creation)
- Kept environment module console.log untouched per plan scope (runner-only refactor)
- Fixed root `harness:api` script to forward `--tag`/`--scenario` args through npm workspace boundary

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] trace_id missing from JSON log lines**
- **Found during:** Task 2 (logger integration)
- **Issue:** pino `formatters.bindings` does not run per log call; trace_id never appeared in output
- **Fix:** Switched to `mixin()` hook calling `getActiveTraceId()` and scenario AsyncLocalStorage
- **Files modified:** harness/observability/logger.ts
- **Verification:** `npm run harness:api -- --tag health` emits trace_id on scenario start/end lines
- **Committed in:** 589e76b

**2. [Rule 3 - Blocking] harness:api did not forward CLI filters**
- **Found during:** Task 2 verify (`--tag health` ran all scenarios)
- **Issue:** Root script lacked trailing `--` for npm arg forwarding to workspace script
- **Fix:** `"harness:api": "npm run test:api -w @krasterisk/harness --"`
- **Files modified:** package.json
- **Committed in:** 589e76b

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes required for verify commands and D-H05 trace correlation. No app-package scope creep.

## Issues Encountered

- Auth/moh/sse scenarios fail locally without seeded credentials and running backend (pre-existing); span and log correlation verified on health-smoke and auth tag runs

## User Setup Required

None — optional `OTEL_EXPORTER_OTLP_ENDPOINT` for collector export; defaults to console spans.

## Next Phase Readiness

- Observability v1 complete for plan 07 Asterisk lab and plan 08 CI wiring
- Step-level spans inside vitest/playwright scenarios deferred to future enhancement

## Self-Check: PASSED

- FOUND: harness/observability/tracing.ts
- FOUND: harness/observability/logger.ts
- FOUND: commit 1fab747
- FOUND: commit 589e76b

---
*Phase: 11-harness-layer-external-scenario-runner-environment-observabi*
*Completed: 2026-08-04*
