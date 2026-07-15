# Phase 7: Call Center overhaul — корпоративный колл-центр - Research

**Researched:** 2026-07-15
**Domain:** Real-time contact-center platform (NestJS + AMI/ARI event pipeline, React/Redux SSE frontend, WebRTC softphone, metrics/reporting, AI-ready extension points)
**Confidence:** MEDIUM-HIGH (стек и паттерны верифицированы в коде и package.json; часть числовых порогов нагрузки — оценка [ASSUMED], требует эмпирической проверки на реальном трафике)

## Summary

Модуль колл-центра в krasterisk_v4 — это не greenfield: backend-ядро (`CallCenterStateService`, `CallCenterAmiService`, REST API, SSE) реально работает, а не просто задокументировано в чеклисте. Экспертный аудит (раздел ниже) подтверждает: real-time pipeline in-memory→SSE — качественная основа, но слой персистентной истории для метрик/отчётов **фактически не пишется** (`CALL_START`/`CALL_END` есть в enum `AgentEventType`, но никогда не вызываются), `queue_log`-реконсиляции нет, batched-write инфраструктуры нет. Фронтенд имеет более высокую степень готовности по строительным блокам (DnD, SSE-хук, клиентская карточка, уведомления), но верстка на custom SCSS вместо design-system компонентов, WebRTC отсутствует полностью, wallboard/чат/карточки/отчёты не начаты.

Фаза объёмная (45 locked-решений, ~12-18 планов по волнам). Первая волна после аудита — **metrics engine + персист**, потому что от неё зависят wallboard, отчёты и agent timeline. Ключевой архитектурный принцип, который нужно защитить во всех волнах: **in-memory state остаётся источником правды для real-time**, БД — только исторический слой, `queue_log` — resync/backfill механизм при разрывах AMI, не основной путь записи.

**Primary recommendation:** Wave 1 строит `cc_queue_calls` (call history) + `cc_daily_*` rollup-таблицы + batched-async writer (in-memory очередь + `bulkCreate` на interval/threshold flush) поверх уже существующих AMI-хендлеров в `CallCenterAmiService`, без изменения контракта `CallCenterStateService`. Все последующие волны (wallboard, cards, reports, AI-tools) читают из этого фундамента, а не изобретают собственные пути записи.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Real-time состояние агентов/очередей/звонков | API/Backend (in-memory `CallCenterStateService`) | — | Уже реализовано; SSE — единственный канал push, БД не участвует в hot path |
| История звонков / метрики (SLA, AHT, ASA) | API/Backend (`cc_*` таблицы + rollup) | Database/Storage | Пишется асинхронно из AMI-хендлеров; читается отчётами |
| AMI/ARI интеграция (queue events, hold, originate) | API/Backend (`ami.service.ts`, `ari-*`) | — | Единственная точка входа в Asterisk; уже стабилизирована reconnect-логикой |
| WebRTC softphone (SIP.js) | Browser/Client | API/Backend (credentials endpoint) | Медиа/сигнализация полностью в браузере; backend лишь выдаёт SIP-креды и PJSIP WSS настроен на Asterisk |
| Call Cards (конструктор + данные) | API/Backend (CRUD, schema) | Browser/Client (DnD builder UI) | Схема/валидация на backend, drag-and-drop UX на клиенте |
| Wallboard (TV display) | Browser/Client (read-only SSE consumer) | API/Backend (display-token auth) | Отдельная auth-ветка без JWT-сессии, тот же SSE-поток |
| Internal chat | API/Backend (REST+SSE, история в БД) | Browser/Client | Транспорт по существующему SSE-каналу, не WebSocket |
| Отчёты (7 видов) + экспорт | API/Backend (агрегация, CSV/XLSX/PDF генерация) | Browser/Client (UI, agent timeline) | Тяжёлая агрегация — на backend, чтобы не тащить сырые данные в браузер |
| CC event bus (AI-ready) | API/Backend (RxJS Subject, in-process) | — | AI-консьюмеры (будущие платные модули) подписываются in-process, не через сеть |
| MCP/AI tools для CC | API/Backend (Domain AI Adapter) | — | Тот же паттерн, что Phase 5 Phonebooks — handler получает `vpbxUserUid` параметром |
| ARI externalMedia (PCM skeleton) | API/Backend (`AriHttpClientService` + `RtpUdpServerService`) | — | Уже есть готовый паттерн в `voice-robots`; переиспользуем, не изобретаем |

## Expert Audit — Gap Analysis (D-02)

> Выполнено внутри research-этапа по решению D-02. `CC_IMPLEMENTATION_CHECKLIST.md` устарел и не используется как источник истины — ниже актуальная сверка кода с `.idea/call-center/*` концепциями и практиками индустрии (Genesys Cloud CX, NICE CXone, QueueMetrics, VICIdial, FOP2).

### Backend — что реально работает

| Компонент | Файл | Оценка |
|---|---|---|
| In-memory state store | `packages/backend/src/modules/callcenter/callcenter-state.service.ts` | ✅ Готово. `AgentState`/`QueueState`/`CallState` Maps + RxJS `Subject` для событий, `getSnapshot()` для fullSnapshot при подключении SSE. Соответствует концепции "in-memory для real-time". |
| AMI event ingestion | `callcenter-ami.service.ts` | ✅ Частично готово. Обрабатывает `queuememberstatus`, `queuememberadded/removed`, `queuememberpause`, `queuecallerjoin/abandon`, `agentconnect/complete`, `hold/unhold`. `loadInitialState()` делает разовый `QueueStatus` resync при старте — НЕ выполняется при reconnect AMI (см. Pitfall). |
| REST API (agent/supervisor) | `callcenter.controller.ts`, `callcenter.service.ts` | ✅ Хорошо покрыто: login/logout/pause/unpause/hangup/hold/unhold/transfer/wrapup-done/pick-call, supervisor spy/force-pause/force-unpause/queue-add/queue-remove, pause-reasons CRUD, missed-calls, client-lookup. |
| SSE push | `callcenter-sse.controller.ts` | ✅ `@Sse('events')`, fullSnapshot на коннект + стрим + heartbeat. Токен через query param (ограничение EventSource API — ожидаемо). |
| DB-модели | `models/*.ts` | ⚠️ Частично. Есть `agent-session`, `agent-event` (enum LOGIN/LOGOUT/PAUSE/READY/HOLD/UNHOLD/WRAPUP_END + **CALL_START/CALL_END, которые определены, но НИГДЕ не вызываются** — мёртвый код), `missed-call` (с `called_back_by`/`note` — готово для reports), `agent-queue`. **Нет `cc_queue_calls`** (полная история звонка: enter/answer/end, talk/hold/wrapup time, disposition) — то есть отчёты "детализация звонков", "статистика операторов", "почасовая heatmap" сейчас нечем наполнить. |
| Метрики/агрегация | — | ❌ Отсутствует. `QueueState` в памяти хранит только текущие счётчики (waiting, agents), нет накопителей SLA/ASR/AHT/ASA за период, нет восстановления "аккумуляторов за сегодня" при рестарте (D-06). |
| `queue_log` reconciliation | — | ❌ Отсутствует полностью. |
| Batched-write | — | ❌ Отсутствует. Единственная запись в БД в hot path — `cc_missed_calls.create()` в `handleCallerAbandon`, и она уже fire-and-forget (`.catch()`, не await) — хороший прецедент, но не масштабируется на полную историю без явной очереди. |
| Известный баг | `callcenter.service.ts` `agentTransfer()` | ⚠️ Blind transfer использует `call.callerIdNum` как `channel` для AMI `Redirect` — должен быть `call.callerChannel` (channel name, не CallerID number). Нужно исправить в первой волне доработки АРМ оператора. |
| MCP/AI tools для CC | `mcp-tools.service.ts` | ❌ Не зарегистрировано. Backend `ARCHITECTURE.md` §6 явно требует MCP-инструмент на новую сущность — это deferred gap, который явно закрывает D-41(b). |
| Тесты | `*.spec.ts` (3 backend файла) | ✅ Есть: `callcenter-state.service.spec.ts`, `callcenter.service.spec.ts`, `callcenter-ami.service.spec.ts`. Плюс `npm run test:cc` скрипт уже настроен (`jest --testPathPattern="modules/callcenter"`). Хорошая база для регрессионных проверок в ходе рефакторинга. |

### Frontend — что реально работает

