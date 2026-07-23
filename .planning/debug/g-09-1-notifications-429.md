---
status: diagnosed
trigger: "UAT Gap G-09-1 — GET /api/callcenter/settings/operator/notifications returns 429 ThrottlerException"
created: 2026-07-23T13:38:00+07:00
updated: 2026-07-23T13:50:00+07:00
goal: find_root_cause_only
symptoms_prefilled: true
uat_gap: G-09-1
---

## Current Focus

hypothesis: CONFIRMED — AppModule registers named throttler `ai` (limit 10/min) as a global parallel limit; ThrottlerGuard applies every named throttler to all routes; SPA bursts (>10 req/min from same IP) make GET operator/notifications return 429 before the matrix can load
bug_class: Bohrbug
classification: throttle_misconfig (not missing feature; not primary frontend wiring bug)
next_action: none — diagnose-only complete; return ROOT CAUSE FOUND to orchestrator

## Symptoms

expected: Notification matrix (D-41/D-42) loads and is configurable; sound/popup fire per event×channel grid at runtime
actual: User opened Моя панель → Уведомления; GET http://192.168.2.37:5010/api/callcenter/settings/operator/notifications returns `{"statusCode":429,"message":"ThrottlerException: Too Many Requests"}`
errors: ThrottlerException: Too Many Requests (HTTP 429)
reproduction: Open Call Center Settings → tab «Моя панель» → sub-tab «Уведомления» (often after browsing agent panel or other settings tabs)
started: Phase 9 UAT (G-09-1)

## Eliminated

- hypothesis: Endpoint or feature missing (getOperatorNotifications not implemented / not wired)
  evidence: Controller GET operator/notifications → settingsService.getOperatorNotifications; frontend useGetMyNotificationsQuery + CallCenterSettings NotificationMatrix; service.spec covers D-41/D-43
  timestamp: 2026-07-23T13:45:00+07:00

- hypothesis: Frontend polling/refetchOnFocus/duplicate mounts cause a dedicated request storm on this endpoint alone
  evidence: getMyNotifications has no pollingInterval; RTK Query dedupes identical hooks (AgentPage + CallCenterSettings share cache); no refetchOnFocus override beyond defaults. Burst volume is normal multi-endpoint SPA traffic, not a notifications-only storm
  timestamp: 2026-07-23T13:46:00+07:00

- hypothesis: Only the 60/min `global` limit is too low
  evidence: Named `ai` limit is 10/min and applies in parallel; 429 can fire after ~10 total API hits while global still has headroom
  timestamp: 2026-07-23T13:47:00+07:00

## Evidence

- timestamp: 2026-07-23T13:40:00+07:00
  checked: packages/backend/src/app.module.ts ThrottlerModule.forRoot + APP_GUARD
  found: Named throttlers `{ name: 'global', ttl: 60000, limit: 60 }` and `{ name: 'ai', ttl: 60000, limit: 10 }`; ThrottlerGuard bound as APP_GUARD
  implication: Intended “AI-only” 10/min profile is registered as a second global definition

- timestamp: 2026-07-23T13:41:00+07:00
  checked: node_modules/@nestjs/throttler/dist/throttler.guard.js canActivate (v6.x)
  found: Loop `for (const namedThrottler of this.throttlers)` applies every named limit unless THROTTLER_SKIP+name is set; `@SkipThrottle()` without args only skips name `default` (README: default `{ default: true }`)
  implication: Routes without `@SkipThrottle({ ai: true })` are capped by the `ai` 10/min counter (IP tracker)

- timestamp: 2026-07-23T13:42:00+07:00
  checked: callcenter-settings.controller.ts GET operator/notifications
  found: No SkipThrottle / Throttle decorators; handler delegates to getOperatorNotifications (feature present)
  implication: Endpoint is correctly wired but inherits the mis-scoped `ai` global limit

- timestamp: 2026-07-23T13:43:00+07:00
  checked: ai-chat.controller.ts comments + decorators
  found: Comment claims GET endpoints are unlimited via `@SkipThrottle()`; POST uses `@Throttle({ ai: ... })`. Bare `@SkipThrottle()` does not skip named `ai`/`global`
  implication: Confirms design intent was AI-scoped rate limit, but registration makes `ai` apply app-wide

- timestamp: 2026-07-23T13:44:00+07:00
  checked: CallCenterAgentPage + CallCenterSettings + OperatorSettingsForm
  found: Agent page mounts many concurrent GETs (operator settings, ui, notifications, webrtc, pause reasons, permissions, queues KPI, history, parked, kpi, SSE). Settings «Моя панель» mounts getMyUi + getMyNotifications. Legacy «Звуки и уведомления» uses getMyOperatorSettings only (fewer calls / often already cached)
  implication: Why legacy tab can appear to work while notifications GET 429s after prior SPA traffic burned the 10-req `ai` budget

- timestamp: 2026-07-23T13:48:00+07:00
  checked: RCA branching (code vs config vs environment)
  found: code — `ai` registered in forRoot array (global apply); config — limit 10 unsuitable as app-wide; environment — default IP tracker shares budget across tabs/sessions on same client IP. AND-gate: primary cause is code/config mis-scope of `ai`; SPA volume is expected, not a second independent defect
  implication: Minimal fix is throttle registration/scoping, not rewriting the notification matrix feature

## Resolution

root_cause: >
  Throttle misconfiguration: AppModule registers a named `ai` throttler (10 req / 60s)
  alongside `global` (60/min). @nestjs/throttler v6 applies ALL named throttlers to every
  route by default. Call-center (and the rest of the SPA) therefore share an effective
  ~10 requests/minute IP budget. After normal agent/settings page load bursts,
  GET /api/callcenter/settings/operator/notifications returns 429 — the notification
  matrix feature itself is implemented and wired.
fix: (diagnose-only — not applied)
verification: (n/a)
files_changed: []
oracle_type: specified
recommended_fix_minimal: >
  1) Keep only one app-wide throttler in ThrottlerModule.forRoot (e.g. global 60/min,
     or unnamed default). 2) Apply the stricter 10/min limit only on AI POST /message
     via @Throttle({ global: { limit: 10, ttl: 60000 } }) (or equivalent single-name
     override). 3) Optionally fix bare @SkipThrottle() call sites to
     @SkipThrottle({ global: true }) / named keys if multi-profile remains. Do not
     SkipThrottle the notifications route as the primary fix — that papers over the
     global mis-scope.
classification: throttle_misconfig
not: missing_feature
not_primary: frontend_wiring_or_polling_storm
