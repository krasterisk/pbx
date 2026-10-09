import { ContextsAiAdapter } from './contexts-ai.adapter';
import { parseMutationInput } from '../ai-platform/ai-mutation.contract';

const ctx = { vpbxUserUid: 100, userUid: 11, role: 1, isAdmin: true };

describe('ContextsAiAdapter ordered routing configuration', () => {
  function fixture() {
    const rows = [
      { uid: 1, name: 'Access', include_uids: [2, 3] },
      { uid: 2, name: 'Internal', include_uids: [4] },
      { uid: 3, name: 'National', include_uids: [4] },
      { uid: 4, name: 'Shared', include_uids: [] },
    ];
    const service = {
      findAll: jest.fn(async () => rows),
      findOne: jest.fn(async (uid: number) => {
        const row = rows.find((candidate) => candidate.uid === uid);
        if (!row) throw new Error('Context not found');
        return row;
      }),
      update: jest.fn(), create: jest.fn(async () => ({ uid: 5, name: 'New' })), remove: jest.fn(),
    };
    const applyService = { applyContext: jest.fn(async () => ({ success: true })), clearContext: jest.fn() };
    const adapter = new ContextsAiAdapter(service as never, {} as never, { get: () => applyService } as never);
    const tool = (name: string) => adapter.getTools().find((candidate) => candidate.name === name)!;
    return { rows, service, applyService, adapter, tool };
  }

  it('reads tenant-scoped own-first depth-first search order with diamond deduplication', async () => {
    const { tool, service } = fixture();
    const result = await tool('get_context_configuration').handler({ uid: 1 }, 100) as any;
    expect(service.findAll).toHaveBeenCalledWith(100);
    expect(result.search_order.map((node: any) => node.uid)).toEqual([1, 2, 4, 3]);
    expect(result.ordered_includes.map((node: any) => node.name)).toEqual(['Internal', 'National']);
    await expect(tool('get_context_configuration').handler({ uid: 99 }, 100)).rejects.toThrow('not found');
  });

  it('previews reordered names and rejects cycles before proposal and again at confirmation', async () => {
    const { tool, rows } = fixture();
    const mutation = tool('update_context').mutation!;
    const proposal = await mutation.propose({ uid: 1, include_uids: [3, 2] }, ctx) as any;
    expect(proposal.before.ordered_includes.map((node: any) => node.name)).toEqual(['Internal', 'National']);
    expect(proposal.after.ordered_includes.map((node: any) => node.name)).toEqual(['National', 'Internal']);
    expect(proposal.summary.join(' ')).toContain('National → Internal');
    await expect(mutation.propose({ uid: 4, include_uids: [1] }, ctx)).rejects.toThrow('cycle');
    rows[3].include_uids = [1];
    expect(await mutation.revalidate({ uid: 1, include_uids: [3, 2] }, ctx)).toMatchObject({ ok: false });
  });

  it('reads Sequelize-style prototype attribute getters rather than spreading a model instance', async () => {
    const { rows, tool } = fixture();
    rows[0] = Object.create({ get uid() { return 1; }, get name() { return 'Access'; }, get include_uids() { return [2, 3]; } });
    const result = await tool('get_context_configuration').handler({ uid: 1 }, 100) as any;
    expect(result.uid).toBe(1);
    expect(result.name).toBe('Access');
    expect(result.search_order.map((node: any) => node.uid)).toEqual([1, 2, 4, 3]);
  });

  it('distinguishes omitted includes from an empty replacement and rejects foreign references', async () => {
    const { tool } = fixture();
    const mutation = tool('update_context').mutation!;
    const preserved = await mutation.propose({ uid: 1, comment: 'Keep' }, ctx) as any;
    const removed = await mutation.propose({ uid: 1, include_uids: [] }, ctx) as any;
    expect(preserved.after.include_uids).toEqual([2, 3]);
    expect(removed.after.ordered_includes).toEqual([]);
    await expect(mutation.propose({ uid: 1, include_uids: [99] }, ctx)).rejects.toThrow('this tenant');
    expect(() => parseMutationInput(mutation, { uid: 1, include_uids: [2, 2] })).toThrow('Duplicate');
  });

  it('checkpoints updates before central reload so retry does not repeat the database write', async () => {
    const { tool, service, applyService } = fixture();
    const mutation = tool('update_context').mutation!;
    expect(mutation.reload.kind).toBe('dialplan-context');
    await mutation.apply({ uid: 1, include_uids: [3] }, ctx);
    expect(service.update).toHaveBeenCalledWith(1, { include_uids: [3] }, 100);
    expect(applyService.applyContext).not.toHaveBeenCalled();
  });

  it('retry apply requires canonical confirmation and performs no database mutation', async () => {
    const { tool, service } = fixture();
    const retry = tool('apply_context');
    expect(retry.proposes).toBe(true);
    expect(retry.mutation!.reload.kind).toBe('dialplan-context');
    const proposal = await retry.mutation!.propose({ uid: 1 }, ctx) as any;
    expect(proposal.applyPayload).toMatchObject({ tool: 'apply_context', args: { uid: 1 } });
    await retry.mutation!.apply({ uid: 1 }, ctx);
    expect(service.create).not.toHaveBeenCalled();
    expect(service.update).not.toHaveBeenCalled();
    expect(service.remove).not.toHaveBeenCalled();
  });

  it('validates create includes and applies the generated context UID', async () => {
    const { tool, applyService } = fixture();
    const mutation = tool('create_context').mutation!;
    await expect(mutation.propose({ name: 'New', include_uids: [99] }, ctx)).rejects.toThrow('this tenant');
    await mutation.apply({ name: 'New', include_uids: [2] }, ctx);
    expect(applyService.applyContext).toHaveBeenCalledWith(5, 100, true);
  });

  it('deletion safely narrows ModuleRef and clears both removed context and parent dialplan', async () => {
    const { tool, service, applyService } = fixture();
    await tool('delete_context').mutation!.apply({ uid: 2 }, ctx);
    expect(service.remove).toHaveBeenCalledWith(2, 100);
    expect(applyService.clearContext).toHaveBeenCalledWith('Internal', 100);
    expect(applyService.applyContext).toHaveBeenCalledWith(1, 100, true);
  });

  it('reports saved UID after failed creation apply, enabling retry without duplicate creation', async () => {
    const { tool, applyService } = fixture();
    applyService.applyContext.mockRejectedValueOnce(new Error('AMI unavailable'));
    await expect(tool('create_context').mutation!.apply({ name: 'New' }, ctx)).rejects.toThrow('uid=5');
  });

  it('offers and enforces the same identifier rules through MCP mutation schemas', () => {
    const { tool } = fixture();
    for (const name of ['create_context', 'update_context']) {
      const mutation = tool(name).mutation!;
      const args = name === 'update_context' ? { uid: 1 } : {};
      expect(parseMutationInput(mutation, { ...args, name: 'from-internal' })).toMatchObject({ name: 'from-internal' });
      for (const invalid of ['two words', 'Межгород', 'Internal', 'a.b', 'a--b', 'a'.repeat(65)]) {
        expect(() => parseMutationInput(mutation, { ...args, name: invalid })).toThrow();
      }
    }
  });

});
