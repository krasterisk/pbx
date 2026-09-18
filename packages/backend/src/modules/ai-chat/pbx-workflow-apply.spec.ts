import { z } from 'zod';
import { PbxWorkflowRunnerService } from './pbx-workflow-runner.service';

const ctx = { userUid: 7, vpbxUserUid: 42, role: 1 };
function fixture() {
  const row: any = { uid: 1, workflow_id: 'test', status: 'pending', expires_at: new Date(Date.now() + 60000),
    update: jest.fn(async (values) => Object.assign(row, values)), reload: jest.fn(async () => row) };
  const step: any = { step_key: 'first', status: 'pending', attempts: 0, canonical_args: {},
    schema_version: 'v1', tool: 'create', update: jest.fn(async (values) => Object.assign(step, values)) };
  const model = { findOne: jest.fn(async () => row), update: jest.fn(async (values) => {
    if (!['pending', 'failed'].includes(row.status)) return [0];
    Object.assign(row, values); return [1];
  }) };
  const mutation = { schemaVersion: 'v1', args: z.object({}), reload: { kind: 'dialplan-context', contextUid: () => 9 },
    revalidate: jest.fn(async () => ({ ok: true, args: {} })), apply: jest.fn(async () => ({ uid: 5 })) };
  const reload = jest.fn(async () => undefined);
  const make = () => new PbxWorkflowRunnerService(model as any, { findAll: async () => [step] } as any,
    {} as any, { getMutationTool: () => ({ mutation }) } as any, { applyContext: reload } as any, {} as any);
  return { row, step, model, mutation, reload, make };
}

describe('workflow durable apply', () => {
  it('retries only reload after the domain write has committed', async () => {
    const f = fixture();
    f.reload.mockRejectedValueOnce(new Error('AMI unavailable'));
    expect((await f.make().apply('test', ctx)).status).toBe('failed');
    expect(f.step.result_json.__execution.writeCompleted).toBe(true);
    expect((await f.make().apply('test', ctx)).status).toBe('applied');
    expect(f.mutation.apply).toHaveBeenCalledTimes(1);
    expect(f.reload).toHaveBeenCalledTimes(2);
    expect(f.reload).toHaveBeenLastCalledWith(9, 42, true);
  });

  it('retains an ambiguous write claim and never re-executes it', async () => {
    const f = fixture();
    f.mutation.apply.mockRejectedValueOnce(new Error('connection lost after commit'));
    expect((await f.make().apply('test', ctx)).status).toBe('applying');
    expect(f.row.error).toContain('WRITE_OUTCOME_UNKNOWN');
    await f.make().apply('test', ctx);
    expect(f.mutation.apply).toHaveBeenCalledTimes(1);
  });

  it('claims across service instances before calling the mutation', async () => {
    const f = fixture();
    await Promise.all([f.make().apply('test', ctx), f.make().apply('test', ctx)]);
    expect(f.mutation.apply).toHaveBeenCalledTimes(1);
  });

  it('refuses read-only callers without changing the pending card', async () => {
    const f = fixture();
    await expect(f.make().apply('test', { ...ctx, role: 5 })).rejects.toThrow('Read-only');
    expect(f.model.update).not.toHaveBeenCalled();
    expect(f.mutation.apply).not.toHaveBeenCalled();
  });
});
