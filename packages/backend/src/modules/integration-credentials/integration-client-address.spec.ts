import { integrationClientAddress } from './integration-client-address';

describe('integrationClientAddress', () => {
  it('ignores forged forwarded headers from untrusted peers', () => {
    expect(integrationClientAddress('203.0.113.8', '198.51.100.4', '10.0.0.1'))
      .toBe('203.0.113.8');
  });

  it('walks the configured trusted proxy chain from the socket backwards', () => {
    expect(integrationClientAddress('10.0.0.2', '192.0.2.1, 198.51.100.4, 10.0.0.1',
      '10.0.0.1,10.0.0.2')).toBe('198.51.100.4');
  });

  it('falls back to socket address for malformed or fully trusted chains', () => {
    expect(integrationClientAddress('10.0.0.2', 'forged, 192.0.2.1', '10.0.0.2'))
      .toBe('10.0.0.2');
    expect(integrationClientAddress('10.0.0.2', '10.0.0.1', '10.0.0.1,10.0.0.2'))
      .toBe('10.0.0.2');
  });
});
