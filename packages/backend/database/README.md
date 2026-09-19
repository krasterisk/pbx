# Database configuration and versioned schema

`npm run db:migrate` applies the artifacts selected by `migrations/manifest.json`.
`npm run db:migrate:list` prints engine, IDs, paths and checksums without connecting.
`npm run db:migrate:status` reads engine, schema version, applied/pending IDs and
the dirty marker under a session lock; it does not create or change tables.
Status returns a nonzero exit code for dirty/invalid history. No credentials are
printed. Unknown flags and automatic rollback are rejected.

`DB_SCHEMA_PROFILE` selects the installation schema. The default `full-pbx`
preserves the original 0001…0007 IDs and checksums. `analytics-api` and `robot-api`
are clean minimal installations: their shared `0001-ai-standalone-base.sql` contains only reviewed
identity, session, tenant, module catalog, audit and AI provider tables; 0004…0007
are the same shared migrations as full-pbx. The minimal artifacts are generated
offline from the immutable baselines with
`node harness/database/build-minimal-baseline.cjs`; `--check` verifies them.
The runner never filters full SQL at install time. Profile is stored in
`krasterisk_schema_state`; changing the environment to switch an existing
database to another profile fails before migration or API startup. Upgrading a
minimal installation to full PBX requires a separate reviewed data-preserving
plan; changing the env variable is not an upgrade.

Standalone API builds are explicit: `npm run build:analytics -w @krasterisk/backend`
and `npm run build:robot -w @krasterisk/backend`, followed by their corresponding
`start:*` scripts with a matching `DB_SCHEMA_PROFILE`. The frontend has matching
`build:analytics` and `build:robot` bundles. These C2 compositions currently
provide identity/login, integration credentials, connectivity and an honest
health result `productRuntime: not-installed`; analytics processing and SIP robot
execution require later product runtime phases. The standalone login accepts
only bcrypt credentials on an active tenant. After applying migrations, the
installer can provision its first tenant with `provision:analytics` or
`provision:robot` in the matching backend build. Set `DB_SCHEMA_PROFILE`,
`STANDALONE_ADMIN_LOGIN`, `STANDALONE_ADMIN_NAME`, and `STANDALONE_COMPANY_NAME`;
pipe a 12–128 character password to stdin. The command refuses a terminal stdin
so the password is not placed in argv or environment. It creates only identity
and tenant rows, with zero PBX limits; it never creates Context, Asterisk or CDR
data. Provisioning another tenant is an explicit operator action. The disposable
CI seed remains a test fixture, not an installer.

Existing full-pbx journals keep their rows unchanged. If their older state
table lacks `profile`, `db:migrate:status` reports `legacy-full-pbx` and startup
requires `db:migrate`. The locked migration command adds only the profile
metadata column after verifying the journal prefix and dirty marker. It never
reapplies 0001 or changes its checksum. Back up and review the database before
running migrations in production.

**DB-02-A schema availability:** MySQL and PostgreSQL baselines are selected by
the manifest. Both install only into an empty database; reruns use the versioned
journal and do not reapply SQL. PostgreSQL schema installation does not certify
full application startup, seed, Asterisk integration or business-query parity;
those are DB-02-B through DB-03. Test fixtures are supplied directly by the
isolated harness; there is no production `--fixtures`, arbitrary SQL path or
fallback to MySQL. Changing `DB_DIALECT` does not transfer data.

## One configuration source

`src/database/database-config.cjs` exports `resolveDatabaseConfig(input)` and
`toDriverConfig(config)`. It does not read files, load dotenv, connect, or log.
Nest loads its ConfigModule before calling the resolver; its CJS asset is copied
to `dist/database` by Nest build. CLI and CI seed use the same source. Sequelize
stays on major 6; `pg` and `pg-hstore` are explicit backend dependencies.

App defaults remain MySQL, localhost, user/database `krasterisk`, empty password.
Migration and seed CLIs require explicit `DB_HOST`, `DB_USER`, `DB_PASSWORD`,
`DB_NAME`; an explicitly empty password is accepted for MySQL. PostgreSQL
requires a nonempty password: `pg` otherwise falls back to ambient `PGPASSWORD`.
They never load `.env`
implicitly. `DB_PORT` is optional: 3306 for mysql, 5432 for postgres. An explicit
value always wins; invalid/empty/out-of-range values fail before connecting.

