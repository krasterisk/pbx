---
status: diagnosed
trigger: "UAT Phase 07 Call Center Test 2 — ShiftLoginModal WebRTC registers over WSS; answer/hold/mute/DTMF/transfer in browser. User: Вообще ничего не работает. Severity blocker. Test 1 also failed (shift/status)."
created: 2026-07-16T11:39:00.000Z
updated: 2026-07-16T11:55:00.000Z
symptoms_prefilled: true
goal: find_root_cause_only
---

## Current Focus

hypothesis: CONFIRMED — WebRTC E2E is primarily blocked by the same shift-identity binding bug as Test 1 (missing setMyAgentInterface); hold/mute/DTMF/transfer UI also gated on activeCall←myAgent. Independent secondary: ASTERISK_WSS_URL null aborts phone.connect before REGISTER.
test: codebase call-chain + sibling DEBUG-cc-agent-shift.md (diagnose-only)
expecting: N/A — diagnosis complete
next_action: return ROOT CAUSE FOUND to orchestrator

known_pattern_candidate: sibling session DEBUG-cc-agent-shift.md — same myAgentInterface root cause
classification: |
  PRIMARY = blocked by broken shift login (shared with Test 1)
  SECONDARY = independent env/config (ASTERISK_WSS_URL) if unset
  NOT PRIMARY = sip.js / useWebRTCPhone API implementation bugs

## Symptoms

expected: WebRTC mode works end-to-end — ShiftLoginModal WebRTC registers over WSS; answer/hold/mute/DTMF/transfer work fully in browser
actual: "Вообще ничего не работает"
errors: none reported by user (silent / total failure; Test 1 also blocker on shift start / statuses)
reproduction: 1) Open /callcenter/agent 2) Start shift in WebRTC mode 3) Observe nothing works (register/answer/controls)
started: Phase 07 UAT Test 2 (blocker); Test 1 failed first

## Eliminated

- hypothesis: useWebRTCPhone missing hold/mute/DTMF/transfer APIs (sip.js stub)
  evidence: useWebRTCPhone.ts implements connect/register, acceptCall, hold/unhold (Web.holdModifier), mute/unmute (track.enabled), sendDtmf, blindTransfer, attendedTransfer. CallCenterAgentPage wires these when isWebrtc.
  timestamp: 2026-07-16T11:48:00.000Z

- hypothesis: Backend GET /callcenter/webrtc/config controller broken / not mounted
  evidence: CallCenterWebrtcController registered in callcenter.module.ts; unit tests cover wssUrl/STUN/TURN; JwtAuthGuard present. Returns null wssUrl when env unset by design (not a crash).
  timestamp: 2026-07-16T11:49:00.000Z

- hypothesis: WebRTC failure is purely independent of shift login (only WSS/TURN)
  evidence: Even if phone.connect() + REGISTER succeed, Zone B call controls (hold/mute/DTMF/transfer) render only inside `activeCall ? (...)` which requires myAgent.currentCall. myAgent requires myAgentInterface. Same as Test 1 — UI remains "not logged in" / OFFLINE. Ringing answer has a fallback without activeCall, but in-call controls do not.
  timestamp: 2026-07-16T11:52:00.000Z

- hypothesis: ShiftLoginModal never calls onConfirm / never fetches WebRTC credentials
  evidence: handleConfirm fetches credentials for webrtc mode, builds companion interface PJSIP/{ew*}, awaits onConfirm. Modal closes after successful onConfirm. Failures surface in micError. Does not explain silent OFFLINE after modal close when agentLogin succeeds.
  timestamp: 2026-07-16T11:53:00.000Z

## Evidence

- timestamp: 2026-07-16T11:42:00.000Z
  checked: Sibling debug .planning/debug/DEBUG-cc-agent-shift.md
  found: Confirmed PRIMARY for Test 1 — setMyAgentInterface never dispatched after agentLogin; selectMyAgent always undefined.
  implication: WebRTC Test 2 shares the same agent-workspace identity failure.

- timestamp: 2026-07-16T11:44:00.000Z
  checked: CallCenterAgentPage handleShiftLogin (326-357)
  found: WebRTC path — gate on webrtcConfig.wssUrl → setSipCredentials → agentLogin({ interface: PJSIP/ew*, queues }) → phone.connect(...). Never dispatch(setMyAgentInterface). Early return if !wssUrl skips agentLogin AND phone.connect (toast webrtcConfigMissing); softphoneMode already set to webrtc; modal still closes (onConfirm did not throw).
  implication: (A) Missing identity binding after successful login. (B) Missing ASTERISK_WSS_URL aborts REGISTER entirely while UX looks like shift attempted.

