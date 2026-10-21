# ac_channel_reservations production repair

Coordinator: Codex /root; mode codex-direct; status released; required gates passed.
Baseline: server f4e998e5; local e715eefa. Existing dirty 0031 migration and main.ts are outside scope.
Owned paths: new 0032 migrations, migration manifest/tests, AutodialCampaignsService startup hook, reservation DB contracts, this document.
Plan R1: diagnose MySQL-only startup DDL (confirmed). R2: versioned dual-engine migration plus remove runtime DDL. R3: unit/lint/backend/frontend gates and real PG migration/hold constraints. R4: apply migration, release corrected backend, verify pacer logs and health.
Acceptance: schema journal clean at 0032; identity and unique task holds, expiry sweep; no missing-reservation errors in live pacer. No campaigns started by verification.
Next action: run gates and isolated DB contract, then production backup/migrate/release.

## Evidence 2026-10-03
- R1/R2 implemented: 0032 full-pbx migration for PostgreSQL/MySQL; removed MySQL-only startup DDL.
- DB unit/schema: 59 passed. Backend: 372 suites, 3529 tests passed (11 existing skips). Build passed. Lint: 0 errors, existing 116 backend/87 frontend warnings.
- Isolated PG17/MySQL8.4.11: migration, direct SQL reapply/legacy adoption, revision backfill, ORM identity, duplicate task reservation rejection, tenant mapping, expiry cleanup and journal rerun preserving rows passed. Test containers/network removed.
- Production released: backend f4e998e5-acres (minimal overlay on installed f4e998e5); frontend unchanged. DB schema 0032, pending [], dirty null. No campaign started.
- Backup /opt/krasterisk/backups/pre-acres-20261003T035106Z/database.dump.
- Compatible rollback image: krasterisk-backend:f4e998e5-acres-schema (old service plus new manifest). A previous image with a 0031 manifest cannot restart against the 0032 journal; use the compatible rollback image.
- Production health/auth, AMI/ARI passed; missing-table and startup-DDL errors absent after restart.
- Full frontend suite: 299 files, 1593 tests passed (exit 0).
- Code committed/pushed to krasterisk/pbx main: 2a920d48.
- GitHub Actions on 2a920d48: quality 37094755027, Database contracts 37094755052, e2e 37094755035, harness 37094755155 — all success.
- R1-R4 complete; production runtime pacer errors zero. Existing dirty 0031/main.ts preserved. Next action: none for this scoped repair.
