# Phase 7: Call Center overhaul — Pattern Map

**Mapped:** 2026-07-15
**Files analyzed:** 46 (backend 24, frontend 22) — новые + модифицируемые, извлечено из 07-CONTEXT.md / 07-RESEARCH.md / 07-UI-SPEC.md
**Analogs found:** 43 / 46 (3 без прямого анализа — новые примитивы `shared/ui`, см. «No Analog Found»)

> Аудит реализованного (research §Expert Audit) подтверждает: `CallCenterStateService`/SSE/AMI-пайплайн — рабочий фундамент, не переписывать контракт. Все паттерны ниже показывают, ЧТО КОПИРОВАТЬ, а не что менять в существующих файлах, кроме явно отмеченных «расширить» точек (batched-writer hook в AMI-хендлерах, reconnect-подписка, webhook `extraVars`, `agentTransfer` bug fix).

---

## File Classification

### Backend — Wave 1 (metrics engine + персист, D-03/D-05..D-09)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/backend/src/modules/callcenter/models/queue-call.model.ts` | model | CRUD (history insert) | `packages/backend/src/modules/callcenter/models/missed-call.model.ts` | exact |
| `packages/backend/src/modules/callcenter/models/daily-queue-stats.model.ts` | model | batch/rollup | `packages/backend/src/modules/callcenter/models/missed-call.model.ts` | role-match |
| `packages/backend/src/modules/callcenter/models/daily-agent-stats.model.ts` | model | batch/rollup | `packages/backend/src/modules/callcenter/models/missed-call.model.ts` | role-match |
| `packages/backend/src/modules/callcenter/callcenter-history-writer.service.ts` | service | event-driven → batch | `handleCallerAbandon()` в `callcenter-ami.service.ts` (fire-and-forget `.create().catch()`) | role-match (единственный существующий прецедент неблокирующей записи) |
| `packages/backend/src/modules/callcenter/callcenter-metrics.service.ts` | service | CRUD + aggregation | `callcenter-state.service.ts` (аккумуляторы в Map) + новый SQL-агрегатор | partial (state pattern есть, SQL-агрегация — новая) |
| `packages/backend/src/modules/callcenter/callcenter-queuelog-reconciler.service.ts` | service | batch/reconciliation | `loadInitialState()` в `callcenter-ami.service.ts` (AMI resync pattern) | role-match |
| `packages/backend/src/modules/callcenter/callcenter-ami.service.ts` (**расширить**, не переписывать) | service | event-driven | себя (существующий файл) | exact — добавить: emit event bus discriminated union + push в `CallCenterHistoryWriterService.enqueue()` внутри уже существующих `handleAgentConnect`/`handleAgentComplete`/`handleCallerJoin`/`handleCallerAbandon`; подписать `loadInitialState()` на AMI reconnect-событие (Pitfall 3) |
| `packages/backend/src/modules/callcenter/callcenter.service.ts` `agentTransfer()` (**bug fix**) | service | request-response | себя | exact — заменить `call.callerIdNum` → `call.callerChannel` при вызове `amiService.action('Redirect', ...)` (Pitfall 2); добавить regression-тест в `callcenter.service.spec.ts` |

### Backend — Call Cards (D-10..D-13)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/backend/src/modules/callcenter/models/card-template.model.ts` | model | CRUD | `packages/backend/src/modules/notifications/notification-integration.model.ts` (tenant-scoped config JSON) | role-match |
| `packages/backend/src/modules/callcenter/models/card-field.model.ts` | model | CRUD | `packages/backend/src/modules/callcenter/models/pause-reason.model.ts` | role-match |
| `packages/backend/src/modules/callcenter/models/card-data.model.ts` | model | CRUD (per-call snapshot) | `packages/backend/src/modules/callcenter/models/missed-call.model.ts` | exact |
| `packages/backend/src/modules/callcenter/callcenter-cards.controller.ts` | controller | request-response | `callcenter.controller.ts` (assertSupervisor pattern для CRUD шаблонов) | exact |
| `packages/backend/src/modules/callcenter/callcenter-cards.service.ts` | service | CRUD | `packages/backend/src/modules/phonebooks/phonebooks.service.ts` (CRUD + JSON entries pattern) | role-match |
| `packages/backend/src/modules/notifications/providers/webhook.provider.ts` (**расширить сигнатуру**) | service | request-response | себя | exact — добавить 4-й опциональный параметр `extraVars?: Record<string,string>`, слить в `vars` ДО `applyTemplate` (см. Pattern 4 ниже) |

### Backend — Wallboard (D-26..D-29)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/backend/src/modules/callcenter/models/display-token.model.ts` | model | CRUD | `packages/backend/src/modules/callcenter/models/agent-session.model.ts` (token/session lifecycle) | role-match |
| `packages/backend/src/modules/callcenter/callcenter-wallboard.controller.ts` (display-token guard) | controller | streaming (SSE) | `callcenter-sse.controller.ts` | exact (структура SSE), НО auth-ветка новая — см. Pitfall 5 |
| `packages/backend/src/modules/callcenter/guards/display-token.guard.ts` | middleware | request-response | `packages/backend/src/modules/auth/jwt-auth.guard.ts` | role-match (тот же контракт CanActivate, другая логика проверки — opaque token, не JWT) |

### Backend — Internal chat (D-30..D-32)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/backend/src/modules/callcenter/models/chat-message.model.ts` | model | CRUD | `packages/backend/src/modules/callcenter/models/agent-event.model.ts` | role-match |
| `packages/backend/src/modules/callcenter/callcenter-chat.controller.ts` | controller | request-response + SSE fan-out | `callcenter.controller.ts` (REST POST) + `callcenter-sse.controller.ts` (доставка через event bus) | exact |
| `packages/backend/src/modules/callcenter/callcenter-chat.service.ts` | service | CRUD | `callcenter.service.ts` (session/tenant pattern) | role-match |

