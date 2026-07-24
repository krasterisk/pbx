# Phase 10: Full Softphone (WebRTC + SIP/AMI dual-mode) - Pattern Map

**Mapped:** 2026-07-24
**Files analyzed:** 17 (10 frontend, 7 backend)
**Analogs found:** 16 / 17

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `packages/frontend/.../SoftphoneWidget/SoftphoneWidget.tsx` | component | request-response | itself (existing chrome/fab dual-variant shell) | exact (extend in place) |
| `packages/frontend/.../SoftphoneWidget/SoftphoneJournal.tsx` (NEW) | component | streaming (SSE-fed list) | `CallHistoryPanel.tsx` | exact (row rendering + direction icon idiom) |
| `packages/frontend/.../SoftphoneWidget/SoftphoneContacts.tsx` (NEW) | component | CRUD (read + search) | `TransferDirectory.tsx` | exact (sectioned/searchable list) |
| `packages/frontend/.../CallHistoryPanel/CallHistoryPanel.tsx` | component | CRUD (filter/search) | itself + `TransferDirectory.tsx` (SegmentedControl/search) | role-match |
| `packages/frontend/.../ContactBookForm/ContactBookForm.tsx` (NEW) | component | CRUD (create/update/delete) | `PauseReasonsManager.tsx` | role-match (CRUD form-state shape; swap Dialog->Sheet per UI-SPEC) |
| `packages/frontend/.../lib/useSipPhoneAmi.ts` (NEW) | hook | request-response | `useWebRTCPhone.ts` | role-match (shape-compatible facade, explicitly modeled by RESEARCH) |
| `packages/frontend/.../lib/shiftSession.ts` | utility | file-I/O (sessionStorage) | itself | exact (extend with 2 more keys) |
| `packages/frontend/.../lib/useCallCenterSSE.ts` | hook | event-driven (SSE) | itself (`presenceUpdate` listener) | exact |
| `packages/frontend/src/shared/api/endpoints/callCenterApi.ts` | store (RTK Query) | CRUD | itself (`getOperatorCallHistory`/pause-reasons endpoints) | exact |
| `packages/frontend/src/pages/CallCenterAgentPage/CallCenterAgentPage.tsx` | page/orchestrator | request-response | itself (`isWebrtc` branching) | exact |
| `packages/backend/.../callcenter.controller.ts` | controller | CRUD / request-response | itself (`agent/hold`, `agent/directory`, pause-reasons routes) | exact |
| `packages/backend/.../callcenter.service.ts` | service | CRUD | itself (`getMissedCalls`, `createPauseReason`/`updatePauseReason`/`deletePauseReason`, `agentHold`) | exact |
| `packages/backend/.../callcenter-history-writer.service.ts` | service | event-driven (batched writer) | itself + `agentHold`'s `emitEvent` call | role-match |
| `packages/backend/.../models/cc-contact.model.ts` (NEW) | model | CRUD | `models/missed-call.model.ts` | exact (tenant + ownership column shape) |
| `packages/backend/.../dto/callcenter-contacts.dto.ts` (NEW) | utility (DTO) | CRUD (validation) | `dto/callcenter-missed.dto.ts` | exact (class-validator DTO shape) |
| `packages/backend/.../migrate-callcenter-contacts.ts` (NEW) | migration | batch (DDL) | `packages/backend/src/modules/call-groups/migrate-call-groups-phase6.ts` | exact (standalone `createTable`+`addIndex` script for a brand-new entity) |
| `packages/backend/src/modules/ami/ami.service.ts` (add `playDtmf`) | service | event-driven (AMI action) | itself (`hangup(channel)` thin wrapper) | exact |

## Pattern Assignments

### `SoftphoneWidget.tsx` (component, request-response) - MODIFY

**Analog:** itself (`packages/frontend/src/features/callcenter/ui/SoftphoneWidget/SoftphoneWidget.tsx`)

**Current variant/placement typing to delete** (lines 18-19):
```typescript
export type SoftphonePlacement = 'bottom-right' | 'bottom-left' | 'hidden';
export type SoftphoneVariant = 'fab' | 'chrome';
```
D-26 narrows `SoftphoneVariant` to `'chrome'`-only (or removes the type entirely if every call site is updated) and grep-verifies no remaining `.fab`/`.fabWrap`/`.fabRinging`/`SoftphonePlacement` references (RESEARCH Pitfall 5) before deleting the whole `if (isChrome) {...}` vs fallback-`fab`-JSX branch (lines 472-543).

**Placeholder tabs to replace** (lines 359-369):
```typescript
{activeTab === 'journal' ? (
  <Text variant="muted" className={styles.tabPlaceholder}>
    {t('callcenter.softphone.journalSoon', 'Call journal will land in the full softphone phase.')}
  </Text>
) : null}

{activeTab === 'contacts' ? (
  <Text variant="muted" className={styles.tabPlaceholder}>
    {t('callcenter.softphone.contactsSoon', 'Endpoints, queues and groups: full softphone phase.')}
  </Text>
) : null}
```
Replace with `<SoftphoneJournal />` / `<SoftphoneContacts />` mounts. Existing tab-row markup (lines 339-357, hand-rolled `role="tab"` buttons) must be replaced with `shared/ui/Tabs` per UI-SPEC Design System note.

**Mode-prop extension point** — the `phone` prop doc comment already states the contract new code must respect:
```typescript
export interface SoftphoneWidgetProps {
  /** Return value of useWebRTCPhone - this widget only renders it, never forks call logic. */
  phone: ReturnType<typeof useWebRTCPhone>;
  ...
```
Widen this to accept the shape-compatible union of `useWebRTCPhone`/`useSipPhoneAmi` return types (add a `mode: 'webrtc' | 'sip'` prop to gate the quality/device rows per D-34), never fork call-control logic inside the widget itself (RESEARCH Anti-Pattern 1).

---

