# Autodial UX audit — execution

Coordinator: `/root`, this Codex chat. Mode: `codex-direct`. Status: implementation/isolated acceptance complete; deployment assignment active.
User assignment 2026-10-16: implement REPORT completely, including live checks and call runs.
Canonical plan: [REPORT.md](REPORT.md), §6, revision r1 with the clarifications below.
Baseline: main / 0ebd6ba9a1d3ad0458cabbd6e6bc270f705f9294. Existing foreign dirty changes are preserved.
Workers: coordinator only; no delegated agents.

## Scope and ownership

Owned: autodial backend/features/pages/API/shared autodial contracts, backend autodial skills,
autodial audit artifacts. Shared AI infrastructure, router, locales, migration manifest and
shared exports require bounded, backwards-compatible integration with existing dirty baseline.
Do not modify adjacent callcenter/helpdesk work or historical GSD STATE/ROADMAP.
Previous autodial-refactor execution is implementation-closed/idle; its invariants remain.

## Plan clarifications r1

- E1: CURL already contains a second `same => n,`; split generated text into individual
  category entries before AMI serialization. Test individual AMI Append values, not joined text.
- R2: daily series needs current-day attempt aggregation independently of callback repair.
- B5/C4: existing field-reference/base-running guards remain; improve UI and mode guard.
- R5: current shared CSV exporter already includes BOM; verify rather than duplicate.
- E7: TTS field interpolation exists; retain it and extend presentation/typed speech.
- Reports use an explicit reporting timezone, half-open day boundaries, distinct contacts
  for list penetration; technical answers and business outcomes remain separate.
- Ingestion dedup follows the base policy; active normalized-number exclusion is tenant scoped.
  Preserve duplicates when policy allows them, but never dial them concurrently.
- Imported optional invalid fields are omitted only by explicit policy, with row/column warnings.
- Base reuse remains supported; schema changes require revision checks and usage preview.
- Preflight distinguishes blocking configuration defects from scheduled waiting and checks
  registration only for trunks configured to register. Revalidate on execution.
- New integrations cannot apply proposals with API credentials; existing JWT confirmation
  semantics must also be audited, not assumed to prove a human click.

## Assignments and gates

| ID | REPORT phase | State | Checks |
|---|---|---|---|
| U0 | 0: dialplan/DNC/import/dedup/metrics | implemented; live-verified | 9 actual dispositions/TTS/DTMF + DNC/retry/canonical concurrency, durable counts, MySQL and PG PASS |
| UA1 | AI-1: shared contract/diagnosis/preflight | implemented; real-model gate pending | common contract/diagnosis/preflight, tenant/role guards; source evals PASS, LLM15 auth unavailable |
| U1 | 1: campaign workspace/tours | implemented; browser/live verified | six tabs, task actions, tours/progress, actor+thread journal, desktop/390 browser and actual retry/DNC PASS |
| U2 | 2: wizard/preflight/test call | implemented; browser/live verified | wizard/guard/checklist, actual internal playback and TTS calls, no campaign tasks/attempts, cleanup PASS |
| U6 | 6: schema/import editor | implemented; browser/MySQL/PG verified | migration preview/hash/revision/archive/reference rewrite, validation-only imports/rejected XLSX/templates, AI proposal parity |
| UA2 | AI-2: configure/context/privacy | implemented; real-model gate pending | masked tools, page context, plan refs, human-click actions, confirmation cards, 12 scripted autodial cases PASS |
| U3 | 3: speech/scenario outcomes | implemented; live-verified with custom TTS | actual Russian speech/preview/DTMF business outcome PASS; configured global64 credential gate pending |
| U4 | 4: live monitor | implemented; browser/live verified | health/trend/ETA/alerts/feed/call lanes/390px; actual AMI steps + three operator modes PASS |
| U5 | 5: reports | implemented; browser/MySQL/PG verified | dimensions/heatmap/drilldown/recordings/exports/selection→base→draft; no automatic launch |
| U7 | 7: CRM integration | implemented; MySQL and live HTTPS verified | scoped keys/atomic upsert/idempotency/jobs/DNC PASS; OpenAPI + usage docs; actual HMAC503→204 retry after31sec by replacement worker PASS |
| UA3 | AI-3: external MCP | implemented; automated/browser verified | annotations/resources/prompts/scopes/session isolation, HTTP password-proof positive+negative PASS, incoming UI error persistence fixed |
| UA4 | AI-4: evaluation | implemented; real-model gate pending | 28 reference cases total, 12 autodial; scripted model + real tool contracts/workflow checks, not live model quality |

