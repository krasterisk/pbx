---
phase: 13-custom-voicemail-instead-of-voicemail
verified: 2026-09-03T04:32:00Z
status: gaps_found
score: 18/19 must-haves verified
behavior_unverified: 0
overrides_applied: 0
decision_coverage:
  honored: 21
  total: 21
  not_honored: []
gaps:
  - truth: "D-62: first notify attempt runs in Nest after {accepted:true} using the voicemail step's notify config"
    status: failed
    reason: "Hangup-handler CURL never carries step notify fields (integration_uid/body/target/subject). Ingest no-ops sendFirstNotify when integration_uid is absent. Tests hide this by injecting integration_uid in the fixture body."
    artifacts:
      - path: "packages/backend/src/shared/utils/dialplan.util.ts"
        issue: "emitVoicemailDialplan buildCurlCall payload is only uniqueid/file/status/clid/exten (+ vpbx_user_uid from curlCtx). params.notify is never read."
      - path: "packages/backend/src/modules/voicemail/voicemail.service.ts"
        issue: "sendFirstNotify returns immediately when parseTenantUid(body.integration_uid) is null; notify_dispatch stays null so scanner retries also throw notify_dispatch_missing."
      - path: "packages/frontend/src/features/dialplan-apps/model/schemas/voicemail.tsx"
        issue: "Sheet collects notify.integration_uid / body / target / subject but those values never reach Asterisk CURL or the voicemail_messages row on the production path."
    missing:
      - "Generator must URIENCODE step notify.integration_uid (and optional body/target/subject) into the krsk-vm-done CURL, or ingest must resolve the voicemail step and persist notify_dispatch without relying on the CURL body."
      - "A generator spec that fails when params.notify.integration_uid is set but the CURL omits integration_uid."
---

# Phase 13: Custom voicemail instead of VoiceMail Verification Report

**Phase Goal:** Replace Asterisk `VoiceMail()` with custom greeting → `Record()` → notify → optional STT + LLM summary. Messages on the CDR report tab/filter with a details Dialog and player. Keep ActionType string `voicemail`; migrate existing steps.

**Verified:** 2026-09-03T04:32:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

The generator, ingest, JWT list, CDR Surface L, tokens, scanner, and migration are present and wired. The phase goal's **notify** clause is not achieved on the production path: the Sheet stores `params.notify`, Nest can send attach/link when `integration_uid` is in the ingest body, but `emitVoicemailDialplan` never forwards those fields. A real hangup CURL therefore inserts a row and never notifies.

