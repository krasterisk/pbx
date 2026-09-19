# DB-02-B — core startup, CI fixtures and API parity

Status: implementation complete for the assigned core profile. DB-02-C/D/E remain open; this is not a claim of whole-app PostgreSQL query parity.

## Delivered

- `schema-readiness.cjs` validates the selected migration manifest and read-only journal/state before Sequelize connects and before module startup hooks can mutate tables. Empty, legacy, dirty, unknown, changed-checksum, wrong-engine and pending histories fail closed. Startup never runs DDL.
- CI seed accepts both MySQL and PostgreSQL only with explicit `CI=true`, a disposable `krasterisk_ci[_suffix]` database and a supplied test password. It inserts tenant 0 admin, tenant A/B admins, their roles, two tenant rows and offline AI provider fixtures in a transaction; it refuses an existing admin/login.
- `DB_CORE_TEST_PROFILE=true` together with `CI=true` prevents the app from reading the workstation `.env`. The actual AppModule booted against disposable databases on both engines through SSH tunnels to the designated server, with Redis disabled, AMI credentials absent, ARI directed to local unavailable port and offline providers.
- Real HTTP checks cover login/refresh, case-folded login, tenant isolation and CRUD, module catalog/entitlements/settings, and AI provider CRUD. PostgreSQL catalog startup is idempotent by using `code` as its `upsert` conflict key. The `User` model now writes required timestamps and `findByLogin` uses an explicit case-insensitive predicate on both engines.
- Existing MySQL with a successful legacy migration journal can be adopted via the canonical runner after backup/review. A populated unversioned legacy database remains a release gate requiring reviewed schema reconciliation and metadata adoption; automatic marking of its baseline would be unsafe. See `packages/backend/database/README.md`.

## Decisions and limits

- Canonical MySQL 0001 bytes and checksum remain unchanged. The User model metadata fingerprint was re-pinned after verifying its timestamp option changes writes only; no schema column/type/index difference was introduced.
- The core profile does not certify CDR, call-center, autodial or scenario-robot SQL on PostgreSQL. Those are DB-02-C/D assignments. No live Asterisk, PBX provisioning, paid provider call or production data was used.
- The full app can start without an Asterisk connection, but ARI retries and AMI-dependent startup services log unavailable-PBX errors. An explicit external-only module profile remains future integration work; the DB-02-B core request gate did not depend on live PBX.

Evidence: [DB-02-B verification](DB-02-B-VERIFICATION.md) and `evidence/db-02-b/`.
