# DB-04 I1 verification — 2026-09-20

Status: **implemented; I2 restore / I3 upgrade / I4 ODBC not this slice**. Coordinator `codex-direct`. PLAN [DB-04](DB-04-PLAN.md) SHA-256 `83F520D6B208EE6177C0ADD77D380DBA1CC01A28BA2B5EECCDAA9345305FF085`.

## Passed

- Offline unit: `node --test harness/database/clean-install.test.cjs` **4/4** plus commercial-preflight **2/2**.
- Disposable matrix on `root@ipbx.krasterisk.ru`: MySQL **5/5**, PostgreSQL **5/5**, `FAIL=0`. Evidence: [REMOTE-MATRIX](evidence/i1/REMOTE-MATRIX.md).
- Empty install schema version `0020-ai-sku-catalog.sql`. `0019-asterisk-odbc.sql` only on `full-pbx`. Standalone profiles exclude `contexts`/`cdr`/`queue_log`.
- CI seed tenants 0/A/B; second seed refuses overwrite. Dirty journal refuses apply. Wrong `DB_SCHEMA_PROFILE` refuses.
- Community source does not import commercial AI modules. `synchronize: false` in PBX and standalone compositions. Legacy `src/sync.ts` remains disabled.
- DBR-02/06/08 paths named in [DB-04-I1-INSTALL](DB-04-I1-INSTALL.md).

## Deviations / not this slice

- I2 backup/restore and missing-key fail-closed.
- I3 N-1 fixture upgrade runbook.
- I4 generated ODBC / disposable Asterisk apply.
- No `productRuntime` flip, no live tenant debit, no autodial/`xray-ui`, no production DB.