### `SoftphoneJournal.tsx` (component, streaming) - NEW

**Analog:** `packages/frontend/src/features/callcenter/ui/CallHistoryPanel/CallHistoryPanel.tsx`

**Imports pattern** (lines 1-22):
```typescript
import { useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import {
  PhoneIncoming, PhoneOutgoing, Phone, PhoneMissed, PhoneCall, IdCard,
} from 'lucide-react';
import { Button, Text, SegmentedControl } from '@/shared/ui';
import {
  useGetOperatorCallHistoryQuery,
  useClickToCallMutation,
  useLazyGetCardByCallQuery,
  useGetCardTemplatesQuery,
  type IOperatorHistoryRow,
} from '@/shared/api/endpoints/callCenterApi';
import { selectCcQueues } from '@/features/callcenter/model/selectors/callCenterSelectors';
import { requestOutboundDial } from '@/features/callcenter/model/slice/callCenterSlice';
import { queueDisplayName } from '@/features/callcenter/lib/displayLabels';
import { CallCardPopup } from '@/features/callcenter/ui/CallCardPopup/CallCardPopup';
```
SoftphoneJournal reuses the same `useGetOperatorCallHistoryQuery` (capped/sliced client-side to N=50 per D-04, blended not segmented per D-02) plus `CallCardPopup`/`useClickToCallMutation` for its two row actions (D-03).

**Direction-icon core pattern** (lines 26-38):
```typescript
interface DirectionVisual {
  Icon: typeof PhoneIncoming;
  colorClass: string;
}

function directionVisual(row: Pick<IOperatorHistoryRow, 'direction' | 'disposition'>): DirectionVisual {
  if (row.disposition === 'abandoned' || row.disposition === 'timeout') {
    return { Icon: PhoneMissed, colorClass: styles.iconMissed };
  }
  if (row.direction === 'inbound') return { Icon: PhoneIncoming, colorClass: styles.iconInbound };
  if (row.direction === 'outbound') return { Icon: PhoneOutgoing, colorClass: styles.iconOutbound };
  return { Icon: Phone, colorClass: styles.iconOther };
}
```
Copy verbatim - D-02's "one blended feed with direction icons" is exactly this function's contract.

**Row action pattern (callback + open-card, D-03)** (lines 122-153, 206-228):
```typescript
const handleCallback = async (row: IOperatorHistoryRow) => {
  if (!row.callerIdNum) return;
  setPendingId(row.uid);
  try {
    const res = await clickToCall({ target: row.callerIdNum }).unwrap();
    if (res.mode === 'webrtc' && res.target) {
      dispatch(requestOutboundDial(res.target));
    }
  } catch { /* dial-initiation error - nothing more to do client-side */ }
  finally { setPendingId(null); }
};
```
```typescript
<Button
  type="button" variant="outline" size="sm" className={styles.actionBtn}
  disabled={!row.callerIdNum || (isCalling && pendingId === row.uid)}
  aria-label={`${t('callcenter.history.callBack', 'Call back')} ${row.callerIdNum}`}
  onClick={() => void handleCallback(row)}
>
  <PhoneCall className="w-4 h-4" />
</Button>
```
SoftphoneJournal has exactly these two actions (callback, open-card via `IdCard` button + `CallCardPopup`) and no third action (RESEARCH/UI-SPEC Surface C).

**Live-update pattern (D-05, new):** see Shared Patterns > SSE Cache-Patch below - Journal must call `callCenterApi.util.updateQueryData('getOperatorCallHistory', ..., (draft) => draft.unshift(row))` on a new `historyRow` SSE event, capping at journal depth N.

**Empty/footnote states:** reuse `rows.length === 0 && !isFetching` guard (lines 173-176) with the new Copywriting Contract strings ("Journal is empty" / "Calls will appear here..."); add the "More in History" footnote row when `rows.length >= N` (UI-SPEC Surface C).

---

### `SoftphoneContacts.tsx` (component, CRUD-read) - NEW

**Analog:** `packages/frontend/src/features/callcenter/ui/TransferDirectory/TransferDirectory.tsx`

**Imports pattern** (lines 1-17):
```typescript
import { useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Search, Users, List, UsersRound } from 'lucide-react';
import { Input, Text, Button, Tooltip, SegmentedControl } from '@/shared/ui';
import {
  useGetTransferDirectoryQuery,
  useAddToConferenceMutation,
  useClickToCallMutation,
} from '@/shared/api/endpoints/callCenterApi';
import type {
  IDirectoryEndpoint,
  IDirectoryQueue,
  IDirectoryGroup,
} from '@/shared/api/endpoints/callCenterApi';
import { requestOutboundDial } from '@/features/callcenter/model/slice/callCenterSlice';
```
SoftphoneContacts's Endpoints/Queues/Groups sections directly reuse `useGetTransferDirectoryQuery` + `mode="call"` semantics (D-25 - click-to-call only, never a transfer picker in this tab).

**Search/filter core pattern** (lines 92-111):
```typescript
const rows = useMemo<DirectoryRow[]>(() => {
  if (!data) return [];
  const term = search.trim().toLowerCase();
  const endpoints = data.endpoints
    .filter((e) => !isEndpointUnreachable(e.presence))
    .map((e) => ({ ...e, type: 'endpoint' as const }));
  ...
  if (!term) return all;
  return all.filter((row) => {
    const extension = row.type === 'endpoint' ? row.extension : '';
    return row.label.toLowerCase().includes(term) || extension.toLowerCase().includes(term);
  });
}, [data, search, typeFilter]);
```
D-14's "единый поиск" across all 5 sections (Recent/Endpoints/Queues/Groups/Book) extends this `useMemo` filter shape - one `search` state filters every section's own array independently, collapsing a section's header when its filtered array is empty (UI-SPEC Surface D).

