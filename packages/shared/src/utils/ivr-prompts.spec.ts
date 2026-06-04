import {
  normalizeIvrPrompts,
  assertIvrPromptsForSave,
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
});
