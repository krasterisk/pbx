# Phase 7: Call Center overhaul — корпоративный колл-центр (workspaces, wallboard, call cards, отчётность, AI-ready) - Context

**Gathered:** 2026-07-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Переработка и развитие начатого модуля колл-центра (backend core готов, панели ~60–75%) до уровня современного корпоративного инструмента. Одна фаза с waves (~12–18 планов), «ничего не режем» — весь заявленный объём в этой фазе, планировщик раскладывает по волнам.

**In scope:**
1. **Аудит + rework ядра** — экспертная сверка реализованного с концепциями `.idea/call-center/*` и best practices; выполняется **внутри research-этапа** (в RESEARCH.md, не отдельным планом). Чеклист CC_IMPLEMENTATION_CHECKLIST.md устарел: в коде уже есть ClientCard, DragTransfer, MissedCallsPanel, PauseReasonModal, useCallNotifications, missed-call.model, spec-тесты сервисов — сначала точный gap-анализ.
2. **Metrics engine + персист** (первая волна после аудита) — SLA/ASR/AHT/ASA/Occupancy/Abandon; трёхслойная схема данных.
3. **АРМ оператора** — доведение до 4-зонной концепции: pick call, DnD transfer, wrap-up UX, звуки/notifications, client card.
4. **АРМ супервизора** — ВСЕ фичи: agent detail modal, queue management modal, bulk actions, live calls actions, sparklines, grid↔table.
5. **Wallboard** — `/callcenter/wallboard`, display-токен для TV, настраиваемые пороги алертов.
6. **Call Cards** — полный DnD-конструктор шаблонов, auto-populate, привязка к очередям/CDR, webhook в CRM.
7. **Отчётность** — все 7 отчётов, экспорт CSV/XLSX/PDF, автоматическая рассылка, agent timeline.
8. **Internal chat** — полноценный чат поверх REST+SSE с историей в БД.
9. **WebRTC softphone** — полный объём (SIP.js + PJSIP WSS).
10. **AI-ready foundation** — CC event bus, MCP/AI tools, каркас ARI externalMedia.

**Out of scope:**
- Сами AI-модули (STT, речевая аналитика, голосовые ассистенты, autonomous agent) — отдельные платные модули, отдельные фазы.
- AI-агент как оператор очереди — после реализации модуля AI Voice Assistants (решение D-23).
- WFM (прогноз нагрузки, расписания смен), omnichannel (чаты/email как каналы очередей) — backlog.
- Конфигуратор виджетов wallboard (фиксированный layout в этой фазе).

</domain>

<decisions>
## Implementation Decisions

### Структура и приоритеты
- **D-01:** Одна фаза 7 с waves (~12–18 планов, как Phase 6), без подфаз 7.x.
- **D-02:** Экспертный аудит реализованного — внутри research-этапа (RESEARCH.md), не отдельным планом. Researcher сверяет код с концепциями и best practices (Genesys/NICE/QueueMetrics), актуализирует картину «что реально сделано».
- **D-03:** Первая волна после аудита — **metrics engine + персист данных** (фундамент для wallboard и отчётов).
- **D-04:** Ничего не режем: WebRTC, internal chat, DnD-конструктор — всё в фазе, сколько бы волн ни понадобилось.

### Метрики и данные (design constraint: 150 одновременных звонков, 10–20 тыс. звонков/день)
- **D-05:** **Трёхслойная схема данных:** (1) in-memory state для real-time (как сейчас), (2) собственные `cc_*` таблицы истории звонков, пишутся из AMI-событий — основной источник отчётов, (3) Asterisk `queue_log` — источник resync/backfill при разрывах AMI (Asterisk пишет его независимо; при reconnect/периодической сверке дозаполняем пропуски). Детали reconciliation прорабатывает research.
- **D-06:** При рестарте backend аккумуляторы «за сегодня» (SLA, counters) восстанавливаются из БД — real-time метрики точны всегда.
- **D-07:** SLA-порог настраивается **per-queue** + default на тенанта.
- **D-08:** Механизм агрегации отчётов (SQL по сырым vs rollup-таблицы) — НЕ зафиксирован: research делает анализ нагрузки под constraint 150 concurrent / 10–20k calls/day и выбирает. Требование: отчёты быстрые при этой нагрузке.
- **D-09:** Запись истории из AMI при пиках — предпочтительно батчевая асинхронная (очередь в памяти, flush по N/интервалу); финальное решение на усмотрение Claude по итогам research. AMI-обработчики должны оставаться дешёвыми.

