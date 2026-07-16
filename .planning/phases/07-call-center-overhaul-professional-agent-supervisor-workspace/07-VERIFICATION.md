---
phase: 07-call-center-overhaul-professional-agent-supervisor-workspace
verified: 2026-07-16T03:30:00Z
status: gaps_found
score: 11/12 must-haves verified
overrides_applied: 0
gaps:
  - truth: "/callcenter/settings delivers complete D-40 tabs including functional pause-reasons management"
    status: failed
    reason: "pauseReasons tab still renders placeholder Text; create/update/delete PauseReason RTK hooks exist but are never used in any UI component. D-40 and 07-02 must_have require «Причины пауз» as a real settings surface."
    artifacts:
      - path: "packages/frontend/src/pages/CallCenterSettingsPage/CallCenterSettingsPage.tsx"
        issue: "activeTab === 'pauseReasons' falls through to t('callcenter.settings.placeholder') (L54)"
      - path: "packages/frontend/src/shared/api/endpoints/callCenterApi.ts"
        issue: "useCreatePauseReasonMutation / useUpdatePauseReasonMutation / useDeletePauseReasonMutation exported but orphaned (no consumer under pages/ or features/)"
    missing:
      - "PauseReasonsManager (or equivalent) mounted on pauseReasons tab with list CRUD against existing /callcenter/pause-reasons API"
      - "Operator picker on operatorSettings tab wired to GET/PUT /callcenter/settings/operator/:operatorId so admin can edit other operators (supervisor API exists, frontend only calls /operator self)"
  - truth: "No unresolved TBD/FIXME/XXX debt markers in phase-modified files"
    status: failed
    reason: "CallCenterAgentPage.tsx L313 contains 'AMI MuteAudio TBD' without issue/PR/DEF reference — debt-marker gate is a blocker."
    artifacts:
      - path: "packages/frontend/src/pages/CallCenterAgentPage/CallCenterAgentPage.tsx"
        issue: "Comment: Mute toggle — WebRTC uses local track; SIP mode keeps local UI state (AMI MuteAudio TBD)"
    missing:
      - "Implement AMI MuteAudio for SIP mode, or replace TBD with tracked follow-up (issue #N / DEF-*)"
human_verification:
  - test: "Full agent happy-path on /callcenter/agent"
    expected: "Login → inbound queue call → card auto-opens with phonebook data → hold/transfer → wrap-up → call appears in reports"
    why_human: "Requires live Asterisk AMI/queue traffic and browser media; cannot be proven by static grep"
  - test: "WebRTC browser mode end-to-end"
    expected: "ShiftLoginModal WebRTC mode registers over WSS; answer/hold/mute/DTMF/transfer work entirely in browser"
    why_human: "Needs real PJSIP WSS endpoint, mic permissions, and ICE/NAT conditions"
  - test: "Wallboard TV display-token flow (07-13)"
    expected: "Create token on settings → open /callcenter/wallboard?token=… without login → KPI/agents/queues; revoke stops SSE"
    why_human: "Cross-session TV UX and token lifecycle need a real browser"
  - test: "Role-based nav DOM presence"
    expected: "Operator sees only АРМ оператора; supervisor sees agent/supervisor/wallboard/reports; admin also sees settings; operator deep-link to /callcenter/supervisor redirects home"
    why_human: "RequireRole and buildNavigation need logged-in sessions per UserLevel"
---

# Phase 07: Call Center overhaul — Verification Report

**Phase Goal:** Professional agent and supervisor workspaces, wallboard, call cards, reporting/analytics, WebRTC softphone, AI-ready foundation (D-01…D-45).

