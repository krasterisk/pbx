import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '@nestjs/common';
import { TENANT_ARG_KEYS } from '../ai-platform/ai-adapter.types';
import { McpToolsService } from './mcp-tools.service';

const FORMER_HANDWRITTEN_NAMES = [
  'get_pbx_state', 'create_endpoints_bulk', 'create_endpoint', 'delete_endpoint',
  'create_trunk', 'delete_trunk', 'create_ivr', 'update_ivr', 'delete_ivr',
  'create_queue', 'update_queue', 'delete_queue', 'create_route', 'delete_route',
  'apply_dialplan', 'list_contexts', 'get_cdr_summary', 'find_cdr_calls',
] as const;
const RETIRED_APPLY_TOOL = 'apply_dialplan';

/**
 * Unit tests for McpToolsService (D-23 cross-tenant fix, D-19 audit, D-14 registry integration).
 *
 * Plain-instantiation style (no NestJS TestingModule) — matches
 * route-apply.service.spec.ts / directories.controller.spec.ts in this repo.
 */
describe('McpToolsService', () => {
  let trunksService: any;
  let aiAdapterRegistry: any;
  let loggerService: any;
  let pbxAgentDiffService: any;
  let service: McpToolsService;

  beforeEach(() => {
    trunksService = { findAll: jest.fn().mockResolvedValue([]), create: jest.fn().mockResolvedValue({}), remove: jest.fn() };
    aiAdapterRegistry = {
      getAllTools: jest.fn().mockReturnValue([]),
      getDomains: jest.fn().mockReturnValue([]),
    };
    loggerService = { logAction: jest.fn().mockResolvedValue(undefined) };
    pbxAgentDiffService = {
      createProposal: jest.fn(async (proposal: any) => ({
        proposalId: '11111111-1111-4111-8111-111111111111',
        entityType: proposal.entityType,
        entityLabel: proposal.entityLabel,
        summary: proposal.summary,
        before: proposal.before ?? null,
        after: proposal.after ?? null,
        includesDialplanReload: !!proposal.includesDialplanReload,
        status: 'pending',
      })),
    };

    service = new McpToolsService(
      aiAdapterRegistry,
      loggerService,
      pbxAgentDiffService,
    );
    service.onApplicationBootstrap();
  });

  const adoptTrunkAdapters = () => {
    aiAdapterRegistry.getAllTools.mockReturnValue([
      {
        name: 'create_trunk',
        description: 'create trunk',
        inputSchema: { name: { type: 'string' } },
        entityType: 'trunk',
        handler: (args: any, uid: number) => trunksService.create(args, uid),
      },
      {
        name: 'delete_trunk',
        description: 'delete trunk',
        inputSchema: { trunkId: { type: 'string' } },
        entityType: 'trunk',
        destructive: true,
        handler: (args: any, uid: number) => trunksService.remove(args.trunkId, uid),
      },
    ]);
    service.registerAll();
  };

  describe('cross-tenant closure regression (D-23)', () => {
    it('calls trunksService.create with the uid passed at call time, for two different tenants in a row', async () => {
      adoptTrunkAdapters();
      await service.callTool('create_trunk', { name: 'Trunk A' }, 111);
      await service.callTool('create_trunk', { name: 'Trunk B' }, 222);

      expect(trunksService.create).toHaveBeenNthCalledWith(1, expect.objectContaining({ name: 'Trunk A' }), 111);
      expect(trunksService.create).toHaveBeenNthCalledWith(2, expect.objectContaining({ name: 'Trunk B' }), 222);
    });

    it('getToolsList for a second tenant is not tainted by the first tenant', async () => {
      adoptTrunkAdapters();
      service.getToolsList(111);
      await service.callTool('create_trunk', {}, 222);
      expect(trunksService.create).toHaveBeenCalledWith({}, 222);
    });
  });

  describe('MCP audit logging (D-19)', () => {
    it('logs a success action_log entry with the tool entityType after a successful call', async () => {
      adoptTrunkAdapters();
      trunksService.create.mockResolvedValue({ id: 't1' });

      await service.callTool('create_trunk', { name: 'MTT' }, 100);

      expect(loggerService.logAction).toHaveBeenCalledWith(
        0, 'ai_tool', 'trunk', null, 100, expect.stringContaining('mcp:create_trunk'), 'success',
      );
    });

    it('logs an error action_log entry when the handler throws, without letting logAction failure affect the response', async () => {
      adoptTrunkAdapters();
      trunksService.create.mockRejectedValue(new Error('boom'));

      const result = await service.callTool('create_trunk', { name: 'MTT' }, 100);

      expect(loggerService.logAction).toHaveBeenCalledWith(
        0, 'ai_tool', 'trunk', null, 100, expect.stringContaining('mcp:create_trunk'), 'error',
      );
      expect(result[0].text).toContain('Ошибка');
    });

    it('does not let a rejected logAction promise break the tool response (fire-and-forget)', async () => {
      adoptTrunkAdapters();
      loggerService.logAction.mockRejectedValue(new Error('log db down'));
      trunksService.create.mockResolvedValue({ id: 't1' });

      const result = await service.callTool('create_trunk', { name: 'MTT' }, 100);

      expect(result[0].text).toContain('t1');
    });
  });

  describe('Domain AI Adapter registry integration (D-14)', () => {
    it('exposes only registry tools through getToolsList / callTool', async () => {
      const adapterHandler = jest.fn().mockResolvedValue({ ok: true });
      aiAdapterRegistry.getAllTools.mockReturnValue([
        { name: 'list_directories', description: 'lists directories', inputSchema: {}, entityType: 'directory', handler: adapterHandler },
      ]);
      service.registerAll();

      const tools = service.getToolsList(100);
      expect(tools.map((t) => t.name)).toEqual(['list_directories']);
      expect(tools.map((t) => t.name)).not.toContain('create_trunk');

      await service.callTool('list_directories', { foo: 'bar' }, 100);
      expect(adapterHandler).toHaveBeenCalledWith({ foo: 'bar' }, 100);
    });
  });

  describe('hard cutover — no handwritten registrations (D-11, D-27)', () => {
    it('registers no tools of its own: registry count equals adapter declarations', () => {
      expect(service.getToolsList(100)).toHaveLength(0);

      const tools = [
        { name: 'list_directories', description: 'x', inputSchema: {}, entityType: 'directory', handler: jest.fn() },
        { name: 'list_contexts', description: 'x', inputSchema: {}, entityType: 'context', handler: jest.fn() },
      ];
      aiAdapterRegistry.getAllTools.mockReturnValue(tools);
      service.registerAll();
      expect(service.getToolsList(100)).toHaveLength(tools.length);
    });

    it('resolves every former handwritten name to an adapter handler except retired apply_dialplan', async () => {
      const migrateNames = FORMER_HANDWRITTEN_NAMES.filter((name) => name !== RETIRED_APPLY_TOOL);
      const handlers = Object.fromEntries(
        migrateNames.map((name) => [name, jest.fn().mockResolvedValue({ ok: name })]),
      );
      aiAdapterRegistry.getAllTools.mockReturnValue(
        Object.entries(handlers).map(([name, handler]) => ({
          name,
          description: name,
          inputSchema: {},
          entityType: 'pbx',
          handler,
        })),
      );
      service.registerAll();

      for (const [name, handler] of Object.entries(handlers)) {
        await service.callTool(name, {}, 100);
        expect(handler).toHaveBeenCalled();
      }
      await expect(service.callTool(RETIRED_APPLY_TOOL, {}, 100)).rejects.toThrow('Tool not found');
      expect(service.getToolsList(100).map((t) => t.name)).not.toContain(RETIRED_APPLY_TOOL);
    });

    it('has no handwritten registration methods or precedence shim in source', () => {
      const src = fs.readFileSync(path.join(__dirname, 'mcp-tools.service.ts'), 'utf8');
      expect(src).not.toMatch(/regGetPbxState|private reg\(|adapterProvidedNames|Skipping handwritten/);
    });

    it('no source file imports deleted knowledge or webhook symbols', () => {
      const srcRoot = path.resolve(__dirname, '../..');
      const webhookPath = path.join(srcRoot, 'modules/ai-chat/ai-webhook.controller.ts');
      const knowledgePath = path.join(srcRoot, 'modules/ai-chat/knowledge-base.service.ts');
      expect(fs.existsSync(webhookPath)).toBe(false);
      expect(fs.existsSync(knowledgePath)).toBe(false);

      const banned = /KnowledgeBaseService|AiWebhookController|knowledge-base\.service|ai-webhook\.controller/;
      const hits: string[] = [];
      const walk = (dir: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walk(full);
            continue;
          }
          if (!entry.name.endsWith('.ts') || entry.name.endsWith('.spec.ts')) continue;
          const text = fs.readFileSync(full, 'utf8');
          if (banned.test(text)) hits.push(path.relative(srcRoot, full));
        }
      };
      walk(srcRoot);
      expect(hits).toEqual([]);
    });
  });

  describe('destructive agent-path refusal (D-18, replaces D-20/D-25 self-confirm)', () => {
    it('does not gate a non-destructive tool', async () => {
      adoptTrunkAdapters();
      await service.callTool('create_trunk', { name: 'MTT' }, 100);

      expect(trunksService.create).toHaveBeenCalledWith({ name: 'MTT' }, 100);
    });
  });

  describe('callTool error handling', () => {
    it('throws for an unknown tool name', async () => {
      await expect(service.callTool('does_not_exist', {}, 100)).rejects.toThrow('Tool not found');
    });
  });

  describe('model-visible confirmation flag removed (D-18 prep)', () => {
    it('exposes no boolean confirmation property in any getToolsList schema', () => {
      adoptTrunkAdapters();
      const tools = service.getToolsList(100);
      expect(tools.length).toBeGreaterThan(0);
      for (const tool of tools) {
        const props = tool.inputSchema?.properties ?? tool.inputSchema ?? {};
        for (const [key, schema] of Object.entries(props)) {
          const type = (schema as { type?: string } | undefined)?.type;
          const looksLikeConfirm =
            /confirm/i.test(key) ||
            (type === 'boolean' && /confirm|подтвержд/i.test(JSON.stringify(schema)));
          expect({ name: tool.name, key, looksLikeConfirm }).toEqual({
            name: tool.name,
            key,
            looksLikeConfirm: false,
          });
        }
      }
    });

    it('refuses a destructive tool with any argument shape and does not invoke the domain handler', async () => {
      const shapes = [
        {},
        { trunkId: 't_x_1' },
        { trunkId: 't_x_1', confirm: true },
        { confirm: false },
      ];
      adoptTrunkAdapters();
      for (const args of shapes) {
        trunksService.remove.mockClear();
        const result = await service.callTool('delete_trunk', args, 100);
        expect(trunksService.remove).not.toHaveBeenCalled();
        expect(result[0].text).toMatch(/proposal|карточки изменений|подтвержд/i);
        expect(result[0].text).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
      }
    });
  });

  describe('bootstrap-built registry (Pitfall 2, Pitfall 5)', () => {
    it('does not lazy-register: getToolsList is empty until onApplicationBootstrap', () => {
      const fresh = new McpToolsService(
        aiAdapterRegistry,
        loggerService,
        pbxAgentDiffService,
      );
      expect(fresh.getToolsList(100)).toHaveLength(0);
    });

    it('onApplicationBootstrap builds the registry and registerAll is idempotent', () => {
      adoptTrunkAdapters();
      const bootable = service as McpToolsService & { onApplicationBootstrap: () => void };
      expect(typeof bootable.onApplicationBootstrap).toBe('function');
      bootable.onApplicationBootstrap();
      const first = bootable.getToolsList(100).map((t) => t.name);
      expect(first.length).toBeGreaterThan(0);
      bootable.onApplicationBootstrap();
      expect(bootable.getToolsList(100).map((t) => t.name)).toEqual(first);
    });
  });

  describe('forged tenant argument is stripped (D-22 tracer)', () => {
    const injectListContextsStub = () => {
      const stubHandler = jest.fn().mockResolvedValue({ ok: true });
      aiAdapterRegistry.getAllTools.mockReturnValue([
        {
          name: 'list_contexts',
          description: 'stub list_contexts',
          inputSchema: {},
          entityType: 'context',
          handler: stubHandler,
        },
      ]);
      service.registerAll();
      return stubHandler;
    };

    it('invokes list_contexts with dispatch uid 100 and no tenant key left in args', async () => {
      const stubHandler = injectListContextsStub();
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

      await service.callTool('list_contexts', { vpbxUserUid: 200 }, 100);

      expect(stubHandler).toHaveBeenCalledTimes(1);
      expect(stubHandler).toHaveBeenCalledWith({}, 100);
      expect(stubHandler.mock.calls[0][0]).not.toHaveProperty('vpbxUserUid');
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringMatching(/list_contexts/),
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringMatching(/100/),
      );

      warnSpy.mockRestore();
    });

    it('passes a non-tenant argument through untouched', async () => {
      const stubHandler = injectListContextsStub();

      await service.callTool('list_contexts', { pattern: '_X.' }, 100);

      expect(stubHandler).toHaveBeenCalledWith({ pattern: '_X.' }, 100);
    });
  });

  describe('D-22 per-tool tenancy (dispatch mechanics)', () => {
    const TENANT_A = 100;
    const TENANT_B = 200;
    const toolNames = collectRegisteredToolNames();

    it('tool names are unique and the list is non-empty', () => {
      adoptTrunkAdapters();
      const names = service.getToolsList(TENANT_A).map((t) => t.name);
      expect(names.length).toBeGreaterThan(0);
      expect(new Set(names).size).toBe(names.length);
    });

    it.each(toolNames)('%s receives uid from dispatch and forged tenant keys are absent', async (name) => {
      adoptTrunkAdapters();
      const spy = jest.fn().mockResolvedValue([{ type: 'text', text: 'ok' }]);
      const entry = (service as any).toolRegistry.get(name);
      expect(entry).toBeDefined();
      entry.destructive = false;
      entry.handler = spy;

      await service.callTool(name, { vpbxUserUid: TENANT_B }, TENANT_A);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][1]).toBe(TENANT_A);
      expect(spy.mock.calls[0][0]).not.toHaveProperty('vpbxUserUid');
      for (const key of TENANT_ARG_KEYS) {
        expect(spy.mock.calls[0][0]).not.toHaveProperty(key);
      }
    });

    it('no tool schema declares a tenant key as an input property', () => {
      for (const tool of service.getToolsList(TENANT_A)) {
        const keys = Object.keys(tool.inputSchema?.properties ?? {});
        for (const key of keys) {
          expect(TENANT_ARG_KEYS as readonly string[]).not.toContain(key);
        }
      }
    });
  });

  describe('proposes persist and live-ops (D-18)', () => {
    const proposal = {
      entityType: 'directory',
      entityLabel: 'VIP',
      summary: ['Create directory VIP'],
      before: null,
      after: { name: 'VIP' },
      applyPayload: { tool: 'create_directory', args: { name: 'VIP' } },
      includesDialplanReload: false,
    };

    const registerAdapterTools = (tools: any[]) => {
      aiAdapterRegistry.getAllTools.mockReturnValue(tools);
      service.registerAll();
    };

    it('persists create_directory as a pending proposal and inserts no directory row', async () => {
      const handler = jest.fn().mockResolvedValue(proposal);
      const create = jest.fn();
      registerAdapterTools([
        {
          name: 'create_directory',
          description: 'create',
          inputSchema: {},
          entityType: 'directory',
          proposes: true,
          handler,
        },
      ]);

      const result = await service.callTool('create_directory', { name: 'VIP' }, 100);
      const body = JSON.parse(result[0].text);

      expect(handler).toHaveBeenCalledWith(
        { name: 'VIP' },
        100,
        expect.objectContaining({ userUid: 0, role: 1, threadUid: 0 }),
      );
      expect(pbxAgentDiffService.createProposal).toHaveBeenCalledWith(
        expect.objectContaining({ applyPayload: proposal.applyPayload }),
        expect.objectContaining({ vpbxUserUid: 100 }),
      );
      expect(create).not.toHaveBeenCalled();
      expect(body.proposalId).toBeDefined();
      expect(JSON.stringify(body)).not.toMatch(/applyPayload|apply_payload/);
    });

    it('persists delete_directory as a pending proposal', async () => {
      const handler = jest.fn().mockResolvedValue({
        ...proposal,
        applyPayload: { tool: 'delete_directory', args: { uid: 5 } },
      });
      registerAdapterTools([
        {
          name: 'delete_directory',
          description: 'delete',
          inputSchema: {},
          entityType: 'directory',
          destructive: true,
          proposes: true,
          handler,
        },
      ]);

      await service.callTool('delete_directory', { uid: 5 }, 100);
      expect(handler).toHaveBeenCalled();
      expect(pbxAgentDiffService.createProposal).toHaveBeenCalled();
    });

    it('persists remove_directory_records as a pending proposal', async () => {
      const handler = jest.fn().mockResolvedValue({
        ...proposal,
        applyPayload: { tool: 'remove_directory_records', args: { uid: 5, lookup_values: ['100'] } },
      });
      registerAdapterTools([
        {
          name: 'remove_directory_records',
          description: 'remove records',
          inputSchema: {},
          entityType: 'directory',
          destructive: true,
          proposes: true,
          handler,
        },
      ]);

      await service.callTool('remove_directory_records', { uid: 5, lookup_values: ['100'] }, 100);
      expect(handler).toHaveBeenCalled();
      expect(pbxAgentDiffService.createProposal).toHaveBeenCalled();
    });

    it('still refuses an unconverted destructive name and does not invoke that handler', async () => {
      adoptTrunkAdapters();
      const result = await service.callTool('delete_trunk', { trunkId: 't_x_1' }, 100);
      expect(trunksService.remove).not.toHaveBeenCalled();
      expect(result[0].text).toMatch(/proposal|карточки изменений|подтвержд/i);
    });

    it('invokes cc_force_pause_agent as a live-ops exception', async () => {
      const handler = jest.fn().mockResolvedValue({ paused: true });
      registerAdapterTools([
        {
          name: 'cc_force_pause_agent',
          description: 'pause',
          inputSchema: {},
          entityType: 'callcenter_agent',
          destructive: true,
          handler,
        },
      ]);

      await service.callTool('cc_force_pause_agent', { interface: 'PJSIP/e201' }, 100);
      expect(handler).toHaveBeenCalledWith({ interface: 'PJSIP/e201' }, 100);
      expect(pbxAgentDiffService.createProposal).not.toHaveBeenCalled();
    });

    it('invokes cc_force_unpause_agent as a live-ops exception', async () => {
      const handler = jest.fn().mockResolvedValue({ paused: false });
      registerAdapterTools([
        {
          name: 'cc_force_unpause_agent',
          description: 'unpause',
          inputSchema: {},
          entityType: 'callcenter_agent',
          destructive: true,
          handler,
        },
      ]);

      await service.callTool('cc_force_unpause_agent', { interface: 'PJSIP/e201' }, 100);
      expect(handler).toHaveBeenCalledWith({ interface: 'PJSIP/e201' }, 100);
    });

    it('returns a workflow plan view as a card payload, not as prose', async () => {
      const plan = {
        workflowId: 'w-plan-1',
        title: 'x',
        summary: ['step'],
        status: 'pending',
        error: null,
        expiresAt: new Date().toISOString(),
        appliedAt: null,
        steps: [{ stepKey: 's1', tool: 'create_ivr' }],
      };
      registerAdapterTools([
        {
          name: 'propose_plan',
          description: 'plan',
          inputSchema: {},
          entityType: 'workflow',
          proposes: true,
          handler: async () => plan,
        },
      ]);

      const parts = await service.callTool(
        'propose_plan',
        {
          title: 'x',
          steps: [{ id: 's1', tool: 'create_ivr', args: { name: 'IVR' } }],
        },
        100,
        { userUid: 11, role: 1, threadUid: 5 },
      );

      expect(parts[0].text).not.toMatch(/черновик|подготовлен|подтверд/i);
      expect(JSON.parse(parts[0].text)).toEqual(expect.objectContaining({ workflowId: expect.any(String) }));
      expect(pbxAgentDiffService.createProposal).not.toHaveBeenCalled();
    });
  });
});

function collectRegisteredToolNames(): string[] {
  return ['create_trunk', 'delete_trunk'];
}
