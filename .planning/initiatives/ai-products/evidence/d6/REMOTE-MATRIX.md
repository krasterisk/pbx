# D6 current-revision remote matrix

Executed 2026-09-19 on `root@ipbx.krasterisk.ru` with `krasterisk_ipbx_agent`. Local Docker was not used. The existing `xray-ui` container was not modified. Optional PBX `RedisModule` was not loaded. No live wallet charge and no PSTN calls.

Transferred `krasterisk-d6-foundation.tgz` (91 830 bytes, SHA-256 `f0a978890042bb526ee470b6521e16cd7f4439c7525d3880a1e45375e3659927`). Directory `/tmp/krasterisk-d46.work` (removed). Disposable MySQL 8.4.11, PostgreSQL 17.11, Redis 7.4-alpine, MinIO `quay.io/minio/minio:RELEASE.2024-12-18T13-15-44Z`.

## Local filesystem + SQL

| Check | Result | Log |
|---|---|---|
| MySQL 8.4.11 + local store | **5/5** pass: readiness split, upload→job→shadow usage + tenant 0/8/9 isolation + unchanged `billing_transactions`, two-scheduler CAS, unique event/ledger replay, retention hold + cancel keeps ledger | [REMOTE-SESSION.log](REMOTE-SESSION.log) (`EXIT mysql-d6 0`) |
| PostgreSQL 17.11 + local store | **5/5** pass; same cells | [REMOTE-SESSION.log](REMOTE-SESSION.log) (`EXIT postgres-d6 0`) |

## Redis + disposable S3-compatible

| Check | Result | Log |
|---|---|---|
| MySQL 8.4.11 + Redis + MinIO | **7/7** pass; previous cells plus Redis PING/SQL-survives-dead-Redis and MinIO put/head on a generated bucket | [REMOTE-SESSION.log](REMOTE-SESSION.log) (`EXIT mysql-redis-minio-d6 0`) |
| PostgreSQL 17.11 + Redis + MinIO | **7/7** pass; same cells | [REMOTE-SESSION.log](REMOTE-SESSION.log) (`EXIT postgres-redis-minio-d6 0`) |

Node v22.23.2, Sequelize 6.37.8. Disposable Testcontainers only.

## Cleanup

Remote `/tmp/krasterisk-d46*` removed. `docker ps` afterward showed only the pre-existing `xray-ui`.
