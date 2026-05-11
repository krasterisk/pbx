import { encryptSecret, decryptSecret } from './secret-cipher.util';

describe('secret-cipher', () => {
  it('round-trips a typical OpenAI key', () => {
    const plain = 'sk-proj-abc123XYZ_~!@#';
    const enc = encryptSecret(plain);
    expect(enc).not.toBe(plain);
    expect(enc.length).toBeGreaterThan(plain.length);
    expect(decryptSecret(enc)).toBe(plain);
  });

  it('produces different ciphertext on every call (random IV)', () => {
    const a = encryptSecret('same');
    const b = encryptSecret('same');
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe('same');
    expect(decryptSecret(b)).toBe('same');
  });

  it('returns empty string for empty input on both sides', () => {
    expect(encryptSecret('')).toBe('');
    expect(decryptSecret('')).toBe('');
  });

  it('returns empty string for blobs too short to be valid ciphertext', () => {
    // Anything below IV(12) + tag(16) + 1 byte → soft return ''
    expect(decryptSecret('short')).toBe('');
  });

  it('throws when the auth tag does not match (tampered payload)', () => {
    const enc = encryptSecret('payload');
    const buf = Buffer.from(enc, 'base64');
    // Flip the last byte (within the ciphertext region) to invalidate the GCM tag
    buf[buf.length - 1] ^= 0x01;
    const tampered = buf.toString('base64');
    expect(() => decryptSecret(tampered)).toThrow();
  });
});
