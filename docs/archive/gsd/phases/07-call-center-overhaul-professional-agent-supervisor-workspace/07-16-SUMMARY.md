---
phase: 07-call-center-overhaul-professional-agent-supervisor-workspace
plan: 16
subsystem: callcenter
tags: [nestjs, ai-adapter, mcp, ari, rtp, event-bus, license-gate, callcenter]

requires:
  - phase: 07-01
    provides: CallCenterStateService RxJS Subject, CcEvent emit/getEventStream
  - phase: 07-03
    provides: QueueState KPI accumulators (SLA/answered/abandoned) for AI tools
  - phase: 07-09
    provides: supervisorForcePause/Unpause delegates for destructive MCP tools
provides:
  - CcEventBusEvent discriminated union + getTypedEventStream (D-41a)
  - CallCenterAiAdapter with 5 MCP/AI tools via AiAdapterRegistryService (D-41b)
  - CallCenterMediaBridgeService ARI externalMedia PCM skeleton (D-41c)
  - cc_ai_voice paid module seed + tenantHasModule license-gate (D-43)
affects: [future paid AI voice analytics phases, MCP tools/list, ARCHITECTURE §6]

tech-stack:
  added: []
  patterns:
    - "Typed overlay on existing RxJS Subject — no second EventEmitter2 bus"
    - "Domain AI Adapter self-register; vpbxUserUid always handler param (D-42)"
    - "Inert media skeleton + ModulesRegistryService.tenantHasModule gate (D-43)"

key-files:
  created:
    - packages/backend/src/modules/callcenter/cc-event-bus.types.ts
    - packages/backend/src/modules/callcenter/cc-event-bus.types.spec.ts
    - packages/backend/src/modules/callcenter/callcenter-ai.adapter.ts
    - packages/backend/src/modules/callcenter/callcenter-ai.adapter.spec.ts
    - packages/backend/src/modules/callcenter/callcenter-media-bridge.service.ts
    - packages/backend/src/modules/callcenter/callcenter-media-bridge.service.spec.ts
  modified:
    - packages/backend/src/modules/callcenter/callcenter-state.service.ts
    - packages/backend/src/modules/callcenter/callcenter.module.ts
    - packages/backend/src/modules/voice-robots/voice-robots.module.ts
    - packages/backend/src/modules/cloud-admin/modules-registry.service.ts

key-decisions:
  - "Reuse existing Subject via getTypedEventStream + mapCcEventToBusEvent; no EventEmitter2 (D-41a)"
  - "externalMedia format alaw (not slin16) to match RtpSession A-law→PCM16 decode path"
  - "Export RtpUdpServerService from VoiceRobotsModule for CC media bridge (minimal, no cycle)"
  - "NestJS in-monorepo + license-gate confirmed over external-service (D-45 / research Pattern 6)"

patterns-established:
  - "Pattern: CC AI tools register via CallCenterAiAdapter → AiAdapterRegistryService.getAllTools()"
  - "Pattern: paid CC AI sleeps behind tenantHasModule('cc_ai_voice') until tenant_modules activates"

requirements-completed: [D-41, D-42, D-43, D-44, D-45]

duration: 10min
completed: 2026-07-16
---

# Phase 07 Plan 16: AI-ready foundation Summary

**Typed CC event bus, CallCenterAiAdapter (5 MCP tools with tenant-param isolation), and licensed ARI externalMedia PCM skeleton without STT**

## Performance

- **Duration:** 10 min
- **Started:** 2026-07-16T02:55:38Z
- **Completed:** 2026-07-16T03:05:00Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- Defined `CcEventBusEvent` (5 variants incl. `media.pcmFrame`) and `getTypedEventStream()` over the existing Subject (D-41a)
- Registered `CallCenterAiAdapter` with read tools + destructive force-pause/unpause; handlers take `vpbxUserUid` as parameter (D-41b/D-42); closes ARCHITECTURE §6 gap
- Built inert `CallCenterMediaBridgeService` reusing voice-robots RTP + ARI externalMedia; emits PCM frames only; gated by `cc_ai_voice` (D-41c/D-43/D-45)
- No CC schema AI-agent fields (D-44); no STT/VAD imports