| Компонент | Файл | Оценка |
|---|---|---|
| SSE-хук | `features/callcenter/lib/useCallCenterSSE.ts` | ✅ Готово. Native `EventSource` (встроенный авто-reconnect), диспатчит 12+ событий в Redux (`setSnapshot`, `updateAgent/Queue`, `addCall/updateCall/removeCall`, `callHold/Unhold`, `wrapupStart/End`, `missedCallNew/Update`). |
| Redux slice/selectors | `model/slice`, `model/selectors` | ✅ Есть, покрыто тестами (`callCenterSlice.test.ts`, `callCenterSelectors.test.ts`). |
| ClientCard | `ui/ClientCard/ClientCard.tsx` | ✅ Работает: `useLazyClientLookupQuery`, показывает совпадения в справочниках + заявки. Это уже **часть** будущей Call Card концепции, но не настраиваемый шаблон — просто read-only sidebar. Не путать эти сущности при проектировании D-10 (Call Card — новая, настраиваемая; ClientCard — существующий read-only виджет для контекста звонящего, вероятно становится одним из "auto-populate" источников). |
| DragTransfer | `ui/DragTransfer/DragTransfer.tsx` | ✅ Работает на `@dnd-kit/core` — `DraggableCall`/`DroppableColleague` + confirm-модалка. Прямой прецедент для D-21 (нужно добавить выбор blind/attended/cancel в модалку). |
| MissedCallsPanel, PauseReasonModal, useCallNotifications | — | ✅ Работают, встроены в `CallCenterAgentPage`. |
| Agent workspace | `pages/CallCenterAgentPage/CallCenterAgentPage.tsx` | ⚠️ Функционально ок (login/logout/pause/hangup/hold/transfer работают), но: custom SCSS вместо `shared/ui` компонентов (`DataTable`, `Dialog`, `Sheet`), mute — чисто локальный React state (не подключён к WebRTC/AMI), DTMF keypad есть в UI, но `// TODO: send DTMF` — не реализован, hardcoded `agentLogin({ interface: 'PJSIP/auto', queues: [] })` вместо реального выбора устройства/очередей. |
| Supervisor workspace | `pages/CallCenterSupervisorPage/CallCenterSupervisorPage.tsx` | ⚠️ KPI/agent grid/live calls/queues отображаются, spy/force-pause/force-unpause работают. Нет grid↔table переключателя (D-24), нет agent detail modal, queue management modal, bulk actions, sparklines (все — D-23). |
| Навигация | `app/router/router.tsx`, `widgets/Sidebar/Sidebar.tsx` | ❌ Роуты на `/operator`, `/supervisor` (не `/callcenter/*` — D-37). **Sidebar — статичный массив без какой-либо role-based фильтрации** (нет `useSelector` на роль/уровень пользователя вообще ни для одного пункта меню) — D-38 требует построить это с нуля, это не доработка, а новая логика. |
| WebRTC | — | ❌ Отсутствует полностью. `sip.js` не в зависимостях фронтенда. |
| Call Cards (конструктор) | — | ❌ Отсутствует. |
| Wallboard | — | ❌ Отсутствует. |
| Internal chat | — | ❌ Отсутствует. |
| Reports | — | ❌ Отсутствует (кроме общего `/reports/cdr` вне CC). |
| UI-примитивы, нужные по 07-UI-SPEC.md, но отсутствующие в `shared/ui` | — | `Sheet`, `Switch`, `Avatar`, `Popover`, `Progress`, `SegmentedControl` — нужно завести до/во время первых UI-волн (проверить `packages/frontend/src/shared/ui/` перед каждым использованием, не создавать дубликаты). |

### Сверка с best practices индустрии (Genesys/NICE/QueueMetrics/VICIdial/FOP2)

| Практика | Есть в krasterisk_v4? | Комментарий |
|---|---|---|
| In-memory real-time state + отдельная история для отчётов (двухуровневая архитектура) | Наполовину | In-memory есть, история — нет. Это САМЫЙ важный gap, потому что все остальные фичи (wallboard sparklines, reports, agent timeline) читают историю. |
| AMI/ARI resync после падения соединения (все продукты типа FOP2/VICIdial держат "recovery" механизм) | Частично | Reconnect с backoff есть в `ami.service.ts`, но `loadInitialState()` (полный `QueueStatus`) вызывается только при первом старте модуля, не при каждом reconnect — при разрыве AMI на N минут state устаревает и не самовосстанавливается. |
| SLA per-queue + tenant default (QueueMetrics/NICE так считают SLA) | Частично | `servicelevel` уже есть в `queue.model.ts` (маппится на Asterisk realtime поле) — то есть per-queue SLA threshold уже настраивается через существующий Queues UI. Не хватает tenant-level default (используется, если у очереди `servicelevel` не задан) и явного использования этого поля в метрик-движке (сейчас нигде не читается для расчёта SLA%). |
| Spy/Whisper/Barge через Originate (FOP2-style) | Да | `supervisorSpy` через `amiService.action` Originate — стандартный Asterisk-паттерн, ничего менять не нужно, D-25 подтверждает "как сейчас". |
| Wrap-up (ACW) с таймером и авто-возвратом в Ready | Нет | Только UI-заглушка, без backend-таймера/persistence per-operator настроек. |
| Configurable call disposition / call cards (Genesys "interaction forms") | Нет | Полностью предстоит построить (D-10-D-13). |
| Wallboard как отдельный auth-режим для TV (industry standard — "display mode" без логина) | Нет | Предстоит построить (D-26). |

**Вывод аудита:** backend real-time слой и часть агентских действий — качественный, готовый фундамент, не трогать архитектуру `CallCenterStateService`/SSE. Всё, что связано с ИСТОРИЕЙ (метрики, отчёты, wallboard sparklines, agent timeline, AI state summary) требует нового слоя персистентности — это объективно должно быть Wave 1, как и зафиксировано в D-03.

## Standard Stack

### Core (уже в проекте, переиспользуется без изменений)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@nestjs/*` | текущая монорепо-версия | Backend framework | Существующий стек, не меняется |
| `sequelize`, `sequelize-typescript` | текущая | ORM, миграции | Существующий стек; для `cc_*` таблиц — новые модели по тому же паттерну (`@Table`, `vpbx_user_uid` FK) |
| `rxjs` | текущая (транзитивная через NestJS) | `CallCenterStateService` event Subject → основа CC event bus (D-41a) | Уже используется, `Subject`/`Observable` — стандартный in-process pub/sub паттерн Nest-приложений, нет причин вводить `EventEmitter2` параллельно |
| `@dnd-kit/core`, `@dnd-kit/sortable` | текущая (в `package.json` фронтенда) | DnD для Call Card builder (D-10), queue↔agent DnD в queue management modal (D-23) | Уже используется в `DialplanAppsEditor` и `DragTransfer` — паттерн `DndContext` + `SortableContext` + `arrayMove` прямо переносится |
| `@tanstack/react-table` | текущая | Supervisor grid↔table (D-24), reports tables | Стандарт проекта (см. `packages/frontend/.idea/ARCHITECTURE.md`) |
| `recharts` | текущая | Sparklines (D-23), heatmap-отчёт (D-33), wallboard live chart (D-29) | Стандарт проекта |
| `@react-pdf/renderer`, `react-to-print` | текущая (в `package.json` фронтенда) | PDF-экспорт отчётов (D-34) | Уже установлены — **не добавлять `jspdf`/`pdfmake` параллельно** |

### Supporting (нужно добавить)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `sip.js` | `0.21.2` [VERIFIED: npm registry — `npm view sip.js version` → `0.21.2`] | WebRTC softphone (D-14) | Единственная реализация SIP.js для браузера; используется в `useWebRTCPhone` hook по паттерну `CC_WEBRTC_CONCEPT.md` |
| `exceljs` | последняя стабильная (сверить `npm view exceljs version` перед install) | XLSX-экспорт отчётов (D-34) | В `package.json` backend её пока нет; `exceljs` — де-факто стандарт для потокового построения `.xlsx` в Node (в отличие от `xlsx`/SheetJS, у которого лицензионные и security-advisory нюансы в open-source сборке) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `rxjs Subject` (CC event bus) | `@nestjs/event-emitter` (`EventEmitter2`) | `EventEmitter2` даёт декларативные `@OnEvent()` декораторы, но `CallCenterStateService` уже построен на `Subject` — вводить вторую шину усложняет модель без выигрыша. Rxjs `Subject` также естественно превращается в `Observable` для SSE (`@Sse()` уже использует Observable-подобный паттерн) |
| `exceljs` (XLSX) | `xlsx` (SheetJS) | `xlsx` community-версия отставала по security patches и не имеет полноценного streaming-writer; `exceljs` активно поддерживается и уже де-факто стандарт в NestJS-экосистеме |
| Ручной CSV builder (уже есть в `cdr.controller.ts`) | `csv-writer`/`fast-csv` | Ручной builder в проекте уже работает и покрывает потребности — **не хand-roll заново**, но и новую зависимость не нужно тащить, переиспользуем существующий подход |
| NestJS-модуль с license-gate (D-43 гипотеза) | Внешний сервис (aiPBX-style) | См. подробный разбор в разделе AI-ready ниже — рекомендация подтверждает D-43 |

