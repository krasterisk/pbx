export const AI_MEDIA_MAX_BYTES = 256 * 1024 * 1024;
export const AI_MEDIA_MAX_DURATION_MS = 60 * 60 * 1000;
export const AI_MEDIA_MAX_CHANNELS = 2;
export const AI_MEDIA_SAMPLE_RATES_HZ = [8000, 16000, 22050, 32000, 44100, 48000] as const;
export const AI_MEDIA_CONTAINERS = ['wav', 'flac', 'mp3'] as const;
export type AiMediaContainer = typeof AI_MEDIA_CONTAINERS[number];

export const AI_STORAGE_REF_RE = /^krs:v1:(local|s3):([0-9]+):([0-9a-fA-F-]{8,36})$/;

export type AiStorageRef = {
  scheme: 'local' | 's3';
  tenantUid: number;
  assetId: string;
};

export function parseAiStorageRef(value: string): AiStorageRef {
  const match = AI_STORAGE_REF_RE.exec(value);
  if (!match) {
    throw Object.assign(new Error('storage reference is opaque and server-issued'), { code: 'storage_ref_invalid' });
  }
  return { scheme: match[1] as 'local' | 's3', tenantUid: Number(match[2]), assetId: match[3] };
}

export function formatAiStorageRef(input: AiStorageRef): string {
  if (!Number.isInteger(input.tenantUid) || input.tenantUid < 0) {
    throw new Error('tenantUid must be a trusted non-negative integer');
  }
  if (!/^[0-9a-fA-F-]{8,36}$/.test(input.assetId)) {
    throw new Error('assetId must be a UUID-like identifier');
  }
  return `krs:v1:${input.scheme}:${input.tenantUid}:${input.assetId}`;
}

export type AiUploadAllocateInput = {
  tenantUid: number;
  principalId: string;
  resourceKind: string;
  resourceId: string;
  expectedBytes?: number;
  expectedChecksum?: string;
};

export type AiMediaProbe = {
  container: AiMediaContainer | 'unknown';
  channels: number;
  sampleRateHz: number;
  durationMs: number;
  lossless: boolean;
  channelRoles: 'unknown';
  qualityFlags: string[];
};
