import { UnauthorizedException } from '@nestjs/common';
import { DialplanBridgeController } from './dialplan-bridge.controller';

describe('DialplanBridgeController', () => {
  const service = {
    setclid: jest.fn().mockResolvedValue({ callerid: '79001112233' }),
    webhook: jest.fn().mockResolvedValue({ body: 'ok' }),
    sendmailpeer: jest.fn().mockResolvedValue({ accepted: true }),
    telegram: jest.fn().mockResolvedValue({ accepted: true }),
    tts: jest.fn().mockResolvedValue({ status: 'ok', file: 'prompt' }),
  };
  const configService = { get: jest.fn().mockReturnValue('secret-key') };
  let controller: DialplanBridgeController;

  beforeEach(() => {
    jest.clearAllMocks();
    configService.get.mockReturnValue('secret-key');
    controller = new DialplanBridgeController(service as any, configService as any);
  });

  it('returns 401 semantics without an API key', async () => {
    await expect(controller.setclid('', { list_uid: '5' })).rejects.toThrow(
      UnauthorizedException,
    );
    expect(service.setclid).not.toHaveBeenCalled();
  });

  it('returns 401 semantics with a wrong API key', async () => {
    await expect(controller.webhook('bad-key', { url: 'https://x' })).rejects.toThrow(
      UnauthorizedException,
    );
    expect(service.webhook).not.toHaveBeenCalled();
  });

  it('returns 200 payload with the correct API key', async () => {
    const result = await controller.telegram('secret-key', { chat_id: '1', text: 'hi' });
    expect(result).toEqual({ accepted: true });
    expect(service.telegram).toHaveBeenCalled();
  });

  it('rejects when DIALPLAN_API_KEY is missing from env', async () => {
    configService.get.mockReturnValue('');
    controller = new DialplanBridgeController(service as any, configService as any);
    await expect(controller.tts('secret-key', { text: 'hi' })).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
