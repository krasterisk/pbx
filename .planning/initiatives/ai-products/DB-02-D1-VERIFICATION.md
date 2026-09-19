# DB-02-D1 — verification

На выделенном сервере `root@ipbx.krasterisk.ru` (без локального Docker): MySQL 8.4.11 и PostgreSQL 17.11, миграция `0001→0002→0003`, replay, проверка legacy-дубликатов до dirty marker — **11/11** каждый. Логи: [MySQL](evidence/db-02-d1/mysql-d1-contract.txt), [PostgreSQL](evidence/db-02-d1/postgres-d1-contract.txt).

На обеих disposable БД application-model golden: 3 queue calls из 7 событий, повторное чтение добавляет 0, tenant 2 видит 2 вызова (1 answered, 1 abandoned), tenant 3 — 1; повторный daily rollup остаётся одной строкой, raw/rollup summary совпадают. После теста fixture queue_log и тестовые строки удалены. D1 Jest: 4 suites/28 tests pass. Backend build pass; общие lint/backend/frontend gates — DB-02-E.

После матрицы добавлена узкая регрессия на **одинаковый Asterisk call ID у двух tenants**: reconciler разделяет event streams, видит существующую запись только у первого и создаёт запись второго. Targeted Jest 8/8 и backend build проходят. Полная dual-DB runtime матрица для этой последней поправки остаётся в финальном gate после DB-02-D2.

Ограничение: уникальный индекс намеренно отказывает на старых дубликатах до DDL. Для конкретной установки требуется резервная копия и предметная сверка этих строк; автоматического выбора «правильной» строки нет. Asterisk queue_log provision, file source в реальной среде и outage/replay live gate относятся к DB-03.
