import { INestApplication, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SuperAdminGuard } from '../auth/superadmin.guard';
import {
  AiProductCatalogMaintenanceController, MarketplaceController, TenantHubEntitlementsController,
  AiProductEntitleController,
} from './tenant-modules.controller';
import { ModuleAccessGuard } from './module-access.guard';
import { ModulesRegistryService } from './modules-registry.service';
import { TenantsService } from './tenants.service';
import { SkuCatalogService } from '../product-access/sku-catalog.service';

describe('Marketplace AI access HTTP contract', () => {
  let app: INestApplication;
  let url: string;
  let principal: any;
  const modules = {
    resolveAiProductAccess: jest.fn(),
    unpublishUnreleasedAiDrafts: jest.fn(),
    findAll: jest.fn(), getTenantModules: jest.fn(), getHubCatalogForTenant: jest.fn(),
    setTenantHubModuleStatus: jest.fn(),
    resolveTenantIdFromJwt: jest.fn(),
  };

  beforeAll(async () => {
    const testingModule = await Test.createTestingModule({
      controllers: [MarketplaceController, AiProductCatalogMaintenanceController],
      providers: [ModuleAccessGuard, { provide: ModulesRegistryService, useValue: modules }],
    }).overrideGuard(JwtAuthGuard).useValue({
      canActivate: (context: any) => {
        if (principal === undefined) return false;
        context.switchToHttp().getRequest().user = principal;
        return true;
      },
    }).compile();
    app = testingModule.createNestApplication();
    await app.listen(0, '127.0.0.1');
    url = await app.getUrl();
  });

  afterAll(async () => app?.close());
  beforeEach(() => {
    jest.clearAllMocks();
    principal = { level: 1, vpbx_user_uid: 42 };
    modules.resolveAiProductAccess.mockImplementation(async (_uid: number, product: string) => ({
      product, allowed: false, reason: 'product_disabled', policyRevision: 1,
    }));
    modules.resolveTenantIdFromJwt.mockImplementation(async (user: any) => {
      if (user?.level !== 1) return null;
      if (Number.isSafeInteger(user?.tenant_id) && user.tenant_id > 0) return user.tenant_id;
      if (Number.isSafeInteger(user?.vpbx_user_uid) && user.vpbx_user_uid >= 0) return 9;
      return null;
    });
  });

  it('denies the protected endpoint even to a superadmin with a grant but no activation', async () => {
    principal = { level: 0, vpbx_user_uid: 0 };
    const response = await fetch(`${url}/marketplace/ai-products/voice-robots/access`);
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'product_disabled' });
    expect(modules.resolveAiProductAccess).toHaveBeenCalledWith(0, 'ai_voice_robots');
  });

  it('rejects an unbound identity before policy lookup', async () => {
    principal = { level: 1 };
    const response = await fetch(`${url}/marketplace/ai-products/speech-analytics/access`);
    expect(response.status).toBe(401);
    expect(modules.resolveAiProductAccess).not.toHaveBeenCalled();
  });

  it('publishes the same policy projection used by the guard', async () => {
    const response = await fetch(`${url}/marketplace/ai-products/status`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      expect.objectContaining({ product: 'ai_voice_robots', allowed: false }),
      expect.objectContaining({ product: 'speech_analytics', allowed: false }),
    ]);
    expect(modules.resolveAiProductAccess).toHaveBeenCalledTimes(2);
  });

  it('reserves the one-time publication repair for superadmin', async () => {
    const path = `${url}/cloud-admin/ai-products/unpublish-unreleased-drafts`;
    const denied = await fetch(path, { method: 'POST' });
    expect(denied.status).toBe(403);
    expect(modules.unpublishUnreleasedAiDrafts).not.toHaveBeenCalled();
    principal = { level: 0, vpbx_user_uid: 0 };
    modules.unpublishUnreleasedAiDrafts.mockResolvedValue(2);
    const accepted = await fetch(path, { method: 'POST' });
    expect(accepted.status).toBe(201);
    expect(await accepted.json()).toEqual({ changed: 2 });
  });

  it('rejects hub disable for a platform superadmin JWT', async () => {
    principal = { level: 0, vpbx_user_uid: 0, sub: 1 };
    const response = await fetch(`${url}/marketplace/hub-modules/ai/disable`, { method: 'POST' });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ message: 'Tenant binding required' });
    expect(modules.setTenantHubModuleStatus).not.toHaveBeenCalled();
  });

  it('lets a tenant admin disable using the resolved cabinet id', async () => {
    principal = { level: 1, vpbx_user_uid: 8, sub: 4 };
    modules.setTenantHubModuleStatus.mockResolvedValue({ module_code: 'ai', status: 'inactive' });
    const response = await fetch(`${url}/marketplace/hub-modules/ai/disable`, { method: 'POST' });
    expect(response.status).toBe(201);
    expect(modules.setTenantHubModuleStatus).toHaveBeenCalledWith(9, 'ai', 'inactive', 4);
  });

  it('rejects hub disable when the admin has no cabinet row', async () => {
    principal = { level: 1, sub: 4 };
    const response = await fetch(`${url}/marketplace/hub-modules/ai/disable`, { method: 'POST' });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ message: 'Tenant binding required' });
    expect(modules.setTenantHubModuleStatus).not.toHaveBeenCalled();
  });
});

