import { compareIntegrationKey, generateIntegrationKey, integrationKeyDigest } from './integration-key.crypto';

describe('integration key generation and verification', () => {
  it('generates fixed-length independent selector/secret and stores only a digest', () => {
    const a = generateIntegrationKey();
    const b = generateIntegrationKey();
    expect(a.selector).toHaveLength(22);
    expect(a.secret).toHaveLength(43);
    expect(a.token).toBe(`krint_v1_${a.selector}_${a.secret}`);
    expect(a.token).not.toBe(b.token);
    expect(a.digest).toHaveLength(32);
    expect(a.digest.toString('utf8')).not.toContain(a.secret);
    expect(compareIntegrationKey(a.selector, a.secret, a.digest)).toBe(true);
    expect(compareIntegrationKey(a.selector, b.secret, a.digest)).toBe(false);
    expect(compareIntegrationKey(a.selector, a.secret, null)).toBe(false);
    expect(integrationKeyDigest(a.selector, a.secret)).toEqual(a.digest);
  });
});