### Backend — Reports (D-33..D-36)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/backend/src/modules/callcenter/reports/callcenter-reports.service.ts` | service | aggregation (SQL raw + rollup) | `packages/backend/src/modules/cdr/cdr.controller.ts` CSV-builder (raw query + hand-rolled export) | role-match |
| `packages/backend/src/modules/callcenter/reports/callcenter-reports.controller.ts` | controller | request-response | `callcenter.controller.ts` | exact |
| `packages/backend/src/modules/callcenter/reports/exporters/xlsx-exporter.ts` | utility | transform | новый (`exceljs`), пример в RESEARCH.md Code Examples | no analog (новая либа) |
| `packages/backend/src/modules/callcenter/reports/exporters/csv-exporter.ts` | utility | transform | `cdr.controller.ts` (существующий hand-rolled CSV builder) | exact — **не** заводить вторую реализацию, переиспользовать builder |
| `packages/backend/src/modules/callcenter/reports/exporters/pdf-exporter.ts` | utility | transform | `@react-pdf/renderer` уже в зависимостях фронтенда — на усмотрение Claude (backend vs frontend generation) | no analog |
| `packages/backend/src/modules/callcenter/reports/callcenter-report-schedule.model.ts` | model | CRUD + cron | `packages/backend/src/modules/cloud-admin/billing/` billing-scheduler (`@Cron`) — паттерн периодических задач | role-match |

### Backend — AI-ready foundation (D-41..D-45)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/backend/src/modules/callcenter/callcenter-ai.adapter.ts` | service (Domain AI Adapter) | request-response | `packages/backend/src/modules/phonebooks/phonebooks-ai.adapter.ts` | exact |
| `packages/backend/src/modules/callcenter/callcenter-media-bridge.service.ts` | service | streaming (RTP/PCM skeleton) | `packages/backend/src/modules/voice-robots/services/voice-robot-session.ts` (`start()` bridge→externalMedia flow) + `rtp-udp-server.service.ts` | exact |
| `packages/backend/src/modules/callcenter/callcenter-state.service.ts` (**расширить типы**, не переписывать) | service | event-driven | себя | exact — только добавить discriminated union `CcEventBusEvent` (Code Examples §CC Event Bus) поверх существующего `CcEvent`/`emitEvent()` |

### Backend — Settings / operator settings (D-18..D-22, D-40)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/backend/src/modules/callcenter/models/operator-settings.model.ts` | model | CRUD (per-operator singleton) | `packages/backend/src/modules/callcenter/models/pause-reason.model.ts` | role-match |
| `packages/backend/src/modules/callcenter/models/cc-settings.model.ts` (per-tenant JSON singleton) | model | CRUD | `packages/backend/src/modules/system-settings/system-setting.model.ts` (key-value, но без `user_uid` — нужно добавить tenant-колонку) | partial |
| `packages/backend/src/modules/callcenter/callcenter-settings.controller.ts` | controller | request-response | `callcenter.controller.ts` (pause-reasons CRUD блок, `assertSupervisor`) | exact |

### Backend — WebRTC softphone (D-14..D-17)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/backend/src/modules/callcenter/callcenter-webrtc.controller.ts` (SIP-креды endpoint) | controller | request-response | `packages/backend/src/modules/endpoints/endpoints.service.ts` (`NAT_PROFILES.webrtc` уже готов) | exact — просто читать существующий PJSIP endpoint с `natProfile: 'webrtc'`, не создавать новую схему креденшлов |

### Frontend — АРМ оператора (D-18..D-22, доработка)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/frontend/src/pages/CallCenterAgentPage/CallCenterAgentPage.tsx` (**рефакторинг верстки**, не с нуля) | page | request-response + SSE consumer | себя (существующий файл) — переносим custom SCSS-разметку на `shared/ui` (DataTable, Dialog, Sheet) | exact |
| `packages/frontend/src/features/callcenter/ui/DragTransfer/DragTransfer.tsx` (**расширить модалку**) | component | event-driven (DnD) | себя | exact — добавить 3 действия «Слепой/С консультацией/Отмена» вместо единственной кнопки Transfer (см. Pattern 3 ниже) |
| `packages/frontend/src/features/callcenter/ui/CallCardPopup/CallCardPopup.tsx` | component (Sheet) | request-response | `packages/frontend/src/features/callcenter/ui/ClientCard/ClientCard.tsx` (структура фичи, НЕ расширять сам ClientCard — Pitfall 4) | role-match |
| `packages/frontend/src/features/callcenter/lib/useWebRTCPhone.ts` | hook | streaming (WebRTC media) | `packages/frontend/src/features/callcenter/lib/useCallCenterSSE.ts` (структура hook: `useRef` для persistent connection + cleanup) | role-match (структура hook да, транспорт — новый `sip.js`) |
| `packages/frontend/src/features/callcenter/ui/DtmfKeypad/DtmfKeypad.tsx` | component | request-response | новый `shared/ui/Popover` + существующий DTMF UI-заготовка в `CallCenterAgentPage.tsx` (`// TODO: send DTMF`) | partial — заглушка есть, реализации нет |
| `packages/frontend/src/features/callcenter/lib/useCallNotifications.ts` (**расширить**) | hook | event-driven | себя | exact — добавить zip tone перед auto-answer (D-16) + volume/off настройки из `operator-settings` |

