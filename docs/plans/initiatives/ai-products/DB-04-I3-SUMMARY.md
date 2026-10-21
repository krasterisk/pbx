# DB-04 I3 — N-1 upgrade

Status: **implemented locally + disposable dual-DB evidence** on 2026-09-20 under [DB-04](DB-04-PLAN.md) I3. Coordinator `codex-direct`. Runbook: [DB-04-I3-UPGRADE](DB-04-I3-UPGRADE.md).

`upgrade.cjs` wraps `db:migrate` for N-1 → `0020-ai-sku-catalog.sql`. Standalone N-1 is `0018-ai-tools.sql`; full-pbx N-1 is `0019-asterisk-odbc.sql`. Fixture jobs and license bindings survive the additive SKU migration. Replay is a no-op. A dirty journal refuses upgrade without silent repair. Automatic `--rollback` is forbidden; recovery is forward repair or an I2 restore. Empty `0001` → current stays the I1 baseline. Worker drain remains a gate before admitting traffic. I4 remains gated.
