import { Injectable, Logger, Optional } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Observable, Subject } from 'rxjs';
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

export type ConferenceParticipantRole = ConferenceRole;

export interface ConferenceParticipantState {
  channel: string;
  callerIdNum: string;
  role: ConferenceParticipantRole;
  talking: boolean;
  muted: boolean;
  joinedAt: number;
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
  private readonly lastSignalAt = new Map<string, number>();
  private readonly conferenceByName = new Map<string, RoomCacheEntry>();
  private readonly conferenceByRoom = new Map<number, RoomCacheEntry>();
  private readonly roomRights = new Map<number, ConferenceRoomRights>();
  private readonly liveGrants = new Map<number, Map<string, ConferenceRole>>();

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
    };
  }

  getEventStream(roomUid: number): Observable<ConferenceEvent> {
    return this.subjectFor(roomUid).asObservable();
  }

  getActiveRoomUids(): number[] {
    return [...this.rooms.entries()]
      .filter(([, members]) => members.size > 0)
      .map(([roomUid]) => roomUid);
  }

  handleJoin(evt: ConferenceAmiEvent): void {
    const resolved = this.resolveRoom(evt);
    const channel = String(evt.Channel ?? '');
    if (!resolved || !channel) return;

    const members = this.membersFor(resolved.roomUid);
    members.set(channel, {
      channel,
      callerIdNum: String(evt.CallerIDNum ?? ''),
      role: this.resolveJoinRole(resolved.roomUid, evt),
      talking: false,
      muted: false,
      joinedAt: Date.now(),
    });
    this.touch(channel);
    this.emit(resolved.roomUid, 'participantJoin');
  }

  handleLeave(evt: ConferenceAmiEvent): void {
    const resolved = this.resolveRoom(evt);
    const channel = String(evt.Channel ?? '');
    if (!resolved || !channel) return;

    const members = this.rooms.get(resolved.roomUid);
    if (!members?.has(channel)) return;
    members.delete(channel);
    this.lastSignalAt.delete(channel);
    const emptied = members.size === 0;
    if (emptied) {
      this.rooms.delete(resolved.roomUid);
      this.liveGrants.delete(resolved.roomUid);
    }
    this.emit(resolved.roomUid, 'participantLeave');
    if (emptied) this.scheduleCollectIfEmpty(resolved.roomUid);
  }

  handleTalking(evt: ConferenceAmiEvent): void {
    const participant = this.findParticipant(evt);
    if (!participant) return;
    const talking = String(evt.TalkingStatus ?? '').toLowerCase();
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

  private resolveJoinRole(roomUid: number, evt: ConferenceAmiEvent): ConferenceParticipantRole {
    const callerRef = String(evt.CallerIDNum ?? '').trim();
    const channel = String(evt.Channel ?? '');
    if (callerRef) {
      return this.roleFromSettings(roomUid, callerRef);
    }
    return this.getGrantedRole(roomUid, channel) ?? roleFromConfbridgeFlags(evt);
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
    const conference = String(evt.Conference ?? '').trim();
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
    const channel = String(evt.Channel ?? '');
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

  private scheduleCollectIfEmpty(roomUid: number): void {
    void this.invokeCollectIfEmpty(roomUid);
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
