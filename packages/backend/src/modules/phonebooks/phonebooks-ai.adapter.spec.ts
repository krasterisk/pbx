import { PhonebooksAiAdapter } from './phonebooks-ai.adapter';

/**
 * Unit tests for PhonebooksAiAdapter (D-11, D-12, D-15, D-16) — the reference
 * implementation of the Domain AI Adapter contract (D-14).
 *
 * Plain-instantiation style (no NestJS TestingModule) — matches
 * mcp-tools.service.spec.ts / phonebooks.controller.spec.ts in this repo.
 */
describe('PhonebooksAiAdapter', () => {
  let phonebooksService: any;
  let routesService: any;
  let routeApplyService: any;
  let dialplanApplyService: any;
  let registry: any;
  let bindingModel: any;
  let adapter: PhonebooksAiAdapter;

  const getTool = (name: string) => adapter.getTools().find((t) => t.name === name)!;

  beforeEach(() => {
    phonebooksService = {
      findAll: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      collectAllVarKeys: jest.fn().mockReturnValue([]),
    };
    routesService = {
      findOne: jest.fn(),
      update: jest.fn(),
    };
    routeApplyService = {
      applyContext: jest.fn().mockResolvedValue(undefined),
      applyContextsForPhonebook: jest.fn().mockResolvedValue(undefined),
      getAffectedContexts: jest.fn().mockResolvedValue({ contextUids: [], bindingUids: [] }),
    };
    dialplanApplyService = { deleteCategories: jest.fn().mockResolvedValue(undefined) };
    registry = { register: jest.fn() };
    bindingModel = { findAll: jest.fn().mockResolvedValue([]) };

    adapter = new PhonebooksAiAdapter(
      phonebooksService,
      routesService,
      routeApplyService,
      dialplanApplyService,
      registry,
      bindingModel,
    );
  });

  describe('getTools (D-11)', () => {
    it('returns exactly 8 tools with the expected names', () => {
      const names = adapter.getTools().map((t) => t.name);
      expect(names.sort()).toEqual([
        'add_phonebook_entries',
        'create_phonebook',
        'delete_phonebook',
        'list_phonebook_entries',
        'list_phonebooks',
        'remove_phonebook_entries',
        'update_phonebook',
        'update_route',
      ].sort());
    });

    it('marks delete_phonebook, remove_phonebook_entries and update_route as destructive (D-20)', () => {
      expect(getTool('delete_phonebook').destructive).toBe(true);
      expect(getTool('remove_phonebook_entries').destructive).toBe(true);
      expect(getTool('update_route').destructive).toBe(true);
    });

    it('does not mark read-only / additive tools as destructive', () => {
      expect(getTool('list_phonebooks').destructive).toBeFalsy();
      expect(getTool('create_phonebook').destructive).toBeFalsy();
      expect(getTool('update_phonebook').destructive).toBeFalsy();
      expect(getTool('add_phonebook_entries').destructive).toBeFalsy();
      expect(getTool('list_phonebook_entries').destructive).toBeFalsy();
    });

    it('entityType is "phonebook" for phonebook tools and "route" for update_route', () => {
      expect(getTool('list_phonebooks').entityType).toBe('phonebook');
      expect(getTool('delete_phonebook').entityType).toBe('phonebook');
      expect(getTool('update_route').entityType).toBe('route');
    });
  });

  describe('onModuleInit', () => {
    it('registers itself with the AiAdapterRegistryService', () => {
      adapter.onModuleInit();
      expect(registry.register).toHaveBeenCalledWith(adapter);
    });
  });

  describe('confirmation gate for update_route (D-20, D-25, Test 1b)', () => {
    // Mirrors McpToolsService.callTool's gate — verifies the destructive flag on
    // update_route interacts correctly with a confirmation-gate consumer without
    // re-testing McpToolsService's gate itself (covered generically in mcp-tools.service.spec.ts).
    async function dispatchWithGate(toolName: string, args: any, uid: number, confirmDestructive: boolean) {
      const tool = getTool(toolName);
      if (tool.destructive && args?.confirm !== true && confirmDestructive) {
        return { blocked: true };
      }
      return { blocked: false, result: await tool.handler(args, uid) };
    }

    beforeEach(() => {
      routesService.findOne.mockResolvedValue({ uid: 7, context_uid: 1 });
      routesService.update.mockResolvedValue({ uid: 7, name: 'R1', context_uid: 1, bindings: [] });
    });

    it('blocks update_route without confirm=true when tenant confirmations are enabled', async () => {
      const outcome = await dispatchWithGate('update_route', { uid: 7, name: 'R1' }, 100, true);
      expect(outcome.blocked).toBe(true);
      expect(routesService.update).not.toHaveBeenCalled();
    });

    it('executes update_route with confirm=true when tenant confirmations are enabled', async () => {
      const outcome = await dispatchWithGate('update_route', { uid: 7, name: 'R1', confirm: true }, 100, true);
      expect(outcome.blocked).toBe(false);
      expect(routesService.update).toHaveBeenCalled();
    });

    it('executes update_route immediately without confirm when confirmations are disabled (default OFF)', async () => {
      const outcome = await dispatchWithGate('update_route', { uid: 7, name: 'R1' }, 100, false);
      expect(outcome.blocked).toBe(false);
      expect(routesService.update).toHaveBeenCalled();
    });
  });

  describe('tenant isolation — uid is a call parameter, never closed over (Test 2)', () => {
    it('list_phonebooks calls phonebooksService.findAll with the uid passed at call time, for two tenants in a row', async () => {
      await getTool('list_phonebooks').handler({}, 111);
      await getTool('list_phonebooks').handler({}, 222);

      expect(phonebooksService.findAll).toHaveBeenNthCalledWith(1, 111);
      expect(phonebooksService.findAll).toHaveBeenNthCalledWith(2, 222);
    });

    it('create_phonebook calls phonebooksService.create with the uid passed at call time, for two tenants in a row', async () => {
      phonebooksService.create.mockResolvedValue({ uid: 1, name: 'A', entries: [] });
      await getTool('create_phonebook').handler({ name: 'A' }, 111);
      await getTool('create_phonebook').handler({ name: 'B' }, 222);

      expect(phonebooksService.create).toHaveBeenNthCalledWith(1, expect.objectContaining({ name: 'A' }), 111);
      expect(phonebooksService.create).toHaveBeenNthCalledWith(2, expect.objectContaining({ name: 'B' }), 222);
    });
  });

  describe('update_route with bindings (Test 3, D-12, D-17)', () => {
    it('passes bindings through to routesService.update and calls RouteApplyService.applyContext', async () => {
      routesService.findOne.mockResolvedValue({ uid: 7, context_uid: 1 });
      routesService.update.mockResolvedValue({ uid: 7, name: 'R1', context_uid: 1, bindings: [{ uid: 1 }] });

      const bindings = [{ phonebook_uid: 5, position: 0, match_mode: 'on_match', behavior_type: 'blacklist' }];
      const result = await getTool('update_route').handler({ uid: 7, bindings }, 100);

      expect(routesService.update).toHaveBeenCalledWith(7, expect.objectContaining({ bindings }), 100);
      expect(routeApplyService.applyContext).toHaveBeenCalledWith(1, 100, false);
      expect((result as any).bindingsCount).toBe(1);
    });

    it('re-applies the old context too when the route moves to a different context', async () => {
      routesService.findOne.mockResolvedValue({ uid: 7, context_uid: 1 });
      routesService.update.mockResolvedValue({ uid: 7, name: 'R1', context_uid: 2, bindings: [] });

      await getTool('update_route').handler({ uid: 7, context_uid: 2 }, 100);

      expect(routeApplyService.applyContext).toHaveBeenCalledWith(2, 100, false);
      expect(routeApplyService.applyContext).toHaveBeenCalledWith(1, 100, false);
    });
  });

  describe('buildSummary (Test 4, D-16, Pitfall 10)', () => {
    it('returns a compact block with name, description, entries count, and bindings — no full entries', async () => {
      phonebooksService.findAll.mockResolvedValue([
        {
          uid: 5,
          name: 'VIP',
          description: 'VIP клиенты',
          entries: [{ number: '1' }, { number: '2' }],
        },
      ]);
      bindingModel.findAll.mockResolvedValue([
        { route_uid: 9, behavior_type: 'set_name', match_mode: 'on_match', route: { name: 'Входящие' } },
      ]);

      const summary = await adapter.getStateProvider!().buildSummary(100);

      expect(summary).toContain('VIP');
      expect(summary).toContain('VIP клиенты');
      expect(summary).toContain('2');
      expect(summary).toContain('Входящие');
      expect(summary).toContain('set_name');
      expect(summary).not.toContain('"number": "1"');
    });

    it('returns an empty string when the tenant has no phonebooks', async () => {
      phonebooksService.findAll.mockResolvedValue([]);
      const summary = await adapter.getStateProvider!().buildSummary(100);
      expect(summary).toBe('');
    });
  });

  describe('add_phonebook_entries (Test 5)', () => {
    it('adds entries incrementally (does not replace existing entries)', async () => {
      phonebooksService.findOne.mockResolvedValue({
        name: 'A', description: '', entries: [{ number: '1', comment: '', vars: null }],
      });
      phonebooksService.update.mockResolvedValue({
        entries: [{ number: '1', vars: null }, { number: '2', vars: null }],
      });

      await getTool('add_phonebook_entries').handler({ uid: 5, entries: [{ number: '2' }] }, 100);

      const updateCall = phonebooksService.update.mock.calls[0];
      expect(updateCall[0]).toBe(5);
      expect(updateCall[1].entries).toEqual([
        { number: '1', comment: '', vars: undefined },
        { number: '2' },
      ]);
    });

    it('triggers re-apply when the new entries introduce a new var key', async () => {
      phonebooksService.findOne.mockResolvedValue({ name: 'A', description: '', entries: [] });
      phonebooksService.collectAllVarKeys.mockReturnValueOnce([]).mockReturnValueOnce(['clid']);
      phonebooksService.update.mockResolvedValue({ entries: [{ number: '2', vars: { clid: 'x' } }] });

      await getTool('add_phonebook_entries').handler({ uid: 5, entries: [{ number: '2', vars: { clid: 'x' } }] }, 100);

      expect(routeApplyService.applyContextsForPhonebook).toHaveBeenCalledWith(5, 100, false);
    });

    it('does not trigger re-apply when the var-key set is unchanged', async () => {
      phonebooksService.findOne.mockResolvedValue({ name: 'A', description: '', entries: [] });
      phonebooksService.collectAllVarKeys.mockReturnValue([]);
      phonebooksService.update.mockResolvedValue({ entries: [{ number: '2', vars: null }] });

      await getTool('add_phonebook_entries').handler({ uid: 5, entries: [{ number: '2' }] }, 100);

      expect(routeApplyService.applyContextsForPhonebook).not.toHaveBeenCalled();
    });
  });

  describe('delete_phonebook (destructive)', () => {
    it('collects affected contexts before destroy, re-applies them, and cleans up orphaned binding categories', async () => {
      routeApplyService.getAffectedContexts.mockResolvedValue({ contextUids: [1, 2], bindingUids: [42] });

      await getTool('delete_phonebook').handler({ uid: 5 }, 100);

      expect(routeApplyService.getAffectedContexts).toHaveBeenCalledWith(5, 100);
      expect(phonebooksService.remove).toHaveBeenCalledWith(5, 100);
      expect(routeApplyService.applyContext).toHaveBeenCalledTimes(2);
      expect(dialplanApplyService.deleteCategories).toHaveBeenCalledWith(
        'krasterisk/phonebooks/pb_100.conf',
        ['pb_bind_42_100'],
        { reload: true },
      );
    });
  });

  describe('remove_phonebook_entries (destructive)', () => {
    it('removes only the specified numbers, keeping the rest', async () => {
      phonebooksService.findOne.mockResolvedValue({
        name: 'A', description: '', entries: [
          { number: '1', comment: '', vars: null },
          { number: '2', comment: '', vars: null },
        ],
      });
      phonebooksService.update.mockResolvedValue({ entries: [{ number: '2', vars: null }] });

      const result = await getTool('remove_phonebook_entries').handler({ uid: 5, numbers: ['1'] }, 100);

      const updateCall = phonebooksService.update.mock.calls[0];
      expect(updateCall[1].entries).toEqual([{ number: '2', comment: '', vars: undefined }]);
      expect(result).toContain('1');
    });
  });

  describe('list_phonebook_entries (on-demand, D-16)', () => {
    it('applies search filter and limit', async () => {
      phonebooksService.findOne.mockResolvedValue({
        entries: [
          { number: '79001234567', comment: 'Ivanov', vars: null },
          { number: '79007654321', comment: 'Petrov', vars: null },
        ],
      });

      const result: any = await getTool('list_phonebook_entries').handler({ uid: 5, search: 'Ivanov' }, 100);

      expect(result.total).toBe(1);
      expect(result.entries[0].number).toBe('79001234567');
    });

    it('caps limit at 200', async () => {
      const entries = Array.from({ length: 250 }, (_, i) => ({ number: String(i), comment: '', vars: null }));
      phonebooksService.findOne.mockResolvedValue({ entries });

      const result: any = await getTool('list_phonebook_entries').handler({ uid: 5, limit: 1000 }, 100);

      expect(result.entries).toHaveLength(200);
    });
  });

  describe('getKnowledgeBlock (D-16)', () => {
    it('returns a compact block (10-15 lines) describing the data+binding model', () => {
      const block = adapter.getKnowledgeBlock!();
      const lines = block.split('\n').filter((l) => l.trim().length > 0);
      expect(lines.length).toBeGreaterThanOrEqual(8);
      expect(lines.length).toBeLessThanOrEqual(20);
      expect(block).toContain('match_mode');
      expect(block).toContain('behavior_type');
    });
  });
});
