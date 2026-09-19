# D3 current-revision remote matrix

Executed 2026-09-19 on `root@ipbx.krasterisk.ru` with `krasterisk_ipbx_agent`. Local Docker was not used. The existing `xray-ui` container was not modified. Optional PBX `RedisModule` was not loaded.

## Local filesystem + SQL

Transferred `krasterisk-d3-media.tgz` (84 104 bytes, SHA-256 `330530b77de14d7f10ea08b400b285f65ac9f370a93fd63df0ff133d94ff077b`). Directory `/tmp/krasterisk-d3.mwdyX4` (removed). Disposable MySQL/PostgreSQL plus a temp local object root.

| Check | Result | Log |
|---|---|---|
| MySQL 8.4.11 + local store | **6/6** pass: opaque refs/traversal, WAV probe (MIME/truncated/bomb/3-channel), fsync+rename+Range+tenant keys, probing while object exists, same SHA-256 different tenants, unique `storage_key`, ready+outbox, running-job retention hold | [mysql-d3.log](mysql-d3.log) |
| PostgreSQL 17.11 + local store | **6/6** pass; same cells | [postgres-d3.log](postgres-d3.log) |

## Disposable S3-compatible (MinIO)

Docker Hub `minio/minio` returned pull 404 on this host. Image used: `quay.io/minio/minio:RELEASE.2024-12-18T13-15-44Z`. Harness waits for MinIO `API:` log and `/minio/health/live` before SigV4.

| Check | Result | Log |
|---|---|---|
| MySQL 8.4.11 + MinIO | **7/7** pass; same SQL/local cells plus put/rename/HEAD/Range/delete | [mysql-minio-d3.log](mysql-minio-d3.log) |
| PostgreSQL 17.11 + MinIO | **7/7** pass; same cells | [postgres-minio-d3.log](postgres-minio-d3.log) |

Node v22.23.2, Sequelize 6.37.8. Disposable Testcontainers only.

## Cleanup

Remote `/tmp/krasterisk-d3*` removed. `docker ps` afterward showed only the pre-existing `xray-ui`.