### Frontend — АРМ супервизора (D-23..D-25)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/frontend/src/features/callcenter/ui/AgentDetailModal/AgentDetailModal.tsx` | component (Dialog xl) | request-response | `shared/ui/Dialog.tsx` (`DialogContent size="xl"`) + новый `AgentTimeline` | exact (базовая обёртка) |
| `packages/frontend/src/features/callcenter/ui/QueueManagementModal/QueueManagementModal.tsx` | component (DnD) | event-driven | `packages/frontend/src/features/dialplan-apps/ui/DialplanAppsEditor/DialplanAppsEditor.tsx` (DndContext + SortableContext + arrayMove) | exact |
| `packages/frontend/src/features/callcenter/ui/BulkActionsBar/BulkActionsBar.tsx` | component | request-response | `shared/ui/DataTable.tsx` (row selection state) — новый композит, паттерн selection bar не существует, строить по UI-SPEC мотивной анимации | no direct analog (новый композит, но использует существующий DataTable selection) |
| `packages/frontend/src/features/callcenter/ui/AgentTimeline/AgentTimeline.tsx` (переиспользуемый, D-36) | component | transform (recharts/timeline) | Recharts-обёртки — искать существующие в `shared/ui` (нет прямого — новый Recharts wrapper по правилу FSD «оборачивать 3rd-party») | no analog — построить как новый `shared/ui`-подобный wrapper |
| `packages/frontend/src/features/callcenter/ui/SupervisorGridTableToggle/SegmentedControl.tsx` | component | — (UI toggle) | `shared/ui/RadioCards.tsx` (структура: options + value + onChange + CVA-классы) | role-match |
| `packages/frontend/src/pages/CallCenterSupervisorPage/CallCenterSupervisorPage.tsx` (**доработка**, не с нуля) | page | request-response + SSE | себя | exact |

### Frontend — Wallboard (D-26..D-29)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/frontend/src/pages/CallCenterWallboardPage/CallCenterWallboardPage.tsx` | page | streaming (SSE, read-only) | `packages/frontend/src/pages/CallCenterAgentPage/CallCenterAgentPage.tsx` (структура SSE-consumer page), но БЕЗ auth chrome | partial — SSE-паттерн да, auth-модель новая (display-token, не JWT localStorage) |
| `packages/frontend/src/features/callcenter/lib/useWallboardSSE.ts` | hook | streaming | `useCallCenterSSE.ts` (EventSource, `es.addEventListener`) | exact (структура), token передаётся не из `localStorage.accessToken`, а из URL param |
| `packages/frontend/src/features/callcenter/ui/Sparkline/Sparkline.tsx` (`shared/ui`) | component (Recharts wrapper) | transform | нет существующего Recharts wrapper в `shared/ui` — искать в `pages/*Reports*` использование Recharts напрямую как отправную точку | no analog — новый |

### Frontend — Call Cards builder (D-10..D-13)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/frontend/src/features/callcenter/ui/TemplateBuilder/TemplateBuilder.tsx` | component (DnD builder, 2-pane) | event-driven | `DialplanAppsEditor.tsx` (DndContext/SortableContext/arrayMove) + `SortableActionItem.tsx` (drag handle + row layout) | exact |
| `packages/frontend/src/features/callcenter/ui/TemplateBuilder/FieldRow.tsx` | component (sortable item) | — | `packages/frontend/src/features/dialplan-apps/ui/SortableActionItem/SortableActionItem.tsx` | exact |
| `packages/frontend/src/features/callcenter/ui/FieldRenderer/FieldRenderer.tsx` | component (single source of truth: builder preview + popup) | transform | нет прямого — композиция существующих `shared/ui` inputs (`Input`, `Select`, `Checkbox`, `TagInput`) по типу поля | no analog (новый composite, но входные примитивы существуют) |

### Frontend — Internal chat (D-30..D-32)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/frontend/src/features/callcenter/ui/ChatPanel/ChatPanel.tsx` | component (right-side collapsible) | request-response + SSE | `packages/frontend/src/features/callcenter/ui/MissedCallsPanel/MissedCallsPanel.tsx` (panel structure внутри `CallCenterAgentPage`) | role-match |
| `packages/frontend/src/features/callcenter/ui/ChatPanel/ChatThread.tsx` | component | request-response | нет — bubble-паттерн новый, копировать структуру `MissedCallsPanel.tsx` (список + пагинация) | partial |

### Frontend — RTK Query / Redux (все волны)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/frontend/src/shared/api/endpoints/callCenterApi.ts` (**расширить**, не переписывать) | RTK Query endpoints | CRUD/request-response | себя | exact — новые `injectEndpoints` блоки по образцу существующих секций (см. Pattern ниже): cards, chat, reports, wallboard-tokens, operator-settings |
| `packages/frontend/src/features/callcenter/model/slice/callCenterSlice.ts` (**расширить**) | Redux slice (SSE state) | event-driven | себя | exact — добавить reducers для chat/card/alert событий по образцу существующих `updateAgent`/`addCall` |

### Frontend — навигация / роли (D-37..D-39)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/frontend/src/widgets/Sidebar/Sidebar.tsx` (**добавить role-filter — новая логика, не доработка**) | widget | — | себя (текущий статичный массив) | exact по структуре массива, НО role-filter логики в кодовой базе НЕТ прообраза — см. `SidebarItem.tsx` для структуры отдельного пункта |
| `packages/frontend/src/app/router/router.tsx` (**добавить `/callcenter/*` + redirect**) | route config | — | искать существующий редирект-паттерн в самом файле (`Navigate to=`) | (не прочитан детально — планировщик должен проверить существующие redirect-примеры в router.tsx) |

### Frontend — новые `shared/ui` примитивы (обязательные по UI-SPEC)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/frontend/src/shared/ui/Sheet/Sheet.tsx` | UI primitive | — | `packages/frontend/src/shared/ui/Dialog/Dialog.tsx` (тот же `@radix-ui/react-dialog` root, side-variant вместо center) | exact |
| `packages/frontend/src/shared/ui/Switch/Switch.tsx` | UI primitive | — | нет `@radix-ui/react-switch` обёртки в проекте — строить по образцу `Dialog.tsx`/`Checkbox.tsx` (CVA + forwardRef паттерн) | role-match (паттерн обёртки, не сам компонент) |
| `packages/frontend/src/shared/ui/Avatar/Avatar.tsx` | UI primitive | — | нет прямого — простой initials-fallback компонент, стиль как `Badge.tsx` (CVA) | no analog |
| `packages/frontend/src/shared/ui/Popover/Popover.tsx` | UI primitive | — | `packages/frontend/src/shared/ui/DropdownMenu/DropdownMenu.tsx` (тот же класс Radix popover-family примитивов, идентичная структура forwardRef+portal) | exact |
| `packages/frontend/src/shared/ui/Progress/Progress.tsx` | UI primitive | — | нет — plain div + token fill, стиль как `Skeleton.tsx` (простой div-based примитив без Radix) | role-match |
| `packages/frontend/src/shared/ui/SegmentedControl/SegmentedControl.tsx` | UI primitive | — | `packages/frontend/src/shared/ui/RadioCards.tsx` (CVA + options/value/onChange контракт) | role-match |

