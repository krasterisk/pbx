import { AiChatSettingsService } from './ai-chat-settings.service';

/**
 * Unit tests for AiChatSettingsService (D-20, D-25).
 *
 * Verifies default-OFF behavior for tenants with no settings row, upsert
 * semantics on update, and per-tenant isolation (settings never leak
 * across vpbx_user_uid).
 */
describe('AiChatSettingsService', () => {
  let model: any;
  let service: AiChatSettingsService;

  beforeEach(() => {
    model = { findOne: jest.fn(), findOrCreate: jest.fn() };
    service = new AiChatSettingsService(model);
  });

  describe('getSettings', () => {
    it('returns confirmDestructive=false (default OFF) when no row exists for the tenant', async () => {
      model.findOne.mockResolvedValue(null);

      const result = await service.getSettings(100);

      expect(model.findOne).toHaveBeenCalledWith({ where: { user_uid: 100 } });
      expect(result).toEqual({ confirmDestructive: false });
    });

    it('returns confirmDestructive=true when the tenant row has confirm_destructive=1', async () => {
      model.findOne.mockResolvedValue({ confirm_destructive: 1 });

      const result = await service.getSettings(100);

      expect(result).toEqual({ confirmDestructive: true });
    });

    it('settings for one tenant do not affect another tenant (isolation)', async () => {
      model.findOne.mockImplementation(({ where }: any) =>
        where.user_uid === 100 ? Promise.resolve({ confirm_destructive: 1 }) : Promise.resolve(null),
      );

      const tenantA = await service.getSettings(100);
      const tenantB = await service.getSettings(200);

      expect(tenantA).toEqual({ confirmDestructive: true });
      expect(tenantB).toEqual({ confirmDestructive: false });
    });
  });

  describe('updateSettings', () => {
    it('creates a row for a tenant with no prior settings and applies the update', async () => {
      const row = { confirm_destructive: 0, update: jest.fn() };
      row.update.mockImplementation(async (patch: any) => { row.confirm_destructive = patch.confirm_destructive; });
      model.findOrCreate.mockResolvedValue([row, true]);

      const result = await service.updateSettings(100, { confirmDestructive: true });

      expect(model.findOrCreate).toHaveBeenCalledWith({
        where: { user_uid: 100 },
        defaults: { user_uid: 100, confirm_destructive: 0 },
      });
      expect(row.update).toHaveBeenCalledWith({ confirm_destructive: 1 });
      expect(result).toEqual({ confirmDestructive: true });
    });

    it('updates an existing row without touching other tenants', async () => {
      const row = { confirm_destructive: 1, update: jest.fn() };
      row.update.mockImplementation(async (patch: any) => { row.confirm_destructive = patch.confirm_destructive; });
      model.findOrCreate.mockResolvedValue([row, false]);

      const result = await service.updateSettings(100, { confirmDestructive: false });

      expect(row.update).toHaveBeenCalledWith({ confirm_destructive: 0 });
      expect(result).toEqual({ confirmDestructive: false });
    });
  });
});
