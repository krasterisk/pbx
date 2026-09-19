import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { canonicalJson, verifySignedLicense, type LicenseTrust } from './license-verifier';

const payload = '{"expiresAt":"2030-01-01T00:00:00.000Z","graceSeconds":0,"installationId":"test-installation","issuer":"krasterisk-test","keyId":"test-key-1","licenseId":"00000000-0000-4000-8000-000000000001","notBefore":"2026-01-01T00:00:00.000Z","products":[{"code":"speech_analytics","limits":{"jobs_per_month":100}}],"revision":1,"tenantUid":0,"version":1}';
const publicKey = '-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAdGdAIz0+jSumODxuUtfiFU6/RZ3o3csV4k7KcpnjWac=\n-----END PUBLIC KEY-----\n';
const signature = 'u-M_yQUsoa3I6oq_wWZJVZ9Nytlol6takB1t8CFxCNsG9JRACMU2w1RXxyraHeUyPVB_05ppDS50C-j3OYfCDg';
const trust: LicenseTrust = {
  issuer: 'krasterisk-test', installationId: 'test-installation',
  publicKeys: { 'test-key-1': publicKey },
};
const envelope = { payload: Buffer.from(payload).toString('base64url'), signature };
const now = new Date('2026-09-18T12:00:00.000Z');

function signedWithEphemeralKey(patch: Record<string, unknown>) {
  const parsed = JSON.parse(payload);
  const changed = { ...parsed, ...patch };
  const bytes = Buffer.from(canonicalJson(changed));
  const keys = generateKeyPairSync('ed25519');
  return {
    envelope: {
      payload: bytes.toString('base64url'),
      signature: sign(null, bytes, keys.privateKey).toString('base64url'),
    },
    trust: {
      ...trust,
      publicKeys: { 'test-key-1': keys.publicKey.export({ type: 'spki', format: 'pem' }).toString() },
    },
  };
}

describe('local Ed25519 license wire contract', () => {
  it('accepts a fixed public-key/signature vector including tenant zero', () => {
    expect(createHash('sha256').update(payload).digest('hex'))
      .toBe('6293f750b9cc741d1c12f1bebbc9352e5b7cf1633ca06f75dc6a6577bfbe08b8');
    expect(verifySignedLicense(envelope, trust, now)).toMatchObject({
      payload: { tenantUid: 0, products: [{ code: 'speech_analytics', limits: { jobs_per_month: 100 } }] },
      digest: '6293f750b9cc741d1c12f1bebbc9352e5b7cf1633ca06f75dc6a6577bfbe08b8',
    });
  });

  it('rejects a modified payload, unknown key, wrong installation and wrong issuer', () => {
    const modified = { ...envelope, payload: Buffer.from(payload.replace('100', '101')).toString('base64url') };
    expect(() => verifySignedLicense(modified, trust, now)).toThrow();
    expect(() => verifySignedLicense(envelope, { ...trust, publicKeys: {} }, now)).toThrow();
    expect(() => verifySignedLicense(envelope, { ...trust, installationId: 'elsewhere' }, now)).toThrow();
    expect(() => verifySignedLicense(envelope, { ...trust, issuer: 'elsewhere' }, now)).toThrow();
  });

  it('rejects alternate encoding, duplicate keys and an unknown field', () => {
    expect(() => verifySignedLicense({ ...envelope, payload: `${envelope.payload}=` }, trust, now)).toThrow();
    const duplicate = payload.replace('"version":1}', '"version":1,"version":1}');
    expect(() => verifySignedLicense({ ...envelope, payload: Buffer.from(duplicate).toString('base64url') }, trust, now)).toThrow();
    const extra = signedWithEphemeralKey({ surprise: true });
    expect(() => verifySignedLicense(extra.envelope, extra.trust, now)).toThrow();
  });

  it('rejects future, expired and invalid product grants despite valid signatures', () => {
    expect(() => verifySignedLicense(envelope, trust, new Date('2025-12-31T23:59:59Z'))).toThrow();
    expect(() => verifySignedLicense(envelope, trust, new Date('2030-01-01T00:00:00Z'))).toThrow();
    const wrong = signedWithEphemeralKey({ products: [{ code: 'voice_robot', limits: {} }] });
    expect(() => verifySignedLicense(wrong.envelope, wrong.trust, now)).toThrow();
    const grace = signedWithEphemeralKey({ graceSeconds: 300 });
    expect(() => verifySignedLicense(grace.envelope, grace.trust, now)).toThrow();
  });
});
