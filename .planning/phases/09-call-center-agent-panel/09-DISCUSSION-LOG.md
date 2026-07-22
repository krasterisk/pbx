# Phase 9: Call Center Agent Panel — softphone widget & professional call control - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-22
**Phase:** 9-call-center-agent-panel
**Areas discussed:** Layout/вкладки, Кастомизация, KPI, Статусы, Умные пропущенные, ChanSpy, Права управления, Call-control, Вкладка Очереди, История вызовов, Справочник для перевода, Уведомления, Модель прав, i18n/perf/mobile

---

## Layout / вкладки

| Option | Description | Selected |
|--------|-------------|----------|
| Floating FAB | Плавающий виджет внизу справа (dialpad on expand) | ✓ |
| Status-bar dock | Встроен в статус-бар (popover dialpad) | |
| Sidebar card | Компактная карточка в боковой колонке | |

**User's choice:** Floating FAB + индивидуальная настройка показа/размещения софтфона на оператора.
**Notes:** Окно входящего — slide-in toast; кнопки управления в статус-баре + полный набор в окне/виджете.

## Кастомизация интерфейса

| Option | Description | Selected |
|--------|-------------|----------|
| Tabs+toggle | Вкладки + вкл/выкл каждую | |
| Panels dashboard | Настраиваемые панели | |
| Hybrid | Панели на широком / вкладки на узком + тоглы | ✓ |

**User's choice:** Hybrid; конфиг = role default + per-operator override; глубина MVP = видимость + размещение софтфона; настраивают и админ, и оператор (оба места).
**Notes:** Уточнил, что это вкладки, но с максимальной настраиваемостью (вкл/выкл вкладок/карточек).

## KPI принял/пропустил

| Option | Description | Selected |
|--------|-------------|----------|
| AMI extend | Расширить AMI на каналы оператора | ✓ |
| Hybrid CDR | Live + сверка с CDR | |
| CDR only | Только CDR | |

**User's choice:** AMI extend + требование исторического детального журнала действий оператора.
**Notes:** missed = персональный(−) + отдельный queue-missed раздел; сброс = смена+день; исходящие = отдельные счётчики (принято/совершено/пропущено).

## Статусы оператора

| Option | Description | Selected |
|--------|-------------|----------|
| Rename only | READY→«Ожидание звонка» | |
| +DIALING/CONSULT | Доп. статусы | |
| Full set | +DIALING, CONSULT, ACW отдельно | ✓ |

**User's choice:** Full set; live-таймер + накопление; авто-паузы RONA + гибкие правила.
**Notes:** Индикатор разговора максимально информативный (очередь/тип/номер/имя). Авто-пауза настраивается по кол-ву пропущенных / времени бездействия / длительности статуса.

## Умные пропущенные

| Option | Description | Selected |
|--------|-------------|----------|
| By number | Группа по номеру + счётчик попыток | ✓ |
| Flat | Плоский список | |

**User's choice:** By number; авто-закрытие при дозвоне клиента + пометка; callback-flow (>5с = успех, иначе попытка); ownership hybrid (персональные=мои, queue=claim); scope = queue-abandoned + персональные, in-queue ring-no-answer исключён.
**Notes:** Для внутренних абонентов подставлять имя. Callback: PJSIP originate-to-operator, WebRTC direct.

## ChanSpy / прослушка

| Option | Description | Selected |
|--------|-------------|----------|
| Target allows | Флаг на цели | |
| Listener can | Флаг на слушающем | |
| Both flags | can_spy + spyable | ✓ |

**User's choice:** Both flags; режимы granular по праву; peer↔peer в общих очередях; listen тихо + аудит.

## Права управления чужими звонками

| Option | Description | Selected |
|--------|-------------|----------|
| Tenant all | Весь tenant | |
| Assigned queues | Назначенные очереди | ✓ |
| Assigned operators | Явная связь | |

**User's choice:** Assigned queues; управление чужими — supervisor-only; оператор — свои + pickup + сброс zombie-звонка.

## Call-control set

| Option | Description | Selected |
|--------|-------------|----------|
| Stuck clear | Сброс zombie | ✓ |
| Warm transfer queue | Перевод в очередь | ✓ |
| Conference | 3-way ConfBridge | ✓ |
| Record on demand | Запись | (deferred) |
| Park | Парковка | ✓ |
| Click-to-call | Исходящий из панели | ✓ |

**User's choice:** Всё сразу, запись отложена в отдельную фазу, MVP-first.
**Notes:** Click-to-call client-aware: WebRTC direct; PJSIP originate-to-operator (auto-answer via SIP Call-Info).

## Вкладка Очереди

| Option | Description | Selected |
|--------|-------------|----------|
| Personal+queue | Личные + агрегат | ✓ |
| Personal only | Только личные | |
| Queue only | Только агрегат | |

**User's choice:** Агрегат (waiting/talking/SLA) + число свободных (warning<50%, danger 0) + личные принял/пропустил; период смена+день; действия: pause per-queue, join/leave, view waiting, перевод активного звонка в очередь.

## История вызовов оператора

**User's choice:** Все направления + click-to-callback + карточка; источник cc_call_history (расширить на все звонки: вход/исход/персональные/внутренние).

## Справочник для перевода

**User's choice:** endpoints + очереди + группы; presence через AMI DeviceState/ExtensionState → SSE; число свободных из CC-state.

## Уведомления

**User's choice:** Подраздел «Уведомления» в настройках оператора — матрица событие × канал (чат/звук/попап); все каналы (звук+browser+toast); per-operator + role default.

## Модель прав

**User's choice:** Хранение = operator_settings + role defaults в cc_settings; модель = role default + override; UI = таблица + модалка.

## i18n / perf / mobile

**User's choice:** ru+en для всех строк; SSE throttle/batch + дельты; mobile — полный mobile-first rework в этой фазе.

## Claude's Discretion

- Дефолтная вкладка при входе (Waiting или «запоминать последнюю»).
- Конкретные алгоритмы гибких авто-пауз.
- Схема расширения cc_call_history/cc_agent_events под non-queue.
- Разбиение на waves (MVP-first).

## Deferred Ideas

- Запись по требованию — отдельная фаза.
- Полный drag/resize dashboard — отдельная фаза.
- Тяжёлая аналитика операторов — Phase 7 reports / backlog.
- Полный редизайн АРМ супервизора.
- Campaign dialer — backlog.
