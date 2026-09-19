import { createHash } from 'node:crypto';
import { AI_MEDIA_MAX_BYTES } from '@krasterisk/shared';
import { assertSafeObjectKey, objectKeyFor, parseRef } from './storage-key';
import type { MediaStorage, ObjectStore, StorageRange, WriteTemporaryResult } from './storage.port';

export class ObjectMediaStorage implements MediaStorage {
  constructor(private readonly store: ObjectStore) {}

  async writeTemporary(input: {
    tenantUid: number;
    assetId: string;
    body: Buffer;
    maxBytes: number;
  }): Promise<WriteTemporaryResult> {
    const maxBytes = Math.min(input.maxBytes, AI_MEDIA_MAX_BYTES);
    if (input.body.length > maxBytes) {
      throw Object.assign(new Error('upload exceeds byte limit'), { code: 'upload_overflow' });
    }
    const key = assertSafeObjectKey(objectKeyFor({
      scheme: 'local', tenantUid: input.tenantUid, assetId: input.assetId,
    }));
    const tempKey = `${key}.part`;
    await this.store.put(tempKey, input.body);
    return {
      tempKey,
      bytes: input.body.length,
      sha256: createHash('sha256').update(input.body).digest('hex'),
    };
  }

  async commitImmutable(tempKey: string): Promise<{ key: string }> {
    if (!tempKey.endsWith('.part')) {
      throw Object.assign(new Error('commit requires a temporary object'), { code: 'storage_commit_invalid' });
    }
    const key = tempKey.slice(0, -'.part'.length);
    assertSafeObjectKey(key);
    await this.store.rename(tempKey, key);
    return { key };
  }

  async stat(key: string): Promise<{ bytes: number } | null> {
    return this.store.head(assertSafeObjectKey(key));
  }

  async openRange(key: string, range: StorageRange): Promise<Buffer> {
    return this.store.get(assertSafeObjectKey(key), range);
  }

  async delete(key: string): Promise<void> {
    await this.store.delete(assertSafeObjectKey(key));
  }
}

export function keyFromRef(ref: string): string {
  return objectKeyFor(parseRef(ref));
}
