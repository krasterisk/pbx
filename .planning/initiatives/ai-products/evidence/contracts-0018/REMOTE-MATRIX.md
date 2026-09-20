# Live dual-DB contracts — after 0018

Executed 2026-09-20 on `root@ipbx.krasterisk.ru` with `krasterisk_ipbx_agent`. Local Docker was not used. The existing `xray-ui` container was not modified. Optional PBX `RedisModule` was not loaded. No live wallet charge. Production PBX dialplan was not rewritten. Native MixMonitor / ARI / live SIP / live MCP were not executed.

Transferred `krasterisk-d1-contracts.tgz` (106 749 bytes, SHA-256 `582a7eeef8db3d461904c33db8b08fb4d48ac8b8f07d4494c11c80a1b80cfbd4`), then patched `run-contracts.cjs` in place: parent timeout 720 s; PostgreSQL inventory pinned to live `information_schema` **190 tables / 2187 columns / 40 enums / 85 FKs / 9 FK indexes**. Directory `/tmp/krasterisk-contracts.fooXTc` (removed). Disposable MySQL 8.4.11 and PostgreSQL 17.11.

| Case | Engine | Script | Result | Log |
|---|---|---|---|---|
| Full dual-engine migration contracts through `0018-ai-tools.sql` | MySQL 8.4.11 | `run-contracts.cjs mysql` | **16/16** pass (`EXIT mysql-contracts 0`) | [mysql-contracts.log](mysql-contracts.log) |
| Full dual-engine migration contracts through `0018-ai-tools.sql` | PostgreSQL 17.11 | `run-contracts.cjs postgres` | **16/16** pass (`EXIT postgres-contracts 0`) | [postgres-contracts.log](postgres-contracts.log) |

Pack: `node harness/database/pack-d1-contracts.cjs`. Remote: `bash harness/database/run-contracts-remote.sh`. `FAIL=0`.

Uniqueness contracts for reports/SIP/tools remain in [rep-rt-tool](../rep-rt-tool/REMOTE-MATRIX.md) (MySQL **4/4**, PG **4/4**).

Node v22.23.2. After cleanup `docker ps` showed only pre-existing `xray-ui`.
