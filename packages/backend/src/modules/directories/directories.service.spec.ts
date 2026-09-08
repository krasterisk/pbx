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

    it('picks the more specific Asterisk pattern after an exact miss', async () => {
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
        values: ['pattern-high', 'P20'],
      });
    });

    it('picks the narrower CallerID range without a stored priority', async () => {
      const created = await service.create(
        createDto({
          name: 'CallerNames',
          key_normalization: 'digits',
          records: [
            { values: { number: '79001234568', name: 'Иван' } },
            { values: { number: '_7900123XXXX', name: 'Билайн' } },
            { values: { number: '_7900XXXXXXX', name: 'Ростелеком' } },
          ],
        }),
        100,
      );

      const nameUid = created.fields!.find((field) => field.key === 'name')!.uid;
      await expect(
        service.lookup({
          directoryUid: created.uid,
          userUid: 100,
          key: '+79001234567',
          fieldUids: [nameUid],
        }),
      ).resolves.toEqual({
        status: 'FOUND',
        matchKind: 'asterisk_pattern',
        values: ['Билайн'],
      });
    });

    it('finds an exact 7-number when the incoming key is written with a leading 8', async () => {
      const created = await service.create(
        createDto({
          name: 'RuTrunk',
          key_normalization: 'ru_8_to_7',
          records: [{ values: { number: '+7 (900) 123-45-67', name: 'Alice' } }],
        }),
        100,
      );
      const nameUid = created.fields!.find((field) => field.key === 'name')!.uid;

      await expect(
        service.lookup({
          directoryUid: created.uid,
          userUid: 100,
          key: '8-900-123-45-67',
          fieldUids: [nameUid],
        }),
      ).resolves.toEqual({
        status: 'FOUND',
        matchKind: 'exact',
        values: ['Alice'],
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

    it('reindexes exact keys when switching digits to none so lookup still finds the record', async () => {
      const created = await service.create(
        createDto({
          name: 'DigitsToNone',
          key_normalization: 'digits',
          records: [
            { match_kind: 'exact', priority: 1, values: { number: '+1-23', name: 'A' } },
            { match_kind: 'asterisk_pattern', priority: 10, values: { number: '_1XX' } },
          ],
        }),
        100,
      );
      const numberUid = created.fields!.find((f) => f.key === 'number')!.uid;

      await service.update(created.uid, { key_normalization: 'none' }, 100);

      await expect(
        service.lookup({
          directoryUid: created.uid,
          userUid: 100,
          key: '+1-23',
          fieldUids: [numberUid],
        }),
      ).resolves.toEqual({ status: 'FOUND', matchKind: 'exact', values: ['+1-23'] });

      const exact = store.records.find(
        (r) => r.directory_uid === created.uid && r.match_kind === 'exact',
      );
      const pattern = store.records.find(
        (r) => r.directory_uid === created.uid && r.match_kind === 'asterisk_pattern',
      );
      expect(exact!.normalized_lookup_value).toBe('+1-23');
      expect(pattern).toMatchObject({ lookup_value: '_1XX', normalized_lookup_value: '_1XX' });
    });

    it('reindexes exact keys when switching none to digits so lookup still finds the record', async () => {
      const created = await service.create(
        createDto({
          name: 'NoneToDigits',
          key_normalization: 'none',
          records: [
            { match_kind: 'exact', priority: 1, values: { number: '+1-23', name: 'A' } },
            { match_kind: 'asterisk_pattern', priority: 10, values: { number: '_1XX' } },
          ],
        }),
        100,
      );
      const numberUid = created.fields!.find((f) => f.key === 'number')!.uid;

      await service.update(created.uid, { key_normalization: 'digits' }, 100);

      await expect(
        service.lookup({
          directoryUid: created.uid,
          userUid: 100,
          key: '+1-23',
          fieldUids: [numberUid],
        }),
      ).resolves.toEqual({ status: 'FOUND', matchKind: 'exact', values: ['+1-23'] });

      const exact = store.records.find(
        (r) => r.directory_uid === created.uid && r.match_kind === 'exact',
      );
      const pattern = store.records.find(
        (r) => r.directory_uid === created.uid && r.match_kind === 'asterisk_pattern',
      );
      expect(exact!.normalized_lookup_value).toBe('123');
      expect(pattern).toMatchObject({ lookup_value: '_1XX', normalized_lookup_value: '_1XX' });
    });

    it('rejects a normalization change that would collide exact keys', async () => {
      const created = await service.create(
        createDto({
          name: 'NormClash',
          key_normalization: 'none',
          records: [
            { match_kind: 'exact', priority: 1, values: { number: '+1-23', name: 'A' } },
            { match_kind: 'exact', priority: 1, values: { number: '123', name: 'B' } },
          ],
        }),
        100,
      );

      await expect(
        service.update(created.uid, { key_normalization: 'digits' }, 100),
      ).rejects.toBeInstanceOf(ConflictException);
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
    function csvErrors(err: unknown): Array<{ row: number; column?: string; code: string }> {
      expect(err).toBeInstanceOf(BadRequestException);
      const body = (err as BadRequestException).getResponse() as {
        errors?: Array<{ row: number; column?: string; code: string }>;
      };
      return body.errors ?? [];
    }

    async function importErrors(uid: number, csv: string) {
      try {
        await service.importCsv(uid, csv, 100);
      } catch (err) {
        return csvErrors(err);
      }
      throw new Error('import was expected to fail');
    }

    it('rejects unknown and duplicate headers', async () => {
      await expect(
        service.importCsv(7, 'number,name,unknown,match_kind,priority\n1,A,x,exact,1\n', 100),
      ).rejects.toBeInstanceOf(BadRequestException);

      await expect(
        service.importCsv(7, 'number,number,comment,match_kind,priority\n1,2,,exact,1\n', 100),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('reports unknown, duplicate and missing columns with codes', async () => {
      expect(
        await importErrors(7, 'number,unknown,match_kind,priority\n1,x,exact,1\n'),
      ).toContainEqual(expect.objectContaining({ row: 1, column: 'unknown', code: 'unknown_column' }));

      expect(
        await importErrors(7, 'number,number,match_kind,priority\n1,2,exact,1\n'),
      ).toContainEqual(expect.objectContaining({ column: 'number', code: 'duplicate_column' }));

      expect(await importErrors(7, 'name,match_kind,priority\nA,exact,1\n')).toContainEqual(
        expect.objectContaining({ column: 'number', code: 'missing_column' }),
      );
    });

    it('replaces every existing record and bumps the revision once', async () => {
      const before = store.records.filter((r) => r.directory_uid === 7).length;
      expect(before).toBe(3);

      await expect(
        service.importCsv(7, 'number;name;match_kind;priority\n555;Alice;exact;1\n', 100),
      ).resolves.toEqual({ imported: 1, replaced: 3, errors: [] });

      const after = store.records.filter((r) => r.directory_uid === 7);
      expect(after).toHaveLength(1);
      expect(after[0].lookup_value).toBe('555');
      expect(store.directories.find((d) => d.uid === 7)?.revision).toBe(1);
    });

    it('leaves records and revision untouched when a row is invalid', async () => {
      const errors = await importErrors(
        7,
        'number;name\n555;Alice\n;Bob\n',
      );
      expect(errors).toContainEqual(
        expect.objectContaining({ row: 3, column: 'number', code: 'required_empty' }),
      );
      expect(store.records.filter((r) => r.directory_uid === 7)).toHaveLength(3);
      expect(store.directories.find((d) => d.uid === 7)?.revision).toBe(0);
    });

    it('ignores legacy match_kind and priority columns including invalid values', async () => {
      await expect(
        service.importCsv(7, 'number;name;match_kind;priority\n555;Alice;exact;0\n', 100),
      ).resolves.toEqual({ imported: 1, replaced: 3, errors: [] });

      const after = store.records.filter((r) => r.directory_uid === 7);
      expect(after).toHaveLength(1);
      expect(after[0]).toMatchObject({
        lookup_value: '555',
        match_kind: 'exact',
        priority: 1,
      });
    });

    it('keeps leading zeros, a leading plus, dates and long numeric strings as text', async () => {
      const created = await service.create(createDto({ name: 'TextDir' }), 100);
      await service.importCsv(
        created.uid,
        [
          'number;name;match_kind;priority',
          '0712345;2024-01-15;exact;1',
          '+79001234567;12345678901234567890;exact;1',
        ].join('\n'),
        100,
      );

      const loaded = await service.findOne(created.uid, 100);
      expect(loaded.records?.map((record) => record.values)).toEqual([
        expect.objectContaining({ number: '0712345', name: '2024-01-15' }),
        expect.objectContaining({ number: '+79001234567', name: '12345678901234567890' }),
      ]);
    });

    it('accepts a UTF-8 BOM and both delimiters', async () => {
      const created = await service.create(createDto({ name: 'BomDir' }), 100);
      await service.importCsv(
        created.uid,
        '\ufeffnumber;name;match_kind;priority\r\n555;Alice;exact;1\r\n',
        100,
      );
      await expect(service.findOne(created.uid, 100)).resolves.toMatchObject({
        records: [expect.objectContaining({ lookup_value: '555' })],
      });

      await service.importCsv(
        created.uid,
        'number,name,match_kind,priority\n556,Bob,exact,1\n',
        100,
      );
      await expect(service.findOne(created.uid, 100)).resolves.toMatchObject({
        records: [expect.objectContaining({ lookup_value: '556' })],
      });
    });

    it('keeps quoted newlines and reports the physical file line', async () => {
      const created = await service.create(createDto({ name: 'MultilineDir' }), 100);
      await service.importCsv(
        created.uid,
        'number;name;match_kind;priority\n555;"first\nsecond";exact;1\n',
        100,
      );
      const loaded = await service.findOne(created.uid, 100);
      expect(loaded.records?.[0].values).toEqual(
        expect.objectContaining({ name: 'first\nsecond' }),
      );

      const errors = await importErrors(
        created.uid,
        'number;name\n555;"first\nsecond"\n;Bob\n',
      );
      expect(errors).toContainEqual(
        expect.objectContaining({ row: 4, column: 'number', code: 'required_empty' }),
      );
    });

    it('rejects an empty cell in a required column instead of coercing it', async () => {
      const errors = await importErrors(7, 'number;name;match_kind;priority\n;Alice;exact;1\n');
      expect(errors).toEqual([
        expect.objectContaining({ row: 2, column: 'number', code: 'required_empty' }),
      ]);
    });

    it('rejects a non-numeric cell in a number column', async () => {
      const created = await service.create(
        createDto({
          name: 'NumberDir',
          fields: [
            { key: 'number', label: 'Number', type: 'phone', required: true, position: 0 },
            { key: 'weight', label: 'Weight', type: 'number', required: false, position: 1 },
          ],
        }),
        100,
      );
      const errors = await importErrors(
        created.uid,
        'number;weight;match_kind;priority\n555;heavy;exact;1\n',
      );
      expect(errors).toEqual([
        expect.objectContaining({ row: 2, column: 'weight', code: 'invalid_number' }),
      ]);
    });

    it('reports duplicate lookup values by row', async () => {
      const created = await service.create(createDto({ name: 'DupeDir' }), 100);
      const errors = await importErrors(
        created.uid,
        'number;name;match_kind;priority\n555;Alice;exact;1\n555;Bob;exact;1\n',
      );
      expect(errors).toEqual([
        expect.objectContaining({ row: 3, column: 'number', code: 'duplicate_key' }),
      ]);
    });

    it('rejects two identical Asterisk patterns on import', async () => {
      const created = await service.create(createDto({ name: 'DupePatternCsv' }), 100);
      const errors = await importErrors(
        created.uid,
        'number;name\n_7900XXXXXXX;A\n_7900XXXXXXX;B\n',
      );
      expect(errors).toEqual([
        expect.objectContaining({ row: 3, column: 'number', code: 'duplicate_key' }),
      ]);
    });

    it('exports with a BOM, a semicolon delimiter and a deterministic order', async () => {
      const created = await service.create(createDto({ name: 'ExportDir' }), 100);
      await service.importCsv(
        created.uid,
        [
          'number;name;match_kind;priority',
          '777;Carol;exact;2',
          '555;Alice;exact;1',
        ].join('\n'),
        100,
      );

      const exported = await service.exportCsv(created.uid, 100);
      expect(exported.charCodeAt(0)).toBe(0xfeff);
      expect(exported.slice(1).split('\r\n')).toEqual([
        'number;name;comment',
        '555;Alice;',
        '777;Carol;',
        '',
      ]);
    });

    it('survives an export then import round trip', async () => {
      const source = await service.create(createDto({ name: 'RoundSource' }), 100);
      await service.importCsv(
        source.uid,
        [
          'number;name;comment;match_kind;priority',
          '0712345;"Alice; Bob";"note\nline";exact;1',
          '+79001234567;Carol;;exact;2',
        ].join('\n'),
        100,
      );
      const exported = await service.exportCsv(source.uid, 100);

      const target = await service.create(createDto({ name: 'RoundTarget' }), 100);
      await service.importCsv(target.uid, exported, 100);

      const sourceLoaded = await service.findOne(source.uid, 100);
      const targetLoaded = await service.findOne(target.uid, 100);
      const strip = (directory: typeof sourceLoaded) =>
        (directory.records ?? [])
          .map((record) => ({
            lookup_value: record.lookup_value,
            match_kind: record.match_kind,
            priority: record.priority,
            comment: record.comment,
            values: record.values,
          }))
          .sort((a, b) => a.lookup_value.localeCompare(b.lookup_value));

      expect(strip(targetLoaded)).toEqual(strip(sourceLoaded));
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
      expect(exported.split('\n')[0]).not.toMatch(/match_kind/);
      expect(exported.split('\n')[0]).not.toMatch(/priority/);
    });
  });
});
