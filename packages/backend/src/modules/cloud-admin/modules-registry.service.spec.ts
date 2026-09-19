import { ConfigService } from '@nestjs/config';
import { ModulesRegistryService } from './modules-registry.service';
import type { HubModule } from './models/hub-module.model';
import type { TenantModule } from './tenant-module.model';

function mockHub(partial: Partial<HubModule> & { code: string; kind: 'base' | 'market' }): HubModule {
  return {
    id: 1,
    name: partial.code,
    sort_order: 0,
    requires_cloud: false,
    pages: [],
    ...partial,
  } as HubModule;
}

describe('ModulesRegistryService licenseStatus (08-02)', () => {
  let service: ModulesRegistryService;
  let hubFindAll: jest.Mock;
  let tenantFindAll: jest.Mock;
  let configGet: jest.Mock;

  beforeEach(() => {
    hubFindAll = jest.fn();
    tenantFindAll = jest.fn();
    configGet = jest.fn().mockReturnValue('CLOUD');

    service = new ModulesRegistryService(
      {} as any,
      { findAll: tenantFindAll, findOne: jest.fn(), upsert: jest.fn(), update: jest.fn(), bulkCreate: jest.fn() } as any,
      { findOne: jest.fn() } as any,
      { get: configGet } as unknown as ConfigService,
      { findAll: hubFindAll, findOne: jest.fn(), create: jest.fn(), upsert: jest.fn() } as any,
      { findAll: jest.fn(), destroy: jest.fn(), bulkCreate: jest.fn() } as any,
      {} as any,
    );
  });

  it('maps missing market license → locked', async () => {
    hubFindAll.mockResolvedValue([
      mockHub({ code: 'callcenter', kind: 'market' }),
      mockHub({ code: 'core', kind: 'base' }),
    ]);
    tenantFindAll.mockResolvedValue([]);

    const catalog = await service.getHubCatalogForTenant(1);
    const cc = catalog.find((m) => m.code === 'callcenter');
    const core = catalog.find((m) => m.code === 'core');
    expect(cc?.licenseStatus).toBe('locked');
    expect(core?.licenseStatus).toBe('active');
  });

  it('maps active|trial → active and inactive → disabled', async () => {
    hubFindAll.mockResolvedValue([
      mockHub({ code: 'callcenter', kind: 'market' }),
      mockHub({ code: 'analytics', kind: 'market' }),
    ]);
    tenantFindAll.mockResolvedValue([
      { module_code: 'callcenter', status: 'active' },
      { module_code: 'analytics', status: 'inactive' },
    ] as TenantModule[]);

    const catalog = await service.getHubCatalogForTenant(7);
    expect(catalog.find((m) => m.code === 'callcenter')?.licenseStatus).toBe('active');
    expect(catalog.find((m) => m.code === 'analytics')?.licenseStatus).toBe('disabled');
  });

  it('BOX mode: base active; requires_cloud market → locked', async () => {
    configGet.mockReturnValue('BOX');
    hubFindAll.mockResolvedValue([
      mockHub({ code: 'apps', kind: 'base' }),
      mockHub({ code: 'ai', kind: 'market', requires_cloud: true }),
      mockHub({ code: 'callcenter', kind: 'market', requires_cloud: false }),
    ]);
    tenantFindAll.mockResolvedValue([]);

    const catalog = await service.getHubCatalogForTenant(1);
    expect(catalog.find((m) => m.code === 'apps')?.licenseStatus).toBe('active');
    expect(catalog.find((m) => m.code === 'ai')?.licenseStatus).toBe('locked');
    expect(catalog.find((m) => m.code === 'callcenter')?.licenseStatus).toBe('active');
  });

  it('never accepts client licenseStatus — field is computed server-side', async () => {
    hubFindAll.mockResolvedValue([mockHub({ code: 'callcenter', kind: 'market' })]);
    tenantFindAll.mockResolvedValue([]);
    const catalog = await service.getHubCatalogForTenant(1);
    expect(catalog[0]).toHaveProperty('licenseStatus');
    expect(Object.keys(catalog[0])).not.toContain('clientLicenseStatus');
  });
});

