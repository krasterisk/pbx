import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/sequelize';
import { CcQueueCall } from './models/queue-call.model';

/** Interval between automatic flushes (ms). */
export const FLUSH_INTERVAL_MS = 1000;
/** Trigger an immediate flush when buffer reaches this size. */
export const FLUSH_MAX_BATCH = 200;
/**
 * Hard cap — drop oldest rows if buffer exceeds this (T-07-01).
 * Protects memory when AMI floods or DB flush is systematically failing.
 */
export const MAX_BUFFER = 5000;

/**
 * Batched-async writer for cc_queue_calls (D-09).
 *
 * AMI handlers call enqueue() (sync push) — never await Model.create() on the
 * hot path. Flush runs on @Interval and when FLUSH_MAX_BATCH is reached.
 */
@Injectable()
export class CallCenterHistoryWriterService {
  private readonly logger = new Logger(CallCenterHistoryWriterService.name);
  private buffer: Partial<CcQueueCall>[] = [];

  constructor(
    @InjectModel(CcQueueCall) private readonly model: typeof CcQueueCall,
  ) {}

  /** Sync push into the in-memory buffer. Never awaits DB I/O. */
  enqueue(row: Partial<CcQueueCall>): void {
    this.buffer.push(row);

    if (this.buffer.length > MAX_BUFFER) {
      const dropped = this.buffer.length - MAX_BUFFER;
      this.buffer.splice(0, dropped);
      this.logger.warn(
        `History buffer cap exceeded — dropped ${dropped} oldest row(s); buffer=${this.buffer.length}`,
      );
    }

    if (this.buffer.length >= FLUSH_MAX_BATCH) {
      void this.flush();
    }
  }

  /** Drain buffer via bulkCreate. Interval-driven; also callable from tests/threshold. */
  @Interval(FLUSH_INTERVAL_MS)
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const batch = this.buffer;
    this.buffer = [];

    try {
      await this.model.bulkCreate(batch as any[], { validate: false });
    } catch (e: any) {
      this.logger.error(
        `History batch flush failed (${batch.length} rows): ${e?.message}`,
      );
      // Do not re-queue — prevents unbounded growth on systematic DB errors (D-09).
    }
  }

  /** Current buffer length (tests / metrics). */
  get bufferLength(): number {
    return this.buffer.length;
  }
}
