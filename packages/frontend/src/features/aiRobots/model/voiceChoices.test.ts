import { describe, expect, it } from 'vitest';
import { AI_VOICE_ROBOT_DEFAULTS } from '@krasterisk/shared';
import { changeRobotModel, voiceChoices } from './voiceChoices';

describe('donor voice selection', () => {
  it('uses provider-specific voices while retaining stored custom choices', () => {
    expect(voiceChoices('qwen', '', 'custom')).toContain('Cherry');
    expect(voiceChoices('qwen', '', 'custom')).toContain('custom');
    expect(voiceChoices('yandex', '', '')).toContain('alena');
    expect(voiceChoices('openai', '', '')).toContain('marin');
    expect(voiceChoices('custom', '', 'local')).toEqual(['', 'local']);
  });
  it('clears incompatible voice and changes audio formats when changing model family', () => {
    const config = { ...AI_VOICE_ROBOT_DEFAULTS };
    expect(changeRobotModel(config, 'qwen-test')).toMatchObject({ voice: '', inputAudioFormat: 'pcm16', outputAudioFormat: 'pcm16' });
    expect(changeRobotModel(config, 'gpt-test')).toMatchObject({ voice: '', inputAudioFormat: 'g711_alaw' });
    expect(changeRobotModel(config, config.model)).toBe(config);
  });
});
