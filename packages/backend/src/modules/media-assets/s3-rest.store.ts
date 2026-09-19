import { createHash, createHmac } from 'node:crypto';
import type { ObjectStore, StorageRange } from './storage.port';

export type S3RestConfig = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
};

function hmac(key: Buffer | string, value: string): Buffer {
  return createHmac('sha256', key).update(value, 'utf8').digest();
}

function sha256Hex(body: Buffer | string): string {
  return createHash('sha256').update(body).digest('hex');
}

function signingKey(secret: string, date: string, region: string): Buffer {
  const kDate = hmac(`AWS4${secret}`, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, 's3');
  return hmac(kService, 'aws4_request');
}

export class S3RestObjectStore implements ObjectStore {
  constructor(private readonly config: S3RestConfig) {}

  private objectUrl(key: string): URL {
    const url = new URL(this.config.endpoint);
    url.pathname = `/${this.config.bucket}/${key}`;
    return url;
  }

  private bucketUrl(): URL {
    const url = new URL(this.config.endpoint);
    url.pathname = `/${this.config.bucket}`;
    return url;
  }

  private async request(method: string, url: URL, body?: Buffer, extra: Record<string, string> = {}): Promise<{
    status: number;
    buffer: Buffer;
    contentLength: number;
  }> {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const date = amzDate.slice(0, 8);
    const payload = body ?? Buffer.alloc(0);
    const payloadHash = sha256Hex(payload);
    const headers: Record<string, string> = {
      host: url.host,
      'x-amz-content-sha256': String(payloadHash),
      'x-amz-date': amzDate,
      ...extra,
    };
    if (body) headers['content-length'] = String(body.length);
    const signedHeaderNames = Object.keys(headers).map(name => name.toLowerCase()).sort();
    const canonicalHeaders = signedHeaderNames.map(name => `${name}:${headers[name]}\n`).join('');
    const signedHeaders = signedHeaderNames.join(';');
    const canonical = [
      method, url.pathname, '', canonicalHeaders, signedHeaders, payloadHash,
    ].join('\n');
    const scope = `${date}/${this.config.region}/s3/aws4_request`;
    const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256Hex(canonical)].join('\n');
    const signature = createHmac('sha256', signingKey(this.config.secretKey, date, this.config.region))
      .update(stringToSign, 'utf8').digest('hex');
    headers.authorization = `AWS4-HMAC-SHA256 Credential=${this.config.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    const response = await fetch(url, { method, headers, body });
    const buffer = Buffer.from(await response.arrayBuffer());
    const advertised = Number(response.headers.get('content-length'));
    return {
      status: response.status,
      buffer,
      contentLength: Number.isFinite(advertised) ? advertised : buffer.length,
    };
  }

  async put(key: string, body: Buffer): Promise<void> {
    const result = await this.request('PUT', this.objectUrl(key), body);
    if (result.status >= 300) {
      throw Object.assign(new Error(`s3 put failed ${result.status}`), { code: 'storage_s3_failed' });
    }
  }

  async get(key: string, range?: StorageRange): Promise<Buffer> {
    const extra: Record<string, string> = range
      ? { range: `bytes=${range.start}-${range.end}` }
      : {};
    const result = await this.request('GET', this.objectUrl(key), undefined, extra);
    if (result.status === 404) {
      throw Object.assign(new Error('object not found'), { code: 'storage_not_found' });
    }
    if (result.status !== 200 && result.status !== 206) {
      throw Object.assign(new Error(`s3 get failed ${result.status}`), { code: 'storage_s3_failed' });
    }
    return result.buffer;
  }

  async head(key: string): Promise<{ bytes: number } | null> {
    const result = await this.request('HEAD', this.objectUrl(key));
    if (result.status === 404) return null;
    if (result.status >= 300) {
      throw Object.assign(new Error(`s3 head failed ${result.status}`), { code: 'storage_s3_failed' });
    }
    return { bytes: result.contentLength };
  }

  async delete(key: string): Promise<void> {
    const result = await this.request('DELETE', this.objectUrl(key));
    if (result.status >= 300 && result.status !== 404) {
      throw Object.assign(new Error(`s3 delete failed ${result.status}`), { code: 'storage_s3_failed' });
    }
  }

  async rename(fromKey: string, toKey: string): Promise<void> {
    const body = await this.get(fromKey);
    await this.put(toKey, body);
    await this.delete(fromKey);
  }

  async ensureBucket(): Promise<void> {
    const result = await this.request('PUT', this.bucketUrl());
    if (result.status >= 300 && result.status !== 409) {
      throw Object.assign(new Error(`s3 create bucket failed ${result.status}`), { code: 'storage_s3_failed' });
    }
  }
}

export function createS3StorageFromEnv(env: NodeJS.Dict<string>): S3RestConfig {
  const endpoint = env.AI_S3_ENDPOINT?.trim();
  if (!endpoint) {
    throw Object.assign(new Error('AI S3 adapter requires AI_S3_ENDPOINT'), { code: 's3_required' });
  }
  if (!/^https?:\/\//i.test(endpoint)) {
    throw Object.assign(new Error('S3 endpoint must be an http(s) deployment URL'), { code: 's3_endpoint_denied' });
  }
  return {
    endpoint,
    region: env.AI_S3_REGION || 'us-east-1',
    bucket: env.AI_S3_BUCKET || 'krasterisk-ai-media',
    accessKey: env.AI_S3_ACCESS_KEY || '',
    secretKey: env.AI_S3_SECRET_KEY || '',
  };
}

export function createS3ObjectStoreFromEnv(env: NodeJS.Dict<string>): S3RestObjectStore {
  return new S3RestObjectStore(createS3StorageFromEnv(env));
}
