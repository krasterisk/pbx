import {
  normalizeIvrPrompts,
  assertIvrPromptsForSave,
  getIvrPromptsValidationIssues,
  IvrPromptsValidationError,
} from './ivr-prompts';

describe('normalizeIvrPrompts', () => {
  it('converts filename string to audio', () => {
    expect(normalizeIvrPrompts(['a.wav'])).toEqual([{ kind: 'audio', filename: 'a.wav' }]);
  });

  it('converts tts: prefix to tts with engine_uid 0', () => {
    expect(normalizeIvrPrompts(['tts:hello'])).toEqual([
      { kind: 'tts', text: 'hello', engine_uid: 0 },
    ]);
  });

  it('passes through valid objects', () => {
    const input = [{ kind: 'tts' as const, text: 'Hi', engine_uid: 2 }];
    expect(normalizeIvrPrompts(input)).toEqual(input);
  });
});

describe('assertIvrPromptsForSave', () => {
  it('requires engine for tts', () => {
    expect(() =>
      assertIvrPromptsForSave([{ kind: 'tts', text: 'x', engine_uid: 0 }]),
    ).toThrow(IvrPromptsValidationError);
  });

  it('requires voice when engine settings lack defaults', () => {
    const issues = getIvrPromptsValidationIssues(
      [{ kind: 'tts', text: 'hi', engine_uid: 1 }],
      { engines: [{ uid: 1, type: 'yandex', settings: {} }] },
    );
    expect(issues.some((i) => i.code === 'tts_params_missing')).toBe(true);
  });

  it('passes when engine has default voice', () => {
    const issues = getIvrPromptsValidationIssues(
      [{ kind: 'tts', text: 'hi', engine_uid: 1 }],
      { engines: [{ uid: 1, type: 'yandex', settings: { voice: 'alena' } }] },
    );
    expect(issues).toHaveLength(0);
  });
});
