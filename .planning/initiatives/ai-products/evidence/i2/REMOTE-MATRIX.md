# Live I2 backup/restore matrix

Executed 2026-09-20 on `root@ipbx.krasterisk.ru` with `krasterisk_ipbx_agent`. Local Docker was not used. The existing `xray-ui` container was not modified. No production database, no live secrets copied, no I3 upgrade, no I4 ODBC apply, no live wallet charge.

Pack `krasterisk-d1-contracts.tgz` (126 501 bytes, SHA-256 `7e78f54323bdcb5adf88eafb8b7a4ee3bd5716bfd7f2e1286ea062e16b5c67e3`) plus an in-place harness fix for MySQL `information_schema` column aliases. Remote directory `/tmp/krasterisk-i2.M3VYLj` (removed). Disposable MySQL **8.4.11** and PostgreSQL **17.11**.

| Case | Engine | Script | Result | Log |
|---|---|---|---|---|
| analytics-api backup→restore: schema `0020-ai-sku-catalog.sql`, ledger sum, job/asset IDs, license bindings, object checksums, decrypt with sidecar; missing-key fail-closed; DBR-07 dialect-switch refuse | MySQL 8.4.11 | `run-i2-restore.cjs mysql` | **4/4** pass (`EXIT mysql-i2 0`) | [mysql-i2.log](mysql-i2.log) |
| same | PostgreSQL 17.11 | `run-i2-restore.cjs postgres` | **4/4** pass (`EXIT postgres-i2 0`) | [postgres-i2.log](postgres-i2.log) |

`FAIL=0`. Node v22.23.2. After cleanup `docker ps` showed only pre-existing `xray-ui`. No leftover `org.testcontainers=true` containers.
