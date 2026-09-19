import { encryptSecret, decryptSecret } from './secret-cipher.util';
import { createCipheriv, randomBytes, scryptSync } from 'node:crypto';

describe('secret-cipher', () => {
  it('round-trips a typical OpenAI key', () => {
    const plain = 'sk-proj-abc123XYZ_~!@#';
    const enc = encryptSecret(plain);
    expect(enc).toMatch(/^v2:[A-Za-z0-9_-]+:/);
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

  it('rejects malformed ciphertext instead of treating it as an absent key', () => {
    expect(() => decryptSecret('short')).toThrow('AI_PROVIDER_CIPHERTEXT_INVALID');
  });

  it('throws when the auth tag does not match (tampered payload)', () => {
    const enc = encryptSecret('payload');
    const [version, id, body] = enc.split(':');
    const buf = Buffer.from(body, 'base64');
    // Flip the last byte (within the ciphertext region) to invalidate the GCM tag
    buf[buf.length - 1] ^= 0x01;
    const tampered = `${version}:${id}:${buf.toString('base64')}`;
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it('reads a legacy ciphertext without rewriting the stored bytes', () => {
    const previous = process.env.CC_AI_LEGACY_KEY_SECRET;
    try {
      process.env.CC_AI_LEGACY_KEY_SECRET = 'explicit-legacy-fixture-key';
      const key = scryptSync('explicit-legacy-fixture-key',
        Buffer.from('krsk-ai-providers-v1'), 32);
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      const payload = Buffer.concat([cipher.update('legacy-key'), cipher.final()]);
      const legacy = Buffer.concat([iv, cipher.getAuthTag(), payload]).toString('base64');
      expect(decryptSecret(legacy)).toBe('legacy-key');
    } finally {
      if (previous === undefined) delete process.env.CC_AI_LEGACY_KEY_SECRET;
      else process.env.CC_AI_LEGACY_KEY_SECRET = previous;
    }
  });

  it('reads prior v2 key IDs only through an explicit installation keyring', () => {
    const before = {
      secret: process.env.CC_AI_KEY_SECRET,
      id: process.env.CC_AI_KEY_ID,
      ring: process.env.CC_AI_PREVIOUS_KEYS_JSON,
    };
    try {
      process.env.CC_AI_KEY_SECRET = 'old-installation-provider-secret-00000001';
      process.env.CC_AI_KEY_ID = 'old';
      const stored = encryptSecret('rotated-secret');
      process.env.CC_AI_KEY_SECRET = 'new-installation-provider-secret-00000002';
      process.env.CC_AI_KEY_ID = 'new';
      expect(() => decryptSecret(stored)).toThrow('AI_PROVIDER_KEY_UNAVAILABLE');
      process.env.CC_AI_PREVIOUS_KEYS_JSON = JSON.stringify({
        old: 'old-installation-provider-secret-00000001',
      });
      expect(decryptSecret(stored)).toBe('rotated-secret');
    } finally {
      for (const [name, value] of [
        ['CC_AI_KEY_SECRET', before.secret], ['CC_AI_KEY_ID', before.id],
        ['CC_AI_PREVIOUS_KEYS_JSON', before.ring],
      ] as const) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    }
  });

  it('fails closed outside tests without an installation secret', () => {
    const priorMode = process.env.NODE_ENV;
    const priorSecret = process.env.CC_AI_KEY_SECRET;
    try {
      process.env.NODE_ENV = 'production';
      delete process.env.CC_AI_KEY_SECRET;
      expect(() => encryptSecret('secret')).toThrow('AI_PROVIDER_KEY_UNAVAILABLE');
    } finally {
      if (priorMode === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = priorMode;
      if (priorSecret === undefined) delete process.env.CC_AI_KEY_SECRET;
      else process.env.CC_AI_KEY_SECRET = priorSecret;
    }
  });
});