Each phase also requires service/UI/tool/skill/eval parity. Mandatory final checks:
`npm run lint`, `npm run test:backend`, `npm run test:frontend`; database portability
checks for schema changes. Unit/mock, actual browser, live Asterisk and release evidence
are recorded separately. No gate passes from historical evidence alone.

## Live boundary

Authorized isolated calls use synthetic contacts, dedicated loopback trunk/contexts/campaigns
and test operators only. Never start campaign uid 1 or dial customer/external numbers.
Inspect existing fixture and runtime before restoring it; capture and clean up only test resources.
Do not print token.txt, environment secrets or SSH private keys. No production release is implied.

## Next action

Current slice: implementation/final regression/live calls/webhook/browser cleanup finished; configured-model acceptance pending.
Actual LLM15 and configured TTS64 credentials remain unavailable under the current keyring; user input on current configuration
is pending. No historical-key probing is authorized. Canonical scope remains all REPORT tasks.

Historical U1 checkpoint (superseded by later checkpoints below):
Backend targeted U1: 30 suites/281 tests PASS, 16 opt-in DB tests skipped. Actual MySQL 16/16 PASS.
Frontend targeted U1: 19 files/98 tests PASS; UA1 shared editor: 21 files/128 tests PASS.
Production backend/frontend typecheck PASS before latest route guard; scoped eslint 0 errors.
Browser UAT uses actual frontend/services + disposable MySQL, disconnected PBX dependencies; it is not a full
production-app or call-run check. Verified clients/outcome filter, preflight blocks disconnected ARI/AMI,
save+revision+append-only journal, dirty navigation cancellation retains input, 390px contained table overflow.
Live browser exposed host-TZ serialization in Sequelize raw Date replacements; explicit database-TZ strings
now used for diagnosis, preflight, campaign journal and report bounds. Real MySQL future-retry assertion passes.
Migration 0040 reserved by this coordinator (additive tours/events; MySQL+PG); not applied to production.
Docker on local host is stopped. PostgreSQL 17 migration 0040 runtime PASS in a disposable remote container,
removed after verification (pg-u1-result.log); migrations 0041–0043 PG runtime pending. No external blocker prevents other work.
Temporary UI harness: .planning/autodial-ux-audit/ui-server.cjs, port15016 and Vite3016. Cleanup endpoint
POST http://127.0.0.1:15016/api/uat/cleanup removes only own random krsk_ac_ui_* schema. Keep while UI work runs,
clean before final completion. Current process IDs/sessions are tool-owned; never kill generic node processes.

## Checkpoint 2026-10-16 23:05 +07

- Source changes include shared strict field/mode/pacing/disposition schemas, provider-catalog preflight,
  raw SQL timezone serialization fix and canonical cross-base phone mutex.
- Migrations 0040 tours/events, 0041 internal test calls, 0042 canonical phones, 0043 field archive/format
  registered for full-PBX MySQL and PostgreSQL. None applied to production.
