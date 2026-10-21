# AI-01-B2 — integration credentials

Status: backend foundation implemented 2026-09-19. Scope: [AI-01-B](AI-01-B-INTEGRATIONS-PLAN.md), B2, SHA-256 `357D7E2C19370D50A85004A18C925161984B901C22DFF7D2429657387E9D7ECC`.

Added tenant-bound integration principals, credential generations, grants, audit and idempotent command receipts in additive migrations 0005 for MySQL and PostgreSQL. Migration 0006 adds shared failed-auth counters with indexed expiry. No migration creates a principal, key or grant. Both new models are registered in AppModule and the integration module, and inventory tracks additive migration ownership without modifying the immutable baseline.

The service creates a random selector and high-entropy secret, persists only a versioned SHA-256 digest, and returns the full token only on the first successful create/rotate response. A replay returns metadata without the token. Create, rotate and disable are transactional; principal/tenant row locks and unique generation/command constraints prevent duplicate active generations and duplicate command effects. Rotation immediately revokes the predecessor. Authentication checks digest in constant time, current generation, revocation, expiry, tenant state and live product access; it uses no credential cache. Management writes recheck current tenant-admin status in SQL.

Grant replacement validates fixed product/resource/scope pairs and resource ownership. The production resolver registry is empty until AI-04 projects and AI-07 deployments exist, so nonempty grants are denied. A key with no grant cannot upload analytics or start a robot. The shared SQL limiter counts failed key attempts by hashed remote address and address/selector across API processes (20/min and 5/min respectively); expiry cleanup is indexed. Only the socket address is trusted; reverse-proxy policy is deferred to B3.

B2 is a service and database slice. No external management or product API routes are published by B2. B3 must add audited HTTP contracts, no-store secret responses, sanitized capability discovery and route-level authorization; AI-04/07 must register real tenant-scoped resource resolvers before scoped grants can be issued.
