# Live SQL matrix — AI-06 REP/INT1, AI-08 RT, AI-09 TOOL

Executed 2026-09-20 on `root@ipbx.krasterisk.ru` with `krasterisk_ipbx_agent`. Local Docker was not used. The existing `xray-ui` container was not modified. Optional PBX `RedisModule` was not loaded. No live wallet charge. Production PBX dialplan was not rewritten. Native MixMonitor / ARI / live SIP / live MCP were not executed.

Transferred `krasterisk-rep-rt.tgz` (109 006 bytes, SHA-256 `ac577ff9e9e11728866de2ab2d74502976b201048b497e6e35ce8a2901718113`). Directory `/tmp/krasterisk-rep-rt.pkikJR` (removed). Disposable MySQL 8.4.11 and PostgreSQL 17.11. Profile `analytics-api`.

| Case | Engine | Script | Result | Log |
|---|---|---|---|---|
| Report slot UNIQUE, budget PK, capture policy, recording relation UNIQUE | MySQL 8.4.11 | `run-rep-rt-tool.cjs mysql` | **4/4** pass (`EXIT mysql-rep-rt 0`) | [mysql-rep-rt.log](mysql-rep-rt.log) |
| Report slot UNIQUE, budget PK, capture policy, recording relation UNIQUE | PostgreSQL 17.11 | `run-rep-rt-tool.cjs postgres` | **4/4** pass (`EXIT postgres-rep-rt 0`) | [postgres-rep-rt.log](postgres-rep-rt.log) |
| SIP DID UNIQUE, invocation replay key | both | nested in the same file | included in **4/4** each | same logs |
| Tool binding UNIQUE, KB ACL UNIQUE | both | nested in the same file | included in **4/4** each | same logs |

Pack: `node harness/database/pack-rep-rt-tool.cjs`. Remote: `bash harness/database/run-rep-rt-tool-remote.sh`. `FAIL=0`.

Node v22.23.2. After cleanup `docker ps` showed only pre-existing `xray-ui`.
