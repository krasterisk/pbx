# AI-02-D5 verification — 2026-09-19

Status: **D5 closed**. Coordinator `codex-direct`. PLAN [AI-02](AI-02-PLAN.md) SHA-256 `84BCDFF527CDA7F0205635F157D6ACA460147092467E9EAE51EE6F8AF89B4907`. No production DB/PBX. No local Docker.

## Passed

- Entrypoints `ai-api.main.ts`, `ai-worker.main.ts`, `media-worker.main.ts` with `start:ai-api` / `start:ai-worker` / `start:media-worker`. Env example without secrets: `packages/backend/deploy/ai-process-roles.env.example`.
- API graph has no ARI/AMI/billing cron. Analytics worker is `createApplicationContext` (no HTTP controllers). Media worker imports storage/probe only, not `ai-jobs`.
- Liveness is always `live: true`. Readiness is schema, Redis, storage (API + media), encryption, provider. Worker Redis miss → 503. API Redis miss → 200 delayed under backlog cap, else 503 backlog.
- SIGTERM: stop claims, wait inflight, `mayForceReleaseUnknown()` is always false.
- Two scheduler settles of the same reservation consume quota once. `AI_CLOUD_EGRESS=1` is refused.
- Logs carry request/job/stage/operation/asset ids and tenant uid; prompt/transcript/audio/Authorization keys are rejected. Metrics are low-cardinality aggregates.
- Operator recovery: [AI-02-RUNBOOK.md](AI-02-RUNBOOK.md) (preview SQL → drain → do not truncate jobs/ledger).
- Local `process-roles` Jest includes D5 cases. Lint on D5 sources: 0 errors.

## Deviations / not this slice

- Roles were not HTTP-booted as long-running processes on ipbx. Isolation, readiness, SIGTERM and two-scheduler CAS are unit-tested; D6 ran the SQL two-scheduler CAS and Redis-absent delayed-accept contract live.
- AppModule still does not mount AI analysis HTTP (AI-04). Optional PBX `RedisModule` semantics unchanged.
- Product runtime still `not-installed`.

Rollback: stop the three roles; drain inflight; do not force-release unknown usage.
