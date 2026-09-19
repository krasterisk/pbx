# AI-01-B1 verification — 2026-09-18

- Targeted parser, context resolver, guard and resource authorization suites: 4 suites / 9 tests passed. Cases include tenant `0`, stale/revoked membership, suspended/expired tenant, superadmin target requirement, spoofed body/path, query/duplicate credential and foreign-resource 404.
- Backend build passed. Full backend: 263 suites / 2957 tests passed, 1 suite / 11 tests skipped, 0 failed; [log](evidence/a2/backend-b1-test.log). Full lint passed with 0 errors and repository warnings; [log](evidence/a2/lint-b1.log).
- No migrations, live provider calls, PBX changes, or local Docker. The B1 module composes with SQL User/Tenant only; future B2 credential generation is intentionally fail closed.

Known boundary: JWT `iat` has second precision, so the DB `updatedAt` comparison alone cannot detect a same-second user update. Current membership, role and tenant status are checked on every request. Per-token revocation needs an explicit token/session revision if required beyond this B1 contract.