**Click-to-call CTA pattern** (lines 119-138, 211-229):
```typescript
const handleEntryClick = async (entry: IDirectoryEndpoint) => {
  ...
  const res = await clickToCall({ target: entry.extension }).unwrap();
  if (res.mode === 'webrtc' && res.target) {
    dispatch(requestOutboundDial(res.target));
  }
  onDone?.();
};
```
```typescript
<Button
  type="button" size="sm" className={styles.ctaBtn}
  disabled={isPending(entry.id) || ...}
  aria-label={`${ctaLabel} ${entry.label}`}
  onClick={() => void handleEntryClick(entry)}
>
  {ctaLabel}
</Button>
```
The Book section's row CTA (new `cc_contacts` entries) reuses this exact `.ctaBtn`-is-the-hit-target idiom (D-25 "not the whole row", UI-SPEC Surface D). The Recent section is a client-side slice of the Journal data source (dedup by number, no new query - RESEARCH Don't Hand-Roll).

**Empty state pattern** (lines 188-194): reuse for the unified "Nothing found" case; Book section alone gets a distinct empty copy (Copywriting Contract) when it alone is empty but other sections have rows.

---

### `CallHistoryPanel.tsx` (component, CRUD) - MODIFY

**Analog:** itself, extended with `TransferDirectory.tsx`'s `SegmentedControl` filter idiom

