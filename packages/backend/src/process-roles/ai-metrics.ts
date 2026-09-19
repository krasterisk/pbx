export type AiMetricSnapshot = {
  oldestPendingAgeMs: number;
  outboxLag: number;
  leaseExpiryCount: number;
  unknownOperations: number;
  retries: number;
  quotaRejects: number;
  storageFailures: number;
  processingDurationMs: number;
};

export function emptyAiMetrics(): AiMetricSnapshot {
  return {
    oldestPendingAgeMs: 0, outboxLag: 0, leaseExpiryCount: 0, unknownOperations: 0,
    retries: 0, quotaRejects: 0, storageFailures: 0, processingDurationMs: 0,
  };
}

const FORBIDDEN_LOG = /prompt|transcript|audio|authorization|api[_-]?key/i;

export function aiLogFields(input: {
  requestId: string; jobId?: string; stageId?: string; operationId?: string; assetId?: string;
  tenantUid: number; errorCode?: string;
}): Record<string, string | number> {
  for (const key of Object.keys(input)) {
    if (FORBIDDEN_LOG.test(key)) throw new Error('log field is not allowed');
  }
  return {
    requestId: input.requestId,
    jobId: input.jobId ?? '',
    stageId: input.stageId ?? '',
    operationId: input.operationId ?? '',
    assetId: input.assetId ?? '',
    tenantUid: input.tenantUid,
    errorCode: input.errorCode ?? '',
  };
}
