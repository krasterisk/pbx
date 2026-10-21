---
phase: 18-polnyy-refaktoring-rechevoy-analitiki
plan: 07
subsystem: speech-analytics
tags: [speech-analytics, upload, url-ingest, api-tokens, tdd, jest]

requires:
  - phase: 18-polnyy-refaktoring-rechevoy-analitiki
    provides: SA charge run, journal JWT APIs, project editor delete/token revoke (18-04, 18-06, 18-11)
provides:
  - UploadService with cabinet async / API sync=true single-file wait (D-14…D-17)
  - Hash-only project-bound SA API tokens (D-32, D-33)
  - URL download with 50MB/timeout caps and open LAN/public ingest (D-39…D-42)
  - JWT Get analytics endpoint using the same recording asset (D-18)
affects:
  - 18-13 UploadForm / TokensTable UI
  - 18-09 (not started by this plan)

actuals:
  tokens: 16062
  tasks: 3
  commits: 4

plan_head_before: 252476f3bbad51c1f3439454e9c2555b0ae86b0c

tech-stack:
  added: []
  patterns:
    - "Upload/URL batch domain services under speech-analytics/ingest/* with injectable deps"
    - "API token project binding via resolveTokenBoundProject; secret_digest only"
    - "Open URL fetch with rejectUnauthorized:false and Content-Length completeness checks"

key-files:
  created:
    - packages/backend/src/modules/speech-analytics/ingest/upload.service.ts
    - packages/backend/src/modules/speech-analytics/ingest/upload.service.spec.ts
    - packages/backend/src/modules/speech-analytics/ingest/url-download.ts
    - packages/backend/src/modules/speech-analytics/ingest/url-download.spec.ts
    - packages/backend/src/modules/speech-analytics/speech-analytics-public.controller.spec.ts
  modified:
    - packages/backend/src/modules/speech-analytics/speech-analytics-public.controller.ts
    - packages/backend/src/modules/speech-analytics/speech-analytics-jwt.controller.ts
    - packages/backend/src/modules/speech-analytics/speech-analytics.service.ts
    - packages/backend/src/modules/integration-credentials/integration-credentials.service.ts
    - packages/backend/src/modules/integration-credentials/integration-credentials.service.spec.ts

key-decisions:
  - "D-32 approved as hash-only tokens (approve-hash-only); plaintext shown once at issue"
  - "lastUsed for SA token list uses principal.updated_at touched on authenticate (no new column)"
  - "Get analytics JWT route reuses createRun with the same assetId — no second copy"

patterns-established:
  - "Public uploads/batch and analyze-url bind project from token grant only"
  - "Incomplete URL downloads never call runAnalysis / SA-CHARGE-RUN; batch continues"
  - "Pause does not block manual upload or Get analytics; module off blocks both"

requirements-completed: [REQ-SA-PARITY]

coverage:
  - id: D1
    description: "API sync=true single-file upload waits for scored result; stores bytes; journal-only"
    requirement: REQ-SA-PARITY
    verification:
      - kind: unit
        ref: "packages/backend/src/modules/speech-analytics/ingest/upload.service.spec.ts#API single file sync=true waits for scored result and stores bytes"
        status: pass
    human_judgment: false
  - id: D2
    description: "Hash-only project-bound SA tokens; ADMIN/SUPERADMIN issue; SUPERVISOR cannot"
    requirement: REQ-SA-PARITY
    verification:
      - kind: unit
        ref: "packages/backend/src/modules/integration-credentials/integration-credentials.service.spec.ts#speech-analytics project tokens"
        status: pass
    human_judgment: false
  - id: D3
    description: "URL download caps + incomplete skip charge; JWT Get analytics admission"
    requirement: REQ-SA-PARITY
    verification:
      - kind: unit
        ref: "packages/backend/src/modules/speech-analytics/ingest/url-download.spec.ts"
        status: pass
    human_judgment: false

duration: 55min
completed: 2026-09-22
status: complete
---

