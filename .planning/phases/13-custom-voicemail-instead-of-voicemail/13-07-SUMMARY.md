---
phase: 13-custom-voicemail-instead-of-voicemail
plan: 07
subsystem: voicemail
tags: [voicemail, scanner, stt, llm, axios, nest-interval, d-57, d-60, d-61, d-63, d-68, d-69, d-70, d-71, tdd]

requires:
  - phase: 13-custom-voicemail-instead-of-voicemail
    provides: 13-06 first notify + notify_attempts/next_notify_at; 13-01 parseWavPcm16; 13-11 ingest without STT
provides:
  - LlmSummaryService axios Chat Completions client with decryptSecret
  - VoicemailScannerService @Interval vm-scan with two independent axes
  - retryTranscript(uniqueid) for 13-08 UI
affects:
  - 13-08 JWT detail/retry-stt
  - 13-10 VoicemailAiAdapter (reads transcript/summary written here)

actuals:
  tokens: 9756
  tasks: 3
  commits: 7

tech-stack:
  added: []
  patterns:
    - Thin OpenAI-compatible axios POST; no openai SDK; skip wss and native /api/chat
    - Two-axis scanner: notify (next_notify_at + lease) independent of transcript_status
    - Restart-safe notify retry via notify_dispatch JSON snapshot

key-files:
  created:
    - packages/backend/src/modules/voicemail/llm-summary.service.ts
    - packages/backend/src/modules/voicemail/llm-summary.service.spec.ts
    - packages/backend/src/modules/voicemail/voicemail-scanner.service.ts
    - packages/backend/src/modules/voicemail/voicemail-scanner.service.spec.ts
  modified:
    - packages/backend/src/modules/voicemail/voicemail.service.ts
    - packages/backend/src/modules/voicemail/voicemail.module.ts
    - packages/backend/src/modules/voicemail/voicemail-message.model.ts
    - packages/backend/src/modules/voicemail/migrate-voicemail.ts
    - packages/backend/src/modules/voice-robots/voice-robots.module.ts

key-decisions:
  - "LLM is axios + decryptSecret; wss and /api/chat skip return empty summary, not transcript failure"
  - "Notify retries persist ingest params as notify_dispatch JSON so scanOnce can reuse 13-06 attach/link after Nest restart"
  - "STT/LLM failures increment transcript_attempts only; notify_status is never written from the transcript path"
  - "SttProviderFactory is exported from VoiceRobotsModule so the scanner reuses the existing batch transcribe client"

patterns-established:
  - "Pattern: @Interval('vm-scan', 30000) + running mutex + exported scanOnce() — no Redis/Bull"
  - "Pattern: scan_locked_until lease for notify; transcript_status=pending is a second independent query"
  - "Pattern: no tenant STT engine → transcript_status=not_configured immediately (D-63)"

requirements-completed: [D-57, D-60, D-61, D-63, D-68, D-69, D-70, D-71]

coverage:
  - id: D1
    description: Thin Chat Completions client uses bearer/X-API-Key after decryptSecret, skips wss, reads choices[0].message.content
    requirement: D-57
    verification:
      - kind: unit
        ref: packages/backend/src/modules/voicemail/llm-summary.service.spec.ts#sends bearer auth via Authorization after decryptSecret
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/voicemail/llm-summary.service.spec.ts#skips wss endpoints without fetching and returns empty summary
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/voicemail/llm-summary.service.spec.ts#returns trimmed choices[0].message.content
        status: pass
    human_judgment: false
  - id: D2
    description: scanOnce notify axis — three transport fails → notify_status=failed; overlapping tick is a mutex no-op; notify_error on the row only
    requirement: D-61
    verification:
      - kind: unit
        ref: packages/backend/src/modules/voicemail/voicemail-scanner.service.spec.ts#three notify failures mark notify_status=failed, keep the row, set notify_error
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/voicemail/voicemail-scanner.service.spec.ts#tick is a no-op when a scan is already running
        status: pass
    human_judgment: false
  - id: D3
    description: Notify backoff +1 / +4 min then failed; no admin alerter (D-68 / D-69)
    requirement: D-68
    verification:
      - kind: unit
        ref: packages/backend/src/modules/voicemail/voicemail-scanner.service.spec.ts#stores notify_error on the row and never calls an admin alerter
        status: pass
    human_judgment: false
  - id: D4
    description: No tenant STT engine → transcript_status=not_configured immediately; ingest still does not transcribe
    requirement: D-63
    verification:
      - kind: unit
        ref: packages/backend/src/modules/voicemail/voicemail-scanner.service.spec.ts#marks not_configured immediately when the tenant has no STT engine
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/voicemail/voicemail.service.spec.ts#does not start STT on the ingest path
        status: pass
    human_judgment: false
  - id: D5
    description: Three STT throws → transcript_status=failed and notify_status unchanged (D-70)
    requirement: D-70
    verification:
      - kind: unit
        ref: packages/backend/src/modules/voicemail/voicemail-scanner.service.spec.ts#three STT throws set transcript_status=failed and leave notify_status unchanged
        status: pass
    human_judgment: false
  - id: D6
    description: LIST-chunk wav still transcribes via parseWavPcm16 (D-71); language ru-RU
    requirement: D-71
    verification:
      - kind: unit
        ref: packages/backend/src/modules/voicemail/voicemail-scanner.service.spec.ts#transcribes LIST-chunk wav via parseWavPcm16 and stores the transcript
        status: pass
    human_judgment: false

duration: 13min
completed: 2026-09-03
status: complete
---

# Phase 13 Plan 07: Scanner + thin LLM Summary

