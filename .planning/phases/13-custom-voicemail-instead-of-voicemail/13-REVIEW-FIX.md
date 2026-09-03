---
phase: 13-custom-voicemail-instead-of-voicemail
fixed_at: 2026-09-03T05:35:00Z
review_path: .planning/phases/13-custom-voicemail-instead-of-voicemail/13-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 13: Code Review Fix Report

**Fixed at:** 2026-09-03T05:35:00Z
**Source review:** `.planning/phases/13-custom-voicemail-instead-of-voicemail/13-REVIEW.md`
**Iteration:** 1
**Verification environment:** main checkout (`wt="."`, branch `feat/universal-dialplan-directories`). No worktree. Jest ran in this tree.

**Summary:**
- Findings in scope: 6
- Fixed: 6
- Skipped: 0

**13-13 overlap:** CR-01 implements 13-13 Task 3 (LinkController before JWT `:uniqueid`). CR-02 implements 13-13 Tasks 1–2 (D-62 hangup CURL + persist `notify_dispatch` / step engine uids / `next_notify_at`). `execute --gaps-only` can treat those tasks as already implemented.

## Fixed Issues

### CR-01: Token play URL is captured by JWT `GET /voicemail/:uniqueid`

**Files modified:** `packages/backend/src/modules/voicemail/voicemail.module.ts`, `packages/backend/src/modules/voicemail/voicemail-link.controller.spec.ts`
**Commit:** a6a4aba
**Applied fix:** Reordered module controllers to `[VoicemailDialplanController, VoicemailLinkController, VoicemailController]`. Isolation spec now asserts LinkController is registered before the JWT controller. `mintPlayToken` URL stays `/voicemail/play`; link controller still uses only `VoicemailLinkGuard`.
**Verification:** Tier 1 re-read; `npm run test -w @krasterisk/backend -- --testPathPattern="voicemail-link.controller|voicemail.controller" --no-coverage` passed in the main checkout.

### CR-02: Hangup CURL never carries step notify (or STT/LLM) params

**Files modified:** `packages/backend/src/shared/utils/dialplan.util.ts`, `packages/backend/src/shared/utils/dialplan.util.spec.ts`, `packages/backend/src/shared/utils/dialplan-curl.util.ts`, `packages/backend/src/shared/utils/dialplan-curl.util.spec.ts`, `packages/backend/src/modules/voicemail/voicemail.service.ts`, `packages/backend/src/modules/voicemail/voicemail.service.spec.ts`, `packages/backend/src/modules/voicemail/voicemail-scanner.service.ts`, `packages/backend/src/modules/voicemail/voicemail-scanner.service.spec.ts`
**Commit:** 99b7bd3
**Status:** fixed: requires human verification
**Applied fix:** `emitVoicemailDialplan` stamps sanitized `notify.integration_uid` / body / target / subject and `stt_engine_uid` / `llm_provider_uid` onto the hangup CURL. Ingest persists those uids in `notify_dispatch` JSON (no new columns) and sets `next_notify_at = now` when an integration uid is present. Scanner `resolveEngine` / `pickLlm` read step uids from that snapshot. `extractCurlInvocation` now balances nested `URIENCODE(${VAR})` so D-62 decode works. Ingest still does not await STT/LLM.
**Verification:** Tier 1 re-read; `npm run test -w @krasterisk/backend -- --testPathPattern="dialplan.util|dialplan-curl.util|voicemail.service|voicemail-scanner|voicemail-dialplan.controller" --no-coverage` passed in the main checkout.

### WR-01: JWT list returns raw Sequelize rows including `notify_dispatch`

**Files modified:** `packages/backend/src/modules/voicemail/voicemail.service.ts`, `packages/backend/src/modules/voicemail/voicemail.service.spec.ts`
**Commit:** 273f15e
**Applied fix:** `list()` maps rows through `toDetailDto`, so JWT JSON no longer includes `notify_dispatch`.
**Verification:** Tier 1 re-read; `voicemail.service.spec` passed in the main checkout.

### WR-02: `safeVoicemailFilePath` `startsWith` is not prefix-safe

**Files modified:** `packages/backend/src/modules/voicemail/voicemail.service.ts`, `packages/backend/src/modules/voicemail/voicemail.service.spec.ts`
**Commit:** 77a754e
**Applied fix:** Reject absolute and drive-letter rel paths; require `startsWith(base + path.sep)` (or exact base).
**Verification:** Tier 1 re-read; `voicemail.service.spec` passed in the main checkout.

### WR-03: JWT list skips the CDR access-scope used by play/detail

**Files modified:** `packages/backend/src/modules/voicemail/voicemail.service.ts`, `packages/backend/src/modules/voicemail/voicemail.service.spec.ts`, `packages/backend/src/modules/voicemail/voicemail.controller.ts`, `packages/backend/src/modules/voicemail/voicemail.controller.spec.ts`
**Commit:** 21c4080
**Status:** fixed: requires human verification
**Applied fix:** JWT `list` now passes `viewer.sub` and filters each row through `cdrService.findByUniqueid` — the same visibility check as play/detail. Hidden calls (and their transcripts) are omitted. AI adapter still calls `list(tenant)` without a viewer and stays tenant-scoped.
**Verification:** Tier 1 re-read; `voicemail.service.spec`, `voicemail.controller.spec`, `voicemail-ai.adapter.spec` passed in the main checkout.

### WR-04: `retryTranscript` looks up `uniqueid` with no tenant

**Files modified:** `packages/backend/src/modules/voicemail/voicemail-scanner.service.ts`, `packages/backend/src/modules/voicemail/voicemail-scanner.service.spec.ts`, `packages/backend/src/modules/voicemail/voicemail.service.ts`, `packages/backend/src/modules/voicemail/voicemail.service.spec.ts`
**Commit:** ce9c9d3
**Applied fix:** `retryTranscript(uniqueid, userUid)` uses `where: { uniqueid, user_uid }`. `VoicemailService.retryStt` passes `tenantId`.
**Verification:** Tier 1 re-read; `voicemail.service.spec` and `voicemail-scanner.service.spec` passed in the main checkout.

## Info (out of scope)

IN-01 and IN-02 were not given their own commits. CR-02 already sets `next_notify_at` on insert when an integration is present (IN-01) and stores STT/LLM uids in `notify_dispatch` for the scanner (IN-02).

---

_Fixed: 2026-09-03T05:35:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
