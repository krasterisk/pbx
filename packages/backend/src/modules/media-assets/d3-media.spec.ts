import { lstat, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AI_MEDIA_MAX_BYTES, formatAiStorageRef, parseAiStorageRef } from '@krasterisk/shared';
import { authorizeRange } from './range-policy';
import { mayDeleteAsset, expireUpload } from './retention';
import { LocalObjectStore, ensureLocalRoot } from './local-object.store';
import { MemoryObjectStore } from './memory-object.store';
import { ObjectMediaStorage } from './object-media.storage';
import { probeMediaBuffer } from './probe';
import { ffprobeArgs } from './ffprobe-spawn';
import { assertSafeObjectKey } from './storage-key';
import { allocateUpload, appendChunk, emptyMediaStores, finalizeUpload, reconcileUnreadyObject } from './upload-pipeline';
import { bombWav, pcmWav, silenceWav, threeChannelWav, truncatedWav } from './wav-fixture';
import { createS3StorageFromEnv } from './s3-rest.store';

const assetId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

describe('D3 media storage and probe', () => {
  it('issues opaque refs and rejects traversal, UNC and absolute keys', () => {
    const ref = formatAiStorageRef({ scheme: 'local', tenantUid: 2, assetId });
    expect(parseAiStorageRef(ref)).toEqual({ scheme: 'local', tenantUid: 2, assetId });
    expect(() => parseAiStorageRef('/tmp/a.wav')).toThrow(/opaque/);
    expect(() => assertSafeObjectKey('../etc/passwd')).toThrow(/traversal/);
    expect(() => assertSafeObjectKey('\\\\server\\share')).toThrow(/traversal|UNC|absolute/);
    expect(() => assertSafeObjectKey('C:/windows/x')).toThrow(/absolute/);
    expect(ffprobeArgs('/safe/root/t2/' + assetId)[0]).toBe('-v');
    expect(ffprobeArgs('/safe/root/t2/' + assetId).join(' ')).not.toMatch(/cmd|sh -c/);
  });

  it('probes WAV bytes, ignores MIME lies, and rejects truncated/bomb/3-channel media', () => {
    const mono = pcmWav({ channels: 1, sampleRate: 8000, samples: 8000, amplitude: 0 });
    const stereo = pcmWav({ channels: 2, sampleRate: 8000, samples: 160, amplitude: 10 });
    expect(probeMediaBuffer(mono, 'audio/mpeg')).toMatchObject({
      container: 'wav', lossless: true, channelRoles: 'unknown', qualityFlags: expect.arrayContaining(['mono']),
    });
    expect(probeMediaBuffer(stereo).qualityFlags).toContain('stereo');
    expect(probeMediaBuffer(silenceWav()).qualityFlags).toContain('silence');
    expect(() => probeMediaBuffer(truncatedWav())).toThrow(/truncated/);
    expect(() => probeMediaBuffer(bombWav())).toThrow(/bomb/);
    expect(() => probeMediaBuffer(threeChannelWav())).toThrow(/channels/);
    const mp3 = Buffer.concat([Buffer.from('ID3'), Buffer.alloc(32, 0xff)]);
    expect(probeMediaBuffer(mp3).lossless).toBe(false);
  });

  it('streams with a byte cap, finalizes twice as ready, and keeps probing after rename-before-SQL', async () => {
    const stores = emptyMediaStores();
    const allocated = allocateUpload({ tenantUid: 2, principalId: 'prin-1', expectedBytes: 200, now: new Date() });
    stores.uploads.set(allocated.upload.id, allocated.upload);
    stores.assets.set(allocated.asset.id, allocated.asset);
    expect(allocated.asset.storageKey).toMatch(/^krs:v1:local:2:/);
    const wav = pcmWav({ channels: 1, sampleRate: 8000, samples: 40, amplitude: 1 });
    expect(() => appendChunk(allocated.upload, Buffer.alloc(201), 200)).toThrow(/overflow|byte limit/);
    const uploading = appendChunk(allocated.upload, wav, AI_MEDIA_MAX_BYTES);
    const storage = new ObjectMediaStorage(new MemoryObjectStore());
    await expect(finalizeUpload({
      upload: uploading, asset: allocated.asset, storage, crash: 'after-rename',
    })).rejects.toMatchObject({
      code: 'crash_after_rename',
      asset: expect.objectContaining({ state: 'probing' }),
    });
    const crashed = { ...allocated.asset, state: 'probing' as const, storageKey: allocated.asset.storageKey };
    expect(reconcileUnreadyObject(crashed, true, false)).toBe('probing');
    const first = await finalizeUpload({ upload: uploading, asset: allocated.asset, storage });
    expect(first.asset.state).toBe('ready');
    expect(first.asset.storageKey).toMatch(/^krs:v1:local:2:/);
    expect(first.outbox?.eventType).toBe('asset.ready');
    const second = await finalizeUpload({
      upload: { ...first.upload, state: 'uploading', chunks: uploading.chunks },
      asset: { ...first.asset, state: 'uploading' },
      storage,
    });
    expect(second.asset.state).toBe('ready');
  });

  it('uses the same storage contract for memory/S3-like and local disks, including Range and retention', async () => {
    const wav = pcmWav({ channels: 1, sampleRate: 8000, samples: 80, amplitude: 2 });
    const memory = new ObjectMediaStorage(new MemoryObjectStore());
    const written = await memory.writeTemporary({ tenantUid: 3, assetId, body: wav, maxBytes: AI_MEDIA_MAX_BYTES });
    const committed = await memory.commitImmutable(written.tempKey);
    expect(await memory.stat(committed.key)).toEqual({ bytes: wav.length });
    const range = authorizeRange({
      assetTenant: 3, requestTenant: 3, state: 'ready', objectBytes: wav.length, start: 0, end: 3,
    });
    expect((await memory.openRange(committed.key, range)).length).toBe(4);
    expect(() => authorizeRange({
      assetTenant: 3, requestTenant: 9, state: 'ready', objectBytes: wav.length, start: 0, end: 3,
    })).toThrow(/tenant/);
    expect(() => authorizeRange({
      assetTenant: 3, requestTenant: 3, state: 'probing', objectBytes: wav.length, start: 0, end: 3,
    })).toThrow(/not readable/);
    expect(mayDeleteAsset({ state: 'ready', activeJobCount: 1, now: new Date(), retentionAt: null })).toBe(false);
    expect(mayDeleteAsset({
      state: 'ready', activeJobCount: 0, now: new Date('2020-01-01'), retentionAt: new Date('2021-01-01'),
    })).toBe(false);
    expect(expireUpload(new Date('2020-01-01'), new Date('2021-01-01'), new Date('2022-01-01'))).toBe('hold');
    expect(() => createS3StorageFromEnv({})).toThrow(/AI_S3_ENDPOINT/);
    const full = {
      put: async () => { throw Object.assign(new Error('ENOSPC'), { code: 'ENOSPC' }); },
      get: async () => Buffer.alloc(0),
      head: async () => null,
      delete: async () => undefined,
      rename: async () => undefined,
    };
    const failing = new ObjectMediaStorage(full);
    await expect(failing.writeTemporary({
      tenantUid: 1, assetId, body: Buffer.from('x'), maxBytes: 10,
    })).rejects.toMatchObject({ code: 'ENOSPC' });

    const root = await ensureLocalRoot(await mkdtemp(join(tmpdir(), 'krasterisk-d3-')));
    try {
      const disk = new LocalObjectStore(root);
      const local = new ObjectMediaStorage(disk);
      const localWrite = await local.writeTemporary({ tenantUid: 4, assetId, body: wav, maxBytes: AI_MEDIA_MAX_BYTES });
      const localKey = (await local.commitImmutable(localWrite.tempKey)).key;
      expect((await local.stat(localKey))?.bytes).toBe(wav.length);
      await writeFile(join(root, 'outside.txt'), 'x');
      const objectPath = join(root, ...localKey.split('/'));
      await rm(objectPath);
      await symlink(join(root, 'outside.txt'), objectPath).catch(() => undefined);
      const linked = await lstat(objectPath).catch(() => null);
      if (linked?.isSymbolicLink()) {
        await expect(disk.get(localKey)).rejects.toMatchObject({ code: 'storage_path_denied' });
      }
      const otherTenant = await memory.writeTemporary({
        tenantUid: 5, assetId: 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff', body: wav, maxBytes: AI_MEDIA_MAX_BYTES,
      });
      expect(otherTenant.sha256).toBe(written.sha256);
      expect(otherTenant.tempKey).not.toBe(written.tempKey);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
