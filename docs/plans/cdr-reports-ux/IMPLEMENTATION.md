# CDR v1.2 — первый вертикальный срез

Дата: 2026-10-18. Coordinator/исполнитель: `/root`, chat `01a14cff-e054-7ba0-931d-95fd94bfb3e8`, `codex-direct`.
Единственный план: [PLAN v1.2](PLAN.md), §12. Назначение и baseline: [EXECUTION](EXECUTION.md).

Статус первого среза: **implemented, automated-tests-passed**. Полные gates приведены ниже. Не `live-verified` на АТС и не `released`; фазы A/B целиком не закрыты.

## Что реализовано

| Область плана | Реализованный срез | Оставшаяся работа |
|---|---|---|
| A1/A2 | Shared calls-контракт; общий классификатор с совместимым dashboard facade; semantics v4/replay; legacy SIP endpoint; независимые обработчики/результат; unknown сохраняется; номер Caller ID не предоставляет employee ACL | Полный golden-корпус на исторических звонках; CDR-only политика завершения; международная нормализация из настроек организации |
| A3/A4 | `call_facts` расширяет существующий `dashboard_calls`; факты, ACL, buckets и revision записываются в одной транзакции; обогащение CDR/CEL, voicemail, voiceRobot, AI sessions, SA relations/runs; поздние сообщения и изменения SA run инициируют пересчёт | Перезвоны/call_links, конференции, кампании, исторические снимки справочников, оценки/тональность и last-attempt status; Z5 остаётся за speech-analytics |
| A5/A6 | Возобновляемая загрузка всей CDR-истории; старый 31-дневный checkpoint перезапускается один раз; source state/dataAsOf; имена/отделы сотрудников и очередей; технические каналы исключены из business API | Числовой прогресс; богатые справочники клиентов/DID/транков/маршрутов; инвалидация имён и исторические snapshots |
| A7 | Общее основание классификации и атомарная проекция; unit-сценарии метрик/пересечений/доступа | Живая сверка dashboard/journal/CSV на одном snapshot и реальные p95; AI tools пока используют старый CDR adapter |
| B1/B2 | Новый журнал по `/reports/calls`, прямой `/:callId`, `/reports/cdr` перенаправляет с сохранением query/hash; `/reports` ведёт в журнал; matchPaths сохраняет существующий CDR page grant для новых URL; API list+summary в одном snapshot, detail, audited recording, потоковый CSV без лимита 10000; ACL по целому звонку | Перенос robot journal/грантов его владельцем, остальные legacy links, facets, trace/admin и XLSX; отдельные granular permissions F2 |
| B3/B5 | Одна строка поиска по номерам/именам; даты организации; направление/результат/обработчик/сотрудник/номер компании/отдел; chips и URL-state; keyset pagination; desktop table/mobile cards | Facets/select справочников, сохранённые подборки/колонки и сортировки, expanded operational filters |
| B6/B7 | Карточка с участниками, временем, понятной последовательностью и переводами CEL; неполнота видима; CDR-время этапа помечено ≈; записи с проверкой файла и скоростью; статус/переход в аналитику и голосовая почта | Полный graph fork/join/park/pickup/consultation; синхронная расшифровка/таймкоды; собственный voicemail viewer внутри карточки |
| F2/F3 (основа) | Существующие tenant/page/participant ACL; отсутствие аналитики без её страницы; аудит view/play/export через ActionLog без Telegram; защита CSV от формул | Раздельные права записи/скачивания/расшифровки, retention/masking, live privacy gate перед публикацией |

Текстовый/семантический поиск по разговорам, новые iaChat tools и управленческий обзор не входят в этот срез. Поиск сейчас работает по метаданным звонка. Результат успешного разговора не выдаётся за решение вопроса клиента.

## Достоверность времени и результатов

- Звонок имеет устойчивый ключ tenant + node + linkedid; при пустом linkedid используется uniqueid. Ноги не становятся отдельными обращениями.
- Общая длительность — от начала исходной ноги до максимального конца, без суммы длительности ног.
- Разговор с сотрудником — объединение подтверждённых customer/employee bridge-интервалов CEL. Внутренние консультации без клиента не включаются. Незакрытый bridge не превращается в известную длительность.
- CDR fallback времени используется только при отсутствии признаков IVR/технического Answer/робота/voicemail. Смешанный billsec остаётся неизвестным. Среднее содержит размер выборки известных значений.
- Оценочные соединение и ожидание CDR помечены ≈; сводка возвращает `estimatedConnectedSample` и показывает число оценок. CSV содержит явную точность времени. Оценка ожидания не выдаётся за точное время ответа.
- Menu, сохранённое voicemail, робот, человек и неизвестный исход различаются. Вход в VoiceMail без сохранённого сообщения не создаёт признак сообщения. Подтверждение работы AI требует playback proof из общего классификатора.
- Default журнал исключает текущие звонки так же, как историческая сводка dashboard. Параметры точного периода и aggregate outcome из dashboard сохраняются. Неподдержанные старые state/trunk/bucket отмечаются предупреждением.
- Страница, сводка и CSV используют один предикат tenant/ACL/фильтров. Сводка и страница читаются в одном repeatable-read snapshot; CSV имеет собственный согласованный snapshot.
- Текущий projector всегда оставляет `historyComplete=false`: наличие моста и LINKEDID_END ещё не доказывает полноту сложного маршрута. Пользователь видит подтверждённые этапы и предупреждение о возможной неполноте до отдельной приёмки graph reconstruction.

