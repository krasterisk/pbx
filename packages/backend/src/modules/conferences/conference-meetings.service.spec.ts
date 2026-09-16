import { NotFoundException } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { ConferenceMeetingsController } from './conference-meetings.controller';
import { ConferenceMeetingsService } from './conference-meetings.service';
import { ConferenceRecordingService } from './conference-recording.service';
import { ConferenceRoomsController } from './conference-rooms.controller';
import { ConferenceStateService } from './conference-state.service';
import { ConferencesModule } from './conferences.module';

const VPBX = 42;
const ROOM_UID = 77;
const CONFERENCE = 'conf6007_42';

function memoryMeetings() {
  const rows: Array<Record<string, unknown> & { update: jest.Mock }> = [];
  let next = 1;
  return {
    rows,
    create: jest.fn(async (data: Record<string, unknown>) => {
      const row = {
        uid: next++,
        ...data,
        update: jest.fn(async (patch: Record<string, unknown>) => Object.assign(row, patch)),
      };
      rows.push(row);
      return row;
    }),
    findOne: jest.fn(async ({ where }: { where: Record<string, unknown> }) => {
      return (
        rows.find((row) => {
          if (where.uid != null && row.uid !== where.uid) return false;
          if (where.room_uid != null && row.room_uid !== where.room_uid) return false;
          if (Object.prototype.hasOwnProperty.call(where, 'ended_at') && row.ended_at !== where.ended_at) {
            return false;
          }
          return true;
        }) ?? null
      );
    }),
    findAll: jest.fn(async ({ where }: { where?: Record<string, unknown> } = {}) => {
      const matched = rows.filter((row) => {
        if (where?.room_uid != null && row.room_uid !== where.room_uid) return false;
        return true;
      });
      return [...matched].sort((a, b) => Number(b.uid) - Number(a.uid));
    }),
  };
}

function memoryParticipants() {
  const rows: Array<Record<string, unknown> & { update: jest.Mock }> = [];
  let next = 1;
  return {
    rows,
    create: jest.fn(async (data: Record<string, unknown>) => {
      const row = {
        uid: next++,
        ...data,
        update: jest.fn(async (patch: Record<string, unknown>) => Object.assign(row, patch)),
      };
      rows.push(row);
      return row;
    }),
    findAll: jest.fn(async ({ where }: { where: Record<string, unknown> }) => {
      return rows.filter((row) => {
        if (where.meeting_uid != null && row.meeting_uid !== where.meeting_uid) return false;
        if (where.uniqueid != null && row.uniqueid !== where.uniqueid) return false;
        return true;
      });
    }),
  };
}

describe('ConferenceMeetingsService last-leave (16.2-02 D-33)', () => {
  let meetingModel: ReturnType<typeof memoryMeetings>;
  let participantModel: ReturnType<typeof memoryParticipants>;
  let rooms: { findOne: jest.Mock };
  let service: ConferenceMeetingsService;

  beforeEach(() => {
    meetingModel = memoryMeetings();
    participantModel = memoryParticipants();
    rooms = {
      findOne: jest.fn().mockResolvedValue({
        uid: ROOM_UID,
        number: '6007',
        user_uid: VPBX,
        record_mode: 'auto',
      }),
    };
    service = new ConferenceMeetingsService(
      meetingModel as never,
      participantModel as never,
      rooms as never,
    );
  });

  it('first emptied writes ended_at and left_at; second endMeeting keeps the same ended_at', async () => {
    const { meeting } = await service.beginMeeting(ROOM_UID, VPBX, {
      Conference: CONFERENCE,
      Channel: 'PJSIP/601-00000001',
      CallerIDNum: '601',
      Uniqueid: '1693731234.12',
    });
    expect(meeting.ended_at).toBeNull();

    await service.markParticipantLeft(ROOM_UID, {
      uniqueid: '1693731234.12',
      channel: 'PJSIP/601-00000001',
    });
    const firstEnd = await service.endMeeting(ROOM_UID);
    expect(firstEnd?.ended_at).toBeInstanceOf(Date);
    expect(participantModel.rows[0].left_at).toBeInstanceOf(Date);
    const endedAt = firstEnd?.ended_at;

    await service.markParticipantLeft(ROOM_UID, {
      uniqueid: '1693731234.12',
      channel: 'PJSIP/601-00000001',
    });
    const secondEnd = await service.endMeeting(ROOM_UID);
    expect(secondEnd?.ended_at).toBe(endedAt);
  });

  it('marks left_at by persisted channel or caller_id_num when Uniqueid is missing', async () => {
    await service.beginMeeting(ROOM_UID, VPBX, {
      Conference: CONFERENCE,
      Channel: 'PJSIP/601-00000001',
      CallerIDNum: '601',
    });
    expect(participantModel.rows[0].channel).toBe('PJSIP/601-00000001');
    expect(participantModel.rows[0].uniqueid).toBeNull();

    await service.markParticipantLeft(ROOM_UID, {
      uniqueid: '',
      channel: 'PJSIP/601-00000001',
    });
    expect(participantModel.rows[0].left_at).toBeInstanceOf(Date);

    await service.beginMeeting(ROOM_UID, VPBX, {
      Conference: CONFERENCE,
      Channel: 'PJSIP/602-00000002',
      CallerIDNum: '602',
    });
    participantModel.rows[1].channel = null;
    await service.markParticipantLeft(ROOM_UID, {
      uniqueid: '',
      channel: 'PJSIP/other',
      callerIdNum: '602',
    });
    expect(participantModel.rows[1].left_at).toBeInstanceOf(Date);
  });
});

