import { parseJsonObject } from './analysis-prompt';
import { deepseekStructuredParams, normalizeSpeakerRole, readSpeakerRoles } from './provider-analysis';

describe('deepseekStructuredParams', () => {
  it('turns thinking off for deepseek-flash so the score is JSON', () => {
    expect(deepseekStructuredParams('deepseek-flash', 'https://api.deepseek.com/')).toEqual({
      thinking: { type: 'disabled' },
      reasoning_effort: 'none',
    });
  });

  it('leaves other providers unchanged', () => {
    expect(deepseekStructuredParams('gpt-4.1', 'https://api.openai.com/v1')).toEqual({});
  });
});

describe('readSpeakerRoles', () => {
  it('reads indexed roles and russian names', () => {
    expect(readSpeakerRoles({
      roles: [
        { i: 0, role: 'оператор' },
        { i: 1, role: 'клиент' },
      ],
    }, 2)).toEqual(['operator', 'customer']);
  });

  it('reads a parallel list of the same length', () => {
    expect(readSpeakerRoles({ roles: ['operator', 'customer'] }, 2)).toEqual(['operator', 'customer']);
  });

  it('keeps the roles list when each item is also a JSON object', () => {
    const raw = '{"roles":[{"i":0,"role":"operator"},{"i":1,"role":"customer"}]}';
    expect(readSpeakerRoles(parseJsonObject(raw), 2)).toEqual(['operator', 'customer']);
  });

  it('rejects a list whose length does not match the lines', () => {
    expect(readSpeakerRoles({ roles: ['operator'] }, 2)).toBeNull();
    expect(normalizeSpeakerRole('пациент')).toBe('customer');
  });
});
