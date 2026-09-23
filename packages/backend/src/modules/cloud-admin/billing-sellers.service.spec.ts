import { BillingSellersService } from './billing-sellers.service';
import { BillingSeller } from './billing-seller.model';
import { Tenant } from './tenant.model';

describe('BillingSellersService', () => {
  const sellers: any[] = [];
  let nextId = 1;

  const sellerModel = {
    findAll: jest.fn(async () => [...sellers].sort((a, b) => Number(b.isDefault) - Number(a.isDefault))),
    findByPk: jest.fn(async (id: number) => sellers.find((s) => s.id === id) ?? null),
    findOne: jest.fn(async ({ where }: any) => {
      if (where?.isDefault) return sellers.find((s) => s.isDefault) ?? null;
      return null;
    }),
    count: jest.fn(async () => sellers.length),
    create: jest.fn(async (data: any) => {
      const row = {
        id: nextId++,
        ...data,
        update: jest.fn(async (patch: any) => Object.assign(row, patch)),
        destroy: jest.fn(async () => {
          const idx = sellers.findIndex((s) => s.id === row.id);
          if (idx >= 0) sellers.splice(idx, 1);
        }),
      };
      sellers.push(row);
      return row;
    }),
    update: jest.fn(async (patch: any, opts: any) => {
      for (const s of sellers) {
        if (opts?.where?.isDefault && s.isDefault) Object.assign(s, patch);
      }
    }),
  };

  const tenants: Array<{ id: number; seller_id: number }> = [];
  const tenantModel = {
    update: jest.fn(async (patch: any, opts: any) => {
      for (const t of tenants) {
        if (opts?.where?.seller_id === t.seller_id) t.seller_id = patch.seller_id;
      }
    }),
  };

  const sequelize = {
    transaction: async (fn: (t: unknown) => Promise<unknown>) => fn({}),
  };

  const service = new BillingSellersService(
    sellerModel as any,
    tenantModel as any,
    sequelize as any,
  );

  beforeEach(() => {
    sellers.length = 0;
    tenants.length = 0;
    nextId = 1;
    jest.clearAllMocks();
  });

  it('creates the first seller as default', async () => {
    const row = await service.create({ name: 'Acme' });
    expect(row.isDefault).toBe(true);
  });

  it('refuses to delete the default seller', async () => {
    await service.create({ name: 'Default' });
    await expect(service.remove(1)).rejects.toThrow(/default seller/i);
  });

  it('reassigns tenants when deleting a non-default seller', async () => {
    await service.create({ name: 'Default' });
    await service.create({ name: 'Other', isDefault: false });
    tenants.push({ id: 10, seller_id: 2 });
    await service.remove(2);
    expect(tenants[0].seller_id).toBe(1);
    expect(sellers.map((s) => s.id)).toEqual([1]);
  });

  it('setDefault clears the previous default', async () => {
    await service.create({ name: 'A' });
    await service.create({ name: 'B', isDefault: false });
    await service.setDefault(2);
    expect(sellers.find((s) => s.id === 1)?.isDefault).toBe(false);
    expect(sellers.find((s) => s.id === 2)?.isDefault).toBe(true);
  });
});
