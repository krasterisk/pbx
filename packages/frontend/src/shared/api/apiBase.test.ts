import { afterEach, describe, expect, it, vi } from 'vitest';
import { getEffectiveApiBase, isStandaloneApp, setRuntimeApiBase } from './apiBase';

afterEach(() => { vi.unstubAllEnvs(); setRuntimeApiBase(null); window.history.replaceState({}, '', '/'); });
describe('standalone API selection', () => {
  it('uses session-scoped public gateway when embedded at legacy index.php', () => {
    vi.stubEnv('VITE_VPBX_STANDALONE', 'true');
    vi.stubEnv('VITE_API_URL', '/modules/voice-robots/api.php');
    window.history.replaceState({}, '', '/index.php?module=voice-robots#/voice-robots');
    expect(isStandaloneApp()).toBe(true);
    expect(getEffectiveApiBase()).toBe('/modules/voice-robots/api.php/public');
  });
  it('does not append a second public segment', () => {
    vi.stubEnv('VITE_VPBX_STANDALONE', 'true');
    vi.stubEnv('VITE_API_URL', '/modules/voice-robots/api.php/public');
    expect(getEffectiveApiBase()).toBe('/modules/voice-robots/api.php/public');
  });
  it('retains existing standalone URL support', () => {
    vi.stubEnv('VITE_VPBX_STANDALONE', ''); vi.stubEnv('VITE_API_URL', '/api');
    window.history.replaceState({}, '', '/standalone.html');
    expect(getEffectiveApiBase()).toBe('/api/public');
  });
  it('keeps the main application on its authenticated API', () => {
    vi.stubEnv('VITE_VPBX_STANDALONE', ''); vi.stubEnv('VITE_API_URL', '/api/public');
    expect(isStandaloneApp()).toBe(false); expect(getEffectiveApiBase()).toBe('/api');
  });
});
