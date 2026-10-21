# PostgreSQL и MySQL: общий контракт платформы

Дата: 2026-09-18. Статус: **planned**. Требование пользователя: установить Krasterisk с любой из двух СУБД, включая приложение, Asterisk CDR, queue_log и связанные таблицы. ORM остаётся Sequelize. Прежняя фиксация MySQL как единственного engine в инициативе отменена ADR-13. Поддержка PostgreSQL в production ещё не доказана.

## Границы решения

- При установке выбирается `DB_DIALECT=postgres|mysql`. Одна установка использует один engine; SaaS, коробка и OpenSource core поддерживают оба варианта. Существующие MySQL installations сохраняют совместимый default. Для новой установки выбор явный.
- Логическая схема и продуктовые возможности одинаковы. Приложение и Asterisk могут иметь отдельные роли/пулы и, если понадобится, отдельные базы того же engine. Общие run/outbox/ledger остаются в одной transactional database; распределённые транзакции не вводятся.
- Engine выбирается deployment configuration, а не tenant/user setting. Одновременная работа MySQL+PostgreSQL, cross-engine joins и горячее переключение не входят в первую версию.
- Переключение `DB_DIALECT` у установки с данными не переносит эти данные. Для смены engine — отдельный export/import/cutover с остановкой writers и проверкой целостности. Копия и rollback обязательны; production автоматически не мигрируется.
- Внешние АТС интегрируются через SIP/API и не обязаны использовать нашу СУБД. Analytics-only не требует CDR/ARA/queue_log schema.
- Поддержка MySQL не означает автоматически поддержку MariaDB; точные engine versions и ODBC drivers фиксируются после contract tests. Не совмещать эту работу с ненужной сменой ORM или upgrade на Sequelize 7.

## Что сейчас привязывает проект к MySQL

Это read-only snapshot исходников; line numbers могут изменяться в параллельной работе. Перед реализацией сверить baseline.

| Слой | Наблюдение | Работа |
|---|---|---|
| App bootstrap | `packages/backend/src/app.module.ts:173–175`: DB_DIALECT уже читается, default port 3306. В `packages/backend/package.json` заявлен mysql2, pg не заявлен | Общая validated config для app/CLI/tests, dialect ports/options, pg driver |
| Canonical migrations | `packages/backend/database/run-migrations.cjs`: mysql2, GET_LOCK, SHOW TABLES, MySQL placeholders; `database/migrations/0001-current-schema.sql` — MySQL baseline | Один journal/checksum contract, adapters для двух engines, PostgreSQL baseline; сохранять применённую MySQL историю |
| Исторические migrations | `packages/backend/migrations/postgres/005…` не входит в новый runner; много старых CLI scripts hardcode mysql | Инвентаризация источников схемы; один поддерживаемый install/upgrade путь, archived scripts не выдавать за PostgreSQL readiness |
| CDR | `reports/cdr/cdr.service.ts`: GROUP_CONCAT/SUBSTRING_INDEX, STR_TO_DATE, HOUR, DAYOFWEEK. `reports/cdr/cdr.model.ts`: calldate STRING(80) | Repository/query dialect boundary, temporal contract, grouped-call parity; не механическая замена синтаксиса |
| Другие runtime queries | `voice-robots.service.ts`: JSON_EXTRACT/JSON_UNQUOTE/JSON_LENGTH; `autodial-reports.service.ts`: TIMESTAMPDIFF; rollup/reports SUM(boolean); `realtime-queue-log-reader.ts`: SHOW TABLES | ORM expressions либо ограниченные dialect helpers с общими golden tests |
| Driver return values | `callcenter.service.ts` использует affectedRows; autodial paths ждут специфичный INSERT result. Raw aliases camelCase требуют нормализации/quoting | Репозитории возвращают domain result независимо от драйвера |
| CI/harness | `.github/workflows/harness.yml`, `e2e.yml`, `harness-asterisk.yml`; `harness/environment/testcontainers/mysql.ts` | Реальные MySQL и PostgreSQL jobs, отдельные Asterisk profiles; SQLite и mocks не заменяют их |
| Asterisk bootstrap | MySQL baseline содержит CDR/MOH/PJSIP/queues, но не queue_log/CEL; полный versioned ODBC/ARA install profile в просмотренных файлах не найден. `.docs/QUEUES_MODULE.md` и `.docs/MOH_MODULE.md` по engine расходятся | Воспроизводимые schema/config profiles и исправление documentation drift; исторический pilot не считается свежей live проверкой |

