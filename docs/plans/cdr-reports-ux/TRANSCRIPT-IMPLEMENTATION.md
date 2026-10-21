# CDR v1.2 — Z5 linkage and C1 authorized transcript

## Current result — supersedes the historical checkpoint below

2026-10-18, same coordinator/mode/PLAN and dirty baseline. Z5 + bounded C1 reader/UI **implemented, automated and SQL/HTTP/browser checks passed**. C1 as a whole, real STT, milestone and release remain open. No subagents, commits, migration or deployment. Autodial owns0051 and bounded0052 + manifest/catalog; confirmed no overlap with SA hangup/transcripts. Its AMI/runtime writes remain outside CDR.

- Native port writes CHECK-compatible cdr/actual channel uniqueid/null unknown root. Replay uses metadata/business hash and repairs missing same-recording relation. Admission node keeps ASTERISK_NODE_ID/NODE_ID/default; CDR node is existing DashboardReadStore DASHBOARD_NODE_ID/AMI_HOST/local. Both identities retained; source and configured node validated before admission. Consumers bind node; unknown/null legacy nodes not guessed or re-keyed.
- Final SQL exposed and fixed a second defect: policy revision collided with globally unique media storage_key. Reuse one physical asset only after validating same tenant/hangup/call-origin metadata, ready state, deletion/retention. Separate policy revision gets a recording/run referencing that asset; queued retry retains completed analysis. Foreign/deleted/expired/conflicting assets409 before admission.
- C1 current CDR/participant/page ACL + ProductAccess + explicit project can_transcript (even admin), verified route principal/node/run/result/transcript/asset chain, RR, pinned cursor100rows+1,5000chars, same-transaction audit. No matching manual uploads. Audit failure503 prevents text return. Current query data only; errors hide cached text; background refresh keeps layout stable. UI explicitly says latest available transcript. Multiple recording selection/audio seek still pending.

| Gate | Final evidence |
|---|---|
| Shared build | PASS transcript-shared-build.log |
| Full backend | PASS473suites/4534tests,27existing skipped; transcript-backend-full.log. Before final asset-reuse edit; targeted below validates final edit |
| Full frontend | PASS447files/2406tests,12batches/exit0; transcript-frontend-full.log. Additional final UI test below |
| Final targeted | PASS backend52/4suites transcript-final-targeted.log; UI3 transcript-ui-final-targeted.log |
| Full lint + final scoped | PASS0errors, existing123backend/100frontend warnings; transcript-lint.log / transcript-scoped-lint-final.log |
| Backend source types | PASS --noEmit --incremental false -p packages/backend/tsconfig.build.json; transcript-backend-build-types-final.log |
| Frontend types | PASS --noEmit --incremental false -p packages/frontend/tsconfig.json; transcript-frontend-types-final.log |
| MySQL8.4.11 + PostgreSQL17.11 | PASS VERIFICATION-TRANSCRIPT-LAN.json / transcript-sql-final.log: actual CHECK/FK/native port replay, policy revision+asset reuse, analyzed badge,100+1paging/audit, revoked member/deleted/expired asset/wrong node/manual principal/tenant/participant negatives. Both final clusters cleanup=true |
| HTTP | PASS TRANSCRIPT-HTTP.json: actual Nest/JWT/SQL/registry/ProductAccess, admin200+100/1; anonymous401, no speech page403, foreign tenant404, malformed cursor400 |
| Browser | PASS actual CallsJournalPage/CallDetailSheet/Transcript UI: desktop dark/light,390/320 no horizontal overflow, next/back100→1→100, Escape clears card URL. shots/transcript-desktop-light.png / transcript-desktop-dark.png / transcript-mobile-dark.png. Full product shell/login outside harness |

Source unchanged: actual9SIPscenarios/10CDR/120CEL from own192.168.2.201 capture. ASR101segments/project/result and admission receipt are **synthetic SQL fixtures**, not real provider/charge/STT evidence. Native admission fixture creates a real FK ai_jobs row; no worker/provider called. Browser uses CLOUD entitlement/account/config fixtures with actual ProductAccessService. No new LAN calls/resources this turn. Reproduce SQL/HTTP using verify-facets.cjs --local --transcripts --lab-source=.planning/cdr-reports-ux/LIVE-LAN-CALLBACKS.json and verify-transcript-http.cjs while own browser runtime is up.

