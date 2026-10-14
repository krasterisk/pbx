## D7-UI / 2026-10-13-r4

Coordinator /root, codex-direct, sole writer; previous dashboard writers FIN. User requested a modern dashboard and detail sheets, period tabs, no visible timezone or deployment-mode label. Owned paths: features/dashboard UI/styles/tests, dashboard-only locale keys if needed, this PLAN/EXECUTION and the dashboard registry row. Preserve all existing dirty work; no backend/API/schema/shared UI changes, no deployment or restart. Acceptance: shared Tabs keyboard selection and valid custom dates with existing organization timezone semantics; themed KPI depth/hierarchy, responsive layouts and redesigned call/inventory/system/cloud sheets; lazy queries, filters, pagination, source freshness and focus return preserved. Checks: targeted dashboard tests, frontend types/SCSS, root lint/backend/frontend; browser visual check if available, reported separately. Existing r3 AI/autodial/load/release gates remain pending.

# PBX Dashboard — 2026-10-11-r3

## Bounded follow-up 2026-10-12: D5-CEL-REPAIR
Coordinator /root, codex-direct; no agents. User authorized migrations against the DB configured in the local backend .env, then reported projection failure `Unknown column 'extra'`. Owned paths: new 0034 MySQL/PostgreSQL CEL repair, migration manifest and migration tests, this PLAN/EXECUTION. Existing production source and neighboring dirty work excluded. Read-only SHOW COLUMNS confirmed legacy cel lacks extra despite applied0019. Add only nullable VARCHAR(512), conditional on absence; preserve all applied artifact checksums and event data. Acceptance: migration tests, real MySQL apply/replay, schema readiness and exact projection SELECT; mandatory lint/backend/frontend checks. PostgreSQL live integration is separate evidence, not implied by MySQL success.
Approved source: full user implementation request in this chat. Coordinator /root; codex-direct. Baseline main / 7263d499. Preserve dirty endpoint/mobile navigation work. This revision extends r2 with actual D6-LIVE; previous definitions are superseded only where explicitly recorded.

## Tasks
- D1 Shared bounded contracts, access, API/module/socket integration; /root.
- D2 Incremental logical-call projection, scope-safe summary/cursor queries, complete AMI snapshots, one node collector with lease; backend worker.
- D3 Responsive dashboard, lazy detail panels, filters/period/timezone, throttled refresh; frontend worker.
- D4 Tenant tariff/timezone/billing identity, node exporter monitoring; cloud/system worker.
- D5 Portable additive migrations, composition/AI coverage integration; /root.
- D6 Targeted/full tests, scale harness, browser verification, evidence; /root.

## Behavior
Overview <=50KiB, <=300 buckets, no full lists; detail default50/max100 cursor rows. All calls including internal/autodial/AI counted once by tenant+node+linkedid or uniqueid. Human/working AI answer accepted; IVR/voicemail not accepted. Incomplete history unknown. Existing interface/module and CDR access. No AMI actions/raw CDR scans on HTTP path. One collector per node; complete snapshots only, replay events during resync. Idempotent checkpoints and bucket corrections for late legs/CEL/AI. Refresh5s/history30s/cloud5m, hidden-tab pause, bounded scope-safe caches. BOX/OPENSOURCE exporter host metrics15s/retention7d; CLOUD tariff/balance/limits with real tenant ID. Organization timezone, UTC fallback disclosed. No new tariff store/charging/enforcement/callcenter KPI.

## r2 acceptance corrections from execution/review
- Summary and historical detail return opaque revision tied to tenant/effective rights/scope. Detail rows and exact count use one REPEATABLE_READ snapshot; a changed revision never borrows an old summary total. Optional explicit version mismatch returns409.
- Updated SIP contacts invalidate the former expiry; bounded fair SQL renewal queue and per-endpoint generation prevent late SQL from overwriting newer events.
- CDR dispatch does not prove logical completion. Fresh tenant-scoped live absence after last leg end or tenant-safe CEL LINKEDID_END proves completion. Continuing calls take precedence over human/AI result and keep endedAt null; history excludes active calls. Pending completion is replayed in bounded indexed batches even without a new CDR. Existing positive completion must survive a source outage.
- Mobile tariff/balance strings remain readable within cards, including long names and large amounts. Dense charts group counts into at most24 phone/96 desktop intervals; sums, chart/selector/drill boundaries agree.

- Quiet intervals remain explicit zero bins; at/until boundaries survive public payload and UI coarsening. Clicked intervals match graph/selector/detail filters.
- Legacy AI recognized text/ai_response is presence only, not working-playback evidence. Without reliable playback proof answered AI remains unknown/aiPlaybackUnconfirmed. v2 played_until_ms>0 is positive evidence; neighboring v1 writers stay outside this initiative.
- Slow AMI inventory has a bounded120s default timeout separate from channels15s; detached inventory permits calls/publication5s and lease heartbeat15s. Ownership/reconnect aborts stale reconciliation. Restart restores bounded valid persisted last-good separately per source; successful empty replaces it, no-data failures stay unavailable, disconnected last-good stays stale with original timestamp. Replay overflow is checked after the final awaited lease.

