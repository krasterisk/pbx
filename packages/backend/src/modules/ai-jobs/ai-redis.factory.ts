/** Fail-closed Redis for AI API/worker. Does not change optional PBX RedisModule. */
export function resolveRequiredAiRedis(env: NodeJS.Dict<string>): { host: string; port: number } {
  const host = env.REDIS_HOST?.trim();
  if (!host) {
    throw Object.assign(new Error('AI API/worker requires REDIS_HOST'), { code: 'ai_redis_required' });
  }
  const port = Number(env.REDIS_PORT || 6379);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw Object.assign(new Error('REDIS_PORT is invalid'), { code: 'ai_redis_required' });
  }
  return { host, port };
}

export async function assertAiRedisReady(ping: () => Promise<string>): Promise<void> {
  const reply = await ping();
  if (String(reply).toUpperCase() !== 'PONG') {
    throw Object.assign(new Error('AI Redis ping failed'), { code: 'ai_redis_required' });
  }
}
