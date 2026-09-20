# Live 10A analytics-only installer matrix

Executed 2026-09-20 on `root@ipbx.krasterisk.ru` with `krasterisk_ipbx_agent`. Local Docker was not used. The existing `xray-ui` container was not modified. No production database, no I4 ODBC apply, no live Adaptive DSN overwrite, no live wallet charge.

Pack `krasterisk-10a-smoke.tgz` (240 195 bytes, SHA-256 `407d76f3d4444bb1635ce48afb51ab763b9f2caec384ff6716c5caa85eedbd2d`). Remote directory `/tmp/krasterisk-10a.4Vb5x5`. Disposable MySQL **8.4.11** and PostgreSQL **17.11**. TAP logs copied after the run, before leftover Ryuk cleanup. Host unixODBC/Asterisk module load was not claimed.

| Case | Engine | Script | Result | Log |
|---|---|---|---|---|
| I1 `analytics-api` clean-install + live project→key→upload→run; OpenAPI tags; A/B isolation; PBX routes 404 | MySQL 8.4.11 | `run-10a-smoke.cjs mysql` | TAP **2/2** pass (`EXIT mysql-10a 0`) | [mysql-10a.log](mysql-10a.log) |
| same | PostgreSQL 17.11 | `run-10a-smoke.cjs postgres` | TAP **2/2** pass (`EXIT postgres-10a 0`) | [postgres-10a.log](postgres-10a.log) |

`FAIL=0`. Node v22.23.2. Health stayed `productRuntime: 'not-installed'`. Query `?token=` rejected. `cdr` table absent on analytics-only schema.
