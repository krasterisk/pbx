# Optional BLF / presence — EXECUTION and PLAN

Coordinator/writer: Codex `/root`; mode: `codex-direct`; baseline: main, 327ca234.
Scope: endpoint subscription policy, tenant hints, endpoint form, box modules.
Excluded dirty baseline: backend/src/main.ts and database/migrations/0031-cdr-chain.sql.

## Tasks

1. Reuse allow_subscribe as optional permission (new endpoints off); force a
   server-owned tenant subscribe_context. Preserve existing enabled subscribers.
2. Generate isolated hint-only contexts for primary + WebRTC devices; reconcile
   create/update/delete/bulk operations and startup/retry without reloading on reads.
3. Add a labelled BLF checkbox in endpoint Calls tab, remove managed raw fields.
4. Include required presence/dialog generators in box build/runtime profile.
5. Targeted isolation/lifecycle/UI tests, required lint/backend/frontend suites,
   build, commit/push, deploy and verify SIP SUBSCRIBE/NOTIFY and hint states live.

Acceptance: disabled subscriber cannot subscribe; enabled subscriber gets status
for own organization's extensions only; deleting device removes its hint; modules
and configuration survive restart. No DB migration or entitlement changes.

Status: in_progress. Tests/live/release: pending.
Next action: implement tasks 1–4 locally.
