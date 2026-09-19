import { spawn } from 'node:child_process';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { VoiceRobotsPublicController } from './voice-robots-public.controller';
import { VoiceRobotsPublicKeyGuard } from './voice-robots-public-key.guard';
import { VoiceRobotsService } from './voice-robots.service';

function curl(url: string, extra: string[] = []): Promise<{ status: number; body: string }> {
  const bin = process.platform === 'win32' ? 'curl.exe' : 'curl';
  return new Promise((resolve, reject) => {
    const child = spawn(bin, [
      '-sS', '--max-time', '5', '--ipv4', '--http1.1', '--noproxy', '*',
      '-D', '-', '-o', '-', ...extra, url,
    ], { windowsHide: true });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`curl failed (${code}): ${stderr || stdout}`));
        return;
      }
      const split = stdout.includes('\r\n\r\n') ? '\r\n\r\n' : '\n\n';
      const index = stdout.indexOf(split);
      const headers = index >= 0 ? stdout.slice(0, index) : stdout;
      const body = index >= 0 ? stdout.slice(index + split.length) : '';
      const statusLine = headers.split(/\r?\n/).find((line) => /^HTTP\//i.test(line)) ?? '';
      resolve({ status: Number(statusLine.split(/\s+/)[1]), body });
    });
  });
}

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

  it('keeps the same v3 URL for a curl client with x-api-key', async () => {
    const missing = await curl(`${base}/public/voice-robots`);
    expect(missing.status).toBe(401);
    expect(missing.status).not.toBe(404);
    const allowed = await curl(`${base}/public/voice-robots`, ['-H', 'x-api-key: public-secret']);
    expect(allowed.status).toBe(200);
    expect(JSON.parse(allowed.body)).toEqual([{ uid: 1, name: 'v3-robot' }]);
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
