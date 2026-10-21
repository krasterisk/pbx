# AI voice parity — implementation checkpoint

Date: 2026-09-28. Coordinator: current chat `/root`; mode: `codex-direct`.
Current plan: [AI-VOICE-PARITY-PLAN.md](AI-VOICE-PARITY-PLAN.md), revision 2026-09-28-r1.
Status: **partial implementation / in_progress**, not full parity, not live-verified, not released.
Baseline main `7d73a2c27c1e9e8cfcc789181c816aa6179a1460`, with pre-existing dirty speech analytics/provider/admin changes. No commits, migrations, deployment, production calls or provider charges performed.

## Implemented slice

- `packages/shared/src/types/ai-voice.types.ts`: typed settings, defaults, shared validation and UTF-8 payload limit; index export.
- `packages/backend/src/modules/ai-voice/robot-config.{controller,service}.ts`, `dto/save-robot.dto.ts`, module registration: tenant-aware list/get/create/save, If-Match, agent/draft locks, one transaction for draft/version/bindings, complete settings snapshot and whitelisted nonsecret provider connection snapshots. Existing sessions are not updated. Existing table schemas reused.
- Legacy agent canonical fields and VAD settings populate the new configuration; extended settings remain in the draft. Archived rows cannot be resurrected through Save.
- `packages/frontend/src/features/aiRobots/ui/{RobotSettingsForm,RobotEditor,RobotsTable}` and `model/voiceChoices`: feature-owned editor, local form state, shared UI, SCSS, RU/EN, copy opens a draft, stale-save handling, first invalid field focus, unsaved-close confirmation; thin studio page.
- Shared RTK endpoint `aiVoiceRobotsApi`, locale `aiVoiceDesigner`, bounded locale imports and tool-list kind typing.
- Dialplan `aiVoiceRobots` catalog in schema types/useSchemaRefs/CATALOG_DEFAULTS, catalog refresh dependencies; shared/backend robot_uid contract; Stasis robot argument with legacy deployment support. No listener has been implemented yet.

## Checks

- Shared build: PASS.
- Backend TypeScript build check: PASS, including the provider snapshot and reference-kind changes.
- Robot configuration tests: 17/17 PASS, mocked repositories/transaction only; not real database isolation evidence.
- Targeted backend configuration/dialplan suites: 7 files, 304 tests PASS.
- New frontend editor/list/voice/studio tests: 5 files, 14 tests PASS.
- Dialplan hook/editor/StepSheet/playback regression tests after new query mocks: 4 files, 37 tests PASS, including post-load catalog refresh.
- Targeted new backend/frontend ESLint: PASS, repeated after fixes. `git diff --check`: PASS (line-ending warnings only).
- Full backend suite: FAIL, 361 passed suites, 1 failed, 1 skipped; 3468 passed tests, 1 failed, 11 skipped. Failure: existing `ai-connectivity.module.spec.ts` does not override the CloudSetting repository now required by AiConnectivityModule. This assignment did not modify that module/test.
- Full `npm run lint`: FAIL on six pre-existing speech-analytics backend errors (analysis-prompt preserve-caught-error, unsafe Function types). Separate frontend lint: FAIL on SpeechAnalyticsJournalPage preserve-caught-error. Do not fix adjacent owned changes implicitly.
- Full frontend typecheck: FAIL on pre-existing TenantDrawer, speechAnalytics and SttEngineFormModal type/export errors. New test state inference and partial-hook mock typing errors were fixed; final rerun contains no errors in this assignment's files.
- Full frontend suite COMPLETED with exit 1: 287 discovered files; 282 passed, 5 failed in that run. Four failures were pre-fix missing API mocks in dialplan suites (27 tests), now fixed and all four rerun PASS. The remaining failure is the existing SpeechAnalyticsProjectPage test, whose API mock lacks useGetSaProjectVersionsQuery. Chunk 8 passed 7 files / 83 tests. New test files added after initial discovery are covered by targeted runs above. No test processes remain running. Full suite was not rerun a second time after fixing the four mocks; do not call this a full-suite PASS.
- Live DB, microphone/audio, PBX calls, provider calls, visual/mobile screenshot parity and independent review: PENDING, not claimed.

## Exact next work

1. Resume from this checkpoint; validation processes have completed. Preserve unrelated failures separately from this scope; this is not a full release-ready state.
2. Finish P1: enforce tenant unique_id at DB level safely (existing schema has no unique index; current duplicate precheck is not a concurrent uniqueness guarantee); coordinate manifest ownership because migration 0028/manifest are already dirty from another scope. Coordinate old ai-agents update/delete/publish endpoints so they cannot bypass snapshot/reference semantics. Add real MySQL/PG rollback/concurrency evidence.
3. Finish P2 using donor files, not guesses: dynamic model catalog, prompt templates/generation, WAV voice upload/preview, typed transfer destination catalog, archive/delete with route/IVR/reference protection, bulk selection/delete, mobile cards and persisted optimistic list toggles. Current transfer destinations are a text list, not a completed catalog.
4. P3: add PBX-specific adapter without importing mandatory ARI/PBX models into standalone AiVoiceModule. Subscribe to dedicated AI ARI app, enforce channel tenant ownership, resolve saved robot snapshot, reuse proven media primitives safely, implement cascade lifecycle/cancellation/barge-in and journal writes. Current `robot:uid` argument has no runtime consumer.
5. P4–P6: real authenticated browser audio/shared runtime, realtime adapters, tools/MCP/knowledge implementations and durable journal/integrations. Existing modules contain scaffolding, not completed functionality.

All owned unfinished work stays with `/root` in this chat. No subagents assigned. Do not mark this plan complete from passing unit tests or this checkpoint.
