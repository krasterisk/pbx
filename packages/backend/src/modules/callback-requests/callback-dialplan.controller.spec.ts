import { UnauthorizedException } from '@nestjs/common';
import { CallbackDialplanController } from './callback-dialplan.controller';
import {
  CallbackRequestsService,
  parseTenantUid,
  sanitizeCaller,
} from './callback-requests.service';

describe('CallbackDialplanController', () => {
  let configService: { get: jest.Mock };
  let service: { enqueue: jest.Mock };
  let controller: CallbackDialplanController;

  const body = {
    caller: '79001234567',
    uniqueid: '1693731234.12',
    route_uid: 9,
    step_id: 'cb-1',
    source: 'route_step',
    window_start: '09:00',
    window_end: '21:00',
    max_attempts: 3,
    pause_minutes: 30,
    vpbx_user_uid: 42,
  };

  beforeEach(() => {
    configService = { get: jest.fn().mockReturnValue('secret-key') };
    service = { enqueue: jest.fn().mockResolvedValue({ uid: 11 }) };
    controller = new CallbackDialplanController(
      service as any,
      configService as any,
    );
  });

  it('returns { accepted: true } and creates a row on valid x-api-key header', async () => {
    const result = await controller.enqueue('secret-key', body);

    expect(result).toEqual({ accepted: true, id: 11 });
    expect(service.enqueue).toHaveBeenCalledWith(body);
  });

  it('returns { accepted: true } and calls enqueue on valid body.api_key', async () => {
    const result = await controller.enqueue('', { ...body, api_key: 'secret-key' });

    expect(result).toEqual({ accepted: true, id: 11 });
    expect(service.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ caller: '79001234567', api_key: 'secret-key' }),
    );
  });

  it('throws UnauthorizedException on invalid api key', async () => {
    await expect(controller.enqueue('bad-key', body)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(service.enqueue).not.toHaveBeenCalled();
  });
});

describe('CallbackRequestsService.enqueue', () => {
  let requests: {
    findOne: jest.Mock;
    create: jest.Mock;
  };
  let service: CallbackRequestsService;

  beforeEach(() => {
    requests = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ uid: 1, caller: '79001234567' }),
    };
    service = new CallbackRequestsService(requests as any);
  });

  it('creates a pending row with window copy and route_step source', async () => {
    await service.enqueue({
      caller: '79001234567',
      uniqueid: '1693731234.12',
      route_uid: 9,
      step_id: 'cb-1',
      source: 'route_step',
      window_start: '10:00',
      window_end: '18:00',
      max_attempts: 5,
      pause_minutes: 15,
      vpbx_user_uid: 42,
    });

    expect(requests.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user_uid: 42,
        caller: '79001234567',
        route_uid: 9,
        status: 'pending',
        attempt_count: 0,
        max_attempts: 5,
        pause_minutes: 15,
        window_start: '10:00',
        window_end: '18:00',
        source: 'route_step',
        claimed_agent_uid: null,
      }),
    );
  });

  it('rejects invalid tenant uid and empty caller', async () => {
    expect(await service.enqueue({ caller: '7900', vpbx_user_uid: 0 })).toBeNull();
    expect(await service.enqueue({ caller: '', vpbx_user_uid: 7 })).toBeNull();
    expect(requests.create).not.toHaveBeenCalled();
  });

  it('dedupes a rapid second fire with the same uniqueid', async () => {
    const existing = { uid: 3, caller: '79001234567' };
    requests.findOne.mockResolvedValue(existing);

    const row = await service.enqueue({
      caller: '79001234567',
      uniqueid: '1693731234.12',
      vpbx_user_uid: 42,
    });

    expect(row).toBe(existing);
    expect(requests.create).not.toHaveBeenCalled();
  });

  it('sanitizes caller and parses tenant uid', () => {
    expect(sanitizeCaller('+7 (900) 123-45-67')).toBe('+79001234567');
    expect(parseTenantUid('42')).toBe(42);
    expect(parseTenantUid('x')).toBeNull();
  });
});
