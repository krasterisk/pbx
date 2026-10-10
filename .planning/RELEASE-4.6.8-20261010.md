# Release 4.6.8 — PLAN / EXECUTION

Coordinator / sole release writer: Codex /root, codex-direct.
User authorizes repeat current changes commit/push to krasterisk/pbx main and deploy to 185.177.216.132, next patch release 4.6.8.
Baseline main e5a1e202; production 96b67a48, healthy, zero calls. N13/r5 coordinator idle; preserve completed source and evidence.
Tasks: root manifest/lock version, audit/snapshot, exact-snapshot lint/backend/frontend/build CI gates, Linux images, fresh verified private backup, migration status, switch with rollback, authenticated production smoke.
Owned: release manifests, this record and own registry row, operational scripts and concrete release blockers. No agents or other phase execution. Exclude generated tsbuildinfo; dependencies/backend/migrations unchanged. No customer bootstrap or Asterisk restart.
Prior local evidence: lint/type PASS, backend 388 suites/3662 tests PASS, frontend 329 files/1749 tests PASS, targeted 4 files/50 tests PASS; 18 local Chromium mocked scenarios. Device/screen-reader/human UAT remain separate and pending.
Status: released. All required release gates PASS. Next: none in release scope.

Interim: exact 19-file snapshot b3eaa72f published, dependency graph unchanged, whitespace gate PASS. Private backup /opt/krasterisk/backups/20261010-4.6.8 verified (pg_restore list, dump 527416 bytes / mode 600; Asterisk config and env preserved). Baseline authenticated production smoke PASS. Candidate full-pbx PostgreSQL status 0032, pending [], dirty null (checked after image tagging). CI MySQL/PostgreSQL contracts 38050337174 PASS; E2E 38050337181 PASS. Full quality/harness/build/release still pending.

## Release acceptance — 2026-10-10 12:12 UTC

- Application/source SHA **b3eaa72f54529113c7fa7481a49ca1efe924f0d6**, version **4.6.8**, pushed to krasterisk/pbx / main.
- Exact-commit CI all PASS: quality **38050337175**, E2E **38050337181**, harness **38050337166**, MySQL/PostgreSQL contracts **38050337174**.
- Required lint PASS; backend **388 suites / 3662 tests** PASS (11 existing skips); frontend **329 files / 1749 tests** PASS; full shared/backend/frontend build PASS. Existing warnings are not errors. Harness: 25 API/realtime passed / 3 skipped; Chromium: 33 passed / 1 skipped. No live-model/native checks claimed for skipped tests.
- Linux images built from exact source with unchanged installed dependencies as base. Backend sha256:3f39ee935005723f507d83425a575b7f850d6648ac5858cb4c143c5ec61c87bb; frontend sha256:c79bd6085d12788e144a0c61e0f85da122221d90bfc1ebb71336da13cad4aa00. Active backend root manifest version confirmed as 4.6.8.
- Production source /opt/krasterisk/src -> /opt/krasterisk/releases/b3eaa72f; both application image tags b3eaa72f. Only backend/frontend containers recreated. Zero calls at switch; native Asterisk uptime unchanged (1 week 1 day 7 hours), Komandor contact Avail; PostgreSQL healthy.
- Private backup /opt/krasterisk/backups/20261010-4.6.8 verified via pg_restore list (dump 527416 bytes, mode 600), with Asterisk config, production env and previous source/tag. Candidate PostgreSQL full-pbx 0032, pending [], dirty null; migration runner PASS with no new migration files.
- Production authenticated smoke PASS: release version, health, box auth/registration disabled, existing admin login/logout, 2 subscribers (no trunks), 1 context, 1 trunk, 2 route details, tenant settings, frontend HTML and JS asset. External /api/health ok. Brief startup 502s resolved in health polling.
- Automatic rollback trap not needed. Previous source/image **96b67a48** saved in release/rollback-baseline.txt; fresh database/config/env backup available. No customer bootstrap, entitlements/firewall changes or Asterisk restart.
- Evidence: C:/Users/Professional/Documents/Codex/release-4.6.8-* and actions-38050337175.log / actions-38050337166.log. Production release stores health-after.json, auth-after.json, smoke-after.log. No credentials/tokens in this record.

No pending release gates or active release writers. Real-device/screen-reader/human UAT in original navigation initiative remain separate and pending; mocked Chromium and API smoke do not certify them. No neighboring initiative state changed. A documentation-only acceptance commit may follow the deployed application SHA without changing runtime.
