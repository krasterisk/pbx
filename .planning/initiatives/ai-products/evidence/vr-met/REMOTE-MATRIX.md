# Live SQL matrix — AI-07 VR1 / AI-05 MET1

Executed 2026-09-19 on `root@ipbx.krasterisk.ru` with `krasterisk_ipbx_agent`. Local Docker was not used. The existing `xray-ui` container was not modified. Optional PBX `RedisModule` was not loaded. No live wallet charge. Production PBX dialplan was not rewritten. Native MixMonitor / ARI live calls were not executed.

Transferred `krasterisk-vr-met.tgz` (103 094 bytes, SHA-256 `839e0828bf0040f172a6b71edd651c33e6ab3fa7a3a9fa0779cac3b740943152`), then patched `run-vr-met.cjs` in place (missing `assert.rejects` close). Directory `/tmp/krasterisk-vr-met.fkUlhY` (removed). Disposable MySQL 8.4.11 and PostgreSQL 17.11. Profile `analytics-api`.

| Case | Engine | Script | Result | Log |
|---|---|---|---|---|
| Voice version uniqueness, sip cannot be ready, ingress/turn/event/op UNIQUE | MySQL 8.4.11 | `run-vr-met.cjs mysql` | **2/2** pass (`EXIT mysql-vr-met 0`) | [mysql-vr-met.log](mysql-vr-met.log) |
| Voice version uniqueness, sip cannot be ready, ingress/turn/event/op UNIQUE | PostgreSQL 17.11 | `run-vr-met.cjs postgres` | **2/2** pass (`EXIT postgres-vr-met 0`) | [postgres-vr-met.log](postgres-vr-met.log) |
| Metric key uniqueness, weight CHECK, reanalysis child run, review command_key | MySQL 8.4.11 | same file, nested MET test | included in MySQL **2/2** | [mysql-vr-met.log](mysql-vr-met.log) |
| Metric key uniqueness, weight CHECK, reanalysis child run, review command_key | PostgreSQL 17.11 | same file, nested MET test | included in PostgreSQL **2/2** | [postgres-vr-met.log](postgres-vr-met.log) |

Pack: `node harness/database/pack-vr-met.cjs`. Remote: `bash harness/database/run-vr-met-remote.sh`. `FAIL=0`.

Node v22.23.2. After cleanup `docker ps` showed only pre-existing `xray-ui`.
