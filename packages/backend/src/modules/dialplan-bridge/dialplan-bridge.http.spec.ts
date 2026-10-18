import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { DialplanBridgeController } from './dialplan-bridge.controller';
import { DialplanBridgeService } from './dialplan-bridge.service';

describe('Dialplan bridge HTTP validation', () => {
  let app: INestApplication;
  let url: string;
  const tts = jest.fn().mockResolvedValue({ status: 'ok', file: 'customer-prompt' });
  const post = (body: Record<string, string>) => fetch(`${url}/api/internal/dialplan/tts`, {
    method: 'POST', body: new URLSearchParams(body),
  });

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [DialplanBridgeController],
      providers: [
        { provide: DialplanBridgeService, useValue: { tts } },
        { provide: ConfigService, useValue: { get: () => 'test-dialplan-key' } },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.listen(0, '127.0.0.1');
    url = await app.getUrl();
  });

  afterAll(async () => { await app.close(); });
  beforeEach(() => { tts.mockClear(); });

  it('accepts the form body emitted by Asterisk CURL with strict production validation', async () => {
    const body = { api_key: 'test-dialplan-key', vpbx_user_uid: '0', engine: '69', text: 'Тестовый клиент пятнадцать рублей' };
    const response = await post(body);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('customer-prompt');
    expect(tts).toHaveBeenCalledWith(expect.objectContaining(body));
  });

  it('rejects an invalid key before synthesis', async () => {
    const response = await post({ api_key: 'wrong', engine: '69', text: 'test', vpbx_user_uid: '0' });
    expect(response.status).toBe(401);
    expect(tts).not.toHaveBeenCalled();
  });

  it('continues to reject undeclared body properties', async () => {
    const response = await post({ api_key: 'test-dialplan-key', engine: '69', text: 'test', unexpected: 'value' });
    expect(response.status).toBe(400);
    expect(tts).not.toHaveBeenCalled();
  });
});
