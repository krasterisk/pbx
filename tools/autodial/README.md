# Autodial development tools

Запускать из корня репозитория после установки зависимостей.

- `node tools/autodial/make-csv.cjs` — только синтетические debtors CSV в UTF-8 BOM и Windows-1251; вывод в `ARTIFACTS_ROOT/runs/autodial/csv-<timestamp>/`. Канонические входы тестов не перезаписываются.
- `node tools/autodial/export-crm-openapi.cjs` — Swagger metadata export с stub providers/deny guards, без app bootstrap/listen/DB; вывод в `ARTIFACTS_ROOT/runs/autodial/openapi-<timestamp>/`.

Синтетические входы: `tests/fixtures/autodial/`. Остальные прежние numbered/remote/live сценарии не объявлены поддерживаемыми инструментами и сохранены локально в `.planning/`; перемещённые исходники дополнительно сохранены в резервной копии миграции. Запуск LLM/SQL/SSH/calls не входит в структурную миграцию.
