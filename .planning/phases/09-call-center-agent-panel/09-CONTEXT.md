# Phase 9: Call Center Agent Panel — softphone widget & professional call control - Context

**Gathered:** 2026-07-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Переработка АРМ оператора (`CallCenterAgentPage`) в современный полнофункциональный рабочий стол колл-центра. Софтфон перестаёт быть доминирующей «карточкой ожидания» и становится компактным виджетом; основными становятся настраиваемые области **Коллеги / Очереди / Текущие (ожидающие) звонки** + история вызовов оператора + справочник для перевода. Полный профессиональный набор call-control, умный инструмент обработки пропущенных, гибкая кастомизация интерфейса и granular-права. Одна фаза с waves — планировщик раскладывает объём по волнам, приоритет MVP.

**In scope:**
1. **Layout / IA АРМ** — гибрид «панели рядом на широком экране / вкладки на узком»; софтфон — плавающий виджет (FAB → dialpad) с индивидуальной настройкой показа/размещения; окно входящего — slide-in toast; кнопки управления вызовом в верхнем статус-баре + полный набор в окне/виджете.
2. **Статус-бар оператора** — READY → «Ожидание звонка»; полный набор статусов (+ DIALING, CONSULT, ACW отдельно от WRAPUP); максимально информативный индикатор текущего разговора (очередь / тип / номер / имя); live-таймер статуса; KPI принял/совершил/пропустил (за смену + день).
3. **KPI по всем звонкам оператора** — не только queue: расширение AMI-слушателя на каналы оператора (direction + disposition); отдельные счётчики принято(вход)/совершено(исход)/пропущено; детальный исторический журнал действий оператора.
4. **Вкладка Очереди** — все очереди оператора; агрегат (waiting/talking/SLA, число свободных операторов, warning <50% / danger при 0) + личные принял/пропустил per-queue (смена+день); действия: пауза/снятие per-queue, join/leave, переход к waiting, перевод активного звонка в очередь.
5. **Вкладка Коллеги** — активные операторы общих очередей; click-to-transfer; ChanSpy (если цель spyable и есть право) в режимах по granular-праву; hangup своих (оператор) / супервизор в пределах назначенных очередей.
6. **Вкладка Текущие/ожидающие** — таблица waiting + pickup («подобрать»).
7. **Умный модуль пропущенных** — группировка по номеру (счётчик попыток + время последней); авто-закрытие при дозвоне клиента (+ пометка «клиент сам перезвонил»); callback-flow с порогом успеха >5с; персональные vs queue (claim); исключение in-queue ring-no-answer.
8. **Call-control set** — уже готово: hold/mute/DTMF/blind+attended transfer/pickup. Добавляем: сброс «зависшего» (zombie) звонка, warm transfer в очередь, конференция 3-way (ConfBridge), парковка, client-aware click-to-call.
9. **История вызовов оператора** в панели — все направления (вход queue+персональные, исход, пропущенные) за смену/день + click-to-callback + доступ к карточке звонка.
10. **Справочник для перевода** — внутренние абоненты (endpoints) + очереди + группы вызовов с presence (BLF) и числом свободных операторов.
11. **Кастомизация интерфейса** — видимость вкладок/карточек + размещение софтфона; role default + per-operator override; настраивают и админ/супервизор, и оператор (в рамках разрешённого).
12. **Granular-права** — can_spy/spyable/spy_modes/click_to_call/customize_ui и т.д.
13. **Уведомления** — подраздел «Уведомления» в настройках оператора: матрица событие × канал (чат/звук/попап); per-operator + role default.
14. **i18n** — ru + en для всех новых строк. Mobile-first rework АРМ.

