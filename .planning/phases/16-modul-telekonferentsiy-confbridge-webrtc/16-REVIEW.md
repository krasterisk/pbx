---
phase: 16-modul-telekonferentsiy-confbridge-webrtc
reviewed: 2026-09-16T02:50:00Z
depth: standard
files_reviewed: 28
files_reviewed_list:
  - packages/backend/src/modules/conferences/conference-dialplan.util.ts
  - packages/backend/src/modules/conferences/conference-rooms.service.ts
  - packages/backend/src/modules/conferences/conference-state.service.ts
  - packages/backend/src/modules/conferences/conference-sse.controller.ts
  - packages/backend/src/modules/conferences/conference-ephemeral.service.ts
  - packages/backend/src/modules/conferences/conference-moderation.service.ts
  - packages/backend/src/modules/conferences/conference-entry-policy.util.ts
  - packages/backend/src/modules/conferences/dto/conference-participant.dto.ts
  - packages/backend/src/modules/conferences/conference-stale-channel-sweeper.service.ts
  - packages/backend/src/modules/conferences/conference-rooms.controller.ts
  - packages/backend/src/modules/conferences/conference-moderation.controller.ts
  - packages/backend/src/modules/conferences/conference-participant.controller.ts
  - packages/backend/src/modules/conferences/conference-roles.util.ts
  - packages/backend/src/modules/conferences/conferences.module.ts
  - packages/backend/src/modules/conferences/dto/create-conference-room.dto.ts
  - packages/backend/src/modules/conferences/dto/update-conference-room.dto.ts
  - packages/backend/src/modules/conferences/dto/conference-moderator.dto.ts
  - packages/backend/src/modules/conferences/models/conference-room.model.ts
  - packages/backend/src/modules/conferences/setup-conferences-schema.ts
  - packages/backend/src/modules/conferences/confbridge-static-profile.service.ts
  - packages/backend/src/modules/ami/ami.service.ts
  - packages/backend/src/shared/utils/dialplan.util.ts
  - packages/backend/src/shared/utils/dialplan-target.util.ts
  - packages/backend/src/modules/callcenter/callcenter.service.ts
  - packages/frontend/src/shared/api/endpoints/conferenceRoomApi.ts
  - packages/frontend/src/features/dialplan-apps/model/schemas/confBridge.tsx
  - packages/frontend/src/features/dialplan-apps/model/useSchemaRefs.ts
  - packages/frontend/src/features/dialplan-apps/ui/ValueSourceField/ValueSourceField.tsx
findings:
  critical: 3
  warning: 7
  info: 2
  total: 12
status: issues
---

# Phase 16: Code Review Report

**Reviewed:** 2026-09-16T02:50:00Z
**Depth:** standard
**Files Reviewed:** 28
**Status:** issues

## Summary

Advisory review of Phase 16 conference-core (plans 16-01…16-07): ConfBridge dialplan, tenant CRUD, ephemeral call-center rooms, AMI live state, SSE, roles/moderation, entry policy, participant DTO, and the stale-channel sweeper. Scope is `packages/backend/src/modules/conferences/**` plus AMI listeners, `dialplan.util.ts` confbridge hop, `addToConference`, and the frontend room catalog (`conferenceRoomApi`, `confBridge` schema, `ValueSourceField`). Unrelated dirty-tree files were ignored.

Tenant isolation on HTTP paths is generally sound: `user_uid` / `vpbx_user_uid` comes from JWT, DTOs strip tenant fields, and `assertLiveRoomAccess` gates SSE and live actions. Dialplan generation sanitizes inputs and keeps ConfBridge() inside the room category.

The live-state path is not production-safe. `asterisk-manager` lowercases AMI headers; conference handlers read PascalCase only, so join/leave/talk/mute never land. The sweeper then treats a quiet live channel as stale and kicks it after 121s. Public create/update also allow `kind: 'ephemeral'`, which `collectIfEmpty` will delete.

