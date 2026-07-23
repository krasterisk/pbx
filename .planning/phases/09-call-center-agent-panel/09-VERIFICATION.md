---
phase: 09-call-center-agent-panel
verified: 2026-07-23T09:20:00Z
status: human_needed
score: 16/16 must-haves verified
behavior_unverified: 2
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 14/14
  gaps_closed:
    - "G-09-1: Single global throttler; AI POST route-scoped 10/min; callcenter operator notifications not crushed by named ai 10/min global"
    - "G-09-2: sanitizeAutopauseRules + PUT tenant autopause_rules; AutoPauseRulesForm on Settings autoPause tab; RONA not editable; SUPERVISOR/ADMIN gate; i18n"
  gaps_remaining: []
  regressions: []
deferred: []
behavior_unverified_items:
  - truth: "Notification matrix (D-41/D-42) actually fires sound/popup/in-app-toast per the configured event×channel grid at runtime"
    test: "After confirming GET /callcenter/settings/operator/notifications returns 200 (not 429), configure sound+popup for incoming/missed; trigger both with tab visible and hidden"
    expected: "Matrix loads; configured channels fire; browser notification when tab hidden; locks respected"
    why_human: "Throttle mis-scope (G-09-1) is fixed in code; actual audio/OS notification playback still requires a live browser session"
  - truth: "Auto-pause rule engine (D-15) correctly transitions an agent to PAUSED at configured RONA/missed-count/idle-time/status-duration thresholds under live AMI ordering"
    test: "As SUPERVISOR/ADMIN open Call Center Settings → Auto-pause; add missed_count/idle_time/status_duration rules and save; drive live/staging AMI sequences against those thresholds"
    expected: "Rules persist and reload; agent auto-pauses exactly once per breach with correct reason; no double-fire"
    why_human: "G-09-2 config API/UI is verified in code + unit tests; true AMI event-ordering races need a live event stream"
human_verification:
  - test: "Re-UAT G-09-1 unblock: open Моя панель → Уведомления (or Settings notifications); confirm GET operator/notifications is 200; then configure sound+popup and trigger incoming/missed with tab visible and hidden"
    expected: "No 429 on notification settings load; sound/popup/toast fire per matrix; browser notification when hidden"
    why_human: "Code removes parallel ai throttler; only a live SPA session proves 429 is gone and audio/OS channels work"
  - test: "Re-UAT G-09-2 unblock: as SUPERVISOR/ADMIN open Call Center Settings → tab «Автопауза»/Auto-pause; add/edit/save missed_count, idle_time, status_duration; confirm RONA info is read-only; then drive live AMI missed/idle/WRAPUP sequences"
    expected: "Tab visible; rules save and reload; non-supervisor sees read-only; live auto-pause fires at thresholds once"
    why_human: "Config surface is code-verified; live AMI ordering and end-to-end pause transition need staging"
---

# Phase 9: Call Center Agent Panel Verification Report

**Phase Goal:** Rework agent ARM (`CallCenterAgentPage`): primary tabs Coworkers / Queues / Waiting; softphone as floating widget + incoming-call toast with call controls and dialpad; rename Ready → Waiting for call; KPI answered/missed in status bar (all channels); per-queue answered/missed; transfer / ChanSpy / hangup by role; pickup from waiting; expand call-control toward professional call-center practices; operator call history; transfer directory.

**Verified:** 2026-07-23T09:20:00Z  
**Status:** human_needed  
**Re-verification:** Yes — after UAT gap-closure plans **09-16** (G-09-1) and **09-17** (G-09-2)

