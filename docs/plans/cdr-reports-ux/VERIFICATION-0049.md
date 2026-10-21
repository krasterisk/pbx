# CDR v1.2 — migration и Asterisk reconciliation, 2026-10-18

Coordinator: `/root`, `codex-direct`, тот же chat и PLAN v1.2 (§12, A3/A5/A7/B2/B6). Baseline HEAD `10308472a809ba42e501ccbd2d079a097b9a1222`; текущие смежные dirty изменения сохранены. Проверка собственная, не независимый review.

## Миграция — PASS

Реальные MySQL **8.4.11** и PostgreSQL **17.11**, отдельные временные loopback-кластеры Windows, без установки служб и без обращения к рабочей БД на запись. На каждой СУБД штатный full-pbx migration runner установил baseline до 0048; после вставки существующего dashboard-звонка применил только 0049. Существующая строка сохранена. Повторный запуск не применяет миграции заново. Проверены FK `dashboard_calls → call_facts`, каскад удаления и восстановление после rollback.

Evidence: [SCHEMA](../../../.planning/cdr-reports-ux/VERIFICATION-0049-SCHEMA.json), четыре synthetic SQL fixtures, включая коллизии идентификаторов у двух арендаторов и подмену caller ID. Это integration SQL, не реальная телефония. Кластеры удалены после проверки.

## Реальные звонки — PASS в изолированной АТС

По указанию пользователя использован `192.168.2.201`. С владельцем параллельной задачи «Autodial» согласован namespace `cdr49-20261018`; его `/opt/krasterisk-labs/sv-autodial-20261018`, HTTP3181 и существующие контейнеры не менялись. HTTP3182 не потребовался. Проверка занимала до 1 CPU / 512 MiB; SQL выполнялся локально.

Использован отдельный контейнер из существующего образа `krasterisk-support-asterisk-r9` (`sha256:5bed1811e39c59eacbd8ff221c80add2e0efaf300af16335fb4432c44d597b29`), **Asterisk 16.28.0**. Python установлен только внутрь нового временного контейнера; затем контейнер отключён от bridge-сети. SIP, AMI и RTP работали на loopback внутри его namespace, без внешних номеров и опубликованных портов. Настройки и логи создавались в отдельном private directory. Рабочие настройки/БД АТС не использовались.

| Реальный SIP-сценарий | Ожидаемый бизнес-результат |
|---|---|
| Входящий, сотрудник ответил | `in / human`, разговор 2 сек |
| Входящий, занято | `in / missed`, без времени разговора |
| Входящий без ответа до отмены вызывающим | `in / missed`, без времени разговора |
| Только IVR | `in / menu`, без времени человеческого разговора |
| Внутренний разговор | `internal / human`, 2 сек |
| Исходящий разговор | `out / human`, 2 сек |
| Входящий с переводом 101 → 102 | один `in / human`, два разговора суммарно 4 сек, отдельный понятный этап перевода |
| Второй арендатор, тот же внутренний 101 | отдельный `in / human`, 2 сек |

Получено **9 настоящих строк CDR / 111 CEL → 8 логических звонков**. Для разговоров проверены двусторонний RTP источника, установленный SIP-диалог и завершение BYE/200. Для каждого сценария получен настоящий `LINKEDID_END`. Исходные строки не создавались вручную: [LIVE-LAN-CDR](../../../.planning/cdr-reports-ux/LIVE-LAN-CDR.json), только синтетические номера собственных SIP-участников.

Эти CDR/CEL загружены в полную установленную схему обеих СУБД, затем обработаны настоящими `DashboardProjectionService`, `DashboardReadStore` и `CallsService`. Проверены результаты и направления, начало/конец истории, время из CEL и перевод сотрудника. MySQL/PostgreSQL дали одинаковые целые секунды разговоров (2/2/2/4/2). Независимый от проектора oracle суммирует исходные enter/exit события канала вызывающего; допуск 1 сек учитывает точность SQL DATETIME. Это собственная проверка другим вычислением, не независимый reviewer.

Журнал, dashboard и CSV совпадают по числу звонков и выбранному периоду. Сводка совпадает со всеми страницами журнала, outcome-фильтры — с dashboard. Проверены области сотрудника, прямой доступ к карточке, запрет карточки другого арендатора и идемпотентная повторная проекция. Авторизация в SQL harness задаётся тестовым контекстом; HTTP/JWT/browser с живыми данными этим прогоном не проверялись.