**Current period-only control to extend into 3-way segment tabs (D-07)** (lines 82-92):
```typescript
const periodControl = (
  <SegmentedControl
    ariaLabel={t('callcenter.history.title', 'Call history')}
    value={period}
    onChange={setPeriod}
    options={[
      { value: 'shift', label: t('callcenter.history.shift', 'Shift') },
      { value: 'day', label: t('callcenter.history.day', 'Day') },
    ]}
  />
);
```
Add a second, independent `SegmentedControl` (or extend `TransferDirectory`'s `typeFilter` 4-option shape at lines 145-174) for Queue/Outbound/Personal (D-07), filtering the already-fetched `rows` client-side by `direction`/`queueName` - no new backend query (RESEARCH Pitfall 4 explicitly warns this is real UI work, not a toggle).

**Search input to add (D-10):** reuse `TransferDirectory`'s `.searchRow` `Input` block (lines 177-185) - `number/name/queue` fields for the Queue segment, `number/name/status` for Outbound/Personal, filtering the same `rows` array already in `useGetOperatorCallHistoryQuery` (no new DTO fields needed - `direction`/`queueName`/`disposition`/`callerIdNum`/`callerIdName` already exist per `IOperatorHistoryRow`, lines 288-302 of `callCenterApi.ts`).

**Existing callback/card-open handlers stay unchanged** (lines 122-153) - CallHistoryPanel's action set is untouched by D-07/D-10, only filtering UI is added.

---

### `ContactBookForm.tsx` (component, CRUD create/update/delete) - NEW

**Analog:** `packages/frontend/src/features/callcenter/ui/PauseReasonsManager/PauseReasonsManager.tsx`

**Imports pattern** (lines 1-27):
```typescript
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import {
  Button, Input, Label, Text, Skeleton, Switch,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/shared/ui';
import { UserLevel, selectUserLevel } from '@/entities/User';
import { useAppSelector } from '@/shared/hooks/useAppStore';
```
Swap `Dialog`/`DialogContent`/... for `Sheet`/`SheetContent`/`SheetHeader`/`SheetTitle` per UI-SPEC Surface D ("inline Sheet form... not a full-page modal") - `SoftphoneWidget.tsx` lines 404-417 shows the exact `Sheet` usage idiom already in this feature.

**Create/edit form-state pattern** (lines 31-64, 101-120):
```typescript
interface PauseReasonForm { name: string; color: string; max_duration: number; is_paid: boolean; sort_order: number; }
const EMPTY_FORM: PauseReasonForm = { name: '', color: DEFAULT_COLOR, max_duration: 0, is_paid: false, sort_order: 0 };
...
const openCreate = () => { setEditing(null); setForm({ ...EMPTY_FORM, ... }); setDialogOpen(true); };
const openEdit = (row: IPauseReason) => { setEditing(row); setForm({ name: row.name, ... }); setDialogOpen(true); };
```
`ContactBookForm` mirrors this with `{ name, number, note }` fields (D-14) and `editing: ICcContact | null`.

**Save/delete mutation pattern** (lines 122-157):
```typescript
const handleSave = async () => {
  const name = form.name.trim();
  if (!name) { toast.error(...); return; }
  const payload = { name, ... };
  try {
    if (editing) { await updateReason({ id: editing.uid, data: payload }).unwrap(); }
    else { await createReason(payload).unwrap(); }
    setDialogOpen(false);
    toast.success(...);
  } catch { toast.error(...); }
};
const handleDelete = async () => {
  if (!deleteTarget) return;
  try { await deleteReason(deleteTarget.uid).unwrap(); setDeleteTarget(null); toast.success(...); }
  catch { toast.error(...); }
};
```
Copy this create-vs-update branch + delete-confirmation-state shape verbatim; swap in `useCreateContactMutation`/`useUpdateContactMutation`/`useDeleteContactMutation` (new RTK endpoints) and the two destructive-confirmation copy variants (own vs. supervisor-deletes-another-operator's, per Copywriting Contract) instead of the single generic delete-confirm dialog shown here.

**Ownership-gated edit/delete buttons (D-13, new UI concern not present in this analog):** gate the `Pencil`/`Trash2` action buttons (lines 226-239) with `row.created_by === myUserId || isSupervisor` - `isSupervisor` itself is already computed exactly this way at line 53 (`level === UserLevel.SUPERVISOR || level === UserLevel.ADMIN`).

---

### `useSipPhoneAmi.ts` (hook, request-response) - NEW

**Analog:** `packages/frontend/src/features/callcenter/lib/useWebRTCPhone.ts`

**Return-shape contract to mirror** (lines 790-811):
```typescript
return {
  status, callInfo, isHeld, isMuted, quality,
  connect, disconnect, ensureConnected,
  acceptCall, rejectCall, hangup, makeCall,
  hold, unhold, mute, unmute, sendDtmf,
  blindTransfer, attendedTransfer,
};
```
`useSipPhoneAmi` must expose the same field names (`status`, `callInfo`, `isHeld`, `isMuted`, `hangup`, `hold`, `unhold`, `sendDtmf`) so `SoftphoneWidget` stays transport-agnostic (RESEARCH Pattern 2/Anti-Pattern 1); omit `quality`/device-related fields entirely (D-34 - no getStats equivalent, not merely null).

**Internal wiring — reuse existing REST mutations, do not reinvent transport:**
```typescript
export function useSipPhoneAmi(activeCall: ICall | null) {
  const [agentHangup] = useAgentHangupMutation();
  const [agentHold] = useAgentHoldMutation();
  const [agentUnhold] = useAgentUnholdMutation();
  const [sendDtmf] = useSendDtmfMutation(); // NEW endpoint
  const { data: regState } = useGetMyRegistrationStateQuery(undefined, { pollingInterval: 5000 }); // D-35

  return {
    status: regState?.online ? 'registered' : 'disconnected', // binary, no 'registering' (D-35)
    isHeld: activeCall?.status === 'HOLD',
    hangup: () => agentHangup({}),
    hold: () => agentHold(),
    unhold: () => agentUnhold(),
    sendDtmf: (digit: string) => activeCall && sendDtmf({ uniqueid: activeCall.uniqueid, digit }),
  };
}
```
(Verbatim from `10-RESEARCH.md` Pattern 2 - already codebase-grounded against the exact mutation names imported in `CallCenterAgentPage.tsx`.)

**Consumption analog inside the page orchestrator** (`CallCenterAgentPage.tsx` lines 506-519):
```typescript
const handleHoldToggle = useCallback(() => {
  if (isWebrtc) {
    if (phone.isHeld) void phone.unhold();
    else void phone.hold();
    return;
  }
  if (activeCall?.status === 'HOLD') agentUnhold();
  else agentHold();
}, [isWebrtc, phone, activeCall?.status, agentHold, agentUnhold]);
```
This existing `isWebrtc` boolean branch is the exact idiom `useSipPhoneAmi`'s consumer must extend for the new `isSip` branch - do not add a third, parallel abstraction (RESEARCH Alternatives Considered: "Unified WebRTC+SIP call-control hook" rejected).

---

### `shiftSession.ts` (utility, sessionStorage) - MODIFY

**Analog:** itself

**Full existing shape to extend** (lines 1-60):
```typescript
export const CC_ACTIVE_SHIFT_KEY = 'cc:activeShift';

export interface ActiveShiftSession {
  interface: string;
  queues: string[];
  mode: SoftphoneMode;
  endpointId: string;
  sipId: string;
  micDeviceId?: string;
  sinkId?: string;
}

export function loadActiveShift(storage: Pick<Storage, 'getItem'> = sessionStorage): ActiveShiftSession | null {
  try {
    const raw = storage.getItem(CC_ACTIVE_SHIFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ActiveShiftSession>;
    if (!parsed || typeof parsed.interface !== 'string' || ...) return null;
    return { interface: parsed.interface, ... };
  } catch { return null; }
}

export function saveActiveShift(shift: ActiveShiftSession, storage: Pick<Storage, 'setItem'> = sessionStorage): void {
  storage.setItem(CC_ACTIVE_SHIFT_KEY, JSON.stringify(shift));
}
```
D-19 (dial buffer + last number persistence) should follow this exact typed-load/typed-save/try-catch-defensive-parse shape as a **second, independent key** (e.g. `CC_DIAL_BUFFER_KEY = 'cc:dialBuffer'`) rather than bolting fields onto `ActiveShiftSession` (that interface is shift-scoped and cleared on logout; dial buffer/last-number should survive independently per D-19's own framing "redial after F5", not tied to shift lifecycle). Mirror the same injectable-`storage` param for testability (existing `shiftSession.test.ts` pattern).

---

### `useCallCenterSSE.ts` (hook, event-driven) - MODIFY

**Analog:** itself

**Cache-patch listener idiom to replicate for Journal (D-05)** (lines 247-258):
```typescript
es.addEventListener('presenceUpdate', (e: MessageEvent) => {
  try {
    const data = JSON.parse(e.data) as { extension?: string; state?: string };
    if (!data?.extension) return;
    dispatch(
      callCenterApi.util.updateQueryData('getTransferDirectory', undefined, (draft) => {
        const entry = draft.endpoints.find((ep) => ep.extension === data.extension);
        if (entry) entry.presence = data.state || entry.presence;
      }),
    );
  } catch { /* ignore */ }
});
```
New `historyRow` listener follows the identical `JSON.parse` -> `try/catch` -> `dispatch(callCenterApi.util.updateQueryData(...))` shape, but **prepends** (`draft.unshift(row)`) instead of patching an existing entry, and caps at journal depth N (see Shared Patterns > SSE Cache-Patch below).

**Simpler window-CustomEvent alternative already proven for cross-component signals** (lines 230-234, 264-266):
```typescript
es.addEventListener('missedCallNew', (e: MessageEvent) => {
  try {
    window.dispatchEvent(new CustomEvent('cc:missed-call-new', { detail: JSON.parse(e.data) }));
  } catch { /* ignore */ }
});
```
Available as a fallback if the Journal SSE event needs to reach a component outside the RTK Query cache boundary (e.g. a toast), but the direct `updateQueryData` route is the D-05-mandated primary path (no full refetch, per ARCHITECTURE Optimistic Toggles rationale).

---

### `callCenterApi.ts` (RTK Query endpoints) - MODIFY

**Analog:** itself

**Simple tenant-scoped CRUD-mutation shape to copy for `cc_contacts`** (lines 480-491):
```typescript
agentHangup: build.mutation<{ success: boolean }, { channel?: string } | void>({
  query: (body) => ({ url: '/callcenter/agent/hangup', method: 'POST', body: body || {} }),
}),
agentHold: build.mutation<{ success: boolean }, void>({
  query: () => ({ url: '/callcenter/agent/hold', method: 'POST' }),
}),
```

**Query-with-provided-tags shape to copy for `getMyContacts`** (lines 439-454):
```typescript
getTransferDirectory: build.query<ITransferDirectory, { search?: string } | void>({
  query: (params) => ({
    url: '/callcenter/agent/directory',
    params: params?.search ? { search: params.search } : undefined,
  }),
  providesTags: ['Directory'],
}),

getOperatorCallHistory: build.query<IOperatorHistoryRow[], { period?: 'shift' | 'day' } | void>({
  query: (params) => ({
    url: '/callcenter/agent/history',
    params: params?.period ? { period: params.period } : undefined,
  }),
  providesTags: ['CallHistory'],
}),
```
New endpoints needed: `getMyContacts` (`providesTags: ['CcContacts']`), `createContact`/`updateContact`/`deleteContact` mutations (each `invalidatesTags: ['CcContacts']`, following the plain-mutation shape above - no optimistic `onQueryStarted` needed per ARCHITECTURE's Optimistic Toggles rule since this is list CRUD, not a Switch/toggle), `sendDtmf` mutation, `getMyRegistrationState` query (`pollingInterval` consumer-side, per RESEARCH Pattern 2).

**Response-shape interfaces to model `ICcContact` on** (lines 288-302):
```typescript
export interface IOperatorHistoryRow {
  uid: number;
  callUniqueid: string;
  queueName: string | null;
  callerIdNum: string;
  callerIdName: string;
  direction: 'inbound' | 'outbound' | 'personal' | 'internal';
  ...
}
```
`ICcContact` follows the same flat-interface-with-`uid`-primary-key convention: `{ uid: number; name: string; number: string; note: string; createdBy: number; createdAt: string }`.

---

### `CallCenterAgentPage.tsx` (page orchestrator) - MODIFY

**Analog:** itself

**Mode computation to extend with an `isSip` counterpart** (lines 195-204, paraphrased from RESEARCH):
```typescript
const effectiveSoftphoneMode: SoftphoneMode | null = softphoneMode
  ?? (myAgentInterface && isWebrtcCompanion(...) ...);
...
const isWebrtc = effectiveSoftphoneMode === 'webrtc';
const phone = useWebRTCPhone({ ... });
```
Add `const isSip = effectiveSoftphoneMode === 'sip';` and `const sipPhone = useSipPhoneAmi(activeCall);` alongside.

**Per-action branch pattern to extend for every call-control handler** (lines 506-519):
```typescript
const handleHoldToggle = useCallback(() => {
  if (isWebrtc) {
    if (phone.isHeld) void phone.unhold();
    else void phone.hold();
    return;
  }
  if (activeCall?.status === 'HOLD') agentUnhold();
  else agentHold();
}, [isWebrtc, phone, activeCall?.status, agentHold, agentUnhold]);

const handleHangup = useCallback(() => {
  if (isWebrtc) void phone.hangup();
  if (activeCall) agentHangup({});
}, [isWebrtc, phone, activeCall, agentHangup]);
```
Note these handlers already call `agentHold`/`agentUnhold`/`agentHangup` directly (not through `sipPhone`) in the non-WebRTC branch today - Phase 10 should route the SIP branch through the new `sipPhone` facade instead, for a single call-control entry point matching D-24's "один shared handler layer".

**Softphone mount condition to widen (the actual gap per RESEARCH Pitfall 2)** (lines 867-899):
```typescript
{isWebrtc && (
  <SoftphoneWidget
    phone={phone}
    variant="chrome"
    showLabel
    callerName={activeCallLabel}
    queueLabel={activeCallQueueLabel}
    callSeconds={callTimer}
    onTransferClick={() => { setTransferError(null); setTransferModalOpen(true); }}
    onOpenCard={openCardManually}
    activeCallUniqueid={activeCall?.uniqueid}
    pendingOutboundDial={pendingOutboundDial}
    onOutboundDialConsumed={() => dispatch(clearOutboundDial())}
    extraControls={showCallControls ? (
      <CallControlBar
        variant="extended"
        uniqueid={activeCall?.uniqueid}
        isZombie={activeCall?.zombieCandidate ?? false}
        isMuted={isWebrtc ? phone.isMuted : isMuted}
        isHeld={isWebrtc ? phone.isHeld : activeCall?.status === 'HOLD'}
        onMuteToggle={handleMuteToggle}
        onHoldToggle={handleHoldToggle}
        onHangup={handleHangup}
      />
    ) : undefined}
  />
)}
```
Change the guard to `{(isWebrtc || isSip) && (<SoftphoneWidget mode={isWebrtc ? 'webrtc' : 'sip'} phone={isWebrtc ? phone : sipPhone} .../>)}` - this is the single line that currently makes SIP-mode operators see zero softphone chrome (RESEARCH's "biggest gap" finding); every other prop on this element stays as-is.

---

### `callcenter.controller.ts` (controller, CRUD) - MODIFY

**Analog:** itself

**Simple agent-scoped POST route shape** (lines 120-133):
```typescript
@Post('agent/hangup')
agentHangup(@Body() dto: AgentHangupDto, @Req() req: Request & { user: any }) {
  return this.ccService.agentHangup(req.user.vpbx_user_uid, req.user.sub, dto.channel);
}

@Post('agent/hold')
agentHold(@Req() req: Request & { user: any }) {
  return this.ccService.agentHold(req.user.vpbx_user_uid, req.user.sub);
}
```
New `POST agent/dtmf` route (`sendDtmf(dto: SendDtmfDto, req)`) and `GET agent/registration-state` route follow this exact `req.user.vpbx_user_uid`/`req.user.sub` passthrough shape - never trust a client-supplied tenant/user id (RESEARCH Security Domain).

**GET route with query DTO shape** (lines 253-269):
```typescript
@Get('agent/history')
getOperatorCallHistory(
  @Query('period') period: string | undefined,
  @Req() req: Request & { user: any },
) {
  return this.ccService.getOperatorCallHistory(
    req.user.vpbx_user_uid, req.user.sub,
    period === 'shift' ? 'shift' : 'day',
  );
}

@Get('agent/directory')
getTransferDirectory(@Query() query: DirectoryQueryDto, @Req() req: Request & { user: any }) {
  return this.ccService.getTransferDirectory(req.user.vpbx_user_uid, query.search);
}
```
`GET callcenter/contacts` follows the `@Query() query: DirectoryQueryDto`-style pattern; `POST/PUT/DELETE callcenter/contacts` follow the plain-body-DTO pattern used by `agentHangup`/`ConferenceAddDto` above.

**Class-level guard/decorator boilerplate** (lines 13-53):
```typescript
import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, Req, UseGuards, ParseIntPipe,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
...
const SUPERVISOR_LEVEL = 3;
function assertSupervisor(user: any): void {
  if (user.level < SUPERVISOR_LEVEL) {
    throw new ForbiddenException('Supervisor access required (level >= 3)');
  }
}

@UseGuards(JwtAuthGuard)
@Controller('callcenter')
export class CallCenterController {
```
All new contacts routes stay under this same `@UseGuards(JwtAuthGuard)` + `@Controller('callcenter')` class - no new guard/module needed. `assertSupervisor` is reused only where D-13's full-CRUD-for-supervisors distinction requires an explicit check (service layer is the actual enforcement point, see Shared Patterns below).

---

### `callcenter.service.ts` (service, CRUD) - MODIFY

**Analog:** itself - `createPauseReason`/`updatePauseReason`/`deletePauseReason` (tenant-scoped CRUD triplet) + `getMissedCalls` (tenant `where` filter) + `agentHold` (AMI action + `emitEvent`)

**Tenant-scoped CRUD triplet to copy for `cc_contacts`** (lines 1553-1575):
```typescript
async getPauseReasons(userUid: number) {
  return this.pauseReasonModel.findAll({
    where: { user_uid: userUid },
    order: [['sort_order', 'ASC'], ['name', 'ASC']],
  });
}

async createPauseReason(dto: any, userUid: number) {
  return this.pauseReasonModel.create({ ...dto, user_uid: userUid });
}

async updatePauseReason(id: number, dto: any, userUid: number) {
  const reason = await this.pauseReasonModel.findOne({ where: { uid: id, user_uid: userUid } });
  if (!reason) throw new NotFoundException('Pause reason not found');
  return reason.update(dto);
}

async deletePauseReason(id: number, userUid: number) {
  const reason = await this.pauseReasonModel.findOne({ where: { uid: id, user_uid: userUid } });
  if (!reason) throw new NotFoundException('Pause reason not found');
  await reason.destroy();
  return { success: true };
}
```
`createContact`/`updateContact`/`deleteContact` copy this shape, with `create` additionally setting `created_by: userId` and `update`/`delete` additionally enforcing the D-13 ownership check documented in Shared Patterns (`created_by === userId` unless `isSupervisor`) **inside the same `where` clause** (never as a separate post-fetch `if`), matching how `getMissedCalls` composes its tenant filter dynamically:
```typescript
async getMissedCalls(userUid: number, includeHandled = false, userId?: number) {
  const tenant = userId != null ? (this.stateService.findTenantForOnlineUser(userId) ?? userUid) : userUid;
  const where: any = { user_uid: tenant };
  if (!includeHandled) where.called_back = false;
  const rows = await this.missedCallModel.findAll({ where, order: [['created_at', 'DESC']], limit: 200 });
  ...
}
```

**AMI action + state-emit pattern for `sendDtmf`** (lines 559-583, `agentHold` excerpt):
```typescript
if (call.callerChannel) {
  try {
    await this.amiService.action({
      action: 'Redirect', channel: call.callerChannel, context: 'cc-hold', exten: 's', priority: '1',
    });
    this.logger.log(`Hold: redirected caller ${call.callerChannel} to MOH`);
  } catch (err: any) {
    this.logger.warn(`Hold AMI redirect failed: ${err.message}, updating state only`);
  }
}
this.stateService.setCall(agent.currentCall, { status: 'HOLD' });
this.stateService.emitEvent('callHold', userUid, { uniqueid: agent.currentCall, agent: agentInterface });
```
`sendDtmf(userUid, userId, uniqueid, digit)` follows the same "resolve agent/call from state -> call `amiService.playDtmf(channel, digit)` in a try/catch -> log on failure" shape (no `emitEvent` needed for DTMF, it is a fire-and-forget action with no client-visible state transition).

**Click-to-call / dial routing to reuse unmodified for D-33** (lines 1291-1325, `originateDial` - already shown in RESEARCH Code Examples): `sendDtmf`'s target-channel resolution should reuse `agentInterface`/`call.agentChannel` exactly as `agentHold`/`agentUnhold` already do - do not add a third independent "which mode is this operator in" heuristic (RESEARCH Pitfall 3).

---

### `callcenter-history-writer.service.ts` (service, event-driven) - MODIFY

**Analog:** itself

**Current buffered-write flow with no SSE emit (the gap, RESEARCH Pitfall 1)** (lines 48-64):
```typescript
@Interval(FLUSH_INTERVAL_MS)
async flush(): Promise<void> {
  if (this.buffer.length === 0) return;
  const batch = this.buffer;
  this.buffer = [];
  try {
    await this.model.bulkCreate(batch as any[], { validate: false });
  } catch (e: any) {
    this.logger.error(`History batch flush failed (${batch.length} rows): ${e?.message}`);
  }
}
```
Add, immediately after a successful `bulkCreate`, one `emitEvent('historyRow', row.user_uid, {...})` call per row (needs `CallCenterStateService` injected into this service - not currently a constructor dependency, check `callcenter.module.ts` providers). Reuse the exact `emitEvent(eventName, tenantUid, payload)` signature already proven at `agentHold`'s `this.stateService.emitEvent('callHold', userUid, {...})` (see `callcenter.service.ts` excerpt above) - same two-argument-plus-payload shape, different event name.

---

### `models/cc-contact.model.ts` (model) - NEW

**Analog:** `packages/backend/src/modules/callcenter/models/missed-call.model.ts`

**Full tenant + ownership column shape to copy** (entire file, 61 lines):
```typescript
import { Column, DataType, Model, Table } from 'sequelize-typescript';

@Table({ tableName: 'cc_missed_calls', timestamps: false })
export class CcMissedCall extends Model {
  @Column({ primaryKey: true, autoIncrement: true, type: DataType.BIGINT })
  declare uid: number;

  @Column({ type: DataType.STRING(64), allowNull: false, unique: true })
  declare call_uniqueid: string;
  ...
  /** User id of the operator who called back (NULL until handled). */
  @Column({ type: DataType.INTEGER, allowNull: true })
  declare called_back_by: number;
  ...
  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  declare created_at: Date;

  // Tenant isolation
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'vpbx_user_uid' })
  declare user_uid: number;
}
```
`CcContact` copies: `uid` (PK, autoincrement), `user_uid` (tenant, `field: 'vpbx_user_uid'`), plus new `name` (`STRING(128)`, `allowNull: false` - the field `route_phonebook_entries` is missing per RESEARCH Don't Hand-Roll), `number` (`STRING(64)`, `allowNull: false`), `note` (`STRING(255)`, nullable), `created_by` (`INTEGER`, `allowNull: false` - modeled on `called_back_by`'s "operator user id" role but non-nullable since every contact has a creator from row 1), `created_at`/`updated_at` (`DataType.NOW` default).

---

### `dto/callcenter-contacts.dto.ts` (DTO) - NEW

**Analog:** `packages/backend/src/modules/callcenter/dto/callcenter-missed.dto.ts`

**Full file to model shape on** (14 lines):
```typescript
import { IsString, MaxLength } from 'class-validator';

export class MissedCallActionDto {
  @IsString()
  @MaxLength(64)
  callerIdNum: string;
}
```
`CreateContactDto`/`UpdateContactDto` (`name: @IsString() @MaxLength(128)`, `number: @IsString() @MaxLength(64)`, `note?: @IsOptional() @IsString() @MaxLength(255)`) and `SendDtmfDto` (`uniqueid: @IsString() @MaxLength(64)`, `digit: @IsString() @Matches(/^[0-9*#A-D]$/)` per RESEARCH Security Domain's single-character AMI-injection guard) follow this exact one-class-per-concern, `class-validator`-decorator-only file style - keep contacts DTOs in their own file (this file's own doc comment explains the convention: "avoid a wave collision, same convention as dto/callcenter-callcontrol.dto.ts").

---

### `migrate-callcenter-contacts.ts` (migration) - NEW

**Analog:** `packages/backend/src/modules/call-groups/migrate-call-groups-phase6.ts`

**Full standalone-script shape to copy** (lines 1-46, 81-85):
```typescript
import { Sequelize } from 'sequelize-typescript';
import { DataTypes, QueryInterface } from 'sequelize';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

async function main() {
  const sequelize = new Sequelize({
    dialect: 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    username: process.env.DB_USER || 'krasterisk',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'krasterisk',
    logging: console.log,
  });

  const qi: QueryInterface = sequelize.getQueryInterface();

  console.log('[migration] Creating call_groups...');
  await qi.createTable('call_groups', {
    uid: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(128), allowNull: false },
    ...
    vpbx_user_uid: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  }, { ifNotExists: true } as any);

  try {
    await qi.addIndex('call_groups', ['vpbx_user_uid'], { name: 'idx_call_groups_user_uid' });
  } catch (e) {
    console.log('[migration] idx_call_groups_user_uid:', (e as Error).message);
  }
  ...
  console.log('[migration] Phase 6 call-groups migration complete.');
  await sequelize.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
```
`migrate-callcenter-contacts.ts` follows this verbatim: one `qi.createTable('cc_contacts', { uid, name, number, note, created_by, vpbx_user_uid, created_at, updated_at }, { ifNotExists: true })` plus one `addIndex(['vpbx_user_uid'])` (tenant scans) and one `addIndex(['created_by'])` (ownership-filtered edit/delete queries) - both wrapped in the same try/catch-log-don't-throw idiom shown above, since `addIndex` on an already-indexed column throws on rerun.

---

### `ami.service.ts` (add `playDtmf`) - MODIFY

**Analog:** itself (`hangup` method)

**Thin-wrapper shape to copy** (lines 433-477):
```typescript
async action(action: Record<string, any>): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!this.connected) {
      reject(new Error('AMI not connected'));
      return;
    }
    this.ami.action(action, (err: any, res: any) => { ... });
  });
}

async hangup(channel: string): Promise<any> {
  return this.action({ action: 'Hangup', channel });
}
```
Add directly below `hangup`:
```typescript
async playDtmf(channel: string, digit: string): Promise<any> {
  return this.action({ action: 'PlayDTMF', channel, digit });
}
```
Digit format/character-set validation happens in the DTO (`SendDtmfDto.digit` regex above) and/or the calling service method - `AmiService.playDtmf` itself stays a pure thin wrapper with zero validation logic, exactly like `hangup`.

## Shared Patterns

### Tenant isolation (every new backend method)
**Source:** `packages/backend/src/modules/callcenter/callcenter.service.ts` (`getMissedCalls`, `createPauseReason`/`updatePauseReason`/`deletePauseReason`)
**Apply to:** `callcenter.controller.ts` contacts routes, `callcenter.service.ts` contacts CRUD + `sendDtmf` + `getMyRegistrationState`, `models/cc-contact.model.ts`
```typescript
// controller: never trust client-supplied tenant/user id
return this.ccService.createContact(dto, req.user.vpbx_user_uid, req.user.sub);

// service: user_uid always comes from the JWT-derived arg, never dto
async createContact(dto: CreateContactDto, userUid: number, userId: number) {
  return this.contactModel.create({ ...dto, user_uid: userUid, created_by: userId });
}
```

### Ownership-gated CRUD (D-13 - composed pattern, no single existing analog)
**Source:** `PauseReasonsManager.tsx` line 53 (`isSupervisor` computation) + `callcenter.service.ts` `updatePauseReason`/`deletePauseReason` (tenant-scoped `findOne`) + `missed-call.model.ts`'s `called_back_by` column shape
**Apply to:** `ContactBookForm.tsx` (hide edit/delete buttons per-row), `callcenter.service.ts` `updateContact`/`deleteContact` (enforce server-side - UI hiding is not a security boundary per RESEARCH Security Domain)
```typescript
// service - ownership folded into the where clause, not a separate post-fetch check
async updateContact(id: number, dto: UpdateContactDto, userUid: number, userId: number, isSupervisor: boolean) {
  const where: any = { uid: id, user_uid: userUid };
  if (!isSupervisor) where.created_by = userId;
  const contact = await this.contactModel.findOne({ where });
  if (!contact) throw new NotFoundException('Contact not found');
  return contact.update(dto);
}
```
No single file in the codebase already composes tenant + ownership + role-bypass in one CRUD method - this is the one genuinely new access-control shape in Phase 10 (RESEARCH Security Domain V4 flags exactly this).

### SSE cache-patch idiom (D-05, D-35 registration polling as fallback)
**Source:** `useCallCenterSSE.ts` `presenceUpdate` listener (lines 247-258)
**Apply to:** `useCallCenterSSE.ts` new `historyRow` listener, `callCenterApi.ts` `getOperatorCallHistory` cache
```typescript
es.addEventListener('historyRow', (e: MessageEvent) => {
  try {
    const row = JSON.parse(e.data);
    dispatch(
      callCenterApi.util.updateQueryData('getOperatorCallHistory', { period: 'shift' }, (draft) => {
        draft.unshift(row);
        if (draft.length > journalDepthN) draft.pop();
      }),
    );
  } catch { /* ignore */ }
});
```
Never `invalidatesTags` + refetch for this - the codebase's own Optimistic Toggles rationale (avoids list-position jank) already governs this exact tradeoff.

### `isWebrtc`/`isSip` per-action branching (D-24, D-31…D-35)
**Source:** `CallCenterAgentPage.tsx` `handleHoldToggle`/`handleMuteToggle`/`handleHangup` (lines 494-519)
**Apply to:** every call-control handler in `CallCenterAgentPage.tsx`, the `SoftphoneWidget` mount condition, `CallControlBar` prop wiring
```typescript
const handleHoldToggle = useCallback(() => {
  if (isWebrtc) { /* phone.hold()/unhold() */ return; }
  if (isSip) { /* sipPhone.hold()/unhold() - NEW branch, same shape */ return; }
  /* legacy non-branching fallback, if any */
}, [isWebrtc, isSip, phone, sipPhone, ...]);
```
Extend, never replace, per RESEARCH's explicit rejection of a unified hook.

### Tenant-scoped RTK Query mutation/query pairs
**Source:** `callCenterApi.ts` `agentHold`/`agentUnhold` (plain mutations) + `getTransferDirectory`/`getOperatorCallHistory` (tag-provided queries)
**Apply to:** all new `cc_contacts` and DTMF/registration-state endpoints
```typescript
createContact: build.mutation<ICcContact, { name: string; number: string; note?: string }>({
  query: (body) => ({ url: '/callcenter/contacts', method: 'POST', body }),
  invalidatesTags: ['CcContacts'],
}),
getMyContacts: build.query<ICcContact[], void>({
  query: () => '/callcenter/contacts',
  providesTags: ['CcContacts'],
}),
```

## No Analog Found

| File/Concern | Role | Data Flow | Reason |
|---------------|------|-----------|--------|
| Ownership-gated CRUD (D-13 full mechanism) | service (cross-cutting) | CRUD | No existing table combines tenant isolation + per-row `created_by` ownership + role-bypass in one query; documented as a **composed** Shared Pattern above instead of a single-file analog (closest ingredients: `PauseReasonsManager.tsx`'s `isSupervisor` calc + `missed-call.model.ts`'s `called_back_by` column + `updatePauseReason`'s tenant-scoped `findOne`) |

## Metadata

**Analog search scope:** `packages/frontend/src/features/callcenter/`, `packages/frontend/src/pages/CallCenterAgentPage/`, `packages/frontend/src/shared/api/endpoints/callCenterApi.ts`, `packages/backend/src/modules/callcenter/`, `packages/backend/src/modules/ami/`, `packages/backend/src/modules/call-groups/` (migration precedent only)
**Files scanned:** ~30 read/grepped this session (SoftphoneWidget.tsx, CallHistoryPanel.tsx, TransferDirectory.tsx, useCallCenterSSE.ts, shiftSession.ts, useWebRTCPhone.ts, callCenterApi.ts, CallCenterAgentPage.tsx, callcenter.controller.ts, callcenter.service.ts, callcenter-history-writer.service.ts, ami.service.ts, callcenter-presence.service.ts, missed-call.model.ts, cc-settings.model.ts, callcenter-missed.dto.ts, PauseReasonsManager.tsx, migrate-callcenter-autopause-enabled.ts, migrate-call-groups-phase6.ts, callcenter-chat.service.ts + related model)
**Pattern extraction date:** 2026-07-24