### Call Cards
- **D-10:** Сразу полный **DnD-конструктор** шаблонов с live preview (без промежуточной «формы-списка»).
- **D-11:** Набор типов полей v1 — на усмотрение Claude (концепция даёт 15 типов; file upload оценить отдельно — тянет хранилище/лимиты).
- **D-12:** Момент открытия карточки настраивается per-template: `answer` / `ring` / вручную (auto_open_on из концепции).
- **D-13:** Webhook в CRM при сохранении карточки — через **notification_integration из Phase 6** (generic webhook канал) + маппинг полей карточки; не дублировать credential store.

### WebRTC softphone
- **D-14:** Полный объём по CC_WEBRTC_CONCEPT.md: register/answer/hangup + hold/mute/DTMF + blind/attended transfer + выбор аудио-устройств + call quality indicator.
- **D-15:** Выбор режима (SIP-устройство / браузер) — модалка при логине в смену + выбор добавочного.
- **D-16:** Auto-answer настраиваемый per-operator + звуковой сигнал (zip tone) перед соединением.
- **D-17:** NAT traversal v1: STUN + поддержка TURN через env-конфиг; coturn разворачивается по потребности.

### АРМ оператора
- **D-18:** Pick call из своих очередей — с **per-user разрешением** в настройках (разрешить/запретить перехват).
- **D-19:** Wrap-up: кнопка продления (+N сек) И autosave draft карточки по финальному таймауту → READY; все таймеры и поведение настраиваются per-operator.
- **D-20:** Полный набор уведомлений: звук входящего/пропущенного + Browser Notification API при неактивной вкладке + настройки громкости/отключения.
- **D-21:** DnD transfer с модалкой подтверждения (слепой / с консультацией / отмена).
- **D-22:** Из решений D-16/18/19/20 следует сущность **per-operator настроек CC** (pickup permission, auto-answer, wrap-up таймеры, звуки/notifications) — управляется со страницы настроек КЦ.

### АРМ супервизора
- **D-23:** ВСЕ фичи в фазе: agent detail modal (timeline дня + статистика), queue management modal (add/remove/penalty + DnD агентов между очередями), bulk actions (массовая пауза/unpause/logout), live calls actions (pickup/transfer/hangup из таблицы), sparklines в KPI.
- **D-24:** Grid (плитки) ↔ Table (TanStack) переключатель, выбор запоминается.
- **D-25:** Spy/Whisper/Barge — как сейчас: Originate на устройство/добавочный супервизора (с WebRTC softphone заработает в браузере автоматически, отдельная кнопка не нужна).

### Wallboard
- **D-26:** Доступ для TV: **display-ссылка** — супервизор генерирует долгоживущий read-only токен, TV открывает URL без логина (только wallboard, никаких действий).
- **D-27:** Пороги алертов настраиваются через UI (на тенанта, разумные дефолты).
- **D-28:** Алерты сверх визуала/звука — через notification_integration Phase 6 (Telegram/email супервизору при превышении порогов).
- **D-29:** Фиксированный продуманный layout по концепции (KPI + live chart + агенты + очереди); конфигуратор виджетов не делаем.

### Internal chat
- **D-30:** Транспорт поверх существующей архитектуры: REST POST для отправки + SSE event для доставки (тот же tenant-фильтр). Без WebSocket.
- **D-31:** Полноценный чат v1: личные супервизор↔оператор, оператор↔оператор, broadcast супервизора (всем/очереди), групповые каналы.
- **D-32:** История чата в БД (видна при перезагрузке, за смену/период).

### Отчётность
- **D-33:** Все 7 отчётов: сводка очередей, детализация звонков, статистика операторов, отчёт по паузам, почасовая heatmap, agent timeline, пропущенные (с отметкой перезвона).
- **D-34:** Экспорт: CSV + XLSX + PDF.
- **D-35:** Автоматическая рассылка отчётов — в фазе (поздняя волна): расписание + шаблон + доставка через notification_integration Phase 6.
- **D-36:** Agent timeline — один переиспользуемый компонент: в отчётах (любой день) и в agent detail modal супервизора (сегодня, live).

### Роли и навигация
- **D-37:** Переезд на namespace `/callcenter/*` (agent, supervisor, wallboard, reports, settings) + редиректы со старых `/operator`, `/supervisor`.
- **D-38:** Role-based меню: оператор (level 2) — только своя панель; супервизор (3+) — всё CC-меню; админ — + настройки.
- **D-39:** Супервизор может работать как оператор: открывает АРМ оператора и логинится в очереди как обычный агент.
- **D-40:** Единая страница `/callcenter/settings` с табами: шаблоны карточек, паузы, пороги алертов, per-operator настройки, display-токены.

