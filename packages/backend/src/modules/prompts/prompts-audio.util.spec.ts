import * as path from 'path';
import {
  promptAudioCandidates,
  resolveUnderDir,
  sanitizePromptFilename,
} from './prompts-audio.util';

describe('prompts-audio.util', () => {
  it('rejects path traversal in filename', () => {
    expect(sanitizePromptFilename('../evil')).toBeNull();
    expect(sanitizePromptFilename('ok/file')).toBeNull();
  });

  it('builds extension candidates for basename without ext', () => {
    expect(promptAudioCandidates('welcome')).toEqual([
      'welcome.wav',
      'welcome.WAV',
      'welcome.gsm',
      'welcome.mp3',
      'welcome',
    ]);
  });

  it('resolveUnderDir blocks escape from sounds directory', () => {
    const dir = '/usr/records/1/sounds';
    expect(resolveUnderDir(dir, '../secret.wav')).toBeNull();
    expect(resolveUnderDir(dir, 'a.wav')).toBe(path.resolve(dir, 'a.wav'));
  });
});
