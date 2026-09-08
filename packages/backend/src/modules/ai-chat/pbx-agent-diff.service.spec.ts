import { z } from 'zod';
import { UserLevel } from '../users/user.model';
import { AiAdapterRegistryService } from '../ai-platform/ai-adapter-registry.service';
import { defineMutationTool } from '../ai-platform/ai-mutation.contract';
import { toPublicExten } from '../../shared/utils/tenant-public-id.util';
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
    applyPayload: {
      tool: 'create_route',
      args: {
        context_uid: 7,
        name: '_X.',
        extensions: ['_X.'],
        actions: [{ type: 'hangup', params: {} }],
      },
    },
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
  let callGroupsService: { create: jest.Mock; update: jest.Mock; remove: jest.Mock };
  let queuesService: { create: jest.Mock; update: jest.Mock; remove: jest.Mock };
  let ivrsService: { create: jest.Mock; update: jest.Mock; remove: jest.Mock };
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
    callGroupsService = { create: jest.fn(), update: jest.fn(), remove: jest.fn() };
    queuesService = { create: jest.fn(), update: jest.fn(), remove: jest.fn() };
    ivrsService = { create: jest.fn(), update: jest.fn(), remove: jest.fn() };

    const registry = new AiAdapterRegistryService();
    registry.register({
      domain: 'test_mutations',
      getTools: () => [
        defineMutationTool({
          name: 'create_directory',
          description: 'test',
          entityType: 'directory',
          schemaVersion: 'directories-1',
          input: z.strictObject({ name: z.string(), lookupFieldKey: z.string() }),
          args: z.strictObject({ name: z.string(), lookupFieldKey: z.string() }),
          reload: { kind: 'none' },
          propose: async () => directoryCreateProposal() as any,
          revalidate: async (args) => ({ ok: true, args }),
          apply: async (args, ctx) => {
            await directoriesService.create(args as any, ctx.vpbxUserUid);
          },
        }),
        defineMutationTool({
          name: 'create_route',
          description: 'test',
          entityType: 'route',
          schemaVersion: 'routes-1',
          input: z.strictObject({
            context_uid: z.number(),
            name: z.string().optional(),
            extensions: z.array(z.string()).optional(),
            pattern: z.string().optional(),
            patterns: z.array(z.string()).optional(),
            actions: z.array(z.record(z.string(), z.unknown())).optional(),
          }),
          args: z.strictObject({
            context_uid: z.number(),
            name: z.string().optional(),
            extensions: z.array(z.string()).optional(),
            pattern: z.string().optional(),
            patterns: z.array(z.string()).optional(),
            actions: z.array(z.record(z.string(), z.unknown())).optional(),
          }),
          reload: { kind: 'dialplan-context', contextUid: (args: any) => Number(args.context_uid) },
          propose: async () => routeCreateProposal() as any,
          revalidate: async (args) => ({ ok: true, args }),
          apply: async (args, ctx) => {
            await routesService.create(args as any, ctx.vpbxUserUid);
          },
        }),
        defineMutationTool({
          name: 'create_call_group',
          description: 'test',
          entityType: 'call_group',
          schemaVersion: 'call-groups-1',
          input: z.strictObject({
            name: z.string(),
            exten: z.string(),
            strategy: z.string().optional(),
            members: z.array(z.record(z.string(), z.unknown())).optional(),
          }),
          args: z.strictObject({
            name: z.string(),
            exten: z.string(),
            strategy: z.string().optional(),
            members: z.array(z.record(z.string(), z.unknown())).optional(),
          }),
          reload: { kind: 'none' },
          propose: async (input) => ({
            entityType: 'call_group',
            entityLabel: input.name,
            summary: [`Создать группу ${input.name}`],
            before: null,
            after: input,
            applyPayload: { tool: 'create_call_group', args: input },
            includesDialplanReload: false,
          }),
          revalidate: async (args) => ({ ok: true, args }),
          apply: async (args, ctx) => {
            await callGroupsService.create(
              {
                ...args,
                exten: toPublicExten(args.exten, ctx.vpbxUserUid),
                members: (args.members ?? []).map((member) =>
                  member.member_type === 'internal'
                    ? { ...member, value: toPublicExten(member.value, ctx.vpbxUserUid) }
                    : member,
                ),
              } as any,
              ctx.vpbxUserUid,
            );
          },
        }),
        defineMutationTool({
          name: 'create_queue',
          description: 'test',
          entityType: 'queue',
          schemaVersion: 'queues-1',
          input: z.strictObject({
            display_name: z.string().optional(),
            name: z.string().optional(),
            exten: z.string(),
            strategy: z.string().optional(),
          }),
          args: z.strictObject({
            display_name: z.string().optional(),
            name: z.string().optional(),
            exten: z.string(),
            strategy: z.string().optional(),
          }),
          reload: { kind: 'none' },
          propose: async (input) => ({
            entityType: 'queue',
            entityLabel: String(input.display_name || input.name || input.exten),
            summary: ['Создать очередь'],
            before: null,
            after: input,
            applyPayload: { tool: 'create_queue', args: input },
            includesDialplanReload: false,
          }),
          revalidate: async (args) => ({ ok: true, args }),
          apply: async (args, ctx) => {
            await queuesService.create(
              { ...args, exten: toPublicExten(args.exten, ctx.vpbxUserUid) } as any,
              ctx.vpbxUserUid,
            );
          },
        }),
        defineMutationTool({
          name: 'create_ivr',
          description: 'test',
          entityType: 'ivr',
          schemaVersion: 'ivrs-1',
          input: z.strictObject({
            name: z.string(),
            menu_items: z.array(z.record(z.string(), z.unknown())).optional(),
          }),
          args: z.strictObject({
            name: z.string(),
            menu_items: z.array(z.record(z.string(), z.unknown())).optional(),
          }),
          reload: { kind: 'none' },
          propose: async (input) => ({
            entityType: 'ivr',
            entityLabel: input.name,
            summary: [`Создать голосовое меню ${input.name}`],
            before: null,
            after: input,
            applyPayload: { tool: 'create_ivr', args: input },
            includesDialplanReload: false,
          }),
          revalidate: async (args) => ({ ok: true, args }),
          apply: async (args, ctx) => {
            await ivrsService.create(args as any, ctx.vpbxUserUid, ctx.isAdmin);
          },
        }),
      ],
    });

    service = new PbxAgentDiffService(
      proposalModel as any,
      routeApplyService as any,
      loggerService as any,
      auditModel as any,
      registry,
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
      expect(rows[0].apply_payload).toEqual({
        tool: 'create_directory',
        args: { name: 'VIP', lookupFieldKey: 'num' },
        schemaVersion: 'directories-1',
      });
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
    });

    it('returns success idempotently when the proposal is already applied', async () => {
      const view = await service.createProposal(directoryCreateProposal(), ctxA);
      await service.apply(view.proposalId, ctxA);
      directoriesService.create.mockClear();

      const result = await service.apply(view.proposalId, ctxA);
      expect(result.ok).toBe(true);
      expect(result.proposal?.status).toBe('applied');
      expect(directoriesService.create).not.toHaveBeenCalled();
      expect(rows[0].status).toBe('applied');
    });

    it('clears a stuck claim after revalidate denial so retry is not not_pending', async () => {
      const view = await service.createProposal(directoryCreateProposal(), ctxA);
      // Simulate the Sequelize no-op bug: claim left in DB while status stayed pending.
      rows[0].applied_at = new Date();
      rows[0].error = 'Номера уже заняты у тенанта: 103';

      const result = await service.apply(view.proposalId, ctxA);
      expect(result.ok).toBe(true);
      expect(result.proposal?.status).toBe('applied');
      expect(rows[0].applied_at).toBeInstanceOf(Date);
      expect(directoriesService.create).toHaveBeenCalled();
    });

    it('releases applied_at via Model.update when revalidate denies', async () => {
      const registry = new AiAdapterRegistryService();
      registry.register({
        domain: 'deny_once',
        getTools: () => [
          defineMutationTool({
            name: 'create_directory',
            description: 'test',
            entityType: 'directory',
            schemaVersion: 'directories-1',
            input: z.strictObject({ name: z.string(), lookupFieldKey: z.string() }),
            args: z.strictObject({ name: z.string(), lookupFieldKey: z.string() }),
            reload: { kind: 'none' },
            propose: async () => directoryCreateProposal() as any,
            revalidate: async () => ({ ok: false as const, reason: 'Номера уже заняты у тенанта: 103' }),
            apply: async () => {
              throw new Error('should not apply');
            },
          }),
        ],
      });
      const denying = new PbxAgentDiffService(
        proposalModel as any,
        routeApplyService as any,
        loggerService as any,
        auditModel as any,
        registry,
      );

      const view = await denying.createProposal(directoryCreateProposal(), ctxA);
      // Force instance applied_at to null while DB claim is set — releaseClaim must still clear DB.
      rows[0].applied_at = new Date();
      const claimedAt = rows[0].applied_at;
      expect(claimedAt).toBeTruthy();

      const result = await denying.apply(view.proposalId, ctxA);
      expect(result.ok).toBe(false);
      expect(result.reason).toMatch(/занят/i);
      expect(rows[0].status).toBe('pending');
      expect(rows[0].applied_at).toBeNull();
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

  describe('call-group apply', () => {
    it('creates the group for the calling tenant and not from model-supplied tenant keys', async () => {
      const view = await service.createProposal({
        entityType: 'call_group',
        entityLabel: 'Продажи_группа',
        summary: ['Создать группу Продажи_группа'],
        before: null,
        after: { name: 'Продажи_группа', exten: '701' },
        applyPayload: {
          tool: 'create_call_group',
          args: { name: 'Продажи_группа', exten: '701', strategy: 'ringall' },
        },
        includesDialplanReload: false,
      }, ctxA);

      const result = await service.apply(view.proposalId, ctxA);

      expect(result.ok).toBe(true);
      expect(callGroupsService.create).toHaveBeenCalledWith(
        { name: 'Продажи_группа', exten: '701', strategy: 'ringall', members: [] },
        TENANT_A,
      );
    });

    it('rewrites a tenant-scoped exten before create so the group stays in the calling tenant', async () => {
      const view = await service.createProposal({
        entityType: 'call_group',
        entityLabel: 'Продажи_группа',
        summary: ['Создать группу Продажи_группа'],
        before: null,
        after: { name: 'Продажи_группа', exten: 'q701_0' },
        applyPayload: {
          tool: 'create_call_group',
          args: {
            name: 'Продажи_группа',
            exten: 'q701_0',
            strategy: 'ringall',
            members: [{ member_type: 'internal', value: 'e201_0' }],
          },
        },
        includesDialplanReload: false,
      }, ctxA);

      await service.apply(view.proposalId, ctxA);

      expect(callGroupsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          exten: '701',
          members: [expect.objectContaining({ value: '201' })],
        }),
        TENANT_A,
      );
    });
  });

  describe('queue apply', () => {
    it('creates the queue for the calling tenant from a public number', async () => {
      const view = await service.createProposal({
        entityType: 'queue',
        entityLabel: 'Support',
        summary: ['Создать очередь Support'],
        before: null,
        after: { name: 'Support', exten: 'q200_100' },
        applyPayload: {
          tool: 'create_queue',
          args: { display_name: 'Support', exten: 'q200_100', strategy: 'ringall' },
        },
        includesDialplanReload: false,
      }, ctxA);

      const result = await service.apply(view.proposalId, ctxA);

      expect(result.ok).toBe(true);
      expect(queuesService.create).toHaveBeenCalledWith(
        expect.objectContaining({ exten: '200' }),
        TENANT_A,
      );
    });
  });

  describe('ivr apply', () => {
    it('creates the IVR for the JWT tenant and strips a forged user_uid', async () => {
      const view = await service.createProposal({
        entityType: 'ivr',
        entityLabel: 'Продажи',
        summary: ['Создать голосовое меню Продажи'],
        before: null,
        after: { name: 'Продажи' },
        applyPayload: {
          tool: 'create_ivr',
          args: {
            name: 'Продажи',
            user_uid: 0,
            vpbxUserUid: TENANT_B,
            menu_items: [
              { digit: '1', actions: [{ type: 'toexten', params: { target: { source: 'fixed', value: '101' } } }] },
            ],
          },
        },
        includesDialplanReload: false,
      }, ctxA);

      const result = await service.apply(view.proposalId, ctxA);

      expect(result.ok).toBe(true);
      expect(ivrsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Продажи',
          menu_items: expect.any(Array),
        }),
        TENANT_A,
        true,
      );
      const saved = ivrsService.create.mock.calls[0][0];
      expect(saved.user_uid).toBeUndefined();
      expect(saved.vpbxUserUid).toBeUndefined();
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
          applyPayload: {
            tool: 'create_route',
            args: {
              context_uid: 7,
              name: '_X.',
              extensions: ['_X.'],
              patterns: ['_X.', '112'],
              actions: [{ type: 'hangup', params: {} }],
            },
          },
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
