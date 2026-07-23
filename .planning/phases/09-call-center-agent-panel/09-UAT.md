---
status: complete
phase: 09-call-center-agent-panel
source: [09-VERIFICATION.md]
started: 2026-07-23T04:30:00Z
updated: 2026-07-23T06:35:00Z
---

## Current Test

number: 2
name: Auto-pause under live AMI event ordering
expected: |
  Against a live/staging tenant, drive missed queue calls / idle / long WRAPUP so configured
  auto-pause rules fire. Agent goes PAUSED exactly once per rule breach with the correct reason;
  no double-fire from concurrent AMI events.
awaiting: none

## Tests

### 1. Notification matrix runtime (sound + popup)
expected: Sound plays and popup/toast appears per configuration; browser notification when tab hidden, respecting role locks
result: issue
reported: "URL запроса http://192.168.2.37:5010/api/callcenter/settings/operator/notifications GET → {\"statusCode\":429,\"message\":\"ThrottlerException: Too Many Requests\"}. Отдельной вкладки Уведомления нет (путь: Моя панель → Уведомления); матрица недоступна из‑за 429."
severity: major

### 2. Auto-pause under live AMI event ordering
expected: Agent auto-pauses exactly once per configured rule breach (RONA / missed-count / idle / WRAPUP duration) with correct logged reason; no double-fire from concurrent AMI events
result: issue
reported: "Не вижу настройки автопаузы (экран Настройки операторов — есть «Звуки и уведомления», но нет секции правил автопаузы / RONA / missed-count / idle / WRAPUP)."
severity: major

## Summary

total: 2
passed: 0
issues: 2
pending: 0
skipped: 0
blocked: 0

## Gaps

- gap_id: G-09-1
  truth: "Notification matrix (D-41/D-42) is configurable and fires sound/popup per the event×channel grid at runtime"
  status: failed
  reason: "User reported: GET /api/callcenter/settings/operator/notifications returns 429 ThrottlerException Too Many Requests; notification matrix UI cannot load settings"
  severity: major
  test: 1
  artifacts: []
  missing: []

- gap_id: G-09-2
  truth: "Auto-pause rule engine (D-15) is configurable and correctly transitions an agent to PAUSED at configured thresholds under live AMI ordering"
  status: failed
  reason: "User reported: no auto-pause settings visible in Call Center Settings (Operator settings shows legacy sound toggles only; no UI for autopause_rules / RONA / missed-count / idle / WRAPUP). Backend stores rules on cc_settings.autopause_rules but no settings API/UI exposes them."
  severity: major
  test: 2
  artifacts: []
  missing: []
