import { PbxWorkflowCompilerService } from './pbx-workflow-compiler.service';
import { AiAdapterRegistryService } from '../ai-platform/ai-adapter-registry.service';
import { defineMutationTool } from '../ai-platform/ai-mutation.contract';
import { z } from 'zod';

describe('PbxWorkflowCompilerService', () => {
  const registry = new AiAdapterRegistryService();
  registry.register({
    domain: 'wf_test',
    getTools: () => [
      defineMutationTool({
        name: 'create_directory',
        description: 'test',
        entityType: 'directory',
        schemaVersion: 'directories-1',
        input: z.strictObject({ name: z.string() }),
        args: z.strictObject({ name: z.string() }),
        reload: { kind: 'none' },
        propose: async (input) => ({
          entityType: 'directory',
          entityLabel: input.name,
          summary: [`Create ${input.name}`],
          before: null,
          after: input,
          applyPayload: { tool: 'create_directory', args: input },
          includesDialplanReload: false,
        }),
        revalidate: async (args) => ({ ok: true, args }),
        apply: async () => undefined,
      }),
    ],
  });
  const compiler = new PbxWorkflowCompilerService(registry);

  it('rejects cyclic dependency graphs', async () => {
    await expect(
      compiler.compile(
        {
          steps: [
            { id: 'a', tool: 'create_directory', args: { name: 'A' }, dependsOn: ['b'] },
            { id: 'b', tool: 'create_directory', args: { name: 'B' }, dependsOn: ['a'] },
          ],
        },
        { vpbxUserUid: 1, userUid: 2, role: 1 },
      ),
    ).rejects.toThrow(/CYCLE/);
  });

  it('compiles a linear two-step draft', async () => {
    const compiled = await compiler.compile(
      {
        title: 'Dirs',
        steps: [
          { id: 'vip', tool: 'create_directory', args: { name: 'VIP' } },
          {
            id: 'staff',
            tool: 'create_directory',
            args: { name: 'Staff' },
            dependsOn: ['vip'],
          },
        ],
      },
      { vpbxUserUid: 1, userUid: 2, role: 1 },
    );
    expect(compiled.steps).toHaveLength(2);
    expect(compiled.steps[1].dependsOn).toEqual(['vip']);
    expect(compiled.steps[0].schemaVersion).toBe('directories-1');
  });
  it('validates a planned autodial base before creating a campaign and preserves the runtime reference', async () => {
    const live = new AiAdapterRegistryService();
    const fields = [{ key: 'phone', label: 'Phone', type: 'phone', var_name: 'AC_PHONE' }];
    const proposeCampaign = jest.fn(async (args, ctx) => {
      expect(ctx.planned.autodialBases).toEqual([{ uid: args.base_uid, fields }]);
      return { entityType: 'autodial_campaign', entityLabel: 'Campaign', summary: [], before: null, after: args,
        applyPayload: { tool: 'create_autodial_campaign', args }, includesDialplanReload: false };
    });
    const baseSchema = z.strictObject({ name: z.string(), fields: z.array(z.record(z.string(), z.string())) });
    const campaignSchema = z.strictObject({ name: z.string(), base_uid: z.number().int().positive() });
    live.register({ domain: 'autodial-test', getTools: () => [
      defineMutationTool({ name: 'create_autodial_base', description: '', entityType: 'autodial_base', schemaVersion: 'test',
        input: baseSchema, args: baseSchema, reload: { kind: 'none' },
        propose: async (args) => ({ entityType: 'autodial_base', entityLabel: args.name, summary: [], before: null, after: args,
          applyPayload: { tool: 'create_autodial_base', args }, includesDialplanReload: false }),
        revalidate: async (args) => ({ ok: true, args }), apply: async () => ({ uid: 8 }) }),
      defineMutationTool({ name: 'create_autodial_campaign', description: '', entityType: 'autodial_campaign', schemaVersion: 'test',
        input: campaignSchema, args: campaignSchema, reload: { kind: 'none' }, propose: proposeCampaign,
        revalidate: async (args) => ({ ok: true, args }), apply: async () => undefined }),
    ] });
    const compiler = new PbxWorkflowCompilerService(live);
    const compiled = await compiler.compile({ steps: [
      { id: 'base', tool: 'create_autodial_base', args: { name: 'Base', fields } },
      { id: 'campaign', tool: 'create_autodial_campaign', args: { name: 'Campaign', base_uid: 'steps.base.result.uid' } },
    ] }, { vpbxUserUid: 1, userUid: 2, role: 1 });
    expect(compiled.steps[1].canonicalArgs.base_uid).toBe('steps.base.result.uid');
    expect(compiled.steps[1].dependsOn).toEqual(['base']);
    await expect(compiler.compile({ steps: [{ id: 'campaign', tool: 'create_autodial_campaign',
      args: { name: 'Campaign', base_uid: 'steps.future.result.uid' } }] }, { vpbxUserUid: 1, userUid: 2, role: 1 }))
      .rejects.toThrow('WORKFLOW_INVALID_AUTODIAL_BASE_REF');
  });
});
