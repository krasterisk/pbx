import { GUARDS_METADATA, PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ConferenceRecordingController } from './conference-recording.controller';

describe('ConferenceRecordingController (16.2-01)', () => {
  const req = { user: { vpbx_user_uid: 42, sub: 7 }, query: { tenant: '999' } };
  let rooms: { findOne: jest.Mock };
  let recording: { streamMeeting: jest.Mock };
  let controller: ConferenceRecordingController;

  beforeEach(() => {
    rooms = { findOne: jest.fn().mockResolvedValue({ uid: 77, user_uid: 42 }) };
    recording = { streamMeeting: jest.fn().mockResolvedValue(undefined) };
    controller = new ConferenceRecordingController(rooms as never, recording as never);
  });

  it('is guarded by JwtAuthGuard and mounted at conferences', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, ConferenceRecordingController) ?? [];
    expect(guards).toContain(JwtAuthGuard);
    expect(Reflect.getMetadata(PATH_METADATA, ConferenceRecordingController)).toBe('conferences');
  });

  it('GET :uid/meetings/:meetingUid/play uses JWT tenant only and streams via @Res()', async () => {
    const play = ConferenceRecordingController.prototype.play;
    expect(Reflect.getMetadata(PATH_METADATA, play)).toBe(':uid/meetings/:meetingUid/play');
    expect(Reflect.getMetadata(METHOD_METADATA, play)).toBe(RequestMethod.GET);

    const res = { setHeader: jest.fn() };
    await controller.play(77, 15, req as never, res as never);
    expect(rooms.findOne).toHaveBeenCalledWith(77, 42);
    expect(rooms.findOne).not.toHaveBeenCalledWith(77, 999);
    expect(recording.streamMeeting).toHaveBeenCalledWith(77, 15, 42, req, res, 7);
  });
});
