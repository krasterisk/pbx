# Dashboard АТС — результат реализации

Канонический PLAN: revision 2026-10-11-r3. Координатор /root, codex-direct. Работа выполнена поверх main / 7263d499 с сохранением исходных незакоммиченных изменений других инициатив. Коммиты, stash/reset и публикация не выполнялись.

Статус: implemented; automated-tests-passed; isolated ordinary-call live-verified. Working AI, full autodial engine, dedicated PBX high-load и release остаются pending.

## r3: реальные звонки и исправления — 2026-10-11

Изолированный второй Asterisk на ipbx.krasterisk.ru, loopback-only AMI/SIP/ARI/RTP; новая Dashboard API/React UI локально с disposable full-PBX MySQL8.4.11. Основной Asterisk, production конфигурация и БД телефонии не изменены. Тестовые SIP UA передавали настоящий UDP/PCMU RTP silence; tenant/users/rights/endpoints и приветствие приватного mailbox являются конфигурационными fixtures. AI playback и телеком-результаты не фабриковались.

Чистый run6: **PASS**, 14 логических звонков /16 фактических CDR /187 CEL, 12 маршрутов + отдельный UI-звонок + звонок для outage. Tenant1:13 звонков, входящие8/исходящие3/внутренние2; принятые входящие4/пропущенные4/unknown0. Tenant2:1 звонок. Overview,105 графических интервалов и13 строк детализации совпадают, historyVersion совпадает. Перевод создаёт2 CDR legs и1 логический звонок. Оба ограниченных CDR scope дают9 уникальных звонков на этапе tenant1=11, до UI/outage звонков.

Проверены входящий/внутренний/исходящий ответ, noAnswer, busy, IVR, VoiceMail, технический Answer перед BUSY, перевод, реальный звонок через autodial-marked context и вторая организация. Положительные answer-сценарии требуют установленного исходного SIP диалога, RTP от/к исходной стороне и BYE200. Реальный Asterisk Contact без user@ подтверждён в отчёте. UI без mock API проверен390/1280 dark и390 light: ringing → conversation → detail1 → BYE → active0 → исторический счётчик. DOM783/1477 для исторических экранов остаётся ограниченным.

100 одновременных HTTP запросов с одним test-admin JWT/scope: p95 **407.54мс**, дополнительных AMI bulk actions **0**. Это малый функциональный набор, не100 отдельно авторизованных браузеров и не проверка1000 активных звонков. При настоящем разрыве AMI TCP сохраняются1 звонок и исходный timestamp/stale; реальный Asterisk продолжает держать2 канала. Reconnect и завершённый snapshot восстанавливают разговор, последующий BYE добавляет1 историю. Stale HTTP проверен runtime assertion и сохранённым check; полный stale response body run6 не сохранён.

Исправлены production ошибки: caller Answer/IVR/VoiceMail не подтверждают ответ сотрудника; technical evidence и явный BUSY переживают final Hangup; CEL доказательства привязаны к tenant-owned UID/channel/linkedid; сохраняется только v3 positive human/AI provenance, старый accepted не является proof. Bounded semantic replay500/continuation с фиксированным upper key исправляет31-дневную проекцию и входит в readiness. Исходное направление/источник сохраняются при быстром переводе, рестарте и snapshot+Hangup replay. Exact empty No Contacts found для PJSIPShowContacts принимается как terminal empty; остальные ошибки не превращаются в ноль. Добавлены node+call_key и CEL linkedid indexes в обе0033.

Отдельно исправлен стенд: bridge_simple для настоящего RTP, CDR/CEL raw epoch→UTC и SQL UTC wall strings, SIP Contact/ACK/BYE/CANCEL, private VoiceMail greeting. Run4/run5 FAIL и cleanup PASS сохранены как предыдущие попытки. Run6 успешные IVR/VM прерваны внутри Playback/VoiceMail; ветка terminal-Hangup IVR имеет отдельные unit/ранние actual-failure доказательства, не повторена успешным run6. VoiceMail greeting не подтверждает запись полноценного сообщения.

