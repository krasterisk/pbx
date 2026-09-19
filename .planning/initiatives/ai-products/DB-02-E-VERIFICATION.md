# DB-02-E — integration verification (partial)

**Status: runtime matrix passed; DB-02-E remains a partial closure. DB-02-D2 is explicitly excluded from this initiative and belongs to the separate autodial task; independent review is still pending.** Verified 2026-09-18 on `root@ipbx.krasterisk.ru`; local Docker not used. Fresh Testcontainers: MySQL 8.4.11 and PostgreSQL 17.11, Node 22.23.2, Sequelize 6.37.8. Schema through `0003-callcenter-report-keys.sql` was installed and checked before AppModule startup. No live PBX, production DB, paid provider or external recording was touched.

| Gate | MySQL | PostgreSQL |
|---|---|---|
| Migration/config/schema contracts incl duplicate preflight | 11/11 | 11/11 |
| Actual AppModule, core auth/refresh/tenant/provider API | PASS | PASS |
| CDR list, stats, charts, drill-down, CSV | PASS | PASS, identical result |
| КЦ queue_log reader, replay, tenant/raw/daily rollup | PASS | PASS, identical result |
| Scenario robot last-tag filter/search/distinct | PASS | PASS, identical result |

Runtime logs: [MySQL](evidence/db-02-e/mysql-e-runtime.txt), [PostgreSQL](evidence/db-02-e/postgres-e-runtime.txt). Canonical JSON results are byte-equivalent after removing `dialect` labels. MySQL runtime required an explicit disposable provider key; PostgreSQL connection timeout was increased to 60s **only in the CI harness** after a 10s timeout on the shared test server. Both final runs passed. Fresh testcontainers removed by the harness.

After collecting evidence, the two separately started manual DB-02 containers and exact resolved `/tmp/krasterisk-db02-*` work directory were removed; SSH tunnels and local temporary bundles were closed/removed. `docker ps` showed only the pre-existing `xray-ui` container.

Local checks: `npm run lint` passes (warnings, no errors); `npm run test:backend` 251 suites / 2896 tests pass, 1 suite skipped; `npm run test:db:unit` 45/45; `npm run test:db:schema` 6/6; shared/backend builds pass; `git diff --check` pass. `npm run test:frontend` starts with filesystem access but has the existing `ConferenceRoomFormModal.test.tsx` locale assertion failure (`conferences.history.empty`) and hangs afterward; it was stopped. No DB-02 frontend code was changed. The separate sandboxed attempt could not read `vite.config.ts` due ACL; that was a harness access issue, not a test verdict.

CI definition [database-contracts.yml](../../../.github/workflows/database-contracts.yml) runs schema and full runtime goldens per dialect on fresh containers. The workflow file is staged locally; no GitHub CI run or PR exists yet. An **independent** reviewer has not reviewed this DB-02 diff; local self-checks are not labelled as independent review.

Remaining closure conditions in this initiative: independent review of migrations/history, tenant scope and error normalization. DB-02-D2 implementation, its dual-DB golden/concurrency tests and the resulting final runtime gates belong solely to the separate autodial task by explicit user direction; they are not a handoff target here. DB-03 owns Asterisk queue_log/CDR/CEL writer/ODBC and live PBX parity. DB-04 owns per-engine install/upgrade/backup assumptions, legacy unversioned MySQL reconciliation and release matrix.

After these server logs, a targeted tenant-collision correction was made to the call-center reconciler. Its new 8/8 Jest regression and backend build pass; a fresh matrix is required before DB-02 as a whole can be attested for this later revision. It is not coupled to, or a reason to edit, the separate autodial scope.

Read-only SQL inventory also found `packages/backend/src/sync.ts`, a dormant legacy entry point with an embedded database credential and `sync({ alter: true })`. It has been replaced with an explicit refusal and contains no credential now. Its historical exposure requires credential rotation and git-history/access review by the environment owner; this task did not connect to or change the named database. Backend build and lint pass after the replacement; final full gates remain after D2.
