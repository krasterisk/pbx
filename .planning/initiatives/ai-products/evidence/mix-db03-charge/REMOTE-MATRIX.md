# MixMonitor generated routes / DB-03 writer / live charge

Executed 2026-09-20 on `root@ipbx.krasterisk.ru` with `krasterisk_ipbx_agent`. Local Docker was not used. Existing `xray-ui` was not modified. Optional PBX `RedisModule` was not loaded. Existing Adaptive ODBC DSN secrets were not copied or replaced. Isolated `[krasterisk-ai-generated]` was loaded on the **test** Asterisk; customer `custom/routes` were not rewritten.

Source HEAD `1c837b8b` (uncommitted slice). Bundle `krasterisk-db03.tgz` 110 667 bytes, SHA-256 `c1b8db518ec1d648a1e9189bbad8bcdb05caa6f1d1cb3f67da38cc0cc4087160`. Disposable dirs `/tmp/krasterisk-db03.p0F6As` and `/tmp/krasterisk-mix.b4R5GA` removed after log copy. After cleanup `docker ps` showed only pre-existing `xray-ui`.

| Case | Target | Script | Result | Log |
|---|---|---|---|---|
| Generated-route MixMonitor (`DURABLE_CAPTURE` UUID + `RECORDER_ID` + hangup StopMixMonitor) | test Asterisk | `run-generated-mixmonitor.sh` | **generated_ok=True**. WAV `2c38cac3-d0cc-4464-9629-ad736c157c27.wav` **95084** bytes under `/usr/records/8/calls/`. `0 active channels`. CDR context `krasterisk-ai-generated` UniqueIDs `1789879875.112` / `1789879875.113` | [mixmonitor](mixmonitor/logs/ai-generated-mixmonitor/) |
| Portable CDR / `queue_log` / CEL writer uniqueness | MySQL 8.4.11 | `run-db03.cjs mysql` | **4/4** (`EXIT mysql-db03 0`) | [mysql-db03.log](mysql-db03.log) |
| Portable CDR / `queue_log` / CEL writer uniqueness | PostgreSQL 17.11 | `run-db03.cjs postgres` | **4/4** (`EXIT postgres-db03 0`) | [postgres-db03.log](postgres-db03.log) |
| Live `external_id` charge (find-first, no double debit) | disposable billing tables, both engines | same `run-db03.cjs` | tenant `90001` 10000→9750 kopecks; replay keeps 9750 and one row | [mysql-db03.log](mysql-db03.log), [postgres-db03.log](postgres-db03.log) |
| Full dual-engine migrations through `0019-asterisk-odbc.sql` | MySQL 8.4.11 | `run-contracts.cjs mysql` | **16/16** (`EXIT mysql-contracts 0`) | [mysql-contracts.log](mysql-contracts.log) |
| Full dual-engine migrations through `0019-asterisk-odbc.sql` | PostgreSQL 17.11 | `run-contracts.cjs postgres` | **16/16** (`EXIT postgres-contracts 0`). Inventory **192** tables (live pin 2223 columns / 40 enums / 85 FKs) | [postgres-contracts.log](postgres-contracts.log) |

Local: Jest MixMonitor/charge/writer **47** tests; dialplan file match rechecked **9/9**; DB unit + schema inventory **27/27**; eslint on touched TS **0** errors.

`nativeCaptureApply` follows `DURABLE_CAPTURE=1`. Product Nest runtime on ipbx remains `not-installed`, so the HTTP capability flag is still env-gated. Generated-route MixMonitor **shape** from `recordingDialplanLines` / `generateRouteDialplan` was applied in `[krasterisk-ai-generated]`.

Not claimed: replacing the live Adaptive ODBC DSN; unixODBC installer apply against production credentials; charging real tenants; rewriting all `krasterisk/routes/*`.