Honored locks that hold: ActionType stays `voicemail`; D-72 `proceed-locked-path`; no new npm in this phase; hangup handler does not await STT/LLM; token URL is omitted from JWT JSON/UI; `cdr-public` is not used for voicemail play; two status axes.

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | D-54: ActionType remains `voicemail`; generator no longer emits the mailbox application; greeting (optional) then Record then ingest CURL | ✓ VERIFIED | `case 'voicemail'` → `emitVoicemailDialplan`; no `VoiceMail(` in `dialplan.util.ts`. Greeting Playback then Record then `buildCurlCall('voicemail', …)`. |
| 2 | D-55: `hangup_handler_push` before `Record(`; `k` always in options; `hangup_handler_pop` after Record and before Goto; handler ends with `Return()` | ✓ VERIFIED | Production lines 702–718. Named test `pushes hangup handler before Record` **PASS**. |
| 3 | D-72: on-disk / Record path is `{records_base_path}/{vpbx_user_uid}/voicemail/{UNIQUEID}-%d.wav` | ✓ VERIFIED | `recordPath` uses `voicemailRecordsBase()` + `/{uid}/voicemail/${UNIQUEID}-%d.wav`. Ingest `toRelativeFileRel` stores `{uid}/voicemail/{name}.wav`. 13-02 SUMMARY records `proceed-locked-path`. |
| 4 | D-56: `RECORD_STATUS_VALUES` is 7 members including OPERATOR; `CONDITION_SOURCES` has `record_status`; schema exposes `q o x y n s u` and not `k` | ✓ VERIFIED | Shared table exported; `buildConditionExpr` ORs `${RECORD_STATUS}`; ConditionEditor `record:` prefix; `RecordOptionsDto` / `RECORD_FLAGS` omit `k`; generator always prefixes `k`. |
| 5 | D-74: registry `defaultParams.max_duration === 120`; VoicemailParamsDto matches `IVoicemailParams`; terminal stays `conditional` | ✓ VERIFIED | `registry.ts` default 120; DTO has greeting/max_duration/silence_timeout/record_options/notify/stt/llm; `voicemail.test.tsx` asserts `terminal === 'conditional'`. |
| 6 | Two-axis fields exist: `notify_status` and `transcript_status` (not a single status) | ✓ VERIFIED | `IVoicemailMessage` + Sequelize model + migrate columns. |
| 7 | D-60 / D-62 accept: ingest inserts a row, does not call STT/LLM; `POST /internal/dialplan/voicemail` returns `{accepted:true}` before ingest settles | ✓ VERIFIED | Controller `void this.service.ingest`. Tests `returns before ingest completes` and `does not invoke STT or LLM` **PASS**. |
| 8 | D-62: first notify attempt runs in Nest after `{accepted:true}` using the voicemail step's notify config | ✗ FAILED | Nest `sendFirstNotify` exists and is tested when `integration_uid` is injected. Production CURL from `emitVoicemailDialplan` never sends `params.notify.*`. `grep params.notify` in `dialplan.util.ts` is empty. Ingest then returns early; scanner `retryNotify` throws `notify_dispatch_missing`. |
| 9 | D-64 / D-65: attach iff `fs.stat` size is strictly less than `2 * 1024 * 1024` | ✓ VERIFIED | `VOICEMAIL_ATTACH_MAX_BYTES`. Tests `size 2MiB-1 takes the attach path` and `size 2MiB takes the link path` **PASS**. |
| 10 | D-66: attach rejected on telegram/email immediately resends the same channel as text+link without incrementing `notify_attempts` | ✓ VERIFIED | `ATTACHMENT_REJECTED` → `dispatchLinkNotify`. Test `attachment_rejected resends text+link` **PASS**. |
| 11 | WhatsApp / MAX / VK / webhook send link only; Telegram file send uses `sendDocument` multipart | ✓ VERIFIED | Provider specs: telegram `sendDocument`; webhook/whatsapp/max/vk ignore attach. |
| 12 | D-59 / D-67: opaque `vm_access_tokens` + `VoicemailLinkGuard`; TTL 7 days; expired/revoked 401; file remains; `req.user` is `{ vpbx_user_uid, isDisplayToken }` only | ✓ VERIFIED | `PLAY_TOKEN_TTL_MS`; guard sets no `sub`/`level`; expired → 401 (allowed by plan). No delete-on-expire. |
| 13 | Token play URL is never returned by JWT list/detail JSON and never rendered as copyable text in Dialog or table | ✓ VERIFIED | `toDetailDto` / AI adapter whitelist omit token fields. JWT play is `/voicemail/:uniqueid/play`. FE tests assert body text does not match `/voicemail/play?token=`. |
| 14 | Stream MIME is `audio/wav` via `safeVoicemailFilePath` (not the conversation mpeg helper); Range supported | ✓ VERIFIED | `streamWavFile` sets `Content-Type: audio/wav`, `Accept-Ranges`, 206 Range. Path resolver does not append `.mp3`. |
| 15 | D-61 / D-63 / D-68 / D-69 / D-70 / D-71: `@Interval('vm-scan', 30000)` + mutex; `scanOnce` exported; no Bull/Redis in the scanner; notify backoff ~1/4 min then `notify_status=failed`; no engine → `not_configured`; 3 STT fails → `transcript_status=failed` without changing notify; `parseWavPcm16` feeds PCM and rejects non-8 kHz / non-mono | ✓ VERIFIED | Scanner implementation + named tests `three notify failures`, `marks not_configured`, `three STT throws` **PASS**. `wav-pcm.util.ts` walks RIFF chunks. |
| 16 | D-57: LLM is axios + `decryptSecret`; skip `wss` endpoints; read `choices[0].message.content` | ✓ VERIFIED | `llm-summary.service.ts` + specs for bearer/header, wss skip, content extract. No new `openai` npm package. |
| 17 | D-58 Surface L: CDR third tab shares `CdrUiFilters.voicemail === '1'` with the filter checkbox; `clearAll` clears it; voicemail tab uses `useGetVoicemailMessagesQuery`; Dialog (not Sheet) with non-compact `AudioPlayer`; four transcript states; Voicemail icon next to conversation play | ✓ VERIFIED | `CdrReportPage` / `CdrFilter` / `VoicemailDetailsModal` / `CdrTable`. `AudioPlayer` is used without `compact`. Conversation control is `RecordingButton` (`Play` icon, not Mic — see anti-patterns). |
| 18 | D-54 migrate: existing steps keep type `voicemail`; six JSON columns visited; `raw_dialplan` containing `VoiceMail(` is logged, not rewritten | ✓ VERIFIED | `migrateVoicemailParams` + `migrate-voicemail-actions.ts` uses `PHASE12_ACTION_TARGETS`; `scanRawDialplanMailboxHits` is SELECT/log only. Specs assert type + idempotence + `max_duration` 120. |
| 19 | D-73: no Nest janitor that deletes voicemail files; JWT `GET /voicemail` lists `where: { user_uid }`; `VoicemailAiAdapter` registers read-only `list_voicemail_messages` / `get_voicemail_message` with `vpbxUserUid` as an argument | ✓ VERIFIED | Migrate comment + no unlink in production service. `list(vpbxUserUid)`. Adapter `onModuleInit` → registry; specs assert no `destructive` and no token URL. |

