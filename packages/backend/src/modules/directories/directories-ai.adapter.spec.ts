import { DirectoriesAiAdapter } from './directories-ai.adapter';

/**
 * Unit tests for DirectoriesAiAdapter — Domain AI Adapter for directories.
 * Plain instantiation (no Nest TestingModule), matching callcenter-ai.adapter.spec.ts.
 */
describe('DirectoriesAiAdapter', () => {
  let directoriesService: any;
  let registry: any;
  let adapter: DirectoriesAiAdapter;

  const TOOL_NAMES = [
    'list_directories',
    'create_directory',
    'update_directory',
    'delete_directory',
    'list_directory_records',
    'add_directory_records',
    'remove_directory_records',
  ];

  const getTool = (name: string) => adapter.getTools().find((t) => t.name === name)!;

  beforeEach(() => {
    directoriesService = {
      findAll: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    registry = { register: jest.fn() };
    adapter = new DirectoriesAiAdapter(directoriesService, registry);
  });

  describe('getTools', () => {
    it('exposes the seven directory tools in order', () => {
      expect(adapter.getTools().map((t) => t.name)).toEqual(TOOL_NAMES);
      expect(new Set(TOOL_NAMES).size).toBe(7);
    });

    it('marks delete_directory and remove_directory_records as destructive', () => {
      expect(getTool('delete_directory').destructive).toBe(true);
      expect(getTool('remove_directory_records').destructive).toBe(true);
    });

    it('does not mark read-only or additive tools as destructive', () => {
      expect(getTool('list_directories').destructive).toBeFalsy();
      expect(getTool('create_directory').destructive).toBeFalsy();
      expect(getTool('update_directory').destructive).toBeFalsy();
      expect(getTool('list_directory_records').destructive).toBeFalsy();
      expect(getTool('add_directory_records').destructive).toBeFalsy();
    });

    it('sets entityType to directory on every tool', () => {
      for (const name of TOOL_NAMES) {
        expect(getTool(name).entityType).toBe('directory');
      }
    });
  });

  describe('onModuleInit', () => {
    it('registers itself with AiAdapterRegistryService', () => {
      adapter.onModuleInit();
      expect(registry.register).toHaveBeenCalledWith(adapter);
    });
  });

  describe('tenant isolation via vpbxUserUid parameter', () => {
    it('list_directories passes the call-time uid, not a closure', async () => {
      await getTool('list_directories').handler({}, 111);
      await getTool('list_directories').handler({}, 222);
      expect(directoriesService.findAll).toHaveBeenNthCalledWith(1, 111);
      expect(directoriesService.findAll).toHaveBeenNthCalledWith(2, 222);
    });

    it('create_directory passes the call-time uid for two tenants in a row', async () => {
      directoriesService.create.mockResolvedValue({ uid: 1, name: 'A', records: [] });
      await getTool('create_directory').handler({ name: 'A', lookupFieldKey: 'internal_number' }, 111);
      await getTool('create_directory').handler({ name: 'B', lookupFieldKey: 'internal_number' }, 222);
      expect(directoriesService.create).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ name: 'A' }),
        111,
      );
      expect(directoriesService.create).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ name: 'B' }),
        222,
      );
    });
  });

  describe('record tools', () => {
    it('list_directory_records returns records from findOne', async () => {
      directoriesService.findOne.mockResolvedValue({
        uid: 5,
        name: 'VIP',
        records: [{ uid: 9, values: { internal_number: '100' } }],
      });
      const result = await getTool('list_directory_records').handler({ uid: 5 }, 42);
      expect(directoriesService.findOne).toHaveBeenCalledWith(5, 42);
      expect(result).toEqual(expect.objectContaining({
        records: [{ uid: 9, values: { internal_number: '100' } }],
      }));
    });

    it('add_directory_records appends records through update', async () => {
      directoriesService.findOne.mockResolvedValue({
        uid: 5,
        name: 'VIP',
        description: '',
        lookup_field_uid: 1,
        key_normalization: 'digits',
        fields: [{ key: 'internal_number', uid: 1 }],
        records: [{ match_kind: 'exact', priority: 1, values: { internal_number: '100' } }],
      });
      directoriesService.update.mockResolvedValue({ uid: 5, records: [] });

      await getTool('add_directory_records').handler(
        {
          uid: 5,
          records: [{ match_kind: 'exact', priority: 2, values: { internal_number: '200' } }],
        },
        42,
      );

      expect(directoriesService.update).toHaveBeenCalledWith(
        5,
        expect.objectContaining({
          records: [
            expect.objectContaining({ values: { internal_number: '100' } }),
            expect.objectContaining({ values: { internal_number: '200' } }),
          ],
        }),
        42,
      );
    });

    it('remove_directory_records drops matching lookup values through update', async () => {
      directoriesService.findOne.mockResolvedValue({
        uid: 5,
        name: 'VIP',
        description: '',
        lookup_field_uid: 1,
        key_normalization: 'digits',
        fields: [{ key: 'internal_number', uid: 1 }],
        records: [
          { uid: 9, lookup_value: '100', values: { internal_number: '100' } },
          { uid: 10, lookup_value: '200', values: { internal_number: '200' } },
        ],
      });
      directoriesService.update.mockResolvedValue({ uid: 5, records: [] });

      await getTool('remove_directory_records').handler(
        { uid: 5, lookup_values: ['100'] },
        42,
      );

      expect(directoriesService.update).toHaveBeenCalledWith(
        5,
        expect.objectContaining({
          records: [expect.objectContaining({ values: { internal_number: '200' } })],
        }),
        42,
      );
    });
  });

  describe('getKnowledgeBlock', () => {
    it('explains explicit key sources, exact-before-pattern, field UIDs, and ERROR fail-open', () => {
      const kb = adapter.getKnowledgeBlock();
      expect(kb).toMatch(/key.?source|источник ключа/i);
      expect(kb).toMatch(/exact/i);
      expect(kb).toMatch(/pattern|паттерн/i);
      expect(kb).toMatch(/field.?uid|UID поля/i);
      expect(kb).toMatch(/ERROR/);
      expect(kb).toMatch(/fail-open|исходн/i);
    });
  });
});
