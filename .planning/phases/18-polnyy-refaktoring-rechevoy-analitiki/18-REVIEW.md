---
phase: 18-polnyy-refaktoring-rechevoy-analitiki
reviewed: 2026-09-23T03:00:00Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - packages/backend/src/modules/routes/dialplan-webhooks.service.spec.ts
  - packages/backend/src/modules/routes/routes.module.ts
  - packages/backend/src/modules/speech-analytics/dashboard/insights.service.spec.ts
  - packages/backend/src/modules/speech-analytics/dashboard/insights.service.ts
  - packages/backend/src/modules/speech-analytics/hangup-analytics.port.spec.ts
  - packages/backend/src/modules/speech-analytics/hangup-analytics.port.ts
  - packages/backend/src/modules/speech-analytics/ingest/public-ingest.wiring.spec.ts
  - packages/backend/src/modules/speech-analytics/ingest/public-ingest.wiring.ts
  - packages/backend/src/modules/speech-analytics/jobs/sa-analysis.worker.nest.ts
  - packages/backend/src/modules/speech-analytics/jobs/sa-analysis.worker.spec.ts
  - packages/backend/src/modules/speech-analytics/jobs/sa-analysis.worker.ts
  - packages/backend/src/modules/speech-analytics/speech-analytics-ai.adapter.spec.ts
  - packages/backend/src/modules/speech-analytics/speech-analytics-ai.adapter.ts
  - packages/backend/src/modules/speech-analytics/speech-analytics-public.controller.spec.ts
  - packages/backend/src/modules/speech-analytics/speech-analytics-public.controller.ts
  - packages/backend/src/modules/speech-analytics/speech-analytics.module.ts
findings:
  critical: 3
  warning: 5
  info: 3
  total: 11
status: issues_found
---

# Phase 18: Code Review Report (gap-closure)

**Reviewed:** 2026-09-23T03:00:00Z
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

Adversarial review of the post-`2f60a1c1` gap-closure delta (plans 18-16…18-19): hangup port + Nest worker binding, public ingest UUID wiring, insights charge persistence, AI adapter Nest registration, and Routes↔SA module wiring.

Locked product rules that hold in this delta: no `settleShadow` / `BillingBalanceService` / wallet debit; runs and insights persist `charged: false`; public success ids are UUID `createRun` recording ids (not `journal:` stubs); body cannot override token project; batch item failures continue; >50MB rejected before createRun; duplicate hangup origin replays; pause gates hangup enqueue in dialplan (not manual upload); Nest worker factory always injects `runAnalysis`; stereo path does not request dual-STT; no analyst role; token secret stripped from chat-history proposals.

Three critical defects remain: AI project apply wipes draft fields on partial config, hangup Nest path bills `audioMs` from file byte size, and public “accepted” batches still await full scored analysis on the HTTP thread.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: AI project apply merges partial config onto defaults and wipes the draft

**File:** `packages/backend/src/modules/speech-analytics/speech-analytics-ai.adapter.ts:210-218`
**Issue:** `proposeEdit` correctly merges `{ ...state.draft, ...input.config }` when deciding publish, but the apply payload stores only the partial `input.config`. `apply` then calls `mergeConfig(args.config)` which does `{ ...defaultSaProjectConfig(), ...partial }`. Confirming a metric-only edit therefore resets topics, webhooks, digest, alerts, budget, prompts, and other draft fields to defaults, and can publish that wiped config when `publish: true`.
**Fix:**
```typescript
apply: async (args, ctx) => {
  const state = await this.projects.getEditorState(ctx.vpbxUserUid, args.project_id);
  const merged = this.mergeConfig({ ...state.draft, ...args.config });
  return this.projects.applyEditorUpdate(ctx.vpbxUserUid, {
    projectId: args.project_id,
    expectedRevision: args.expected_revision,
    config: merged,
    publish: args.publish,
    level: ctx.role,
  });
},
```
Alternatively put the full merged config into `applyPayload` during `proposeEdit` and keep apply as a pure write of that snapshot (still re-validate revision).

### CR-02: Hangup Nest worker passes file byte size as `audioMs`

**File:** `packages/backend/src/modules/speech-analytics/jobs/sa-analysis.worker.nest.ts:130-136`
**Issue:** `createSaAnalysisWorker` calls `pipelineRunAnalysis` with `audioMs: Math.max(0, bytes)` where `bytes` is the stable file size from `waitForFile`. SA-CHARGE-RUN then persists that value as `audio_ms` and uses it for amount math (even with `charged: false`). A multi‑MB recording is stored as millions of “milliseconds”. Hangup already has `durationSec` on `HangupAnalysisJobInput`, but `SaAnalysisJob` / fire-and-forget payload never carry it.
**Fix:** Extend `SaAnalysisJob` with `audioMs` (or `durationSec`), set it from hangup `durationSec * 1000` in `HangupAnalyticsPortService.enqueueAnalysisJob`, and pass that into the Nest `runAnalysis` wrapper. Fall back to STT `durationSec` when duration is unknown — never use raw file bytes as ms.

### CR-03: Public “accepted” batches still await scored analysis on the request thread

**File:** `packages/backend/src/modules/speech-analytics/speech-analytics-public.controller.ts:103-149`
**Issue:** Controller docs claim `sync=true` + one file waits, otherwise an accepted batch returns. Gap-closure wires `buildPublicUploadDeps` / `buildPublicUrlDeps` so `runAnalysis` is real `pipeline/run-analysis`. `UploadService` / `UrlIngestService` still `await` analysis for every item before returning, including `sync: false` and multi-file/URL batches — only the response `kind` changes. With real STT this blocks HTTP for the full batch, contradicts D-17/D-39 “accepted immediately”, and amplifies timeouts; stubs previously hid the bug.
**Fix:** When `apiWaitsForResult` / `urlApiWaitsForResult` is false, persist the journal/run, schedule analysis asynchronously (same fire-and-forget pattern as hangup), and return `kind: 'accepted'` with UUID `journalId`s without awaiting score. Keep await only for the single-item `sync=true` path.

