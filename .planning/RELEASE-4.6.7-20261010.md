# Release 4.6.7 — PLAN / EXECUTION

Coordinator / sole release writer: Codex /root, codex-direct.
User authorizes current changes commit/push to krasterisk/pbx main and deploy to 185.177.216.132, next patch release 4.6.7.
Baseline main 6fa6c419, production bef2865f, healthy, zero calls. Navigation r4 coordinator idle; preserve completed changes and evidence.
Tasks: root manifest/lock version, audit/snapshot current sources/docs, exact-snapshot required lint/backend/frontend/build CI gates, Linux images from published source, fresh private verified backup, clean migration status, switch with rollback, authenticated production smoke.
Owned: release manifests, this record and own registry row, operational scripts and concrete release blockers. No subagents or other phase execution. Exclude generated tsbuildinfo. No dependency/backend/migration changes at baseline. Do not rerun bootstrap or restart Asterisk.
Prior source evidence: local lint PASS (121 backend/80 frontend warnings, zero errors), backend 388 suites/3662 tests PASS, frontend 329 files/1742 tests PASS, latest UI 2 files/29 tests PASS, typecheck PASS. Human/device/screen-reader/UAT pending in original navigation initiative; do not claim those as passed.
Status: in_progress. Next: commit/push, CI/build/backup, deployment/smoke.