**Score:** 18/19 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `packages/backend/src/shared/utils/dialplan.util.ts` | D-54/D-55/D-72 generator arm | ✓ VERIFIED | Substantive `emitVoicemailDialplan`; wired from `case 'voicemail'`. Notify fields not passed (gap is wiring, not a stub). |
| `packages/backend/src/shared/utils/dialplan.util.spec.ts` | D-55 describe | ✓ VERIFIED | Order/`k`/path assertions; named test PASS. Does not assert CURL notify fields. |
| `packages/shared/src/types/dialplan-condition.types.ts` | RECORD_STATUS + record_status | ✓ VERIFIED | 7 values including OPERATOR; `CONDITION_SOURCES` includes `record_status`. |
| `packages/shared/src/types/voicemail.types.ts` | Two-axis message type | ✓ VERIFIED | Exported from `packages/shared/src/index.ts`. |
| `packages/shared/src/types/dialplan-params.types.ts` | `IVoicemailParams` | ✓ VERIFIED | greeting, max_duration, record_options, notify, stt/llm uids. |
| `packages/backend/src/modules/voicemail/wav-pcm.util.ts` | parseWavPcm16 | ✓ VERIFIED | RIFF walk; bits≠16 throws; returns sampleRate. |
| `packages/backend/src/shared/utils/dialplan-condition.util.ts` | record_status compiler | ✓ VERIFIED | OR-join on `${RECORD_STATUS}`. |
| `packages/frontend/src/features/dialplan-apps/ui/ConditionEditor/ConditionEditor.tsx` | OPERATOR vs DTMF | ✓ VERIFIED | `record:` prefix; tests encode OPERATOR ≠ DTMF. |
| `packages/frontend/src/features/dialplan-apps/model/schemas/voicemail.tsx` | Step schema | ✓ VERIFIED | Wired in registry. Notify fields collected but unused by generator (hollow for D-62). |
| `packages/backend/src/modules/routes/dto/dialplan-params/address.params.dto.ts` | VoicemailParamsDto | ✓ VERIFIED | Nested notify + RecordOptionsDto without `k`. |
| `packages/backend/src/modules/voicemail/migrate-voicemail.ts` | voicemail_messages | ✓ VERIFIED | Two-axis columns; no janitor. |
| `packages/backend/src/modules/voicemail/voicemail.module.ts` | Nest module | ✓ VERIFIED | Imported in `app.module.ts`. Controllers + scanner + LLM + AI adapter. |
| `packages/frontend/src/shared/api/endpoints/voicemailApi.ts` | JWT list/detail/retry | ✓ VERIFIED | Injected into `rtkApi` (`Voicemail` tag). |
| `packages/backend/src/modules/voicemail/voicemail-access-token.model.ts` | Token table | ✓ VERIFIED | Used by guard + mint. |
| `packages/backend/src/modules/voicemail/voicemail-link.guard.ts` | DisplayToken-style guard | ✓ VERIFIED | Query `token`; no sub/level. |
| `packages/backend/src/modules/voicemail/voicemail-link.controller.ts` | GET `/voicemail/play` | ✓ VERIFIED | Explicitly not cdr-public. |
| `packages/backend/src/modules/voicemail/voicemail.controller.ts` | JWT detail/play/retry | ✓ VERIFIED | JwtAuthGuard. |
| `packages/backend/src/modules/voicemail/voicemail.service.ts` | ingest / notify / stream | ⚠️ HOLLOW (notify source) | Attach/link/stream are substantive. First-notify data source is disconnected from the generator. |
| `packages/backend/src/modules/voicemail/voicemail-scanner.service.ts` | Interval scanner | ✓ VERIFIED | `scanOnce` exported; running mutex. |
| `packages/backend/src/modules/voicemail/llm-summary.service.ts` | Thin LLM client | ✓ VERIFIED | axios + decryptSecret. |
| `packages/backend/src/modules/routes/dialplan-actions-migration.util.ts` | migrateVoicemailParams | ✓ VERIFIED | Type stays `voicemail`. |
| `packages/backend/src/modules/voicemail/migrate-voicemail-actions.ts` | Six-column script | ✓ VERIFIED | PHASE12 inventory + raw_dialplan log. |
| `packages/frontend/src/pages/CdrReportPage/CdrReportPage.tsx` | Third tab | ✓ VERIFIED | Shared filter + list query + Dialog. |
| `packages/frontend/src/features/cdr/ui/CdrFilter/CdrFilter.tsx` | Shared checkbox | ✓ VERIFIED | `clearAll` clears `voicemail`. |
| `packages/frontend/src/features/cdr/ui/VoicemailDetailsModal/VoicemailDetailsModal.tsx` | Details Dialog | ✓ VERIFIED | Four transcript states; JWT player; notify-failed meta line. |
| `packages/backend/src/modules/voicemail/voicemail-ai.adapter.ts` | MCP/AI tools | ✓ VERIFIED | Registered; read-only. |

