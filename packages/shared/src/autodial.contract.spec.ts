import { autodialScenarioActionSchema, autodialScenarioJsonSchema } from './autodial.contract';

describe('autodial runtime scenario contract', () => {
  it('accepts the editor spelling and rejects guesses before proposal creation', () => {
    expect(autodialScenarioActionSchema.safeParse({ type: 'collect_input', params: {
      variableName: 'AC_CHOICE', promptFile: 'question.wav', digitsCount: 1, mode: 'digits', timeout: 10,
    } }).success).toBe(true);
    expect(autodialScenarioActionSchema.safeParse({ type: 'collect_input', params: { guessed_prompt: 'x' } }).success).toBe(false);
    expect(autodialScenarioActionSchema.safeParse({ type: 'cmd', params: { command: 'anything' } }).success).toBe(false);
  });
  it('restricts destinations and dangerous prompt/variable syntax', () => {
    expect(autodialScenarioActionSchema.safeParse({ type: 'toqueue', params: { target: { source: 'variable', name: 'X' } } }).success).toBe(false);
    expect(autodialScenarioActionSchema.safeParse({ type: 'collect_input', params: { promptFile: '../tenant/file' } }).success).toBe(false);
    expect(autodialScenarioActionSchema.safeParse({ type: 'collect_input', params: { variableName: 'X)=bad' } }).success).toBe(false);
  });
  it('accepts the shared editor legacy empty condition but refuses an actual branch', () => {
    expect(autodialScenarioActionSchema.safeParse({ type: 'hangup', params: {}, condition: { dialstatus: '' } }).success).toBe(true);
    expect(autodialScenarioActionSchema.safeParse({ type: 'hangup', params: {}, condition: { dialstatus: 'ANSWER' } }).success).toBe(false);
  });
  it('publishes discriminated parameter schemas for the same ten compiler actions', () => {
    const json = autodialScenarioJsonSchema() as { oneOf: Array<{ properties: { type: { const: string } } }> };
    expect(json.oneOf).toHaveLength(10);
    expect(json.oneOf.map((item) => item.properties.type.const)).toContain('collect_input');
  });
});