**Requirement basis:** No REQUIREMENTS.md IDs mapped to Phase 9. Verified against Implementation Decisions **D-01…D-46** from `09-CONTEXT.md`, prior `09-VERIFICATION.md` truths, and gap-plan must_haves from `09-16-PLAN.md` / `09-17-PLAN.md`.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Primary tabs Coworkers / Queues / Waiting exist, hybrid panels (≥1024px) / tabs (<768px) (D-04) | ✓ VERIFIED | `CallCenterAgentPage.tsx` — `PANEL_ORDER` / hybrid layout (regression intact) |
| 2 | Softphone floating widget; incoming call non-modal toast with controls (D-01, D-02) | ✓ VERIFIED | `SoftphoneWidget` + `IncomingCallToast` mounted (prior + unchanged) |
| 3 | READY relabeled "Ожидание звонка" / "Waiting for call" (D-13) | ✓ VERIFIED | `displayLabels.ts` + tests |
| 4 | KPI answered/missed in status bar, all channels, shift+day (D-08, D-11, D-12, D-14) | ✓ VERIFIED | AMI KPI + `AgentStatusBar` |
| 5 | Per-queue answered/missed (D-31, D-32) | ✓ VERIFIED | `QueuesTab` + stats query |
| 6 | Transfer / ChanSpy / hangup gated by role (D-21…D-26) | ✓ VERIFIED | `CoworkersTab` + permissions |
| 7 | Pickup from Waiting tab (D-06/D-18/D-19) | ✓ VERIFIED | `WaitingTab` → `agentPickCall` |
| 8 | Call-control expanded: zombie-reset, park/retrieve, conference, warm-transfer, click-to-call — reachable (D-27…D-29) | ✓ VERIFIED | `CallControlBar` full + `ParkedCallsIndicator` + history (09-15; still wired) |
| 9 | Operator call history in panel (D-34, D-35) | ✓ VERIFIED | `history` panel mounts `CallHistoryPanel` |
| 10 | Transfer directory with BLF, usable for transfer (D-36, D-37) | ✓ VERIFIED | Transfer Modal `TransferDirectory mode="transfer"` |
| 11 | UI customization tab/card visibility + softphone placement (D-05, D-06) | ✓ VERIFIED | Settings + UI customization query |
| 12 | Granular permissions role default + override + locks (D-38…D-40) | ✓ VERIFIED | PermissionsService + settings UI |
| 13 | Notifications matrix event×channel, per-operator + locks (D-41…D-43) — **wiring + throttle** | ✓ VERIFIED | Matrix UI/API + **G-09-1 closed** (single `global` throttler); runtime audio → human |
| 14 | i18n ru+en; mobile-first (D-44, D-46) | ✓ VERIFIED | Locales + `useIsMobile`; autoPause keys added |
| 15 | **G-09-1:** SPA call-center GETs (incl. operator/notifications) use only app-wide 60/min `global`; AI POST is route-scoped 10/min; no parallel named `ai` forRoot | ✓ VERIFIED | See Gap Closure G-09-1 below |
| 16 | **G-09-2:** Supervisor/admin can configure tenant auto-pause rules (missed_count / idle_time / status_duration); RONA not writable; persists to `cc_settings.autopause_rules` | ✓ VERIFIED | See Gap Closure G-09-2 below |

**Score:** 16/16 truths verified (2 present, behavior-unverified runtime items — notification audio, auto-pause AMI ordering)

### Gap Closure Detail

#### G-09-1 (09-16) — throttle scope

| Check | Status | Evidence |
|-------|--------|----------|
| `ThrottlerModule.forRoot` has exactly one named profile `global` 60/min | ✓ | `app.module.ts` lines ~173–177; no `name: 'ai'` in forRoot |
| AI POST `/ai-chat/message` `@Throttle({ global: { limit: 10, ttl: 60000 } })` | ✓ | `ai-chat.controller.ts` `@Post('message')` |
| Intentional bypasses use named `@SkipThrottle({ default: true, global: true })` | ✓ | ai-chat GET/settings (4) + endpoints bulk (2); **zero** bare `@SkipThrottle()` in those files |
| No SkipThrottle paper-over on operator/notifications | ✓ | `callcenter-settings.controller.ts` GET/PUT `operator/notifications` have no SkipThrottle |
| Repo-wide: no `@Throttle({ ai: … })` / `name: 'ai'` forRoot | ✓ | ripgrep across `packages/backend/src` — no matches |

