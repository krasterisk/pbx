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
});