## Схема и запуск на стенде

Владелец миграции **0049** в этом назначении — `/root`: `database/migrations/0049-call-facts.sql`, PostgreSQL-вариант и только их full-pbx manifest entries. Standalone analytics/robot/community profiles не расширялись.

Миграция **проверена на временных MySQL 8.4.11 и PostgreSQL 17.11** (upgrade с 0048, сохранность данных, replay/no-op, FK/rollback PASS). Дополнительно 8 настоящих SIP-сценариев на изолированной АТС 192.168.2.201: CDR/CEL → проекция → SQL/API обеих СУБД PASS. [Подробное evidence и ограничения](VERIFICATION-0049.md). Production schema не менялась. Новый business API требует 0049 и запущенного background projector; до этого возвращает недоступность истории. После применения схемы процесс приложения нужно перезапустить, поскольку установленный набор таблиц кэшируется проектором на запуске.

Порядок следующей проверки: disposable MySQL и PostgreSQL → штатный migration runner с full-pbx профилем → старт приложения → дождаться source `ok` и завершения backfill → сопоставить одни и те же звонки/метрики/ACL в dashboard/journal/CSV → запись/voicemail/переводы на реальной АТС. Большая история требует замера нагрузки и времени backfill до rollout.

## Evidence

| Gate | Статус / результат |
|---|---|
| `npm run lint` | PASS, 0 errors; существующие warnings 123 backend / 101 frontend; итоговый `implementation-lint-acceptance.log` |
| Shared build / backend production typecheck / frontend typecheck | PASS; `implementation-shared-latest.log`, `implementation-acceptance-backend-types.log`, `implementation-router-frontend-types.log` |
| `npm run test:backend` | PASS: 462 suites, 4439 tests; 1 suite/27 tests skipped; `implementation-backend.log`. Последующие локальные правки дополнительно проверены targeted runs |
| Targeted core/API/dashboard/legacy tools | PASS: итоговые 8 suites / 130 tests; `implementation-acceptance-backend.log`; включает ACL regression, artifacts и atomic store |
| Targeted frontend calls/CDR page | PASS: 3 files / 15 tests; `implementation-acceptance-frontend.log`; navigation/module license дополнительно 3 files / 29 tests (`implementation-navigation.log`) |
| `npm run test:frontend` | PASS: 425 files / 2345 tests, все 11 пакетов, exit 0; `implementation-frontend.log` |
| Migration runner manifest/profile tests | PASS: 20/20; реальные MySQL/PostgreSQL также PASS, [evidence](VERIFICATION-0049.md) |
| Browser | Реальные React-компоненты с локальными synthetic fixtures: desktop, mobile 390 и 320; открытие/закрытие карточки с сохранением URL; светлая/тёмная тема; на 320 document scrollWidth=clientWidth=320. Это UI fixture evidence, не DB/live verification |
| Независимый review | pending, другой исполнитель не назначался |
| DB/live/load/release | SQL обеих СУБД и изолированная реальная SIP телефония PASS; production archive/backfill/load/release pending, [evidence](VERIFICATION-0049.md) |

Fixture preview воспроизводится командой `node .planning/cdr-reports-ux/preview/server.mjs` (localhost:3511), без доступа к АТС/БД/авторизации. Она не является backend integration test.
Скриншоты: [журнал](../../../.planning/cdr-reports-ux/preview/journal-desktop.png), [карточка](../../../.planning/cdr-reports-ux/preview/card-desktop.png). Временный процесс preview остановлен, viewport сброшен, созданная вкладка закрыта.

## Handoff / следующее действие

Смежные dirty изменения и Z1–Z4 сохранены. Общие router/locales/module manifest дополнены точечно; AI studio runtime, Z5/hangup relations, autodial и CC не изменялись. Не выполнять `reset`, общий `stash` или общий commit по этому dirty tree.

1. Disposable migration/API/projection gate и live reconciliation восьми реальных SIP-сценариев выполнены: [VERIFICATION-0049](VERIFICATION-0049.md). A/B не приняты целиком; production archive/backfill/load, live media/robots/SA и HTTP/browser gates остаются открытыми. Полные repo checks и targeted проверки последующих исправлений приведены в evidence.
2. Справочники, facets/мультифильтры и business route реализованы следующим назначением: [FACETS-IMPLEMENTATION](FACETS-IMPLEMENTATION.md), SQL/HTTP/browser PASS на импортированных реальных LAN данных. Далее граф с полным fork/join/transfer provenance и granular media permissions. Подключение transcript/search — после Z5 владельца speech-analytics и проверки реальных relations.
