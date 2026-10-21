# mpbx standalone voice robots release evidence

## r5 — module UI refinement released and live-verified

2026-10-14, `/root`, codex-direct, T13–T15 complete. MCP keys remain a plain module-owned HTML page on mpbx; no MCP credential React route/page was added to main or standalone React. The page now has matching palette, typography, cards, forms, actions, responsive empty/list states, one-time secret display and native revoke confirmation. Guide link remains in its footer; the separate LLM navigation tab was removed from the PHP fragment and direct standalone navigation. Public AGENTS1.3 and MCP guide resource are identical (SHA256 ad9192b7300a359b5c6b8eb6bb8e1e0c34446334c0959609b2b58d2d430a3169).

STT/TTS and native HTML dialogs now send same-origin/window-validated modal state. The module iframe fills the browser viewport while a dialog is open; a placeholder retains document geometry, and close restores overflow and scroll. Dialogs remain isolated from legacy CSS. Shadow clipping was confirmed live: embedded layout padding12px0 placed a 24px blurred card shadow against the iframe boundary. Module-owned layout/MCP gutters now provide32px horizontally on desktop,24px on mobile and40px below. Shared React table styles and the legacy layout were not edited.

Scoped verification:6 bridge tests PASS; actual HTML credential workflow against mock API PASS (create/read/configure, fake one-time secret, XSS text escaping, revoke, mobile width); compiled frontend browser geometry PASS STT/TTS desktop1366x900 and mobile390x844, full viewport bounds, footer visible, gutters>=24px and bottom>=40px, zero errors. Final standalone build PASS; r5 TypeScript/scoped lint/root lint PASS with existing warnings. Full backend4011/frontend1946 tests passed in r4 and were retained as unchanged core regression evidence; isolated HTML/bridge/nav/CSS changes were checked with the scoped r5 suite rather than rerunning the Windows full suite. Logs: artifacts/mpbx-r5-bridge-tests.log, mpbx-r5-mcp-tests.log, mpbx-r5-modal-geometry.log, mpbx-r5-frontend-build.log, mpbx-r5-typecheck.log, mpbx-r5-scoped-lint.log, mpbx-r5-required-lint.log.

Actual authenticated mpbx browser verification PASS: native header/tabs, restyled MCP/footer-only guide, left/right/bottom card shadow space, STT/TTS full1280x720 iframe and cancel/overflow restoration. Live screenshot artifacts/mpbx-r5-shadow-gutters-live.png shows the TTS card with its complete shadow; mpbx-r5-mcp-live.png and mpbx-r5-stt-modal-live.png / mpbx-r5-tts-modal-live.png show the other changes. Agent-created test tab closed; the user's original tab and form were not reloaded or edited. No real keys/providers/calls were created by these checks; provider rows present in live view were user data and untouched.

Module-only release backups: evidence/ui-r5-module-backup and evidence/ui-r5-shadow-backup. Original r5 final archive SHA256 bc1203e7f6e69327e679e6d32eb510d46add71c1998dd7a9823d1f3a0b576e96. Final shadow/cache overlay SHA256 2e227a3eee2313cb2702a1ec1c7d6bb97d1dc9ce73842f24ae75cf9ddebd1fa2; stage releases/ui-r5-shadows-20261014. Old hashed assets retained; entry points copied atomically. Host script URL uses content hash and iframe URL ui=6 to avoid cached old integration. Evidence artifacts/mpbx-r5-shadow-publish.log / host evidence/ui-r5-shadows-final.json: all109 protected hashes unchanged, index remains18b0d51a52670fd4483d810ddbb4994af4910a282c96508345828a2f40cb9c7d; Asterisk PID unchanged; bankWebhooks_api1234/caskBase_backend1235/speech_server_api1241 online/restarts0 and own2766180 online/restarts2 unchanged; health ARI/VADtrue. No index/server-config/backend/DB edits or service restarts in r5.

Status: implemented / automated-tests-passed / live-verified / released for requested r5 UI scope. No pending UI gate. Real audio/provider/robot routing and capacity validation remain a separate original deployment gate, with no call generated during UI work. Next action: user closes/saves any current form and refreshes the module (Ctrl+F5) to load the published assets; no writer active.

## r4 — legacy interface integration released and live-verified

