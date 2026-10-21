# AI-10 COM1 — price book / trial / SKU

Status: **implemented locally** on 2026-09-20 under [AI-10](AI-10-PLAN.md) COM1. Coordinator `codex-direct`. Details: [VERIFICATION](AI-10-COM1-VERIFICATION.md). Dual-DB matrix on ipbx: MySQL/PG **16/16**.

Tenant-owned SKU revisions, trial policy snapshots and entitlements exist behind additive `0020-ai-sku-catalog.sql`. Publication is separate from app enable. Unpublished/draft/revoked SKUs cannot be purchased. Hub checkout for AI products uses the SKU path, not `/marketplace/purchase`. BYOK does not debit the wallet. `cloud_wallet` usage and `productRuntime` are unchanged.

Next: disposable dual-DB contracts for 0020, then [AI-10](AI-10-PLAN.md) COM2 (billable switch). Not I1. Full-pbx journal order is 0019 then 0020.
