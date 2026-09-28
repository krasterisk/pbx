# AI voice parity — accepted implementation plan

Revision: 2026-09-28-r1. Coordinator: current chat `/root`; mode: codex-direct.
Baseline: main 7d73a2c27c1e9e8cfcc789181c816aa6179a1460 with existing unrelated speech-analytics/provider/UI changes preserved.
Source: aiPBX a1126ae; aiPBX_backend 62ffff9. Donors are read-only.

## Accepted decisions

AI robots are an additional PBX module invoked through DialplanAppsEditor / ai_voice_robot.
Reproduce donor forms, field order, conditions, choices and actions with v4 shared/ui, SCSS, local form state, typed RTK Query, RU/EN and responsive layouts.
Save affects new calls; running calls pin immutable configuration. No user-facing publish/deployment workflow.
Existing PBX modules own trunks, SIP and dialplan application. Standalone publication, widgets and external voice API are excluded.
Scripted voice-robots and administrative MCP remain separate.

## Ordered assignments

1. P1: complete typed robot configuration, tenant validation, transactional revision/save/snapshot and backward compatibility.
2. P2: donor-parity configurator and robot list, copy/delete/reference protection, provider capabilities, prompt and voice helpers.
3. P3: robot catalog in dialplan, ARI subscription/listener, cascade media/session lifecycle.
4. P4: authenticated browser audio transport/Playground and realtime adapters using the same runtime.
5. P5: real Tools/MCP CRUD and execution, knowledge documents/index/search and bindings.
6. P6: durable session journal, recordings/analytics links, existing autodial integration and parity acceptance.

## Ownership

Current chat owns ai-voice, aiRobots and their new shared contracts/components/tests, bounded edits to ai-agents, ARI, dialplan references and existing ai-tool-connectivity/knowledge. Shared schema/locale/router changes have this chat as their sole writer for this assignment; preserve adjacent dirty edits. No subagents assigned.
Speech analytics implementation, standalone/SIP publication and production changes are excluded.

## Acceptance

Field -> API -> persisted state -> effective session configuration roundtrip; browser and ARI calls for cascade/realtime; actual tools/MCP/KB; tenant isolation; reference safety; MySQL/PostgreSQL migrations; responsive RU/EN UI; npm run lint, npm run test:backend, npm run test:frontend.
Record implemented, automated-tests-passed and live-verified separately. No mock/in-memory test substitutes for live voice evidence.

## Superseded requirements

For this assignment ROBOTS-SPEC VR-01/02/06 standalone, explicit publish and separate SIP publication are replaced by the accepted PBX-module/save semantics above. Existing deployment rows and external APIs are retained for compatibility, not expanded.

## Execution checkpoint — 2026-09-28

This plan is **in_progress**, not implemented end-to-end. See [handoff and evidence](AI-VOICE-PARITY-HANDOFF.md).

| Task | Current evidence / remaining acceptance |
|---|---|
| P1 | Typed settings, DTO/API, tenant-scoped reference validation, revision lock, transactional save, immutable settings and nonsecret provider snapshots implemented; unit tests pass. Real MySQL/PG roundtrip/rollback, unique identifier concurrency constraint and legacy API write coordination remain. |
| P2 | Shared-ui editor with donor section order, voice lists, conditional pipeline fields, validation/focus, copy, unsaved-change guard, RU/EN and list implemented. Exact model catalog, prompt helpers, voice upload/preview, deletion/reference checks, bulk/mobile actions, persisted optimistic toggles and visual parity acceptance remain. |
| P3 | Catalog/schema and backward-compatible robot_uid → Stasis argument implemented and tested. ARI subscription/listener, tenant-safe resolution and actual media/session lifecycle remain. Catalog presence does not prove the robot can answer a call. |
| P4 | Not implemented in this assignment. Existing preview ticket UI is not a working Playground. |
| P5 | Only binding selectors/tenant existence checks added. Actual function/MCP/KB forms and execution still remain. |
| P6 | Not implemented in this assignment. Durable journal/recordings/autodial integration still remain. |
