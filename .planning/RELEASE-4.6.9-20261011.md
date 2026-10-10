# Release 4.6.9 — PLAN / EXECUTION

Coordinator / sole release writer: Codex /root, codex-direct.
User authorizes repeat current changes commit/push to krasterisk/pbx main and deploy to 185.177.216.132, next patch release 4.6.9.
Baseline main 7b12985c; production b3eaa72f, healthy, zero calls. Navigation N18/r10 coordinator idle; preserve completed source and evidence.
Tasks: root manifest/lock version, audit/snapshot, exact-snapshot lint/backend/frontend/build CI gates, Linux images, fresh verified private backup, migration status, switch with rollback, authenticated production smoke.
Owned: release manifests, this record and own registry row, operational scripts and concrete release blockers. No agents or other phase execution. Exclude generated tsbuildinfo; dependencies/backend/migrations unchanged. No customer bootstrap or Asterisk restart.
Prior local evidence: lint/type PASS, backend 388 suites/3662 tests PASS, frontend 331 files/1769 tests PASS, targeted 5 files/66 tests PASS; 22 local Chromium mocked checks. Device/screen-reader/human UAT remain separate and pending.
Status: in_progress. Next: commit/push, exact CI/build/backup and production switch/smoke.
