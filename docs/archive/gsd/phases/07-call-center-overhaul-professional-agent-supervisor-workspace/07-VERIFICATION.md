---
phase: 07-call-center-overhaul-professional-agent-supervisor-workspace
verified: 2026-07-16T12:10:00Z
status: human_needed
score: 16/16 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 12/12
  gaps_closed:
    - "setMyAgentInterface dispatched after agentLogin and cleared on logout (CallCenterAgentPage)"
    - "ShiftLoginModal requires ≥1 queue so AMI QueueAdd can run"
    - "SSE fallback binds myAgentInterface by userId when interface is null"
    - "ASTERISK_WSS_URL documented in .env.example + clearer missing-WSS locales"
  gaps_remaining: []
  regressions: []
  uat_blockers_code_closed: true
  note: "UAT Tests 1–2 PRIMARY/SECONDARY code fixes landed via 07-21/07-22; live re-UAT still required"
human_verification:
  - test: "Re-UAT Test 1 — Full agent happy-path on /callcenter/agent (gap closure 07-21)"
    expected: "Start Shift with ≥1 queue → status leaves OFFLINE (READY); End Shift → OFFLINE; inbound queue call → card/hold/transfer/wrap-up; call in reports"
    why_human: "Code binds myAgentInterface and requires queues; live AMI/queue traffic and browser session still required"
  - test: "Re-UAT Test 2 — WebRTC browser mode end-to-end (gap closure 07-21 + 07-22)"
    expected: "With ASTERISK_WSS_URL set: REGISTER over WSS; answer/hold/mute/DTMF/transfer in browser. With unset: toast names ASTERISK_WSS_URL and modal stays open"
    why_human: "Needs real PJSIP WSS endpoint, mic permissions, ICE/NAT; env must be set on deploy"
  - test: "Wallboard TV display-token flow (07-13) — was UAT-blocked"
    expected: "Create token on settings → open /callcenter/wallboard?token=… without login → KPI/agents/queues; revoke stops SSE"
    why_human: "Previously blocked by ARM failure; re-test after shift login works"
  - test: "Role-based nav DOM presence — was UAT-blocked"
    expected: "Operator sees only АРМ оператора; supervisor sees agent/supervisor/wallboard/reports; admin also sees settings; operator deep-link to /callcenter/supervisor redirects home"
    why_human: "RequireRole and buildNavigation need logged-in sessions per UserLevel"
  - test: "Settings D-40 pause-reasons + operator picker (07-19) — was UAT-blocked"
    expected: "Admin opens /callcenter/settings → Причины пауз CRUD works; Настройки операторов → pick another operator → save persists via /operator/:operatorId"
    why_human: "Static wiring verified; live CRUD/IDOR UX needs authenticated admin session"
---

# Phase 07: Call Center overhaul — Verification Report

**Phase Goal:** Professional agent and supervisor workspaces, wallboard, call cards, reporting/analytics, WebRTC softphone, AI-ready foundation (D-01…D-45).