| Focus check | Verdict |
|-------------|---------|
| Tenant JWT scoping on CRUD / SSE / moderation | Pass — `where: { uid, user_uid: vpbx }` |
| AMI Confbridge* → in-memory state | Fail — PascalCase keys vs lowercase AMI |
| SSE first message is mapped DTO | Pass in unit tests; dead in production until AMI parse is fixed |
| PIN / wait_marked via `conferenceEntryPolicy` | Pass as a translator; PIN is still returned on GET list |
| Ephemeral reuse / collect | Fail — reuses any number match; public `kind` can delete rooms |
| Stale sweeper 120s + no AMI when disconnected | Partial — disconnected guard is correct; silent live users are kicked |
| Catalog uid stays a string | Pass — `String(room.uid)` in `useSchemaRefs` |

## Critical Issues

### CR-01: AMI ConfBridge events are dropped — live state, SSE, and moderation stay empty

**File:** `packages/backend/src/modules/conferences/conference-state.service.ts:188-201`
**Also:** `packages/backend/src/modules/conferences/conference-state.service.ts:46-54`, `293-297`, `325-333`; `packages/backend/src/modules/conferences/conference-roles.util.ts:28-31`; `packages/backend/src/modules/ami/ami.service.ts:305`, `448-463`

**Issue:** `asterisk-manager` lowercases every header. The same file already documents this on AgentConnect (`evt.destchannel`, not `DestChannel`) and every other listener reads `evt.channel` / `evt.calleridnum`. Conference handlers pass the raw event into `ConferenceStateService`, which only reads `evt.Conference`, `evt.Channel`, `evt.CallerIDNum`, `evt.TalkingStatus`, `evt.Admin`, `evt.MarkedUser`. On a live AMI socket those keys are undefined: `resolveRoom` returns null, `handleJoin`/`handleLeave`/`handleTalking`/`handleMute` no-op. Unit tests mock PascalCase, so they stay green. Result: SSE snapshots stay empty, `waitingForModerator` never flips, mute/kick/`me/video` fail with "not in the room", and the sweeper never sees members.

**Fix:** Dual-read lowercase keys at the AMI boundary (or inside `ConferenceStateService`) and add a test that feeds lowercase headers.

```ts
function amiStr(evt: ConferenceAmiEvent, ...keys: string[]): string {
  const rec = evt as Record<string, unknown>;
  for (const key of keys) {
    const value = rec[key] ?? rec[key.toLowerCase()];
    if (value != null && String(value).trim()) return String(value);
  }
  return '';
}

// handleJoin / resolveRoom
const conference = amiStr(evt, 'Conference');
const channel = amiStr(evt, 'Channel');
const callerIdNum = amiStr(evt, 'CallerIDNum');
```

### CR-02: Stale sweeper kicks silent live participants after 121 seconds

**File:** `packages/backend/src/modules/conferences/conference-stale-channel-sweeper.service.ts:46-55`
**Also:** `packages/backend/src/modules/conferences/conference-state.service.ts:182-186`, `203`, `225-247`, `354-356`

**Issue:** `lastSignalAt` is touched only on join, talking, mute, and unmute. ConfBridge does not emit periodic talking pulses — only start/stop. A muted or listen-only participant therefore becomes `isStale` 121s after join. `tick()` then sends `ConfbridgeKick`. The unit test at `conference-stale-channel-sweeper.service.spec.ts:63-75` encodes this: join, advance 121s, expect a kick. That matches leftover-channel cleanup after a missed Leave, but it cannot distinguish a zombie channel from a live quiet user. After a process restart the opposite hole remains: true Asterisk leftovers are not in `rooms`, so the sweeper never walks them.

**Fix:** Do not treat "no talking/mute event" as dead. Reconcile against AMI (`ConfbridgeList` / channel status) and kick only when Asterisk no longer has the channel, or touch `lastSignalAt` from a periodic list snapshot.

```ts
const listed = await this.amiService.action({
  action: 'ConfbridgeList',
  conference,
});
const live = new Set(listedChannels(listed));
for (const item of channels) {
  if (!live.has(item.channel)) {
    this.stateService.handleLeave({ Conference: conference, Channel: item.channel });
  }
}
```

