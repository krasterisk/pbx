# Dual-database contract harness

On this Windows development host, use the designated test server
`root@ipbx.krasterisk.ru` via the existing `krasterisk_ipbx_agent` SSH key;
**do not start local Docker for DB tests**. The DB-01 remote verification used a
new `/tmp/krasterisk-db01.*` bundle containing only this harness, database
config/runner/SQL, and exact npm dependency versions. After `npm ci` inside the
bundle, it ran `node harness/database/run-contracts.cjs mysql` and the same
command with `postgres`, copied logs back, checked no testcontainers remained,
and removed the temporary directory. Recreate a fresh isolated bundle for each
new source revision; never reuse an old copy of a migration or dependency lock.

On a Linux CI/test host with Docker, run `npm run test:db:contracts` from
repository root.
Optional argument `mysql` or `postgres` selects one job. No application process,
AMI/ARI connection, external account, existing DB or `.env` is used. All SQL goes
to generated test databases inside newly created containers. Testcontainers owns
cleanup; stopped containers and their anonymous volumes are removed. No reuse or
bind mounts. Failure to start Docker/images is a failure, not a skipped test.

The same cases run on both engines: offline/read-only status; first apply and
replay; checksum/engine/schema refusal; simultaneous runners; lock timeout and
disconnect; mid-file DDL failure, journal correctness, dirty restart; legacy
journal adoption; Sequelize JSON/Unicode/tenant CRUD. MySQL additionally installs
the unchanged application baseline in an empty database. These tests do not boot
AppModule, test auth, or certify Asterisk — those are DB-02/03.

`images.json` pins mysql:8.4.11 (8.4 LTS line) and postgres:17.11-bookworm.
Version discovery: official docker-library
[MySQL versions](https://github.com/docker-library/mysql/blob/master/versions.json)
and [PostgreSQL versions](https://github.com/docker-library/postgres/blob/master/versions.json),
checked 2026-09-18. A pin is a test target, not a passing claim: measured outcomes
and server/driver versions are recorded in DB-01-VERIFICATION. Existing full-app
MySQL 8.0 jobs remain separate; this change does not certify their migration to
8.4. Tags are patch-pinned, not digest-pinned. Record the resolved image digest
when promoting a tested profile into release support in DB-04.

CI: `.github/workflows/database-contracts.yml`, Node 22, independent engine jobs,
nonzero failures and uploaded logs. Local execution also prints actual server,
Node, Sequelize, pg/mysql2 and pg-hstore versions without credentials.

DB-02 extends those jobs with `npm run test:db:runtime -- mysql|postgres` after
building shared and backend. Each job starts a **fresh** container/database,
applies all manifest migrations, seeds offline tenants/providers, boots the
actual AppModule without live AMI/ARI or paid providers, then checks core HTTP,
CDR HTTP/CSV, call-center queue_log reader/reconciliation/rollup, and scenario
voice-robot CDR tag behavior. The call-center fixture creates its own temporary
queue_log table in that disposable database and drops it afterward; it is not
an Asterisk writer test. The runtime script always stops its app child and
container, including on assertion failure. On this Windows workstation these
tests run only on the designated SSH test server, never via local Docker.

For an additional local PostgreSQL smoke when Docker is unavailable:

```powershell
npm run test:db:contracts -- postgres "--postgres-bin=C:\Program Files\PostgreSQL\14\bin"
```

This is an explicit **supplemental** profile. `initdb` creates a fresh cluster in
TEMP, a generated SCRAM password, loopback-only listener and a random free port;
`pg_ctl` targets only that new data directory. The installed PostgreSQL service
is not used or stopped. After tests the new cluster is stopped and its verified
temporary directory removed. Startup/cleanup failure is an error. Following a
hard process kill, a remaining TEMP `krasterisk-db01-pg-*` directory/process may
need manual cleanup; never stop an unrelated service. The actual installed
server version is printed. Passing this profile does not close the pinned
container matrix, and old installed server versions are not production advice.
