import { HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { UniqueConstraintError } from 'sequelize';
import { ConferenceGuestService } from './conference-guest.service';

const VPBX = 42;
const ROOM_UID = 77;

function guestUser() {
  return {
    isGuest: true as const,
    roomUid: ROOM_UID,
    guestTokenUid: 9,
    tokenKind: 'shared_link' as const,
    inviteName: null,
    guestVpbxUserUid: VPBX,
  };
}

function roomJson(overrides: Record<string, unknown> = {}) {
  return {
    uid: ROOM_UID,
    name: 'Sales conf',
    user_uid: VPBX,
    entry_strictness: 'token_name',
    pin: null,
    tariff_max_participants: 2,
    ...overrides,
  };
}

describe('ConferenceGuestService (16.1-01)', () => {
  let roomsService: { findOne: jest.Mock };
  let stateService: { getSnapshot: jest.Mock; getActiveRoomUids: jest.Mock };
  let endpointsService: {
    generateSipPassword: jest.Mock;
    createEphemeralGuestEndpoint: jest.Mock;
    destroyEphemeralGuestEndpoint: jest.Mock;
  };
  let tokenModel: { findByPk: jest.Mock; create: jest.Mock; findAll: jest.Mock; findOne: jest.Mock };
  let capacity: { capacityForRoom: jest.Mock };
  let service: ConferenceGuestService;
  const prevUplink = process.env.CONFERENCE_UPLINK_KBPS;

  beforeEach(() => {
    process.env.CONFERENCE_UPLINK_KBPS = '100000';
    roomsService = { findOne: jest.fn().mockResolvedValue(roomJson()) };
    stateService = {
      getSnapshot: jest.fn().mockReturnValue({ participants: [] }),
      getActiveRoomUids: jest.fn().mockReturnValue([]),
      rememberDisplayName: jest.fn(),
    };
    endpointsService = {
      generateSipPassword: jest.fn().mockReturnValue('sip-secret'),
      createEphemeralGuestEndpoint: jest.fn().mockResolvedValue(undefined),
      destroyEphemeralGuestEndpoint: jest.fn().mockResolvedValue(undefined),
    };
    tokenModel = { findByPk: jest.fn(), create: jest.fn(), findAll: jest.fn(), findOne: jest.fn() };
    capacity = { capacityForRoom: jest.fn().mockReturnValue(2) };
    service = new ConferenceGuestService(
      roomsService as any,
      stateService as any,
      endpointsService as any,
      tokenModel as any,
      capacity as any,
    );
  });

  afterEach(() => {
    if (prevUplink === undefined) delete process.env.CONFERENCE_UPLINK_KBPS;
    else process.env.CONFERENCE_UPLINK_KBPS = prevUplink;
  });

  it('admits an empty room and creates one gst ephemeral in krsk-conf-{uid}', async () => {
    const token = {
      uid: 9,
      sip_id: null,
      display_name: null,
      update: jest.fn().mockResolvedValue(undefined),
    };
    tokenModel.findByPk.mockResolvedValue(token);

    const result = await service.join(guestUser(), { displayName: 'Гость' });

    expect(endpointsService.createEphemeralGuestEndpoint).toHaveBeenCalledTimes(1);
    const args = endpointsService.createEphemeralGuestEndpoint.mock.calls[0][0];
    expect(args.context).toBe('krsk-conf-77');
    expect(args.sipId).toMatch(/^gst[0-9a-f]{8}$/);
    expect(args.password).toBe('sip-secret');
    expect(args.vpbx).toBe(VPBX);
    expect(args.maxVideoStreams).toBe(2);
    expect(token.update).toHaveBeenCalledWith(
      expect.objectContaining({ sip_id: args.sipId }),
    );
    expect(result).toEqual({
      sipId: args.sipId,
      password: 'sip-secret',
      sipDomain: process.env.SIP_DOMAIN || null,
      roomUid: ROOM_UID,
    });
    expect(result).not.toHaveProperty('conference');
    expect(JSON.stringify(result)).not.toMatch(/conf6007|normalizeTarget/);
  });

  it('writes optional displayName onto the token', async () => {
    const token = {
      uid: 9,
      sip_id: null,
      display_name: null,
      update: jest.fn().mockResolvedValue(undefined),
    };
    tokenModel.findByPk.mockResolvedValue(token);

    await service.join(guestUser(), { displayName: 'Гость' });

    expect(token.update).toHaveBeenCalledWith(
      expect.objectContaining({ display_name: 'Гость' }),
    );
  });

  it('returns 409 CONFERENCE_ROOM_FULL when n === effectiveMax and does not create', async () => {
    stateService.getSnapshot.mockReturnValue({
      participants: [{ channel: 'PJSIP/a' }, { channel: 'PJSIP/b' }],
    });
    stateService.getActiveRoomUids.mockReturnValue([ROOM_UID]);

    try {
      await service.join(guestUser(), {});
      throw new Error('expected CONFERENCE_ROOM_FULL');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(HttpStatus.CONFLICT);
      expect((err as HttpException).getResponse()).toMatchObject({
        code: 'CONFERENCE_ROOM_FULL',
        message: 'Conference room is full',
      });
    }
    expect(endpointsService.createEphemeralGuestEndpoint).not.toHaveBeenCalled();
    expect(tokenModel.findByPk).not.toHaveBeenCalled();
  });

  it('destroys the previous sip_id then creates a new triple on a second join', async () => {
    const token = {
      uid: 9,
      sip_id: 'gstaaaaaaaa',
      display_name: null,
      update: jest.fn().mockResolvedValue(undefined),
    };
    tokenModel.findByPk.mockResolvedValue(token);

    await service.join(guestUser(), { displayName: 'Гость' });

    expect(endpointsService.destroyEphemeralGuestEndpoint).toHaveBeenCalledWith(
      'gstaaaaaaaa',
      VPBX,
    );
    expect(endpointsService.createEphemeralGuestEndpoint).toHaveBeenCalledTimes(1);
    const destroyOrder = endpointsService.destroyEphemeralGuestEndpoint.mock.invocationCallOrder[0];
    const createOrder = endpointsService.createEphemeralGuestEndpoint.mock.invocationCallOrder[0];
    expect(destroyOrder).toBeLessThan(createOrder);
  });

  it('returns room meta without an Asterisk conference name', async () => {
    const meta = await service.getMeta(guestUser());
    expect(meta).toEqual({
      name: 'Sales conf',
      entry_strictness: 'token_name',
      requiresPin: false,
    });
    expect(JSON.stringify(meta)).not.toMatch(/conf6007_|krsk-conf-/);
  });

  describe('staff token CRUD (16.1-02 D-12)', () => {
    beforeEach(() => {
      tokenModel.create.mockImplementation(async (data: Record<string, unknown>) => ({
        ...data,
        uid: 11,
      }));
    });

    it('creates a shared_link with 64-hex token, null invite_name, and expires_at from ttlSec', async () => {
      const before = Date.now();
      const row = await service.createToken(ROOM_UID, VPBX, {
        kind: 'shared_link',
        ttlSec: 3600,
      });
      const after = Date.now();

      expect(roomsService.findOne).toHaveBeenCalledWith(ROOM_UID, VPBX);
      expect(row.kind).toBe('shared_link');
      expect(row.invite_name).toBeNull();
      expect(row.token).toMatch(/^[0-9a-f]{64}$/);
      expect(row.token).toHaveLength(64);
      expect(row.expires_at).toBeInstanceOf(Date);
      expect(row.expires_at.getTime()).toBeGreaterThanOrEqual(before + 3600_000 - 50);
      expect(row.expires_at.getTime()).toBeLessThanOrEqual(after + 3600_000 + 50);
      expect(tokenModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          room_uid: ROOM_UID,
          kind: 'shared_link',
          invite_name: null,
          token: row.token,
        }),
      );
    });

    it('creates a shared_link with null expires_at when ttlSec is omitted', async () => {
      const row = await service.createToken(ROOM_UID, VPBX, { kind: 'shared_link' });
      expect(row.expires_at).toBeNull();
    });

    it('rejects named_invite with an empty inviteName as 400', async () => {
      try {
        await service.createToken(ROOM_UID, VPBX, {
          kind: 'named_invite',
          inviteName: '',
        });
        throw new Error('expected 400 for empty inviteName');
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        expect((err as HttpException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
      }
      expect(tokenModel.create).not.toHaveBeenCalled();
    });

    it('creates a named_invite with invite_name Иванов', async () => {
      const row = await service.createToken(ROOM_UID, VPBX, {
        kind: 'named_invite',
        inviteName: 'Иванов',
      });
      expect(row.kind).toBe('named_invite');
      expect(row.invite_name).toBe('Иванов');
    });

    it('listTokens of another tenant room is NotFoundException', async () => {
      roomsService.findOne.mockRejectedValue(new NotFoundException());
      await expect(service.listTokens(ROOM_UID, 99)).rejects.toBeInstanceOf(NotFoundException);
      expect(tokenModel.findAll).not.toHaveBeenCalled();
    });

    it('listTokens orders by created_at ASC, uid ASC', async () => {
      tokenModel.findAll.mockResolvedValue([]);
      await service.listTokens(ROOM_UID, VPBX);
      expect(roomsService.findOne).toHaveBeenCalledWith(ROOM_UID, VPBX);
      expect(tokenModel.findAll).toHaveBeenCalledWith({
        where: { room_uid: ROOM_UID },
        order: [
          ['created_at', 'ASC'],
          ['uid', 'ASC'],
        ],
      });
    });

    it('does not swallow UniqueConstraintError when a second insert reuses a token', async () => {
      tokenModel.create.mockRejectedValueOnce(new UniqueConstraintError({}));
      await expect(
        service.createToken(ROOM_UID, VPBX, { kind: 'shared_link' }),
      ).rejects.toBeInstanceOf(UniqueConstraintError);
    });
  });

  describe('revoke and leave (16.1-02 D-12)', () => {
    let amiService: { action: jest.Mock };
    let state: {
      getSnapshot: jest.Mock;
      getActiveRoomUids: jest.Mock;
      findLiveParticipant: jest.Mock;
    };

    beforeEach(() => {
      amiService = { action: jest.fn().mockResolvedValue({}) };
      state = {
        getSnapshot: jest.fn().mockReturnValue({ participants: [] }),
        getActiveRoomUids: jest.fn().mockReturnValue([]),
        findLiveParticipant: jest.fn(),
        rememberDisplayName: jest.fn(),
        setDisplayName: jest.fn(),
      };
      roomsService.findOne.mockResolvedValue(roomJson({ number: '6007' }));
      service = new ConferenceGuestService(
        roomsService as any,
        state as any,
        endpointsService as any,
        tokenModel as any,
        capacity as any,
        { ingest: jest.fn() } as any,
        amiService as any,
      );
    });

    function tokenRow(overrides: Record<string, unknown> = {}) {
      const row: Record<string, unknown> = {
        uid: 2,
        room_uid: ROOM_UID,
        sip_id: 'gstaaaaaaaa',
        revoked_at: null,
        ...overrides,
      };
      row.update = jest.fn().mockImplementation(async (payload: Record<string, unknown>) => {
        Object.assign(row, payload);
        return row;
      });
      return row;
    }

    it('revokes a live sip_id with exactly one ConfbridgeKick and one destroy', async () => {
      const row = tokenRow();
      tokenModel.findOne.mockResolvedValue(row);
      state.findLiveParticipant.mockReturnValue({
        channel: 'PJSIP/gstaaaaaaaa-00000001',
        callerIdNum: 'gstaaaaaaaa',
      });

      await service.revoke(ROOM_UID, 2, VPBX);

      expect(amiService.action).toHaveBeenCalledTimes(1);
      expect(amiService.action).toHaveBeenCalledWith({
        action: 'ConfbridgeKick',
        conference: 'conf6007_42',
        channel: 'PJSIP/gstaaaaaaaa-00000001',
      });
      expect(endpointsService.destroyEphemeralGuestEndpoint).toHaveBeenCalledTimes(1);
      expect(endpointsService.destroyEphemeralGuestEndpoint).toHaveBeenCalledWith(
        'gstaaaaaaaa',
        VPBX,
      );
      expect(row.revoked_at).toBeInstanceOf(Date);
      expect(row.sip_id).toBeNull();
      const stampOrder = (row.update as jest.Mock).mock.invocationCallOrder[0];
      const kickOrder = amiService.action.mock.invocationCallOrder[0];
      const destroyOrder = endpointsService.destroyEphemeralGuestEndpoint.mock.invocationCallOrder[0];
      expect(stampOrder).toBeLessThan(kickOrder);
      expect(kickOrder).toBeLessThan(destroyOrder);
    });

    it('revokes without AMI when sip_id is absent', async () => {
      const row = tokenRow({ sip_id: null });
      tokenModel.findOne.mockResolvedValue(row);

      await service.revoke(ROOM_UID, 2, VPBX);

      expect(row.revoked_at).toBeInstanceOf(Date);
      expect(amiService.action).not.toHaveBeenCalled();
      expect(endpointsService.destroyEphemeralGuestEndpoint).not.toHaveBeenCalled();
    });

    it('does not stamp revoked_at on a neighboring token of the same room', async () => {
      const neighbor = tokenRow({ uid: 1, sip_id: null, kind: 'shared_link' });
      const named = tokenRow({ uid: 2, sip_id: null, kind: 'named_invite' });
      tokenModel.findOne.mockResolvedValue(named);

      await service.revoke(ROOM_UID, 2, VPBX);

      expect(named.revoked_at).toBeInstanceOf(Date);
      expect(neighbor.revoked_at).toBeNull();
      expect(neighbor.update).not.toHaveBeenCalled();
      expect(tokenModel.findOne).toHaveBeenCalledWith({
        where: { uid: 2, room_uid: ROOM_UID },
      });
    });

    it('leave clears sip_id and does not set revoked_at', async () => {
      const row = tokenRow({ uid: 9 });
      tokenModel.findByPk.mockResolvedValue(row);

      await service.leave(guestUser());

      expect(endpointsService.destroyEphemeralGuestEndpoint).toHaveBeenCalledWith(
        'gstaaaaaaaa',
        VPBX,
      );
      expect(row.sip_id).toBeNull();
      expect(row.revoked_at).toBeNull();
      expect(row.update).toHaveBeenCalledWith({ sip_id: null });
      expect(row.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ revoked_at: expect.anything() }),
      );
    });

    it('rejects empty pin when requiresPin as CONFERENCE_PIN_REQUIRED and does not create', async () => {
      roomsService.findOne.mockResolvedValue(
        roomJson({ number: '6007', entry_strictness: 'token_name_pin', pin: '1234' }),
      );
      try {
        await service.join(guestUser(), { pin: '' });
        throw new Error('expected CONFERENCE_PIN_REQUIRED');
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        expect((err as HttpException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
        expect((err as HttpException).getResponse()).toMatchObject({
          code: 'CONFERENCE_PIN_REQUIRED',
        });
      }
      expect(endpointsService.createEphemeralGuestEndpoint).not.toHaveBeenCalled();
    });

    it('rejects a wrong pin as CONFERENCE_PIN_WRONG', async () => {
      roomsService.findOne.mockResolvedValue(
        roomJson({ number: '6007', entry_strictness: 'token_name_pin', pin: '1234' }),
      );
      try {
        await service.join(guestUser(), { pin: '9999' });
        throw new Error('expected CONFERENCE_PIN_WRONG');
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        expect((err as HttpException).getResponse()).toMatchObject({
          code: 'CONFERENCE_PIN_WRONG',
        });
      }
      expect(endpointsService.createEphemeralGuestEndpoint).not.toHaveBeenCalled();
    });

    it('creates once when requiresPin and pin matches', async () => {
      const fs = require('fs') as typeof import('fs');
      const path = require('path') as typeof import('path');
      const src = fs.readFileSync(
        path.resolve(__dirname, 'conference-guest.service.ts'),
        'utf8',
      );
      expect(src).toMatch(/CONFERENCE_PIN_REQUIRED/);
      expect(src).toMatch(/CONFERENCE_PIN_WRONG/);
      expect(src.indexOf('CONFERENCE_PIN_REQUIRED')).toBeLessThan(
        src.indexOf('createEphemeralGuestEndpoint'),
      );
      roomsService.findOne.mockResolvedValue(
        roomJson({ number: '6007', entry_strictness: 'token_name_pin', pin: '1234' }),
      );
      tokenModel.findByPk.mockResolvedValue({
        uid: 9,
        sip_id: null,
        display_name: 'Гость',
        update: jest.fn().mockResolvedValue(undefined),
      });
      await service.join(guestUser(), { pin: '1234' });
      expect(endpointsService.createEphemeralGuestEndpoint).toHaveBeenCalledTimes(1);
    });

    it('ignores dto.pin when the room does not require a PIN', async () => {
      tokenModel.findByPk.mockResolvedValue({
        uid: 9,
        sip_id: null,
        display_name: 'Гость',
        update: jest.fn().mockResolvedValue(undefined),
      });
      await service.join(guestUser(), { pin: '9999' });
      expect(endpointsService.createEphemeralGuestEndpoint).toHaveBeenCalledTimes(1);
    });

    it('exposes POST :token/leave on ConferenceGuestController without JwtAuthGuard', () => {
      const fs = require('fs') as typeof import('fs');
      const path = require('path') as typeof import('path');
      const src = fs.readFileSync(
        path.resolve(__dirname, 'conference-guest.controller.ts'),
        'utf8',
      );
      expect(src).toMatch(/@Post\(':token\/leave'\)/);
      expect(src).toMatch(/@UseGuards\(ConferenceGuestTokenGuard\)/);
      expect(src).not.toMatch(/JwtAuthGuard/);
      expect(src).not.toMatch(/EndpointsService\.remove/);
    });
  });
});

describe('ConferenceGuestService.join capacityForRoom (16.1-04 D-21)', () => {
  let roomsService: { findOne: jest.Mock };
  let stateService: { getSnapshot: jest.Mock; getActiveRoomUids: jest.Mock };
  let endpointsService: {
    generateSipPassword: jest.Mock;
    createEphemeralGuestEndpoint: jest.Mock;
    destroyEphemeralGuestEndpoint: jest.Mock;
  };
  let tokenModel: { findByPk: jest.Mock };
  let capacity: { capacityForRoom: jest.Mock };
  let service: ConferenceGuestService;

  function tokenRow() {
    return {
      uid: 9,
      sip_id: null,
      display_name: null,
      update: jest.fn().mockResolvedValue(undefined),
    };
  }

  beforeEach(() => {
    roomsService = { findOne: jest.fn().mockResolvedValue(roomJson()) };
    stateService = {
      getSnapshot: jest.fn().mockReturnValue({ participants: [] }),
      getActiveRoomUids: jest.fn(),
      rememberDisplayName: jest.fn(),
    };
    endpointsService = {
      generateSipPassword: jest.fn().mockReturnValue('sip-secret'),
      createEphemeralGuestEndpoint: jest.fn().mockResolvedValue(undefined),
      destroyEphemeralGuestEndpoint: jest.fn().mockResolvedValue(undefined),
    };
    tokenModel = { findByPk: jest.fn().mockResolvedValue(tokenRow()) };
    capacity = { capacityForRoom: jest.fn().mockReturnValue(2) };
    service = new ConferenceGuestService(
      roomsService as any,
      stateService as any,
      endpointsService as any,
      tokenModel as any,
      capacity as any,
    );
  });

  it('calls capacityForRoom once before createEphemeralGuestEndpoint', async () => {
    await service.join(guestUser(), { displayName: 'Гость' });
    expect(capacity.capacityForRoom).toHaveBeenCalledTimes(1);
    expect(capacity.capacityForRoom).toHaveBeenCalledWith(expect.objectContaining({ uid: ROOM_UID }));
    expect(stateService.getActiveRoomUids).not.toHaveBeenCalled();
    const capacityOrder = capacity.capacityForRoom.mock.invocationCallOrder[0];
    const createOrder = endpointsService.createEphemeralGuestEndpoint.mock.invocationCallOrder[0];
    expect(capacityOrder).toBeLessThan(createOrder);
  });

  it('rejects a participant when n === N with CONFERENCE_ROOM_FULL and zero creates', async () => {
    capacity.capacityForRoom.mockReturnValue(2);
    stateService.getSnapshot.mockReturnValue({
      participants: [{ channel: 'PJSIP/a' }, { channel: 'PJSIP/b' }],
    });
    try {
      await service.join(guestUser(), {});
      throw new Error('expected CONFERENCE_ROOM_FULL');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(HttpStatus.CONFLICT);
      expect((err as HttpException).getResponse()).toMatchObject({
        code: 'CONFERENCE_ROOM_FULL',
        message: 'Conference room is full',
      });
    }
    expect(endpointsService.createEphemeralGuestEndpoint).not.toHaveBeenCalled();
    expect(tokenModel.findByPk).not.toHaveBeenCalled();
  });

  it('creates once for a participant when n === N - 1', async () => {
    capacity.capacityForRoom.mockReturnValue(2);
    stateService.getSnapshot.mockReturnValue({
      participants: [{ channel: 'PJSIP/a' }],
    });
    await service.join(guestUser(), { displayName: 'Гость' });
    expect(endpointsService.createEphemeralGuestEndpoint).toHaveBeenCalledTimes(1);
    expect(endpointsService.createEphemeralGuestEndpoint.mock.calls[0][0].maxVideoStreams).toBe(2);
  });

  it.each(['owner', 'moderator'] as const)(
    'lets %s join when n >= N (admin-bypass)',
    async (role) => {
      capacity.capacityForRoom.mockReturnValue(2);
      stateService.getSnapshot.mockReturnValue({
        participants: [{ channel: 'PJSIP/a' }, { channel: 'PJSIP/b' }],
      });
      await service.join({ ...guestUser(), role }, { displayName: 'Гость' });
      expect(endpointsService.createEphemeralGuestEndpoint).toHaveBeenCalledTimes(1);
    },
  );

  it('does not copy remaining/budget math inside GuestService', () => {
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const src = fs.readFileSync(path.resolve(__dirname, 'conference-guest.service.ts'), 'utf8');
    expect(src).toMatch(/capacityForRoom/);
    expect(src).not.toMatch(/maxParticipantsForBudget/);
    expect(src).not.toMatch(/streamsForParticipants/);
    expect(src).not.toMatch(/STREAM_KBPS/);
  });
});

describe('ConferenceGuestService display name (16.1-06 D-40)', () => {
  let roomsService: { findOne: jest.Mock };
  let stateService: {
    getSnapshot: jest.Mock;
    getActiveRoomUids: jest.Mock;
    rememberDisplayName: jest.Mock;
    setDisplayName: jest.Mock;
  };
  let endpointsService: {
    generateSipPassword: jest.Mock;
    createEphemeralGuestEndpoint: jest.Mock;
    destroyEphemeralGuestEndpoint: jest.Mock;
  };
  let tokenModel: { findByPk: jest.Mock };
  let capacity: { capacityForRoom: jest.Mock };
  let service: ConferenceGuestService;

  function tokenRow(overrides: Record<string, unknown> = {}) {
    return {
      uid: 9,
      sip_id: null,
      display_name: null,
      update: jest.fn().mockResolvedValue(undefined),
      ...overrides,
    };
  }

  beforeEach(() => {
    roomsService = { findOne: jest.fn().mockResolvedValue(roomJson()) };
    stateService = {
      getSnapshot: jest.fn().mockReturnValue({ participants: [] }),
      getActiveRoomUids: jest.fn().mockReturnValue([]),
      rememberDisplayName: jest.fn(),
      setDisplayName: jest.fn(),
    };
    endpointsService = {
      generateSipPassword: jest.fn().mockReturnValue('sip-secret'),
      createEphemeralGuestEndpoint: jest.fn().mockResolvedValue(undefined),
      destroyEphemeralGuestEndpoint: jest.fn().mockResolvedValue(undefined),
    };
    tokenModel = { findByPk: jest.fn().mockResolvedValue(tokenRow()) };
    capacity = { capacityForRoom: jest.fn().mockReturnValue(2) };
    service = new ConferenceGuestService(
      roomsService as any,
      stateService as any,
      endpointsService as any,
      tokenModel as any,
      capacity as any,
    );
  });

  it('rejects whitespace displayName without a saved token name as CONFERENCE_DISPLAY_NAME_REQUIRED', async () => {
    try {
      await service.join(guestUser(), { displayName: '  ' });
      throw new Error('expected CONFERENCE_DISPLAY_NAME_REQUIRED');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect((err as HttpException).getResponse()).toMatchObject({
        code: 'CONFERENCE_DISPLAY_NAME_REQUIRED',
      });
    }
    expect(endpointsService.createEphemeralGuestEndpoint).not.toHaveBeenCalled();
  });

  it('truncates a 70-grapheme join name to 64 on the token', async () => {
    const token = tokenRow();
    tokenModel.findByPk.mockResolvedValue(token);
    const longName = 'ё'.repeat(70);
    await service.join(guestUser(), { displayName: longName });
    expect(token.update).toHaveBeenCalledWith(
      expect.objectContaining({
        display_name: expect.any(String),
      }),
    );
    const written = (token.update as jest.Mock).mock.calls[0][0].display_name as string;
    expect([...written].length).toBe(64);
    expect(stateService.rememberDisplayName).toHaveBeenCalledWith(
      ROOM_UID,
      expect.stringMatching(/^gst[0-9a-f]{8}$/),
      written,
    );
  });
});
