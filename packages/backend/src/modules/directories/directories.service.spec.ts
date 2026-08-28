import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { DirectoriesService } from './directories.service';
import type { CreateDirectoryDto, UpdateDirectoryDto } from './dto/directory.dto';

type Row = Record<string, any>;

function createStore() {
  const directories: Row[] = [];
  const fields: Row[] = [];
  const records: Row[] = [];
  const bindings: Row[] = [];
  const routes: Row[] = [];
  function matchWhere(row: Row, where?: Row): boolean {
    if (!where) return true;
    return Object.entries(where).every(([k, v]) => row[k] === v);
  }

  function applyOrder(rows: Row[], order?: Array<[string, string]>): Row[] {
    if (!order?.length) return rows;
    return [...rows].sort((a, b) => {
      for (const [col, dir] of order) {
        if (a[col] < b[col]) return dir === 'ASC' ? -1 : 1;
        if (a[col] > b[col]) return dir === 'ASC' ? 1 : -1;
      }
      return 0;
    });
  }

  function wrap(row: Row, table: Row[], include?: Array<{ as?: string }>): Row {
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
        const idx = table.findIndex((r) => r.uid === row.uid);
        if (idx >= 0) table.splice(idx, 1);
        if (table === directories) {
          for (let i = fields.length - 1; i >= 0; i--) {
            if (fields[i].directory_uid === row.uid) fields.splice(i, 1);
          }
          for (let i = records.length - 1; i >= 0; i--) {
            if (records[i].directory_uid === row.uid) records.splice(i, 1);
          }
        }
      },
    };
    Object.assign(instance, row);
    if (include) {
      for (const inc of include) {
        if (inc.as === 'fields') {
          instance.fields = fields
            .filter((f) => f.directory_uid === row.uid)
            .map((f) => wrap(f, fields));
        }
        if (inc.as === 'records') {
          instance.records = records
            .filter((r) => r.directory_uid === row.uid)
            .map((r) => wrap(r, records));
        }
      }
    }
    return instance;
  }

  function makeModel(table: Row[], seq: { n: number }) {
    return {
      async findOne(opts: { where?: Row; include?: Array<{ as?: string }> } = {}) {
        const row = table.find((r) => matchWhere(r, opts.where));
        if (!row) return null;
        return wrap(row, table, opts.include);
      },
      async findAll(opts: { where?: Row; include?: Array<{ as?: string }>; order?: Array<[string, string]> } = {}) {
        const matched = applyOrder(
          table.filter((r) => matchWhere(r, opts.where)),
          opts.order,
        );
        return matched.map((r) => wrap(r, table, opts.include));
      },
      async create(data: Row) {
        const row = { ...data, uid: data.uid ?? seq.n++ };
        table.push(row);
        return wrap(row, table);
      },
      async bulkCreate(items: Row[]) {
        return Promise.all(items.map((item) => this.create(item)));
      },
      async destroy(opts: { where?: Row } = {}) {
        let deleted = 0;
        for (let i = table.length - 1; i >= 0; i--) {
          if (matchWhere(table[i], opts.where)) {
            table.splice(i, 1);
            deleted++;
          }
        }
        return deleted;
      },
    };
  }

  const dirSeqRef = { n: 1 };
  const fieldSeqRef = { n: 1 };
  const recSeqRef = { n: 1 };
  const bindSeqRef = { n: 1 };
  const routeSeqRef = { n: 1 };

  const directoryModel = makeModel(directories, dirSeqRef);
  const fieldModel = makeModel(fields, fieldSeqRef);
  const recordModel = makeModel(records, recSeqRef);
  const bindingModel = makeModel(bindings, bindSeqRef);
  const routeModel = makeModel(routes, routeSeqRef);

  const sequelize = {
    async transaction<T>(fn: (t: unknown) => Promise<T>): Promise<T> {
      return fn({});
    },
  };

  function seedLookupFixture() {
    dirSeqRef.n = 9;
    fieldSeqRef.n = 20;
    recSeqRef.n = 10;
    bindSeqRef.n = 10;
    routeSeqRef.n = 10;
    directories.push({
      uid: 7,
      user_uid: 100,
      name: 'VIP',
      description: '',
      lookup_field_uid: 17,
      key_normalization: 'digits',
      revision: 0,
    });
    fields.push(
      { uid: 17, directory_uid: 7, key: 'number', label: 'Number', type: 'phone', required: true, position: 0 },
      { uid: 18, directory_uid: 7, key: 'name', label: 'Name', type: 'string', required: false, position: 1 },
    );
    records.push(
      {
        uid: 1,
        directory_uid: 7,
        lookup_value: '123',
        normalized_lookup_value: '123',
        match_kind: 'exact',
        priority: 1,
        values: { '18': 'Alice', '17': '700' },
        comment: '',
      },
      {
        uid: 2,
        directory_uid: 7,
        lookup_value: '_1XX',
        normalized_lookup_value: '_1XX',
        match_kind: 'asterisk_pattern',
        priority: 20,
        values: { '17': 'pattern-high', '18': 'P20' },
        comment: '',
      },
      {
        uid: 3,
        directory_uid: 7,
        lookup_value: '_XXX',
        normalized_lookup_value: '_XXX',
        match_kind: 'asterisk_pattern',
        priority: 10,
        values: { '17': 'pattern-low', '18': 'P10' },
        comment: '',
      },
    );
    directories.push({
      uid: 8,
      user_uid: 200,
      name: 'Foreign',
      description: '',
      lookup_field_uid: 19,
      key_normalization: 'none',
      revision: 0,
    });
    fields.push(
      { uid: 19, directory_uid: 8, key: 'number', label: 'Number', type: 'phone', required: true, position: 0 },
    );
    records.push({
      uid: 4,
      directory_uid: 8,
      lookup_value: '123',
      normalized_lookup_value: '123',
      match_kind: 'exact',
      priority: 1,
      values: { '19': 'SECRET' },
      comment: '',
    });
    routes.push({
      uid: 5,
      user_uid: 100,
      actions: [
        {
          id: 'a1',
          type: 'directory_lookup',
          params: {
            directoryUid: 7,
            keySource: { source: 'original_caller' },
            outputs: [{ fieldUid: 17, targetVariable: 'CID_NUM' }],
            onMissing: 'keep',
          },
          condition: {},
        },
      ],
    });
    bindings.push({
      uid: 3,
      route_uid: 5,
      directory_uid: 7,
      user_uid: 100,
      behavior_type: 'set_number',
      behavior_params: { fieldUid: 17 },
      actions: null,
    });
  }

  return {
    directories,
    fields,
    records,
    bindings,
    routes,
    directoryModel,
    fieldModel,
    recordModel,
    bindingModel,
    routeModel,
    sequelize,
    seedLookupFixture,
  };
}