**Verified:** 2026-07-16T03:30:00Z  
**Status:** gaps_found  
**Re-verification:** No — initial verification  
**Score:** 11/12 must-haves verified

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Metrics engine persists history, restores today, reconciles queue_log, hybrid rollup (D-03/05/06/07/08/09) | ✓ VERIFIED | `cc_queue_calls` model + history writer + `CallCenterMetricsService.restoreToday` + reconciler/rollup; AMI `historyWriter.enqueue` / `metricsService.record*`; 147 CC Jest tests pass |
| 2 | `/callcenter/*` namespace, legacy redirects, role-based nav (D-37/38/39) | ✓ VERIFIED | `router.tsx` redirects `/operator`→agent, `/supervisor`→supervisor; `RequireRole` on supervisor/reports/settings; `buildNavigation` set-membership for OPERATOR/SUPERVISOR/ADMIN; agent route unguarded for D-39 |
| 3 | Settings page tabs complete per D-40 (cards, **pause reasons**, alerts, operator settings, display tokens) | ✗ FAILED | Tab chrome includes `pauseReasons` but panel is placeholder (`CallCenterSettingsPage.tsx` L54). Pause-reason CRUD API/RTK exist; UI never mounts. Operator tab only edits **self** via `/operator`; supervisor `/:operatorId` endpoints unwired on frontend |
| 4 | Agent 4-zone ARM: pick, DnD transfer, wrap-up, notifications, client card (D-18–21) | ✓ VERIFIED | Zones A/B/C/D in `CallCenterAgentPage`; `DragTransferProvider`; `WrapupBar`; `useCallNotifications` + `operatorSettings`; pick gated by `pickup_enabled`; `ClientCard` / call-card popup |
| 5 | Supervisor: detail modal, queue modal, bulk, live actions, sparklines, grid↔table, spy (D-23–25) | ✓ VERIFIED | `AgentDetailModal`, `QueueManagementModal`, `BulkActionsBar`, live redirect/hangup/spy, `Sparkline` + `cc:supervisor:view` localStorage; backend `supervisorSpy` ChanSpy |
| 6 | Wallboard TV + display tokens + alert thresholds/routing (D-26–29) | ✓ VERIFIED | Public wallboard + `useWallboardSSE` token auth; `DisplayTokensManager`; `AlertThresholdsForm` + `AlertRoutingForm`; `callcenter-alert.service` → `NotificationDispatcherService`. TV visual tones use local `WALLBOARD_DEFAULT_THRESHOLDS` (intentional comment — server alerts still use cc_settings) |
| 7 | Call cards DnD builder, field types, auto_open_on, CRM webhook (D-10–13) | ✓ VERIFIED | `TemplateBuilder` + `FieldRenderer` (14 types); `shouldAutoOpen` ring/answer/manual; `dispatchWebhook` via notification_integration |
| 8 | Internal chat REST+SSE+DB history (D-30–32) | ✓ VERIFIED | Chat controller/service; `cc_chat_*` migrations; SSE `ccChatMessage`; `ChatPanel`/`ChatThread` |
| 9 | Seven reports + CSV/XLSX/PDF + shared AgentTimeline (D-33/34/36) | ✓ VERIFIED | `CC_REPORT_IDS` whitelist (7); server CSV/XLSX; client PDF; `AgentTimeline` on reports page + `AgentDetailModal` |
| 10 | Automated report schedules via notification_integration (D-35) | ✓ VERIFIED | `cc_report_schedules` + scheduler cron + delivery service + `ReportSchedulesManager` settings tab |
| 11 | WebRTC softphone full v1 (D-14–17) | ✓ VERIFIED | `useWebRTCPhone` (sip.js UserAgent/Registerer, hold/mute/DTMF/transfer, ICE); `ShiftLoginModal`; `/callcenter/webrtc/config` STUN/TURN env. SIP-device mute is UI-only (see anti-patterns) |
| 12 | AI-ready: typed event bus, CallCenterAiAdapter, ARI PCM skeleton, research D-43/45 (D-41–45) | ✓ VERIFIED | `getTypedEventStream` / `cc-event-bus.types`; adapter registered with 5 tools; `attachPcmSkeleton` license-gated; RESEARCH.md documents aiPBX + NestJS+license choice; no AI-agent-as-operator schema (D-44) |

