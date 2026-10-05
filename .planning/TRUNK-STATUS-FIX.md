# Trunk status correction

Coordinator Codex /root; mode codex-direct; baseline main 6a9e64a5, server f4e998e5-acres.
Scope: backend trunk list/live reachability/qualify resync, frontend API + shared status rendering/mobile/polling/i18n and tests. Existing dirty main.ts/0031 SQL excluded.
Plan T1: AMI contact status separate from registration, fail unknown on AMI error and tenant-only probes; T2: shared desktop/mobile badge + 15s polling + available counts; T3: regression/unit/build/lint and CI gates; T4: deploy checked patch, live browser verification.

Implemented T1/T2. New reachabilityStatus is independent of registrationStatus; only tenant-owned t_* endpoints are probed, bounded 8 actions per batch. Unknown on AMI failure; NonQualified distinct from Unreachable. No registration query for IP-only lists. Safe qualify CLI synchronization after create/update. Shared TrunkStatus renders desktop/mobile; list polls 15s, cached status becomes Unknown on HTTP error.

## Gates, 2026-10-05

- lint PASS: 0 errors (existing 116 backend/87 frontend warnings).
- backend PASS: npm run test:backend, 374 suites / 3543 tests, 11 existing skips. Final guard changes: targeted 15 tests passed; final complete suite passed in quality CI.
- frontend targeted PASS: 6 badge tests. Full suite PASS in quality CI and locally on Windows: 300 files / 1599 tests, exit 0.
- backend/frontend builds PASS locally and in CI. Existing Rollup circular-chunk / size warnings remain.
- GitHub Actions for 45b96197: quality 37287982411, harness 37287982270, e2e 37287982210, Database contracts 37287982161 all completed success.
- live PASS: production browser desktop (1440x900) and mobile (390x844), komandor shows green Доступен and 1 доступно. Status remains displayed after multiple polling periods. Offline/unqualified/error states verified in unit tests, not induced on production.
- release PASS: backend/frontend images 45b96197 deployed to 185.177.216.132. Health ok; AMI/ARI connected; restarts 0; Asterisk t_komandor_0 contact Avail (~15ms). Box mode and registrationEnabled=false preserved.

## Release composition / rollback

Code commit 45b96197 pushed to krasterisk/pbx main. Backend image based on existing f4e998e5-acres, replaces only compiled trunks.service.js/trunk-reachability.util.js and owned source directory. Frontend built from committed 45b96197 source with existing Linux dependencies, VITE_API_URL=/api. No schema migration or Asterisk restart needed. Release source: /opt/krasterisk/releases/45b96197; production secrets remain external. Dirty main.ts/0031 excluded from commit/image.
Previous source/tag recorded in release/rollback-baseline.txt; trunk-deploy.sh restores previous symlink/tag and containers on failed health. Runtime image tag 45b96197.
Screenshots: C:/Users/Professional/Documents/Codex/trunk-status-desktop.png and trunk-status-mobile.png.

Status complete, released, live-verified. All required gates passed; no next implementation/deployment action.
