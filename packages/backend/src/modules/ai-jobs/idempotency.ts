import { createHash } from 'node:crypto';

const PRINTABLE_ASCII = /^[\x20-\x7E]{1,128}$/;

export function digestIdempotencyKey(key: string): Buffer {
  if (!PRINTABLE_ASCII.test(key)) {
    throw Object.assign(new Error('Idempotency-Key must be 1..128 ASCII characters'), { code: 'idempotency_key_invalid' });
  }
  return createHash('sha256').update(key, 'ascii').digest();
}

export function canonicalRequestHash(fields: Record<string, unknown>): string {
  const keys = Object.keys(fields).sort();
  const canonical = JSON.stringify(keys.map(key => [key, fields[key]]));
  return createHash('sha256').update(canonical).digest('hex');
}
