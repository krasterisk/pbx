import { createHash, randomUUID } from 'node:crypto';
import { createAiOutboxPayloadV1, AI_MEDIA_MAX_BYTES, formatAiStorageRef } from '@krasterisk/shared';
import { finalizeAssetProbe, transitionAsset, transitionUpload, type AssetState, type UploadState } from './asset-state-machine';
import { probeMediaBuffer } from './probe';
import type { MediaStorage } from './storage.port';

export type UploadSession = {
  id: string;
  tenantUid: number;
  principalId: string;
  assetId: string;
  state: UploadState;
  expectedBytes: number | null;
  receivedBytes: number;
  chunks: Buffer[];
  requestHash: string;
};

export type AssetRow = {
  id: string;
  tenantUid: number;
  state: AssetState;
  sha256: string | null;
  bytes: number;
  storageKey: string;
  metadata: string;
};

export type MediaStores = {
  uploads: Map<string, UploadSession>;
  assets: Map<string, AssetRow>;
  outbox: Map<string, { id: string; eventType: string }>;
};

export function emptyMediaStores(): MediaStores {
  return { uploads: new Map(), assets: new Map(), outbox: new Map() };
}

export function allocateUpload(input: {
  tenantUid: number;
  principalId: string;
  expectedBytes?: number;
  now: Date;
}): { upload: UploadSession; asset: AssetRow } {
  const assetId = randomUUID();
  const uploadId = randomUUID();
  const asset: AssetRow = {
    id: assetId,
    tenantUid: input.tenantUid,
    state: 'allocated',
    sha256: null,
    bytes: 0,
    storageKey: formatAiStorageRef({ scheme: 'local', tenantUid: input.tenantUid, assetId }),
    metadata: '{}',
  };
  const upload: UploadSession = {
    id: uploadId,
    tenantUid: input.tenantUid,
    principalId: input.principalId,
    assetId,
    state: 'allocated',
    expectedBytes: input.expectedBytes ?? null,
    receivedBytes: 0,
    chunks: [],
    requestHash: createHash('sha256').update(`${input.tenantUid}:${assetId}`).digest('hex'),
  };
  return { upload, asset };
}

export function appendChunk(upload: UploadSession, chunk: Buffer, maxBytes = AI_MEDIA_MAX_BYTES): UploadSession {
  const nextState = upload.state === 'allocated' ? transitionUpload('allocated', 'uploading') : upload.state;
  if (nextState !== 'uploading') {
    throw Object.assign(new Error('upload is not writable'), { code: 'upload_not_writable' });
  }
  const received = upload.receivedBytes + chunk.length;
  if (received > maxBytes || (upload.expectedBytes != null && received > upload.expectedBytes)) {
    throw Object.assign(new Error('upload exceeds byte limit'), { code: 'upload_overflow' });
  }
  return {
    ...upload,
    state: nextState,
    receivedBytes: received,
    chunks: [...upload.chunks, chunk],
  };
}

export async function finalizeUpload(input: {
  upload: UploadSession;
  asset: AssetRow;
  storage: MediaStorage;
  claimedMime?: string;
  crash?: 'after-rename';
}): Promise<{ upload: UploadSession; asset: AssetRow; outbox?: { eventType: string } }> {
  const body = Buffer.concat(input.upload.chunks);
  const written = await input.storage.writeTemporary({
    tenantUid: input.asset.tenantUid,
    assetId: input.asset.id,
    body,
    maxBytes: AI_MEDIA_MAX_BYTES,
  });
  await input.storage.commitImmutable(written.tempKey);
  let asset: AssetRow = {
    ...input.asset,
    bytes: written.bytes,
    sha256: written.sha256,
    storageKey: formatAiStorageRef({
      scheme: 'local', tenantUid: input.asset.tenantUid, assetId: input.asset.id,
    }),
  };
  if (asset.state === 'allocated') {
    asset = { ...asset, state: transitionAsset('allocated', 'uploading') };
  }
  if (asset.state === 'uploading') {
    asset = { ...asset, state: transitionAsset('uploading', 'probing') };
  }
  if (input.crash === 'after-rename') {
    throw Object.assign(new Error('crash after rename'), { code: 'crash_after_rename', asset });
  }
  if (asset.state === 'ready') {
    return {
      upload: { ...input.upload, state: 'completed' },
      asset,
      outbox: { eventType: 'asset.ready' },
    };
  }
  const probe = probeMediaBuffer(body, input.claimedMime);
  asset = {
    ...asset,
    state: finalizeAssetProbe('probing', 'ready'),
    metadata: JSON.stringify(probe),
  };
  return {
    upload: { ...input.upload, state: transitionUpload(input.upload.state === 'allocated' ? 'uploading' : input.upload.state, 'completed') },
    asset,
    outbox: { eventType: createAiOutboxPayloadV1({
      tenantUid: asset.tenantUid, aggregateKind: 'asset', aggregateId: asset.id, eventType: 'asset.ready',
    }).eventType },
  };
}

export function reconcileUnreadyObject(asset: AssetRow, objectExists: boolean, checksumMatches: boolean): AssetState {
  if (asset.state === 'ready') return 'ready';
  if (objectExists && !checksumMatches) return asset.state;
  if (objectExists && asset.state === 'probing') return 'probing';
  return asset.state;
}
