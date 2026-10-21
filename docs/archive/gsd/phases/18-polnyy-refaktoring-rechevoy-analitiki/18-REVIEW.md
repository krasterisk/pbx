---
phase: 18-polnyy-refaktoring-rechevoy-analitiki
reviewed: 2026-09-23T04:36:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - packages/backend/src/modules/speech-analytics/speech-analytics-ai.adapter.ts
  - packages/backend/src/modules/speech-analytics/speech-analytics-ai.adapter.spec.ts
  - packages/backend/src/modules/speech-analytics/jobs/sa-analysis.worker.ts
  - packages/backend/src/modules/speech-analytics/jobs/sa-analysis.worker.spec.ts
  - packages/backend/src/modules/speech-analytics/jobs/sa-analysis.worker.nest.ts
  - packages/backend/src/modules/speech-analytics/hangup-analytics.port.ts
  - packages/backend/src/modules/speech-analytics/hangup-analytics.port.spec.ts
  - packages/backend/src/modules/speech-analytics/pipeline/run-analysis.ts
  - packages/backend/src/modules/speech-analytics/pipeline/run-analysis.spec.ts
  - packages/backend/src/modules/speech-analytics/ingest/upload.service.ts
  - packages/backend/src/modules/speech-analytics/ingest/upload.service.spec.ts
  - packages/backend/src/modules/speech-analytics/ingest/url-download.ts
  - packages/backend/src/modules/speech-analytics/ingest/url-download.spec.ts
  - packages/backend/src/modules/speech-analytics/speech-analytics-public.controller.spec.ts
findings:
  critical: 0
  warning: 5
  info: 3
  total: 8
status: issues_found
---

# Phase 18: Code Review Report

**Reviewed:** 2026-09-23T04:36:00Z
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Adversarial review of the second gap-closure delta after `d48bfba1` (plans 18-20, 18-21, 18-22): AI apply draft merge, hangup/Nest `audioMs` from duration (with STT fallback), and public upload/URL fire-and-forget accepted paths.

Prior blockers from the previous REVIEW are **closed** in this scope:
- **CR-01 / D-27:** `edit_speech_analytics_project` apply reloads live draft and merges `{ ...state.draft, ...args.config }` before `applyEditorUpdate`; metric-only confirm preserves topics/webhooks/digest/alerts/budget/prompts. No wallet imports in the adapter.
- **CR-02 / D-46:** Hangup passes `durationSec` + `audioMs: durationSec*1000`; Nest ignores `waitForFile` bytes for charge; `runAnalysis` prefers positive job `audioMs` else STT `durationSec*1000`. Charge seam keeps `charged: false`. Hangup HTTP uses `void worker.processJob(...).catch(...)` (does not await STT).
- **CR-03 / D-17 / D-40:** When `sync !== true` or item count ≠ 1, upload/URL schedule `void runAnalysis(...).catch(...)` and return `accepted` without score; sync+one item still awaits. Batch item failures continue. Journal ids come from deps/`createRun` UUIDs (public controller specs). Upload guards `createsCdr !== false`. No CDR/wallet debit in these paths.

Residual issues are robustness, authz defense-in-depth, and test flakiness — not reopenings of the three locked contracts.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: Accepted-path analysis failures are swallowed with no log

**File:** `packages/backend/src/modules/speech-analytics/ingest/upload.service.ts:161-165`
**Also:** `packages/backend/src/modules/speech-analytics/ingest/url-download.ts:186-190`
**Issue:** Fire-and-forget correctly unblocks HTTP, but `.catch(() => { /* ... */ })` discards all background errors. Hangup logs worker failures (`hangup-analytics.port.ts:296-298`). A thrown/`run_binding_missing`/unexpected failure can leave a run stuck in `queued` with no HTTP signal and no warn log, which is hard to operate and debug.
**Fix:** Mirror hangup: log at warn with `journalId` / filename / url, and ensure the wired `runAnalysis` always persists an error state before rethrowing (or catch and call `persistError` in the ingest wiring).

```typescript
void this.deps.runAnalysis(analysisArgs).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  // use Nest Logger if injected, else deps.onBackgroundError?.(…)
  console.warn(`SA upload analysis failed journal=${analysisArgs.journalId}: ${message}`);
});
```

### WR-02: URL download treats non-2xx HTTP bodies as successful audio

