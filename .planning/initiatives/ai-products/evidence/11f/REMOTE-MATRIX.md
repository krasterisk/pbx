# Live 11F fault injection matrix

Executed 2026-09-20 on `root@ipbx.krasterisk.ru` with `krasterisk_ipbx_agent`. Local Docker was not used. The existing `xray-ui` container was not modified. No production database, no live Adaptive DSN overwrite, no live wallet charge, no autodial.

Pack `krasterisk-11f-fault.tgz` (245 508 bytes, SHA-256 `090b0f342eee84d8a5d85bcea31e6f3b433f7a8367e908a5ea874d0459a4fabc`). Remote directory `/tmp/krasterisk-11f.k8XWAt` (removed after log copy). Disposable MySQL **8.4.11**, PostgreSQL **17.11**, Redis **7.4-alpine**. TAP logs and matrix JSON copied after the run, before leftover Ryuk cleanup. Published matrix is **measurement only** (`productSlaClaimed: false`). Shadow debit path only (`idempotent_replay_zero_debit` → one debit call).

| Case | Engine | Script | Result | Log / matrix |
|---|---|---|---|---|
| 14 pure named faults + I1 analytics-api live Redis/outbox recovery (unreachable keep, kill-after-enqueue, duplicate CAS, Redis restart rehydrate) | MySQL 8.4.11 + Redis | `run-11f-fault.cjs mysql` | TAP **3/3** pass (`EXIT mysql-11f 0`) | [mysql-11f.log](mysql-11f.log), [matrix-mysql.json](matrix-mysql.json) |
| same | PostgreSQL 17.11 + Redis | `run-11f-fault.cjs postgres` | TAP **3/3** pass (`EXIT postgres-11f 0`) | [postgres-11f.log](postgres-11f.log), [matrix-postgres.json](matrix-postgres.json) |

`FAIL=0`. Node v22.23.2. Constraints: `productRuntime: 'not-installed'`, `cloudWallet: 'off'`, `shadowDebitOnly: true`, `noLiveTenantDebit: true`.
