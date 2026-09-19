export const AI_OUTBOX_SCHEMA_VERSION = 1 as const;

export const AI_AGGREGATE_KINDS = ['job', 'asset', 'upload', 'provider_revision'] as const;
export type AiAggregateKind = typeof AI_AGGREGATE_KINDS[number];

export const AI_OUTBOX_EVENT_TYPES = [
  'job.admitted',
  'job.terminal',
  'asset.ready',
  'asset.deleted',
] as const;
export type AiOutboxEventType = typeof AI_OUTBOX_EVENT_TYPES[number];

/** Outbox payload is identifiers plus schema version. Consumers re-read SQL. */
export type AiOutboxPayloadV1 = {
  schemaVersion: typeof AI_OUTBOX_SCHEMA_VERSION;
  tenantUid: number;
  aggregateKind: AiAggregateKind;
  aggregateId: string;
  eventType: AiOutboxEventType;
};

const FORBIDDEN_METADATA = /secret|password|authorization|transcript|prompt|filepath|storage_path|api[_-]?key/i;

export function createAiOutboxPayloadV1(input: {
  tenantUid: number;
  aggregateKind: AiAggregateKind;
  aggregateId: string;
  eventType: AiOutboxEventType;
}): AiOutboxPayloadV1 {
  if (!Number.isInteger(input.tenantUid) || input.tenantUid < 0) {
    throw new Error('tenantUid must be a trusted non-negative integer');
  }
  if (!/^[0-9a-fA-F-]{8,36}$/.test(input.aggregateId)) {
    throw new Error('aggregateId must be a UUID-like identifier');
  }
  return {
    schemaVersion: AI_OUTBOX_SCHEMA_VERSION,
    tenantUid: input.tenantUid,
    aggregateKind: input.aggregateKind,
    aggregateId: input.aggregateId,
    eventType: input.eventType,
  };
}

export function assertSafeAiMetadata(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('AI metadata must be a versioned object');
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (FORBIDDEN_METADATA.test(key)) {
      throw new Error(`AI metadata must not include ${key}`);
    }
  }
}
