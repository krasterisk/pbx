# Проверки исследовательского этапа

Дата: 2026-09-18. Изменения этого этапа — документы инициативы и ссылки в `.planning/CANONICAL_REFS.md`/общем `ROADMAP.md`. Production-код, зависимости, provider credentials и БД не менялись; aiPBX использовался read-only.

## Baseline

Krasterisk HEAD при фиксации: `e7eba43f3b2c2e985f0e7647bd81d8a3a0fda9cd`, branch `main`. До работы было много незакоммиченных изменений, включая production remediation и autodial. Список: [baseline-status.txt](evidence/baseline-status.txt). Это не чистый checkout и не изолированная release-ветка; результаты относятся к текущему рабочему дереву, а не исключительно к данному пакету документов.

Финальная сверка status также показала новые изменения autodial, поступившие параллельно этой задаче. Их не делали и не откатывали авторы данного пакета. Результаты ниже — snapshot выполненных прогонов; они не аттестуют каждый последующий параллельный edit и не заменяют повтор release checks на зафиксированной ветке реализации.

## Обязательные проверки из AGENTS.md

| Команда | Результат | Свидетельство |
|---|---|---|
| `npm run lint` | exit 0; ошибок нет; 99 backend и 84 frontend warnings | [lint.log](evidence/lint.log) |
| `npm run test:backend` | exit 0; 241 suites passed, 1 skipped; 2840 tests passed, 9 skipped | [test-backend.log](evidence/test-backend.log) |
| `npm run test:frontend` | exit 0; 243 files, 1384 tests passed | [test-frontend.log](evidence/test-frontend.log) |

Первый frontend запуск в ограниченной среде завершился до тестов: esbuild `Access is denied` при загрузке vite.config.ts. Та же штатная команда повторена с разрешённым расширением среды и прошла. Конфигурация тестов для обхода ошибки не изменялась. Итоговый frontend лог содержит успешный повтор.

Пропущенные тесты и lint warnings не скрыты и не исправлялись этим исследовательским этапом. Эти успешные checks **не доказывают работоспособность новых AI-продуктов**, которых ещё нет, и не закрывают исторический live UAT/P0.

## Проверка плана

- Три независимых code audits: aiPBX robots, aiPBX analytics, Krasterisk reuse. Различены code, skeleton, исторический UAT и proposed design.
- Независимый review первоначального плана нашёл 12 замечаний. После исправлений reviewer подтвердил **12/12 addressed in plan, 0 fixed in code**: [PLAN-REVIEW](PLAN-REVIEW.md).
- Сверены requirement mappings AN/VR с ROADMAP; explicit technical retry отделён от нового analysis run.
- Общий capture03 необходим для robot recording, но аналитика/её лицензия не требуется robot-only продукту. Analytics04 может принимать внешние записи без legacy CDR.
- Выбор пользователя «развивать параллельно» внесён в README/ROADMAP с отдельными ветками и владельцем shared changes.
- Уточнение SaaS/коробка/OpenSource-base внесено в DEPLOYMENT-LICENSING, ARCHITECTURE, ROADMAP и AI-00; отдельные DEP-01…08 gates проверяют самостоятельную сборку core, data boundaries и оба режима поставки.
- Относительные Markdown-ссылки проверены: 14 документов, отсутствующих ссылок нет. `git diff --check` по изменённым root planning references прошёл. Proposed будущие файлы названы текстом, не выданы за существующие артефакты.

## Не выполнялось

Новые SIP-звонки/ARI media capture, provider API/платные evals, production migrations/deployment, коммерческие списания, benchmark latency/accuracy/load, визуальная приёмка реализованного UI. Эти проверки явно включены в следующие фазы. В документах latency/accuracy thresholds — предлагаемые цели, не результаты измерений.

## Следующая работа

[DB-01-PLAN](DB-01-PLAN.md): configuration/migration infrastructure MySQL и PostgreSQL; параллельно [AI-00-PLAN](AI-00-PLAN.md): критичные контрактные spikes и baseline. Затем DB-02 schema/query parity и shared foundation с параллельными продуктовыми ветками. Новые SUMMARY/VERIFICATION создаются только после выполнения соответствующей работы.

## Уточнение двух СУБД и готовности к реализации

По запросу пользователя добавлены DATABASE-PORTABILITY и детальный DB-01-PLAN, обновлены ARCHITECTURE/ROADMAP/AI-00/README/recording/deployment/workflow и корневые индексы. Sequelize сохранён; PostgreSQL и MySQL поддерживаются целевым контрактом для всей установки, включая Asterisk CDR/queue_log/realtime. Read-only аудит подтвердил, что driver/runner/schema/runtime SQL/CI ещё требуют реализации для PostgreSQL.

Roadmap готов на фазовом уровне; детальные execution plans существуют только для AI-00 и DB-01. Ближайшая реализация может начаться локально, однако PostgreSQL compatibility и новые AI-продукты не объявлены готовыми. Выбор coding models сверён с актуальной official OpenAI documentation и записан как рекомендация, без изменения настроек GSD/задачи.

В этом дополнении менялись только Markdown-документы. Указанные выше npm checks — прежний baseline исследовательского этапа, повторно после этого documentation-only изменения не запускались; это не результат PostgreSQL integration tests. Реальные DB/ODBC/provider/production операции не выполнялись.

Повторная локальная проверка дополнения: 16 Markdown-документов, 117 относительных ссылок, отсутствующих целей нет; trailing whitespace не найден. `git diff --check` корневых planning references — exit 0 (только предупреждения LF/CRLF). Независимый review DB-плана отделил runner guard от runtime readiness, обязательную per-engine установку от optional cross-engine transfer, а также нашёл косвенную Asterisk-зависимость standalone analytics release. Последняя устранена разделением AI-06A (отчёты) и AI-06P (internal PBX integration); 06P остаётся обязательным scope встроенного продукта.
