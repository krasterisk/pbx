# AI-11 11F — fault injection

Status: **implemented + disposable dual-DB+Redis fault matrix** on 2026-09-20 under [AI-11](AI-11-PLAN.md) 11F. Coordinator `codex-direct`. Docs: [AI-11-11F-FAULT](AI-11-11F-FAULT.md). Evidence: [evidence/11f](evidence/11f/REMOTE-MATRIX.md).

Fourteen named pure faults (API crash, worker restart ordinal, Redis enqueue failure, duplicate outbox, stale fence/CAS, forged tenant, rate-limit, long-tool unknown, clock/timezone lease, storage unavailable, idempotent replay zero second debit, deadlock retry) plus live Redis/outbox recovery on MySQL 8.4.11 and PostgreSQL 17.11. Wraps AI-02 D2 contracts. Shadow debit only. Product runtime stays `not-installed`. No live tenant debit, no autodial/`xray-ui`. 11O ops drills are a separate assignment.