---

## Pattern Assignments

### 1. In-memory state + RxJS event bus (основа для D-41a CC Event Bus)

**Analog:** `packages/backend/src/modules/callcenter/callcenter-state.service.ts`

**Текущий контракт событий** (lines 64-68):
```typescript
export interface CcEvent {
  type: string;             // SSE event type: agentUpdate, queueUpdate, callNew, etc.
  userUid: number;          // tenant — used for SSE filtering
  data: any;
}
```

**Emit pattern** (lines 107-111, переиспользовать буквально для новых типов событий — chat/cards/alerts/media):
```typescript
emitEvent(type: string, userUid: number, data: any): void {
  this.eventSeqId++;
  this.eventSubject.next({ type, userUid, data: { ...data, _eventId: this.eventSeqId } });
}
```

**Tenant-filtered stream** (lines 101-105):
```typescript
getEventStream(userUid: number): Observable<CcEvent> {
  return this.eventSubject.asObservable().pipe(
    filter(event => event.userUid === userUid),
  );
}
```

**D-41a action:** НЕ вводить `EventEmitter2` — формализовать discriminated union `CcEventBusEvent` (см. RESEARCH.md §Code Examples) как type-safe надстройку над существующим `CcEvent.data`, без изменения runtime-механизма.

---

### 2. AMI event handler → batched history write (Pattern 1, D-09)

**Analog:** `handleCallerAbandon()` в `packages/backend/src/modules/callcenter/callcenter-ami.service.ts` (lines 367-415) — единственный существующий прецедент неблокирующей записи.

**Существующий fire-and-forget паттерн** (lines 391-412, буквально копировать стиль `.catch()` без `await`):
```typescript
if (uniqueid && callerIdNum) {
  this.missedCallModel
    .create({ /* ... */ })
    .then(() => {
      this.stateService.emitEvent('missedCallNew', userUid, { /* ... */ });
    })
    .catch(err => this.logger.warn(`Persist missed call failed: ${err.message}`));
}
```

**Новый batched writer** (см. RESEARCH.md Pattern 1 для полного кода `CallCenterHistoryWriterService`) — вызывается из `handleAgentConnect`/`handleAgentComplete`/`handleCallerJoin`/`handleCallerAbandon` через `enqueue()`, НЕ через синхронный `await Model.create()`:
```typescript
// Внутри handleAgentComplete() — заменить/дополнить существующую логику:
this.historyWriter.enqueue({
  call_uniqueid: uniqueid,
  queue_name: queueName,
  agent_interface: agentInterface,
  answer_time: call?.answerTime,
  end_time: new Date(),
  disposition: 'answered',
  user_uid: userUid,
});
```

**Критично (Pitfall 1):** никогда `await Model.create()` внутри AMI event handler — только `.enqueue()` (sync, push в массив) или fire-and-forget `.then().catch()` как в существующем прецеденте.

---

### 3. DnD Transfer confirmation modal — расширение до 3 действий (D-21)

**Analog:** `packages/frontend/src/features/callcenter/ui/DragTransfer/DragTransfer.tsx` (lines 77-101)

**Текущая модалка** (одна кнопка Transfer):
```typescript
{confirmTarget && activeCall && (
  <div className={styles.modalOverlay} onClick={() => setConfirmTarget(null)}>
    <div className={styles.modal} onClick={e => e.stopPropagation()}>
      <div className={styles.modalTitle}>...</div>
      <Text>...</Text>
      <div className={styles.modalButtons}>
        <Button variant="outline" onClick={() => setConfirmTarget(null)}>Cancel</Button>
        <Button onClick={confirm}>Transfer</Button>
      </div>
    </div>
  </div>
)}
```

**Требуемое расширение (D-21, UI-SPEC §1):** заменить единственную `confirm()` на три действия — «Слепой перевод» (primary) / «С консультацией» (secondary) / «Отмена» (ghost). Сохранить структуру `DndContext` + `useDraggable`/`useDroppable` (lines 1-149) БЕЗ изменений — только тело модалки:
```typescript
const [confirmTarget, setConfirmTarget] = useState<{ iface: string; name: string } | null>(null);
// ...
<Button onClick={() => onTransfer(confirmTarget.iface, 'blind')}>Слепой перевод</Button>
<Button variant="outline" onClick={() => onTransfer(confirmTarget.iface, 'attended')}>С консультацией</Button>
<Button variant="ghost" onClick={() => setConfirmTarget(null)}>Отмена</Button>
```
Также рекомендуется мигрировать разметку модалки с ручных `div`/`styles.modal` на `shared/ui/Dialog` (`DialogContent`/`DialogHeader`/`DialogFooter`) — текущая реализация не использует design-system компоненты (см. Gap Analysis: "custom SCSS вместо `shared/ui`").

---

### 4. DnD Sortable Builder (Call Card TemplateBuilder, D-10)

**Analog:** `packages/frontend/src/features/dialplan-apps/ui/DialplanAppsEditor/DialplanAppsEditor.tsx` (весь файл, 132 lines) + `SortableActionItem.tsx` (139 lines)

**Sensors setup** (DialplanAppsEditor.tsx lines 46-51):
```typescript
const sensors = useSensors(
  useSensor(PointerSensor),
  useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
);
```

**onDragEnd + arrayMove** (lines 89-96):
```typescript
const handleDragEnd = (event: DragEndEvent) => {
  const { active, over } = event;
  if (active.id !== over?.id && over) {
    const oldIndex = actions.findIndex((a) => a.id === active.id);
    const newIndex = actions.findIndex((a) => a.id === over.id);
    onChange(arrayMove(actions, oldIndex, newIndex));
  }
};
```

