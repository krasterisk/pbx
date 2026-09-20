import fs from 'fs';
import path from 'path';
import { generatedDurableLabDialplan } from './route-recording.util';

describe('generated-route MixMonitor lab dialplan', () => {
  it('matches the isolated Asterisk generated.conf', () => {
    const file = fs.readFileSync(
      path.resolve(__dirname, '../../../../../harness/asterisk/ai-lab/generated.conf'),
      'utf8',
    );
    expect(generatedDurableLabDialplan(8).replace(/\r\n/g, '\n').trim())
      .toBe(file.replace(/\r\n/g, '\n').trim());
  });
});
