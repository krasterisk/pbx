# Phase 9: Call Center Agent Panel — Pattern Map

**Mapped:** 2026-07-22
**Files analyzed:** 27 (13 frontend, 14 backend)
**Analogs found:** 25 / 27

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `shared/ui/Tabs/Tabs.tsx` | component | request-response (UI state) | `shared/ui/Popover/Popover.tsx` (Radix wrapper shape) + `shared/ui/SegmentedControl/SegmentedControl.tsx` (tab-like ARIA) | role-match |
| `features/callcenter/ui/SoftphoneWidget/*` | component | event-driven (call state) | `features/callcenter/ui/CallCardPopup/CallCardPopup.tsx` (Sheet-based expandable panel) | role-match |
| `features/callcenter/ui/IncomingCallToast/*` | component | event-driven | `features/callcenter/ui/CallCardPopup/CallCardPopup.tsx` | role-match |
| `features/callcenter/ui/CoworkersTab/*` | component | CRUD + event-driven | `features/callcenter/ui/DragTransfer/DragTransfer.tsx` (colleague rows) | exact |
| `features/callcenter/ui/QueuesTab/*` | component | CRUD | `features/callcenter/ui/QueueManagementModal/QueueManagementModal.tsx` | role-match |
| `features/callcenter/ui/WaitingTab/*` | component | streaming (SSE-fed list) | existing `queueTable` block in `CallCenterAgentPage.tsx` (zoneC) | exact |
| `features/callcenter/ui/TransferDirectory/*` | component | request-response + streaming (BLF) | `features/callcenter/ui/DragTransfer/DragTransfer.tsx` (`DroppableColleague`) | role-match |
| `features/callcenter/ui/CallControlBar/*` | component | event-driven | existing `.statusBar`/call-action buttons in `CallCenterAgentPage.tsx` | role-match |
| `features/callcenter/ui/ParkedCallsIndicator/*` | component | streaming | `features/callcenter/ui/MissedCallsPanel/MissedCallsPanel.tsx` (badge + dropdown) | exact |
| `features/callcenter/ui/PermissionsMatrix/*` | component | CRUD | `shared/ui/DataTable/DataTable.tsx` + `features/callcenter/ui/OperatorSettingsForm/OperatorSettingsForm.tsx` | role-match |
| `features/callcenter/ui/NotificationMatrixForm/*` | component | CRUD | `features/callcenter/ui/OperatorSettingsForm/OperatorSettingsForm.tsx` (self/by-id split) | exact |
| `features/callcenter/lib/useUiCustomization.ts` | hook | request-response (settings fetch) | `features/callcenter/ui/OperatorSettingsForm/OperatorSettingsForm.tsx` query pattern | role-match |
| `features/callcenter/lib/usePermissions.ts` | hook | request-response | `features/callcenter/ui/OperatorSettingsForm/OperatorSettingsForm.tsx` query pattern | role-match |
| `pages/CallCenterAgentPage/CallCenterAgentPage.tsx` (rework) | orchestrator | event-driven | itself (existing file, extend) | exact |
| `callcenter-ami.service.ts::handleDialBegin/handleDialEnd/handleNewchannel` | service (AMI handler) | event-driven | `callcenter-ami.service.ts::handleHold/handleCallerJoin` (same file) | exact |
| `callcenter-ami.service.ts::findAgentByChannel` (new helper, likely on state service) | utility | transform | `callcenter-ami.service.ts::iterateAllCalls()` | exact |
| `callcenter.service.ts::peerSpy` | service | request-response | `callcenter.service.ts::supervisorSpy` | exact |
| `callcenter.service.ts::parkCall/retrieveParkedCall/addToConference/resetZombieCall` | service | request-response | `callcenter.service.ts::supervisorRedirectCall/supervisorHangupCall` | exact |
| `callcenter.controller.ts` (new endpoints: peer-spy, park, conference, zombie-reset, transfer-to-queue) | controller | request-response | `callcenter.controller.ts` (existing `supervisor/*`, `agent/*` routes) | exact |
| `models/operator-permissions.model.ts` (or extend `operator-settings.model.ts`) | model | CRUD | `models/operator-settings.model.ts` | exact |
| `models/missed-call.model.ts` (extend: attempt grouping, `client_called_back`, `personal`) | model | CRUD | itself (existing file, extend) + `migrate-missed-calls-unique.ts` | exact |
| new `cc_role_permission_defaults`-style table/service | model + service | CRUD | `models/cc-settings.model.ts` (`alert_thresholds` JSON pattern) | role-match |
| `PermissionsService` (new) | service | request-response (auth check) | `callcenter-settings.controller.ts::assertSupervisor` + `callcenter.service.ts::supervisorSpy` gate | role-match |
| `ami.service.ts::chanSpy()/park()/parkedCalls()/deviceStateList()` (new wrapper methods) | service (AMI action wrapper) | request-response | `ami.service.ts::queuePause()/queueAdd()/originate()` | exact |
| `callcenter-settings.controller.ts` / `.service.ts` (extend for permissions + notification matrix) | controller/service | CRUD | itself (existing file, extend) | exact |
| `callcenter-state.service.ts::emitEvent('presenceUpdate', ...)` (new event type) | service (event bus) | pub-sub | `callcenter-state.service.ts::emitEvent()` (existing) | exact |
| `cc_agent_events` ENUM migration (DIALING/CONSULT/ACW) | migration | batch | `migrate-missed-calls-unique.ts` | exact |

