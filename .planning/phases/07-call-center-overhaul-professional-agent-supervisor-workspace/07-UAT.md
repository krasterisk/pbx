---
status: testing
phase: 07-call-center-overhaul-professional-agent-supervisor-workspace
source: [07-VERIFICATION.md]
started: 2026-07-16T04:30:00Z
updated: 2026-07-16T04:30:00Z
---

## Current Test

number: 1
name: Full agent happy-path on /callcenter/agent
expected: |
  Login → inbound queue call → card auto-opens with phonebook data → hold/transfer → wrap-up → call appears in reports
awaiting: user response

## Tests

### 1. Full agent happy-path on /callcenter/agent
expected: Login → inbound queue call → card auto-opens with phonebook data → hold/transfer → wrap-up → call appears in reports
result: [pending]

### 2. WebRTC browser mode end-to-end
expected: ShiftLoginModal WebRTC mode registers over WSS; answer/hold/mute/DTMF/transfer work entirely in browser
result: [pending]

### 3. Wallboard TV display-token flow (07-13)
expected: Create token on settings → open /callcenter/wallboard?token=… without login → KPI/agents/queues; revoke stops SSE
result: [pending]

### 4. Role-based nav DOM presence
expected: Operator sees only АРМ оператора; supervisor sees agent/supervisor/wallboard/reports; admin also sees settings; operator deep-link to /callcenter/supervisor redirects home
result: [pending]

### 5. Settings D-40 pause-reasons + operator picker (gap closure 07-19)
expected: Admin opens /callcenter/settings → Причины пауз CRUD works; Настройки операторов → pick another operator → save persists via /operator/:operatorId
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
