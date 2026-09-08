import { AgentSkillRegistryService } from '../ai-platform/agent-skill-registry.service';
import { AiAdapterRegistryService } from '../ai-platform/ai-adapter-registry.service';
import { AgentIntentClassifierService } from './agent-intent-classifier.service';

describe('AgentIntentClassifierService', () => {
  const registry = new AiAdapterRegistryService();
  const skills = new AgentSkillRegistryService(registry);
  const classifier = new AgentIntentClassifierService(skills);

  it('selects ivrs, endpoints and call-groups for a clear IVR + subscribers + group request', () => {
    const result = classifier.classify({
      message:
        'Создай IVR Продажи: цифра 1 на 101, 2 на 102, 3 на 103, таймаут в группу абонентов 101-103',
    });
    expect(result.skillNames).toEqual(expect.arrayContaining(['ivrs', 'endpoints', 'call-groups']));
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('filters tools to selected domains while keeping discovery tools', () => {
    const classification = classifier.classify({
      message: 'Создай IVR Продажи с таймаутом в группу 101-103',
    });
    const filtered = classifier.filterToolNames(
      [
        'list_skills',
        'read_skill',
        'get_pbx_state',
        'create_ivr',
        'list_endpoints',
        'create_call_group',
        'create_trunk',
        'delete_trunk',
      ],
      { ...classification, confidence: 0.9 },
    );
    expect(filtered).toEqual(
      expect.arrayContaining(['list_skills', 'read_skill', 'get_pbx_state', 'create_ivr', 'list_endpoints', 'create_call_group']),
    );
    expect(filtered).not.toContain('create_trunk');
  });

  it('selects ivrs, endpoints and call-groups for «ничего не нажали» without the word таймаут', () => {
    const result = classifier.classify({
      message:
        'Создай IVR - Продажи, текст: "Вы позвонили..." Пункты: 1 - Абонент 101 2 - 102 3 - 103 ничего не нажали - группа 101-103',
    });
    expect(result.skillNames).toEqual(expect.arrayContaining(['ivrs', 'endpoints', 'call-groups']));
    expect(result.skillNames).not.toContain('queues');
    expect(result.confidence).toBeGreaterThan(0.5);
  });
});
