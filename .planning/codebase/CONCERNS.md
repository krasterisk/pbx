# Codebase Concerns

**Analysis Date:** 2026-08-28

## Tech Debt

**Gitignored operational knowledge (`.docs/`, `.cursor/`, `.idea/`, `**/migrations/`):**
- Issue: Root `.gitignore` excludes `.docs/`, `.cursor/`, `.idea/`, `**/migrations/`, and `**/scripts/`. `.planning/CANONICAL_REFS.md` still points agents at `.docs/*_MODULE.md` and `packages/frontend/.idea/ARCHITECTURE.md` / `packages/backend/.idea/ARCHITECTURE.md`. `packages/backend/package.json` `db:migrate` runs `node migrations/run-migrations.js`, but `packages/backend/migrations/` is not present in this tree. Schema changes live as ad-hoc `migrate-*.ts` next to modules (e.g. `packages/backend/src/modules/call-groups/migrate-call-groups-exten.ts`).
- Why: Env-specific deploy scripts and local GSD/docs were kept out of git; Phase 8 force-tracked `packages/frontend/.idea/ARCHITECTURE.md` despite the ignore.
- Impact: New clones lack module docs, Sequelize migration history, and (unless force-added) architecture contracts. Live schema can drift from code. `CODEBASE-SNAPSHOT.md` still claims MOH `mode: 'files'` while `packages/backend/src/modules/moh/moh.service.ts` already writes `mode: 'playlist'`.
- Fix approach: Force-track the two `ARCHITECTURE.md` files and a committed migration runner index; vendor a checked-in `.docs/` index or move module docs under `.planning/`; refresh `CODEBASE-SNAPSHOT.md` after each map.

**Legacy PHP still emitted from inbound route generator:**
- Issue: Phase 12 replaced PHP for setclid/webhook/TTS/notify via `packages/backend/src/modules/dialplan-bridge/`, but `packages/backend/src/modules/routes/routes.service.ts` still emits `SHELL(/usr/scripts/check_blacklist.php …)` and `SHELL(/usr/scripts/check_listbook.php …)` when `check_blacklist` / `check_listbook` are set and no phonebook binding replaces blacklist.
- Why: Backward-compat path for tenants that never migrated those flags to phonebook bindings (`routes.service.spec.ts` asserts the PHP line still appears).
- Impact: `.planning/WINDOWS.md` window 1 and Phase 12 M12 (`12-17-PLAN.md` D-31) cannot close while live dialplan still shells PHP. Asterisk `SHELL()` is a process-spawn hotspot and a leftover attack surface.
- Fix approach: Fold both checks into existing phonebook Gosub / `CURL()` dialplan-bridge; keep a one-release dual-read; then delete the PHP lines and close M12 with a post-deploy `check_*.php` hit-counter of 0.

**Voicemail type left on Asterisk `VoiceMail()` (Phase 12b):**
- Issue: `packages/frontend/src/features/dialplan-apps/model/registry.ts` registers `voicemail` with no schema/summarize (unlike `notify` / `webhook`). Generator still emits `VoiceMail(${exten}@default,u)` in `packages/backend/src/shared/utils/dialplan.util.ts`. `12-12-SUMMARY.md` and `STATE.md` explicitly keep the type until Phase 12b (D-54…D-59).
- Why: Custom Record()+hangup_handler voicemail was sized as its own workstream; Wave 12 only hard-removed `tofax`/`asr`/`keywords` and folded notify aliases.
- Impact: Mailboxes are not tenant-provisioned (`@default`); MWI/folders were never wired. `cdr-public.controller.ts` must not be reused for voicemail links (`12-CONTEXT.md` D-59).
- Fix approach: Execute Phase 12b as planned — new `modules/voicemail/`, `Record()` with `k`, expiring `audience='voicemail-link'` tokens, migrate existing steps, then hard-remove the `voicemail` ActionType.

