import { Provider } from '@nestjs/common';
import { QUEUE_LOG_READER, QueueLogReader } from './queue-log-reader.interface';
import { FileQueueLogReader } from './file-queue-log-reader';
import { RealtimeQueueLogReader } from './realtime-queue-log-reader';

/**
 * Factory for QUEUE_LOG_READER.
 *
 * CC_QUEUE_LOG_BACKEND: file | realtime | auto
 * Default `realtime` — confirmed by 07-04 Task 1 (queue_log table present on target MySQL).
 * `auto` prefers realtime when available, else file.
 */
export const queueLogReaderProvider: Provider = {
  provide: QUEUE_LOG_READER,
  useFactory: async (
    fileReader: FileQueueLogReader,
    realtimeReader: RealtimeQueueLogReader,
  ): Promise<QueueLogReader> => {
    const backend = (process.env.CC_QUEUE_LOG_BACKEND || 'realtime').toLowerCase();
    if (backend === 'file') return fileReader;
    if (backend === 'realtime') return realtimeReader;
    // auto
    if (await realtimeReader.isAvailable()) return realtimeReader;
    return fileReader;
  },
  inject: [FileQueueLogReader, RealtimeQueueLogReader],
};
