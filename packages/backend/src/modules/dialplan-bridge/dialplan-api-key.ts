import * as crypto from 'crypto';

export function timingSafeApiKeyEqual(expected: string, provided?: string): boolean {
  if (!expected) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(provided ?? '');
  const len = Math.max(a.length, b.length, 1);
  const ka = Buffer.alloc(len);
  const kb = Buffer.alloc(len);
  a.copy(ka);
  b.copy(kb);
  return crypto.timingSafeEqual(ka, kb) && a.length === b.length;
}