**Installation:**
```bash
npm install sip.js --workspace=@krasterisk/frontend
npm install exceljs --workspace=@krasterisk/backend
```

**Version verification:**
```bash
npm view sip.js version
npm view exceljs version
```
`sip.js@0.21.2` подтверждён напрямую через `npm view` в ходе research (см. Sources). `exceljs` — команду нужно прогнать непосредственно перед install в первой Reports-волне (версия могла обновиться между research и execution).

## Package Legitimacy Audit

> slopcheck не устанавливался в рамках этой сессии research (инструмент недоступен в окружении Windows/PowerShell без предварительной настройки Python-тулчейна проекта). Оба пакета помечены `[ASSUMED]` — планировщик должен поставить `checkpoint:human-verify` перед `npm install` каждого.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `sip.js` | npm | ~9 лет (первый релиз 2014-2015, `onsip/SIP.js`) [ASSUMED] | Высокие (десятки тыс/нед, стандартный WebRTC-стек) [ASSUMED] | `github.com/onsip/SIP.js` [ASSUMED] | не проверено | Approved с checkpoint:human-verify |
| `exceljs` | npm | ~9 лет [ASSUMED] | Очень высокие (millions/week-уровень, широко используемый) [ASSUMED] | `github.com/exceljs/exceljs` [ASSUMED] | не проверено | Approved с checkpoint:human-verify |

**Packages removed due to slopcheck [SLOP] verdict:** none (slopcheck не запускался)
**Packages flagged as suspicious [SUS]:** none

*Все пакеты выше — `[ASSUMED]`, планировщик должен добавить `checkpoint:human-verify` перед каждым `npm install` этих пакетов.*

## Architecture Patterns

### System Architecture Diagram

```
                          ┌──────────────────────────────┐
                          │   Asterisk (AMI + ARI + PJSIP) │
                          └───────────┬───────────────────┘
                                      │ AMI events (queuememberstatus,
                                      │  agentconnect, agentcomplete,
                                      │  queuecallerjoin/abandon, hold/unhold)
                                      ▼
                    ┌─────────────────────────────────────┐
                    │  CallCenterAmiService (backend)       │
                    │  - обновляет in-memory state          │
                    │  - эмитит событие в CC event bus       │──┐
                    │  - кладёт запись в batched write queue │  │ (новое, Wave 1)
                    └───────────────┬─────────────────────┘  │
                                    │ setAgent/setQueue/setCall │
                                    ▼                           │
                    ┌─────────────────────────────────────┐    │
                    │  CallCenterStateService (in-memory)   │    │
                    │  - Maps + RxJS Subject                │    │
                    └───────────────┬─────────────────────┘    │
                                    │ getEventStream()            │
                    ┌───────────────┼─────────────────────┐     │
                    ▼               ▼                     ▼     ▼
            ┌──────────────┐ ┌─────────────┐   ┌───────────────────┐
            │ SSE endpoint │ │ MCP/AI tools │   │ Batched Writer     │
            │ /events      │ │ (Domain      │   │ (in-memory queue → │
            │ (JWT / token)│ │  AI Adapter) │   │  bulkCreate flush) │
            └──────┬───────┘ └─────────────┘   └─────────┬─────────┘
                   │                                      ▼
     ┌─────────────┼──────────────┐              ┌──────────────────┐
     ▼             ▼              ▼              │  cc_queue_calls    │
 Agent WS   Supervisor WS    Wallboard (TV,      │  cc_agent_events   │
 (React)    (React)          display-token)      │  (история звонков) │
                                                   └─────────┬────────┘
                                                             │ nightly cron
                                                             ▼
                                                   ┌──────────────────┐
                                                   │ cc_daily_* rollup │
                                                   └─────────┬────────┘
                                                             ▼
                                                   ┌──────────────────┐
                                                   │ Reports API       │
                                                   │ (CSV/XLSX/PDF)    │
                                                   └──────────────────┘

  Отдельно (resync путь, при разрыве AMI):
  Asterisk queue_log (файл/Realtime-таблица) ──► reconciliation job ──► backfill gaps в cc_queue_calls
```

### Recommended Project Structure (новые backend-сущности)

```
packages/backend/src/modules/callcenter/
├── callcenter-state.service.ts        # НЕ менять контракт — только консьюмеры добавляются
├── callcenter-ami.service.ts          # добавить: emit в event bus + push в batch queue
├── callcenter-history-writer.service.ts   # НОВОЕ: batched-async writer (Wave 1)
├── callcenter-metrics.service.ts          # НОВОЕ: SLA/ASR/AHT/ASA/Occupancy расчёт, аккумуляторы (Wave 1)
├── callcenter-queuelog-reconciler.service.ts  # НОВОЕ: resync/backfill из queue_log (Wave 1)
├── callcenter-ai.adapter.ts                # НОВОЕ: Domain AI Adapter (по паттерну phonebooks-ai.adapter.ts)
├── callcenter-media-bridge.service.ts       # НОВОЕ: ARI externalMedia skeleton (позже волна, AI-ready)
├── models/
│   ├── queue-call.model.ts             # НОВОЕ: cc_queue_calls (история звонков)
│   ├── daily-queue-stats.model.ts      # НОВОЕ: rollup
│   ├── card-template.model.ts          # НОВОЕ: cc_card_templates
│   ├── card-field.model.ts             # НОВОЕ: cc_card_fields
│   ├── card-data.model.ts              # НОВОЕ: cc_card_data
│   ├── chat-message.model.ts           # НОВОЕ: cc_chat_messages
│   ├── operator-settings.model.ts      # НОВОЕ: cc_operator_settings
│   └── display-token.model.ts          # НОВОЕ: cc_display_tokens (wallboard)
└── reports/
    └── callcenter-reports.service.ts   # НОВОЕ: 7 отчётов + export
```

### Pattern 1: Batched-Async History Writer (D-09)

**What:** AMI-хендлеры (дешёвые, синхронные обновления in-memory state) кладут "событие для истории" в простую in-memory очередь (массив). Отдельный интервал (`setInterval`/NestJS `@Interval`) раз в N мс или при достижении M записей делает `bulkCreate` одним запросом.
**When to use:** Всегда для записи `cc_queue_calls`/`cc_agent_events` из AMI-хендлеров — никогда не делать `await Model.create()` синхронно внутри AMI event handler.
**Example:**
```typescript
// packages/backend/src/modules/callcenter/callcenter-history-writer.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/sequelize';
import { QueueCall } from './models/queue-call.model';

const FLUSH_INTERVAL_MS = 1000;
const FLUSH_MAX_BATCH = 200;

@Injectable()
export class CallCenterHistoryWriterService {
  private readonly logger = new Logger(CallCenterHistoryWriterService.name);
  private buffer: Partial<QueueCall>[] = [];

  constructor(@InjectModel(QueueCall) private readonly model: typeof QueueCall) {}

  enqueue(row: Partial<QueueCall>): void {
    this.buffer.push(row);
    if (this.buffer.length >= FLUSH_MAX_BATCH) {
      void this.flush(); // не await — вызывающий AMI-хендлер не блокируется
    }
  }

  @Interval(FLUSH_INTERVAL_MS)
  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    const batch = this.buffer;
    this.buffer = [];
    try {
      await this.model.bulkCreate(batch as any, { validate: false });
    } catch (e: any) {
      this.logger.error(`History batch flush failed (${batch.length} rows): ${e?.message}`);
      // Решение по переполнению/потере записи — на усмотрение Claude при планировании (D-09):
      // рекомендация — логировать в отдельный dead-letter массив с ограниченным TTL,
      // не ретраить бесконечно (иначе буфер растёт при систематической ошибке схемы).
    }
  }
}
```
*Источник: паттерн — стандартная практика батчевой записи high-throughput event streams (общее знание Node.js/NestJS, не специфичная библиотека) [ASSUMED — общий паттерн, не из официальной документации конкретного пакета].*

### Pattern 2: Domain AI Adapter для CC-сущностей (D-41b)

