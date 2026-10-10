# Release 4.6.8 — PLAN / EXECUTION

Coordinator / sole release writer: Codex /root, codex-direct.
User authorizes repeat current changes commit/push to krasterisk/pbx main and deploy to 185.177.216.132, next patch release 4.6.8.
Baseline main e5a1e202; production 96b67a48, healthy, zero calls. N13/r5 coordinator idle; preserve completed source and evidence.
Tasks: root manifest/lock version, audit/snapshot, exact-snapshot lint/backend/frontend/build CI gates, Linux images, fresh verified private backup, migration status, switch with rollback, authenticated production smoke.
Owned: release manifests, this record and own registry row, operational scripts and concrete release blockers. No agents or other phase execution. Exclude generated tsbuildinfo; dependencies/backend/migrations unchanged. No customer bootstrap or Asterisk restart.
Prior local evidence: lint/type PASS, backend 388 suites/3662 tests PASS, frontend 329 files/1749 tests PASS, targeted 4 files/50 tests PASS; 18 local Chromium mocked scenarios. Device/screen-reader/human UAT remain separate and pending.
Status: in_progress. Next: commit/push, exact CI/build/backup and production switch/smoke.
