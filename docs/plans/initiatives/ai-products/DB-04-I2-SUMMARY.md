# DB-04 I2 — backup / restore

Status: **implemented locally + disposable dual-DB evidence** on 2026-09-20 under [DB-04](DB-04-PLAN.md) I2. Coordinator `codex-direct`. Runbook: [DB-04-I2-RESTORE](DB-04-I2-RESTORE.md).

`backup-restore.cjs` dumps same-engine SQL plus an object-storage fixture and a customer-held `encryption.key` sidecar. Restore reapplies data onto an I1 `--apply` schema at `0020-ai-sku-catalog.sql` and checks ledger sums, job/asset IDs, license bindings, and object checksums. Missing sidecar fails closed (`AI_PROVIDER_KEY_UNAVAILABLE`) without turning ciphertext into empty secrets. `DB_DIALECT` switch is a documented DBR-07 refusal, not a migration. Live secrets and publisher private keys are not copied into the pack. I3–I4 remain gated.
