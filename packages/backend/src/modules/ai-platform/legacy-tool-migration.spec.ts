import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '@nestjs/common';
import { TENANT_ARG_KEYS } from './ai-adapter.types';
import { AiAdapterRegistryService } from './ai-adapter-registry.service';
import { ContextsAiAdapter } from '../contexts/contexts-ai.adapter';
import { DirectoriesAiAdapter } from '../directories/directories-ai.adapter';
import { McpToolsService } from '../mcp/mcp-tools.service';

const TENANT_A = 100;
const TENANT_B = 200;

const CTX_A = { uid: 1, name: 'ctx-a', comment: 'Tenant A inbound', user_uid: TENANT_A };
const CTX_B = { uid: 2, name: 'ctx-b', comment: 'Tenant B inbound', user_uid: TENANT_B };
const DIR_A = {
  uid: 10,
  name: 'dir-a',
  description: 'A book',
  lookup_field_uid: 1,
  key_normalization: 'digits',
  fields: [],
  records: [],
};
const DIR_B = {
  uid: 20,
  name: 'dir-b',
  description: 'B book',
  lookup_field_uid: 2,
  key_normalization: 'none',
  fields: [],
  records: [],
};

const OTHER_TENANT_TOKENS: Record<number, string[]> = {
  [TENANT_A]: ['ctx-b', 'dir-b', 'Tenant B inbound'],
  [TENANT_B]: ['ctx-a', 'dir-a', 'Tenant A inbound'],
};

describe('legacy-tool-migration (D-22, D-27)', () => {
  let registry: AiAdapterRegistryService;
  let contextsService: { findAll: jest.Mock };
  let directoriesService: {
    findAll: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };
  let mcp: McpToolsService;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    registry = new AiAdapterRegistryService();
    contextsService = {
      findAll: jest.fn(async (uid: number) => {
        if (uid === TENANT_A) return [CTX_A];
        if (uid === TENANT_B) return [CTX_B];
        return [];
      }),
    };
    directoriesService = {
      findAll: jest.fn(async (uid: number) => {
        if (uid === TENANT_A) return [DIR_A];
        if (uid === TENANT_B) return [DIR_B];
        return [];
      }),
      findOne: jest.fn(async (id: number, uid: number) => {
        const rows = uid === TENANT_A ? [DIR_A] : uid === TENANT_B ? [DIR_B] : [];
        const found = rows.find((row) => row.uid === id);
        if (!found) throw new Error('Directory not found');
        return found;
      }),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    new ContextsAiAdapter(contextsService as any, registry).onModuleInit();
    new DirectoriesAiAdapter(directoriesService as any, registry).onModuleInit();

    mcp = createMcp(registry, contextsService, directoriesService);
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    mcp.registerAll();
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  describe('adapter precedence over handwritten twins (D-27)', () => {
    it('serves list_contexts from the adapter and skips the handwritten twin', async () => {
      expect(registry.getToolByName('list_contexts')).toBeDefined();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringMatching(/handwritten[\s\S]*list_contexts[\s\S]*adapter|adapter[\s\S]*list_contexts[\s\S]*handwritten/i),
      );

      const result = await mcp.callTool('list_contexts', {}, TENANT_A);
      const parsed = parseToolJson(result);
      expect(parsed).toEqual({
        contexts: [{ uid: CTX_A.uid, name: CTX_A.name, comment: CTX_A.comment }],
      });
      expect(contextsService.findAll).toHaveBeenCalledWith(TENANT_A);
    });

    it('still registers a handwritten name that no adapter claims', () => {
      const names = mcp.getToolsList(TENANT_A).map((tool) => tool.name);
      expect(names).toContain('create_trunk');
      expect(registry.getToolByName('create_trunk')).toBeUndefined();
    });

    it('contains no duplicate tool names', () => {
      const names = mcp.getToolsList(TENANT_A).map((tool) => tool.name);
      expect(names.length).toBeGreaterThan(0);
      expect(new Set(names).size).toBe(names.length);
    });
  });

  describe('contexts tenant isolation (D-22)', () => {
    it('returns disjoint context sets for two tenants', async () => {
      const parsedA = parseToolJson(await mcp.callTool('list_contexts', {}, TENANT_A));
      const parsedB = parseToolJson(await mcp.callTool('list_contexts', {}, TENANT_B));

      const namesA = new Set((parsedA.contexts as Array<{ name: string }>).map((row) => row.name));
      const namesB = new Set((parsedB.contexts as Array<{ name: string }>).map((row) => row.name));

      expect(namesA).toEqual(new Set(['ctx-a']));
      expect(namesB).toEqual(new Set(['ctx-b']));
      for (const name of namesA) expect(namesB.has(name)).toBe(false);
    });

    it('ignores a forged tenant key in list_contexts arguments', async () => {
      const forged = await mcp.callTool('list_contexts', { vpbxUserUid: TENANT_B, tenantId: TENANT_B }, TENANT_A);
      const clean = await mcp.callTool('list_contexts', {}, TENANT_A);
      expect(forged).toEqual(clean);
      expect(parseToolJson(forged).contexts).toEqual([
        { uid: CTX_A.uid, name: CTX_A.name, comment: CTX_A.comment },
      ]);
      expect(contextsService.findAll).toHaveBeenCalledWith(TENANT_A);
      expect(contextsService.findAll).not.toHaveBeenCalledWith(TENANT_B);
    });
  });

  describe('registry-enumerated isolation for every adapter tool (D-22)', () => {
    it('proves adapter ownership, cross-tenant isolation and forged-key ignore for each registered adapter tool', async () => {
      const adapterTools = registry.getAllTools();
      expect(adapterTools.map((tool) => tool.name).sort()).toEqual(
        expect.arrayContaining(['list_contexts', 'list_directories']),
      );
      expect(new Set(adapterTools.map((tool) => tool.name)).size).toBe(adapterTools.length);

      for (const tool of adapterTools) {
        expect(registry.getToolByName(tool.name)).toBeDefined();
        expect(mcp.getToolsList(TENANT_A).map((entry) => entry.name)).toContain(tool.name);

        const argsA = await minimalArgs(mcp, tool, TENANT_A);
        const argsB = await minimalArgs(mcp, tool, TENANT_B);
        const forgedArgs = { ...argsA };
        for (const key of TENANT_ARG_KEYS) {
          forgedArgs[key] = TENANT_B;
        }

        const resultA = await mcp.callTool(tool.name, argsA, TENANT_A);
        const forged = await mcp.callTool(tool.name, forgedArgs, TENANT_A);
        const resultB = await mcp.callTool(tool.name, argsB, TENANT_B);

        expect(forged).toEqual(resultA);
        expectNoForeignTenantLeak(resultA[0].text, TENANT_A);
        expectNoForeignTenantLeak(resultB[0].text, TENANT_B);

        if (!tool.proposes) {
          expect(resultA[0].text).not.toEqual(resultB[0].text);
        } else {
          expect(directoriesService.create).not.toHaveBeenCalled();
          expect(directoriesService.update).not.toHaveBeenCalled();
          expect(directoriesService.remove).not.toHaveBeenCalled();
        }
      }
    });
  });

  describe('contexts domain skill (D-12)', () => {
    it('ships two-field frontmatter the skill registry can parse', () => {
      const skillPath = path.join(__dirname, '../../skills/contexts/SKILL.md');
      const raw = fs.readFileSync(skillPath, 'utf8');
      expect(raw).toMatch(/^---\r?\nname: contexts\r?\ndescription: .+\r?\n---/);
      expect(raw).toMatch(/маршрут|route/i);
      expect(raw).toMatch(/тенант|tenant/i);
    });
  });
});