- Public system overview contains the most-used disk per host plus explicit omitted disk/missing-filesystem counts; full paths/status remain in lazy /system detail. Final byte assertion prevents oversized successful responses, including maximal valid metadata.
- Actual MySQL ONLY_FULL_GROUP_BY and PostgreSQL bucket queries use identical selected/grouped expressions; SQL mode is not weakened.

## Gates
Targeted tests; shared/backend/frontend build/typechecks; npm run lint; npm run test:backend; npm run test:frontend. Load10k endpoints/1k calls/100 viewers/5m CDR legs; p95 budgets and viewer-independent collection. Both SQL dialect integration; live Asterisk/AI/local+remote exporter distinct from mocks. Honest implemented/automated-tests-passed/live-verified/released statuses.

## r3 D6-LIVE — authorized actual calls, 2026-10-11
The user explicitly requested creation of test calls and live scenarios on the authorized host. Root remains the only coordinator, codex-direct. Existing r2 implementation and baseline are preserved.
- Temporary second Asterisk on the installed binary, unique verified /tmp lab directories, loopback-only unused ports, private CSV CDR/CEL, no main PBX reload/config changes or external destinations. Actual SIP dialog and RTP participants; at most4 concurrent logical calls.
- Fresh disposable local SQL with canonical migrations and actual new Dashboard collector/projection/API, SSH AMI tunnel and actual lab CDR/CEL import. Tenant/users/permissions are test configuration; telephony evidence must come from actual Asterisk calls.
- Validate ringing, human answer, missed/busy, IVR-only, voicemail-only, incoming/outgoing/internal, transfer, autodial and AI evidence when an actual working runtime is available. Never fabricate playback proof or call a simulated AI response live AI verification.
- Check exact current/history/detail agreement, completion, late event replay, tenant/scope isolation, source outage/stale values and real frontend API rendering. Record topology, calls/channels/CPS/events, resource cost and cleanup. This is functional live acceptance, distinct from dedicated production-scale load/release.
- Workers: dashboard_cloud_system owns live-asterisk-lab.py; dashboard_backend owns live-dashboard-runtime.cjs and the assigned classifier/projection semantic correction with regression/completion tests; independent reviewer read-only + LIVE-REVIEW.md. Root owns live-dashboard-check.cjs and any production source corrections/shared files.
### D6-LIVE confirmed source correction
Actual Asterisk22 AMI returns Error `No Contacts found` with no list-completion event for an empty dynamic Sorcery contact collection (including static-only AoRs). This is a documented terminal-empty response, not a source outage. The earlier event-only rule is superseded for this exact `PJSIPShowContacts` + explicit Error response + exact trimmed message + zero observed rows combination only. Permission errors, other actions/messages, timeout, overflow and partial lists remain failed/incomplete. Evidence: live-dashboard-attempt-3 source preflight and targeted18/18 tests. Official implementation: res/res_pjsip/pjsip_options.c ami_show_contacts; static contacts remain on AoR permanent_contacts.
### D6-LIVE semantic revision3
Actual isolated CDR/CEL exposed technical Answer/Playback and terminal Hangup misclassification. Positive human evidence must be a destination answer or distinct owned SIP bridge peer, bound to tenant-owned CDR uniqueid/channel/linkedid. Caller Answer alone is technical pickup; answered Dial/Queue destination is the CDR fallback. IVR/voicemail and explicit destination failure retain their reasons after final Hangup. Old accepted outcomes are not answer evidence; only durable version3 human/AI provenance is retained through outages. A bounded node+call_key indexed replay of the existing31-day projection corrects previous results and contributes to readiness.

Harness source corrections are separate: installed bridge_simple supports actual bidirectional RTP; CDR start and CEL event epochs are explicitly converted to UTC, retaining raw epoch provenance; SQL importer inserts UTC wall strings rather than host-local nativeDate escaping. These are actual-source transport corrections, not fabricated telephony outcomes. Production app deployment remains a separate gate.

### D6-LIVE r3 result / outstanding gates
Run6 ordinary-call isolated application gate PASS:14logical/16CDR/187CEL,12scenarios+UI/outage,27checks, real sourceRTP/BYE200, scope/tenant/detail/graph/revision consistent. Independent actual-record audit and source review PASS. Full backend3894 tests/lint/actual dualSQL26groupsPASS; prior frontend1840PASS reused(no frontend change). All own resources removed and mainPBX untouched. SUMMARY/EXECUTION hold measurements and next action. WorkingAI/fullproductautodialengine/dedicatedhighCPS-PBXload/productionrelease remain pending; this result does not complete those gates or neighboring milestones.

### D7-UI result
Implemented 2026-10-13. Scoped43tests, frontend types/lint, SCSS and full backend pass. Full frontend347files:345pass/2fail outside D7; isolated endpoint14pass, SoftphoneContacts6mock failures remain. Root lint foreign support preserve-caught-error failure. Browser visual acceptance pending after CUA errors/timeouts. Details and exact next action in EXECUTION; no active D7 writers/processes or release.
