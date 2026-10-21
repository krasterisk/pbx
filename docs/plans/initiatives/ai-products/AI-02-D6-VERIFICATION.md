# AI-02-D6 verification — 2026-09-19

Status: **D6 closed**. Coordinator `codex-direct`. PLAN [AI-02](AI-02-PLAN.md) SHA-256 `84BCDFF527CDA7F0205635F157D6ACA460147092467E9EAE51EE6F8AF89B4907`. No production DB/PBX. No local Docker. No live wallet charge. No real PSTN calls.

## Passed

- Combined matrix [REMOTE-MATRIX](evidence/d6/REMOTE-MATRIX.md): MySQL and PostgreSQL local-fs **5/5**; MySQL+Redis+MinIO and PostgreSQL+Redis+MinIO **7/7**.
- End-to-end SQL: ready asset → admitted job → prepared operation → quota CAS → parent/child reservation → unique usage event → shadow ledger. Tenant 0, tenant 8 and tenant 9 isolated; cross-tenant job FK fails.
- Two schedulers: one CAS winner; stale fence ignored. Duplicate event/ledger sequence rejected (kill+replay). Cancel does not drop the ledger. Running job holds retention.
- Redis PING on disposable Redis; SQL rows survive a dead Redis connection. API delayed-accept when Redis is absent is unit-covered (D5) and re-asserted in the D6 harness.
- Disposable MinIO put/head on a generated bucket; no existing production buckets.
- Local D6 Jest path: memory upload → shadow settle → matching receipt digest. D1–D5 unit suites still pass.
- Project lint: 0 errors (warnings only, pre-existing). Backend Jest **294** suites / **3061** tests pass (11 skipped). Nest `dist` emits `ai-api.main.js`, `ai-worker.main.js`, `media-worker.main.js`. Analytics/robot/community profile builds passed.
- Operator runbook: [AI-02-RUNBOOK.md](AI-02-RUNBOOK.md).

## Deviations / not this slice

- Full `npm run test:frontend` and the C4 exclude rerun both hung at Vitest `RUN` with zero files on this Windows host. Last closed C4 evidence remains 253 files / 1404 tests. Not re-counted in this session.
- AI process roles were not left running as HTTP daemons on ipbx. Nest `dist` build of the three mains is the compile gate.
- Analytics/robot/community isolated builds were not a D5 remote boot; they remain C2 composition gates.
- Public analysis HTTP remains AI-04. Live STT/LLM, cloud wallet, and DB-04 restore are absent.
- Product runtime still `not-installed`.

Rollback: stop admission → drain/record unknown → stop workers → previous compatible application build. Do not delete ledger, assets or schema. Engine change is DB-04.
