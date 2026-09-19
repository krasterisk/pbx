import { createHash, randomUUID } from 'node:crypto';
import type { AiCaptureManifestV1, AiCaptureOrigin } from '@krasterisk/shared';
import { assertCaptureManifestV1 } from '@krasterisk/shared';

export class DomainError extends Error {
  constructor(readonly code: string, readonly status: number, message?: string) {
    super(message ? `${code}: ${message}` : code);
  }
}

export type CaptureBinding = {
  id: string;
  nodeId: string;
  tenantUid: number;
  revision: number;
  status: 'active' | 'revoked' | 'expired';
  identityDigest: string;
  expiresAt: Date;
};

export type CaptureIntent = {
  id: string;
  tenantUid: number;
  nodeId: string;
  recordingUid: string;
  originKind: AiCaptureOrigin;
  originId: string;
  recorderId: string;
  bindingId: string;
  bindingRevision: number;
  state: 'open' | 'closed' | 'quarantined' | 'failed';
  policySnapshot: string;
  callRef: string | null;
};

export type CaptureReceipt = {
  id: string;
  tenantUid: number;
  nodeId: string;
  recordingUid: string;
  manifestRevision: number;
  digest: string;
  assetId: string;
  status: 'acked' | 'quarantined';
};

export type CaptureAsset = { id: string; tenantUid: number; sha256: string };

export type CaptureStores = {
  bindings: Map<string, CaptureBinding>;
  intents: Map<string, CaptureIntent>;
  receipts: Map<string, CaptureReceipt>;
  assets: Map<string, CaptureAsset>;
};

export function emptyCaptureStores(): CaptureStores {
  return { bindings: new Map(), intents: new Map(), receipts: new Map(), assets: new Map() };
}

export function digestNodeIdentity(nodeId: string, secret: string): string {
  return createHash('sha256').update(`${nodeId}:${secret}`).digest('hex');
}

export function digestManifest(manifest: AiCaptureManifestV1): string {
  return createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
}

function intentKey(nodeId: string, recordingUid: string): string {
  return `${nodeId}:${recordingUid}`;
}

function receiptKey(nodeId: string, recordingUid: string, revision: number): string {
  return `${nodeId}:${recordingUid}:${revision}`;
}

export function createCaptureIntent(input: {
  stores: CaptureStores;
  nodeId: string;
  nodeIdentityDigest: string;
  recordingUid: string;
  claimedTenantUid: number;
  originKind: AiCaptureOrigin;
  originId: string;
  recorderId: string;
  bindingId: string;
  now: Date;
  policy: { capture: 'allow' | 'deny'; analysisExport: 'allow' | 'deny' };
  callRef?: string;
}): CaptureIntent {
  const binding = input.stores.bindings.get(input.bindingId);
  if (!binding || binding.nodeId !== input.nodeId) {
    throw new DomainError('spoof_node', 403, 'node identity does not match binding');
  }
  if (binding.identityDigest !== input.nodeIdentityDigest) {
    throw new DomainError('spoof_node', 403, 'node identity does not match binding');
  }
  if (binding.status === 'revoked') throw new DomainError('binding_revoked', 403);
  if (binding.status === 'expired' || binding.expiresAt.getTime() <= input.now.getTime()) {
    throw new DomainError('binding_expired', 403);
  }
  if (binding.tenantUid !== input.claimedTenantUid) {
    throw new DomainError('tenant_mismatch', 404);
  }
  if (input.policy.capture === 'deny' || input.policy.analysisExport === 'deny') {
    throw new DomainError('policy_deny', 403);
  }
  const existing = [...input.stores.intents.values()]
    .find(row => row.nodeId === input.nodeId && row.recordingUid === input.recordingUid);
  if (existing) {
    if (existing.tenantUid === binding.tenantUid && existing.recorderId === input.recorderId) {
      return existing;
    }
    throw new DomainError('duplicate_recording', 409);
  }
  const intent: CaptureIntent = {
    id: randomUUID(),
    tenantUid: binding.tenantUid,
    nodeId: input.nodeId,
    recordingUid: input.recordingUid,
    originKind: input.originKind,
    originId: input.originId,
    recorderId: input.recorderId,
    bindingId: binding.id,
    bindingRevision: binding.revision,
    state: 'open',
    policySnapshot: JSON.stringify(input.policy),
    callRef: input.callRef ?? null,
  };
  input.stores.intents.set(intentKey(intent.nodeId, intent.recordingUid), intent);
  return intent;
}

export function ackCaptureManifest(input: {
  stores: CaptureStores;
  nodeId: string;
  nodeIdentityDigest: string;
  manifest: AiCaptureManifestV1;
  assetId: string;
  now: Date;
}): CaptureReceipt {
  assertCaptureManifestV1(input.manifest);
  if (input.manifest.nodeId !== input.nodeId) {
    throw new DomainError('spoof_node', 403);
  }
  const binding = [...input.stores.bindings.values()].find(row => row.id === input.manifest.bindingId);
  if (!binding || binding.nodeId !== input.nodeId
    || binding.identityDigest !== input.nodeIdentityDigest
    || binding.revision !== input.manifest.bindingRevision) {
    throw new DomainError('spoof_node', 403);
  }
  if (binding.status !== 'active' || binding.expiresAt.getTime() <= input.now.getTime()) {
    throw new DomainError(binding.status === 'revoked' ? 'binding_revoked' : 'binding_expired', 403);
  }
  const asset = input.stores.assets.get(input.assetId);
  if (!asset || asset.tenantUid !== binding.tenantUid) {
    throw new DomainError('foreign_asset', 404);
  }
  if (asset.sha256 !== input.manifest.sha256) {
    throw new DomainError('foreign_asset', 409);
  }
  const digest = digestManifest(input.manifest);
  const key = receiptKey(input.nodeId, input.manifest.recordingUid, 1);
  const existing = input.stores.receipts.get(key);
  if (existing) {
    if (existing.digest === digest) return existing;
    existing.status = 'quarantined';
    throw new DomainError('manifest_conflict', 409);
  }
  const receipt: CaptureReceipt = {
    id: randomUUID(),
    tenantUid: binding.tenantUid,
    nodeId: input.nodeId,
    recordingUid: input.manifest.recordingUid,
    manifestRevision: 1,
    digest,
    assetId: input.assetId,
    status: 'acked',
  };
  input.stores.receipts.set(key, receipt);
  const intent = input.stores.intents.get(intentKey(input.nodeId, input.manifest.recordingUid));
  if (intent) intent.state = 'closed';
  return receipt;
}

export function appendCaptureSegment(intent: CaptureIntent, privacy: 'allow' | 'deny' | 'unknown'): CaptureIntent {
  if (privacy === 'deny') return { ...intent, state: 'quarantined' };
  return intent;
}
