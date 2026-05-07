import { Module, Global, Provider, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** DI token for the shared Redis client */
export const REDIS_CLIENT = 'REDIS_CLIENT';

/**
 * A null-safe Redis client stub used when Redis is not configured.
 * All operations return safe no-op results so callers don't need
 * null-checks everywhere.
 */
const nullRedis = new Proxy({} as any, {
  get: (_target, prop) => {
    // Must NOT be thenable — if .then is a function, `await nullRedis`
    // treats it as a Promise and calls .then(resolve, reject).
    // Our generic handler would return a function but never call resolve,
    // causing an infinite hang in NestJS's async provider resolution.
    if (prop === 'then' || prop === 'catch' || prop === 'finally') return undefined;
    if (prop === Symbol.toStringTag) return 'RedisNullStub';
    if (prop === 'status') return 'close';
    if (prop === 'isConnected') return false;
    return (..._args: any[]) => Promise.resolve(null);
  },
});

const redisClientProvider: Provider = {
  provide: REDIS_CLIENT,
  inject: [ConfigService],
  useFactory: async (config: ConfigService): Promise<any> => {
    const logger = new Logger('RedisModule');
    const host = config.get<string>('REDIS_HOST');
    const port = config.get<number>('REDIS_PORT') || 6379;

    if (!host) {
      logger.warn('REDIS_HOST not set — Redis disabled. Features requiring Redis will use fallbacks.');
      return nullRedis;
    }

    // Lazy require — only load ioredis when Redis is actually configured.
    // Top-level `import Redis from 'ioredis'` causes ioredis to register
    // Node.js async_hooks and trigger dns.lookup at module load time,
    // which blocks the NestJS IoC container's Promise.all() in
    // createInstances() on Windows, preventing the app from starting.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Redis = require('ioredis').default ?? require('ioredis');

    const client = new Redis({
      host,
      port,
      // Retry strategy: give up after 3 attempts (don't block startup)
      maxRetriesPerRequest: 3,
      enableOfflineQueue: false,
      lazyConnect: true,          // don't connect until first command
      connectTimeout: 5000,
      retryStrategy: (times: number) => {
        if (times > 3) return null; // stop retrying → throw error
        return Math.min(times * 500, 2000);
      },
    });

    try {
      await client.connect();
      await client.ping();
      logger.log(`Redis connected (${host}:${port})`);
      return client;
    } catch (err: any) {
      logger.warn(`Redis connection failed (${host}:${port}): ${err.message} — using null stub`);
      client.disconnect();
      return nullRedis;
    }
  },
};

/**
 * Global Redis module — provides a shared ioredis client via DI.
 *
 * Usage in any module:
 *   constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}
 *
 * The module is @Global() — no need to import it in every module,
 * just ensure it is imported ONCE in AppModule.
 *
 * If REDIS_HOST is not set or Redis is unavailable, injects a null-safe
 * proxy stub — callers receive null/resolved Promises instead of errors.
 */
@Global()
@Module({
  providers: [redisClientProvider],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
