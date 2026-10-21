---
phase: 10-full-softphone
plan: 09
subsystem: ui
tags: [softphone, sip, ami, webrtc, dual-mode, rtk-query]

requires:
  - phase: 10-03
    provides: POST /agent/dtmf + GET /agent/registration-state AMI backend
  - phase: 10-04
    provides: useSendDtmfMutation + useGetMyRegistrationStateQuery RTK hooks
  - phase: 10-08
    provides: SoftphoneWidgetPhone structural interface + mode prop (D-34 quality/device gate)
provides:
  - useSipPhoneAmi shape-compatible AMI facade (D-31…D-35)
  - CallCenterAgentPage isSip branch mounting SoftphoneWidget for SIP operators
  - Shared call-control handler layer routing SIP through sipPhone (D-24)
affects:
  - 10-full-softphone verification / live-Asterisk UAT
  - Phase 9 multi-call / park paths (no-regression only)

tech-stack:
  added: []
  patterns:
    - "isWebrtc / isSip per-action branching through transport facades (no unified hook)"
    - "SoftphoneWidgetPhone structural typing — widget never imports either phone hook"

key-files:
  created:
    - packages/frontend/src/features/callcenter/lib/useSipPhoneAmi.ts
    - packages/frontend/src/features/callcenter/lib/useSipPhoneAmi.test.ts
  modified:
    - packages/frontend/src/pages/CallCenterAgentPage/CallCenterAgentPage.tsx
    - packages/frontend/src/pages/CallCenterAgentPage/CallCenterAgentPage.test.tsx

key-decisions:
  - "SIP call-control goes through useSipPhoneAmi only; page extends isWebrtc branches with isSip (no unified hook)"
  - "status is binary online→registered / offline→disconnected (never registering, D-35)"
  - "quality/device fields omitted from facade entirely (D-34), not null"
  - "SIP outbound makeCall = clickToCall/originate (D-33)"
  - "Live A1/A3 AMI shapes deferred as [ASSUMED] — no live PBX in executor environment"

patterns-established:
  - "Pattern: transport-agnostic SoftphoneWidgetPhone + page-level isWebrtc|isSip handler routing"
  - "Pattern: SIP mute stays local UI state (DEF-07-MUTE-AMI follow-up)"

requirements-completed: [D-24, D-28, D-29, D-30, D-31, D-32, D-33, D-34, D-35]

coverage:
  - id: D1
    description: "useSipPhoneAmi exposes WebRTC-compatible control surface over AMI REST + sendDtmf + registration-state"
    requirement: D-32
    verification:
      - kind: unit
        ref: packages/frontend/src/features/callcenter/lib/useSipPhoneAmi.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: "SIP-mode SoftphoneWidget mounts with mode=sip; quality/device rows absent (D-34)"
    requirement: D-31
    verification:
      - kind: unit
        ref: packages/frontend/src/features/callcenter/lib/useSipPhoneAmi.test.ts#omits quality and device fields
        status: pass
    human_judgment: false
  - id: D3
    description: "Shared handler layer routes SIP hold/mute/hangup/transfer/DTMF through sipPhone (D-24)"
    requirement: D-24
    verification:
      - kind: unit
        ref: packages/frontend/src/features/callcenter/lib/useSipPhoneAmi.test.ts
        status: pass
    human_judgment: false
  - id: D4
    description: "Live Asterisk validation of A1 PlayDTMF Channel/Digit and A3 DeviceState/ExtensionState field names"
    requirement: D-35
    verification: []
    human_judgment: true
    rationale: "No live PBX in executor environment; [ASSUMED] A1/A3 shapes from 10-03 ship unconfirmed until hardware-phone session"

duration: 18min
completed: 2026-07-24
status: complete
---

# Phase 10 Plan 09: SIP/AMI Softphone Facade Summary

**SIP-mode operators get full softphone chrome via `useSipPhoneAmi` (AMI REST facade) and a widened `CallCenterAgentPage` mount — same SoftphoneWidget, transport-agnostic handlers.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-07-24T15:10:00Z
- **Completed:** 2026-07-24T15:28:00Z
- **Tasks:** 3/3 (Task 3 live-Asterisk checkpoint deferred as [ASSUMED])
- **Files modified:** 4

## Accomplishments

- Built `useSipPhoneAmi` mirroring `useWebRTCPhone` control fields over existing AMI mutations + `sendDtmf` + polled `getMyRegistrationState` (binary status, no quality/devices).
- Widened SoftphoneWidget mount to `(isWebrtc || isSip)` with `mode` + correct phone object; SIP call-control handlers route through `sipPhone` (D-24).
- Unit tests cover status mapping, mutation routing, DTMF uniqueid, clickToCall outbound, and D-34 field absence (8/8 green).

