# REPORT implementation — acceptance evidence

Checkpoint: 2026-10-17 02:54 Asia/Krasnoyarsk. Coordinator `/root`, mode `codex-direct`.
Canonical scope: [REPORT §6](REPORT.md), U0–U7 and UA1–UA4. Source baseline and ownership: [EXECUTION](EXECUTION.md).

**Status: implementation and assigned acceptance complete; automated/browser/isolated-call and real-model gates passed. Not released.**
No production migration or application deployment was performed. Existing unrelated dirty changes are preserved.

## Implementation

| Scope | Delivered | Evidence |
|---|---|---|
| U0 | Correct AMI CURL entries/aliases/DTMF/business outcome/talk time; durable day metrics; normalized-number mutex; DNC; RU import formats/multiple phones/dedup; percentages/timezones | Source tests, actual MySQL, nine actual loopback outcomes; retry/DNC/concurrency run |
| UA1 | Shared strict contract used by UI/API/compiler/AI; diagnosis/capabilities/preflight; tenant/role/target validation; classifier/context/skills | Registered-capability tests, reference evals, actual AMI/ARI checks |
| U1 | Campaign workspace with six tabs; clients/task actions/DNC; explicit tours; lifetime progress; actor/thread journal; KPI/ETA/status/stop/dirty guards | Browser desktop/390, MySQL lifecycle and actual retries |
| U2 | Seven-step wizard, mode/pacing/queue/retry presets; saved/draft preflight; isolated persisted internal-user test call with limit/idempotency/cleanup | Browser wizard/preflight; actual internal playback/TTS, zero new campaign tasks/attempts |
| U6 | Field formats/system guards/enum extension; schema preview/revision/hash/conversion/archive/reference rewrite; import validation/rejected XLSX/create-column-field/templates/chips | MySQL transactions/rollback/revision, browser; migration runtime on PG17 |
| UA2 | Data tools with masking/default tenant privacy; validated page context; base→campaign plan reference; click-only navigation/launch-dialog actions; readable diffs and actor audit | Real tool contracts and compiler with scripted model, negative permission tests, browser cards |
| U3 | Russian money/date/number/digits speech variables; speech builder/provider CTA; text/audio preview; business outcome mapping | Actual source TTS HTTP/cache/publication + Asterisk speech and internal test; DTMF=1→confirmed |
| U4 | Cached health/diagnosis/trends/ETA/alerts/agents; health and step SSE; session feed; call timelines; 390px 2×2 KPIs/contained table scroll | Browser desktop/390, actual AMI AutodialStep; progressive/power/predictive calls |
| U5 | Presets/comparison, eight dimensions including heatmap, drilldown/custom columns/authenticated recordings; typed XLSX/provenance; selection→new base→redial draft preserving DNC | Golden MySQL analytics/selection tests, browser heatmap/drilldown/copy/draft; no automatic launch |
| U7 | Scoped one-time API keys, rate/revocation checks; atomic upsert/idempotency; restart-safe import jobs; external_id results; normalized bulk DNC; durable HMAC webhook retries; OpenAPI | Actual MySQL27 tests; public HTTPS503→204 retry; API guide and metadata-generated schema |
| UA3 | MCP annotations/resources/templates/prompts; per-key scopes and session identity; no apply/start scope; browser proof on apply; incoming cards | MCP negatives/catalog tests; actual local HTTP login→cookie→apply→refresh; browser denial and retained retry message |
| UA4 | 28 reference cases, including original eight requested autodial cases plus schema/selection/task/bulk-DNC (12 autodial total) | Scripted-model regression plus all eight original scenarios passed with actual configured DeepSeek68; source loop/adapters/contracts/compiler, synthetic domain storage |

The module currently exposes 35 autodial tools. Schema migration and report-copy tools recheck preview hashes before apply;
all mutations remain proposals requiring confirmation. API-key creation and PII sharing are administrative UI settings;
secrets are not delivered to the model.

## Automated gates

