# AI-01-A3 — tenant-exact provider readiness and legacy inventory

Status: implemented backend preparation slice, 2026-09-18. Assignment: `AI-01-A3-provider-readiness` in [EXECUTION](EXECUTION.md), PLAN A3 at SHA-256 `C46E8834643A706635CF97FCBE69930E11D45CF97739F6930CF6258E5D1984E1`.

The agent inventory now pages by stable UID (maximum 100), queries only the JWT tenant, and selects explicit agent/provider/toolset columns. It never loads the provider ciphertext, endpoint, defaults, pricing or toolset `tools` payload for readiness. Each row returns `{ready, issues}` with `code`, provider `role` and reference UID, without secrets. Realtime requires a `realtime` model; cascade requires separate `llm`, `stt` and `tts` capabilities. Disabled, missing and foreign-tenant references are reported separately. Tenant UID `0` is a real owner, never a global template.

Agent create/update now validates the resultant stored-plus-patch configuration against exact-tenant, enabled, role-capable providers and exact-tenant toolsets. The former implicit `user_uid IN (0, tenant)` provider acceptance was removed. Disabling or repairing an invalid historical draft remains possible; re-enabling it requires readiness. A read-only `checkReadiness` method rechecks current provider state for later AI-robot publish/admission. This slice does not start a new AI-robot runtime, so the future runtime must invoke this check at its own admission boundary.

Admin endpoints under `/ai-agents` expose `inventory?limit=&afterUid=`, `inventory/report?maxRows=` and `:id/readiness`. The bounded migration report identifies invalid provider/toolset references and duplicate `unique_id` values for the scanned tenant, including tenant `0`. `truncated=true` means it is only a preview, not a clean migration verdict. Existing provider list/create/update API responses now replace the encrypted key field with `has_key`, matching the frontend contract.

No provider secrets or agents were copied across tenants, no historical row was deleted, and no live provider call was made. Provider network/codec readiness and new-product processing remain later slices.