**`DIALPLAN_API_KEY` check is not one helper:**
- Issue: `packages/backend/src/modules/dialplan-bridge/dialplan-api-key.ts` (`timingSafeApiKeyEqual`) is used only by `dialplan-bridge.controller.ts`. Sibling internals still use `if (this.apiKey && provided !== this.apiKey)` — `packages/backend/src/modules/notifications/dialplan-notify.controller.ts`, `packages/backend/src/modules/mailer/dialplan-notify.controller.ts`, `packages/backend/src/modules/routes/dialplan-webhooks.controller.ts`, `packages/backend/src/modules/phonebooks/phonebook-lookup.controller.ts`, `packages/backend/src/modules/ivrs/ivrs-internal.controller.ts`. Empty env key skips the check entirely.
- Why: Bridge was added in 12-11 with a timing-safe helper; older CURL endpoints were not migrated.
- Impact: Missing `DIALPLAN_API_KEY` opens notify/webhook/phonebook/IVR internals. Non-constant-time compare on the older paths.
- Fix approach: Shared guard that 401s when the env key is missing (bridge already does this) and always uses `timingSafeApiKeyEqual`. Bind `/api/internal/*` to the Asterisk host (already recommended on `dialplan-bridge.controller.ts`).

**Tenant uid fallback `|| 0` on JWT-scoped controllers:**
- Issue: `packages/backend/src/modules/moh/moh.controller.ts` and `packages/backend/src/modules/prompts/prompts.controller.ts` resolve `req.user?.vpbx_user_uid || req.user?.user_uid || 0`. Prompts has **no** `@UseGuards(JwtAuthGuard)` at all (`prompts.module.ts` does not import Auth).
- Why: Pre-Phase-? habit before `JwtAuthGuard` was added to MOH to stop `user_uid 0` writes (`STATE.md`).
- Impact: Unauthenticated `/api/prompts` operates as tenant `0`. A JWT without `vpbx_user_uid` on MOH also collapses to `0`.
- Fix approach: Add `@UseGuards(JwtAuthGuard)` to `PromptsController`; throw if tenant is missing instead of defaulting to `0`.

**i18n close-out skipped, then keys landed anyway:**
- Issue: `.planning/WINDOWS.md` windows 5–6 still mark `packages/frontend/src/shared/config/locales/ru.ts` as unstaged `routes.chain` / congestion keys. The file now contains a full `chain:` block and `congestion` entries; UI still uses `t(key, fallback)` in `packages/frontend/src/features/dialplan-apps/ui/StepRow/StepRow.tsx` and registry schemas.
- Why: 12-02…12-16 close-outs skipped locales because `ru.ts`/`en.ts` were mixed with unrelated WIP (`STATE.md`).
- Impact: Ledger blocks `/gsd-ship` (`open_count: 8`) even if keys are present. Fallback-second-arg hides missing keys in other locales.
- Fix approach: Diff locales vs WINDOWS 5–6; mark windows fixed if committed; stop adding new `t(key, fallback)` once both locale files are clean.

**Functional stubs that look like production:**
- Issue: `packages/backend/src/modules/voice-robots/services/streaming-stt.service.ts` returns empty text (TODO HTTP POST). `packages/backend/src/modules/prompts/prompts.controller.ts` TODO Phase 3 SFTP download/delete — DELETE leaves audio on disk. `packages/backend/src/modules/redis/redis.module.ts` returns a null-safe Proxy when `REDIS_HOST` is unset. `packages/backend/src/modules/routes/webhook-queue.service.ts` `getStats()` always returns `null`.
- Why: Features shipped around optional infra (Redis, STT engines, Asterisk SFTP).
- Impact: Occupancy/cache/retry dashboards silently no-op; voice-robot STT never transcribes; prompt files accumulate.
- Fix approach: Fail closed or surface “unconfigured” in API/UI; implement the SFTP lifecycle or document local-disk-only; wire `StreamingSttService` to `stt_engines` or delete the stub from the provider factory.

## Known Bugs

**Live call-group ALTERs not applied (WINDOWS 7–8):**
- Symptoms: Generator/UI expect `call_groups.exten` (6+pad uid) and ring-option columns (`12-14` / `12-15`). Live MySQL may still lack them. `12-17` M6/M7 were later marked approved in `12-17-SUMMARY.md`, but WINDOWS still lists the scripts as unrun.
- Trigger: Deploy Phase 12 generator without running the two scripts twice each.
- Workaround: Human runs `packages/backend/src/modules/call-groups/migrate-call-groups-exten.ts` and `migrate-call-groups-ring-options.ts` (dry-run then write), then marks WINDOWS 7–8 fixed.
- Root cause: Unit tests mock QueryInterface; live ALTER was deferred (`STATE.md`).
- Blocked by: Human DB access. `/gsd-ship` blocked while `open_count > 0`.

