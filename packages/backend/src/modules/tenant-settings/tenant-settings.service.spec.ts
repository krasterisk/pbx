import { BadRequestException } from '@nestjs/common';
import { TenantSettingsService } from './tenant-settings.service';

type Row = {
  id: number;
  vpbxUserUid: number;
  key: string;
  value: string | null;
  category: string;
};

function createInMemoryModel() {
  const rows: Row[] = [];
  let nextId = 1;

  const matches = (row: Row, where: Partial<Row> = {}) => {
    if (where.vpbxUserUid !== undefined && row.vpbxUserUid !== where.vpbxUserUid) return false;
    if (where.key !== undefined && row.key !== where.key) return false;
    return true;
  };

  return {
    rows,
    findAll: jest.fn(async ({ where }: { where?: Partial<Row> } = {}) => rows.filter((r) => matches(r, where))),
    findOne: jest.fn(async ({ where }: { where: Partial<Row> }) => rows.find((r) => matches(r, where)) ?? null),
    count: jest.fn(async ({ where }: { where?: Partial<Row> } = {}) => rows.filter((r) => matches(r, where)).length),
    create: jest.fn(async (data: Omit<Row, 'id'>) => {
      const row: Row = { id: nextId++, ...data };
      rows.push(row);
      return row;
    }),
    upsert: jest.fn(async (data: Omit<Row, 'id'> & { id?: number }) => {
      const existing = rows.find((r) => r.vpbxUserUid === data.vpbxUserUid && r.key === data.key);
      if (existing) {
        existing.value = data.value;
        if (data.category !== undefined) existing.category = data.category;
        return [existing, false];
      }
      const row: Row = { id: nextId++, ...data };
      rows.push(row);
      return [row, true];
    }),
  };
}

describe('TenantSettingsService (D-19, D-17)', () => {
  let model: ReturnType<typeof createInMemoryModel>;
  let service: TenantSettingsService;

  beforeEach(() => {
    model = createInMemoryModel();
    service = new TenantSettingsService(model as any);
  });

  describe('getAll', () => {
    it('returns D-17 defaults true for a tenant with no rows', async () => {
      const result = await service.getAll(42);

      expect(result['routes.show_raw_dialplan']).toBe(true);
      expect(result['routes.show_flowchart']).toBe(true);
    });

    it('does not see another tenant rows even with the same key', async () => {
      await service.setMany(43, { 'routes.show_flowchart': false });

      expect(await service.getAll(42)).toEqual(
        expect.objectContaining({ 'routes.show_flowchart': true }),
      );
      expect((await service.getAll(42))['routes.show_flowchart']).toBe(true);
    });
  });

  describe('setMany', () => {
    it('rejects an unknown key with BadRequestException naming the key', async () => {
      await expect(service.setMany(42, { 'routes.unknown_key': true })).rejects.toThrow(BadRequestException);
      await expect(service.setMany(42, { 'routes.unknown_key': true })).rejects.toThrow(/routes\.unknown_key/);
    });

    it('rejects a value whose type does not match the descriptor', async () => {
      await expect(service.setMany(42, { 'routes.show_raw_dialplan': 'yes' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('upserts a boolean flag and getAll reflects the stored value', async () => {
      await service.setMany(42, { 'routes.show_raw_dialplan': false });

      const result = await service.getAll(42);
      expect(result['routes.show_raw_dialplan']).toBe(false);
      expect(result['routes.show_flowchart']).toBe(true);
    });

    it('updates the same row on a second setMany (count stays 1)', async () => {
      await service.setMany(42, { 'routes.show_raw_dialplan': true });
      await service.setMany(42, { 'routes.show_raw_dialplan': false });

      expect(await model.count({ where: { vpbxUserUid: 42, key: 'routes.show_raw_dialplan' } })).toBe(1);
      expect((await service.getAll(42))['routes.show_raw_dialplan']).toBe(false);
    });

    it('does not leak tenant 43 writes into tenant 42 defaults', async () => {
      await service.setMany(43, { 'routes.show_flowchart': false });

      expect((await service.getAll(42))['routes.show_flowchart']).toBe(true);
    });
  });
});