- timestamp: 2026-07-16T11:46:00.000Z
  checked: selectMyAgent + Zone B UI gating
  found: selectMyAgent requires myAgentInterface. isLoggedIn = myAgent && status !== OFFLINE. activeCall from myAgent.currentCall. Hold/mute/DTMF/transfer block only when activeCall truthy. WebRTC ringing UI has fallback (phone.status==='ringing') without activeCall; after answer (in-call) without activeCall → idle "Click Start".
  implication: WebRTC media APIs can run but E2E UX/controls fail without shift identity — "nothing works" matches.

- timestamp: 2026-07-16T11:47:00.000Z
  checked: callcenter-webrtc.controller.ts + workspace env
  found: wssUrl = process.env.ASTERISK_WSS_URL?.trim() || null. No packages/backend/.env or root .env with ASTERISK_WSS_* in workspace listing. TURN optional. Frontend useGetWebrtcConfigQuery → toast if null.
  implication: Independent ops/config failure mode exists; cannot prove runtime value without deploy env, but code + missing local .env make unset highly plausible.

- timestamp: 2026-07-16T11:50:00.000Z
  checked: ShiftLoginModal webrtc credentials + endpoints.service getCredentials
  found: Requires endpoint.webrtc_enabled + nested webrtc creds (companion ew*). Backend attaches webrtc block when companion auth exists. SIP domain from SIP_DOMAIN || DB_HOST || localhost.
  implication: Misconfigured endpoint shows explicit modal error (not silent). Secondary setup prerequisite, not primary silent failure.

- timestamp: 2026-07-16T11:51:00.000Z
  checked: Hold button condition vs WebRTC session state
  found: Hold UI requires activeCall.status === 'TALKING' (AMI/SSE call state), not phone.status === 'in-call'. After identity fix, WebRTC hold button may still hide if AMI call state never reaches TALKING for the agent.
  implication: Secondary UI coupling bug; not needed to explain current total failure.

- timestamp: 2026-07-16T11:54:00.000Z
  checked: Does shift login gate WebRTC registration?
  found: YES — phone.connect only called inside handleShiftLogin after wssUrl check and after agentLogin().unwrap(). No auto-register on page load. If agentLogin throws, connect skipped; error shown in modal. If wssUrl null, connect skipped with toast.
  implication: Registration is gated by shift flow; shift identity bug still breaks E2E even when registration succeeds.

## Resolution

root_cause: |
  CLASSIFICATION: primarily BLOCKED BY BROKEN SHIFT LOGIN (Test 1), with an independent config failure mode.

  PRIMARY (confidence: high) — Shared with DEBUG-cc-agent-shift:
  After WebRTC shift confirm, CallCenterAgentPage never dispatches setMyAgentInterface(result.interface).
  selectMyAgent stays undefined → status OFFLINE, isLoggedIn false, Start Shift button stays,
  activeCall never resolves → hold/mute/DTMF/transfer panel never mounts for in-call.
  Backend agentLogin + optional phone.connect/REGISTER can succeed while UI shows "nothing works".

  SECONDARY / INDEPENDENT (confidence: medium — env not observable in repo):
  If ASTERISK_WSS_URL unset, GET /callcenter/webrtc/config returns wssUrl:null;
  handleShiftLogin toasts webrtcConfigMissing and returns before agentLogin and phone.connect.
  WEBRTC_TURN_* only affects ICE relay after REGISTER; missing TURN alone does not block registration.
  useWebRTCPhone / sip.js APIs are present and not the primary defect.

  GATEING:
  Shift login DOES gate WebRTC registration (connect only in handleShiftLogin).
  But the dominant UAT symptom ("nothing works" + Test 1) is identity/UI binding, not a missing sip.js feature.

fix: (diagnose-only — not applied)
verification: (diagnose-only)
files_changed: []

## Suggested Fix Direction (not applied)

1. In handleShiftLogin after successful agentLogin, dispatch setMyAgentInterface(result.interface) — same fix as Test 1 (use companion interface PJSIP/ew* for WebRTC).
2. Ensure deploy sets ASTERISK_WSS_URL (and SIP_DOMAIN); verify GET /callcenter/webrtc/config returns non-null wssUrl before UAT.
3. After (1)+(2): optionally render in-call WebRTC controls from phone.status === 'in-call' (not only activeCall), and allow hold when phone is in-call even if AMI status ≠ TALKING.
4. Endpoint prerequisite: webrtc_enabled companion on chosen extension.