- Targeted backend: 35 suites / 324 tests PASS, 21 opt-in skipped (u6-tests.log) before latest dry-run integration test.
- Import UI + base draft: 2 files / 20 tests PASS before latest column-field/template additions.
- Prior real MySQL U6: 20/21 PASS; canonical fixture campaign-name collision corrected, rerun in progress.
- Schema conversion/archive/reference rewrite and atomic rollback already passed real MySQL.
- Preview/audio service and scenario preview UI implemented; actual TTS audio and internal test-call live gates pending.
- Final global lint/backend/frontend and all later REPORT phases remain required. No release performed.
- Live U0 evidence remains 8 loopback outcomes; it does not verify later features.
- UI server15016 currently holds older loaded source; restart with updated schema/routes before U6 browser checks.

## Checkpoint 2026-10-16 23:46 +07

- U6 actual MySQL **22/22 PASS** (u6-mysql.log); dry-run/rejected XLSX changes neither contacts/phones/revision nor import history.
- Browser U6 PASS: invalid name→money conversion blocks Apply, valid AC_NAME→AC_CUSTOMER_NAME migration persists,
  create city field from CSV column, validate 2 rows→1 valid/1 rejected without writes, commit 1 contact,
  table shows 2 customers and imported city. ui-fixture.json owns current random schema krsk_ac_ui_d2e769cf8b93388b.
- Current UI backend session47807, Vite69354. Backend loaded before UA2/U3 changes. Restart only via cleanup endpoint.
- U1 campaign REST+AI mutations now record actor_uid; journal shows actor. AI thread attribution remains pending.
- Added migration0044 ac_ai_settings (tenant privacy opt-in), not applied to production. PG0041–44 runtime pending.
- New AutodialAiDataTools adds client/base/profile/report/preview/test-call/UI-action tools via existing gated adapter.
  Phone/default field masking happens before read results reach model. Tenant opt-in controlled by admin REST/UI.
- Page context is strict/bounded, tenant-checked through read tools; classifier sees autodial context even for terse follow-ups.
- Workflow compiler supports earlier create_autodial_base reference in create_autodial_campaign, validates planned fields
  before card and resolves actual UID at execution. No start tool added.
- Shared timeline action opens internal campaign/preflight/import only by click. Final launch still a human UI button.
- U3 speech uses generated _SAY_MONEY/DATE/NUMBER/DIGITS variables inside ordinary TTS actions; preview and calls share formatter.
  collect_input.outcomeMap persists separate scenario_result.business_outcome. Current technical disposition remains separate.
- Backend last checkpoint **41 suites/397 tests PASS**, 22 opt-in skipped (u3-tests.log), before latest action/AMD additions.
- Latest edit serializes finalize/AMD task writes and repairs delayed AMD callback; new real MySQL race test not run yet.
- Frontend production typecheck found missing condition on generated TTS action, corrected. Rerun pending.
- Large combined Vitest run stalled at discovery; stopped own session12930, retrying smaller explicit batches.
- Next: finish regression for latest changes, actual MySQL + PG migrations, AI tool labels/skills/evals/parity;
  then U4 monitor, U5 reports, U7 CRM/UA3 MCP and final full checks/live calls. Original entire REPORT remains assigned.

## Checkpoint 2026-10-17 00:12 +07

- Latest source MySQL **23/23 PASS** (u3-mysql.log), including serialized late AMD correction versus ARI finalize.
- Backend targeted **45 suites/368 PASS**, 24 opt-in skipped before latest analytics golden test (u5-tests.log).
- Frontend smaller explicit batches PASS: AI chat3 files/31 tests, autodial4 files/19 tests. Full combined discovery hung;
  use explicit small batches with --pool=forks --maxWorkers=1. Latest production typechecks empty/PASS at checkpoint.
- U4: AutodialMonitorService/controller, 5s coalesced cache, max50 campaigns, zero-filled15min trends, per-campaign queue agents,
  alerts, SSE health frames every10sec, AMI UserEvent(AutodialStep) tracking, customer display names and UI session feed.
