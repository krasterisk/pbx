/**
 * Abstraction over Asterisk queue_log backends (file-tail vs realtime table).
 * Both branches select at runtime via CC_QUEUE_LOG_BACKEND (D-05).
 */

export type QueueLogEntry = {
  timestamp: Date;
  callId: string;
  queueName: string;
  agent: string;
  event: string;
  params: string[];
};

export interface QueueLogReader {
  readonly source: 'file' | 'realtime';
  isAvailable(): Promise<boolean>;
  readEntries(since: Date, until: Date): Promise<QueueLogEntry[]>;
}

/** DI token for the active QueueLogReader implementation. */
export const QUEUE_LOG_READER = 'QUEUE_LOG_READER';
