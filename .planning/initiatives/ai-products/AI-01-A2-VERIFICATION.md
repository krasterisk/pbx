# AI-01-A2 verification — 2026-09-18

## Local checks

- Backend build: passed.
- `npm run lint`: passed with repository warnings and zero errors.
- `npm run test:backend`: 257 suites passed, 1 skipped; 2936 tests passed, 11 skipped, 0 failed.
- `npm run test:db:unit`: 45/45 passed. `npm run test:db:schema`: 7/7 passed, including additive model ownership.
- Product verifier, policy, registry and service tests cover signed vector, tampering, unknown key, wrong installation/issuer/tenant, future/expired/invalid product, activation separation, import/downgrade/revision conflict, tenant `0`, local admission and rollback clock.
- `npm run test:frontend` was attempted with elevated filesystem read after the sandbox denied Vite configuration access. It reproduced the pre-existing `ConferenceRoomFormModal.test.tsx` locale assertion (`conferences.history.empty`) and stalled before a suite summary; the run was stopped. No frontend code was changed in A2. Raw output: [frontend-test.log](evidence/a2/frontend-test.log).

## Dedicated DB server

On `root@ipbx.krasterisk.ru`, a fresh isolated `/tmp/krasterisk-a2.QLnKBE` bundle ran all contract cases against disposable containers, never local Docker or an existing database. The final harness additionally inserted a tenant-zero license document, binding and activation; joined them and confirmed a missing document FK is rejected. It tested clean install, upgrade and no-op replay of the 0004 manifest entry.

| Engine | Image/server | Result | Evidence |
|---|---|---:|---|
| MySQL | `mysql:8.4.11` / 8.4.11 | 11/11 pass | [mysql-final.log](evidence/a2/mysql-final.log) |
| PostgreSQL | `postgres:17.11-bookworm` / 17.11 | 11/11 pass | [postgres-final.log](evidence/a2/postgres-final.log) |

After copying logs, `docker ps -a --filter label=org.testcontainers=true` reported zero containers, and the verified temporary directory was removed. No PBX calls, production data or payments were used.

## Release limits

The independent security review required by A2 has not occurred. Signed production licenses must not be issued yet; AI product offers remain unpublished and blocked from purchase. This verification does not claim live Asterisk, frontend activation UI, provider readiness, or commercial runtime acceptance.
