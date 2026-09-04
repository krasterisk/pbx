import { Logger, NotFoundException } from '@nestjs/common';
import { UserLevel } from '../users/user.model';
import { PbxAgentDiffService } from '../ai-chat/pbx-agent-diff.service';
import { AiAdapterRegistryService } from '../ai-platform/ai-adapter-registry.service';
import { McpToolsService } from '../mcp/mcp-tools.service';
import { RoutesAiAdapter } from './routes-ai.adapter';

const TENANT_A = 100;
const TENANT_B = 200;
const AUTHOR_A = 11;

const CONTEXT_A = { uid: 3, name: 'from-internal', comment: 'in' };
const CONTEXT_B = { uid: 8, name: 'sip-out', comment: 'other' };

const QUEUE_ACTION = {
  type: 'toqueue',
  params: { target: { source: 'fixed', value: 'sales' } },
  condition: {},
};

const ROUTE_A = {
  uid: 11,
  context_uid: 3,
  name: 'Inbound sales',
  extensions: ['74951234567'],
  priority: 0,
  actions: [QUEUE_ACTION],
  user_uid: TENANT_A,
};

const ROUTE_CATCHALL = {
  uid: 12,
  context_uid: 3,
  name: 'Default',
  extensions: ['_X.'],
  priority: 1,
  actions: [{ type: 'hangup', params: { signal: 'hangup' }, condition: {} }],
  user_uid: TENANT_A,
};

const ROUTE_B = {
  uid: 90,
  context_uid: 8,
  name: 'Other inbound',
  extensions: ['74959990000'],
  priority: 0,
  actions: [{ type: 'toqueue', params: { queue: 'other' }, condition: {} }],
  user_uid: TENANT_B,
};

type ProposalRow = {
  proposal_id: string;
  thread_uid: number;
  vpbx_user_uid: number;
  user_uid: number;
  entity_type: string;
  entity_label: string;
  summary: string[];
  before_json: Record<string, unknown> | null;
  after_json: Record<string, unknown> | null;
  apply_payload: Record<string, unknown>;
  includes_dialplan_reload: boolean;
  status: string;
  error: string | null;
  expires_at: Date;
  applied_at: Date | null;
  created_at: Date;
  update: (values: Partial<ProposalRow>) => Promise<ProposalRow>;
};

function matchesWhere(row: ProposalRow, where: Record<string, unknown> | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, value]) => (row as Record<string, unknown>)[key] === value);
}