Evidence: [LAN SQL matrix](../../../.artifacts/legacy/.planning/cdr-reports-ux/VERIFICATION-0049-LAN.json), [лог](../../../.artifacts/legacy/.planning/cdr-reports-ux/verification-sql-lan.log). Asterisk остановлен, private directory и порты освобождены; контейнер удалён. После удаления `docker ps -a --filter name=cdr49-20261018` пуст. Владелец Autodial уведомлён об освобождении ресурсов.

## Исправленные дефекты

1. Sequelize не подставлял named replacements рядом с `<:to`, `<:cursorAt`, `<:cursorId`, `>:at`, `>:id`: реальные запросы периода, курсора и позднего SA update падали. Добавлены пробелы и регрессионная проверка настоящим Sequelize lexer для обеих СУБД.
2. Справочник очередей запрашивал несуществующий `queue_table.user_uid`; заменён на физический `vpbx_user_uid`.
3. При одинаковом времени технический порядок ID ставил попытку перед началом звонка. Граничные этапы `received`/`ended` теперь имеют явный приоритет.
4. Перевод CEL с собственным uniqueid канала сотрудника терялся, если у этого канала нет отдельной строки CDR. Допускается подтверждённое совпадение linkedid **и известного канала данного звонка**. Чужой канал исключён регрессионным тестом.
5. PostgreSQL TIMESTAMP CEL автоматически превращался драйвером в Date с часовым поясом процесса и смещал историю относительно CDR. CEL читается как wall-clock текст (`CONCAT(eventtime,'')`) и разбирается в настроенном CDR timezone; так же исправлено чтение completion evidence. Глобальные parser/config не менялись.

## Проверки репозитория

| Gate | Evidence |
|---|---|
| `npm run lint` | PASS, 0 errors, существующие 123 backend / 101 frontend warnings; `verification-lint.log` |
| `npm run test:backend` | PASS: 464 suites / 4450 tests, 1 suite / 27 skipped; `verification-backend.log` |
| `npm run test:frontend` | PASS: 427 files / 2353 tests, все 11 chunks, exit 0; `verification-frontend.log` (workers=2) |
| После исправлений SQL/CEL: targeted backend | PASS: 5 suites / 69 tests; `verification-final-targeted.log` |
| После исправлений: scoped ESLint / production backend types | PASS; `verification-final-eslint.log`, `verification-final-types.log` |
| Migration runner unit | PASS: 20/20; `verification-migration-runner.log` |

Полные тесты запускались до последних ограниченных исправлений; после них повторены затронутые suites, lint/types и реальные SQL-проверки. Это не утверждение о полном повторном прогоне всего монорепозитория на финальном diff.

## Оставшиеся gates / handoff

- `ipbx.krasterisk.ru` перегружен и новые подключения получали timeout. До переключения SELECT показал CEL=0, отсутствие SA-связей со звонками и исторические unknown. Это предварительная диагностика, не успешная сверка API с производственным архивом; raw snapshot не сохранён. Миграция и приложение туда не выкатывались. Новые проверки на нём прекращены по указанию пользователя.
- Изолированная настоящая телефония проверена; production archive/backfill/load/release — **pending**. Нет оснований восстанавливать переводы, которых нет в исходном CEL. `historyComplete=false` сохранён честно.
- Реальные сохранённые voicemail/записи, AI/voice robot runtime и speech analytics provenance в этом прогоне — **pending**: их владельцы и рабочие источники не заменялись fixtures. Сценарий IVR не выдаётся за успешную обработку роботом или сохранённую голосовую почту.
- Следующее действие того же PLAN: facets/справочники, полноценный граф fork/join, granular media permissions; отдельно замер backfill и авторизованный HTTP/browser gate на согласованном экземпляре с 0049. Z5 остаётся у speech-analytics. Общие STATE и смежные назначения не менять.

Воспроизведение SQL: `node .planning/cdr-reports-ux/verify-real.cjs --local --schema-only`; затем `node .planning/cdr-reports-ux/verify-real.cjs --local --lab-source=.planning/cdr-reports-ux/LIVE-LAN-CDR.json`. Нужны portable engines в пути из `local-engines.cjs`; источники и версии сохранены в evidence. `live-lan.cjs` — RPC-клиент для заранее созданного собственного контейнера с Python и изолированной сетью; не запускается против существующей рабочей АТС.
