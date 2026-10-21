---
phase: 10-full-softphone
plan: 03
subsystem: api
tags: [ami, nestjs, callcenter, sip, dtmf, presence]

requires:
  - phase: 10-full-softphone/10-01
    provides: callcenter.service/controller ownership patterns + contacts DTO file
  - phase: 09-call-center-agent-panel/09-11
    provides: CallCenterPresenceService DeviceState/ExtensionState cache
provides:
  - AmiService.playDtmf PlayDTMF thin wrapper (D-32)
  - POST /callcenter/agent/dtmf ownership-gated sendDtmf
  - GET /callcenter/agent/registration-state { online } (D-35)
affects: [10-09, phase-10-verify-work]

tech-stack:
  added: []
  patterns:
    - "PlayDTMF thin AmiService wrapper; digit validation in DTO + service defense-in-depth"
    - "Registration-state: isWebrtcCompanion → primaryIdOf before extractExtension (Pitfall 3)"

key-files:
  created: []
  modified:
    - packages/backend/src/modules/ami/ami.service.ts
    - packages/backend/src/modules/callcenter/callcenter.service.ts
    - packages/backend/src/modules/callcenter/callcenter.controller.ts
    - packages/backend/src/modules/callcenter/dto/callcenter-contacts.dto.ts
    - packages/backend/src/modules/callcenter/callcenter.service.spec.ts

key-decisions:
  - "DTMF uses agentChannel preferred over callerChannel"
  - "Offline DeviceState: UNAVAILABLE/INVALID/UNKNOWN or missing → online:false"
  - "A1/A3 remain [ASSUMED] for 10-09 live Asterisk checkpoint"

requirements-completed: [D-32, D-33, D-35]

coverage:
  - id: D1
    description: "sendDtmf PlayDTMF on own call channel; rejects bad digit and foreign uniqueid"
    requirement: "D-32"
    verification:
      - kind: unit
        ref: "callcenter.service.spec.ts#sendDtmf"
        status: pass
    human_judgment: true
    rationale: "PlayDTMF param shape A1 needs live Asterisk check in 10-09"
  - id: D2
    description: "getMyRegistrationState { online } from presence; WebRTC→primary mapping"
    requirement: "D-35"
    verification:
      - kind: unit
        ref: "callcenter.service.spec.ts#getMyRegistrationState"
        status: pass
    human_judgment: true
    rationale: "DeviceState field names A3 need live check in 10-09"
  - id: D3
    description: "SIP outbound reuses clickToCall/originateDial (no new dial path)"
    requirement: "D-33"
    verification:
      - kind: other
        ref: "no new dial-routing code; clickToCall unchanged"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-07-24
status: complete
---

# Phase 10: Plan 03 Summary

**SIP AMI primitives: PlayDTMF sendDtmf + my-endpoint registration-state online/offline.**

## Accomplishments

- `AmiService.playDtmf` + validated `POST /agent/dtmf` with parkCall-style ownership.
- `GET /agent/registration-state` via presence + `extractExtension`/`isWebrtcCompanion`.

## Verification

- `callcenter.service.spec` — 95 passed (incl. 6 new DTMF/registration cases)

## Next

- Wave 3: **10-04** Frontend foundation (RTK/SSE/i18n)
