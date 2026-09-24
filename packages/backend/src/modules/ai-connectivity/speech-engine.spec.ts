import {
  mapLegacySpeechEngine,
  mergeCatalogDefaults,
  remapSpeechUid,
  repairLegacySpeechProvider,
  rewriteIvrPrompts,
  rewriteNotifyDispatch,
  rewriteRouteActions,
  toSpeechEngine,
} from './speech-engine';

describe('speech engine catalog mapping', () => {
  it('turns a cabinet engine into a global provider of that capability', () => {
    const mapped = mapLegacySpeechEngine({
      uid: 4,
      name: 'Yandex Alena',
      type: 'yandex',
      token: 'secret',
      settings: { voice: 'alena' },
      custom_url: '',
      auth_mode: 'bearer',
      custom_headers: { 'X-Folder': '1' },
    }, 'tts');

    expect(mapped.is_global).toBe(true);
    expect(mapped.user_uid).toBe(0);
    expect(mapped.capabilities).toEqual(['tts']);
    expect(mapped.vendor).toBe('yandex');
    expect(mapped.kind).toBe('online');
    expect(mapped.plainToken).toBe('secret');
    expect(mapped.defaults.legacyEngine).toEqual({ kind: 'tts', uid: 4 });
    expect(mapped.defaults.customHeaders).toEqual({ 'X-Folder': '1' });
    expect(mapped.endpoint).toBe('https://tts.api.cloud.yandex.net');
    expect(mapped.auth_type).toBe('bearer');
  });

  it('treats a stored Yandex token as bearer even when the old auth mode was none', () => {
    const mapped = mapLegacySpeechEngine({
      uid: 1,
      name: 'Yandex STT',
      type: 'yandex',
      token: 'secret',
      settings: { model: 'general', language_code: 'ru-RU' },
      custom_url: '',
      auth_mode: 'none',
    }, 'stt');
    expect(mapped.endpoint).toBe('https://stt.api.cloud.yandex.net');
    expect(mapped.auth_type).toBe('bearer');
  });

  it('repairs an already copied row and keeps bookkeeping when the form saves a partial defaults object', () => {
    const repaired = repairLegacySpeechProvider({
      vendor: 'yandex',
      endpoint: '',
      auth_type: 'none',
      capabilities: ['tts'],
      defaults: { voice: 'jane', emotion: 'neutral', legacyEngine: { kind: 'tts', uid: 1 } },
      hasKey: true,
    });
    expect(repaired).toMatchObject({
      endpoint: 'https://tts.api.cloud.yandex.net',
      auth_type: 'bearer',
    });
    expect(repaired?.defaults?.role).toBe('neutral');
    expect(mergeCatalogDefaults(
      { voice: 'jane', legacyEngine: { kind: 'tts', uid: 1 }, customHeaders: {} },
      { voice: 'filipp', speed: '1.0' },
    )).toEqual({
      voice: 'filipp',
      speed: '1.0',
      legacyEngine: { kind: 'tts', uid: 1 },
      customHeaders: {},
    });
  });

  it('rebuilds the factory shape without the catalog bookkeeping keys', () => {
    const engine = toSpeechEngine({
      uid: 9,
      name: 'Custom',
      vendor: 'custom',
      endpoint: 'https://stt.example/v1',
      auth_type: 'bearer',
      defaults: {
        language: 'ru-RU',
        customHeaders: { Authorization: 'Bearer x' },
        legacyEngine: { kind: 'stt', uid: 2 },
      },
    }, 'token-1');

    expect(toSpeechEngine({
      uid: 64,
      name: 'Yandex TTS',
      vendor: 'yandex',
      endpoint: 'https://tts.api.cloud.yandex.net',
      auth_type: 'bearer',
      defaults: { voice: 'jane', emotion: 'neutral', speed: '1.0' },
    }, 'token-1').settings).toMatchObject({ voice: 'jane', role: 'neutral', speed: '1.0' });

    expect(engine).toEqual({
      uid: 9,
      name: 'Custom',
      type: 'custom',
      token: 'token-1',
      settings: { language: 'ru-RU' },
      custom_url: 'https://stt.example/v1',
      auth_mode: 'bearer',
      custom_headers: { Authorization: 'Bearer x' },
    });
  });

  it('rewrites IVR, route and voicemail references and leaves an already migrated uid', () => {
    const tts = new Map([[4, 40]]);
    const stt = new Map([[2, 20]]);
    const legacy = new Map([[40, 4]]);

    expect(rewriteIvrPrompts([
      { kind: 'tts', engine_uid: 4, text: 'a' },
      { kind: 'audio', file: 'beep' },
    ], tts)).toEqual([
      { kind: 'tts', engine_uid: 40, text: 'a' },
      { kind: 'audio', file: 'beep' },
    ]);
    expect(rewriteIvrPrompts([{ kind: 'tts', engine_uid: 40, text: 'a' }], tts, legacy)).toEqual([
      { kind: 'tts', engine_uid: 40, text: 'a' },
    ]);
    expect(rewriteRouteActions([
      { type: 'text2speech', params: { engine: 4, text: 'hi' } },
      { type: 'voicemail', params: { stt_engine_uid: 2 } },
    ], { tts, stt })).toEqual([
      { type: 'text2speech', params: { engine: 40, text: 'hi' } },
      { type: 'voicemail', params: { stt_engine_uid: 20 } },
    ]);
    expect(rewriteNotifyDispatch(JSON.stringify({ stt_engine_uid: 2 }), stt))
      .toBe(JSON.stringify({ stt_engine_uid: 20 }));
    expect(remapSpeechUid(40, tts, legacy)).toBe(40);
  });
});
