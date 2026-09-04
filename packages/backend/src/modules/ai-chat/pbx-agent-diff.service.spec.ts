import { UserLevel } from '../users/user.model';
import { PbxAgentDiffService } from './pbx-agent-diff.service';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TENANT_A = 100;
const TENANT_B = 200;
const AUTHOR_A = 11;
const AUTHOR_B = 22;

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

function assertNoApplyPayload(value: unknown): void {
  const json = JSON.stringify(value);
  expect(json).not.toMatch(/applyPayload|apply_payload/);
}

function directoryCreateProposal(overrides: Record<string, unknown> = {}) {
  return {
    entityType: 'directory',
    entityLabel: 'VIP',
    summary: ['Create directory VIP'],
    before: null,
    after: { name: 'VIP' },
    applyPayload: { tool: 'create_directory', args: { name: 'VIP', lookupFieldKey: 'num' } },
    includesDialplanReload: false,
    ...overrides,
  };
}

function routeCreateProposal(overrides: Record<string, unknown> = {}) {
  return {
    entityType: 'route',
    entityLabel: '_X.',
    summary: ['Create catch-all route'],
    before: null,
    after: { pattern: '_X.' },
    applyPayload: { tool: 'create_route', args: { context_uid: 7, pattern: '_X.' } },
    includesDialplanReload: true,
    ...overrides,
  };
}

