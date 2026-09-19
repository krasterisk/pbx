# AI-02-D2 — admission, outbox, leases, recovery

Status: **closed** on 2026-09-19 under [AI-02](AI-02-PLAN.md) D2. Coordinator `codex-direct`. Details: [VERIFICATION](AI-02-D2-VERIFICATION.md).

API/worker can durably admit an entitled job in one SQL transaction, replay Idempotency-Key, dispatch outbox after commit, and recover from Redis loss, process-kill between enqueue and mark, and stale fences. Required Redis for AI does not change optional PBX Redis. This is not storage, metering, public analysis HTTP, or a shipping product.

Next: [AI-02](AI-02-PLAN.md) D3 (streaming media and storage).
