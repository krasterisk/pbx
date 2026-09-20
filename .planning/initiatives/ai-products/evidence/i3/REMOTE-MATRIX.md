# Live I3 N-1 upgrade matrix

Executed 2026-09-20 on `root@ipbx.krasterisk.ru` with `krasterisk_ipbx_agent`. Local Docker was not used. The existing `xray-ui` container was not modified. No production database, no I4 ODBC apply, no live wallet charge, no `--rollback`.

Pack `krasterisk-d1-contracts.tgz` (129 665 bytes, SHA-256 `564781cb320552b5c5b60d3fe56fc52b553d08c87a8a595514cd86cfeed65128`). Remote directory `/tmp/krasterisk-i3.N1XTHz` (removed). Disposable MySQL **8.4.11** and PostgreSQL **17.11**. TAP logs below are the runner stdout captured in the coordinator session (`FAIL=0`, `EXIT mysql-i3 0`, `EXIT postgres-i3 0`).

| Case | Engine | Script | Result | Log |
|---|---|---|---|---|
| analytics-api `0018`→`0020` + full-pbx `0019`→`0020`, fixture job/license survive, replay no-op, dirty refuse | MySQL 8.4.11 | `run-i3-upgrade.cjs mysql` | **4/4** pass (`EXIT mysql-i3 0`) | [mysql-i3.log](mysql-i3.log) |
| same | PostgreSQL 17.11 | `run-i3-upgrade.cjs postgres` | **4/4** pass (`EXIT postgres-i3 0`) | [postgres-i3.log](postgres-i3.log) |

`FAIL=0`. Node v22.23.2. After cleanup `docker ps` showed only pre-existing `xray-ui`. No leftover `org.testcontainers=true` containers.
