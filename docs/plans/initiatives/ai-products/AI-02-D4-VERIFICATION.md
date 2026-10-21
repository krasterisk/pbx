# AI-02-D4 verification — 2026-09-19

Status: **D4 closed**. Coordinator `codex-direct`. PLAN [AI-02](AI-02-PLAN.md) SHA-256 `84BCDFF527CDA7F0205635F157D6ACA460147092467E9EAE51EE6F8AF89B4907`. No production DB/PBX. No local Docker. No live `BillingBalanceService.charge`.

## Passed

- Additive `0009-ai-usage.sql` (MySQL and PostgreSQL) creates `ai_quota_counters`, `ai_usage_reservations`, `ai_usage_events`, `ai_price_revisions`, `ai_usage_ledger`. 0008 does not create those tables.
- Quota PK is tenant+product+metric+period_start. Concurrent CAS at the limit has one winner; metrics are not added together.
- Parent job reservation holds quota; child operation share does not double-reserve. UNIQUE(owner_key, metric, period_start). Parent/operation pairing CHECK. Wrong-tenant job FK fails.
- Usage events UNIQUE(provider_operation_id, event_key). Ledger UNIQUE(operation_id, entry_kind, sequence), append-only.
- Price revisions are insert-only. Unknown BYOK rate is NULL, never a fake measured zero. `cloud_wallet` processing throws until AI-10.
- Money is decimal strings; chunk costs sum then round half_up once. Kill+replay digest of counters/ledger/events matches when ids are excluded.
- Heartbeat extends expiry; stale hold expires; unknown stays held for reconciliation. Cancel releases leftover without a wallet debit.
- Shadow adapter never calls charge or balance lookup. No `ai_wallet` table.
- Live matrix [REMOTE-MATRIX](evidence/d4/REMOTE-MATRIX.md): MySQL/PG **4/4** SQL cells each.
- Local `ai-usage` Jest **7/7**. Schema inventory + migration runner include 0009. Lint on D4 sources: 0 errors.

## Deviations / not this slice

- Process roles and worker boot are D5. Combined E2E fault matrix is D6.
- Public analysis HTTP remains AI-04. `AiUsageModule` is not imported by AppModule.
- Product runtime still `not-installed`. No live STT/LLM and no cloud wallet debit.

Rollback: stop admission; drain/record unknown; do not drop 0009 tables or charge the live wallet.
