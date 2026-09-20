# AI-10 COM1 verification — 2026-09-20

Status: **implemented locally; dual-DB closed**. Coordinator `codex-direct`. PLAN [AI-10](AI-10-PLAN.md) SHA-256 `7D50CE43333E27871882DE59DD7BF09DE899F65B8837FE82B89F23B5DDA3AE4A`. No production DB/PBX. No local Docker. No live tenant wallet debit. `productRuntime` remains `not-installed` unless COM3 flags are set. `cloud_wallet` usage still disabled by default.

## Passed

- Additive `0020-ai-sku-catalog.sql` (MySQL and PostgreSQL) creates `ai_trial_policy_snapshots`, `ai_sku_revisions`, `ai_sku_offers`, `ai_sku_entitlements`. Full-pbx apply order is `0019` then `0020` so journal `ORDER BY name` stays a prefix of the manifest. Standalone analytics/robot profiles include 0020 and not 0019. After apply, both full-pbx and standalone `schemaVersion` are `0020-ai-sku-catalog.sql`.
- Unpublished, draft and revoked SKUs are denied even on the direct purchase API (`OFFER_NOT_RELEASED`). Tenant A cannot list or buy tenant B offers.
- Enable without purchase → `not_entitled`. Purchase without ProductActivation → processing `product_disabled`. Trial limits seed server quota counters.
- `local_byok` purchase does not call `BillingBalanceService.charge`. Priced shadow SKU uses the existing wallet charge with `purchaseChargeOperationKey`; usage metering is not billed here.
- Price edit inserts a new revision; purchased entitlement keeps the old revision id.
- Hub Buy for AI products calls `POST /marketplace/ai-products/skus/:code/purchase`. Unpublished SKUs keep Buy disabled. Hub enable for AI products calls `setActivation`, not `tenant_modules` upsert.
- A1 `RELEASED_AI_PRODUCT_OFFERS` stays empty. Autodial/`xray-ui` untouched.

## Local checks

- Engine `sku-catalog.spec.ts` **8/8**. Persistence `sku-catalog.service.spec.ts` **4/4**. `product-access.service.spec.ts` includes SKU grant without activation. `modules-registry.service.spec.ts` **17/17**.
- Schema inventory **7/7**. Migration runner **20/20** (combined node:test run **27/27**).
- Frontend targeted vitest **10/10** (CheckoutSheet, TenantModulesPanel, ModuleHub, MarketplaceCard).
- ESLint on COM1 backend/frontend sources: 0 errors.

## Deviations / not this slice

- Dual-engine `run-contracts` on `ipbx.krasterisk.ru`: MySQL **16/16**, PostgreSQL **16/16**. Live PG inventory **196** tables / **2258** columns / **40** enums / **89** FKs. Evidence: [contracts-0020](evidence/contracts-0020/REMOTE-MATRIX.md).
- COM2 billable switch, COM3 `productRuntime` flag, DB-04 I1 installer are out of scope.
- SKU create still refuses `cloud_wallet` money policy. Monthly SaaS charge reuses `BillingBalanceService.charge` only on priced non-BYOK purchase.

Rollback: leave 0020 unapplied on production; do not publish SKUs; Hub Buy stays disabled without a published offer.
