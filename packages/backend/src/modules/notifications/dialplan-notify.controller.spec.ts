import { UnauthorizedException } from '@nestjs/common';
import { DialplanNotifyController } from './dialplan-notify.controller';

describe('DialplanNotifyController', () => {
  let configService: { get: jest.Mock };
  let dispatcher: { dispatch: jest.Mock };
  let controller: DialplanNotifyController;

  const body = {
    integration_uid: 15,
    message: 'hello',
  };

  beforeEach(() => {
    configService = { get: jest.fn().mockReturnValue('secret-key') };
    dispatcher = { dispatch: jest.fn().mockResolvedValue(undefined) };
    controller = new DialplanNotifyController(
      dispatcher as any,
      configService as any,
    );
  });

  it('returns { accepted: true } and calls dispatch on valid x-api-key header', async () => {
    const result = await controller.notify('secret-key', body);

    expect(result).toEqual({ accepted: true });
    expect(dispatcher.dispatch).toHaveBeenCalledWith(body);
  });

  it('returns { accepted: true } and calls dispatch on valid body.api_key', async () => {
    const result = await controller.notify('', { ...body, api_key: 'secret-key' });

    expect(result).toEqual({ accepted: true });
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ integration_uid: 15, api_key: 'secret-key' }),
    );
  });

  it('throws UnauthorizedException on invalid api key when DIALPLAN_API_KEY is configured', async () => {
    await expect(controller.notify('bad-key', body)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
  });

  it('returns before dispatch completes (fire-and-forget, not awaited)', async () => {
    let resolved = false;
    dispatcher.dispatch.mockReturnValue(
      new Promise<void>((resolve) => {
        setTimeout(() => {
          resolved = true;
          resolve();
        }, 50);
      }),
    );

    const result = await controller.notify('secret-key', body);

    expect(result).toEqual({ accepted: true });
    expect(resolved).toBe(false);
    expect(dispatcher.dispatch).toHaveBeenCalled();
  });
});
