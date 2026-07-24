---
phase: 10-full-softphone
plan: 08
subsystem: ui
tags: [softphone, webrtc, tabs, registration, call-quality, audio-devices]

requires:
  - phase: 10-04
    provides: dial buffer sessionStorage + registration/Recover i18n keys
  - phase: 10-05
    provides: SoftphoneJournal component
  - phase: 10-06
    provides: SoftphoneContacts component
provides:
  - Chrome-only SoftphoneWidget (fab purged) with shared/ui/Tabs Dial/Journal/Contacts
  - Transport-agnostic SoftphoneWidgetPhone + mode webrtc|sip prop
  - Redial + F5 dial-buffer restore, registration badge/banner/Recover
  - WebRTC-only quality compact+detail and device picker (DOM-absent in SIP)
affects: [10-09-sip-ami-softphone]

tech-stack:
  added: []
  patterns:
    - SoftphoneWidgetPhone structural interface (no hook imports in widget)
    - SoftphoneDevicePicker child mounts useAudioDevices only when mode=webrtc
    - shared/ui/Tabs replaces hand-rolled role=tab row

key-files:
  created: []
  modified:
    - packages/frontend/src/features/callcenter/ui/SoftphoneWidget/SoftphoneWidget.tsx
    - packages/frontend/src/features/callcenter/ui/SoftphoneWidget/SoftphoneWidget.module.scss
    - packages/frontend/src/features/callcenter/ui/SoftphoneWidget/SoftphoneWidget.test.tsx
    - packages/frontend/src/features/callcenter/ui/SoftphoneWidget/index.ts
    - packages/frontend/src/features/callcenter/index.ts
    - packages/frontend/src/features/callcenter/lib/useWebRTCPhone.ts
    - packages/frontend/src/pages/CallCenterAgentPage/CallCenterAgentPage.tsx

key-decisions:
  - "SoftphonePlacement removed from SoftphoneWidget; API softphone_placement type retained in callCenterApi"
  - "mode defaults to webrtc; AgentPage passes mode=webrtc + device change callbacks"
  - "Device picker isolated in SoftphoneDevicePicker so SIP never enumerates mediaDevices"
  - "useWebRTCPhone gained switchMicrophone/switchSpeaker + ensureConnected(force) for Recover"

patterns-established:
  - "Chrome-only softphone: SoftphoneVariant is chrome-only; trigger testid softphone-widget-trigger"
  - "Quality/devices gated on mode===webrtc (D-34 DOM absent)"

requirements-completed: [D-16, D-17, D-18, D-19, D-20, D-21, D-22, D-23, D-24, D-26, D-27, D-34]

coverage:
  - id: D1
    description: Fab variant fully removed; chrome shell with shared/ui/Tabs Dial/Journal/Contacts
    requirement: D-26
    verification:
      - kind: unit
        ref: packages/frontend/src/features/callcenter/ui/SoftphoneWidget/SoftphoneWidget.test.tsx#renders chrome-only shell with three Tabs (no fab)
        status: pass
    human_judgment: false
  - id: D2
    description: Journal/Contacts mounted; Redial dials lastNumber; registration badge/banner/Recover after 10s
    requirement: D-19
    verification:
      - kind: unit
        ref: packages/frontend/src/features/callcenter/ui/SoftphoneWidget/SoftphoneWidget.test.tsx#enables Redial when lastNumber exists and dials it
        status: pass
      - kind: unit
        ref: packages/frontend/src/features/callcenter/ui/SoftphoneWidget/SoftphoneWidget.test.tsx#shows registration badge online/registering/offline and Recover after timeout
        status: pass
    human_judgment: false
  - id: D3
    description: WebRTC quality+devices present; SIP mode omits both from DOM; inline device-switch error
    requirement: D-34
    verification:
      - kind: unit
        ref: packages/frontend/src/features/callcenter/ui/SoftphoneWidget/SoftphoneWidget.test.tsx#renders quality + device picker in WebRTC mode and omits both in SIP mode
        status: pass
      - kind: unit
        ref: packages/frontend/src/features/callcenter/ui/SoftphoneWidget/SoftphoneWidget.test.tsx#shows inline device-switch error on failure
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-07-24
status: complete
---

# Phase 10 Plan 08: SoftphoneWidget Chrome Shell Summary

