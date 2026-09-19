# AI-01-B3 — integration management API

Status: backend HTTP surface implemented 2026-09-19. Scope: [AI-01-B](AI-01-B-INTEGRATIONS-PLAN.md), B3, SHA-256 `357D7E2C19370D50A85004A18C925161984B901C22DFF7D2429657387E9D7ECC`.

Registered `/api/v1/integrations` in the existing global `/api` prefix with the dedicated tenant-context guard. Tenant admins can list safe principal metadata, create a key, replace grants with an expected permission revision, rotate with an expected generation and idempotent operation ID, or disable all generations. A machine key can access only `/self/capabilities` and never receives management authority. Create/rotate respond 201 with a secret only once and `Cache-Control: no-store`; replay returns `token: null`. Revoke responds 204.

The capability response contains only its own product, revision, usable tenant-bound resource IDs/scopes and a generic `available`, `not_configured` or `temporarily_unavailable` state with a documented action. No provider URL, PBX infrastructure, prompt or secret is included. The production resource registry remains empty until AI-04/07, so no scoped grant is currently usable. Validation is strict under the application `ValidationPipe`; OpenAPI documents 201/204 and 400/401/403/404/409/429/503 outcomes.

Authentication failures and management requests use shared SQL limit buckets. Socket peer addresses are authoritative by default; `INTEGRATION_TRUSTED_PROXY_IPS` explicitly trusts exact reverse-proxy peers and right-to-left `X-Forwarded-For` parsing. Untrusted or malformed chains cannot choose the limiter address. No external analytics upload or robot invocation routes are introduced in B3; those depend on product resources and later phases.
