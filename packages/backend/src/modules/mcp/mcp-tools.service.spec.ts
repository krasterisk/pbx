import { McpToolsService } from './mcp-tools.service';

/**
 * Unit tests for McpToolsService (D-23 cross-tenant fix, D-19 audit, D-14 registry integration).
 *
 * Plain-instantiation style (no NestJS TestingModule) — matches
 * route-apply.service.spec.ts / phonebooks.controller.spec.ts in this repo.
 */
describe('McpToolsService', () => {
  let endpointsService: any;
  let trunksService: any;
  let ivrsService: any;
  let queuesService: any;
  let routesService: any;
  let contextIncludesService: any;
  let contextsService: any;
  let dialplanApplyService: any;
  let contextBuilder: any;
  let contextModel: any;
  let cdrService: any;
  let aiAdapterRegistry: any;
  let aiChatSettingsService: any;
  let loggerService: any;
  let service: McpToolsService;

  beforeEach(() => {
    endpointsService = { findAll: jest.fn().mockResolvedValue([]), create: jest.fn(), remove: jest.fn(), bulkCreate: jest.fn() };
    trunksService = { findAll: jest.fn().mockResolvedValue([]), create: jest.fn().mockResolvedValue({}), remove: jest.fn() };
    ivrsService = { findAll: jest.fn().mockResolvedValue([]), create: jest.fn(), update: jest.fn(), remove: jest.fn() };
    queuesService = { findAll: jest.fn().mockResolvedValue([]), create: jest.fn(), update: jest.fn(), remove: jest.fn() };
    routesService = { create: jest.fn(), remove: jest.fn(), generateContextDialplan: jest.fn() };
    contextIncludesService = { getIncludeNames: jest.fn() };
    contextsService = { findAll: jest.fn().mockResolvedValue([]) };
    dialplanApplyService = { applyCategories: jest.fn() };
    contextBuilder = {};
    contextModel = { findOne: jest.fn() };
    cdrService = { getStats: jest.fn(), findCalls: jest.fn() };
    aiAdapterRegistry = { getAllTools: jest.fn().mockReturnValue([]) };
    aiChatSettingsService = { getSettings: jest.fn().mockResolvedValue({ confirmDestructive: false }) };
    loggerService = { logAction: jest.fn().mockResolvedValue(undefined) };

    service = new McpToolsService(
      endpointsService,
      trunksService,
      ivrsService,
      queuesService,
      routesService,
      contextIncludesService,
      contextsService,
      dialplanApplyService,
      contextBuilder,
      contextModel,
      cdrService,
      aiAdapterRegistry,
      aiChatSettingsService,
      loggerService,
    );
  });

  describe('cross-tenant closure regression (D-23)', () => {
    it('calls trunksService.create with the uid passed at call time, for two different tenants in a row', async () => {
      await service.callTool('create_trunk', { name: 'Trunk A' }, 111);
      await service.callTool('create_trunk', { name: 'Trunk B' }, 222);

      expect(trunksService.create).toHaveBeenNthCalledWith(1, expect.objectContaining({ name: 'Trunk A' }), 111);
      expect(trunksService.create).toHaveBeenNthCalledWith(2, expect.objectContaining({ name: 'Trunk B' }), 222);
    });

    it('getToolsList for a second tenant is not tainted by the first tenant that triggered lazy registration', async () => {
      service.getToolsList(111);
      await service.callTool('create_trunk', {}, 222);
      expect(trunksService.create).toHaveBeenCalledWith({}, 222);
    });
  });

  describe('MCP audit logging (D-19)', () => {
    it('logs a success action_log entry with the tool entityType after a successful call', async () => {
      trunksService.create.mockResolvedValue({ id: 't1' });

      await service.callTool('create_trunk', { name: 'MTT' }, 100);

      expect(loggerService.logAction).toHaveBeenCalledWith(
        0, 'ai_tool', 'trunk', null, 100, expect.stringContaining('mcp:create_trunk'), 'success',
      );
    });

    it('logs an error action_log entry when the handler throws, without letting logAction failure affect the response', async () => {
      trunksService.create.mockRejectedValue(new Error('boom'));

      const result = await service.callTool('create_trunk', { name: 'MTT' }, 100);

      expect(loggerService.logAction).toHaveBeenCalledWith(
        0, 'ai_tool', 'trunk', null, 100, expect.stringContaining('mcp:create_trunk'), 'error',
      );
      expect(result[0].text).toContain('Ошибка');
    });

    it('does not let a rejected logAction promise break the tool response (fire-and-forget)', async () => {
      loggerService.logAction.mockRejectedValue(new Error('log db down'));
      trunksService.create.mockResolvedValue({ id: 't1' });

      const result = await service.callTool('create_trunk', { name: 'MTT' }, 100);

      expect(result[0].text).toContain('t1');
    });
  });

  describe('Domain AI Adapter registry integration (D-14)', () => {
    it('exposes registry tools through getToolsList / callTool alongside legacy tools', async () => {
      const adapterHandler = jest.fn().mockResolvedValue({ ok: true });
      aiAdapterRegistry.getAllTools.mockReturnValue([
        { name: 'list_phonebooks', description: 'lists phonebooks', inputSchema: {}, entityType: 'phonebook', handler: adapterHandler },
      ]);

      const tools = service.getToolsList(100);
      expect(tools.map((t) => t.name)).toContain('list_phonebooks');
      expect(tools.map((t) => t.name)).toContain('create_trunk');

      await service.callTool('list_phonebooks', { foo: 'bar' }, 100);
      expect(adapterHandler).toHaveBeenCalledWith({ foo: 'bar' }, 100);
    });

    it('does not change the composition of the 18 legacy tools', () => {
      const tools = service.getToolsList(100);
      const legacyNames = [
        'get_pbx_state', 'create_endpoints_bulk', 'create_endpoint', 'delete_endpoint',
        'create_trunk', 'delete_trunk', 'create_ivr', 'update_ivr', 'delete_ivr',
        'create_queue', 'update_queue', 'delete_queue', 'create_route', 'delete_route',
        'apply_dialplan', 'list_contexts', 'get_cdr_summary', 'find_cdr_calls',
      ];
      for (const name of legacyNames) {
        expect(tools.map((t) => t.name)).toContain(name);
      }
    });
  });

  describe('per-tenant confirmation gate for destructive tools (D-20, D-25)', () => {
    it('blocks a destructive tool without confirm=true when the tenant has confirmations enabled', async () => {
      aiChatSettingsService.getSettings.mockResolvedValue({ confirmDestructive: true });

      const result = await service.callTool('delete_trunk', { trunkId: 't_x_1' }, 100);

      expect(trunksService.remove).not.toHaveBeenCalled();
      expect(result[0].text).toContain('Требуется подтверждение');
    });

    it('executes a destructive tool when confirm=true is passed, with confirmations enabled', async () => {
      aiChatSettingsService.getSettings.mockResolvedValue({ confirmDestructive: true });

      await service.callTool('delete_trunk', { trunkId: 't_x_1', confirm: true }, 100);

      expect(trunksService.remove).toHaveBeenCalledWith('t_x_1', 100);
    });

    it('executes a destructive tool immediately without confirm when confirmations are disabled (default OFF)', async () => {
      aiChatSettingsService.getSettings.mockResolvedValue({ confirmDestructive: false });

      await service.callTool('delete_trunk', { trunkId: 't_x_1' }, 100);

      expect(trunksService.remove).toHaveBeenCalledWith('t_x_1', 100);
    });

    it("tenant A's confirmation setting does not block tenant B's call to the same destructive tool", async () => {
      aiChatSettingsService.getSettings.mockImplementation(async (uid: number) =>
        uid === 100 ? { confirmDestructive: true } : { confirmDestructive: false },
      );

      const blockedForA = await service.callTool('delete_trunk', { trunkId: 't_a' }, 100);
      expect(trunksService.remove).not.toHaveBeenCalled();
      expect(blockedForA[0].text).toContain('Требуется подтверждение');

      await service.callTool('delete_trunk', { trunkId: 't_b' }, 200);
      expect(trunksService.remove).toHaveBeenCalledWith('t_b', 200);
    });

    it('adds a confirm boolean property to the inputSchema of destructive tools', () => {
      const tools = service.getToolsList(100);
      const deleteTrunk = tools.find((t) => t.name === 'delete_trunk')!;
      expect(deleteTrunk.inputSchema.properties.confirm).toEqual(expect.objectContaining({ type: 'boolean' }));
    });

    it('does not gate a non-destructive tool even when confirmations are enabled', async () => {
      aiChatSettingsService.getSettings.mockResolvedValue({ confirmDestructive: true });

      await service.callTool('create_trunk', { name: 'MTT' }, 100);

      expect(trunksService.create).toHaveBeenCalledWith({ name: 'MTT' }, 100);
    });
  });

  describe('callTool error handling', () => {
    it('throws for an unknown tool name', async () => {
      await expect(service.callTool('does_not_exist', {}, 100)).rejects.toThrow('Tool not found');
    });
  });
});
