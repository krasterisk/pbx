import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
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
      const live = this.stateService?.findLiveParticipant(roomUid, callerIdNum || channel);
      const role: ConferenceMeetingParticipantRole = live?.role ?? 'participant';
      await this.participants.create({
        meeting_uid: meeting.uid,
        display_name: callerIdNum || 'Participant',
        role,
        is_guest: false,
        joined_at: new Date(),
        left_at: null,
      });
      return { meeting, room, isFirstJoin };
    });
  }

  private enqueue<T>(roomUid: number, fn: () => Promise<T>): Promise<T> {
    const prev = this.roomTails.get(roomUid) ?? Promise.resolve();
    const next = prev.catch(() => undefined).then(fn);
    this.roomTails.set(roomUid, next);
    return next;
  }
}