**Score:** 11/12 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `callcenter/models/queue-call.model.ts` | `cc_queue_calls` history | ✓ VERIFIED | Sequelize model, wired via writer |
| `callcenter-history-writer.service.ts` | Batched AMI persist | ✓ VERIFIED | enqueue + interval flush + specs |
| `callcenter-metrics.service.ts` | Accumulators + restoreToday | ✓ VERIFIED | ~301 lines; AMI + controller wired |
| `callcenter-queuelog-reconciler.service.ts` | queue_log backfill | ✓ VERIFIED | reconnect + cron; file/realtime readers |
| `callcenter-rollup.service.ts` | Nightly + hybrid query | ✓ VERIFIED | raw ≤90d / rollup >90d |
| `RequireRole.tsx` + `buildNavigation.ts` + `router.tsx` | CC routes/RBAC | ✓ VERIFIED | Wired |
| `CallCenterSettingsPage.tsx` | D-40 tab shell | ⚠️ PARTIAL | Shell + 5 functional tabs; **pauseReasons stub** |
| `OperatorSettingsForm.tsx` | Per-operator settings UI | ⚠️ PARTIAL | Self-only; no operator picker |
| `CallCenterAgentPage` + DragTransfer/WrapupBar | Agent ARM | ✓ VERIFIED | 4-zone layout wired |
| Supervisor modals + BulkActionsBar | D-23 ops | ✓ VERIFIED | Wired on supervisor page |
| `CallCenterWallboardPage` + DisplayTokensManager | TV wallboard | ✓ VERIFIED | Token SSE path |
| `TemplateBuilder` + cards service | Call cards | ✓ VERIFIED | DnD + webhook |
| Chat models/controller + ChatPanel | Internal chat | ✓ VERIFIED | REST+SSE+DB |
| Reports service + ReportsPage + AgentTimeline | Reporting | ✓ VERIFIED | 7 IDs + exports |
| Report schedules stack | D-35 | ✓ VERIFIED | Cron + delivery + UI |
| `useWebRTCPhone` + ShiftLoginModal | Softphone | ✓ VERIFIED | sip.js path |
| `callcenter-ai.adapter.ts` + media-bridge | AI foundation | ✓ VERIFIED | Module providers registered |
| Pause-reasons **settings UI** | D-40 «паузы» | ✗ MISSING | API only; settings tab placeholder |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| AMI complete/abandon | HistoryWriter.enqueue | sync push | ✓ WIRED | Pattern in ami service |
| AMI complete/abandon | MetricsService.record* | sync | ✓ WIRED | Specs cover restore/tenant |
| AMI reconnect | loadInitialState + reconcileRecent | ModuleRef | ✓ WIRED | ami.service.ts |
| Sidebar | buildNavigation(level) | selectUserLevel | ✓ WIRED | |
| router | RequireRole | supervisor/reports/settings | ✓ WIRED | |
| SettingsPage | OperatorSettingsForm / Alert* / Cards / Tokens / Schedules | tab render | ✓ WIRED | |
| SettingsPage | PauseReasons UI | pauseReasons tab | ✗ NOT_WIRED | Placeholder only |
| callCenterApi pause CRUD hooks | any settings component | mutations | ✗ ORPHANED | Defined, never imported outside API |
| Settings supervisor `/:operatorId` | frontend | RTK | ✗ NOT_WIRED | Controller exists; no RTK endpoints/UI |
| Cards save | notification_integration webhook | dispatchWebhook | ✓ WIRED | Tenant guard in service |
| Alert service | NotificationDispatcher | @Interval | ✓ WIRED | |
| Report scheduler | runReport + delivery | cron | ✓ WIRED | |
| Agent page | useWebRTCPhone + webrtc/config | connect(iceServers) | ✓ WIRED | |
| CallCenterAiAdapter | AiAdapterRegistry | onModuleInit | ✓ WIRED | |
| StateService | getTypedEventStream | RxJS map | ✓ WIRED | Specs |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| Agent page | SSE snapshot / agents/calls | `useCallCenterSSE` → Redux | AMI/state store | ✓ FLOWING |
| Metrics KPI | accumulators | AMI handlers + restoreToday(cc_queue_calls) | DB + live | ✓ FLOWING |
| Wallboard | queues/agents via token SSE | wallboard events | state store | ✓ FLOWING |
| Reports page | report rows | `runReport` SQL/raw/rollup | DB queries | ✓ FLOWING |
| Call card popup | template fields | templates API + phonebook lookup | DB | ✓ FLOWING |
| ChatPanel | messages | REST history + SSE | `cc_chat_messages` | ✓ FLOWING |
| OperatorSettingsForm | form state | getMyOperatorSettings | DB (self only) | ⚠️ PARTIAL |
| pauseReasons tab | — | placeholder Text | none | ✗ DISCONNECTED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Callcenter Jest suite | `npx jest --testPathPattern=callcenter` (backend) | 19 suites / 147 tests passed | ✓ PASS |
| Artifact existence sample | path size checks on 13 key files | all present, substantive line counts | ✓ PASS |
| Live AMI/WebRTC E2E | — | requires running Asterisk | ? SKIP |

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| — | — | No phase-declared `probe-*.sh`; not a migration/tooling phase | SKIP |

