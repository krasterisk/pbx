# Автообзвон: журнал реализации

Дата: 2026-09-18. Разрешение на реализацию: «давай, реализуем план». Разрешение на использование сервера БД: «Используй рабочую базу - она тестовая».

## Граница результата

Выполнен первый вертикальный срез из раздела 10 плана: данные баз/контактов, импорт, HTTP-контракты и состояние соответствующих форм. Это не завершение R0-R6 и не разрешение включать изменённый dialer на реальных номерах. STATE/ROADMAP исторических фаз 17.x не закрываются.

Изменения не опубликованы и не применены к PBX. Миграции существующих данных не запускались. Тесты использовали соединение из локального `.env`, но только отдельные случайно именованные схемы `krsk_ac_test_<16 hex>`. Эти схемы удалены после тестов. Существующая схема приложения не изменялась; учётные данные не выводились.

## Реализовано

| Область / находки | Реализация | Проверка |
|---|---|---|
| A01, A05: список и detail | Общий `{items,total,page,page_size}`, отдельный scoped GET contact, `currentData`, запрет сохранения до загрузки | HTTP Nest + ValidationPipe, MySQL fixture с 61 контактом, RTL формы |
| A02: поля | Diff по UID, сохранение значений при rename label/reorder, проверка опасного удаления и смены типа | Service tests, реальная транзакция MySQL |
| A03: телефоны | Stable UID, сопоставление legacy по normalized, сохранение comment/external_id без пересоздания phones, защита ссылок задач | Service + MySQL, RTL payload |
| A04: валидация | Общий pure validator import/manual; required phone проверяется в phones; false/0/пустота различаются | Unit + MySQL required-phone fixture |
| A06: импорт | Дедупликация внутри файла и по существующей базе; пустая/ошибочная replace не очищает контакты; revision fence | Реальная MySQL, включая искусственную ошибку после удаления и rollback |
| A07: парсинг | Preview учитывает delimiter/has_header, XLSX без заголовка сохраняет первую строку, индекс колонки различает повторные headers | Parser tests + RTL wizard |
| Формы/запросы | Selection отдельно от edit target, draft не сбрасывается refetch, debounce поиска, page clamp, ошибки с retry, unwrap мутаций | Reducer + RTL; browser UAT ещё нужен |
| Импорт-профиль | Передача выбранного профиля/dedup и изменённого mapping, typed write input вместо `as never`, сохранение ввода при ошибке | RTL wizard |
| Переменные сценария | Отсутствующее phone field value выводится из набираемого номера; существующие legacy values имеют приоритет | Pure unit tests; звонковый lifecycle не менялся |
| Найденный DB-дефект | `AcImportRun.created_at` теперь устанавливается Sequelize; раньше реальная вставка отклонялась | Первый DB-прогон обнаружил ошибку, повторный прошёл |

Для writers баз/контактов/import введена блокировка строки базы в транзакции. Это ещё не общая защита от конкурентного создания campaign/tasks: эти writers входят в R2 и должны использовать согласованный протокол.

## Явные изменения поведения

1. Телефон/контакт, на который есть задачи или история, нельзя удалить либо незаметно заменить другим номером. Удаление/replace базы с campaign references также отклоняется. Правило консервативное, включая неактивные кампании; отдельный workflow миграции не реализован.
2. Несовместимая схема заполненной базы отклоняется. Изменение label/порядка и добавление необязательного поля разрешены. Некоторые изменения key/var блокируются при ссылках из кампаний/профилей. Утерянные старые UID не восстанавливаются догадками.
3. Replace требует ревизию preview и подтверждение; при нуле валидных строк, любой ошибочной/дублирующей строке или конфликте ревизии исходные данные сохраняются. Обычный append может импортировать валидные строки с отчётом остальных.
4. При phone-dedup совпадение любого номера строки исключает всю строку. Счётчики относятся к строкам, а не числу удалённых контактов.
5. Некорректные number/boolean/enum/date отклоняются вместо неявного преобразования. Неверный непустой дополнительный телефон или timezone offset отклоняют всю строку импорта, а не молча отбрасываются. Пустой комментарий и `external_id: null` действительно очищают значения.
6. `.xls` отклоняется до отправки; поддержаны CSV/TXT/XLSX, лимит файла 20 MiB. Телефонные данные хранятся в phones; для новых/пересохранённых контактов отсутствующая переменная phone берётся из текущего набираемого номера. Номер выбора/порядок обзвона этим не меняются.
7. Каждая мутация контактов увеличивает revision базы: устаревшее сохранение схемы может вернуть конфликт и потребовать перезагрузки.

