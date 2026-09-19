import { lstat, mkdir, open, readFile, realpath, rename, rm } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { assertSafeObjectKey } from './storage-key';
import type { ObjectStore, StorageRange } from './storage.port';

export class LocalObjectStore implements ObjectStore {
  constructor(private readonly root: string) {}

  private async resolveSafe(key: string): Promise<string> {
    const base = key.endsWith('.part') ? key.slice(0, -'.part'.length) : key;
    assertSafeObjectKey(base);
    if (key.includes('..') || key.includes('\\') || key.includes('\0')) {
      throw Object.assign(new Error('storage key traversal is not allowed'), { code: 'storage_path_denied' });
    }
    const root = await realpath(this.root);
    const target = resolve(join(root, ...key.split('/')));
    const prefix = root.endsWith(sep) ? root : root + sep;
    if (target !== root && !target.startsWith(prefix)) {
      throw Object.assign(new Error('resolved path escaped storage root'), { code: 'storage_path_denied' });
    }
    return target;
  }

  async put(key: string, body: Buffer): Promise<void> {
    const target = await this.resolveSafe(key);
    await mkdir(dirname(target), { recursive: true });
    try {
      try {
        const existing = await lstat(target);
        if (existing.isSymbolicLink()) {
          throw Object.assign(new Error('symlink storage objects are not allowed'), { code: 'storage_path_denied' });
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
      const handle = await open(target, 'w');
      try {
        await handle.writeFile(body);
        await handle.sync();
      } finally {
        await handle.close();
      }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOSPC') {
        throw Object.assign(new Error('storage is full'), { code: 'storage_full' });
      }
      throw error;
    }
  }

  async get(key: string, range?: StorageRange): Promise<Buffer> {
    const target = await this.resolveSafe(key);
    const info = await lstat(target);
    if (info.isSymbolicLink()) {
      throw Object.assign(new Error('symlink storage objects are not allowed'), { code: 'storage_path_denied' });
    }
    const body = await readFile(target);
    if (!range) return body;
    return body.subarray(range.start, range.end + 1);
  }

  async head(key: string): Promise<{ bytes: number } | null> {
    try {
      const info = await lstat(await this.resolveSafe(key));
      if (info.isSymbolicLink()) {
        throw Object.assign(new Error('symlink storage objects are not allowed'), { code: 'storage_path_denied' });
      }
      return { bytes: info.size };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(await this.resolveSafe(key), { force: true });
  }

  async rename(fromKey: string, toKey: string): Promise<void> {
    const from = await this.resolveSafe(fromKey);
    const to = await this.resolveSafe(toKey);
    await mkdir(dirname(to), { recursive: true });
    await rename(from, to);
  }
}

export async function ensureLocalRoot(root: string): Promise<string> {
  await mkdir(root, { recursive: true });
  return realpath(root);
}
