export type AiProcessRole = 'ai-api' | 'ai-worker' | 'media-worker';

export type AiReadinessInput = {
  role: AiProcessRole;
  schemaReady: boolean;
  redisReady: boolean;
  storageReady: boolean;
  encryptionReady: boolean;
  providerReady: boolean;
  inflight: number;
  backlog: number;
  backlogCap: number;
};

export type AiReadiness = {
  live: true;
  ready: boolean;
  status: 200 | 503;
  delayed: boolean;
  reason?: string;
};

export function evaluateAiReadiness(input: AiReadinessInput): AiReadiness {
  if (!input.schemaReady) {
    return { live: true, ready: false, status: 503, delayed: false, reason: 'schema' };
  }
  if (input.role !== 'ai-api' && !input.redisReady) {
    return { live: true, ready: false, status: 503, delayed: false, reason: 'redis' };
  }
  if ((input.role === 'media-worker' || input.role === 'ai-api') && !input.storageReady) {
    return { live: true, ready: false, status: 503, delayed: false, reason: 'storage' };
  }
  if (!input.encryptionReady || !input.providerReady) {
    return { live: true, ready: false, status: 503, delayed: false, reason: 'config' };
  }
  if (input.role === 'ai-api' && !input.redisReady) {
    if (input.backlog >= input.backlogCap) {
      return { live: true, ready: false, status: 503, delayed: true, reason: 'backlog' };
    }
    return { live: true, ready: false, status: 200, delayed: true, reason: 'redis-delayed' };
  }
  return { live: true, ready: true, status: 200, delayed: false };
}

export function assertNoCloudEgress(env: NodeJS.Dict<string>): void {
  if (env.AI_CLOUD_EGRESS === '1') {
    throw Object.assign(new Error('local profile forbids cloud egress'), { code: 'cloud_egress_denied' });
  }
}