# Phase 18 Plan 07: Upload, URL ingest, Get analytics, hash-only tokens Summary

**Cabinet/API upload and open URL ingest with sync wait, plus hash-only project-bound API tokens and JWT Get analytics on the same recording asset.**

## Performance

- **Duration:** 55 min
- **Started:** 2026-09-22T15:07:00Z
- **Completed:** 2026-09-22T16:02:00Z
- **Tasks:** 3/3 (task 1 decision-only; tasks 2–3 TDD)
- **Files modified:** 10

## Accomplishments

- API `sync=true` on one file waits for scored result; cabinet always returns a background batch; `putUploadContent` stores bytes
- Speech-analytics tokens: secret once, `secret_digest` only, one project grant, ADMIN/SUPERADMIN issuers
- URL download enforces 50MB / timeout / Content-Length completeness; incomplete skips SA-CHARGE-RUN; JWT Get analytics uses same asset

## Task Commits

1. **Task 1: Confirm hash-only tokens (D-32)** — decision only (`approve-hash-only`), no commit
2. **Task 2 (tracer, TDD):**
   - RED `b5fe95c8` — failing upload sync + hash-token specs
   - GREEN `8cec8c8f` — sync upload + hash-only SA tokens
3. **Task 3 (TDD):**
   - RED `e64cdfe2` — failing URL download + Get analytics specs
   - GREEN `31af444c` — URL ingest caps + Get analytics

_Note: TDD tasks produce RED then GREEN commits._

## TDD Gate Compliance

| Task | RED | GREEN | Status |
|------|-----|-------|--------|
| 2 | `b5fe95c8` + `18-07-t2-red-evidence.json` (`RED_EVIDENCE_OK`) | `8cec8c8f` | Pass |
| 3 | `e64cdfe2` + `18-07-t3-red-evidence.json` (`RED_EVIDENCE_OK`) | `31af444c` | Pass |

## Files Created/Modified

- `ingest/upload.service.ts` — cabinet/API batch upload with sync wait and token project binding
- `ingest/url-download.ts` — open URL download, UrlIngestService, Get analytics admission helpers
- `speech-analytics-public.controller.ts` — `uploads/batch`, `analyze-url`, token-bound project
- `speech-analytics-jwt.controller.ts` — `POST get-analytics`
- `integration-credentials.service.ts` — `issueSpeechAnalyticsToken` / `listSpeechAnalyticsTokens` / `resolveSpeechAnalyticsProjectId`
- `speech-analytics.service.ts` — `putUploadContent` persists bytes in `uploadBodies`

## Decisions Made

- User selected `approve-hash-only` for D-32 (one-way secret door)
- `lastUsed` surfaced via `principal.updated_at` on authenticate (no migration)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Persist upload bytes in SpeechAnalyticsService**
- **Found during:** Task 2 (GREEN)
- **Issue:** Plan required `putUploadContent` to store bytes; existing path only set metadata flags
- **Fix:** Added in-process `uploadBodies` map + 50MB cap aligned with D-14
- **Files modified:** `speech-analytics.service.ts`
- **Committed in:** `8cec8c8f`

**Total deviations:** 1 auto-fixed (Rule 2)
**Impact on plan:** Necessary for D-14 byte storage; no scope creep into 18-13 UI

## Issues Encountered

None blocking. PowerShell mangled `|` in Jest patterns; Git Bash scripts used for verify/commit.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Backend ingest/token/Get-analytics paths ready for 18-13 UploadForm/TokensTable. Do not start 18-09 from this plan.

## Self-Check: PASSED

- FOUND: `packages/backend/src/modules/speech-analytics/ingest/upload.service.ts`
- FOUND: `packages/backend/src/modules/speech-analytics/ingest/url-download.ts`
- FOUND: commits `b5fe95c8`, `8cec8c8f`, `e64cdfe2`, `31af444c`, docs `ec2bafef`
- VERIFY: 24/24 tests passed (`upload.service|url-download|integration-credentials.service|speech-analytics-public`)