Профиль:6 endpoints,1 одновременный логический звонок, максимум2 наблюдённых канала, peak rolling1s CPS1; mean CPS0.0318 в 440.23с от первого raw start до последнего projected end. AMI observer1021 событий; среднее1.96событий/с по полному521.249с окну с bootstrap/cleanup, peak AMI не измерен. Raw CEL peak12 событий/rolling1s. Asterisk certified22.8-cert2 /Linux6.8.0-138-generic /2CPU /2014860KiB RAM; собственный AsteriskRSS58572KiB, последний MemAvailable527280KiB. API:Windows/Intel i5-7400,4logicalCPU/32GiB/Node24.19.0. Overview18509байт,105bins.

| Gate | r3 result |
|---|---|
| Targeted collector/AMI | PASS62/62; live-collector-targeted.log |
| Targeted classifier/projection | PASS73/73; source worker evidence |
| Независимый review | PASS91unit/2SQLlexer/1migration плюс отдельный audit actual run6; LIVE-REVIEW.md, без суммирования перекрывающихся тестов |
| npm run lint | PASS0errors, существующие warnings; full-lint-r3.log |
| npm run test:backend | PASS406suites/3894tests;1suite11tests skipped; full-backend-r3.log |
| npm run test:frontend | Предыдущий PASS340files/1840tests используется: frontend source в r3 не менялся; full-frontend-r2.log |
| Production TypeScript / scoped ESLint | PASS |
| Actual MySQL/PostgreSQL | PASS26groups; default ONLY_FULL_GROUP_BY/optimizer, CEL index_merge/BitmapOr; dashboard-dialects-check.json |
| Actual ordinary SIP→AMI/CDR/CEL→SQL→API/UI | PASS27checks/12scenarios/14logical; live-dashboard-report.json |
| Cleanup | PASS own local runtime/container, remote ownPID/directory/ports, mainUnchanged; foreign resources не затронуты |
| git diff --check | PASS; diff-check-r3.log |
| Working AI / full autodial engine | Pending; autodial-marked context проверен, scheduler не запускался |
| Dedicated10k endpoints/1k active-call/high-CPS PBX | Pending; прежний seeded SQL/HTTP5m load и unit10k не являются этим gate |
| Production deployment / release | Не выполнено |

AI scalar SELECT-only audit:1 активный legacy robot имеет unified STT/TTS references и credentials, но installed runtime ищет старые speech engine tables. Рабочая voice session не доказана; изменения AI writers принадлежат соседней инициативе. Capability evidence:live-ai-capabilities.json. Перед production rollout отдельно настроить корректный CDR writer timezone и реальный CEL/AI evidence writer; в текущем main runtime CEL disabled. Исторические неясные результаты должны оставаться unknown.

Повтор:node .planning/pbx-dashboard/live-dashboard-check.cjs (SSH key остаётся локально; runner генерирует новые ephemeral secrets, проверяет isolated ports/privatePID и удаляет только свои ресурсы). SIP unit:live-asterisk-lab-sip.test.py. Артефакты:live-dashboard-report.json, live-dashboard-console.log, live-dashboard-*.png, LIVE-REVIEW.md, PLAN.md, EXECUTION.md. Новая application на production host не опубликована.

Ниже сохранены r2 implementation и прежние измерения; текущая таблица r3 supersedes только соответствующие gates.

## Что реализовано

Главная страница / показывает доступность и свежесть источников, сгруппированные проблемы, текущие логические звонки, доступность абонентов/транков, итоги периода и динамику. В CLOUD добавлены тариф, срок, баланс, кредитный лимит и использование лимитов; в BOX/OPENSOURCE — CPU, память и диски серверов Asterisk/приложения. Период использует IANA timezone кабинета, с явно обозначенным UTC fallback. Метрики колл-центра в этот экран не добавлены.

Карточки открывают адаптивную боковую панель. Детализация загружается после открытия: 50 строк, максимум 100, серверные фильтры/поиск/cursor, отмена устаревших запросов. Переход в полный раздел сохраняет фильтры и использует облегчённый dashboard route. График сохраняет пустые интервалы; на телефоне объединяет их до 24, на desktop до 96, сохраняя суммы и границы выбранного периода. Есть dark/light, RU/EN, управление клавиатурой и восстановление фокуса.

