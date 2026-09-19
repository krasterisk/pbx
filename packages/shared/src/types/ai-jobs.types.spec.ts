import {
  AI_OUTBOX_SCHEMA_VERSION,
  assertSafeAiMetadata,
  createAiOutboxPayloadV1,
} from './ai-jobs.types';

describe('AI job/outbox shared contracts', () => {
  it('builds a v1 payload of ids and schema version only', () => {
    expect(createAiOutboxPayloadV1({
      tenantUid: 2,
      aggregateKind: 'job',
      aggregateId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      eventType: 'job.admitted',
    })).toEqual({
      schemaVersion: AI_OUTBOX_SCHEMA_VERSION,
      tenantUid: 2,
      aggregateKind: 'job',
      aggregateId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      eventType: 'job.admitted',
    });
  });

  it('rejects secrets, paths and untrusted tenant ids', () => {
    expect(() => assertSafeAiMetadata({ secret: 'x' })).toThrow(/secret/);
    expect(() => assertSafeAiMetadata({ storage_path: '/tmp/a.wav' })).toThrow(/storage_path/);
    expect(() => createAiOutboxPayloadV1({
      tenantUid: -1,
      aggregateKind: 'asset',
      aggregateId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      eventType: 'asset.ready',
    })).toThrow(/tenantUid/);
    assertSafeAiMetadata({ schemaVersion: 1, durationMs: 12 });
  });
});
