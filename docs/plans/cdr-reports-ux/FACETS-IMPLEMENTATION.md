# CDR v1.2 — справочники, фильтры и маршрут

Назначение: PLAN v1.2 A6/B2/B3/B6/B8, `/root`, `codex-direct`, тот же chat. Смежный dirty baseline сохранён; субагенты не запускались. Статус: implemented / automated-tests-passed / browser-verified на импортированных настоящих CDR/CEL LAN. Production release и полная реконструкция сложных веток не заявлены.

## Изменения

- `0050-call-dimensions` для MySQL/PostgreSQL, только full-pbx: индексированные исторические значения employee/department/companyNumber/queue/robot и метаданные наличия записи. Обновляются атомарно с общей проекцией; FK/cascade. `CALL_FACTS_VERSION=2`, ограниченный возобновляемый replay всего архива, checkpoint участвует в readiness. Существующая 0049 не переписана.
- `/reports/calls/facets`: варианты и distinct-счётчики из доступного пользователю cohort в repeatable-read snapshot. Собственная группа исключается при пересчёте вариантов, остальные условия и ACL остаются. Лимит 200 с явным `truncated`, поиск по справочникам на сервере. `search_label` нормализуется в JavaScript: кириллица работает и на PostgreSQL с locale C, где SQL LOWER() не обеспечивает нужное приведение регистра. Негативный прогон сохранён в `VERIFICATION-FACETS-SCHEMA-pg-case-fold-failure.json`; финальный повтор обеих СУБД PASS. Поиск исторического имени выбирает сущность, сохраняя счётчик всех её доступных звонков.
- URL/API: повторяемые значения employees/departments/companyNumbers/queues/robots/outcomes, OR внутри группы/AND между группами. Валидация до 30 значений, bind parameters, тот же predicate для журнала/сводки/экспорта. Legacy одиночные ссылки сохранены. Фильтры recording/voicemail/analytics; аналитика доступна только при соответствующем page grant.
- UI: searchable MultiSelect, понятные подписи/счётчики, чипы, поиск в больших справочниках, сохранение имён при загрузке. Не используется API/лицензия КЦ. Наличие записи означает ссылку в телефонных данных; доступность файла отдельно проверяет карточка.
- Отдельный business `CallRoute`: этапы и возможные пересекающиеся попытки, без выдумывания параллельного дозвона по одному CDR. Перевод подтверждается только следующим CEL-разговором с нужным получателем. UI: вертикальные связи, развилки попыток, секунды и относительное время, имена, сводка переводов, режим схемы. Raw CEL/каналы/контексты не выводятся, `historyComplete=false` сохранён.

## Стенд и доказательства

С задачей «Autodial» согласованы `cdr12-20261018`/HTTP3182, но новых серверных ресурсов не потребовалось. Их sv-autodial namespace/3181/schema0048 и сборка Asterisk20 не менялись. Их БД не читалась. В финале владелец подтвердил: его control-calls прошли, но raw CDR=0/CEL=0 (writer не настраивался). Этот прогон не использован как CDR evidence; их attempts/testcalls не подменяют телефонные факты.

Данные: настоящие 9 CDR/111 CEL восьми SIP-сценариев из собственного изолированного Asterisk на **192.168.2.201**, полученные в предыдущем этапе того же дня, [provenance](../../../.planning/cdr-reports-ux/LIVE-LAN-CDR.json). CDR/CEL не изменялись. Учётные записи, лицензирование тестового кабинета, ФИО и отделы — явно заданные configuration fixtures.

- [Матрица LAN](../../../.artifacts/legacy/.planning/cdr-reports-ux/VERIFICATION-FACETS-LAN.json): MySQL8.4.11/PostgreSQL17.11 PASS — 0049→0050, сохранность старого payload, API/projection/facets/CSV/ACL/replay. Временные SQL кластеры очищены.
- [SQL-only corpus](../../../.planning/cdr-reports-ux/VERIFICATION-FACETS-SCHEMA.json): отдельные synthetic факты для положительных queue/robot/DID/department/recording filters; не выдавать за работающего робота или фактическую аудиозапись.
- [HTTP](../../../.artifacts/legacy/.planning/cdr-reports-ux/FACETS-HTTP.json): реальный Nest CallsController, DTO ValidationPipe, JwtAuthGuard/JwtStrategy, SQL DashboardAccessService и module guard. Admin 7, scoped101 6, другой tenant 1; чужая карточка404; 31 значение400. Login endpoint не проверяется, JWT подписан harness для тестовой identity.
- Browser: текущие настоящие React-компоненты + Nest/API/SQL на localhost:3512 с импортированными данными LAN. Это **не деплой приложения на192.168.2.201**. Код browser-runtime и live-ui изолирован в этой папке, не входит в production. Проверены справочник101(6)/102(2), выбор102→2 звонка, OR101+102→6 уникальных, полная карточка перевода, Escape/URL, 390/320px, тёмная/светлая темы, отсутствие файла записи. На390 и320 documentWidth<=innerWidth, Sheet390/320.

