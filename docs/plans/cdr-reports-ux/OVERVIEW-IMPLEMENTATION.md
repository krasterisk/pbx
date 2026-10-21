# CDR v1.2 — завершение маршрута/поиска и первый обзор

2026-10-18, тот же coordinator /root, codex-direct, PLAN v1.2 §12.9 slice4 (D1/D2 first slice), остатки B4/C1. HEAD10308472; весь исходный dirty baseline смежных модулей сохранён, без commit/reset/stash/deploy и субагентов.

## Реализовано

- Перевод подтверждается CEL-разговором до следующего перевода по порядку событий. Одинаковая метка времени двух переводов больше не позволяет подтвердить первый последующим разговором после второго. Не утверждается восстановление Local/fork/join/attended/conference.
- Числовой поиск охватывает промежуточных сотрудников и номера компании из call_dimensions. ФИО/отделы ищутся по нормализованным search_label; целый логический звонок сохраняется. Для длинных телефонных номеров совпадение по последним10 цифрам; короткие внутренние номера не обрезаются. Нормализация8→7 сохранена.
- GET /reports/calls/overview: текущая и предыдущая выборка равной абсолютной длительности, итоговые исходы и не более90 равных временных интервалов; период до366 дней. Все исходы, суммы и предыдущий интервал получены в одной repeatable-read транзакции, без чтения CDR payload на каждый звонок. Общий callsWhere сохраняет tenant/participant ACL и все фильтры, cursor игнорируется для агрегатов. Обе СУБД; явное десятичное деление и отделённые пробелами SQL placeholders.
- Обзор внутри текущего журнала:8 исходов (активные добавляются при наличии), абсолютные изменения относительно предыдущего интервала, нагрузка с визуальной шкалой, переход к точному полуоткрытому интервалу. Фильтры остаются над обзором. URL view=overview сохраняет состояние; ссылки интервалов сохраняют search и выбранные группы. Доступно обновление обзора. Unknown и неполнота показаны явно; бизнес-результат не подменён ответом человека/робота. В UI нет внутренних revision/channel/context.
- Нет новых библиотек, migration или зависимости от лицензии КЦ. Контракт CallsOverview у текущего CDR coordinator. Новое API использует существующие JWT/module/page/participant grants.

## Evidence и границы

Использованы прежние настоящие9CDR/111CEL восьми SIP-сценариев собственной изолированной АТС на192.168.2.201, LIVE-LAN-CDR.json. Телефонные факты не изменялись; identities/ФИО/отделы тестового кабинета — configuration fixtures. Приложение проверяется локально, это не rollout на рабочую БД стенда.

- MySQL8.4.11/PostgreSQL17.11: VERIFICATION-FACETS-LAN.json, overview-sql-lan-final.log — совпадение overview/list, сумма buckets, предыдущий интервал, промежуточный101 и Unicode АННА; tenant/scoped/CSV/replay/FK проверки сохранены. Cleanup собственных SQL кластеров PASS.
- HTTP: OVERVIEW-HTTP.json, overview-http.log. Actual Nest/JWT/module guard/SQL ACL: admin7, scoped1016, другой tenant1; overview=list, numeric101/name6, search102overview2, unauth401, неограниченный период400, analytics без grant403.
- Browser: actual текущие React/Nest/API/SQL с импортом LAN. Поиск102→2, обзор2/человек2/остальные0, предыдущий час0. Ссылка интервала открыта навигацией по href, точные from/to и search102 сохранились, журнал2. Desktop1280 и mobile390/320: overflow отсутствует (documentWidth1274/384/314 при innerWidth1280/390/320). overview-desktop.png, overview-mobile.png, overview-mobile-320.png; OVERVIEW-BROWSER.json (partial).
- Ограничение browser evidence: click/Enter/Space/AX secondary actions текущей IAB сессии не меняли состояние ни существующих, ни новых кнопок/ссылок. Поэтому ручная активация мышью/клавиатурой PENDING; прямые URL и отображение проверены, React interaction tests отдельно. В ходе HMR при последовательной смене prop был transient periodHref error; после согласования props выполнена полная перезагрузка, полная финальная перезагрузка2026-10-18T07:23:26.646Z: новых console errors0. Не называть этот gate полным интерактивным UAT.

## Gates / handoff

- Full backend final: PASS466 suites /4460 tests,27 skipped (overview-backend-final.log). Первый запуск поймал прежнее ожидание полного11-значного телефона; ожидание приведено к требованию последних10, targeted и полный повтор PASS.
- Full lint: PASS0errors, прежние123/101warnings (overview-lint.log). Последующие точечные lint/types — отдельные final logs.
- Targeted backend: PASS2suites/16tests, SQL replacement lexer обеих СУБД, same-timestamp transfer, ACL/range/cohort (overview-targeted-backend.log).
- Targeted frontend final: PASS3files/11tests (overview-targeted-frontend-final-pass.log), включая ссылки/сохранение фильтров/ошибки. Backend/frontend types и scoped ESLint PASS exit0 (overview-backend-types-final.log, overview-frontend-types-accepted.log, overview-scoped-lint-final.log). Full frontend PASS429files/2357tests,11chunks,exit0 (overview-frontend.log). Runner перечислил429 файлов до создания CallsOverview.test.tsx; новый файл включён в targeted final. Последнее уточнение предупреждения о неполной проекции проверено targeted, types и scoped lint, полный runner не перезапускался для одного текста.
- SQL ранние отрицательные прогоны обнаружили пустой старый snapshot в harness и lexer placeholders; исправлены. Финальный SQL/HTTP положительный результат отдельно от unit.

Следующее действие PLAN: D1 cache/load и календарные срезы (текущие интервалы равны по elapsed time, не локальные дни DST); D2 отделы/сотрудники/DID, D3 правила внимания и достоверный callback matcher; E1 структурные инструменты iaChat после согласования reports-ai adapter. Ни D1/D2 целиком, ни D3/E1, ни полный milestone не закрыты. Production archive/backfill/load/pilot/release и granular media permissions pending. Z5/расшифровки/semantic search у speech-analytics; robots/autodial runtime не присвоен.

Housekeeping из предыдущего назначения: собственный старый mysqld PID271788 с datadir krasterisk-cdr49-mysql-BWCxkB остаётся pending. Предыдущее принудительное завершение/удаление было отклонено automatic approval review: blocked by policy, без конкретизации. Повтор обходным способом не выполнялся; потерянный случайный пароль не восстанавливался. Нельзя заявлять полную очистку всех предыдущих локальных ресурсов. Текущие SQL matrix и browser API/SQL остановлены штатно,3512 не слушает. После cleanup обнаружены5 idle Node harness процессов, без слушающих портов: проверены точные PID/командные строки и завершены; собственных browser-runtime Node не осталось. Исправлен exit в helper после штатного close для следующих запусков; исправленный lifecycle сам ещё не перепроверен отдельным новым стартом. Browser viewport reset, собственная вкладка закрыта.

Согласование: Autodial подтвердил отсутствие записи в reports-ai/router/CDR scope, затем освобождение своего sv-autodial namespace,3181/15013, контейнеров/сети/каталога на LAN. Их и прочие рабочие БД не изменялись.

Финальные scoped UI lint0errors и backend/frontend typechecks exit0. Исправление предупреждения не выводит служебные historyStale/historyBackfillInProgress keys: переиспользованы локализованные sourcePartial/sourceUnavailable, regression в CallsOverview.test.tsx. Общий FSD/router/AI/SA/robot runtime baseline сохранён.