## Pattern Assignments

### `shared/ui/Tabs/Tabs.tsx` (component, request-response)

**Analog:** `shared/ui/Popover/Popover.tsx` (Radix-wrapper shape) — no `shared/ui/Tabs` exists yet; `@radix-ui/react-tabs` is installed but unused (`RESEARCH.md` confirms zero existing usage).

**Radix-wrapper import/forwardRef pattern** (`shared/ui/Popover/Popover.tsx` lines 1-33):
```typescript
import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;
const PopoverAnchor = PopoverPrimitive.Anchor;

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = 'center', sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content ref={ref} align={align} sideOffset={sideOffset}
      className={cn('z-50 ... data-[state=open]:animate-in ...', className)}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor };
```
Build `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` the same way: thin `React.forwardRef` wrappers over `@radix-ui/react-tabs` primitives, exported as named consts, no custom logic beyond className merge.

**ARIA/active-state pattern** (`shared/ui/SegmentedControl/SegmentedControl.tsx` lines 47-75):
```typescript
<div role="tablist" aria-label={ariaLabel} className={cn('inline-flex ...', className)}>
  {options.map(opt => {
    const isActive = opt.value === value;
    return (
      <button key={opt.value} type="button" role="tab" aria-selected={isActive}
        className={segmentBtn({ active: isActive })} onClick={() => handleSelect(opt.value)}>
        {Icon && <Icon className="h-4 w-4" aria-hidden />}
        {opt.label && <span>{opt.label}</span>}
      </button>
    );
  })}
</div>
```
Radix `Tabs` already handles `role="tablist"`/`role="tab"`/keyboard nav internally — do not hand-roll this ARIA plumbing like `SegmentedControl` does; just apply the mandatory SCSS underline contract below.

**Canonical tab SCSS contract** (`RESEARCH.md` Architecture Pattern 5, sourced from `packages/frontend/.idea/ARCHITECTURE.md` lines 379-423):
```scss
.tabsWrap { margin-bottom: 1.5rem; border-bottom: 1px solid var(--color-border); flex-shrink: 0; }
.tabsRow { display: flex; gap: 0.5rem; margin-bottom: -1px; overflow-x: auto; scrollbar-width: none; }
.tab { border-bottom: 2px solid transparent; }
.tabActive { color: var(--color-primary); border-bottom-color: var(--color-primary); }
```
This exact SCSS shape is mandatory per `09-UI-SPEC.md` — one shared `Tabs` primitive backs both the desktop panel toggle and the phone Coworkers/Queues/Waiting switcher.

---

### `features/callcenter/ui/SoftphoneWidget/*` and `IncomingCallToast/*` (component, event-driven)

**Analog:** `features/callcenter/ui/CallCardPopup/CallCardPopup.tsx`

**Sheet-based expandable panel pattern** (lines 1-23, 93-97):
```typescript
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
  Button, Text, HStack, VStack,
} from '@/shared/ui';

export interface CallCardPopupProps {
  open: boolean;
  template: ICardTemplate | null;
  initialValues: Record<string, unknown>;
  callContext: CallCardContext | null;
  ...
  onClose: () => void;
}

// ...
<Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
  <SheetContent className={isVip ? styles.vipBorder : undefined}>
    <SheetHeader><SheetTitle>{t('...')}</SheetTitle></SheetHeader>
    <div className={styles.body}>...</div>
    <SheetFooter>...</SheetFooter>
  </SheetContent>
</Sheet>
```
`SoftphoneWidget` (FAB → expanded panel) and `IncomingCallToast` (slide-in, non-modal) both follow this "controlled `open` boolean + `Sheet`/anchored `Popover`" shape. For the toast specifically (non-modal per D-02/UI-SPEC Surface 3), use `Popover`/`PopoverContent` (not `Sheet`, which has a backdrop) or a bespoke `motion`-driven absolutely-positioned div — `Sheet`'s `SheetOverlay` (`fixed inset-0 ... bg-black/80`, lines 11-24 of `Sheet.tsx`) blocks background interaction, which UI-SPEC Surface 3 explicitly forbids ("non-modal — underlying tabs/lists remain fully interactive").

