# Live 11L load profile matrix

Executed 2026-09-20 on `root@ipbx.krasterisk.ru` with `krasterisk_ipbx_agent`. Local Docker was not used. The existing `xray-ui` container was not modified. No production database, no I4 native CDR/`queue_log` claim, no live Adaptive DSN overwrite, no live wallet charge, no autodial.

Pack `krasterisk-11l-load.tgz` (242 465 bytes, SHA-256 `783811e3965fa4ea11791b1571e42143db6230866321f72b3dea2349e7d71d9d`). Remote directory `/tmp/krasterisk-11l.pjvk1c` (removed after log copy). Disposable MySQL **8.4.11** and PostgreSQL **17.11**. TAP logs and profile JSON copied after the run, before leftover Ryuk cleanup. Host unixODBC/Asterisk module load was not claimed. Published profile is **measurement only** (`productSlaClaimed: false`).

| Case | Engine | Script | Result | Log / profile |
|---|---|---|---|---|
| I1 `analytics-api` + admission ladder 1→5→20; media vs batch; quota `fairness_exhausted` | MySQL 8.4.11 | `run-11l-load.cjs mysql` | TAP **2/2** pass (`EXIT mysql-11l 0`) | [mysql-11l.log](mysql-11l.log), [profile-mysql.json](profile-mysql.json) |
| same | PostgreSQL 17.11 | `run-11l-load.cjs postgres` | TAP **2/2** pass (`EXIT postgres-11l 0`) | [postgres-11l.log](postgres-11l.log), [profile-postgres.json](profile-postgres.json) |

`FAIL=0`. Node v22.23.2. Constraints in profile JSON: `productRuntime: 'not-installed'`, `cloudWallet: 'off'`, `noLiveTenantDebit: true`. Ladder admits under default caps (`runningCap` 8 / `queueCap` 32) with 0 fairness rejects at each step; batch exhaustion does not starve media; overflow returns `fairness_exhausted`.
