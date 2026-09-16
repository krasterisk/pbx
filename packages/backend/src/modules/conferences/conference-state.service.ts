import { Injectable, Logger, Optional } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { getModelToken } from '@nestjs/sequelize';
import { Observable, Subject } from 'rxjs';
import { ConferenceRoom } from './models/conference-room.model';
import {
  conferenceEntryPolicy,
  type ConferenceEntryPolicy,
  type ConferenceEntryPolicyRoom,
} from './conference-entry-policy.util';
import {
  CONFBRIDGE_ROLE_FLAGS,
  resolveRoleForCaller,
  roleFromConfbridgeFlags,
  type ConferenceRole,
} from './conference-roles.util';
import { truncateDisplayName } from './dto/conference-participant.dto';

export type ConferenceParticipantRole = ConferenceRole;

export interface ConferenceParticipantState {
  channel: string;
  callerIdNum: string;
  role: ConferenceParticipantRole;
  talking: boolean;
  muted: boolean;
  video: boolean;
  joinedAt: number;
  displayName?: string;
}

export interface ConferenceRoomRights {
  ownerRef: string | null;
  moderatorRefs: string[];
}

export interface ConferenceRoomSnapshot {
  roomUid: number;
  conference: string | null;
  participants: ConferenceParticipantState[];
  waitingForModerator: boolean;
  recording: boolean;
}

export interface ConferenceEvent {
  type: string;
  roomUid: number;
  data: ConferenceRoomSnapshot;
}

export interface ConferenceAmiEvent {
  Conference?: string;
  Channel?: string;
  CallerIDNum?: string;
  Admin?: string;
  MarkedUser?: string;
  TalkingStatus?: string;
  [key: string]: unknown;
}

/** asterisk-manager lowercases AMI headers — accept both casings. */
function amiString(evt: ConferenceAmiEvent, ...names: string[]): string {
  const lower = new Map<string, unknown>();
  for (const [key, value] of Object.entries(evt ?? {})) {
    lower.set(key.toLowerCase(), value);
  }
  for (const name of names) {
    const value = lower.get(name.toLowerCase());
    if (value != null && String(value).trim() !== '') return String(value);
  }
  return '';
}

interface RoomCacheEntry {
  roomUid: number;
  number: string;
  vpbx: number;
  conference: string;
  entryPolicy: ConferenceEntryPolicy;
}

@Injectable()
export class ConferenceStateService {
  private readonly logger = new Logger(ConferenceStateService.name);

  constructor(@Optional() private readonly moduleRef?: ModuleRef) {}

  private readonly rooms = new Map<number, Map<string, ConferenceParticipantState>>();
  private readonly streams = new Map<number, Subject<ConferenceEvent>>();
  private readonly streamObservers = new Map<number, number>();
  private readonly lastSignalAt = new Map<string, number>();
  private readonly conferenceByName = new Map<string, RoomCacheEntry>();
  private readonly conferenceByRoom = new Map<number, RoomCacheEntry>();
  private readonly roomRights = new Map<number, ConferenceRoomRights>();
  private readonly liveGrants = new Map<number, Map<string, ConferenceRole>>();
  private readonly rememberedNames = new Map<number, Map<string, string>>();
  private readonly recordingByRoom = new Map<number, boolean>();
  private readonly hydrating = new Map<string, Promise<RoomCacheEntry | null>>();

  registerRoom(
    room: { uid: number; number: string; user_uid: number } & ConferenceEntryPolicyRoom,
  ): void {
    const conference = `conf${room.number}_${room.user_uid}`;
    const entry: RoomCacheEntry = {
      roomUid: room.uid,
      number: room.number,
      vpbx: room.user_uid,
      conference,
      entryPolicy: conferenceEntryPolicy(room),
    };
    this.conferenceByName.set(conference, entry);
    this.conferenceByRoom.set(room.uid, entry);
  }

  setRoomRights(roomUid: number, rights: ConferenceRoomRights): void {
    this.roomRights.set(roomUid, {
      ownerRef: rights.ownerRef,
      moderatorRefs: [...rights.moderatorRefs],
    });
  }

