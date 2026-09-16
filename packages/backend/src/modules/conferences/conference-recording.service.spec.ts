import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PassThrough } from 'stream';
import { ConferenceRecordingService } from './conference-recording.service';
import { ConferenceStateService } from './conference-state.service';

const VPBX = 42;
const ROOM_UID = 77;
const MEETING_UID = 15;

function room(overrides: Record<string, unknown> = {}) {
  return {
    uid: ROOM_UID,
    number: '6007',
    user_uid: VPBX,
    record_mode: 'button',
    ...overrides,
  };
}

function meeting(overrides: Record<string, unknown> = {}) {
  const row = {
    uid: MEETING_UID,
    room_uid: ROOM_UID,
    has_recording: false,
    recording_file_rel: null as string | null,
    update: jest.fn(async (patch: Record<string, unknown>) => Object.assign(row, patch)),
    ...overrides,
  };
  return row;
}

describe('ConferenceRecordingService.startForMeeting (16.2-01 D-31)', () => {
  let base: string;
  let ami: { action: jest.Mock };
  let settings: { getServerConfigRaw: jest.Mock };
  let state: ConferenceStateService;
  let rooms: { findOne: jest.Mock };
  let meetings: { currentMeeting: jest.Mock };
  let service: ConferenceRecordingService;

  beforeEach(() => {
    base = fs.mkdtempSync(path.join(os.tmpdir(), 'conf-rec-svc-'));
    ami = { action: jest.fn().mockResolvedValue({ response: 'Success' }) };
    settings = {
      getServerConfigRaw: jest.fn().mockResolvedValue({ records_base_path: base }),
    };
    state = new ConferenceStateService();
    state.registerRoom({ uid: ROOM_UID, number: '6007', user_uid: VPBX });
    rooms = { findOne: jest.fn() };
    meetings = { currentMeeting: jest.fn() };
    service = new ConferenceRecordingService(
      ami as never,
      settings as never,
      state,
      rooms as never,
      meetings as never,
    );
  });

  afterEach(() => {
    fs.rmSync(base, { recursive: true, force: true });
  });

  it('does not read record_mode and still starts AMI for a button room', async () => {
    const row = meeting();
    await service.startForMeeting(room({ record_mode: 'button' }) as never, row as never, {
      vpbx_user_uid: VPBX,
    });
    expect(ami.action).toHaveBeenCalledTimes(1);
    expect(ami.action.mock.calls[0][0]).toEqual({
      action: 'ConfbridgeStartRecord',
      conference: 'conf6007_42',
      recordFile: path.join(base, '42/conferences/77/15.wav'),
    });
    expect(Object.keys(ami.action.mock.calls[0][0])).not.toContain('RecordFile');
    expect(row.recording_file_rel).toBe('42/conferences/77/15.wav');
    expect(row.has_recording).toBe(true);
    expect(fs.existsSync(path.join(base, '42', 'conferences', '77'))).toBe(true);
    expect(state.getSnapshot(ROOM_UID).recording).toBe(true);
  });

  it('returns without a second AMI when snapshot.recording is already true', async () => {
    state.setRecording(ROOM_UID, true);
    await service.startForMeeting(room() as never, meeting() as never, { vpbx_user_uid: VPBX });
    expect(ami.action).not.toHaveBeenCalled();
  });

  it('treats an already-recording AMI error as success and sets the flag', async () => {
    ami.action.mockRejectedValue(new Error('Conference already recording'));
    const row = meeting();
    await service.startForMeeting(room() as never, row as never, { vpbx_user_uid: VPBX });
    expect(state.getSnapshot(ROOM_UID).recording).toBe(true);
    expect(row.has_recording).toBe(true);
    expect(row.recording_file_rel).toBe('42/conferences/77/15.wav');
  });

  it('leaves has_recording false when StartRecord fails', async () => {
    ami.action.mockRejectedValue(new Error('AMI timeout'));
    const row = meeting();
    await expect(
      service.startForMeeting(room() as never, row as never, { vpbx_user_uid: VPBX }),
    ).rejects.toThrow('AMI timeout');
    expect(row.has_recording).toBe(false);
    expect(row.recording_file_rel).toBeNull();
    expect(state.getSnapshot(ROOM_UID).recording).toBe(false);
  });
});

