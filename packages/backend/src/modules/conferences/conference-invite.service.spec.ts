import { HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { ConferenceInviteService } from './conference-invite.service';

const VPBX = 42;
const ROOM_UID = 77;

function roomJson(overrides: Record<string, unknown> = {}) {
  return {
    uid: ROOM_UID,
    name: 'Sales conf',
    number: '6007',
    user_uid: VPBX,
    invite_external_scope: 'owner',
    ...overrides,
  };
}

function staffUser(overrides: Record<string, unknown> = {}) {
  return { sub: 5, vpbx_user_uid: VPBX, ...overrides };
}

describe('ConferenceInviteService (16.1-05 D-38 internal)', () => {
  let roomsService: {
    assertLiveRoomAccess: jest.Mock;
    findOne: jest.Mock;
    resolveCallerRef: jest.Mock;
    getRoomModerators: jest.Mock;
  };
  let amiService: { originate: jest.Mock };
  let loggerService: { logAction: jest.Mock };
  let endpointModel: { findOne: jest.Mock };
  let stateService: { getLiveGrants: jest.Mock; getSnapshot: jest.Mock };
  let service: ConferenceInviteService;

  beforeEach(() => {
    roomsService = {
      assertLiveRoomAccess: jest.fn().mockResolvedValue(roomJson()),
      findOne: jest.fn().mockResolvedValue(roomJson()),
      resolveCallerRef: jest.fn().mockResolvedValue('601'),
      getRoomModerators: jest.fn().mockResolvedValue([{ endpointRef: '601', role: 'owner' }]),
    };
    amiService = { originate: jest.fn().mockResolvedValue({ response: 'Success' }) };
    loggerService = { logAction: jest.fn().mockResolvedValue(undefined) };
    endpointModel = { findOne: jest.fn() };
    stateService = {
      getLiveGrants: jest.fn().mockReturnValue([]),
      getSnapshot: jest.fn().mockReturnValue({ participants: [] }),
    };
    service = new ConferenceInviteService(
      roomsService as any,
      amiService as any,
      loggerService as any,
      endpointModel as any,
      stateService as any,
    );
  });

  it('originates PJSIP/e200_42 into krsk-conf-77 exten s when primary exists', async () => {
    endpointModel.findOne.mockImplementation(async ({ where }: { where: { id: string } }) =>
      where.id === 'e200_42' ? { id: 'e200_42' } : null,
    );

    const result = await service.invite(ROOM_UID, staffUser(), {
      kind: 'internal',
      target: '200',
    });

    expect(roomsService.assertLiveRoomAccess).toHaveBeenCalledWith(ROOM_UID, staffUser());
    expect(amiService.originate).toHaveBeenCalledTimes(1);
    expect(amiService.originate).toHaveBeenCalledWith(
      'PJSIP/e200_42',
      '"Sales conf" <6007>',
      'krsk-conf-77',
      's',
      '1',
    );
    expect(result).toEqual({ accepted: true });
    expect(loggerService.logAction).toHaveBeenCalledWith(
      5,
      'conference.invite.internal',
      'conference_room',
      ROOM_UID,
      VPBX,
      '200',
    );
  });

  it('falls back to PJSIP/ew200_42 when primary is missing', async () => {
    endpointModel.findOne.mockImplementation(async ({ where }: { where: { id: string } }) =>
      where.id === 'ew200_42' ? { id: 'ew200_42' } : null,
    );

    await service.invite(ROOM_UID, staffUser(), { kind: 'internal', target: '200' });

    expect(amiService.originate).toHaveBeenCalledWith(
      'PJSIP/ew200_42',
      '"Sales conf" <6007>',
      'krsk-conf-77',
      's',
      '1',
    );
  });

  it('throws NotFoundException and does not originate when both endpoints are missing', async () => {
    endpointModel.findOne.mockResolvedValue(null);

    await expect(
      service.invite(ROOM_UID, staffUser(), { kind: 'internal', target: '200' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(amiService.originate).not.toHaveBeenCalled();
  });

  it('rejects a gst extension with 400 and does not originate', async () => {
    try {
      await service.invite(ROOM_UID, staffUser(), { kind: 'internal', target: 'gst200' });
      throw new Error('expected gst rejection');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
    }
    expect(amiService.originate).not.toHaveBeenCalled();
    expect(endpointModel.findOne).not.toHaveBeenCalled();
  });

  it('rejects a gst* sip id target with 400 and does not originate', async () => {
    try {
      await service.invite(ROOM_UID, staffUser(), {
        kind: 'internal',
        target: 'gsta1b2c3d4',
      });
      throw new Error('expected gst sipId rejection');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
    }
    expect(amiService.originate).not.toHaveBeenCalled();
  });

  it('maps AMI throw to CONFERENCE_INVITE_FAILED', async () => {
    endpointModel.findOne.mockResolvedValue({ id: 'e200_42' });
    amiService.originate.mockRejectedValue(new Error('AMI down'));

    try {
      await service.invite(ROOM_UID, staffUser(), { kind: 'internal', target: '200' });
      throw new Error('expected CONFERENCE_INVITE_FAILED');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getResponse()).toMatchObject({
        code: 'CONFERENCE_INVITE_FAILED',
      });
    }
  });
});
