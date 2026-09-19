# D1 current-revision remote matrix

Executed 2026-09-19 on `root@ipbx.krasterisk.ru` with `krasterisk_ipbx_agent`. Local Docker was not used. The existing `xray-ui` container was not modified.

## Fixture

Transferred `krasterisk-d1-contracts.tgz` (75 046 bytes, 49 files: harness CJS, dual-engine SQL including `0008`, database runner/adapters). Runtime packages were installed on the server. No application sources, `.env`, or production credentials.

Directory: `/tmp/krasterisk-d1.aZ59XY` (removed after logs were copied).

## Results

| Check | Result | Log |
|---|---|---|
| MySQL 8.4.11 contracts | **15/15** pass; baseline SHA-256 `8c18e47d…9543d`; D1 cell includes illegal state, tenant FK, unique races, concurrent CAS, utf8mb4 collation and full-length unique indexes | [mysql-d1.log](mysql-d1.log) |
| PostgreSQL 17.11 contracts | **15/15** pass; baseline SHA-256 `a7d418f5…1720f`; **132** tables after 0008; same D1 constraint cell | [postgres-d1.log](postgres-d1.log) |

Node v22.23.2, Sequelize 6.37.8. Disposable Testcontainers only. Standalone `analytics-api` / `robot-api` profiles install through `0008-ai-jobs-assets.sql`.

## Cleanup

Testcontainers leftovers (including a leftover Ryuk) were removed. `docker ps` afterward showed only the pre-existing `xray-ui`.