**AMI event-list field names still `[ASSUMED]` (no live PBX):**
- Symptoms: Park UI may show empty `parkingSpace`; PlayDTMF may no-op; zombie poll may miss channels; parked-call list may be empty.
- Trigger: `AmiService.playDtmf` / `getActiveChannels` / `parkedCalls` and `CallCenterService.parkCall` / `getParkedCalls` in `packages/backend/src/modules/ami/ami.service.ts` and `packages/backend/src/modules/callcenter/callcenter.service.ts`. Same class of bug already shipped dead-on-arrival (ack-only) before 09-07/09-10.
- Workaround: Operators refresh; zombie flag is conservative (10 min, `callcenter-zombie.service.ts`).
- Root cause: Field names verified against `asterisk-manager` lowercasing, not a live instance. WINDOWS 1 / Phase 10 A1+A3 still open.
- Blocked by: Live Asterisk checkpoint (`10-09-SUMMARY.md`, `09-VALIDATION`).

**Personal inbound talk time overestimated:**
- Symptoms: `cc_queue_calls` talk_sec for `direct:<interface>` includes ring time.
- Trigger: Personal answer has no distinct AMI event in the current listener set (`callcenter-ami.service.ts` ≈1832).
- Workaround: Treat personal talk KPIs as upper bound until 09-VALIDATION.
- Root cause: `answerTime` falls back to `enterTime`.

**Occupancy incomplete after backend restart:**
- Symptoms: Agent occupancy/idle looks freshly zeroed after process restart even though answered/missed restore.
- Trigger: `CallCenterMetricsService.restoreToday` in `callcenter-metrics.service.ts` — comment: `idleSeconds NOT restored`.
- Workaround: Wait for a full shift after deploy.
- Root cause: Idle is process-uptime only; in-memory maps.

**CONSULT / ACW journal never produced from live AMI:**
- Symptoms: Timeline/report tests can map CONSULT/ACW (`callcenter.service.spec.ts`) but live agents stay IN_CALL/WRAPUP. `STATE.md` 09-03: journal path exists, no producer.
- Trigger: Warm transfer / ACW. `TIMED_STATUS_EVENTS` in `callcenter-ami.service.ts` includes CONSULT/ACW; nothing calls `beginTimedStatus` with those types.
- Workaround: Reports only show states that AMI already writes (PAUSE, CALL_START, WRAPUP_START, DIALING).
- Root cause: Enum + restore list shipped before a consult/ACW event mapper.

**Phase 12 final gate incomplete:**
- Symptoms: `STATE.md` stopped at 12-17 Task 2 (M4–M7); `12-17-SUMMARY.md` still open on M1/M9/M12 and M4/M5, plus full `lint` / `test:backend` / `test:frontend`.
- Trigger: Resume `/gsd-execute-phase` 12-17 without a live PBX or records_base_path read.
- Workaround: Keep generator changes off prod until M9 (`records_base_path` vs `/usr/records` in `dialplan-playback.util.ts` / `system-settings.service.ts`) is recorded.
- Root cause: Eight manual telephony gates cannot run in CI.

## Security Considerations

**`PromptsController` has no JWT guard:**
- Risk: Unauthenticated CRUD/stream on `/api/prompts` with tenant fallback `0` (`prompts.controller.ts`). Global `APP_GUARD` is only `ThrottlerGuard` (`app.module.ts`).
- Current mitigation: None on this controller. MOH was later wrapped with `JwtAuthGuard` for the same `user_uid 0` pitfall.
- Recommendations: `@UseGuards(JwtAuthGuard)` + require `vpbx_user_uid`; add a negative harness auth test (`apiRequest`/`apiFetch` split already exists per `STATE.md`).

**Default JWT secret if env missing:**
- Risk: `packages/backend/src/modules/auth/jwt.strategy.ts` uses `JWT_SECRET` default `'krasterisk-v4-secret'`. Tokens minted against the default are forgeable.
- Current mitigation: Production `.env` is expected to set a real secret (not verified here; `.env` is gitignored).
- Recommendations: Fail boot when `JWT_SECRET` is unset/default; never document the default string in new env samples.

