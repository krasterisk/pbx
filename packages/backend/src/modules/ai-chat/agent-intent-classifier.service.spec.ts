import { AgentSkillRegistryService } from '../ai-platform/agent-skill-registry.service';
import { AiAdapterRegistryService } from '../ai-platform/ai-adapter-registry.service';
import { AgentIntentClassifierService } from './agent-intent-classifier.service';

describe('AgentIntentClassifierService', () => {
  const registry = new AiAdapterRegistryService();
  const skills = new AgentSkillRegistryService(registry);
  const classifier = new AgentIntentClassifierService(skills);
  it('keeps route intent despite references to existing contexts, IVRs and subscribers', () => {
    const result = classifier.classify({ message: 'В контексте ctx-356 создай внутренний маршрут номера 700 в существующее IVR. Само меню и абонентов повторно не создавай.' });
    expect(result.skillNames[0]).toBe('routes');
    expect(classifier.filterToolNames(['create_route', 'list_ivrs'], result)).toContain('create_route');
  });

  it('selects registration evidence rather than a setup recipe for support', () => {
    const result = classifier.classify({ message: 'У абонента 101 нет регистрации, звонок не проходит. Проверь регистрацию. Настройки не меняй.' });
    expect(result.skillNames).toContain('registration-support');
    expect(classifier.filterToolNames(['get_endpoint_registration', 'get_recent_call_events'], result))
      .toContain('get_endpoint_registration');
  });

  it('keeps domain tools whose names do not contain the domain plural', () => {
    for (const [domain, names] of Object.entries({ conferences: ['create_conference_room', 'list_conference_rooms'],
      callcenter: ['cc_get_agents', 'cc_get_queue_snapshot'], users: ['list_portal_users', 'describe_portal_user'] })) {
      const filtered = classifier.filterToolNames([...names, 'create_trunk'], {
        domains: [domain], confidence: 1, intents: [], skillNames: [], source: 'deterministic',
      });
      expect(filtered).toEqual(names);
    }
  });

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

  it('selects time-groups for a calendar request and keeps create_time_group', () => {
    const result = classifier.classify({
      message: 'Нужен календарь: будни 08-17, суббота 09-15',
    });
    expect(result.skillNames).toEqual(expect.arrayContaining(['time-groups']));
    const filtered = classifier.filterToolNames(
      ['list_time_groups', 'create_time_group', 'create_trunk', 'list_skills'],
      { ...result, confidence: 0.9 },
    );
    expect(filtered).toEqual(expect.arrayContaining(['list_time_groups', 'create_time_group', 'list_skills']));
    expect(filtered).not.toContain('create_trunk');
  });

  it('keeps list_dialplan_apps on an IVR turn', () => {
    const classification = classifier.classify({
      message: 'Создай IVR Продажи с таймаутом в группу 101-103',
    });
    const filtered = classifier.filterToolNames(
      ['list_skills', 'create_ivr', 'list_dialplan_apps', 'create_trunk'],
      { ...classification, confidence: 0.9 },
    );
    expect(classifier.isAlwaysAvailableTool('list_dialplan_apps')).toBe(true);
    expect(filtered).toContain('list_dialplan_apps');
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