#### G-09-2 (09-17) — autopause config surface

| Check | Status | Evidence |
|-------|--------|----------|
| `sanitizeAutopauseRules` whitelist triad; drops `rona`/unknown; non-array → `[]` | ✓ | `callcenter-settings.service.ts`; Jest: `drops unknown types including fabricated rona-like entries` |
| `UpdateCcSettingsDto.autopause_rules` + `updateTenantSettings` patch | ✓ | DTO + service; test `persists sanitized autopause_rules` |
| PUT `/callcenter/settings/tenant` gated by `assertSupervisor` | ✓ | Controller `assertSupervisor` (SUPERADMIN/ADMIN/SUPERVISOR) |
| GET tenant / defaults expose `autopause_rules: []` | ✓ | `DEFAULT_TENANT_SETTINGS` |
| Engine reads rules unchanged | ✓ | `CallCenterAutoPauseService.getRules` → `autopause_rules ?? []` |
| `AutoPauseRulesForm` on Settings tab `autoPause` | ✓ | `CallCenterSettingsPage` TAB_IDS + `renderPanel` |
| RONA read-only info; only triad editable | ✓ | `RULE_TYPES` + `ronaInfo` callout; no rona option |
| SUPERVISOR/ADMIN `canEdit` gate | ✓ | Same pattern as `AlertThresholdsForm` |
| i18n `callcenter.settings.tabs.autoPause` + `autoPause.*` ru+en | ✓ | `en.ts` / `ru.ts` |

### Deferred Items

