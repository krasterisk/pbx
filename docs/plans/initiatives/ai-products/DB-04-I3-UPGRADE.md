# DB-04 I3 — N-1 upgrade

Shared upgrade entrypoint: `node harness/database/upgrade.cjs`. SQL runner ownership stays `packages/backend/database/run-migrations.cjs`. Empty `0001` → current remains the I1 clean-install gate and is not rewritten here. This does not apply ODBC (I4). `xray-ui` and production databases are out of scope.

## Runbook

1. **Backup** — I2 same-engine pack + customer `encryption.key` sidecar.
2. **Migrate** — `upgrade.cjs --upgrade` applies remaining journaled migrations (N-1 → `0020-ai-sku-catalog.sql`).
3. **Health / schema readiness** — `db:migrate --status` / process readiness; dirty journal refuses.
4. **Worker drain** — stop new admissions; in-flight work may finish.
5. **Admit traffic** — only after schema ready, workers drained, workers configured.

Automatic `--rollback` is forbidden. Recovery is forward repair or restore from the I2 backup. Changing `DB_DIALECT` on existing data is a DBR-07 refusal, not a migration.

## N-1 identities

| Profile | N-1 | Current |
|---|---|---|
| `full-pbx` | `0019-asterisk-odbc.sql` | `0020-ai-sku-catalog.sql` |
| `analytics-api` / `robot-api` | `0018-ai-tools.sql` | `0020-ai-sku-catalog.sql` |

## Commands

```sh
DB_DIALECT=mysql DB_SCHEMA_PROFILE=analytics-api node harness/database/upgrade.cjs --plan
# disposable N-1 fixture (tests only):
node harness/database/upgrade.cjs --apply-n1
node harness/database/upgrade.cjs --upgrade
node harness/database/upgrade.cjs --status
```

Replay of an already-current journal is a no-op. A dirty marker refuses upgrade without silent repair.

## Disposable matrix

On `root@ipbx.krasterisk.ru` only (no local Docker):

```sh
node harness/database/pack-d1-contracts.cjs
# scp archive + run-i3-ipbx.sh, then:
node harness/database/run-i3-upgrade.cjs mysql
node harness/database/run-i3-upgrade.cjs postgres
```

I4 ODBC apply is not this slice. Analytics-only installs do not wait for I4.
