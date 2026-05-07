import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import axios from 'axios';
import { WebhookFailure } from './webhook-failure.model';

export interface WebhookJobData {
  url: string;
  payload: Record<string, any>;
  headers: Record<string, string>;
  tag: string;
}

/**
 * Webhook delivery queue with in-memory retry + DB dead-letter persistence.
 *
 * NOTE: BullMQ/ioredis were removed — importing BullMQ caused Node.js-level
 * hooks to fire at module load time, blocking NestJS initialization even when
 * Redis was not configured. This implementation uses setTimeout-based retry
 * with exponential backoff. BullMQ can be re-added as a separate opt-in module
 * when running on Linux with Redis available.
 *
 * Retry schedule:
 *   Attempt 1 → immediate
 *   Attempt 2 → 2s  after failure
 *   Attempt 3 → 4s  after failure
 */
@Injectable()
export class WebhookQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(WebhookQueueService.name);
  private readonly timers = new Set<NodeJS.Timeout>();

  constructor(
    @InjectModel(WebhookFailure) private readonly failureModel: typeof WebhookFailure,
  ) {}

  /**
   * Enqueue a webhook for delivery with exponential retry.
   * Fire-and-forget: returns immediately, delivery is async.
   */
  async enqueue(data: WebhookJobData): Promise<void> {
    this.deliverWithRetry(data, 1);
  }

  /**
   * List webhook failures from DB with pagination and optional filters.
   */
  async getFailures(opts: {
    page?: number;
    limit?: number;
    resolved?: boolean;
    event?: string;
  } = {}) {
    const { page = 1, limit = 50, resolved, event } = opts;
    const where: Record<string, any> = {};
    if (resolved !== undefined) where['resolved'] = resolved;
    if (event) where['event'] = event;

    const { count, rows } = await this.failureModel.findAndCountAll({
      where,
      order: [['failed_at', 'DESC']],
      limit,
      offset: (page - 1) * limit,
    });

    return { total: count, page, limit, items: rows };
  }

  /**
   * Retry a specific webhook failure by ID.
   */
  async retryFailure(id: number): Promise<{ queued: boolean; reason?: string }> {
    const failure = await this.failureModel.findByPk(id);
    if (!failure) return { queued: false, reason: 'Not found' };

    const data: WebhookJobData = {
      url: failure.url,
      payload: failure.payload,
      headers: failure.headers,
      tag: `${failure.event}:${failure.route_uid}:retry`,
    };

    this.deliverWithRetry(data, 1);
    await failure.update({ retried_at: new Date() });
    return { queued: true };
  }

  /** Mark a failure as resolved (dismissed without retry). */
  async resolveFailure(id: number): Promise<void> {
    await this.failureModel.update({ resolved: true }, { where: { id } });
  }

  /** Bulk resolve all unresolved failures (optionally filtered by route). */
  async resolveAll(routeUid?: string): Promise<number> {
    const where: Record<string, any> = { resolved: false };
    if (routeUid) where['route_uid'] = routeUid;
    const [count] = await this.failureModel.update({ resolved: true }, { where });
    return count;
  }

  /** Queue stats stub — returns null (no persistent queue). */
  async getStats() {
    return null;
  }

  onModuleDestroy() {
    // Cancel pending retry timers on graceful shutdown
    for (const timer of this.timers) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private deliverWithRetry(data: WebhookJobData, attempt: number): void {
    const maxAttempts = 3;

    axios
      .post(data.url, data.payload, { timeout: 10_000, headers: data.headers })
      .then(() => {
        this.logger.log(`[${data.tag}] delivered (attempt ${attempt}): ${data.url}`);
      })
      .catch((err: any) => {
        if (attempt < maxAttempts) {
          const delay = Math.pow(2, attempt) * 1000; // 2s → 4s
          this.logger.warn(`[${data.tag}] attempt ${attempt} failed, retry in ${delay}ms: ${err?.message}`);
          const timer = setTimeout(() => {
            this.timers.delete(timer);
            this.deliverWithRetry(data, attempt + 1);
          }, delay);
          this.timers.add(timer);
        } else {
          this.logger.error(`[${data.tag}] DEAD after ${maxAttempts} attempts: ${data.url} — ${err?.message}`);
          this.persistFailure(data, err?.message ?? 'Unknown error', attempt).catch(() => null);
        }
      });
  }

  private async persistFailure(data: WebhookJobData, error: string, attempts: number): Promise<void> {
    try {
      const [event, ...rest] = data.tag.split(':');
      const routeUid = rest.find(p => !['retry'].includes(p)) || data.payload?.route_uid || '';
      await this.failureModel.create({
        route_uid: routeUid,
        event: event || data.tag,
        url: data.url,
        payload: data.payload,
        headers: data.headers,
        error: error.slice(0, 2000),
        attempts,
        failed_at: new Date(),
        retried_at: null,
        resolved: false,
      });
    } catch (dbErr: any) {
      this.logger.error(`Failed to save webhook failure to DB: ${dbErr?.message}`);
    }
  }
}
