---
phase: 08-navigation-redesign-android-port-foundation
plan: 06
subsystem: billing
tags: [billing, checkout, marketplace, NAV-07, D-23, 005-B]

requires:
  - phase: 08-navigation-redesign-android-port-foundation
    provides: PurchaseModuleService NotImplemented stub (08-13); Hub Buy / System Modules Buy stubs (08-03/08-05); BillingBalanceService.charge
provides:
  - "PurchaseModuleService charge→activate with 402 INSUFFICIENT_BALANCE"
  - "POST /marketplace/purchase JWT tenant-admin bound"
  - "CheckoutSheet 005-B plan→confirm→success wired to purchaseModule RTK"
affects:
  - Hub Marketplace Buy UX
  - Tenant System→Modules Buy
  - Future PCI top-up / deposit UI (skeleton only)

tech-stack:
  added: []
  patterns:
    - "Server-authoritative price from modules_registry; Hub market via legacy paid codes"
    - "Checkout Dialog desktop / Sheet phone (useIsMobile)"
    - "No Stripe/CloudPayments — internal balance ledger only (D-23)"

key-files:
  created:
    - packages/backend/src/modules/cloud-admin/marketplace.controller.ts
    - packages/backend/src/modules/cloud-admin/dto/purchase-module.dto.ts
    - packages/frontend/src/features/modules/ui/CheckoutSheet/CheckoutSheet.tsx
    - packages/frontend/src/features/modules/lib/hubMarketPrices.ts
  modified:
    - packages/backend/src/modules/cloud-admin/purchase-module.service.ts
    - packages/backend/src/modules/cloud-admin/purchase-module.service.spec.ts
    - packages/backend/src/modules/cloud-admin/modules-registry.service.ts
    - packages/backend/src/modules/cloud-admin/cloud-admin.module.ts
    - packages/frontend/src/shared/api/endpoints/cloudAdminApi.ts
    - packages/frontend/src/widgets/ModuleHub/ModuleHubMarketplaceCard.tsx
    - packages/frontend/src/features/modules/ui/TenantModulesPanel/TenantModulesPanel.tsx
    - packages/frontend/src/shared/config/locales/en.ts
    - packages/frontend/src/shared/config/locales/ru.ts

key-decisions:
  - "Hub market prices resolved via LEGACY_HUB_LICENSE_CODES → first paid registry price"
  - "JWT tenant_id with vpbx_user_uid→tenants.id fallback so purchase binds to billing tenant key"
  - "Locales path shared/config/locales (not plan i18n/locales typo)"
  - "No PCI SDK; insufficient balance shows deposit hint text (no dedicated deposit page yet)"

patterns-established:
  - "PurchaseModuleService: balance check → charge → activate; compensate deposit on activate failure"
  - "CheckoutSheet owns 3 steps; parents only pass moduleCode/name/priceRub display props"

requirements-completed: [NAV-07]

duration: 12min
completed: 2026-07-16
---

# Phase 8 Plan 06: Marketplace Checkout Billing Skeleton Summary

**Real charge+activate purchase path with 005-B CheckoutSheet — Hub Buy and System Modules Buy complete a server-priced ledger purchase without PCI SDKs**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-16T17:35:42Z
- **Completed:** 2026-07-16T17:47:00Z
- **Tasks:** 2
- **Files modified:** 16

## Accomplishments

- Replaced Wave 0 `PurchaseModuleService` stub with charge-then-activate flow and 402 `INSUFFICIENT_BALANCE`
- Added `POST /marketplace/purchase` under JwtAuthGuard (tenant ADMIN); amount never from client
- Shipped `CheckoutSheet` (plan→confirm→success) wired to `purchaseModule` RTK on Hub Marketplace and System→Modules Buy

## Task Commits

Each task was committed atomically (TDD where applicable):

1. **Task 1: PurchaseModuleService + marketplace purchase endpoint**
   - `522eae0` (test) — failing charge-then-activate contract
   - `3a59a4f` (feat) — service, DTO, controller, registry offer helpers, module wiring
2. **Task 2: CheckoutSheet UI + RTK purchaseModule** - `6380ee3` (feat)

**Plan metadata:** see final docs commit

## Files Created/Modified

- `purchase-module.service.ts` — charge → activate (+ compensate on failure)
- `purchase-module.service.spec.ts` — insufficient / success / already-active / compensate
- `marketplace.controller.ts` — `POST /marketplace/purchase`
- `dto/purchase-module.dto.ts` — `{ moduleCode }` only
- `modules-registry.service.ts` — `resolvePurchaseOffer` / `isModuleActiveForTenant`
- `CheckoutSheet/` — 005-B three-step UI + tests
- `hubMarketPrices.ts` — display prices aligned with backend legacy mapping
- `cloudAdminApi.ts` — `purchaseModule` mutation + tag invalidation
- `ModuleHubMarketplaceCard.tsx` / `TenantModulesPanel.tsx` — Buy → CheckoutSheet
- `en.ts` / `ru.ts` — Confirm purchase / checkout error / insufficient balance copy

## Decisions Made

- Hub market modules without a direct registry row bill using the first paid legacy license code price (e.g. callcenter → service_requests 1500₽)
- Controller resolves tenant via `req.user.tenant_id` or `TenantsService.findByVpbxUid` so purchases hit `tenants.id` used by billing balances
- Deposit UX is a textual hint (no tenant deposit route in app yet)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Critical] JWT tenant_id fallback via vpbx_user_uid**
- **Found during:** Task 1
- **Issue:** JwtPayloadUser has no `tenant_id`; billing/modules keys use `tenants.id`
- **Fix:** `MarketplacePurchaseController.requireTenantAdmin` falls back to `TenantsService.findByVpbxUid`
- **Files modified:** `marketplace.controller.ts`
- **Committed in:** `3a59a4f`

**2. [Rule 2 - Critical] Hub market price resolution helpers on ModulesRegistryService**
- **Found during:** Task 1
- **Issue:** Hub codes lack `price_monthly` on `hub_modules`
- **Fix:** `resolvePurchaseOffer` + `isModuleActiveForTenant` using LEGACY_HUB_LICENSE_CODES
- **Files modified:** `modules-registry.service.ts`
- **Committed in:** `3a59a4f`

**Total deviations:** 2 auto-fixed (Rule 2 × 2)
**Impact on plan:** Required for correct secure purchase; no PCI / parallel marketplace invented

## Issues Encountered

None blocking — TenantModulesPanel i18n mock adjusted for object interpolation args in tests

## User Setup Required

None — uses existing internal balance ledger

## Known Stubs

None that block NAV-07 — deposit is hint-only until a dedicated top-up surface exists

## Threat Flags

None beyond plan register (T-08-10/11/SC mitigated: server price, JWT tenant bind, no payment SDK)

## Verification Results

- `cd packages/backend && npx jest --testPathPattern="purchase-module" --no-coverage` — PASS (8)
- `cd packages/frontend && npx vitest run src/features/modules --reporter=dot` — PASS (28)
- No stripe/cloudpayments in `packages/backend/package.json`

## Self-Check: PASSED

- All key artifacts FOUND on disk
- All task commits FOUND: 522eae0, 3a59a4f, 6380ee3
