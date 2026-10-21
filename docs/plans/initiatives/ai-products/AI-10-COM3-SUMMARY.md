# AI-10 COM3 — license lifecycle + honest runtime flag

Status: **implemented locally** on 2026-09-20 under [AI-10](AI-10-PLAN.md) COM3. Coordinator `codex-direct`. Details: [VERIFICATION](AI-10-COM3-VERIFICATION.md).

`productRuntime` / `usable` are a function of schema-ready ∧ workers-configured ∧ entitlement ∧ not expired. Default env stays `not-installed` / `usable: false`. Community remains `community-core` without an AI SKU. Expiry stops new work and does not delete data. Offline profile forbids a mandatory license heartbeat. No I1 installer and no production runtime flip.
