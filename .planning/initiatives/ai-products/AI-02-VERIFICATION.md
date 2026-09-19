# AI-02 verification — 2026-09-19

Status: **foundation closed**. Coordinator `codex-direct`. PLAN [AI-02](AI-02-PLAN.md) SHA-256 `84BCDFF527CDA7F0205635F157D6ACA460147092467E9EAE51EE6F8AF89B4907`. No production DB/PBX. No local Docker.

## Passed (measured)

- D1 schema/state machines: MySQL/PG 15/15. [D1](AI-02-D1-VERIFICATION.md)
- D2 admission/outbox/leases: SQL 16/16; MySQL+Redis and PG+Redis 10/10. [D2](AI-02-D2-VERIFICATION.md)
- D3 media: local-fs 6/6; MinIO 7/7. [D3](AI-02-D3-VERIFICATION.md)
- D4 usage/quotas/shadow: MySQL/PG 4/4; wallet unchanged. [D4](AI-02-D4-VERIFICATION.md)
- D5 roles/readiness: isolated graphs, delayed API, SIGTERM without force-release. [D5](AI-02-D5-VERIFICATION.md)
- D6 combined: MySQL/PG 5/5; MySQL+Redis+MinIO and PG+Redis+MinIO 7/7. [D6](AI-02-D6-VERIFICATION.md)
- Project lint: 0 errors. Backend Jest 294 suites / 3061 tests pass.

## Absent capabilities (not claimed)

- Public analysis HTTP and 202 status URL (AI-04)
- Product runtimes and live STT/LLM/TTS (AI-03/04/07)
- `cloud_wallet` atomic debit (AI-10)
- Engine change / backup restore (DB-04)
- Guaranteed recovery if SQL, object storage and Redis are all destroyed
- Long-running `ai-api`/`ai-worker`/`media-worker` daemons on ipbx
- Full frontend vitest (hung at `RUN` this session; last C4 evidence 253/1404)

Rollback: stop admission → drain/record unknown → stop workers → previous compatible application build. Do not truncate jobs, ledger or assets.