## Warnings

### WR-01: Production public + hangup Nest paths default STT/score to null

**File:** `packages/backend/src/modules/speech-analytics/ingest/public-ingest.wiring.ts:105-110`
**Issue:** `defaultPipelineDeps` uses `stt: async () => null` and `score: async () => null`. The public controller never injects `pipelineDeps` / `runScoredAnalysis`. Nest hangup worker (`sa-analysis.worker.nest.ts:49-58`) similarly defaults to null providers. Every scored path therefore ends in `stt_silent` / error after `createRun` / enqueue — UUID rows exist, but analysis never completes until providers are wired.
**Fix:** Inject real STT/score ports from the AI media stack into `buildPublicUploadDeps` / `createSaAnalysisWorker` (or fail closed at module boot if required providers are missing), and surface a clear `provider_unconfigured` reason instead of a silent null.

### WR-02: Hangup Nest forces stereo + verified on MP3 paths

**File:** `packages/backend/src/modules/speech-analytics/jobs/sa-analysis.worker.nest.ts:84-93,137-140`
**Issue:** Worker reads the recording as a Buffer (typically `.mp3` after dialplan ffmpeg) and passes `channels: 2`, `stereoVerified: true` into diarize. Energy stereo labeling expects PCM WAV; MP3 bytes will not parse, so channel-energy stereo never works for route hangup despite the flags claiming verified stereo.
**Fix:** Detect container/codec (or convert to WAV before energy), or set `stereoVerified: false` / `channels: 1` until a WAV energy path exists. Prefer passing true channel metadata from MixMonitor/ffmpeg rather than hardcoding.

### WR-03: Optional missing `SA_ANALYSIS_WORKER` silently drops hangup jobs

**File:** `packages/backend/src/modules/speech-analytics/hangup-analytics.port.ts:48,285-296`
**Issue:** Worker is `@Optional()`. If DI fails to bind `SA_ANALYSIS_WORKER`, `enqueueAnalysisJob` still admits `ai_jobs` / `sa_analysis_runs` (`charged: false`) but never schedules `processJob`. Specs treat null worker as acceptable; production would leave queued runs stuck with no error transition.
**Fix:** Make `SA_ANALYSIS_WORKER` required in production, or on missing worker mark the run `error` / `worker_unbound` inside the same transaction instead of returning success.

### WR-04: `enqueueAnalysisJob` does not re-check `pauseNew`

**File:** `packages/backend/src/modules/speech-analytics/hangup-analytics.port.ts:105-150`
**Issue:** Pause is enforced in `DialplanWebhooksService` via `resolveHangupContext` + admission. `enqueueAnalysisJob` itself only checks project active/published and product entitlement. Any future caller that bypasses dialplan can enqueue automatic analyses while pause is on, violating “pause blocks only new automatic analyses” at the port boundary.
**Fix:** Re-read module settings / capture policy inside `enqueueAnalysisJob` and reject with a non-chargeable `pause_new` reason before `admit` / run create.

### WR-05: Insights cache is process-local; cache misses re-charge

**File:** `packages/backend/src/modules/speech-analytics/dashboard/insights.service.ts:172,331-338`
**Issue:** `InsightsService` keeps an in-memory `Map`. Multi-instance or restart always miss cache, call LLM stub/provider again, and invoke SA-CHARGE-INSIGHTS for a new `insightsRequestId` (still `charged: false`). Duplicate amount rows accumulate per refresh/miss.
**Fix:** Back cache with a shared store keyed by `cacheKey` + tenant, or persist “latest insights for digest” and skip charge when a non-refresh hit exists in DB.

## Info

### IN-01: Hangup media asset `sha256` is a hash of the origin key, not file bytes

**File:** `packages/backend/src/modules/speech-analytics/hangup-analytics.port.ts:163`
**Issue:** `sha256: createHash('sha256').update(originKey).digest('hex')` with `bytes: String(0)` while `state: 'ready'`. Downstream integrity checks that trust asset digests will be wrong.
**Fix:** Hash the recording after the worker’s stable-file wait (or leave `state` non-ready until content is hashed).

### IN-02: `createSaAiProjectsPort` ignores `level` on apply

**File:** `packages/backend/src/modules/speech-analytics/speech-analytics-ai.adapter.ts:365-406`
**Issue:** `applyEditorUpdate` accepts `level` but never uses it; permission checks that live in `ProjectEditorService` are bypassed by this Nest port.
**Fix:** Delegate to `ProjectEditorService` or mirror `canPublishProject` / model-edit gates inside the port.

### IN-03: Nest worker “always injects runAnalysis” test does not exercise the factory path

**File:** `packages/backend/src/modules/speech-analytics/jobs/sa-analysis.worker.spec.ts:105-156`
**Issue:** The test builds `createSaAnalysisWorker` then scores via a separately constructed `SaAnalysisWorker` with a mocked `runAnalysis`. It never calls `processJob` on the factory-built instance, so regressions that omit `runAnalysis` from the Nest factory would not fail this assertion strongly.
**Fix:** Call `nestWorker.processJob` with a mocked `waitForFile` (or spy factory deps) and assert the factory-injected pipeline path runs.

---

_Reviewed: 2026-09-23T03:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