- U5: AutodialAnalyticsService/controller groups by attempt/hour/weekday×hour/field/trunk cause/operator/business/technical outcome.
  UTC15min buckets remap with Intl to tenant timezone incl DST/quarter-hour zones; scoped drilldown bounded10000 rows.
  New ReportBreakdown UI, configurable columns and authenticated recording fetch. XLSX dates are typed tenant civil times;
  metadata/period/timezone/data SHA included, no digital certificate/signature is claimed.
- Base contact search now includes phone/JSON values, keeping bounded SQL IDs + hydrate.
- AI journal now receives authenticated actor and thread through proposal/workflow execution; UI opens the thread.
- Live U3 attempt1 and engine attempt2 each confirmed all8 actual loopback dispositions including DTMF business_outcome=confirmed.
  Both overall runs failed later; do not call full U3 gate passed. Protected configuration hashes and production campaign states
  preserved, temporary schemas/audio/configs/internal endpoint cleaned (live-u3-result.json, live-u3-engine-result.json).
- Source internal test call actually answered/played/ended/cleaned with no campaign tasks/attempts. Last harness run initially
  failed only because it expected a campaign daily row for this intentionally excluded call; corrected and final repeat running
  (session10739, live-u2-internal.log). Earlier input failure exposed real legacy campaign revision0 validation bug, now fixed
  in test-call schema, AI schemas and REST UpdateCampaignDto.
- TTS gate: actual global Yandex64 credentials cannot decrypt with current local keyring. Preflight now detects this before launch
  with AC_TTS_CREDENTIAL_UNAVAILABLE. No cipher, provider ciphertext or persistent env configuration changed.
- AUTO-REVIEW REJECTED a read-only historical Git legacy-key/decryption probe as credential probing outside blanket test permission.
  Explicit approval requested via async user question; **no answer yet**, date/environment message is not approval.
  Do NOT bypass this rejection or run a historical-key probe through any indirect harness. Unaffected work continues.
- live-u3.cjs supports AUTODIAL_LIVE_SKIP_TTS=1 and AUTODIAL_LIVE_ONLY_INTERNAL=1; these never decrypt TTS credentials.
  Only PJSIP00991...@dedicatedloopback or own e00991501_991016 allowed; endpoint/aor temporary exact-ID rows cleaned.
- Source TTS bridge found to publish only private cache while Playback reads tenant sounds. DialplanBridgeService now also
  publishes WAV via PromptsService.savePromptAudio; shared/module integration tests PASS, actual TTS audio remains pending.
- New analytics golden MySQL run in progress (session21301, u5-mysql.log). Final global checks and migrations0041–44 PG still pending.
- Current UI server47807 still runs pre-UA2/U3/U4/U5 source. Restart/extend routes before browser checks of these features.
- Required next: finish current regression/live cleanup, analytics selections to base/redial, U7 scoped API/bulk/jobs/webhooks and UA3
  MCP annotations/resources/prompts/interactive confirmation, UA4 reference evals, remaining live DNC/retry/restart/concurrency/operator,
  migration portability, final lint/backend/frontend. Entire REPORT remains assigned; not complete or released.

## Checkpoint 2026-10-17 00:38 +07

- U5 report selection→base implemented with preview hash/revision/tenant checks, ≤5000 unique contacts, transactional copy,
  new field/contact/phone identities and conservative copy of source base/campaign DNC. UI can create a redial draft on the new
  base, reuses the created base if draft creation fails, never launches automatically. Actual MySQL26/26 PASS before U7 changes.
- U7 source implemented: separate scoped autodial credentials shared by CRM+MCP (ac_integration_keys; immutable scope list,
  SHA256 only, one-time token, expiry≤year, fresh issuer admin role+module checks, persisted60/min limit, revocation).
  Existing integration-credentials module belongs to another initiative; its tables/protocol were not changed.
- New CRM /autodial/api/v1: strict atomic upsert≤100 by external_id, durable idempotency results, CSV/XLSX append-only jobs
  (≤4MB, max10pending/key), bounded results by external_id, DNC bulk≤100. Import and job success commit together; replacement
  worker picks persistent pending rows. No integration endpoint launches calls or replaces/deletes bases.