  grantRole(roomUid: number, participantRef: string, role: ConferenceRole): void {
    const participant = this.findLiveParticipant(roomUid, participantRef);
    if (!participant) return;
    if (participant.role === 'owner' || role === 'participant') return;
    const grants = this.grantsFor(roomUid);
    grants.set(participant.channel, role);
    if (participant.callerIdNum) grants.set(participant.callerIdNum, role);
    grants.set(participantRef, role);
    participant.role = role;
    this.emit(roomUid, 'roleGrant');
  }

  revokeRole(roomUid: number, participantRef: string): void {
    const participant = this.findLiveParticipant(roomUid, participantRef);
    const grants = this.liveGrants.get(roomUid);
    grants?.delete(participantRef);
    if (participant) {
      grants?.delete(participant.channel);
      if (participant.callerIdNum) grants?.delete(participant.callerIdNum);
      participant.role = this.roleFromSettings(roomUid, participant.callerIdNum);
      this.emit(roomUid, 'roleRevoke');
    }
  }

  getGrantedRole(roomUid: number, participantRef: string): ConferenceRole | undefined {
    return this.liveGrants.get(roomUid)?.get(participantRef);
  }

  getLiveGrants(roomUid: number): Array<{ participantRef: string; role: ConferenceRole }> {
    return [...(this.liveGrants.get(roomUid)?.entries() ?? [])].map(([participantRef, role]) => ({
      participantRef,
      role,
    }));
  }

  findLiveParticipant(
    roomUid: number,
    participantRef: string,
  ): ConferenceParticipantState | undefined {
    return this.getSnapshot(roomUid).participants.find(
      (item) => item.channel === participantRef || item.callerIdNum === participantRef,
    );
  }

  getSnapshot(roomUid: number): ConferenceRoomSnapshot {
    const participants = [...(this.rooms.get(roomUid)?.values() ?? [])].sort((a, b) => {
      if (a.joinedAt !== b.joinedAt) return a.joinedAt - b.joinedAt;
      return a.channel.localeCompare(b.channel);
    });
    return {
      roomUid,
      conference: this.conferenceByRoom.get(roomUid)?.conference ?? null,
      participants,
      waitingForModerator: this.computeWaitingForModerator(roomUid, participants),
      recording: this.recordingByRoom.get(roomUid) ?? false,
    };
  }

  setRecording(roomUid: number, value: boolean): void {
    this.recordingByRoom.set(roomUid, value);
    this.emit(roomUid, 'recording');
  }

  getEventStream(roomUid: number): Observable<ConferenceEvent> {
    const subject = this.subjectFor(roomUid);
    return new Observable((subscriber) => {
      this.streamObservers.set(roomUid, (this.streamObservers.get(roomUid) ?? 0) + 1);
      const sub = subject.subscribe(subscriber);
      return () => {
        sub.unsubscribe();
        const next = (this.streamObservers.get(roomUid) ?? 1) - 1;
        if (next <= 0) this.streamObservers.delete(roomUid);
        else this.streamObservers.set(roomUid, next);
      };
    });
  }

  streamObserverCount(roomUid: number): number {
    return this.streamObservers.get(roomUid) ?? 0;
  }

  getActiveRoomUids(): number[] {
    return [...this.rooms.entries()]
      .filter(([, members]) => members.size > 0)
      .map(([roomUid]) => roomUid);
  }

  getLiveChannelPairs(
    roomUid: number,
  ): Array<{ participantRef: string; channel: string }> {
    return this.getSnapshot(roomUid).participants.map((item) => ({
      participantRef: item.callerIdNum || item.channel,
      channel: item.channel,
    }));
  }

  getRoomIdentity(roomUid: number): { number: string; vpbx: number } | null {
    const cached = this.conferenceByRoom.get(roomUid);
    if (!cached) return null;
    return { number: cached.number, vpbx: cached.vpbx };
  }

  isStale(channel: string, thresholdMs: number): boolean {
    const last = this.lastSignalAt.get(channel);
    if (last == null) return false;
    return Date.now() - last > thresholdMs;
  }

  handleJoin(evt: ConferenceAmiEvent): void | Promise<void> {
    const channel = amiString(evt, 'Channel');
    if (!channel) return;
    const resolved = this.resolveRoom(evt);
    if (resolved) {
      return this.applyJoin(resolved, evt, channel);
    }
    return this.hydrateRoom(evt).then((entry) => {
      if (entry) return this.applyJoin(entry, evt, channel);
    });
  }

