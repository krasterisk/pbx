import { AiAgentsController } from './ai-agents.controller';

describe('AiAgentsController AI inventory and provider projection', () => {
  const admin = { user: { level: 1, vpbx_user_uid: 0 } } as any;

  it('binds inventory and migration report to the JWT tenant, including zero', async () => {
    const inventory = {
      listPageForTenant: jest.fn().mockResolvedValue({ items: [], nextCursor: null }),
      reportLegacyForTenant: jest.fn().mockResolvedValue({ scanned: 0 }),
    };
    const controller = new AiAgentsController({} as any, {} as any, {} as any, inventory as any);
    await controller.listInventory('20', '0', admin);
    await controller.migrationReport('100', admin);
    expect(inventory.listPageForTenant).toHaveBeenCalledWith(0, 20, 0);
    expect(inventory.reportLegacyForTenant).toHaveBeenCalledWith(0, 100);
    expect(() => controller.listInventory('101x', undefined, admin)).toThrow();
  });

  it('never returns encrypted provider keys through list, create or update', async () => {
    const secretRow = { uid: 7, user_uid: 0, encrypted_api_key: 'ciphertext', name: 'P',
      endpoint: 'https://user:password@provider.example/v1?api_key=hidden-url-key',
      defaults: { model: 'gpt-4o', apiKey: 'hidden-default-key' },
      pricing: { inputTokenUsd: 1, apiSecret: 'hidden-price-secret' },
      internal_note: 'hidden-internal-note' };
    const providers = {
      findAll: jest.fn().mockResolvedValue([secretRow]),
      create: jest.fn().mockResolvedValue(secretRow),
      update: jest.fn().mockResolvedValue({ get: () => secretRow }),
    };
    const controller = new AiAgentsController({} as any, providers as any, {} as any, {} as any);
    const list = await controller.listProviders(admin);
    const created = await controller.createProvider({} as any, admin);
    const updated = await controller.updateProvider(7, {} as any, admin);
    for (const row of [...list, created, updated]) {
      expect(row).toMatchObject({ uid: 7, has_key: true });
      expect(row).not.toHaveProperty('encrypted_api_key');
      expect(JSON.stringify(row)).not.toContain('ciphertext');
      expect(JSON.stringify(row)).not.toMatch(/hidden-default-key|hidden-price-secret|hidden-internal-note|hidden-url-key|password/);
      expect(row).toMatchObject({ secretConfigured: true,
        authSummary: { secretConfigured: true } });
    }
  });
});