### AI-ready foundation
- **D-41:** Реализуем в фазе: (1) **типизированный CC event bus** — все события звонков/агентов как подписываемый поток для будущих AI-консьюмеров; (2) **MCP/AI tools для CC-сущностей** по паттерну Phase 5 Domain AI Adapter (состояние КЦ, управление агентами/паузами, отчёты через AI Chat) — закрывает deferred gap backend ARCHITECTURE §6; (3) **каркас ARI externalMedia** — прототип «канал звонка → PCM поток» без самого STT, как точка подключения будущей транскрипции.
- **D-42:** AI аналитика / голосовые ассистенты — **отдельные платные модули**: изолировать от CC-ядра, полей под них в схеме CC НЕ резервировать; предусмотреть точки быстрого подключения (event bus, media skeleton), не схему.
- **D-43:** Механика подключения платных модулей — рабочая гипотеза: отдельные NestJS-модули в монорепо + license/feature-flag гейт per-tenant (подписка на event bus, свои таблицы, UI появляется при активной лицензии). Research обязан сравнить с external-service подходом (как aiPBX) и подтвердить оптимальный вариант.
- **D-44:** AI-агент как оператор очереди — НЕ закладывать сейчас (ни agent type в схему); добавим после реализации модуля AI Voice Assistants.
- **D-45:** Research ДОЛЖЕН изучить существующие наработки: модуль `voice-robots` в этом репо и проект **aiPBX** (внешний, локально: `c:/Users/Professional/WebstormProjects/aiPBX_backend/src/assistants/assistants.service.ts`, `c:/Users/Professional/WebstormProjects/aiPBX_backend/src/ai-analytics/ai-analytics.service.ts`) — там уже реализованы голосовые AI-ассистенты и аналитика; концепции использовать при проектировании точек расширения.

### Claude's Discretion
- Набор типов полей Call Card v1 (база — 15 типов концепции; file upload оценить отдельно).
- Механизм агрегации отчётов (SQL vs rollup) — по итогам анализа нагрузки в research.
- Детали батчевой записи AMI→БД (размер батча, интервал flush, поведение при переполнении).
- Схемы новых таблиц (cc_queue_calls, chat, card templates/fields/data, operator settings, display tokens) и миграции.
- Детали reconciliation с queue_log (формат чтения: файл vs Realtime-таблица, частота сверки).
- Формат PDF-экспорта (библиотека, layout).
- Внутренности CC event bus (RxJS Subject vs Nest EventEmitter vs своя абстракция).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Архитектура (обязательно)
- `packages/frontend/.idea/ARCHITECTURE.md` — FSD, Tailwind + shadcn, SCSS modules, i18n, TanStack Table, паттерны страниц/модалок
- `packages/backend/.idea/ARCHITECTURE.md` — NestJS-модули, Sequelize, AMI, guards, tenant isolation, §6 (MCP/AI tools для новых сущностей)
- `.planning/CANONICAL_REFS.md` — общий индекс

### Концепции модуля (первоисточник требований)
- `.idea/call-center/CALLCENTER_MODULE_PLAN.md` — экспертный план: архитектура SSE + in-memory, метрики (формулы SLA/ASR/AHT/ASA/FCR/Occupancy), ролевая модель, схема БД
- `.idea/call-center/CC_IMPLEMENTATION_CHECKLIST.md` — чеклист прогресса (**устарел** — сверять с кодом в research)
- `.idea/call-center/CC_WORKSPACES_CONCEPT.md` — АРМ оператора (4 зоны), АРМ супервизора (KPI + tabs), wallboard, state machine агента
- `.idea/call-center/CC_CALL_CARD_CONCEPT.md` — шаблоны карточек, 15 типов полей, зависимые поля, auto-populate, схема БД cc_card_*
- `.idea/call-center/CC_WEBRTC_CONCEPT.md` — SIP.js + PJSIP WSS, двойной режим, useWebRTCPhone hook, конфигурация Asterisk
- `.docs/CALLCENTER_MODULE.md` — документация текущей реализации (API, SSE events, схема БД)

### Существующий код CC (точки изменения)
- `packages/backend/src/modules/callcenter/` — state store, AMI handlers, SSE controller, agent/supervisor API, 5 моделей, spec-тесты
- `packages/frontend/src/features/callcenter/` — slice, selectors, SSE hook, ClientCard, DragTransfer, MissedCallsPanel, PauseReasonModal, useCallNotifications
- `packages/frontend/src/shared/api/endpoints/callCenterApi.ts` — 19 RTK endpoints
- `packages/frontend/src/pages/CallCenterAgentPage/`, `pages/CallCenterSupervisorPage/` — текущие панели