### Requirements Coverage

`.planning/REQUIREMENTS.md` has **no Phase 07 REQ-*** entries (MOH/IVR/phonebooks only). Trackable IDs are CONTEXT decisions **D-01…D-45**, declared across 18 PLAN frontmatters. Every ID appears in ≥1 plan.

| Requirement | Source Plan(s) | Description | Status | Evidence |
| ----------- | -------------- | ----------- | ------ | -------- |
| D-01 | 07-01 | Single phase / waves structure | ✓ SATISFIED | Informational; 18 plans in one phase dir |
| D-02 | 07-01 | Expert audit in RESEARCH | ✓ SATISFIED | `07-RESEARCH.md` gap analysis vs concepts |
| D-03 | 07-01, 07-03 | Metrics engine first | ✓ SATISFIED | MetricsService + history |
| D-04 | 07-01 | Full scope (WebRTC/chat/DnD) | ✓ SATISFIED | Delivered; settings pause tab gap is UI hole, not descoped feature area |
| D-05 | 07-01, 07-04 | 3-layer data + queue_log | ✓ SATISFIED | in-memory + cc_* + reconciler |
| D-06 | 07-03 | Restore accumulators on restart | ✓ SATISFIED | restoreToday |
| D-07 | 07-03, 07-05 | Per-queue SLA + tenant default | ✓ SATISFIED | servicelevel + cc_settings |
| D-08 | 07-04 | Fast reports under load | ✓ SATISFIED | hybrid raw/rollup |
| D-09 | 07-01 | Batched AMI history write | ✓ SATISFIED | HistoryWriter |
| D-10 | 07-11 | DnD card constructor | ✓ SATISFIED | TemplateBuilder |
| D-11 | 07-06, 07-11 | Field types v1 | ✓ SATISFIED | 14 types; file upload excluded |
| D-12 | 07-06, 07-11 | auto_open_on | ✓ SATISFIED | answer/ring/manual |
| D-13 | 07-06 | CRM webhook via notifications | ✓ SATISFIED | dispatchWebhook |
| D-14 | 07-14 | Full WebRTC feature set | ✓ SATISFIED | useWebRTCPhone (SIP mute gap noted) |
| D-15 | 07-14 | Shift mode modal | ✓ SATISFIED | ShiftLoginModal |
| D-16 | 07-14, 07-05 | Auto-answer + zip | ✓ SATISFIED | operator settings + softphone |
| D-17 | 07-14 | STUN/TURN env | ✓ SATISFIED | webrtc/config |
| D-18 | 07-08 | Pick + permission | ✓ SATISFIED | pickup_enabled gate |
| D-19 | 07-08 | Wrap-up extend/autosave | ✓ SATISFIED | WrapupBar + settings |
| D-20 | 07-08 | Sounds + Browser Notification | ✓ SATISFIED | useCallNotifications |
| D-21 | 07-08 | DnD transfer confirm | ✓ SATISFIED | DragTransfer dialog |
| D-22 | 07-05 | Per-operator settings entity | ⚠️ PARTIAL | Backend + self form; no multi-operator admin UI; operators cannot open settings (admin-only nav) |
| D-23 | 07-09, 07-17 | All supervisor features | ✓ SATISFIED | Modals/bulk/live/sparklines |
| D-24 | 07-09 | Grid↔table persist | ✓ SATISFIED | localStorage key |
| D-25 | 07-09 | Spy/Whisper/Barge | ✓ SATISFIED | ChanSpy Originate (`oper_chanspy` flag not enforced — WARNING) |
| D-26 | 07-10 | Display tokens | ✓ SATISFIED | Wallboard service + UI |
| D-27 | 07-05, 07-13 | Alert thresholds UI | ✓ SATISFIED | AlertThresholdsForm + cc_settings |
| D-28 | 07-10 | Alerts via notification_integration | ✓ SATISFIED | AlertRoutingForm + alert service |
| D-29 | 07-13 | Fixed wallboard layout | ✓ SATISFIED | KPI/chart/agents/queues |
| D-30 | 07-07 | REST+SSE chat transport | ✓ SATISFIED | |
| D-31 | 07-07 | DM/group/broadcast | ✓ SATISFIED | channel_key schemes |
| D-32 | 07-07 | Chat history in DB | ✓ SATISFIED | |
| D-33 | 07-12, 07-18 | Seven reports | ✓ SATISFIED | CC_REPORT_IDS |
| D-34 | 07-12, 07-18 | CSV/XLSX/PDF | ✓ SATISFIED | Server + client PDF |
| D-35 | 07-15 | Scheduled delivery | ✓ SATISFIED | |
| D-36 | 07-18 | Shared AgentTimeline | ✓ SATISFIED | Reports + detail modal |
| D-37 | 07-02 | /callcenter/* + redirects | ✓ SATISFIED | |
| D-38 | 07-02 | Role-based menu | ✓ SATISFIED | |
| D-39 | 07-02 | Supervisor as operator | ✓ SATISFIED | Agent in nav + unguarded route |
| D-40 | 07-02 | Settings tabs incl. pauses | ✗ BLOCKED | pauseReasons placeholder |
| D-41 | 07-16 | Event bus + AI adapter + PCM | ✓ SATISFIED | |
| D-42 | 07-16 | No AI schema reservation | ✓ SATISFIED | License gate; no AI columns in CC core |
| D-43 | 07-16 | NestJS+license over external | ✓ SATISFIED | RESEARCH + media-bridge gate |
| D-44 | 07-16 | No AI agent-as-operator | ✓ SATISFIED | Not in schema |
| D-45 | 07-16 | Research voice-robots + aiPBX | ✓ SATISFIED | RESEARCH.md cites both |

**Orphaned REQUIREMENTS.md IDs for Phase 07:** none (phase uses decision IDs only).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `CallCenterAgentPage.tsx` | 313 | `AMI MuteAudio TBD` (untracked) | 🛑 BLOCKER | Debt-marker gate; SIP-mode mute is local UI only |
| `CallCenterSettingsPage.tsx` | 54 | Settings placeholder for pauseReasons | 🛑 BLOCKER | D-40 incomplete |
| `CallCenterWallboardPage.tsx` | 41–44 | Hardcoded TV thresholds (documented backlog) | ⚠️ Warning | Visual tones ≠ tenant cc_settings; server alerts still correct |
| `ChatPanel.tsx` | ~140 | `window.prompt` for broadcast | ℹ️ Info | Functional but crude UX |
| `callcenter-metrics.service.ts` | ~257 | idleSeconds not restored | ℹ️ Info | Occupancy partial after restart |
| Spy UI / `supervisorSpy` | — | `oper_chanspy` user flag unused | ⚠️ Warning | All supervisors can spy |

### Human Verification Required

### 1. Agent happy-path

**Test:** On `/callcenter/agent`, login to queues, receive inbound, complete hold/transfer/wrap-up; confirm card auto-open and report row.  
**Expected:** Full cycle works with live AMI.  
**Why human:** Needs Asterisk + real calls.

### 2. WebRTC mode

**Test:** ShiftLoginModal → browser mode → register/answer/hold/mute/DTMF/transfer.  
**Expected:** Softphone works over WSS with mic.  
**Why human:** Media/ICE/NAT.

### 3. Wallboard display token

**Test:** Create token → open TV URL private window → revoke.  
**Expected:** Read-only wallboard; revoke disconnects.  
**Why human:** Cross-session token auth UX.

### 4. Role menu matrix

**Test:** Login as operator / supervisor / admin; inspect nav DOM and deep links.  
**Expected:** Matches D-38/D-39.  
**Why human:** Session-dependent UI.

### Gaps Summary

Phase 07 delivered the bulk of the corporate call-center goal: metrics/history, agent and supervisor ARMs, wallboard, call cards, chat, reports, schedules, WebRTC, and AI-ready hooks are present, wired, and covered by 147 backend unit tests.

Two blockers prevent goal closure:

1. **D-40 pause-reasons settings UI never shipped** — tab remains the 07-02 placeholder; pause CRUD is API-only. Closely related: **operator settings admin UX is incomplete** (self-edit only; supervisor `/:operatorId` unused).
2. **Untracked `TBD` debt marker** on SIP-mode mute in `CallCenterAgentPage.tsx`.

No later milestone phase claims these items, so they are not deferred.

---

_Verified: 2026-07-16T03:30:00Z_  
_Verifier: Claude (gsd-verifier)_