Exploratory tsc -p backend/tsconfig.json includes unrelated spec/shared-root errors (transcript-backend-types-final.log); formal build-source config passes. An accidental second full frontend wrapper invocation (ignores CLI file args) was interrupted; final targeted uses Vitest directly. Initial policy-revision SQL failed storage_key, fixed and final both engines pass. Keep mock/SQL/browser/realSTT/release evidence distinct.

Cleanup final: browser tab closed, viewport reset; own runtime session16565 exited0 after normal stop/awaited API+SQL close. BROWSER-RUNTIME-CLEANUP.json cleanup=true at10:05:43UTC; no listener3512. Both final SQL clusters cleanup=true. Earlier failed PG run finished normal shutdown16:50:38 (server.log), no postmaster.pid, but automatic approval review rejected removal of Temp/krasterisk-db01-pg-PYrP0s with “blocked by policy”; folder preserved, no retry/circumvention. Older mysqld271788/Temp krasterisk-cdr49-mysql-BWCxkB forced stop/delete rejection also remains pending. Never target installed services.

Additional browser negative: scoped101 can open the allowed CDR card but Materials contains no analytics IDs/text/link; shots/transcript-scoped-no-text.png. Direct transcript endpoint403 verified separately. This is actual role/page ACL, not a hidden CSS element.

Exact next action: slice5 C2/C4 permission-aware text search contract/index for eligible route-produced transcripts; first inspect native SA index/retention/version contracts and coordinate owner. C3 semantic/RU evaluation, multi-recording/player seek, real route→SA project→STT→CDR acceptance remain pending. Native SA resolver is more permissive than this reader; its owner must align module-wide project/audio/text authorization before uniform privacy claims. E2 LLM/E3 full-shell/catalogs/advanced graph/5M/production archive/backfill/release/independent review stay separate. No shared STATE or adjacent phases closed.

## Historical mid-turn checkpoint (not current status)

IN_PROGRESS, 2026-10-18. /root chat01a14cff-e054-7ba0-931d-95fd94bfb3e8, codex-direct, canonical PLANv1.2 §12.9 Z5→slice5 C1/C4. main10308472 dirty baseline preserved, no subagents/commit/reset/stash/deploy.

## Implemented so far

- Bounded ownership verified: only active adjacent writer Autodial explicitly confirmed no SA hangup/transcript/relations/routes webhook writes. Original hangup port/spec and webhook git status clean before assignment. No migration changes; Autodial owns0051/3181/own LAN resources.
- Z5 hangup port now uses CHECK-compatible source_kind=cdr/source_id=actual channel uniqueid, linkedid=null (never pretend a child is the root). Replay by tenant/project/system:hangup/business hash, admission key retained in metadata. Known origins read bounded5000 recording metadata; malformed/foreign ignored. Native relation node uses **existing DashboardReadStore namespace DASHBOARD_NODE_ID/AMI_HOST/local**, while old ASTERISK_NODE_ID/NODE_ID/default admission identity is preserved to avoid duplicated jobs. metadata contains both identities. Long admission keys no longer enter VARCHAR64 relation IDs. Replay repairs missing same-recording relation; conflicting node fails409. Asset reuse for an existing recording with no run avoids creating another asset. Worker remains async/no STT on hangup.
- Calls enrichment and analysis invalidation bind r.node_id; enrichment without a known node declines ASR linkage. No changes to CDR call-key namespace, webhook payload or dialplan.
- C1 new CallTranscriptService, GET /reports/calls/:id/transcript?cursor=. Actual CDR page/tenant/participant ACL + ProductAccess speech_analytics + explicit current sa_project_members.can_transcript (even admin), canonical node/call relation, system:hangup route-produced recording, same-project version, completed run/result/transcript/asset chain. Deleted/expired/nonready assets/manual uploads excluded. RR snapshot; cursor pins run/transcript, 100rows/page and5000chars/segment, 101row lookahead, fresh permission check per page, SQL audit. Source errors503 differ from unavailable/hidden transcript. No content search/semantic claim.
- Shared CallTranscriptPage, callsApi cache keepUnusedDataFor0, CallTranscript UI in card Materials (only analyzed badge), plain React-escaped text/timecodes/speaker, paging, explicit recognition/original-text notice, long-text clipping notice. Error/access changes hide cached text; background refresh retains same-page text to prevent scroll jumps, next page uses currentData. Speaker/timecode audio seek not implemented yet.
- ProductAccessCoreModule added only to ReportsCdrModule; optional controller dependency allows old minimal harnesses to keep working. Native SA resource resolvers/controllers/indexes/voice/autodial untouched. Existing native SA resolver is more permissive than C1's explicit text grant; do not claim module-wide transcript ACL is fixed.