## Task Commits

1. **Task 1+2: useSipPhoneAmi + shared SIP handlers + facade test** - `5ae40b5` (feat)
   - Note: `CallCenterAgentPage` isSip mount/handler wiring landed in the same wave via `7e95ad1` (feat(10-08) included the page edits while SoftphoneWidgetPhone/mode were introduced). Facade + tests committed under 10-09.
2. **Task 3: Live-Asterisk checkpoint** - deferred `[ASSUMED]` (see Checkpoint Status)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `packages/frontend/src/features/callcenter/lib/useSipPhoneAmi.ts` — AMI facade (`SoftphoneWidgetPhone` + `transfer`)
- `packages/frontend/src/features/callcenter/lib/useSipPhoneAmi.test.ts` — status/mutation/DTMF/D-34 coverage
- `packages/frontend/src/pages/CallCenterAgentPage/CallCenterAgentPage.tsx` — `isSip` + `sipPhone` + widened mount + shared handlers
- `packages/frontend/src/pages/CallCenterAgentPage/CallCenterAgentPage.test.tsx` — RTK mocks for new SIP hooks

## Decisions Made

- Extended per-action `isWebrtc` branches with `isSip` → `sipPhone`; rejected unified WebRTC+SIP hook.
- Binary registration status only (`registered`/`disconnected`); never `registering` (D-35).
- SIP mute is local UI state only (existing DEF-07-MUTE-AMI follow-up).
- Live A1/A3 verification documented as deferred rather than blocking forever (executor has no live PBX).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] CallCenterAgentPage.test mocks for SIP RTK hooks**
- **Found during:** Task 2
- **Issue:** Page test mock lacked `useSendDtmfMutation` / `useGetMyRegistrationStateQuery` / `useClickToCallMutation` required once `useSipPhoneAmi` mounts unconditionally.
- **Fix:** Extended the vi.mock map.
- **Files modified:** `CallCenterAgentPage.test.tsx`
- **Commit:** `5ae40b5`

**2. [Coordination] Page wiring co-committed with 10-08**
- **Found during:** Task 1 commit
- **Issue:** SoftphoneWidget `mode`/`SoftphoneWidgetPhone` and page `isSip` edits overlapped with concurrent 10-08 landing (`7e95ad1`).
- **Fix:** Kept page wiring as landed; committed facade + tests under feat(10-09). No duplicate page commit.
- **Files modified:** n/a (already in `7e95ad1`)

### Deferred Issues

None that block the plan goal.

## Checkpoint Status

**Type:** human-verify (live Asterisk)  
**Gate:** blocking (plan) → **deferred [ASSUMED]** per executor instructions (no live PBX)

| Item | Status | Notes |
|------|--------|-------|
| A1 PlayDTMF Channel/Digit | `[ASSUMED]` | Implemented in 10-03; needs hardware-phone DTMF far-end confirm |
| A3 DeviceState/ExtensionState | `[ASSUMED]` | registration-state poll + badge; needs unregister/re-register confirm |
| SIP chrome Dial/Journal/Contacts | code-complete | Mount guard widened; D-34 omit via SoftphoneWidget `mode==='sip'` |
| Hold/hangup/transfer via AMI | code-complete | Routed through `sipPhone`; live parity still human |

**Resume signal when PBX available:** Type `approved` or report which of A1/A3 failed with observed AMI field names.

## Tests

```text
npx vitest run --root packages/frontend useSipPhoneAmi
→ 8 passed (8)
```

`npx tsc -p packages/frontend/tsconfig.json --noEmit` — no errors in 10-09 files; pre-existing unrelated errors remain in AgentDetailModal / AgentStatusBar / PauseReasonModal / Wallboard / callCenterSlice.test (out of scope).

## Known Stubs

None.

## Threat Flags

None beyond plan threat model (T-10-09-01…03). Facade forwards only; ownership stays server-side. A1/A3 remain `[ASSUMED]` until live verify (T-10-09-03).

## Self-Check: PASSED

- FOUND: `packages/frontend/src/features/callcenter/lib/useSipPhoneAmi.ts`
- FOUND: `packages/frontend/src/features/callcenter/lib/useSipPhoneAmi.test.ts`
- FOUND: `isSip` / `(isWebrtc || isSip)` SoftphoneWidget mount in CallCenterAgentPage
- FOUND: commit `5ae40b5`