### Переиспользование из других фаз
- Phase 6 `notification_integration` (05/06-планы, `packages/backend/src/modules/notifications/`) — канал для CRM webhook карточек, алертов wallboard, рассылки отчётов
- `.planning/phases/05-phonebooks-ai-universal-directory-mechanisms-mcp-tools-and-c/05-CONTEXT.md` — паттерн Domain AI Adapter для MCP/AI tools
- `packages/backend/src/modules/mcp/mcp-tools.service.ts` — регистрация MCP-инструментов
- `packages/frontend/src/features/phonebooks/` + `PhonebooksService.lookupNumber` — auto-populate карточек, client card
- `packages/backend/src/modules/voice-robots/voice-robots.service.ts` — существующие TTS/STT наработки, учесть при проектировании AI-точек

### Внешние референсы (research)
- `c:/Users/Professional/WebstormProjects/aiPBX_backend/src/assistants/assistants.service.ts` — реализация голосовых AI-ассистентов (внешний проект aiPBX, концепции для точек расширения)
- `c:/Users/Professional/WebstormProjects/aiPBX_backend/src/ai-analytics/ai-analytics.service.ts` — реализация AI-аналитики (внешний проект aiPBX)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `CallCenterStateService` — in-memory Map store + RxJS Subject: основа для event bus (D-41) и метрик-аккумуляторов
- `CallCenterAmiService.loadInitialState()` — QueueStatus resync: расширить до полного reconciliation при reconnect (D-05)
- `useCallCenterSSE` (12 listeners, auto-reconnect) — добавить события chat/cards/alerts в тот же поток
- `ClientCard`, `DragTransfer`, `MissedCallsPanel`, `PauseReasonModal` — начатые компоненты, достроить, не переписывать
- `IvrPromptsEditor`/`DialplanAppsEditor` + `@dnd-kit` — паттерн DnD-редакторов для конструктора карточек
- NAT-профиль `webrtc` в `endpoints.service.ts` — готов для WebRTC endpoints
- `MailerService`/notification-путь Phase 6 — доставка алертов и рассылки отчётов

### Established Patterns
- Tenant isolation: `vpbx_user_uid` на всех таблицах и SSE-фильтрах
- RTK Query `injectEndpoints` + tagTypes; Redux slice для SSE-состояния
- Роли: level 2 = оператор, level 3+ = супервизор (RBAC уже в контроллере)
- SCSS-модули + design tokens `var(--color-*)`; i18n ru/en; TanStack Table
- Historical DB / in-memory разделение: real-time НЕ из БД (сохранить принцип)

### Integration Points
- AMI event pipeline → добавить запись истории (батчи) и event bus поверх существующих handlers
- Очереди (`queues` module): поля card_template_id, sla_threshold per-queue
- SSE endpoint: display-токен wallboard — отдельная auth-ветка (read-only, без JWT-сессии)
- MCP: `mcp-tools.service` — регистрация CC-инструментов по паттерну Phase 5
- ARI: подключение externalMedia каркаса к существующему ARI WS соединению

</code_context>

<specifics>
## Specific Ideas

- «Нужен анализ нагрузки: за основу 150 одновременных звонков, 10–20 тысяч звонков в день» — зафиксировано как design constraint для metrics/reports (D-08).
- «Что будет, если AMI упадёт/перегрузится?» — надёжность AMI-пайплайна обязательна: reconnect + resync + queue_log backfill (D-05).
- «AI аналитика, голосовые ассистенты — дополнительные платные модули, изолировать друг от друга, но предусмотреть быстрое подключение» (D-42/43).
- «После реализации модуля AI Voice Assistants добавляем AI-агента как оператора очереди» — задел не сейчас (D-44).
- «В research используй концепции проекта aiPBX» — внешние пути указаны в canonical_refs (D-45).
- Per-operator настройки (перехват, wrap-up, auto-answer) — пользователь настойчиво хочет гибкость на уровне отдельного оператора (D-18/19/22).

</specifics>

<deferred>
## Deferred Ideas

- **AI-агент как оператор очереди** (agent type human|ai) — после модуля AI Voice Assistants (отдельная фаза).
- **Модули AI аналитики / голосовых ассистентов / речевой аналитики** — отдельные платные модули, отдельные фазы; в этой фазе только точки подключения.
- **WFM** (прогноз нагрузки, расписания смен) — backlog.
- **Omnichannel** (чаты, email, соцсети как каналы очередей) — backlog.
- **Конфигуратор виджетов wallboard** — фиксированный layout в v1.
- **Callback (перезвон из очереди) и skill-based routing** — не обсуждались детально; кандидаты в следующую фазу (в ROADMAP scope-out).

</deferred>

---

*Phase: 7-call-center-overhaul-professional-agent-supervisor-workspace*
*Context gathered: 2026-07-15*
