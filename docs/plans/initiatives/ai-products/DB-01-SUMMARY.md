---
initiative: ai-products
phase: DB-01
implementation: implemented
acceptance: automated-tests-passed; independent-review-passed
---

# DB-01 — результат реализации

2026-09-18, `codex-direct`, назначение в [EXECUTION](EXECUTION.md). Выполнен code/documentation scope Tasks 1–3 из [DB-01-PLAN](DB-01-PLAN.md). Pinned MySQL/PostgreSQL matrix прошла на выделенном тестовом сервере; [independent implementation review](DB-01-REVIEW.md) завершён без открытых P0/P1/P2. Подробные результаты — [VERIFICATION](DB-01-VERIFICATION.md).

Этот документ фиксирует состояние на момент закрытия DB-01. Последующая [DB-02-A](DB-02-A-SUMMARY.md) открыла PostgreSQL schema manifest; утверждения ниже о прежнем PG refusal являются историческим результатом DB-01, не текущим поведением CLI.

## Что изменено

- Один side-effect-free `packages/backend/src/database/database-config.cjs` с TS declaration используется Nest AppModule, canonical migration CLI, seed и harness. Nest factory ждёт ConfigModule; build копирует CJS asset в dist. MySQL defaults сохраняются; PostgreSQL получает порт 5432, pg-specific settings. Explicit DB_PORT, required CLI values, pool/timeouts/TLS/timezone валидируются без вывода credentials.
- Sequelize major остаётся 6 (установлен 6.37.8), mysql2 остаётся 3.20.0. Backend явно зависит от pg 8.23.0 и pg-hstore 2.3.4. Lockfile дополнительно синхронизировал уже существовавшие версии workspace manifests; ненужного ORM upgrade нет.
- `database/migration-runner.cjs` отделяет manifest/history orchestration от `migration-adapter.cjs`. Adapter нормализует native results, placeholders, introspection, dedicated-session locks и journal operations для двух engines. PostgreSQL schema — public.
- Applied MySQL 0001 SQL bytes и ID не менялись. SHA-256 до/после: `8c18e47d94da3c3aeca3807eb44dbd0280433c1dedf96bef36470203d699543d`. Migration-local `.gitattributes` предотвращает преобразование строк при checkout.
- Journal остаётся прежним; дополнительная state table хранит engine и dirty artifact. Проверяются prefix/checksum/history/metadata, MySQL metadata — InnoDB. Dirty marker переживает interrupted/failed SQL, replay блокируется до reviewed recovery. PostgreSQL SQL/journal commit атомарны; MySQL DDL частично применим и требует forward repair/restore.
- `db:migrate:status` — read-only, список/статус JSON без credentials. PostgreSQL production commands пока fail before connection: baseline not implemented (DB-02). Нет fixtures fallback или automatic down. CI seed получает общий config и также явно отказывает PG до DB-02.
- `harness/database` и отдельный CI workflow запускают narrow contracts на двух engines; не выдают это за full-app PG readiness. Docker profiles patch-pinned в images.json. Дополнительный explicit local-PG profile создаёт собственный временный cluster; существующие службы не используются.
- Добавлены [SQL inventory](SQL-PORTABILITY-INVENTORY.md), список legacy CLI и [DB-02-PLAN](DB-02-PLAN.md) со schema/core/CDR/КЦ/autodial/scripted-robots срезами и ограниченным ownership.

## Проверено

43 DB unit checks после review fixes; pinned MySQL 8.4.11 на `root@ipbx.krasterisk.ru` — 8 contract cases + parent suite, 9 passing tests; pinned PostgreSQL 17.11 — 7 cases + parent, 8 passing tests. MySQL current baseline установлена без изменения и повторно применена как no-op: 114 таблиц, SHA-256 совпал. Ранее пройден supplemental PostgreSQL 14.0 на изолированном локальном cluster; этот прогон не использовал локальный Docker. Shared/backend build, tsc и config asset inclusion — pass. Backend — 248 suites / 2873 tests passed (1 suite / 9 tests skipped). Lint — 0 errors.

Frontend — 245 files / 1388 tests passed, 1 existing conference locale test failed. Первая попытка на remote MySQL обнаружила readiness race контейнера; harness получил bounded connect retry, затем тот же профиль прошёл. Образа и их digests зафиксированы; созданные контейнеры удалены. Independent review — PASS; TLS/ambient-config замечания исправлены и покрыты installed-driver regressions.

## Ограничения и следующий шаг

Production/application databases и Asterisk не изменялись; aiPBX остаётся read-only. Runtime queries и full PostgreSQL schema/auth/startup не портировались — DB-02. ORM support не означает PG readiness всего приложения. Рабочая копия общая с autodial-refactor: её изменения сохранены, общий root GSD STATE/ROADMAP не переинициализированы. Коммиты и push не выполнялись.

DB-01 acceptance закрыта; следующий assignment — DB-02-A по EXECUTION. AI-00 independent fixtures остаются отдельным кандидатом, автоматически не запускались. Для будущих тестов по указанию пользователя использовать тестовый сервер, не локальный Docker этого компьютера.