| Setting | Default / contract |
|---|---|
| DB_DIALECT | mysql; only mysql/postgres accepted |
| DB_TIMEZONE | +00:00; explicit numeric offset, maximum ±14:00 |
| DB_CONNECT_TIMEOUT_MS | 10000; mysql connectTimeout / pg connectionTimeoutMillis |
| DB_POOL_MAX / MIN | 5 / 0; integers, min ≤ max |
| DB_POOL_ACQUIRE_MS / IDLE_MS | 30000 / 10000; Sequelize pool only |
| DB_SSL | false; true enables certificate and hostname verification (mysql2 `verifyIdentity`); PostgreSQL false is passed explicitly to block ambient `PGSSLMODE` |
| DB_SSL_CA | Optional inline PEM; only accepted with DB_SSL=true |
| DB_SOCKET | MySQL only; for PostgreSQL Unix sockets use DB_HOST=socket directory |
| DB_STATEMENT_TIMEOUT_MS | PostgreSQL only, 0 (disabled) |
| DB_IDLE_TRANSACTION_TIMEOUT_MS | PostgreSQL only, 0 (disabled) |

Dialect-specific settings on the wrong engine are errors, not ignored options.
Native migration connections use the same timezone/TLS/connect timeout. PostgreSQL
migrations explicitly use the `public` schema. Migration connections are dedicated,
never borrowed from the application pool; pool settings do not control them.

The first migration is a schema-only baseline of the current Sequelize models.
It contains no tenant data or credentials. It bootstraps **empty databases**.
An existing unversioned database is refused: compare its schema and reconcile
the differences before adopting migration history. This baseline does not
claim to upgrade every legacy Krasterisk database.

The PostgreSQL `postgres/0001-current-schema.sql` artifact has the same logical
ID as the immutable MySQL baseline. It uses explicit PostgreSQL ENUM types,
identity columns, JSON, UTF8, `TIMESTAMPTZ` for UTC instants, bounded mappings
for MySQL unsigned integers, and deferred FK declarations after table creation.
The install database must be UTF8. Existing `queue_log`/CEL writers and Asterisk
ODBC provisioning remain DB-03. Generated schema inventory and parity tests are
in `harness/database/schema-inventory.cjs` and `run-contracts.cjs`.
Model decorators and declared types are pinned by a metadata hash, so changes to
defaults, PK/identity, unique/index or association options force schema review.
This is a drift gate, not a claim that every ORM default is a DB column default:
47 current `DataType.NOW` attributes are populated by Sequelize on model writes,
while the original MySQL DDL did not assign a server default. The PostgreSQL
baseline preserves that policy; direct SQL/Asterisk writers must supply values
where a timestamp is required. A future server-side default needs a new migration.

`0002-cdr-query-indexes.sql` adds tenant/date and tenant/linkedid/date CDR
indexes. `0003-callcenter-report-keys.sql` adds unique tenant/business keys
for queue calls and daily queue/agent rollups. Before 0003 is marked dirty or
any index SQL runs, the runner checks all three tables for duplicate keys. If
duplicates exist, migration refuses with the table name and leaves history
clean and pending. Review and reconcile the rows against a backup; the runner
does not choose a winner or delete business data. Both migrations preserve the
original 0001 checksum and use separate engine-specific SQL artifacts.

`0004-ai-product-access.sql` adds separate activation, signed local-license
document and active-binding tables for the two new AI products. It does not
grant access or enable activation on migration. The `(license_id, revision)`
uniqueness and binding foreign key are enforced on both engines; the signed
payload bytes and maximum observed validation time remain in the document.

`0005-ai-integration-credentials.sql` adds tenant-bound machine principals,
credential generations, resource grants, audit and idempotent command receipts.
Selectors and `(principal_id, generation)` are unique; credentials, grants,
audits and receipts use composite tenant/principal foreign keys. Migration
does not create a usable key or resource grant.

