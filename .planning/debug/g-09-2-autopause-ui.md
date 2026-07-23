---
status: diagnosed
trigger: "Gap G-09-2 — Auto-pause rule engine (D-15) configurable UI missing; user sees operator settings toggles but no auto-pause rules UI (RONA / missed-count / idle / WRAPUP duration). Cannot configure thresholds for UAT. symptoms_prefilled: true; goal: find_root_cause_only"
created: 2026-07-23T06:38:00Z
updated: 2026-07-23T06:45:00Z
symptoms_prefilled: true
goal: find_root_cause_only
---

## Current Focus

hypothesis: CONFIRMED — D-15 engine + schema shipped in 09-01/09-09; settings API (09-13) and settings UI (09-14) never exposed GET/PUT for autopause_rules (explicitly deferred in 09-09-SUMMARY, never consumed)
test: Grep/read AutopauseService, settings service/controller/DTOs, frontend CallCenterSettingsPage/OperatorSettingsForm, plans 09-09/13/14
expecting: Engine yes; API/UI no; plans omit UI
next_action: return ROOT CAUSE FOUND (diagnose-only)
bug_class: Bohrbug
known_pattern_candidate: none (no knowledge-base.md)

reasoning_checkpoint:
  hypothesis: "Missing settings API+UI for cc_settings.autopause_rules causes UAT inability to configure D-15 thresholds; engine works with empty rules (RONA-only)"
  confirming_evidence:
    - "CallCenterAutoPauseService.getRules reads autopause_rules ?? [] — empty means missed_count/idle_time/status_duration never fire"
    - "No autopause in callcenter-settings.dto.ts, controller routes, or frontend; 09-09-SUMMARY line 191 deferred UI to 09-14; 09-13/09-14 never mention autopause"
  falsification_test: "Finding a GET/PUT autopause_rules endpoint or settings form field would refute"
  fix_rationale: "N/A diagnose-only — recommended scope is tenant GET/PUT + admin settings UI"
  blind_spots: "Did not run live AMI RONA; did not inspect live DB rows for seeded rules"
  candidate_causes:
    - "code: no API/UI surface for autopause_rules"
    - "config/planning: 09-13/09-14 scoped to UI/notifications/permissions only; autopause UI deferred and never scheduled"
  and_gate: "yes — missing UI AND missing write API both block UAT configuration; engine alone is insufficient for configurable-threshold truth"

## Symptoms

expected: Auto-pause rule engine (D-15) is configurable and correctly transitions an agent to PAUSED at configured thresholds under live AMI ordering
actual: User looked at Call Center Settings → «Настройки операторов» and sees pickup/auto-answer/wrap-up/legacy sound toggles, but NO auto-pause rules UI (RONA / missed-count / idle / WRAPUP duration). Cannot configure thresholds for UAT.
errors: none (missing feature surface, not runtime error)
reproduction: Open Call Center Settings → «Настройки операторов»; look for auto-pause rules configuration
started: Phase 9 UAT test 2 / Gap G-09-2

## Eliminated

- hypothesis: Engine missing or not reading cc_settings.autopause_rules
  evidence: CallCenterAutoPauseService exists, registered in module, getRules() reads settings.autopause_rules; AMI service calls evaluateRonaOnAbandon / evaluateOnMissed / evaluateOnStatusEvent; 14 unit tests in callcenter-autopause.service.spec.ts
  timestamp: 2026-07-23T06:42:00Z

- hypothesis: UI exists but hidden under wrong tab / wrong label
  evidence: CallCenterSettingsPage tabs are cardTemplates/pauseReasons/alertThresholds/operatorSettings/myPanel/displayTokens/reportSchedules; OperatorSettingsForm = pickup/auto-answer/wrapup/sound; CallCenterSettings = panel visibility + notification matrix only; zero frontend matches for autopause_rules
  timestamp: 2026-07-23T06:43:00Z

- hypothesis: API exists but frontend forgot to wire it
  evidence: UpdateCcSettingsDto has no autopause_rules; updateTenantSettings only patches default_sla_threshold/alert_sound_enabled/alert_thresholds; no tenant/autopause route; dto folder has zero autopause matches
  timestamp: 2026-07-23T06:44:00Z

## Evidence

- timestamp: 2026-07-23T06:40:00Z
  checked: CallCenterAutoPauseService + cc-settings.model + migration
  found: Service reads autopause_rules JSON; RONA is fixed always-on; missed_count/idle_time/status_duration gated on rules.find(...); null/missing → []
  implication: Engine present; configurable rules inert without DB content

- timestamp: 2026-07-23T06:41:00Z
  checked: packages frontend + backend for autopause_rules API/UI
  found: Backend-only references (service/spec/model/types/ami/migration). No frontend. No DTO field. No dedicated controller route.
  implication: Gap is missing configuration surface, not a broken existing UI

- timestamp: 2026-07-23T06:42:00Z
  checked: 09-09-PLAN / 09-09-SUMMARY / 09-13-PLAN / 09-14-PLAN
  found: 09-09 delivered engine only; SUMMARY explicitly: "09-14 will need a UI for editing cc_settings.autopause_rules (currently JSON-only, no admin surface)". 09-13 requirements D-05/06/38-43 only (UI/permissions/notifications). 09-14 same — no D-15, no autopause.
  implication: Autopause settings UI was known deferred and never planned into 09-13/09-14

- timestamp: 2026-07-23T06:43:00Z
  checked: OperatorSettingsForm + CallCenterSettingsPage + 09-UI-SPEC
  found: User-visible «Настройки операторов» matches OperatorSettingsForm (legacy toggles). UI-SPEC mentions RONA/auto-pause only as a warning color semantic, not a settings surface.
  implication: Symptom matches shipped UI exactly; not a lookup error by tester

- timestamp: 2026-07-23T06:44:00Z
  checked: getTenantSettings return path
  found: getTenantSettings returns full Sequelize row (so autopause_rules may appear in raw GET /tenant if column set in DB) but UpdateCcSettingsDto / updateTenantSettings never write it — no supported configuration path
  implication: Even raw API consumers cannot configure rules via documented settings DTOs

## Resolution

root_cause: "D-15 auto-pause engine and cc_settings.autopause_rules column were shipped (09-01 schema + 09-09 CallCenterAutoPauseService), but no settings API write path and no admin/settings UI were ever implemented — 09-09-SUMMARY deferred the UI to 09-14, and 09-13/09-14 scoped only UI-customization/permissions/notifications (D-05/06/38–43), omitting autopause. With empty/null rules, only always-on RONA can fire; missed_count/idle_time/status_duration cannot be UAT-configured."
fix: (diagnose-only — not applied)
verification: (diagnose-only)
files_changed: []
oracle_type: specified
recommended_fix_scope: "Add tenant GET/PUT for autopause_rules (UpdateAutopauseRulesDto + settings service/controller) + Call Center Settings admin UI (rule list editor for missed_count / idle_time / status_duration); OR document configurable rules as deferred and narrow UAT to RONA-only with empty rules array"
uat_without_ui: "RONA always-on — abandon a queue call while agent still RINGING; expect PAUSED with reason 'RONA (ring-no-answer)'. Configurable thresholds require DB seed of autopause_rules JSON or new API/UI."