- Webhook source: minimal attempt-completed outbox in same attempt transaction, late scenario/AMD updates emit distinct version;
  HMAC timestamp/body, encrypted secret returned once, persistent retries8, revocation/module checks, HTTPS443/publicIPv4 only,
  DNS pinning/no redirects. Delivery not yet live-verified. MySQL test queues then cancels own hook, no HTTP delivery.
- Actual MySQL27/27 PASS (u7-mysql.log), including CRM replay/upsert/import replacement-worker/DNC/outbox/revocation.
  Subsequent command-scope revalidation, late-callback lock and pending-job cap require another targeted rerun.
- UA3 MCP source: annotations, static contract/skills resources + tenant-checked campaign/base templates, three prompts;
  key scopes filter discovery and execution, key sessions bound to credential identity, 1h expiry/10000 session cap.
  propose_plan permitted only when every step is a registered autodial mutation and key has proposals:write.
- Autodial proposal/workflow HTTP apply now requires signed HttpOnly SameSiteStrict browser proof issued after password login,
  bound to exact access token and user/tenant; refresh alone cannot mint it. Other module apply semantics unchanged.
  Existing browser sessions must log in again. Impersonated sessions cannot mint this proof. No claim of physical-human proof.
- Admin API-key management added to workspace settings; PII settings remain separate. Browser verification of latest UI pending.
- Targeted backend50 suites/420 PASS (u7-tests.log), then registry/MCP/attempt4 suites17 PASS (u7-regression.log).
- Full npm run lint PASS (backend126warnings/frontend104warnings). Full backend run still active session34378; it exposed
  registered-capabilities fixture missing new dataTools dependency. Fixture corrected using actual tool factory; scoped test PASS.
  Full frontend active session36088 (424files in chunks40). Latest production typechecks empty/PASS before final small edits.
- PG0040–46 runtime launched in own disposable network-none container (session87720, pg-runtime.log), result pending.
- Current UI backend47807 + Vite69354 still hold earlier fixture/source; restart using ONLY own cleanup endpoint before new UAT.
- Live internal test FINAL PASS (live-u2-internal-result.json), all cleanup/protected-state checks true. TTS block remains exactly
  as previous checkpoint: no explicit user answer, historical-key probe rejected and MUST NOT be bypassed.
- Next: consume full-check results, add CRM/MCP/webhook/frontend negative tests, PG migration evidence, extend/restart UI harness,
  desktop+390 browser checks, remaining UA4 evals and actual DNC/retry/restart/concurrency/operator calls. Entire plan incomplete.

## Checkpoint 2026-10-17 01:04 +07

- Sole coordinator /root, codex-direct, same REPORT and baseline; no delegated writers. User explicitly assigned root@ipbx.krasterisk.ru.
- Full backend rerun PASS: 453 suites/4362 tests, 27 opt-in skipped (final-backend-r2.log). Later UA4/data-tool/network edits need targeted verification.
- Full frontend running session30239, 424 files in chunks5, latest68/85; newly added incoming3 tests passed separately.
- PG17 runtime migrations0040–46 PASS in disposable network-none container, removed (pg-runtime.log). No production migrations applied.
- Actual source + MySQL + Asterisk TTS run PASS: all9 outcomes, DTMF/business outcome, actual Russian SAPI custom HTTP provider,
  preview audio equals runtime text; internal user test call answered/ended/cleaned without campaign tasks/attempts.
  live-u3-custom-tts-result.json: errors[], all cleanup checks true. Global64 credentials were never accessed in this alternative.
- Operational actual loopback run PASS: DNC causes zero originate/attempt; two busy retries respect interval/max; new event handler/state
  continues an already answered call from persisted data; two simultaneous same-number requests produce exactly one call.
  live-operations-result.json: all cleanup checks true. Handler replacement is not an OS process restart.
