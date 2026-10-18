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
