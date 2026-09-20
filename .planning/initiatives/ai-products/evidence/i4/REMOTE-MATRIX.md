# Live I4 ODBC installer matrix

Executed 2026-09-20 on `root@ipbx.krasterisk.ru` with `krasterisk_ipbx_agent`. Local Docker was not used. The existing `xray-ui` container was not modified. No production database, no live Adaptive ODBC dump/overwrite (`--apply-live` / `--from-live` refused), no `/etc/asterisk` write, no live wallet charge.

Pack `krasterisk-d1-contracts.tgz` (135 668 bytes, SHA-256 `d7f789e27c572d7289f86ac11baef3ee6955cdf62745101e1077c400ed5fc090`). Remote directory `/tmp/krasterisk-i4.IR5J1b` (removed). Disposable MySQL **8.4.11** and PostgreSQL **17.11**. Dedicated writer role `asterisk_i4` ≠ app user. Golden uniqueid `1760000000.41`. TAP logs copied after the run, before cleanup.

| Case | Engine | Script | Result | Log |
|---|---|---|---|---|
| full-pbx generate + Asterisk user writer matches golden CDR/`queue_log`/CEL; replay unique; live paths refused | MySQL 8.4.11 | `run-i4-odbc.cjs mysql` | TAP **2/2** pass (`EXIT mysql-i4 0`) | [mysql-i4.log](mysql-i4.log) |
| same | PostgreSQL 17.11 | `run-i4-odbc.cjs postgres` | TAP **2/2** pass (`EXIT postgres-i4 0`) | [postgres-i4.log](postgres-i4.log) |

`FAIL=0`. Node v22.23.2. After cleanup `docker ps` showed only pre-existing `xray-ui`. No leftover `org.testcontainers=true` containers. Host unixODBC driver load and Asterisk module reload were not claimed.