## Проверки

- `npm run lint`: оба полных прогона exit 0, warnings, без ошибок. Scoped ESLint последних правок parser также exit 0.
- `npm run test:backend`: 239 suites / 2831 tests passed, 9 opt-in DB tests skipped штатно. После добавления phone-variable тестов профильный повтор: 12 suites / 134 tests passed, DB suite отдельно.
- `AUTODIAL_DB_INTEGRATION=1 npm run test -w @krasterisk/backend -- --runInBand --testPathPattern=autodial --no-coverage`: финальный повтор 13 suites / 145 tests passed, включая 9 real-MySQL tests. Временная схема финального прогона `krsk_ac_test_cf7cd27737bbebb7` удалена тестовым teardown.
- `npm run test -w @krasterisk/frontend -- src/features/autodial --maxWorkers=2`: 10 files / 75 tests passed, включая 6 tests формы контакта и 5 tests wizard.
- `npm run test:frontend`: первый запуск завис без результата и остановлен. Эквивалентный полный последовательный прогон `npm run test -w @krasterisk/frontend -- --maxWorkers=2 --no-file-parallelism --reporter=verbose`: exit 0, 242 files / 1379 tests passed, 1161.77 s. Новый wizard test file добавлен после старта discovery полного прогона и отдельно включён в зелёный профильный прогон 75 tests выше.
- `npm run build -w @krasterisk/shared`: passed.
- `npx tsc -p packages/backend/tsconfig.build.json --noEmit --incremental false`: passed.
- `npx tsc -p packages/frontend/tsconfig.json --noEmit --incremental false`: passed.
- `git diff --check` по затронутым модулям: passed (предупреждения CRLF не являются ошибками whitespace).

HTTP-тесты используют настоящий локальный HTTP server/ValidationPipe, но service stubs. DB-тесты вызывают настоящие service/models/MySQL. Полного end-to-end UI -> HTTP -> DB пока нет. Unit/RTL не доказывают отсутствие переполнений в браузере. Production typecheck отделён от полного backend tsconfig со spec-файлами, где обнаружены многочисленные существующие ошибки типизации тестов.

## Остаток и следующий этап

- R0: acceptance matrix всех D-01..D-20, read-only preflight старых данных, dialplan snapshots и PBX fixture ещё не завершены. A08-A24 остаются задачами следующих этапов, кроме локальных улучшений state/errors выше.
- R1: preview пока структурный (headers/sample), не полный dry-run с количеством пригодных строк; общий parser следует объединить. Полная проверка вложенных ссылок/profile DTO и конкурентных campaign/task writers ещё нужна. Нет browser UAT, performance baseline и автоматического ремонта старых данных. Нельзя объявлять все критерии R1 выполненными.
- Следующий R2a: атомарное сохранение campaign/schedules, revision/deploy status, запрет start при ошибке apply, tenant validation и capability matrix/compiler. Сначала тесты ошибок DB/deploy и несовместимых сценариев.
- Затем R2b/R2c: ARI correlation/answer/finalize, stop/drain, lease fencing/recovery, last-mile DNC и capacity. Дефекты runtime из анализа пока остаются. Нужен согласованный тестовый PBX/внутренние номера до реальных вызовов.
- R3: целевые компоненты/хуки, responsive layout, InfoTooltip, русские подписи, timezone picker, DNC boundary и запрет длинного тире ещё не реализованы.
- R4/R5: versioned per-trunk CallerID/carousel и настоящее AMD message ещё не реализованы.
- R6: полный regression/live acceptance и измерения производительности не проведены.

Существовавшие до этой задачи изменения других модулей не откатывались. Автоматических commit/deploy нет.

