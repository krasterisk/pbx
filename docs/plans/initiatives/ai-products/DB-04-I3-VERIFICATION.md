# DB-04 I3 verification — 2026-09-20

Status: **implemented; I4 ODBC not this slice**. Coordinator `codex-direct`. PLAN [DB-04](DB-04-PLAN.md) SHA-256 `83F520D6B208EE6177C0ADD77D380DBA1CC01A28BA2B5EECCDAA9345305FF085`.

## Passed

- Offline unit: `node --test harness/database/upgrade.test.cjs` **3/3**.
- Disposable matrix on `root@ipbx.krasterisk.ru`: MySQL **4/4**, PostgreSQL **4/4**. Evidence: [REMOTE-MATRIX](evidence/i3/REMOTE-MATRIX.md).
- analytics-api `0018-ai-tools.sql` → `0020-ai-sku-catalog.sql`; full-pbx `0019-asterisk-odbc.sql` → `0020`. SKU tables appear only after upgrade. Job/license fixture rows survive. Replay `newlyApplied=[]`.
- Dirty marker refuses `--upgrade` without clearing itself. `--rollback` refused. Runbook is backup → migrate → readiness → drain → admit.
- DBR-07 dialect switch remains a runner engine-identity refusal. Empty 0001→current remains I1.
- No production DB, `xray-ui` untouched, no live tenant debit.

## Deviations / not this slice

- I4 generated ODBC / disposable Asterisk apply.
- Cross-engine data transfer.
- No `productRuntime` flip, no autodial.
