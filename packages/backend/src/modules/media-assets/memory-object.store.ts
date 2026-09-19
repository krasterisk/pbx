import type { ObjectStore, StorageRange } from './storage.port';

export class MemoryObjectStore implements ObjectStore {
  private readonly objects = new Map<string, Buffer>();

  async put(key: string, body: Buffer): Promise<void> {
    this.objects.set(key, Buffer.from(body));
  }

  async get(key: string, range?: StorageRange): Promise<Buffer> {
    const body = this.objects.get(key);
    if (!body) throw Object.assign(new Error('object not found'), { code: 'storage_not_found' });
    if (!range) return Buffer.from(body);
    return Buffer.from(body.subarray(range.start, range.end + 1));
  }

  async head(key: string): Promise<{ bytes: number } | null> {
    const body = this.objects.get(key);
    return body ? { bytes: body.length } : null;
  }

  async delete(key: string): Promise<void> {
    this.objects.delete(key);
  }

  async rename(fromKey: string, toKey: string): Promise<void> {
    const body = this.objects.get(fromKey);
    if (!body) throw Object.assign(new Error('object not found'), { code: 'storage_not_found' });
    this.objects.set(toKey, body);
    this.objects.delete(fromKey);
  }
}
