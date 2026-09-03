import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Op } from 'sequelize';
import { RouteTemplatesService } from './route-templates.service';
import { BUILTIN_ROUTE_TEMPLATES } from './builtin-route-templates';
import { builtInSeedStatements, ROUTE_TEMPLATE_SCHEMA_STATEMENTS } from './setup-route-templates-schema';

type Row = Record<string, any>;

function matchWhere(row: Row, where?: Row): boolean {
  if (!where) return true;
  const orClauses = where[Op.or as unknown as string] ?? where[Op.or];
  const rest = { ...where };
  delete rest[Op.or as unknown as string];
  delete rest[Op.or];
  const keysMatch = Object.entries(rest).every(([key, value]) => {
    if (value === null) return row[key] == null;
    return row[key] === value;
  });
  if (!orClauses) return keysMatch;
  const orMatch = (orClauses as Row[]).some((clause) => matchWhere(row, clause));
  return keysMatch && orMatch;
}

function createStore() {
  const templates: Row[] = [];
  const seq = { n: 1 };

  function wrap(row: Row) {
    const instance: Row = {
      get(key: string) {
        return instance[key] ?? row[key];
      },
      toJSON() {
        return { ...row };
      },
      async update(patch: Row) {
        Object.assign(row, patch);
        Object.assign(instance, row);
        return instance;
      },
      async destroy() {
        const idx = templates.findIndex((item) => item.uid === row.uid);
        if (idx >= 0) templates.splice(idx, 1);
      },
    };
    Object.assign(instance, row);
    return instance;
  }

  const templateModel = {
    async findOne(opts: { where?: Row } = {}) {
      const row = templates.find((item) => matchWhere(item, opts.where));
      return row ? wrap(row) : null;
    },
    async findAll(opts: { where?: Row } = {}) {
      return templates.filter((item) => matchWhere(item, opts.where)).map(wrap);
    },
    async create(data: Row) {
      const now = new Date('2026-09-04T00:00:00.000Z');
      const row = {
        ...data,
        uid: data.uid ?? seq.n++,
        created_at: now,
        updated_at: now,
      };
      templates.push(row);
      return wrap(row);
    },
  };

  function seedBuiltins() {
    for (const seed of BUILTIN_ROUTE_TEMPLATES) {
      templates.push({
        uid: seq.n++,
        name: seed.name,
        description: seed.description,
        actions: seed.actions,
        slots: seed.slots,
        vpbx_user_uid: null,
        created_at: new Date('2026-01-01T00:00:00.000Z'),
        updated_at: new Date('2026-01-01T00:00:00.000Z'),
      });
    }
  }

  return { templateModel, templates, seedBuiltins };
}

describe('BUILTIN_ROUTE_TEMPLATES', () => {
  it('seeds exactly three built-ins with typed slots', () => {
    expect(BUILTIN_ROUTE_TEMPLATES).toHaveLength(3);
    expect(BUILTIN_ROUTE_TEMPLATES.map((item) => item.key)).toEqual([
      'queue_failover',
      'ivr_handoff',
      'business_hours',
    ]);
    expect(BUILTIN_ROUTE_TEMPLATES[0].slots).toEqual([
      expect.objectContaining({ kind: 'queue' }),
    ]);
    expect(BUILTIN_ROUTE_TEMPLATES[1].slots.map((slot) => slot.kind)).toEqual([
      'recording',
      'ivr',
    ]);
    expect(BUILTIN_ROUTE_TEMPLATES[2].actions.some((action) => action.type === 'schedule')).toBe(
      true,
    );
    expect(BUILTIN_ROUTE_TEMPLATES[2].slots).toEqual([
      expect.objectContaining({ kind: 'recording' }),
    ]);
  });

  it('emits idempotent INSERT statements for the three built-ins', () => {
    expect(ROUTE_TEMPLATE_SCHEMA_STATEMENTS[0]).toContain('CREATE TABLE IF NOT EXISTS `route_templates`');
    const seeds = builtInSeedStatements();
    expect(seeds).toHaveLength(3);
    expect(seeds.every((sql) => sql.includes('vpbx_user_uid') && sql.includes('WHERE NOT EXISTS'))).toBe(
      true,
    );
  });
});

describe('RouteTemplatesService', () => {
  let service: RouteTemplatesService;
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
    store.seedBuiltins();
    service = new RouteTemplatesService(store.templateModel as any);
  });

  it('lists built-ins plus the calling tenant rows only', async () => {
    await service.create(
      {
        name: 'Mine',
        description: '',
        actions: [{ id: 'a1', type: 'hangup', params: {}, condition: {} }],
        slots: [],
      },
      100,
    );
    store.templates.push({
      uid: 99,
      name: 'Other tenant',
      description: '',
      actions: [],
      slots: [],
      vpbx_user_uid: 200,
    });

    const listed = await service.findAll(100);
    expect(listed).toHaveLength(4);
    expect(listed.map((row) => row.name)).toEqual(
      expect.arrayContaining(['Queue + failover', 'IVR handoff', 'Business hours', 'Mine']),
    );
    expect(listed.every((row) => row.vpbx_user_uid === null || row.vpbx_user_uid === 100)).toBe(
      true,
    );
  });

  it('creates, reads, updates, and deletes a tenant template', async () => {
    const created = await service.create(
      {
        name: 'Sales overflow',
        description: 'Tenant copy',
        actions: [{ id: 'step-1', type: 'hangup', params: { signal: 'busy' }, condition: {} }],
        slots: [{ id: 'queue', kind: 'queue', label: 'Queue' }],
        vpbx_user_uid: 999,
      } as any,
      100,
    );

    expect(created.vpbx_user_uid).toBe(100);
    expect(created.uid).toBeGreaterThan(0);

    const loaded = await service.findOne(created.uid, 100);
    expect(loaded.name).toBe('Sales overflow');
    expect(loaded.slots).toEqual([{ id: 'queue', kind: 'queue', label: 'Queue' }]);

    const updated = await service.update(
      created.uid,
      { name: 'Sales overflow v2', description: 'Renamed' },
      100,
    );
    expect(updated.name).toBe('Sales overflow v2');
    expect(updated.description).toBe('Renamed');

    await service.remove(created.uid, 100);
    await expect(service.findOne(created.uid, 100)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects mutations of built-in rows', async () => {
    const builtin = (await service.findAll(100)).find((row) => row.vpbx_user_uid == null)!;
    await expect(service.update(builtin.uid, { name: 'Hacked' }, 100)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.remove(builtin.uid, 100)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('does not reveal another tenant template', async () => {
    store.templates.push({
      uid: 77,
      name: 'Secret',
      description: '',
      actions: [],
      slots: [],
      vpbx_user_uid: 200,
    });
    await expect(service.findOne(77, 100)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.update(77, { name: 'Nope' }, 100)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remove(77, 100)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects unknown slot kinds and duplicate slot ids', async () => {
    await expect(
      service.create(
        {
          name: 'Bad kind',
          actions: [{ id: 'a', type: 'hangup', params: {}, condition: {} }],
          slots: [{ id: 'x', kind: 'robot' as any, label: 'X' }],
        },
        100,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.create(
        {
          name: 'Dup slots',
          actions: [{ id: 'a', type: 'hangup', params: {}, condition: {} }],
          slots: [
            { id: 'q', kind: 'queue', label: 'A' },
            { id: 'q', kind: 'ivr', label: 'B' },
          ],
        },
        100,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