**Artifacts:** 25/26 verified (1 hollow — notify data source)

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `actionToDialplan('voicemail')` | `[krsk-vm-done-{uid}]` CURL `/internal/dialplan/voicemail` | `buildCurlCall` | ✓ WIRED | uniqueid/file/status/clid/exten + vpbx_user_uid |
| Step `params.notify` | ingest body / `notify_dispatch` | generator CURL | ✗ NOT_WIRED | `params.notify` never read in `dialplan.util.ts` |
| CURL ingest | `voicemail_messages` | `VoicemailDialplanController` → `ingest` | ✓ WIRED | Fire-and-forget; `{accepted:true}` |
| ingest | dispatcher attach/link | `sendFirstNotify` | ⚠️ PARTIAL | Code path exists; production never supplies `integration_uid` |
| `mintPlayToken` | `GET /voicemail/play?token=` | `VoicemailLinkGuard` | ✓ WIRED | Separate from JWT play |
| JWT play | `safeVoicemailFilePath` → `AudioPlayer` | `voicemailPlayUrl` | ✓ WIRED | Dialog uses JWT path, not opaque token URL |
| `CdrUiFilters.voicemail` | tab + checkbox | `'1'` | ✓ WIRED | Both write the same field |
| `useGetVoicemailMessagesQuery` | voicemail tab body | `voicemailApi` | ✓ WIRED | |
| `scanOnce` | notify pending / transcript pending | two queries | ✓ WIRED | Independent axes |
| `parseWavPcm16` | STT factory | scanner | ✓ WIRED | sampleRate/channels checked |
| `VoicemailAiAdapter` | `AiAdapterRegistryService` | `onModuleInit` | ✓ WIRED | |
| `migrateVoicemailParams` | six JSON columns | `PHASE12_ACTION_TARGETS` | ✓ WIRED | |

