---
initiative: ai-products
phase: DB-02
status: planned
depends_on: [DB-01]
requirements: [DBR-02, DBR-03, DBR-08]
autonomous_scope: local_code_and_disposable_test_databases
---

# DB-02 — полная схема и core/query parity

Назначать по одному ограниченному срезу ниже через EXECUTION. Этот файл не запускает новую фазу сам. Основания: [DATABASE-PORTABILITY](DATABASE-PORTABILITY.md), [SQL inventory](SQL-PORTABILITY-INVENTORY.md), [DB-01 verification](DB-01-VERIFICATION.md). Sequelize 6 сохраняется. Production/PBX credentials, действующая БД и изменение engine установки не требуются и не разрешаются этим планом.

## Вход и владение

1. Сверить свежие HEAD/diff, текущий EXECUTION и active autodial-refactor. Одному schema/config owner назначить manifest, migrations, readiness contract, seed и shared DB interfaces. Другой исполнитель не меняет их параллельно.
2. Закрыть pending DB-01 pinned MySQL/PostgreSQL container matrix и независимый review, если они ещё открыты. Исследование schema inventory разрешено до этого, но не объявлять foundation проверенным.
3. Повторить поиск raw query/literal/DDL и legacy scripts; сверить модели со snapshot 0001. Отдельно учесть поля/индексы, добавленные соседней задачей после baseline.
4. Каждый срез заканчивается собственными SUMMARY/VERIFICATION. Root GSD STATE не переинициализировать. До назначения query slice подготовить его конкретный список файлов/fixtures и acceptance из таблицы ниже.

## DB-02-A. Schema + immutable upgrade path

**Owned:** `packages/backend/database/**`, модельный inventory (read-only models), новые `harness/database/**` schema fixtures. Существующий MySQL 0001 не редактировать.

1. Построить машинно сравнимый inventory Sequelize models и canonical baseline: таблицы/колонки, PK/FK, unique/index, null/default, JSON/ENUM, unsigned ranges, DECIMAL/BIGINT, collation/Unicode. Явно записать owner ps_*/CDR/queues; queue_log/CEL writer schema оставить DB-03, не вводить конкурирующего writer.
2. Создать reviewed PostgreSQL versioned baseline (`migrations/postgres/0001-current-schema.sql`) с тем же logical ID. Порядок FK, sequences/identity, enum changes и timestamp semantics задавать явно. Не импортировать MySQL SQL и не использовать sync как installer.
3. Изменения models сверх original MySQL snapshot выразить следующими additive versioned artifacts для обеих СУБД. Existing MySQL history и raw checksum сохранить; применять новые constraints только с проверяемой data/backfill policy.
4. Завершить legacy CLI mapping: необходимые изменения входят в canonical artifacts, остальные явно maintenance-only/archived либо wrappers. Не выполнять все исторические миграции подряд.
5. Открыть PostgreSQL manifest только после прохождения empty install/replay/schema parity. Это разрешает migrations, но ещё не объявляет весь runtime PG-ready.

**Gate:** clean install обеих СУБД, exact schema inventory, upgrade с копии прежнего versioned MySQL snapshot с fixture data, replay no-op, checksum mismatch, interrupted/recovery rehearsal. Invalid legacy data даёт actionable refusal, не тихое исправление. Schema drift после current model изменения виден тестом.

## DB-02-B. Core startup, seed и readiness

**Owned:** `src/database/**`, ограниченный DB bootstrap AppModule, `database/seed-ci.cjs`, core integration tests и узкий test profile. Auth/users/tenant/provider modules менять только при доказанной несовместимости с отдельным assignment.

1. Добавить schema-readiness check до приёма трафика: выбранный engine, ожидаемая schema version, dirty/unknown history. Для существующих MySQL installations определить явный adoption path, не потерять данные при включении guard.
2. Перенести CI seed на общий parameterized dialect contract: explicit disposable target/CI guard, нет перезаписи существующего admin. Поднять одинаковые tenant 0 + tenants A/B, роли и users; provider fixtures без платных запросов и секретов.
3. Boot actual core application against обеими БД с управляемыми Redis/PBX/provider stubs. External analytics/API profile не должен требовать live Asterisk. Не маскировать DB errors mock repository.
4. Проверить login/refresh/authorization, users/tenant CRUD, module registry/entitlements settings и AI provider CRUD. Тестировать isolation/unique/NULL/case/decimal/bigint там, где применимо.