**Out of scope:**
- **Запись по требованию (start/stop)** — отложена в отдельную фазу (обсуждено).
- Полный drag/resize настраиваемый dashboard (перестановка панелей) — отдельная фаза; здесь только видимость on/off + размещение софтфона.
- Тяжёлая аналитика/дашборды по операторам — пересекается с Phase 7 `/callcenter/reports`; на АРМ только live-показатели + оперативная история/журнал.
- Полный редизайн АРМ супервизора (кроме прав hangup/chanspy, пересекающихся с вкладкой Коллеги).
- Исходящий обзвон/кампании (campaign dialer) — не обсуждали (кандидат в backlog); click-to-call входит, campaign — нет.

</domain>

<decisions>
## Implementation Decisions

### Layout / вкладки / кастомизация
- **D-01:** Софтфон — плавающий виджет внизу справа (FAB → разворачивает dialpad), НЕ доминирующая карточка. + индивидуальная настройка оператора: показывать/скрывать/где размещать софтфон.
- **D-02:** Окно входящего вызова — slide-in toast-карточка (не блокирует работу со списками).
- **D-03:** Кнопки управления вызовом — основные в верхнем статус-баре (как просил пользователь) + полный набор в окне вызова/виджете.
- **D-04:** Три области — гибрид: на широком экране панели рядом, на узком — вкладки; везде тоглы видимости.
- **D-05:** Конфиг интерфейса: **role default + per-operator override**. Глубина MVP — только видимость вкладок/карточек on/off + размещение софтфона (без reorder/DnD в этой фазе).
- **D-06:** Настраивают и админ/супервизор (задаёт default для роли + локи), и оператор (меняет разрешённое). UI в двух местах.
- **D-07 [Claude's discretion]:** Дефолтная вкладка при входе — вероятно Waiting или «запоминать последнюю»; финализировать на UI-этапе.

### KPI / статусы
- **D-08:** Источник KPI по ВСЕМ звонкам — расширить AMI-слушатель на каналы оператора (DialBegin/DialEnd/Hangup, direction + disposition), не только queue-события.
- **D-09:** Нужен детальный **исторический журнал действий оператора** (смены статусов, звонки, пропуски) — на базе `cc_agent_events` + `agent-detail`; для построения отчёта детализации работы оператора.
- **D-10:** «Пропущенный» у оператора: раздельно — **персональный пропущенный (−)** и **общий queue-missed раздел** (который операторы отрабатывают). In-queue ring-no-answer (когда звонок «долбится» в очередь) НЕ считается персональным пропущенным и НЕ попадает в инструмент пропущенных (его может ответить другой оператор позже).
- **D-11:** Сброс счётчиков в статус-баре — показывать И за смену, И за день (два числа).
- **D-12:** Исходящие — отдельные счётчики: принято (вход) / совершено (исход) / пропущено.
- **D-13:** Набор статусов — полный: READY(«Ожидание звонка») / PAUSED / IN_CALL / RINGING / WRAPUP / OFFLINE + **DIALING** (исходящий) + **CONSULT** (attended/консультация) + **ACW** (пост-обработка, отдельно от WRAPUP).
- **D-14:** Длительность статусов — live-таймер текущего статуса в статус-баре + накопление длительностей для отчёта. Индикатор разговора максимально информативный: из очереди → какая очередь; персональный/исходящий → тип + номер/имя собеседника.
- **D-15:** Авто-паузы — RONA (авто-пауза после пропущенного queue-звонка) + **гибко настраиваемые правила**: по количеству пропущенных, по времени бездействия, по длительности статуса. Алгоритмы проработать на research/plan.

### Умный модуль пропущенных
- **D-16:** Группировка по номеру: одна строка = номер + счётчик попыток + время последней (с раскрытием в историю попыток).
- **D-17:** «Клиент сам перезвонил» — авто-закрытие записи при последующем отвеченном (любым) звонке с этого номера + сохранять пометку «клиент сам перезвонил».
- **D-18:** «Оператор перезвонил» (callback-flow): клик «перезвонить» → для **PJSIP** originate на номер оператора, при ответе (или авто-ответ через SIP header Call-Info) → набор цели; для **WebRTC** — прямой звонок. Разговор **>5с = успешный перезвон** (mark called_back); недозвон или <5с = «попытка», запись остаётся в пропущенных.
- **D-19:** Владение: гибрид — персональные (прямые/внутренние на оператора) = мои; queue-missed = общий пул с claim. Персональные помечены отлично от queue; для внутренних абонентов подставлять имя звонившего.
- **D-20:** Scope инструмента: queue-abandoned + персональные (прямые на оператора/внутренние); in-queue ring-no-answer исключён.

### ChanSpy / прослушка
- **D-21:** Два флага максимального контроля: **can_spy** (может слушать) и **spyable** (его можно слушать).
- **D-22:** Режимы — granular по праву/уровню (оператор MVP: listen; whisper/barge — по праву/супервизор).
- **D-23:** Кто кого: коллега ↔ коллега в пределах общих очередей, если цель spyable; супервизор — шире (в пределах назначенных очередей).
- **D-24:** Приватность: listen — тихо (классика QA) + аудит-лог кто кого слушал.

### Права управления чужими звонками
- **D-25:** Scope супервизора — только назначенные очереди (не весь tenant).
- **D-26:** Управление чужими звонками (hangup/transfer/redirect) — только supervisor+ (без «оператора-лида»).
- **D-27:** Оператор управляет только своим активным звонком (hangup/hold/transfer/mute/DTMF) + pickup из своих очередей + **сброс «зависшего» (zombie) звонка** (канал без BYE, висящий в core show channels и в панели).

### Call-control set
- **D-28:** Включаем в фазу: сброс zombie-звонка, warm transfer в очередь, конференция 3-way (ConfBridge), парковка (park/retrieve), client-aware click-to-call. **Запись по требованию — отложена в отдельную фазу.**
- **D-29:** Click-to-call client-aware: WebRTC = прямой звонок; PJSIP (софтфон/аппарат) = originate на оператора, затем на цель (авто-ответ через SIP header Call-Info). Та же схема, что callback пропущенных (D-18).
- **D-30:** Приоритет MVP; тяжёлые фичи планировщик раскладывает по waves, остаток при необходимости в backlog.

### Вкладка Очереди
- **D-31:** Метрики per-queue: общий принято/пропущено + waiting/talking/SLA + число свободных операторов; warning если свободных <50%, danger если 0. + личные принял/пропустил оператора по очереди.
- **D-32:** Период — смена + день (согласовано с KPI).
- **D-33:** Действия: пауза/снятие паузы per-queue, войти/выйти из очереди (если разрешено), переход к waiting этой очереди, **перевод текущего активного звонка в эту очередь** (warm transfer to queue).

### История вызовов оператора
- **D-34:** Контент — все направления (вход queue+персональные, исход, пропущенные) с типом/направлением + click-to-callback из истории + доступ к карточке звонка.
- **D-35:** Источник — `cc_call_history` (расширить, чтобы содержал ВСЕ звонки: входящие/исходящие/персональные/внутренние, не только queue) + фильтр по оператору/дню.

### Справочник для перевода
- **D-36:** Сущности — внутренние абоненты (endpoints) + очереди + группы вызовов.
- **D-37:** Presence/BLF — AMI DeviceState/ExtensionState → SSE (real-time занятость абонента); для очередей/групп — число свободных из CC-state.

### Права (модель хранения)
- **D-38:** Хранение granular-прав — расширить `operator_settings` (per-operator) + role defaults в `cc_settings`.
- **D-39:** Модель — роль = набор прав (default) + переопределение на оператора.
- **D-40:** UI прав — оба: массовая таблица операторы × права + модалка на оператора.

### Уведомления
- **D-41:** Подраздел «Уведомления» в настройках оператора — матрица событие × канал: чат-сообщение / звук / всплывающее окно. Гибко и кастомизируемо.
- **D-42:** События (мин.): входящий, пропущенный + опционально SLA/порог очереди, новый пропущенный в общем пуле, чат, «вас подключили» (whisper/barge). Каналы: звук + browser notification (когда вкладка скрыта) + in-app toast.
- **D-43:** Конфиг — per-operator (`operator_settings`) + role default/локи.

### i18n / производительность / mobile
- **D-44:** i18n — ru + en для всех новых строк.
- **D-45:** SSE — троттлинг/батчинг событий + дельты (не слать полный стейт), особенно для BLF/presence и per-operator метрик.
- **D-46:** Mobile — полноценный mobile-first rework АРМ в этой фазе (переиспользуя наработки Phase 8: sticky softphone / bottom bar как отправную точку).

### Claude's Discretion
- Дефолтная вкладка при входе (D-07).
- Конкретные алгоритмы гибких авто-пауз (D-15) — проработать на research/plan.
- Точная схема расширения `cc_call_history`/`cc_agent_events` под не-queue звонки — research.
- Разбиение на waves и порядок (MVP-first).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Архитектура (обязательно)
- `packages/frontend/.idea/ARCHITECTURE.md` — FSD, Tailwind + shadcn, Stack, i18n, design tokens, TanStack Table
- `packages/backend/.idea/ARCHITECTURE.md` — модульная структура, AMI, SSE, multi-tenant

### Концепции колл-центра
- `.idea/call-center/CC_WORKSPACES_CONCEPT.md` — АРМ оператора (зоны/layout), референс для рефакторинга
- `.idea/call-center/CC_WEBRTC_CONCEPT.md` — WebRTC softphone (SIP.js + PJSIP WSS), двойной режим
- `.docs/CALLCENTER_MODULE.md` — документация текущей реализации (обновить по итогам фазы)

### Прошлая фаза (решения переносятся)
- `.planning/phases/07-call-center-overhaul-professional-agent-supervisor-workspace/07-CONTEXT.md` — D-14…D-45 (WebRTC, pickup D-18/D-19, chat, metrics, spy supervisor-only)

### Primary targets (frontend)
- `packages/frontend/src/pages/CallCenterAgentPage/CallCenterAgentPage.tsx` — orchestrator (primary refactor target)
- `packages/frontend/src/features/callcenter/` — softphone (`useWebRTCPhone`), SSE (`useCallCenterSSE`), selectors, UI-панели (ClientCard, DragTransfer, MissedCallsPanel, PauseReasonModal, CallCardPopup, ChatPanel)
- `packages/frontend/src/shared/api/endpoints/callCenterApi.ts` — RTK endpoints
- `packages/frontend/src/features/endpoints/lib/endpointIds.ts` — `interfaceToExtension`

### Primary targets (backend)
- `packages/backend/src/modules/callcenter/callcenter-ami.service.ts` — AMI-слушатель (расширить на каналы оператора: direction/disposition, presence)
- `packages/backend/src/modules/callcenter/callcenter.controller.ts` — agent/supervisor endpoints (spy, hangup-call, redirect, pickup, transfer)
- `packages/backend/src/modules/callcenter/callcenter-metrics.service.ts` — метрики (recordAnswered/recordAbandoned/recordAgentStatus)
- `packages/backend/src/modules/callcenter/callcenter-state.service.ts` — in-memory state + SSE emit
- `packages/backend/src/modules/callcenter/models/operator-settings.model.ts` — расширить (кастомизация UI, права, уведомления)
- `packages/backend/src/modules/callcenter/models/missed-call.model.ts` + `migrate-missed-calls-unique.ts` — умные пропущенные
- `packages/backend/src/modules/callcenter/models/agent-event.model.ts` — журнал действий оператора
- `packages/backend/src/modules/ami/ami.service.ts` — AMI actions (Originate, Redirect, ChanSpy, Hangup, ConfBridge, Park, DeviceStateList)

### Sketch findings (UI shell)
- `.cursor/skills/sketch-findings-krasterisk-v4/SKILL.md` — winners для навигации/mobile (bottom bar B, in-module A+C hybrid); учитывать для mobile-first rework

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useWebRTCPhone` — register/answer/hangup/hold/mute/DTMF/blind+attended transfer/quality — база для виджета и call-control.
- `DragTransfer` (DraggableCall/DroppableColleague) + click-to-transfer — уже есть для вкладки Коллеги.
- `MissedCallsPanel` + `CcMissedCall` model + unique-index migration — фундамент умного модуля пропущенных (нужно расширить: группировка, флаги, callback-flow, персональные).
- `PauseReasonModal` + `pausedAt.maxDurationMin` — база для гибких авто-пауз/лимитов.
- `useCallNotifications` + operator_settings (sound_incoming/missed, notifications_enabled, volume) — база для матрицы уведомлений.
- `CallCardPopup` (auto_open_on ring/answer/manual) — переиспользовать для окна входящего/карточки.
- `agentPickCall` + `pickup_enabled` (D-18/D-19) — вкладка Waiting «подобрать».
- Supervisor endpoints: `supervisor/spy` (ChanSpy modes), `supervisor/hangup-call`, `supervisor/redirect-call`, `agent-detail` — расширить на peer-spy и scope=назначенные очереди.
- `callsTaken` (session counter) + `recordAgentStatus`/`recordAnswered`/`recordAbandoned` — расширить на direction + missed + non-queue.

### Established Patterns
- In-memory state + SSE per-tenant emit (`emitEvent`) — добавлять новые события через тот же канал с троттлингом/дельтами (D-45).
- Tenant из суффикса имени очереди (`parseQueueTenant`), `req.user.vpbx_user_uid` — соблюдать multi-tenant изоляцию.
- `assertSupervisor` (level>=3) — заменить/дополнить на scope=назначенные очереди (D-25) + granular-права (D-38…D-40).
- История батчево через `CallCenterHistoryWriterService` (D-09 из Phase 7) — расширить на non-queue звонки (D-35).
- mobile: `useIsMobile`, `phoneTabs`, sticky softphone (Phase 8) — отправная точка mobile-first.

### Integration Points
- AMI: сейчас слушаются только Queue*-события; нужно подключить Dial*/Hangup/DeviceState на каналах оператора (KPI, история, presence).
- `operator_settings` + `cc_settings` — расширяются под кастомизацию UI, права, уведомления (миграции).
- `cc_call_history` / `cc_agent_events` — расширить схему под все направления и журнал действий.
- Endpoints/queues/call_groups модули — источник справочника для перевода (D-36).

</code_context>

<specifics>
## Specific Ideas

- «Максимальная информативность» индикатора разговора — из какой очереди / тип / номер / имя (для внутренних — имя абонента).
- Callback-порог «успех разговора» = **>5 секунд** (иначе «попытка»).
- Очереди: warning при свободных <50%, danger при 0 свободных.
- Пропущенные: явное отличие персонального от queue-missed; «клиент сам перезвонил» как отдельная пометка даже при авто-закрытии.
- Click-to-call и callback учитывают клиент оператора (WebRTC direct vs PJSIP originate-first).
- Оператор должен уметь сам «скинуть» зависший (zombie) звонок.

</specifics>

<deferred>
## Deferred Ideas

- **Запись разговоров по требованию (start/stop)** — отдельная фаза (обсуждено, вынесено из scope).
- **Полный drag/resize настраиваемый dashboard** (перестановка/ресайз панелей) — отдельная фаза; здесь только видимость + размещение софтфона.
- **Тяжёлая аналитика/дашборды по операторам** — пересекается с Phase 7 `/callcenter/reports`; вынести туда/в backlog.
- **Полный редизайн АРМ супервизора** — отдельно (кроме пересечения прав hangup/chanspy).
- **Исходящий обзвон / campaign dialer** — кандидат в backlog (click-to-call входит, кампании — нет).

</deferred>

---

*Phase: 9-call-center-agent-panel*
*Context gathered: 2026-07-22*
