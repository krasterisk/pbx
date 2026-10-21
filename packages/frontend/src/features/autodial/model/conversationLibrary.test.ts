import { describe, expect, it } from 'vitest';
import { autodialScenarioSchema } from '@krasterisk/shared';
import { conversationTemplate } from './conversationLibrary';

const input = { provider: 3, name: 'AC_NAME', amount: 'AC_DEBT', date: 'AC_DATE', time: 'AC_TIME', queue: 'support', text: (key: string, fields?: Record<string, string>) => `${key} ${Object.values(fields ?? {}).join(' ')}` };
describe('conversation templates', () => {
  it.each(['debt', 'appointment', 'notification', 'operator', 'survey'] as const)('validates %s against the real scenario contract', (goal) => {
    expect(autodialScenarioSchema.safeParse(conversationTemplate({ ...input, goal })).success).toBe(true);
  });
  it('gates the balance behind recipient acknowledgement and ends the wrong-party path before disclosure', () => {
    const actions = conversationTemplate({ ...input, goal: 'debt' });
    const amount = actions.findIndex((step) => step.type === 'text2speech' && String(step.params.text).includes('AC_DEBT_SAY_MONEY'));
    const gate = actions.findIndex((step) => step.type === 'goto' && step.params.condition?.name === 'AC_IDENTITY');
    expect(gate).toBeGreaterThan(0);
    expect(actions[gate]).toMatchObject({ params: { condition: { value: '1' }, label_name: 'debt_details' } });
    expect(actions.slice(gate + 1, amount).some((step) => step.type === 'hangup')).toBe(true);
    expect(actions[amount - 1]).toMatchObject({ type: 'label', params: { label_name: 'debt_details' } });
  });
  it('does not assign a confirmation for missing or invalid appointment input', () => {
    const actions = conversationTemplate({ ...input, goal: 'appointment' });
    expect(actions.find((step) => step.type === 'collect_input')).toMatchObject({ params: { outcomeMap: { '1': 'visit_confirmed', '2': 'visit_reschedule' } } });
    const jumps = actions.filter((step) => step.type === 'goto');
    expect(jumps).toHaveLength(2);
    expect(actions.some((step) => step.type === 'text2speech' && String(step.params.text).includes('unknownEnd'))).toBe(true);
  });
  it('requires an explicitly chosen provider and correctly typed field mappings', () => {
    expect(() => conversationTemplate({ ...input, goal: 'debt', provider: undefined })).toThrow('speech_provider_required');
    expect(() => conversationTemplate({ ...input, goal: 'debt', amount: '' })).toThrow('field_required');
    expect(() => conversationTemplate({ ...input, goal: 'operator', queue: '' })).toThrow('queue_required');
  });
  it('counts both valid survey answers as a received response and keeps missing input outside that goal', () => {
    const actions = conversationTemplate({ ...input, goal: 'survey' });
    const read = actions.find((step) => step.type === 'collect_input');
    expect(read).toMatchObject({ params: { outcomeMap: { '1': 'survey_positive', '2': 'survey_negative' }, outcomeDefinitions: {
      survey_positive: { category: 'positive', goal_relation: 'achieved' }, survey_negative: { category: 'negative', goal_relation: 'achieved' },
    } } });
    const jumps = actions.filter((step) => step.type === 'goto');
    expect(jumps.map((step) => step.params.condition?.value)).toEqual(['1', '2']);
    const firstHangup = actions.findIndex((step) => step.type === 'hangup');
    const received = actions.findIndex((step) => step.type === 'label' && step.params.label_name === 'survey_received');
    expect(firstHangup).toBeLessThan(received);
    expect(actions.every((step) => step.type !== 'text2speech' || step.params.onFailure === 'hangup')).toBe(true);
  });
  it('defines a connection goal explicitly without treating queue entry as success', () => {
    const actions = conversationTemplate({ ...input, goal: 'operator', outcomeLabel: () => 'Connected to support' });
    expect(actions[0]).toMatchObject({ type: 'toqueue', params: { queue: 'support', connectionOutcome: {
      code: 'operator_connected', label: 'Connected to support', category: 'positive', goal_relation: 'achieved',
    } } });
  });
});