**Internal dialplan key optional + public CDR/recordings:**
- Risk: Older `/api/internal/dialplan/*` and `/api/internal/ivr/play-phrase` accept any caller when `DIALPLAN_API_KEY` is empty. `CdrPublicController` (`packages/backend/src/modules/reports/cdr/cdr-public.controller.ts`) streams recordings with no JWT, tenant = `DEFAULT_VPBX_USER_UID` default `'0'` (other `*-public.controller.ts` files default `'1'`). Knowing a `uniqueid` is enough for that tenant’s audio.
- Current mitigation: Bridge controller 401s on missing key; deploy note to bind internals to Asterisk network. Public CDR is documented as v3 iframe compat.
- Recommendations: Fail closed on missing API key everywhere; give public recording an expiring audience token (same design as D-59 voicemail links); align `DEFAULT_VPBX_USER_UID` defaults; do not reuse `cdr-public` for voicemail.

**Phone provision dumps SIP password without auth:**
- Risk: `packages/backend/src/modules/endpoints/provision.controller.ts` `GET /api/provision/:filename` is unauthenticated. A guessed MAC returns `$password` from `ps_auths`.
- Current mitigation: 404 unless `provision_enabled` and a template exist; MAC must match `[0-9a-f]{12}`.
- Recommendations: Restrict by source IP / HTTPS client cert / short-lived provision token; never log the rendered body.

**`findByUidInternal` is global; callers must re-check tenant:**
- Risk: `packages/backend/src/modules/notifications/notifications.service.ts` decrypts credentials with `where: { uid }` only. A wrong `integration_uid` could send to another tenant’s webhook if a caller skips the check.
- Current mitigation: `callcenter-cards.service.ts` and `callcenter-report-delivery.service.ts` compare `integ.user_uid` to the schedule/card tenant and abort.
- Recommendations: Change the internal API to `findByUidInternal(uid, tenantUid)` so new callers cannot forget.

**Display token and client-only role gates:**
- Risk: Wallboard SSE uses `DisplayTokenGuard` (`callcenter/guards/display-token.guard.ts`) — opaque `?token=`, no `level`/`sub` (Pitfall 5). Frontend `RequireRole` (`packages/frontend/src/app/router/RequireRole.tsx`) only redirects; `/callcenter/agent` is unguarded so supervisors can act as operators (`router.tsx`, D-39). CORS is `origin: true` + `credentials: true` (`main.ts`).
- Current mitigation: Display token is revoked/expired in DB; supervisor mutations use `assertSupervisor` set-membership (`callcenter-rbac.util.ts`). Agent APIs still require JWT.
- Recommendations: Keep wallboard mutations JWT-only (already). Do not treat `RequireRole` as authz. Tighten CORS to known SPA origins.

**Shared / unsuffixed Asterisk objects:**
- Risk: `VoiceMail(${exten}@default,u)`, `ConfBridge(${room})` without tenant suffix, `toivr` → `Goto(ivr_{uid},start,1)` without tenant (`dialplan.util.ts`, `STATE.md` 12-03/12-13). Cross-tenant room/mailbox collision if uids or room names overlap.
- Current mitigation: Queues/groups/extensions go through `normalizeTarget` (`dialplan-target.util.ts`) as `q…_{uid}` / `group_…_{uid}` / `e…_{uid}`.
- Recommendations: Suffix ConfBridge rooms and IVR contexts the same way; replace `VoiceMail()` in 12b.

## Performance Bottlenecks

**Call-center state and KPIs are process-local:**
- Problem: `CallCenterStateService` and `CallCenterMetricsService` keep agents, calls, and SLA maps in memory (`callcenter-state.service.ts`, `callcenter-metrics.service.ts`). Restart rebuilds “today” from `cc_queue_calls` but not idle seconds. Multi-instance backend would split SSE/KPI views.
- Measurement: No p95 in repo. Restore cost is O(today’s `cc_queue_calls` + personal misses) on boot.
- Cause: Phase 7 D-03/D-06 chose in-memory accumulators + `restoreToday`.
- Improvement path: Keep a single writer instance or move live maps to Redis (today’s client is optional/`null` stub). Persist idle snapshots if occupancy must survive restarts.

**AMI event-list collection timeouts:**
- Problem: `getActiveChannels` / `parkedCalls` wait up to 5s for `*Complete` (`ami.service.ts`). Zombie poll every 45s walks all in-memory calls vs CoreShowChannels (`callcenter-zombie.service.ts`).
- Measurement: Hard 5000 ms finish timer per list action; 45s poll; 10-minute zombie grace.
- Cause: `asterisk-manager` ack-first API; collectors are Promise + `rawevent`.
- Improvement path: After live A1/A3, tune timeout; share one CoreShowChannels snapshot per poll tick; add `ami.service.spec.ts` for the collector.