## Продолжение: проверка PBX и частичное R2 (2026-09-18)

Пользователь указал SSH-доступ к тестовой PBX. В соседней задаче обнаружен путь к ключу `C:\Users\Professional\.ssh\krasterisk_ipbx_agent`; подключение прошло. Read-only ответы: `Asterisk certified-22.8-cert2`, 12 модулей ARI загружены, ARI включён, на момент проверки 0 активных каналов и вызовов. `module show like app_amd` вернул 0, а `core show application AMD` подтвердил, что `AMD()` не зарегистрировано. Для кампании с включённым AMD это несовместимая runtime-конфигурация. Нужно проверить наличие бинарного модуля и предусмотреть preflight/start gate; автоматическая загрузка модуля и изменение PBX пока не выполнялись. На сервере не выполнялись запись конфигурации, перезагрузка dialplan и исходящие вызовы.

В коде:

- Каждый capacity provider теперь отдаёт свободные новые слоты. Static вычитает текущие вызовы и резервы; trunk получает уже свободную ёмкость из occupancy без повторного вычитания; tenant cap считает каналы и резервы всех кампаний организации. Monitor получает соответствующий суммарный текущий потолок.
- Для ограниченного транка при недостоверном AMI snapshot новые слоты закрыты; текущая локальная активность учитывается поверх снимка. Это намеренное fail-closed изменение до восстановления occupancy.
- Старый lease возвращается в очередь только в статусе `leased`; статус `dialing` и вызов в работе не переводятся автоматически обратно в `pending` по таймеру. Stop переводит только `leased`, активный набор завершается обычным жизненным циклом.
- Ошибка AMI apply теперь возвращается из dialplan service; `start` и `resume` не ставят `running`, а UI показывает локализованный код. `create`/`update` по-прежнему сохраняют DB-конфигурацию отдельно от apply: полноценный status/appliedRevision и атомарность остаются R2a.
- Перед стартом/возобновлением AMD-кампании проверяется загруженный `app_amd.so` через AMI. При отсутствии модуля кампания не запускается и получает `AC_AMD_UNAVAILABLE`. Для `on_machine=voicemail` запуск блокируется кодом `AC_AMD_MESSAGE_NOT_CONFIGURED`, поскольку фактической записи/ветки Playback ещё нет. Существующие конфигурации читаются и редактируются; в селекторе этот недоступный вариант виден, но его больше нельзя выбрать для новой конфигурации. В UI пояснено, что AMD использует штатное приложение Asterisk; русская вкладка «Пейсинг» переименована в «Темп набора».

Новые проверки: capacity с tenant10/active4 => 6, trunkFree6/active4 => 6, межкампанийные резервы, stale occupancy, sweep/stop и ошибка AMI apply; локализованная ошибка в окне запуска. После AMD gate профильный backend-прогон: 14 suites / 149 tests passed, opt-in DB suite пропущен (его предыдущие 9 тестов прошли отдельно). Профильный frontend-прогон: 11 files / 76 tests passed. Полный backend-прогон до последнего AMD gate: 243 suites / 2850 tests passed (9 opt-in DB skipped); `npm run lint`: exit 0, предупреждения без ошибок. Production backend/frontend typecheck: exit 0. Полный frontend-прогон 242 files / 1379 tests проводился до этого частичного R2; после изменений повторён профильный прогон автообзвона, а не все frontend-файлы.

Ограничения: пока нет общего резервирования на несколько инстансов backend, учёта одного оператора в двух очередях и достоверной разницы между ожидающим оператора и говорящим вызовом. Нет heartbeat/fencing для перезапуска уже начатой попытки, согласованной eligibility/DNC перед набором, атомарной кампании с расписанием, capability matrix для сценария, AMD voicemail и новой trunk/CID policy. Код этого этапа не развёрнут и не проверен реальным вызовом. Для такого теста нужно выбрать безопасные внутренние номера/endpoint без влияния на абонентов.

## Продолжение: R2a и R3, конфигурация кампании (2026-09-18)

Выполнены два связанных среза. Они не закрывают весь рефакторинг R2-R6 и не меняют PBX.

