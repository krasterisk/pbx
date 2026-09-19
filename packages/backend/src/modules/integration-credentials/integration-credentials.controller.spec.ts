import {
  ConflictException, ForbiddenException, HttpException, HttpStatus,
  INestApplication, ServiceUnavailableException, UnauthorizedException, ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { IntegrationCredentialsController } from './integration-credentials.controller';
import { IntegrationCredentialsService } from './integration-credentials.service';
import { TenantContextGuard } from './tenant-context.guard';
import { IntegrationKeyRateLimiter } from './integration-key-rate-limiter';

describe('IntegrationCredentialsController HTTP contract', () => {
  let app: INestApplication;
  let base: string;
  const machine = { tenantUid: 7, principalId: '00000000-0000-4000-8000-000000000001',
    principalKind: 'integration', permissionRevision: '1', requestId: 'request' };
  const admin = { tenantUid: 7, principalId: 'user:7',
    principalKind: 'user', permissionRevision: '1', requestId: 'request' };
  const service = {
    selfCapabilities: jest.fn().mockResolvedValue({ product: 'speech_analytics', state: 'not_configured',
      action: 'create_project', grants: [] }),
    list: jest.fn().mockResolvedValue({ items: [], nextCursor: null }),
    create: jest.fn(async (context) => {
      if (context.principalKind !== 'user') throw new ForbiddenException({ code: 'integration_admin_required' });
      return { principalId: machine.principalId, generation: 1, token: 'one-time-secret', replay: false };
    }),
    replaceGrants: jest.fn().mockResolvedValue('2'),
    rotate: jest.fn().mockResolvedValue({ principalId: machine.principalId,
      generation: 2, token: 'rotated-secret', replay: false }),
    disable: jest.fn().mockResolvedValue(true),
  };
  const limiter = { consumeManagement: jest.fn() };

  beforeAll(async () => {
    const guard = { canActivate: (execution) => {
      const req = execution.switchToHttp().getRequest();
      if (!req.headers.authorization) throw new UnauthorizedException();
      req.tenantContext = req.headers.authorization === 'Bearer machine' ? machine : admin;
      return true;
    } };
    const module = await Test.createTestingModule({
      controllers: [IntegrationCredentialsController],
      providers: [
        { provide: IntegrationCredentialsService, useValue: service },
        { provide: IntegrationKeyRateLimiter, useValue: limiter },
      ],
    }).overrideGuard(TenantContextGuard).useValue(guard).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.listen(0, '127.0.0.1');
    base = `http://127.0.0.1:${(app.getHttpServer().address() as any).port}/api/v1/integrations`;
  });

  afterAll(async () => { await app?.close(); });

  it('puts static self route before id and denies missing authorization', async () => {
    const response = await fetch(`${base}/self/capabilities`, { headers: { authorization: 'Bearer machine' } });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toMatchObject({ action: 'create_project', grants: [] });
    expect((await fetch(base)).status).toBe(401);
  });

  it('returns one-time secret with no-store, validates body, and forbids machine management', async () => {
    const body = JSON.stringify({ label: 'External PBX', product: 'speech_analytics',
      operationId: '00000000-0000-4000-8000-000000000002' });
    const send = (authorization: string, payload: string) => fetch(base, {
      method: 'POST', headers: { authorization, 'content-type': 'application/json' }, body: payload,
    });
    const created = await send('Bearer user', body);
    expect(created.status).toBe(201);
    expect(created.headers.get('cache-control')).toBe('no-store');
    expect(created.headers.get('pragma')).toBe('no-cache');
    expect(await created.json()).toMatchObject({ token: 'one-time-secret', replay: false });
    expect((await send('Bearer user', JSON.stringify({ ...JSON.parse(body), tenantUid: 8 }))).status).toBe(400);
    expect((await send('Bearer machine', body)).status).toBe(403);
  });

  it('handles bounded listing, grant revision, rotation and idempotent 204 revoke', async () => {
    expect((await fetch(`${base}?limit=101`, { headers: { authorization: 'Bearer user' } })).status).toBe(400);
    expect((await fetch(`${base}?limit=10`, { headers: { authorization: 'Bearer user' } })).status).toBe(200);
    expect(service.list).toHaveBeenCalledWith(admin, 10, undefined);
    const id = machine.principalId;
    const headers = { authorization: 'Bearer user', 'content-type': 'application/json' };
    const grants = await fetch(`${base}/${id}/grants`, { method: 'PUT', headers,
      body: JSON.stringify({ expectedRevision: '1', grants: [] }) });
    expect(grants.status).toBe(200);
    expect(await grants.json()).toEqual({ permissionRevision: '2' });
    const rotated = await fetch(`${base}/${id}/rotate`, { method: 'POST', headers,
      body: JSON.stringify({ operationId: '00000000-0000-4000-8000-000000000003', expectedGeneration: 1 }) });
    expect(rotated.status).toBe(201);
    expect(rotated.headers.get('cache-control')).toBe('no-store');
    const revoke = await fetch(`${base}/${id}/revoke`, { method: 'POST', headers });
    expect(revoke.status).toBe(204);
    expect(await revoke.text()).toBe('');
  });

  it('returns reviewed 409, 429 and 503 statuses without a token', async () => {
    const body = JSON.stringify({ label: 'External PBX', product: 'speech_analytics',
      operationId: '00000000-0000-4000-8000-000000000004' });
    const send = () => fetch(base, { method: 'POST',
      headers: { authorization: 'Bearer user', 'content-type': 'application/json' }, body });
    service.create.mockRejectedValueOnce(new ConflictException({ code: 'operation_conflict' }));
    expect((await send()).status).toBe(409);
    limiter.consumeManagement.mockRejectedValueOnce(new HttpException(
      { code: 'credential_rate_limited' }, HttpStatus.TOO_MANY_REQUESTS));
    const limited = await send();
    expect(limited.status).toBe(429);
    expect(JSON.stringify(await limited.json())).not.toContain('one-time-secret');
    limiter.consumeManagement.mockRejectedValueOnce(new ServiceUnavailableException({
      code: 'credential_auth_unavailable',
    }));
    expect((await send()).status).toBe(503);
  });

  it('publishes versioned paths and documented error statuses in OpenAPI', () => {
    const document = SwaggerModule.createDocument(app, new DocumentBuilder().addBearerAuth().build());
    const path = document.paths['/api/v1/integrations'];
    expect(path?.post?.responses).toHaveProperty('201');
    for (const status of ['400', '401', '403', '404', '429', '503']) {
      expect(path?.post?.responses).toHaveProperty(status);
    }
    expect(document.paths['/api/v1/integrations/{id}/rotate']?.post?.responses).toHaveProperty('409');
    expect(document.paths['/api/v1/integrations/{id}/revoke']?.post?.responses).toHaveProperty('204');
    expect(document.paths['/api/v1/integrations/self/capabilities']?.get).toBeDefined();
  });
});
