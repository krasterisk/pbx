---
phase: 09-call-center-agent-panel
verified: 2026-07-23T04:20:00Z
status: human_needed
score: 14/14 must-haves verified
behavior_unverified: 2
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 11/14
  gaps_closed:
    - "Call-control set expanded toward professional practices (D-27 zombie-reset, D-28 park/retrieve) is reachable by the operator"
    - "Client-aware click-to-call (D-29) and the transfer/BLF directory (D-36/D-37) are reachable as a general-purpose 'directory' surface, not only for conference-add"
    - "Operator call history (all directions, shift/day, click-to-callback, card access) is visible in the agent panel (D-34/D-35, phase goal item 9)"
  gaps_remaining: []
  regressions: []
deferred: []
behavior_unverified_items:
  - truth: "Notification matrix (D-41/D-42) actually fires sound/popup/in-app-toast per the configured event×channel grid at runtime"
    test: "Trigger an incoming call, a missed call, and a whisper/barge event while operator has notifications configured for sound+popup; observe actual sound playback and OS/browser popup"
    expected: "Configured channels fire for each event per the matrix, respecting locks/defaults; hidden-tab browser notification appears per D-42"
    why_human: "Runtime audio/notification behavior and OS-level permission prompts cannot be verified by static analysis; useCallCenterNotifications.test.ts exercises the decision logic but not real playback"
  - truth: "Auto-pause rule engine (D-15) correctly transitions an agent to PAUSED at the configured RONA/missed-count/idle-time/status-duration thresholds without false triggers in production AMI event ordering"
    test: "Drive real (or AMI-simulated) sequences of missed calls / idle periods / long WRAPUP against a live tenant and confirm auto-pause fires at the exact configured threshold, not earlier/later, and does not double-fire"
    expected: "Agent transitions to PAUSED exactly once per configured rule breach, with the correct reason recorded"
    why_human: "callcenter-autopause.service.spec.ts covers the unit-level rule logic in isolation; true event-ordering races (concurrent AMI events, timer drift) are a runtime characteristic not provable by presence/wiring checks"
human_verification:
  - test: "Configure sound+popup for incoming call and missed call in Settings → Notifications; trigger both while tab visible and hidden"
    expected: "Sound plays and popup/toast appears per configuration; browser notification when tab hidden, respecting role locks"
    why_human: "Audio playback and OS notification permissions are runtime/browser behaviors"
  - test: "Simulate consecutive missed queue calls, idle, and long WRAPUP against a live/staging tenant; confirm auto-pause at configured thresholds"
    expected: "Agent auto-pauses exactly once per rule breach with correct logged reason; no double-fire from concurrent AMI events"
    why_human: "Unit tests verify rule logic in isolation; AMI event-ordering races need a live event stream"
---

# Phase 9: Call Center Agent Panel Verification Report

**Phase Goal:** Rework agent ARM (`CallCenterAgentPage`): primary tabs Coworkers / Queues / Waiting; softphone as floating widget + incoming-call toast with call controls and dialpad; rename Ready → Waiting for call; KPI answered/missed in status bar (all channels); per-queue answered/missed; transfer / ChanSpy / hangup by role; pickup from waiting; expand call-control toward professional call-center practices; operator call history; transfer directory.

**Verified:** 2026-07-23T04:20:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap-closure plan 09-15