2026-10-14, `/root`, codex-direct, T10–T12. User inserted `include("modules/voice-robots/standalone.html");` into the legacy voice-robots case and requested shared-shell integration. Production investigation and the actual administrator browser showed that the complete HTML/React global CSS disrupted Bootstrap navigation, while pathname-only standalone detection selected the wrong API route on index.php. Robot list failed to load and MCP had no navigation entry.

Module-only fix is published at `/var/www/html/vpbx/modules/voice-robots`: standalone build explicitly uses the session-scoped gateway regardless of pathname, direct navigation includes MCP/guide, and a PHP module fragment supplies Bootstrap tabs plus an isolated same-origin iframe. Safe display context comprises current tenant UID/name, user name, administrator level and locale; HTML and JSON are escaped. Parent and child check both message origin and exact window source, allow only robot routes, synchronize React Router changes/deep links and resize to content. API tenant/auth remains independently checked against the existing PHP session; no credentials/cookies/DB connection move to JS and no backend/migrations change.

User explicitly approved `include("modules/voice-robots/standalone.html");` → `include("modules/voice-robots/module.php");`. Guarded connect-ui.py applied exactly that replacement, preserved a private index backup and passed PHP syntax/exact-byte/service checks. After the user reauthenticated, the actual administrator browser verified the native header/icon/dropdown menu, embedded robots/MCP/STT/TTS/CDR tabs, safe context, robot-create/cancel route synchronization and refreshed direct links. No data or real tokens were created. Screenshot artifacts/mpbx-r4-integration-live.png is the actual integrated mpbx page. Earlier module-only/local preview evidence remains distinct.

Final index SHA256 `18b0d51a52670fd4483d810ddbb4994af4910a282c96508345828a2f40cb9c7d`; all other index bytes and108 protected file hashes unchanged. Public AGENTS1.2 and its runtime MCP resource published with identical bytes, SHA256 `a35df8c52ce730971bb74f1ae327cdaaaa2ef91e88b3808a49e2b8d56b63e259`, using integrated index URLs while retaining standalone access. Final evidence: artifacts/mpbx-r4-connect.log and mpbx-r4-final-verification.log; private host evidence/ui-r4-connected.json and ui-r4-final.json. Private original index: evidence/ui-r4-index-before.php (0600).

Published package SHA256 `842714788d06184fcc57e1e6f6a28166a9ac624208c2d4aa9c07f53b3c75d12d`; staging `/opt/krasterisk-voice-robots/releases/ui-r4-20261014`, private module-file backup `/opt/krasterisk-voice-robots/evidence/ui-r4-module-backup`. No services restarted: own PM2 PID2766180/restarts2 and old PID1234/1235/1241/restarts0 unchanged. Asterisk PID and all109 protected file hashes, including user's index.php SHA256 b34b6951d7008399c12ad1804ba7a9fb9d5ba4748024c158c5a7be258016abc0, unchanged. Health ARI/VAD true, legacy HTTPS200. Evidence: artifacts/mpbx-r4-publish.log and mpbx-r4-module-verification.log, host evidence/ui-r4-before.json and ui-r4-published.json.

| r4 gate | Current result |
|---|---|
| Standalone build, final frontend TypeScript and scoped lint | PASS; mpbx-r4-frontend-build.log, mpbx-r4-frontend-typecheck.log, mpbx-r4-scoped-lint.log |
| API mode compatibility | PASS4 tests, index.php session gateway / no duplicated public / old standalone / unchanged main JWT mode; mpbx-r4-api-mode-tests.log |
| Message boundary/deep links/escaping | PASS5 tests, actual scripts and PHP fixture; mpbx-r4-bridge-tests.log |
| Local browser shell/tabs/STT/create-route | PASS, actual PHP fragment and compiled frontend, mock read-only API; mpbx-r4-integration-local.png, local-api-requests.json |
| Required root lint | PASS with existing warnings; mpbx-r4-required-lint.log |
| Required backend | PASS414 suites /4011 tests, 1 suite/11 tests skipped; mpbx-r4-required-backend-tests.log |
| Required full frontend | PASS349 files/1946 tests, all9 chunks / exit0; mpbx-r4-frontend-tests.log |
| Live administrator robots/key list | PASS, user's current authenticated CUA tab, no credential issuance or data mutation |
| Live common shell integration | PASS after explicit approval, actual authenticated header/menu/all tabs/context/route sync/deep links; mpbx-r4-integration-live.png |
| Provider audio/routes/capacity | PENDING, unchanged earlier bounded pilot gate |

