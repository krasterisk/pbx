# Phase 18 — External API / HTTP Coverage

Assumption-delta scan (`gsd-tools query assumption-delta scan 18 --json`): **`detected: false`**. No `<assumption_delta_decision>` invented.

External STT, scoring LLM, insights LLM, URL download, and analytics webhooks are treated as detected integrations. Default disposition is **INTEGRATE**. Locked OPT-OUTs are recorded with reasons.

| Capability | Disposition | Notes |
|------------|-------------|-------|
| STT provider (platform allowlist models for speech analytics) | INTEGRATE | One STT pass per run; used by route job, upload, API file, URL after complete download, Get analytics, regenerate (D-23, D-38, D-46). |
| Scoring LLM (call analysis / metrics) | INTEGRATE | Scores transcript against published project metric set; mono role assignment when energy fails (D-23, D-38, D-46). |
| Insights LLM (dashboard insights) | INTEGRATE | On-demand only; min 10 conversations; cache until refresh; SA-CHARGE-INSIGHTS on success (D-35, D-36, D-47). |
| URL download (server-side HTTP/HTTPS GET into journal) | INTEGRATE | Any public or LAN address; self-signed TLS accepted; size/timeout caps; incomplete download is error (D-39…D-42). No host allowlist. |
| Analytics event webhook delivery | INTEGRATE | Project-configured URL + headers; events `analysis.completed`, `analysis.error`, `budget.exceeded`, `anomaly.detected`; real Test button; cabinet `WebhookQueueService` (D-30). |
| Digest / alert delivery via NotificationIntegrations | INTEGRATE | Recipients are existing Integrations page channels only (D-29). |
| dual-stt second STT pass | OPT-OUT | Locked out of scope (D-23). |
| Live wallet debit / `settleShadow` / `BillingBalanceService` | OPT-OUT | This phase only persists calculated amounts via SA-CHARGE-RUN / SA-CHARGE-INSIGHTS (D-46…D-48). |
| SA-CHARGE-GATE balance check | OPT-OUT | Later phase (D-49). |
| DashboardBuilder widget constructor | OPT-OUT | Locked not ported (D-34). |
| Separate Reports page | OPT-OUT | Excel on journal toolbar only (D-37). |
| Analyst role / `sa_project_members.analyst` product path | OPT-OUT | Use existing SUPERVISOR + admin/superadmin (D-10). |
| Refund on conversation delete | OPT-OUT | No charge this phase; future debit must not reverse SA-CHARGE-RUN on delete (D-13). |

## Provider call map (planned)

| Call site | Protocol | Auth | Charge seam |
|-----------|----------|------|-------------|
| Pipeline STT | Existing AI provider HTTP from platform model list | Tenant/platform provider credentials | Contributes `audio_ms` into SA-CHARGE-RUN |
| Pipeline scoring LLM | Same | Same | Contributes `provider_tokens` into SA-CHARGE-RUN |
| Insights LLM | Same | Module insights model or call-analysis fallback (D-36) | SA-CHARGE-INSIGHTS |
| `analyze-url` download | Server HTTP(S) GET | None / URL as-is; insecure SSL accepted | None until complete file then same as upload → SA-CHARGE-RUN |
| Event webhook test + delivery | HTTP(S) POST via `WebhookQueueService` | Project custom headers | Not a charge point (D-48) |
| Golden eval scoring | Scoring LLM only | Platform credentials | Not a charge point (D-43, D-48) |