**Report PDF client cap:**
- Problem: `packages/frontend/src/features/callcenter/lib/reportPdf.tsx` `REPORT_PDF_MAX_ROWS = 2000`.
- Measurement: First 2000 rows only; UI copy tells users to export CSV/XLSX.
- Cause: `@react-pdf/renderer` in the browser (07-18).
- Improvement path: Keep the cap; generate large PDFs server-side if product needs full dumps.

**Webhook CURL in the dialplan path:**
- Problem: `routes.service.ts` sets `CURLOPT` connect 3s / total 4–5s on custom and before-dial webhooks — every inbound call waits.
- Measurement: Timeouts are the documented upper bound (no production p95).
- Cause: Synchronous `CURL()` so CRM can set `DIALTO` / CallerID.
- Improvement path: Keep short timeouts; move non-blocking hooks to hangup-handler (already async for on-hangup).

## Fragile Areas

**Dialplan generator (`AsteriskDialplanUtils`):**
- Why fragile: Large switch on ActionType in `packages/backend/src/shared/utils/dialplan.util.ts` plus helpers (`dialplan-target.util.ts`, `dialplan-playback.util.ts`, `dialplan-trunk-carousel.util.ts`). Wrong emit is a live call failure, not a 4xx.
- Common failures: Raw `${EXTEN}` in Queue/Dial (fixed for toqueue via `normalizeTarget`; still correct for totrunk dest). PHP leftover on route options. Hop limit `DEFAULT_HOP_LIMIT=10`. Invalid HTTP URL → `NoOp(Invalid HTTP URL)`.
- Safe modification: Characterization tests in `dialplan.util.spec.ts` (Wave 0: 100% stmts/lines, 93.06% branch — `STATE.md`). Add a golden before changing a case arm. Do not emit `__USE_EXTEN__`.
- Test coverage: Strong unit goldens; no live Asterisk apply in CI. `DialplanApplyService` is tested (`dialplan-apply.service.spec.ts`); `AmiService` itself has no `ami.service.spec.ts`.

**AMI / ARI socket layer:**
- Why fragile: `asterisk-manager@0.2.0` via `require()` in `ami.service.ts`; event-list actions need actionid + rawevent; reconnect backoff 5s–60s then `loadInitialState`. Field names `[ASSUMED]`.
- Common failures: Collecting the ack instead of the event list (already bitten twice). Reconnect without resync. `findAgentByChannel` substring match (`callcenter-state.service.ts`) can mis-attribute if interfaces share prefixes (guard `userId > 0`).
- Safe modification: Copy the `pjsipShowRegistrations` collector pattern; never resolve on Success ack for list actions. Run A1/A3 on lab PBX before renaming fields.
- Test coverage: `callcenter-ami.service.spec.ts` feeds synthetic events (no socket). Harness `harness/scenarios/realtime/asterisk-originate.test.ts` is env-specific and deferred (WINDOWS 2–4 / A5).

**Phase 12 live apply + records path:**
- Why fragile: `cmd_apply` writes ActionLog from the static generator (`STATE.md`). Unified playback path is `/usr/records/${uid}/sounds/…` (`dialplan-playback.util.ts`) until M9 reads prod `records_base_path`.
- Common failures: Apply to the wrong Asterisk; recordings vanish if the constant is flipped without moving files (`12-17-PLAN.md` forbids file moves).
- Safe modification: Read prod path first; if it differs, change the constant to prod, do not relocate files.
- Test coverage: Units assume `/usr/records`. M9 is human-only.

**Frontend page tests that stub the feature:**
- Why fragile: Pages such as `packages/frontend/src/pages/CdrReportPage/CdrReportPage.test.tsx` mock `@/features/cdr` and only assert overflow markers. Same pattern on Settings/IVR/Prompts/VoiceRobots page tests.
- Common failures: Page “green” while the real table/editor regresses.
- Safe modification: Put behavior tests next to features (`features/dialplan-apps`, `features/callcenter`); keep page tests for shell/overflow only.
- Test coverage: Feature suites exist for dialplan-apps and callcenter; many pages are smoke-only.

## Scaling Limits

