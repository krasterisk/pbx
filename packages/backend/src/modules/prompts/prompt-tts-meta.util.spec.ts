import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  readTtsMetaFile,
  ttsMetaFileName,
  writeTtsMetaFile,
} from './prompt-tts-meta.util';

describe('prompt-tts-meta.util', () => {
  it('builds sidecar filename', () => {
    expect(ttsMetaFileName('prompt_1_99')).toBe('prompt_1_99.tts.json');
  });

  it('round-trips tts meta json', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'prompt-tts-'));
    const filePath = path.join(dir, 'test.tts.json');
    await writeTtsMetaFile(filePath, {
      text: 'Привет',
      engine_uid: 3,
      settings: { voice: 'alena' },
    });
    const loaded = await readTtsMetaFile(filePath);
    expect(loaded).toEqual({
      text: 'Привет',
      engine_uid: 3,
      settings: { voice: 'alena' },
    });
  });
});