None actionable. Queue/group transfer CTA inside `TransferDirectory` remains a documented 09-15 follow-up (not a UAT gap).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app.module.ts` ThrottlerModule | Single `global` profile | ✓ VERIFIED | G-09-1 |
| `ai-chat.controller.ts` | Route-scoped AI POST + named skips | ✓ VERIFIED | G-09-1 |
| `endpoints.controller.ts` | Named SkipThrottle | ✓ VERIFIED | G-09-1 |
| `sanitizeAutopauseRules` + DTO write path | Tenant autopause persistence | ✓ VERIFIED | G-09-2 |
| `AutoPauseRulesForm.tsx` | Tenant settings editor | ✓ VERIFIED | Mounted on `autoPause` tab |
| `CallCenterSettingsPage.tsx` | `autoPause` tab | ✓ VERIFIED | Wired |
| Prior Phase 9 surfaces (page orchestrator, softphone, tabs, etc.) | Unchanged after gap plans | ✓ VERIFIED | Regression: mounts still present |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `APP_GUARD` ThrottlerGuard | all routes without named skip | `forRoot([{ name: 'global', … }])` only | ✓ WIRED | G-09-1 |
| AI POST message | stricter 10/min | `@Throttle({ global: { limit: 10, ttl: 60000 } })` | ✓ WIRED | G-09-1 |
| GET operator/notifications | inherits `global` only | no dedicated SkipThrottle | ✓ WIRED | Intentional — not paper-over |
| PUT tenant settings | `updateTenantSettings` → `autopause_rules` | `assertSupervisor` → sanitize | ✓ WIRED | G-09-2 |
| GET tenant → `AutoPauseRulesForm` | `useGetTenantSettingsQuery` → `autopause_rules` | RTK + form state | ✓ WIRED | G-09-2 |
| Form save | PUT tenant | `useUpdateTenantSettingsMutation({ autopause_rules })` | ✓ WIRED | G-09-2 |
| Engine | `cc_settings.autopause_rules` | `getRules` | ✓ WIRED | No engine change required |
| Prior 09-15 page links | CallControlBar / Parked / History / TransferDirectory | orchestrator | ✓ WIRED | Regression |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `AutoPauseRulesForm` | `rules` | GET tenant `autopause_rules` → sanitize on PUT | Yes (DB JSON column) | ✓ FLOWING |
| Notification matrix settings | operator matrix | GET operator/notifications (now under global only) | Yes (when not 429) | ✓ FLOWING (throttle fixed; human re-confirms) |
| Prior history/control/directory | unchanged | prior pipelines | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Autopause sanitize + updateTenantSettings | `npx jest callcenter-settings.service.spec.ts --forceExit` | 27/27 passed incl. rona-drop + persist | ✓ PASS |
| forRoot single global | node parse of `ThrottlerModule.forRoot([...])` | `forRoot ok` (no `ai`) | ✓ PASS |
| AI POST throttle decorator | rg `@Throttle({ global: { limit: 10` | Present on POST message | ✓ PASS |
| AutoPauseRulesForm mount | rg on Settings page | `autoPause` tab → `<AutoPauseRulesForm />` | ✓ PASS |
| Page orchestrator regression | rg CallCenterAgentPage | CallControlBar / Parked / History / TransferDirectory present | ✓ PASS |

### Probe Execution

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| — | — | No phase-declared `scripts/*/tests/probe-*.sh` | SKIP |

### Requirements Coverage (D-01…D-46 + UAT gaps)

| Decision / Gap | Description | Status | Evidence |
|----------------|-------------|--------|----------|
| D-01…D-14, D-16…D-40, D-44…D-46 | Prior phase scope | ✓ SATISFIED | Unchanged from prior verification |
| D-15 | Auto-pause rules | ✓ SATISFIED (config+engine wiring); ⚠️ live AMI human | **G-09-2 closed** — API/UI/i18n |
| D-41…D-43 | Notification matrix | ✓ SATISFIED (wiring+throttle); ⚠️ audio human | **G-09-1 closed** — 429 root cause fixed |
| G-09-1 | Throttle crush of notifications GET | ✓ CLOSED | Code evidence above |
| G-09-2 | Missing autopause Settings UI/API | ✓ CLOSED | Code evidence above |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| Gap-touched files (app.module, ai-chat, endpoints, settings service/form) | — | No `TBD`/`FIXME`/`XXX` | — | Debt-marker gate: clean |
| — | — | No bare `@SkipThrottle()` left on intentional bypass sites | — | G-09-1 acceptance met |

### Human Verification Required

1. **Re-UAT notifications after G-09-1 (D-41/D-42)**  
   **Test:** Load Моя панель → Уведомления; confirm GET `/api/callcenter/settings/operator/notifications` is **200** (not 429); configure sound+popup; trigger incoming/missed with tab visible and hidden.  
   **Expected:** Matrix loads under SPA traffic; channels fire; browser notification when hidden.  
   **Why human:** Throttle structure is code-verified; live 429 absence + audio/OS permissions are runtime.

2. **Re-UAT auto-pause after G-09-2 (D-15)**  
   **Test:** SUPERVISOR/ADMIN → Call Center Settings → **Автопауза** tab; add/save triad rules; confirm RONA info only; then drive live AMI missed/idle/WRAPUP.  
   **Expected:** Config persists; read-only for operators; single pause per threshold with correct reason.  
   **Why human:** Config path unit-tested; AMI ordering needs staging.

**Do not mark Phase 9 complete in ROADMAP** until these human items pass via `/gsd-verify-work 9`.

### Gaps Summary

UAT gaps **G-09-1** and **G-09-2** are **closed in code** (plans 09-16, 09-17). No remaining BLOCKER wiring gaps.

Prior phase orchestrator wiring (09-15) remains intact. Status is **human_needed** solely for runtime re-UAT of notifications (post-throttle fix) and auto-pause under live AMI (post-config UI).

**Next command:** `/gsd-verify-work 9`

---

_Verified: 2026-07-23T09:20:00Z_  
_Verifier: Claude (gsd-verifier)_