describe('Tenant hub entitlements by URL tenant id', () => {
  let app: INestApplication;
  let url: string;
  let principal: any;
  const modules = {
    getHubCatalogForTenant: jest.fn(),
    setTenantHubModuleStatus: jest.fn(),
    grantHubModule: jest.fn(),
  };
  const tenants = { findOne: jest.fn() };
  const skus = { entitleOperator: jest.fn() };

  beforeAll(async () => {
    const testingModule = await Test.createTestingModule({
      controllers: [TenantHubEntitlementsController],
      providers: [
        SuperAdminGuard,
        { provide: ModulesRegistryService, useValue: modules },
        { provide: TenantsService, useValue: tenants },
        { provide: SkuCatalogService, useValue: skus },
      ],
    }).overrideGuard(JwtAuthGuard).useValue({
      canActivate: (context: any) => {
        context.switchToHttp().getRequest().user = principal;
        return true;
      },
    }).compile();
    app = testingModule.createNestApplication();
    await app.listen(0, '127.0.0.1');
    url = await app.getUrl();
  });

  afterAll(async () => app?.close());
  beforeEach(() => {
    jest.clearAllMocks();
    principal = { level: 0, sub: 1, vpbx_user_uid: 0 };
    tenants.findOne.mockResolvedValue({ id: 12, name: 'Acme' });
    modules.setTenantHubModuleStatus.mockResolvedValue({ module_code: 'ai', status: 'inactive' });
    modules.grantHubModule.mockResolvedValue({ module_code: 'analytics', status: 'active' });
    skus.entitleOperator.mockResolvedValue({ product: 'speech_analytics', enabled: true, revision: 1 });
  });

  it('disables the selected cabinet, not the superadmin JWT', async () => {
    const response = await fetch(`${url}/cloud-admin/tenants/12/hub-modules/ai/disable`, { method: 'POST' });
    expect(response.status).toBe(201);
    expect(tenants.findOne).toHaveBeenCalledWith(12);
    expect(modules.setTenantHubModuleStatus).toHaveBeenCalledWith(12, 'ai', 'inactive', 1);
  });

  it('refuses a tenant admin on the platform route', async () => {
    principal = { level: 1, sub: 4, vpbx_user_uid: 8 };
    const response = await fetch(`${url}/cloud-admin/tenants/12/hub-modules/ai/disable`, { method: 'POST' });
    expect(response.status).toBe(403);
    expect(modules.setTenantHubModuleStatus).not.toHaveBeenCalled();
  });

  it('does not write when the selected cabinet is missing', async () => {
    tenants.findOne.mockRejectedValue(new NotFoundException('Tenant #99 not found'));
    const response = await fetch(`${url}/cloud-admin/tenants/99/hub-modules/ai/enable`, { method: 'POST' });
    expect(response.status).toBe(404);
    expect(modules.setTenantHubModuleStatus).not.toHaveBeenCalled();
  });

  it('opens an AI product on the selected cabinet', async () => {
    const response = await fetch(`${url}/cloud-admin/tenants/12/hub-modules/speech_analytics/grant`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ access: 'open' }),
    });
    expect(response.status).toBe(201);
    expect(skus.entitleOperator).toHaveBeenCalledWith(12, 'speech_analytics', 1, { trialDays: 0 });
    expect(modules.grantHubModule).not.toHaveBeenCalled();
  });

  it('starts a hub-module trial without the AI entitle path', async () => {
    const response = await fetch(`${url}/cloud-admin/tenants/12/hub-modules/analytics/grant`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ access: 'trial', trialDays: 14 }),
    });
    expect(response.status).toBe(201);
    expect(modules.grantHubModule).toHaveBeenCalledWith(12, 'analytics', 'trial', 14, 1);
    expect(skus.entitleOperator).not.toHaveBeenCalled();
  });
});

