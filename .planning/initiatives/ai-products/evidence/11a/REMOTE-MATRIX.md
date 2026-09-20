# Live 11A analytics LIVE-UAT matrix

Executed 2026-09-20 on `root@ipbx.krasterisk.ru` with `krasterisk_ipbx_agent`. Local Docker was not used. The existing `xray-ui` container was not modified. No production database, no I4/AMI/ARI, no live Adaptive DSN overwrite, no live wallet charge, no autodial.

Pack `krasterisk-11a-uat.tgz` (258 821 bytes, SHA-256 `c70382decc721408acb5e67a06b545c6d672aec88dc1974ee7ae1fb4467272bf`). Remote directory `/tmp/krasterisk-11a.T6hvw8` (removed after log copy). Disposable MySQL **8.4.11** and PostgreSQL **17.11**. TAP logs and eval JSON copied after the run, before leftover Ryuk cleanup. Eval report is **measurement only** (`productSlaClaimed: false`). Remaining gates named: `local_ai_stt_not_claimed`, `met5_30_call_holdout_not_claimed`.

| Case | Engine | Script | Result | Log / eval |
|---|---|---|---|---|
| LIVE-UAT pilot A onboarding + pilot B parallel; A/B isolation; analytics-only (no `cdr`/PBX routes) | MySQL 8.4.11 | `run-11a-uat.cjs mysql` | TAP **2/2** pass (`EXIT mysql-11a 0`) | [mysql-11a.log](mysql-11a.log), [eval-mysql.json](eval-mysql.json) |
| same | PostgreSQL 17.11 | `run-11a-uat.cjs postgres` | TAP **2/2** pass (`EXIT postgres-11a 0`) | [postgres-11a.log](postgres-11a.log), [eval-postgres.json](eval-postgres.json) |

`FAIL=0`. Node v22.23.2. Health stayed `productRuntime: 'not-installed'`. Query `?token=` rejected. Fake STT does not close local-AI.
