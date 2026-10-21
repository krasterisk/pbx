# AI-02-D1 — schema and state machines

Status: **closed** on 2026-09-19 under [AI-02](AI-02-PLAN.md) D1. Coordinator `codex-direct`. Details: [VERIFICATION](AI-02-D1-VERIFICATION.md).

Jobs, media assets, outbox, idempotency and provider revisions exist as UUID/tenant SQL on MySQL and PostgreSQL, with composite tenant FKs, insert-only provider revisions, and tested state machines. This is not admission, workers, storage, metering or a shipping AI product.

Next: [AI-02](AI-02-PLAN.md) D2 (admission, outbox dispatcher, leases, recovery).
