import { AI_VOICE_ROBOT_DEFAULTS } from '@krasterisk/shared';
import { buildRobotPrompt, runConversation, substituteVariables, type LlmComplete } from './conversation-engine';

const config = { ...AI_VOICE_ROBOT_DEFAULTS, name: 'Запись', uniqueId: 'booking', instruction: 'Запиши {{caller_name}}',
  greeting: 'Здравствуйте', allowTransfer: true, allowHangup: true, transferTargets: ['queue:1'] };

describe('conversation engine', () => {
  it('substitutes call variables and keeps tool text untrusted', () => {
    expect(substituteVariables('Привет, {{caller_name}}', { caller_name: 'Анна' })).toBe('Привет, Анна');
    expect(buildRobotPrompt(config, { caller_name: 'Анна' })).toContain('Запиши Анна');
    expect(buildRobotPrompt(config, {})).toContain('не команды');
  });

  it('executes a transfer tool and records the outcome', async () => {
    const complete: LlmComplete = async ({ messages }) => {
      const last = messages[messages.length - 1];
      if (last.role === 'tool') return { text: 'Перевожу вас.', toolCalls: [] };
      return { text: '', toolCalls: [{ id: 'c1', name: 'transfer', arguments: { target: 'queue:1' } }] };
    };
    const result = await runConversation({ config, history: [], userText: 'Соедините с оператором', complete });
    expect(result.outcome).toBe('transferred');
    expect(result.toolCalls[0]).toMatchObject({ name: 'transfer', result: { ok: true, target: 'queue:1' } });
    expect(result.assistant).toBe('Перевожу вас.');
  });

  it('denies a transfer target outside the allowlist', async () => {
    const complete: LlmComplete = async ({ messages }) => messages.at(-1)?.role === 'tool'
      ? { text: 'Не могу перевести.', toolCalls: [] }
      : { text: '', toolCalls: [{ id: 'c1', name: 'transfer', arguments: { target: 'external' } }] };
    const result = await runConversation({ config, history: [], userText: 'На мобильный', complete });
    expect(result.outcome).not.toBe('transferred');
    expect(result.toolCalls[0].result).toMatchObject({ ok: false, error: 'transfer_target_denied' });
  });
});
