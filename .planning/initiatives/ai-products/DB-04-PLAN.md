---
initiative: ai-products
phase: DB-04
revision: 2026-09-20-r1
status: planned_dependency_gated
tasks: [I1, I2, I3, I4]
depends_on: [DB-02, DB-03]
requirements: [DBR-02, DBR-06, DBR-07, DBR-08]
autonomous_scope: local_code_and_disposable_test_databases
---

# DB-04 — clean install, backup/restore, upgrade, PBX ODBC installer

Назначать по одному ограниченному срезу ниже через [EXECUTION](EXECUTION.md). Этот файл не запускает implementation сам. Основания: [DATABASE-PORTABILITY](DATABASE-PORTABILITY.md), [DB-02](DB-02-PLAN.md), DB-03 writer/examples (`asterisk-odbc/**`, migration 0019), [DEPLOYMENT-LICENSING](DEPLOYMENT-LICENSING.md) DEP-07, [AI-10](AI-10-PLAN.md) packaging overlap.

**Depends:** DB-02 для I1–I3; PBX I4 дополнительно после DB-03. Analytics-only / 10A **не** ждут I4. Production credentials, действующая БД и смена engine установки не требуются и не разрешаются этим планом без отдельного assignment. `xray-ui` не трогать. Автоматический `--rollback` по-прежнему запрещён.

Порядок относительно AI-10: I1–I3 параллельно COM1–COM3; I4 — для full-pbx / 10R native, не для standalone analytics.

## Вход и владение

1. Сверить HEAD/diff, EXECUTION и соседние schema owners. Один writer на migrations/manifest/install harness/ODBC templates.
2. Не дублировать DB-02 schema inventory и DB-03 portable INSERT writer — reuse, wrap, document.
3. Каждый срез заканчивается собственными SUMMARY/VERIFICATION + disposable evidence. Root GSD STATE не переинициализировать.
4. Engine versions pin как в текущих contracts (MySQL **8.4.11**, PostgreSQL **17.11**), не «любой 8.x/17.x». Не SQLite.

## I1 — clean install matrix

**Owned:** harness install scripts поверх [`run-contracts.cjs`](../../../harness/database/run-contracts.cjs) / `seed-ci.cjs` / `standalone-provision`, docs preflight, profile matrix evidence. Bounded `packages/backend/database/**` только если нужен shared install entrypoint — согласовать с schema owner.

Профили × engines:

| Profile | MySQL 8.4.11 | PG 17.11 |
|---|---|---|
| `full-pbx` | required | required |
| `analytics-api` | required | required |
| `robot-api` | required | required |
| community composition | required (no commercial AI schema claims) | required |

Preflight: `DB_DIALECT`, `DB_SCHEMA_PROFILE`, refuse dirty/unknown journal, refuse wrong profile for binary. Empty install → schema version current (through latest additive for that profile; 0019 only on full-pbx). Seed CI tenants 0/A/B без overwrite existing admin. Standalone provision CLI covers analytics/robot identity without PBX Context.

**Gate:** clean install matrix documented with commands/logs; dirty journal refuse; community artifact не требует speech-analytics/ai-voice tables; no `synchronize`/alter; DBR-02/06/08 evidence paths named.

## I2 — backup / restore

**Owned:** backup/restore scripts for disposable DB, object-storage fixture pack, encryption key material custody docs, restore verification harness. Не копировать live secrets.

SQL dump/restore disposable DB + object storage fixture + encryption key material. После restore проверить: schema version, ledger sums, job/asset IDs, license bindings. Restore без ключа → credentials unreadable, fail closed (не silent empty secrets).

Явный отказ: `DB_DIALECT` switch на существующие данные (DBR-07) — documented refusal, не «миграция». Cross-engine transfer — out of scope первого релиза.

**Gate:** backup→restore на MySQL и PG disposable; post-restore invariants; missing key fail-closed; dialect-switch refuse documented; no production DB touch.

## I3 — upgrade

**Owned:** upgrade runbook, N-1 fixture packs, interrupted/dirty refuse rehearsal harness. Reuse DB-01 dirty journal contract.

Empty 0001 → current уже покрыт contracts — зафиксировать как baseline gate, не переписывать. Fixture data на N-1 additive → current: apply remaining migrations, replay no-op. Interrupted dirty refuse (не auto-repair silently).

Upgrade runbook: backup → migrate → health/schema readiness → worker drain → admit traffic. Automatic `--rollback` запрещён; forward repair / restore from backup — единственные recovery paths.

**Gate:** N-1→current MySQL/PG; replay no-op; dirty refuse; runbook reviewed; DBR-02/07 evidence.

## I4 — PBX ODBC installer

**Вход:** DB-03 schema `queue_log`/`cel` + portable writer; examples under `packages/backend/src/modules/asterisk-odbc/examples`. **Owned:** installer templates, generation of DSN/`res_odbc`/`cdr_adaptive_odbc`/`cel_odbc`/`extconfig` **без** копирования live secrets; separate DB credentials from app user; disposable Asterisk apply harness.

Сгенерировать config из templates + operator-supplied credentials file (gitignored). На disposable Asterisk (не замена текущего Adaptive ODBC ipbx вслепую): CDR + queue_log insert parity с writer golden. Existing Adaptive ODBC на test host не dump'ать и не overwrite без явного assignment.

Analytics-only **не** ждёт I4. Robot standalone без native PBX CDR claim тоже не блокируется I4.

**Gate:** generated configs contain no live secrets; disposable apply writes CDR/queue_log rows matching writer contract; app credentials ≠ ODBC credentials; documentation states analytics-only independent of I4.

## Definition of done DB-04

I1–I3 закрывают per-engine install/restore/upgrade gates для AI-10A/R соответствующего profile. I4 закрывает native PBX ODBC installer slice. Это не объявляет AI-11 нагрузку/пилот и не выполняет cross-engine data transfer.

## Recovery

Disposable fixtures only. DDL/journal failures используют DB-01 dirty contract. PostgreSQL transactional SQL без собственных COMMIT/ROLLBACK; MySQL implicit-commit changes требуют reviewed recovery. Production cutover — отдельный release assignment после AI-11 evidence.
