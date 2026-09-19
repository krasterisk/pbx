export const AI_CAPTURE_MANIFEST_SCHEMA = 1 as const;

export const AI_CAPTURE_ORIGINS = ['pbx_route', 'robot_session'] as const;
export type AiCaptureOrigin = typeof AI_CAPTURE_ORIGINS[number];

export const AI_CAPTURE_INTENT_STATES = ['open', 'closed', 'quarantined', 'failed'] as const;
export type AiCaptureIntentState = typeof AI_CAPTURE_INTENT_STATES[number];

export type AiCaptureManifestV1 = {
  schemaVersion: typeof AI_CAPTURE_MANIFEST_SCHEMA;
  nodeId: string;
  bindingId: string;
  bindingRevision: number;
  recordingUid: string;
  originKind: AiCaptureOrigin;
  originId: string;
  recorderId: string;
  startedAt: string;
  endedAt: string;
  sampleRateHz: number;
  channels: 1 | 2;
  container: 'wav' | 'raw';
  bytes: number;
  sha256: string;
  captureProfileRevision: string;
  spoolObjectKey: string;
  segmentTrackRoles: ReadonlyArray<{
    ordinal: number;
    role: 'operator' | 'customer' | 'mixed' | 'unknown';
    provenance: 'runtime' | 'unknown';
    confidence: number | null;
  }>;
  privacy: 'allow' | 'deny' | 'unknown';
  analysisExport: 'allow' | 'deny';
};

const FORBIDDEN_MANIFEST = /caller|clid|secret|transcript|filepath|password/i;

export function assertCaptureManifestV1(value: unknown): asserts value is AiCaptureManifestV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('capture manifest must be an object');
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (FORBIDDEN_MANIFEST.test(key)) {
      throw new Error(`capture manifest must not include ${key}`);
    }
  }
  if (record.schemaVersion !== AI_CAPTURE_MANIFEST_SCHEMA) {
    throw new Error('unsupported capture manifest schema');
  }
}

export function durableCaptureEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.DURABLE_CAPTURE === '1';
}