describe('PbxAgentDiffService', () => {
  let rows: ProposalRow[];
  let proposalModel: { create: jest.Mock; findOne: jest.Mock; findAll: jest.Mock; update: jest.Mock };
  let routeApplyService: { applyContext: jest.Mock };
  let directoriesService: { create: jest.Mock; update: jest.Mock; remove: jest.Mock; findOne: jest.Mock };
  let routesService: { create: jest.Mock; update: jest.Mock; remove: jest.Mock };
  let loggerService: { logAction: jest.Mock };
  let auditModel: { create: jest.Mock };
  let service: PbxAgentDiffService;
  const ctxA = { vpbxUserUid: TENANT_A, userUid: AUTHOR_A, role: UserLevel.ADMIN, threadUid: 3 };

  beforeEach(() => {
    rows = [];
    proposalModel = {
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
        rows.push(row);
        return row;
      }),
      findOne: jest.fn(async (opts: { where?: Record<string, unknown> } = {}) => {
        return rows.find((row) => matchesWhere(row, opts.where)) ?? null;
      }),
      findAll: jest.fn(async (opts: { where?: Record<string, unknown> } = {}) => {
        return rows.filter((row) => matchesWhere(row, opts.where));
      }),
      update: jest.fn(async (values: Partial<ProposalRow>, opts: { where?: Record<string, unknown> } = {}) => {
        const matched = rows.filter((row) => matchesWhere(row, opts.where));
        matched.forEach((row) => Object.assign(row, values));
        return [matched.length];
      }),
    };
    routeApplyService = { applyContext: jest.fn().mockResolvedValue({ success: true, filename: 'x', linesApplied: 1 }) };
    directoriesService = {
      create: jest.fn(async (args: { name: string }, uid: number) => ({ uid: 10, name: args.name, vpbx_user_uid: uid })),
      update: jest.fn(),
      remove: jest.fn(),
      findOne: jest.fn(),
    };
    routesService = {
      create: jest.fn(async (args: { context_uid: number }) => ({ uid: 1, context_uid: args.context_uid })),
      update: jest.fn(),
      remove: jest.fn(),
    };
    loggerService = { logAction: jest.fn().mockResolvedValue(undefined) };
    auditModel = { create: jest.fn().mockResolvedValue({ uid: 1 }) };
    service = new PbxAgentDiffService(
      proposalModel as any,
      routeApplyService as any,
      directoriesService as any,
      routesService as any,
      { createWithGeneratedCredentials: jest.fn(), bulkCreate: jest.fn(), remove: jest.fn() } as any,
      { create: jest.fn(), remove: jest.fn() } as any,
      loggerService as any,
      auditModel as any,
    );
  });

  describe('createProposal', () => {
    it('persists a pending row with a generated identifier, summary list and 24h expiry, without the apply payload', async () => {
      const view = await service.createProposal(directoryCreateProposal(), ctxA);

      expect(view.proposalId).toMatch(UUID_RE);
      expect(view.summary).toEqual(['Create directory VIP']);
      expect(view.status).toBe('pending');
      expect(new Date(view.expiresAt).getTime()).toBeGreaterThan(Date.now() + 23 * 60 * 60 * 1000);
      expect(new Date(view.expiresAt).getTime()).toBeLessThan(Date.now() + 25 * 60 * 60 * 1000);
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe('pending');
      expect(rows[0].apply_payload).toEqual({ tool: 'create_directory', args: { name: 'VIP', lookupFieldKey: 'num' } });
      assertNoApplyPayload(view);
    });
  });

  describe('apply refusals', () => {
    it('refuses an unknown identifier and mutates nothing', async () => {
      const result = await service.apply('00000000-0000-4000-8000-000000000099', ctxA);
      expect(result.ok).toBe(false);
      expect(directoriesService.create).not.toHaveBeenCalled();
      expect(routeApplyService.applyContext).not.toHaveBeenCalled();
      assertNoApplyPayload(result);
    });

    it('refuses an expired identifier and mutates nothing', async () => {
      const view = await service.createProposal(directoryCreateProposal(), ctxA);
      rows[0].expires_at = new Date(Date.now() - 1000);

      const result = await service.apply(view.proposalId, ctxA);
      expect(result.ok).toBe(false);
      expect(directoriesService.create).not.toHaveBeenCalled();
      expect(rows[0].status).toBe('pending');
      assertNoApplyPayload(result);
    });

    it('refuses a foreign-tenant identifier and mutates nothing', async () => {
      const view = await service.createProposal(directoryCreateProposal(), ctxA);
      const result = await service.apply(view.proposalId, {
        vpbxUserUid: TENANT_B,
        userUid: AUTHOR_A,
        role: 1,
        threadUid: 3,
      });
      expect(result.ok).toBe(false);
      expect(directoriesService.create).not.toHaveBeenCalled();
      expect(rows[0].status).toBe('pending');
    });

    it('refuses an already-settled identifier and mutates nothing', async () => {
      const view = await service.createProposal(directoryCreateProposal(), ctxA);
      await service.apply(view.proposalId, ctxA);
      directoriesService.create.mockClear();

      const result = await service.apply(view.proposalId, ctxA);
      expect(result.ok).toBe(false);
      expect(directoriesService.create).not.toHaveBeenCalled();
      expect(rows[0].status).toBe('applied');
    });
  });

  describe('apply route', () => {
    it('calls the route apply orchestrator once and sets the row to applied with a timestamp', async () => {
      const view = await service.createProposal(routeCreateProposal(), ctxA);
      const result = await service.apply(view.proposalId, ctxA);

      expect(result.ok).toBe(true);
      expect(routeApplyService.applyContext).toHaveBeenCalledTimes(1);
      expect(routeApplyService.applyContext).toHaveBeenCalledWith(7, TENANT_A, expect.anything());
      expect(rows[0].status).toBe('applied');
      expect(rows[0].applied_at).toBeInstanceOf(Date);
      assertNoApplyPayload(result);
    });
  });

  describe('reject', () => {
    it('sets a pending proposal to rejected and mutates nothing', async () => {
      const view = await service.createProposal(directoryCreateProposal(), ctxA);
      const result = await service.reject(view.proposalId, ctxA);

      expect(result.ok).toBe(true);
      expect(rows[0].status).toBe('rejected');
      expect(directoriesService.create).not.toHaveBeenCalled();
      expect(routeApplyService.applyContext).not.toHaveBeenCalled();
      assertNoApplyPayload(result);
    });
  });

  describe('directory apply', () => {
    it('inserts exactly one directory row for the calling tenant', async () => {
      const view = await service.createProposal(directoryCreateProposal(), ctxA);
      const result = await service.apply(view.proposalId, ctxA);

      expect(result.ok).toBe(true);
      expect(directoriesService.create).toHaveBeenCalledTimes(1);
      expect(directoriesService.create).toHaveBeenCalledWith(
        { name: 'VIP', lookupFieldKey: 'num' },
        TENANT_A,
      );
      assertNoApplyPayload(result);
    });
  });

  describe('route precedence (Pitfall 10)', () => {
    it('refuses an unsafe route proposal, leaves it pending and records the audit', async () => {
      const view = await service.createProposal(
        routeCreateProposal({
          after: { patterns: ['_X.', '112'] },
          applyPayload: { tool: 'create_route', args: { context_uid: 7, pattern: '_X.', patterns: ['_X.', '112'] } },
        }),
        ctxA,
      );

      const result = await service.apply(view.proposalId, ctxA);

      expect(result.ok).toBe(false);
      expect(result.reason).toMatch(/precedence|catch-all|112|_X\./i);
      expect(rows[0].status).toBe('pending');
      expect(routesService.create).not.toHaveBeenCalled();
      expect(routeApplyService.applyContext).not.toHaveBeenCalled();
      expect(auditModel.create).toHaveBeenCalledWith(expect.objectContaining({
        status: 'denied',
      }));
    });
  });

  describe('permission and audit (D-21)', () => {
    it('denies a read-only role, writes a denied audit row and performs no domain write', async () => {
      const view = await service.createProposal(directoryCreateProposal(), ctxA);
      const result = await service.apply(view.proposalId, { ...ctxA, role: UserLevel.READONLY });

      expect(result.ok).toBe(false);
      expect(result.reason).toBe('denied');
      expect(rows[0].status).toBe('denied');
      expect(directoriesService.create).not.toHaveBeenCalled();
      expect(auditModel.create).toHaveBeenCalledWith(expect.objectContaining({
        status: 'denied',
        thread_uid: 3,
        user_uid: TENANT_A,
      }));
      expect(loggerService.logAction).toHaveBeenCalled();
    });

    it('allows a permitted role and writes a successful audit row', async () => {
      const view = await service.createProposal(directoryCreateProposal(), ctxA);
      const result = await service.apply(view.proposalId, ctxA);

      expect(result.ok).toBe(true);
      expect(directoriesService.create).toHaveBeenCalledTimes(1);
      expect(auditModel.create).toHaveBeenCalledWith(expect.objectContaining({
        status: 'ok',
        thread_uid: 3,
        user_uid: TENANT_A,
        tool_name: 'create_directory',
      }));
    });

    it('writes the audit row before the response is produced', async () => {
      const order: string[] = [];
      auditModel.create.mockImplementation(async () => {
        order.push('audit');
        return { uid: 1 };
      });
      const view = await service.createProposal(directoryCreateProposal(), ctxA);
      const result = await service.apply(view.proposalId, ctxA);
      order.push('response');

      expect(result.ok).toBe(true);
      expect(order).toEqual(['audit', 'response']);
    });

    it('carries the conversation reference and the calling tenant on the audit row', async () => {
      const view = await service.createProposal(directoryCreateProposal(), ctxA);
      await service.apply(view.proposalId, { ...ctxA, threadUid: 99 });

      expect(auditModel.create).toHaveBeenCalledWith(expect.objectContaining({
        thread_uid: 99,
        user_uid: TENANT_A,
      }));
    });
  });

  describe('payload omission', () => {
    it('keeps the serialized apply payload out of every returned shape', async () => {
      const created = await service.createProposal(directoryCreateProposal(), ctxA);
      const pending = await service.getPending(ctxA);
      const applied = await service.apply(created.proposalId, ctxA);
      const other = await service.createProposal(directoryCreateProposal({ entityLabel: 'Other' }), {
        ...ctxA,
        userUid: AUTHOR_B,
      });
      const rejected = await service.reject(other.proposalId, { ...ctxA, userUid: AUTHOR_B });

      for (const shape of [created, pending, applied, rejected]) {
        assertNoApplyPayload(shape);
      }
    });
  });
});
