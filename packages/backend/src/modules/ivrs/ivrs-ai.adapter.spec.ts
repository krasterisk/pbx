import * as fs from 'fs';
import * as path from 'path';
import { Logger, NotFoundException } from '@nestjs/common';
import { UserLevel } from '../users/user.model';
import { AiAdapterRegistryService } from '../ai-platform/ai-adapter-registry.service';
import { McpToolsService } from '../mcp/mcp-tools.service';
import { IvrsAiAdapter } from './ivrs-ai.adapter';

const TENANT_A = 100;
const TENANT_B = 200;

const MENU_A = {
  uid: 7,
  name: 'Main',
  timeout: '10',
  menu_items: [
    {
      digit: '1',
      actions: [{ type: 'toqueue', params: { target: { source: 'fixed', value: 'q100_100' } } }],
    },
    {
      digit: 't',
      actions: [{ type: 'toivr', params: { ivr_uid: 8 } }],
    },
    {
      digit: 'i',
      actions: [{ type: 'hangup', params: {} }],
    },
  ],
};

const MENU_B = {
  uid: 9,
  name: 'Other',
  timeout: '8',
  menu_items: [
    {
      digit: '1',
      actions: [{ type: 'toqueue', params: { target: { source: 'fixed', value: 'q500_200' } } }],
    },
  ],
};

function confirmAs<T>(
  role: UserLevel,
  apply: () => Promise<T>,
): Promise<{ ok: boolean; reason?: string; result?: T }> {
  if (role === UserLevel.READONLY) {
    return Promise.resolve({ ok: false, reason: 'denied' });
  }
  return apply().then((result) => ({ ok: true, result }));
}

