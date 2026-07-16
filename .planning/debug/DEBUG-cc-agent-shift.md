---
status: diagnosed
trigger: "UAT Phase 07 Call Center Test 1 — при входе в АРМ и начале смены статусы не меняются, при выборе номера смена не начинается; карточка/hold/transfer/wrap-up/reports полный провал"
created: 2026-07-16T11:40:00.000Z
updated: 2026-07-16T11:55:00.000Z
symptoms_prefilled: true
goal: find_root_cause_only
---

## Current Focus

hypothesis: CONFIRMED — myAgentInterface never set after agentLogin; selectMyAgent always undefined → full UI cascade failure
test: codebase grep + call-chain read (no runtime fix)
expecting: N/A — diagnosis complete
next_action: return ROOT CAUSE FOUND to orchestrator

known_pattern_candidate: none (no knowledge-base.md)

## Symptoms

expected: Shift starts when selecting extension; agent status changes; inbound queue call opens call card; hold/transfer/wrap-up work; call appears in reports
actual: при входе в АРМ и начале смены - статусы не меняются, при выборе номера, смена не начинается. Карточка звонка не открывается, удержание/перевод, поствызывная обработка не появляется, в отчётах звонков нет. Полный провал
errors: none reported by user (silent UI failure — status stays Offline)
reproduction: 1) Enter ARM 2) Start shift / select extension 3) Observe status unchanged, no call card, no wrap-up, no reports
started: Phase 07 UAT Test 1 (blocker)

## Eliminated

- hypothesis: Backend agentLogin never persists READY / never emits agentUpdate
  evidence: callcenter.service.ts:106-116 calls stateService.setAgent(... status READY); setAgent emits agentUpdate (callcenter-state.service.ts:163). Unit tests cover this path.
  timestamp: 2026-07-16T11:50:00.000Z

- hypothesis: SSE endpoint broken so no events reach frontend at all
  evidence: Even if SSE works and agents[] updates via updateAgent, selectMyAgent still requires myAgentInterface (selectors.ts:20-23). SSE alone cannot make isLoggedIn true. SSE may work (connectionDot Online) while status stays Offline — matches dual indicator design.
  timestamp: 2026-07-16T11:52:00.000Z

- hypothesis: JWT / req.user.sub wrong so login API always 401
  evidence: User did not report modal error; ShiftLoginModal surfaces API errors in micError (ShiftLoginModal.tsx:225-230). JWT strategy accepts Bearer + ?token= for SSE. Not required to explain permanent OFFLINE after successful login close.
  timestamp: 2026-07-16T11:53:00.000Z

## Evidence

- timestamp: 2026-07-16T11:45:00.000Z
  checked: Grep setMyAgentInterface across packages/frontend
  found: Action defined and tested in callCenterSlice, but ZERO production dispatches. Only slice + unit tests reference it.
  implication: myAgentInterface remains null for entire session after login.

- timestamp: 2026-07-16T11:46:00.000Z
  checked: selectMyAgent (callCenterSelectors.ts:20-24)
  found: Returns undefined unless myAgentInterface is set; then finds agent by interface match.
  implication: All consumers of myAgent see "not logged in".

- timestamp: 2026-07-16T11:47:00.000Z
  checked: CallCenterAgentPage handleShiftLogin (326-357) and isLoggedIn (401)
  found: Calls agentLogin().unwrap() but never dispatch(setMyAgentInterface(result.interface)). isLoggedIn = myAgent && status !== OFFLINE → always false. Status label defaults to OFFLINE (272-281).
  implication: Start Shift button never becomes End Shift; status never READY.

- timestamp: 2026-07-16T11:48:00.000Z
  checked: useCallCardPopup, activeCall, wrap-up UI
  found: useCallCardPopup early-returns when !myAgent (116-123). activeCall keyed off myAgent.currentCall (285-288). WRAPUP panel requires myAgent.status === WRAPUP (632). Hold/transfer buttons require activeCall.
  implication: Card / hold / transfer / wrap-up cannot appear without myAgent — cascade from same root.

- timestamp: 2026-07-16T11:49:00.000Z
  checked: Backend agentLogin + AMI QueueAdd
  found: Login creates session, QueueAdd per queues (may be empty array), setAgent READY. Queues optional in AgentLoginDto and ShiftLoginModal (no required validation on queues).
  implication: Backend can succeed while UI shows offline. Empty queues → no AMI membership → no inbound queue calls → empty reports even after UI fix.

- timestamp: 2026-07-16T11:51:00.000Z
  checked: ShiftLoginModal handleConfirm
  found: Selecting extension only sets sipId; login runs only on Start Shift button. Modal closes after successful onConfirm.
  implication: User phrase "при выборе номера" likely means the start-shift flow (select + confirm); after confirm modal closes but UI stays offline — matches bug.

## Resolution

root_cause: |
  PRIMARY: Frontend never dispatches setMyAgentInterface after successful agentLogin.
  selectMyAgent always returns undefined → status stays OFFLINE, isLoggedIn false,
  CallCardPopup/activeCall/wrap-up/hold/transfer UI all gated on myAgent.
  Backend login + SSE agentUpdate can succeed; UI identity binding is missing.

  CONTRIBUTING: Shift login allows empty queues[]; agentLogin then skips QueueAdd.
  Even after UI fix, inbound queue calls and report rows require at least one selected queue
  (and working AMI). Empty queues amplify "no calls in reports".

fix: (diagnose-only — not applied)
verification: (diagnose-only)
files_changed: []