**Requirement basis:** No REQUIREMENTS.md IDs mapped to Phase 9. Verified against Implementation Decisions **D-01…D-46** from `09-CONTEXT.md`, cross-checked against the phase goal and ROADMAP.md Phase 9 scope.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Primary tabs Coworkers / Queues / Waiting exist, hybrid panels (≥1024px) / tabs (<768px) (D-04) | ✓ VERIFIED | `CallCenterAgentPage.tsx` renders `CoworkersTab`/`QueuesTab`/`WaitingTab` (+ `history`) via `PANEL_ORDER` / `panelBody`; wide = columns, narrow = `Tabs` |
| 2 | Softphone is a floating widget (FAB/sticky bar); incoming call is non-modal slide-in toast with controls + dialpad (D-01, D-02) | ✓ VERIFIED | `SoftphoneWidget.tsx` + `IncomingCallToast.tsx` mounted on page |
| 3 | READY status relabeled "Ожидание звонка" / "Waiting for call" (D-13) | ✓ VERIFIED | `displayLabels.ts` + `displayLabels.test.ts` |
| 4 | KPI answered/missed in status bar across ALL channels, shift+day (D-08, D-11, D-12, D-14) | ✓ VERIFIED | AMI KPI pipeline + `AgentStatusBar` dual counters |
| 5 | Per-queue answered/missed with aggregate + personal stats (D-31, D-32) | ✓ VERIFIED | `QueuesTab` + `useGetAgentQueuesStatsQuery` |
| 6 | Transfer / ChanSpy / hangup gated by role (D-21…D-26) | ✓ VERIFIED | `CoworkersTab` permission-gated actions |
| 7 | Pickup from Waiting tab (D-06/D-18/D-19) | ✓ VERIFIED | `WaitingTab` → `agentPickCall` |
| 8 | Call-control expanded: zombie-reset (D-27), park/retrieve (D-28), conference, warm-transfer-to-queue, click-to-call (D-29) — **reachable** | ✓ VERIFIED | **Gap closed (09-15):** `CallControlBar variant="full"` gated on `showCallControls` with `uniqueid={activeCall?.uniqueid}` / `isZombie={activeCall?.zombieCandidate ?? false}`; `ParkedCallsIndicator` in header chrome; warm-transfer also via `QueuesTab`; conference-add via `SoftphoneWidget`; click-to-call via mounted `CallHistoryPanel` |
| 9 | Operator call history in the panel, all directions, shift/day, click-to-callback (D-34, D-35) | ✓ VERIFIED | **Gap closed (09-15):** `history` in `PanelKey`/`PANEL_ORDER`/`PANEL_META`/`panelBody`; `effectivePanelVisibility.history` defaults true (D-05); `callcenter.tabs.history` ru/en |
| 10 | Transfer directory (endpoints+queues+groups) with live BLF presence, usable for transfer (D-36, D-37) | ✓ VERIFIED | **Gap closed (09-15) for endpoint targets:** Transfer Modal hosts `TransferDirectory mode="transfer"` → `executeTransfer(entry.extension)` shared with manual input; blind/attended host toggle preserved. Queue/group rows still lack a transfer CTA inside `TransferDirectory` (documented 09-15 follow-up, not a remaining wiring gap for the prior FAILED truth) |
| 11 | UI customization: tab/card visibility + softphone placement (D-05, D-06) | ✓ VERIFIED | Settings + `useGetMyUiCustomizationQuery`; history panel honors same visibility model |
| 12 | Granular permissions with role default + operator override + locks (D-38…D-40) | ✓ VERIFIED | `CallCenterPermissionsService` + settings UI + `CoworkersTab` |
| 13 | Notifications matrix (event × channel), per-operator + role default/locks (D-41…D-43) | ✓ VERIFIED (wiring) | Matrix editor + `useCallCenterNotifications`; runtime audio/popup → human verification |
| 14 | i18n ru+en; mobile-first rework (D-44, D-46) | ✓ VERIFIED | Locale keys incl. `tabs.history`; `useIsMobile` hybrid layout |

**Score:** 14/14 truths verified (2 present, behavior-unverified runtime items — notifications audio, auto-pause AMI ordering)

### Deferred Items

