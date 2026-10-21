# DB-04 I1 — clean install matrix

Shared install entrypoint: `node harness/database/clean-install.cjs`. SQL runner ownership stays `packages/backend/database/run-migrations.cjs`. This does not restore (I2), upgrade N-1 packs (I3), or apply ODBC (I4). `xray-ui` and production databases are out of scope.

## Preflight

Commercial apply (`analytics-api` / `robot-api` / `full-pbx` unless `KRASTERISK_BINARY=community-pbx`) runs [commercial-preflight](AI-10-COM4-PREFLIGHT.md): `DB_DIALECT`, `DB_SCHEMA_PROFILE`, customer data key, workers flag, no publisher private key, no offline heartbeat.

| Check | Command |
|---|---|
| Offline plan | `DB_DIALECT=mysql DB_SCHEMA_PROFILE=analytics-api node harness/database/clean-install.cjs --plan` |
| Status | same env + explicit `DB_HOST/USER/PASSWORD/NAME` + `--status` |
| Apply | `--apply` |
| Disposable CI tenants 0/A/B | `--apply --seed-ci` with `CI=true`, `DB_NAME=krasterisk_ci[_suffix]`, `CI_SEED_PASSWORD` |
| Standalone first tenant | `provision:analytics` / `provision:robot` (password on stdin, no PBX Context) |
| Refuse rollback | `--rollback` or `npm run db:migrate:rollback` |

`KRASTERISK_BINARY=analytics-api|robot-api` must match `DB_SCHEMA_PROFILE`. Community binary only accepts `full-pbx`.

## Profiles × engines

| Profile | MySQL 8.4.11 | PostgreSQL 17.11 | Current schema | 0019 `queue_log`/`cel` |
|---|---|---|---|---|
| `full-pbx` | required | required | `0020-ai-sku-catalog.sql` | yes |
| `analytics-api` | required | required | `0020-ai-sku-catalog.sql` | no |
| `robot-api` | required | required | `0020-ai-sku-catalog.sql` | no |
| community composition | required | required | uses `full-pbx` schema; runtime does **not** import `speech-analytics` / `ai-voice` | PBX tables only as needed by community-pbx |

Empty install is journaled; replay is a no-op. Dirty/unknown journal and profile/engine mismatch refuse before mutation. Sequelize `synchronize`/`alter` stay false. Legacy `src/sync.ts` throws.

## Evidence paths (DBR-02 / DBR-06 / DBR-08)

| Requirement | Evidence |
|---|---|
| DBR-02 identical logical schema, journal, interrupted refuse | `run-i1-install.cjs` + existing `run-contracts.cjs` |
| DBR-06 profiles without a hidden second SQL engine | `installPlan()` / `--plan`; one of `mysql`/`postgres` per install |
| DBR-08 published MySQL+PG matrix | [evidence/i1](evidence/i1/REMOTE-MATRIX.md) after disposable ipbx run |

## Disposable matrix

On `root@ipbx.krasterisk.ru` only (no local Docker):

```sh
node harness/database/pack-d1-contracts.cjs
# scp archive + run-i1-ipbx.sh, then:
node harness/database/run-i1-install.cjs mysql
node harness/database/run-i1-install.cjs postgres
```

I2 backup/restore: [DB-04-I2-RESTORE](DB-04-I2-RESTORE.md). I3 N-1 upgrade and I4 ODBC apply are not this slice.
