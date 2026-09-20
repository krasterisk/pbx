# Live 11O ops drill matrix

Executed 2026-09-20 on `root@ipbx.krasterisk.ru` with `krasterisk_ipbx_agent`. Local Docker was not used. The existing `xray-ui` container was not modified. No production database, no `--rollback`, no live Adaptive DSN overwrite, no live wallet charge, no autodial.

Pack `krasterisk-11o-ops.tgz` (156 199 bytes, SHA-256 `10f5061dd8b4aaff20a23b7998ea867ee0b3a0d589779ef48cc75a0303249f5b`). Remote directory `/tmp/krasterisk-11o.JJUE82` (removed after log copy). Disposable MySQL **8.4.11** and PostgreSQL **17.11**. TAP logs and drill JSON copied after the run, before leftover Ryuk cleanup. This is **named AI-11 evidence** wrapping I2/I3 (not a re-claim of I2/I3 alone).

| Case | Engine | Script | Result | Log / drill |
|---|---|---|---|---|
| Probes (rollback/dialect/drain/key rotation) + I2 backup→restore + missing-key fail-closed + I3 N-1→upgrade→drain→admit | MySQL 8.4.11 | `run-11o-ops.cjs mysql` | TAP **4/4** pass (`EXIT mysql-11o 0`) | [mysql-11o.log](mysql-11o.log), [drill-mysql.json](drill-mysql.json) |
| same | PostgreSQL 17.11 | `run-11o-ops.cjs postgres` | TAP **4/4** pass (`EXIT postgres-11o 0`) | [postgres-11o.log](postgres-11o.log), [drill-postgres.json](drill-postgres.json) |

`FAIL=0`. Node v22.23.2. Constraints: `productRuntime: 'not-installed'`, `noAutomaticRollback: true`, `cloudWallet: 'off'`.