| Gate | Result | Artifact |
|---|---|---|
| `npm run lint` | PASS, zero errors; existing backend126/frontend104 warnings | `final-lint-r4.log` |
| `npm run test:backend` | PASS, 456 suites/4403 tests; 27 opt-in DB tests skipped here | `final-backend-r6.log` |
| `npm run test:frontend` (`VITEST_CHUNK=5`) | PASS, all424 files/85 batches/2332 tests | `final-frontend-small-batches.log` |
| Latest incoming-card/error regression | PASS, 2 files/26 tests; includes new pending-refresh error regression | `final-cards-frontend.log` |
| Actual MySQL source integration | PASS, 27/27 in own random schema, removed | `final-mysql-r2.log` |
| PG17 migration runtime0040–46 | PASS, disposable network-none container removed | `pg-runtime.log` |
| Migration-runner tests | PASS, 20/20 | `final-migrations.log` |
| Production backend/frontend typechecks | PASS, no diagnostics at respective final source checkpoints | `typecheck-backend.log`, `typecheck-frontend.log` |
| Latest AI parity/registered capabilities | PASS, 3 suites/35 tests | `final-ai-parity.log` |
| Webhook transport/worker + MCP session negatives | PASS, 3 suites/28 tests | `final-network-r5.log` |
| Interactive proof over actual localhost HTTP + unit boundaries | PASS, 2 suites/4 tests | `final-http-proof.log` |
| Latest live-eval fixture/adapters regression | PASS, 2 suites/40 tests | `final-live-fixture.log` |
| Actual configured LLM scenarios | PASS, 8/8, provider68/deepseek-flash, 30 requests; zero domain writes | `live-ai-evals-result.json`, `live-ai-evals-r4.log` |

PG runtime proves migration execution/backfill/schema constructs, not the entire application on PostgreSQL.
HTTP confirmation tests use synthetic auth/proposal storage with actual controllers/cookie/HMAC/guard.
Browser UAT runs the actual frontend and autodial services with disposable MySQL and disconnected PBX dependencies;
it does not certify a deployed full application, assistant panel, or production authentication.

## Live calls on root@ipbx.krasterisk.ru

Only synthetic prefixes00991… and the dedicated localhost PJSIP loopback were allowed by the transport guard.
Existing campaign states and hashes of protected autodial configuration files stayed unchanged.

- [Speech/outcome evidence](live-u3-custom-tts-result.json): success/busy/no_answer/congestion/answered_short/amd_machine/DTMF/invalid_number/speech;
  DTMF1 and business_outcome=confirmed persisted. Actual Russian SAPI custom HTTP TTS, source preview/bridge/publication,
  Asterisk playback and internal-user test passed. Preview artifact: `live-u3-preview.wav`.
- [Operational evidence](live-operations-result.json): DNC prevented ARI originate and attempt creation; two actual busy attempts
  respected retry interval/max; replacement event handler/state completed an already answered call from durable data;
  simultaneous requests across campaigns produced exactly one call for the same canonical number.
- [Operator evidence](live-operators-result.json): progressive/power/predictive each gave success, 8s talk time and the actual Local
  queue-member interface. Each mode produced zero originates while the synthetic operator was PAUSED, then one when READY.
  Readiness was seeded from an actual AMI QueueStatus member; CallCenterState and manual pacer ticks were actual source.
  Warmup elapsed clock was controlled by the fixture. This does not prove the entire live CallCenter login/status-ingestion path.
- [Webhook evidence](live-webhook-result.json): actual public HTTPS443 with normal TLS validation and source DNS pinning;
  receiver verified HMAC/timestamp/exact body hash; first503 persisted a retry, replacement worker delivered204 after31 real seconds.
  Both deliveries retained one event UUID. Own random PHP receiver/state and database were removed.
- [Actual model-plan → internal TTS call](live-ai-plan-result.json): PASS. A recorded passing real DeepSeek collection plan
  was applied through actual source base/campaign creation in the disposable schema; actual preflight ready=true. Logical
  eval-isolated trunk and engine1 were explicitly bound to the dedicated loopback and isolated HTTP/SAPI provider.
  Actual ARI answer/continue, source HTTP TTS bridge, WAV publication and internal test-call completion/cleanup passed.
  Runtime text equals preview: «Тестовый клиент ваша задолженность составляет пятнадцать тысяч двести сорок рублей пятьдесят копеек».
  Preview WAV133148bytes; bridge returned nonempty playback filename. Zero campaign tasks/attempts were created.
  All six cleanup/protected-state checks true, errors[], production campaign states unchanged; process exited0.
  Audio `live-ai-plan-preview.wav`, log `live-ai-plan-r3.log`. This composes model output with real telephony; the binding/application
  is performed by the test harness, not by clicking the assistant panel of a deployed full application.

Handler replacement in the operational run is **not** an OS-process restart. Import and webhook durable worker replacement are
verified separately. Earlier failed harness runs are retained as attempts; only the final result JSON files above are passing evidence.
The queue fixture was corrected for AMI Location and numeric setinterfacevar. Webhook hash verification was corrected to compare
the persisted MySQL JSON representation, which is what the worker signs, rather than the pre-insert whitespace/key order.

## Browser checks and cleanup

Desktop and390px: workspace tabs/client filters, seven-step creation/preflight, dirty guard, import and schema flows;
monitor health/KPI50%/retry time/trend; contained horizontal table and heatmap scroll; report attempt drilldown;
report selection created a separate base and draft campaign, opened preflight, never launched calls.
Incoming card denial retained the localized password-login instruction and retry button after a pending-list refresh.
Call lanes render ringing/talking/current step; mobile page width384px within390px, lane width302px without overflow.

