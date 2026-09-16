import { ForbiddenException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { ConferenceGuestController } from './conference-guest.controller';
import { ConferenceRoomsController } from './conference-rooms.controller';
import { ConferenceTelemetryService } from './conference-telemetry.service';

describe('ConferenceTelemetryService (16.1-06 R-TELEMETRY)', () => {
  let service: ConferenceTelemetryService;

  beforeEach(() => {
    service = new ConferenceTelemetryService();
    jest.useFakeTimers();
    jest.setSystemTime(1_000_000);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns the three allow-listed fields from get after a valid ingest', () => {
    const stored = service.ingest(77, '200', {
      qualityLimitationReason: 'bandwidth',
      packetsLost: 3,
      totalFreezesDuration: 1.5,
    });
    expect(stored).toEqual({
      qualityLimitationReason: 'bandwidth',
      packetsLost: 3,
      totalFreezesDuration: 1.5,
    });
    expect(service.get(77, '200')).toEqual(stored);
  });

  it('drops invalid reason or packetsLost and keeps neighboring valid fields', () => {
    const stored = service.ingest(77, '200', {
      qualityLimitationReason: 'slow',
      packetsLost: 'x',
      totalFreezesDuration: 1.5,
    });
    expect(stored).toEqual({ totalFreezesDuration: 1.5 });
    expect(stored).not.toHaveProperty('qualityLimitationReason');
    expect(stored).not.toHaveProperty('packetsLost');
    expect(service.get(77, '200')).toEqual({ totalFreezesDuration: 1.5 });
  });

  it('strips unknown extra keys while keeping a valid packetsLost', () => {
    const stored = service.ingest(77, '200', {
      extra: 'nope',
      packetsLost: 4,
    });
    expect(stored).toEqual({ packetsLost: 4 });
    expect(stored).not.toHaveProperty('extra');
    expect(service.get(77, '200')).toEqual({ packetsLost: 4 });
  });

  it('returns null from get 61s after ingest', () => {
    service.ingest(77, '200', { packetsLost: 1 });
    jest.setSystemTime(1_000_000 + 61_000);
    expect(service.get(77, '200')).toBeNull();
  });
});

describe('JWT telemetry POST (16.1-06 R-TELEMETRY)', () => {
  it('keys ingest by path uid, ignoring a foreign body.roomUid', async () => {
    const telemetry = new ConferenceTelemetryService();
    const rooms = {
      assertLiveRoomAccess: jest.fn().mockResolvedValue({ uid: 77 }),
      resolveCallerRef: jest.fn().mockResolvedValue('200'),
    };
    const controller = new ConferenceRoomsController(
      rooms as any,
      {} as any,
      {} as any,
      telemetry,
    );
    const result = await controller.ingestTelemetry(
      77,
      {
        roomUid: 999,
        qualityLimitationReason: 'bandwidth',
        packetsLost: 3,
      },
      { user: { sub: 5, vpbx_user_uid: 42 } } as any,
    );
    expect(result).toEqual({
      qualityLimitationReason: 'bandwidth',
      packetsLost: 3,
    });
    expect(telemetry.get(77, '200')).toEqual(result);
    expect(telemetry.get(999, '200')).toBeNull();
    expect(rooms.assertLiveRoomAccess).toHaveBeenCalled();
  });

  it('forbids a caller whose number did not resolve', async () => {
    const telemetry = new ConferenceTelemetryService();
    const rooms = {
      assertLiveRoomAccess: jest.fn().mockResolvedValue({ uid: 77 }),
      resolveCallerRef: jest.fn().mockResolvedValue(null),
    };
    const controller = new ConferenceRoomsController(
      rooms as any,
      {} as any,
      {} as any,
      telemetry,
    );
    await expect(
      controller.ingestTelemetry(77, { packetsLost: 1 }, { user: { sub: 5 } } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(telemetry.get(77, '200')).toBeNull();
  });
});

describe('guest telemetry route (16.1-06 R-TELEMETRY)', () => {
  it('guards POST :token/telemetry and does not validate the body with class-validator', () => {
    const guestSrc = fs.readFileSync(
      path.resolve(__dirname, 'conference-guest.controller.ts'),
      'utf8',
    );
    const roomsSrc = fs.readFileSync(
      path.resolve(__dirname, 'conference-rooms.controller.ts'),
      'utf8',
    );
    const dtoSrc = fs.readFileSync(
      path.resolve(__dirname, 'dto/conference-telemetry.dto.ts'),
      'utf8',
    );
    expect(guestSrc).toMatch(/@Post\(':token\/telemetry'\)/);
    expect(guestSrc).toMatch(/ConferenceGuestTokenGuard/);
    expect(guestSrc).toMatch(/@SkipThrottle\(\{ default: true, global: true \}\)/);
    expect(roomsSrc).toMatch(/@Post\(':uid\/telemetry'\)/);
    expect(roomsSrc).toMatch(/@SkipThrottle\(\{ default: true, global: true \}\)/);
    expect(dtoSrc).not.toMatch(/IsIn|IsNumber|forbidNonWhitelisted|class-validator/);
    expect(guestSrc).not.toMatch(/ConferenceTelemetryDto/);
    expect(roomsSrc).not.toMatch(/ConferenceTelemetryDto/);
    expect(typeof ConferenceGuestController.prototype.ingestTelemetry).toBe('function');
  });
});