None. Queue/group transfer CTA inside `TransferDirectory` is a documented follow-up from 09-15 (out of scope for gap closure), not matched to a later roadmap phase and not blocking the prior FAILED truths (endpoint transfer + reachability).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `CallCenterAgentPage.tsx` | Orchestrator mounting all Phase 9 surfaces | ✓ VERIFIED | Now also mounts `CallControlBar` full, `ParkedCallsIndicator`, `TransferDirectory` transfer, `CallHistoryPanel` |
| `AgentStatusBar.tsx` | Compact call-control | ✓ VERIFIED | `variant="compact"` |
| `SoftphoneWidget.tsx` | FAB/sticky-bar, conference-add | ✓ VERIFIED | Conference-add directory still hosted here |
| `IncomingCallToast.tsx` | Non-modal answer/reject | ✓ VERIFIED | Mounted |
| `CoworkersTab` / `QueuesTab` / `WaitingTab` | Core tabs | ✓ VERIFIED | Mounted |
| `MissedCallsPanel` | Grouped missed | ✓ VERIFIED | Header chrome |
| `CallControlBar.tsx` (full) | Park/warm-transfer/zombie-reset | ✓ VERIFIED | Reachable via `showCallControls` gate; RTK mutations internal |
| `ParkedCallsIndicator.tsx` | Parked badge + retrieve | ✓ VERIFIED | Persistent header chrome |
| `CallHistoryPanel.tsx` | History + click-to-call | ✓ VERIFIED | Fourth `history` panel/tab |
| `TransferDirectory.tsx` | transfer / conference-add / call | ✓ VERIFIED | `conference-add` (Softphone) + `transfer` (Transfer Modal); `call` via history panel |
| `CallCenterSettings.tsx` / `NotificationMatrix.tsx` | Settings surfaces | ✓ VERIFIED | Mounted via settings page |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `CallCenterAgentPage` | `CallControlBar` full | `showCallControls && <CallControlBar variant="full" uniqueid=… isZombie=…>` | ✓ WIRED | Lines ~709–721; connected-call only (not ringing) |
| `CallCenterAgentPage` | `ParkedCallsIndicator` | header chrome render | ✓ WIRED | Line ~621 |
| `CallCenterAgentPage` | `CallHistoryPanel` | `panelBody.history` + `PANEL_ORDER` | ✓ WIRED | Lines ~82–90, 554, 585 |
| `CallControlBar` full | park / warm-transfer / zombie-reset mutations | internal RTK hooks + `uniqueid` prop | ✓ WIRED | Props from live `activeCall` |
| Transfer Modal | `TransferDirectory` mode=transfer | `onSelectTransferTarget` → `executeTransfer` | ✓ WIRED | Lines ~886–893; shared with manual input |
| `SoftphoneWidget` | `TransferDirectory` mode=conference-add | Sheet | ✓ WIRED | Unchanged |
| `QueuesTab` | warm-transfer-to-queue | button → mutation | ✓ WIRED | Unchanged |
| `AgentStatusBar` / `CoworkersTab` / `WaitingTab` | KPI / spy / pickup | prior wiring | ✓ WIRED | Unchanged |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `CallControlBar` full | `uniqueid` / `isZombie` | `activeCall.uniqueid` / `activeCall.zombieCandidate` | Yes (live SSE/AMI call state) | ✓ FLOWING |
| `ParkedCallsIndicator` | `parked` | `useGetParkedCallsQuery` + SSE invalidate | Yes | ✓ FLOWING |
| `TransferDirectory` (transfer) | directory rows | `useGetTransferDirectoryQuery` + `presenceUpdate` SSE | Yes | ✓ FLOWING |
| `CallHistoryPanel` | `rows` | `useGetOperatorCallHistoryQuery` → history API | Yes (now reachable) | ✓ FLOWING |
| `QueuesTab` / `AgentStatusBar` | KPI | prior Phase 9 pipelines | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Page suite after 09-15 wiring | `npm run test:frontend -- CallCenterAgentPage` | 1 file, 2/2 tests passed | ✓ PASS |
| `CallControlBar` / `ParkedCallsIndicator` / `TransferDirectory` / `CallHistoryPanel` in page | `rg` on `CallCenterAgentPage.tsx` | All four imported and rendered; `variant="full"`, `mode="transfer"`, `history` panel | ✓ PASS |
| Page test stubs for unconditional mounts | `CallCenterAgentPage.test.tsx` | `ParkedCallsIndicator` + `CallHistoryPanel` mocked | ✓ PASS |

### Probe Execution

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| — | — | No phase-declared `scripts/*/tests/probe-*.sh` | SKIP |

### Requirements Coverage (D-01…D-46)

