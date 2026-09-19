export const AI_OUTBOX_QUEUE = 'ai-outbox';

export type AiQueueJob = {
  eventId: string;
  tenantUid: number;
  aggregateKind: string;
  aggregateId: string;
};

export function bindAiQueueJob(input: AiQueueJob): AiQueueJob {
  if (!Number.isInteger(input.tenantUid) || input.tenantUid < 0) {
    throw new Error('queue payload tenantUid must be a trusted non-negative integer');
  }
  if (!input.eventId || !input.aggregateId) {
    throw new Error('queue payload requires event and aggregate ids');
  }
  return {
    eventId: input.eventId,
    tenantUid: input.tenantUid,
    aggregateKind: input.aggregateKind,
    aggregateId: input.aggregateId,
  };
}

export function assertQueueTenant(payload: AiQueueJob, expectedTenant: number): void {
  if (payload.tenantUid !== expectedTenant) {
    throw Object.assign(new Error('forged queue payload'), {
      code: 'forged_queue_payload',
      status: 403,
    });
  }
}
