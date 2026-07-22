# Phase 9: Call Center Agent Panel — softphone widget & professional call control - Research

**Researched:** 2026-07-22
**Domain:** Real-time call-center agent desktop (React FSD frontend + NestJS/AMI backend), WebRTC/SIP softphone widget, AMI event extension (agent-channel KPIs, ChanSpy, ConfBridge, Park, DeviceState/BLF), granular permissions, notification matrix
**Confidence:** HIGH (existing codebase patterns, verified by direct file reads) / MEDIUM (exact AMI event field names for ChanSpy/Park/DeviceState — verified against `asterisk-manager` usage in this repo, not against a live Asterisk instance) / LOW (auto-pause rule-engine algorithms, zombie-call detection heuristic — flagged as `[ASSUMED]`, explicitly deferred to planner/Claude's discretion per CONTEXT.md D-15)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (D-01…D-46 — copied verbatim, condensed headers preserved)

**Layout / вкладки / кастомизация**
- **D-01:** Софтфон — плавающий виджет внизу справа (FAB → разворачивает dialpad), НЕ доминирующая карточка. + индивидуальная настройка оператора: показывать/скрывать/где размещать софтфон.
- **D-02:** Окно входящего вызова — slide-in toast-карточка (не блокирует работу со списками).
- **D-03:** Кнопки управления вызовом — основные в верхнем статус-баре (как просил пользователь) + полный набор в окне вызова/виджете.
- **D-04:** Три области — гибрид: на широком экране панели рядом, на узком — вкладки; везде тоглы видимости.
- **D-05:** Конфиг интерфейса: role default + per-operator override. Глубина MVP — только видимость вкладок/карточек on/off + размещение софтфона (без reorder/DnD в этой фазе).
- **D-06:** Настраивают и админ/супервизор (задаёт default для роли + локи), и оператор (меняет разрешённое). UI в двух местах.
- **D-07 [Claude's discretion → locked in 09-UI-SPEC.md]:** Дефолтная вкладка при входе — **Waiting** (see UI-SPEC Surface 4).

**KPI / статусы**
- **D-08:** Источник KPI по ВСЕМ звонкам — расширить AMI-слушатель на каналы оператора (DialBegin/DialEnd/Hangup, direction + disposition), не только queue-события.
- **D-09:** Нужен детальный исторический журнал действий оператора (смены статусов, звонки, пропуски) — на базе `cc_agent_events` + `agent-detail`; для построения отчёта детализации работы оператора.
- **D-10:** «Пропущенный» у оператора: раздельно — персональный пропущенный (−) и общий queue-missed раздел (который операторы отрабатывают). In-queue ring-no-answer НЕ считается персональным пропущенным и НЕ попадает в инструмент пропущенных.
- **D-11:** Сброс счётчиков в статус-баре — показывать И за смену, И за день (два числа).
- **D-12:** Исходящие — отдельные счётчики: принято (вход) / совершено (исход) / пропущено.
- **D-13:** Набор статусов — полный: READY(«Ожидание звонка») / PAUSED / IN_CALL / RINGING / WRAPUP / OFFLINE + **DIALING** (исходящий) + **CONSULT** (attended/консультация) + **ACW** (пост-обработка, отдельно от WRAPUP).
- **D-14:** Длительность статусов — live-таймер текущего статуса в статус-баре + накопление длительностей для отчёта. Индикатор разговора максимально информативный: из очереди → какая очередь; персональный/исходящий → тип + номер/имя собеседника.
- **D-15:** Авто-паузы — RONA (авто-пауза после пропущенного queue-звонка) + гибко настраиваемые правила: по количеству пропущенных, по времени бездействия, по длительности статуса. Алгоритмы проработать на research/plan.

**Умный модуль пропущенных**
- **D-16:** Группировка по номеру: одна строка = номер + счётчик попыток + время последней (с раскрытием в историю попыток).
- **D-17:** «Клиент сам перезвонил» — авто-закрытие записи при последующем отвеченном (любым) звонке с этого номера + сохранять пометку «клиент сам перезвонил».
- **D-18:** «Оператор перезвонил» (callback-flow): клик «перезвонить» → для PJSIP originate на номер оператора, при ответе (или авто-ответ через SIP header Call-Info) → набор цели; для WebRTC — прямой звонок. Разговор >5с = успешный перезвон (mark called_back); недозвон или <5с = «попытка», запись остаётся в пропущенных.
- **D-19:** Владение: гибрид — персональные (прямые/внутренние на оператора) = мои; queue-missed = общий пул с claim. Персональные помечены отлично от queue; для внутренних абонентов подставлять имя звонившего.
- **D-20:** Scope инструмента: queue-abandoned + персональные (прямые на оператора/внутренние); in-queue ring-no-answer исключён.

**ChanSpy / прослушка**
- **D-21:** Два флага максимального контроля: can_spy (может слушать) и spyable (его можно слушать).
- **D-22:** Режимы — granular по праву/уровню (оператор MVP: listen; whisper/barge — по праву/супервизор).
- **D-23:** Кто кого: коллега ↔ коллега в пределах общих очередей, если цель spyable; супервизор — шире (в пределах назначенных очередей).
- **D-24:** Приватность: listen — тихо (классика QA) + аудит-лог кто кого слушал.

**Права управления чужими звонками**
- **D-25:** Scope супервизора — только назначенные очереди (не весь tenant).
- **D-26:** Управление чужими звонками (hangup/transfer/redirect) — только supervisor+ (без «оператора-лида»).
- **D-27:** Оператор управляет только своим активным звонком (hangup/hold/transfer/mute/DTMF) + pickup из своих очередей + сброс «зависшего» (zombie) звонка (канал без BYE, висящий в core show channels и в панели).

**Call-control set**
- **D-28:** Включаем в фазу: сброс zombie-звонка, warm transfer в очередь, конференция 3-way (ConfBridge), парковка (park/retrieve), client-aware click-to-call. Запись по требованию — отложена в отдельную фазу.
- **D-29:** Click-to-call client-aware: WebRTC = прямой звонок; PJSIP (софтфон/аппарат) = originate на оператора, затем на цель (авто-ответ через SIP header Call-Info). Та же схема, что callback пропущенных (D-18).
- **D-30:** Приоритет MVP; тяжёлые фичи планировщик раскладывает по waves, остаток при необходимости в backlog.

**Вкладка Очереди**
- **D-31:** Метрики per-queue: общий принято/пропущено + waiting/talking/SLA + число свободных операторов; warning если свободных <50%, danger если 0. + личные принял/пропустил оператора по очереди.
- **D-32:** Период — смена + день (согласовано с KPI).
- **D-33:** Действия: пауза/снятие паузы per-queue, войти/выйти из очереди (если разрешено), переход к waiting этой очереди, перевод текущего активного звонка в эту очередь (warm transfer to queue).

**История звонков оператора**
- **D-34:** Контент — все направления (вход queue+персональные, исход, пропущенные) с типом/направлением + click-to-callback из истории + доступ к карточке звонка.
- **D-35:** Источник — `cc_call_history` (расширить, чтобы содержал ВСЕ звонки: входящие/исходящие/персональные/внутренние, не только queue) + фильтр по оператору/дню.

**Справочник для перевода**
- **D-36:** Сущности — внутренние абоненты (endpoints) + очереди + группы вызовов.
- **D-37:** Presence/BLF — AMI DeviceState/ExtensionState → SSE (real-time занятость абонента); для очередей/групп — число свободных из CC-state.

**Права (модель хранения)**
- **D-38:** Хранение granular-прав — расширить `operator_settings` (per-operator) + role defaults в `cc_settings`.
- **D-39:** Модель — роль = набор прав (default) + переопределение на оператора.
- **D-40:** UI прав — оба: массовая таблица операторы × права + модалка на оператора.

**Уведомления**
- **D-41:** Подраздел «Уведомления» в настройках оператора — матрица событие × канал: чат-сообщение / звук / всплывающее окно. Гибко и кастомизируемо.
- **D-42:** События (мин.): входящий, пропущенный + опционально SLA/порог очереди, новый пропущенный в общем пуле, чат, «вас подключили» (whisper/barge). Каналы: звук + browser notification (когда вкладка скрыта) + in-app toast.
- **D-43:** Конфиг — per-operator (`operator_settings`) + role default/локи.

**i18n / производительность / mobile**
- **D-44:** i18n — ru + en для всех новых строк.
- **D-45:** SSE — троттлинг/батчинг событий + дельты (не слать полный стейт), особенно для BLF/presence и per-operator метрик.
- **D-46:** Mobile — полноценный mobile-first rework АРМ в этой фазе (переиспользуя наработки Phase 8: sticky softphone / bottom bar как отправную точку).

### Claude's Discretion
- Дефолтная вкладка при входе (D-07) — **already resolved** in `09-UI-SPEC.md` Surface 4 → **Waiting**, static default, no "remember last tab" for MVP.
- Конкретные алгоритмы гибких авто-пауз (D-15) — see `## Common Pitfalls` → Pitfall "Auto-pause rule engine scope creep" and `## Open Questions` #1 below.
- Точная схема расширения `cc_call_history`/`cc_agent_events` под не-queue звонки — see `## Architecture Patterns` → Pattern "Unified call-history row" and `## Code Examples`.
- Разбиение на waves и порядок (MVP-first) — see `## Architectural Responsibility Map` and the wave-sequencing guidance embedded in `## Architecture Patterns`.

### Deferred Ideas (OUT OF SCOPE)
- Запись разговоров по требованию (start/stop) — отдельная фаза.
- Полный drag/resize настраиваемый dashboard (перестановка/ресайз панелей) — отдельная фаза; здесь только видимость + размещение софтфона.
- Тяжёлая аналитика/дашборды по операторам — пересекается с Phase 7 `/callcenter/reports`; backlog.
- Полный редизайн АРМ супервизора — отдельно (кроме пересечения прав hangup/chanspy).
- Исходящий обзвон / campaign dialer — backlog (click-to-call входит, кампании — нет).

### UI Design Contract (from `09-UI-SPEC.md` — binding, not re-litigated here)
- No shadcn CLI in this repo; hand-built Radix wrappers in `shared/ui`. **New component required: `shared/ui/Tabs`** wrapping `@radix-ui/react-tabs` (already an installed dependency — see `## Package Legitimacy Audit`, no new npm install needed).
- Reuse `shared/ui/Sheet`, `shared/ui/SegmentedControl`, `shared/ui/DataTable`, `shared/ui/Switch`, existing `--color-*` tokens. No new design tokens.
- Full locked surface specs (status bar, softphone widget FAB, incoming-call toast, hybrid tabs/panels, Coworkers/Queues/Waiting rows, missed-calls module, call-control additions, transfer directory, call history, settings screens, mobile rework, motion/a11y) — planner MUST re-read `09-UI-SPEC.md` directly; not duplicated here to avoid drift between two documents. Treat `09-UI-SPEC.md` Surfaces 1–13 as equally binding as this file.
</user_constraints>

## Summary

This phase reworks `CallCenterAgentPage.tsx` (currently a 4-zone `useState`-driven orchestrator with an ad hoc mobile tab switcher) into a tabbed/panelled workspace built on a new `shared/ui/Tabs` primitive, with the softphone demoted from a dominant call card to a floating FAB widget. The frontend work is almost entirely **new composition of already-installed dependencies** (`@radix-ui/react-tabs`, `@dnd-kit/*`, `motion`, `lucide-react`, `sip.js@0.21.2`) — **no new npm packages are required for this phase**, which simplifies the Package Legitimacy Audit to "N/A, no installs".

The harder, higher-risk half of the phase is **backend**: the AMI listener (`callcenter-ami.service.ts`) today only understands **Queue\*-prefixed events** (`QueueCallerJoin/Leave/Abandon`, `AgentConnect/Complete`, `QueueMemberStatus/Added/Removed/Pause`, plus generic `Hold`/`Unhold`). It has **zero visibility into non-queue channels** — no `Dial`/`DialBegin`/`DialEnd` listener, no `Newchannel`/`Hangup` correlation to an agent, no `ChanSpy` support beyond a one-way supervisor `Originate`, no `Park`/`ConfBridge`/`DeviceState` actions in `AmiService` at all. D-08 (all-channel KPI), D-21…D-24 (peer ChanSpy), D-28 (conference/park/zombie-reset), D-36/D-37 (presence/BLF), and D-38…D-40 (granular permissions) are **net-new backend surfaces**, not extensions of existing endpoints. The granular-permissions model (`can_spy`, `spyable`, `spy_modes`, `click_to_call`, `customize_ui`) does not exist anywhere in the codebase today (`Grep` returned zero matches) — it must be designed from scratch on top of the existing `CcOperatorSettings` / `CcSettings` role-default pattern already used for `pickup_enabled` etc.

**Primary recommendation:** Treat this as two parallel tracks that meet at the SSE/REST boundary — (1) **backend AMI/permission/history extension** (new AMI event handlers for agent-channel Dial/Hangup, new `AmiService` action wrappers for `ChanSpy`/`Redirect`/`Park`/`ParkedCalls`/`DeviceState`/`ConfBridge`-via-`Originate`, new `cc_operator_permissions`-style columns or JSON blob, extended `cc_call_history`/`cc_agent_events` schemas) and (2) **frontend composition** (new `shared/ui/Tabs`, softphone FAB widget, incoming-call toast, three tab/panel bodies, missed-calls grouping UI, transfer directory, settings screens) — following the exact multi-tenant (`vpbx_user_uid` / `parseQueueTenant`), SSE-delta (`emitEvent` + `_eventId`), and RTK-Query (`rtkApi.injectEndpoints`) idioms already established in Phase 7/8 call-center code. Do not invent a second state-management or event-transport mechanism.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Softphone widget UI (FAB, dialpad, call controls) | Browser / Client | — | Pure React composition over existing `useWebRTCPhone` hook; no new backend surface |
| Status bar KPI counters (answered/made/missed, shift·day) | API / Backend (compute) | Browser (render) | Counters must be derived once server-side (`CallCenterMetricsService`-style accumulator) and pushed via SSE — computing dual shift/day counters independently in the browser from raw events would drift on reconnect/refresh |
| All-channel AMI listening (Dial/Hangup on agent channels) | API / Backend | — | AMI is a persistent backend TCP connection (`AmiService`); browser has no access to Asterisk events except via SSE relay |
| ChanSpy / peer listen-whisper-barge | API / Backend | Browser (mode picker UI) | Requires AMI `Originate`/`ChanSpy` app invocation + permission check (`can_spy`/`spyable`) — must never be client-enforced only |
| Granular permissions (can_spy, spyable, spy_modes, click_to_call, customize_ui) | API / Backend (storage + enforcement) | Browser (settings UI) | Same pattern as existing `pickup_enabled` — DB-backed, enforced in service layer, UI only reflects/edits it |
| UI customization (tab/panel visibility, softphone placement) | API / Backend (persistence) | Browser (render + toggle) | Must persist per-operator (`CcOperatorSettings`) + role-default (`CcSettings`) so it survives refresh/device change, exactly like `pickup_enabled`/`auto_answer` today |
| Missed-calls grouping by number, callback flow | API / Backend (aggregation + originate) | Browser (list UI, claim action) | Grouping/callback success (>5s) determination must be server-computed from `cc_missed_calls`/call-history rows, not client-side, so multiple operators see consistent claim state |
| Transfer directory presence (BLF) | API / Backend (AMI DeviceState + SSE push) | Browser (render dot) | `DeviceState`/`ExtensionState` are AMI-only concepts; browser only renders the pushed dot color |
| Call history panel | API / Backend (`cc_call_history` extension + query) | Browser (render, filter) | History must be DB-backed for shift/day filter and click-to-callback; in-memory state is transient |
| Notification matrix (event × channel) | API / Backend (config storage) | Browser (Notification API, sound, toast) | Config is per-operator DB row; the actual browser Notification / sound playback is unavoidably client-side (existing `useCallNotifications` pattern) |
| Zombie-call reset | Browser (trigger) | API / Backend (AMI Hangup by channel) | Detection heuristic can be either tier (see Pitfall below); the destructive action itself must go through the existing `agentHangup`-style backend endpoint, never a raw AMI call from the browser |

## Standard Stack

### Core
No new runtime libraries are required. This phase is implemented entirely with packages already present in `package.json` (verified below).

| Library | Version (installed) | Purpose | Why Standard (for this phase) |
|---------|---------|---------|--------------|
| `@radix-ui/react-tabs` | `^1.1.3` [VERIFIED: package.json] | Backs the new `shared/ui/Tabs` primitive required by `09-UI-SPEC.md` | Already a dependency (unused today — `Grep` confirms no existing `shared/ui/Tabs` folder) — matches ARCHITECTURE.md's "Radix primitives wrapped in shared/ui" rule; do not hand-roll tab logic |
| `@dnd-kit/core` | `^6.3.1` [VERIFIED: package.json] | Coworkers-tab click-to-transfer / existing `DragTransfer` drag target reuse | Already used by `features/callcenter/ui/DragTransfer/DragTransfer.tsx`; extend, don't replace |
| `sip.js` | `0.21.2` [VERIFIED: package.json, exact pin per Phase 7 D-14] | WebRTC softphone widget (hold/mute/DTMF/blind+attended transfer already implemented in `useWebRTCPhone.ts`) | Exact-pinned per STATE.md Phase 7 decision; do not bump minor/major without a fresh supply-chain check |
| `motion` | `^12.6.3` [VERIFIED: package.json] | FAB pulse animation, toast slide-in (UI-SPEC Motion & Accessibility section) | Already the project's animation library; reuse existing `@keyframes pulse`/`fadeIn` SCSS conventions before reaching for `motion` JS API |
| `lucide-react` | `^0.475.0` [VERIFIED: package.json] | All new icons (PhoneIncoming/PhoneOutgoing/PhoneMissed, Users/List/UsersRound for transfer directory, etc.) | Project-wide icon rule; emoji icons are strictly forbidden |
| `asterisk-manager` | `^0.2.0` [VERIFIED: package.json] | Backend AMI client — new `ChanSpy`/`Park`/`ConfBridge`/`DeviceState` actions are additional `this.action({...})` calls through the existing `AmiService.action()` wrapper | Same library already used for every existing AMI call in this codebase; no alternative library needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `rxjs` | `^7.8.1` [VERIFIED: package.json] | `CallCenterStateService`'s `Subject`-based SSE fan-out already used for all CC events | Reuse `emitEvent()`/`getTypedEventStream()` for every new event type (agent-channel KPI deltas, BLF presence, permission changes) — do not create a second event bus |
| `sequelize-typescript` | `^2.1.6` [VERIFIED: package.json] | New/extended models: permissions columns, missed-call grouping fields, call-history direction/type columns | Follow the exact `@Table`/`@Column` + `field: 'vpbx_user_uid'` tenant pattern used by every existing `Cc*` model |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Extending `AmiService` with typed action wrappers (`chanSpy()`, `park()`, `deviceStateList()`) | Calling `this.amiService.action({...})` inline from `callcenter.service.ts` (as already done for `Redirect`) | Inline calls are the existing pattern (`supervisorSpy` already does raw `originate()` + literal `ChanSpy(...)` app string) — for consistency, **prefer adding thin named wrapper methods to `AmiService`** for the genuinely new action types (`Park`, `DeviceStateList`) so they're discoverable/testable, but keep `Redirect`-style ad hoc `action()` calls for one-off dialplan-app invocations that mirror existing code |
| Building a new "AgentChannelTracker" listener class | Extending `CallCenterAmiService` with new handler methods (`handleDialBegin`, `handleNewchannel`, `handleAgentHangup`) registered in `AmiService`'s constructor block | A second listener class would duplicate the `resolveQueueTenant`/`stateService` wiring already in `CallCenterAmiService`; extend the existing class instead — it is already the single source of truth for "AMI event → CC state" |
| Client-side ChanSpy mode gating only | Server-side `can_spy`/`spyable`/`spy_modes` check in `callcenter.service.ts` before calling AMI, UI only reflects it | D-24 requires an audit log and privacy guarantee — this cannot be a UI-only gate; mirrors existing `assertSupervisor()` pattern but scoped to assigned queues (D-25) |

**Installation:**
No `npm install` is needed for this phase. If the planner discovers a genuine gap during implementation (unlikely given the audit above), re-run the Package Legitimacy Gate before adding anything.

**Version verification (ecosystem registry check performed 2026-07-22):**
```
@radix-ui/react-tabs   → 1.1.3 already resolved in package-lock (installed, unused)
@dnd-kit/core          → 6.3.1 already resolved in package-lock (installed, used by DragTransfer)
sip.js                 → 0.21.2 exact-pinned (Phase 7 D-14 decision, STATE.md) — do not bump
asterisk-manager       → 0.2.0 already resolved in package-lock (installed, used by AmiService)
```
All four are read directly from `packages/frontend/package.json` / `packages/backend/package.json` (already installed in `node_modules` per lockfile) — `[VERIFIED: package.json]`, not a registry lookup for new installs.

## Package Legitimacy Audit

**Not applicable — this phase installs zero new external packages.** Every capability required by `09-CONTEXT.md` D-01…D-46 and `09-UI-SPEC.md` is implementable with dependencies already present in `packages/frontend/package.json` and `packages/backend/package.json` (see Standard Stack table above, all four flagged `[VERIFIED: package.json]`). The planner must not add a slopcheck/registry-audit task for this phase; if a future task discovers a genuine new-package need mid-implementation, it must trigger the full Package Legitimacy Gate protocol at that time, not skip it.

**Packages removed due to slopcheck [SLOP] verdict:** none — no packages were proposed.
**Packages flagged as suspicious [SUS]:** none.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────── BROWSER (CallCenterAgentPage) ───────────────────────────┐
│                                                                                       │
│  useCallCenterSSE() ──EventSource──▶ callCenterSlice (Redux)                        │
│        ▲                                    │                                       │
│        │                              selectors (memoized)                          │
│        │                                    ▼                                       │
│  ┌─────┴──────┐   ┌──────────────┐   ┌──────────────────┐   ┌────────────────────┐ │
│  │ StatusBar  │   │ shared/ui    │   │ Coworkers /      │   │ Softphone Widget    │ │
│  │ (D-11..14) │   │ /Tabs (NEW)  │──▶│ Queues / Waiting │   │ (FAB → Sheet/Popover)│ │
│  │ KPI+status │   │ desktop:panels│   │  tab bodies      │   │ useWebRTCPhone()    │ │
│  └────────────┘   │ phone: tabs   │   └──────────────────┘   └──────────┬──────────┘ │
│                    └──────────────┘                                     │            │
│  Incoming-call toast (non-modal) ◀──────── agentUpdate/callNew SSE ─────┘            │
│                                                                                       │
│  RTK Query mutations (agentLogin/pause/transfer/pickCall/spy/park/conference/...)    │
└───────────────────────────────────────┬───────────────────────────────────────────────┘
                                         │ REST POST (JWT)               ▲ SSE push
                                         ▼                               │
┌────────────────────────── NestJS Backend (packages/backend) ───────────┴─────────────┐
│  CallCenterController ──▶ CallCenterService ──▶ AmiService.action({...})            │
│         │                       │                        │                          │
│         │                       ▼                        ▼                          │
│         │             CallCenterStateService     Asterisk AMI (persistent TCP)      │
│         │             (in-memory agents/queues/    │  Dial* / Hangup / ChanSpy /     │
│         │              calls Map + RxJS Subject)   │  QueueMember* / Hold/Unhold /   │
│         │                       │                  │  Park / DeviceState            │
│         │                       ▼                  ▼                                │
│         │              CallCenterAmiService.handle*(evt) ◀── ami.on('eventname')     │
│         │                       │                                                    │
│         ▼                       ▼                                                    │
│  CallCenterSseController   CallCenterHistoryWriterService ──▶ cc_call_history        │
│  (per-tenant SSE stream)   CallCenterMetricsService ──▶ cc_daily_agent_stats         │
│                                                                                        │
│  NEW surfaces this phase: agent-channel Dial listener, ChanSpy/Park/DeviceState AMI   │
│  wrappers, permission checks (can_spy/spyable/spy_modes), missed-call grouping query, │
│  UI-customization + notification-matrix settings endpoints                           │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

A reader can trace the primary "operator answers a call and a colleague spies on it" use case: browser REST → `CallCenterController` → `CallCenterService` → `AmiService.action()` (ChanSpy via `Originate`) → Asterisk executes → AMI events flow back through `ami.on(...)` → `CallCenterAmiService.handle*` → `CallCenterStateService.setAgent/setCall` → `emitEvent()` → `CallCenterSseController` → browser `EventSource` → `callCenterSlice` → selectors → UI.

### Recommended Project Structure

No new top-level folders. Extend existing FSD locations:

```
packages/frontend/src/
├── shared/ui/Tabs/                          # NEW — Tabs.tsx + Tabs.module.scss + index.ts (Radix wrapper)
├── features/callcenter/
│   ├── ui/
│   │   ├── SoftphoneWidget/                 # NEW — FAB + Sheet/Popover, wraps existing useWebRTCPhone + DtmfKeypad
│   │   ├── IncomingCallToast/               # NEW — non-modal slide-in (Surface 3)
│   │   ├── CoworkersTab/                    # NEW — extends colleague row + ChanSpy mode picker
│   │   ├── QueuesTab/                       # NEW — per-queue card (D-31), reuse queueTable visual pattern
│   │   ├── WaitingTab/                      # NEW — extract existing queueMonitor table into its own tab body
│   │   ├── TransferDirectory/               # NEW — unified endpoints+queues+groups searchable list (D-36/D-37)
│   │   ├── CallControlBar/                  # NEW — status-bar inline controls (Surface 1) shared by widget + bar
│   │   ├── ParkedCallsIndicator/             # NEW — badge + list (D-28 park/retrieve)
│   │   ├── PermissionsMatrix/               # NEW — bulk table (D-40a), reuse shared/ui/DataTable
│   │   ├── NotificationMatrixForm/          # NEW — event×channel Switch grid (D-41/D-42), same row/col pattern as PermissionsMatrix
│   │   └── MissedCallsPanel/                # EXTEND — add grouping-by-number, claim, callback success tag
│   ├── lib/
│   │   ├── useUiCustomization.ts            # NEW — reads/writes tab+softphone visibility (D-05/D-06)
│   │   └── usePermissions.ts                # NEW — reads granular rights, drives ChanSpy/click-to-call gating in UI
│   └── model/ ...                            # extend callCenterSlice/selectors for DIALING/CONSULT/ACW statuses
└── pages/CallCenterAgentPage/CallCenterAgentPage.tsx   # REWORK — orchestrator only, delegate zones to the above

packages/backend/src/modules/callcenter/
├── callcenter-ami.service.ts                # EXTEND — handleDialBegin/handleDialEnd/handleNewchannel/handleAgentHangup
├── callcenter.service.ts                    # EXTEND — peerSpy, parkCall, retrieveParkedCall, addToConference, resetZombieCall
├── models/
│   ├── operator-permissions.model.ts        # NEW (or extend operator-settings.model.ts) — can_spy/spyable/spy_modes/click_to_call/customize_ui
│   └── missed-call.model.ts                 # EXTEND — grouping fields (attempt_count, last_attempt_at, client_called_back, personal flag)
└── ../ami/ami.service.ts                    # EXTEND — chanSpy(), park(), parkedCalls(), deviceStateList(), confBridge-via-originate helpers
```

### Pattern 1: Extend `CallCenterAmiService`, never fork it

**What:** All AMI-derived CC state mutations funnel through one class's `handle*(evt)` methods, registered once in `AmiService`'s `connect()` method via `this.getCcAmiService()?.handleXyz(evt)`.
**When to use:** Every new AMI event this phase needs (`dialbegin`, `dialend`, `newchannel` for outbound/personal calls, `parkedcall`, `chanspyStart`) must add a new `handleXyz` method to the existing `CallCenterAmiService` class and a corresponding `this.ami.on('xyz', (evt) => this.getCcAmiService()?.handleXyz(evt))` registration inside `ami.service.ts`'s existing `connect()` block — right next to the current `queuecallerjoin`/`agentconnect`/`hold` registrations.
**Example:**
```typescript
// Source: packages/backend/src/modules/ami/ami.service.ts (existing pattern, lines 293-344)
this.ami.on('queuecallerjoin', (evt: any) => {
  this.getCcAmiService()?.handleCallerJoin(evt);
});
// NEW registrations follow the identical shape:
this.ami.on('dialbegin', (evt: any) => {
  this.getCcAmiService()?.handleDialBegin(evt);
});
this.ami.on('dialend', (evt: any) => {
  this.getCcAmiService()?.handleDialEnd(evt);
});
```

### Pattern 2: Tenant resolution for non-queue channels

**What:** Queue-sourced events resolve tenant via `CallCenterAmiService.parseQueueTenant(queueName)` (suffix `_<uid>` on the queue name). Non-queue channels (personal/internal/outbound dials) have **no queue name to parse** — D-08 requires KPI for these too.
**When to use:** Any new agent-channel handler (`handleDialBegin`, `handleNewchannel`) must resolve tenant from **the calling/called agent's already-known `AgentState.userUid`** (looked up by channel/interface via `stateService.getAllAgentsGlobal()`-style scan, mirroring the existing `iterateAllCalls()` helper used by `handleHold`/`handleUnhold`), not from a queue suffix that won't exist for these events.
**Example:**
```typescript
// Source: packages/backend/src/modules/callcenter/callcenter-ami.service.ts (existing pattern, lines 743-760)
// handleHold already resolves an event with NO queue context by scanning known state:
handleHold(evt: any): void {
  const channel = evt.channel || '';
  if (!channel) return;
  for (const call of this.iterateAllCalls()) {
    if (call.agentChannel === channel || call.callerChannel === channel) {
      // ... found without any queue lookup
    }
  }
}
// NEW handleDialBegin/handleAgentHangup should follow the same "scan by channel,
// resolve userUid from the matched AgentState/CallState" approach — add a
// `findAgentByChannel(channel): AgentState | undefined` helper to CallCenterStateService.
```

### Pattern 3: Dual shift/day counters (D-11/D-12/D-31/D-32)

**What:** Every KPI surface in this phase (status bar, per-queue card) needs **two numbers** for the same metric: since-shift-login and since-midnight. `CallCenterMetricsService` already has in-memory accumulators with a `restoreToday from cc_queue_calls` pattern (per STATE.md Phase 7 decision) for the day figure; the shift figure is the existing session-scoped `callsTaken` counter pattern (reset to 0 on `agentLogin`, per `handleAgentComplete`'s `callsTaken: existing.userId ? existing.callsTaken : ...` guard).
**When to use:** Do not build a third accumulator type. Extend `CallCenterMetricsService` with parallel "sinceLogin" and "sinceMidnight" counters for **answered / made / missed**, keyed the same way the existing queue metrics are keyed (`userUid:queueName` → generalize to `userUid:agentInterface` for personal-channel counters).
**Example:**
```typescript
// Source: packages/backend/src/modules/callcenter/callcenter-ami.service.ts (existing session-counter guard, lines 249-253)
callsTaken:
  existing?.userId != null && existing.userId > 0
    ? (existing.callsTaken ?? 0)          // session counter — survives across calls, reset only on login
    : (parseInt(evt.callstaken, 10) || existing?.callsTaken || 0),
```

### Pattern 4: SSE delta events, never full-state re-broadcast (D-45)

**What:** Every existing SSE event (`agentUpdate`, `queueUpdate`, `callNew/Update/End`) carries only the changed slice, tagged with a monotonic `_eventId` (`emitEvent()` in `callcenter-state.service.ts`). D-45 explicitly requires the same discipline for new BLF/presence and per-operator metric events, which are higher-frequency than existing queue events.
**When to use:** New presence events (`presenceUpdate` for DeviceState/ExtensionState) and any new counter delta must go through `CallCenterStateService.emitEvent(type, userUid, data)` exactly like existing events — never introduce a parallel WebSocket/polling channel. If volume is a concern (D-45 "throttling/batching"), batch inside the AMI handler (e.g. debounce rapid `DeviceStateChange` bursts for the same extension over ~250-500ms) before calling `emitEvent`, rather than changing the transport.
**Example:**
```typescript
// Source: packages/backend/src/modules/callcenter/callcenter-state.service.ts (lines 138-142)
emitEvent(type: string, userUid: number, data: any): void {
  this.eventSeqId++;
  this.eventSubject.next({ type, userUid, data: { ...data, _eventId: this.eventSeqId } });
}
```

### Pattern 5: Tabs primitive — build once, reuse for both breakpoints

**What:** `09-UI-SPEC.md` mandates the **same** `shared/ui/Tabs` component power both the desktop "3-column panel toggle" (if the planner interprets "panel visibility toggle" as tab-like) and the phone Coworkers/Queues/Waiting switcher. Do not build two different tab implementations for the two breakpoints.
**When to use:** Follow the project's mandatory tabs visual model from `packages/frontend/.idea/ARCHITECTURE.md` §"Паттерн табов в модалках" — **one line under the tab row, one 2px primary underline on the active tab, `margin-bottom: -1px` overlap** — even though that section's literal heading says "in modals", the rule is the project's single canonical tab visual contract and UI-SPEC explicitly says the phone switcher and desktop toggle must share one primitive.
**Example:**
```scss
/* Source: packages/frontend/.idea/ARCHITECTURE.md (canonical tabs SCSS, lines 379-423) */
.tabsWrap { margin-bottom: 1.5rem; border-bottom: 1px solid var(--color-border); flex-shrink: 0; }
.tabsRow { display: flex; gap: 0.5rem; margin-bottom: -1px; overflow-x: auto; scrollbar-width: none; }
.tab { /* ...border-bottom: 2px solid transparent... */ }
.tabActive { color: var(--color-primary); border-bottom-color: var(--color-primary); }
```

### Anti-Patterns to Avoid
- **Client-computed KPI/permission gating:** Never compute the shift/day KPI split, missed-call claim ownership, or ChanSpy eligibility purely in the browser from raw SSE events — always source the authoritative number/flag from the backend (server is the source of truth on conflict, exactly as UI-SPEC Surface 8 already specifies for the claim action).
- **Second event transport:** Do not add Socket.IO, polling, or a second `EventSource` for presence/BLF — the existing per-tenant SSE stream (`CallCenterSseController` + `getEventStreamForUser`) is the single real-time channel; extend its event vocabulary instead.
- **Raw HTML tags above `shared/ui`:** The current `CallCenterAgentPage.tsx` already violates this in a few places (raw `<div>`, `<table>`, `<input>`, `<textarea>`, `<button>` for modals/tables — e.g. lines 903, 991, 1018-1064, 1090-1163). Do not propagate this pattern into new components; new Coworkers/Queues/Waiting/Transfer-directory components must use `shared/ui` (`Table`/`DataTable`, `Input`, `Textarea`, `Button`) and SCSS modules per ARCHITECTURE.md, even where the file being replaced didn't.
- **Two floating elements on phone:** UI-SPEC Surface 2 explicitly forbids stacking the softphone FAB and the Phase-8 sticky bottom softphone bar simultaneously — collapse into the sticky bar on `<768px`, don't render both.
- **Hardcoded z-index:** ARCHITECTURE.md forbids literal `z-index` values; the FAB/toast must use `var(--z-index-toast)` etc. per UI-SPEC Surface 2.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tab switching UI | Custom `<button role="tab">` state machine (what today's `mobileSection` already is) | `shared/ui/Tabs` wrapping `@radix-ui/react-tabs` | Radix handles keyboard nav (arrow keys, Home/End), ARIA roles, and focus management for free; UI-SPEC explicitly mandates this component |
| Drag-and-drop call transfer | New DnD engine | Extend existing `DragTransfer.tsx` (`@dnd-kit/core`, already wired to `DraggableCall`/`DroppableColleague`) | Already implements the exact "drag call card onto colleague → confirm blind/attended" flow this phase's Coworkers tab needs |
| WebRTC call state machine (hold/mute/DTMF/transfer/quality) | New SIP stack integration | `useWebRTCPhone.ts` (already implements register/answer/hangup/hold/mute/DTMF/blind+attended transfer via `sip.js`) | Building a second WebRTC hook would fork call state from the one softphone instance; the widget is a **presentation** change around this hook, not a logic change |
| Dual shift/day counter math | Ad hoc `Date.now() - shiftStart` filtering in React components | `CallCenterMetricsService` accumulators (extend, per Pattern 3 above) | Metrics must be consistent across refresh/reconnect and available to the Queues tab and status bar simultaneously — client-side recomputation from partial SSE history will drift |
| Presence/BLF polling | `setInterval` REST polling of endpoint status | AMI `DeviceState`/`ExtensionState` subscription → `CallCenterStateService.emitEvent('presenceUpdate', ...)` → SSE (D-37 explicitly specifies this) | Asterisk already emits these events on every state change; polling would be both laggier and heavier load on the DB/AMI |
| Multi-tenant queue name parsing | New tenant-resolution scheme for agent-channel events | `CallCenterAmiService.parseQueueTenant()` for queue events; **new** `findAgentByChannel`-based resolution (Pattern 2) for non-queue events, but still routed through the *same* `stateService` | A second, inconsistent tenant-resolution mechanism risks leaking data across tenants — the single most safety-critical invariant in this codebase per ARCHITECTURE.md §Мультитенантность |
| Granular permission checks | Ad hoc `if (user.level >= X)` scattered in controllers | A single `PermissionsService`-style helper (new) mirroring the existing `assertSupervisor()` idiom, parameterized by right name (`can_spy`, `click_to_call`, etc.) and consulting `CcOperatorSettings`-extended row + `CcSettings` role default + lock flag | D-38/D-39 explicitly model rights as "role default + per-operator override" — a single helper prevents 6 different ad hoc override-merge implementations for 6 different rights |

**Key insight:** Every "Don't Hand-Roll" candidate above already has a first-class implementation somewhere in `packages/backend/src/modules/callcenter/` or `packages/frontend/src/features/callcenter/` from Phase 7/8. The dominant risk in this phase is not "which library to pick" (answered: none, extend existing code) but **scope discipline** — 46 locked decisions across layout, KPIs, permissions, missed-calls, ChanSpy, call-control, queues, history, directory, and notifications is enough surface area that duplicating an existing mechanism instead of extending it will fragment state and cause exactly the kind of SSE/tenant inconsistency bugs the codebase's `STATE.md` gap-closure history (Phase 7 07-19…07-22) shows this team has already had to fix once.

## Common Pitfalls

### Pitfall 1: Treating agent-channel KPI as "just another queue event"
**What goes wrong:** Implementer tries to route `DialBegin`/`DialEnd`/personal-channel `Hangup` through the existing `resolveQueueTenant(queueName)` helper, which returns `null` because there is no queue name on these events — KPI silently never updates for outbound/personal calls.
**Why it happens:** Every existing CC AMI handler assumes a queue context (`evt.queue`); D-08 explicitly requires visibility beyond that.
**How to avoid:** Resolve tenant/agent from the **channel/interface**, not the queue (see Architecture Pattern 2). Add a state-service helper that scans `agents` by matching interface substring, mirroring `iterateAllCalls()`.
**Warning signs:** Outbound call counters stuck at 0 in manual QA even though queue-sourced counters update correctly.

### Pitfall 2: ChanSpy target/spy channel confusion (existing code already has a documented gap here)
**What goes wrong:** `supervisorSpy()` today builds the spy channel from `supervisor.getDataValue('extension') || supervisor.getDataValue('login')` and always uses context `'from-internal'` — this is a supervisor-only, tenant-unaware helper. Extending it naively to "peer ChanSpy" (D-21…D-24, coworker↔coworker) without adding the `can_spy`/`spyable`/scope-to-assigned-queues (D-25) checks would let any operator spy on any other operator across tenants.
**Why it happens:** The existing method has no permission gate beyond `assertSupervisor()` at the controller layer; peer spy has no controller-layer analog yet.
**How to avoid:** New peer-spy endpoint must check, in this order: (1) both agents share a queue online right now, (2) target `spyable === true`, (3) requester `can_spy === true`, (4) requested mode ∈ requester's `spy_modes`, (5) write an audit-log row (D-24) before/after invoking AMI — mirroring the existing `LoggerService.logAction` pattern used elsewhere in the backend.
**Warning signs:** Manual QA where operator A can spy on operator B in a completely unrelated tenant/queue.

### Pitfall 3: Zombie-call detection heuristic invented ad hoc per D-28/D-27
**What goes wrong:** UI-SPEC Surface 9 explicitly says "exact detection heuristic is a backend/research concern, not this spec's" — if the planner doesn't assign an explicit task+threshold, this either never gets implemented or gets implemented with an arbitrary, untested timeout that either false-positives on legitimately long calls or never fires on a truly stuck channel.
**Why it happens:** No existing code in this repo references "zombie" or stuck-channel detection; `AmiService.getActiveChannels()` (`CoreShowChannels`) exists but nothing correlates it against CC state today.
**How to avoid:** `[ASSUMED]` — implement as: periodically (e.g. every 30-60s) diff `CallCenterStateService.getAllCallsGlobal()` against a `CoreShowChannels` AMI poll; a call is "zombie" if its `agentChannel`/`callerChannel` no longer appears in `CoreShowChannels` but the in-memory `CallState` was never removed via a `Hangup`/`AgentComplete` event within some grace window (start conservative, e.g. 2x expected max call duration or a fixed 10-minute floor) — flag it as a candidate rather than auto-clearing, and let D-27's operator self-serve reset button be the actual destructive action. See Open Question #1.
**Warning signs:** N/A yet — this is a design gap, not an observed bug.

### Pitfall 4: Missed-calls "grouped by number" breaks the existing `UNIQUE(call_uniqueid)` migration invariant
**What goes wrong:** `cc_missed_calls` has a hard `UNIQUE INDEX uq_cc_missed_calls_uniqueid (call_uniqueid)` (see `migrate-missed-calls-unique.ts`, already run/uncommitted-migration-file present in this checkout). D-16 wants "one row per **number**" with an attempt counter — a naive implementation might try to violate this unique constraint by upserting on `caller_id_num` instead, or might duplicate the whole grouping logic into every query site.
**Why it happens:** The existing schema is call-level (one row per Asterisk `uniqueid`), but the UI needs number-level aggregation.
**How to avoid:** Keep `cc_missed_calls` call-level (preserve the unique index and the existing `findOrCreate`-by-`call_uniqueid` dedupe in `persistMissedCall()`); do the **number-level grouping in the read/query layer** (`GROUP BY caller_id_num` with `MAX(created_at)` and `COUNT(*)`), returning grouped rows to the frontend. Add `client_called_back` (D-17) and a `personal` boolean (D-19, computed from whether the entry has a `queue_name` or is a direct/internal miss) as new columns rather than overloading `called_back`.
**Warning signs:** Migration errors on `ALTER TABLE ... ADD UNIQUE` if someone tries to add a second unique index on `caller_id_num`; or duplicate grouping SQL scattered across multiple service methods.

### Pitfall 5: `handleAgentComplete`'s wrapup-vs-ACW distinction (D-13) collides with existing WRAPUP semantics
**What goes wrong:** `handleAgentComplete()` today transitions straight to `WRAPUP` (or `READY` if `wrapupTimeout === 0`) after every completed call. D-13 requires **ACW** ("Постобработка") as a status **separate from WRAPUP**. If the planner treats ACW as just a renamed WRAPUP, existing wrapup-timer code (`wrapupTimers`/`wrapupDeadlines` Maps, `wrapupStart`/`wrapupExtend`/`wrapupEnd` SSE events, `WrapupBar` component, `agentWrapupDone`/`agentWrapupExtend` endpoints) either breaks or gets silently duplicated.
**Why it happens:** CONTEXT.md D-13 lists WRAPUP and ACW as two distinct members of the status enum without defining the boundary between them (both are "post-call processing").
**How to avoid:** `[ASSUMED — flag for discuss-phase/planner confirmation]` treat **WRAPUP** as the existing timer-bound post-call state (unchanged, all existing timer/SSE/UI code stays) and **ACW** as the state entered *after* WRAPUP's timer expires if the operator has not yet clicked "ready for next" AND still has an open call-card draft — i.e. ACW = "wrapup timer expired but card not yet saved", a distinct terminal state before READY. This preserves 100% of existing WRAPUP machinery and adds ACW as a new state reached only via the existing `wrapupEnd` transition point. Confirm this interpretation with the user during `/gsd-discuss-phase` follow-up or explicitly in the plan's assumptions if discuss is not re-run.
**Warning signs:** Two status enums that never disambiguate in the UI status pill; `WrapupBar` shown for both states with no distinguishing copy.

### Pitfall 6: CONSULT status vs. attended-transfer's existing "REFER/consultation leg" flow
**What goes wrong:** `useWebRTCPhone.ts`'s `attendedTransfer()` already implements a consultation-call leg via SIP REFER semantics without a dedicated `CONSULT` agent status — D-13 wants CONSULT surfaced as a first-class status. Implementer might build a parallel status-tracking mechanism instead of hooking into the existing attended-transfer call sequence.
**Why it happens:** The existing attended-transfer flow only manipulates local WebRTC session/UI state (`isHeld`, `activeSession`), never dispatches an `AgentState.status` change.
**How to avoid:** When `phone.attendedTransfer()` (or the PJSIP-mode `agentTransfer({ type: 'attended' })`) begins its consultation leg, emit a status transition to `CONSULT` (client-optimistic for WebRTC path via `effectiveStatus` memo already present in `CallCenterAgentPage.tsx`; server-authoritative for PJSIP path via a new AMI-driven or explicit-REST status update) and transition back to `IN_CALL` when the consultation resolves either way (merge vs. cancel).
**Warning signs:** Status bar shows "In Call" throughout an attended-transfer consultation instead of "Консультация".

### Pitfall 7: Auto-pause rule engine scope creep (D-15)
**What goes wrong:** "Гибко настраиваемые правила: по количеству пропущенных, по времени бездействия, по длительности статуса" is a request for a small rule engine with three trigger types, each combinable with pause duration/reason. Building this as three independent ad hoc `setTimeout`/counter checks (rather than one small declarative rule model) will make the settings UI (D-40's bulk table / per-operator modal) impossible to represent generically.
**Why it happens:** No existing "rule" concept exists in this codebase (`PauseReasonModal`/`pausedAt.maxDurationMin` is a single fixed-duration cap, not a multi-trigger rule).
**How to avoid:** Model as a small typed union stored as JSON in `CcSettings`/`CcOperatorSettings` (mirroring the existing `alert_thresholds: Record<string, number>` JSON-column pattern on `CcSettings`), e.g. `{ type: 'missed_count', threshold: N, pauseReason: string, pauseDurationSec?: number } | { type: 'idle_time', ... } | { type: 'status_duration', status: AgentStatus, thresholdSec: number, ... }`. Evaluate rules from the same place `handleCallerAbandon`/`handleAgentStatusEvent` already update state, calling `queuePause`/`stateService.setAgent` exactly like `supervisorForcePause` does today.
**Warning signs:** Settings schema needs a new migration every time a new rule "type" is added because each type got its own hardcoded columns instead of a JSON rule list.

### Pitfall 8: SSE payload growth from presence/BLF on large tenants (D-45)
**What goes wrong:** Naively emitting a `presenceUpdate` SSE event per `DeviceStateChange`/`ExtensionStatus` AMI event, for every endpoint in a tenant, on every state flap, can flood the SSE stream on a busy PBX (dozens of extensions state-changing per second during peak hours) — directly contradicting D-45's explicit throttling requirement.
**Why it happens:** DeviceState events are per-device, high frequency, and easy to wire 1:1 to `emitEvent` without thinking about volume, unlike the comparatively rare queue/agent events this pattern was designed for.
**How to avoid:** Debounce/coalesce per-extension presence changes over a short window (e.g. 250-500ms) before emitting, and/or only push presence deltas for extensions that are actually visible in an open transfer-directory session (subscribe-on-demand) rather than tenant-wide broadcast of every endpoint's state — the planner should pick one strategy explicitly rather than leaving it unaddressed, per D-45.
**Warning signs:** Browser DevTools Network tab shows an SSE event every few hundred ms even when no operator or call state has visibly changed.

## Code Examples

### Extending the AMI listener for agent-channel Dial events (D-08)
```typescript
// Source: pattern combines packages/backend/src/modules/ami/ami.service.ts (event registration, lines 293-344)
// with packages/backend/src/modules/callcenter/callcenter-ami.service.ts (handler shape, lines 211-258)

// In ami.service.ts connect(), alongside existing queue* registrations:
this.ami.on('dialbegin', (evt: any) => {
  this.getCcAmiService()?.handleDialBegin(evt);
});
this.ami.on('dialend', (evt: any) => {
  this.getCcAmiService()?.handleDialEnd(evt);
});

// In callcenter-ami.service.ts, new handler — resolves tenant from the agent's
// already-known state (no queue name available on Dial* events):
handleDialBegin(evt: any): void {
  const channel = evt.channel || '';       // originator (agent) channel
  const destChannel = evt.destchannel || ''; // dialed destination channel
  if (!channel) return;
  const agent = this.stateService.findAgentByChannel(channel); // NEW helper, mirrors iterateAllCalls()
  if (!agent) return; // not one of our logged-in agents — personal call from an unlogged extension is out of scope
  this.stateService.setAgent(agent.userUid, agent.interface, { status: 'DIALING' });
}
```

### Peer ChanSpy with permission gate (D-21…D-25)
```typescript
// Source: pattern extends packages/backend/src/modules/callcenter/callcenter.service.ts
// supervisorSpy() (lines 627-658), adding the permission + scope checks D-21..D-25 require
// that the existing supervisor-only method does not have.

async peerSpy(requesterUserId: number, targetInterface: string, mode: 'listen' | 'whisper' | 'barge', userUid: number) {
  const requesterAgent = /* resolve requester AgentState by userId, as resolveAgentInterface() already does */;
  const targetAgent = this.stateService.getAgent(userUid, targetInterface);
  if (!targetAgent || targetAgent.status !== 'IN_CALL') {
    throw new BadRequestException('Agent is not on a call');
  }
  const sharedQueue = requesterAgent.queues.some(q => targetAgent.queues.includes(q));
  if (!sharedQueue) throw new ForbiddenException('Not in a shared queue');

  const requesterPerms = await this.permissionsService.getEffective(userUid, requesterUserId);
  const targetPerms = await this.permissionsService.getEffective(userUid, targetAgent.userId);
  if (!requesterPerms.can_spy) throw new ForbiddenException('can_spy not granted');
  if (!targetPerms.spyable) throw new ForbiddenException('Target is not spyable');
  if (!requesterPerms.spy_modes.includes(mode)) throw new ForbiddenException(`Mode ${mode} not granted`);

  await this.auditLog.logAction(/* who spied on whom, mode, timestamp — D-24 */);
  const spyOptions = mode === 'listen' ? 'q' : mode === 'whisper' ? 'w' : 'B';
  await this.amiService.originate(/* requester's channel */, `Spy on ${targetAgent.name}`, 'from-internal', `ChanSpy(${targetInterface},${spyOptions})`);
  return { success: true, mode };
}
```

### Grouped missed-calls query (D-16), preserving the call-level unique index
```typescript
// Source: pattern extends packages/backend/src/modules/callcenter/callcenter.service.ts getMissedCalls()
// and preserves the UNIQUE(call_uniqueid) invariant from migrate-missed-calls-unique.ts

async getMissedCallsGrouped(userUid: number) {
  // Aggregate at the READ layer only — table stays call-level (one row per uniqueid).
  return this.missedCallModel.findAll({
    where: { user_uid: userUid, client_called_back: false },
    attributes: [
      'caller_id_num',
      [Sequelize.fn('COUNT', Sequelize.col('uid')), 'attemptCount'],
      [Sequelize.fn('MAX', Sequelize.col('created_at')), 'lastAttemptAt'],
      // personal vs queue-missed distinguished by presence of queue_name (D-19)
    ],
    group: ['caller_id_num'],
    order: [[Sequelize.literal('lastAttemptAt'), 'DESC']],
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Softphone as the dominant "Zone B" call card in `CallCenterAgentPage.tsx` | Floating FAB widget + status-bar controls + non-modal toast (D-01/D-02/D-03) | This phase (09) | Page orchestrator shrinks; three new tab bodies (Coworkers/Queues/Waiting) become the primary visual real estate instead of the call card |
| `mobileSection: 'call' \| 'team' \| 'queues'` hand-rolled tab state | `shared/ui/Tabs` (Radix) driving Coworkers/Queues/Waiting, reused on desktop panel toggle too | This phase (09) | One shared primitive instead of bespoke `<button role="tab">` markup; UI-SPEC explicitly calls out the old markup as the thing being replaced |
| READY status labeled "Ready"/"Готов" | Relabeled "Ожидание звонка"/"Waiting for call" (D-13, same enum value `READY`, label-only change) | This phase (09) | No backend enum change — only i18n string + UI-SPEC Copywriting Contract row; do not rename the `AgentStatus` union member itself, only its label |
| Queue-only AMI listening (`Queue*` prefixed events) | Agent-channel-aware listening (`Dial*`, generic `Hangup`/`Newchannel` correlated to logged-in agents) | This phase (09), first time in the codebase's history | This is the single largest backend behavior change in the phase — every downstream KPI/history feature (D-08, D-09, D-12, D-34, D-35) depends on this listener existing |

**Deprecated/outdated:** None — this phase is additive to Phase 7/8 code, not a replacement of a deprecated approach.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Zombie-call detection heuristic (poll `CoreShowChannels`, diff against in-memory state, conservative timeout floor) | Common Pitfalls #3 | If the real heuristic needs to be tighter/looser, the "Reset call" button may appear on calls that are not actually stuck, or never appear on genuinely stuck calls — low blast radius since D-27 makes this operator-triggered (self-serve), not automatic |
| A2 | ACW is "WRAPUP timer expired, card not yet saved" as a distinct terminal state before READY, reusing all existing WRAPUP timer/SSE machinery | Common Pitfalls #5 | If the user's actual mental model for ACW differs (e.g. ACW = a separate operator-toggled state independent of the wrap-up timer), the planner would need to rework the status-transition graph; recommend confirming this interpretation explicitly before/at plan-review, since it is not resolvable from CONTEXT.md text alone |
| A3 | CONSULT is entered/exited by hooking the existing attended-transfer consultation leg (`useWebRTCPhone.attendedTransfer` / PJSIP `agentTransfer({type:'attended'})`), not a separately-initiated action | Common Pitfalls #6 | If CONSULT is meant to also cover other "supervisor whispering to me" scenarios, the status source would need to include ChanSpy-whisper targets too — worth flagging to the planner as a scope question |
| A4 | Granular permissions (`can_spy`, `spyable`, `spy_modes`, `click_to_call`, `customize_ui`) are stored as new columns/JSON on `CcOperatorSettings` (per-operator) + `CcSettings` (role default) rather than a wholly separate `cc_permissions` table | Standard Stack / Don't Hand-Roll | If the planner instead needs a role-keyed (not operator-keyed) rights table because roles are shared across many operators and D-39's "role = set of rights (default) + override" implies role-level storage distinct from the tenant-singleton `CcSettings`, the schema shape would need a `cc_role_permissions` table keyed by `role` rather than reusing the tenant-singleton `CcSettings` — recommend the planner explicitly decide role-storage-location during planning, since the existing `CcSettings` model is a **tenant singleton**, not a **per-role** table, and D-39 talks about roles plural |

**If this table is empty:** N/A — see rows above.

## Open Questions (RESOLVED)

1. **Where does "role" live for D-38/D-39's role-default permission storage?**
   - What we know: `CcSettings` is a tenant-singleton (`unique on vpbx_user_uid`), used today for tenant-wide `default_sla_threshold`/`alert_thresholds`. `UserLevel` (ADMIN/SUPERVISOR/etc.) is the only existing "role" concept, defined in `users/user.model.ts`, not per-tenant-configurable.
   - What's unclear: D-39 says "роль = набор прав (default) + переопределение на оператора" — this reads as **per-`UserLevel`** defaults (e.g. all SUPERVISORs get `can_spy=true` by default), which `CcSettings`'s single-row-per-tenant shape cannot represent without adding a `role` dimension.
   - Recommendation: Planner should design a small `cc_role_permission_defaults` table (or a JSON column on `CcSettings` keyed by `UserLevel`) rather than trying to force this into the existing singleton row. Flag as a locked decision needed before implementation, or resolve via Claude's discretion in the plan with a `checkpoint:human-verify` if ambiguous.
   - **RESOLVED (09-01 Task 1/2):** Stored as a `role_permission_defaults` JSON column keyed by `UserLevel` on the tenant-singleton `cc_settings` (+ per-item `*_locks` JSON), with per-operator overrides as columns on `cc_operator_settings` — no separate `cc_role_permission_defaults` table. The merge/lock resolution is centralised in `CallCenterPermissionsService.getEffective` (09-05 Task 1); no `checkpoint` needed.

2. **Exact zombie-call detection threshold and polling cadence.**
   - What we know: UI-SPEC explicitly defers this to "backend/research concern". No existing telemetry on typical call durations in this tenant base to calibrate a safe default.
   - What's unclear: Whether a fixed threshold (e.g. 10 min) is acceptable for MVP or whether it needs to be tenant-configurable from day one.
   - Recommendation: Ship a fixed, conservative, code-level constant for MVP (per D-30 "MVP priority; heavy features to waves/backlog") with a follow-up backlog item to make it configurable if support tickets show it's too aggressive/lax.
   - **RESOLVED (09-07 Task 1):** `CallCenterZombieService` polls `CoreShowChannels` every 30-60s and flags a stuck call using a fixed, documented conservative threshold constant (≈10-min floor); it only FLAGS candidates (never auto-hangs) — the destructive reset stays operator-triggered per D-27. Tenant-configurability is deferred to backlog.

3. **ACW/CONSULT status persistence in `cc_agent_events`.**
   - What we know: `CcAgentEvent.event_type` is a fixed Sequelize `ENUM('LOGIN','LOGOUT','READY','PAUSE','CALL_START','CALL_END','WRAPUP_START','WRAPUP_END','HOLD','UNHOLD')` — adding ACW/CONSULT/DIALING as trackable timeline events requires a **migration** to extend this ENUM (MySQL `ALTER TABLE ... MODIFY COLUMN event_type ENUM(...)`), not just a TypeScript-level status union change.
   - What's unclear: Whether the planner intends full timeline/reporting visibility for these three new statuses (matching D-09's "детальный исторический журнал") or just live-state visibility without historical logging.
   - Recommendation: Given D-09 explicitly wants a detailed historical log and D-13 lists DIALING/CONSULT/ACW as first-class statuses, the ENUM migration should be treated as required, not optional — call this out explicitly as a Wave-0/early task so later waves that build reporting off `cc_agent_events` aren't blocked.
   - **RESOLVED (09-01 migration + 09-03 Task 3):** The `cc_agent_events.event_type` ENUM is extended (DIALING/CONSULT/ACW) by the 09-01 Phase-9 migration + model update (wave 1); 09-03 Task 3 writes those transitions to `cc_agent_events`, making them reportable via the existing agent-detail timeline. Treated as required, resolved in the earliest wave.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Asterisk AMI connectivity (`AMI_HOST`/`AMI_PORT`/`AMI_SECRET`) | All backend AMI extensions (ChanSpy, Park, DeviceState, Dial listeners) | Not verifiable from this static research session (no live Asterisk instance reachable from the research sandbox) | — | Existing `AmiService` already has graceful degradation (`if (!secret) { logger.warn(...); return; }` + exponential-backoff reconnect) — new AMI actions will simply reject with `'AMI not connected'` in dev/CI without a live Asterisk, exactly like every existing AMI action today; no new fallback needed, this is the established pattern |
| `asterisk-manager` npm package version behavior for `ChanSpy`/`Park`/`DeviceStateList` action responses | New `AmiService` action wrappers | `[ASSUMED]` — `asterisk-manager@0.2.0` is a thin AMI protocol client (generic `.action()` passthrough); it does not special-case action names, so `Park`/`DeviceStateList`/`ChanSpy` (invoked via `Originate` + dialplan app string, per existing `supervisorSpy` pattern) work through the exact same `.action()`/`.on(eventname, ...)` mechanism already used for every other AMI action in this codebase | 0.2.0 [VERIFIED: package.json] | None needed — no version-specific gap identified; if a specific action's response shape surprises the implementer, add a raw-event listener exactly like `pjsipShowRegistrations()` already does for multi-event AMI actions |
| Node.js 22+ / npm workspaces | Whole monorepo | ✓ (per `package.json` `engines`) | — | — |

**Missing dependencies with no fallback:** none identified — this phase adds no new external dependency.

**Missing dependencies with fallback:** Asterisk AMI live connectivity for manual QA/E2E verification of ChanSpy/Park/DeviceState behavior — cannot be verified in this research session; the planner/executor should flag any AMI action whose event/field names in this document are `[ASSUMED]` (see Assumptions Log implicit coverage) for a `checkpoint:human-verify` against a real Asterisk box during execution, consistent with how Phase 7 handled WebRTC/WSS config gaps (07-22 gap closure).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework (frontend) | Vitest `^4.1.4` [VERIFIED: package.json] + `@testing-library/react` `^16.3.2` + jsdom |
| Framework (backend) | Jest `^29.7.0` [VERIFIED: package.json] + `ts-jest`, `@nestjs/testing` |
| Config file (frontend) | none dedicated — Vitest config is implicit/inline per existing `*.test.ts(x)` files colocated with source (no `vitest.config.ts` found at repo root during this research pass; confirm via `Glob` at execution time if a dedicated config is later added) |
| Config file (backend) | `jest` block inside `packages/backend/package.json` (lines 111-127), `testRegex: ".*\\.spec\\.ts$"`, `rootDir: "src"` |
| Quick run command (frontend, CC-scoped) | `npm run test:cc -w @krasterisk/frontend` → `vitest run src/features/callcenter` |
| Quick run command (backend, CC-scoped) | `npm run test:cc -w @krasterisk/backend` → `jest --testPathPattern="modules/callcenter" --no-coverage` |
| Full suite command | `npm run test:frontend` / `npm run test:backend` (root `package.json` scripts) |

### Phase Requirements → Test Map
No formal `REQ-XX` IDs exist for this phase (`phase_req_ids: null` per orchestrator scope). Map instead against `09-CONTEXT.md` decision IDs (planner should carry these IDs into task-level verification per existing project convention — every prior CC plan cites `[D-XX]` in its task list, e.g. STATE.md's Phase 7 plan entries).

| Decision(s) | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-13 (status enum) | `AgentStatus` union includes DIALING/CONSULT/ACW; status label mapping | unit | `vitest run src/features/callcenter/model` (extend `callCenterSlice.test.ts`/`callCenterSelectors.test.ts`) | ❌ Wave 0 — add cases to existing files |
| D-08 (all-channel KPI) | `handleDialBegin`/`handleDialEnd` update agent status/counters without a queue context | unit | `jest --testPathPattern=callcenter-ami.service.spec` | ❌ Wave 0 — extend `callcenter-ami.service.spec.ts` (already exists, covers queue-event handlers) |
| D-16/D-17/D-19/D-20 (missed-calls grouping) | Grouped query returns one row per number with correct attempt count; `UNIQUE(call_uniqueid)` still enforced | unit + integration | `jest --testPathPattern=callcenter.service.spec` | ❌ Wave 0 — `callcenter.service.spec.ts` exists (verify via Glob), extend with grouping cases |
| D-21…D-25 (peer ChanSpy permission gate) | Requester without `can_spy` or target without `spyable` is rejected; cross-tenant/cross-queue rejected | unit | new spec file for permissions service + peer-spy method | ❌ Wave 0 — new file |
| D-38…D-40 (granular permissions storage/merge) | Effective permission = role default with per-operator override applied correctly; lock flag prevents operator self-override | unit | new spec file | ❌ Wave 0 — new file |
| D-01…D-07, D-46 (layout/tabs/mobile) | `shared/ui/Tabs` renders correct ARIA roles, switches panels; `CallCenterAgentPage` shows Waiting tab by default | integration (RTL) | `vitest run src/shared/ui/Tabs src/pages/CallCenterAgentPage` | ❌ Wave 0 (Tabs is new) / ✅ existing `CallCenterAgentPage.test.tsx` to extend |
| D-45 (SSE delta/throttle) | New presence/KPI SSE events carry only changed fields + `_eventId`; debounce logic coalesces rapid bursts | unit | `jest --testPathPattern=callcenter-state.service.spec` | ✅ file exists, extend |

### Sampling Rate
- **Per task commit:** `npm run test:cc -w @krasterisk/backend` and/or `npm run test:cc -w @krasterisk/frontend` (whichever side the task touched)
- **Per wave merge:** `npm run test:backend && npm run test:frontend` (full suite)
- **Phase gate:** Full suite green + `npm run lint` before `/gsd-verify-work 9`, per AGENTS.md's "Verify перед «готово»" section

### Wave 0 Gaps
- [ ] No dedicated permissions-service spec file exists yet — create `callcenter-permissions.service.spec.ts` (or fold into `callcenter.service.spec.ts` if the planner keeps permission checks inline)
- [ ] No `shared/ui/Tabs` component or test exists yet — create `Tabs.tsx` + `Tabs.test.tsx` following the existing `SegmentedControl`/`Switch` component-with-test precedent in `shared/ui`
- [ ] `cc_agent_events.event_type` ENUM migration needed before ACW/CONSULT/DIALING can be logged to the timeline (see Open Question #3) — a migration file + updated model + updated `agent-event.model.ts` ENUM list
- [ ] No existing test coverage for `AmiService`'s raw `.action()` calls with new action names (`Park`, `DeviceStateList`) — these are best covered by mocking `this.ami.action` exactly as any existing `AmiService`-dependent spec already does (check `callcenter-ami.service.spec.ts` for the mocking pattern used against `AmiService`)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (unchanged) | Existing `JwtAuthGuard` on `CallCenterController`/new controllers — reuse, do not bypass |
| V3 Session Management | yes (unchanged) | Existing JWT access/refresh rotation (`user_sessions`) — no phase-specific change |
| V4 Access Control | **yes — this phase's primary security surface** | New `PermissionsService`-style helper (Don't Hand-Roll table) enforcing `can_spy`/`spyable`/`spy_modes`/scope-to-assigned-queues (D-25) server-side; mirror existing `assertSupervisor()` idiom but parameterized — never trust a client-sent "I have this permission" flag |
| V5 Input Validation | yes | `class-validator` DTOs for every new POST body (peer-spy target, park/retrieve uniqueid, permission updates, notification-matrix updates) — follow existing `dto/callcenter.dto.ts` pattern (`AgentLoginDto`, `TransferDto`, etc.) |
| V6 Cryptography | no new surface | No new secrets/crypto introduced by this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-tenant ChanSpy/hangup/redirect (peer or supervisor issuing an action against a target agent/call in a different `vpbx_user_uid`) | Elevation of Privilege / Information Disclosure | Every new supervisor/peer action must re-verify `targetAgent.userUid === requestUserUid` (and, for supervisor, that the target queue is in the supervisor's *assigned* set per D-25 — not just "same tenant") before calling AMI — mirrors the existing `if (call.userUid !== userUid) throw new BadRequestException('Call belongs to another tenant')` guard already present in `supervisorRedirectCall`/`supervisorHangupCall` |
| IDOR on operator-settings/permission endpoints (operator reads/writes another operator's rights by guessing an ID) | Tampering / Information Disclosure | Follow the existing `callcenter-settings.controller.ts` split — `GET/PUT /operator` (self, ID from `req.user.sub`, never client-supplied) vs. `GET/PUT /operator/:operatorId` (supervisor-gated via `assertSupervisor`) — apply the identical split to any new permissions/notification-matrix endpoints |
| Privilege escalation via self-editable "customize_ui"/permission override when a role-level lock is set (D-06's "lock" concept) | Tampering | Server must re-check the lock flag on every PUT, not just hide the toggle in the UI — client-side hiding is a UX nicety, not a security boundary |
| Audit-log gap for privacy-sensitive ChanSpy listen mode (D-24) | Repudiation | Every peer/supervisor spy invocation must write an audit row (who listened to whom, when, which mode) before/around the AMI call — reuse `LoggerService.logAction` (backend ARCHITECTURE §3) rather than inventing a parallel audit mechanism |
| Zombie-call self-reset abused to force-hangup a call that is not actually stuck (griefing) | Denial of Service | D-27 scopes this to the operator's **own** active call only — enforce `call.agent === requesterAgentInterface` (or equivalent ownership check) before honoring a reset request, exactly like existing `agentHangup` already implicitly does via `resolveAgentInterface` |

## Sources

### Primary (HIGH confidence — direct codebase reads, this session)
- `packages/frontend/.idea/ARCHITECTURE.md` — FSD rules, tabs canonical pattern, design tokens, responsive rules
- `packages/backend/.idea/ARCHITECTURE.md` — multi-tenancy, RBAC, MCP tool registration rule, npm-package verification rule
- `.idea/call-center/CC_WORKSPACES_CONCEPT.md` — original 4-zone agent desktop concept (superseded by this phase's tabs/panels + widget model, but agent-state-machine diagram still accurate for READY/PAUSED/IN_CALL/WRAPUP)
- `.idea/call-center/CC_WEBRTC_CONCEPT.md` — WebRTC architecture rationale (SIP.js + Asterisk PJSIP WSS), already implemented in `useWebRTCPhone.ts`
- `packages/backend/src/modules/ami/ami.service.ts` — full list of currently-implemented AMI actions/event registrations (confirmed: no `ChanSpy`/`Park`/`ConfBridge`/`DeviceState` wrapper methods exist yet; `Redirect`/`ChanSpy`-via-`Originate` invoked ad hoc via `.action()`)
- `packages/backend/src/modules/callcenter/callcenter-ami.service.ts`, `callcenter.service.ts`, `callcenter.controller.ts`, `callcenter-state.service.ts` — full current AMI-event-to-state pipeline, supervisor actions, pick-call/transfer/hold/unhold implementations
- `packages/backend/src/modules/callcenter/models/*.ts` (operator-settings, missed-call, agent-event, agent-queue, cc-settings) — current schema shapes; confirmed no `can_spy`/`spyable`/permission columns exist anywhere (`Grep` zero matches)
- `packages/backend/src/modules/callcenter/migrate-missed-calls-unique.ts` — confirms hard `UNIQUE(call_uniqueid)` constraint that grouping-by-number must not violate
- `packages/frontend/src/pages/CallCenterAgentPage/CallCenterAgentPage.tsx` — current orchestrator, confirms ad hoc mobile tab markup and raw-HTML anti-patterns to not propagate
- `packages/frontend/src/features/callcenter/lib/useCallCenterSSE.ts`, `useWebRTCPhone.ts` (concept doc + confirmed installed `sip.js@0.21.2`), `DragTransfer.tsx` — existing reusable primitives
- `packages/frontend/package.json`, `packages/backend/package.json` — dependency/version verification (no new installs needed)
- `.planning/phases/09-call-center-agent-panel/09-CONTEXT.md`, `09-UI-SPEC.md` — locked decisions and design contract (this document's primary scope input)
- `.planning/STATE.md`, `.planning/ROADMAP.md` — phase history, prior Phase 7/8 decisions this phase must not contradict

### Secondary (MEDIUM confidence)
- None — all findings in this research were sourced directly from the codebase or project docs already present in the repository; no external WebSearch/WebFetch was required because this phase is 100% "extend existing project code," not "adopt a new library."

### Tertiary (LOW confidence)
- Exact Asterisk AMI event/field names for `ChanSpy` completion, `ParkedCall`/`UnParkedCall`, `DeviceStateChange`/`ExtensionStatus` — `[ASSUMED]` based on general Asterisk AMI knowledge and the shape of already-working events in this codebase (`AgentConnect`/`Hold` field naming conventions observed via `asterisk-manager`'s lowercasing behavior); **must be verified against a live Asterisk instance during execution** (flagged in Environment Availability and Open Questions).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified directly against installed `package.json` dependencies; zero new packages needed
- Architecture: HIGH — every pattern cited is quoted/paraphrased directly from existing, working code in this repository
- Pitfalls: MEDIUM-HIGH — pitfalls 1, 2, 4, 5, 6, 8 are grounded in directly-observed code gaps/conflicts; pitfalls 3 and 7 involve genuinely new mechanisms (zombie detection, rule engine) with no existing precedent, hence flagged `[ASSUMED]` in the Assumptions Log

**Research date:** 2026-07-22
**Valid until:** 30 days (stable internal codebase research; re-verify AMI event field assumptions immediately if a live Asterisk smoke test during execution reveals different field names than assumed)