Скриншоты: `live-card-mobile.png`, `live-card-light-320.png`, `live-journal-mobile.png`, `live-card-route-desktop.png`. Итоговый desktop обновлён, 1280×900, семь этапов; финальная полная перезагрузка без новых console errors. В ходе разработки был один временный HMR syntax error при редактировании, устранён до финального просмотра. Browser gate: [FACETS-BROWSER](../../../.artifacts/legacy/.planning/cdr-reports-ux/FACETS-BROWSER.json).

## Проверки / итоговый handoff

| Gate | Итог |
|---|---|
| Full backend | PASS: 466 suites / 4454 tests, 1 suite / 27 skipped; facets-backend.log. Один warning о worker teardown |
| Full frontend | PASS: 427 files / 2354 tests, все11 chunks, exit0; facets-frontend.log |
| Full lint | PASS: 0 errors, прежние123 backend /101 frontend warnings; facets-lint.log |
| После уточнений: targeted backend | PASS:8 suites /95 tests, включая Unicode labels, historical counts и readiness; facets-targeted-final-backend.log |
| После уточнений: targeted frontend | PASS:4 files /10 tests, включая сохранение ФИО при пустой выборке и сброс cache при смене доступа; facets-ui-final.log |
| Shared build, backend/frontend types | PASS, exit0; facets-shared-final.log, facets-backend-types-final.log, facets-frontend-types-final.log |
| Scoped ESLint после исправлений | PASS:0 errors; facets-scoped-lint-final.log |
| Migration runner | PASS:20/20; facets-migration-runner.log |
| 0050/schema SQL corpus | PASS обе СУБД, upgrade/replay/FK/filters/RU rename count; VERIFICATION-FACETS-SCHEMA.json, facets-sql-schema-final.log |
| Реальные LAN CDR/CEL → SQL/API | PASS обе СУБД на финальной0050; VERIFICATION-FACETS-LAN.json, facets-sql-lan-final.log |
| HTTP/JWT/ACL | PASS:401,404,403,400; RU uppercase search6, OR6, seven1-row cursor pages без дублей; FACETS-HTTP.json, facets-http-final.log |
| Browser | PASS в описанных выше границах; FACETS-BROWSER.json и screenshots |
| Независимый review / load / production release | pending; другой reviewer не назначался |

Полные repo runs выполнены до последних ограниченных уточнений; после них повторены затронутые suites, types/lint, SQL и HTTP/browser. Новые два frontend test files входят в targeted run; root runner перечислил427 файлов до их создания. Не утверждается полный повтор всего монорепозитория на каждом последнем редакционном diff.

Текущий browser runtime и его временный SQL кластер остановлены обычным stop/Enter, cleanup подтверждён. SQL-матрицы также cleanup PASS. Browser viewport reset; рабочая вкладка закрыта. Две первоначальные пустые error-вкладки временные; API не позволил привязать их из-за data: URL policy, ручное закрытие не заявляется.

**Один незакрытый housekeeping gate:** первый pipe-запуск browser runtime неожиданно завершился после ready и оставил собственный mysqld PID271788, datadir C:/Users/Professional/AppData/Local/Temp/krasterisk-cdr49-mysql-BWCxkB/data, loopback36958. Последняя read-only инвентаризация подтверждает этот один процесс. Команда проверки/принудительной остановки/удаления собственной папки отклонена automatic approval review (blocked by policy; причина не уточнена), не повторялась. Его очистка требует отдельного ручного действия; полная очистка локальных ресурсов не заявляется. Установленные PostgreSQL и чужие процессы не трогались.

Имена — сохранённый снимок обогащения доступными справочниками, а не доказательство ФИО на дату старого события: исторической версионности исходных каталогов пока нет. Политика неизменяемых снимков при replay остаётся отдельным уточнением A6.

Следующее назначение того же PLAN: пилотный rollout после согласования экземпляра и backfill/load; полная реконструкция Local/fork/join/attended/conference, каталоги линий/маршрутов/кампаний и granular media permissions. Живые robots/SA/media остаются у соответствующих владельцев; Z5 не присвоен. Наличие фильтра робота не является доказательством работающего AI runtime. Миграции0049/0050 не применялись к существующим рабочим БД; deploy/commit/reset/stash чужого diff не выполнялись.