function parseToolJson(result: Array<{ type: string; text: string }>): Record<string, any> {
  expect(result[0]?.text).toEqual(expect.any(String));
  return JSON.parse(result[0].text);
}

function expectNoForeignTenantLeak(text: string, uid: number): void {
  for (const token of OTHER_TENANT_TOKENS[uid]) {
    expect(text).not.toContain(token);
  }
}

async function minimalArgs(
  mcp: McpToolsService,
  tool: { name: string; inputSchema: Record<string, any> },
  uid: number,
): Promise<Record<string, any>> {
  const args: Record<string, any> = {};
  const schema = tool.inputSchema ?? {};
  let listedUid: number | undefined;

  if (schema.uid) {
    const listed = parseToolJson(await mcp.callTool('list_directories', {}, uid));
    listedUid = listed.directories?.[0]?.uid;
  }

  for (const [key, def] of Object.entries(schema)) {
    const type = (def as { type?: string })?.type;
    if (key === 'uid') {
      args[key] = listedUid;
    } else if (key === 'name') {
      args[key] = uid === TENANT_A ? 'dir-a-new' : 'dir-b-new';
    } else if (key === 'lookupFieldKey' || key === 'key_normalization') {
      args[key] = 'digits';
    } else if (type === 'array') {
      args[key] = [];
    } else if (type === 'number') {
      args[key] = listedUid ?? 1;
    } else if (type === 'string') {
      args[key] = 'x';
    }
  }
  return args;
}

function createMcp(
  registry: AiAdapterRegistryService,
  contextsService: { findAll: jest.Mock },
  directoriesService: object,
): McpToolsService {
  return new McpToolsService(
    { findAll: jest.fn().mockResolvedValue([]), create: jest.fn(), remove: jest.fn(), bulkCreate: jest.fn() } as any,
    { findAll: jest.fn().mockResolvedValue([]), create: jest.fn().mockResolvedValue({}), remove: jest.fn() } as any,
    { findAll: jest.fn().mockResolvedValue([]), create: jest.fn(), update: jest.fn(), remove: jest.fn() } as any,
    { findAll: jest.fn().mockResolvedValue([]), create: jest.fn(), update: jest.fn(), remove: jest.fn() } as any,
    { create: jest.fn(), remove: jest.fn(), generateContextDialplan: jest.fn() } as any,
    { getIncludeNames: jest.fn() } as any,
    contextsService as any,
    { applyCategories: jest.fn() } as any,
    {} as any,
    { findOne: jest.fn() } as any,
    { getStats: jest.fn(), findCalls: jest.fn() } as any,
    registry,
    { getSettings: jest.fn().mockResolvedValue({ confirmDestructive: false }) } as any,
    { logAction: jest.fn().mockResolvedValue(undefined) } as any,
    {
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
    } as any,
  );
}
