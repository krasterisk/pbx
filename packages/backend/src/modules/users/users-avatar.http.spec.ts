import { NotFoundException, type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { createReadStream } from 'fs';
import { Readable } from 'stream';
import { AuthService } from '../auth/auth.service';
import { JwtStrategy } from '../auth/jwt.strategy';
import { LoggerService } from '../logger/logger.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

jest.mock('fs', () => ({ ...jest.requireActual('fs'), createReadStream: jest.fn() }));

describe('Avatar burst over authenticated HTTP', () => {
  let app: INestApplication;
  let base: string;
  let token: string;
  const secret = 'synthetic-avatar-http-secret-at-least-32-characters';
  const service = {
    openAvatarStream: jest.fn(async (id: number, tenant: number) => {
      if (id !== 347 || tenant !== 0) throw new NotFoundException('Avatar not found');
      return { absolutePath: '/synthetic/avatar.png', contentType: 'image/png' };
    }),
    findAll: jest.fn(async () => []),
    assertCanManageAvatar: jest.fn(),
    removeAvatar: jest.fn(async () => ({})),
  };

  beforeAll(async () => {
    jest.mocked(createReadStream).mockImplementation(() => Readable.from(['synthetic-avatar']) as ReturnType<typeof createReadStream>);
    const module = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret }), ThrottlerModule.forRoot([
        { name: 'default', limit: 2, ttl: 60_000 }, { name: 'global', limit: 2, ttl: 60_000 },
      ])],
      controllers: [UsersController],
      providers: [JwtStrategy, { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: ConfigService, useValue: new ConfigService({ JWT_SECRET: secret }) },
        { provide: AuthService, useValue: { validateJwtPayload: (payload: unknown) => payload } },
        { provide: UsersService, useValue: service },
        { provide: LoggerService, useValue: { logAction: jest.fn() } },
      ],
    }).compile();
    token = module.get(JwtService).sign({ sub: 58, level: 1, vpbx_user_uid: 0 });
    app = module.createNestApplication({ logger: false });
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
  });
  afterAll(async () => { await app?.close(); });

  async function request(path: string, method = 'GET', access = token) {
    const response = await fetch(`${base}${path}`, { method, headers: access ? { Authorization: `Bearer ${access}` } : {} });
    await response.arrayBuffer();
    return response;
  }

  it('serves avatar bursts without weakening JWT or tenant lookup', async () => {
    for (let i = 0; i < 5; i++) {
      const response = await request(`/users/347/avatar?token=${token}`, 'GET', '');
      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('private, max-age=86400');
    }
    expect(service.openAvatarStream).toHaveBeenCalledWith(347, 0);
    expect((await request('/users/347/avatar', 'GET', '')).status).toBe(401);
    expect((await request('/users/347/avatar', 'GET', 'invalid')).status).toBe(401);
    for (let i = 0; i < 3; i++) expect((await request('/users/348/avatar')).status).toBe(404);
    const otherTenant = app.get(JwtService).sign({ sub: 59, level: 1, vpbx_user_uid: 1 });
    expect((await request('/users/347/avatar', 'GET', otherTenant)).status).toBe(404);
    expect(service.openAvatarStream).toHaveBeenCalledWith(347, 1);
  });

  it('retains rate limits for user listing and avatar removal', async () => {
    for (const [path, method] of [['/users', 'GET'], ['/users/347/avatar', 'DELETE']]) {
      expect((await request(path, method)).status).toBe(200);
      expect((await request(path, method)).status).toBe(200);
      expect((await request(path, method)).status).toBe(429);
    }
  });
});