**Wiring:** 10/12 connections verified (1 NOT_WIRED, 1 PARTIAL — same root cause)

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| CDR voicemail tab | message list | `GET /voicemail` → `messages.findAll({ user_uid })` | Yes | ✓ FLOWING |
| Details Dialog | transcript/summary | JWT `GET /voicemail/:uniqueid` → row columns | Yes | ✓ FLOWING |
| AudioPlayer `src` | JWT play URL | `voicemailPlayUrl(uniqueid)` | Yes (auth stream) | ✓ FLOWING |
| Notify dispatch | `integration_uid` | Expected from step `params.notify` via CURL | No — CURL omits it; tests inject it | ✗ DISCONNECTED |
| Opaque play token | notify body URL | `mintPlayToken` only on notify-path helpers | Yes when notify runs | ⚠️ STATIC unless D-62 is fixed |
| Step STT/LLM uids | `stt_engine_uid` / `llm_provider_uid` | Schema fields | No column on `voicemail_messages`; scanner falls back to tenant default | ⚠️ STATIC (tenant default still works for D-63) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| D-55 hangup order | `jest dialplan.util.spec -t "pushes hangup handler before Record"` | 1 passed | ✓ PASS |
| Ingest fire-and-forget + no STT | `jest voicemail-dialplan.controller.spec -t "returns before ingest completes\|does not invoke STT"` | 2 passed | ✓ PASS |
| Attach / link / D-66 | `jest voicemail.service.spec -t "attachment_rejected\|size 2MiB"` | 3 passed | ✓ PASS |
| Scanner D-68 / D-63 / D-70 | `jest voicemail-scanner.service.spec -t "three notify\|three STT\|not_configured"` | 3 passed | ✓ PASS |
| Live Asterisk Record → Telegram/email | (requires PBX + channel) | Not run | ? SKIP |

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| — | — | No `scripts/*/tests/probe-*.sh` and no phase-declared probes | SKIPPED |

### Requirements Coverage

Canonical D-54…D-59 live in `12-CONTEXT.md`. Discuss D-60…D-74 live in `13-CONTEXT.md`. Every D-ID appears in at least one PLAN `requirements:` list.

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| D-54 | 13-01, 13-02, 13-09 | Replace VoiceMail(); keep ActionType; migrate steps | ✓ SATISFIED | Generator + migrateVoicemailParams + six-column script |
| D-55 | 13-01, 13-02 | k + hangup_handler_push before Record; order test | ✓ SATISFIED | Production + passing spec |
| D-56 | 13-01, 13-03, 13-04 | Record flags UI; 7 RECORD_STATUS including OPERATOR | ✓ SATISFIED | Shared table + compiler + schema + ConditionEditor |
| D-57 | 13-07 | Thin OpenAI-compatible LLM + stt-engines | ✓ SATISFIED | LlmSummaryService + scanner STT |
| D-58 | 13-08, 13-10, 13-12 | CDR tab/filter, details, player; UNIQUEID correlation | ✓ SATISFIED | Surface L + JWT play + AI adapter |
| D-59 | 13-05 | Authenticated expiring notify link; cdr-public forbidden | ✓ SATISFIED | VoicemailLinkGuard; link controller comment + spec |
| D-60 | 13-07, 13-11 | Hangup does not call STT/LLM; scanner picks pending | ✓ SATISFIED | Ingest + `transcript_status=pending` query |
| D-61 | 13-07 | Nest `@Interval` batches; no BullMQ/Redis | ✓ SATISFIED | `vm-scan` 30s; voicemail module does not import Bull |
| D-62 | 13-06, 13-11 | Notify immediately from hangup path (Nest after accept) | ✗ BLOCKED | Nest send exists; step notify never reaches ingest |
| D-63 | 13-07 | No tenant engine → not_configured / ready-without-text | ✓ SATISFIED | Scanner + Dialog copy |
| D-64 | 13-06 | Threshold is file bytes, not duration | ✓ SATISFIED | `fs.stat` size |
| D-65 | 13-06 | 2 MiB attach threshold | ✓ SATISFIED | Strict `< 2 MiB` |
| D-66 | 13-06 | Attach reject → same-channel link; no retry consume | ✓ SATISFIED | Passing spec |
| D-67 | 13-05 | 7-day TTL; 401/404/410; file remains | ✓ SATISFIED | 401 on expired; no file delete |
| D-68 | 13-07 | 3 notify attempts; backoff ~1 / 4 / 10 min | ✓ SATISFIED | 3 attempts; delays 1 then 4 min (10 min slot unused — warning) |
| D-69 | 13-07, 13-08 | Notify error only on CDR details; no admin alert | ✓ SATISFIED | `notify_error` column; Dialog meta line; no alerter |
| D-70 | 13-07 | 3 STT/LLM fails → failed transcript; notify unchanged | ✓ SATISFIED | Passing spec; UI “не удалось” + retry |
| D-71 | 13-01, 13-07 | wav + RIFF parseWavPcm16; caller checks 8 kHz | ✓ SATISFIED | Util + scanner check |
| D-72 | 13-02, 13-11 | Same volume, `voicemail/` subdir | ✓ SATISFIED | Locked path in generator + `file_rel` |
| D-73 | 13-11 | No separate voicemail retention janitor | ✓ SATISFIED | No delete cron in module |
| D-74 | 13-04 | Default max duration 120 s | ✓ SATISFIED | Registry default + migrate default |

