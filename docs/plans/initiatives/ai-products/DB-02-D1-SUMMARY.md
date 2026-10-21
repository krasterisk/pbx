# DB-02-D1 — queue_log reader and call-center reports

Статус: реализован для application reader и отчётов КЦ на MySQL/PostgreSQL. Asterisk writer/provisioning остаётся DB-03.

- `queue_log` обнаруживается через dialect-aware Sequelize catalog. Отсутствующая таблица даёт `false`; ошибка каталога/доступа выбрасывается. Режим `auto` выбирает файл только при реально отсутствующей таблице и доступном файле; если источников нет, startup отказывает. Ошибка чтения выбранного realtime/file источника больше не превращается в пустую выборку.
- Порядок realtime events стабилен при одинаковом времени. Параметры границ передаются через replacements.
- Reconciler группирует события по tenant и Asterisk call ID, затем проверяет существующую запись тем же составным ключом; совпадение call ID у разных арендаторов не склеивает истории и не скрывает второй вызов.
- Отчёты с `dateFrom/dateTo` в формате `YYYY-MM-DD` включают последний день целиком. Явный ISO timestamp остаётся точной границей. Date-only контракт — UTC, соответствующий DB profile.
- `0003-callcenter-report-keys.sql` добавляет уникальные tenant/business keys для queue calls и двух daily rollup таблиц; повторный `upsert` на PostgreSQL использует явные composite conflict fields. До выставления dirty marker миграция отказывает при legacy-дубликатах с именем таблицы, не удаляя их.

Затронутый reader проверен отдельно от DB-03: golden fixture создаёт `queue_log` только во временной БД и удаляет её после проверки. Реальный Asterisk/ODBC writer не утверждается как PostgreSQL-ready.
