import * as fs from 'fs';
import * as path from 'path';
import { HttpException, HttpStatus } from '@nestjs/common';
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

describe('conference guest spine (16.1-01)', () => {
  let roomsService: { findOne: jest.Mock };
  let stateService: { getSnapshot: jest.Mock; getActiveRoomUids: jest.Mock };
  let endpointsService: {
    generateSipPassword: jest.Mock;
    createEphemeralGuestEndpoint: jest.Mock;
    destroyEphemeralGuestEndpoint: jest.Mock;
  };
  let tokenModel: { findByPk: jest.Mock };
  let service: ConferenceGuestService;
  const prevUplink = process.env.CONFERENCE_UPLINK_KBPS;

  beforeEach(() => {
    process.env.CONFERENCE_UPLINK_KBPS = '100000';
    roomsService = {
      findOne: jest.fn().mockResolvedValue({
        uid: ROOM_UID,
        name: 'Sales conf',
        user_uid: VPBX,
        entry_strictness: 'token_name',
        tariff_max_participants: 2,
      }),
    };
    stateService = {
      getSnapshot: jest.fn(),
      getActiveRoomUids: jest.fn().mockReturnValue([ROOM_UID]),
    };
    endpointsService = {
      generateSipPassword: jest.fn().mockReturnValue('sip-secret'),
      createEphemeralGuestEndpoint: jest.fn().mockResolvedValue(undefined),
      destroyEphemeralGuestEndpoint: jest.fn().mockResolvedValue(undefined),
    };
    tokenModel = { findByPk: jest.fn() };
    service = new ConferenceGuestService(
      roomsService as any,
      stateService as any,
      endpointsService as any,
      tokenModel as any,
      { capacityForRoom: jest.fn().mockReturnValue(2) } as any,
    );
  });

  afterEach(() => {
    if (prevUplink === undefined) delete process.env.CONFERENCE_UPLINK_KBPS;
    else process.env.CONFERENCE_UPLINK_KBPS = prevUplink;
  });

  it('empty room: one createEphemeralGuestEndpoint with context krsk-conf-77', async () => {
    stateService.getSnapshot.mockReturnValue({ participants: [] });
    tokenModel.findByPk.mockResolvedValue({
      uid: 9,
      sip_id: null,
      update: jest.fn().mockResolvedValue(undefined),
    });

    await service.join(guestUser(), {});

    expect(endpointsService.createEphemeralGuestEndpoint).toHaveBeenCalledTimes(1);
    const args = endpointsService.createEphemeralGuestEndpoint.mock.calls[0][0];
    expect(args.context).toBe('krsk-conf-77');
    expect(args.sipId).toMatch(/^gst[0-9a-f]{8}$/);
  });

  it('full room: 409 CONFERENCE_ROOM_FULL and zero create calls', async () => {
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
      });
    }
    expect(endpointsService.createEphemeralGuestEndpoint).not.toHaveBeenCalled();
  });

  it('registers ConferenceGuestController first and imports EndpointsModule', () => {
    const src = fs.readFileSync(path.resolve(__dirname, './conferences.module.ts'), 'utf8');
    expect(src).toMatch(/import \{ EndpointsModule \}/);
    expect(src).toMatch(/EndpointsModule/);
    const controllers = src.match(/controllers:\s*\[([^\]]+)\]/);
    expect(controllers).toBeTruthy();
    const names = controllers![1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    expect(names).toEqual(
      expect.arrayContaining(['ConferenceGuestWebrtcController', 'ConferenceGuestController']),
    );
    expect(names.indexOf('ConferenceGuestController')).toBeLessThan(
      names.indexOf('ConferenceRoomsController'),
    );
    expect(src).toMatch(/ConferenceGuestService/);
    expect(src).toMatch(/ConferenceGuestTokenGuard/);
  });

  it('keeps guest routes off ConferenceRoomsController and off class-level JwtAuthGuard', () => {
    const guest = fs.readFileSync(
      path.resolve(__dirname, './conference-guest.controller.ts'),
      'utf8',
    );
    const rooms = fs.readFileSync(
      path.resolve(__dirname, './conference-rooms.controller.ts'),
      'utf8',
    );
    expect(guest).toMatch(/@Controller\('conferences\/guest'\)/);
    expect(guest).not.toMatch(/JwtAuthGuard/);
    expect(guest).toMatch(/@UseGuards\(ConferenceGuestTokenGuard\)/);
    expect(rooms).not.toMatch(/conferences\/guest/);
    expect(rooms).not.toMatch(/ConferenceGuestTokenGuard/);
  });

  it('guest events first snapshot uses toConferenceRoomStateDto and omits conference', async () => {
    const { ConferenceGuestController } = require('./conference-guest.controller');
    const { EMPTY, firstValueFrom } = require('rxjs');
    const state = {
      getSnapshot: jest.fn().mockReturnValue({
        roomUid: ROOM_UID,
        participants: [],
        waitingForModerator: false,
        conference: 'conf6007_42',
      }),
      getEventStream: jest.fn().mockReturnValue(EMPTY),
      streamObserverCount: jest.fn().mockReturnValue(0),
    };
    const controller = new ConferenceGuestController({} as any, state as any);
    const req = {
      user: guestUser(),
      on: jest.fn(),
      off: jest.fn(),
    };
    const first = await firstValueFrom(controller.events(req));
    expect(first.type).toBe('fullSnapshot');
    const data = JSON.parse(first.data as string);
    expect(Object.keys(data).sort()).toEqual(['participants', 'waitingForModerator']);
    expect(data).not.toHaveProperty('conference');
    expect(JSON.stringify(data)).not.toMatch(/conf6007_42/);
  });

  it('ConferenceGuestJoinDto pin matches CONFERENCE_PIN_PATTERN', async () => {
    const { plainToInstance } = require('class-transformer');
    const { validate } = require('class-validator');
    const { ConferenceGuestJoinDto } = require('./dto/conference-guest-join.dto');
    const { CONFERENCE_PIN_PATTERN } = require('./dto/create-conference-room.dto');
    const src = fs.readFileSync(
      path.resolve(__dirname, './dto/conference-guest-join.dto.ts'),
      'utf8',
    );
    expect(src).toMatch(/CONFERENCE_PIN_PATTERN/);
    expect(String(CONFERENCE_PIN_PATTERN)).toBe(String(/^\d{4,32}$/));
    const bad = plainToInstance(ConferenceGuestJoinDto, { pin: '12' });
    expect((await validate(bad)).some((e: { property: string }) => e.property === 'pin')).toBe(
      true,
    );
    const ok = plainToInstance(ConferenceGuestJoinDto, { pin: '1234' });
    expect(await validate(ok)).toHaveLength(0);
  });

  it('guest events skip throttle and reuse toConferenceRoomStateDto', () => {
    const guest = fs.readFileSync(
      path.resolve(__dirname, './conference-guest.controller.ts'),
      'utf8',
    );
    expect(guest).toMatch(/@SkipThrottle\(\{ default: true, global: true \}\)/);
    expect(guest).toMatch(/toConferenceRoomStateDto/);
    expect(guest).toMatch(/:token\/events/);
    expect(guest).toMatch(/req\.user\.roomUid/);
    expect(guest).not.toMatch(/ParseIntPipe/);
  });
});
