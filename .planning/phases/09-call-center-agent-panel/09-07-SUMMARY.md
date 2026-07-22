---
phase: 09-call-center-agent-panel
plan: 07
subsystem: backend
tags: [nestjs, ami, asterisk, call-control, permissions]
status: complete

requires:
  - phase: 09-01
    provides: "cc_agent_events schema (used indirectly — new zombie/reset actions deliberately reuse the generic action-audit log instead of extending the event_type ENUM)"
  - phase: 09-05
    provides: "CallCenterPermissionsService.getEffective/assert (click_to_call gate) + peerSpy's Redirect/Originate/audit-log pattern reused throughout"
provides:
  - "AmiService.park()/parkedCalls()/deviceStateList() thin action wrappers + a corrected getActiveChannels() that actually collects CoreShowChannel events"
  - "CallCenterZombieService — 45s CoreShowChannels poll vs in-memory state diff, flags zombie candidates after a fixed 10-min grace period, never auto-hangs"
  - "CallCenterService.parkCall/retrieveParkedCall/addToConference/resetZombieCall/warmTransferToQueue/clickToCall — all own-call-ownership-guarded"
  - "POST /callcenter/agent/{park,retrieve-parked,conference-add,zombie-reset,warm-transfer-queue,click-to-call}"
affects: ["09-08", "09-10", "09-VALIDATION"]

tech-stack:
  added: []
  patterns:
    - "getCall -> tenant guard (call.userUid===userUid) -> own-call ownership guard (call.agent===agentInterface) -> channel-presence guard -> AMI, applied uniformly across all 5 new call-mutating methods (RESEARCH Security Domain)"
    - "ConfBridge/ChanSpy kept as ad hoc originate + dialplan-app-string, matching the existing supervisorSpy/peerSpy convention instead of inventing a new AMI mechanism (RESEARCH Alternatives Considered)"
    - "resetZombieCall clears local state unconditionally even when the AMI Hangup itself fails — a 'reset' must never leave the operator stuck behind a channel Asterisk has already lost track of"
    - "Zombie candidate flag lives on CallState (zombieCandidate?: boolean) and is only ever set by CallCenterZombieService / cleared by resetZombieCall or CallCenterZombieService itself on reappearance — never read anywhere else in this plan (UI wiring is 09-10)"

key-files:
  created:
    - packages/backend/src/modules/callcenter/callcenter-zombie.service.ts
    - packages/backend/src/modules/callcenter/callcenter-zombie.service.spec.ts
    - packages/backend/src/modules/callcenter/dto/callcenter-callcontrol.dto.ts
  modified:
    - packages/backend/src/modules/ami/ami.service.ts
    - packages/backend/src/modules/callcenter/callcenter-state.service.ts
    - packages/backend/src/modules/callcenter/callcenter.module.ts
    - packages/backend/src/modules/callcenter/callcenter.service.ts
    - packages/backend/src/modules/callcenter/callcenter.service.spec.ts
    - packages/backend/src/modules/callcenter/callcenter.controller.ts

key-decisions:
  - "Fixed AmiService.getActiveChannels() to actually collect CoreShowChannel/CoreShowChannelsComplete events (actionid+rawevent pattern identical to pjsipShowRegistrations()) instead of resolving on the immediate ack — the pre-existing implementation could never have worked for the zombie reconciler this plan needed to build (Rule 1 bug fix, in-scope: same file this plan already modifies for park/parkedCalls/deviceStateList)"
  - "resetZombieCall audits via LoggerService.logAction('zombie_reset', ...) instead of a new cc_agent_events.event_type value — adding 'ZOMBIE_RESET' to that column's ENUM would require a migration outside this plan's files_modified list; the existing free-text action-audit log (already used by peerSpy) covers the D-27 auditability need without a schema change"
  - "warmTransferToQueue is deliberately queue-only + own-call-ownership-guarded, distinct from the pre-existing agentTransfer (blind, any tenant target, no per-call ownership check) — the two are not merged so agentTransfer's existing behavior/tests stay untouched"
  - "clickToCall's WebRTC branch returns { mode: 'webrtc' } and issues no AMI action at all — the WebRTC client dials directly over its own signalling; only the PJSIP branch originates server-side with a Call-Info auto-answer header"

requirements-completed: [D-25, D-26, D-27, D-28, D-29, D-33]