describe('SuperAdmin AI entitle HTTP', () => {
  let app: INestApplication;
  let url: string;
  let principal: any;
  const tenants = {
    findOne: jest.fn(),
    findByVpbxUid: jest.fn(),
  };
  const skus = { entitleOperator: jest.fn() };

  beforeAll(async () => {
    const testingModule = await Test.createTestingModule({
      controllers: [AiProductEntitleController],
      providers: [
        SuperAdminGuard,
        { provide: TenantsService, useValue: tenants },
        { provide: SkuCatalogService, useValue: skus },
      ],
    }).overrideGuard(JwtAuthGuard).useValue({
      canActivate: (context: any) => {
        context.switchToHttp().getRequest().user = principal;
        return true;
      },
    }).compile();
    app = testingModule.createNestApplication();
    await app.listen(0, '127.0.0.1');
    url = await app.getUrl();
  });

  afterAll(async () => app?.close());
  beforeEach(() => {
    jest.clearAllMocks();
    principal = { level: 0, sub: 1, vpbx_user_uid: 0 };
    tenants.findOne.mockResolvedValue({ id: 12, name: 'Acme' });
    tenants.findByVpbxUid.mockResolvedValue({ id: 12, vpbx_user_uid: 0 });
    skus.entitleOperator.mockResolvedValue({ product: 'speech_analytics', enabled: true, revision: 1 });
  });

  it('entitles the selected cabinet, not the JWT uid', async () => {
    const response = await fetch(
      `${url}/cloud-admin/tenants/12/ai-products/speech_analytics/entitle`,
      { method: 'POST' },
    );
    expect(response.status).toBe(201);
    expect(tenants.findOne).toHaveBeenCalledWith(12);
    expect(skus.entitleOperator).toHaveBeenCalledWith(12, 'speech_analytics', 1);
  });

  it('entitles the JWT cabinet when a tenant row exists', async () => {
    const response = await fetch(
      `${url}/cloud-admin/ai-products/speech_analytics/entitle-current`,
      { method: 'POST' },
    );
    expect(response.status).toBe(201);
    expect(tenants.findByVpbxUid).toHaveBeenCalledWith(0);
    expect(skus.entitleOperator).toHaveBeenCalledWith(12, 'speech_analytics', 1);
  });

  it('returns 404 when SuperAdmin has no cabinet row', async () => {
    tenants.findByVpbxUid.mockResolvedValue(null);
    const response = await fetch(
      `${url}/cloud-admin/ai-products/ai_voice_robots/entitle-current`,
      { method: 'POST' },
    );
    expect(response.status).toBe(404);
    expect(skus.entitleOperator).not.toHaveBeenCalled();
  });

  it('refuses a tenant admin', async () => {
    principal = { level: 1, sub: 4, vpbx_user_uid: 8 };
    const response = await fetch(
      `${url}/cloud-admin/tenants/12/ai-products/speech_analytics/entitle`,
      { method: 'POST' },
    );
    expect(response.status).toBe(403);
    expect(skus.entitleOperator).not.toHaveBeenCalled();
  });
});