**Nest `@Interval` voicemail scanner with two independent axes and an axios Chat Completions client (no openai SDK)**

## Performance

- **Duration:** 13 min
- **Started:** 2026-09-03T03:20:14Z
- **Completed:** 2026-09-03T03:33:33Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- `LlmSummaryService.summarize` POSTs `/v1/chat/completions` with `decryptSecret` bearer or `X-API-Key`, fixed RU system prompt, capped user transcript, `max_tokens=400`, 30s timeout; `wss:` / native `/api/chat` skip returns empty summary
- `VoicemailScannerService` ticks every 30s behind a `running` mutex; `scanOnce()` is exported; notify query is `notify_status=pending AND next_notify_at<=now` with `scan_locked_until` lease (no Redis/Bull)
- Transcript axis is a second `transcript_status=pending` query; no engine → `not_configured`; three STT/LLM fails → `transcript_status=failed` without touching notify; `retryTranscript(uniqueid)` ready for 13-08

## Task Commits

Each task was committed atomically (TDD RED then GREEN):

1. **Task 1 RED:** `d8d1404` (test) — failing LlmSummaryService spec
2. **Task 1 GREEN:** `765eb67` (feat) — thin Chat Completions client
3. **Task 2 RED:** `52b6dd0` (test) — failing notify scanner spec
4. **Task 2 GREEN:** `d2e6f6a` (feat) — scanOnce notify axis + notify_dispatch
5. **Task 3 RED:** `c14b217` (test) — failing transcript scanner spec
6. **Task 3 GREEN:** `aa5a6cc` (feat) — transcript axis + retryTranscript

**Plan metadata:** pending docs commit

## Files Created/Modified

- `packages/backend/src/modules/voicemail/llm-summary.service.ts` — axios Chat Completions + `resolveChatCompletionsUrl` + `parseAndValidateSummary`
- `packages/backend/src/modules/voicemail/llm-summary.service.spec.ts` — bearer, X-API-Key, wss skip, content path, timeout
- `packages/backend/src/modules/voicemail/voicemail-scanner.service.ts` — `@Interval('vm-scan', 30000)`, mutex, two-axis `scanOnce`, `retryTranscript`
- `packages/backend/src/modules/voicemail/voicemail-scanner.service.spec.ts` — notify backoff/overlap + D-63/D-70/D-71
- `packages/backend/src/modules/voicemail/voicemail.service.ts` — `retryNotify` reuses 13-06 attach/link; persist `notify_dispatch`
- `packages/backend/src/modules/voicemail/voicemail.module.ts` — scanner + LLM + STT/AI imports
- `packages/backend/src/modules/voicemail/voicemail-message.model.ts` — `notify_dispatch` TEXT
- `packages/backend/src/modules/voicemail/migrate-voicemail.ts` — idempotent `notify_dispatch` column
- `packages/backend/src/modules/voice-robots/voice-robots.module.ts` — export `SttProviderFactory`

## Decisions Made

- Persist ingest notify params as `notify_dispatch` JSON so retries survive Nest restart without new Redis/Bull (13-06 invited 13-07 to store the target).
- Transcript failures never write `notify_status` / `next_notify_at`.
- Export existing `SttProviderFactory` instead of adding a second STT client or npm package.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Persist notify dispatch snapshot**
- **Found during:** Task 2 (notify retry after restart)
- **Issue:** 13-06 stored integration/body/target/subject only on the ingest CURL; after Nest restart `scanOnce` had no target to re-dispatch
- **Fix:** `notify_dispatch` TEXT JSON on `voicemail_messages`; `retryNotify` reuses 13-06 attach/link
- **Files modified:** `voicemail-message.model.ts`, `migrate-voicemail.ts`, `voicemail.service.ts`
- **Verification:** notify scanner spec three-fail path; existing ingest notify specs still pass
- **Committed in:** `d2e6f6a` (Task 2)

**2. [Rule 3 - Blocking] Export SttProviderFactory**
- **Found during:** Task 3 (inject factory into scanner)
- **Issue:** `VoiceRobotsModule` constructed the factory but did not export it
- **Fix:** add `SttProviderFactory` to module `exports`; import `VoiceRobotsModule` from `VoicemailModule`
- **Files modified:** `voice-robots.module.ts`, `voicemail.module.ts`
- **Verification:** LIST-chunk transcribe spec calls `transcribe(engine, pcm, 'ru-RU')`
- **Committed in:** `aa5a6cc` (Task 3)

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 blocking)
**Impact on plan:** Required for restart-safe notify retries and reuse of existing STT. No new npm packages. No scope creep.

## Issues Encountered

None

## Authentication Gates

None

## User Setup Required

None - no external service configuration required. Existing tenant STT/LLM rows in `stt_engines` / `cc_ai_providers` are optional (D-63).

## Next Phase Readiness

Ready for 13-08 (JWT detail / play / `retryTranscript`) and 13-10 (read-only `VoicemailAiAdapter`). Hangup ingest still does not await STT/LLM. Live DB needs `notify_dispatch` column if `migrate-voicemail.ts` has not been re-run on an already-created table.

---
*Phase: 13-custom-voicemail-instead-of-voicemail*
*Completed: 2026-09-03*

## Self-Check: PASSED

- Created files exist: `llm-summary.service.ts`, `llm-summary.service.spec.ts`, `voicemail-scanner.service.ts`, `voicemail-scanner.service.spec.ts`, `13-07-SUMMARY.md`
- Commits exist: `d8d1404`, `765eb67`, `52b6dd0`, `d2e6f6a`, `c14b217`, `aa5a6cc`
