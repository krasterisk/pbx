import { ConferenceMeetingsService } from './conference-meetings.service';
import { ConferenceRecordingService } from './conference-recording.service';
import { ConferenceStateService } from './conference-state.service';

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
    const resolveToken = (token: { name?: string } | string) => {
      const name = typeof token === 'function' ? token.name : String(token);
      if (name === 'ConferenceMeetingsService') return meetings;
      if (name === 'ConferenceRecordingService') return recording;
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