Это платформенная совместимость всего Krasterisk, а не отдельная PostgreSQL-база только для новых AI-модулей. Asterisk installer/config/schema audit входит в DB-03 ниже. Текущие queue-log error→empty-list/auto-fallback и некоторые migration catch-all могут скрыть несовместимость dialect; readiness/diagnostics должны отличать недоступную БД от пустого результата. Driver return-count differences часто влияют лишь на отчёт/лог, а SQL syntax/schema/driver — непосредственные blockers; severity уточняется по конкретному consumer.

## Sequelize и migrations

Sequelize 6 поддерживает оба dialect с разными underlying connectors. Dialect-specific options передаются соответствующему драйверу; один набор MySQL options нельзя передать pg. [Официальная документация Sequelize](https://sequelize.org/docs/v6/other-topics/dialect-specific-things/).

1. Единый config resolver валидирует dialect, host/port, TLS, timezone, pool и timeout options; используется AppModule, canonical runner, seed tooling и harness. Конфигурация не выводит credentials в логи. Неподдерживаемый engine — ошибка до старта, не silent fallback.
2. Сохранить canonical migration runner и applied MySQL baseline/checksums. Общие migration IDs описывают одинаковую логическую schema version; journal содержит engine и checksum фактически применённого артефакта. Для нового dialect нужен собственный versioned baseline и явное правило existing-schema adoption. MySQL journal нельзя скопировать в PostgreSQL как доказательство переноса.
3. Предпочитать portable QueryInterface для новых изменений; где нужен raw SQL — reviewed dialect implementation. Не редактировать историческую applied migration ради PostgreSQL. Новые additive migrations проходят empty install, upgrade и повторный no-op на обоих engines.
4. Migration locking имеет отдельную реализацию: MySQL connection-scoped GET_LOCK и PostgreSQL advisory lock, отдельная выделенная connection на весь run, bounded wait, release в finally. Учесть session affinity, а не случайную connection из pool. Никаких distributed locks Redis вместо schema lock.
5. Не обещать атомарный DDL rollback одинаково для двух engines. Interrupted migration, journal/checksum, partial schema detection, forward repair и restore репетируются отдельно. `sync({ alter: true })` не является production migration.
6. Каждая таблица имеет одного schema owner. Текущий application runner и upstream Asterisk schema tooling нельзя одновременно направить изменять одни ps_*/CDR/queue_log tables без version ownership contract.

## Контракт данных и запросов

| Область | Общая семантика и проверка |
|---|---|
| IDs и tenant | Стабильные PK/FK и `vpbx_user_uid`; tenant 0 допустим явно, NULL не означает tenant 0. BIGINT не проходит через небезопасный JS number |
| Money | Fixed precision DECIMAL/строковый exact representation либо minor units; одинаковые rounding и limits, без floating-point charge |
| Dates | Новые events — UTC timestamps; timezone/day boundaries задаёт report contract. Legacy calldate STRING требует parsing/backfill/invalid-value policy и совместимого чтения, а не молчаливого cast |
| Text | UTF-8, Unicode/RU, явная case sensitivity для уникальных usernames/keys/tags, collation parity; необоснованная зависимость от MySQL *_ci недопустима |
| JSON/enums | Один logical type и validation; PostgreSQL JSONB/ENUM — технический вариант, не API contract. Distinguish missing/null/empty; portable alternatives там, где native features расходятся |
| SQL aggregates | CASE WHEN вместо предположений о SUM(boolean); deterministic order внутри агрегатов; null/grouping/alias naming и time buckets одинаковы |
| Constraints | Tenant-scoped unique keys, NULL semantics, FK actions, lengths/defaults, enum upgrade, identifier quoting и unsigned ranges проверяются на обоих engines |
| Concurrency | Выбранная isolation level, row locks, compare-and-set, retry только допустимых transient conflicts. Golden race tests для reserve/settle, claims, dedupe, outbox |
| Query shape | Parameterized values; identifiers только из фиксированного кода/whitelist. Repository нормализует driver errors/result counts, не разносить `if dialect` по контроллерам |

Upsert return values между dialect отличаются; например PostgreSQL не гарантирует boolean `created` в Sequelize v6. Бизнес-логика не должна выводить новый billable event из такого флага. [Sequelize v6 upsert](https://sequelize.org/docs/v6/other-topics/upgrade/).

Один reusable SQL compatibility слой используется текущими CDR/КЦ/автообзвоном и AI analytics dashboards. Новые jobs/outbox/ledger, versioned metrics, API idempotency и recording manifests сразу тестируются на двух engines. Поиск знаний — adapter; pgvector возможен в PostgreSQL-профиле, но MySQL-профиль сохраняет ту же функциональность без обязательного второго SQL server.

## Asterisk: отдельное подключение и отдельная приёмка

Asterisk не использует Sequelize. Предлагаемый общий транспорт — unixODBC с driver выбранной СУБД. Asterisk рекомендует `cdr_adaptive_odbc` для CDR; ARA имеет независимый от storage интерфейс и поддерживает ODBC и queue_log family. [CDR drivers](https://docs.asterisk.org/Fundamentals/Asterisk-Architecture/Types-of-Asterisk-Modules/Call-Detail-Record-CDR-Drivers/), [Realtime Database Configuration](https://docs.asterisk.org/Fundamentals/Asterisk-Configuration/Database-Support-Configuration/Realtime-Database-Configuration/).

| Поток | Планируемый путь | Критерий |
|---|---|---|
| Realtime/ARA | res_odbc + res_config_odbc; extconfig/sorcery mappings для фактически используемых families, включая PJSIP/queues | Endpoint registration/update, routing/queue read, identity/tenant attribution работают на обоих engines |
| CDR | cdr_adaptive_odbc → versioned schema; explicit alias/field mapping | Inbound/outbound/transfer/multiple legs/failed call, uniqueid+linkedid, tenant, timestamps и recording references совпадают с contract |
| CEL | cel_odbc, если CEL включён в выбранном PBX profile | Schema/event mapping и ordering проверены; отсутствие CEL не выдаётся за потерянный CDR |
| queue_log | Предпочтительно realtime queue_log через res_config_odbc + extconfig; logging settings/schema проверяются по используемой версии Asterisk | ENTERQUEUE/CONNECT/COMPLETE/ABANDON/TRANSFER, data1…N/time/agent и tenant-aware projection дают одинаковые отчёты |
| File compatibility | Существующий queue_log file ingest сохраняется отдельным adapter, если есть потребитель; local fallback требует явного spool/replay contract | Один authoritative writer/ingest path на установку; file и realtime не дублируют события |

queue_log callid может быть `NONE`/`REALTIME`; нельзя выводить tenant из произвольного callid или телефонного номера. Для служебных событий — trusted PBX/node/queue ownership mapping; неизвестные помещаются в диагностический quarantine. File spool использует node+rotation generation+offset для replay identity; realtime events требуют подтверждённого стабильного identity contract. [Формат queue_log](https://docs.asterisk.org/Operation/Logging/Queue-Logs/).

Installer генерирует engine-specific ODBC DSN/driver config, `res_odbc.conf`, `extconfig.conf`, `cdr_adaptive_odbc.conf`, при использовании CEL — `cel_odbc.conf`, и проверяет logger/sorcery mappings. Не копировать MySQL func_odbc expressions или triggers в PostgreSQL. Preflight проверяет actual compiled modules, DSN/connectivity/TLS, schema version и ограниченные права Asterisk writer. Application/administrator и Asterisk используют разные credentials.

CDR и queue_log **не определяют готовность аудиофайла**. Recording finalizer/spool остаётся источником media readiness. Ошибка SQL-сервера не запускает STT в hangup: проверяем измеримый loss/retry/reconciliation contract для каждого writer. ODBC само по себе не гарантирует сохранение всех событий при длительной недоступности БД; соответствующий fallback/spool нужно реализовать и проверить до такой гарантии.

## Последовательность платформенной работы

Это подэтапы общего foundation, а не новый конкурирующий master roadmap. Основная последовательность — [ROADMAP](ROADMAP.md).

| Подэтап | Результат | Зависимость и gate |
|---|---|---|
| **DB-01** | Central config, два драйвера, migration adapters, изолированный dual-DB integration harness | Можно начать сейчас, параллельно AI-00 media/provider fixtures. Подробно: [DB-01-PLAN](DB-01-PLAN.md). Никакого обещания полного PostgreSQL AppModule после одного config switch |
| **DB-02** | Versioned PostgreSQL baseline, existing MySQL upgrade compatibility, core models/seeds и runtime queries parity (auth/tenant/providers/КЦ/CDR/autodial/robots); manifest всех оставшихся несовместимостей | После DB-01. Перед DB-зависимой реализацией AI-01/02. UX/offline/media contracts могут идти параллельно. Делится на небольшие планы schema, core smoke, report parity |
| **DB-03** | Asterisk/installer/ODBC profiles, ARA/CDR/CEL/queue_log schema ownership, tenant attribution и live golden calls на обоих engines | После DB-02, параллельно AI-01/02; перед native PBX recording AI-03 и internal routes AI-06. Analytics external/API не ждёт Asterisk live gate |
| **DB-04** | Release CI matrix, clean install, backup/restore/upgrade отдельно для каждой СУБД | После DB-02; PBX-срез дополнительно после DB-03. Обязательные gates каждого AI-10/11 в его deployment scope; analytics-only не ждёт PBX gates |

Большой DB-02 нельзя выдать за один маленький PR. Один schema/config owner координирует остальные workers. После DB-01 результат измеряется на двух реальных БД и уточняется план DB-02; незакрытые runtime несовместимости сохраняются видимыми.

**Смена engine действующей установки — отдельная будущая capability**, не требование первого релиза и не общий блокер двух продуктов. До её реализации документация явно запрещает трактовать замену `DB_DIALECT` как миграцию. Если этот scope будет включён, нужен отдельный план MySQL→PostgreSQL/PostgreSQL→MySQL export/import/cutover с evidence. Пользователь уже определил выбор engine при установке; дополнительный data-transfer scope этим не объявляется реализованным или обязательным.

## Требования и матрица приёмки

| ID | Требование | Где закрывается |
|---|---|---|
| DBR-01 | Явный выбор engine и единый validated config; MySQL defaults совместимы | DB-01 |
| DBR-02 | Одинаковая logical schema, clean install, upgrade, immutable journal/checksums, interrupted migration recovery | DB-01/02/04 |
| DBR-03 | Core и runtime query parity, tenant isolation, string/date/JSON/numeric edge cases | DB-02 |
| DBR-04 | ARA/CDR/queue_log и optional CEL с engine-specific drivers/schema | DB-03 |
| DBR-05 | AI outbox/idempotency/claims/финансовые invariants под конкуренцией на обеих СУБД | AI-02, последующие продуктовые фазы |
| DBR-06 | SaaS/self-hosted/core-only/analytics-only/robots-only profiles без скрытого второго SQL engine | AI-01/10/11, DB-04 |
| DBR-07 | Backup/restore/upgrade каждого engine; документированный запрет простой смены dialect для existing data | DB-04; cross-engine transfer — отдельный будущий scope |
| DBR-08 | Обязательная CI matrix MySQL+PostgreSQL с published evidence; live Asterisk отдельно | DB-01…04, AI-11 |

Каждый DB-affecting PR: unit + contract integration в обеих БД (реальные контейнеры/стенд, не SQLite). Release каждого поддерживаемого deployment profile проходит обе СУБД; billing/outbox concurrency тесты обязательны в обоих jobs. SQL-only success не закрывает Asterisk integration. Проверки `npm run lint`, `npm run test:backend`, `npm run test:frontend` сохраняются; к ним добавляются реальные dialect jobs.

Golden data: два tenants, tenant 0, RU/Unicode, case collisions, empty/null JSON, DST/day boundaries, несколько call legs/transfers, zero/big/decimal values. Для ingest/jobs/ledger — duplicate/concurrent/restart scenarios. Cross-engine transfer проверяет row counts, PK/FK, sequence reset, timestamps, DECIMAL суммы, semantic JSON checksums, tenant attribution и выборки отчётов; SQL dumps разных engines напрямую не импортируются.

Это контракт будущей реализации. Наличие этой документации и зелёные прежние unit tests не означают, что PostgreSQL, ODBC или cross-engine migration уже работают.
