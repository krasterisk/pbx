# Live 10R robots-only installer matrix

Executed 2026-09-20 on `root@ipbx.krasterisk.ru` with `krasterisk_ipbx_agent`. Local Docker was not used. The existing `xray-ui` container was not modified. No production database, no I4 native CDR/`queue_log` claim, no live Adaptive DSN overwrite, no live wallet charge, no analytics entitlement.

Pack `krasterisk-10r-smoke.tgz` (227 228 bytes, SHA-256 `6bf7532ff08ee8647da51634b875c6ab7fa0b442ca71c7c7f8c7ee0722c2e003`). Remote directory `/tmp/krasterisk-10r.DzwXsS` (removed after log copy). Disposable MySQL **8.4.11** and PostgreSQL **17.11**. TAP logs copied after the run, before leftover Ryuk cleanup. Host unixODBC/Asterisk module load was not claimed.

| Case | Engine | Script | Result | Log |
|---|---|---|---|---|
| I1 `robot-api` clean-install + publish→browser_test→SIP udp draft / tls `sip_profile_unsupported`→drain `admissions_stopped`; OpenAPI; A/B isolation; analytics/PBX 404 | MySQL 8.4.11 | `run-10r-smoke.cjs mysql` | TAP **2/2** pass (`EXIT mysql-10r 0`) | [mysql-10r.log](mysql-10r.log) |
| same | PostgreSQL 17.11 | `run-10r-smoke.cjs postgres` | TAP **2/2** pass (`EXIT postgres-10r 0`) | [postgres-10r.log](postgres-10r.log) |

`FAIL=0`. Node v22.23.2. Health stayed `productRuntime: 'not-installed'`. Query `?token=` rejected. `cdr` table absent on robots-only schema. `evaluateSipProfile({ nativePbx: true, i4Evidence: false })` remains `native_pbx_gated` without claiming host I4 apply.
