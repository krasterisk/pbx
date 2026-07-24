---
status: confirmed
bug_class: Bohrbug
phase: 09-call-center-agent-panel
created: 2026-07-23T11:15:00Z
updated: 2026-07-23T11:20:00Z
---

# G-09-3: Time-based auto-pause never fires in production

## Symptom

Configured `status_duration` / `idle_time` rules do not pause agents in live use. UI saves rules correctly; unit tests previously "passed" by manually re-calling `evaluateOnStatusEvent` after fake time advance.

## Root cause

`idle_time` / `status_duration` were designed to evaluate only on AMI status events, requiring a **second** observation of the same status after the threshold. AMI does not re-emit unchanged agent status while the agent sits in WRAPUP/READY — so the second evaluation never arrives.

Confirmed in `09-09-SUMMARY.md`: "status_duration fires when the *same* status is re-observed…"

## Fix

Schedule real `setTimeout` when entering a watched status / READY (idle). Cancel on status change. Re-check live agent status when the timer fires. Tests updated to advance timers without a second evaluate call.

## Files

- `packages/backend/src/modules/callcenter/callcenter-autopause.service.ts`
- `packages/backend/src/modules/callcenter/callcenter-autopause.service.spec.ts`