**Verified:** 2026-07-16T12:10:00Z  
**Status:** human_needed  
**Re-verification:** Yes — after UAT gap closure (07-21, 07-22)  
**Score:** 16/16 must-haves verified  
**UAT blockers closed in code:** Yes

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | ------- | ---------- | -------------- |
| 1 | Metrics engine persists history, restores today, reconciles queue_log, hybrid rollup (D-03/05/06/07/08/09) | ✓ VERIFIED | Quick regression; prior evidence stands |
| 2 | `/callcenter/*` namespace, legacy redirects, role-based nav (D-37/38/39) | ✓ VERIFIED | Quick regression; `RequireRole` / redirects unchanged |
| 3 | Settings page tabs complete per D-40 (cards, pause reasons, alerts, operator settings, display tokens) | ✓ VERIFIED | Prior gap closure 07-19; no regression |
| 4 | Agent 4-zone ARM: pick, DnD transfer, wrap-up, notifications, client card (D-18–21) | ✓ VERIFIED | **UAT blocker closed (07-21):** `handleShiftLogin` binds identity after `agentLogin`; `selectMyAgent` can resolve; gates no longer permanently OFFLINE |
| 5 | Supervisor: detail modal, queue modal, bulk, live actions, sparklines, grid↔table, spy (D-23–25) | ✓ VERIFIED | Quick regression |
| 6 | Wallboard TV + display tokens + alert thresholds/routing (D-26–29) | ✓ VERIFIED | Quick regression |
| 7 | Call cards DnD builder, field types, auto_open_on, CRM webhook (D-10–13) | ✓ VERIFIED | Quick regression |
| 8 | Internal chat REST+SSE+DB history (D-30–32) | ✓ VERIFIED | Quick regression |
| 9 | Seven reports + CSV/XLSX/PDF + shared AgentTimeline (D-33/34/36) | ✓ VERIFIED | Quick regression |
| 10 | Automated report schedules via notification_integration (D-35) | ✓ VERIFIED | Quick regression |
| 11 | WebRTC softphone full v1 (D-14–17) | ✓ VERIFIED | **UAT blockers closed (07-21/07-22):** identity bind + queue gate + documented WSS + toast/throw on null `wssUrl` |
| 12 | AI-ready: typed event bus, CallCenterAiAdapter, ARI PCM skeleton, research D-43/45 (D-41–45) | ✓ VERIFIED | Quick regression |
| 13 | **(UAT/07-21)** `setMyAgentInterface` dispatched after successful `agentLogin` and cleared on logout | ✓ VERIFIED | `CallCenterAgentPage.tsx`: `bindIdentity()` after `agentLogin().unwrap()` on SIP+WebRTC (L362–378); `handleLogout` → `setMyAgentInterface(null)` (L396); missing-WSS path throws before bind (L353–355) |
| 14 | **(UAT/07-21)** ShiftLoginModal requires ≥1 queue before confirm | ✓ VERIFIED | `isQueuesSelectionValid(queues)` gate (L184–186); `queuesRequired` en/ru; `cc:lastShiftQueues` via `shiftLoginQueues.ts`; unit tests green |
| 15 | **(UAT/07-21)** SSE fallback binds interface by `userId` when `myAgentInterface` is null | ✓ VERIFIED | `maybeBindMyAgentInterface` in `useCallCenterSSE.ts` after `fullSnapshot`/`agentUpdate`; never overwrites non-null; tests cover bind + no-overwrite |
| 16 | **(UAT/07-22)** `ASTERISK_WSS_URL` in `.env.example` + clearer missing-WSS locales | ✓ VERIFIED | `.env.example` Call Center/WebRTC section; en/ru `webrtcConfigMissing` names `ASTERISK_WSS_URL`; controller JSDoc; no invented pjsip/http.conf |

**Debt-marker gate:** ✓ PASS — no bare `TBD`/`FIXME`/`XXX` in gap-closure files; SIP mute still `DEF-07-MUTE-AMI`.

**Score:** 16/16 truths verified

### Gaps Closed (this re-verification)