**FAB pulse/ring animation reuse:** existing `@keyframes pulse` in `CallCenterAgentPage.module.scss` (referenced by `.connectionOffline`/`.statusDot`) — reuse verbatim for the ringing-state FAB per `RESEARCH.md` Architecture Pattern note and `09-UI-SPEC.md` Motion & Accessibility section; respect `prefers-reduced-motion: reduce`.

---

### `features/callcenter/ui/CoworkersTab/*` (component, CRUD + event-driven)

**Analog:** `features/callcenter/ui/DragTransfer/DragTransfer.tsx`

**Draggable/droppable colleague row pattern** (lines 141-185):
```typescript
export function DraggableCall({ uniqueid, className, children }: DraggableCallProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `call-${uniqueid}` });
  return (
    <div ref={setNodeRef} className={`${className || ''} ${styles.draggable} ${isDragging ? styles.dragging : ''}`}
      {...listeners} {...attributes}>
      {children}
    </div>
  );
}

export function DroppableColleague({ agent, className, children, onColleagueClick }: DroppableColleagueProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `agent-${agent.interface}`,
    data: { iface: agent.interface, name: agent.name, status: agent.status },
  });
  const canAccept = agent.status === 'READY';
  return (
    <div ref={setNodeRef} className={`${className || ''} ${isOver ? (canAccept ? styles.dropOk : styles.dropBlocked) : ''}`}
      onClick={() => onColleagueClick?.(agent)} role={onColleagueClick ? 'button' : undefined}
      tabIndex={onColleagueClick ? 0 : undefined}
      onKeyDown={(e) => { if (onColleagueClick && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onColleagueClick(agent); } }}>
      {children}
    </div>
  );
}
```
`CoworkersTab` rows should wrap each colleague in `DroppableColleague` (already exists, reuse directly, do not fork) and add the new ChanSpy trigger icon-button (permission-gated, `SegmentedControl` for listen/whisper/barge mode picker per UI-SPEC Surface 5) plus the supervisor-only hangup icon.

**Confirmation-modal pattern for a destructive/multi-choice colleague action** (lines 100-129):
```typescript
<Dialog open={!!confirmTarget && !!activeCall} onOpenChange={(open) => !open && closeConfirm()}>
  <DialogContent className="max-w-md">
    <DialogHeader><DialogTitle>{...}</DialogTitle></DialogHeader>
    <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
      <Button onClick={confirmBlind} className="w-full">{t('callcenter.dnd.blind', 'Blind transfer')}</Button>
      <Button variant="outline" onClick={confirmAttended} className="w-full">{t('callcenter.dnd.attended', 'Attended transfer')}</Button>
      <Button variant="ghost" onClick={closeConfirm} className="w-full">{t('callcenter.dnd.cancel', 'Cancel')}</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```
Reuse this exact 3-button stacked-footer shape for zombie-call-reset confirmation and supervisor-hangup confirmation dialogs (Copywriting Contract already locks the copy in `09-UI-SPEC.md`).

---

### `features/callcenter/ui/QueuesTab/*` (component, CRUD)

