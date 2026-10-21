# Release 4.7.2.0 — PLAN / EXECUTION

- Coordinator: /root, codex-direct, 2026-10-21. No subagents.
- Human assignment: repeat version bump, commit/push current work to krasterisk/pbx main and deploy box 185.177.216.132.
- Baseline: main 10308472; existing staged repository-layout migration and application changes preserved.
- Owned paths: release version metadata, this release record; bounded fixes needed for release gates. Existing initiative designs are preserved; no adjacent phase execution.
- S1 implemented: inventory source/publication inputs; exclude private/generated outputs, keep .planning untracking.
- S2 automated-tests-passed: lint, backend/frontend tests, build, version/database checks. Fix concrete gate failures.
- S3 published: commit and push reviewed snapshot, inspect applicable GitHub Actions.
- S4 released / live-verified: access restored using krasterisk_ipbx_agent after direct user instruction to inspect other keys. Executing: fresh production/schema preflight, private backup, test upgrade and compatible rollback, build/redeploy backend/frontend, health/authenticated smoke.
- Preserve production credentials, customer module grants, firewall and native Asterisk configuration.
- Evidence: ARTIFACTS_ROOT/runs/release-4.7.2.0/20261021; root configured C:/Users/Professional/Documents/Codex/Artifacts/krasterisk_v4.
- Acceptance: published source with passing gates; live verification and release require actual deployment. No release claimed before S4.

## Gate update
- Version 4.7.2.0, synchronized by canonical version:set tool.
- lint PASS (0 errors; existing warnings), full build PASS (shared/backend/frontend).
- Backend PASS: 508 suites, 5017 tests; 27 skipped.
- Database runner PASS57/57, schema PASS10/10 after explicit reviewed ownership update for business_goal0053 and phone_sessions0055; immutable baseline SQL preserved. Metadata fingerprint29d62d84cf348a759e76594cd71d8635c0ccc272096c86bfbfe89f259049bb95; column delta125. No guard weakened.
- WebRTC consultation targeted PASS8/8. Full frontend and final CI passed (acceptance below).
- Publication: source/docs/tools and synthetic inputs included; .planning removed from tracking, never force-added. Private/generated outputs and unrelated API9057 deployment scratch excluded. No credential patterns found in selected files. Dependency declarations unchanged.
- Initial access attempt: supplied audit key rejected, deployment held. User authorized checking other local keys; krasterisk_ipbx_agent succeeded. Production changes occurred only after restored access and completed preparation.

## Publication and verification
- Runtime/source commit eda0a994; harness/workflow follow-ups efb5039c and e0d0a038 published to main. No application/manifests/lockfile changes after eda0a994. Selected source has no detected credential patterns.
- Final candidate e0d0a038: quality39601473987 PASS, harness39601473999 PASS, e2e39601474097 PASS. Database contracts39600202279 PASS on identical runtime/database source.
- Local frontend PASS482files/2639tests; CI same counts. Shared PASS19suites/180tests. Harness25API/realtime PASS3skip; Chromium33PASS1skip.
- First harness failed4 geometry cases because old seven-tab expectation did not match implemented five-step creation wizard; corrected to five and added aria-current verification. CI artifact upload now uses external /tmp path. These are superseded by final green runs.
- Server preflight: e6fce25e runtime/schema0035, 0 active channels, health/auth PASS, existing admin login/routes/assets/disabled-dashboard policy PASS. Customer grants/layout fingerprints recorded before switch.
- Private backup /opt/krasterisk/backups/20261021-4.7.2.0/database.dump (547258bytes/mode600), pg_restore list verified; Asterisk configuration and production env saved under umask077.
- Candidate images being built fresh from canonical Dockerfiles and exact published archive; dependency delta since e6fce25e requires npm ci. Stage-only upgrade/rollback checks completed; production switched successfully (acceptance below).

## Release acceptance — 2026-10-21 13:13 UTC

Status: **released / live-verified**. S1–S4 complete. No required release gate pending; no active release writer. Adjacent initiative acceptance remains unchanged.

