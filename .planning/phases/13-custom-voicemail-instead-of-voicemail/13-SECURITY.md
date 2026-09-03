---
phase: "13"
slug: "custom-voicemail-instead-of-voicemail"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
block_on: high
created: "2026-09-03"
---

# Phase 13 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> State B (no prior SECURITY.md). Register authored at plan time. ASVS L1 grep-depth.

**Verdict:** SECURED — 28/28 closed, `threats_open: 0`

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Asterisk hangup CURL → `POST /internal/dialplan/voicemail` | Untrusted ingest; only `DIALPLAN_API_KEY` authenticates | uniqueid, file, RECORD_STATUS, notify/engine uids |
| Unauthenticated browser → `GET /voicemail/play` | Opaque 7-day token is the only credential; JWT must not intercept | play token hex |
| JWT operator → list / detail / play | Tenant from `req.user.vpbx_user_uid`; CDR access-scope for viewers | transcripts, uniqueid, clid |
| Token guard → `req.user` | Must not become a JWT session (no `sub`/`level`) | `vpbx_user_uid`, `isDisplayToken` |
| Nest → Telegram/email | File bytes and token URL leave the tenant | attach buffer or `/voicemail/play?token=` |
| MCP / ai-tools → VoicemailService | Caller must not see other tenants or token URLs | message DTO whitelist |
| transcript → LLM | Untrusted user speech as prompt input | truncated transcript |
| disk → Node buffer | Large wav could DoS memory | wav bytes |
| Generator → disk path | D-72 prefix is a one-way door | Record() path |
| Browser → JWT list hook | Tab must not invent a public play URL | JWT `/voicemail` list |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-13-01 | Tampering | `parseWavPcm16` | medium | mitigate | Chunk walk; reject non-16-bit; clamp data length — `wav-pcm.util.ts:7-17` | closed |
| T-13-02 | Denial of service | `parseWavPcm16` | low | accept | Parser bounded by buffer; scanner size-guards before `readFile` (see Accepted Risks) | closed |
| T-13-03 | Spoofing | `VoicemailDialplanController` | high | mitigate | `timingSafeApiKeyEqual`; 401 when key missing/mismatch — `voicemail-dialplan.controller.ts:45-49`, `dialplan-api-key.ts:3-12` | closed |
| T-13-04 | Information disclosure | `VoicemailController` list | high | mitigate | Tenant from JWT only (`req.user.vpbx_user_uid`); `where: { user_uid }` — `voicemail.controller.ts:18-22`, `voicemail.service.ts:444-447` | closed |
| T-13-05 | Tampering | ingest `file` / uniqueid | high | mitigate | `sanitizeUniqueid` allow-list; `toRelativeFileRel` rebuilds `{uid}/voicemail/{name}.wav` — `voicemail.service.ts:30,60-81,240-252` | closed |
| T-13-06 | Elevation of privilege | ingest `user_uid` | medium | mitigate | Key required; uid is generator-stamped tenant, not a JWT session — `voicemail-dialplan.controller.ts:38`, `voicemail.service.ts:246-250` | closed |
| T-13-07 | Tampering | `buildConditionExpr` record_status | medium | mitigate | Filter values through `RECORD_STATUS_VALUES` before emit — `dialplan-condition.util.ts:119-123` | closed |
| T-13-08 | Denial of service | `max_duration` | medium | mitigate | `@Min(1)` + UI default 120; generator numeric cap — `address.params.dto.ts:480-483`, `dialplan.util.ts:684-685` | closed |
| T-13-09 | Tampering | `greeting` path | medium | mitigate | `SAFE_GREETING` + prompt picker (`optionsSource: 'prompts'`); no free absolute path — `address.params.dto.ts:28-29,474-477`, `voicemail.tsx:110-117` | closed |
| T-13-10 | Information disclosure / Elevation of privilege | `GET /voicemail/play` vs `GET /voicemail/:uniqueid` | critical | mitigate | Opaque 7-day token + expire/revoke; `VoicemailLinkController` registered **before** JWT `:uniqueid` so `play` is not treated as a uniqueid and JwtAuthGuard does not see the hex as a JWT (CR-01) — `voicemail.module.ts:32`, `voicemail-link.controller.ts:10-22`, `voicemail-link.guard.ts:35-44`, `voicemail.service.ts:120-131` | closed |
| T-13-11 | Elevation of privilege | `VoicemailLinkGuard` | high | mitigate | `req.user` is `{ vpbx_user_uid, isDisplayToken }` only — no `sub`/`level` — `voicemail-link.guard.ts:46-49` | closed |
| T-13-12 | Tampering | `safeVoicemailFilePath` | high | mitigate | Reject `..`, absolute, drive-letter; `startsWith(base + path.sep)` prefix-safe (WR-02) — `voicemail.service.ts:88-97` | closed |
| T-13-13 | Information disclosure | notify link | high | mitigate | Only 13-05 opaque 7-day token via `mintPlayToken`; never a raw file URL — `voicemail.service.ts:406-411` | closed |
| T-13-14 | Denial of service | attach buffer | medium | mitigate | 2 MiB gate; larger files are link-only — `voicemail.service.ts:26,377-403` | closed |
| T-13-15 | Tampering | `LlmSummaryService` | medium | mitigate | Fixed system prompt; transcript only in user role; 4k cap — `llm-summary.service.ts:8-9,63-66,112-115` | closed |
| T-13-16 | Spoofing | custom STT | medium | accept | Reuse existing custom-http-stt allow-list; step has no new URL field (see Accepted Risks) | closed |
| T-13-17 | Denial of service | scanner `readFile` | medium | mitigate | `MAX_WAV_BYTES` (20 MiB) before buffer load; 30s LLM timeout — `voicemail-scanner.service.ts:27,125-130`, `llm-summary.service.ts:8,118` | closed |
| T-13-18 | Information disclosure | `decryptSecret` | high | mitigate | AES via `CC_AI_KEY_SECRET`; logs only `uid`/`status`/`model`, never plaintext key — `llm-summary.service.ts:95-123`, `secret-cipher.util.ts:19-21,33-42` | closed |
| T-13-19 | Information disclosure | Details Dialog | high | mitigate | JWT stream only (`voicemailPlayUrl` → `/:uniqueid/play`); never renders `/voicemail/play?token=` — `voicemailApi.ts:4-9`, `VoicemailDetailsModal.tsx:27-35`; `toDetailDto` omits token/`notify_dispatch` (WR-01) — `voicemail.service.ts:515-536` | closed |
| T-13-20 | Information disclosure | play uniqueid | high | mitigate | Tenant `where` + CDR `findByUniqueid` access-scope; 404 cross-tenant — `voicemail.service.ts:498-512` | closed |
| T-13-21 | Tampering | `migrate-voicemail-actions` | high | mitigate | Pure `migrateVoicemailParams` + specs; backup JSON; `--dry-run`; `raw_dialplan` SELECT/log only — `migrate-voicemail-actions.ts:12-19,41-58` | closed |
| T-13-22 | Information disclosure | `get_voicemail_message` | high | mitigate | Handler uid argument; service tenant where; `toSafeMessage` omits token/`notify_dispatch` — `voicemail-ai.adapter.ts:85-88,101-106,118-139` | closed |
| T-13-23 | Elevation of privilege | adapter closure | high | mitigate | Every handler receives `vpbxUserUid` as a call parameter — never closed over — `voicemail-ai.adapter.ts:36,85-86,101` | closed |
| T-13-25 | Tampering | `actionToDialplan` Record path | high | mitigate | Emit only locked D-72 prefix `{base}/{uid}/voicemail/${UNIQUEID}-%d.wav` — `dialplan.util.ts:659-683` | closed |
| T-13-26 | Information disclosure | CdrReportPage voicemail tab | medium | mitigate | `useGetVoicemailMessagesQuery` only; JWT play URL helper, no token play URL — `CdrReportPage.tsx:20,69-72` | closed |
| T-13-27 | Tampering | `emitVoicemailDialplan` notify payload | high | mitigate | Notify/engine fields copied through `sanitizeDialplanInput` (CR-02) — `dialplan.util.ts:717-728` | closed |
| T-13-28 | Information disclosure | hangup CURL notify body/target | medium | mitigate | Same sanitizer; no secrets added; token URL minted only inside Nest notify helpers — `dialplan.util.ts:707-728`, `voicemail.service.ts:406-411` | closed |
| T-13-SC | Tampering | npm / openai SDK | high | accept | No packages added this phase; no `openai` dependency (see Accepted Risks) | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above `block_on: high` count toward `threats_open`*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