**Structure** (lines 98-122): `DndContext` → `SortableContext items={fields.map(f => f.id)} strategy={verticalListSortingStrategy}` → map over items rendering a `Sortable*Item` component per row.

**Drag handle row layout** (SortableActionItem.tsx lines 76-97, `useSortable` + `CSS.Transform.toString`):
```typescript
const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: action.id });
const style = {
  transform: CSS.Transform.toString(transform),
  transition,
  zIndex: isDragging ? 10 : 1,
  opacity: isDragging ? 0.8 : 1,
};
// ...
<Flex {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing ...">
  <GripVertical className="w-5 h-5" />
</Flex>
```

**Для `TemplateBuilder`:** заменить `action.id`/`ActionTypeSelect`/`AppComponent` на `field.id`/тип поля (15 типов, D-11)/`FieldRenderer` — тот же скелет DnD, другой домен данных. Live preview (правая панель) рендерит тот же `FieldRenderer`, что и `CallCardPopup` (UI-SPEC: «single source of truth, no separate preview markup»).

**Queue↔Agent DnD в Queue Management Modal (D-23):** тот же `DndContext`/`arrayMove` паттерн, но между двумя списками (in-queue / available) вместо reorder одного списка — ближайший аналог двусторонней DnD в проекте: `DragTransfer.tsx` `useDroppable`/`useDraggable` для cross-container drop (не sortable reorder).

---

### 5. Domain AI Adapter (D-41b — `CallCenterAiAdapter`)

**Analog:** `packages/backend/src/modules/phonebooks/phonebooks-ai.adapter.ts` (весь файл, 323 lines) — эталонная реализация Phase 5.

**Imports pattern** (lines 1-11):
```typescript
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AiAdapterRegistryService } from '../ai-platform/ai-adapter-registry.service';
import { AiToolDefinition, AiStateProvider, DomainAiAdapter } from '../ai-platform/ai-adapter.types';
```

**Class skeleton + self-registration** (lines 23-52):
```typescript
@Injectable()
export class CallCenterAiAdapter implements DomainAiAdapter, OnModuleInit {
  readonly domain = 'callcenter';
  constructor(
    private readonly ccService: CallCenterService,
    private readonly stateService: CallCenterStateService,
    private readonly registry: AiAdapterRegistryService,
  ) {}
  onModuleInit(): void { this.registry.register(this); }
  getTools(): AiToolDefinition[] {
    return [this.toolGetQueueSnapshot(), this.toolForcePauseAgent(), /* ... */];
  }
  getStateProvider(): AiStateProvider {
    return { domain: this.domain, buildSummary: (uid) => this.buildSummary(uid) };
  }
}
```

**Tool definition contract** (`AiToolDefinition` interface, `ai-adapter.types.ts` lines 23-36) — **критично**, `handler` получает `vpbxUserUid` ВСЕГДА параметром вызова, никогда через closure (D-23 antipattern, задокументированный реальный cross-tenant баг):
```typescript
export interface AiToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
  entityType: string;
  destructive?: boolean;
  handler: (args: Record<string, any>, vpbxUserUid: number) => Promise<string | Record<string, any>>;
}
```

**Destructive tool example** (phonebooks-ai.adapter.ts lines 171-194, `delete_phonebook` — паттерн для `cc_force_logout_agent`/`cc_force_pause_agent`):
```typescript
private toolDeletePhonebook(): AiToolDefinition {
  return {
    name: 'delete_phonebook',
    description: '...',
    inputSchema: { uid: { type: 'number', description: 'UID справочника' } },
    entityType: 'phonebook',
    destructive: true,
    handler: async (args, uid) => { /* ... */ },
  };
}
```

**State summary (per-tenant, компактный текстовый блок — НЕ полный dump)** (lines 78-92):
```typescript
private async buildSummary(vpbxUserUid: number): Promise<string> {
  const phonebooks = await this.phonebooksService.findAll(vpbxUserUid);
  if (phonebooks.length === 0) return '';
  const lines: string[] = ['Справочники (Phonebooks):'];
  for (const pb of phonebooks) { /* ... */ }
  return lines.join('\n');
}
```
Для CC: `buildSummary()` должен возвращать компактную сводку KPI очередей + агентов на паузе, НЕ полный дамп `getAllAgents()`/`getAllCalls()`.

**Registry** (`ai-adapter-registry.service.ts`, весь файл — НЕ модифицировать, только вызывать `register()`):
```typescript
register(adapter: DomainAiAdapter): void {
  this.adapters.set(adapter.domain, adapter);
  this.logger.log(`Registered AI adapter for domain "${adapter.domain}" (${adapter.getTools().length} tools)`);
}
```

---

### 6. ARI externalMedia / RTP skeleton (D-41c — `CallCenterMediaBridgeService`)

**Analog:** `packages/backend/src/modules/voice-robots/services/voice-robot-session.ts` (`start()` метод, lines 230-270) + `packages/backend/src/modules/ari/ari-http-client.service.ts` (`externalMedia()`, lines 237-254)

**externalMedia call signature** (ari-http-client.service.ts lines 237-254):
```typescript
async externalMedia(
  channelId: string | null,
  app: string,
  externalHost: string,
  format: string = 'alaw',
  data?: string,
): Promise<any> {
  const params: any = { app, external_host: externalHost, format };
  if (channelId) params.channelId = channelId;
  if (data) params.data = data;
  const response = await this.client.post(`/channels/externalMedia`, undefined, { params });
  return response.data;
}
```

**Usage pattern in voice-robot-session.ts** (lines 255-270 — bridge → RTP session → externalMedia → add to bridge):
```typescript
this.rtpSession = await this.udpServer.createSession();
this.externalChannel = await this.ariClient.externalMedia(
  null, 'krasterisk_voicerobots', `${this.externalHost}:${this.rtpSession.port}`, 'alaw', this.channelId,
);
await this.ariClient.addChannelToBridge(this.bridge.id, this.externalChannel.id);
```