### CR-03: Public create/update can mark a room ephemeral and `collectIfEmpty` will delete it

**File:** `packages/backend/src/modules/conferences/dto/create-conference-room.dto.ts:25-27`
**Also:** `packages/backend/src/modules/conferences/dto/update-conference-room.dto.ts:28-30`; `packages/backend/src/modules/conferences/conference-ephemeral.service.ts:69-73`

**Issue:** `kind` is a public DTO field (`permanent` | `ephemeral`). Any JWT tenant user can `POST /conferences` with `kind: 'ephemeral'` or `PUT` an existing scheduled room to ephemeral. On the next last-leave, `collectIfEmpty` destroys that row and its dialplan. Ephemeral is an internal call-center mechanism (`ensureRoomForCall`); exposing it on the tenant CRUD surface is a data-loss path.

**Fix:** Strip `kind` from public DTOs. Force `kind: 'permanent'` in `ConferenceRoomsService.create`/`update`. Only `ConferenceEphemeralService` should write `ephemeral`.

```ts
// create / update
delete data.kind;
// create:
kind: 'permanent',
```

## Warnings

### WR-01: `ensureRoomForCall` reuses any tenant room with the same number, including permanent rooms

**File:** `packages/backend/src/modules/conferences/conference-ephemeral.service.ts:41-44`

**Issue:** Lookup is `{ user_uid, number }` with `number = uniqueid.replace(/\D/g, '').slice(0, 32)`. If those digits match a permanent room (or a leftover ephemeral from another call), `addToConference` Redirects both call legs into that room. `collectIfEmpty` will not delete a permanent room, but the operator conference has now joined a scheduled meeting.

**Fix:** Restrict reuse to `kind: 'ephemeral'` and namespace the number (prefix or a dedicated column) so uniqueid digits cannot collide with a public room number.

```ts
const existing = await this.roomModel.findOne({
  where: { user_uid: vpbx, number, kind: 'ephemeral' },
});
```

### WR-02: Guest participant DTO `ref` is not a usable moderation key

**File:** `packages/backend/src/modules/conferences/dto/conference-participant.dto.ts:36-41`

**Issue:** Empty `CallerIDNum` maps to `ref: "participant"` (lowercase of `ANONYMOUS_DISPLAY_NAME`). Two guests collapse to the same ref. `findLiveParticipant` matches `channel` or `callerIdNum`, neither of which is `"participant"`. Moderation tests grant guests via the raw channel (`PJSIP/gst-0001`), but SSE/UI consumers only see the six-key DTO. Mute/kick/grant from the live-room UI will 404 for guests.

**Fix:** Use a stable unique ref when CID is empty (channel is internal — hash it, or keep a short opaque id in state and emit that). Never reuse a constant string.

```ts
ref: callerIdNum || `anon:${shortHash(state.channel)}`,
```

### WR-03: `registerRoom` does not hydrate `roomRights` — roles and wait-flag are wrong after restart

**File:** `packages/backend/src/modules/conferences/conference-rooms.service.ts:77-85`
**Also:** `packages/backend/src/modules/conferences/conference-state.service.ts:78-91`, `258-265`, `276-281`

**Issue:** `findAll` / `findOne` / `assertLiveRoomAccess` call `registerRoom` (name + entry policy only). `setRoomRights` runs only inside `applyRoom` (create/update/setModerators). After a process restart, SSE subscribe registers the room with empty rights. `handleJoin` then marks the owner as `participant`. `waitingForModerator` stays true even though ConfBridge already elevated them via dialplan. Moderation HTTP still reads DB (OK); the snapshot/SSE path does not.

**Fix:** Load moderator rows whenever a room is registered for live use.

```ts
this.stateService.registerRoom(room);
this.syncRoomRights(room.uid, this.toPermanentRights(await this.loadModeratorRows(room.uid)));
```

### WR-04: Dialplan apply failures are swallowed after a successful DB write

