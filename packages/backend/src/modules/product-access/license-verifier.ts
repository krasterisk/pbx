import { createHash, createPublicKey, verify } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import { isAiProductCode, type AiProductModuleCode } from '../cloud-admin/product-access-policy';

export interface SignedLicenseEnvelope {
  payload: string;
  signature: string;
}

export interface LocalLicensePayload {
  version: 1;
  licenseId: string;
  issuer: string;
  keyId: string;
  installationId: string;
  tenantUid: number;
  revision: number;
  notBefore: string;
  expiresAt: string;
  graceSeconds: 0;
  products: Array<{ code: AiProductModuleCode; limits: Record<string, number> }>;
}

export interface LicenseTrust {
  issuer: string;
  installationId: string;
  publicKeys: Record<string, string>;
}

export interface VerifiedLocalLicense {
  payload: LocalLicensePayload;
  payloadBytes: Buffer;
  signatureBytes: Buffer;
  digest: string;
}

const fail = (code: string): never => {
  throw new BadRequestException({ code });
};

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

/** Canonical representation of parsed JSON; schema validation restricts keys. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (record(value)) {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function base64url(value: unknown, maxBytes: number): Buffer {
  if (typeof value !== 'string' || value.length === 0 || value.length > maxBytes * 2
    || !/^[A-Za-z0-9_-]+$/.test(value)) fail('license_encoding_invalid');
  const bytes = Buffer.from(value as string, 'base64url');
  if (bytes.length === 0 || bytes.length > maxBytes || bytes.toString('base64url') !== value) {
    fail('license_encoding_invalid');
  }
  return bytes;
}

function utcInstant(value: unknown): value is string {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
    && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString() === value;
}

function parsePayload(value: unknown): LocalLicensePayload {
  const keys = [
    'version', 'licenseId', 'issuer', 'keyId', 'installationId', 'tenantUid',
    'revision', 'notBefore', 'expiresAt', 'graceSeconds', 'products',
  ];
  if (!record(value) || !exactKeys(value, keys)) fail('license_schema_invalid');
  const p = value as Record<string, unknown>;
  if (p.version !== 1
    || typeof p.licenseId !== 'string'
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(p.licenseId)
    || typeof p.issuer !== 'string' || p.issuer.length < 1 || p.issuer.length > 128
    || typeof p.keyId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(p.keyId)
    || typeof p.installationId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(p.installationId)
    || !Number.isSafeInteger(p.tenantUid) || (p.tenantUid as number) < 0
    || !Number.isSafeInteger(p.revision) || (p.revision as number) < 1
    || !utcInstant(p.notBefore) || !utcInstant(p.expiresAt)
    || p.expiresAt <= p.notBefore || p.graceSeconds !== 0
    || !Array.isArray(p.products) || p.products.length < 1 || p.products.length > 2) {
    fail('license_schema_invalid');
  }
  let previous = '';
  for (const product of p.products as unknown[]) {
    if (!record(product) || !exactKeys(product, ['code', 'limits'])
      || typeof product.code !== 'string' || !isAiProductCode(product.code)
      || product.code <= previous || !record(product.limits)) fail('license_schema_invalid');
    const item = product as Record<string, unknown>;
    previous = item.code as string;
    const limits = item.limits as Record<string, unknown>;
    if (Object.keys(limits).length > 20 || Object.entries(limits).some(([key, limit]) =>
      !/^[a-z][a-z0-9_]{0,63}$/.test(key)
      || !Number.isSafeInteger(limit) || (limit as number) < 0)) fail('license_schema_invalid');
  }
  return p as unknown as LocalLicensePayload;
}

export function verifySignedLicense(
  envelope: unknown,
  trust: LicenseTrust,
  now: Date,
): VerifiedLocalLicense {
  if (!record(envelope) || !exactKeys(envelope, ['payload', 'signature'])) {
    fail('license_encoding_invalid');
  }
  const encoded = envelope as Record<string, unknown>;
  const payloadBytes = base64url(encoded.payload, 16 * 1024);
  const signatureBytes = base64url(encoded.signature, 64);
  if (signatureBytes.length !== 64) fail('license_signature_invalid');
  let json: unknown;
  let decoded = '';
  try {
    decoded = new TextDecoder('utf-8', { fatal: true }).decode(payloadBytes);
    json = JSON.parse(decoded);
  } catch {
    fail('license_encoding_invalid');
  }
  try {
    if (canonicalJson(json) !== decoded) fail('license_encoding_invalid');
  } catch {
    fail('license_encoding_invalid');
  }
  const payload = parsePayload(json);
  if (!trust.issuer || !trust.installationId || payload.issuer !== trust.issuer
    || payload.installationId !== trust.installationId) fail('license_binding_invalid');
  const pem = Object.prototype.hasOwnProperty.call(trust.publicKeys, payload.keyId)
    ? trust.publicKeys[payload.keyId] : undefined;
  if (!pem) fail('license_key_unknown');
  let valid = false;
  try {
    const key = createPublicKey(pem as string);
    valid = key.asymmetricKeyType === 'ed25519'
      && verify(null, payloadBytes, key, signatureBytes);
  } catch { /* Invalid trusted key configuration fails closed. */ }
  if (!valid) fail('license_signature_invalid');
  const instant = now.getTime();
  if (!Number.isFinite(instant) || instant < Date.parse(payload.notBefore)) {
    fail('license_not_yet_valid');
  }
  if (instant >= Date.parse(payload.expiresAt)) fail('license_expired');
  return {
    payload, payloadBytes, signatureBytes,
    digest: createHash('sha256').update(payloadBytes).digest('hex'),
  };
}