`0006-ai-integration-auth-limits.sql` adds a shared, indexed expiry counter for
failed integration-key authentication. The API hashes the remote-address and
address/selector keys before storage and increments them atomically on either
database engine, so limits apply across SaaS API instances.
For external integration requests, the API uses the socket peer address by
default. `INTEGRATION_TRUSTED_PROXY_IPS` may list exact trusted reverse-proxy IPs
(comma-separated); only then does it walk `X-Forwarded-For` from right to left
past those proxies. Configure each proxy to append or replace that header, never
to forward a client-supplied value unchanged. Malformed chains fall back to the
socket address.

`0007-tenant-login-uniqueness.sql` adds a unique login key for concurrent
tenant identity creation: the deployed MySQL login collation is case-insensitive,
and PostgreSQL indexes `LOWER(login)`. A preflight checks legacy duplicates before
marking migration dirty; operators must reconcile collisions against a backup.
The migration never chooses or deletes a user automatically.

`0008-ai-jobs-assets.sql` adds durable AI job, media, outbox and idempotency
tables for both full-pbx and standalone analytics/robot profiles. IDs are UUID
strings, tenant identity is `vpbx_user_uid`, and child rows use composite tenant
foreign keys. Provider revisions are insert-only via
`(tenant, provider_uid, revision)` uniqueness.

`0009-ai-usage.sql` adds quota counters, usage reservations, usage events,
immutable price revisions and an append-only usage ledger. This is a measurement
journal for shadow/`local_byok` settlement; it does not change the existing
billing wallet. `cloud_wallet` processing stays disabled until AI-10.

`0010-ai-capture.sql` adds capture node bindings, intents, segments and receipts.
`0011-speech-analytics.sql` adds project, recording, run, transcript and result
tables. `0012-ai-webhooks.sql` adds signed callback endpoints and delivery history.
`0013-ai-voice.sql` adds robot drafts/versions/deployments and cascade session tables.
`0014-sa-metrics.sql` adds metric definitions, revisions, scored values and human reviews.
It also drops `uq_sa_run_initial` so a recording can have an original run plus reanalysis children.
`0015-sa-reporting.sql` adds report definitions, runs, snapshots, schedules, budgets and bulk reanalysis.
`0016-sa-native-int.sql` adds tenant capture policy and recording relations; live Asterisk apply stays gated.
`0017-ai-realtime.sql` adds SIP connection/DID/invocation contracts without applying live PJSIP.
`0018-ai-tools.sql` adds business tool revisions and knowledge-base tables.

The wide Asterisk `ps_endpoints` table stores non-indexed 40-character options
as `TEXT`, allowing InnoDB DYNAMIC to move values off-page under utf8mb4.
Using VARCHAR for all those columns exceeds the 8126-byte inline row limit.
Application option schemas remain unchanged.

## History, locking and interrupted runs

Existing `krasterisk_schema_migrations` columns/rows/IDs/checksums are preserved.
The original `0001-current-schema.sql` bytes are unchanged. `.gitattributes` in
the migrations directory prevents checkout newline conversion; checksums are
byte-sensitive. Do not normalize an already applied artifact or rewrite its
checksum to make a failure disappear.

`krasterisk_schema_state` adds engine identity and a durable dirty name/checksum.
Before any new SQL, the complete applied journal must match a prefix of the
manifest. A legacy successful journal is adopted by adding this state table;
applied rows are not rewritten. This is not proof of physical schema integrity:
operators must reconcile any known legacy interrupted run before adoption.
Unversioned databases, unknown/out-of-order history, mismatched checksums,
engine mismatch and incomplete metadata fail closed. An empty legacy journal
with business tables is treated as an unjournaled partial schema.
MySQL journal/state tables must use InnoDB; existing nontransactional metadata
is refused rather than claiming atomic journal completion.

The lock covers inspection, metadata and all migrations on the same connection:
MySQL GET_LOCK preserves the existing database-name migration key (names exceeding
the 64-character lock-name limit use its SHA-256); PostgreSQL uses a
database-scoped advisory lock. Default wait is 30 seconds. Internal harness API
allows a bounded timeout (0–300000 ms). The runner unlocks in finally and closes
the connection even when unlocking fails; disconnect also releases the lock.