## Task Commits

1. **Task 1: Типизированный CC event bus** - `595dc2f` (feat)
2. **Task 2: CallCenterAiAdapter + MCP tools** - `1d27150` (feat)
3. **Task 3: Media PCM skeleton + license-gate** - `8c5f912` (feat)

**Plan metadata:** `00f7170` (docs: complete plan)

## Files Created/Modified

- `cc-event-bus.types.ts` — discriminated union + mapper
- `callcenter-state.service.ts` — `getTypedEventStream()` re-export
- `callcenter-ai.adapter.ts` — Domain AI Adapter, 5 tools, compact `buildSummary`
- `callcenter-media-bridge.service.ts` — `attachPcmSkeleton` / `detachPcmSkeleton`
- `callcenter.module.ts` — AiPlatformModule, AriModule, VoiceRobotsModule, CloudAdminModule wiring
- `voice-robots.module.ts` — export `RtpUdpServerService`
- `modules-registry.service.ts` — seed `cc_ai_voice` (`is_paid=true`, category analytics)

## Decisions Made

- Keep single RxJS Subject; typed overlay only (anti-pattern «второй event bus» avoided)
- Use `alaw` with existing RTP decoder instead of plan's `slin16` (correctness)
- Confirm NestJS module + `@RequiresModule`/`tenantHasModule` over external microservice (D-45)
- Future AI endpoints should use `@RequiresModule('cc_ai_voice')` + `ModuleAccessGuard`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] externalMedia format alaw instead of slin16**
- **Found during:** Task 3
- **Issue:** Plan specified `slin16`, but `RtpSession` always decodes A-law payloads to PCM16; slin16 would corrupt frames
- **Fix:** Call `externalMedia(..., 'alaw', ...)`; documented in code comment
- **Files modified:** `callcenter-media-bridge.service.ts`
- **Verification:** media-bridge spec asserts `'alaw'` arg
- **Committed in:** `8c5f912`

**2. [Rule 2 - Missing critical] Export RtpUdpServerService from VoiceRobotsModule**
- **Found during:** Task 3
- **Issue:** Service was not exported; CallCenter could not inject it without duplication
- **Fix:** Added `RtpUdpServerService` to `VoiceRobotsModule.exports`
- **Files modified:** `voice-robots.module.ts`
- **Verification:** Nest wiring via CallCenterModule imports VoiceRobotsModule
- **Committed in:** `8c5f912`

---

**Total deviations:** 2 auto-fixed (1 Rule 1, 1 Rule 2)
**Impact on plan:** Correctness-only; no scope creep. External-service approach rejected per research (documented decision).

## Issues Encountered

None

## User Setup Required

None — license activates via existing `tenant_modules` / cloud admin when deploying paid AI.

## Known Stubs

None that block the plan goal. Media bridge is intentionally inert (no auto StasisStart) — future paid module calls `attachPcmSkeleton`.

## Threat Flags

None beyond plan threat model. Mitigations applied:
- T-07-16-01: uid param proven in `callcenter-ai.adapter.spec.ts`
- T-07-16-02: destructive flags on force-pause/unpause
- T-07-16-03: PCM only to tenant-filtered event bus
- T-07-16-04: `tenantHasModule('cc_ai_voice')` no-op gate

## Verification Results

- `npm run test:cc -w @krasterisk/backend` — **138 passed** (17 suites)
- Grep: no `EventEmitter2` in callcenter; no `StreamingSttService`/VAD in media-bridge; no ai-agent fields in `models/*.ts`

## Next Steps

- Execute remaining plan **07-15** if still incomplete
- Optional: MCP `tools/list` smoke check for `cc_*` tool names
- Future phase: paid AI voice module subscribes to `getTypedEventStream().pipe(filter(e => e.type === 'media.pcmFrame'))`

## Self-Check: PASSED

- FOUND: `cc-event-bus.types.ts`, `callcenter-ai.adapter.ts`, `callcenter-media-bridge.service.ts`, `07-16-SUMMARY.md`
- FOUND commits: `595dc2f`, `1d27150`, `8c5f912`
