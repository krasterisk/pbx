import { INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SuperAdminGuard } from '../auth/superadmin.guard';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';

describe('trusted analytics tenant onboarding route', () => {
  let app: INestApplication;
  let url: string;
  const tenants = { provisionAnalyticsIdentity: jest.fn().mockResolvedValue({
    tenant: { id: 9, uid: 'tenant-uid', name: 'Analytics', status: 'trial' },
    adminUser: { id: 71, login: 'owner@example.invalid', email: 'owner@example.invalid' },
  }) };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [TenantsController],
      providers: [{ provide: TenantsService, useValue: tenants }],
    }).overrideGuard(JwtAuthGuard).useValue({ canActivate: (execution) => {
      const request = execution.switchToHttp().getRequest();
      if (!request.headers.authorization) throw new UnauthorizedException();
      request.user = { sub: 1 };
      return true;
    } }).overrideGuard(SuperAdminGuard).useValue({ canActivate: () => true }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.listen(0, '127.0.0.1');
    url = `http://127.0.0.1:${(app.getHttpServer().address() as any).port}/api/cloud-admin/tenants/analytics`;
  });

  afterAll(async () => { await app?.close(); });

  it('requires platform authentication and forbids client-selected profile/modules', async () => {
    const body = { name: 'Analytics', email: 'owner@example.invalid', password: 'password123' };
    const send = (payload: object, authorization?: string) => fetch(url, { method: 'POST',
      headers: { 'content-type': 'application/json', ...(authorization ? { authorization } : {}) },
      body: JSON.stringify(payload),
    });
    expect((await send(body)).status).toBe(401);
    expect((await send({ ...body, provisioningProfile: 'pbx' }, 'Bearer platform')).status).toBe(400);
    const response = await send(body, 'Bearer platform');
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ tenant: { id: 9 }, adminUser: { id: 71 } });
    expect(tenants.provisionAnalyticsIdentity).toHaveBeenCalledWith(body, 1);
  });
});