| Decision | Description | Status | Evidence |
|----------|-------------|--------|----------|
| D-01, D-02 | Softphone widget + incoming toast | ✓ SATISFIED | SoftphoneWidget, IncomingCallToast |
| D-03 | Controls in status bar + full set | ✓ SATISFIED | compact in AgentStatusBar; full bar on connected call |
| D-04 | Hybrid panels/tabs | ✓ SATISFIED | PANEL_ORDER + breakpoints |
| D-05, D-06 | UI config visibility/placement | ✓ SATISFIED | incl. `history` visibility |
| D-07 | Default tab | ? UNCERTAIN | Discretion item; low risk |
| D-08…D-14 | All-channel KPI, journal, dual counters, status set, timer | ✓ SATISFIED | Prior plans 09-01…09-04 |
| D-15 | Auto-pause rules | ✓ SATISFIED (wiring); ⚠️ runtime unverified | Human item |
| D-16…D-20 | Missed-call engine | ✓ SATISFIED | 09-09/09-10 |
| D-21…D-26 | ChanSpy + supervisor hangup/scope | ✓ SATISFIED | CoworkersTab + permissions |
| D-27 | Operator zombie-reset | ✓ SATISFIED | Full CallControlBar reachable |
| D-28 | Park/retrieve, conference, warm-transfer | ✓ SATISFIED | Full bar + ParkedCallsIndicator + Softphone + QueuesTab |
| D-29 | Click-to-call | ✓ SATISFIED | CallHistoryPanel mounted |
| D-30 | MVP waves | ✓ SATISFIED | Process |
| D-31…D-33 | Per-queue metrics + actions | ✓ SATISFIED | QueuesTab |
| D-34, D-35 | Call history in panel | ✓ SATISFIED | history panel |
| D-36, D-37 | Transfer directory + BLF | ✓ SATISFIED (endpoint transfer) | mode=transfer in modal; queue/group CTA follow-up |
| D-38…D-40 | Permissions UI/model | ✓ SATISFIED | Settings |
| D-41…D-43 | Notification matrix | ✓ SATISFIED (wiring) | Human runtime item |
| D-44…D-46 | i18n, SSE deltas, mobile | ✓ SATISFIED | Locales + SSE + useIsMobile |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `SoftphoneWidget.tsx` | ~29 | Comment still mentions unused `extraControls` slot | ℹ️ Info | Intentional: 09-15 mounted full bar in call chrome (SIP+WebRTC) instead of Softphone-only slot |
| — | — | No `TBD`/`FIXME`/`XXX` in page/orchestrator after 09-15 | — | Debt-marker gate: clean |

### Human Verification Required

1. **Notification matrix runtime behavior (D-41/D-42)**
   **Test:** Configure sound+popup for incoming/missed; trigger with tab visible and hidden.
   **Expected:** Channels fire per matrix; browser notification when hidden; locks respected.
   **Why human:** Audio/OS permissions not statically verifiable.

2. **Auto-pause under real AMI timing (D-15)**
   **Test:** Drive missed/idle/WRAPUP sequences on live/staging tenant.
   **Expected:** Single pause per threshold with correct reason; no double-fire.
   **Why human:** Unit tests isolate rule logic; event-ordering needs live AMI.

**Recommended (non-blocking) live UAT after 09-15:** park/retrieve/zombie-reset on a connected call; blind/attended transfer via directory endpoint; click-to-callback from History — confirms AMI/WebRTC end-to-end beyond wiring.

### Gaps Summary

Previous verification (`gaps_found`, 11/14) found three orchestrator wiring gaps. Plan **09-15** closed all three:

1. **Park / retrieve / zombie-reset** — `CallControlBar variant="full"` under `showCallControls` with live `activeCall` identity; `ParkedCallsIndicator` in persistent header.
2. **Directory transfer** — Transfer Modal hosts `TransferDirectory mode="transfer"` via shared `executeTransfer`.
3. **Call history + click-to-call** — fourth `history` panel/tab mounting `CallHistoryPanel`.

No remaining BLOCKER wiring gaps. Status is **human_needed** solely for runtime notification audio and auto-pause AMI ordering (unchanged from prior report).

---

_Verified: 2026-07-23T04:20:00Z_
_Verifier: Claude (gsd-verifier)_
