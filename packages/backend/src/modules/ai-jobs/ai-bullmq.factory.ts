import { resolveRequiredAiRedis } from './ai-redis.factory';
import { AI_OUTBOX_QUEUE } from './queue-payload';

export type AiQueueConnection = { host: string; port: number };

/** Required Redis connection for AI outbox. Does not import or alter RedisModule. */
export function resolveAiQueueConnection(env: NodeJS.Dict<string>): AiQueueConnection {
  return resolveRequiredAiRedis(env);
}

export function createAiOutboxQueue(env: NodeJS.Dict<string>): {
  name: string;
  connection: AiQueueConnection;
} {
  const connection = resolveAiQueueConnection(env);
  return { name: AI_OUTBOX_QUEUE, connection };
}