Screenshots were inspected in the browser tool. Browser viewport reset, own tab closed, Vite session stopped,
UAT server exited and confirmed `UAT schema removed` in `ui-live-final.log`. No production token was used in the UAT fixture.

## Real-model acceptance and implementation boundaries

1. **Configured real-model gate — PASS.** Normal current tenant-provider selection returns provider68 (DeepSeek Flash);
   credentials load through the source service without configuration/key changes. The earlier provider15 failure was an
   invalid harness probe: a global row outside the tenant LLM catalog, without tenantUid. It was not evidence that the
   configured model was unavailable. Original failed probe is retained as `live-ai-provider-invalid-global-probe.json`;
   corrected probe is `live-ai-provider-result.json`. All eight requested cases passed in one real-model run, including
   local retry time, collection plan, redial UI action, DNC proposal, report, injection, compliance clarification and page context.
   Domain storage is synthetic and rejects writes; no real contacts or secrets were sent to the model. One diagnostic tool
   call encountered a fixture-method omission and the model recovered; the fixture was subsequently completed and regression passed.
   Product fixes from these runs: DeepSeek thinking budget and tool-continuation reasoning (kept private), autodial classifier
   routing, explicit reporting timezone/local retry time, and prevention of text-only confirmation applying autodial proposals.
   Configured global Yandex TTS64 still fails normal current-keyring loading (`current-tts-result.json`); its authentication
   was not repaired or verified. Actual speech functionality passed using an isolated custom HTTP/SAPI provider.
2. The canonical supported scenario set has ten actions. HTTP and generic per-step conditions remain unavailable,
   consistent with REPORT U0/C2; variable insertion covers supported TTS/value-source/goto paths. No unsupported HTTP action is advertised.
3. XLSX includes title/period/timezone/typed formats/provenance SHA256. It is not signed with a certificate.
4. No application release or production migration is claimed. An independent review was not performed; all checks are coordinator self-verification.

Automatic approval review rejected a historical Git key/decryption probe earlier in this session.
It was not executed or bypassed; neither public-key SSH access nor elapsed time is consent for that credential probe.
Current authorized provider68 resolved the model gate; historical key probing was unnecessary. No historical secrets were accessed.

Acceptance is closed for the assigned REPORT scope with the explicit boundaries above. Release/deployment and restoration of
the existing Yandex64 provider configuration are not claimed by this implementation acceptance.

## Explicit release assignment — completed 2026-10-18

The subsequent user-authorized deployment supersedes the earlier no-release boundary for this assignment only.
Version4.7.1.1/source427a5059724f3884e131da4b7bfa09c772f5a2aa is released at https://ipbx.krasterisk.ru/v4/.
Authoritative provenance, commands/results, backup, first failed call and corrective fix: [RELEASE](RELEASE.md).

| Gate | Result |
|---|---|
| Versioned source push | PASS, origin/main verified; neighboring0048 dependency explicitly approved,0049 excluded |
| Lint/backend/frontend/build/version | PASS, final quality39097726685; shared180/backend4409/frontend2339 |
| E2E/harness/Linux package | PASS,39097726717/39097726726/39097730853 |
| Real MySQL/PostgreSQL contracts | PASS,39096997739; backend/schema unchanged in final frontend-only correction |
| Strict production schema readiness | PASS,0048 checksum preserved; no production DDL |
| Deployed normal login→real AI→explicit apply | PASS, DeepSeek68/workflow63; new base/campaign5 |
| Deployed UI preflight/client audio preview | PASS, all sixready; synthetic name/15240.50RUB; audio7.864s |
| Deployed internal SIP speech call | PASS,3d539cf9; actual runtime text/returned prompt/receiving recording; normal cause16 |
| Receiving audio | PASS,7.86s,125804bytes,correlation0.999901 with synthesized PCM; no manual-listening/ASR claim |
| Final backend continuity | PASS,2092 compiled files byte-identical to real-call-accepted17d6b143 |
| Final UI label/public health | PASS, translated delete/count; public legacy/v4/health200,exactSHA,loopbackAPI |
| Disposable cleanup | PASS, users367/368,sessions,base/campaign/contact,provider69,SIP/dialplan/prompt/tunnel removed |
| Original campaign states | PASS,equal baseline;0test campaigntasks/attempts,0activecalls |

Speech used the actual deployed custom HTTP/SAPI provider. Existing Yandex64 authentication remains unverified and was not
repaired; that earlier configuration limitation does not become a passing provider-auth claim. Coordinator self-verification,
no independent reviewer. Private recordings/captures/credentials are not published. No assigned release gate remains pending.