**What:** Реализовать `DomainAiAdapter` по образцу `PhonebooksAiAdapter` — единственный существующий эталон в кодовой базе.
**When to use:** Для всех MCP/AI-инструментов CC (получить статус агентов, поставить/снять паузу, форс-логаут, получить сводку KPI очереди, вызвать отчёт).
**Example:**
```typescript
// packages/backend/src/modules/callcenter/callcenter-ai.adapter.ts
// Source: packages/backend/src/modules/phonebooks/phonebooks-ai.adapter.ts (эталон Phase 5, D-14/D-15/D-23)
@Injectable()
export class CallCenterAiAdapter implements DomainAiAdapter, OnModuleInit {
  readonly domain = 'callcenter';

  constructor(
    private readonly ccService: CallCenterService,
    private readonly stateService: CallCenterStateService,
    private readonly registry: AiAdapterRegistryService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  getTools(): AiToolDefinition[] {
    return [this.toolGetQueueSnapshot(), this.toolForcePauseAgent(), this.toolGetTodayKpi()];
  }

  getStateProvider(): AiStateProvider {
    return { domain: this.domain, buildSummary: (uid) => this.buildSummary(uid) };
  }

  private toolForcePauseAgent(): AiToolDefinition {
    return {
      name: 'cc_force_pause_agent',
      description: 'Ставит агента на паузу принудительно (только для супервизора/AI с ролью супервизора).',
      inputSchema: { agent_interface: { type: 'string' }, reason: { type: 'string' } },
      entityType: 'callcenter_agent',
      destructive: true, // требует confirm=true — как все supervisor-force-* операции
      handler: async (args, vpbxUserUid) =>
        this.ccService.supervisorForcePause(args.agent_interface, args.reason, vpbxUserUid),
    };
  }
  // ... остальные tool-методы по тому же контракту, handler получает vpbxUserUid параметром — НЕ замыканием (D-23 antipattern)
}
```

### Pattern 3: DnD Card Template Builder (D-10)

**What:** Переиспользовать ровно тот же стек, что `DialplanAppsEditor`: `DndContext` + `SortableContext` (`verticalListSortingStrategy`) + `arrayMove` для перестановки полей карточки, каждое поле — `SortableActionItem`-подобный компонент с live preview рядом.
**When to use:** Экран конструктора шаблона Call Card — единственный экран, где нужен DnD builder (не промежуточная форма-список, согласно D-10).
**Example:**
```typescript
// Source: packages/frontend/src/features/dialplan-apps/ui/DialplanAppsEditor/DialplanAppsEditor.tsx (прямой прецедент)
const sensors = useSensors(
  useSensor(PointerSensor),
  useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
);
// onDragEnd: fields = arrayMove(fields, oldIndex, newIndex); onChange(fields);
```

### Pattern 4: Webhook payload для Call Card → CRM (D-13)

**What:** `WebhookProvider.send()` уже поддерживает `payload_template` с `{{var}}`-подстановкой, но **только для `message`/`target`** — нужно расширить `vars` до произвольного набора полей карточки.
**When to use:** При сохранении Call Card, если у шаблона настроен webhook (integration_uid из `notification_integration`).
**Example (требуемое изменение сигнатуры, НЕ hand-roll нового webhook-механизма):**
```typescript
// packages/backend/src/modules/notifications/providers/webhook.provider.ts
// ТЕКУЩАЯ сигнатура: send(integration, target, message) — vars = {message, target}
// ТРЕБУЕТСЯ: 4-й опциональный параметр extraVars, слитый в vars ДО applyTemplate,
// чтобы {{customer_name}}, {{card_field_x}} и т.п. подставлялись из данных карточки.
async send(
  integration: DecryptedNotificationIntegration,
  target: string | undefined,
  message: string,
  extraVars?: Record<string, string>,   // НОВОЕ — card field values
): Promise<NotificationSendResult> {
  const vars: Record<string, string> = { message: trimNotificationMessage(message), target: target ?? '', ...extraVars };
  // ...остальное без изменений
}
```
Это единственная точка, которую нужно расширить в `NotificationDispatcherService`/`WebhookProvider` — CRUD интеграций (`notifications.controller.ts`) переиспользуется без изменений (D-13: "не дублировать credential store").

### Pattern 5: ARI externalMedia Skeleton (D-41c)

**What:** Прототип "канал звонка → PCM поток" без STT — переиспользовать УЖЕ РАБОТАЮЩИЙ паттерн `voice-robots`.
**When to use:** Как каркас точки подключения будущей платной AI-транскрипции — не подключать реальный STT в этой фазе (D-42/D-44).
**Example:**
```typescript
// Source: packages/backend/src/modules/ari/ari-http-client.service.ts (externalMedia) +
//         packages/backend/src/modules/voice-robots/services/rtp-udp-server.service.ts
// Существующий поток (voice-robots): AriHttpClientService.externalMedia(channelId, rtpAddr)
//   → AriConnectionService эмитит 'ari.ExternalMediaRtpReady' когда RTP-адрес готов
//   → RtpUdpServerService создаёт RtpSession, парсит RTP-заголовки, эмитит decoded PCM16/Float32
//
// Для CC-каркаса: тот же вызов externalMedia на канал агента/звонка из cc_queue_calls,
// но НЕ подключать StreamingSttService — вместо этого просто логировать/эмитить событие
// 'cc.media.pcmFrame' в CC event bus, оставляя точку подписки для будущего платного модуля.
class CallCenterMediaBridgeService {
  async attachPcmSkeleton(channelId: string): Promise<void> {
    const rtpSession = await this.rtpServer.allocateSession();
    await this.ariClient.externalMedia(channelId, rtpSession.localAddr);
    rtpSession.on('pcm', (frame) => this.eventBus.emit('cc.media.pcmFrame', { channelId, frame }));
    // НЕ вызывать sttService.transcribe() здесь — это платный модуль, за пределами этой фазы (D-42)
  }
}
```

### Pattern 6: License-gate для платных AI-модулей (D-43)

**Разбор сравнения (обязателен по D-43):**

**Вариант A — NestJS-модуль в монорепо + license/feature-flag gate (рабочая гипотеза D-43):**
- Плюсы: in-process подписка на CC event bus (RxJS `Subject`) без сетевого хопа, переиспользование tenant-isolation (`vpbxUserUid` уже везде), переиспользование `AiAdapterRegistryService`/MCP-инфраструктуры без дублирования auth.
- Минусы: платный код физически лежит в том же репозитории/деплое — нужен чистый feature-flag guard, чтобы не течь функциональность неоплаченным тенантам.
- В проекте уже есть `packages/backend/src/modules/cloud-admin/billing/` (billing-scheduler, billing-balance, bank-webhook) — то есть биллинговая инфраструктура per-tenant УЖЕ существует, её можно расширить полем "активные фичи/подписки" без построения отдельного billing-стека с нуля.

**Вариант B — внешний сервис (aiPBX-style):**
- Изучен `c:/Users/Professional/WebstormProjects/aiPBX_backend/src/assistants/assistants.service.ts` и `ai-analytics/ai-analytics.service.ts`. **Важное честное наблюдение:** aiPBX — это НЕ пример "внешнего плагина к хост-PBX". Это полностью самостоятельный NestJS-монолит: `AssistantsService` инжектирует `OpenAiService`, `Prices`, `BillingRecord`, `BillingFxService`, `UsersService` — всё в одном приложении, ассистенты и биллинг за них живут в общей БД этого же процесса. aiPBX не демонстрирует паттерн "AI как отдельный микросервис, подключаемый по сети к другому PBX" — он демонстрирует, как выглядит вертикально интегрированный AI-модуль внутри одного NestJS-приложения (assistants + tools + mcpServers many-to-many, billing per assistant/usage, `AiAnalyticsService.analyzeCall()` — LLM-вызов с строго типизированным JSON-контрактом метрик по транскрипту).
- Следствие: аргументов "за" внешний сервис в самом aiPBX не находится — он не построен как внешний сервис относительно чего-либо. Сетевой хоп добавил бы задержку в подписку на CC event bus (нужную для будущей live-транскрипции/аналитики в реальном времени) и дублировал бы tenant-auth.

**Рекомендация:** Вариант A (NestJS-модуль + license-gate) подтверждается — сохранить D-43 как принятое решение, не рабочую гипотезу. Полезная деталь из aiPBX для будущего платного модуля (не для этой фазы, но как заметка для планирования разделения): `AiAnalyticsService.analyzeCall()` — хороший образец промпта для извлечения строго типизированных бизнес-метрик звонка через LLM (JSON-schema из 5 категорий: accuracy, speech quality, business impact, satisfaction, scenario) — пригодится когда AI voice analytics module будет реализовываться отдельной фазой.

### Anti-Patterns to Avoid