describe('ModulesRegistryService AI product access (AI-01)', () => {
  function buildAccessService(mode: string, decision = { allowed: false, reason: 'product_disabled' }) {
    const decide = jest.fn().mockResolvedValue(decision);
    return new ModulesRegistryService(
      {} as any,
      {} as any,
      { findOne: jest.fn().mockResolvedValue({ id: 9, status: 'active' }) } as any,
      { get: jest.fn().mockReturnValue(mode) } as unknown as ConfigService,
      {} as any,
      {} as any,
      { decide } as any,
    );
  }

  it('delegates access to the persisted product access service', async () => {
    const service = buildAccessService('CLOUD', { allowed: false, reason: 'product_disabled' });
    await expect(service.resolveAiProductAccess(42, 'speech_analytics')).resolves.toMatchObject({
      reason: 'product_disabled', allowed: false,
    });
    await expect(service.tenantHasAiProduct(42, 'ai_voice_robots')).resolves.toBe(false);
  });

  it('does not use the generic BOX allow for a rejected license', async () => {
    const service = buildAccessService('BOX');
    await expect(service.tenantHasAiProduct(42, 'speech_analytics')).resolves.toBe(false);
  });

  it('reports commercial packages missing in OpenSource mode', async () => {
    const service = buildAccessService('OPENSOURCE', { allowed: false, reason: 'package_missing' });
    await expect(service.resolveAiProductAccess(42, 'ai_voice_robots')).resolves.toMatchObject({
      allowed: false, reason: 'package_missing',
    });
  });

  it('passes the server-resolved tenant and code to product access', async () => {
    const decide = jest.fn().mockResolvedValue({ allowed: false });
    const service = new ModulesRegistryService(
      {} as any, {} as any, {} as any,
      { get: jest.fn().mockReturnValue('CLOUD') } as unknown as ConfigService,
      {} as any, {} as any, { decide } as any,
    );
    await service.resolveAiProductAccess(42, 'speech_analytics');
    expect(decide).toHaveBeenCalledWith(42, 'speech_analytics');
  });

  it('routes generic checks for new products through the fail-closed policy', async () => {
    const service = buildAccessService('BOX');
    await expect(service.tenantHasModule(42, 'ai_voice_robots')).resolves.toBe(false);
    await expect(service.tenantHasModule(42, 'voice_robot')).resolves.toBe(true);
  });

  it('rejects unknown product codes instead of consulting a legacy fallback', async () => {
    const service = buildAccessService('CLOUD');
    await expect(service.resolveAiProductAccess(42, 'unknown' as any)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'UNKNOWN_AI_PRODUCT' }),
    });
  });
});

describe('ModulesRegistryService A1 catalog and offers', () => {
  it('inserts AI drafts unpublished and leaves operator publication unchanged on reseed', async () => {
    const rows = new Map<string, any>();
    const registry = {
      findOrCreate: jest.fn(async ({ where, defaults }: any) => {
        const existing = rows.get(where.code);
        if (existing) return [existing, false];
        const row = { ...defaults, update: jest.fn(async (patch) => Object.assign(row, patch)) };
        rows.set(where.code, row);
        return [row, true];
      }),
    };
    const service = new ModulesRegistryService(
      registry as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any,
    );
    await service.onApplicationBootstrap();
    expect(rows.get('ai_voice_robots').is_published).toBe(false);
    expect(rows.get('speech_analytics').is_published).toBe(false);
    rows.get('voice_robot').is_published = false;
    rows.get('ai_voice_robots').is_published = true;
    await service.onApplicationBootstrap();
    expect(rows.get('voice_robot').is_published).toBe(false);
    expect(rows.get('ai_voice_robots').is_published).toBe(true);
  });

  it('rejects direct purchases of unpublished or unreleased AI offers', async () => {
    const registry = { findOne: jest.fn().mockResolvedValue({
      code: 'ai_voice_robots', name: 'AI robots', is_core: false,
      is_paid: true, is_published: false, price_monthly: 0,
    }) };
    const service = new ModulesRegistryService(
      registry as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any,
    );
    await expect(service.resolvePurchaseOffer('ai_voice_robots')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'OFFER_NOT_RELEASED' }),
    });
    registry.findOne.mockResolvedValue({
      code: 'ai_voice_robots', name: 'AI robots', is_core: false,
      is_paid: true, is_published: true, price_monthly: 0,
    });
    await expect(service.resolvePurchaseOffer('ai_voice_robots')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'OFFER_NOT_RELEASED' }),
    });
  });

  it('never creates an AI grant from a tenant Hub toggle', async () => {
    const upsert = jest.fn();
    const service = new ModulesRegistryService(
      {} as any, { upsert } as any, {} as any, {} as any, {} as any, {} as any, {} as any,
    );
    await expect(service.setTenantHubModuleStatus(9, 'speech_analytics', 'active'))
      .rejects.toMatchObject({
        response: expect.objectContaining({ code: 'product_configuration_pending' }),
      });
    expect(upsert).not.toHaveBeenCalled();
  });

  it('makes draft-publication correction an explicit, narrowly scoped maintenance call', async () => {
    const update = jest.fn().mockResolvedValue([2]);
    const service = new ModulesRegistryService(
      { update } as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any,
    );
    await expect(service.unpublishUnreleasedAiDrafts()).resolves.toBe(2);
    expect(update).toHaveBeenCalledWith(
      { is_published: false },
      { where: { code: ['ai_voice_robots', 'speech_analytics'] } },
    );
  });
});
