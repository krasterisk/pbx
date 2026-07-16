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
      { get: configGet } as unknown as ConfigService,
      { findAll: hubFindAll, findOne: jest.fn(), create: jest.fn(), upsert: jest.fn() } as any,
      { findAll: jest.fn(), destroy: jest.fn(), bulkCreate: jest.fn() } as any,
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
