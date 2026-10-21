# AI-10 COM2 — billable switch

Status: **implemented locally** on 2026-09-20 under [AI-10](AI-10-PLAN.md) COM2. Coordinator `codex-direct`. Details: [VERIFICATION](AI-10-COM2-VERIFICATION.md).

Default usage policy stays `shadow`. `cloud_wallet` settlement runs only when both the installation flag (`AI_CLOUD_WALLET=1`) and the tenant flag are on. Live debit uses the existing `BillingBalanceService.charge` operation key `ai-usage:{reservationId}`. The emulated wallet is a test double only. SKU create still refuses `cloud_wallet`. Real-tenant debit is refused in CI.

Next: COM3 runtime flag (no I1). Dual-DB 0020 contracts are the shared schema gate, not a COM2 schema change.
