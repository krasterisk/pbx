---
phase: 09-call-center-agent-panel
verified: 2026-07-23T06:45:00Z
status: gaps_found
score: 11/14 must-haves verified
behavior_unverified: 2
overrides_applied: 0
gaps:
  - truth: "Call-control set expanded toward professional practices (D-27 zombie-reset, D-28 park/retrieve) is reachable by the operator"
    status: failed
    reason: "Backend (CallCenterService.resetZombieCall/parkCall/retrieveParkedCall) and the frontend CallControlBar 'full' variant (park/conference/warm-transfer/zombie-reset buttons, RTK-wired) both exist and are individually correct, but CallControlBar is never rendered with variant=\"full\" anywhere in the app. AgentStatusBar only renders variant=\"compact\" (mute/hold/transfer/hangup). SoftphoneWidget defines an `extraControls` slot explicitly documented as 'Slot for park/zombie-reset controls (09-10's remaining CallControlBar full-variant actions)' but CallCenterAgentPage.tsx never passes it. useParkCallMutation/useResetZombieCallMutation are imported nowhere except inside the orphaned CallControlBar.tsx. Result: an operator has zero UI path to park a call, retrieve a parked call (ParkedCallsIndicator also unmounted, see below), or self-reset a stuck/zombie call — despite D-27 explicitly requiring operator self-service zombie reset."
    artifacts:
      - path: "packages/frontend/src/features/callcenter/ui/CallControlBar/CallControlBar.tsx"
        issue: "variant=\"full\" branch (park/conference/warm-transfer/zombie-reset) built and correctly wired to RTK mutations, but the component is only ever instantiated with variant=\"compact\" (in AgentStatusBar) — the full variant is dead code in the running app"
      - path: "packages/frontend/src/features/callcenter/ui/ParkedCallsIndicator/ParkedCallsIndicator.tsx"
        issue: "Component built (badge + dropdown for retrieve), never imported by any page — grep across packages/frontend/src finds it only inside its own module files"
      - path: "packages/frontend/src/pages/CallCenterAgentPage/CallCenterAgentPage.tsx"
        issue: "SoftphoneWidget mounted without the extraControls prop (line ~795-804); ParkedCallsIndicator not imported at all"
    missing:
      - "Pass extraControls={<park/zombie-reset buttons>} to <SoftphoneWidget> in CallCenterAgentPage.tsx, or mount CallControlBar variant=\"full\" somewhere reachable (e.g. inside the softphone panel or a call-detail popover)"
      - "Mount <ParkedCallsIndicator> in CallCenterAgentPage.tsx persistent chrome so parked calls are visible/retrievable"
  - truth: "Client-aware click-to-call (D-29) and the transfer/BLF directory (D-36/D-37) are reachable as a general-purpose 'directory' surface, not only for conference-add"
    status: failed
    reason: "TransferDirectory.tsx correctly implements three modes ('transfer' | 'conference-add' | 'call') with live BLF presence via SSE. In the mounted app, however, only mode=\"conference-add\" is ever instantiated (inside SoftphoneWidget's 'Add to conference' sheet). Blind/attended transfer still opens the pre-existing plain-number-input modal (TransferModal in CallCenterAgentPage.tsx), not the directory. The only consumer of mode=\"call\" (click-to-call) is CallHistoryPanel.tsx, which is itself unmounted (see next gap) — so click-to-call via the directory has zero live entry point."
    artifacts:
      - path: "packages/frontend/src/features/callcenter/ui/TransferDirectory/TransferDirectory.tsx"
        issue: "mode=\"transfer\" and mode=\"call\" branches are unreachable dead code in the running app — grep for `mode=\"call\"`/`mode=\"transfer\"` across packages/frontend/src finds only the type definition, no instantiation site"
    missing:
      - "Either wire the existing manual Transfer Modal to open TransferDirectory mode=\"transfer\" (replacing/augmenting the plain number input), or add a dedicated directory entry point reachable outside conference-add"
  - truth: "Operator call history (all directions, shift/day, click-to-callback, card access) is visible in the agent panel (D-34/D-35, phase goal item 9)"
    status: failed
    reason: "CallHistoryPanel.tsx (built in 09-12: shift/day toggle, all-direction rows, click-to-callback via useClickToCallMutation, card-popup access) is never imported by CallCenterAgentPage.tsx or any other page. grep across packages/frontend/src/pages confirms zero usages outside the component's own module files, index.ts barrel, and locale files."
    artifacts:
      - path: "packages/frontend/src/features/callcenter/ui/CallHistoryPanel/CallHistoryPanel.tsx"
        issue: "Substantive, correctly wired to getOperatorCallHistory/clickToCall/getCardByCall — but orphaned, never mounted in any page"
      - path: "packages/frontend/src/pages/CallCenterAgentPage/CallCenterAgentPage.tsx"
        issue: "No import of CallHistoryPanel; no tab/panel slot renders it"
    missing:
      - "Mount <CallHistoryPanel> as a tab/panel in CallCenterAgentPage.tsx (e.g. alongside or nested under Waiting, or as a 4th toggleable panel per D-05's visibility-toggle model)"
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
---

