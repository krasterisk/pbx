import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export interface GeneratedIntegrationKey {
  selector: string;
  secret: string;
  token: string;
  digest: Buffer;
}

const canonicalPart = (value: string, bytes: number): boolean =>
  /^[A-Za-z0-9_-]+$/.test(value)
  && Buffer.from(value, 'base64url').length === bytes
  && Buffer.from(value, 'base64url').toString('base64url') === value;

/** Version and NUL delimiters are part of the stored digest domain. */
export function integrationKeyDigest(selector: string, secret: string): Buffer {
  return createHash('sha256')
    .update('krint_v1\0', 'utf8').update(selector, 'ascii')
    .update('\0', 'utf8').update(secret, 'ascii').digest();
}

export function generateIntegrationKey(): GeneratedIntegrationKey {
  const selector = randomBytes(16).toString('base64url');
  const secret = randomBytes(32).toString('base64url');
  return {
    selector, secret, token: `krint_v1_${selector}_${secret}`,
    digest: integrationKeyDigest(selector, secret),
  };
}

export function compareIntegrationKey(
  selector: string, secret: string, storedDigest: Buffer | null,
): boolean {
  const shapeValid = canonicalPart(selector, 16) && canonicalPart(secret, 32);
  const actual = shapeValid ? integrationKeyDigest(selector, secret) : Buffer.alloc(32);
  const expected = Buffer.isBuffer(storedDigest) && storedDigest.length === 32
    ? storedDigest : Buffer.alloc(32);
  // Run the same fixed-size comparison for absent selectors and bad digests.
  const equal = timingSafeEqual(actual, expected);
  return shapeValid && Buffer.isBuffer(storedDigest) && storedDigest.length === 32 && equal;
}
