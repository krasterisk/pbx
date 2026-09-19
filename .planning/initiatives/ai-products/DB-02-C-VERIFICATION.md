# DB-02-C — verification

Disposable database matrix на `root@ipbx.krasterisk.ru`; локальный Docker не использовался. MySQL `8.4.11`, PostgreSQL `17.11`, Sequelize `6.37.8`. Приложение подключалось к отдельным временным БД через SSH tunnel; production/PBX конфигурации не менялись.

| Проверка | MySQL | PostgreSQL |
|---|---|---|
| `0001 → 0002`, data preservation, replay, schema contracts | 10/10 | 10/10 |
| CDR golden HTTP endpoints + CSV | PASS | PASS, одинаковый вывод |
| EXPLAIN tenant/date на 6000 временных CDR-строк | `idx_cdr_tenant_date` | `idx_cdr_tenant_date` |

Контрактные логи: [MySQL](evidence/db-02-c/mysql-c-contract.txt), [PostgreSQL](evidence/db-02-c/postgres-c-contract.txt). Предыдущие CDR HTTP логи: [MySQL](evidence/db-02-b/mysql-cdr-api.txt), [PostgreSQL](evidence/db-02-b/postgres-cdr-api.txt). `npm run test:db:unit`: 45/45, `npm run test:db:schema`: 6/6, backend build: pass. Дополнительные общие проверки фиксируются в DB-02-E.

Ограничение: benchmark проверяет выбор индекса на representative fixture, а не SLA на production-объёме; legacy timestamps остаются строками. Ошибочные даты видны в списке, но исключаются из временных графиков.
