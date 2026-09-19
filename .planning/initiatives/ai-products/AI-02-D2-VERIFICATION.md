# AI-02-D2 verification — 2026-09-19

Status: **D2 closed**. Coordinator `codex-direct`. PLAN [AI-02](AI-02-PLAN.md) SHA-256 `84BCDFF527CDA7F0205635F157D6ACA460147092467E9EAE51EE6F8AF89B4907`. No production DB/PBX. No local Docker.

## Passed

- Atomic in-memory/SQL admission: 403 unentitled, 202 replay same hash, 409 hash conflict, 503 fairness cap, crash-before-commit rolls back, crash-after-commit keeps the job. Redis enqueue failure does not delete committed SQL.
- Idempotency-Key 1…128 printable ASCII, SHA-256 digest, canonical JSON hash. Required AI Redis factory/`assertAiRedisReady` fail closed; `RedisModule` optional stub unchanged and unused by this module.
- Outbox: enqueue then mark; process-kill after BullMQ add leaves `delivered_at` null; later CAS mark wins once. Handler skip on duplicate event id.
- Stage leases: owner is not an OS PID; CAS + fence; two OS worker processes produce one winner; stale fence cannot complete.
- Cancel: queued job terminals and cannot be claimed; executing sets `cancel_requested_at`, matching fence may finish the current stage, next pending stage is not claimed.
- Retry: three transient attempts then `dlq`; protocol/permanent fail immediately; dispatched crash/`timeout` → `unknown`; worker restart does not insert a second `ordinal`.
- Test provider barriers: dispatch / observe / timeout. Forged queue `tenantUid` rejected against SQL tenant.
- Live matrix [REMOTE-MATRIX](evidence/d2/REMOTE-MATRIX.md): MySQL/PG SQL **16/16**; MySQL+Redis and PG+Redis live **10/10** including Redis empty restart rehydrate.
- Local `ai-jobs` Jest **21/21**. Lint on D2 sources: 0 errors.

## Deviations / not this slice

- Tenant quota **row** is not a D4 ledger table; v1 fairness locks/counts `ai_jobs` queued/running only.
- Public analysis HTTP and 202 status URL remain AI-04. `AiJobsModule` is not imported by AppModule (D5 process roles).
- Fairness round-robin soak across many tenants is unit-capped, not a long-running live load test.
- Product runtime still `not-installed`. No live STT/LLM. No usage settlement.

Rollback: stop AI API/worker admission; drain/record unknown; do not drop 0008 tables or RedisModule semantics.