describe('applyLeave last-leave stop (16.2-02 D-31/D-33)', () => {
  it('emptied room with recording true sends one StopRecord and writes ended_at once', async () => {
    const meetingModel = memoryMeetings();
    const participantModel = memoryParticipants();
    const rooms = {
      findOne: jest.fn().mockResolvedValue({
        uid: ROOM_UID,
        number: '6007',
        user_uid: VPBX,
        record_mode: 'auto',
      }),
    };
    const meetings = new ConferenceMeetingsService(
      meetingModel as never,
      participantModel as never,
      rooms as never,
    );
    const ami = { action: jest.fn().mockResolvedValue({ response: 'Success' }) };
    let recording: ConferenceRecordingService;
    const collectIfEmpty = jest.fn(async () => {
      expect(meetingModel.rows[0].ended_at).toBeInstanceOf(Date);
    });
    const resolveToken = (token: { name?: string } | string) => {
      const name = typeof token === 'function' ? token.name : String(token);
      if (name === 'ConferenceMeetingsService') return meetings;
      if (name === 'ConferenceRecordingService') return recording;
      if (name === 'ConferenceEphemeralService') return { collectIfEmpty };
      return undefined;
    };
    const moduleRef = { get: jest.fn(resolveToken) };
    const state = new ConferenceStateService(moduleRef as never);
    state.registerRoom({ uid: ROOM_UID, number: '6007', user_uid: VPBX });
    recording = new ConferenceRecordingService(
      ami as never,
      { getServerConfigRaw: jest.fn().mockResolvedValue({ records_base_path: '/tmp' }) } as never,
      state,
      rooms as never,
      meetings,
    );
    moduleRef.get.mockImplementation(resolveToken);

    await state.handleJoin({
      Conference: CONFERENCE,
      Channel: 'PJSIP/601-00000001',
      CallerIDNum: '601',
      Uniqueid: '1693731234.12',
    });
    expect(state.getSnapshot(ROOM_UID).recording).toBe(true);
    ami.action.mockClear();

    await state.handleLeave({
      Conference: CONFERENCE,
      Channel: 'PJSIP/601-00000001',
      Uniqueid: '1693731234.12',
    });
    expect(ami.action).toHaveBeenCalledTimes(1);
    expect(ami.action.mock.calls[0][0]).toEqual({
      action: 'ConfbridgeStopRecord',
      conference: CONFERENCE,
    });
    expect(meetingModel.rows[0].ended_at).toBeInstanceOf(Date);
    expect(participantModel.rows[0].left_at).toBeInstanceOf(Date);
    expect(collectIfEmpty).toHaveBeenCalledWith(ROOM_UID);
    const endedAt = meetingModel.rows[0].ended_at;

    await state.handleLeave({
      Conference: CONFERENCE,
      Channel: 'PJSIP/601-00000001',
      Uniqueid: '1693731234.12',
    });
    expect(ami.action).toHaveBeenCalledTimes(1);
    expect(meetingModel.rows[0].ended_at).toBe(endedAt);
  });
});

