# Autodial deployment 4.7.1.1 — PLAN / EXECUTION

**Current checkpoint is the final section below; earlier dated sections are history.**

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

## Final deployed acceptance — 2026-10-18

Status **released / live-verified**: R1–R6 complete, all assigned gates PASS. Final source427a5059, version4.7.1.1.
User explicitly approved0048; published12ff8238 contains only both SQL files,48-only manifest and runner test.
Neighbor0049 and AI Robots/CDR/callcenter/marketplace source remain excluded. No production DDL was needed.

12ff8238 deployed successfully with strict schema0048 readiness. Actual deployed password login, DeepSeek68 AI workflow63
(thread157) and explicit UI apply created new base5/campaign5draft. Contact18: Тестовый клиент,15240.50RUB.
All six actual UI preflight checksready; no campaign task/attempt was created. Preview7.864s, readyState4,no media error.
First UI internal call9e256ca2 connected but FAILED speech: erased DTO metadata caused strict ValidationPipe HTTP400.
Fixed and published17d6b143: runtime DTO imports; actual HTTP regression asserts valid200,wrong-key401,extra-field400.
Configured a nonempty private DIALPLAN_API_KEY; no authentication bypass. HTTP regression2suites7tests, backend rebuild,
compiled DTO metadata and targeted lint PASS.

Successful UI internal call **3d539cf9-37c4-4014-a354-0ba33f1c6849** on17d6b143:

- Actor367, own endpoint e00991418_0, existing dedicated loopback trunk t_uat_ac_loop_20260921.
- Runtime AMI text equals preview: «Тестовый клиент ваша сумма составляет пятнадцать тысяч двести сорок рублей пятьдесят копеек».
- Backend returned promptbf408e9a959476e626de6f87; speech ran before normal cause16 hangup.
- Synthesized PCM8k mono WAV125868bytes/7.864s; receiving SIP MixMonitor125804bytes/7.86s/RMS1702.57.
- Recorded/synthesized PCM correlation **0.999901**,lag0. Recording SHA256
  e14307c2f89676e5e72d5a3add22f7d6a16fe1286961daff48e92b3c2fc5006f.
- Database ended/cleanup_done1; campaigndraft,0tasks/attempts; original four campaign states unchanged.

Recording retained privately at C:/Users/Professional/Documents/Codex/autodial-release-4.7.1.1-call.wav and on the stand.
Local evidence release-call-ami.json,release-deployed-db.json,release-deployed-{preflight,preview,call}.png stays unpublished.
This proves actual playback to the receiving SIP leg; no manual listening/ASR claim. Custom HTTP/SAPI provider69 was used;
preexisting global Yandex64 authentication was not repaired/verified. No external subscriber call or independent review.

17d6b143 full [quality](https://github.com/krasterisk/pbx/actions/runs/39096997738) PASS: lint/version/build,
shared180,backend457suites4409tests (27opt-in skipped),frontend425files2339tests.
[Harness](https://github.com/krasterisk/pbx/actions/runs/39096997723),
[E2E](https://github.com/krasterisk/pbx/actions/runs/39096997753) and
[real MySQL/PG contracts](https://github.com/krasterisk/pbx/actions/runs/39096997739) PASS.
Final427a5059724f3884e131da4b7bfa09c772f5a2aa only removes an untranslated BasesList toolbar label override;
the shared translated delete label/count applies. Backend/shared/dependency source unchanged; toolbar13tests PASS.
Final [Linux package](https://github.com/krasterisk/pbx/actions/runs/39097730853) PASS,artifact12124774718,
ZIPsha256ca4d717585dd6d771d816070877e150e73d71382b686accf272f8ec9bfc2c3e4;
tarSHA256180d97d9f8914478f356e9abbf7b906d263ca6fe39e7415c2c16662b9d025ab4. Both verified on the stand before extraction.
Final [quality](https://github.com/krasterisk/pbx/actions/runs/39097726685),
[E2E](https://github.com/krasterisk/pbx/actions/runs/39097726717) and
[harness](https://github.com/krasterisk/pbx/actions/runs/39097726726) PASS. DB contracts unchanged from passing17d6b143.

Service krasterisk-v4 uses atomic /var/lib/krasterisk-v4/current, loopback5010, heap512MiB/MemoryMax768M/Swap384M.
Nginx/v4 preserves legacy PHP root. Private env0600 and exact APP_GIT_SHA; no historical-key access.
Fresh backup /var/backups/krasterisk-autodial-4.7.1.1-pre-activation, DB gzip SHA256
54e4e324c2f2244c4992cb268dab8601c21b1121ef8fd485333bbb36b7d41f3d, gzip/hash verified,600/700.
Application rollback restores the previous current symlink/APP_GIT_SHA and restarts only the new service; no DB restore required
for this no-DDL release. Rollback prepared, not claimed as an executed outage test. Asterisk/unrelated services not restarted.

Campaign/base/contact removed through UI; principal367/sessions/provider69/endpoint/AOR, own loopback file/prompt and local
TTS/AMI observer/reverse tunnel removed. Audit/workflow retained, own thread archived. Temporary label-check account368 logged out
and removed with its sessions; private tracking password discarded. Actual final UI shows «Удалить выбранные (1)»; selection cleared
without changing existing bases. Final DB check:0test accounts/sessions/provider/endpoint/AOR/campaign/base/contact/tasks/attempts,
original campaign states equal baseline. Own four download-staging directories removed; prior release tree retained, disk free4.09GB.

Final host check (`release-final-host.json`) PASS: public legacy root,/v4/ and/api/health HTTP200; service/nginxactive;
healthok/version4.7.1.1/SHA427a5059724f3884e131da4b7bfa09c772f5a2aa/schema0048; APIbound127.0.0.1:5010;
0active channels/calls; temporary endpoint unavailable and reverse listener removed. **All2092 compiled backend files are
byte-identical to the17d6b143 backend accepted by the real call.** Final frontend correction does not weaken call evidence.
Own captures remain local; credentials/private logs excluded from GitHub. Final source push verified against origin/main;
acceptance documentation is a subsequent docs-only commit. No pending assigned gate or live fixture writer remains.