**Coverage:** 20/21 requirements satisfied. No orphaned D-IDs (D-54…D-74 all claimed by a plan).

### Decision Coverage

All 21 trackable CONTEXT.md decisions are reported honored by `check.decision-coverage-verify` (soft, non-blocking). That heuristic is a **false positive on D-62**: the decision text is implemented as a Nest helper, but the hangup-handler → ingest field contract is missing. Treat D-62 as not achieved despite 21/21 honored.

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
| --------- | ---------- | ------ | ------- | -------- | --------------- | ------- |
| `dialplan.util.spec.ts` (voicemail D-55) | D-54/D-55/D-72 | yes | no | no | Behavioral (index order) | OK |
| `voicemail.service.spec.ts` (first notify) | D-62/D-64/D-65/D-66 | yes | no | no | Value/behavioral | ⚠️ INSUFFICIENT for D-62 production path — fixture supplies `integration_uid` the generator never emits |
| `voicemail-dialplan.controller.spec.ts` | D-60/D-62 accept | yes | no | no | Behavioral | OK for accept/no-STT |
| `voicemail-scanner.service.spec.ts` | D-61/D-63/D-68/D-70 | yes | no | no | Behavioral | OK |
| `llm-summary.service.spec.ts` | D-57 | yes | no | no | Value | OK |
| `voicemail-ai.adapter.spec.ts` | D-58 | yes | no | no | Value | OK |
| `CdrFilter.test.tsx` / `CdrReportPage.test.tsx` / `VoicemailDetailsModal.test.tsx` | D-58/D-69 | yes | no | no | Behavioral (RTL) | OK |
| `ConditionEditor.test.tsx` | D-56 | yes | no | no | Value | OK |

**Disabled tests on requirements:** 0 → no blocker
**Circular patterns detected:** 0
**Insufficient assertions:** 1 (D-62 ingest notify — fixture-only `integration_uid`) → WARNING (same root cause as the gap)

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `packages/backend/src/shared/utils/dialplan.util.ts` | 707–713 | CURL payload omits `params.notify` | 🛑 Blocker | Configured notify never fires after Record |
| `packages/backend/src/modules/voicemail/voicemail.service.ts` | 432–437 | `list()` returns raw Sequelize rows | ⚠️ Warning | JWT list may serialize `notify_dispatch` (not the token URL; still extra) |
| `packages/backend/src/modules/voicemail/voicemail-scanner.service.ts` | 155–165 | `stt_engine_uid` / `llm_provider_uid` cast on a model that has no such columns | ⚠️ Warning | Step-level engine/provider fields are dead; tenant default still satisfies D-63 |
| `packages/backend/src/modules/voicemail/voicemail-scanner.service.ts` | 26 | `NOTIFY_BACKOFF_MS = [60_000, 4*60_000]` | ℹ️ Info | Third ~10 min backoff from D-68 is unused; 3 attempts still fail-closed |
| `packages/frontend/src/shared/ui/RecordingButton/RecordingButton.tsx` | 49 | `Play` icon, not `Mic` | ℹ️ Info | Surface L asked Mic vs Voicemail; conversation vs voicemail remain distinguishable |
| Phase-modified files | — | `TBD` / `FIXME` / `XXX` | — | None (wav-pcm spec uses `XXXX` as a RIFF id fixture, not a debt marker) |

**Anti-patterns:** 5 found (1 blocker, 2 warnings, 2 info)

### Human Verification Required

Not status-driving while `gaps_found` is open. After the notify wiring is fixed, a human should still walk Surface L (visual/live):

### 1. CDR tab and shared filter

