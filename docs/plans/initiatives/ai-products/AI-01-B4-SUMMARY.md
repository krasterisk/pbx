# AI-01-B4 — tenant identity without PBX provisioning

Status: backend onboarding foundation implemented 2026-09-19. Scope: [AI-01-B](AI-01-B-INTEGRATIONS-PLAN.md), B4, SHA-256 `357D7E2C19370D50A85004A18C925161984B901C22DFF7D2429657387E9D7ECC`.

Added `TenantIdentityModule` containing only Sequelize, User and Tenant. Its transaction creates the tenant admin with the existing owner UID mapping, then the tenant; an optional callback runs PBX provisioning inside the same transaction. The existing BOX registration now selects the PBX profile in server code and creates both private contexts through that callback. Public CLOUD self-registration remains disabled. Mail and audit transport failures after commit no longer turn a successful public registration into a retry that could appear failed.

The existing platform-admin tenant controller has a separate `POST /api/cloud-admin/tenants/analytics` action. Its validated body has no profile/module selector; the server chooses the analytics profile. This creates an active admin identity and tenant with zero PBX resource limits, without contexts, core PBX modules, billing balance or welcome email side effects. The response is an explicit allowlist and excludes password hashes. Product access still requires the separate activation/license policy; onboarding does not create an entitlement. The legacy platform PBX provisioning path is unchanged.

Additive migration 0007 protects `users.login` with a case-insensitive unique key on MySQL and a `LOWER(login)` unique index on PostgreSQL. Its read-only duplicate preflight runs before the dirty marker. Existing duplicate users must be reconciled by an operator; the migration does not merge or delete accounts. The database constraint closes the create-after-precheck race.

Joining PBX to an existing analytics identity is a separate idempotent command and remains unavailable; no route silently creates a second tenant. Full standalone product boot is a later AI-01-C2/C4 gate.