Additional key-page regression PASS: fake key issue/configure/one-time display/revoke/escaping/390px viewport, mpbx-r4-mcp-page-tests.log and mpbx-r4-mcp-access-local.png. No real credentials were created. Local wrapper screenshot mpbx-r4-integration-local.png uses synthetic PHP context and the actual compiled UI; direct MCP deep-link initialization was verified after the final about:blank/router synchronization fix.

Handoff: no module writer or test process running; authorized UI integration and all required/scoped/live checks finished successfully. No service restart, DB mutation or other host configuration edit performed in r4. Any further outside-module change still requires separate approval. Actual audio/provider/routes/capacity remain pending separately. Current key page is reusable standalone code in the local repository working copy; the main React application has shared robot tools/skills/JWT MCP but no equivalent robot MCP key page. Its AI-product /ai-robots/connections credentials are separate; adding a common MCP key UI is not assigned by the informational question.

## Current release r3 — public LLM guide and robot MCP

Coordinator `/root`, codex-direct; T6–T9 released 2026-10-13, final invariant verification 17:56 Asia/Krasnoyarsk. Earlier r1 evidence below is historical. Final archive `../../.artifacts/legacy/artifacts/mpbx-r3-release.tar.gz`, SHA256 `e6c77871d2bbd3a828ceb776541c8fea2f9611d2c378dafab2f140cc18ab0a8b`; active `dist` symlink targets `/opt/krasterisk-voice-robots/releases/mcp-r3-final-20261013/dist`. Unchanged isolated pinned dependencies are reused from the r3 release; the previous dist remains available for rollback. Own PM2 PID 2766180, restart count 2 (two deliberate isolated updates); original apps retain PIDs 1234/1235/1241, online, zero restarts.

- Public guide: https://mpbx.krasterisk.ru/modules/voice-robots/AGENTS.md, SHA256 `7c3cd2b6fe4a399980d153f4b398c83faf5422fa15bc78e7d9ba6ae5c6894899`. Complete field/reference/behavior contract, inline importable example, JSON Schema and two separately downloadable examples. With authorized MCP the model configures, rereads and tests; without write access it returns JSON and exact manual installation/testing instructions.
- MCP: https://mpbx.krasterisk.ru/modules/voice-robots/mcp.php, stateless JSON Streamable HTTP. Configure credentials discover 31 tools: 28 robot tools and 3 capability/skill helpers; read credentials discover 18. Robot CRUD includes groups, keywords and data lists; import/export, validation, readiness, text matching, list lookup, logs/CDR and speech-engine catalogs. Three skills, three prompts and guide/schema/skill resources. Stdio bridge available for compatible clients.
- Key page: https://mpbx.krasterisk.ru/modules/voice-robots/mcp-access.html. Existing PBX administrator session required; tenant derives from that session, Bearer credentials are tenant-bound, scope-limited, expire and can be revoked. Only SHA256 credential hashes persist, mode 0600. Browser-origin checks, strict schemas, rejection of supplied tenant identity, secrets and webhook custom-auth header values; credential values are masked/removed from results/exports. No route changes or call origination tools.
- Shared base AI-chat adapter uses the same catalog and existing confirmation/proposal/revalidation flow. Revision checks prevent applying stale proposals, writes use transactions and tenant/parent locks; import remaps portable group/list references atomically. Tool selection keeps relevant-domain robot tools inside the model's 128-tool budget while full MCP discovery remains intact. This integration is source-implemented and tested; only standalone on mpbx was deployed.
- Existing production: 109 protected Asterisk/Apache/index.php hashes and Asterisk PID unchanged; existing UI HTTPS 200; Asterisk uptime 55 days, three active calls observed at final check, available memory 8276 MiB and load 0.23/0.38/0.42. Own health ARI/VAD true, no robot channels. No Asterisk restart/reload or existing PM2 restart; no new DB migration in r3.

