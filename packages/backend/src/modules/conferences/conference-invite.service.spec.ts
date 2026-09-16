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

describe('ConferenceInviteService (16.1-05 D-39 external)', () => {
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

  function setup(roomOverrides: Record<string, unknown> = {}) {
    const room = roomJson(roomOverrides);
    roomsService = {
      assertLiveRoomAccess: jest.fn().mockResolvedValue(room),
      findOne: jest.fn().mockResolvedValue(room),
      resolveCallerRef: jest.fn().mockResolvedValue('602'),
      getRoomModerators: jest.fn().mockResolvedValue([
        { endpointRef: '601', role: 'owner' },
        { endpointRef: '602', role: 'moderator' },
      ]),
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
  }

  beforeEach(() => {
    setup();
  });

  it('rejects owner-scope when caller is moderator with CONFERENCE_INVITE_EXTERNAL_FORBIDDEN', async () => {
    setup({ invite_external_scope: 'owner' });

    try {
      await service.invite(ROOM_UID, staffUser(), {
        kind: 'external',
        target: '79001234567',
      });
      throw new Error('expected CONFERENCE_INVITE_EXTERNAL_FORBIDDEN');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(HttpStatus.FORBIDDEN);
      expect((err as HttpException).getResponse()).toMatchObject({
        code: 'CONFERENCE_INVITE_EXTERNAL_FORBIDDEN',
      });
      expect(JSON.stringify((err as HttpException).getResponse())).not.toMatch(/not found|не найден/i);
    }
    expect(amiService.originate).not.toHaveBeenCalled();
  });

  it('originates Local/79001234567@from-internal42 when scope is moderator and caller is moderator', async () => {
    setup({ invite_external_scope: 'moderator' });

    const result = await service.invite(ROOM_UID, staffUser(), {
      kind: 'external',
      target: '79001234567',
    });

    expect(amiService.originate).toHaveBeenCalledTimes(1);
    expect(amiService.originate).toHaveBeenCalledWith(
      'Local/79001234567@from-internal42',
      '"Sales conf" <6007>',
      'krsk-conf-77',
      's',
      '1',
    );
    expect(result).toEqual({ accepted: true });
    expect(loggerService.logAction).toHaveBeenCalledWith(
      5,
      'conference.invite.external',
      'conference_room',
      ROOM_UID,
      VPBX,
      '79001234567',
    );
  });

  it('originates when scope is anyone and caller is a snapshot participant', async () => {
    setup({ invite_external_scope: 'anyone' });
    roomsService.resolveCallerRef.mockResolvedValue('777');
    stateService.getSnapshot.mockReturnValue({
      participants: [{ callerIdNum: '777', channel: 'PJSIP/e777_42' }],
    });

    await service.invite(ROOM_UID, staffUser(), {
      kind: 'external',
      target: '79001234567',
    });

    expect(amiService.originate).toHaveBeenCalledWith(
      'Local/79001234567@from-internal42',
      '"Sales conf" <6007>',
      'krsk-conf-77',
      's',
      '1',
    );
  });

  it('strips a dirty number to Local/7900123@from-internal{vpbx}', async () => {
    setup({ invite_external_scope: 'moderator' });

    await service.invite(ROOM_UID, staffUser(), {
      kind: 'external',
      target: '79-00 (123)',
    });

    expect(amiService.originate).toHaveBeenCalledWith(
      'Local/7900123@from-internal42',
      '"Sales conf" <6007>',
      'krsk-conf-77',
      's',
      '1',
    );
  });

  it('rejects a garbage number with 400 and does not originate', async () => {
    setup({ invite_external_scope: 'moderator' });

    try {
      await service.invite(ROOM_UID, staffUser(), { kind: 'external', target: '---' });
      throw new Error('expected empty target 400');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect((err as HttpException).message).toMatch(/Target is required/i);
    }
    expect(amiService.originate).not.toHaveBeenCalled();
  });
});
