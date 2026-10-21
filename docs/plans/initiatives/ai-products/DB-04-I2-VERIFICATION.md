# DB-04 I2 verification — 2026-09-20

Status: **implemented; I3 upgrade / I4 ODBC not this slice**. Coordinator `codex-direct`. PLAN [DB-04](DB-04-PLAN.md) SHA-256 `83F520D6B208EE6177C0ADD77D380DBA1CC01A28BA2B5EECCDAA9345305FF085`.

## Passed

- Offline unit: `node --test harness/database/backup-restore.test.cjs` **6/6**.
- Disposable matrix on `root@ipbx.krasterisk.ru`: MySQL **4/4**, PostgreSQL **4/4**. Evidence: [REMOTE-MATRIX](evidence/i2/REMOTE-MATRIX.md).
- Post-restore invariants: schema `0020-ai-sku-catalog.sql`, ledger sum `8`, job/asset IDs, license bindings, object checksums.
- Provider credentials remain `v2:` envelopes; decrypt with sidecar; missing key throws `AI_PROVIDER_KEY_UNAVAILABLE` (not empty plaintext).
- DBR-07 dialect-switch refuse documented in [DB-04-I2-RESTORE](DB-04-I2-RESTORE.md). `--rollback` refused.
- No production DB, no live secret copy, `xray-ui` untouched.

## Deviations / not this slice

- I3 N-1 fixture upgrade runbook.
- I4 generated ODBC / disposable Asterisk apply.
- Cross-engine data transfer.
- No `productRuntime` flip, no live tenant debit, no autodial.
