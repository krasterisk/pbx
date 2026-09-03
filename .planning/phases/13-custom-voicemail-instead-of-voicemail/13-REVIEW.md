---
phase: 13-custom-voicemail-instead-of-voicemail
reviewed: 2026-09-03T04:30:00Z
depth: deep
files_reviewed: 22
files_reviewed_list:
  - packages/backend/src/modules/voicemail/voicemail.service.ts
  - packages/backend/src/modules/voicemail/voicemail.controller.ts
  - packages/backend/src/modules/voicemail/voicemail-dialplan.controller.ts
  - packages/backend/src/modules/voicemail/voicemail-link.controller.ts
  - packages/backend/src/modules/voicemail/voicemail-link.guard.ts
  - packages/backend/src/modules/voicemail/voicemail-scanner.service.ts
  - packages/backend/src/modules/voicemail/voicemail-ai.adapter.ts
  - packages/backend/src/modules/voicemail/voicemail.module.ts
  - packages/backend/src/modules/voicemail/llm-summary.service.ts
  - packages/backend/src/modules/voicemail/voicemail-message.model.ts
  - packages/backend/src/modules/voicemail/wav-pcm.util.ts
  - packages/backend/src/modules/dialplan-bridge/dialplan-api-key.ts
  - packages/backend/src/shared/utils/dialplan.util.ts
  - packages/backend/src/shared/utils/dialplan-curl.util.ts
  - packages/backend/src/modules/auth/jwt.strategy.ts
  - packages/backend/src/modules/auth/jwt-auth.guard.ts
  - packages/shared/src/types/voicemail.types.ts
  - packages/shared/src/types/dialplan-params.types.ts
  - packages/frontend/src/shared/api/endpoints/voicemailApi.ts
  - packages/frontend/src/features/cdr/ui/VoicemailDetailsModal/VoicemailDetailsModal.tsx
  - packages/frontend/src/features/dialplan-apps/model/schemas/voicemail.tsx
  - packages/frontend/src/pages/CdrReportPage/CdrReportPage.tsx
findings:
  critical: 2
  warning: 4
  info: 2
  total: 8
status: issues
---

# Phase 13: Code Review Report

**Reviewed:** 2026-09-03T04:30:00Z
**Depth:** deep
**Files Reviewed:** 22
**Status:** issues

## Summary

Advisory review of the Phase 13 custom-voicemail stack (plans 13-01…13-10, 13-11, 13-12) against PLAN/SUMMARY threat models (T-13-03…T-13-26) and the requested focus list.

Several threat mitigations are in place: ingest uses `timingSafeApiKeyEqual` and fire-and-forgets `ingest` (no STT on the hangup path); `VoicemailLinkGuard` sets `req.user` without `sub`/`level`; JWT list/detail/play take tenant from `req.user.vpbx_user_uid`; the AI adapter and CDR UI do not emit the opaque `/voicemail/play?token=` URL; LLM is a thin axios client (no `openai` package). Notify and transcript are separate columns and separate scanner queries.

Two ship-blocking defects remain: the token play route is shadowed by JWT `:uniqueid`, and the generator never stamps step `notify` (or STT/LLM) fields onto the hangup CURL that ingest actually reads.

| Focus check | Verdict |
|-------------|---------|
| `timingSafeApiKeyEqual` on ingest | Pass (T-13-03) |
| Tenant JWT scoping | Partial — tenant `where` is correct; list skips CDR access-scope and returns raw rows |
| `safeVoicemailFilePath` | Incomplete `startsWith` / absolute-path guards (T-13-12) |
| Token `req.user` without `sub`/`level` | Pass (T-13-11) |
| Notify vs transcript isolation | Axes isolated; notify pipeline is dead (CR-02) |
| No `openai` SDK | Pass |
| No token URL in UI / adapter | Pass for the opaque 7-day URL (T-13-19 / T-13-22 / T-13-26) |
| Hangup ingest not awaiting STT | Pass (D-60 / D-62) |

## Critical Issues

### CR-01: Token play URL is captured by JWT `GET /voicemail/:uniqueid`

**File:** `packages/backend/src/modules/voicemail/voicemail.module.ts:32`
**Also:** `packages/backend/src/modules/voicemail/voicemail.controller.ts:43-50`, `packages/backend/src/modules/voicemail/voicemail-link.controller.ts:15-22`
**Issue:** `mintPlayToken` issues `APP_URL/api/voicemail/play?token=…` (T-13-10 / T-13-13). `VoicemailModule` registers `VoicemailController` (JwtAuthGuard, `@Get(':uniqueid')`) **before** `VoicemailLinkController` (`@Get('play')`, VoicemailLinkGuard only). Nest/Express matches in registration order; `/:uniqueid` consumes the literal path `play`. An unauthenticated notify-link holder then hits JwtAuthGuard; `ExtractJwt.fromUrlQueryParameter('token')` treats the opaque hex as a JWT and returns 401. Telegram/email play links do not work. T-13-10 is not mitigated in the running app.
**Fix:** Register the static token route first, or stop using a colliding path.

