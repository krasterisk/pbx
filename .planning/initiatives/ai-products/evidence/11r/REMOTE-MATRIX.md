# Live 11R robots LIVE-UAT matrix

Executed 2026-09-20 on `root@ipbx.krasterisk.ru` with `krasterisk_ipbx_agent`. Local Docker was not used. The existing `xray-ui` container was not modified. No production database, no live Adaptive DSN overwrite, no host unixODBC/Asterisk module load claim, no live wallet charge, no autodial.

Pack `krasterisk-11r-uat.tgz` (247 788 bytes, SHA-256 `6ec40ec49f74afbfaac4a9f37864d217a6b050d1e4945d77a059cd5549cc217e`). Remote directory `/tmp/krasterisk-11r.sVVH04` (removed after log copy). Disposable MySQL **8.4.11** and PostgreSQL **17.11**. Eval report `productSlaClaimed: false`; `native_pbx_gated` with `hostModuleLoadClaimed: false`.

| Case | Engine | Script | Result | Log / eval |
|---|---|---|---|---|
| LIVE-UAT robots-only publish→SIP UDP draft / TLS disabled→drain `admissions_stopped`; analytics 404; `native_pbx_gated` | MySQL 8.4.11 | `run-11r-uat.cjs mysql` | TAP **2/2** pass (`EXIT mysql-11r 0`) | [mysql-11r.log](mysql-11r.log), [eval-mysql.json](eval-mysql.json) |
| same | PostgreSQL 17.11 | `run-11r-uat.cjs postgres` | TAP **2/2** pass (`EXIT postgres-11r 0`) | [postgres-11r.log](postgres-11r.log), [eval-postgres.json](eval-postgres.json) |

`FAIL=0`. Node v22.23.2. Remaining gates named: host unixODBC/module load, TLS/SRTP/NAT, `liveMcp=true`.
