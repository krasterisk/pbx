import { describe, it, expect } from 'vitest';
import {
  resolveApiBaseUrl,
  resolveWssUrl,
  type UrlFlavor,
} from './envUrls';

describe('envUrls (NAV-11 / D-34)', () => {
  it('prefers runtime override over VITE_API_URL and flavor defaults', () => {
    const url = resolveApiBaseUrl('prod', {
      override: 'https://onprem.example/api/',
      envApiUrl: 'https://prod.example/api',
    });
    expect(url).toBe('https://onprem.example/api');
  });

  it('uses VITE_API_URL when override is empty', () => {
    const url = resolveApiBaseUrl('staging', {
      override: null,
      envApiUrl: 'https://staging.example/api/',
    });
    expect(url).toBe('https://staging.example/api');
  });

  it('falls back to flavor default when env and override missing', () => {
    const flavors: UrlFlavor[] = ['dev', 'staging', 'prod'];
    for (const flavor of flavors) {
      const url = resolveApiBaseUrl(flavor, { override: undefined, envApiUrl: '' });
      expect(url.length).toBeGreaterThan(0);
      expect(url.endsWith('/')).toBe(false);
    }
  });

  it('resolveWssUrl prefers override then VITE_WSS_URL then flavor', () => {
    expect(
      resolveWssUrl('prod', {
        override: 'wss://onprem.example/socket.io',
        envWssUrl: 'wss://prod.example/socket.io',
      }),
    ).toBe('wss://onprem.example/socket.io');

    expect(
      resolveWssUrl('prod', {
        override: null,
        envWssUrl: 'wss://prod.example/socket.io/',
      }),
    ).toBe('wss://prod.example/socket.io');
  });
});