## Данные и защита от нагрузки

- HTTP читает готовые данные: без AMI-действий, полного списка АТС и сканирования raw CDR. Public overview ограничен 50 КиБ и 300 интервалами. В system overview сохраняется один наиболее заполненный диск узла и явные omittedDisks/omittedMissingFilesystems; полные пути/статусы остаются в lazy /system detail. Размер проверяется после сериализации. Проблемы группируются: пять групп плюс количество остальных.
- Один сборщик на node с SQL lease, независимо от числа зрителей. События AMI обновляют состояние, bulk channels сверяются каждые 30 секунд, inventory — каждые 5 минут. SIP/WebRTC контакты одного абонента учитываются один раз. Сверки принимаются по complete event либо точному terminal-empty No Contacts found для PJSIPShowContacts без строк; replay поверх snapshot защищён generation/fence и проверкой overflow после последнего await.
- Медленный inventory выполняется отдельно от 5-секундной публикации и calls. Его timeout по умолчанию 120 секунд, heartbeat lease — 15 секунд; channels сохраняют 15-секундный timeout. Перезапуск восстанавливает bounded persisted last-good отдельно для calls/inventory; до полной сверки показываются прежние timestamp и stale. Источник без достоверной истории имеет unavailable, а не ноль.
- Проекция объединяет CDR/CEL/AI в логический звонок tenant + node + linkedid, fallback uniqueid. Batch/checkpoint, идемпотентная транзакционная коррекция прежнего/нового 5-минутного агрегата, bootstrap последних 31 дня с прогрессом. Поздние legs/events исправляют существующий звонок.
- Ответ IVR/voicemail не считается принятым. Человек либо подтверждённый playback работающего AI считается ответом; незавершённые звонки исключены из итогов истории. Конец отдельного CDR не доказывает завершение: используется tenant-safe CEL LINKEDID_END либо свежая live absence после последнего участка. Bounded pending replay завершает звонки даже без нового CDR.
- Ограниченный CDR scope использует индексируемые участники и EXISTS: пересечение операторов не удваивает звонок. Права читаются из проверенного актуального пользовательского контекста; tenant и версия прав входят в ключи bounded cache/single-flight.
- Summary/details имеют opaque historyVersion. Строки и точный count читаются в одной REPEATABLE_READ транзакции; явно запрошенная устаревшая версия возвращает 409. Overview сохраняет версию собственного cached summary.
- UI: live не чаще 5 секунд, history через серверный кэш 30 секунд, cloud 5 минут. Скрытая вкладка прекращает polling. Socket /pbx-dashboard передаёт только авторизованное изменение версии; персональных данных в общем broadcast нет.
- Node Exporter собирается фоном каждые 15 секунд, SQL history хранится 7 дней. До восьми серверных targets, bounded HTTP response/timeout, выбранные реальные mountpoints, avg/max при объединении истории. CPU/RAM 85/95% за 5 минут; диски 85/95%; три пропущенных цикла дают stale. Метрики backend контейнера не используются как показатели хоста.

## Контракты и настройка

API с JWT: GET /api/dashboard/overview, /calls, /endpoints, /trunks, /system. Shared DTO находится в packages/shared/src/types/dashboard.types.ts. Модуль подключён только к полной PBX composition; добавлены AI read adapter, skill и coverage registry.

Аддитивная миграция 0033-pbx-dashboard существует для MySQL/PostgreSQL и зарегистрирована в manifest. Она добавляет read model, participant ACL, buckets/checkpoints/lease/live-state/system samples и поля tenants: plan_name, plan_expires_at, max_concurrent_calls nullable, timezone. Кабинет редактируется через действующую platform tenant form. Billing использует tenants.id через tenant binding. Неизвестные лимиты/тариф/баланс явно обозначены.

Настройка в .env.example:

