# Release 4.6.9 — PLAN / EXECUTION

Coordinator / sole release writer: Codex /root, codex-direct.
User authorizes repeat current changes commit/push to krasterisk/pbx main and deploy to 185.177.216.132, next patch release 4.6.9.
Baseline main 7b12985c; production b3eaa72f, healthy, zero calls. Navigation N18/r10 coordinator idle; preserve completed source and evidence.
Tasks: root manifest/lock version, audit/snapshot, exact-snapshot lint/backend/frontend/build CI gates, Linux images, fresh verified private backup, migration status, switch with rollback, authenticated production smoke.
Owned: release manifests, this record and own registry row, operational scripts and concrete release blockers. No agents or other phase execution. Exclude generated tsbuildinfo; dependencies/backend/migrations unchanged. No customer bootstrap or Asterisk restart.
Prior local evidence: lint/type PASS, backend 388 suites/3662 tests PASS, frontend 331 files/1769 tests PASS, targeted 5 files/66 tests PASS; 22 local Chromium mocked checks. Device/screen-reader/human UAT remain separate and pending.
Status: released. All required release gates PASS. Next: none in release scope.

Interim: exact 96-file snapshot 35c29abd published, dependency graph unchanged, whitespace gate PASS. Verified private backup /opt/krasterisk/backups/20261011-4.6.9 (dump 527592 bytes, mode 600, pg_restore list; Asterisk config/env). Baseline authenticated production smoke PASS. Candidate PostgreSQL full-pbx status 0032, pending [], dirty null. MySQL/PostgreSQL contract CI 38071459221 PASS. Release smoke additionally checks the exact AppBrand PNG path/content type. Final app CI/build/deploy pending.

## Release acceptance — 2026-10-11 (Asia/Krasnoyarsk)

- Application/source SHA **35c29abd256cd6dd7dc45d792e885a4970638903**, version **4.6.9**, pushed to krasterisk/pbx / main.
- Exact-commit CI all PASS: quality **38071459226**, E2E **38071459197**, harness **38071459191**, MySQL/PostgreSQL contracts **38071459221**.
- Required lint PASS; backend **388 suites / 3662 tests** PASS (11 existing skips); frontend **331 files / 1769 tests** PASS; full shared/backend/frontend build PASS. Existing warnings are not errors. Harness API/realtime 25 passed / 3 skipped; Chromium 32 passed / 1 skipped / 1 passed on retry (known agent-smoke Start shift case, reported flaky). No failed final workflow or unconfirmed native/live-model test claimed.
- Linux images built from exact published source using unchanged dependency graph as base. Backend sha256:67786823218f856000d0ccb307fffd495d91e7696fe30c4d3c35b2d9ed98c251; frontend sha256:d3324481885862db19819abeae1881e5e4d47fa3ea6627832416a90d7c8e3633. Active backend root manifest version 4.6.9 confirmed.
- Production /opt/krasterisk/src -> /opt/krasterisk/releases/35c29abd, both application image tags 35c29abd. Only backend/frontend recreated. Zero active calls at switch; native Asterisk uptime unchanged (1 week 1 day 12 hours), Komandor contact Avail; PostgreSQL healthy.
- Private backup /opt/krasterisk/backups/20261011-4.6.9 verified (527592-byte PostgreSQL dump, mode 600, pg_restore list; Asterisk config/env and previous source/tag). Candidate PostgreSQL full-pbx 0032, pending [], dirty null; migration runner PASS, no new migration files.
- Authenticated production smoke PASS at 2026-10-10 17:34 UTC: release version, health, box policy/registration disabled, existing admin login/logout, 2 subscribers (no trunks), 1 context, 1 trunk, 2 route details, tenant settings, frontend HTML and JS asset, exact AppBrand PNG path/content type. External /api/health ok. Brief startup 502s resolved in health polling.
- Automatic rollback trap not needed. Previous source/image **b3eaa72f** saved in release/rollback-baseline.txt; fresh database/config/env backup available. No customer bootstrap, entitlements/firewall changes or Asterisk restart.
- Evidence: C:/Users/Professional/Documents/Codex/release-4.6.9-* and actions-38071459226.log / actions-38071459191.log. Production release holds health-after.json, auth-after.json, smoke-after.log. No credentials/tokens in this record.

No pending release gates or active release writers. Real-device/screen-reader/human UAT in original navigation initiative stay separate and pending; mocked Chromium and API smoke do not certify them. No neighboring initiative state changed. Acceptance documentation can follow deployed application SHA without modifying runtime.
