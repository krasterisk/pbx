# Versioned MySQL schema

`npm run db:migrate` applies the SQL files in `database/migrations` in order,
under a connection-owned MySQL advisory lock. Applied files are checksummed;
changing one after application is an error. Supply `DB_HOST`, `DB_PORT`,
`DB_USER`, `DB_PASSWORD`, and `DB_NAME` explicitly. `--list` needs no connection.

The first migration is a schema-only baseline of the current Sequelize models.
It contains no tenant data or credentials. It bootstraps **empty databases**.
An existing unversioned database is refused: compare its schema and reconcile
the differences before adopting migration history. This baseline does not
claim to upgrade every legacy Krasterisk database.

The wide Asterisk `ps_endpoints` table stores non-indexed 40-character options
as `TEXT`, allowing InnoDB DYNAMIC to move values off-page under utf8mb4.
Using VARCHAR for all those columns exceeds the 8126-byte inline row limit.
Application option schemas remain unchanged.

MySQL DDL is not transactional. Keep forward migrations restartable and review
recovery steps before deployment. Automatic rollback is deliberately refused.
The older ignored `migrations/mysql` and `migrations/postgres` files are historical
manual scripts, not inputs to this runner.

For a disposable CI database named `krasterisk_ci` (or `krasterisk_ci_suffix`),
run `CI=true npm run db:seed:ci -w @krasterisk/backend` after migration. This
creates the harness admin fixture and refuses to replace an existing account.
Never run the fixture against the development/production database.

## Authorized live development PBX check

After building backend/shared, run `ALLOW_LIVE_PBX_CHECK=1 node
packages/backend/database/live-proposal-check.cjs` with the development DB,
JWT/provider-key and AMI environment configured. `LIVE_PBX_USER` defaults to
`admin`. This creates two temporary routes, tests confirmation concurrency and
reload recovery, and originates a Local call playing `beep`. It cleans its DB
objects in finally; interrupted processes require cleanup of their recorded
`codexcheck*` context. Empty dialplan files remain for inspection. This script
does not contact a language model and is never an automatic CI step.