**Single-process call-center maps:**
- Current capacity: One NestJS process holds all tenant agent/call/KPI maps. `loggedMissedUniqueids` trims above 2000 (`callcenter-ami.service.ts`). Rollup uses raw `cc_queue_calls` for ≤ `RAW_MAX_DAYS` (90) then daily tables (`callcenter-rollup.service.ts`).
- Limit: Second API replica does not share live state. Memory grows with concurrent calls × tenants.
- Symptoms at limit: Split-brain SSE, missing parked/zombie flags, OOM on large tenants.
- Scaling path: Sticky sessions to one CC writer, or Redis-backed state (requires `REDIS_HOST` — currently optional).

**Dialplan hop / undo / PDF:**
- Current capacity: Hop prologue stops at 10 (`STATE.md` `DEFAULT_HOP_LIMIT`). Editor undo is a 20-step removed-stack (`STATE.md` 12-07). PDF 2000 rows.
- Limit: Deeper Gosub/Goto chains abort; long undo histories lost; large reports truncated.
- Symptoms at limit: Calls exit early; editors cannot undo; PDF footer “export CSV”.
- Scaling path: Raise hop only with Asterisk Goto testing; persist undo if needed; server-side export for >2000 rows.

**AMI reconnect / zombie grace:**
- Current capacity: One AMI TCP connection; reconnect 5s exponential to 60s; zombie grace 10 minutes; poll 45s.
- Limit: During disconnect, live CC state is stale until `loadInitialState`.
- Symptoms at limit: Ghost calls, detached queues (`queuesDetached` on `AgentState`).
- Scaling path: Live A1/A3 to set grace from real CoreShowChannels lag; consider ARI as a second source (`ari-client@2.2.0` already in `package.json`).

## Dependencies at Risk

**`asterisk-manager@0.2.0` + `@types/asterisk-manager@0.0.1`:**
- Risk: Tiny type package; event-list API caused two production-class bugs (CoreShowChannels, ParkedCalls). Unmaintained relative to current Asterisk.
- Impact: Park/zombie/DTMF/channel inventory wrong or empty.
- Migration plan: After live field-name capture, wrap AMI in a typed client or switch hot paths to ARI (`ari-client@^2.2.0` already used). Keep collector tests so a swap cannot regress ack-vs-list.

**`uuid@^3.4.0` and `ws@^6.2.3` (backend `package.json`):**
- Risk: uuid v3 is deprecated; ws v6 is far behind current v8.
- Impact: Known CVE surface on old `ws`; uuid v3 API differs from v9+.
- Migration plan: Upgrade `ws` with a smoke on AMI/WebSocket gateways; replace `uuid` v3 with Node `crypto.randomUUID()` or uuid v9.

**`sip.js@0.21.2` exact pin + `exceljs@^4.4.0`:**
- Risk: Intentionally pinned after supply-chain review (`STATE.md` Phase 7). Drift or a careless `^` bump reopens that review.
- Impact: Softphone REFER/getStats (`useWebRTCPhone.ts`) or XLSX export break.
- Migration plan: Keep exact pin; re-run the supply-chain notes before any bump.

**Gitignored Sequelize migrations vs `db:migrate`:**
- Risk: `npm run db:migrate` points at a directory that is not in git. Deploy images may lack the runner that production expects.
- Impact: Operators cannot replay schema; ad-hoc `migrate-*.ts` become the only path (and two of those are still unrun).
- Migration plan: Commit the runner + versioned SQL/TS migrations, or document that all schema changes are the module-local scripts and delete `db:migrate`.

## Missing Critical Features

**Phase 8 Android FCM + foreground WebRTC smoke (NAV-13):**
- Problem: `08-11-SUMMARY.md` status `partial`; Task 3 human-verify blocked. `08-USER-SETUP.md` still Incomplete. `google-services.json` is gitignored; without it Gradle skips the Google Services plugin (`packages/frontend/android/app/build.gradle`).
- Current workaround: Web push/register is a no-op; Android builds assemble without FCM.
- Blocks: Phase 8 UAT, production push, any claim that Capacitor softphone works on device. Android Telecom / ConnectionService is explicitly deferred (`packages/frontend/docs/ANDROID_WEBRTC_NOTES.md`).
- Implementation complexity: Ops (Firebase file + device) plus later Telecom workstream — not more Nest/React code for Task 3.

**Phase 12b custom voicemail (D-54…D-59):**
- Problem: Native `VoiceMail()` has no MWI/provisioning; `Record()` without `k` drops messages on hangup (`12-CONTEXT.md`).
- Current workaround: Existing `voicemail` ActionType → `@default`.
- Blocks: Tenant-safe mailbox, STT/summary on messages, secure listen links.
- Implementation complexity: High — new module, dialplan, CDR tab, token audience (VALIDATION rows still pending).