function createService(store: ReturnType<typeof createStore>): DirectoriesService {
  return new DirectoriesService(
    store.directoryModel as never,
    store.fieldModel as never,
    store.recordModel as never,
    store.bindingModel as never,
    store.routeModel as never,
    store.sequelize as never,
  );
}

const baseFields: CreateDirectoryDto['fields'] = [
  { key: 'number', label: 'Number', type: 'phone', required: true, position: 0 },
  { key: 'name', label: 'Name', type: 'string', required: false, position: 1 },
];

function createDto(overrides: Partial<CreateDirectoryDto> = {}): CreateDirectoryDto {
  return {
    name: 'Staff',
    lookupFieldKey: 'number',
    key_normalization: 'digits',
    fields: baseFields,
    ...overrides,
  };
}

describe('DirectoriesService', () => {
  let store: ReturnType<typeof createStore>;
  let service: DirectoriesService;

  beforeEach(() => {
    store = createStore();
    store.seedLookupFixture();
    service = createService(store);
  });

  describe('lookup', () => {
    it('returns exact match values in the requested fieldUid order', async () => {
      await expect(
        service.lookup({
          directoryUid: 7,
          userUid: 100,
          key: '123',
          fieldUids: [17, 18],
        }),
      ).resolves.toEqual({
        status: 'FOUND',
        matchKind: 'exact',
        values: ['700', 'Alice'],
      });
    });

    it('follows request fieldUid order, not persisted JSON key order', async () => {
      await expect(
        service.lookup({
          directoryUid: 7,
          userUid: 100,
          key: '123',
          fieldUids: [18, 17],
        }),
      ).resolves.toEqual({
        status: 'FOUND',
        matchKind: 'exact',
        values: ['Alice', '700'],
      });
    });

    it('lets exact match win over matching patterns', async () => {
      const result = await service.lookup({
        directoryUid: 7,
        userUid: 100,
        key: '123',
        fieldUids: [17],
      });
      expect(result).toEqual({ status: 'FOUND', matchKind: 'exact', values: ['700'] });
    });

    it('picks the lowest pattern priority after an exact miss', async () => {
      await expect(
        service.lookup({
          directoryUid: 7,
          userUid: 100,
          key: '155',
          fieldUids: [17, 18],
        }),
      ).resolves.toEqual({
        status: 'FOUND',
        matchKind: 'asterisk_pattern',
        values: ['pattern-low', 'P10'],
      });
    });

    it('returns NOT_FOUND for a foreign-tenant directory without revealing it exists', async () => {
      await expect(
        service.lookup({
          directoryUid: 7,
          userUid: 200,
          key: '123',
          fieldUids: [17],
        }),
      ).resolves.toEqual({ status: 'NOT_FOUND', values: [] });

      await expect(
        service.lookup({
          directoryUid: 8,
          userUid: 100,
          key: '123',
          fieldUids: [19],
        }),
      ).resolves.toEqual({ status: 'NOT_FOUND', values: [] });
    });

    it('rejects a field UID that does not belong to the directory', async () => {
      await expect(
        service.lookup({
          directoryUid: 7,
          userUid: 100,
          key: '123',
          fieldUids: [19],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('still resolves a saved field UID after directory and field labels are renamed', async () => {
      await service.update(
        7,
        {
          name: 'VIP Renamed',
          fields: [
            { key: 'number', label: 'Caller ID', type: 'phone', required: true, position: 0 },
            { key: 'name', label: 'Display', type: 'string', required: false, position: 1 },
          ],
          lookupFieldKey: 'number',
        },
        100,
      );

      const one = await service.findOne(7, 100);
      expect(one.name).toBe('VIP Renamed');
      const numberField = one.fields!.find((f) => f.uid === 17);
      expect(numberField).toMatchObject({ uid: 17, key: 'number', label: 'Caller ID' });

      await expect(
        service.lookup({
          directoryUid: 7,
          userUid: 100,
          key: '123',
          fieldUids: [17],
        }),
      ).resolves.toEqual({ status: 'FOUND', matchKind: 'exact', values: ['700'] });
    });
  });

  describe('create / update validation', () => {
    it('rejects a duplicate directory name for the same tenant', async () => {
      await expect(service.create(createDto({ name: 'VIP' }), 100)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('allows the same directory name for another tenant', async () => {
      const created = await service.create(createDto({ name: 'VIP' }), 300);
      expect(created.user_uid).toBe(300);
      expect(created.name).toBe('VIP');
    });

    it('never persists user_uid from the DTO', async () => {
      const created = await service.create(
        { ...createDto({ name: 'Owned' }), user_uid: 999 } as CreateDirectoryDto & { user_uid: number },
        100,
      );
      expect(created.user_uid).toBe(100);
      expect(store.directories.find((d) => d.name === 'Owned')?.user_uid).toBe(100);
    });

    it('rejects an unknown lookupFieldKey', async () => {
      await expect(
        service.create(createDto({ name: 'BadLookup', lookupFieldKey: 'missing' }), 100),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects duplicate exact normalized keys', async () => {
      await expect(
        service.create(
          createDto({
            name: 'DupExact',
            records: [
              { match_kind: 'exact', priority: 1, values: { number: '123', name: 'A' } },
              { match_kind: 'exact', priority: 1, values: { number: '+1-23', name: 'B' } },
            ],
          }),
          100,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects duplicate pattern text', async () => {
      await expect(
        service.create(
          createDto({
            name: 'DupPattern',
            records: [
              { match_kind: 'asterisk_pattern', priority: 10, values: { number: '_1XX' } },
              { match_kind: 'asterisk_pattern', priority: 20, values: { number: '_1XX' } },
            ],
          }),
          100,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects pattern records when the lookup field is not phone', async () => {
      await expect(
        service.create(
          createDto({
            name: 'NoPattern',
            key_normalization: 'none',
            fields: [
              { key: 'code', label: 'Code', type: 'string', required: true, position: 0 },
            ],
            lookupFieldKey: 'code',
            records: [{ match_kind: 'asterisk_pattern', priority: 1, values: { code: '_1XX' } }],
          }),
          100,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects record values that do not match field types', async () => {
      await expect(
        service.create(
          createDto({
            name: 'BadType',
            fields: [
              { key: 'number', label: 'Number', type: 'phone', required: true, position: 0 },
              { key: 'active', label: 'Active', type: 'boolean', required: true, position: 1 },
            ],
            records: [
              { match_kind: 'exact', priority: 1, values: { number: '100', active: 'yes' } },
            ],
          }),
          100,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('maps management values by field key and persists decimal field UIDs', async () => {
      const created = await service.create(
        createDto({
          name: 'Mapped',
          records: [{ match_kind: 'exact', priority: 1, values: { number: '555', name: 'Pat' } }],
        }),
        100,
      );
      expect(created.lookup_field_uid).toBe(created.fields!.find((f) => f.key === 'number')!.uid);
      expect(created.records![0].values).toEqual({ number: '555', name: 'Pat' });

      const persisted = store.records.find((r) => r.directory_uid === created.uid);
      const numberUid = String(created.fields!.find((f) => f.key === 'number')!.uid);
      const nameUid = String(created.fields!.find((f) => f.key === 'name')!.uid);
      expect(persisted!.values).toEqual({ [numberUid]: '555', [nameUid]: 'Pat' });
    });

    it('keeps field keys immutable while allowing label rename', async () => {
      const created = await service.create(createDto({ name: 'Immutable' }), 100);
      const numberUid = created.fields!.find((f) => f.key === 'number')!.uid;

      const updated = await service.update(
        created.uid,
        {
          fields: [
            { key: 'number', label: 'MSISDN', type: 'phone', required: true, position: 0 },
            { key: 'name', label: 'Name', type: 'string', required: false, position: 1 },
          ],
        },
        100,
      );
      expect(updated.fields!.find((f) => f.uid === numberUid)).toMatchObject({
        key: 'number',
        label: 'MSISDN',
      });
    });
  });

  describe('references and deletion', () => {
    it('returns structured references for a directory and a field', async () => {
      const refs = await service.findReferences(7, undefined, 100);
      expect(refs.length).toBeGreaterThanOrEqual(2);
      expect(refs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            routeUid: 5,
            actionOrBindingId: expect.any(String),
            location: expect.any(String),
          }),
        ]),
      );
      expect(refs.every((r) => typeof r.location === 'string' && r.location.length > 0)).toBe(true);

      const fieldRefs = await service.findReferences(7, 17, 100);
      expect(fieldRefs.length).toBeGreaterThanOrEqual(1);
      expect(fieldRefs.every((r) => r.routeUid === 5)).toBe(true);
    });

    it('blocks removal of a referenced directory and includes reference locations', async () => {
      try {
        await service.remove(7, 100);
        throw new Error('expected remove to reject');
      } catch (err) {
        expect(err).toBeInstanceOf(ConflictException);
        const body = (err as ConflictException).getResponse() as {
          references?: Array<{ routeUid: unknown; actionOrBindingId: unknown; location: unknown }>;
        };
        expect(body.references?.length).toBeGreaterThan(0);
        expect(body.references![0]).toEqual(
          expect.objectContaining({
            routeUid: expect.anything(),
            actionOrBindingId: expect.any(String),
            location: expect.any(String),
          }),
        );
      }
    });

    it('blocks removal of a referenced field', async () => {
      await expect(
        service.update(
          7,
          {
            fields: [{ key: 'name', label: 'Name', type: 'string', required: false, position: 0 }],
            lookupFieldKey: 'name',
          } as UpdateDirectoryDto,
          100,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('findOne is tenant-scoped', async () => {
      await expect(service.findOne(7, 200)).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.findOne(7, 100)).resolves.toMatchObject({ uid: 7, name: 'VIP' });
    });
  });

  describe('csv', () => {
    it('rejects unknown and duplicate headers', async () => {
      await expect(
        service.importCsv(7, 'number,name,unknown,match_kind,priority\n1,A,x,exact,1\n', 100),
      ).rejects.toBeInstanceOf(BadRequestException);

      await expect(
        service.importCsv(7, 'number,number,comment,match_kind,priority\n1,2,,exact,1\n', 100),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('preserves quoted delimiters on import and export', async () => {
      const created = await service.create(createDto({ name: 'CsvDir' }), 100);
      const csv = [
        'number,name,comment,match_kind,priority',
        '555,"Alice, Bob","note, x",exact,1',
      ].join('\n');

      await service.importCsv(created.uid, csv, 100);
      const loaded = await service.findOne(created.uid, 100);
      expect(loaded.records).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            match_kind: 'exact',
            values: expect.objectContaining({ number: '555', name: 'Alice, Bob' }),
            comment: 'note, x',
          }),
        ]),
      );

      const exported = await service.exportCsv(created.uid, 100);
      expect(exported).toMatch(/Alice,\s*Bob/);
      expect(exported.split('\n')[0]).toMatch(/number/);
      expect(exported.split('\n')[0]).toMatch(/match_kind/);
      expect(exported.split('\n')[0]).toMatch(/priority/);
    });
  });
});