describe('ConferenceMeetingsService list and CDR-join (16.2-02 D-33)', () => {
  let meetingModel: ReturnType<typeof memoryMeetings>;
  let participantModel: ReturnType<typeof memoryParticipants>;
  let rooms: { findOne: jest.Mock };
  let cdr: { findByUniqueid: jest.Mock };
  let service: ConferenceMeetingsService;

  beforeEach(() => {
    meetingModel = memoryMeetings();
    participantModel = memoryParticipants();
    rooms = {
      findOne: jest.fn(async (uid: number, vpbx: number) => {
        if (uid !== ROOM_UID || vpbx !== VPBX) {
          throw new NotFoundException('Conference room not found');
        }
        return { uid: ROOM_UID, number: '6007', user_uid: VPBX };
      }),
    };
    cdr = { findByUniqueid: jest.fn().mockResolvedValue({ uniqueid: '1693731234.12' }) };
    service = new ConferenceMeetingsService(
      meetingModel as never,
      participantModel as never,
      rooms as never,
      undefined,
      cdr as never,
    );
  });

  it('persists AMI uniqueid 1693731234.12 and null when Uniqueid is missing', async () => {
    await service.beginMeeting(ROOM_UID, VPBX, {
      Conference: CONFERENCE,
      Channel: 'PJSIP/601-00000001',
      CallerIDNum: '601',
      Uniqueid: '1693731234.12',
    });
    expect(participantModel.rows[0].uniqueid).toBe('1693731234.12');
    expect(participantModel.rows[0].caller_id_num).toBe('601');
    expect(participantModel.rows[0].channel).toBe('PJSIP/601-00000001');
    await service.beginMeeting(ROOM_UID, VPBX, {
      Conference: CONFERENCE,
      Channel: 'PJSIP/602-00000002',
      CallerIDNum: '602',
    });
    expect(participantModel.rows[1].uniqueid).toBeNull();
  });

  it('lists tenant meetings without channel and with left_at after leave', async () => {
    await service.beginMeeting(ROOM_UID, VPBX, {
      Conference: CONFERENCE,
      Channel: 'PJSIP/601-00000001',
      CallerIDNum: '601',
      Uniqueid: '1693731234.12',
    });
    await service.markParticipantLeft(ROOM_UID, {
      uniqueid: '1693731234.12',
      channel: 'PJSIP/601-00000001',
    });
    await service.endMeeting(ROOM_UID);
    const listed = await service.listByRoom(ROOM_UID, VPBX);
    expect(listed).toHaveLength(1);
    expect(listed[0].participants[0].left_at).toBeInstanceOf(Date);
    expect(listed[0].participants[0]).not.toHaveProperty('channel');
    expect(JSON.stringify(listed)).not.toContain('PJSIP/');
  });

  it('throws NotFoundException when listing meetings for a foreign tenant', async () => {
    await expect(service.listByRoom(ROOM_UID, 99)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('recordings-by-uniqueid skips ids where findByUniqueid throws', async () => {
    await service.beginMeeting(ROOM_UID, VPBX, {
      Conference: CONFERENCE,
      Channel: 'PJSIP/601-00000001',
      CallerIDNum: '601',
      Uniqueid: 'visible-1',
    });
    meetingModel.rows[0].has_recording = true;
    meetingModel.rows[0].recording_file_rel = '42/conferences/77/1.wav';
    cdr.findByUniqueid.mockImplementation(async (_vpbx: number, id: string) => {
      if (id === 'hidden-9') throw new NotFoundException('CDR record not found');
      return { uniqueid: id };
    });
    const found = await service.findRecordingsByUniqueids(VPBX, ['visible-1', 'hidden-9'], 5);
    expect(found.map((row) => row.uniqueid)).toEqual(['visible-1']);
    expect(found[0]).toMatchObject({
      uniqueid: 'visible-1',
      meetingUid: 1,
      roomUid: ROOM_UID,
      playPath: '/conferences/77/meetings/1/play',
    });
    expect(cdr.findByUniqueid).toHaveBeenCalledWith(VPBX, 'visible-1', 5);
  });

  it('registers ConferenceMeetingsController before ConferenceRoomsController', () => {
    const controllers = Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, ConferencesModule) ?? [];
    expect(controllers.indexOf(ConferenceMeetingsController)).toBeGreaterThanOrEqual(0);
    expect(controllers.indexOf(ConferenceMeetingsController)).toBeLessThan(
      controllers.indexOf(ConferenceRoomsController),
    );
  });
});