The dirty marker is committed **before** migration SQL. PostgreSQL runs SQL plus
journal/marker completion in one transaction; migration authors must not embed
COMMIT/ROLLBACK or nontransactional DDL in those artifacts. MySQL DDL implicitly
commits, so only the final journal insert/marker clear is transactional. A failed
or interrupted migration leaves the marker and is never marked applied. A lost
COMMIT response is resolved by reading journal/state after reconnect, not by
blind replay. Dirty PostgreSQL runs also require review even if DDL rolled back.

Recovery: stop migration writers, preserve a backup and inspect read-only status;
compare the actual schema and artifact. Restore the known-good database, or
prepare a reviewed repair/adoption procedure that proves the expected schema
before reconciling the marker/journal. No automatic down, force-clear or mark-all
applied command exists. Do not revert to the old runner on a dirty database:
it does not understand the new marker. Metadata-only startup interruption can
also need review. Never point this process at a different engine to bypass it.

The older ignored `migrations/mysql` and `migrations/postgres` files are historical
manual scripts, not inputs to this runner. Existing `db:setup:*`, module-local
`migrate-*` and superadmin seeds are legacy, **unsupported as a PostgreSQL install
or canonical upgrade path**; they are not auto-executed. The complete observed
inventory and DB-02/03 ownership are in
[SQL-PORTABILITY-INVENTORY](../../../.planning/initiatives/ai-products/SQL-PORTABILITY-INVENTORY.md).

The application checks the selected engine's complete, clean versioned history
before Sequelize connects or module startup hooks run. A missing/dirty/unknown
history refuses startup; it never invokes `sync`, `alter` or migrations. Run
`db:migrate:status` to inspect, then `db:migrate` only against a reviewed target.
MySQL and PostgreSQL use the same logical migration ID and separate SQL files.

**Existing MySQL installations:** a successful journal from the previous
runner can be adopted with `db:migrate` after backup and schema review; it adds
state metadata without rewriting applied rows. An unversioned populated MySQL
database is intentionally refused by both migration and startup. Keep the
previous application version serving that database until a separately reviewed,
backed-up schema reconciliation and metadata adoption has been prepared for
that installation. Do not run the empty-database baseline over existing tables,
insert a journal row by hand, or disable readiness to make the error disappear.
This is a release gate for legacy installations, not a data migration performed
by startup.

For a disposable CI database named `krasterisk_ci` (or `krasterisk_ci_suffix`),
run `CI=true CI_SEED_PASSWORD=<unique-test-password> npm run db:seed:ci -w
@krasterisk/backend` after migration. The password must have at least 12
characters. The seed creates a platform admin (tenant 0), two tenant admins,
roles, tenant A/B rows and offline AI provider fixtures on either MySQL or
PostgreSQL. It refuses existing fixture logins/admin and rolls back on error;
never run it against development/production data. For isolated AppModule tests,
set `CI=true DB_CORE_TEST_PROFILE=true` to skip the local `.env` file and set
all DB, JWT and provider-secret variables explicitly. Keep AMI credentials
unset and Redis disabled. `harness/database/core-api-smoke.cjs` exercises core
HTTP requests against the running profile without paid provider calls.

## Verification

From repository root:

```sh
npm run test:db:unit
npm run test:db:contracts
# Individual Docker profiles:
npm run test:db:contracts -- mysql
npm run test:db:contracts -- postgres
```

The harness creates new containers, generated credentials and named test databases;
it never reads DB_* or `.env`, mounts application data, or targets an existing
service. It removes its containers/volumes on completion. Docker unavailable is
a failing acceptance gate, never a passing skip. See
[harness/database](../../../harness/database/README.md) for image pins, optional
isolated local PostgreSQL smoke, and limits. The narrow CI matrix does not claim
full-app PostgreSQL E2E coverage. Actual results live in DB-01-VERIFICATION.

## Authorized live development PBX check

After building backend/shared, run `ALLOW_LIVE_PBX_CHECK=1 node
packages/backend/database/live-proposal-check.cjs` with the development DB,
JWT/provider-key and AMI environment configured. `LIVE_PBX_USER` defaults to
`admin`. This creates two temporary routes, tests confirmation concurrency and
reload recovery, and originates a Local call playing `beep`. It cleans its DB
objects in finally; interrupted processes require cleanup of their recorded
`codexcheck*` context. Empty dialplan files remain for inspection. This script
does not contact a language model and is never an automatic CI step.