```ts
// voicemail.module.ts — LinkController before the parameterized JWT controller
controllers: [
  VoicemailDialplanController,
  VoicemailLinkController,
  VoicemailController,
],
```

Safer: move token play to a non-overlapping path (`GET /voicemail/public/play`) and update `mintPlayToken` to match. Add an HTTP-level test that `GET /voicemail/play?token=<opaque>` is 200 without a JWT.

### CR-02: Hangup CURL never carries step notify (or STT/LLM) params

**File:** `packages/backend/src/shared/utils/dialplan.util.ts:707-713`
**Also:** `packages/backend/src/modules/voicemail/voicemail.service.ts:271-295`, `packages/frontend/src/features/dialplan-apps/model/schemas/voicemail.tsx:39-57`
**Issue:** The voicemail schema persists `params.notify.{integration_uid,body,target,subject}` (13-04). Ingest first-notify and `notify_dispatch` persist those fields from the CURL body (13-06). `emitVoicemailDialplan` only posts `uniqueid`, `file`, `status`, `clid`, `exten` (plus `vpbx_user_uid` / `api_key` from `buildCurlCall`). `sendFirstNotify` returns immediately when `integration_uid` is missing. Configured Telegram/email never fires; `notify_status` stays `pending` with `next_notify_at = null`, so the scanner notify query (`next_notify_at <= now`) also never picks the row up. The same gap drops `stt_engine_uid` / `llm_provider_uid` — the scanner casts columns that do not exist on `VoicemailMessage` and always falls through to “first tenant engine”.
**Fix:** Stamp sanitized notify + engine fields into the hangup payload:

```ts
const curlPayload: Record<string, string> = {
  uniqueid: '${UNIQUEID}',
  file: '${RECORDED_FILE}',
  status: '${RECORD_STATUS}',
  clid: '${CALLERID(num)}',
  exten: '${EXTEN}',
};
const notify = params.notify && typeof params.notify === 'object' ? params.notify : {};
if (notify.integration_uid) {
  curlPayload.integration_uid = this.sanitizeDialplanInput(String(notify.integration_uid));
}
if (notify.body) curlPayload.body = this.sanitizeDialplanInput(String(notify.body));
if (notify.target) curlPayload.target = this.sanitizeDialplanInput(String(notify.target));
if (notify.subject) curlPayload.subject = this.sanitizeDialplanInput(String(notify.subject));
if (params.stt_engine_uid) {
  curlPayload.stt_engine_uid = this.sanitizeDialplanInput(String(params.stt_engine_uid));
}
if (params.llm_provider_uid) {
  curlPayload.llm_provider_uid = this.sanitizeDialplanInput(String(params.llm_provider_uid));
}
const curl = buildCurlCall('voicemail', curlPayload, this.curlCtx(vpbxUserUid));
```

Persist `stt_engine_uid` / `llm_provider_uid` on `voicemail_messages` (or inside `notify_dispatch`) so the scanner can resolve the step engines. Add a `dialplan.util` assertion that a step with `notify.integration_uid` emits those keys in the handler CURL.

## Warnings

### WR-01: JWT list returns raw Sequelize rows including `notify_dispatch`

**File:** `packages/backend/src/modules/voicemail/voicemail.service.ts:432-437`
**Also:** `packages/backend/src/modules/voicemail/voicemail.controller.ts:18-22`, `packages/backend/src/modules/voicemail/voicemail-message.model.ts:57-59`
**Issue:** `list()` returns `findAll` models. Sequelize `toJSON()` includes `notify_dispatch` (integration uid, target, subject, body). Detail uses `toDetailDto` and omits that column. Any tenant operator who can `GET /voicemail` sees notify routing PII. The AI adapter whitelists via `toSafeMessage`; the JWT list does not. T-13-19 / T-13-22 hygiene is only half-applied.
**Fix:** Map list through the same DTO as detail (or `attributes` exclude `notify_dispatch`). Do not return the raw model.

```ts
list(vpbxUserUid: number) {
  return this.messages.findAll({
    where: { user_uid: vpbxUserUid },
    order: [['created_at', 'DESC']],
  }).then((rows) => rows.map((row) => this.toDetailDto(row)));
}
```

### WR-02: `safeVoicemailFilePath` `startsWith` is not prefix-safe

**File:** `packages/backend/src/modules/voicemail/voicemail.service.ts:84-91`
**Issue:** T-13-12 requires `..` + `startsWith(baseResolved)`. The helper rejects `..` and rebuilds ingest paths via `toRelativeFileRel`, but the resolver still has the classic prefix hole: `fileResolved.startsWith(baseResolved)` is true for a sibling such as `{base}-evil/…`. On Windows, a stored `rel` of `C:/usr/records-evil/x.wav` resolves to an absolute path; if that string starts with `C:\usr\records`, the check passes. Ingest currently cannot write that `rel`, so this is defense-in-depth — the same pattern CDR already uses — but it is the file-stream trust boundary.
**Fix:**