| r3 gate | Result / evidence |
|---|---|
| Standalone TypeScript/package and full-backend build typecheck | PASS; artifacts/mpbx-r3-final-typecheck.log |
| Final shared-guard, AI-chat, MCP and robot regression | PASS, 53 suites / 571 tests; artifacts/mpbx-r3-final-ai-tests.log; narrower guard/credentials/tenant suite 43 tests PASS |
| Full backend before last header-guard change | PASS, 413 suites / 4000 tests, 1 suite / 11 tests skipped; artifacts/mpbx-r3-backend-tests.log |
| Actual frontend parser/importer/exporter roundtrip | PASS on both examples and inline guide example; verify-scenario-guide.cjs |
| Actual MCP SDK transport | PASS, initialize/notifications/discovery/prompts/resources/tools/tenant rejection; verify-mcp-sdk.cjs, mock writes, no PBX/DB |
| Admin key page browser | PASS on local mocked API at narrow width, issue/revoke/escaping; artifacts/mpbx-r3-mcp-access-local.png |
| Public HTTPS MCP and real existing DB | PASS, scoped issue/read/configure/revoke, atomic scenario reference remapping, robot/group/keyword CRUD, export roundtrip, matcher/list lookup, secret/tenant/read-only/origin rejection; artifacts/mpbx-r3-final-live-mcp-smoke.log |
| Final protected services, static hashes and credentials cleanup | PASS; artifacts/mpbx-r3-final-release.log and mpbx-r3-final-verification.log; host evidence/mcp-r3-final-release.json and mcp-r3-final.json |
| Required root lint | FAIL, one unrelated support-ai.adapter.ts:49 preserve-caught-error, 123 warnings; artifacts/mpbx-r3-lint.log. Scoped backend lint PASS; frontend lint PASS with existing warnings |
| Required full frontend | FAIL, 346 files / 1925 tests passed, six failures in SoftphoneContacts.test.tsx missing CheckCheck mock; artifacts/mpbx-r3-frontend-tests.log. No scoped product behavior failure |
| Current authenticated admin key-page issuance through PHP | PENDING: no active admin PHP session at final run. Live credentials issued via authenticated internal API; every MCP tool called via public HTTPS. Prior r1 legacy PHP session CRUD was verified separately |
| Real STT/TTS audio, route integration and concurrent conversations | PENDING: providers/test route not configured, no live robot calls/load generated |

All temporary smoke robots and credentials were deleted; final revoked-token access returned 401. Next action is administrator login, configure-key issuance/client connection and provider setup through the module UI. An actual test call route and conversation require intentional follow-up; no automatic dialplan edits/reloads. Source ownership and completed/pending gates are in EXECUTION; no active writers, adjacent initiatives preserved.

Coordinator `/root`, codex-direct, revision 2026-10-13-r1. Release verification completed 2026-10-13 15:18 Asia/Krasnoyarsk. Base HEAD 7263d4996928bb58bc4b21f9b45995374725b805 plus scoped edits over the existing dirty workspace. No unrelated edits reverted, staged or committed. No adjacent phase closed.

## Result

- Backend: `/opt/krasterisk-voice-robots`; PM2 `krasterisk_voice_robots`, PID 2723705, zero restarts, autostart saved. Existing pm2-root service already enabled; saved list backed up privately before save.
- Listener: `127.0.0.1:5013`. Health returned `{profile:"v3-voice-robots",ari:true,vad:true}`.
- Runtime drops from the PM2 root child to `krsk-voice-robots`. Dedicated cgroup: memory.max 1610612736, memory.high 1342177280, cpu.max `150000 100000`, pids.max 96. Robot session cap 3. Final PM2 RSS approximately 140 MiB; available host RAM 8173 MiB; load 0.89/0.96/0.93.
- Static entry: https://mpbx.krasterisk.ru/modules/voice-robots/standalone.html#/voice-robots. Module-local `api.php` checks existing v3 PHP session/admin level 1 or 5 and derives tenant from users.user_uid. Mutations require same-origin HTTPS JSON. `module.php` is a future iframe include target. Existing index.php is unchanged.
- Dedicated MySQL account `krsk_voice_robots@localhost`: CRUD only on eight new tables, SELECT only on v3 catalogs and selected users columns. Protected maintenance credentials used only by installer; unchanged v3 DB-account privileges. Secrets remain on server under `/etc/krasterisk-voice-robots`, not in assets or local evidence.
- Database `krasterisk`: 71→79 tables. Added only voice_robots, voice_robot_keyword_groups, voice_robot_keywords, voice_robot_logs, voice_robot_cdr, voice_robot_data_lists, stt_engines, tts_engines. All original table DDL verified unchanged after normalizing live AUTO_INCREMENT counters.
- Asterisk HTTP prefix `/asterisk` preserved. User had enabled res_ari.so while resource modules remained Not Running/use count 0. Loaded only res_ari_applications, res_ari_asterisk, res_ari_bridges, res_ari_channels, res_ari_events, res_ari_playbacks, res_ari_recordings, res_ari_sounds. Each then Running; app mpbx_voice_robots registered. Normal module load succeeded directly: no unload, core reload or restart. Eight active calls before and after this activation, no calls generated by deployment.

