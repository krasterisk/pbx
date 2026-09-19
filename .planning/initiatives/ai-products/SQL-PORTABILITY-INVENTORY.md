# SQL portability inventory — после DB-01

## DB-02 execution update (2026-09-18)

| Profile / boundary | Measured state | Remaining owner |
|---|---|---|
| Versioned schema and core HTTP auth/tenant/provider | MySQL 8.4.11 + PostgreSQL 17.11 passes; startup checks exact engine/history through 0003 | DB-04 legacy deployment/adoption and release matrix |
| CDR list, drill-down, stats, charts, CSV | Dual-DB API golden parity; `calldate VARCHAR(80)` invalid strings remain visible only in list; tenant/date index verified on 6000 rows | DB-03 CDR writer/recording/timezone integration |
| КЦ application `queue_log` reader, reconciliation, daily/raw summary | Dual-DB golden parity, source failures propagate; 0003 preflight refuses old duplicate business keys | DB-03 Asterisk queue_log provisioning/writer/replay/live outage |
| Scenario voice-robot CDR last tag filter/search/distinct | Dual-DB model golden parity; scripted robots remain separate from planned AI agents | Future AI robot implementation phases |
| Autodial reports/campaign/rollup | **Pending DB-02-D2:** active autodial refactor task still owns files; no parallel edits in this DB task | Autodial refactor owner handoff → DB-02-D2 |
| Historical manual setup/migrate scripts | Maintenance-only, not canonical PG installation/upgrade inputs | DB-04 installation tooling, module owners |
| `packages/backend/src/sync.ts` | Legacy entry point disabled in DB-02-E: it had embedded DB credentials and `sync({ alter: true })`, bypassing history. Source no longer contains the credential. | Secret rotation/history review by operations; DB-04 installation tooling |

The CI workflow now defines separate schema/config and runtime golden jobs per engine; its current source revision must pass on the designated test server before DB-02-E is closed. The table below is the original pre-implementation search, retained for traceability.

2026-09-18. Scope: фактический код Krasterisk, без запуска legacy CLI и без чтения рабочих DB credentials. Исходный поиск: [sql-search.txt](evidence/db-01/sql-search.txt); перечень legacy entry points: [legacy-cli-inventory.txt](evidence/db-01/legacy-cli-inventory.txt). Это inventory известных несовместимостей, не доказательство полноты runtime parity. При DB-02 повторить поиск SQL/literal/query и сверить изменения соседних задач.

