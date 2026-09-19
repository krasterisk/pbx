import { UnauthorizedException } from '@nestjs/common';
import { IvrsInternalController } from './ivrs-internal.controller';

describe('IvrsInternalController', () => {
  const ivrsService = { findOne: jest.fn() };
  const ivrTtsService = { loadEngine: jest.fn(), synthesizeToBuffer: jest.fn() };
  const ttsCache = { writeWav: jest.fn() };
  const config = { get: jest.fn() };

  function create(secret: string | undefined) {
    config.get.mockReturnValue(secret);
    return new IvrsInternalController(
      ivrsService as any, ivrTtsService as any, ttsCache as any, config as any,
    );
  }

  beforeEach(() => jest.clearAllMocks());

  it('rejects when DIALPLAN_API_KEY is missing from env', async () => {
    const controller = create('');
    await expect(controller.playPhrase('1', '0', '1', 'u1', ''))
      .rejects.toThrow(UnauthorizedException);
    expect(ivrsService.findOne).not.toHaveBeenCalled();
  });

  it('rejects a wrong query api_key', async () => {
    const controller = create('secret');
    await expect(controller.playPhrase('1', '0', '1', 'u1', 'wrong'))
      .rejects.toThrow(UnauthorizedException);
  });
});