**Gate:** реальные AppModule startup/auth/tenant/provider requests на обеих СУБД, same API responses, bad schema → fail readiness, no `synchronize`/alter. Full-app PostgreSQL становится заявляемым только для прошедшего списка flows; оставшиеся reports/robots ещё pending.

## DB-02-C. CDR query boundary и временной контракт

**Owned:** `src/modules/reports/cdr/**`, новый ограниченный query compatibility adapter рядом с database infrastructure, `harness/database/**` CDR fixtures. Общий adapter interface утверждает schema owner.

1. До SQL замены зафиксировать ожидаемые first/last call leg, tie-breaker, transfer/linkedid, null handling, order/page/total semantics из API/UI consumers.
2. `calldate` STRING(80): определить parsing/invalid-value policy, UTC/DST/report-zone contract, совместимое чтение legacy строк. Если нужен typed column/backfill, оформить отдельные additive artifacts через schema owner; не менять тип в модели без data migration.
3. Убрать MySQL expressions из доменной оркестрации: reviewed dialect SQL либо portable Sequelize query. Parameterize values, whitelist identifiers; обеспечить deterministic aggregation на двух engines.
4. Golden dataset: tenants A/B/0, нескольких legs/transfer, одинаковые timestamps, missing/null fields, invalid legacy dates, Unicode, пагинация и границы дня.

**Gate:** все затронутые CDR endpoints/exports/aggregates возвращают одинаковые результаты, изоляция tenants и сортировка сохранены. Performance план/индексы проверены на representative fixture volume без production DB.

## DB-02-D. КЦ, автообзвон и сценарные роботы

Срез можно разделить на последовательные D1/D2/D3 assignments после стабилизации общего query interface. Это не разрешение параллельно менять shared migrations.

| Assignment | Owned modules | Concrete work | Gate |
|---|---|---|---|
| D1 | `callcenter/queuelog/**`, затронутые rollup/report repositories | Replace SHOW discovery, classify missing-table/outage/SQL failures; portable aggregation/upsert; explicit source choice | Одинаковый queue-event dataset → одинаковые reports; duplicate/restart; отсутствие таблицы отличается от ошибки доступа |
| D2 | точные autodial report/campaign/rollup repository files после handoff от refactor owner | SUM(CASE...), duration semantics, normalized INSERT/update outcomes, claim/idempotency concurrency | Disposition totals, NULL dates, repeat tasks и result counts не меняют бизнес-действия; concurrency на обеих БД |
| D3 | `voice-robots/voice-robots.service.ts` и выделенный query layer/tests | Last JSON tag filtering/search/distinct, identifier quoting и bound values | tags null/[]/null element/Unicode/quotes/wildcards, last tag, tenant isolation; сценарные роботы не смешиваются с будущими AI-роботами |

Asterisk `queue_log` provisioning и реальный writer/replay входят в DB-03. D1 проверяет application reader/query semantics на owned fixtures. Новые AI products не реализуются внутри DB-02.

## DB-02-E. Integration closure

**Owned:** DB contract/core CI jobs, inventory/verification docs. Широкие legacy E2E jobs изменять только после доказанного core bootstrap на PostgreSQL.

1. Поднять обязательную CI matrix schema + core + затронутые runtime golden tests на обеих СУБД. Сохранить отдельные narrow migration contracts и существующие repository checks.
2. Каждая оставшаяся MySQL-only точка имеет owner, severity, supported profile и следующий task; не закрывать PostgreSQL readiness по одному driver smoke. Неподдерживаемая feature явно недоступна, а не возвращает пустой результат.
3. Required: `npm run lint`, `npm run test:backend`, `npm run test:frontend`, DB matrix; independent review migration/history/tenant boundaries/error normalization. Baseline unrelated failures отдельно от regressions.
4. SUMMARY/VERIFICATION с серверными версиями, profile list, commands/logs, фактическими pending. DB-03 получает schema ownership/API contract, DB-04 — per-engine install/upgrade assumptions.

**Definition of done DB-02:** полные canonical migrations/seeds, core startup и назначенные query parity flows проверены на MySQL/PostgreSQL; engine selection не требует code fork; immutable MySQL history сохранён. Live Asterisk/ODBC, backup/restore releases и cross-engine data transfer этим не объявляются готовыми.

## Recovery

Работать на disposable fixtures; DDL/journal failures используют DB-01 dirty contract. PostgreSQL transactional SQL не содержит собственных COMMIT/ROLLBACK; MySQL implicit-commit changes требуют reviewed recovery. Production cutover/backup restore — отдельный deployment/release assignment, не автоматический следующий шаг этого плана.
