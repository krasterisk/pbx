# Live dual-DB contracts — after 0020

Executed 2026-09-20 on `root@ipbx.krasterisk.ru` with `krasterisk_ipbx_agent`. Local Docker was not used. The existing `xray-ui` container was not modified. No live wallet charge. Production PBX dialplan was not rewritten.

Pack `krasterisk-d1-contracts.tgz` (111 927 bytes, SHA-256 `16b3b49f281df0af19e58b034aa518668949422e28f0fd76ea4e29d853de4118`). Remote directory `/tmp/krasterisk-contracts.OFyRLy` (removed). Disposable MySQL 8.4.11 and PostgreSQL 17.11.

Full-pbx apply order is `0019-asterisk-odbc.sql` then `0020-ai-sku-catalog.sql` so journal `ORDER BY name` stays a prefix of the manifest. Standalone profiles end at `0020-ai-sku-catalog.sql`. Live PostgreSQL inventory pin: **196 tables / 2258 columns / 40 enums / 89 FKs / 9 FK indexes**.

| Case | Engine | Script | Result | Log |
|---|---|---|---|
| Full dual-engine migration contracts through `0020-ai-sku-catalog.sql` | MySQL 8.4.11 | `run-contracts.cjs mysql` | **16/16** pass (`EXIT mysql-contracts 0`) | [mysql-contracts.log](mysql-contracts.log) |
| Full dual-engine migration contracts through `0020-ai-sku-catalog.sql` | PostgreSQL 17.11 | `run-contracts.cjs postgres` | **16/16** pass (`EXIT postgres-contracts 0`). Inventory **196** tables | [postgres-contracts.log](postgres-contracts.log) |

`FAIL=0`. Node v22.23.2. After cleanup `docker ps` showed only pre-existing `xray-ui`.