| Previous UAT blocker | Closure plan | Evidence |
| --- | --- | --- |
| Test 1 PRIMARY — never `setMyAgentInterface` after login → permanent OFFLINE | 07-21 | `bindIdentity()` after `agentLogin` unwrap; optimistic READY `updateAgent`; logout clears |
| Test 1 CONTRIBUTING — empty `queues[]` skips AMI QueueAdd | 07-21 | Modal blocks `queues.length === 0`; last queues restore/persist |
| Test 1/2 — SSE cannot recover identity | 07-21 | `maybeBindMyAgentInterface` by `userId` when interface null |
| Test 2 SECONDARY — unset `ASTERISK_WSS_URL` silent/unclear | 07-22 | `.env.example` + locales name env var; toast+throw keeps modal open |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `CallCenterAgentPage.tsx` | dispatch setMyAgentInterface after login; clear on logout; fail-closed missing WSS | ✓ VERIFIED | Exists, substantive, wired; Level 4: identity from `ShiftLoginResult.interface` |
| `ShiftLoginModal.tsx` | ≥1 queue required; last queues restore | ✓ VERIFIED | Uses `isQueuesSelectionValid` / load/save helpers |
| `shiftLoginQueues.ts` | validate / load / save queues | ✓ VERIFIED | Extracted helper +  unit tests |
| `useCallCenterSSE.ts` | userId→interface fallback | ✓ VERIFIED | `maybeBindMyAgentInterface` on snapshot + agentUpdate |
| `.env.example` | ASTERISK_WSS_URL + SIP_DOMAIN | ✓ VERIFIED | Call Center / WebRTC section present |
| `callcenter-webrtc.controller.ts` | JSDoc + null wssUrl when unset | ✓ VERIFIED | Runtime unchanged; Jest 6/6 pass |
| `en.ts` / `ru.ts` | queuesRequired + webrtcConfigMissing names ASTERISK_WSS_URL | ✓ VERIFIED | Both locales updated |
| Core CC stack (prior) | Phase goal surfaces | ✓ VERIFIED | Quick regression |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `handleShiftLogin` | `callCenterSlice.myAgentInterface` | `dispatch(setMyAgentInterface(result.interface))` after unwrap | ✓ WIRED | Both SIP and WebRTC branches |
| `handleLogout` | `myAgentInterface` | `dispatch(setMyAgentInterface(null))` | ✓ WIRED | After `agentLogout` |
| `ShiftLoginModal.handleConfirm` | `onConfirm` | blocked when `!isQueuesSelectionValid` | ✓ WIRED | No confirm on empty queues |
| `useCallCenterSSE` | `setMyAgentInterface` | `maybeBindMyAgentInterface` | ✓ WIRED | Only when null + userId match + not OFFLINE |
| `selectMyAgent` | CallCard / hold / transfer / wrap-up | `myAgent` truthy | ✓ WIRED | Unchanged selector; now reachable after bind |
| `getConfig` | `process.env.ASTERISK_WSS_URL` | `wssUrl` null when unset | ✓ WIRED | Spec confirms null/set behavior |
| `handleShiftLogin` | toast + throw `webrtcConfigMissing` | early return when `!wssUrl` | ✓ WIRED | Modal catch keeps dialog open |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| CallCenterAgentPage | `myAgentInterface` / `myAgent` | dispatch after agentLogin + SSE fallback | Login result.interface; SSE agents[].userId | ✓ FLOWING |
| ShiftLoginModal | `queues` | MultiSelect + `cc:lastShiftQueues` | User selection / localStorage | ✓ FLOWING |
| useCallCenterSSE | agents → bind | EventSource fullSnapshot/agentUpdate | Backend SSE | ✓ FLOWING |
| webrtc config | `wssUrl` | `ASTERISK_WSS_URL` env | Deploy env (null if unset — intentional) | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Selectors / SSE / slice / shiftLoginQueues | `npx vitest run …` (4 files) | 38 passed | ✓ PASS |
| WebRTC controller | `npx jest callcenter-webrtc.controller.spec.ts` | 6 passed | ✓ PASS |
| Login bind present | grep `setMyAgentInterface` in AgentPage | after unwrap + null on logout | ✓ PASS |
| Queue gate | grep `isQueuesSelectionValid` / `queuesRequired` | wired + i18n | ✓ PASS |
| Env docs | grep `ASTERISK_WSS_URL` in `.env.example` + locales | present | ✓ PASS |
| Live AMI/WebRTC E2E | — | requires running Asterisk + deploy env | ? SKIP |

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| — | — | No phase-declared `probe-*.sh` | SKIP |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
| ----------- | -------------- | ----------- | ------ | -------- |
| D-01…D-13, D-16, D-18…D-45 | 07-01…07-20 | Prior phase decisions | Consistent SATISFIED | Prior verification; no regressions found |
| D-14 | 07-14, **07-21**, **07-22** | Softphone + WebRTC config clarity | ✓ SATISFIED | Identity bind + WSS docs/locales |
| D-15 | 07-14, **07-21** | Shift login / queue membership | ✓ SATISFIED | ≥1 queue + myAgentInterface bind |
| D-17 | 07-14, **07-22** | WebRTC runtime config from env | ✓ SATISFIED | Documented ASTERISK_WSS_URL; null wssUrl path clear |
| D-22 / D-40 | 07-19 | Operator settings / pause reasons | ✓ SATISFIED | Prior gap closure |