- Browser desktop/390 PASS for monitor health, database KPIs/contact-rate50%, waiting reason/ETA/feed and contained horizontal scroll;
  reports attempt drilldown and heatmap; selection→new base→redial draft opens preflight, no automatic launch; privacy/key UI visible.
- UI backend session75223 port15016 (isolated schema); Vite69354 port3016. Cleanup only POST /api/uat/cleanup when browser checks finish.
- Incoming proposal UI and relogin error handling added; UA4 8 new reference cases (24 total) pass actual tool/contract/workflow checks
  using scripted model and service fixtures, 22 eval tests PASS. These are not evidence of real model quality.
- Actual configured LLM15 attempt failed provider_auth_unavailable (live-ai-provider-result.json). Global TTS64 also cannot decrypt.
  Async current-config/provider question pending; historical-key probing remains rejected/unapproved, must not bypass.
- Remaining: operator queue/pacer actual calls; webhook network/retry/signature and MCP catalog negatives; final updated regression,
  API/OpenAPI examples, full report coverage review and honest pending external gates. Entire plan remains in_progress, not released.

## Checkpoint / handoff 2026-10-17 01:29 +07

Authoritative current result: [VERIFICATION.md](VERIFICATION.md). All earlier pending operator/webhook/regression/UI-cleanup
items in historical checkpoints are superseded by the following evidence. No new coordinator or agents.

- Full final backend PASS:456 suites/4397 tests,27 DB opt-in skipped; actual MySQL27/27 PASS separately.
  Full frontend PASS:424files/85batches/2332tests; latest card regression2files26PASS. Full lint0errors (126+104warnings).
  Production backend/frontend typechecks empty/PASS. Migration runner20PASS; PG17 runtime0040–46PASS, container removed.
- Source now35 autodial tools, including schema preview/migration, report selection/copy, contact-task action and bulkDNC.
  Twelve autodial reference cases (28total) use real contracts/adapters/compiler with scripted model. Latest parity35testsPASS;
  final review regression5suites15PASS covers tenant0 interactive proof and new mutation metadata. No model-quality claim.
- Actual internal HTTP password-login→cookie→apply→refresh PASS; bearer alone/wrong token/cross-site/refresh-without-cookie denied.
  Tenant0 remains supported. Browser found and verified fix for pending refresh erasing an apply error.
- Operator live FINAL PASS (live-operators-result.json): progressive/power/predictive each success8s with actual Local agent interface,
  zero originate while PAUSED, one when READY. Existing campaign states/protected dialplan hashes unchanged. All own resources removed.
- HTTPS webhook FINAL PASS (live-webhook-result.json): public TLS443/DNS pinning, actual PHP HMAC receiver,503→durable retry→204
  after31real seconds with replacement worker; stable eventUUID/bodyhash/signature. Own receiver/state/schema removed.
- Actual custom Russian TTS9outcomes/internalcall and DNC/retry/concurrency/replacement-handler gates remain PASS.
  Configured TTS64 credentials remain unavailable; SAPI custom-provider alternative did not access them.
- Browser final desktop/390 call lanes and incoming cards PASS. Viewport reset; own tab closed; own Vite69354 stopped;
  UAT55480 exited after POSTcleanup and confirmed own schema removed. No active fixture server should remain.
- API guide .docs/AUTODIAL_CRM_API.md and metadata-generated12path OpenAPI JSON added. No application release/production migration.
- **Only required external acceptance pending:** actual configured LLM15 returns provider_auth_unavailable, TTS64 cannot decrypt;
  localhost Ollama11434 on assigned stand is absent. Async request for current backend configuration path or working provider UID
  unanswered. Historical Git key probe was auto-review rejected and remains unapproved; never execute it indirectly.