  handleLeave(evt: ConferenceAmiEvent): void | Promise<void> {
    const channel = amiString(evt, 'Channel');
    if (!channel) return;
    const resolved = this.resolveRoom(evt);
    if (resolved) {
      return this.applyLeave(resolved, channel, evt);
    }
    return this.hydrateRoom(evt).then((entry) => {
      if (entry) return this.applyLeave(entry, channel, evt);
    });
  }

  private applyJoin(
    resolved: RoomCacheEntry,
    evt: ConferenceAmiEvent,
    channel: string,
  ): void | Promise<void> {
    const members = this.membersFor(resolved.roomUid);
    const callerIdNum = amiString(evt, 'CallerIDNum');
    const remembered = this.rememberedNames.get(resolved.roomUid)?.get(callerIdNum);
    members.set(channel, {
      channel,
      callerIdNum,
      role: this.resolveJoinRole(resolved.roomUid, evt),
      talking: false,
      muted: false,
      video: false,
      joinedAt: Date.now(),
      ...(remembered ? { displayName: remembered } : {}),
    });
    this.touch(channel);
    this.emit(resolved.roomUid, 'participantJoin');
    return this.persistJoin(resolved, evt);
  }

  private async persistJoin(resolved: RoomCacheEntry, evt: ConferenceAmiEvent): Promise<void> {
    if (!this.moduleRef) return;
    try {
      const meetings = this.moduleRef.get<{
        beginMeeting: (
          roomUid: number,
          vpbx: number,
          event: ConferenceAmiEvent,
        ) => Promise<{
          meeting: unknown;
          room: { record_mode?: string };
          isFirstJoin: boolean;
        }>;
      }>('ConferenceMeetingsService', { strict: false });
      if (!meetings?.beginMeeting) return;
      const result = await meetings.beginMeeting(resolved.roomUid, resolved.vpbx, evt);
      const mode = result?.room?.record_mode;
      if (!result?.isFirstJoin || (mode !== 'auto' && mode !== 'both')) return;
      const recording = this.moduleRef.get<{
        startForMeeting: (
          room: unknown,
          meeting: unknown,
          userLike: { vpbx_user_uid: number },
        ) => Promise<void>;
      }>('ConferenceRecordingService', { strict: false });
      if (!recording?.startForMeeting) return;
      await recording.startForMeeting(result.room, result.meeting, {
        vpbx_user_uid: resolved.vpbx,
      });
    } catch (e: any) {
      this.logger.error(
        `Meeting persist failed for room ${resolved.roomUid}: ${e?.message || e}`,
      );
    }
  }

  private applyLeave(
    resolved: RoomCacheEntry,
    channel: string,
    evt?: ConferenceAmiEvent,
  ): void | Promise<void> {
    const members = this.rooms.get(resolved.roomUid);
    if (!members?.has(channel)) return;
    members.delete(channel);
    this.lastSignalAt.delete(channel);
    const emptied = members.size === 0;
    if (emptied) {
      this.rooms.delete(resolved.roomUid);
      this.liveGrants.delete(resolved.roomUid);
      this.rememberedNames.delete(resolved.roomUid);
    }
    this.emit(resolved.roomUid, 'participantLeave');
    const persist = this.persistLeave(resolved, channel, evt, emptied);
    if (emptied) {
      return persist.then(() => this.invokeCollectIfEmpty(resolved.roomUid));
    }
    return persist;
  }