# Phase 9: Call Center Agent Panel Verification Report

**Phase Goal:** Rework agent ARM (`CallCenterAgentPage`): primary tabs Coworkers / Queues / Waiting; softphone as floating widget + incoming-call toast with call controls and dialpad; rename Ready → Waiting for call; KPI answered/missed in status bar (all channels); per-queue answered/missed; transfer / ChanSpy / hangup by role; pickup from waiting; expand call-control toward professional call-center practices.

**Verified:** 2026-07-23T06:45:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

**Requirement basis:** No REQUIREMENTS.md IDs are mapped to Phase 9. Per user instruction, verified against Implementation Decisions **D-01…D-46** from `09-CONTEXT.md`, cross-checked against the phase goal and ROADMAP.md Phase 9 scope.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Primary tabs Coworkers / Queues / Waiting exist, hybrid panels (≥1024px) / tabs (<768px) (D-04) | ✓ VERIFIED | `CallCenterAgentPage.tsx` renders `CoworkersTab`/`QueuesTab`/`WaitingTab` side-by-side on wide screens and via `Tabs` on narrow; each tab reads real Redux state (`selectCcAgents`, `selectCcQueues`, `selectQueueMonitorCalls`) — not stubs |
| 2 | Softphone is a floating widget (FAB/sticky bar), not a dominant card; incoming call is a non-modal slide-in toast with controls + dialpad (D-01, D-02) | ✓ VERIFIED | `SoftphoneWidget.tsx` renders a 56px FAB (desktop, `placement` configurable) / sticky bar (mobile); `DtmfKeypad` embedded; `IncomingCallToast.tsx` mounted in `CallCenterAgentPage.tsx` as non-modal slide-in with answer/reject |
| 3 | READY status relabeled "Ожидание звонка" / "Waiting for call" (D-13) | ✓ VERIFIED | `displayLabels.ts:57-62` — explicit comment "READY is relabelled ... per D-13", `key: 'callcenter.status.ready', fallback: 'Waiting for call'`; covered by `displayLabels.test.ts` |
| 4 | KPI answered/missed in status bar across ALL channels (queue + personal + outgoing), shift+day (D-08, D-11, D-12, D-14) | ✓ VERIFIED | `CallCenterAmiService` handles `DialBegin`/`DialEnd`/`Hangup` on operator channels (09-03); `GET /callcenter/agent/kpi` + `agentKpiUpdate` SSE; `AgentStatusBar.tsx` renders dual shift/day counters for answered/made/missed |
| 5 | Per-queue answered/missed with aggregate + personal stats, free-operator warning/danger (D-31, D-32) | ✓ VERIFIED | `QueuesTab.tsx` renders `queue.waiting/talking/sla`, `freeOperatorsClass()` (warning <50%, danger 0), and personal `answered.shift/day` + `missed.shift/day` via `useGetAgentQueuesStatsQuery` |
| 6 | Transfer / ChanSpy / hangup gated by role (D-21…D-26) | ✓ VERIFIED | `CoworkersTab.tsx`: click/drag-to-transfer (`canClickTransfer`), permission-gated ChanSpy mode picker (`can_spy` + `spy_modes`, disables ungranted modes with tooltip), supervisor-only hangup (`isSupervisor` + confirm dialog) calling `supervisorHangupCall` |
| 7 | Pickup from Waiting tab (D-06/D-18/D-19 carried) | ✓ VERIFIED | `WaitingTab.tsx`: "Pick" button gated on `pickup_enabled` + `myAgent.status === 'READY'` + queue membership, wired to `agentPickCall` mutation |
| 8 | Call-control expanded toward pro practices: zombie-reset (D-27), park/retrieve (D-28), 3-way conference (D-28), warm-transfer-to-queue (D-28/D-33), click-to-call (D-29) — **all reachable by the operator** | ✗ **FAILED (partial)** | Conference-add (via `SoftphoneWidget`→`TransferDirectory` sheet) and warm-transfer-to-queue (via `QueuesTab` "Transfer call here" button) **are** reachable. Park, zombie-reset, and click-to-call-via-directory have **zero UI entry point** in the mounted app — see Gaps below |
| 9 | Operator call history in the panel, all directions, shift/day, click-to-callback (D-34, D-35) | ✗ **FAILED** | `CallHistoryPanel.tsx` built and correctly wired (09-12) but never imported/mounted anywhere — see Gaps below |
| 10 | Transfer directory (endpoints+queues+groups) with live BLF presence, usable for transfer (D-36, D-37) | ⚠️ **PRESENT_BEHAVIOR_UNVERIFIED → treated as FAILED for its primary "transfer" use case** | `TransferDirectory.tsx` + `presenceUpdate` SSE fully implemented and *is* wired for `conference-add`, but its `transfer` and `call` modes are dead code in the running app — blind/attended transfer still uses the legacy plain-number-input modal. Directory-as-transfer-picker is not actually usable by an operator today |
| 11 | UI customization: tab/card visibility + softphone placement, role default + per-operator override, editable by admin/supervisor and operator (D-05, D-06) | ✓ VERIFIED | `CallCenterSettings.tsx` mounted via `CallCenterSettingsPage` (routed); `CallCenterAgentPage.tsx` applies `effectivePanelVisibility` and `softphonePlacement` from `useGetMyUiCustomizationQuery` live |
| 12 | Granular permissions (can_spy/spyable/spy_modes/click_to_call/customize_ui) with role default + operator override + locks (D-38…D-40) | ✓ VERIFIED | `CallCenterPermissionsService.getEffective` merges role defaults + operator overrides + `permission_locks`; `assert()`/`assertSpyMode()` gate backend actions; `CoworkersTab` consumes `getEffectivePermissions` client-side |
| 13 | Notifications matrix (event × channel), per-operator + role default/locks (D-41…D-43) | ✓ VERIFIED (wiring); ⚠️ runtime behavior unverified | `NotificationMatrix.tsx` + `useCallCenterNotifications.ts` built, unit-tested (`useCallCenterNotifications.test.ts`), and `CallCenterSettings` exposes the matrix editor. Actual sound/popup firing at runtime is a human-verification item (see below) |
| 14 | i18n ru+en for new strings; mobile-first rework (D-44, D-46) | ✓ VERIFIED | All 14 plan SUMMARYs report ru/en key additions; `useIsMobile` breakpoints (768/1024) drive hybrid panel/tab and FAB/sticky-bar layout throughout `CallCenterAgentPage.tsx`, `SoftphoneWidget.tsx`, `CallControlBar.tsx` |