- Exact next action after user supplies current authorized configuration: resolve normal provider loading (no historical probing),
  rerun live-ai-provider.cjs, then run the requested eight reference scenarios with a real model against isolated domain storage,
  record model outputs/tool sequence/no unconfirmed writes, rerun configured TTS64 preview/internal call if restored, update acceptance.
  Preserve baseline/foreign changes; do not rerun completed broad checks unless new source changes justify it.

Boundaries explicitly recorded in VERIFICATION: no HTTP/general-condition scenario actions are advertised; XLSX provenance SHA is
not a certificate signature; handler replacement is not OS restart; browser fixture is not a deployed full-app acceptance test.

## Checkpoint 2026-10-17 02:53 +07 — real-model gate corrected

- Same coordinator `/root`, codex-direct, REPORT §6/r1, same dirty baseline. No delegated writers or adjacent scope changes.
- Prior LLM15 diagnosis is superseded: the harness passed an inadmissible global row without tenantUid. Current normal tenant0
  selection returns LLM68/deepseek-flash; corrected probe PASS. No provider/key/config changes and no historical-secret access.
- All eight original scenarios PASS in one real-model run (30 requests): `live-ai-evals-result.json`, `live-ai-evals-r4.log`.
  Source classifier/context/skills/loop/adapter/contracts/compiler, synthetic domain storage, zero unconfirmed writes.
  Model output is recorded without private reasoning. Twelve scripted autodial reference cases remain regression coverage.
- Real-model-found fixes: thinking token budget, private reasoning continuation for DeepSeek tool calls, deterministic autodial
  routing rather than unrelated IVR setup, reporting timezone/local next-attempt time, text confirmation cannot apply autodial cards.
- Full final backend PASS456 suites/4403 tests,27 opt-in skipped; full lint PASS0errors (126+104warnings).
  `final-backend-r6.log`, `final-lint-r4.log`; production typecheck PASS `final-live-ai-typecheck.log`.
  Latest fixture-only followup PASS2suites40tests `final-live-fixture.log`. Earlier frontend2332/MySQL27/PG/migration gates unchanged.
- Final model-plan→actual source creation→preflight→internal TTS call is running, session1383/log `live-ai-plan-r3.log`.
  Attempt1 failed long WAV stdin delivery (SCP replaces it); attempt2 failed a harness response-shape assertion (controller returns
  filename). Both are retained as failing evidence, own cleanup completed; neither is accepted as passing.
- Next action: consume session1383, require pass/errors[]/allcleanuptrue, update VERIFICATION and central registry only after result.
  Configured Yandex64 remains a preexisting current-keyring limitation; custom HTTP/SAPI proves speech functionality, not its auth.

## Final acceptance 2026-10-17 02:54 +07

- Session1383 exited0. `live-ai-plan-result.json`: pass=true, errors[], six cleanup checks true, production campaign states equal
  before/after. Actual model-generated collection plan→source base/campaign creation→preflight ready→internal-user TTS call PASS.
  Preview/runtime text identical with Russian money declension; WAV133148bytes, bridge playback filename nonempty.
  Trunk/provider fixture bindings are explicit; no campaign tasks/attempts or unconfirmed real-domain writes.
- U0–U7/UA1–UA4 implementation and assigned automated/browser/isolated telephony/real-model acceptance complete.
  Authoritative evidence/boundaries: VERIFICATION.md. Backend4403/frontend2332/lint0errors/MySQL27/PG runtime/real-model8 PASS.
- Own listener/tunnel/schema/config/audio/endpoint removed. No fixture server/writer remains; no production migration/deployment,
  no commit/reset/stash of the foreign dirty baseline. Single coordinator remains /root; no handoff to another workflow.
- Next action: no implementation gate remains in this assignment. Any release or repair of preexisting Yandex64 configuration is
  separate work; do not resurrect the superseded invalid-global-provider credentials blocker or historical key probe.

## Deployment assignment 2026-10-18