| Переменная | Назначение |
|---|---|
| DEPLOYMENT_MODE | CLOUD либо BOX; OPENSOURCE использует технический BOX |
| DASHBOARD_NODE_ID | Стабильный уникальный ID узла и партиции проекции |
| PBX_DEFAULT_TIMEZONE | IANA fallback установки, default UTC |
| DASHBOARD_CDR_TIMEZONE | Фактическая timezone legacy CDR writer без offset |
| DASHBOARD_AMI_INVENTORY_TIMEOUT_MS | Default 120000; ограничено 15000–180000 |
| PBX_MONITORING_TARGETS | До восьми id/label/role/url; filesystems/recordsMount должны совпадать с экспортируемыми mountpoints |

Пример BOX targets: [{"id":"pbx","label":"Asterisk","role":"asterisk","url":"http://127.0.0.1:9100/metrics","filesystems":["/"]}]. Для отдельного application host добавляется другой target с role application. Адреса не принимаются из браузера. Миграции и конфигурация на пользовательском сервере не применялись.

## Evidence и границы измерений

| Gate | Статус и доказательство |
|---|---|
| Targeted dashboard tests | PASS; final collector 2 suites / 51 tests, AI completion 3 suites / 44 tests; текущие результаты в EXECUTION |
| Shared build | PASS |
| Production backend / frontend TypeScript | PASS |
| npm run lint | PASS; zero errors, existing warnings; full-lint-r2.log |
| npm run test:backend | PASS; 406 suites / 3854 tests; 1 suite / 11 tests skipped; full-backend-r2-final.log |
| npm run test:frontend | PASS; 340 files / 1840 tests, 9 chunks; full-frontend-r2.log |
| Pinned real SQL matrix | PASS 34/34: MySQL 8.4.11 и PostgreSQL 17.11-bookworm; установка/повторная установка/constraints/concurrency. pinned-sql-contracts.log |
| Actual dashboard queries on both pinned engines | PASS12+12 groups: summary/boundaries/scopes/cursors/count/version, leases/fences/atomic corrections, snapshots, ingestion/pending replay and system JSON avg/max. dashboard-dialects-check.json |
| Supplemental PostgreSQL14 integration | PASS, fresh isolated full-PBX install/replay + 17 contracts. postgres-contracts-final.log |
| Seeded SQL + Nest HTTP read load | PASS; sql-load.cjs / sql-load-report.json |
| Chromium real frontend / mocked API | PASS 15/15; browser-check.cjs / browser-report.json; screenshots в этой папке |
| Independent collector closure | PASS; final collector 2 suites / 51 tests independently, no confirmed P1/P2 in assigned scope |
| Actual AMI bulk source | PASS; live-source-check.cjs / live-source-report.json |
| Actual remote Node Exporter | PASS; official1.10.2 + checksum, 2 actual host samples, actual parser/SystemService with local memory adapters; live-exporter-report.json |
| Live нового dashboard с реальными call flows/AI | Pending: приложение не развёрнуто, необходим изолированный функциональный стенд |
| Live нагрузка 10k endpoints / CPS / event burst | Pending: требуется выделенный Asterisk load stand |
| Release / application of user-server migrations | Не выполнялось |

Нагрузочный прогон использовал локальный PostgreSQL14, Node24.19, Sequelize6.37.8, Windows, Intel i5-7400 4 cores / 32 GiB. История: 5 млн raw CDR legs, 1 млн логических звонков, 2 млн participant links; 100 зрителей. Настоящие Nest routing/serialization/Service/read-store/SQL, но авторизация и live-state — fixtures; cloud/host blocks исключены из измерения HTTP. История seeded: CPS и AMI events/sec не генерировались. Отдельная unit fixture коллектора содержит 10k endpoints / 1k active logical calls / 1k channels и доказывает отсутствие новых AMI-запросов при росте с 1 до 100 прямых вызовов collector.overview.

| Метрика этого профиля | Результат |
|---|---:|
| Public HTTP overview JSON | 27769 bytes / 150 buckets |
| HTTP первая сводка | 84.3 ms |
| HTTP ready overview p95 / 100 одновременных запросов | 424.5 ms |
| HTTP detail p95 / 12 cursor pages | 403.7 ms |
| 100 cold summary requests | 3 SQL SELECT, один single-flight расчёт |
| Прогретый ReadStore summary cache p95 | 12.3 ms |
| Cold ReadStore SQL summary | 31.6 ms |
| SQL detail p95 | 269.6 ms |

