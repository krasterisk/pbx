---
status: complete
phase: 09-call-center-agent-panel
source: [09-VERIFICATION.md, 09-16-SUMMARY.md, 09-17-SUMMARY.md]
started: 2026-07-23T04:30:00Z
updated: 2026-07-23T10:52:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Notification matrix load + runtime (re-UAT G-09-1)
expected: GET operator/notifications = 200; матрица и UI-visibility toggles optimistic; sound/popup по конфигу
result: pass

### 2. Auto-pause Settings tab + rules persist (re-UAT G-09-2)
expected: Master switch «Включить автопаузу»; выкл — RONA/правила неактивны; вкл — RONA + доп. правила (status select); save/reload; layout aligned; read-only для не-supervisor
result: pass
notes: "UI-only checkpoint; live AMI auto-pause deferred. During UAT: autopause_enabled master switch + status Select + layout fixes."

## Summary

total: 2
passed: 2
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- gap_id: G-09-1
  truth: "Notification matrix (D-41/D-42) is configurable and fires sound/popup per the event×channel grid at runtime"
  status: resolved
  resolved_by: 09-16-PLAN.md
  resolved_at: 2026-07-23
  reason: "User reported: GET /api/callcenter/settings/operator/notifications returns 429 ThrottlerException Too Many Requests; notification matrix UI cannot load settings"
  severity: major
  test: 1
  root_cause: "Throttle misconfig: ThrottlerModule registers named 'ai' limit (10/min) globally; Nest applies all named throttlers to every route, so SPA bursts exhaust the AI budget and any later GET (including /operator/notifications) returns 429. Matrix feature itself is implemented under Моя панель → Уведомления."
  artifacts:
    - path: "packages/backend/src/app.module.ts"
      issue: "ai throttler (10/min) registered alongside global (60/min); APP_GUARD applies both to all routes"
    - path: "packages/backend/src/modules/callcenter/callcenter-settings.controller.ts"
      issue: "GET operator/notifications inherits mis-scoped ai limit (symptom site)"
    - path: ".planning/debug/g-09-1-notifications-429.md"
      issue: "full diagnosis"
  missing:
    - "Keep single app-wide throttler (e.g. global 60/min); apply 10/min only on AI POST /message via route-scoped @Throttle — do not only SkipThrottle notifications"
  debug_session: ".planning/debug/g-09-1-notifications-429.md"

- gap_id: G-09-2
  truth: "Auto-pause rule engine (D-15) is configurable and correctly transitions an agent to PAUSED at configured thresholds under live AMI ordering"
  status: resolved
  resolved_by: 09-17-PLAN.md
  resolved_at: 2026-07-23
  reason: "User reported: no auto-pause settings visible in Call Center Settings (Operator settings shows legacy sound toggles only; no UI for autopause_rules)"
  severity: major
  test: 2
  root_cause: "D-15 engine + cc_settings.autopause_rules shipped (09-01/09-09) but no GET/PUT API and no Settings UI were ever built. 09-09 deferred admin UI to 09-14; 09-13/09-14 never covered autopause. Empty rules → only always-on RONA can fire."
  artifacts:
    - path: "packages/backend/src/modules/callcenter/callcenter-autopause.service.ts"
      issue: "engine OK; reads autopause_rules ?? []"
    - path: "packages/backend/src/modules/callcenter/dto/callcenter-settings.dto.ts"
      issue: "no autopause_rules on update DTOs"
    - path: "packages/frontend/src/features/callcenter/ui/OperatorSettingsForm/OperatorSettingsForm.tsx"
      issue: "no autopause editor (pickup/auto-answer/wrap-up/sound only)"
    - path: ".planning/debug/g-09-2-autopause-ui.md"
      issue: "full diagnosis"
  missing:
    - "Tenant GET/PUT autopause_rules + admin Settings UI for missed_count/idle_time/status_duration (RONA remains always-on)"
  debug_session: ".planning/debug/g-09-2-autopause-ui.md"

## Deferred Follow-Ups

- test: 2
  idea: "Live AMI smoke for RONA / missed_count / idle_time / status_duration auto-pause under real event ordering — deferred from UI-only UAT"
  deferred_at: 2026-07-23
