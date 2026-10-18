# Autodial deployment 4.7.1.1 — PLAN / EXECUTION

Coordinator /root, codex-direct, sole writer. User assignment 2026-10-18: commit/push with versioning, deploy to ipbx.krasterisk.ru,
then verify AI campaign creation, preflight and internal test call with customer speech in the deployed application.
Baseline main5da23135 (origin identical); autodial implementation already committed by release230acec8. Foreign dirty AI robot,
marketplace, CDR and callcenter changes excluded; no stash/reset or broad git add.

Tasks: R1 inspect live app/release topology and current config; R2 bump4.7.1.0→4.7.1.1 and commit scoped docs/version;
R3 clean-source lint/backend/frontend/build/version/schema verification and verified GitHub push/CI;
R4 private current app/DB/config backup, migration readiness/upgrade rehearsal as needed, deploy exact published revision with rollback;
R5 actual authenticated browser AI plan→explicit apply→preflight→internal synthetic contact TTS test, verify speech and cleanup;
R6 acceptance report, release metadata, verified final push. No external subscriber calls or unrelated services/grants.

Owned: version metadata, autodial release docs/scripts and scoped fixes found in acceptance. Source builds use a clean export of
the release commit so unrelated work in the shared checkout is preserved. No delegated agents. Status in_progress, next R1.

## Checkpoint 2026-10-18 10:27 Asia/Krasnoyarsk

R1/R2 complete; R3 initial96519d1f all CI PASS, finalf3fb621f CI/bundle pending. Local backend4406/lint/build/version PASS;
full frontend PASS in CI, local duplicate stopped intentionally at batch36. Source unchanged in frontend since that passing CI.
R4 private backup/config ready, strict catalog48 permission pending; no migration/start/switch executed. Remote install stopped
after memory pressure; use CI Linux package39093437092. R5 disposable account/endpoint/provider/loopback ready, no call yet.
Current detailed ownership/resources and exact next action: EXECUTION.md deployment checkpoint.

## Prepared package / remaining gate — 2026-10-18

- Published runtime/source SHA a4d593bd26915b71668b6122b85cd68793a13ef0, application4.7.1.1. Verified origin/main matches.
- Full initial release CI96519d1f: shared180/backend4406/frontend2339 PASS, lint/build/version PASS; harness/E2E and real MySQL/PG PASS.
  Latest source a4d593bd: Linux bundle/harness/E2E PASS, quality still running at this checkpoint. Frontend source unchanged since96519d1f.
- Linux bundle39093685895/artifact12123463561 PASS, includes native bcrypt/shared/mysql2 runtime-load probes.
  ZIP SHA25617dc38b671d1d23ba1d7cba38d1486043460977e24eabf3813e52d7c1b9daa95;
  tar SHA25605f6e7256c9b920f8811dfb1c44a35a1ef6ba649560f3f72b0fda67b7e53d10e.
  Both independently recomputed locally and on the stand. Remote prepared package:
  /var/lib/krasterisk-v4/bundle-12123463561/krasterisk-linux.tgz. No activation or nginx change.
- First bundle failed because production npm ci invoked shared/prepare after removing dev types; corrected by pruning already
  installed/built dependencies with scripts disabled. Passing replacement above supersedes39093437092.
- Own aborted installer and partial staging tree removed after verifying exact cwd/no live writers. Host available memory recovered
  to895MiB. Existing n8n/MySQL/PHP/Asterisk services untouched. Own account/endpoint/provider and TTS listener/tunnel remain ready.
- **Required decision pending:** permission to publish the already-applied0048 SQL (MySQL+PG), manifest and runner-test update
  from neighboring AI Robots scope. Current applied checksum equals the proposed SQL bytes; candidate runner57PASS. No robot
  implementation source proposed for this release. Never bypass strict readiness, rewrite applied history or silently commit foreign work.
- R4 deployment and R5 deployed UI/call acceptance remain pending. This release assignment is not complete or live-verified.