`T-13-24` was never registered. `T-13-10` / `T-13-03` were re-declared in 13-13; each ID is one row (highest severity kept).

---

## Focus checks (review CR/WR + orchestrator)

| Check | Threat | Evidence | Result |
|-------|--------|----------|--------|
| Ingest `timingSafeApiKeyEqual` | T-13-03 | `voicemail-dialplan.controller.ts:46`; empty `DIALPLAN_API_KEY` fails closed (`dialplan-api-key.ts:4`) | CLOSED |
| Token play not shadowed by JWT `:uniqueid` (CR-01) | T-13-10 | `controllers: [VoicemailDialplanController, VoicemailLinkController, VoicemailController]` — `voicemail.module.ts:32`; spec asserts order | CLOSED |
| `req.user` without `sub`/`level` | T-13-11 | `voicemail-link.guard.ts:46-49` | CLOSED |
| `safeVoicemailFilePath` prefix-safe (WR-02) | T-13-12 | reject absolute/drive-letter; `startsWith(base + sep)` — `voicemail.service.ts:88-97` | CLOSED |
| No token URL in JWT / UI / adapter | T-13-19 / T-13-22 / T-13-26 | `toDetailDto`, `toSafeMessage`, `voicemailPlayUrl`, DetailsModal JWT `/:uniqueid/play` | CLOSED |
| Hangup CURL carries `integration_uid` (CR-02) | T-13-27 / T-13-13 | `dialplan.util.ts:717-718`; ingest persists `notify_dispatch` — `voicemail.service.ts:278-307` | CLOSED |
| JWT list omits `notify_dispatch` (WR-01) | T-13-19 | `list()` maps `toDetailDto` — `voicemail.service.ts:444-456,515-536` | CLOSED |
| JWT list access-scope (WR-03) | T-13-04 / T-13-20 | `list(tenant, viewerUserId)` filters via `cdrService.findByUniqueid` — `voicemail.service.ts:444-461` | CLOSED |
| `retryTranscript` tenant (WR-04) | T-13-04 | `where: { uniqueid, user_uid }` — `voicemail-scanner.service.ts:101-102`; `retryStt` passes `tenantId` | CLOSED |
| No new npm / no openai SDK | T-13-SC | root + `@krasterisk/backend` `package.json` have no `openai`; LLM is axios | CLOSED |
| `cdr-public` not used for voicemail | T-13-10 / D-59 | `voicemail-link.controller.ts` comment + spec; module does not import `cdr-public.controller` | CLOSED |

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-13-02 | T-13-02 | WAV parser is bounded by the already-loaded buffer. Memory DoS is owned by the scanner size guard (`MAX_WAV_BYTES` before `readFile`, T-13-17). | phase-13 plans (13-01) | 2026-09-03 |
| AR-13-16 | T-13-16 | Custom STT URLs stay on the existing `custom-http-stt` engine allow-list. The voicemail step has no new outbound URL field. | phase-13 plans (13-07) | 2026-09-03 |
| AR-13-SC | T-13-SC | No npm/pip/cargo packages added for this phase. LLM is a thin axios client (`llm-summary.service.ts`); no official OpenAI SDK. | phase-13 plans (all) | 2026-09-03 |

*Accepted risks do not resurface in future audit runs.*

---

## Unregistered Flags

None. The only SUMMARY `## Threat Flags` block (13-06) maps to T-13-13 / T-13-14.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-03 | 28 | 28 | 0 | gsd-security-auditor (State B) |

## Security Audit 2026-09-03

| Metric | Count |
|--------|-------|
| Threats found | 28 |
| Closed | 28 |
| Open (blocking ≥ high) | 0 |
| Open (non-blocking) | 0 |
| Unregistered flags | 0 |
| ASVS level | 1 |
| block_on | high |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-03