## Gates

| Gate | Status / evidence |
|---|---|
| Backend TypeScript build | PASS, artifacts/mpbx-backend-build.log |
| Frontend TypeScript and production build | PASS, artifacts/mpbx-frontend-typecheck.log and mpbx-frontend-build.log |
| Required npm run lint | PASS, zero errors, existing warnings; mpbx-required-lint.log |
| Final scoped lint | PASS, zero errors, one existing unused SCSS import warning; mpbx-scoped-lint-final.log |
| Required npm run test:backend | PASS, 411 suites / 3983 tests; 1 suite / 11 tests skipped; mpbx-required-backend-tests.log |
| Required npm run test:frontend | FAIL, 346 files / 1925 tests passed, 1 file / 6 tests failed. SoftphoneContacts.test.tsx lucide-react mock lacks CheckCheck required by shared TableToolbar; these files were not edited in this assignment. mpbx-required-frontend-tests.log |
| Scoped frontend tests | PASS, 10 files / 26 tests; mpbx-scoped-frontend-tests.log |
| Scoped HTTP/security/schema/secret tests | PASS, 5 tests; mpbx-targeted-tests.log |
| Local browser | PASS, five routes, STT/TTS forms and unsupported vendor exclusion; real static with mocked API. mpbx-browser-smoke.log / mpbx-standalone-local.png |
| MySQL migration rehearsal | PASS on separate random temporary schema; twice/idempotence, exact columns, FK rejection; schema removed. mpbx-migration-test.log |
| Production additive migration | PASS, table delta exactly 8; original DDL unchanged; mpbx-deploy.log and mpbx-final-verification.log |
| PHP syntax / live auth / CSRF / tenant CRUD | PASS; actual existing admin v3 session used internally, no credential/cookie exported. Read catalogs, CRUD inactive robot/group/keyword/STT/TTS, matcher, foreign tenant GET/PUT rejection; all smoke rows removed. mpbx-live-smoke.log |
| ARI / Silero VAD | PASS, health and registration; mpbx-ari-activation.log |
| Existing production unaffected | PASS, original PM2 PIDs 1234/1235/1241 and restart counts 0, original protected file hashes unchanged, existing HTTPS UI 200, Asterisk uptime continues and last reload remains the user's earlier action; mpbx-final-verification.log |
| Actual STT/TTS conversation / robot capacity | PENDING: no real providers or dialplan routes seeded, no production call/load test performed |

## Reproduction and rollback

Source/build/install/rollback instructions: deploy/voice-robots-standalone/README.md. Uploaded runtime archive SHA256 `c0bcce10deef741c57a3835f0b252c733f973bc95d8ecd1cbdea13f5841c2396`; module.php added separately afterward. Host private metadata/PM2 snapshots at `/opt/krasterisk-voice-robots/evidence`, including before.json, legacy-schema.json, migration.json, final.json and the pre-save PM2 dump. Do not export that dump: it may contain existing application secrets.

Runtime supports Yandex STT/TTS and custom HTTP STT. Semantic embeddings are explicitly disabled for the bounded pilot; lexical keyword matching and Silero VAD work. Restarting only the new PM2 app is sufficient for its configuration changes. Do not change existing PM2 apps or use global deployment workflows. All writers finished; next action is provider setup and an explicitly requested call route/UAT, not another deployment loop.