**Remote mute (DEF-07-MUTE-AMI):**
- Problem: Softphone mute is local only (`CallCenterAgentPage.tsx`, `useSipPhoneAmi.ts`). No `MuteAudio` helper in `AmiService`.
- Current workaround: Browser-side mute; far end may still hear depending on path.
- Blocks: Supervisor-visible mute / recording of muted legs.
- Implementation complexity: Medium — AMI action + live verify (same A1 gate).

**Queue self-service join/leave and multi-call UI:**
- Problem: `STATE.md` 09-08: queue self-service omitted (no endpoint). Phase 10 D-28: multi-line hold/switch out of scope (`10-CONTEXT.md`).
- Current workaround: Login/rejoin-queues only (`callcenter.controller.ts` `agent/rejoin-queues`). One active SIP session.
- Blocks: Agents adding queues mid-shift; hold A / answer B.
- Implementation complexity: Medium (API + AMI QueueAdd/Remove); multi-call is a larger softphone rewrite.

**Reports landing page:**
- Problem: `packages/frontend/src/app/router/router.tsx` `path: 'reports'` is `PlaceholderPage`.
- Current workaround: Users open `/reports/cdr` and `/reports/voice-robot-cdr` directly.
- Blocks: Hub-level “Reports” as a real IA node.
- Implementation complexity: Low — index of existing report routes.

**Verify/UAT still open on earlier phases:**
- Problem: `STATE.md` — Phase 1–7/9/10/11 verify or re-UAT still listed; WINDOWS 2–4 harness live API on `:5010` never run during 11-03.
- Current workaround: Unit/Vitest only.
- Blocks: `/gsd-ship`, confidence that AMI/auth/MOH harness tags pass against a real backend.
- Implementation complexity: Environment (backend up + optional Testcontainers `USE_TESTCONTAINERS=1`).

## Test Coverage Gaps

**`AmiService` socket helpers:**
- What's not tested: No `packages/backend/src/modules/ami/ami.service.spec.ts`. PlayDTMF, CoreShowChannels collector, ParkedCalls collector, reconnect/`loadInitialState` are untested at the AMI wrapper.
- Risk: Third ack-vs-list regression (already happened twice).
- Priority: High
- Difficulty to test: Need a fake `asterisk-manager` that emits `rawevent` with actionid — same pattern as existing CC AMI unit tests.

**Harness live tags (auth/moh/health/originate):**
- What's not tested: `harness/scenarios/api/health-smoke.test.ts`, `auth.test.ts`, `moh-crud.test.ts` against a running `:5010`; realtime originate is `ASSUMED A5`.
- Risk: JWT/MOH regressions that unit tests with mocked guards miss (especially `PromptsController`).
- Priority: High
- Difficulty to test: Requires backend + DB; `USE_TESTCONTAINERS=1` or GHA `DB_*`.

**Jest/Vitest have no coverage gates:**
- What's not tested: `packages/backend/package.json` `collectCoverageFrom` has no `coverageThreshold`. Frontend `test:cov` is opt-in. Dialplan goldens are strong; many pages are stub smokes.
- Risk: New modules ship with 0% coverage (AMI, prompts authz, provision).
- Priority: Medium
- Difficulty to test: Add thresholds incrementally on `shared/utils/dialplan*.ts` and `modules/callcenter`.

**Android device / FCM / Telecom:**
- What's not tested: NAV-13 device smoke; background WebRTC (explicitly out of scope). Unit tests: `device-token.controller.spec.ts`, `push.test.ts` only.
- Risk: Production Android login never registers a token; mic/audio fails only on device.
- Priority: High for Phase 8 close; Telecom is later.
- Difficulty to test: Needs `google-services.json` and a device/emulator (human Task 3).

**Voicemail 12b VALIDATION rows:**
- What's not tested: `12-VALIDATION.md` D-55 `Record()`+`k`, D-58 path traversal, D-59 audience token — all pending, no `modules/voicemail/*.spec.ts`.
- Risk: Building 12b without the listed tests repeats the PHP/recording-loss pitfalls.
- Priority: High when 12b starts; skip until then.
- Difficulty to test: Unit + one live SIP hangup-during-record (M2).

---

*Concerns audit: 2026-08-28*
*Update as issues are fixed or new ones discovered*
