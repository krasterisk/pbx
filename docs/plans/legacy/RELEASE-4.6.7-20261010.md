# Release 4.6.7 — PLAN / EXECUTION

Coordinator / sole release writer: Codex /root, codex-direct.
User authorizes current changes commit/push to krasterisk/pbx main and deploy to 185.177.216.132, next patch release 4.6.7.
Baseline main 6fa6c419, production bef2865f, healthy, zero calls. Navigation r4 coordinator idle; preserve completed changes and evidence.
Tasks: root manifest/lock version, audit/snapshot current sources/docs, exact-snapshot required lint/backend/frontend/build CI gates, Linux images from published source, fresh private verified backup, clean migration status, switch with rollback, authenticated production smoke.
Owned: release manifests, this record and own registry row, operational scripts and concrete release blockers. No subagents or other phase execution. Exclude generated tsbuildinfo. No dependency/backend/migration changes at baseline. Do not rerun bootstrap or restart Asterisk.
Prior source evidence: local lint PASS (121 backend/80 frontend warnings, zero errors), backend 388 suites/3662 tests PASS, frontend 329 files/1742 tests PASS, latest UI 2 files/29 tests PASS, typecheck PASS. Human/device/screen-reader/UAT pending in original navigation initiative; do not claim those as passed.
Status: released. All required release gates PASS. Next: none in release scope.

Interim: snapshot b3177122 (72 files) published, final 96b67a48 trims one SCSS trailing blank line; full release diff whitespace PASS. Dependencies unchanged. Empty stale Git lock from 12:29:37 removed after checking no git processes and copying original file to Documents/Codex/release-4.6.7-stale-index.lock.
Backup verified: /opt/krasterisk/backups/20261010-4.6.7, PostgreSQL dump 527307 bytes / mode 600, Asterisk config and production env. Baseline authenticated API smoke PASS. Candidate PostgreSQL full-pbx status 0032, pending [], dirty null. MySQL/PostgreSQL contract CI 38038606721 PASS. Full app CI/build/release still pending.

## Release acceptance — 2026-10-10 08:51 UTC

- Application/source SHA **96b67a48047f99d063cd9812bb7e49824c0f473a**, version **4.6.7**, pushed to krasterisk/pbx / main.
- Exact-commit CI PASS: quality 38038620805, E2E 38038620852, harness 38038620804. Applicable MySQL/PostgreSQL contracts 38038606721 PASS at b3177122; only subsequent source change is trailing whitespace in a frontend stylesheet.
- Required lint PASS, backend **388 suites / 3662 tests** PASS (11 skipped), frontend **329 files / 1743 tests** PASS, full shared/backend/frontend build PASS. Existing lint/chunk-size/circular re-export warnings are not errors. Source-origin local checks additionally retained in navigation evidence; no duplicate broad local run needed.
- Linux backend image sha256:ad5e93d084d17afe9a7767546122d79788c1dd4f06690d79ad9348b5da4a35ef; frontend sha256:3be44af5e50618c9ed6cb8144931fa7968cbf575ffa2b7bfd540aedf70b747c7. Built from exact source using unchanged installed dependency graph as base; root manifest inside active container is 4.6.7.
- Production /opt/krasterisk/src -> /opt/krasterisk/releases/96b67a48; backend/frontend image tags 96b67a48. Only application containers recreated. Native Asterisk uptime unchanged (1 week 1 day), zero active calls at switch; Komandor contact Avail; PostgreSQL healthy.
- Backup /opt/krasterisk/backups/20261010-4.6.7 verified (pg_restore list, private mode 600). PostgreSQL migration status full-pbx 0032, pending [], dirty null; runner applied no new DDL.
- Authenticated production smoke PASS: version, health, box auth policy/registration disabled, existing admin login/logout, 2 subscribers (no trunks), 1 context, 1 trunk, 2 route details, tenant settings, frontend HTML and JS asset. Public /api/health ok. Startup 502 responses cleared in health polling.
- Automatic rollback trap not needed. Previous source/image bef2865f saved in release/rollback-baseline.txt; fresh DB/config/env backup available. No customer bootstrap, license/firewall changes or Asterisk restart.
- Evidence: C:/Users/Professional/Documents/Codex/release-4.6.7-* and actions-38038620805.log. Server release contains health-after.json, auth-after.json, smoke-after.log. No credentials/tokens in this record.

No pending release gates or active release writers. Human/device/screen-reader/UX-UAT gates in navigation initiative remain separate and pending; mocked Chromium and this API smoke do not certify them. No other initiative state changed. A documentation-only acceptance commit may follow deployed application SHA without altering runtime.