User explicitly authorizes versioned commit/push to GitHub, deployment to ipbx.krasterisk.ru and actual deployed UI AI campaign
creation→apply→preflight→internal customer-data TTS call. Sole coordinator remains /root, codex-direct; current plan [RELEASE](RELEASE.md).
Baseline now main5da23135, source autodial already included by230acec8; unrelated dirty robot/CDR/marketplace/callcenter changes excluded.
User separately authorized a disposable test account and internal loopback endpoint. No permission to publish neighboring0048 yet;
async confirmation pending because the stand already applied it and strict readiness requires the matching catalog.

Release commits96519d1f (4.7.1.1/basepath/docs), b5617622 (loopback bind setting), f3fb621f (Linux bundle workflow) published to main.
Source isolation C:/Users/Professional/Documents/Codex/autodial-release-4.7.1.1; no reset/stash/foreign commit.
96519d1f quality/harness/E2E/real MySQL+PG CI PASS. Local lint PASS126+104warnings; backend456suites4406tests PASS27skips;
shared/backend/frontend build PASS, backend bind rebuild PASS; version3testsPASS. SQL candidate0048 runner57PASS.
Local frontend duplicate intentionally stopped during batch36 after the full frontend gate passed in CI; never report it as full local PASS.
No frontend source changed from96519d1f throughf3fb621f. CI/latest bundle still pending.

Host legacy PHP root and stopped v4 checkout preserved; new app planned under /v4/. Private backup verified at
/var/backups/krasterisk-autodial-4.7.1.1 (DB gzip SHA5de3af9e…, configs/old app,600/700). No production DDL requested: current48
already applied, checksum73111adbf0adb82ff464ec2c065373064f2ad3ea3e5c83689260c06d91424fb3. Current key/config copied privately;
no historical-key access. Own remote npm installer PID3733587 killed after memory/swap pressure; use CI Linux bundle instead.
Bundle workflow39093437092 builds f3fb621f. No backend activation/nginx switch has occurred.

Disposable principal367 (login uxa_release_20261018), endpoint e00991418_0, provider69 (custom HTTP/SAPI) created by source services.
Private credentials/tracking at Documents/Codex/autodial-release-4.7.1.1-private.json; never publish. Own dialplan file
uxa-release-20261018.conf adds only00991418 to existing loopback context, records own call; no call originated yet.
Local TTS session37741 and SSH reverse tunnel22361 at127.0.0.1:15012 remain active for acceptance; cleanup required after test.
Next: receive explicit0048 decision; consume bundle/CI; publish only approved dependency, strict readiness and activate prepared
release-activate.py against exact SHA/artifact; actual browser password login/AI card apply/preflight/test call; cleanup and acceptance.

### Prepared-package handoff

Current release source a4d593bd, version4.7.1.1, pushed/verified. Corrected Linux bundle39093685895 PASS, artifact12123463561,
local Documents/Codex/autodial-linux-a4d593bd/krasterisk-linux.tgz and remote /var/lib/krasterisk-v4/bundle-12123463561/krasterisk-linux.tgz.
Both ZIP/tar digests checked on both machines (full values in RELEASE). First bundle failure superseded, no application defect.
Aborted installer/own partial stage removed. Do not reuse old staging; unpack verified final bundle into fresh staging when authorized.
96519d1f full CI shared180/backend4406/frontend425files2339 PASS. Latest a4 quality still pending; latest harness/E2E/bundle PASS.
Foreign0048 remains uncommitted/unpublished pending explicit answer; runtime requires it because DB is already48. Candidate SQL
copies in the private clean export are inspection/test preparation only, not an approved release. Other AI Robots changes excluded.
No deployed-app test call, application activation or nginx switch yet. Test principal367/provider69/endpoint/own loopback file and
TTS session37741/tunnel22361 are prepared, not cleaned; remove after acceptance or cancellation. Credentials remain in private
tracking file; do not output them. Preserve all existing dirty work. No independent reviewer, agent or production DDL added.
