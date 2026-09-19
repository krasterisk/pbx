import {
  INestApplication, UnauthorizedException, ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { TenantContextGuard } from '../integration-credentials/tenant-context.guard';
import { StandaloneCapabilitiesController } from './standalone-capabilities.controller';
import { StandaloneCapabilitiesService } from './standalone-capabilities.service';
import { StandaloneLoginController } from './standalone-login.controller';
import { StandaloneLoginService } from './standalone-login.service';

describe('Standalone identity HTTP', () => {
  let app: INestApplication;
  let base: string;
  const user = { tenantUid: 42, principalKind: 'user', principalId: 'user:7',
    permissionRevision: '1', requestId: 'req' };
  const login = {
    login: jest.fn().mockResolvedValue({
      accessToken: 'access', expiresInSeconds: 7200,
      user: { uniqueid: 7, login: 'admin@example.test', name: 'Admin' },
    }),
  };
  const capabilities = {
    forContext: jest.fn().mockResolvedValue({
      tenantUid: 42, principalKind: 'user', principalId: 'user:7',
      profile: 'analytics-api', productRuntime: 'not-installed', usable: false,
      entitlement: { product: 'speech_analytics', allowed: false, reason: 'license_invalid' },
    }),
  };

  beforeAll(async () => {
    const guard = { canActivate: (execution: { switchToHttp: () => { getRequest: () => any } }) => {
      const req = execution.switchToHttp().getRequest();
      if (!req.headers.authorization) throw new UnauthorizedException({ code: 'credential_invalid' });
      req.tenantContext = user;
      return true;
    } };
    const module = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 20 }])],
      controllers: [StandaloneLoginController, StandaloneCapabilitiesController],
      providers: [
        { provide: StandaloneLoginService, useValue: login },
        { provide: StandaloneCapabilitiesService, useValue: capabilities },
      ],
    }).overrideGuard(TenantContextGuard).useValue(guard).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.listen(0, '127.0.0.1');
    base = `http://127.0.0.1:${(app.getHttpServer().address() as any).port}/api`;
  });

  afterAll(async () => { await app?.close(); });

  it('issues login without a tenant body field', async () => {
    const response = await fetch(`${base}/auth/login`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ login: 'admin@example.test', password: 'secret-value' }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ accessToken: 'access', expiresInSeconds: 7200 });
  });

  it('returns identity and capabilities only with a verified tenant context', async () => {
    expect((await fetch(`${base}/v1/identity/capabilities`)).status).toBe(401);
    expect((await fetch(`${base}/v1/identity/self`)).status).toBe(401);
    const self = await fetch(`${base}/v1/identity/self`, { headers: { authorization: 'Bearer access' } });
    expect(self.status).toBe(200);
    expect(self.headers.get('cache-control')).toBe('no-store');
    expect(await self.json()).toEqual({
      tenantUid: 42, principalKind: 'user', principalId: 'user:7',
    });
    const response = await fetch(`${base}/v1/identity/capabilities`, {
      headers: { authorization: 'Bearer access' },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toMatchObject({
      profile: 'analytics-api', productRuntime: 'not-installed', usable: false,
      entitlement: { product: 'speech_analytics' },
    });
  });
});
