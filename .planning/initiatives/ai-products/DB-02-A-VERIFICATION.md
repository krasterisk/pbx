# DB-02-A — verification

Date: 2026-09-18. Scope: [DB-02-PLAN](DB-02-PLAN.md) slice A; [independent review](DB-02-A-REVIEW.md) passed. Evidence comes from a shared dirty working tree; the concurrent autodial initiative owns its own files.

| Gate | Result | Evidence |
|---|---|---|
| AppModule models vs immutable MySQL 0001 | 112/112 tables, 1447/1447 columns; no unexpected name/type/NULL drift; 99 documented `ps_endpoints` TEXT widenings. Pinned decorator/declared-type fingerprint catches defaults/PK/identity/unique/index/FK changes; negative mutation tests for default and unique. | [inventory JSON](evidence/db-02-a/schema-inventory.json), `node --test harness/database/schema-inventory.test.cjs` |
| PostgreSQL production manifest/static baseline | Logical ID 0001; reviewed static artifact; 40 ENUM, 12 FK, 9 generated FK indexes; UTF8 guard; checksum `a7d418…d1720f` | [manifest runner log](evidence/db-02-a/postgres-manifest-remote.log), [static SQL](../../../packages/backend/database/migrations/postgres/0001-current-schema.sql) |
| PostgreSQL 17.11 clean install/replay/failure contracts | 9/9 pass on `root@ipbx.krasterisk.ru`; 112 application tables + 2 metadata; 1447 application columns + 7 metadata; selected types/DECIMAL/ENUM/FK/index checked | [PG remote log](evidence/db-02-a/postgres-manifest-remote.log) |
| MySQL 8.4.11 clean install/replay/data preservation | 9/9 pass; unchanged original 0001 checksum, tenant setting fixture survives replay | [MySQL remote log](evidence/db-02-a/mysql-final-remote.log) |
| Mismatch, invalid history, interrupted run, lock/recovery | DB-01 generic real-DB contracts rerun for both engines within the 9/9 suites; unknown/unversioned/wrong-engine/dirty unit cases pass | [PG log](evidence/db-02-a/postgres-manifest-remote.log), [MySQL log](evidence/db-02-a/mysql-final-remote.log), [DB-01 review](DB-01-REVIEW.md) |
| Legacy CLI mapping | All 46 entry points accounted for; no blanket execution; historical unversioned upgrade excluded from clean-baseline acceptance | [mapping](DB-02-A-LEGACY-MAPPING.md) |
| `npm run test:db:unit` | 43/43 pass after PG manifest opened | [unit-final.log](evidence/db-02-a/unit-final.log) |
| `npm run test:db:schema` | 6/6 pass, включая CRLF/LF portability; reviewer independently reran final suite; CI step added to both dialect jobs | [inventory-final.log](evidence/db-02-a/inventory-final.log), [review](DB-02-A-REVIEW.md) |
| Backend typecheck | Pass | [typecheck.log](evidence/db-02-a/typecheck.log) |
| `npm run lint` | Pass, no errors; existing warnings | [lint.log](evidence/db-02-a/lint.log) |
| `npm run test:backend` | Pass: 249 suites / 2881 tests, 1 suite / 9 tests skipped | [backend.log](evidence/db-02-a/backend.log) |
| `npm run test:frontend` | 247 files / 1391 tests passed; one pre-existing conferences locale assertion failed (`ConferenceRoomFormModal.test.tsx:234`). Initial sandbox attempt could not read Vite config; full run used an escalated process. | [full log](evidence/db-02-a/frontend-escalated.log), [sandbox log](evidence/db-02-a/frontend.log) |
| Independent review | PASS; two P2 fixed and re-reviewed | [review](DB-02-A-REVIEW.md) |

The remote server used pinned `postgres:17.11-bookworm` and `mysql:8.4.11` images from `harness/database/images.json`, Node 22.23.2, Sequelize 6.37.8, pg 8.23.0 and mysql2 3.20.0. Generated DB passwords were used only for disposable testcontainers. `org.testcontainers=true` count was 0 after runs; remote temp directories were removed. No local Docker, production DB, PBX or credentials were used.

PG schema acceptance is narrower than application readiness. `seed-ci.cjs` still rejects PostgreSQL by design until DB-02-B. Database collation/case behavior, auth/tenant/provider startup and CDR/КЦ/autodial/scripted-robot query parity remain later gates. Existing legacy installations are refused until data-aware adoption; no automatic conversion or cross-engine data transfer is claimed.

The frontend failure is the same `does not rename conferences.history.empty` assertion documented before DB-01 in [HYBRID-VERIFICATION](../../workflows/HYBRID-VERIFICATION.md). DB-02-A changed no frontend files. Concurrent autodial changes added tests during this shared-tree run; the result is not an isolated commit-level comparison.
