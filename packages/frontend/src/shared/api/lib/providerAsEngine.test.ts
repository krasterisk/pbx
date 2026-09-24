import { describe, expect, it } from 'vitest';
import { providerAsEngine } from './providerAsEngine';
import type { IAiProvider } from '../endpoints/aiAgentsApi';

function provider(partial: Partial<IAiProvider>): IAiProvider {
  return {
    uid: 1,
    name: 'Yandex',
    kind: 'online',
    vendor: 'yandex',
    endpoint: '',
    auth_type: 'bearer',
    capabilities: ['tts'],
    defaults: {},
    enabled: true,
    user_uid: 7,
    ...partial,
  };
}

describe('providerAsEngine', () => {
  it('maps vendor and defaults and drops catalog bookkeeping', () => {
    const engine = providerAsEngine(provider({
      defaults: { voice: 'alena', customHeaders: { 'X-Folder': '1' }, legacyEngine: { kind: 'tts', uid: 4 } },
    }));
    expect(engine.type).toBe('yandex');
    expect(engine.settings).toEqual({ voice: 'alena' });
    expect(engine.custom_headers).toEqual({ 'X-Folder': '1' });
  });

  it('does not treat a global row as a cabinet engine by itself', () => {
    const rows = [provider({ is_global: true, capabilities: ['tts'] }), provider({ capabilities: ['stt'] })];
    const tts = rows.filter((row) => row.is_global !== true && row.capabilities?.includes('tts'));
    expect(tts).toEqual([]);
  });
});