**Score:** 11/14 truths verified (2 present-but-behavior-unverified, routed to human verification; 2 truths — #8 and #9 — failed outright, #10 failed for its primary intended use)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `CallCenterAgentPage.tsx` | Hybrid orchestrator mounting all Phase 9 surfaces | ✓ VERIFIED | Mounts `AgentStatusBar`, `SoftphoneWidget`, `IncomingCallToast`, `CoworkersTab`, `QueuesTab`, `WaitingTab`, `MissedCallsPanel` |
| `AgentStatusBar.tsx` | Status pill, live timer, dual KPI, call-control (compact) | ✓ VERIFIED | Wired, renders `CallControlBar variant="compact"` |
| `SoftphoneWidget.tsx` | FAB/sticky-bar, dialpad, conference-add | ✓ VERIFIED | Wired; `extraControls` slot exists but unused by caller |
| `IncomingCallToast.tsx` | Non-modal slide-in with answer/reject | ✓ VERIFIED | Mounted, wired to `phone.acceptCall/rejectCall` |
| `CoworkersTab.tsx` | Presence, drag/click-transfer, ChanSpy, hangup | ✓ VERIFIED | Fully wired, real data |
| `QueuesTab.tsx` | Aggregate + personal per-queue KPI, pause, warm-transfer | ✓ VERIFIED | Fully wired, real data |
| `WaitingTab.tsx` | Waiting table + pickup | ✓ VERIFIED | Fully wired, real data |
| `MissedCallsPanel` | Grouped missed, claim/callback/resolve | ✓ VERIFIED | Mounted in `CallCenterAgentPage.tsx` (per 09-10) |
| `CallControlBar.tsx` (full variant) | Park/conference/warm-transfer/zombie-reset | ⚠️ **ORPHANED** | Substantive and correctly wired internally, but `variant="full"` never instantiated anywhere in the app |
| `ParkedCallsIndicator.tsx` | Parked-calls badge + retrieve dropdown | ⚠️ **ORPHANED** | Substantive, never imported by any page |
| `CallHistoryPanel.tsx` | All-direction history, callback, card access | ⚠️ **ORPHANED** | Substantive and correctly wired internally, never imported by any page |
| `TransferDirectory.tsx` | Transfer/conference-add/click-to-call picker with BLF | ⚠️ **PARTIALLY ORPHANED** | `conference-add` mode wired (via `SoftphoneWidget`); `transfer`/`call` modes have no live call site |
| `CallCenterSettings.tsx` | UI customization + notifications editor | ✓ VERIFIED | Mounted via `CallCenterSettingsPage`, routed |
| `NotificationMatrix.tsx` | Event × channel switch grid | ✓ VERIFIED | Used inside `CallCenterSettings.tsx` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `CallCenterAgentPage.tsx` | `SoftphoneWidget` | `extraControls` prop | ✗ **NOT_WIRED** | Prop defined and documented on `SoftphoneWidgetProps` but never passed at the only call site |
| `CallCenterAgentPage.tsx` | `CallHistoryPanel` | import + render | ✗ **NOT_WIRED** | No import found |
| `CallCenterAgentPage.tsx` | `ParkedCallsIndicator` | import + render | ✗ **NOT_WIRED** | No import found |
| `CallControlBar.tsx` (full) | `useParkCallMutation`/`useResetZombieCallMutation` | direct RTK hook | ✓ WIRED (internally) | Correct, but the component instance that owns this wiring is itself unreached |
| `TransferModal` (manual, in `CallCenterAgentPage.tsx`) | `TransferDirectory` mode="transfer" | — | ✗ **NOT_WIRED** | Legacy plain-input modal persists unchanged; directory's transfer mode unused |
| `SoftphoneWidget` | `TransferDirectory` mode="conference-add" | `Sheet` | ✓ WIRED | Confirmed functional |
| `QueuesTab` | `useWarmTransferToQueueMutation` | button → mutation | ✓ WIRED | Confirmed functional, satisfies D-33 independent of `CallControlBar` full |
| `AgentStatusBar` | `CallCenterAmiService` KPI pipeline | `getAgentKpi` query + `agentKpiUpdate` SSE | ✓ WIRED | Confirmed |
| `CoworkersTab` | `peerSpy`/`supervisorHangupCall` mutations | button → mutation | ✓ WIRED | Confirmed |
| `WaitingTab` | `agentPickCall` mutation | button → mutation | ✓ WIRED | Confirmed |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `QueuesTab` | `personalStats` | `useGetAgentQueuesStatsQuery` → `GET /callcenter/agent/queues-kpi` → `CallCenterMetricsService` | Yes (per-tenant DB/in-memory counters, not static) | ✓ FLOWING |
| `AgentStatusBar` | KPI counters | `useGetAgentKpiQuery` + SSE deltas | Yes | ✓ FLOWING |
| `CoworkersTab` | `permissions` | `useGetEffectivePermissionsQuery` → `CallCenterPermissionsService.getEffective` (merges DB role defaults + operator overrides) | Yes | ✓ FLOWING |
| `CallHistoryPanel` | `rows` | `useGetOperatorCallHistoryQuery` → `cc_queue_calls`/history query | Yes, but unreachable (component never mounted) | ⚠️ HOLLOW (data flows correctly when rendered, but nothing renders it) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Backend call-center unit/integration tests pass | `npm run test:cc -w @krasterisk/backend` | 22/23 suites pass, 314/315 tests pass; 1 pre-existing failure (`callcenter-chat.service.spec.ts`, documented in `deferred-items.md` as pre-existing/unrelated to Phase 9) | ✓ PASS (with known pre-existing exception) |
| Frontend call-center-adjacent tests pass | `npm run test -w @krasterisk/frontend` | 80/80 files, 325/325 tests pass | ✓ PASS |
| `useParkCallMutation`/`useResetZombieCallMutation` reachability | `grep -r "useParkCallMutation\|useResetZombieCallMutation" packages/frontend/src` | Only found inside `CallControlBar.tsx` (never rendered with `variant="full"`) | ✗ FAIL (confirms orphaned artifact claim) |
| `CallHistoryPanel`/`ParkedCallsIndicator` reachability | `grep -r "CallHistoryPanel\|ParkedCallsIndicator" packages/frontend/src` | Only found inside own module files, barrel `index.ts`, and locale/SSE-listener files — no page import | ✗ FAIL (confirms orphaned artifact claim) |

### Requirements Coverage (D-01…D-46)

| Decision | Description | Status | Evidence |
|----------|-------------|--------|----------|
| D-01 | Softphone as floating widget, per-operator placement | ✓ SATISFIED | `SoftphoneWidget.tsx`, `softphonePlacement` |
| D-02 | Incoming call as slide-in toast | ✓ SATISFIED | `IncomingCallToast.tsx` |
| D-03 | Call controls in status bar + full set in widget | ⚠️ PARTIAL | Status bar (compact) ✓; "full set in widget" not fully realized — park/zombie-reset missing from widget |
| D-04 | Hybrid panels/tabs layout | ✓ SATISFIED | `CallCenterAgentPage.tsx` |
| D-05 | UI config: role default + per-operator, visibility+placement only | ✓ SATISFIED | `CallCenterSettings.tsx`, `uiCustomization` |
| D-06 | Configurable by admin/supervisor and operator | ✓ SATISFIED | `CallCenterSettings.tsx` + settings service role-default endpoints |
| D-07 | Default tab on entry (Claude's discretion) | ? UNCERTAIN | Not independently spot-checked; low risk, discretion item |
| D-08 | All-channel KPI via extended AMI listener | ✓ SATISFIED | 09-03 `CallCenterAmiService` |
| D-09 | Detailed operator action journal (`cc_agent_events`) | ✓ SATISFIED | 09-01/09-03 |
| D-10 | Personal missed vs queue-missed distinction, in-queue RONA excluded | ✓ SATISFIED | `CcMissedCall.personal` flag, `getMissedCallsGrouped` scope (09-09) |
| D-11 | Shift + day dual counters | ✓ SATISFIED | `AgentStatusBar`, `QueuesTab` |
| D-12 | Separate answered(in)/made(out)/missed counters | ✓ SATISFIED | `CallCenterMetricsService` |
| D-13 | Full status set incl. DIALING/CONSULT/ACW; READY relabeled | ✓ SATISFIED | `AgentStatus` union, `displayLabels.ts` |
| D-14 | Live status timer + informative call indicator | ✓ SATISFIED | `AgentStatusBar` |
| D-15 | Flexible auto-pause rules | ✓ SATISFIED (wiring); ⚠️ runtime behavior unverified | `CallCenterAutoPauseService` + unit tests; real AMI event-ordering not exercised — human verification item |
| D-16 | Missed-call grouping by number | ✓ SATISFIED | `getMissedCallsGrouped` (09-09) |
| D-17 | "Client called back" auto-resolve | ✓ SATISFIED | `autoResolveOnAnswer` (09-09) |
| D-18 | Callback flow (PJSIP originate-first / WebRTC direct, >5s success) | ✓ SATISFIED | `callbackMissedCall` (09-09), `MissedCallsPanel` (09-10) |
| D-19 | Ownership: personal vs queue-pool claim | ✓ SATISFIED | `claimMissedCall`, `personal` flag |
| D-20 | Scope: queue-abandoned + personal, RONA excluded | ✓ SATISFIED | Confirmed in 09-09 scope logic |
| D-21…D-24 | ChanSpy: can_spy/spyable, granular modes, scope, audit | ✓ SATISFIED | `CallCenterPermissionsService`, `peerSpy`, `CoworkersTab` |
| D-25, D-26 | Supervisor scope = assigned queues only; hangup/transfer supervisor+ only | ✓ SATISFIED | `assertSupervisor` + queue-scope checks |
| D-27 | Operator self-service zombie-call reset | ✗ **BLOCKED (UI)** | Backend + component exist; no reachable UI entry point (see Gaps) |
| D-28 | Zombie-reset, warm-transfer-to-queue, 3-way conference, park/retrieve, click-to-call all "included in phase" | ✗ **BLOCKED (partial — park/retrieve, click-to-call)** | Conference ✓, warm-transfer-to-queue ✓ (via QueuesTab); park/retrieve and click-to-call have no UI entry point |
| D-29 | Client-aware click-to-call (WebRTC direct / PJSIP originate-first) | ✗ **BLOCKED (UI)** | Backend `clickToCall` correct; only consumer (`CallHistoryPanel`) unmounted |
| D-30 | MVP priority / waves (process decision) | ✓ SATISFIED | N/A — planning process, not a runtime artifact |
| D-31…D-33 | Per-queue metrics, shift+day period, pause/warm-transfer/go-to-waiting actions | ✓ SATISFIED | `QueuesTab.tsx` |
| D-34, D-35 | All-direction call history in panel, extended `cc_queue_calls` source | ✗ **BLOCKED (UI)** | Backend/model extended correctly (09-11); `CallHistoryPanel` built but unmounted |
| D-36, D-37 | Transfer directory (endpoints+queues+groups) with BLF presence | ⚠️ **PARTIAL** | Backend/data + BLF SSE correct; directory unusable for its primary "transfer" purpose in the live UI |
| D-38…D-40 | Permissions storage/model/UI (bulk table + per-operator modal) | ✓ SATISFIED | `CallCenterSettings.tsx`, `CallCenterSettingsService` |
| D-41…D-43 | Notification matrix, events/channels, per-operator + role default | ✓ SATISFIED (wiring) | `NotificationMatrix.tsx`, `useCallCenterNotifications.ts` |
| D-44 | i18n ru+en | ✓ SATISFIED | Confirmed across all 14 SUMMARYs |
| D-45 | SSE throttling/batching/deltas | ✓ SATISFIED | `agentKpiUpdate`/`presenceUpdate` delta events (09-03, 09-11) |
| D-46 | Mobile-first rework reusing Phase 8 patterns | ✓ SATISFIED | `useIsMobile`, sticky softphone bar, tab-based layout |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `CallCenterAgentPage.tsx` | ~795-804 | Silently-unused prop (`extraControls` never passed) — no TODO/FIXME marker, so this doesn't trip the debt-marker gate, but it is a genuine missing-wire | ⚠️ Warning | Park/zombie-reset unreachable |
| `SoftphoneWidget.tsx` | 29 | Doc comment "(09-10's remaining CallControlBar full-variant actions)" — SUMMARY correctly documented the gap in a code comment but it was never closed by a later plan | ℹ️ Info | Confirms the gap was known-but-unresolved, not accidental |
| — | — | No `TBD`/`FIXME`/`XXX` markers found in Phase-9-modified files | — | Debt-marker gate: clean |

### Human Verification Required

1. **Notification matrix runtime behavior (D-41/D-42)**
   **Test:** Configure sound+popup for "incoming call" and "missed call" in Settings → Notifications; trigger both events while the browser tab is hidden and visible.
   **Expected:** Sound plays, popup/toast appears per configuration; browser notification appears only when tab hidden, respecting role locks.
   **Why human:** Audio playback and OS notification permissions are runtime/browser behaviors, not statically verifiable.

2. **Auto-pause rule engine under real AMI event timing (D-15)**
   **Test:** Simulate 3 consecutive missed queue calls, then 60s idle, then a WRAPUP >30s, against a live/staging tenant; confirm agent is auto-paused exactly once per breach with the correct logged reason.
   **Expected:** Auto-pause fires at the configured threshold without double-firing or race conditions from concurrent AMI events.
   **Why human:** Unit tests (`callcenter-autopause.service.spec.ts`) verify rule logic in isolation; true event-ordering races require a live AMI event stream.

### Gaps Summary

Phase 9 delivered a very large and mostly well-executed rework — 11 of 14 goal-level truths are fully verified with real wiring and passing tests (backend: 314/315 pre-existing-exception aside; frontend: 325/325). However, three related and significant gaps prevent the phase goal ("expand call-control toward professional call-center practices" + "История вызовов оператора в панели" + directory-based transfer) from being fully achieved in the **live, mounted application**:

1. **Park / retrieve / self-service zombie-reset are backend-complete and component-complete, but have no UI entry point.** `CallControlBar`'s `variant="full"` (which implements exactly these three actions, correctly wired to real mutations) is never instantiated anywhere in the app — `AgentStatusBar` only uses `variant="compact"`, and `SoftphoneWidget`'s documented `extraControls` slot for this exact purpose is never filled by the page orchestrator. `ParkedCallsIndicator` is similarly fully built but never imported by any page. An operator today cannot park a call, retrieve a parked call, or reset a stuck/zombie call from the running UI, despite D-27/D-28 explicitly calling for this.

2. **Call history is not visible in the agent panel.** `CallHistoryPanel` (all-direction, shift/day, click-to-callback, card access — exactly per D-34/D-35) is fully built and internally correct but never imported by `CallCenterAgentPage.tsx` or any other page. This directly contradicts phase-goal item 9 ("История вызовов оператора в панели").

3. **The transfer directory is not usable for its primary purpose (transfer).** `TransferDirectory` correctly implements BLF-aware `transfer`/`conference-add`/`call` modes, but only `conference-add` has a live call site (inside `SoftphoneWidget`). Blind/attended transfer still uses the pre-existing plain-number-input modal, and click-to-call's only consumer (`CallHistoryPanel`) is itself unmounted per gap #2 — so directory-based transfer and click-to-call are unreachable in practice.

All three gaps share a common root cause: **components and backend endpoints built correctly in isolation (09-07, 09-10, 09-12) were never fully wired into the final `CallCenterAgentPage.tsx` orchestration pass (09-08/09-14)**. This is exactly the kind of "task complete, goal missed" pattern goal-backward verification is designed to catch — SUMMARYs for 09-07/09-10/09-12 correctly report their components as built and unit-tested, but the page-level integration was never completed or re-verified in a later plan.

None of these three gaps are addressed by a later phase in the roadmap (Phase 9 is the terminal phase for this ARM rework per `.planning/ROADMAP.md`), so they are not deferrable.

---

_Verified: 2026-07-23T06:45:00Z_
_Verifier: Claude (gsd-verifier)_