**Chrome-only SoftphoneWidget with Tabs (Dial/Journal/Contacts), transport-agnostic phone+mode props, redial/F5 restore, registration Recover UX, and WebRTC-only quality+device picker omitted in SIP**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-24T22:10:50Z
- **Completed:** 2026-07-24T22:18:00Z
- **Tasks:** 3 (combined into one feat commit per executor instruction)
- **Files modified:** 7

## Accomplishments

- Purged fab variant/SCSS/placement from SoftphoneWidget; chrome trigger + sticky mobile remain
- Replaced hand-rolled tab row with `shared/ui/Tabs`; mounted SoftphoneJournal + SoftphoneContacts
- Dial: Redial + sessionStorage dial buffer/lastNumber; registration badge/banner with Recover after 10s
- WebRTC quality compact (trigger) + MOS/jitter/RTT/loss detail; mic/speaker picker with inline error; SIP omits both

## Task Commits

Each task was committed atomically:

1. **Tasks 1–3: SoftphoneWidget chrome shell (Tabs, redial/registration, quality/devices)** - `7e95ad1` (feat)

**Plan metadata:** _(docs commit after this SUMMARY)_

## Files Created/Modified

- `SoftphoneWidget.tsx` — chrome-only shell, SoftphoneWidgetPhone, mode, Journal/Contacts, redial, registration, quality/devices
- `SoftphoneWidget.module.scss` — fab classes removed; badge/banner/quality/device/sticky registration styles
- `SoftphoneWidget.test.tsx` — fab absence, Tabs, Journal/Contacts, Redial, Recover timeout, SIP omission, device error
- `useWebRTCPhone.ts` — ensureConnected(force), switchMicrophone/switchSpeaker (folded WIP + D-23)
- `CallCenterAgentPage.tsx` — mode=webrtc, onMic/SpeakerDeviceChange (SSE-recovery WIP left uncommitted for 10-09)

## Decisions Made

- Removed SoftphonePlacement from the widget barrel; kept API `softphone_placement` type in callCenterApi (settings persistence)
- Isolated device enumeration in SoftphoneDevicePicker child so SIP mode never calls mediaDevices (T-10-08-01)
- Folded useWebRTCPhone reconnect WIP into 10-08 for Recover; left AgentPage Nest/SSE ensureConnected WIP out of this commit

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Mid-call mic/speaker switch on useWebRTCPhone**
- **Found during:** Task 3
- **Issue:** SoftphoneWidget device picker needs track/sink switch; hook only applied devices at call setup
- **Fix:** Added `switchMicrophone` / `switchSpeaker` on useWebRTCPhone; AgentPage wires preferred-device callbacks
- **Files modified:** useWebRTCPhone.ts, CallCenterAgentPage.tsx, SoftphoneWidget.tsx
- **Verification:** SoftphoneWidget device-error + SIP-omission tests pass
- **Committed in:** 7e95ad1

**2. [Rule 2 - Threat mitigation] Gate useAudioDevices behind WebRTC-only child**
- **Found during:** Task 3
- **Issue:** Calling useAudioDevices in SoftphoneWidget body would enumerate devices even in SIP mode
- **Fix:** SoftphoneDevicePicker child mounted only when `mode === 'webrtc'`
- **Files modified:** SoftphoneWidget.tsx
- **Verification:** SIP mode test asserts device picker absent
- **Committed in:** 7e95ad1

---

**Total deviations:** 2 auto-fixed (2 missing critical / threat)
**Impact on plan:** Required for D-23 and T-10-08-01; no scope creep beyond softphone shell.

## Issues Encountered

- Radix Tabs need `userEvent.click` (fireEvent does not activate tab content) — fixed in Journal/Contacts test
- Pre-existing AgentPage SSE-recovery WIP and untracked `useSipPhoneAmi*` left untouched for 10-09

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- SoftphoneWidget accepts `mode="sip"` and SoftphoneWidgetPhone shape for 10-09 `useSipPhoneAmi`
- AgentPage still mounts softphone only for `isWebrtc` — 10-09 opens SIP path and drops quality/devices via mode

## Self-Check: PASSED

- SoftphoneWidget.tsx / .module.scss / .test.tsx present
- Commit `7e95ad1` present on main
- `npx vitest run --root packages/frontend SoftphoneWidget.test` — 8/8 passed
- No `.fab`/`.fabWrap`/`.fabRinging` classes remain in SoftphoneWidget SCSS

---
*Phase: 10-full-softphone*
*Completed: 2026-07-24*
