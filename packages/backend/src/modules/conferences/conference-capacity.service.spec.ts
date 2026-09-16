import { NotFoundException } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { ConferenceCapacityService } from './conference-capacity.service';
import {
  effectiveMax,
  maxParticipantsForBudget,
  STREAM_KBPS,
  streamsForParticipants,
} from './conference-capacity.util';
import { ConferenceRoomsController } from './conference-rooms.controller';
import { ConferenceStateService } from './conference-state.service';

const ROOM_A = { uid: 77, number: '6007', user_uid: 42, tariff_max_participants: null as number | null };
const ROOM_B = { uid: 88, number: '6008', user_uid: 42, tariff_max_participants: null as number | null };

function joinEvt(room: { number: string; user_uid: number }, channel: string, callerIdNum: string) {
  return {
    Conference: `conf${room.number}_${room.user_uid}`,
    Channel: channel,
    CallerIDNum: callerIdNum,
    Admin: 'No',
    MarkedUser: 'No',
  };
}

function fillRoom(state: ConferenceStateService, room: { uid: number; number: string; user_uid: number }, n: number) {
  state.registerRoom(room);
  for (let i = 0; i < n; i++) {
    state.handleJoin(joinEvt(room, `PJSIP/${room.uid}-${i}`, String(1000 + i)));
  }
}

describe('ConferenceCapacityService (16.1-04 D-18/D-20)', () => {
  let state: ConferenceStateService;
  let service: ConferenceCapacityService;
  const prevUplink = process.env.CONFERENCE_UPLINK_KBPS;

  beforeEach(() => {
    process.env.CONFERENCE_UPLINK_KBPS = '100000';
    state = new ConferenceStateService();
    service = new ConferenceCapacityService(state);
  });

  afterEach(() => {
    if (prevUplink === undefined) delete process.env.CONFERENCE_UPLINK_KBPS;
    else process.env.CONFERENCE_UPLINK_KBPS = prevUplink;
  });

  it('two live rooms n=3 and n=2 with uplink 100000 yield min(tariff, serverMax)', () => {
    fillRoom(state, ROOM_A, 3);
    fillRoom(state, ROOM_B, 2);
    const used = streamsForParticipants(3) + streamsForParticipants(2);
    expect(used).toBe(8);
    const remaining = Math.floor(100000 / STREAM_KBPS) - used;
    const serverMax = maxParticipantsForBudget(remaining + streamsForParticipants(3));
    const room = { ...ROOM_A, tariff_max_participants: 20 };
    expect(service.capacityForRoom(room)).toBe(effectiveMax(20, serverMax));
    expect(service.capacityForRoom(room)).toBe(serverMax);
  });

  it('tariff 4 wins when serverMax is larger', () => {
    process.env.CONFERENCE_UPLINK_KBPS = '105600';
    fillRoom(state, { ...ROOM_A }, 0);
    const remaining = Math.floor(105600 / STREAM_KBPS);
    const serverMax = maxParticipantsForBudget(remaining);
    expect(serverMax).toBe(12);
    expect(service.capacityForRoom({ ...ROOM_A, tariff_max_participants: 4 })).toBe(4);
  });

  it('null tariff returns serverMax', () => {
    process.env.CONFERENCE_UPLINK_KBPS = '105600';
    fillRoom(state, { ...ROOM_A }, 0);
    expect(service.capacityForRoom({ ...ROOM_A, tariff_max_participants: null })).toBe(12);
  });

  it('returns N even when nThis already exceeds serverMax', () => {
    process.env.CONFERENCE_UPLINK_KBPS = '105600';
    fillRoom(state, { ...ROOM_A }, 20);
    expect(service.capacityForRoom({ ...ROOM_A, tariff_max_participants: null })).toBe(12);
  });

  it('returns 0 as { maxParticipants: 0 } and never a negative remainder', () => {
    process.env.CONFERENCE_UPLINK_KBPS = '1';
    fillRoom(state, { ...ROOM_A }, 0);
    expect(service.capacityForRoom({ ...ROOM_A, tariff_max_participants: null })).toBe(0);
    expect(service.capacityForRoom({ ...ROOM_A, tariff_max_participants: 4 })).toBe(0);
  });

  it('uplinkKbps uses a finite positive env value, otherwise 100000', () => {
    process.env.CONFERENCE_UPLINK_KBPS = '80000';
    expect(service.uplinkKbps()).toBe(80000);
    process.env.CONFERENCE_UPLINK_KBPS = '0';
    expect(service.uplinkKbps()).toBe(100000);
    process.env.CONFERENCE_UPLINK_KBPS = 'not-a-number';
    expect(service.uplinkKbps()).toBe(100000);
    delete process.env.CONFERENCE_UPLINK_KBPS;
    expect(service.uplinkKbps()).toBe(100000);
  });
});

describe('GET /conferences/:uid/capacity (16.1-04 D-20)', () => {
  it('is a GET :uid/capacity method on ConferenceRoomsController', () => {
    expect(Reflect.getMetadata(PATH_METADATA, ConferenceRoomsController.prototype.getCapacity)).toBe(
      ':uid/capacity',
    );
    expect(Reflect.getMetadata(METHOD_METADATA, ConferenceRoomsController.prototype.getCapacity)).toBe(
      RequestMethod.GET,
    );
    const src = fs.readFileSync(path.resolve(__dirname, 'conference-rooms.controller.ts'), 'utf8');
    expect(src).toMatch(/@SkipThrottle\(\{\s*default:\s*true,\s*global:\s*true\s*\}/);
    expect(src).toMatch(/:uid\/capacity/);
  });

  it('returns a body with exactly maxParticipants for the tenant room', async () => {
    const roomsService = {
      findOne: jest.fn().mockResolvedValue({ uid: 77, tariff_max_participants: 4, user_uid: 42 }),
    };
    const capacity = { capacityForRoom: jest.fn().mockReturnValue(4) };
    const controller = new ConferenceRoomsController(roomsService as any, capacity as any);
    const body = await controller.getCapacity(77, { user: { vpbx_user_uid: 42 } } as any);
    expect(roomsService.findOne).toHaveBeenCalledWith(77, 42);
    expect(capacity.capacityForRoom).toHaveBeenCalledWith(
      expect.objectContaining({ uid: 77, tariff_max_participants: 4 }),
    );
    expect(Object.keys(body)).toEqual(['maxParticipants']);
    expect(body.maxParticipants).toBe(4);
    expect(body).not.toHaveProperty('tariff');
    expect(body).not.toHaveProperty('budget');
    expect(body).not.toHaveProperty('source');
    expect(body).not.toHaveProperty('remaining');
    expect(body).not.toHaveProperty('server');
    expect(JSON.stringify(body)).not.toMatch(/tariff|budget|server|полос/i);
  });

  it('propagates NotFoundException for a foreign tenant uid', async () => {
    const roomsService = {
      findOne: jest.fn().mockRejectedValue(new NotFoundException('Conference room 99 not found')),
    };
    const capacity = { capacityForRoom: jest.fn() };
    const controller = new ConferenceRoomsController(roomsService as any, capacity as any);
    await expect(controller.getCapacity(99, { user: { vpbx_user_uid: 42 } } as any)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(capacity.capacityForRoom).not.toHaveBeenCalled();
  });
});