coverage:
  - id: D27-zombie-reset
    description: "Operator can reset their own zombie call; the destructive action goes through a backend endpoint, never raw client AMI"
    requirement: "D-27"
    verification:
      - kind: test
        ref: "callcenter.service.spec.ts > resetZombieCall (5 tests: not-logged-in, cross-tenant, coworker's-call forbidden, hangup+clear+audit, hangup-failure still clears state)"
        status: pass
      - kind: test
        ref: "callcenter-zombie.service.spec.ts (6 tests: not-connected no-op, live channel not flagged, grace-window not-yet-elapsed, flagged-after-grace-period with no destructive action, cleared-on-reappearance, waiting-call-with-no-channel ignored)"
        status: pass
    human_judgment: false
  - id: D28-call-control-set
    description: "Park/retrieve, 3-way conference (ConfBridge), warm transfer to queue implemented server-side"
    requirement: "D-28"
    verification:
      - kind: test
        ref: "callcenter.service.spec.ts > parkCall/retrieveParkedCall/addToConference/warmTransferToQueue (13 tests covering guard sequence + AMI call shape)"
        status: pass
      - kind: other
        ref: "AmiService.park/parkedCalls/deviceStateList follow the queueAdd/queuePause thin-wrapper shape (ami.service.ts)"
        status: pass
    human_judgment: true
    rationale: "[ASSUMED] Park response field name (parkingSpace) and the ConfBridge-via-Redirect(Channel+ExtraChannel) mechanism are not verified against a live Asterisk instance in this repo — flagged for 09-VALIDATION manual check per RESEARCH confidence: MEDIUM."
  - id: D29-click-to-call
    description: "Client-aware click-to-call: WebRTC direct vs PJSIP originate-first with auto-answer"
    requirement: "D-29"
    verification:
      - kind: test
        ref: "callcenter.service.spec.ts > clickToCall (4 tests: not-logged-in, permission-denied Forbidden, WebRTC no-AMI-action, PJSIP Originate with Call-Info header)"
        status: pass
    human_judgment: true
    rationale: "[ASSUMED] Exact SIPADDHEADER Call-Info syntax for auto-answer is not verified against the live PJSIP endpoint config — flagged for 09-VALIDATION."
  - id: D33-warm-transfer-queue
    description: "Warm transfer to a queue"
    requirement: "D-33"
    verification:
      - kind: test
        ref: "callcenter.service.spec.ts > warmTransferToQueue (3 tests: unknown-queue rejected, coworker's-call forbidden, Redirect issued + status TRANSFERRED)"
        status: pass
    human_judgment: false
  - id: D25-D26-scope-guards
    description: "Every call-mutating action checks call ownership/tenant before AMI"
    requirement: "D-25/D-26"
    verification:
      - kind: test
        ref: "Cross-tenant and coworker's-call rejection asserted for all five ownership-guarded methods in callcenter.service.spec.ts"
        status: pass
    human_judgment: false
---

# Phase 9 Plan 07: Professional Call-Control Set Summary

Added the D-28-locked professional call-control set (zombie-call self-reset, park/retrieve, 3-way ConfBridge conference, warm transfer to queue, client-aware click-to-call) entirely server-side, each new call-mutating method enforcing the same getCall → tenant guard → own-call ownership guard → channel-presence guard sequence before touching AMI — plus a background zombie-call reconciler that only flags candidates, never auto-hangs.

## What Was Built