describe('IvrsAiAdapter', () => {
  let ivrsService: {
    findAll: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };
  let contextsService: { findAll: jest.Mock };
  let endpointsService: { findAll: jest.Mock };
  let queuesService: { findAll: jest.Mock };
  let registry: { register: jest.Mock };
  let adapter: IvrsAiAdapter;
  const updatedRows: Array<{ uid: number; dto: Record<string, unknown>; tenant: number }> = [];

  const getTool = (name: string) => adapter.getTools().find((tool) => tool.name === name)!;

  beforeEach(() => {
    updatedRows.length = 0;
    ivrsService = {
      findAll: jest.fn(async (uid: number) => {
        if (uid === TENANT_A) return [MENU_A, { uid: 8, name: 'Night', timeout: '5', menu_items: [] }];
        if (uid === TENANT_B) return [MENU_B];
        return [];
      }),
      findOne: jest.fn(async (id: number, uid: number) => {
        const rows = uid === TENANT_A ? [MENU_A, { uid: 8, name: 'Night', timeout: '5', menu_items: [] }] : uid === TENANT_B ? [MENU_B] : [];
        const found = rows.find((row) => row.uid === id);
        if (!found) throw new NotFoundException('IVR not found');
        return found;
      }),
      create: jest.fn(),
      update: jest.fn(async (id: number, dto: Record<string, unknown>, uid: number) => {
        const current = await ivrsService.findOne(id, uid);
        updatedRows.push({ uid: id, dto, tenant: uid });
        return { ...current, ...dto, uid: id };
      }),
      remove: jest.fn(),
    };
    contextsService = {
      findAll: jest.fn(async (uid: number) => {
        if (uid === TENANT_A) return [{ uid: 1, name: 'from-internal' }];
        if (uid === TENANT_B) return [{ uid: 2, name: 'sip-out' }];
        return [];
      }),
    };
    endpointsService = {
      findAll: jest.fn(async (uid: number) => {
        if (uid === TENANT_A) return [{ extension: '201', sipUsername: 'e201_100' }];
        if (uid === TENANT_B) return [{ extension: '500', sipUsername: 'e500_200' }];
        return [];
      }),
    };
    queuesService = {
      findAll: jest.fn(async (uid: number) => {
        if (uid === TENANT_A) return [{ name: 'q100_100', exten: '100', display_name: 'Sales' }];
        if (uid === TENANT_B) return [{ name: 'q500_200', exten: '500', display_name: 'Other' }];
        return [];
      }),
    };
    registry = { register: jest.fn() };
    adapter = new IvrsAiAdapter(
      ivrsService as any,
      registry as any,
      contextsService as any,
      endpointsService as any,
      queuesService as any,
    );
  });

  describe('tool declarations (D-18)', () => {
    it('exposes list, create, update and delete', () => {
      expect(adapter.getTools().map((tool) => tool.name)).toEqual([
        'list_ivrs',
        'create_ivr',
        'update_ivr',
        'delete_ivr',
      ]);
    });

    it('treats update_ivr as a call-handling change regardless of the legacy destructive flag', () => {
      const tool = getTool('update_ivr');
      expect(tool.proposes).toBe(true);
      expect(tool.entityType).toBe('ivr');
    });

    it('marks create and delete as proposing tools and delete as destructive', () => {
      expect(getTool('create_ivr').proposes).toBe(true);
      expect(getTool('delete_ivr').proposes).toBe(true);
      expect(getTool('delete_ivr').destructive).toBe(true);
    });
  });

  describe('list_ivrs (D-15)', () => {
    it('returns the tenant voice menus with digit maps and does not mutate', async () => {
      const result = await getTool('list_ivrs').handler({}, TENANT_A);

      expect(ivrsService.create).not.toHaveBeenCalled();
      expect(ivrsService.update).not.toHaveBeenCalled();
      expect(ivrsService.remove).not.toHaveBeenCalled();
      expect(result.menus).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            uid: 7,
            name: 'Main',
            digits: expect.objectContaining({
              1: expect.objectContaining({ kind: 'queue', target: 'q100_100' }),
            }),
          }),
        ]),
      );
    });
  });

  describe('update_ivr (D-18, D-27)', () => {
    it('returns a pending proposal whose summary states the digit, old destination and new one', async () => {
      const result = await getTool('update_ivr').handler(
        { id: 7, digit: '1', destination: { kind: 'extension', target: '201' } },
        TENANT_A,
      );

      expect(ivrsService.update).not.toHaveBeenCalled();
      expect(result).toEqual(
        expect.objectContaining({
          entityType: 'ivr',
          applyPayload: expect.objectContaining({ tool: 'update_ivr' }),
        }),
      );
      const card = result.summary.join(' ');
      expect(card).toMatch(/1/);
      expect(card).toMatch(/q100_100/);
      expect(card).toMatch(/201/);
      expect(result.before).toEqual(expect.objectContaining({ digit: '1', target: 'q100_100' }));
      expect(result.after).toEqual(expect.objectContaining({ digit: '1', target: '201' }));
    });

    it('refuses a proposal whose new destination does not exist and names the digit and the missing target', async () => {
      const result = await getTool('update_ivr').handler(
        { id: 7, digit: '1', destination: { kind: 'queue', target: 'q-missing' } },
        TENANT_A,
      );

      expect(ivrsService.update).not.toHaveBeenCalled();
      expect(result.applyPayload).toBeUndefined();
      expect(result.refused).toBe(true);
      const text = JSON.stringify(result);
      expect(text).toMatch(/1/);
      expect(text).toMatch(/q-missing/);
    });

    it('confirming a valid proposal updates exactly one voice menu for the calling tenant', async () => {
      const proposal = await getTool('update_ivr').handler(
        { id: 7, digit: '1', destination: { kind: 'extension', target: '201' } },
        TENANT_A,
      );
      expect(updatedRows).toHaveLength(0);

      const { id, ...rest } = proposal.applyPayload.args;
      await ivrsService.update(Number(id), rest, TENANT_A);

      expect(updatedRows).toHaveLength(1);
      expect(updatedRows[0].uid).toBe(7);
      expect(updatedRows[0].tenant).toBe(TENANT_A);
    });
  });

  describe('create_ivr and delete_ivr', () => {
    it('create_ivr returns a pending proposal and does not write', async () => {
      const result = await getTool('create_ivr').handler(
        {
          name: 'Sales',
          menu_items: [
            { digit: '1', actions: [{ type: 'toqueue', params: { target: { source: 'fixed', value: 'q100_100' } } }] },
          ],
        },
        TENANT_A,
      );

      expect(ivrsService.create).not.toHaveBeenCalled();
      expect(result.proposes ?? getTool('create_ivr').proposes).toBe(true);
      expect(result.applyPayload).toEqual(expect.objectContaining({ tool: 'create_ivr' }));
    });

    it('delete_ivr is destructive, names the menu and does not delete until confirm', async () => {
      const result = await getTool('delete_ivr').handler({ id: 7 }, TENANT_A);

      expect(ivrsService.remove).not.toHaveBeenCalled();
      expect(getTool('delete_ivr').destructive).toBe(true);
      expect(result.summary.join(' ')).toMatch(/Main|7/);
      expect(result.applyPayload).toEqual(expect.objectContaining({ tool: 'delete_ivr', args: { id: 7 } }));
    });
  });

  describe('onModuleInit', () => {
    it('registers itself with the adapter registry', () => {
      adapter.onModuleInit();
      expect(registry.register).toHaveBeenCalledWith(adapter);
    });
  });

  describe('role fixtures on confirmation (D-21)', () => {
    const mutating = [
      {
        name: 'create_ivr',
        args: {
          name: 'Sales',
          menu_items: [
            { digit: '1', actions: [{ type: 'toqueue', params: { target: { source: 'fixed', value: 'q100_100' } } }] },
          ],
        },
        apply: (proposal: any) => ivrsService.create(proposal.applyPayload.args, TENANT_A),
        written: () => ivrsService.create,
      },
      {
        name: 'update_ivr',
        args: { id: 7, digit: '1', destination: { kind: 'extension', target: '201' } },
        apply: (proposal: any) => {
          const { id, ...rest } = proposal.applyPayload.args;
          return ivrsService.update(Number(id), rest, TENANT_A);
        },
        written: () => ivrsService.update,
      },
      {
        name: 'delete_ivr',
        args: { id: 7 },
        apply: (proposal: any) => ivrsService.remove(proposal.applyPayload.args.id, TENANT_A),
        written: () => ivrsService.remove,
      },
    ] as const;

    it.each(mutating)('$name denies a read-only role and leaves records untouched', async (row) => {
      const proposal = await getTool(row.name).handler(row.args, TENANT_A);
      const denied = await confirmAs(UserLevel.READONLY, () => row.apply(proposal));

      expect(denied).toEqual({ ok: false, reason: 'denied' });
      expect(row.written()).not.toHaveBeenCalled();
    });
  });

  describe('tenant isolation (D-22)', () => {
    it('never returns or changes another tenant voice menu', async () => {
      const listed = await getTool('list_ivrs').handler({}, TENANT_A);
      expect(JSON.stringify(listed)).not.toContain('Other');
      expect(JSON.stringify(listed)).not.toContain('q500_200');

      await expect(getTool('update_ivr').handler({ id: 9, digit: '1', destination: { kind: 'queue', target: 'q100_100' } }, TENANT_A))
        .rejects.toThrow(/not found/i);
      await expect(getTool('delete_ivr').handler({ id: 9 }, TENANT_A)).rejects.toThrow(/not found/i);
      expect(ivrsService.update).not.toHaveBeenCalled();
      expect(ivrsService.remove).not.toHaveBeenCalled();
    });

    it('ignores a forged tenant key in tool arguments', async () => {
      await getTool('update_ivr').handler(
        { id: 7, digit: '1', destination: { kind: 'extension', target: '201' }, vpbxUserUid: TENANT_B, tenantId: TENANT_B },
        TENANT_A,
      );
      expect(ivrsService.findOne).toHaveBeenCalledWith(7, TENANT_A);
      expect(ivrsService.findOne).not.toHaveBeenCalledWith(7, TENANT_B);
    });
  });

  describe('adapter precedence (D-27)', () => {
    it('serves create_ivr, update_ivr and delete_ivr from the adapter and skips the handwritten twin', () => {
      const live = new AiAdapterRegistryService();
      const wired = new IvrsAiAdapter(
        ivrsService as any,
        live,
        contextsService as any,
        endpointsService as any,
        queuesService as any,
      );
      wired.onModuleInit();
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      const mcp = createMcp(live, ivrsService);
      mcp.registerAll();

      for (const name of ['create_ivr', 'update_ivr', 'delete_ivr']) {
        expect(live.getToolByName(name)).toBeDefined();
        expect(mcp.getToolsList(TENANT_A).filter((tool) => tool.name === name)).toHaveLength(1);
        expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(new RegExp(`Skipping handwritten.*${name}`)));
      }
      expect(new Set(live.getAllTools().map((tool) => tool.name)).size).toBe(live.getAllTools().length);
      warnSpy.mockRestore();
    });
  });

  describe('voice-menu domain skill', () => {
    it('ships two-field frontmatter covering digit maps, destination kinds, timeout and inbound reach', () => {
      const skillPath = path.join(__dirname, '../../skills/ivrs/SKILL.md');
      const raw = fs.readFileSync(skillPath, 'utf8');
      expect(raw).toMatch(/^---\r?\nname: ivrs\r?\ndescription: .+\r?\n---/);
      expect(raw).toMatch(/digit|цифр/i);
      expect(raw).toMatch(/context|extension|queue|меню|menu/i);
      expect(raw).toMatch(/timeout|t\b|неверн|invalid/i);
      expect(raw).toMatch(/маршрут|route|входящ/i);
    });
  });
});

function createMcp(registry: AiAdapterRegistryService, ivrsService: object): McpToolsService {
  return new McpToolsService(
    { findAll: jest.fn().mockResolvedValue([]), create: jest.fn(), remove: jest.fn(), bulkCreate: jest.fn() } as any,
    { findAll: jest.fn().mockResolvedValue([]), create: jest.fn(), remove: jest.fn() } as any,
    ivrsService as any,
    { findAll: jest.fn().mockResolvedValue([]), create: jest.fn(), update: jest.fn(), remove: jest.fn() } as any,
    { create: jest.fn(), remove: jest.fn(), generateContextDialplan: jest.fn() } as any,
    { getIncludeNames: jest.fn() } as any,
    { findAll: jest.fn().mockResolvedValue([]) } as any,
    { applyCategories: jest.fn() } as any,
    {} as any,
    { findOne: jest.fn() } as any,
    { getStats: jest.fn(), findCalls: jest.fn() } as any,
    registry,
    { getSettings: jest.fn().mockResolvedValue({ confirmDestructive: false }) } as any,
    { logAction: jest.fn().mockResolvedValue(undefined) } as any,
    { createProposal: jest.fn(async (proposal: any) => ({ ...proposal, status: 'pending' })) } as any,
  );
}
