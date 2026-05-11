import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

/**
 * AES-256-GCM at-rest encryption for provider API keys.
 *
 * Key derivation: scrypt(CC_AI_KEY_SECRET, fixed-salt) — deterministic so
 * the same env var unlocks any record. Output is base64 of
 *   iv (12B) || authTag (16B) || ciphertext.
 *
 * If `CC_AI_KEY_SECRET` is missing we fall back to a development key
 * (logged once at boot in the service); production deployments MUST set it.
 */

const ALG = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;
const SCRYPT_SALT = Buffer.from('krsk-ai-providers-v1');

function getKey(): Buffer {
  const secret = process.env.CC_AI_KEY_SECRET || '__krsk_dev_unsafe_key__';
  return scryptSync(secret, SCRYPT_SALT, 32);
}

export function encryptSecret(plain: string): string {
  if (!plain) return '';
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALG, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decryptSecret(blob: string): string {
  if (!blob) return '';
  const buf = Buffer.from(blob, 'base64');
  if (buf.length < IV_LEN + TAG_LEN + 1) return '';
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALG, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}
