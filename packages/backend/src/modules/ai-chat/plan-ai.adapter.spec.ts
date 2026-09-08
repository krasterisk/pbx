import { AiAdapterRegistryService } from '../ai-platform/ai-adapter-registry.service';
import { AgentIntentClassifierService } from './agent-intent-classifier.service';
import { PlanAiAdapter } from './plan-ai.adapter';
import type { PbxWorkflowRunnerService } from './pbx-workflow-runner.service';

const THREE_STEPS = [
  { id: 'group', tool: 'create_call_group', args: { name: 'Приёмная', exten: '9010' } },
  { id: 'ivr', tool: 'create_ivr', args: { name: 'IVR - Приёмная' }, dependsOn: ['group'] },
  { id: 'route', tool: 'create_route', args: { name: 'DID' }, dependsOn: ['ivr'] },
];

const CALLER_CTX = { userUid: 11, role: 1, threadUid: 5 };

describe('PlanAiAdapter', () => {
  let registry: AiAdapterRegistryService;
  let workflows: { createFromDraft: jest.Mock };
  let adapter: PlanAiAdapter;

  const tool = () => adapter.getTools()[0];

  beforeEach(() => {
    registry = new AiAdapterRegistryService();
    workflows = {
      createFromDraft: jest.fn(async (draft: { title?: string; steps: unknown[] }) => {
        if (!Array.isArray(draft.steps) || draft.steps.length === 0) {
          throw new Error('WORKFLOW_EMPTY');
        }
        return {
          workflowId: 'w-plan-1',
          title: draft.title ?? '',
          summary: [],
          status: 'pending',
          error: null,
          expiresAt: new Date().toISOString(),
          appliedAt: null,
          steps: draft.steps,
        };
      }),
    };
    adapter = new PlanAiAdapter(registry, workflows as unknown as PbxWorkflowRunnerService);
  });

  it('registers a single always-available propose_plan tool', () => {
    expect(adapter.getTools()).toHaveLength(1);
    expect(tool().name).toBe('propose_plan');
    expect(tool().proposes).toBe(true);
    expect(tool().mutation).toBeUndefined();
  });

  it('compiles the draft into one workflow card', async () => {
    const result = await tool().handler(
      { title: 'Приёмная', steps: THREE_STEPS },
      100,
      CALLER_CTX,
    );
    expect(workflows.createFromDraft).toHaveBeenCalledTimes(1);
    expect(result).toEqual(expect.objectContaining({ workflowId: expect.any(String), steps: expect.any(Array) }));
  });

  it('refuses an empty plan with a readable message, not a stack trace', async () => {
    const result = await tool().handler({ title: 'Пусто', steps: [] }, 100, CALLER_CTX);
    expect(result).toEqual(expect.objectContaining({ refused: true }));
    const text = typeof result === 'string' ? result : JSON.stringify(result);
    expect(text).not.toMatch(/at Object\.|at async |stack/i);
    expect(text).not.toContain('WORKFLOW_EMPTY');
    expect(String((result as { message?: unknown }).message ?? '')).toMatch(/план|шаг/i);
  });

  it('propagates the caller context instead of a zeroed one', async () => {
    await tool().handler({ title: 'Приёмная', steps: THREE_STEPS }, 100, CALLER_CTX);
    expect(workflows.createFromDraft).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Приёмная', steps: THREE_STEPS }),
      expect.objectContaining({ vpbxUserUid: 100, userUid: 11, role: 1, threadUid: 5 }),
    );
    const passed = workflows.createFromDraft.mock.calls[0][1] as Record<string, number>;
    expect(passed.userUid).not.toBe(0);
    expect(passed.threadUid).not.toBe(0);
  });

  it('is listed as always available for the loop', () => {
    expect(new AgentIntentClassifierService().isAlwaysAvailableTool('propose_plan')).toBe(true);
  });
});
