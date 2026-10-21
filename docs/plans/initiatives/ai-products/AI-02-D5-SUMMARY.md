# AI-02-D5 — process roles, readiness, observability

Status: **closed** on 2026-09-19 under [AI-02](AI-02-PLAN.md) D5. Coordinator `codex-direct`. Details: [VERIFICATION](AI-02-D5-VERIFICATION.md).

`ai-api`, `ai-worker` and `media-worker` have separate entrypoints. Liveness is not readiness. Workers 503 without Redis; the API may delay-accept under the backlog cap. SIGTERM stops claims and never force-releases unknown usage. This is not public analysis HTTP or a shipping product.

Next: [AI-02](AI-02-PLAN.md) D6 (fault suite and foundation close).