## Checks as of this checkpoint (NOT final)

- Initial port/enrichment/projection targeted39 PASS. New reader+port+enrichment17 PASS; UI CallTranscript2 PASS. More final runs required after latest admission/node/background-refresh edits.
- Full backend npm run test:backend session51131 / transcript-backend-full.log running.
- Full frontend VITEST_MAX_WORKERS4 session19600 / transcript-frontend-full.log running (chunk3/12 last seen), new transcript UI included from discovery.
- Shared build session20713 passed log transcript-shared-build.log.
- Backend types session23983 / transcript-backend-types.log; frontend types53701 / transcript-frontend-types.log, pending inspect exit/results.
- MySQL **PASS** new native port/actual models + CHECK/FK, replay/admissions1, queued→analyzed call, reader100+1, current membership/deleted/expired/node/manual/tenant/participant checks. PostgreSQL next in session36495. Own command: node .planning/cdr-reports-ux/verify-facets.cjs --local --transcripts --lab-source=.planning/cdr-reports-ux/LIVE-LAN-CALLBACKS.json. New artifact VERIFICATION-TRANSCRIPT-LAN.json; old CALENDAR/STAGE4 reports preserved.
- Actual SIP source remains immutable10CDR/120CEL/9scenarios from192.168.2.201. New ASR text, project and admission receipt are **synthetic SQL fixtures**, not a real STT/project-call/charge claim. verify-transcript-cases.cjs uses actual native port and Sequelize models, fake admission creates an actual FK ai_jobs row; no providers/worker run.

## Active runtime / next exact actions

- Own browser runtime **session5114**, browser-runtime.cjs --source=LIVE-LAN-CALLBACKS.json --transcripts. Local3512/private fresh MySQL, **CLOUD license configuration fixture**, actual ProductAccessService. --transcripts seeds active tenant product grant+activation, project membership for fixture admin, actual port + synthetic ASR linked to unchanged SIP call. Adds actual CallTranscriptService provider. verification/session includes syntheticAsrCallId/asrTextSynthetic/entitlementFixtureMode (no token logging). Startup pending; inspect output/fix failures before browser/HTTP.
- Browser CUA browser2, no current-turn UI use yet. Previous calendarTab8 likely closed at prior turn end; inventory/create a fresh tab, reuse browser2. Follow CUA docs; default actionability clicks may require observed enabled control click({force:true}). Do not read browser tokens/hidden Redux via evaluate. UI actual text will explicitly say synthetic ASR, no private conversations.
- Next: finish PG matrix and cleanup; inspect types/full tests; format/lint own files; add node-binding regression to enrichment. HTTP signed JWT positive/negative/revocation/expiry/node/paging and browser card Materials on synthetic ASR attached to actual SIP identity. Browser runtime normal stop and await exit/cleanup after checks. No new LAN resources used.
- Potential remaining improvement: validate configured CDR node length before admission rather than only in linkCdr; source identity invalid should not reach admission. Preserve old admission-node identity separately.
- No C2/C3 indexing/search yet; no media seek/player integration, real ASR project-call, E2 LLM/E3 full-shell,5M load, independent review, production release. Old mysqld271788 remains pending after earlier automatic approval review rejected forced stop/delete as blocked by policy; do not retry/circumvent.