  private async persistLeave(
    resolved: RoomCacheEntry,
    channel: string,
    evt: ConferenceAmiEvent | undefined,
    emptied: boolean,
  ): Promise<void> {
    if (!this.moduleRef) return;
    try {
      const meetings = this.moduleRef.get<{
        markParticipantLeft?: (
          roomUid: number,
          keys: { uniqueid?: string; channel?: string; callerIdNum?: string },
        ) => Promise<void>;
        endMeeting?: (roomUid: number) => Promise<unknown>;
      }>('ConferenceMeetingsService', { strict: false });
      const uniqueid = evt ? amiString(evt, 'Uniqueid', 'uniqueid') : '';
      const callerIdNum = evt ? amiString(evt, 'CallerIDNum') : '';
      if (meetings?.markParticipantLeft) {
        await meetings.markParticipantLeft(resolved.roomUid, { uniqueid, channel, callerIdNum });
      }
      if (!emptied) return;
      if (meetings?.endMeeting) {
        await meetings.endMeeting(resolved.roomUid);
      }
      const recording = this.moduleRef.get<{
        stopForRoom?: (roomUid: number, userLike?: { vpbx_user_uid: number }) => Promise<void>;
      }>('ConferenceRecordingService', { strict: false });
      if (recording?.stopForRoom) {
        await recording.stopForRoom(resolved.roomUid, { vpbx_user_uid: resolved.vpbx });
      }
    } catch (e: any) {
      this.logger.error(
        `Meeting leave persist failed for room ${resolved.roomUid}: ${e?.message || e}`,
      );
    }
  }

  private hydrateRoom(evt: ConferenceAmiEvent): Promise<RoomCacheEntry | null> {
    const conference = amiString(evt, 'Conference').trim();
    if (!conference) return Promise.resolve(null);
    const cached = this.conferenceByName.get(conference);
    if (cached) return Promise.resolve(cached);
    const pending = this.hydrating.get(conference);
    if (pending) return pending;
    const task = this.loadRoomFromDb(conference).finally(() => {
      this.hydrating.delete(conference);
    });
    this.hydrating.set(conference, task);
    return task;
  }

  private async loadRoomFromDb(conference: string): Promise<RoomCacheEntry | null> {
    const parsed = this.parseConferenceName(conference);
    if (!parsed || !this.moduleRef) return null;
    let model: { findOne: (opts: object) => Promise<ConferenceRoom | null> };
    try {
      model = this.moduleRef.get(getModelToken(ConferenceRoom), { strict: false });
    } catch {
      return null;
    }
    if (!model?.findOne) return null;
    const room = await model.findOne({
      where: { number: parsed.number, user_uid: parsed.vpbx },
    });
    if (!room) return null;
    this.registerRoom(room);
    return (
      this.conferenceByName.get(`conf${room.number}_${room.user_uid}`) ??
      this.conferenceByName.get(conference) ??
      null
    );
  }

  handleTalking(evt: ConferenceAmiEvent): void {
    const participant = this.findParticipant(evt);
    if (!participant) return;
    const talking = amiString(evt, 'TalkingStatus').toLowerCase();
    participant.state.talking = talking === 'on' || talking === 'yes' || talking === 'true';
    this.touch(participant.state.channel);
    this.emit(participant.roomUid, 'participantTalking');
  }

  handleMute(evt: ConferenceAmiEvent): void {
    const participant = this.findParticipant(evt);
    if (!participant) return;
    participant.state.muted = true;
    this.touch(participant.state.channel);
    this.emit(participant.roomUid, 'participantMute');
  }

  handleUnmute(evt: ConferenceAmiEvent): void {
    const participant = this.findParticipant(evt);
    if (!participant) return;
    participant.state.muted = false;
    this.touch(participant.state.channel);
    this.emit(participant.roomUid, 'participantUnmute');
  }

  setVideoState(roomUid: number, participantRef: string, enabled: boolean): void {
    const participant = this.findLiveParticipant(roomUid, participantRef);
    if (!participant) return;
    if (participant.video === enabled) return;
    participant.video = enabled;
    this.emit(roomUid, 'participantVideo');
  }

  rememberDisplayName(roomUid: number, sipId: string, name: string): void {
    const ref = String(sipId ?? '').trim();
    if (!ref) return;
    let names = this.rememberedNames.get(roomUid);
    if (!names) {
      names = new Map();
      this.rememberedNames.set(roomUid, names);
    }
    names.set(ref, truncateDisplayName(String(name ?? '')));
  }

  setDisplayName(roomUid: number, participantRef: string, name: string): void {
    const participant = this.findLiveParticipant(roomUid, participantRef);
    if (!participant) return;
    participant.displayName = truncateDisplayName(String(name ?? ''));
    this.emit(roomUid, 'participantDisplayName');
  }

