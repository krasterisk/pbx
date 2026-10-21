# AI-02 operator runbook

Read-only preview first, then a targeted action. Do not truncate `ai_jobs`, `ai_usage_*`, or media tables.

## Process roles

| Role | Script | Ready when |
|---|---|---|
| `ai-api` | `npm run start:ai-api --prefix packages/backend` | schema + storage + encryption/provider; Redis optional until backlog cap |
| `ai-worker` | `npm run start:ai-worker --prefix packages/backend` | schema + Redis + encryption/provider. Missing Redis is 503, not delayed accept |
| `media-worker` | `npm run start:media-worker --prefix packages/backend` | schema + Redis + storage probe |

Copy `packages/backend/deploy/ai-process-roles.env.example`. Never commit secrets. `AI_CLOUD_EGRESS=1` is refused on local profiles.

Liveness (`/api/health/live`) only means the process is up. Readiness is SQL/schema, Redis, storage, encryption, and provider capability. API with Redis down returns 200 delayed while backlog is under `AI_BACKLOG_CAP`, otherwise 503. Do not treat delayed as succeeded.

## Recovery

1. Preview: `SELECT state, COUNT(*) FROM ai_jobs GROUP BY state;` and the same for `ai_usage_reservations`. Confirm unknown holds (`state='held'` with stale `expires_at`).
2. Stop admission (disable the API role or set schema/provider not-ready).
3. Drain workers: SIGTERM stops new claims, waits inflight, and **must not** force-release unknown usage.
4. Record unknown operations for reconciliation; keep bounded reserves visible.
5. Stop workers. Roll back only to a compatible application build. Leave ledger, assets, and schema in place.
6. Engine change or restore is DB-04, not this runbook.

Quota rejects, storage failures, and outbox lag are aggregate metrics. Tenant drill-down is authorized SQL, not log scraping of prompts, transcripts, audio, or keys.