describe('RoutesAiAdapter', () => {
  let routesService: {
    findAll: jest.Mock;
    findAllByContext: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };
  let contextsService: { findAll: jest.Mock; findOne: jest.Mock };
  let queuesService: { findAll: jest.Mock };
  let endpointsService: { findAll: jest.Mock };
  let trunksService: { findAll: jest.Mock };
  let ivrsService: { findAll: jest.Mock };
  let directoriesService: { findAll: jest.Mock };
  let routeApplyService: { applyContext: jest.Mock };
  let dialplanApplyService: { applyCategories: jest.Mock };
  let registry: { register: jest.Mock };
  let adapter: RoutesAiAdapter;
  let proposalRows: ProposalRow[];
  let diffService: PbxAgentDiffService;
  const ctxA = { vpbxUserUid: TENANT_A, userUid: AUTHOR_A, role: UserLevel.ADMIN, threadUid: 3 };

  const getTool = (name: string) => adapter.getTools().find((tool) => tool.name === name)!;

  beforeEach(() => {
    routesService = {
      findAll: jest.fn(async (uid: number) => {
        if (uid === TENANT_A) return [{ ...ROUTE_A }, { ...ROUTE_CATCHALL }];
        if (uid === TENANT_B) return [{ ...ROUTE_B }];
        return [];
      }),
      findAllByContext: jest.fn(async (contextUid: number, uid: number) => {
        const all = await routesService.findAll(uid);
        return all.filter((row: { context_uid: number }) => row.context_uid === contextUid);
      }),
      findOne: jest.fn(async (id: number, uid: number) => {
        const all = await routesService.findAll(uid);
        const found = all.find((row: { uid: number }) => row.uid === id);
        if (!found) throw new NotFoundException(`Route ${id} not found`);
        return found;
      }),
      create: jest.fn(async (args: { context_uid: number }, uid: number) => ({
        uid: 50,
        context_uid: args.context_uid,
        user_uid: uid,
      })),
      update: jest.fn(),
      remove: jest.fn(),
    };
    contextsService = {
      findAll: jest.fn(async (uid: number) => {
        if (uid === TENANT_A) return [{ ...CONTEXT_A }, { uid: 5, name: 'night' }];
        if (uid === TENANT_B) return [{ ...CONTEXT_B }];
        return [];
      }),
      findOne: jest.fn(async (id: number, uid: number) => {
        const rows = await contextsService.findAll(uid);
        const found = rows.find((row: { uid: number }) => row.uid === id);
        if (!found) throw new NotFoundException('Context not found');
        return found;
      }),
    };
    queuesService = {
      findAll: jest.fn(async (uid: number) => {
        if (uid === TENANT_A) return [{ name: 'sales', exten: '100' }];
        if (uid === TENANT_B) return [{ name: 'other', exten: '500' }];
        return [];
      }),
    };
    endpointsService = {
      findAll: jest.fn(async (uid: number) => {
        if (uid === TENANT_A) return [{ extension: '201', sipUsername: 'e201_100' }];
        return [{ extension: '500', sipUsername: 'e500_200' }];
      }),
    };
    trunksService = {
      findAll: jest.fn(async (uid: number) => {
        if (uid === TENANT_A) return [{ id: 't_mtt_100', name: 'MTT' }];
        return [{ id: 't_other_200', name: 'Other' }];
      }),
    };
    ivrsService = {
      findAll: jest.fn(async (uid: number) => {
        if (uid === TENANT_A) return [{ uid: 7, name: 'Main' }];
        return [];
      }),
    };
    directoriesService = {
      findAll: jest.fn(async (uid: number) => {
        if (uid === TENANT_A) return [{ uid: 4 }];
        return [];
      }),
    };
    routeApplyService = {
      applyContext: jest.fn().mockResolvedValue({ success: true, filename: 'x', linesApplied: 1 }),
    };
    dialplanApplyService = { applyCategories: jest.fn() };
    registry = { register: jest.fn() };
    adapter = new RoutesAiAdapter(
      routesService as any,
      contextsService as any,
      queuesService as any,
      endpointsService as any,
      trunksService as any,
      ivrsService as any,
      directoriesService as any,
      registry as any,
    );

    proposalRows = [];
    const proposalModel = {
      create: jest.fn(async (values: Partial<ProposalRow>) => {
        const row = {
          proposal_id: values.proposal_id as string,
          thread_uid: values.thread_uid as number,
          vpbx_user_uid: values.vpbx_user_uid as number,
          user_uid: values.user_uid as number,
          entity_type: values.entity_type as string,
          entity_label: values.entity_label as string,
          summary: values.summary as string[],
          before_json: values.before_json ?? null,
          after_json: values.after_json ?? null,
          apply_payload: values.apply_payload as Record<string, unknown>,
          includes_dialplan_reload: !!values.includes_dialplan_reload,
          status: values.status ?? 'pending',
          error: values.error ?? null,
          expires_at: values.expires_at as Date,
          applied_at: values.applied_at ?? null,
          created_at: values.created_at ?? new Date(),
          update: async (next: Partial<ProposalRow>) => {
            Object.assign(row, next);
            return row;
          },
        } as ProposalRow;
        proposalRows.push(row);
        return row;
      }),
      findOne: jest.fn(async (opts: { where?: Record<string, unknown> } = {}) => {
        return proposalRows.find((row) => matchesWhere(row, opts.where)) ?? null;
      }),
      findAll: jest.fn(async (opts: { where?: Record<string, unknown> } = {}) => {
        return proposalRows.filter((row) => matchesWhere(row, opts.where));
      }),
      update: jest.fn(),
    };
    diffService = new PbxAgentDiffService(
      proposalModel as any,
      routeApplyService as any,
      directoriesService as any,
      routesService as any,
      { createWithGeneratedCredentials: jest.fn(), bulkCreate: jest.fn(), remove: jest.fn() } as any,
      { create: jest.fn(), remove: jest.fn() } as any,
      { logAction: jest.fn().mockResolvedValue(undefined) } as any,
      { create: jest.fn().mockResolvedValue({ uid: 1 }) } as any,
    );
  });

  describe('tool declarations (D-15, D-18, D-20)', () => {
    it('exposes list, describe-chain, create and delete and does not expose apply_dialplan', () => {
      expect(adapter.getTools().map((tool) => tool.name)).toEqual([
        'list_routes',
        'describe_route_chain',
        'create_route',
        'delete_route',
      ]);
      expect(adapter.getTools().some((tool) => tool.name === 'apply_dialplan')).toBe(false);
    });

    it('marks create and delete as proposing', () => {
      expect(getTool('create_route').proposes).toBe(true);
      expect(getTool('delete_route').proposes).toBe(true);
      expect(getTool('delete_route').destructive).toBe(true);
    });
  });

  describe('list_routes and describe_route_chain (D-15)', () => {
    it('lists tenant routes and describes the assembled chain without mutation', async () => {
      const listed = await getTool('list_routes').handler({}, TENANT_A);
      const described = await getTool('describe_route_chain').handler({ context_uid: 3 }, TENANT_A);

      expect(routesService.create).not.toHaveBeenCalled();
      expect(routesService.remove).not.toHaveBeenCalled();
      expect(routeApplyService.applyContext).not.toHaveBeenCalled();
      expect(dialplanApplyService.applyCategories).not.toHaveBeenCalled();
      expect(JSON.stringify(listed)).toMatch(/74951234567/);
      expect(JSON.stringify(listed)).not.toMatch(/74959990000/);
      expect(JSON.stringify(described)).toMatch(/toqueue|sales/);
    });
  });

  describe('create_route (D-15, D-18, D-20)', () => {
    it('returns a pending proposal whose summary lists steps and states the dialplan will be reloaded', async () => {
      const result = await getTool('create_route').handler(
        {
          context_uid: 3,
          pattern: '74950001111',
          actions: [QUEUE_ACTION],
        },
        TENANT_A,
      );

      expect(routesService.create).not.toHaveBeenCalled();
      expect(result.applyPayload).toEqual(
        expect.objectContaining({
          tool: 'create_route',
          args: expect.objectContaining({
            context_uid: 3,
            extensions: ['74950001111'],
            actions: expect.arrayContaining([expect.objectContaining({ type: 'toqueue' })]),
          }),
        }),
      );
      expect(result.includesDialplanReload).toBe(true);
      const card = (result.summary as string[]).join(' ');
      expect(card).toMatch(/toqueue|очеред/i);
      expect(card).toMatch(/sales/);
      expect(card).toMatch(/reload|диалплан|dialplan/i);
    });

    it('refuses an invalid typed chain before a proposal exists and names the failing step', async () => {
      const result = await getTool('create_route').handler(
        {
          context_uid: 3,
          pattern: '200',
          actions: [
            { type: 'toqueue', params: { queue: 'sales' }, condition: {} },
            { type: 'Dial', params: { appdata: 'PJSIP/e201_100' }, condition: {} },
          ],
        },
        TENANT_A,
      );

      expect(result.applyPayload).toBeUndefined();
      expect(result.refused).toBe(true);
      expect(result.stepIndex).toBe(1);
      expect(JSON.stringify(result)).toMatch(/Dial|unknown|kind|type/i);
    });

    it('refuses a route in another tenant context at tool time', async () => {
      const result = await getTool('create_route').handler(
        {
          context_uid: 8,
          pattern: '200',
          actions: [QUEUE_ACTION],
        },
        TENANT_A,
      );

      expect(result.applyPayload).toBeUndefined();
      expect(result.refused).toBe(true);
      expect(JSON.stringify(result)).toMatch(/8|context|тенант|tenant/i);
    });
  });

  describe('confirm create_route (D-20)', () => {
    it('writes the route and calls the orchestrator exactly once, never the low-level applier', async () => {
      const proposal = await getTool('create_route').handler(
        {
          context_uid: 3,
          pattern: '74950001111',
          actions: [QUEUE_ACTION],
        },
        TENANT_A,
      );

      const view = await diffService.createProposal(proposal, ctxA);
      const result = await diffService.apply(view.proposalId, ctxA);

      expect(result.ok).toBe(true);
      expect(routesService.create).toHaveBeenCalledTimes(1);
      expect(routesService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          context_uid: 3,
          extensions: ['74950001111'],
        }),
        TENANT_A,
      );
      expect(routeApplyService.applyContext).toHaveBeenCalledTimes(1);
      expect(routeApplyService.applyContext).toHaveBeenCalledWith(3, TENANT_A, expect.anything());
      expect(dialplanApplyService.applyCategories).not.toHaveBeenCalled();
    });
  });
});
