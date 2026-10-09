import { z } from 'zod';
import { AiAdapterRegistryService } from '../ai-platform/ai-adapter-registry.service';
import { defineMutationTool } from '../ai-platform/ai-mutation.contract';
import { PbxAgentDiffService } from './pbx-agent-diff.service';
import { Op } from 'sequelize';

describe('secure single-proposal confirmation', () => {
  it('looks up a pending card by tenant, author, conversation and expiry', async () => {
    const model = { findOne: jest.fn(async () => null) };
    const service = new PbxAgentDiffService(model as never, {} as never, {} as never, {} as never, {} as never);
    expect(await service.findLatestPendingForThread(3, { vpbxUserUid: 100, userUid: 11, role: 1 })).toBeNull();
    expect(model.findOne).toHaveBeenCalledWith({ where: { thread_uid: 3, vpbx_user_uid: 100, user_uid: 11, status: 'pending', expires_at: { [Op.gt]: expect.any(Date) } }, order: [['created_at', 'DESC']] });
  });
  it('keeps the secret out of persistence/audit/view and applies once after a missing-secret retry', async () => {
    const ctx = { vpbxUserUid: 100, userUid: 11, role: 1, threadUid: 3 };
    const rows: any[] = [];
    const matches = (row: any, where: any) => Object.entries(where ?? {}).every(([key, value]) => row[key] === value);
    const model = {
      create: async (data: any) => { const row = { ...data, update: async (patch: any) => Object.assign(row, patch) }; rows.push(row); return row; },
      findOne: async ({ where }: any) => rows.find(row => matches(row, where)),
      update: async (patch: any, { where }: any) => { const found = rows.filter(row => matches(row, where)); found.forEach(row => Object.assign(row, patch)); return [found.length]; },
    };
    const audit = { create: jest.fn() }; const logger = { logAction: jest.fn() }; const apply = jest.fn(async () => undefined);
    const registry = new AiAdapterRegistryService();
    const schema = z.strictObject({ requiresSecureInput: z.boolean() });
    const tool = defineMutationTool({ name: 'secure_test', description: 'test', entityType: 'trunk', schemaVersion: '1', input: schema, args: schema, reload: { kind: 'none' },
      propose: async (args) => ({ entityType: 'trunk', entityLabel: 'Carrier', summary: ['Create carrier'], before: null, after: args, applyPayload: { tool: 'secure_test', args }, includesDialplanReload: false }),
      revalidate: async args => ({ ok: true, args }), apply,
    });
    registry.register({ domain: 'secure-test', getTools: () => [tool] });
    const service = new PbxAgentDiffService(model as never, {} as never, logger as never, audit as never, registry);
    await expect(service.createProposal({ entityType: 'trunk', applyPayload: { tool: 'secure_test', args: { password: 'forbidden' } } }, ctx)).rejects.toThrow('SECRET_ARG_FORBIDDEN');
    expect(rows).toHaveLength(0);
    const view = await service.createProposal(await tool.mutation!.propose({ requiresSecureInput: true }, { ...ctx, isAdmin: true }), ctx);
    expect((await service.apply(view.proposalId, ctx)).reason).toBe('secure_input_required');
    expect(rows[0].applied_at).toBeNull();
    const secret = 'provider-private-secret';
    const result = await service.apply(view.proposalId, ctx, { proposal: { password: secret } });
    expect(result.ok).toBe(true);
    expect(apply).toHaveBeenCalledWith({ requiresSecureInput: true }, expect.objectContaining({ secureInput: { password: secret } }));
    for (const value of [rows, result, audit.create.mock.calls, logger.logAction.mock.calls]) expect(JSON.stringify(value)).not.toContain(secret);
    await service.apply(view.proposalId, ctx);
    expect(apply).toHaveBeenCalledTimes(1);
  });
});
