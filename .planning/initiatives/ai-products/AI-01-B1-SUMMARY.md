# AI-01-B1 — trusted tenant context boundary

Status: backend foundation implemented 2026-09-18. PLAN [AI-01-B](AI-01-B-INTEGRATIONS-PLAN.md) B1, SHA-256 `357D7E2C19370D50A85004A18C925161984B901C22DFF7D2429657387E9D7ECC`.

The neutral `integration-credentials` module defines a readonly `TenantContext` and a header-only guard for future integration routes. A JWT is verified with the configured signing secret, issuer and audience, then the current user and tenant are reloaded from SQL. Changed membership/role, deleted user, post-token account update, pending activation, suspended/cancelled or expired-trial tenant are denied. Tenant UID `0` is valid. Platform superadmin tenant operations require a future separate audited target path; there is no generic bypass.

The new parser rejects query tokens, duplicate Authorization headers and malformed machine tokens. A syntactically valid `krint_v1` key remains unauthorized until B2 installs a credential store; it is never interpreted as JWT. Client-supplied tenant context/body ownership fields are rejected, and a mismatched tenant path returns 404. Request IDs are generated server-side. This guard is not applied to legacy PBX endpoints or SSE routes.

Resource authorization accepts a tenant-scoped resolver for the declared analytics project or AI-robot deployment pair. With no compiled resolver installed, it denies access. A resolver must look up the resource by tenant UID; foreign and nonexistent resources both return 404. Permissions are separately checked after ownership. No project/deployment resolver is registered yet because those domain resources are planned for AI-04/07.

B1 does not issue credentials, create grants, expose external API routes, or prove standalone analytics boot. These are B2–B4/C tasks.
