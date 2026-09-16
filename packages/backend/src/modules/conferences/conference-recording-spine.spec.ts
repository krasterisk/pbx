import 'reflect-metadata';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PassThrough } from 'stream';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { ConferenceMeetingsService } from './conference-meetings.service';
import { ConferenceRecordingController } from './conference-recording.controller';
import { ConferenceRecordingService } from './conference-recording.service';
import { ConferenceStateService } from './conference-state.service';
import { ConferencesModule } from './conferences.module';

const VPBX = 42;
const ROOM_UID = 77;
const ROOM_NUMBER = '6007';
const CONFERENCE = 'conf6007_42';

function roomRow(overrides: Record<string, unknown> = {}) {
  const data = {
    uid: ROOM_UID,
    number: ROOM_NUMBER,
    name: 'Sales conf',
    user_uid: VPBX,
    record_mode: 'auto',
    ...overrides,
  };
  return { ...data, toJSON: () => ({ ...data }) };
}

function joinEvt(channel: string, caller = '601') {
  return {
    Conference: CONFERENCE,
    Channel: channel,
    CallerIDNum: caller,
  };
}

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
  const rows: Array<Record<string, unknown>> = [];
  let next = 1;
  return {
    rows,
    create: jest.fn(async (data: Record<string, unknown>) => {
      const row = { uid: next++, ...data };
      rows.push(row);
      return row;
    }),
  };
}

describe('conference recording spine (16.2-01)', () => {
  let base: string;
  let ami: { action: jest.Mock };
  let meetingModel: ReturnType<typeof memoryMeetings>;
  let participantModel: ReturnType<typeof memoryParticipants>;
  let rooms: { findOne: jest.Mock };
  let state: ConferenceStateService;
  let meetings: ConferenceMeetingsService;
  let recording: ConferenceRecordingService;
  let controller: ConferenceRecordingController;

  function wire(recordMode: string) {
    rooms = {
      findOne: jest.fn(async (uid: number, vpbx: number) => {
        if (uid !== ROOM_UID || vpbx !== VPBX) throw new Error('not found');
        return roomRow({ record_mode: recordMode });
      }),
    };
    meetingModel = memoryMeetings();
    participantModel = memoryParticipants();
    meetings = new ConferenceMeetingsService(
      meetingModel as never,
      participantModel as never,
      rooms as never,
    );
    const resolveToken = (token: { name?: string } | string) => {
      const name = typeof token === 'function' ? token.name : String(token);
      if (name === 'ConferenceMeetingsService') return meetings;
      if (name === 'ConferenceRecordingService') return recording;
      return undefined;
    };
    const moduleRef = { get: jest.fn(resolveToken) };
    state = new ConferenceStateService(moduleRef as never);
    state.registerRoom({ uid: ROOM_UID, number: ROOM_NUMBER, user_uid: VPBX });
    recording = new ConferenceRecordingService(
      ami as never,
      { getServerConfigRaw: jest.fn().mockResolvedValue({ records_base_path: base }) } as never,
      state,
      rooms as never,
      meetings,
    );
    moduleRef.get.mockImplementation(resolveToken);
    controller = new ConferenceRecordingController(rooms as never, recording);
  }

  beforeEach(() => {
    base = fs.mkdtempSync(path.join(os.tmpdir(), 'conf-rec-spine-'));
    ami = { action: jest.fn().mockResolvedValue({ response: 'Success' }) };
  });

  afterEach(() => {
    fs.rmSync(base, { recursive: true, force: true });
  });

  it('registers ConferenceRecordingController and both new services on ConferencesModule', () => {
    const controllers = Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, ConferencesModule) ?? [];
    const providers = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, ConferencesModule) ?? [];
    expect(controllers).toContain(ConferenceRecordingController);
    expect(providers).toContain(ConferenceMeetingsService);
    expect(providers).toContain(ConferenceRecordingService);
  });

  it('first auto join creates one meeting and one ConfbridgeStartRecord with recordFile', async () => {
    wire('auto');
    await state.handleJoin(joinEvt('PJSIP/601-00000001', '601'));
    expect(meetingModel.rows).toHaveLength(1);
    expect(ami.action).toHaveBeenCalledTimes(1);
    expect(ami.action.mock.calls[0][0]).toMatchObject({
      action: 'ConfbridgeStartRecord',
      conference: CONFERENCE,
      recordFile: path.join(base, `42/conferences/77/${meetingModel.rows[0].uid}.wav`),
    });
    expect(state.getSnapshot(ROOM_UID).recording).toBe(true);
    expect(meetingModel.rows[0].recording_file_rel).toBe(
      `42/conferences/77/${meetingModel.rows[0].uid}.wav`,
    );
  });

  it('second join into the same live meeting does not start a second record (D-31)', async () => {
    wire('auto');
    await state.handleJoin(joinEvt('PJSIP/601-00000001', '601'));
    await state.handleJoin(joinEvt('PJSIP/602-00000002', '602'));
    expect(meetingModel.rows).toHaveLength(1);
    expect(ami.action).toHaveBeenCalledTimes(1);
  });

  it('record_mode off creates a meeting and never calls StartRecord', async () => {
    wire('off');
    await state.handleJoin(joinEvt('PJSIP/601-00000001', '601'));
    expect(meetingModel.rows).toHaveLength(1);
    expect(ami.action).not.toHaveBeenCalled();
    expect(state.getSnapshot(ROOM_UID).recording).toBe(false);
  });

  it('record_mode button on first join creates a meeting and does not auto-start', async () => {
    wire('button');
    await state.handleJoin(joinEvt('PJSIP/601-00000001', '601'));
    expect(meetingModel.rows).toHaveLength(1);
    expect(ami.action).not.toHaveBeenCalled();
  });

  it('direct startForMeeting on a button room still mkdir + StartRecord (D-31 policy split)', async () => {
    wire('button');
    await state.handleJoin(joinEvt('PJSIP/601-00000001', '601'));
    expect(ami.action).not.toHaveBeenCalled();
    const started = meetingModel.rows[0];
    await recording.startForMeeting(roomRow({ record_mode: 'button' }) as never, started as never, {
      vpbx_user_uid: VPBX,
    });
    expect(ami.action).toHaveBeenCalledTimes(1);
    expect(ami.action.mock.calls[0][0].action).toBe('ConfbridgeStartRecord');
  });

  it('GET play Range bytes=0-1 returns 206 audio/wav for the stored rel', async () => {
    wire('auto');
    await state.handleJoin(joinEvt('PJSIP/601-00000001', '601'));
    const rel = String(meetingModel.rows[0].recording_file_rel);
    const abs = path.join(base, ...rel.split('/'));
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, Buffer.alloc(32, 7));

    const headers: Record<string, string | number> = {};
    const res = Object.assign(new PassThrough(), {
      setHeader: jest.fn((k: string, v: string | number) => {
        headers[k] = v;
      }),
      status: jest.fn().mockReturnThis(),
      headersSent: false,
      end: jest.fn(),
    });
    const req = { user: { vpbx_user_uid: VPBX, sub: 7 }, headers: { range: 'bytes=0-1' }, query: {} };
    await controller.play(ROOM_UID, Number(meetingModel.rows[0].uid), req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(206);
    expect(headers['Content-Type']).toBe('audio/wav');
  });
});