### Атомарность и конфликт редактирования

- Создание кампании вместе с расписанием выполняется в одной транзакции. В случае ошибки расписания запись кампании не остаётся частично созданной.
- Обновление кампании и замена её расписания блокируют строку кампании `FOR UPDATE` и используют одну транзакцию.
- API обновления требует `expected_revision`. Модальное окно передаёт текущую ревизию. При параллельном сохранении сервер отвечает `AC_CAMPAIGN_REVISION_CONFLICT`, а пользователь сохраняет свой открытый черновик и получает понятное сообщение вместо тихого last-write-wins.
- Внутренние API-типы кампании заменили нестрогие словари для create/update. Это намеренно делает внешний старый клиент без `expected_revision` несовместимым: он получит validation error, пока не перейдёт на новый контракт.

### Расписание и форма

- Часовой пояс выбирается из IANA-справочника, с поиском, отображением идентификатора и текущего UTC offset. Сохранён legacy-вариант для уже записанной зоны, которой нет в справочнике браузера.
- Сервер валидирует IANA timezone и больше не подменяет некорректную зону значением по умолчанию.
- **Изменение поведения:** пустое расписание по-прежнему означает отсутствие ограничения. Но если расписание есть и все его окна отключены, кампания теперь закрыта для новых вызовов. Прежняя реализация трактовала это как открытое расписание, что небезопасно. В форме появляется предупреждение.
- В общих настройках, темпе набора, повторах, транках, стоп-листе и расписании сокращены подписи, непонятные детали перенесены в InfoTooltip. Уточнено, что очереди операторов задают доступную ёмкость, а направление в очередь остаётся действием сценария. Значение `0` для retry сохраняется как явная настройка, а не исчезает как пустое.
- Черновик кампании не перезаписывается фоновым refetch во время открытой сессии редактирования.

### Проверки этого среза

- `npm run test -w @krasterisk/backend -- --runInBand --testPathPattern=autodial --no-coverage`: 16 suites, 153 tests passed; 1 opt-in suite skipped штатно.
- `npm run test -w @krasterisk/frontend -- src/features/autodial --maxWorkers=2`: 13 files, 80 tests passed.
- `npx tsc -p packages/backend/tsconfig.build.json --noEmit --incremental false`: passed.
- `npx tsc -p packages/frontend/tsconfig.json --noEmit --incremental false`: passed.
- Scoped ESLint по backend-модулю и затронутым frontend-файлам: 0 errors. Во frontend-модуле остаются 2 прежних warnings `react-hooks/exhaustive-deps` в `CampaignsTable` и `ReportsView`; они не относятся к этому срезу.
- `git diff --check` по затронутым путям: passed; выводит только предупреждения Git о CRLF, а не whitespace errors.

Не запускались миграции, deploy, reload dialplan, конфигурационные записи на PBX и реальные вызовы. Следующими остаются R2b/R2c (DNC last-mile, fencing/recovery, корреляция ARI), затем версия trunk/CID policy и реальный AMD voicemail workflow с безопасным PBX acceptance.

## Продолжение: runtime, per-trunk Caller ID и границы DNC (2026-09-18)

### Реализовано

- Перед originate повторно проверяются DNC и нормализованные legacy-варианты номера. В ARI зарегистрирована correlation до create; `StasisStart` не считается ответом, а handoff выполняется только на `Up` и не дублируется.
- Выбор транка получает exact eligible set от pacer. Ограниченный trunk с устаревшим occupancy snapshot не выбирается; unlimited trunk остаётся допустимым.
- У каждого trunk теперь свой источник Caller ID: статический номер, pool `round_robin`/детерминированное распределение либо lookup справочника по явному полю контакта. Directory, field и base key валидируются tenant-scoped на save/start; при miss/failure используется явно заданный fallback, затем PBX default. Старые campaign-wide `cid_policy` остаются readable и не переписываются простым открытием формы.
- Первоначально Caller ID передавался через `CALLERID(num)` в `/channels/create`; live SIP loopback показал, что это оставляет `From: Anonymous`. Исправленный путь использует `/channels` originate с query-параметром `callerId` и сохраняет остальные channel variables в JSON body. Этот параметр поддерживается `/channels`, но не `/channels/create`.
- Для AMD `hangup` machine branch синхронно отмечает attempt перед `Hangup`; финализатор сохраняет `amd_machine` даже если ARI получает обычный answered outcome. AMD start gate требует загруженный `app_amd`. "Оставить сообщение" всё ещё корректно заблокировано: нет согласованного media source и playback branch.
- В кампании глобальные и базовые DNC видны как inherited read-only. Удалять можно только campaign-local запись; добавление/удаление global записи требует отдельного подтверждения в явной области управления.
- В UI per-trunk CID заменил общий редактор policy: адаптивная grid-вёрстка, IANA timezone selector, InfoTooltip для терминов и отсутствие U+2014 в пользовательских строках auto-dial scope. Сценарий остаётся источником направления в очередь; `queue_names` служит пулом доступной operator capacity и legacy fallback для bare `toqueue`.

