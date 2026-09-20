# Pilot productRuntime smoke — 2026-09-20

Unauthenticated helper only (no live Nest boot on ipbx this slice). Jest `product-runtime.spec.ts` also covers the same matrix.

| Env | Result |
|---|---|
| (default) | `productRuntime: not-installed`, `usable: false`, `pilot: false` |
| `AI_PRODUCT_RUNTIME_PILOT=1` + schema + workers | `installed`, `usable: true`, `pilot: true` |
| pilot + schema only (no workers) | `entitled-not-installed`, `usable: false`, `pilot: true` |

Raw: [pilot-health.json](evidence/followup-fe-tls-pilot/pilot-health.json).

**Not declared:** commercial launch, `cloud_wallet`, live tenant debit.