| Область / точка | Состояние и риск | Владелец следующего среза | Parity fixture / gate |
|---|---|---|---|
| AppModule + `src/database/database-config.cjs` | DB-01 общий config, Sequelize 6, порты, TLS/timeouts. AppModule пока не проверяет полноту PG schema | DB-02-B core owner | Missing/wrong schema → понятный readiness failure; default MySQL startup не ломается |
| `database/migrations/0001-current-schema.sql`, manifest, runner | MySQL immutable baseline. PG production manifest явно закрыт; fixture adapter не является install schema | DB-02-A schema owner | Clean install обоих engines, table/column/index/FK/default/enum inventory; replay; исходный MySQL journal/checksum неизменён |
| Все Sequelize models; свежие изменения autodial | Baseline snapshot может отставать от новых models; нельзя изменять уже applied 0001, нужен additive upgrade | DB-02-A schema owner, согласование autodial owner | Install и upgrade к одинаковой logical schema; tenant-scoped uniqueness, nullable/default semantics |
| `database/seed-ci.cjs` | Общий resolver, явный PG refusal; CI users insert пока MySQL | DB-02-B core owner | Два tenants + tenant 0; admin fixture только disposable DB; idempotent/refuse-existing policy |
| `src/modules/**/migrate-*`, `setup-*-schema.ts`, `cloud-admin/seed-superadmin.ts`; `migrations/mysql`, `migrations/postgres` | Legacy/manual, не inputs canonical runner. Многие hardcode mysql, отдельные catch-all и ALTER/SHOW. PG-имена исторических файлов не подтверждают готовность | DB-02-A schema owner | Сопоставить необходимое DDL canonical baseline/forward migrations; запрет auto-run; точные deprecated aliases/документация |
| `reports/cdr/cdr.service.ts` | GROUP_CONCAT/SUBSTRING_INDEX для выбора call leg; STR_TO_DATE/HOUR/DAYOFWEEK; порядок/tie/null/aggregation семантика | DB-02-C CDR owner | Несколько legs/transfer, одинаковое время двух legs, missing linkedid, NULL/empty поля, tenant filtering, пагинация/total, детерминированный первый/последний leg |
| `reports/cdr/cdr.model.ts` | `calldate` STRING(80), не timestamp | DB-02-C CDR owner; DB-03 mapping owner | Валидные/невалидные legacy dates, UTC/DST/day boundary; политика parsing/backfill без silent cast и потери строк |
| `voice-robots/voice-robots.service.ts` | JSON_EXTRACT/JSON_UNQUOTE/JSON_LENGTH + backtick identifier, last-tag match/search/distinct | DB-02-D scripted robots owner | tags NULL/[]/null member, Unicode, quotes/%/_, last tag, DISTINCT и tenant scope; no prompt/data interpolation |
| `autodial/autodial-reports.service.ts` | SUM(boolean), TIMESTAMPDIFF, temporal aggregates | DB-02-D autodial owner **после передачи от активной refactor задачи** | Все dispositions, null answered_at/ended_at, несколько attempts, одинаковые totals/длительности/периоды |
| `autodial/autodial-campaigns.service.ts`, `autodial-rollup.service.ts` | Raw INSERT/result tuples/affected counts; QueryTypes.INSERT, rollup grouping. Driver metadata отличается; влияние проверять на consumer | DB-02-D autodial owner | Duplicate inserts, claimed tasks, empty rows, aggregate update, concurrency; return count не создаёт лишнее действие |
| `callcenter/queuelog/realtime-queue-log-reader.ts` | SHOW TABLES LIKE; errors в discovery/read могут выглядеть как отсутствие таблицы/empty batch | DB-02-D ingest owner; DB-03 PBX owner | Нет таблицы vs outage vs синтаксическая ошибка; explicit source/fallback, не успешный empty result |
| Callcenter rollups, ingest repositories, report schedules | Не ограничиваться одним найденным SHOW: повторно инвентаризировать raw SQL, dates, grouping, upsert semantics | DB-02-D CC owner | Один queue event log даёт одинаковые reports, duplicate replay, null/agent/state, tenant isolation |
| `ps_*`, queues/members, CDR в canonical baseline | Есть application-owned snapshot Asterisk tables; исторический upstream ARA tooling может стать вторым schema writer | DB-03 schema/ODBC owner | Явный owner каждой family и совместимость Asterisk version, ограниченные app/PBX роли |
| queue_log/CEL + ODBC/installer configs | Нет доказанного полного dual-engine provisioning/writer/read path; приложения одной ORM недостаточно | DB-03 PBX owner | res_odbc/res_config_odbc, cdr_adaptive_odbc, optional cel_odbc; live calls/transfer/queue cases, outage/replay/tenant attribution |
| Existing harness/E2E workflows | Полная система пока MySQL 8.0 jobs; DB-01 добавил отдельные узкие contracts | DB-02-B/E; DB-04 release owner | Полный core startup/auth/CRUD на обоих engines; далее install/upgrade/backup/restore per profile |

## Правило legacy entry points

Все перечисленные legacy setup/migrate/seed scripts считаются **неподдерживаемым путём PostgreSQL installation/upgrade**. Они остаются read-only в DB-01 и не запускаются автоматически. Даже скрипты, использующие DB_DIALECT, не становятся canonical без переноса необходимых изменений в manifest. Read-only `report-legacy-confbridge-steps.ts` также hardcode mysql; его diagnostics portability входит в DB-02, это не migration command.

DB-02-A назначает каждому entry point один исход: необходимый DDL уже покрыт baseline; additive canonical migration; wrapper к canonical command; либо явно архивированный maintenance-only инструмент. Удаление старых скриптов или переписывание чужих модулей не входит в DB-01. PostgreSQL полная готовность требует закрыть и не найденные простым regex query paths.

## Общие invariants

- Одна логическая схема/API, две engine реализации там, где raw SQL неизбежен; без fork приложения.
- Exact DECIMAL/BIGINT, Unicode, tenant 0, NULL/empty JSON, timestamps и result-count semantics проверяются данными.
- Запрет silent fallback dialect→mysql, SQL error→успешный пустой отчёт, sync({alter:true}) и перезаписи applied checksums.
- Asterisk schema/writer acceptance отделён от ORM tests; standalone analytics не ждёт live PBX.
