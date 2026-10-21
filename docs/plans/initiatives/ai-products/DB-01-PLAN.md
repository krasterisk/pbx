---
initiative: ai-products
phase: DB-01
status: planned
depends_on: []
requirements: [DBR-01, DBR-02, DBR-08]
autonomous_scope: local_code_and_disposable_test_databases
---

# Первый implementation slice: подключение и migration adapters двух СУБД

Цель: runtime и canonical CLI получают одинаковый валидированный выбор engine; migration infrastructure работает на disposable MySQL и PostgreSQL; существующий MySQL путь сохраняется. **Это не вся PostgreSQL-совместимость приложения.** Полный baseline/core/query parity — DB-02, Asterisk — DB-03. Контракт: [DATABASE-PORTABILITY](DATABASE-PORTABILITY.md).

## Начать можно сейчас

DB-01 не требует live PBX, платных AI keys, коммерческого тарифа или выбора голосовой модели. Параллельно исполняются независимые ARI/media/provider fixtures из [AI-00](AI-00-PLAN.md). Требуются локальные контейнеры/тестовые БД для интеграционной приёмки; если они недоступны, implementation/unit scope продолжается, реальный dual-DB gate остаётся pending.

Сначала сверить текущий HEAD/dirty baseline и изменения `app.module.ts`, canonical migration runner, backend dependencies и CI. Эти файлы могут меняться соседними задачами. Не stash/reset/commit чужую работу и не создавать worktree от HEAD с потерей нужного uncommitted baseline. Только disposable databases; production credentials/DSN не используются.

## Владение

Один platform implementer владеет DB config, runner/adapters и backend package lock changes. Второй worker может владеть только harness/CI после фиксации config interface. Reviewer не изменяет общие файлы одновременно с исполнителями. Provider/product/UI workers не добавляют параллельные DB configs или migration frameworks.

## Task 1. Общая validated database configuration

**Текущие точки:** `packages/backend/src/app.module.ts`, `packages/backend/database/run-migrations.cjs`, `packages/backend/package.json`, package lock, существующие env examples и DB test harness. Новый config resolver/wrapper размещается рядом с database infrastructure по принятой архитектуре; точное имя фиксируется в implementation summary.

1. Ввести единственную функцию `resolveDatabaseConfig(input)` без eager connection и загрузки секретов при import. Вход — environment/config object; результат отделяет common connection fields и dialect options. TypeScript AppModule и CJS CLI используют один implementation, а не два расходящихся copy-paste варианта.
2. Разрешить только `mysql` и `postgres`. Сохранить MySQL default для existing deployment; installer нового профиля потребует явный выбор. Default ports: 3306/5432, explicit DB_PORT имеет приоритет. Проверять числовые диапазоны, обязательные поля и dialect-specific TLS/timeout options; redact credentials.
3. Сохранить используемый Sequelize major и mysql2. Добавить совместимые `pg` и необходимые для используемого v6 PostgreSQL path зависимости по official docs/lockfile; без ненужного ORM major upgrade. Не передавать MySQL-only options PostgreSQL driver.
4. Подключить resolver к AppModule и canonical runner. Legacy migration CLI перечислить в inventory: либо wrapper к canonical runner, либо явно unsupported/archived; не выполнять автоматически все старые скрипты.

**Проверки:** unit cases default MySQL, explicit PG, override port, invalid dialect/port, TLS option isolation, missing required config; existing config regression. Импорт resolver не подключается к БД и не логирует секреты.

**Acceptance:** один source of truth app+CLI, оба driver packages разрешаются, invalid configuration завершается до обращения к БД. Наличие pg ещё не означает успешный AppModule startup с текущей схемой.

## Task 2. Canonical migration engine adapters

**Текущие точки:** `packages/backend/database/run-migrations.cjs`, `database/README.md`, migration directories/tests. Сначала прочитать journal/lock/adoption semantics текущего runner, затем сохранить MySQL behavior контрактом.