**Orphaned REQUIREMENTS.md IDs for Phase 07:** none.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `CallCenterWallboardPage.tsx` | ~41–44 | Hardcoded TV thresholds (documented) | ⚠️ Warning | Visual tones ≠ tenant cc_settings |
| Spy UI / `supervisorSpy` | — | `oper_chanspy` user flag unused | ⚠️ Warning | All supervisors can spy |
| SIP mute (tracked) | AgentPage | Local UI only in SIP mode | ℹ️ Info | DEF-07-MUTE-AMI — not a blocker |

No bare `TBD`/`FIXME`/`XXX` in 07-21/07-22 modified sources.

### Human Verification Required

### 1. Re-UAT Test 1 — Agent happy-path (07-21)

**Test:** On `/callcenter/agent`, Start Shift with ≥1 queue; confirm status → READY; End Shift → OFFLINE; receive inbound; hold/transfer/wrap-up; report row.  
**Expected:** Full cycle works; empty-queue Start Shift shows `queuesRequired` and does not start.  
**Why human:** Needs Asterisk + real calls; UAT previously failed before code fix.

### 2. Re-UAT Test 2 — WebRTC mode (07-21 + 07-22)

**Test:** Set deploy `ASTERISK_WSS_URL`; ShiftLoginModal → WebRTC → REGISTER/answer/hold/mute/DTMF/transfer. Also verify unset env shows toast naming `ASTERISK_WSS_URL` and keeps modal open.  
**Expected:** Softphone works when WSS configured; clear ops error when not.  
**Why human:** Media/ICE/NAT + real env.

### 3. Wallboard display token (was blocked)

**Test:** Create token → open TV URL private window → revoke.  
**Expected:** Read-only wallboard; revoke disconnects.  
**Why human:** Cross-session token auth UX; previously blocked by ARM failure.

### 4. Role menu matrix (was blocked)

**Test:** Login as operator / supervisor / admin; inspect nav DOM and deep links.  
**Expected:** Matches D-38/D-39.  
**Why human:** Session-dependent UI.

### 5. Settings gap-closure (07-19, was blocked)

**Test:** As ADMIN, CRUD pause reasons; pick another operator and save; reload confirms persistence.  
**Expected:** Pause catalog and by-id operator settings work end-to-end.  
**Why human:** Live auth + DB round-trip.

### Gaps Summary

UAT blocker root causes from `07-UAT.md` / `DEBUG-cc-agent-shift.md` / `DEBUG-cc-webrtc.md` are **closed in code** via plans **07-21** and **07-22**:

1. **Identity bind** — `setMyAgentInterface` after successful `agentLogin`; cleared on logout; SSE userId fallback.
2. **Queue gate** — modal requires ≥1 queue; last selection persisted.
3. **Missing WSS visibility** — `.env.example` + locales name `ASTERISK_WSS_URL`; toast + throw keep modal open.

Automated must-haves: **16/16**. No `gaps_found` remaining for code. Status remains **human_needed** pending re-UAT of Tests 1–2 (and previously blocked Tests 3–5).

---

_Verified: 2026-07-16T12:10:00Z_  
_Verifier: Claude (gsd-verifier)_