- Published application/source **e0d0a0381a3cc6a78fd8c222452244809ce51969**, main; application4.7.2.0 / npm4.7.2. Follow-up acceptance commit changes documentation only.
- Final [quality39601473987](https://github.com/krasterisk/pbx/actions/runs/39601473987), [harness39601473999](https://github.com/krasterisk/pbx/actions/runs/39601473999), [e2e39601474097](https://github.com/krasterisk/pbx/actions/runs/39601474097) PASS. [MySQL/PostgreSQL contracts39600202279](https://github.com/krasterisk/pbx/actions/runs/39600202279) PASS on unchanged application/database source from eda0a994.
- Local mandatory lint/backend/frontend/build PASS. Frontend482files/2639tests; backend508suites/5017tests with27skipped; shared19suites/180tests; database runner57/57/schema10/10. CI confirms same application totals. Harness25API/realtime and33Chromium PASS (3/1skipped respectively). Native/live-provider/call acceptance is not implied by these unit/CI results.
- Canonical backend/frontend Dockerfiles built fresh on Linux from exact Git archive after dependency comparison with old e6fce25e. Native bcrypt, shared APP_VERSION and Silero ONNX CPU model-load probe PASS.
- Backend image sha256:89b223952e612c25cf1ed010fbdbdd9c0c706facfc97d8c14443153720d46231; frontend sha256:3fa58e0d88c94d44f4e056a9083d5d19a6b3688d853b8d48e0484a7fd2ca690d. Tag e0d0a038; /opt/krasterisk/src -> /opt/krasterisk/releases/e0d0a038.
- Actual private production dump restored on isolated loopback-only PG17, upgraded0035→0055 using canonical runner. All20pending migrations PASS, pending[], dirty null. New runtime and old runtime with forward migration catalog both pass startup schema readiness. Own temporary container/anonymous volume cleaned.
- Prepared compatible rollback tag rollback-4.7.2.0: old e6fce25e runtime/frontend plus new database catalog. Backend sha256:348a3a1280aaf0a1428b0abfeef64faae4d53008f09a7cd3a931db992116a067. Restore old source e6fce25e and use compatible tag; plain old tag rejects newer schema. Rollback readiness was tested on restored/upgraded DB; live application rollback was not triggered on this release.
- Production migrations0036–0055 applied, clean schema0055-phone-sessions.sql. Only backend/frontend recreated; PostgreSQL kept its existing container/volume. Startup502s cleared during bounded health polling.
- Authenticated live smoke PASS: configured admin login/logout, box registration disabled,2subscriber endpoints(no trunks),1context/1trunk/2routes and route details/settings; new CDR list/overview/facets; phone-session endpoint list; HTML/JS/brand assets.
- Customer policy exact match: core/apps/system/analytics active, other modules retain their off/locked/disabled policy. All4disabled-dashboard APIs enforce403. tenant_modules and tenant_hub_layout row counts/fingerprints unchanged after switch.
- External HTTP health PASS with version4.7.2.0, shae0d0a038, schema0055. Native Asterisk PID472654 / ActiveEnterTimestamp2026-10-02 unchanged;0channels/0calls at switch and postflight. No firewall/bootstrap/seed rerun or production call generation.
- Private recovery backup remains /opt/krasterisk/backups/20261021-4.7.2.0 (dump547258bytes/mode600, actual restore verified, config/env saved). Runtime image/source references and staging/migration evidence retained there.
- Raw local evidence: C:/Users/Professional/Documents/Codex/Artifacts/krasterisk_v4/runs/release-4.7.2.0/20261021 (build/test/CI/native/staging/deploy/postflight logs, archive, publication manifest). Current generated tsbuildinfo and excluded unrelated/private local files remain outside publication.

Next action: none for this release. Future work starts from released source/schema and current registry, without executing adjacent plans implicitly.

## Version correction — current bounded assignment r2

2026-10-21, /root codex-direct. User explicitly requested4.7.1.2 after correcting the mistakenly selected4.7.2.0. This is a build-number correction, not a rollback of application changes.

- VC1 in_progress: canonical version:set4.7.1.2; owned paths root/workspace manifests, lock metadata and shared/src/app-version.ts. Dependency graph and application implementation preserved.
- VC2 pending: version/identity targeted checks, commit/push main and applicable CI.
- VC3 pending: derive Linux backend from the currently verified e0d0a038 image, overlay only corrected metadata, rebuild shared; rebuild frontend from published source using the same installed dependencies. No fresh npm install needed.
- VC4 pending: verify unchanged clean schema0055 and0active channels, switch app containers, authenticated/external checks. Previous source/image e0d0a038 is the rollback baseline; no schema update required.
- Evidence: ARTIFACTS_ROOT/runs/release-version-correction/20261021-4712.
- Historical acceptance above remains evidence for the previous version label. Correction is not released until VC4 completes.
