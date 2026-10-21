# D5 current-revision checks

Executed 2026-09-19. Local Docker was not used. No production DB/PBX. Optional PBX `RedisModule` was not loaded.

D5 is composition/readiness, not a dual-engine SQL matrix of its own. Live SQL/Redis/MinIO coverage for two-scheduler CAS and Redis-absent delay is in [D6 REMOTE-MATRIX](../d6/REMOTE-MATRIX.md).

| Check | Result |
|---|---|
| Source graphs (API / worker / media) | Jest: no ARI/AMI/billing cron; worker has no HTTP controllers; media has no `ai-jobs` |
| Readiness matrix | Worker Redis miss 503; API delayed 200 under cap; schema/storage/config fail-closed |
| SIGTERM | Claims stop; inflight drains; unknown usage is not force-released |
| Two schedulers | Second settle is idempotent; quota used once |
| Local profile egress | `AI_CLOUD_EGRESS=1` throws |
| Scripts / env example | `start:ai-api`, `start:ai-worker`, `start:media-worker`; `deploy/ai-process-roles.env.example` |