**File:** `packages/backend/src/modules/speech-analytics/ingest/url-download.ts:48-98`
**Issue:** `downloadAnalyticsUrl` never inspects `response.statusCode`. A 404/500 HTML (or redirect body) with non-empty bytes and plausible Content-Length becomes `{ ok: true }`, then journals and schedules STT. That pollutes the journal and burns analysis work on non-audio.
**Fix:** Reject non-success statuses before buffering (and map to `network` or a dedicated `http_error` code):

```typescript
if (response.statusCode < 200 || response.statusCode >= 300) {
  return { ok: false, error: 'network' };
}
```

### WR-03: Nested partial apply still shallow-replaces whole sections

**File:** `packages/backend/src/modules/speech-analytics/speech-analytics-ai.adapter.ts:210-221`
**Issue:** Top-level metric-only merge is fixed, but `{ ...state.draft, ...args.config }` still replaces entire nested objects. An applyPayload like `{ digest: { enabled: true } }` or `{ eventWebhook: { url: '…' } }` wipes sibling nested fields (`integrationUids`, headers, events, etc.) that live under that key. Same pattern exists in `proposeEdit`’s merge for publish decisions.
**Fix:** Deep-merge known nested config sections (digest/alerts/eventWebhook/budget) or reject incomplete nested objects in `revalidate` / Zod refine; keep top-level shallow merge only for arrays like `customMetrics` / `topics`.

### WR-04: AI projects port ignores `level` on publish

**File:** `packages/backend/src/modules/speech-analytics/speech-analytics-ai.adapter.ts:368-409`
**Issue:** `applyEditorUpdate` accepts `level` but never calls `canPublishProject(level)` (unlike `project-editor.service`). Any principal that can confirm the AI mutation can force `publish: true` through this Nest-bound port, bypassing the editor’s publish gate.
**Fix:**

```typescript
import { canPublishProject } from './projects/project-editor.service';
// inside applyEditorUpdate, before publish branch:
if (input.publish && !canPublishProject(input.level)) {
  throw new Error('resource_permission_denied');
}
```

### WR-05: Accepted-before-score specs race on a fixed 30ms sleep

**File:** `packages/backend/src/modules/speech-analytics/ingest/upload.service.spec.ts:125-127`
**Also:** `packages/backend/src/modules/speech-analytics/ingest/url-download.spec.ts:128-130` (and the multi-item variants)
**Issue:** Tests `await setTimeout(30)` then assert `submitDone === true`. On a slow CI agent, `submit` may still be in `putUploadContent` / `createJournalRow`, causing intermittent RED without a product regression.
**Fix:** Poll until `submitDone` with a ceiling (or resolve a latch when `submit`’s microtask completes) instead of a single 30ms sleep; keep the deferred `runAnalysis` unresolved until after assertions.

## Info

### IN-01: Knowledge block still claims full-draft rewrite

**File:** `packages/backend/src/modules/speech-analytics/speech-analytics-ai.adapter.ts:128`
**Issue:** `getKnowledgeBlock` says edit “меняет весь черновик”, but apply now merges partials onto the live draft. Misleading for the agent/tool user.
**Fix:** Update the bullet to describe partial merge + publish-on-metric-change.

### IN-02: URL ingest drops `createsCdr` and never asserts it

**File:** `packages/backend/src/modules/speech-analytics/ingest/url-download.ts:133-138, 177-181`
**Issue:** Upload refuses `createsCdr !== false`. URL `createJournalRow` only requires `{ id }`; production wiring returns `{ id }` only (`buildPublicUrlDeps` strips `createsCdr`). Behavior is safe with current wiring, but the URL path lacks the same CDR hard-stop if a future deps impl regresses.
**Fix:** Align types/return with upload (`createsCdr: false`) and assert in `UrlIngestService.submit`.

### IN-03: `UrlIngestDeps.invokeSaChargeRun` is dead API surface

**File:** `packages/backend/src/modules/speech-analytics/ingest/url-download.ts:139`
**Issue:** Optional `invokeSaChargeRun` is never read by `submit`; specs only assert the mock was unused. Charge correctly lives inside `runAnalysis`. The field suggests a second charge seam that does not exist.
**Fix:** Remove the optional field from `UrlIngestDeps` (and from specs’ deps objects).

---

_Reviewed: 2026-09-23T04:36:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