**Task 1 — AMI wrappers + zombie reconciler.** Added `AmiService.park()/parkedCalls()/deviceStateList()` following the existing `queueAdd`/`queuePause` thin-wrapper shape. While implementing the zombie reconciler, discovered `AmiService.getActiveChannels()` was a pre-existing bug: `CoreShowChannels` is an event-list action (resolves immediately with an ack, then Asterisk emits individual `CoreShowChannel` events followed by `CoreShowChannelsComplete`), but the old implementation just returned the ack — it could never have delivered an actual channel list to any caller. Rewrote it using the same actionid/rawevent collection pattern already proven by `pjsipShowRegistrations()`. Built `CallCenterZombieService`: an `@Interval(45s)` poll that diffs `CallCenterStateService.getAllCallsGlobal()` against a live `CoreShowChannels` result; a call is flagged `zombieCandidate: true` once none of its known channels (`callerChannel`/`agentChannel`) have appeared for `ZOMBIE_GRACE_PERIOD_MS` (fixed 10-minute floor, `[ASSUMED]` per RESEARCH Open Question #2) — it only sets a state flag, it never issues a Hangup itself. Registered in `CallCenterModule`.

**Task 2 — Call-control service methods.** Added six methods to `CallCenterService`:
- `parkCall` / `retrieveParkedCall` — park the operator's own active call; retrieve any parked call in the tenant's parking lot (parked calls aren't agent-owned, so retrieval only requires being a logged-in agent).
- `addToConference` — moves both bridged legs into a shared ConfBridge room via one `Redirect` (`Channel` + `ExtraChannel` to keep the bridge atomic) and originates the third party into the same room, reusing the existing ChanSpy-via-Originate ad hoc dialplan-app-string convention rather than inventing new AMI semantics.
- `resetZombieCall` — D-27's self-serve reset. Strictly own-call only (the anti-griefing guard from the threat model, T-09-07-01); attempts an AMI `Hangup` best-effort but always clears local state and flips the agent back to `READY` even if the hangup itself fails; audited via `LoggerService.logAction` (not a new `cc_agent_events` enum value — see Decisions).
- `warmTransferToQueue` — queue-only Redirect, distinct from the pre-existing `agentTransfer` (which has no per-call ownership check).
- `clickToCall` — resolves the requester's own agent interface, asserts `click_to_call` via `CallCenterPermissionsService`, then branches: WebRTC companion interfaces return `{ mode: 'webrtc' }` with no AMI action (client dials directly); PJSIP interfaces get an AMI `Originate` with a `Call-Info` auto-answer header, then dial the target — the same scheme documented for the D-18 missed-call callback flow.

**Task 3 — Endpoints + DTOs.** New `dto/callcenter-callcontrol.dto.ts` (kept separate from `dto/callcenter.dto.ts` to avoid cross-plan collisions, same convention as `dto/callcenter-permissions.dto.ts`) with `ParkCallDto`, `RetrieveParkedCallDto`, `ConferenceAddDto`, `ZombieResetDto`, `WarmTransferQueueDto`, `ClickToCallDto`. Added six `POST /callcenter/agent/*` routes, all behind the controller's existing `JwtAuthGuard`, ids always taken from `req.user` (never a client-supplied `userUid`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `AmiService.getActiveChannels()` never actually returned the channel list**
- **Found during:** Task 1, while building the zombie reconciler's live-channel poll.
- **Issue:** `CoreShowChannels` is an event-list action; the old implementation called `this.action({ action: 'CoreShowChannels' })` and resolved on the immediate ack, never listening for the follow-up `CoreShowChannel`/`CoreShowChannelsComplete` events that actually carry the channel data.
- **Fix:** Rewrote using the same actionid + `rawevent` listener + timeout-safety pattern already used by `pjsipShowRegistrations()`. Return type changed from `Promise<any>` to `Promise<{ events: any[] }>` — confirmed via `Grep` that no other code in the repo called this method, so the signature change is safe.
- **Files modified:** `packages/backend/src/modules/ami/ami.service.ts`
- **Commit:** `aa52855`

No other deviations — Tasks 2 and 3 executed as planned.

## Known Assumptions (flagged for 09-VALIDATION manual live-Asterisk check)

Per RESEARCH confidence notes (MEDIUM for exact AMI field names on Park/ConfBridge/DeviceState), the following are `[ASSUMED]` and should be verified against a live Asterisk instance:

1. **Park response field name.** `parkCall` reads `res?.exten || res?.parkinglot` from the `Park` action's immediate response to surface a parking-space number to the UI. Some Asterisk versions may only deliver the actual space via a follow-up `ParkedCall` event, not the ack itself.
2. **ConfBridge via Redirect(Channel+ExtraChannel).** `addToConference` redirects both bridged legs into `ConfBridge(${room})` as a literal dialplan-app-string exten, mirroring the existing (already-in-production) `supervisorSpy`/`peerSpy` ChanSpy-via-Originate convention. This relies on the tenant's dialplan evaluating that exten string as an application call — not independently verified here.
3. **Call-Info auto-answer header syntax.** `clickToCall`'s PJSIP branch sets `Variable: 'SIPADDHEADER=Call-Info: <sip:click-to-call>\;answer-after=0'`. The exact header format expected by the deployed PJSIP endpoints/phones for auto-answer is not verified against a live registration.
4. **Zombie-detection grace period (10 min fixed floor).** Documented as a conservative, non-tenant-configurable constant (`ZOMBIE_GRACE_PERIOD_MS` in `callcenter-zombie.service.ts`) per RESEARCH Open Question #2 — explicitly deferred to backlog for tenant-configurability.

None of these block shipping: all four are self-serve/candidate-flagging features with low blast radius by design (D-27's reset stays operator-triggered; the zombie flag never auto-hangs).

## Deferred / Out-of-scope

- Logged a pre-existing, unrelated test failure (`callcenter-chat.service.spec.ts`, from phase 07-07) to `deferred-items.md` — confirmed via `git log` it predates this plan and was not touched.

## Verification

- `npx jest --testPathPattern=callcenter-zombie.service.spec --no-coverage` — 6/6 passing.
- `npx jest --testPathPattern=callcenter.service.spec --no-coverage` — 59/59 passing.
- `npx jest --testPathPattern="modules/callcenter" --no-coverage` — 237/238 passing (1 pre-existing unrelated failure, see Deferred).
- `npx tsc --noEmit` — 0 errors attributable to this plan (7 pre-existing unrelated errors in `call-groups`/`ivrs`/`keyword-matcher` specs, already logged in `deferred-items.md`).

## Self-Check: PASSED

- FOUND: packages/backend/src/modules/callcenter/callcenter-zombie.service.ts
- FOUND: packages/backend/src/modules/callcenter/callcenter-zombie.service.spec.ts
- FOUND: packages/backend/src/modules/callcenter/dto/callcenter-callcontrol.dto.ts
- FOUND: commit aa52855 (Task 1)
- FOUND: commit a4f2f24 (Task 2)
- FOUND: commit c6db1a1 (Task 3)