**File:** `packages/backend/src/modules/conferences/conference-rooms.service.ts:154-160`
**Also:** `packages/backend/src/modules/conferences/conference-rooms.service.ts:221-227`, `257-278`, `376-382`

**Issue:** create / update / remove / setRoomModerators commit (or destroy) the row, then catch `applyRoom` / `deleteCategories` and only log. The HTTP client gets success. The room is missing from Asterisk, or a deleted room's `krsk-conf-{uid}` remains reachable, or mask-index still lists the number. Callers then hit `Playback(invalid)` or a stale context.

**Fix:** Surface a structured warning on the response, or fail the request (and compensate the DB write) when apply fails. At minimum return `{ ..., dialplanApplied: false }` and a `CONFERENCE_DIALPLAN_APPLY_FAILED` code.

### WR-05: `remove` does not drop live-state cache for the deleted room

**File:** `packages/backend/src/modules/conferences/conference-rooms.service.ts:232-281`

**Issue:** After destroy, `conferenceByName` / `conferenceByRoom` / `rooms` / `streams` still hold the old uid and `conf{number}_{vpbx}` key. AMI events (once CR-01 is fixed) keep updating a deleted room. A later room with the same number overwrites the name map; until then SSE subscribers already connected keep receiving events for a row that 404s on a new subscribe.

**Fix:** Add `ConferenceStateService.unregisterRoom(roomUid)` and call it from `remove` after commit.

### WR-06: `GET /conferences` returns room PIN to every tenant JWT

**File:** `packages/backend/src/modules/conferences/conference-rooms.service.ts:77-86`
**Also:** `packages/backend/src/modules/conferences/models/conference-room.model.ts:39-40`

**Issue:** `findAll`/`findOne` return `room.toJSON()` including `pin`. The catalog client only types `{ uid, number, name }`, but the wire payload still carries the PIN. Any authenticated tenant user (and the route-step editor catalog fetch) receives join secrets for every room.

**Fix:** Omit `pin` from list/catalog responses. Return it only on an owner/moderator detail path, or as `pin_set: boolean`.

### WR-07: `addToConference` Originates `PJSIP/${target}` without validating the extension

**File:** `packages/backend/src/modules/callcenter/callcenter.service.ts:1765-1784`

**Issue:** `target` is stripped of a `PJSIP/`/`SIP/` prefix and interpolated into the Originate channel. Comma, ampersand, or context fragments become AMI channel syntax (`PJSIP/101&Local/s@elsewhere`). Tenant isolation of the *room* is correct; the third-party channel is not constrained to a tenant endpoint.

**Fix:** Accept only a tenant endpoint / numeric exten (same validator as `ConferenceModeratorDto` / endpoint lookup) before Originate.

```ts
const exten = target.replace(/^PJSIP\//, '').replace(/^SIP\//, '');
if (!/^\d{1,32}$/.test(exten)) {
  throw new BadRequestException('Conference target must be an extension');
}
```

## Info

### IN-01: Conference catalog still uses queue copy in `ValueSourceField`

**File:** `packages/frontend/src/features/dialplan-apps/ui/ValueSourceField/ValueSourceField.tsx:192-195`
**Also:** `packages/frontend/src/features/dialplan-apps/ui/ValueSourceField/ValueSourceField.tsx:363-365`

**Issue:** Dynamic optgroup stays «Динамичная очередь»; required-empty error stays «Укажите очередь». Room select works; the labels are wrong for the conference field.

**Fix:** Branch those strings on `isConferenceCatalog` the same way the static optgroup already does.

### IN-02: Per-room SSE `Subject` is never completed or removed

**File:** `packages/backend/src/modules/conferences/conference-state.service.ts:336-343`

**Issue:** `streams` grows with every `roomUid` that ever had a subscriber and is not cleared on `remove` or last-unsubscribe. Not a correctness bug in a single-tenant lab, but leaked subscriptions keep emitting after the room is gone (see WR-05).

**Fix:** `complete()` and `delete` the subject in `unregisterRoom`, and drop it when the last SSE subscriber unsubscribes.

---

_Reviewed: 2026-09-16T02:50:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
