# DB-02-D3 — verification

На отдельных временных MySQL 8.4.11 и PostgreSQL 17.11 БД application-model golden дал одинаковые CDR ids и distinct tags: последняя строка `Gold`, `null`, `quote'_%\`, `Привет`; tenant B видит только `Secret`. Проверены `NULL`, `[]`, `[null]`, поиск буквального `%`/`_`/кавычки, last-tag only и страница `limit=1, offset=1`. Оба прогона завершились PASS; fixture строки удалены. Backend build и существующие voice-robots tests pass. Общие lint/backend/frontend gates фиксируются в DB-02-E.