describe('ConferenceRecordingService.streamMeeting (16.2-01 D-30)', () => {
  let base: string;
  let service: ConferenceRecordingService;
  let cdr: { findByUniqueid: jest.Mock };
  let meetings: { getByRoom: jest.Mock; listParticipantUniqueids: jest.Mock };

  beforeEach(() => {
    base = fs.mkdtempSync(path.join(os.tmpdir(), 'conf-rec-play-'));
    const dest = path.join(base, '42', 'conferences', '77');
    fs.mkdirSync(dest, { recursive: true });
    fs.writeFileSync(path.join(dest, '15.wav'), Buffer.alloc(32, 7));
    const rooms = {
      findOne: jest.fn().mockResolvedValue(room()),
    };
    meetings = {
      getByRoom: jest.fn().mockResolvedValue({
        uid: MEETING_UID,
        room_uid: ROOM_UID,
        recording_file_rel: '42/conferences/77/15.wav',
      }),
      listParticipantUniqueids: jest.fn().mockResolvedValue(['1693731234.12']),
    };
    cdr = {
      findByUniqueid: jest.fn().mockResolvedValue({ uniqueid: '1693731234.12' }),
    };
    const state = new ConferenceStateService();
    service = new ConferenceRecordingService(
      { action: jest.fn() } as never,
      { getServerConfigRaw: jest.fn().mockResolvedValue({ records_base_path: base }) } as never,
      state,
      rooms as never,
      meetings as never,
      undefined,
      undefined,
      cdr as never,
    );
  });

  afterEach(() => {
    fs.rmSync(base, { recursive: true, force: true });
  });

  it('does not stream the file when findByUniqueid throws for a participant uniqueid', async () => {
    cdr.findByUniqueid.mockRejectedValue(new NotFoundException('CDR record not found'));
    const res = Object.assign(new PassThrough(), {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      headersSent: false,
      end: jest.fn(),
    });
    await expect(
      service.streamMeeting(ROOM_UID, MEETING_UID, VPBX, { headers: {}, query: {} } as never, res as never, 5),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(res.status).not.toHaveBeenCalled();
    expect(cdr.findByUniqueid).toHaveBeenCalledWith(VPBX, '1693731234.12', 5);
  });

  it('fails closed when the meeting has no stored participant uniqueids', async () => {
    meetings.listParticipantUniqueids.mockResolvedValue([]);
    const res = Object.assign(new PassThrough(), {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      headersSent: false,
      end: jest.fn(),
    });
    await expect(
      service.streamMeeting(ROOM_UID, MEETING_UID, VPBX, { headers: {}, query: {} } as never, res as never, 5),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(res.status).not.toHaveBeenCalled();
    expect(cdr.findByUniqueid).not.toHaveBeenCalled();
  });

  it('fails closed when viewer or CDR scope is missing', async () => {
    const rooms = { findOne: jest.fn().mockResolvedValue(room()) };
    const open = new ConferenceRecordingService(
      { action: jest.fn() } as never,
      { getServerConfigRaw: jest.fn().mockResolvedValue({ records_base_path: base }) } as never,
      new ConferenceStateService(),
      rooms as never,
      meetings as never,
    );
    const res = Object.assign(new PassThrough(), {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      headersSent: false,
      end: jest.fn(),
    });
    await expect(
      open.streamMeeting(ROOM_UID, MEETING_UID, VPBX, { headers: {}, query: {} } as never, res as never, 5),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.streamMeeting(ROOM_UID, MEETING_UID, VPBX, { headers: {}, query: {} } as never, res as never),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('Range bytes=0-1 returns 206 with Content-Type audio/wav', async () => {
    const headers: Record<string, string | number> = {};
    const res = Object.assign(new PassThrough(), {
      setHeader: jest.fn((k: string, v: string | number) => {
        headers[k] = v;
      }),
      status: jest.fn().mockReturnThis(),
      headersSent: false,
      end: jest.fn(),
    });
    const req = { headers: { range: 'bytes=0-1' }, query: {} };

    await service.streamMeeting(ROOM_UID, MEETING_UID, VPBX, req as never, res as never, 5);

    expect(res.status).toHaveBeenCalledWith(206);
    expect(headers['Content-Type']).toBe('audio/wav');
    expect(headers['Accept-Ranges']).toBe('bytes');
    expect(cdr.findByUniqueid).toHaveBeenCalledWith(VPBX, '1693731234.12', 5);
  });
});

describe('ConferenceRecordingService start/stop by moderator (16.2-02 D-31)', () => {
  let base: string;
  let ami: { action: jest.Mock };
  let settings: { getServerConfigRaw: jest.Mock };
  let state: ConferenceStateService;
  let rooms: { findOne: jest.Mock };
  let meetings: {
    currentMeeting: jest.Mock;
    beginMeeting: jest.Mock;
    markParticipantLeft: jest.Mock;
    endMeeting: jest.Mock;
  };
  let logger: { logAction: jest.Mock };
  let moderation: { assertCanModerate: jest.Mock };
  let service: ConferenceRecordingService;
  const user = { sub: 5, vpbx_user_uid: VPBX };

  beforeEach(() => {
    base = fs.mkdtempSync(path.join(os.tmpdir(), 'conf-rec-mod-'));
    ami = { action: jest.fn().mockResolvedValue({ response: 'Success' }) };
    settings = {
      getServerConfigRaw: jest.fn().mockResolvedValue({ records_base_path: base }),
    };
    state = new ConferenceStateService();
    state.registerRoom({ uid: ROOM_UID, number: '6007', user_uid: VPBX });
    rooms = { findOne: jest.fn().mockResolvedValue(room({ record_mode: 'button' })) };
    meetings = {
      currentMeeting: jest.fn().mockResolvedValue(meeting()),
      beginMeeting: jest.fn(),
      markParticipantLeft: jest.fn(),
      endMeeting: jest.fn(),
    };
    logger = { logAction: jest.fn().mockResolvedValue(undefined) };
    moderation = { assertCanModerate: jest.fn().mockResolvedValue(undefined) };
    service = new ConferenceRecordingService(
      ami as never,
      settings as never,
      state,
      rooms as never,
      meetings as never,
      logger as never,
      moderation as never,
    );
  });

  afterEach(() => {
    fs.rmSync(base, { recursive: true, force: true });
  });

  it('record_mode button + startByModerator sends exactly one ConfbridgeStartRecord', async () => {
    await service.startByModerator(ROOM_UID, user);
    expect(ami.action).toHaveBeenCalledTimes(1);
    expect(ami.action.mock.calls[0][0]).toEqual({
      action: 'ConfbridgeStartRecord',
      conference: 'conf6007_42',
      recordFile: path.join(base, '42/conferences/77/15.wav'),
    });
    expect(state.getSnapshot(ROOM_UID).recording).toBe(true);
    expect(logger.logAction).toHaveBeenCalledWith(
      5,
      'conference_record_start',
      'conference_room',
      ROOM_UID,
      VPBX,
      '',
    );
  });

  it('forbids start when record_mode is off or auto', async () => {
    rooms.findOne.mockResolvedValue(room({ record_mode: 'off' }));
    await expect(service.startByModerator(ROOM_UID, user)).rejects.toBeInstanceOf(ForbiddenException);
    rooms.findOne.mockResolvedValue(room({ record_mode: 'auto' }));
    await expect(service.startByModerator(ROOM_UID, user)).rejects.toBeInstanceOf(ForbiddenException);
    expect(ami.action).not.toHaveBeenCalled();
  });

  it('forbids start when assertCanModerate rejects with Moderator role required', async () => {
    moderation.assertCanModerate.mockRejectedValue(new ForbiddenException('Moderator role required'));
    await expect(service.startByModerator(ROOM_UID, user)).rejects.toMatchObject({
      message: 'Moderator role required',
    });
    expect(ami.action).not.toHaveBeenCalled();
  });

  it('returns without a new AMI when snapshot.recording is already true', async () => {
    state.setRecording(ROOM_UID, true);
    await service.startByModerator(ROOM_UID, user);
    expect(ami.action).not.toHaveBeenCalled();
  });

  it('ignores a client path body and still uses the server-built recordFile', async () => {
    await service.startByModerator(ROOM_UID, user, { path: '/tmp/evil.wav', recordFile: '/tmp/evil.wav' });
    expect(ami.action.mock.calls[0][0].recordFile).toBe(path.join(base, '42/conferences/77/15.wav'));
    expect(JSON.stringify(ami.action.mock.calls[0][0])).not.toContain('evil');
  });

  it('stopByModerator sends ConfbridgeStopRecord without a path and audits', async () => {
    state.setRecording(ROOM_UID, true);
    await service.stopByModerator(ROOM_UID, user);
    expect(ami.action).toHaveBeenCalledTimes(1);
    expect(ami.action.mock.calls[0][0]).toEqual({
      action: 'ConfbridgeStopRecord',
      conference: 'conf6007_42',
    });
    expect(Object.keys(ami.action.mock.calls[0][0])).not.toContain('recordFile');
    expect(Object.keys(ami.action.mock.calls[0][0])).not.toContain('RecordFile');
    expect(state.getSnapshot(ROOM_UID).recording).toBe(false);
    expect(logger.logAction).toHaveBeenCalledWith(
      5,
      'conference_record_stop',
      'conference_room',
      ROOM_UID,
      VPBX,
      '',
    );
  });

  it('repeated stop when already false succeeds without a second AMI', async () => {
    await service.stopByModerator(ROOM_UID, user);
    await service.stopByModerator(ROOM_UID, user);
    expect(ami.action).not.toHaveBeenCalled();
  });

  it('rejects start with 409 when the room is live but has no open meeting or members', async () => {
    meetings.currentMeeting.mockResolvedValue(null);
    await expect(service.startByModerator(ROOM_UID, user)).rejects.toBeInstanceOf(ConflictException);
    expect(meetings.beginMeeting).not.toHaveBeenCalled();
    expect(ami.action).not.toHaveBeenCalled();
  });

  it('snapshots live members instead of beginMeeting with an empty AMI event', async () => {
    meetings.currentMeeting.mockResolvedValue(null);
    meetings.beginMeeting.mockResolvedValue({ meeting: meeting() });
    state.handleJoin({
      Conference: 'conf6007_42',
      Channel: 'PJSIP/601-00000001',
      CallerIDNum: '601',
      Uniqueid: '1693731234.12',
    });
    await service.startByModerator(ROOM_UID, user);
    expect(meetings.beginMeeting).toHaveBeenCalledWith(ROOM_UID, VPBX, {
      Channel: 'PJSIP/601-00000001',
      CallerIDNum: '601',
    });
    expect(meetings.beginMeeting.mock.calls[0][2]).not.toEqual({});
  });
});