**RTP decoded audio events** (`rtp-udp-server.service.ts` `RtpSession` class, lines 29-52 — emits `audio-pcm16`/`audio-float32`; для CC-каркаса заменить STT-подключение на emit в CC event bus):
```typescript
this.eventEmitter.emit('audio-pcm16', pcm16);
```
Для `CallCenterMediaBridgeService`: тот же поток `allocateSession()` → `externalMedia()` → на событие RTP эмитить `'cc.media.pcmFrame'` в `stateService.emitEvent(...)`, **НЕ** подключать `StreamingSttService` (D-42/D-44 — запрещено в этой фазе).

**Routing второго leg обратно к первому channel** (`ari-connection.service.ts` lines 241-259) — используется для сопоставления `UnicastRTP/...` канала с исходным звонком через `args[0]` (`data` параметр `externalMedia`); тот же механизм для привязки PCM-потока к `call_uniqueid` из `cc_queue_calls`.

---

### 7. Webhook CRM integration — расширение `extraVars` (D-13)

**Analog:** `packages/backend/src/modules/notifications/providers/webhook.provider.ts` (весь файл, 88 lines)

**Текущая сигнатура** (lines 44-48):
```typescript
async send(
  integration: DecryptedNotificationIntegration,
  target: string | undefined,
  message: string,
): Promise<NotificationSendResult> {
```

**Vars merge + template application** (lines 59-69):
```typescript
const vars: Record<string, string> = { message: text, target: target ?? '' };
const template = integration.config?.payload_template;
const payload = template && typeof template === 'object'
  ? applyTemplate(template, vars)
  : { message: text, target: target ?? null };
```

**Требуемое изменение** (RESEARCH.md Pattern 4): добавить 4-й опциональный параметр `extraVars`, слить в `vars` ДО `applyTemplate` — card field values подставляются как `{{customer_name}}` и т.п.:
```typescript
async send(
  integration: DecryptedNotificationIntegration,
  target: string | undefined,
  message: string,
  extraVars?: Record<string, string>,
): Promise<NotificationSendResult> {
  const vars: Record<string, string> = { message: trimNotificationMessage(message), target: target ?? '', ...extraVars };
  // остальное без изменений
}
```

**Dispatcher unchanged** (`notification-dispatcher.service.ts` lines 39-74) — CC-модуль вызывает `webhookProvider.send(integ, target, message, cardFieldVars)` напрямую (не через `NotificationDispatcherService.dispatch()`, который заточен под dialplan-контекст) либо через отдельный CC-specific вызов; сам провайдер и `NotificationsService.findByUidInternal` переиспользуются как есть, credential store НЕ дублировать (D-13).

**`applyTemplate` — принцип безопасности** (lines 21-38): строковая подстановка регуляркой `{{(\w+)}}`, без `eval`/произвольного JS — сохранить при расширении `vars` (Security Domain: Webhook payload injection mitigation).

---

### 8. Sequelize model с tenant isolation (все новые `cc_*` таблицы)

**Analog:** `packages/backend/src/modules/callcenter/models/missed-call.model.ts` (весь файл, 52 lines) — образцовый пример для истории/событий; `agent-event.model.ts` — образец с ENUM-полем.

**Table decorator + PK** (missed-call.model.ts lines 7-10):
```typescript
@Table({ tableName: 'cc_missed_calls', timestamps: false })
export class CcMissedCall extends Model {
  @Column({ primaryKey: true, autoIncrement: true, type: DataType.BIGINT })
  declare uid: number;
```

**Tenant isolation column** (lines 50-51, **обязательно на каждой новой `cc_*` таблице**):
```typescript
@Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'vpbx_user_uid' })
declare user_uid: number;
```

**ENUM field pattern** (agent-event.model.ts lines 14-23 — для `disposition`/`card field type`/`chat message type`):
```typescript
@Column({
  type: DataType.ENUM('LOGIN', 'LOGOUT', 'READY', 'PAUSE', 'CALL_START', 'CALL_END', 'WRAPUP_START', 'WRAPUP_END', 'HOLD', 'UNHOLD'),
  allowNull: false,
})
declare event_type: string;
```

**AES-encrypted secrets (если понадобится для display-token или card credentials)** — переиспользовать паттерн `notification-integration.model.ts` (lines 27-29): `encrypted_credentials` TEXT + `config` JSON для non-secret defaults, НЕ вводить новый криптослой (Security Domain V6).

---

### 9. NestJS Controller REST + `assertSupervisor` RBAC (все новые CC-контроллеры)

**Analog:** `packages/backend/src/modules/callcenter/callcenter.controller.ts` (весь файл, 198 lines)

**Guard + RBAC helper** (lines 30-44):
```typescript
const SUPERVISOR_LEVEL = 3;
function assertSupervisor(user: any): void {
  if (user.level < SUPERVISOR_LEVEL) {
    throw new ForbiddenException('Supervisor access required (level >= 3)');
  }
}

@UseGuards(JwtAuthGuard)
@Controller('callcenter')
export class CallCenterController {
  constructor(private readonly ccService: CallCenterService) {}
```

**Agent action endpoint** (lines 48-56):
```typescript
@Post('agent/login')
agentLogin(@Body() dto: AgentLoginDto, @Req() req: Request & { user: any }) {
  return this.ccService.agentLogin(dto.interface, dto.queues || [], req.user.vpbx_user_uid, req.user.id);
}
```

**Supervisor-only endpoint** (lines 134-143):
```typescript
@Post('supervisor/spy')
supervisorSpy(@Body() dto: SupervisorSpyDto, @Req() req: Request & { user: any }) {
  assertSupervisor(req.user);
  return this.ccService.supervisorSpy(dto.agentInterface, dto.mode || 'spy', req.user.vpbx_user_uid, req.user.id);
}
```
Все новые контроллеры (`callcenter-cards.controller.ts`, `callcenter-chat.controller.ts`, `callcenter-settings.controller.ts`, `reports/callcenter-reports.controller.ts`) копируют `@UseGuards(JwtAuthGuard)` + `req.user.vpbx_user_uid`/`req.user.id` для tenant/actor context; CRUD-мутации, требующие роль супервизора (шаблоны карточек, отчёты по всем агентам), вызывают `assertSupervisor(req.user)` как первую строку метода.