1. Выделить небольшой adapter: connect/close, acquire/release schema lock, table introspection, journal read/write, parameterized execution. В доменном migration orchestration нет прямых mysql2-specific result assumptions. PostgreSQL implementation использует pg; SQL placeholders/quoting принадлежат adapter.
2. Preserve applied MySQL migration IDs/contents/checksums. Добавить selection manifest, engine identity и checksum actual artifact без silent rebasing существующего журнала. Read-only status/preflight сообщает engine, schema version и pending list без credentials.
3. Проверить dedicated-session schema lock, timeout и competing runner. PostgreSQL advisory lock и MySQL GET_LOCK живут на той же session весь run, release на failure. Ошибки миграции не скрывать под «already applied».
4. Отдельные migration fixtures в disposable databases проверяют одинаковую небольшую logical schema и journal. Полный PostgreSQL baseline ещё не объявляется доступным: до DB-02 обычная PG migration команда останавливается на явном preflight «baseline not implemented», не запускает MySQL SQL и не завершает ложным success. Fixtures выбираются только тестовым harness, не скрытым production fallback.
5. Исследовать transactional DDL/implicit commits и зафиксировать interrupted-run recovery contract; при несовпадении checksum либо partial schema не продолжать автоматически. Для необратимых изменений обещать forward repair/backup restore, а не неработающий down.

**Проверки на обоих engines:** first apply, повторный no-op, checksum mismatch, два параллельных runners, error midway, журнал не объявляет failed migration выполненной, lock после disconnect освобождается. MySQL current baseline smoke — на пустой disposable DB; без адаптации исторической production БД.

**Acceptance:** обе engine adapters доказаны реальной БД; MySQL canonical path не регрессировал; PostgreSQL support status честно ограничен infrastructure. Полный install/Auth CRUD smoke переносится в DB-02 вместе с complete schema/seeds.

## Task 3. Повторяемый integration harness и следующий план

**Текущие точки:** `harness/environment/testcontainers/mysql.ts`, `.github/workflows/harness.yml`, `.github/workflows/harness-asterisk.yml`, `.github/workflows/e2e.yml`. На этом срезе добавляется узкий job migration/config contracts; legacy full-app E2E не выдаётся за PostgreSQL passing, пока не реализован DB-02.

1. Добавить PostgreSQL container/profile и dual-engine matrix для Task 2 с pinned проверенными версиями. Фиксировать server/driver/Sequelize version в test evidence. Выбор support versions документировать по актуальной совместимости, не считать минимальную версию ORM рекомендуемой для production.
2. Изолировать fixture databases и cleanup; при выключенном Docker/missing DB интеграционная проверка сообщает unavailable/failure, а не successful skipped acceptance. Рабочие development и production DB не затрагиваются.
3. Добавить в SQL inventory места MySQL raw expressions, seeds, Asterisk bootstrap/schema ownership, ошибки/fallback, которые могут скрыть unsupported dialect. Для каждого — owner, целевой DB-02/03 slice и parity fixture.
4. Подготовить следующий `DB-02-PLAN.md` по фактическому inventory: schema/baseline/seeds; full core startup/auth/tenant/providers; CDR/КЦ/autodial/robot SQL parity. Для shared contracts использовать [DATABASE-PORTABILITY](DATABASE-PORTABILITY.md), не делать отдельный PostgreSQL fork приложения.

**Acceptance:** узкий reproducible test command и CI job действительно проходят на двух engines; remaining blockers явны. Следующий план имеет ограниченные задачи/файлы и не заявляет, что весь runtime уже портирован.

## Завершение и evidence

- Обязательные repository checks: `npm run lint`, `npm run test:backend`, `npm run test:frontend`; дополнительно DB matrix выше. Distinguish pre-existing baseline failures from regression; не ремонтировать unrelated backlog.
- Независимый review config/migration diff: secrets, applied history, wrong DB target, lock lifetime, failure semantics, dialect result normalization.
- Создать `DB-01-SUMMARY.md` и `DB-01-VERIFICATION.md` с командами, версиями, изменёнными файлами, результатами и pending gates. Общие statuses: planned → implemented → automated-tests-passed; live Asterisk сюда не включён.
- После DB-01 выполняется DB-02; ARI/media/recording/provider работа AI-00 продолжается независимо. AI-01/02 новые SQL schema gates требуют DB-02; DB-03 обязателен для встроенной PBX, но не для внешнего analytics upload.

## Откат

Откат code/config сохраняет existing MySQL default и текущий migration journal. В этом срезе production schema не меняется. Canonical migration command с `postgres` без реализованного baseline завершается preflight failure; не перенаправлять автоматически в MySQL. Это guard runner, не обещание готового schema-readiness guard AppModule: runtime проверка входит в DB-02 вместе с full-app startup. Fixtures удаляются только из именованных disposable databases. Смена engine действующей установки не выполняется в DB-01.
