# Live I1 clean install matrix

Executed 2026-09-20 on `root@ipbx.krasterisk.ru` with `krasterisk_ipbx_agent`. Local Docker was not used. The existing `xray-ui` container was not modified. No production database, no I2 restore, no I3 upgrade, no I4 ODBC apply, no live wallet charge.

Pack `krasterisk-d1-contracts.tgz` (118 829 bytes, SHA-256 `d7283a40d86e8a8938d0a19f7be4cbb360cc50ec25121f8d1cf18c70f7e25896`). Remote directory `/tmp/krasterisk-i1.RiuStV` (removed). Disposable MySQL **8.4.11** and PostgreSQL **17.11**.

| Case | Engine | Script | Result | Log |
|---|---|---|---|---|
| full-pbx / analytics-api / robot-api empty install to `0020-ai-sku-catalog.sql`, CI seed 0/A/B, overwrite refuse, wrong-profile refuse, dirty refuse | MySQL 8.4.11 | `run-i1-install.cjs mysql` | **5/5** pass (`EXIT mysql-i1 0`) | [mysql-i1.log](mysql-i1.log) |
| same | PostgreSQL 17.11 | `run-i1-install.cjs postgres` | **5/5** pass (`EXIT postgres-i1 0`) | [postgres-i1.log](postgres-i1.log) |

`FAIL=0`. Node v22.23.2. After cleanup `docker ps` showed only pre-existing `xray-ui`. No leftover `org.testcontainers=true` containers.