- **Синхронная запись в БД внутри AMI event handler:** блокирует обработку следующих событий при пике 150 concurrent calls — всегда через batched writer (Pattern 1).
- **Замыкание `vpbxUserUid` в handler при регистрации MCP-инструмента:** уже был реальный cross-tenant баг в этом кодовом стиле (см. комментарий D-23 в `mcp-tools.service.ts`) — `vpbxUserUid` ВСЕГДА параметр вызова.
- **Второй event bus (EventEmitter2) параллельно RxJS Subject:** избыточная сложность — CC event bus строится НАД существующим `CallCenterStateService.getEventStream()`, не рядом.
- **Полноценный STT/AI-анализ звонка в рамках этой фазы:** явно запрещено D-42/D-44 — только точки подключения (event bus subscription slot, ARI media skeleton), НЕ сама логика.
- **Дублирование credential store для CRM-webhooks карточек:** переиспользовать `notification_integration`, не создавать `cc_webhook_credentials`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| DnD-конструктор с сортировкой | Свой drag-drop поверх HTML5 DnD API | `@dnd-kit/core` + `@dnd-kit/sortable` (уже в проекте) | Уже отработан в `DialplanAppsEditor`/`DragTransfer` — accessibility (keyboard sensor) и edge cases решены |
| WebRTC SIP-стек | Свой SDP/ICE парсер над `RTCPeerConnection` | `sip.js` | SIP-сигнализация + ICE/DTLS негоциация — тысячи строк edge cases, `sip.js` — стандарт для браузерных SIP-клиентов |
| XLSX-генерация | Ручная сборка ZIP/XML | `exceljs` | OOXML-формат сложный (стили, merge cells, форматы дат) — hand-roll даст битые файлы в Excel/LibreOffice на edge cases |
| CSV-генерация | Ещё один CSV builder | Существующий hand-rolled builder в `cdr.controller.ts` | Уже работает, покрывает потребности — не заводить вторую реализацию той же задачи |
| Батчевая запись high-throughput событий | Message queue (RabbitMQ/Kafka) для внутреннего процесса | In-memory buffer + `bulkCreate` + `@nestjs/schedule` `@Interval` | При 150 concurrent/10-20k calls/day внешняя MQ — избыточная инфраструктура; весь пайплайн внутри одного backend-процесса |
| MCP/AI tool registry с нуля | Своя реализация JSON-RPC dispatch для AI-инструментов | `AiAdapterRegistryService` + `DomainAiAdapter` contract (Phase 5) | Контракт уже валидирован реальным адаптером (`PhonebooksAiAdapter`), включая защиту от cross-tenant утечки closure |
| RTP/PCM парсинг для externalMedia | Свой UDP + RTP header parser | `RtpUdpServerService` (уже в `voice-robots`) | RTP-заголовки, sequence/timestamp обработка, порт-пул — уже реализовано и протестировано в voice-robots |

**Key insight:** Почти всё, что нужно для AI-ready фундамента (D-41), уже существует как рабочий паттерн где-то в этом же репозитории (`voice-robots` для медиа, `phonebooks` для Domain AI Adapter, `notifications` для webhook). Задача этой фазы — **переиспользовать**, а не спроектировать с нуля.

## Load Analysis (D-08)

**Design constraint:** 150 одновременных звонков, 10 000–20 000 звонков/день.

### Оценка объёма строк

- 20 000 звонков/день × ~1 строка `cc_queue_calls` на звонок = **20k строк/день** ≈ **7.3M строк/год**.
- `cc_agent_events` (LOGIN/LOGOUT/PAUSE/READY/HOLD/UNHOLD/WRAPUP_*): при средней смене агента ~15-20 событий/смену × N агентов — оценочно **50-100k строк/день** для колл-центра такого объёма [ASSUMED — зависит от числа агентов и частоты pause/unpause, требует эмпирической калибровки после Wave 1].
- Обе таблицы всегда фильтруются по `vpbx_user_uid` в WHERE (мультитенантность) — то есть **реальный рабочий набор на один тенант в диапазоне отчёта существенно меньше** глобального объёма; топ-тенант с 20k звонков/день — это оценочно верхняя граница на ОДНОГО тенанта, а не на всю платформу.

### Рекомендация по агрегации (закрывает D-08)

**Гибридная стратегия:**
1. **SQL-по-сырым данным** для периодов ≤ 90 дней (все операционные отчёты: сегодня/неделя/месяц/квартал) — при условии композитных индексов `(vpbx_user_uid, created_at)` и `(vpbx_user_uid, queue_name, created_at)` полнотабличный скан не требуется, диапазонный скан по индексу на 1-2M строк на тенанта за 90 дней — стандартная нагрузка для MySQL/PostgreSQL с GROUP BY.
2. **Rollup-таблицы (`cc_daily_queue_stats`, `cc_daily_agent_stats`)** строятся nightly cron (`@Cron('5 0 * * *')`) для:
   - почасовой heatmap-отчёта за длинные периоды (месяцы/годы);
   - wallboard/dashboard KPI, которым нужен мгновенный отклик без фильтров периода;
   - возможности архивации/purge сырых `cc_agent_events` старше N месяцев без потери агрегатов.
3. **Порог перехода на rollup:** если measured p95 latency SQL-по-сырым для 90-дневного отчёта превышает ~1.5-2 сек в проде — расширять горизонт rollup-покрытия. Для periods > 90 дней rollup обязателен independent от измеренной латентности (сырые данные к этому времени уже кандидат на архивацию).

### Индекс-стратегия

```sql
-- cc_queue_calls
CREATE INDEX idx_cc_queue_calls_tenant_date ON cc_queue_calls (vpbx_user_uid, created_at);
CREATE INDEX idx_cc_queue_calls_tenant_queue_date ON cc_queue_calls (vpbx_user_uid, queue_name, created_at);
CREATE INDEX idx_cc_queue_calls_tenant_agent_date ON cc_queue_calls (vpbx_user_uid, agent_user_uid, created_at);
CREATE UNIQUE INDEX idx_cc_queue_calls_uniqueid ON cc_queue_calls (call_uniqueid);

-- cc_agent_events (уже существует — проверить наличие аналогичных индексов, добавить если нет)
CREATE INDEX idx_cc_agent_events_tenant_date ON cc_agent_events (vpbx_user_uid, created_at);
```

### Batched-write параметры (рекомендация, Claude's Discretion по D-09)

- Flush interval: **1000 мс** (баланс между свежестью данных для near-real-time метрик и накладными расходами на частые INSERT).
- Flush threshold: **200 записей** (что бы наступило раньше — flush по времени или по размеру).
- При 150 concurrent calls реалистичный пик событий — десятки/сек (не сотни), так что оба параметра дают большой запас; финальная калибровка — после нагрузочного теста в Wave 1 (не блокирует планирование, но должно быть отражено как verification step).
- Переполнение буфера при систематической ошибке БД: логировать факт потери, не блокировать AMI-обработку (согласно принципу "AMI-обработчики должны оставаться дешёвыми" из D-09) — не пытаться бесконечно ретраить в том же цикле.

## queue_log Reconciliation (D-05)

**Формат Asterisk `queue_log`:** по умолчанию Asterisk пишет построчный лог в файл `/var/log/asterisk/queue_log` (формат: `timestamp|callid|queuename|agent|event|data...`), либо — если настроен `res_config_*` realtime backend — в таблицу (часто называемую `queue_log`) через `queue_log.conf` [CITED: общеизвестный формат Asterisk queue_log, документирован в исходниках `apps/app_queue.c` и стандартных руководствах по Asterisk Queue]. Ключевые события: `ENTERQUEUE`, `CONNECT`, `ABANDON`, `COMPLETECALLER`, `COMPLETEAGENT`, `TRANSFER`, `EXITWITHTIMEOUT`, `RINGNOANSWER`.

