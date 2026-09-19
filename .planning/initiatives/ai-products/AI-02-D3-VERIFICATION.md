# AI-02-D3 verification — 2026-09-19

Status: **D3 closed**. Coordinator `codex-direct`. PLAN [AI-02](AI-02-PLAN.md) SHA-256 `84BCDFF527CDA7F0205635F157D6ACA460147092467E9EAE51EE6F8AF89B4907`. No production DB/PBX. No local Docker.

## Passed

- Opaque storage refs `krs:v1:(local|s3):tenant:uuid`. Object keys `t{tenant}/{uuid}`; `..`, UNC, absolute drive, NUL, and symlink follow are denied. API/SQL never stores a user filesystem path.
- Local adapter: write `.part`, fsync, atomic rename, `stat`/`openRange`/`delete`. Memory adapter shares the same `ObjectStore` contract.
- S3-compatible adapter: SigV4 path-style PUT/GET/HEAD/DELETE/rename; endpoint only from deployment env (`AI_S3_ENDPOINT` http(s)), not tenant input. Live MinIO on both SQL engines.
- Upload pipeline: allocate → chunk byte cap → commit → probe from bytes (MIME advisory) → ready + `asset.ready` outbox. Duplicate finalize stays ready. Crash after rename before SQL leaves `probing` even if the object exists.
- Probe: WAV/FLAC/MP3 magic; truncated WAV; decoded size bomb; >2 channels; 8–48 kHz; `channelRoles=unknown`; silence/mono/stereo quality flags. ffprobe spawn is an argument array, no shell.
- Range: tenant match, `ready` only, 8 MiB cap. Retention: active job count and `retention_at` hold; upload expiry holds while a lease is live.
- Same checksum, different tenants → different keys. Unique `storage_key` in SQL.
- Live matrix [REMOTE-MATRIX](evidence/d3/REMOTE-MATRIX.md): MySQL/PG local-fs **6/6**; MySQL+MinIO and PG+MinIO **7/7**.
- Local `media-assets` Jest **7/7**; shared `ai-media` **1/1**. Lint on D3 sources: 0 errors.

## Deviations / not this slice

- Public analysis HTTP, Range proxy route, and 202 status URL remain AI-04. `MediaAssetsModule` is not imported by AppModule (D5 process roles).
- V1 does not fetch recording URLs (no SSRF ingest). Normalized PCM/playback derivatives are not produced in this slice; lossless original is preserved for WAV/FLAC, MP3 stays lossy.
- Disk-full is unit-mapped (`ENOSPC` → `storage_full`); a live ENOSPC fill was not run on ipbx.
- Usage/quota ledger tables remain D4. PBX hangup/routes and optional `RedisModule` were not changed.
- Product runtime still `not-installed`. No live STT/LLM.

Rollback: stop upload/probe workers; leave objects and SQL as probing/failed; do not drop 0008 tables.
