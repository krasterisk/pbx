# AI-10 COM3 verification — 2026-09-20

Status: **implemented locally**. Coordinator `codex-direct`. PLAN [AI-10](AI-10-PLAN.md) SHA-256 `7D50CE43333E27871882DE59DD7BF09DE899F65B8837FE82B89F23B5DDA3AE4A`. No I1 installer. Default `AI_SCHEMA_READY` / `AI_WORKERS_CONFIGURED` are unset, so process runtime stays `not-installed`.

## Passed

- `resolveProductRuntime` distinguishes `not-installed`, `entitled-not-installed`, `installed`, `expired`, `community-core`.
- Community is usable without an AI SKU. Expiry sets `usable: false` and does not change community-core.
- `StandaloneCapabilitiesService` computes runtime from `decide()` plus process flags. Default flags → `not-installed`.
- License import already denied invalid / expired / wrong-install / replay (A2). COM3 adds renewal (revision replace) and rotated signing key import.
- Trial expiry in `processingAdmission` returns `entitlement_expired` and keeps quota/entitlement rows.
- Offline profile: `AI_LICENSE_PROFILE=offline` with `AI_LICENSE_HEARTBEAT=1` throws. No mandatory outbound heartbeat.
- Bounded UI states in `StandaloneAiApp`: expired vs entitled-not-installed vs installed.

## Local checks

- `product-runtime.spec.ts` **4/4**. Capabilities **4/4**. ProductAccessService **7/7**. License verifier **4/4**. SKU engine includes expiry. Frontend StandaloneAiApp **5/5**.

## Deviations / not this slice

- Health `/api/health` stays process-level `not-installed` without a tenant. Usable commercial runtime requires capabilities + flags.
- DB-04 I1 does not set `AI_SCHEMA_READY`. Operators must set flags after a real install.
- 10A/10R onboarding is gated on I1–I3.

Rollback: unset `AI_SCHEMA_READY` and `AI_WORKERS_CONFIGURED`.
