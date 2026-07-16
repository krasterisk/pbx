---
phase: 07-call-center-overhaul-professional-agent-supervisor-workspace
plan: 22
subsystem: infra
tags: [callcenter, webrtc, asterisk-wss, env-docs, gap-closure, i18n]

requires:
  - phase: 07-21
    provides: missing-wssUrl toast + throw so ShiftLoginModal stays open; myAgentInterface bind on success
  - phase: 07-14
    provides: GET /callcenter/webrtc/config, webrtcConfigMissing locale key, softphone REGISTER path
provides:
  - ASTERISK_WSS_URL and SIP_DOMAIN documented in .env.example
  - Operator-facing webrtcConfigMissing copy names ASTERISK_WSS_URL (en/ru)
  - Controller JSDoc clarifies null wssUrl = unset ASTERISK_WSS_URL; SIP_DOMAIN note
affects:
  - 07-UAT
  - WebRTC softphone ops setup

tech-stack:
  added: []
  patterns:
    - Missing WSS is an explicit ops/config failure (toast + throw); no fabricated Asterisk conf samples

key-files:
  created: []
  modified:
    - .env.example
    - packages/backend/src/modules/callcenter/callcenter-webrtc.controller.ts
    - packages/frontend/src/shared/config/locales/en.ts
    - packages/frontend/src/shared/config/locales/ru.ts

key-decisions:
  - "Document ASTERISK_WSS_URL + SIP_DOMAIN + optional WEBRTC_TURN_* in .env.example only — no invented pjsip/http.conf"
  - "UI copy names the env var so operators can escalate to admins with an actionable message"

patterns-established:
  - "Null wssUrl from GET /callcenter/webrtc/config is a documented deploy-env failure, not a softphone bug"

requirements-completed: [D-14, D-17]

duration: 6min
completed: 2026-07-16
---

# Phase 07 Plan 22: Gap Closure ASTERISK_WSS_URL Docs + Missing-WSS UI Summary

**Ops can set ASTERISK_WSS_URL from .env.example; agents see an actionable toast naming that env var when wssUrl is null**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-16T12:01:09Z
- **Completed:** 2026-07-16T12:05:00Z
- **Tasks:** 1
- **Files modified:** 4

## Accomplishments
- Added Call Center / WebRTC section to `.env.example` (`ASTERISK_WSS_URL`, `SIP_DOMAIN`, optional STUN/TURN keys matching the controller)
- Expanded `CallCenterWebrtcController` JSDoc: null `wssUrl` means unset `ASTERISK_WSS_URL`; `SIP_DOMAIN` used by endpoint credentials, not this API
- Updated en/ru `webrtcConfigMissing` to name `ASTERISK_WSS_URL` with an example WSS URL
- Confirmed `CallCenterAgentPage` already toasts + throws on missing WSS (from 07-21) — no agentLogin/phone.connect/myAgentInterface on that path

## Task Commits

Each task was committed atomically:

1. **Task 1: Document ASTERISK_WSS_URL + SIP_DOMAIN; clarify missing-WSS UX** - `432017d` (feat)

**Plan metadata:** `8875e08` (docs: complete plan)

## Files Created/Modified
- `.env.example` — Call Center WebRTC env keys and comments
- `packages/backend/src/modules/callcenter/callcenter-webrtc.controller.ts` — JSDoc for unset WSS / SIP_DOMAIN note (runtime unchanged)
- `packages/frontend/src/shared/config/locales/en.ts` — webrtcConfigMissing names ASTERISK_WSS_URL
- `packages/frontend/src/shared/config/locales/ru.ts` — same in Russian

## Decisions Made
- Document env only; do not invent Asterisk PJSIP/WSS server config files as a substitute
- Keep CallCenterAgentPage behavior from 07-21 (toast + throw); strengthen message via locales only

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `gsd-tools` CLI not available in this workspace (`.cursor/gsd-core/bin/gsd-tools.js` missing); STATE/ROADMAP updated manually

## User Setup Required
**External service:** Asterisk WSS must be configured in deploy `.env`:
- `ASTERISK_WSS_URL` — e.g. `wss://pbx.example.com:8089/ws` (must match live Asterisk PJSIP WebSocket)
- `SIP_DOMAIN` — optional; falls back to `DB_HOST` / `localhost` for credential domain

See plan `user_setup` / `.env.example` Call Center WebRTC section.

## Next Phase Readiness
- Gap closure plans 07-21 and 07-22 complete for UAT Test 1/2 secondary blockers
- Re-UAT WebRTC: with identity fix + real `ASTERISK_WSS_URL`, REGISTER should no longer abort on null wssUrl
- Ops must still point `ASTERISK_WSS_URL` at a live Asterisk WSS endpoint

## Self-Check: PASSED
- FOUND: `.env.example`, controller, en.ts, ru.ts contain `ASTERISK_WSS_URL`
- FOUND: commit `432017d`
- FOUND: `07-22-SUMMARY.md`
- CallCenterAgentPage missing-WSS path verified present (no file change required)

---
*Phase: 07-call-center-overhaul-professional-agent-supervisor-workspace*
*Completed: 2026-07-16*
