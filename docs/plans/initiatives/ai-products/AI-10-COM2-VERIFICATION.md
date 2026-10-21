# AI-10 COM2 verification — 2026-09-20

Status: **implemented locally**. Coordinator `codex-direct`. PLAN [AI-10](AI-10-PLAN.md) SHA-256 `7D50CE43333E27871882DE59DD7BF09DE899F65B8837FE82B89F23B5DDA3AE4A`. No production DB/PBX. No local Docker. No live tenant wallet debit. `productRuntime` is owned by COM3. SKU create still refuses `cloud_wallet`.

## Passed

- Default `shadow` and `local_byok` paths do not call a wallet. `assertCloudWalletDisabled('cloud_wallet')` still throws without both flags.
- Both installation and tenant flags are required. `AI_CLOUD_WALLET=1` alone is not enough; tenant must be listed in `AI_CLOUD_WALLET_TENANTS` or passed explicitly.
- Billable settle charges **before** quota commit. Insufficient funds leave the reservation `held` and used units at 0.
- Replay of `usageChargeOperationKey(reservationId)` produces zero second debit and one ledger settle row. Concurrent `settleUsage` is serialized per reservation.
- Shadow→billable reconcile debits once; held/unknown reservations stay held with no debit.
- Fixture tenant is `8`. `assertNoLiveTenantDebit` refuses tenants `1` and `7`. `billingChargeFromBalanceService` is opt-in and is not registered on `AiUsageModule`.
- No additive 0021. Money amounts stay decimal strings; emulated wallet uses integer kopecks.

## Local checks

- `com2-billable.spec.ts` **9/9**. D4 `d4-usage.spec.ts` **6/6**. SKU engine **9/9**. Emulated wallet **1/1**. D6 foundation **1/1**. SKU service **4/4**.
- ESLint on COM2 sources: 0 errors.

## Deviations / not this slice

- Production job workers do not auto-enable `cloud_wallet`. Flags default off.
- Dual-DB matrix is COM1/0020 evidence, not a COM2 schema change.
- COM3 `productRuntime`, COM4 packaging, DB-04 I1, 10A/10R are out of scope here.

Rollback: leave `AI_CLOUD_WALLET` unset; SKU create cannot publish `cloud_wallet`.
