import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const ALG = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;
const LEGACY_SALT = Buffer.from('krsk-ai-providers-v1');
const TEST_SECRET = 'krasterisk-test-provider-key-material-do-not-deploy';

function activeSecret(): string {
  const configured = process.env.CC_AI_KEY_SECRET;
  if (configured) return configured;
  if (process.env.NODE_ENV === 'test' && process.env.JEST_WORKER_ID) return TEST_SECRET;
  throw new Error('AI_PROVIDER_KEY_UNAVAILABLE');
}

function activeKeyId(): string {
  const id = process.env.CC_AI_KEY_ID || 'primary';
  if (!/^[A-Za-z0-9_-]{1,32}$/.test(id)) throw new Error('AI_PROVIDER_KEY_ID_INVALID');
  return id;
}

function previousSecrets(): Record<string, string> {
  const raw = process.env.CC_AI_PREVIOUS_KEYS_JSON;
  if (!raw) return {};
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error('AI_PROVIDER_KEYRING_INVALID'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)
    || Object.entries(parsed).some(([id, value]) => !/^[A-Za-z0-9_-]{1,32}$/.test(id)
      || typeof value !== 'string' || !value)) {
    throw new Error('AI_PROVIDER_KEYRING_INVALID');
  }
  return parsed as Record<string, string>;
}

function encryptionKey(secret: string, id: string): Buffer {
  return scryptSync(secret, Buffer.from(`krsk-ai-providers-v2:${id}`), 32);
}

function decodePayload(value: string): Buffer {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) throw new Error('AI_PROVIDER_CIPHERTEXT_INVALID');
  const payload = Buffer.from(value, 'base64');
  if (payload.length < IV_LEN + TAG_LEN + 1) throw new Error('AI_PROVIDER_CIPHERTEXT_INVALID');
  return payload;
}

function decryptPayload(payload: Buffer, key: Buffer): string {
  const iv = payload.subarray(0, IV_LEN);
  const tag = payload.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const cipher = payload.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALG, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(cipher), decipher.final()]).toString('utf8');
}

/** Versioned envelope; only a configured installation secret can encrypt outside tests. */
export function encryptSecret(plain: string): string {
  if (!plain) return '';
  const secret = activeSecret();
  if (Buffer.byteLength(secret, 'utf8') < 32) throw new Error('AI_PROVIDER_KEY_TOO_SHORT');
  const id = activeKeyId();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALG, encryptionKey(secret, id), iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return `v2:${id}:${Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64')}`;
}

/** Legacy base64 rows remain readable with the configured legacy/current key. */
export function decryptSecret(blob: string): string {
  if (!blob) return '';
  const match = /^v2:([A-Za-z0-9_-]{1,32}):(.+)$/.exec(blob);
  if (match) {
    const id = match[1];
    const secret = id === activeKeyId() ? activeSecret() : previousSecrets()[id];
    if (!secret) throw new Error('AI_PROVIDER_KEY_UNAVAILABLE');
    return decryptPayload(decodePayload(match[2]), encryptionKey(secret, id));
  }
  if (blob.startsWith('v2:')) throw new Error('AI_PROVIDER_CIPHERTEXT_INVALID');
  const legacy = process.env.CC_AI_LEGACY_KEY_SECRET || activeSecret();
  return decryptPayload(decodePayload(blob), scryptSync(legacy, LEGACY_SALT, 32));
}