  private resolveJoinRole(roomUid: number, evt: ConferenceAmiEvent): ConferenceParticipantRole {
    const callerRef = amiString(evt, 'CallerIDNum').trim();
    const channel = amiString(evt, 'Channel');
    if (callerRef) {
      return this.roleFromSettings(roomUid, callerRef);
    }
    return (
      this.getGrantedRole(roomUid, channel) ??
      roleFromConfbridgeFlags({
        Admin: amiString(evt, 'Admin'),
        MarkedUser: amiString(evt, 'MarkedUser'),
      })
    );
  }

  private computeWaitingForModerator(
    roomUid: number,
    participants: ConferenceParticipantState[],
  ): boolean {
    const policy = this.conferenceByRoom.get(roomUid)?.entryPolicy;
    if (!policy?.requiresWaitMarked) return false;
    return !participants.some((item) => CONFBRIDGE_ROLE_FLAGS[item.role].marked);
  }

  private roleFromSettings(roomUid: number, callerRef: string): ConferenceParticipantRole {
    const rights = this.roomRights.get(roomUid) ?? { ownerRef: null, moderatorRefs: [] };
    return resolveRoleForCaller(callerRef, {
      ...rights,
      liveGrants: this.getLiveGrants(roomUid),
    });
  }

  private grantsFor(roomUid: number): Map<string, ConferenceRole> {
    let grants = this.liveGrants.get(roomUid);
    if (!grants) {
      grants = new Map();
      this.liveGrants.set(roomUid, grants);
    }
    return grants;
  }

  private resolveRoom(evt: ConferenceAmiEvent): RoomCacheEntry | null {
    const conference = amiString(evt, 'Conference').trim();
    if (!conference) return null;
    const cached = this.conferenceByName.get(conference);
    if (cached) return cached;

    const parsed = this.parseConferenceName(conference);
    if (!parsed) return null;
    const rebuilt = `conf${parsed.number}_${parsed.vpbx}`;
    return this.conferenceByName.get(rebuilt) ?? null;
  }

  private parseConferenceName(conference: string): { number: string; vpbx: number } | null {
    if (!conference.startsWith('conf')) return null;
    const rest = conference.slice('conf'.length);
    const split = rest.lastIndexOf('_');
    if (split <= 0) return null;
    const number = rest.slice(0, split);
    const vpbx = Number(rest.slice(split + 1));
    if (!number || !Number.isFinite(vpbx)) return null;
    return { number, vpbx };
  }

  private membersFor(roomUid: number): Map<string, ConferenceParticipantState> {
    let members = this.rooms.get(roomUid);
    if (!members) {
      members = new Map();
      this.rooms.set(roomUid, members);
    }
    return members;
  }

  private findParticipant(
    evt: ConferenceAmiEvent,
  ): { roomUid: number; state: ConferenceParticipantState } | null {
    const resolved = this.resolveRoom(evt);
    const channel = amiString(evt, 'Channel');
    if (!resolved || !channel) return null;
    const state = this.rooms.get(resolved.roomUid)?.get(channel);
    if (!state) return null;
    return { roomUid: resolved.roomUid, state };
  }

  private subjectFor(roomUid: number): Subject<ConferenceEvent> {
    let subject = this.streams.get(roomUid);
    if (!subject) {
      subject = new Subject<ConferenceEvent>();
      this.streams.set(roomUid, subject);
    }
    return subject;
  }

  private emit(roomUid: number, type: string): void {
    const event: ConferenceEvent = {
      type,
      roomUid,
      data: this.getSnapshot(roomUid),
    };
    this.subjectFor(roomUid).next(event);
  }

  private touch(channel: string): void {
    this.lastSignalAt.set(channel, Date.now());
  }

  private async invokeCollectIfEmpty(roomUid: number): Promise<void> {
    try {
      const ephemeral = this.moduleRef?.get<{ collectIfEmpty: (uid: number) => Promise<void> }>(
        'ConferenceEphemeralService',
        { strict: false },
      );
      await ephemeral?.collectIfEmpty(roomUid);
    } catch (e: any) {
      this.logger.error(
        `Ephemeral collect failed for room ${roomUid}: ${e?.message || e}`,
      );
    }
  }
}