**Test:** Open the CDR report, click «Голосовые сообщения», toggle the filter checkbox, clear filters, switch Journal / Analytics.
**Expected:** Tab and checkbox stay in sync via `voicemail=1`; list comes from `/voicemail`; journal still shows a Voicemail icon on rows that have a message.
**Why human:** Layout, i18n, and URL share state are visual.

### 2. Details Dialog and player

**Test:** Open details from the tab and from the journal icon; play, seek, download; inspect pending / ready / failed / not_configured.
**Expected:** Dialog (not Sheet), full AudioPlayer, JWT stream (`…/voicemail/:uniqueid/play`), no opaque `?token=` URL on screen; notify failure is a meta line only.
**Why human:** Audio playback and visual states.

### 3. Live greeting → Record → notify (blocked until gap fix)

**Test:** Route with voicemail step: greeting, Record flags, notify integration; call in, hang up mid-record.
**Expected:** File under `{records_base_path}/{uid}/voicemail/`; Telegram/email attach or 7-day link; CDR row; STT later if configured. Hangup does not stall on STT.
**Why human:** Requires Asterisk. Will currently fail notify because of the generator gap.

## Gaps Summary

### Critical Gaps (Block Progress)

1. **Step notify never reaches ingest (D-62 / phase-goal notify)**
   - Missing: `params.notify.integration_uid` (and body/target/subject) on the hangup-handler CURL, or an ingest lookup that persists `notify_dispatch` from the saved step.
   - Impact: Operators can configure notify in the Sheet; after Record the row is stored and STT can run, but Telegram/email/webhook never fire. Attach/link/token code is dead on the real path.
   - Fix: Extend `emitVoicemailDialplan` `buildCurlCall` payload (and add a spec that fails if those fields are absent). Optionally also persist step uids for STT/LLM.

### Non-Critical Gaps (Can Defer)

1. **Step-level `stt_engine_uid` / `llm_provider_uid` are not stored on the message row**
   - Issue: Scanner always falls back to the first tenant engine / HTTP LLM.
   - Impact: Per-step engine override in the Sheet is cosmetic. D-63 tenant-optional STT still works.
   - Recommendation: Persist on ingest once the CURL (or a step lookup) carries the uids.

2. **D-68 10-minute backoff slot unused**
   - Issue: Only 1 min and 4 min delays exist between the three attempts.
   - Impact: Faster fail-closed than “~1 / 4 / 10”. Still three attempts.
   - Recommendation: Add a third backoff entry if the discuss wording is taken literally.

## Recommended Fix Plans

### 13-13-PLAN.md: Wire step notify into hangup CURL

**Objective:** Make D-62 true on the production path: configured notify actually leaves Nest after ingest.

**Tasks:**
1. In `emitVoicemailDialplan`, read `params.notify` and add sanitized `integration_uid`, `body`, `target`, `subject` to `buildCurlCall('voicemail', …)`. Add a D-55/D-62 spec that `params.notify.integration_uid = 15` appears in the CURL and is absent when notify is empty.
2. Confirm ingest persists `notify_dispatch` from those fields and `sendFirstNotify` runs; keep fire-and-forget / no STT.
3. Verify: generator spec + existing attach/link tests still pass without injecting fields the generator would not emit (derive the fixture from generated CURL decode).

**Estimated scope:** Small

---

## Verification Metadata

**Verification approach:** Goal-backward (ROADMAP Phase 13 goal + PLAN must_haves + CONTEXT D-54…D-74)
**Must-haves source:** ROADMAP goal (no `success_criteria` array) + all `13-*-PLAN.md` frontmatter, deduplicated; plan must_haves did not subtract roadmap scope
**Automated checks:** 9 named tests passed; 1 critical wiring gap
**Human checks required:** 3 (deferred until gap fix; do not flip status to `human_needed` while `gaps_found`)
**Decision coverage:** 21/21 honored (soft; D-62 false positive)
**Total verification time:** ~25 min

**Inversion (disconfirm):** (1) notify fields missing from CURL — confirmed; (2) ingest tests look green because they inject `integration_uid` — confirmed misleading test; (3) step STT/LLM uids unused — warning only.

---
*Verified: 2026-09-03T04:32:00Z*
*Verifier: Claude (gsd-verifier)*