### Явные изменения поведения

1. Наличие disabled schedule rows теперь закрывает новые вызовы, если включённых окон нет. Пустой список расписаний по-прежнему означает отсутствие ограничения.
2. Сохранение/старт отклоняет неподдержанный scenario action, condition или dynamic target вместо генерации silent NoOp.
3. При AMD machine + `hangup` задача получает `amd_machine`; ранее гонка могла записать обычный answered result.
4. Кампания больше не даёт удалить inherited DNC широкой области. Общая запись меняется только через подтверждённое действие.

### Проверки этого среза

- Targeted backend с MySQL: 21 suites / 186 tests passed; isolated schema removed by teardown.
- Targeted frontend: 14 files / 82 tests passed. Добавлены проверки per-trunk caller ID, inherited DNC boundary и AMD machine finalization.
- `npm run lint`: exit 0, warnings only.
- `npm run test:backend`: 249 suites / 2881 tests passed, 9 opt-in DB tests skipped.
- `npm run test:frontend`: 247 files / 1391 tests passed; один внешний failure `ConferenceRoomFormModal.test.tsx` ожидает устаревшие одинарные кавычки в locale source и не касается auto-dial.
- Production backend/frontend typecheck, shared build, scoped ESLint и `git diff --check`: passed.

### Не закрыто без отдельной авторизации

Реальный PBX/SIP acceptance не выполнялся. Test PBX доступна только как read-only preflight и не имеет `app_amd`; я не загружал модуль, не изменял dialplan, не делал reload и не инициировал вызовы. Нужны безопасные internal endpoints и отдельное разрешение на PBX write/reload. До этого не могут быть закрыты SIP CallerID capture, ARI event permutations, AMD quality/media voicemail, browser geometry, durable multi-worker fencing/restart recovery и load measurements.

## Продолжение: live gates и безопасность ссылок (2026-09-18)

Исторический раздел выше описывает ограничения на момент того среза. Позже пользователь разрешил работу на тестовой PBX, подтвердил любые тестовые номера и сообщил об установке `app_amd.so`. Актуальные результаты находятся в [external gates](AUTODIAL-REFACTOR-EXTERNAL-GATES-2026-09-18.md) и [acceptance matrix](AUTODIAL-REFACTOR-ACCEPTANCE-MATRIX-2026-09-18.md).

