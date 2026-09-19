import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  AiProductCatalogMaintenanceController, MarketplaceController,
} from './tenant-modules.controller';
import { ModuleAccessGuard } from './module-access.guard';
import { ModulesRegistryService } from './modules-registry.service';

describe('Marketplace AI access HTTP contract', () => {
  let app: INestApplication;
  let url: string;
  let principal: any;
  const modules = {
    resolveAiProductAccess: jest.fn(),
    unpublishUnreleasedAiDrafts: jest.fn(),
    findAll: jest.fn(), getTenantModules: jest.fn(), getHubCatalogForTenant: jest.fn(),
    setTenantHubModuleStatus: jest.fn(),
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
});
