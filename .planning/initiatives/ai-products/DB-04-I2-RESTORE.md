# DB-04 I2 — backup / restore

Shared restore entrypoint: `node harness/database/backup-restore.cjs`. Schema apply still goes through I1 `clean-install.cjs`. This does not upgrade N-1 packs (I3) or apply ODBC (I4). `xray-ui` and production databases are out of scope. Live secrets are never copied from the operator environment into a pack.

## Pack layout

| File | Role |
|---|---|
| `MANIFEST.json` | dialect, profile, schema version, ledger/job/asset/license invariants, object checksums |
| `data.sql` | same-engine TRUNCATE + INSERT dump (journal/state excluded; schema comes from I1) |
| `objects/` | object-storage fixture files |
| `encryption.key` | customer-held `CC_AI_KEY_SECRET` sidecar. Generated for disposable tests only |

SQL dump stores versioned `v2:` envelopes, not provider plaintext. Publisher signing keys stay with the issuer.

## Commands

```sh
# Backup (explicit DB_* + CC_AI_KEY_SECRET sidecar; never ambient production)
DB_DIALECT=mysql DB_SCHEMA_PROFILE=analytics-api \
  node harness/database/backup-restore.cjs --backup /path/pack --objects /path/objects

# Restore onto a same-engine schema that already reached 0020 via I1 --apply
node harness/database/backup-restore.cjs --restore /path/pack --objects /path/objects
```

`--rollback` is refused. Missing `encryption.key` fails closed (`AI_PROVIDER_KEY_UNAVAILABLE`) and does not treat credentials as empty strings. Ciphertext remains unreadable until the customer key is supplied.

## DBR-07 dialect switch

Restoring a MySQL pack into PostgreSQL (or the reverse) is a documented refusal, not a migration. Cross-engine transfer is out of scope for this release.

## Evidence (DBR-07)

Disposable backup→restore on `root@ipbx.krasterisk.ru` only (no local Docker):

```sh
node harness/database/pack-d1-contracts.cjs
# scp archive + run-i2-ipbx.sh, then:
node harness/database/run-i2-restore.cjs mysql
node harness/database/run-i2-restore.cjs postgres
```

Post-restore checks: schema version `0020-ai-sku-catalog.sql`, ledger sums, job/asset IDs, license bindings, object checksums, decrypt with sidecar, fail-closed without key.

I3 N-1 upgrade and I4 ODBC apply are not this slice.
