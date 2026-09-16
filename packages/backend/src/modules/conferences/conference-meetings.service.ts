import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { CdrService } from '../reports/cdr/cdr.service';
import { ConferenceRoomsService } from './conference-rooms.service';
import { ConferenceStateService, type ConferenceAmiEvent } from './conference-state.service';
import { ConferenceMeeting } from './models/conference-meeting.model';
import {
  ConferenceMeetingParticipant,
  type ConferenceMeetingParticipantRole,
} from './models/conference-meeting-participant.model';

function amiString(evt: ConferenceAmiEvent | undefined, ...names: string[]): string {
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

@Injectable()
export class ConferenceMeetingsService {
  private readonly roomTails = new Map<number, Promise<unknown>>();

  constructor(
    @InjectModel(ConferenceMeeting) private readonly meetings: typeof ConferenceMeeting,
    @InjectModel(ConferenceMeetingParticipant)
    private readonly participants: typeof ConferenceMeetingParticipant,
    private readonly roomsService: ConferenceRoomsService,
    @Optional() private readonly stateService?: ConferenceStateService,
    @Optional() private readonly cdrService?: CdrService,
  ) {}

  async currentMeeting(roomUid: number): Promise<ConferenceMeeting | null> {
    return this.meetings.findOne({
      where: { room_uid: roomUid, ended_at: null },
    });
  }

  async getByRoom(roomUid: number, meetingUid: number): Promise<ConferenceMeeting> {
    const meeting = await this.meetings.findOne({
      where: { uid: meetingUid, room_uid: roomUid },
    });
    if (!meeting) {
      throw new NotFoundException('Conference meeting not found');
    }
    return meeting;
  }

  async beginMeeting(
    roomUid: number,
    vpbx: number,
    evt: ConferenceAmiEvent,
  ): Promise<{
    meeting: ConferenceMeeting;
    room: Awaited<ReturnType<ConferenceRoomsService['findOne']>>;
    isFirstJoin: boolean;
  }> {
    const room = await this.roomsService.findOne(roomUid, vpbx);
    return this.enqueue(roomUid, async () => {
      let meeting = await this.currentMeeting(roomUid);
      const isFirstJoin = !meeting;
      if (!meeting) {
        meeting = await this.meetings.create({
          room_uid: roomUid,
          started_at: new Date(),
          ended_at: null,
          has_recording: false,
          recording_file_rel: null,
        });
      }
      const callerIdNum = amiString(evt, 'CallerIDNum');
      const channel = amiString(evt, 'Channel');
      const uniqueid = amiString(evt, 'Uniqueid', 'uniqueid') || null;
      const live = this.stateService?.findLiveParticipant(roomUid, callerIdNum || channel);
      const role: ConferenceMeetingParticipantRole = live?.role ?? 'participant';
      await this.participants.create({
        meeting_uid: meeting.uid,
        display_name: callerIdNum || 'Participant',
        role,
        is_guest: false,
        joined_at: new Date(),
        left_at: null,
        uniqueid,
        caller_id_num: callerIdNum || null,
        channel: channel || null,
      });
      return { meeting, room, isFirstJoin };
    });
  }

  async markParticipantLeft(
    roomUid: number,
    keys: { uniqueid?: string | null; channel?: string | null; callerIdNum?: string | null },
  ): Promise<void> {
    const meeting = await this.currentMeeting(roomUid);
    if (!meeting) return;
    const rows = await this.participants.findAll({
      where: { meeting_uid: meeting.uid },
    });
    const uniqueid = keys.uniqueid?.trim() || '';
    const channel = keys.channel?.trim() || '';
    const callerIdNum = keys.callerIdNum?.trim() || '';
    for (const row of rows) {
      if (row.left_at) continue;
      const rowUnique = String(row.uniqueid ?? '').trim();
      const rowChannel = String(row.channel ?? '').trim();
      const rowCaller = String(row.caller_id_num ?? '').trim();
      if (
        (uniqueid && rowUnique === uniqueid) ||
        (channel && rowChannel === channel) ||
        (callerIdNum && rowCaller === callerIdNum)
      ) {
        await row.update({ left_at: new Date() });
      }
    }
  }

  async listParticipantUniqueids(meetingUid: number): Promise<string[]> {
    const parts = await this.participants.findAll({
      where: { meeting_uid: meetingUid },
    });
    return parts
      .map((row) => String(row.uniqueid ?? '').trim())
      .filter(Boolean);
  }

  async listByRoom(roomUid: number, vpbx: number) {
    await this.roomsService.findOne(roomUid, vpbx);
    const meetings = await this.meetings.findAll({
      where: { room_uid: roomUid },
      order: [['uid', 'DESC']],
    });
    const result = [];
    for (const meeting of meetings) {
      const parts = await this.participants.findAll({
        where: { meeting_uid: meeting.uid },
      });
      result.push({
        uid: meeting.uid,
        room_uid: meeting.room_uid,
        started_at: meeting.started_at,
        ended_at: meeting.ended_at,
        has_recording: meeting.has_recording,
        recording_file_rel: meeting.recording_file_rel,
        participants: parts.map((row) => ({
          display_name: row.display_name,
          role: row.role,
          joined_at: row.joined_at,
          left_at: row.left_at,
          caller_id_num: row.caller_id_num,
        })),
      });
    }
    return result;
  }

  async findRecordingsByUniqueids(
    vpbx: number,
    uniqueids: string[],
    viewerUserId: number,
  ): Promise<
    Array<{ uniqueid: string; meetingUid: number; roomUid: number; playPath: string }>
  > {
    const found: Array<{
      uniqueid: string;
      meetingUid: number;
      roomUid: number;
      playPath: string;
    }> = [];
    for (const raw of uniqueids) {
      const id = String(raw ?? '').trim();
      if (!id) continue;
      if (this.cdrService) {
        try {
          await this.cdrService.findByUniqueid(vpbx, id, viewerUserId);
        } catch {
          continue;
        }
      }
      const parts = await this.participants.findAll({ where: { uniqueid: id } });
      for (const part of parts) {
        const meeting = await this.meetings.findOne({ where: { uid: part.meeting_uid } });
        if (!meeting || (!meeting.has_recording && !meeting.recording_file_rel)) continue;
        try {
          await this.roomsService.findOne(meeting.room_uid, vpbx);
        } catch {
          continue;
        }
        found.push({
          uniqueid: id,
          meetingUid: meeting.uid,
          roomUid: meeting.room_uid,
          playPath: `/conferences/${meeting.room_uid}/meetings/${meeting.uid}/play`,
        });
        break;
      }
    }
    return found;
  }

  async endMeeting(roomUid: number): Promise<ConferenceMeeting | null> {
    const open = await this.currentMeeting(roomUid);
    if (open) {
      if (!open.ended_at) {
        await open.update({ ended_at: new Date() });
      }
      return open;
    }
    return this.meetings.findOne({
      where: { room_uid: roomUid },
      order: [['uid', 'DESC']],
    });
  }

  private enqueue<T>(roomUid: number, fn: () => Promise<T>): Promise<T> {
    const prev = this.roomTails.get(roomUid) ?? Promise.resolve();
    const next = prev.catch(() => undefined).then(fn);
    this.roomTails.set(roomUid, next);
    return next;
  }
}