**Рекомендация по способу чтения (Claude's Discretion, D-05/D-08):**
- **Проверить конкретную инсталляцию Asterisk этого проекта** — если БД уже настроена как realtime backend для `queue_log` (то есть таблица `queue_log` уже существует в той же MySQL/PostgreSQL, к которой подключён backend), читать через Sequelize raw query — не парсить файл. Если нет — читать файл `/var/log/asterisk/queue_log` через периодический tail-парсер (отслеживать позицию последней прочитанной строки по offset/inode, как стандартный log-tailing паттерн).
- **Триггер reconciliation:** (1) при восстановлении AMI-соединения после разрыва (событие "reconnected" в `ami.service.ts`) — сверить `cc_queue_calls` за окно разрыва с `queue_log` и добавить недостающие строки; (2) периодическая фоновая сверка (например раз в час) как safety net на случай пропущенных AMI-событий без явного разрыва соединения.
- **Reconciliation logic:** `queue_log` — источник истины при конфликте (Asterisk пишет его независимо от нашего AMI-пайплайна, поэтому он не подвержен тем же сетевым разрывам). Матчинг строк по `callid`/`uniqueid`.

*Это единственный раздел, где степень уверенности LOW-MEDIUM: точный формат/backend `queue_log` в ЭТОЙ инсталляции Asterisk не верифицирован в ходе research (нет доступа к `queue_log.conf` целевого сервера) — см. Open Questions и Assumptions Log.*

## AMI Reliability Best Practices (D-05)

- `ami.service.ts` уже реализует reconnect с exponential backoff и `isConnected()` — хорошая база.
- **Gap, требующий исправления в Wave 1:** `CallCenterAmiService.loadInitialState()` (полный `QueueStatus` resync через временные listeners на `queueparams`/`queuemember`/`queueentry`) вызывается только при старте модуля, НЕ при событии reconnect после разрыва. Нужно подписаться на событие "AMI reconnected" из `ami.service.ts` и повторно вызывать `loadInitialState()` — иначе in-memory state расходится с реальностью Asterisk после любого сетевого сбоя до следующего перезапуска backend.
- Рекомендация (общая практика Asterisk-интеграций, [ASSUMED] — не специфичный API, общее знание): всегда сочетать (a) resync через `QueueStatus`/`QueueSummary` AMI-команды при (re)connect с (b) queue_log backfill для событий, случившихся ВО ВРЕМЯ разрыва (которые resync не восстановит, так как resync даёт только текущий снимок, не историю за период разрыва).

## Runtime State Inventory

> Раздел применим только к rename/refactor/migration фазам. Phase 7 — это преимущественно greenfield-развитие существующего модуля (новые таблицы, новые компоненты), а не переименование/миграция существующих сущностей. **Пропущено** — не rename/refactor фаза.

## Common Pitfalls

### Pitfall 1: Синхронная запись в БД в AMI hot path
**What goes wrong:** При пике 150 concurrent calls обработка AMI-событий начинает задерживаться, agent state в SSE начинает "залипать".
**Why it happens:** `await Model.create()` внутри event handler блокирует event loop на время SQL round-trip.
**How to avoid:** Всегда fire-and-forget или batched writer (Pattern 1). Существующий прецедент в `handleCallerAbandon` (`.catch()`, без await) — доказательство, что паттерн уже осознан в кодовой базе, просто не универсализирован.
**Warning signs:** Растущая задержка между реальным Asterisk-событием и обновлением UI при нагрузочном тесте.

### Pitfall 2: `agentTransfer` использует неверный channel identifier
**What goes wrong:** Blind transfer может тихо фейлить или редиректить неправильный канал.
**Why it happens:** Код использует `call.callerIdNum` вместо `call.callerChannel` для AMI `Redirect` action — CallerID номер это НЕ то же самое, что Asterisk channel name.
**How to avoid:** Исправить как часть первой волны доработки АРМ оператора; добавить unit-тест, который явно проверяет, что `Redirect` вызывается с channel name, не с CallerID.
**Warning signs:** Transfer "работает" в тестах с моками, но реального Redirect на проде не происходит или происходит на неверный канал.

### Pitfall 3: `loadInitialState()` не переподключается после AMI reconnect
**What goes wrong:** После сетевого сбоя AMI in-memory state расходится с реальным состоянием Asterisk до следующего restart backend.
**Why it happens:** Resync-логика написана как "выполнить один раз при старте модуля", а не как "выполнять при каждом (пере)подключении".
**How to avoid:** Подписать `loadInitialState()` на событие reconnect из `ami.service.ts`, не только на `onModuleInit`.
**Warning signs:** Agent state в супервизорской панели не совпадает с реальным `sip show endpoints`/`queue show` на Asterisk после сетевого инцидента.

### Pitfall 4: Смешивание `ClientCard` (существующий read-only виджет) с Call Card (новая настраиваемая сущность D-10)
**What goes wrong:** Разработчик по инерции расширяет `ClientCard.tsx` под задачи конструктора карточек, получая непонятный гибрид.
**Why it happens:** Похожие названия, похожая область (контекст звонящего).
**How to avoid:** Явно развести в плане: `ClientCard` остаётся как есть (read-only lookup-панель, возможно становится ОДНИМ из auto-populate источников новой Call Card), новая сущность — `cc_card_templates`/`cc_card_fields`/`cc_card_data` + отдельный UI-компонент.
**Warning signs:** PR, который переименовывает/расширяет `ClientCard` вместо создания новой фичи.

### Pitfall 5: EventSource token в query param — не забыть про display-token wallboard (D-26)
**What goes wrong:** Wallboard-токен для TV реализуется как ещё один JWT, что требует логина и не соответствует "открывает URL без логина".
**Why it happens:** Существующий SSE endpoint уже использует токен через query param для JWT — легко скопировать этот путь буквально.
**How to avoid:** Отдельная auth-ветка: display-token — это долгоживущий opaque токен (не JWT сессии пользователя), который валидируется отдельным guard'ом, дающим ТОЛЬКО доступ к read-only wallboard SSE-топику, без права на agent/supervisor actions.
**Warning signs:** Display-token декодируется тем же `JwtAuthGuard`, что обычные сессии — риск privilege leakage, если токен утечёт с экрана TV.

### Pitfall 6: Rollup-таблицы, рассинхронизированные с `cc_queue_calls` после queue_log backfill
**What goes wrong:** Backfill добавляет "опоздавшие" строки в `cc_queue_calls` за прошедший день, но nightly rollup для этого дня уже посчитан и не пересчитывается.
**Why it happens:** Rollup job запускается один раз, backfill может произойти позже (при следующем reconnect).
**How to avoid:** Rollup job для дня D должен запускаться не раньше, чем через окно "safety margin" после полуночи (например 2-3 часа), ИЛИ backfill-job должен явно инвалидировать/пересчитывать rollup за затронутый день после успешного backfill.
**Warning signs:** Отчёт "почасовая heatmap" за прошлый месяц не совпадает по итоговым суммам с "детализацией звонков" за тот же период.

## Code Examples

### CC Event Bus — типизация поверх существующего Subject

```typescript
// packages/backend/src/modules/callcenter/callcenter-state.service.ts (расширение существующего файла)
// Текущий getEventStream() уже возвращает Observable<CcEvent> — задача D-41a - формализовать
// discriminated union типов, а не добавлять новую инфраструктуру.
export type CcEventBusEvent =
  | { type: 'agent.stateChanged'; agent: AgentState }
  | { type: 'call.started'; call: CallState }
  | { type: 'call.ended'; call: CallState; disposition: 'answered' | 'abandoned' | 'transferred' }
  | { type: 'queue.statsChanged'; queue: QueueState }
  | { type: 'media.pcmFrame'; channelId: string; frame: Buffer }; // AI-ready slot (D-41c), не обрабатывается в этой фазе

// Будущий платный AI-модуль подписывается так (пример на будущее, НЕ часть этой фазы):
// callCenterStateService.getEventStream().pipe(filter(e => e.type === 'media.pcmFrame')).subscribe(...)
```

### Reports export via exceljs (шаблон, не hand-roll)

```typescript
// Source: https://github.com/exceljs/exceljs (официальный README, streaming writer API)
import ExcelJS from 'exceljs';

async function exportQueueSummaryXlsx(rows: QueueSummaryRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Queue Summary');
  sheet.columns = [
    { header: 'Queue', key: 'queue', width: 20 },
    { header: 'SLA %', key: 'sla', width: 10 },
    { header: 'ASA (sec)', key: 'asa', width: 12 },
    { header: 'AHT (sec)', key: 'aht', width: 12 },
    { header: 'Abandon %', key: 'abandon', width: 12 },
  ];
  sheet.addRows(rows);
  return (await workbook.xlsx.writeBuffer()) as Buffer;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `CC_IMPLEMENTATION_CHECKLIST.md` как источник истины прогресса | Прямая сверка кода в этом research-документе (D-02) | 2026-07-15 (эта research-сессия) | Планировщик должен ориентироваться на раздел "Expert Audit" этого документа, не на устаревший чеклист |
| Единый `mcp-tools.service.ts` с ручными `regXxx()` для каждой сущности | Domain AI Adapter (Phase 5) для новых доменов, старые 5 доменов не мигрируются | Phase 5 (до этой фазы) | CC-инструменты регистрируются через `CallCenterAiAdapter` + `AiAdapterRegistryService`, НЕ через ручной `regXxx()` в `mcp-tools.service.ts` |

**Deprecated/outdated:** `CC_IMPLEMENTATION_CHECKLIST.md` не должен использоваться планировщиком для оценки прогресса — заменён разделом Expert Audit выше.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | Точный формат/backend хранения `queue_log` (файл vs realtime-таблица) на целевом Asterisk-сервере этого проекта | queue_log Reconciliation | Если backend — realtime-таблица с иной структурой полей, чем классический построчный формат, reconciliation-джоб нужно переписать под конкретную схему; требуется проверка `queue_log.conf` перед реализацией (Open Question 1) |
| A2 | Оценка объёма `cc_agent_events` (50-100k строк/день) | Load Analysis | Если реальное число событий на смену выше оценки (например частые pause/unpause), порог перехода на rollup нужно снизить раньше 90 дней |
| A3 | `sip.js` возраст/популярность/репозиторий (age, downloads, source repo в Package Legitimacy Audit) | Package Legitimacy Audit | Данные из training knowledge, не проверены напрямую через registry API/GitHub — низкий риск (widely-known library), но формально не verified в этой сессии |
| A4 | `exceljs` возраст/популярность/репозиторий | Package Legitimacy Audit | То же самое — низкий практический риск, но не verified инструментом |
| A5 | Batched-write параметры (1000мс/200 записей) как безопасные значения по умолчанию | Load Analysis | Если реальный пиковый rate событий выше ожиданий, потребуется снизить flush interval или увеличить buffer capacity — требует нагрузочного теста в Wave 1, не блокирует, но должно быть верификационным шагом плана |
| A6 | Общий паттерн "in-memory queue + interval flush" как отраслевая практика | Pattern 1 (Batched-Async History Writer) | Общее инженерное знание, не привязано к конкретной библиотеке/документации — риск низкий, паттерн стандартен, но не "CITED" источник |

## Open Questions (RESOLVED)

1. **Формат `queue_log` на целевом Asterisk-сервере** — **RESOLVED: via `checkpoint:human-verify` в 07-04 Task 1** (проверка `queue_log.conf` целевого сервера до реализации reconciler; обе реализации `FileQueueLogReader`/`RealtimeQueueLogReader` строятся за интерфейсом `QueueLogReader`, выбор фабрики по факту проверки).
   - What we know: Asterisk по умолчанию пишет построчный файл `/var/log/asterisk/queue_log`; альтернатива — realtime backend (таблица `queue_log` в той же БД).
   - What's unclear: Какой вариант настроен именно на серверах, где будет развёрнут krasterisk_v4 (файл или realtime-таблица), и доступен ли backend-процессу файловый путь при типичном деплое (Docker/контейнер без общего volume с Asterisk).
   - Recommendation: Первая задача Wave 1 (или отдельный spike-план) — проверить реальную конфигурацию `queue_log.conf` в deployment-окружении перед написанием reconciliation-джоба; заложить оба пути (file-tail и raw SQL query) как варианты реализации за интерфейсом `QueueLogReader`, выбрать реализацию по факту.

2. **Точная нагрузка событий `cc_agent_events` в проде** — **RESOLVED: не блокирует планирование — мониторинг после Wave 1** (batched-writer заложен с консервативными параметрами и bounded buffer cap в 07-01; калибровка по метрике flush rate в проде).
   - What we know: design constraint — 150 concurrent calls, 10-20k calls/day.
   - What's unclear: Реальное распределение pause/unpause/wrapup событий на агента в смену для целевых клиентов krasterisk_v4 (зависит от бизнес-процессов конкретных колл-центров).
   - Recommendation: Не блокирует планирование — заложить batched-writer с консервативными параметрами (Pattern 1) и добавить metric/log для мониторинга реального flush rate после Wave 1 в проде, скорректировать при необходимости.

3. **Нужен ли отдельный `cc_tenant_settings` или расширение существующего generic settings-паттерна** — **RESOLVED: 2 таблицы, см. 07-05** (`cc_settings` per-tenant singleton + `cc_operator_settings` per-operator — ровно по рекомендации research, зафиксировано в 07-05-PLAN.md).
   - What we know: `system_settings` (`system-settings/system-setting.model.ts`) — глобальная key-value таблица без `user_uid`, не подходит напрямую.
   - What's unclear: Предпочитает ли планировщик единую JSON-based `cc_settings` таблицу (per-tenant singleton: default SLA, alert thresholds) + отдельную `cc_operator_settings` (per-operator: pickup permission, auto-answer, wrap-up timers) — или дробление на много узких таблиц.
   - Recommendation: Рекомендация research — 2 таблицы (`cc_settings` per-tenant singleton с JSON-колонками для гибкости + `cc_operator_settings` per-operator с явными типизированными колонками, так как per-operator настройки — фиксированный, известный набор полей по D-18/19/20/22) — финальная схема на усмотрение Claude (уже отражено в CONTEXT.md Discretion).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js/npm workspaces | Весь backend/frontend | ✓ | текущая монорепо-версия | — |
| `sip.js` (npm registry) | WebRTC softphone (D-14) | ✓ (registry) | 0.21.2 [VERIFIED: npm registry] | — |
| `exceljs` (npm registry) | XLSX export (D-34) | не установлен, но доступен в registry | сверить перед install | Ручной OOXML не рекомендуется (см. Don't Hand-Roll) |
| Asterisk PJSIP WSS transport (`res_pjsip_transport_websocket`, `http.conf` tlsenable) | WebRTC signaling (D-14/D-17) | ✗ (не управляется этим приложением — нет модуля `ps_transports` в backend) | — | Конфигурируется вручную на Asterisk-сервере (ops runbook), НЕ через krasterisk UI в этой фазе — задокументировать как инфраструктурное требование, не задачу плана |
| coturn (TURN сервер) | WebRTC NAT traversal за симметричным NAT (D-17) | ✗ (разворачивается по потребности, согласно D-17) | — | STUN достаточен для большинства случаев v1; TURN — env-конфигурируемый опциональный путь, не блокирует v1 |
| slopcheck (Python-инструмент) | Package Legitimacy Audit | ✗ (не установлен/не проверялся в этой сессии) | — | Все новые пакеты помечены `[ASSUMED]` с `checkpoint:human-verify` |

**Missing dependencies with no fallback:**
- Нет (PJSIP WSS/coturn имеют явный fallback-путь — ручная ops-конфигурация вне кода приложения, задокументированная, но не блокирующая планирование фазы).

**Missing dependencies with fallback:**
- Asterisk PJSIP WSS transport — ops-задача вне git-репозитория; план должен включать явный чеклист/runbook-шаг ("проверить/настроить `ps_transports` wss на целевом сервере"), а не код-задачу.
- coturn — опционален для v1 (STUN достаточен), подключается по потребности согласно D-17.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework (backend) | Jest (существующий, `packages/backend/package.json` → `"test": "jest"`) |
| Framework (frontend) | Vitest (существующий, `packages/frontend/package.json`) |
| Config file | `packages/backend/jest.config.*` / `packages/frontend/vitest.config.*` (существующие, не создавать заново) |
| Quick run command (CC-scoped, backend) | `npm run test:cc -w @krasterisk/backend` (уже настроен: `jest --testPathPattern="modules/callcenter" --no-coverage`) |
| Quick run command (CC-scoped, frontend) | `npm run test:cc -w @krasterisk/frontend` (уже настроен: `vitest run src/features/callcenter`) |
| Quick run command (both, root) | `npm run test:cc` (уже настроен в root `package.json`, запускает оба workspace-скрипта) |
| Full suite command | `npm run test:backend && npm run test:frontend` (согласно AGENTS.md verify-протоколу проекта) |

### Phase Requirements → Test Map

> `phase_req_ids` не заданы для этой фазы (null) — используются decision ID (D-XX) как единица трассировки вместо REQ-ID.

| Decision | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| D-05/D-06 | Аккумуляторы SLA/counters восстанавливаются из БД при рестарте backend | unit | `npm run test:cc -w @krasterisk/backend` (новый spec для `callcenter-metrics.service.ts`) | ❌ Wave 1 |
| D-09 | Batched writer флашит буфер по интервалу/threshold, не блокирует AMI-хендлер | unit | новый `callcenter-history-writer.service.spec.ts` | ❌ Wave 1 |
| D-05 (queue_log) | Reconciliation job добавляет недостающие строки после симулированного разрыва AMI | integration | новый `callcenter-queuelog-reconciler.service.spec.ts` | ❌ Wave 1 |
| Bug fix (agentTransfer) | Blind transfer вызывает `Redirect` с channel name, не CallerID | unit | обновить существующий `callcenter.service.spec.ts` | ✅ файл есть, тест нужно добавить |
| D-41b (MCP tools) | `CallCenterAiAdapter` регистрирует инструменты, handler получает `vpbxUserUid` параметром (не closure) | unit | новый `callcenter-ai.adapter.spec.ts` (по образцу `phonebooks-ai.adapter.spec.ts`) | ❌ AI-ready волна |
| D-14 (WebRTC) | `useWebRTCPhone` регистрируется/принимает звонок (мок SIP.js транспорта) | unit + manual | новый frontend spec + ручной сценарий с реальным Asterisk PJSIP WSS | ❌ WebRTC волна |
| D-26 (display-token) | Wallboard-токен даёт доступ ТОЛЬКО к read-only SSE, не к agent/supervisor actions | integration | новый `callcenter-sse.controller.spec.ts` (display-token branch) | ❌ Wallboard волна |
| D-33 (reports) | Каждый из 7 отчётов возвращает корректную агрегацию на фикстуре `cc_queue_calls` | integration | новый `callcenter-reports.service.spec.ts` | ❌ Reports волна |
| D-34 (export) | CSV/XLSX/PDF файлы генерируются без ошибок и содержат ожидаемые заголовки | unit | новый export spec (snapshot на структуру, не на байты файла) | ❌ Reports волна |
| D-30-32 (chat) | Сообщение отправляется REST → доставляется через SSE тому же tenant-фильтру | integration | новый `callcenter-chat.controller.spec.ts` | ❌ Chat волна |

### Sampling Rate

- **Per task commit:** `npm run test:cc` (быстрый CC-scoped прогон, backend + frontend)
- **Per wave merge:** `npm run lint && npm run test:backend && npm run test:frontend` (полный verify-протокол проекта, согласно AGENTS.md)
- **Phase gate:** Full suite green перед `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `callcenter-metrics.service.spec.ts` — покрывает D-05/D-06/D-07 (аккумуляторы, per-queue+tenant SLA)
- [ ] `callcenter-history-writer.service.spec.ts` — покрывает D-09
- [ ] `callcenter-queuelog-reconciler.service.spec.ts` — покрывает D-05 (backfill)
- [ ] `callcenter-ai.adapter.spec.ts` — покрывает D-41b, по образцу существующего `phonebooks-ai.adapter.spec.ts`
- [ ] Дополнение существующего `callcenter.service.spec.ts` — regression-тест на `agentTransfer` channel bug
- [ ] Framework install: не требуется (Jest/Vitest уже настроены и покрывают CC-модуль)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | yes | Существующий `JwtAuthGuard` для agent/supervisor API; для wallboard — отдельный display-token guard (НЕ JWT сессии, см. Pitfall 5) |
| V3 Session Management | yes | JWT для operator/supervisor сессий (существующий паттерн); display-token — долгоживущий opaque токен с собственным revoke-механизмом (нужен endpoint для супервизора "отозвать токен") |
| V4 Access Control | yes | RBAC уже в контроллере (`assertSupervisor` helper, level 2 vs 3+); D-38 требует построить то же на фронтенде (Sidebar role-filter — сейчас полностью отсутствует, см. Gap Analysis) |
| V5 Input Validation | yes | NestJS DTO validation (class-validator, существующий паттерн проекта) для новых DTO (card templates, chat messages, report filters) |
| V6 Cryptography | yes | Переиспользовать существующий AES-256-GCM паттерн `notification-integration.model.ts` для любых новых секретов — НЕ вводить новый криптослой |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| Cross-tenant утечка через замыкание `vpbxUserUid` в MCP tool handler | Elevation of Privilege / Information Disclosure | Handler получает `vpbxUserUid` строго параметром вызова (D-23 паттерн, уже задокументирован в кодовой базе как исправленный баг) |
| Display-token (wallboard) утечка/эскалация до полноценной сессии | Elevation of Privilege | Отдельный guard, который валидирует ТОЛЬКО read-only доступ к SSE-топику конкретного tenant, не пересекается с `JwtAuthGuard`-защищёнными agent/supervisor endpoints |
| Webhook payload injection (Call Card → CRM, D-13) через произвольные поля карточки | Tampering | `applyTemplate` уже делает строковую подстановку без `eval`/произвольного JS — сохранить этот принцип при расширении `vars`, не переходить на шаблонизатор с произвольным кодом (например `handlebars` с helpers) |
| DoS через флуд batched-writer буфера (искусственный AMI event flood) | Denial of Service | Buffer с hard cap (например 5000 записей) — при превышении логировать warning и начинать сбрасывать самые старые записи, не расти неограниченно в памяти процесса |
| SSE-соединение без токена (missing/expired auth) | Spoofing | Существующий паттерн уже проверяет токен в query param при подключении — сохранить, для display-token добавить отдельную проверку "не истёк / не отозван" |

## Sources

### Primary (HIGH confidence)
- Прямое чтение кода репозитория: `packages/backend/src/modules/callcenter/*.ts`, `packages/backend/src/modules/ami/ami.service.ts`, `packages/backend/src/modules/ari/*.ts`, `packages/backend/src/modules/voice-robots/*.ts`, `packages/backend/src/modules/notifications/*.ts`, `packages/backend/src/modules/phonebooks/phonebooks-ai.adapter.ts`, `packages/backend/src/modules/ai-platform/*.ts`, `packages/backend/src/modules/mcp/mcp-tools.service.ts`, `packages/backend/src/modules/queues/queue.model.ts`, `packages/backend/src/modules/system-settings/system-setting.model.ts`, `packages/backend/src/modules/cloud-admin/billing/*.ts`.
- Прямое чтение фронтенд-кода: `packages/frontend/src/features/callcenter/**`, `packages/frontend/src/pages/CallCenter*Page/**`, `packages/frontend/src/widgets/Sidebar/Sidebar.tsx`, `packages/frontend/src/features/dialplan-apps/ui/DialplanAppsEditor/**`, `packages/frontend/package.json`.
- `npm view sip.js version` — подтверждено `0.21.2`.
- Внешний проект (по требованию D-45): `c:/Users/Professional/WebstormProjects/aiPBX_backend/src/assistants/assistants.service.ts`, `c:/Users/Professional/WebstormProjects/aiPBX_backend/src/ai-analytics/ai-analytics.service.ts`.
- `.idea/call-center/CALLCENTER_MODULE_PLAN.md`, `CC_WORKSPACES_CONCEPT.md`, `CC_CALL_CARD_CONCEPT.md`, `CC_WEBRTC_CONCEPT.md`, `.docs/CALLCENTER_MODULE.md`, `07-CONTEXT.md`, `07-UI-SPEC.md`, `packages/backend/.idea/ARCHITECTURE.md`, `packages/frontend/.idea/ARCHITECTURE.md`.

### Secondary (MEDIUM confidence)
- Общеизвестный формат Asterisk `queue_log` (ENTERQUEUE/CONNECT/ABANDON/COMPLETECALLER и т.д.) — из общего знания Asterisk-документации, не верифицировано напрямую по `queue_log.conf` целевого сервера в этой сессии.
- `exceljs` как рекомендация для XLSX — на основе широкой известности библиотеки в экосистеме Node.js, версия не проверена `npm view` в этой сессии (рекомендовано сделать перед install).

### Tertiary (LOW confidence)
- Численные оценки нагрузки `cc_agent_events` (50-100k строк/день) — экстраполяция из design constraint без доступа к реальным продакшн-данным (см. Assumptions Log A2).
- Возраст/downloads/source-repo пакетов в Package Legitimacy Audit — training knowledge, не проверено registry API/GitHub напрямую.

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — все ключевые библиотеки (`@dnd-kit`, `recharts`, `@tanstack/react-table`, `@react-pdf/renderer`) уже верифицированы прямым чтением `package.json`; `sip.js` версия подтверждена `npm view`.
- Architecture (real-time pipeline, AI-ready patterns): HIGH — основано на прямом чтении рабочего кода (`CallCenterStateService`, `PhonebooksAiAdapter`, `voice-robots` ARI/RTP pipeline), не на предположениях.
- Load analysis / rollup threshold: MEDIUM — методология обоснована (индексы, tenant-scoping, гибридная агрегация), но конкретные числа объёма событий — оценка, требует калибровки в проде.
- queue_log reconciliation: MEDIUM-LOW — формат событий общеизвестен, но конкретный backend (файл vs realtime-таблица) на целевой инсталляции не верифицирован — явный Open Question для Wave 1.
- Pitfalls (agentTransfer bug, AMI reconnect gap, Sidebar role-filter absence): HIGH — найдены прямым чтением кода, не предположение.

**Research date:** 2026-07-15
**Valid until:** ~30 дней для архитектурных решений (стек стабилен); queue_log-специфика должна быть перепроверена НЕМЕДЛЕННО в начале Wave 1 непосредственно на целевой Asterisk-инсталляции (не зависит от "срока действия" research, а от конкретной инфраструктуры).