```ts
export function safeVoicemailFilePath(base: string, rel: string): string | null {
  const cleaned = String(rel ?? '').replace(/^\/+/, '').replace(/\\/g, '/');
  if (!cleaned || cleaned.includes('..') || path.isAbsolute(cleaned) || /^[A-Za-z]:/.test(cleaned)) {
    return null;
  }
  const baseResolved = path.resolve(base);
  const fileResolved = path.resolve(baseResolved, cleaned);
  const prefix = baseResolved.endsWith(path.sep) ? baseResolved : baseResolved + path.sep;
  if (fileResolved !== baseResolved && !fileResolved.startsWith(prefix)) return null;
  return fs.existsSync(fileResolved) ? fileResolved : null;
}
```

### WR-03: JWT list skips the CDR access-scope used by play/detail

**File:** `packages/backend/src/modules/voicemail/voicemail.service.ts:432-437`
**Also:** `packages/backend/src/modules/voicemail/voicemail.service.ts:473-488`, `packages/frontend/src/pages/CdrReportPage/CdrReportPage.tsx:252-254`
**Issue:** T-13-04 scopes list to `user_uid` from the JWT (that part is correct — query `tenant` / `vpbx_user_uid` is ignored). Play/detail/retry call `cdrService.findByUniqueid` so a viewer without CDR visibility gets 404 (T-13-20). `list()` does not. The CDR voicemail tab renders `msg.transcript` from that list, so an operator can read every tenant transcript (and uniqueid/clid) for calls they cannot play. Access-scope on the details modal is bypassed by the table.
**Fix:** Either apply the same visibility filter when listing, or stop returning `transcript` / `summary` on the list endpoint and load them only through `findByUniqueid`.

### WR-04: `retryTranscript` looks up `uniqueid` with no tenant

**File:** `packages/backend/src/modules/voicemail/voicemail-scanner.service.ts:101-108`
**Issue:** JWT `retryStt` first calls `requireVisibleRow(tenantId, uniqueid, viewerUserId)`, then `scanner.retryTranscript(uniqueid)`. The scanner `findOne({ where: { uniqueid } })` is global. A colliding uniqueid (second Asterisk writing the same DB, or a crafted ingest with the shared `DIALPLAN_API_KEY`) resets another tenant’s transcript axis. T-13-04’s tenant `where` is missing on this write.
**Fix:**

```ts
async retryTranscript(uniqueid: string, userUid: number): Promise<void> {
  const row = await this.messages.findOne({ where: { uniqueid, user_uid: userUid } });
  if (!row) return;
  await row.update({ transcript_status: 'pending', transcript_attempts: 0 });
}
```

Pass `tenantId` from `VoicemailService.retryStt`.

## Info

### IN-01: Scanner notify query cannot recover unscheduled `pending` rows

**File:** `packages/backend/src/modules/voicemail/voicemail-scanner.service.ts:61-70`
**Issue:** Notify retries require `notify_status=pending` **and** `next_notify_at <= now`. SQL does not match `NULL`. Combined with CR-02, every production row stays `pending` forever on the notify axis while transcript still proceeds — isolation holds, notify never heals. Even after CR-02, a crash between `create` and `sendFirstNotify` leaves the same stuck state.
**Fix:** Treat `next_notify_at IS NULL` as due, or set `next_notify_at = now` on insert when an integration is present.

### IN-02: Step STT/LLM uids are not columns; scanner reads missing fields

**File:** `packages/backend/src/modules/voicemail/voicemail-scanner.service.ts:155-182`
**Also:** `packages/backend/src/modules/voicemail/voicemail-message.model.ts`
**Issue:** `resolveEngine` / `pickLlm` cast `stt_engine_uid` / `llm_provider_uid` on the Sequelize model. Those attributes are not declared or ingested. Per-step engine selection in the schema is dead; the scanner always uses `findAll(tenant)[0]`.
**Fix:** Same persist path as CR-02; add real columns or store the uids in `notify_dispatch` / a sibling JSON snapshot.

## Focus items that passed

- **T-13-03:** `VoicemailDialplanController.assertKey` uses `timingSafeApiKeyEqual`; empty `DIALPLAN_API_KEY` fails closed.
- **T-13-11:** `VoicemailLinkGuard` sets only `{ vpbx_user_uid, isDisplayToken }`. Spec asserts key set.
- **D-60 / D-62:** Controller `void this.service.ingest(body)` then `{ accepted: true }`. `ingest` upserts + first notify only; no STT/LLM.
- **T-13-05:** `sanitizeUniqueid` allow-list + `toRelativeFileRel` rebuilds `{uid}/voicemail/{name}.wav`; caller absolute paths are not stored.
- **T-13-19 / T-13-22 / T-13-26:** `toDetailDto`, `toSafeMessage`, `voicemailApi`, and `VoicemailDetailsModal` do not expose `/voicemail/play?token=`. In-app play is `GET /voicemail/:uniqueid/play` (JWT query param matches existing CDR recording URLs).
- **T-13-SC / D-57:** `llm-summary.service.ts` uses axios + `decryptSecret`. No `openai` dependency in backend or root `package.json`. `wss:` and native `/api/chat` are skipped.
- **D-68 isolation:** Scanner uses two queries (`notify_status` vs `transcript_status`). A failed notify does not flip transcript, and the reverse.

---

_Reviewed: 2026-09-03T04:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
