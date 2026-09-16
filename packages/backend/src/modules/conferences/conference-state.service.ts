import { Injectable, Logger, Optional } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Observable, Subject } from 'rxjs';

export type ConferenceParticipantRole = 'owner' | 'moderator' | 'participant';

export interface ConferenceParticipantState {
  channel: string;
  callerIdNum: string;
  role: ConferenceParticipantRole;
  talking: boolean;
  muted: boolean;
}

export interface ConferenceRoomSnapshot {
  roomUid: number;
  conference: string | null;
  participants: ConferenceParticipantState[];
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

  registerRoom(room: { uid: number; number: string; user_uid: number }): void {
    const conference = `conf${room.number}_${room.user_uid}`;
    const entry: RoomCacheEntry = {
      roomUid: room.uid,
      number: room.number,
      vpbx: room.user_uid,
      conference,
    };
    this.conferenceByName.set(conference, entry);
    this.conferenceByRoom.set(room.uid, entry);
  }

  getSnapshot(roomUid: number): ConferenceRoomSnapshot {
    const participants = [...(this.rooms.get(roomUid)?.values() ?? [])];
    return {
      roomUid,
      conference: this.conferenceByRoom.get(roomUid)?.conference ?? null,
      participants,
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
      role: this.roleFromEvent(evt),
      talking: false,
      muted: false,
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
    if (emptied) this.rooms.delete(resolved.roomUid);
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

  private roleFromEvent(evt: ConferenceAmiEvent): ConferenceParticipantRole {
    if (this.isYes(evt.Admin)) return 'moderator';
    if (this.isYes(evt.MarkedUser)) return 'owner';
    return 'participant';
  }

  private isYes(value: unknown): boolean {
    return String(value ?? '').toLowerCase() === 'yes';
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
