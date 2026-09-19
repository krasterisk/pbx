import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { VoiceRobotsPublicController } from './voice-robots-public.controller';
import { VoiceRobotsPublicKeyGuard } from './voice-robots-public-key.guard';
import { VoiceRobotsService } from './voice-robots.service';

describe('VoiceRobotsPublic HTTP', () => {
  let app: INestApplication;
  let base: string;
  const robots = { findAll: jest.fn().mockResolvedValue([{ uid: 1, name: 'v3-robot' }]) };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [VoiceRobotsPublicController],
      providers: [
        VoiceRobotsPublicKeyGuard,
        { provide: VoiceRobotsService, useValue: robots },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, fallback?: string) => {
              if (key === 'VOICE_ROBOTS_PUBLIC_API_KEY') return 'public-secret';
              if (key === 'DEFAULT_VPBX_USER_UID') return '1';
              return fallback ?? '';
            },
          },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1');
    base = `http://127.0.0.1:${(app.getHttpServer().address() as any).port}/api`;
  });

  afterAll(async () => { await app?.close(); });

  it('keeps the v3 public URL and rejects unauthenticated access', async () => {
    const missing = await fetch(`${base}/public/voice-robots`);
    expect(missing.status).toBe(401);
    await expect(missing.json()).resolves.toMatchObject({ message: 'Invalid API key' });
    expect(robots.findAll).not.toHaveBeenCalled();
  });

  it('accepts the same URL with the configured public key', async () => {
    const response = await fetch(`${base}/public/voice-robots`, {
      headers: { 'x-api-key': 'public-secret' },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([{ uid: 1, name: 'v3-robot' }]);
    expect(robots.findAll).toHaveBeenCalledWith(1);
  });

  it('rejects a wrong key without removing the route', async () => {
    const response = await fetch(`${base}/public/voice-robots`, {
      headers: { 'x-api-key': 'wrong' },
    });
    expect(response.status).toBe(401);
    expect(response.status).not.toBe(404);
  });
});

describe('VoiceRobotsPublic HTTP fail-closed', () => {
  it('does not treat an empty configured key as open access', async () => {
    const module = await Test.createTestingModule({
      controllers: [VoiceRobotsPublicController],
      providers: [
        VoiceRobotsPublicKeyGuard,
        { provide: VoiceRobotsService, useValue: { findAll: jest.fn() } },
        { provide: ConfigService, useValue: { get: () => '' } },
      ],
    }).compile();
    const app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1');
    const port = (app.getHttpServer().address() as any).port;
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/public/voice-robots`);
      expect(response.status).toBe(401);
    } finally {
      await app.close();
    }
  });
});