- Isolated SIP loopback выявил, что `CALLERID(num)` в ARI `/channels/create` не передавался в SIP `From`. Переход на `/channels` originate с query `callerId` подтвердил два разных номера в `From`, PAI, RPID и входящем `CallerIDNum`.
- Отдельная versioned DB fixture провела campaign → task → ARI failure → terminal attempt. Это не является успешной проверкой campaign → SIP → answer. Fixture DB и созданный ею dialplan удалены, на PBX 0 активных каналов.
- `AutodialBasesService.remove` теперь удаляет дочерние данные внутри транзакции до базы. Иначе versioned schema с FK `NO ACTION` давала HTTP 500 даже при удалении неиспользуемой базы. Это подтверждено DB integration test и повторным HTTP cleanup.
- READY-оператор, входящий в две очереди кампании, считается один раз при расчёте ёмкости. Tenant ownership проверяется для транков, очередей и фиксированных PJSIP extension targets перед сохранением и запуском.
- Выключенный шаг `toqueue` больше не считается исполняемым при проверке сценария. Это снимает ложный запрет agentless/черновика, не включая выключенный маршрут.
- Playback в autodial теперь использует общий renderer, который ограничивает медиа каталогом `/usr/records/<tenant>/sounds` (кроме зарезервированного `beep`). **Изменение поведения:** старые autodial-сценарии, указывавшие произвольное глобальное имя Asterisk sound, могут потребовать загрузить этот файл в каталог организации. Это защищает от межорганизационного доступа и выравнивает playback с общим редактором маршрутов; перед rollout нужен аудит сохранённых playback paths.
- Read-only DB preflight теперь показывает агрегатные active/open/orphan counts, до 20 UID задач с потерянным phone reference и UID расписаний с неверной зоной, не выводя контакты или секреты. Исходная тестовая БД после cleanup: кампаний, активных задач, открытых/orphan attempts и найденных invalid zones нет.
- Подтверждённый `Up` теперь сохраняет `answered_at` в ещё открытой попытке. После потери локальной Map в результате restart событие `ChannelDestroyed` ищет её по долговечному `channel_id` и финализирует с сохранённым временем ответа. Это узкое восстановление финального события, не полноценный multi-worker handoff/lease fencing. Новые targeted tests покрывают обе стороны.
- Удаление остановленной кампании теперь блокируется, пока остаются leased/dialing задачи, чтобы живой вызов не потерял сценарий и родительскую запись. Новые ошибки чужого/недоступного транка, очереди, внутреннего номера и активного вызова локализованы на ru/en; неизвестные server messages по-прежнему не показываются пользователю.
- Диалог удаления кампании больше не закрывается до ответа API. При ошибке он остаётся открыт и показывает локализованную причину; после успеха закрывается. Текст подтверждения исправлен: существующий hard delete удаляет задачи, но не записи `ac_attempts`, поэтому прежнее обещание удалить историю было неверным. Два UI-теста проверяют обе ветки.

Проверки после этих изменений: полный backend suite 250 passed suites / 2892 passed tests, 11 skipped; targeted attempt/originator suite: 2 suites / 10 tests passed; DB integration: 11 tests passed с удалением отдельной тестовой схемы. Targeted campaign config: 11 tests; dialplan util: 22 tests. Профильный frontend suite: 17 files / 87 tests passed. `npm run lint` без errors; scoped ESLint для нового кода и backend build прошли, `dist/database/database-config.cjs` присутствует. Полный frontend suite снова воспроизвёл unrelated conference locale failure и завис, поэтому не объявлен зелёным.

## Закрытие модуля 2026-09-21

Пользователь запросил реализовать и закрыть план. Исходный PLAN-файл не редактировался. Кампания uid 1 не запускалась. GSD STATE/ROADMAP фазы 17 не обновлялись.

Добавлено в код этого close: campaign `pacer_owner` CAS, `ac_channel_reservations`, `apply_error`, adapter `renderActionChain` и TTS CURL, технические failover legs, DNC `gate` в claim tx, bulk-delete баз.

Live: isolated Local AMD voicemail на ipbx — `AMD=MACHINE/MAXWORDS-3-2`, `TRYSTATUS=SUCCESS`, `Playback(beep)`; контекст удалён, 0 каналов. Browser: 1920 7 вкладок без overflow документа; Playwright CDP pageScale 200% ru/en 2 passed (open-then-scale). Import-preview 1k = 154 ms; 10k = HTTP 413.

Профильные тесты close: backend autodial 230 passed; frontend autodial 18 files / 96 passed; scoped ESLint autodial 0 errors (1 прежний warning ReportsView).

Артефакты: [SUMMARY](AUTODIAL-REFACTOR-SUMMARY-2026-09-21.md), [VERIFICATION](AUTODIAL-REFACTOR-VERIFICATION-2026-09-21.md), [ADR](AUTODIAL-REFACTOR-ADR-B01-B13-2026-09-21.md). Модуль закрыт как implemented-in-scope, не released.

