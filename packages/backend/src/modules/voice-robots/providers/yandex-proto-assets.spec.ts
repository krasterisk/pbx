import * as fs from 'fs';
import * as path from 'path';
import * as protoLoader from '@grpc/proto-loader';

describe('vendored Yandex SpeechKit proto assets', () => {
  const protoDir = path.join(process.cwd(), 'vendor', 'yandex-cloudapi');
  const includeDirs = [protoDir, path.join(protoDir, 'third_party', 'googleapis')];

  for (const service of [
    'yandex/cloud/ai/stt/v3/stt_service.proto',
    'yandex/cloud/ai/tts/v3/tts_service.proto',
  ]) {
    it(`loads ${service} with all imports`, () => {
      const filename = path.join(protoDir, service);
      expect(fs.existsSync(filename)).toBe(true);
      expect(() => protoLoader.loadSync(filename, { includeDirs })).not.toThrow();
    });
  }
});