**Analog:** `features/callcenter/ui/QueueManagementModal/QueueManagementModal.tsx` (component exists for per-queue admin actions — read for join/leave/pause action-button wiring against `callCenterApi` mutations; reuse the same mutation-call + optimistic-toast pattern as `MissedCallsPanel`'s `markCalled`/`refetch` shown below, applied to `agentPause`/`agentUnpause`-per-queue).

**Badge threshold color pattern (warning/danger)** — apply the existing status-color mapping described in `09-UI-SPEC.md` Color section (`--color-warning` <50% free, `--color-destructive` 0 free) the same way `MissedCallsPanel`'s badge switches classes:
```typescript
// MissedCallsPanel.tsx line 67
className={`${styles.badge} ${count > 0 ? styles.badgeAlert : ''}`}
```
Generalize to a 3-state class (`ok`/`warning`/`danger`) for the free-operators indicator.

---

### `features/callcenter/ui/WaitingTab/*` (component, streaming)

**Analog:** existing `queueTable` block inside `CallCenterAgentPage.tsx` (zoneC, lines ~963+) — this is the literal code to extract verbatim into its own component per `RESEARCH.md`'s "Recommended Project Structure" (`WaitingTab/ — extract existing queueMonitor table into its own tab body`). No new pattern to invent; this is a pure extraction, not a rewrite. Preserve the existing wait-timer warning/danger thresholds (30s/60s) referenced in `09-UI-SPEC.md` Surface 7.

---

### `features/callcenter/ui/ParkedCallsIndicator/*` (component, streaming)

**Analog:** `features/callcenter/ui/MissedCallsPanel/MissedCallsPanel.tsx` (full file, badge + dropdown-list shape is a near-exact match for "badge with count + list of parked entries + retrieve action per entry")

**Badge + dropdown + SSE-invalidate pattern** (lines 25-73, 25-60):
```typescript
export function MissedCallsPanel({ onCallback }: Props) {
  const [open, setOpen] = useState(false);
  const { data: missed = [], refetch } = useGetMissedCallsQuery();
  const [markCalled] = useMarkMissedCalledBackMutation();

  // Refresh when SSE notifies us
  useEffect(() => {
    const handler = () => { dispatch(rtkApi.util.invalidateTags(['MissedCalls'])); };
    window.addEventListener('cc:missed-call-new', handler);
    return () => window.removeEventListener('cc:missed-call-new', handler);
  }, [dispatch]);

  const count = missed.length;
  return (
    <div className={styles.wrap}>
      <button className={`${styles.badge} ${count > 0 ? styles.badgeAlert : ''}`} onClick={() => setOpen(o => !o)}>
        <PhoneMissed className="w-4 h-4" />
        <span className={styles.count}>{count}</span>
      </button>
      {open && (
        <div className={styles.dropdown}>
          {/* header, empty state, row list with per-row action button */}
        </div>
      )}
    </div>
  );
}
```
`ParkedCallsIndicator` copies this shape 1:1 (badge → `PhoneParking`-style icon [check `lucide-react` for exact name] instead of `PhoneMissed`, `--color-info` tint instead of warning/destructive per UI-SPEC Surface 9, "Retrieve" row action instead of "Call back"/"Mark done").

---

### `features/callcenter/ui/PermissionsMatrix/*` and `NotificationMatrixForm/*` (component, CRUD)

**Analog:** `shared/ui/DataTable/DataTable.tsx` (bulk matrix table engine) + `features/callcenter/ui/OperatorSettingsForm/OperatorSettingsForm.tsx` (self/by-id RTK-Query split, per-operator modal shape)

**DataTable column-def + row shape** (`DataTable.tsx` lines 1-71):
```typescript
import { useReactTable, getCoreRowModel, getFilteredRowModel, getSortedRowModel,
  getPaginationRowModel, flexRender, type ColumnDef } from '@tanstack/react-table';

export interface DataTableProps<TData> {
  data: TData[];
  columns: ColumnDef<TData, any>[];
  getRowId?: (row: TData) => string;
  selectable?: boolean;
  ...
}
```
`PermissionsMatrix` (operators × `can_spy`/`spyable`/`spy_modes`/`click_to_call`/`customize_ui`) and `NotificationMatrixForm` (events × чат/звук/попап) both feed `ColumnDef[]` where each data column renders a `Switch`/`Select` cell — same `DataTable` component, different `columns` arrays. Do not build two different table shells.

**Self vs. by-id RTK-Query split + form state pattern** (`OperatorSettingsForm.tsx` lines 49-90):
```typescript
const canPickOperator = level === UserLevel.ADMIN || level === UserLevel.SUPERVISOR;
const isSelf = selectedId === selfId;

const myQuery = useGetMyOperatorSettingsQuery(undefined, { skip: !isSelf || !selfId });
const byIdQuery = useGetOperatorSettingsQuery(selectedId, { skip: isSelf || !selectedId || !canPickOperator });

const [updateMy, { isLoading: isSavingMy }] = useUpdateMyOperatorSettingsMutation();
const [updateById, { isLoading: isSavingById }] = useUpdateOperatorSettingsMutation();

const data = isSelf ? myQuery.data : byIdQuery.data;
```
The per-operator permissions modal (UI-SPEC Surface 12b) must follow this exact "self query vs by-id query, self mutation vs by-id mutation" branching — mirrors the backend's `GET/PUT operator` (self) vs `GET/PUT operator/:operatorId` (supervisor) endpoint split (see Shared Patterns → IDOR mitigation below). This is the same pattern the notification-matrix screen needs (D-41/D-43: per-operator + role default/lock).

---

### `features/callcenter/lib/useUiCustomization.ts` / `usePermissions.ts` (hook, request-response)

**Analog:** `OperatorSettingsForm.tsx`'s query-branching logic (lines 78-90) extracted into a reusable hook shape; also mirror `useCallCenterSSE.ts`'s `useCallback`-wrapped-effect structure (lines 54-260) for the "subscribe once, expose typed state + action" hook contract used throughout `features/callcenter/lib/`.
```typescript
// useCallCenterSSE.ts shape to mirror (hook returns typed state + control fn):
export function useCallCenterSSE(enabled: boolean = true) {
  const dispatch = useDispatch();
  // ...effect wiring...
  const reconnect = useCallback(() => { /* ... */ }, [connect]);
  return { reconnect };
}
```
`useUiCustomization()` should expose `{ visibility, softphonePlacement, updateVisibility, updatePlacement }` backed by the same self/by-id RTK-Query pair as `OperatorSettingsForm`; `usePermissions()` should expose `{ canSpy, spyable, spyModes, clickToCall, customizeUi }` read-only, derived from the effective-permissions endpoint (role default + operator override merge happens server-side per `PermissionsService`, never client-side per Anti-Pattern rule in `RESEARCH.md`).

---

### Backend: `callcenter-ami.service.ts::handleDialBegin/handleDialEnd/handleNewchannel` (service, event-driven)

**Analog:** `callcenter-ami.service.ts::handleHold` (lines 743-760) — the only existing handler with **no queue context**, exactly the shape D-08's new agent-channel handlers need.
```typescript
handleHold(evt: any): void {
  const channel = evt.channel || '';
  if (!channel) return;

  // Find the active call where this channel is the agent or caller
  for (const call of this.iterateAllCalls()) {
    if (call.agentChannel === channel || call.callerChannel === channel) {
      this.stateService.setCall(call.uniqueid, { status: 'HOLD' });
      this.stateService.emitEvent('callHold', call.userUid, {
        uniqueid: call.uniqueid,
        channel,
        heldBy: call.agentChannel === channel ? 'agent' : 'caller',
      });
      return;
    }
  }
}

private iterateAllCalls() {
  return this.stateService.getAllCallsGlobal();
}
```
Contrast with the queue-context handler `handleCallerJoin` (lines 263-284) which resolves tenant via `resolveQueueTenant(evt.queue)` — **do not** copy that tenant-resolution approach for `handleDialBegin`/`handleAgentHangup`; copy `handleHold`'s "scan known state by channel" approach instead, adding a new `findAgentByChannel(channel)` helper on `CallCenterStateService` (mirrors `getAllCallsGlobal()`).

**Event registration pattern** (`packages/backend/src/modules/ami/ami.service.ts` lines 313-343):
```typescript
this.ami.on('queuecallerjoin', (evt: any) => {
  this.getCcAmiService()?.handleCallerJoin(evt);
});
this.ami.on('hold', (evt: any) => {
  this.getCcAmiService()?.handleHold(evt);
});
this.ami.on('unhold', (evt: any) => {
  this.getCcAmiService()?.handleUnhold(evt);
});
```
New registrations (`dialbegin`, `dialend`, `newchannel` for personal/outbound) go in this exact block, immediately after the existing `hold`/`unhold` registrations (lines 338-343).

---

### Backend: `callcenter.service.ts::peerSpy` (service, request-response)

**Analog:** `callcenter.service.ts::supervisorSpy` (lines 627-658)
```typescript
async supervisorSpy(agentInterface: string, mode: 'spy' | 'whisper' | 'barge', userUid: number, supervisorId: number) {
  const agent = this.stateService.getAgent(userUid, agentInterface);
  if (!agent || agent.status !== 'IN_CALL') {
    throw new BadRequestException('Agent is not on a call');
  }
  const spyOptions = mode === 'spy' ? 'q' : mode === 'whisper' ? 'w' : 'B';
  const supervisor = await this.userModel.findOne({ where: { id: supervisorId, vpbx_user_uid: userUid } });
  if (!supervisor) throw new NotFoundException('Supervisor not found');
  const supervisorExten = supervisor.getDataValue('extension') || supervisor.getDataValue('login');
  const spyChannel = `PJSIP/${supervisorExten}`;
  try {
    await this.amiService.originate(spyChannel, `Spy on ${agent.name}`, 'from-internal', `ChanSpy(${agentInterface},${spyOptions})`);
  } catch (err: any) {
    throw new BadRequestException(`Spy failed: ${err.message}`);
  }
  this.logger.log(`Supervisor ${supervisorId} started ${mode} on ${agentInterface}`);
  return { success: true, mode };
}
```
`peerSpy(requesterUserId, targetInterface, mode, userUid)` copies this exact shape but **inserts permission/scope checks before** the `originate()` call (this existing method has none beyond controller-level `assertSupervisor()`): shared-queue check, `targetPerms.spyable`, `requesterPerms.can_spy`, `mode ∈ requesterPerms.spy_modes`, then an audit-log write (D-24) — see Pitfall 2 in `RESEARCH.md` for the exact ordering.

**Tenant-ownership guard pattern for call-mutating actions** (`supervisorRedirectCall`, lines 750-759):
```typescript
async supervisorRedirectCall(uniqueid: string, target: string, userUid: number) {
  const call = this.stateService.getCall(uniqueid);
  if (!call) throw new NotFoundException('Call not found');
  if (call.userUid !== userUid) {
    throw new BadRequestException('Call belongs to another tenant');
  }
  if (!call.callerChannel) {
    throw new BadRequestException('Caller channel not available');
  }
  // ...
}
```
`parkCall`/`retrieveParkedCall`/`addToConference`/`resetZombieCall` must all open with this identical `getCall` → tenant-check → channel-presence-check sequence before touching AMI (Security Domain in `RESEARCH.md` explicitly calls this out as the mandatory cross-tenant mitigation).

---

### Backend: `ami.service.ts::chanSpy()/park()/parkedCalls()/deviceStateList()` (new AMI action wrappers)

**Analog:** `ami.service.ts::queuePause()` (lines 436+) and `queueAdd()` (lines 419+) — thin named wrappers around the generic `.action()` call.
```typescript
async queueAdd(queue: string, iface: string, penalty?: number): Promise<any> {
  return this.action({
    action: 'QueueAdd',
    Queue: queue,
    Interface: iface,
    ...(penalty != null ? { Penalty: String(penalty) } : {}),
  });
}
```
New wrappers (`park(channel, parkingLot?)`, `parkedCalls()`, `deviceStateList()`) follow this identical `async methodName(...args): Promise<any> { return this.action({ action: 'ActionName', ...Fields }); }` shape — per `RESEARCH.md`'s "Alternatives Considered" table, prefer named wrappers for genuinely new action types (`Park`, `DeviceStateList`) but keep ad hoc `.action()`/`.originate()` calls for one-off dialplan-app invocations that mirror `supervisorSpy`'s existing `ChanSpy`-via-`Originate` pattern (conference-via-`ConfBridge` dialplan app, not a dedicated AMI action, follows the same ad hoc route).

**Generic action() core** (line 365):
```typescript
async action(action: Record<string, any>): Promise<any> {
  // existing promise-wrapped this.ami.action(...) call — reuse verbatim, do not fork a second AMI call path
}
```

---

### Backend: `callcenter-settings.controller.ts` / `.service.ts` (extend for permissions + notification matrix)

**Analog:** itself — this file already implements the exact self-vs-supervisor-vs-tenant-singleton split that new permission/notification endpoints need.
```typescript
// Self (IDOR-safe — id from JWT, never client param):
@Get('operator')
getMyOperatorSettings(@Req() req: Request & { user: any }) {
  return this.settingsService.getOperatorSettings(req.user.vpbx_user_uid, req.user.sub);
}

// Supervisor-on-behalf-of (id IS a client param, but gated):
@Get('operator/:operatorId')
getOperatorSettingsBySupervisor(@Param('operatorId', ParseIntPipe) operatorId: number, @Req() req: Request & { user: any }) {
  assertSupervisor(req.user);
  return this.settingsService.getOperatorSettings(req.user.vpbx_user_uid, operatorId);
}

// Tenant singleton (role-default row):
@Get('tenant')
getTenantSettings(@Req() req: Request & { user: any }) {
  return this.settingsService.getTenantSettings(req.user.vpbx_user_uid);
}
@Put('tenant')
updateTenantSettings(@Body() dto: UpdateCcSettingsDto, @Req() req: Request & { user: any }) {
  assertSupervisor(req.user);
  return this.settingsService.updateTenantSettings(req.user.vpbx_user_uid, dto);
}
```
Extend this exact controller (new `@Get/@Put('operator/permissions')`, `.../notifications`, `.../ui-customization` sub-routes, or extend the existing `UpdateOperatorSettingsDto`) rather than creating a parallel settings controller — one controller, one IDOR-mitigation pattern, for every per-operator + role-default setting this phase adds (D-05/D-06, D-38...D-43).

**Level-set gate (correct inverted-privilege check)** (lines 26-35):
```typescript
function assertSupervisor(user: any): void {
  const allowed = new Set([UserLevel.SUPERADMIN, UserLevel.ADMIN, UserLevel.SUPERVISOR]);
  if (!allowed.has(user.level)) {
    throw new ForbiddenException('Supervisor access required (level >= 3)');
  }
}
```
Note: `callcenter.controller.ts` has a *different*, simpler `assertSupervisor` (`user.level < 3`, lines 36-40) — the two are inconsistent (`callcenter-settings.controller.ts`'s comment explicitly flags the inverted-privilege gotcha). New permission-gate code (`PermissionsService`) should use the `Set`-membership version, and the plan should flag the divergence for eventual consolidation but not silently "fix" it mid-phase without a task.

---

### Backend: `models/operator-permissions.model.ts` (new) (model, CRUD)

**Analog:** `models/operator-settings.model.ts` (full file)
```typescript
@Table({ tableName: 'cc_operator_settings', timestamps: false })
export class CcOperatorSettings extends Model {
  @Column({ primaryKey: true, autoIncrement: true, type: DataType.INTEGER })
  declare uid: number;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare operator_user_id: number;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
  declare pickup_enabled: boolean;
  // ... more per-operator boolean/int columns ...

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'vpbx_user_uid' })
  declare user_uid: number;
}
```
New `can_spy`/`spyable`/`click_to_call`/`customize_ui` boolean columns + `spy_modes` (JSON string array) follow this exact column style — either as new columns appended to `CcOperatorSettings` (simplest, matches "extend `operator_settings`" per D-38) or a sibling 1:1 table if the migration surface is preferred to be isolated. For the **role-default** half (D-39), `models/cc-settings.model.ts`'s `alert_thresholds: Record<string, number> | null` JSON-column pattern is the closest existing analog for a `role_permission_defaults: Record<UserLevel, Partial<PermissionSet>> | null` JSON column — see Open Question #1 in `RESEARCH.md` for the role-vs-tenant-singleton schema tension this needs to resolve.

---

### Backend: `models/missed-call.model.ts` (extend) (model, CRUD)

**Analog:** itself (existing file) + `migrate-missed-calls-unique.ts` (companion migration)
```typescript
@Table({ tableName: 'cc_missed_calls', timestamps: false })
export class CcMissedCall extends Model {
  @Column({ primaryKey: true, autoIncrement: true, type: DataType.BIGINT })
  declare uid: number;

  @Column({ type: DataType.STRING(64), allowNull: false, unique: true })
  declare call_uniqueid: string;   // <- UNIQUE INVARIANT, must not be violated by grouping logic

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
  declare called_back: boolean;
  // ...
}
```
New columns (`client_called_back: boolean`, `personal: boolean`) are additive to this call-level model — grouping-by-number (D-16) happens in the **read/query layer** (`GROUP BY caller_id_num`), never by relaxing the `UNIQUE(call_uniqueid)` constraint. See `RESEARCH.md` Pitfall 4 and its "Grouped missed-calls query" Code Example for the exact aggregation shape to copy.

**Standalone migration-script pattern** (`migrate-missed-calls-unique.ts`, full file):
```typescript
import { Sequelize } from 'sequelize-typescript';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

async function main() {
  const sequelize = new Sequelize({ dialect: 'mysql', host: process.env.DB_HOST || 'localhost', /* ... */ });
  try {
    await sequelize.query(`ALTER TABLE ... ADD ...`);
  } catch (err: any) {
    const msg = String(err?.message || err);
    if (msg.includes('Duplicate') || msg.includes('exists')) { /* idempotent no-op */ } else { throw err; }
  } finally {
    await sequelize.close();
  }
}
main().catch((err) => { console.error(err); process.exit(1); });
```
Every new migration this phase needs (`client_called_back`/`personal` columns on `cc_missed_calls`, `cc_agent_events.event_type` ENUM extension for DIALING/CONSULT/ACW, new permission columns) copies this exact standalone-script shape: `dotenv` from repo root, raw `sequelize.query`, idempotent catch-and-check-message on `ALTER TABLE`/`ADD` errors, `finally { close() }`.

---

### Backend: `callcenter-state.service.ts::emitEvent` (new event types: `presenceUpdate`, KPI deltas) (event bus, pub-sub)

**Analog:** itself (existing method, reuse verbatim — do not fork)
```typescript
private eventSeqId = 0;

emitEvent(type: string, userUid: number, data: any): void {
  this.eventSeqId++;
  this.eventSubject.next({ type, userUid, data: { ...data, _eventId: this.eventSeqId } });
}
```
Every new SSE surface (BLF `presenceUpdate`, dual shift/day KPI deltas, permission-change notifications) must call this exact method — never introduce a second event bus/transport (`RESEARCH.md` Anti-Patterns). For high-frequency `DeviceStateChange` bursts (D-45), debounce/coalesce in the AMI handler (250-500ms) **before** calling `emitEvent`, not by changing this method's signature.

**Frontend companion — SSE listener registration pattern** (`useCallCenterSSE.ts` lines 165-177, 204-213):
```typescript
es.addEventListener('callHold', (e: MessageEvent) => {
  try {
    const data = JSON.parse(e.data);
    dispatch(updateCall({ uniqueid: data.uniqueid, status: 'HOLD' }));
  } catch { /* ignore */ }
});

// Missed calls — broadcast on window so a panel component invalidates its own cache
es.addEventListener('missedCallNew', (e: MessageEvent) => {
  try {
    window.dispatchEvent(new CustomEvent('cc:missed-call-new', { detail: JSON.parse(e.data) }));
  } catch { /* ignore */ }
});
```
New event types (`presenceUpdate`, `agentKpiUpdate`) need one new `es.addEventListener(...)` block each inside `useCallCenterSSE.ts`, following the same `try { dispatch(...) } catch { /* ignore */ }` shape — either dispatching straight to `callCenterSlice` (state-owning events) or re-broadcasting via `window.dispatchEvent(new CustomEvent(...))` for panel-owned cache invalidation (like `missedCallNew` does for `MissedCallsPanel`).

## Shared Patterns

### Multi-tenant isolation (`vpbx_user_uid` / `parseQueueTenant`)
**Source:** `callcenter-ami.service.ts` lines 813-826, every model's `field: 'vpbx_user_uid'` column
**Apply to:** every new model, every new AMI handler, every new service method
```typescript
private resolveQueueTenant(queueName: string): number | null {
  return CallCenterAmiService.parseQueueTenant(queueName);
}
static parseQueueTenant(queueName: string): number | null {
  const match = queueName.match(/_(\d+)$/);
  if (!match) return null;
  return parseInt(match[1], 10);   // 0 is a VALID tenant — never treat as falsy
}
```
For non-queue (agent-channel) events, resolve tenant from the matched `AgentState.userUid` (new `findAgentByChannel` helper) instead — never invent a second tenant-resolution scheme (`RESEARCH.md` "Don't Hand-Roll" table).

### IDOR-safe self vs. supervisor-on-behalf-of endpoint split
**Source:** `callcenter-settings.controller.ts` lines 42-86 (see full excerpt above)
**Apply to:** all new permissions/notification-matrix/ui-customization endpoints
```typescript
@Get('operator')  // self — id from req.user.sub, never a client param
getMyX(@Req() req) { return this.service.getX(req.user.vpbx_user_uid, req.user.sub); }

@Get('operator/:operatorId')  // supervisor-on-behalf-of — client param, but gated
getXBySupervisor(@Param('operatorId', ParseIntPipe) operatorId: number, @Req() req) {
  assertSupervisor(req.user);
  return this.service.getX(req.user.vpbx_user_uid, operatorId);
}
```

### Cross-tenant call-ownership guard before any AMI mutation
**Source:** `callcenter.service.ts::supervisorRedirectCall` lines 750-759
**Apply to:** `parkCall`, `retrieveParkedCall`, `addToConference`, `resetZombieCall`, `peerSpy`
```typescript
const call = this.stateService.getCall(uniqueid);
if (!call) throw new NotFoundException('Call not found');
if (call.userUid !== userUid) throw new BadRequestException('Call belongs to another tenant');
```

### SSE delta events with `_eventId`, never full-state re-broadcast
**Source:** `callcenter-state.service.ts::emitEvent` lines 139-141
**Apply to:** all new real-time surfaces (presence/BLF, KPI counters, permission changes)
```typescript
emitEvent(type: string, userUid: number, data: any): void {
  this.eventSeqId++;
  this.eventSubject.next({ type, userUid, data: { ...data, _eventId: this.eventSeqId } });
}
```

### Standalone idempotent migration script
**Source:** `migrate-missed-calls-unique.ts` (full file)
**Apply to:** `cc_agent_events.event_type` ENUM extension, new permission columns, missed-call grouping columns
```typescript
try {
  await sequelize.query(`ALTER TABLE ... ADD ...`);
} catch (err: any) {
  const msg = String(err?.message || err);
  if (msg.includes('Duplicate') || msg.includes('exists')) { /* ok, already applied */ } else { throw err; }
}
```

### AMI event registration block
**Source:** `packages/backend/src/modules/ami/ami.service.ts` lines 293-343
**Apply to:** `dialbegin`, `dialend`, and any other new AMI event this phase listens to
```typescript
this.ami.on('<eventname>', (evt: any) => {
  this.getCcAmiService()?.handle<EventName>(evt);
});
```

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| Zombie-call detection heuristic (poll `CoreShowChannels`, diff vs in-memory state) | service (background job) | batch (periodic poll) | No existing periodic-diff/reconciliation job exists in `callcenter/` — closest conceptual sibling is `callcenter-queuelog-reconciler.service.ts` (reconciles queue-log against state), worth reading during planning as a structural analog even though it's not a channel-liveness poll; flagged `[ASSUMED]` in `RESEARCH.md` Pitfall 3 |
| Auto-pause rule engine (missed-count / idle-time / status-duration triggers) | service (rule evaluator) | transform | No "rule" concept exists anywhere in this codebase (confirmed by `RESEARCH.md` Pitfall 7); model as a typed JSON union on `CcSettings`/`CcOperatorSettings` per the `alert_thresholds` JSON-column precedent, but the *evaluator* logic itself has no direct analog to copy — closest partial reference is `PauseReasonModal.tsx` + `pausedAt.maxDurationMin` (single fixed-duration cap, not multi-trigger) |

## Metadata

**Analog search scope:** `packages/frontend/src/shared/ui/`, `packages/frontend/src/features/callcenter/`, `packages/frontend/src/pages/CallCenterAgentPage/`, `packages/backend/src/modules/callcenter/`, `packages/backend/src/modules/ami/`
**Files scanned:** ~35 read/grepped directly (shared/ui: SegmentedControl, Popover, Sheet, Switch, DataTable; callcenter frontend: MissedCallsPanel, DragTransfer, CallCardPopup, useCallCenterSSE, OperatorSettingsForm, CallCenterAgentPage; callcenter backend: callcenter-ami.service, callcenter.service, callcenter-state.service, callcenter.controller, callcenter-settings.controller, operator-settings.model, missed-call.model, cc-settings.model, agent-event.model, migrate-missed-calls-unique.ts; ami.service.ts)
**Pattern extraction date:** 2026-07-22
