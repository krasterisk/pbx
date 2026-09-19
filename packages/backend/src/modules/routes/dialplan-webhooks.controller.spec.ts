import { UnauthorizedException } from '@nestjs/common';
import { DialplanWebhooksController } from './dialplan-webhooks.controller';

describe('DialplanWebhooksController', () => {
  const webhooksService = {
    handleCustomWebhook: jest.fn().mockResolvedValue('100'),
  };
  const config = { get: jest.fn() };

  function create(secret: string | undefined) {
    config.get.mockReturnValue(secret);
    return new DialplanWebhooksController(webhooksService as any, config as any);
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects when DIALPLAN_API_KEY is missing from env', async () => {
    const controller = create('');
    await expect(controller.customWebhook('', { route_uid: '1', user_uid: '1' }))
      .rejects.toThrow(UnauthorizedException);
    expect(webhooksService.handleCustomWebhook).not.toHaveBeenCalled();
  });

  it('rejects a wrong key', async () => {
    const controller = create('secret');
    await expect(controller.customWebhook('wrong', { route_uid: '1', user_uid: '1' }))
      .rejects.toThrow(UnauthorizedException);
  });

  it('accepts a matching x-api-key', async () => {
    const controller = create('secret');
    await expect(controller.customWebhook('secret', { route_uid: '1', user_uid: '1' }))
      .resolves.toBe('100');
  });
});
