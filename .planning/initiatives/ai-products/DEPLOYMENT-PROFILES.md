# AI-00 — deployment profiles

| Profile | Product boundary | Provider operation | License and billing | Required acceptance |
|---|---|---|---|---|
| Community core | PBX core compiles and runs without commercial AI source/endpoint/cron/menu | No required provider | No AI entitlement; core remains usable | Core-only build and route/PBX regression |
| SaaS managed | `ai_voice_robots` and `speech_analytics` independently enabled per tenant | Managed or customer provider connection by explicit binding | Cloud entitlement/quota; later usage reservation/ledger | Tenant/API guards, isolated resources and no direct URL bypass |
| Self-hosted BYOK | Same product contracts without SaaS control plane dependency | Tenant supplies provider or local endpoint | Signed local license, local quotas and non-billable usage allowed | Offline license verification, no mandatory SaaS egress, backup/restore proof |
| Self-hosted managed connector | Same self-hosted app connects to an optional managed service | Explicit outbound connection only | Local license plus contract-defined managed usage | Failure leaves PBX/core and historical product data intact |

The current `DEPLOYMENT_MODE != CLOUD` unconditional module allow is a legacy convenience, not the target BOX/OPENSOURCE policy. AI-01 must replace it only for new product guards with a deployment-aware entitlement interface; it must not silently revoke existing customers or modify existing license records.