---

### 10. SSE Controller — Display-token branch (D-26, Pitfall 5)

**Analog:** `packages/backend/src/modules/callcenter/callcenter-sse.controller.ts` (весь файл, 92 lines)

**Существующий JWT-based SSE endpoint** (lines 23-77) — структура (guard, `@Sse`, snapshot+stream merge, heartbeat) копируется буквально, но `@UseGuards(JwtAuthGuard)` заменяется на новый `DisplayTokenGuard`:
```typescript
@Sse('events')
events(@Req() req: Request & { user: any }): Observable<MessageEvent> {
  const userUid = req.user.vpbx_user_uid;
  const snapshot = this.stateService.getSnapshot(userUid);
  const ccEvents$ = this.stateService.getEventStream(userUid).pipe(
    startWith({ type: 'fullSnapshot', userUid, data: snapshot }),
    map(event => ({ data: JSON.stringify(event.data), type: event.type, id: String(event.data?._eventId || Date.now()) })),
  );
  const heartbeat$ = interval(SSE_HEARTBEAT_MS).pipe(map(() => ({ data: '', type: 'heartbeat', id: undefined as any })));
  return merge(ccEvents$, heartbeat$);
}
```

**Критично (Pitfall 5, Security Domain V2/V3):** `CallCenterWallboardController`/`DisplayTokenGuard` — **новая, отдельная auth-ветка**, НЕ переиспользовать `JwtAuthGuard`. Guard должен:
1. Валидировать opaque token из `cc_display_tokens` (не декодировать как JWT).
2. Проверять `revoked_at IS NULL` / `expires_at` (если задан).
3. Устанавливать `req.user` = `{ vpbx_user_uid, isDisplayToken: true }` — **без** `level`/`id`, чтобы случайное использование на agent/supervisor endpoint фейлилось на отсутствии полей, а не молча проходило.

---

### 11. RTK Query `injectEndpoints` (все новые CC endpoint-группы)

**Analog:** `packages/frontend/src/shared/api/endpoints/callCenterApi.ts` (весь файл, 175 lines)

**injectEndpoints skeleton** (lines 47-48, 146-147):
```typescript
const callCenterApi = rtkApi.injectEndpoints({
  endpoints: (build) => ({ /* ... */ }),
});
```

**Query pattern с tags** (lines 130-133):
```typescript
getPauseReasons: build.query<IPauseReason[], void>({
  query: () => '/callcenter/pause-reasons',
  providesTags: ['PauseReasons'],
}),
```

**Mutation с invalidation** (lines 134-141):
```typescript
createPauseReason: build.mutation<IPauseReason, Partial<IPauseReason>>({
  query: (body) => ({ url: '/callcenter/pause-reasons', method: 'POST', body }),
  invalidatesTags: ['PauseReasons'],
}),
```

**Простая мутация без тела** (lines 71-73):
```typescript
agentHold: build.mutation<{ success: boolean }, void>({
  query: () => ({ url: '/callcenter/agent/hold', method: 'POST' }),
}),
```
Новые группы (`cc_card_templates`, `cc_chat`, `cc_reports`, `cc_display_tokens`, `cc_operator_settings`) добавляются как новые секции в ЭТОМ ЖЕ файле (`callCenterApi.ts`) — не создавать отдельные `*Api.ts` файлы для CC (проектная конвенция — 1 файл на домен, `callCenterApi.ts` уже покрывает домен `callcenter`), либо (если файл станет слишком большим — на усмотрение планировщика) разделить по тому же паттерну, что `callGroupApi.ts`/`notificationApi.ts` для смежных доменов.

---

### 12. Sidebar role-based navigation (D-38 — новая логика, не рефакторинг)

**Analog (структура, не role-логика):** `packages/frontend/src/widgets/Sidebar/Sidebar.tsx` (весь файл, 175 lines)

**Текущий статичный массив** (lines 50-82) — **без единого `useSelector` на роль** (Gap Analysis: подтверждено прямым чтением, ни один пункт не фильтруется):
```typescript
const navigation = [
  { name: t('nav.dashboard'), path: '/', icon: LayoutDashboard },
  { type: 'divider' as const, label: t('nav.pbx') },
  // ... плоский список, без role-условий
  { type: 'divider' as const, label: t('nav.callcenter') },
  { name: t('nav.operator'), path: '/operator', icon: Headphones },
  { name: t('nav.supervisor'), path: '/supervisor', icon: Monitor },
  // ...
] as const;
```

**Item structure** (`SidebarItem.tsx` — не полностью прочитан, но используется как `item as SidebarItemType`, `isActive`, `isVisuallyExpanded`, `collapsed` props, lines 144-152).

**Требуемое изменение (D-37/D-38):**
1. Добавить `useSelector` на текущего юзера (искать существующий auth-selector в `entities/user` или аналогичном слайсе — не найден в этом обходе, планировщик должен его локализовать перед реализацией).
2. Заменить статичный `navigation` на функцию `buildNavigation(userLevel: number, t)`, которая условно включает CC-группу пунктов:
   - level 2 (оператор): только `/callcenter/agent`.
   - level 3+ (супервизор): `/callcenter/agent`, `/callcenter/supervisor`, `/callcenter/wallboard`, `/callcenter/reports`.
   - admin: + `/callcenter/settings`.
3. Заменить `path: '/operator'` → `/callcenter/agent`, `path: '/supervisor'` → `/callcenter/supervisor`; добавить редиректы в `router.tsx` (`/operator` → `/callcenter/agent`, `/supervisor` → `/callcenter/supervisor`) для обратной совместимости старых закладок.

---

### 13. Sheet primitive (новый `shared/ui`, база для CallCardPopup / ChatPanel / Zone D overlay)

**Analog:** `packages/frontend/src/shared/ui/Dialog/Dialog.tsx` (весь файл, 142 lines) — тот же `@radix-ui/react-dialog` пакет, side-variant вместо center-variant.

**Root/Trigger/Portal/Close — переносятся 1:1** (lines 12-15):
```typescript
const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;
```

