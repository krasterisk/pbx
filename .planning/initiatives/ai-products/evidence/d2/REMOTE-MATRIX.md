# D2 current-revision remote matrix

Executed 2026-09-19 on `root@ipbx.krasterisk.ru` with `krasterisk_ipbx_agent`. Local Docker was not used. The existing `xray-ui` container was not modified. Optional PBX `RedisModule` was not loaded.

## SQL contracts

Transferred `krasterisk-d1-contracts.tgz` (75 771 bytes). Directory `/tmp/krasterisk-d2.GObEMT` (removed).

| Check | Result | Log |
|---|---|---|
| MySQL 8.4.11 contracts | **16/16** pass; D2 SQL cell: rollback-before-commit, committed job without Redis mark, concurrent stage/outbox CAS, stale fence, idempotency unique race | [mysql-d2.log](mysql-d2.log) |
| PostgreSQL 17.11 contracts | **16/16** pass; **132** tables after 0008 | [postgres-d2.log](postgres-d2.log) |

## Redis + BullMQ live faults

Transferred `krasterisk-d2-fault.tgz` (79 393 bytes, SHA-256 `d06adb3fdd5c3603bce1afbd1287d240f11aa217a65ebf0a4966993ba05e975e`). Directory `/tmp/krasterisk-d2f.5TaUF8` (removed). Disposable `redis:7.4-alpine` plus the engine under test.

| Check | Result | Log |
|---|---|---|
| MySQL 8.4.11 + Redis 7.4 | **10/10** pass: Redis refusal, process-kill after enqueue, two worker processes + stale fence, queued/executing cancel, DLQ/unknown ordinal, forged tenant, delivery CAS, in-process CAS, Redis empty restart rehydrate | [mysql-redis-d2.log](mysql-redis-d2.log) |
| PostgreSQL 17.11 + Redis 7.4 | **10/10** pass; same cells | [postgres-redis-d2.log](postgres-redis-d2.log) |

Node v22.23.2, Sequelize 6.37.8, BullMQ 5.x. Disposable Testcontainers only.

## Cleanup

Remote `/tmp/krasterisk-d2*` removed. `docker ps` afterward showed only the pre-existing `xray-ui`.
