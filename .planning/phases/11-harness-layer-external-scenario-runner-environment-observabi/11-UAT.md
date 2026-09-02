---
status: complete
phase: 11-harness-layer-external-scenario-runner-environment-observabi
source: [11-01-SUMMARY.md … 11-08-SUMMARY.md]
started: 2026-09-02T11:50:00Z
updated: 2026-09-02T11:55:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Automated coverage 11-01…11-08
expected: All coverage entries with passing unit/file refs auto-pass (scaffold, env, scenarios, metrics, OTel, CI YAML)
result: pass
source: automated
note: 21 auto-pass across 11-01…11-08; remaining human checkpoints listed below

### 2. Live GET /api/health on :5010 (WINDOWS 2)
expected: harness:api health-smoke reaches a running backend
result: skipped
reason: "Operator close-out: live API stack not treated as CI; isolated harness.yml is the green gate"

### 3. Live harness:api --tag auth (WINDOWS 3)
expected: Auth scenarios pass against a running backend
result: skipped
reason: "Operator close-out: backend not required for phase seal; live auth remains WINDOWS 3"

### 4. Live harness:api --tag moh (WINDOWS 4)
expected: MOH CRUD scenarios pass against a running backend
result: skipped
reason: "Operator close-out: must not run full CRUD harness against a live tenant"

### 5. Live Playwright UI absorb
expected: Migrated e2e happy-path runs in harness UI profile
result: skipped
reason: "Operator close-out: UI lab deferred; e2e/ kept until first green harness.yml"

### 6. Live SSE heartbeat
expected: SSE /api/callcenter/events assertion passes on a running stack
result: skipped
reason: "Operator close-out: live SSE deferred with the rest of the API lab"

### 7. Live Asterisk originate (gated)
expected: asterisk-profile scenario originates when HAS_ASTERISK=1
result: skipped
reason: "Operator close-out: live Asterisk lab not in this seal; same class as Phase 12 skipped voice"

### 8. Live AMI / ami-events
expected: Socket.IO AMI gateway assertions pass on a lab pair
result: skipped
reason: "Operator close-out: live AMI deferred with Asterisk originate"

### 9. Delete e2e/ after first green harness.yml (D-H01 / D-23)
expected: e2e/ and e2e.yml removed only after isolated CI is green
result: skipped
reason: "D-H01/D-23: local npm run harness is not the gate; first green GitHub harness.yml still outstanding"

## Summary

total: 9
passed: 1
issues: 0
pending: 0
skipped: 8
blocked: 0

## Deferred Follow-Ups

- test: 2
  idea: "Live harness:api health on isolated CI MySQL (WINDOWS 2)"
- test: 3
  idea: "Live harness:api --tag auth (WINDOWS 3)"
- test: 4
  idea: "Live harness:api --tag moh against isolated stack, never a live tenant (WINDOWS 4)"
- test: 5
  idea: "Playwright UI absorb after first green harness.yml"
- test: 6
  idea: "SSE heartbeat on a running call-center stack"
- test: 7
  idea: "Asterisk originate when HAS_ASTERISK=1"
- test: 8
  idea: "AMI / ami-events on a lab pair"
- test: 9
  idea: "Delete e2e/ and retire e2e.yml after first green harness.yml"