**CVA content variants** (lines 32-48) — для `Sheet` заменить `dialogContentVariants` (center positioning `fixed left-[50%] top-[50%] ... translate-x-[-50%]`) на side-variant (`fixed inset-y-0 right-0 h-full w-[480px] ...` для 480px правый Sheet по UI-SPEC §4):
```typescript
const dialogContentVariants = cva(
  'fixed left-[50%] top-[50%] layer-modal w-full translate-x-[-50%] ...',
  { variants: { size: { default: '...', xl: '...' /* ... */ } }, defaultVariants: { size: 'default' } }
);
```
`Sheet` должен экспортировать те же именованные части (`SheetContent`, `SheetHeader`, `SheetFooter`, `SheetTitle`, `SheetDescription`, `SheetClose`) для консистентности API с `Dialog`.

---

### 14. Popover primitive (новый `shared/ui`, база для DTMF keypad / sparkline detail)

**Analog:** `packages/frontend/src/shared/ui/DropdownMenu/DropdownMenu.tsx` — тот же класс Radix floating-content примитивов (`@radix-ui/react-popover` вместо `@radix-ui/react-dropdown-menu`), идентичная структура `forwardRef` + `Portal` + `Content` с `sideOffset`/`align` пропами. Скопировать структуру forwardRef-компонентов из `DropdownMenu.tsx` (не прочитан целиком в этом обходе — планировщик должен читать перед реализацией), заменив примитив-пакет.

---

## Shared Patterns

### Tenant Isolation (`vpbx_user_uid`)
**Source:** `packages/backend/src/modules/callcenter/models/missed-call.model.ts` lines 50-51; `callcenter-state.service.ts` `agentKey()`/`queueKey()` (lines 115-117, 158-160, ключ `${userUid}:${name}`).
**Apply to:** ВСЕ новые модели (`user_uid` column с `field: 'vpbx_user_uid'`), все новые controller-методы (`req.user.vpbx_user_uid`), все новые in-memory Map-структуры (composite key convention).

### RBAC (`assertSupervisor`)
**Source:** `packages/backend/src/modules/callcenter/callcenter.controller.ts` lines 30-37.
**Apply to:** Все supervisor-only endpoints (card template CRUD, thresholds settings, display-token generation, bulk actions, reports для всех агентов, force-logout).

### AMI handler → non-blocking DB write
**Source:** `callcenter-ami.service.ts` `handleCallerAbandon()` lines 391-412 (существующий прецедент) + новый `CallCenterHistoryWriterService` (RESEARCH.md Pattern 1).
**Apply to:** Все AMI-хендлеры, которые пишут историю (`handleAgentConnect`, `handleAgentComplete`, `handleCallerJoin`, `handleCallerAbandon`), rollup-джобы (`@Interval`/`@Cron`).

### SSE Event → Redux dispatch
**Source:** `packages/frontend/src/features/callcenter/lib/useCallCenterSSE.ts` lines 58-90 (`es.addEventListener(type, handler)` → `dispatch(action(JSON.parse(e.data)))`, try/catch на parse).
**Apply to:** Новые SSE event types (chat message, card saved, alert threshold breach, wallboard-specific events) — тот же `try { dispatch(...) } catch { /* ignore */ }` паттерн, никогда не бросать из listener.

### DnD (`@dnd-kit/core` + `@dnd-kit/sortable`)
**Source:** `DialplanAppsEditor.tsx` (sortable reorder) + `DragTransfer.tsx` (cross-container drag-drop).
**Apply to:** TemplateBuilder (sortable reorder полей), QueueManagementModal (cross-list drag agents между queue/available), DragTransfer modal upgrade (3 actions).

### Domain AI Adapter registration
**Source:** `phonebooks-ai.adapter.ts` полностью + `ai-adapter-registry.service.ts` + `ai-adapter.types.ts`.
**Apply to:** `CallCenterAiAdapter` — единственный новый адаптер в этой фазе; `vpbxUserUid` ВСЕГДА параметр handler, никогда closure.

### Webhook credential reuse (`notification_integration`)
**Source:** `notifications.controller.ts` (CRUD, не читан детально, но подтверждён в RESEARCH.md как переиспользуемый без изменений) + `webhook.provider.ts`.
**Apply to:** Call Card → CRM webhook (D-13), wallboard alert thresholds (D-28), report scheduling delivery (D-35) — три разных consumer'а одного канала `notification_integration`, НЕ создавать `cc_webhook_credentials`.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `packages/frontend/src/shared/ui/Avatar/Avatar.tsx` | component | — | Нет initials-fallback avatar компонента в проекте; строить с нуля по стилю CVA (`Badge.tsx` как ориентир по паттерну класса) |
| `packages/frontend/src/features/callcenter/ui/AgentTimeline/AgentTimeline.tsx` | component | transform (recharts) | Нет существующего Recharts-таймлайн wrapper в `shared/ui`; RESEARCH.md подтверждает `recharts` в зависимостях, но конкретного timeline-компонента для копирования нет — строить новый по FSD-правилу «оборачивать 3rd-party в shared/ui» |
| `packages/frontend/src/features/callcenter/ui/BulkActionsBar/BulkActionsBar.tsx` | component | — | Selection bar (slide-up при выборе строк таблицы) — паттерна в проекте нет; `DataTable.tsx` даёт row-selection state, но UI slide-up bar — новый композит по UI-SPEC мотивной спецификации (Motion `slides up from bottom`) |

---

## Metadata

**Analog search scope:** `packages/backend/src/modules/{callcenter,phonebooks,notifications,voice-robots,ari,ai-platform,queues,system-settings,cloud-admin/billing,endpoints}`, `packages/frontend/src/{features/callcenter,features/dialplan-apps,pages/CallCenterAgentPage,pages/CallCenterSupervisorPage,widgets/Sidebar,shared/api/endpoints,shared/ui}`.
**Files scanned:** ~70 (полное чтение) + ~130 (glob-обзор без полного чтения).
**Pattern extraction date:** 2026-07-15
