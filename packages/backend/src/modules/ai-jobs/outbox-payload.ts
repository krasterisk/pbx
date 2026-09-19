import { createAiOutboxPayloadV1 } from '@krasterisk/shared';

export function admittedJobPayload(tenantUid: number, jobId: string) {
  return createAiOutboxPayloadV1({
    tenantUid,
    aggregateKind: 'job',
    aggregateId: jobId,
    eventType: 'job.admitted',
  });
}