Это подтверждает бюджеты чтения для записанного профиля; не доказывает общую производительность ingestion 5 млн raw legs либо production Asterisk под звонковой нагрузкой. Внутренний summary JSON до public bounded serialization содержит 299 buckets / 53597 bytes; публичный ответ проходит лимит.

На ipbx.krasterisk.ru read-only AMI проверен с добавленным ключом: Asterisk certified22.8-cert2; channels complete 0 rows, endpoints complete 1490 rows за 10.47 seconds, contacts 1 row и outbound registrations 1 row. Этот фактический медленный inventory стал основанием для timeout/heartbeat/асинхронной сверки. Показатели raw каналов/контактов не раскрываются в evidence. RAM stand 1.92 GiB / ~523 MiB available; тяжёлая DB нагрузка туда не переносилась.

## Остаточные ограничения и точное следующее действие

Legacy AI v1 журнал сохраняет распознанный текст до ответа, а ошибки TTS могут быть поглощены. Поэтому текст/ai_response не являются доказательством работоспособной голосовой сессии. При отсутствии надёжного playback marker результат unknown / aiPlaybackUnconfirmed. AI v2 подтверждённый playback и ответ сотрудника поддержаны. AI voice writer принадлежит соседней активной инициативе и здесь не менялся; для полного v1 учёта нужно согласованное событие успешного playback от того владельца.

Следующий внешний gate: на изолированном стенде применить 0033, задать node/timezones/exporter targets и проверить установленный новый dashboard с реальными входящими/исходящими/internal/IVR/voicemail/transfer/AI/autodial, source failures и auth/scope. Затем отдельный Asterisk load stand должен измерить CPS, channels/events/sec и ingestion/backfill в дополнение к уже измеренному SQL read path. Это pending evidence, а не подтверждённая live-приёмка.

Socket CORS оставлен origin:false: автоматический approval reviewer отклонил расширение origin:true. Реализация сохранила ограничение; подтверждения для этого от пользователя не требуется.

Реальный temporary Node Exporter проверен на Linux-хосте: seven collectors успешны, выборки с интервалом15107ms, CPU4.78%, RAM74.17%, root disk70.39%, load/cores0.09, uptime3951127s и сеть. Архив11.69MB проверен по официальному SHA256 manifest. Own loopback PID и уникальный/tmpdir удалены; service install/config/DB/calls не менялись. [Официальный release](https://github.com/prometheus/node_exporter/releases/tag/v1.10.2), воспроизводимый live-exporter-check.cjs и live-exporter-report.json.

Уточнение audit evidence: unit fixture содержит 1000 каналов / 1000 логических звонков и 100 прямых вызовов collector.overview; реальная Nest HTTP wave измерена отдельно. 12.3ms — прогретый ReadStore cache, cold SQL summary31.6ms. Первоначальный exporter pending в историческом live-source-report.json закрыт более поздним live-exporter-report.json.

Финальная реальная dual-dialect проверка нашла и закрыла ONLY_FULL_GROUP_BY несовместимость: selected и grouped временные expressions теперь совпадают полностью. Строгий MySQL mode не отключался. Последующий MySQL8.4.11 и PostgreSQL17.11 прогон:12+12 groups PASS; disposable containers удалены. Нагрузочные PG14 timings выше измерены до этой алгебраически эквивалентной grouping-коррекции; входные/итоговые counts и интервалы подтверждены новым dual-dialect прогоном.

Дополнительная независимая budget-проверка закрыла случай8nodes×8filesystems×255CJKchars: полный metadata мог занимать59825B. Компактный overview сохраняет тот же worst-disk показатель без изменения полной детализации; actualparser/configvalid available/missing fixtures и immutable original samples проходят4suites/55tests, независимый rerun1suite/17tests PASS. Изменений поведения frontend для этого не потребовалось — основная карточка и ранее показывала worst disk.
