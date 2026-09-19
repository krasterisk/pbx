import { createHash, randomUUID } from 'node:crypto';
import { recordingBusinessKey } from '@krasterisk/shared';
import { DomainError, hashBusinessKey, type AnalyticsStores, type ProjectRow } from './project-engine';

export type RecordingRow = {
  id: string;
  tenantUid: number;
  projectId: string;
  principalId: string;
  externalCallId: string;
  sourcePart: string;
  businessKeyHash: string;
  assetId: string;
  contentDigest: string;
  metadata: string;
};

export type RunRow = {
  id: string;
  tenantUid: number;
  recordingId: string;
  projectVersionId: string;
  jobId: string;
  state: string;
};

export type IngestStores = AnalyticsStores & {
  recordings: Map<string, RecordingRow>;
  runs: Map<string, RunRow>;
  assets: Map<string, { id: string; tenantUid: number; state: string; sha256: string }>;
};

export function emptyIngestStores(base?: AnalyticsStores): IngestStores {
  return {
    projects: base?.projects ?? new Map(),
    versions: base?.versions ?? new Map(),
    members: base?.members ?? new Map(),
    recordings: new Map(),
    runs: new Map(),
    assets: new Map(),
  };
}

export function claimRecording(input: {
  stores: IngestStores;
  tenantUid: number;
  principalId: string;
  project: ProjectRow;
  externalCallId: string;
  sourcePart: string;
  assetId: string;
  metadata: Record<string, unknown>;
}): RecordingRow {
  if (input.project.tenantUid !== input.tenantUid || input.project.status === 'archived') {
    throw new DomainError('project_archived', 409);
  }
  if (!input.project.activeVersionId) throw new DomainError('project_not_published', 409);
  const asset = input.stores.assets.get(input.assetId);
  if (!asset || asset.tenantUid !== input.tenantUid) throw new DomainError('foreign_asset', 404);
  if (asset.state !== 'ready') throw new DomainError('asset_not_ready', 409);
  const externalCallId = input.externalCallId;
  if (Buffer.byteLength(externalCallId, 'utf8') < 1 || Buffer.byteLength(externalCallId, 'utf8') > 128) {
    throw new DomainError('metadata_invalid', 422);
  }
  const sourcePart = input.sourcePart || 'main';
  const raw = recordingBusinessKey({
    tenantUid: input.tenantUid, principalId: input.principalId, projectId: input.project.id,
    externalCallId, sourcePart,
  });
  const businessKeyHash = hashBusinessKey(raw);
  const existing = [...input.stores.recordings.values()].find(row =>
    row.tenantUid === input.tenantUid && row.projectId === input.project.id
    && row.principalId === input.principalId && row.businessKeyHash === businessKeyHash);
  if (existing) {
    if (existing.contentDigest === asset.sha256) return existing;
    throw new DomainError('recording_conflict', 409);
  }
  const recording: RecordingRow = {
    id: randomUUID(),
    tenantUid: input.tenantUid,
    projectId: input.project.id,
    principalId: input.principalId,
    externalCallId,
    sourcePart,
    businessKeyHash,
    assetId: asset.id,
    contentDigest: asset.sha256,
    metadata: JSON.stringify(input.metadata),
  };
  input.stores.recordings.set(recording.id, recording);
  return recording;
}

export function admitInitialRun(input: {
  stores: IngestStores;
  recording: RecordingRow;
  projectVersionId: string;
  jobId: string;
}): RunRow {
  const existing = [...input.stores.runs.values()].find(row => row.recordingId === input.recording.id);
  if (existing) return existing;
  const run: RunRow = {
    id: randomUUID(),
    tenantUid: input.recording.tenantUid,
    recordingId: input.recording.id,
    projectVersionId: input.projectVersionId,
    jobId: input.jobId,
    state: 'queued',
  };
  input.stores.runs.set(run.id, run);
  return run;
}

export function metadataAllowlist(input: Record<string, unknown>): Record<string, unknown> {
  const allowed = ['occurredAt', 'timezone', 'direction', 'participants', 'labels'];
  const out: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in input) out[key] = input[key];
  }
  if (JSON.stringify(out).length > 4096) throw new DomainError('metadata_invalid', 422);
  return out;
}

export function uploadChecksum(body: Buffer): string {
  return createHash('sha256').update(body).digest('hex');
}
