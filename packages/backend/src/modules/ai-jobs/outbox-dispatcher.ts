export type OutboxRecord = {
  id: string;
  deliveredAt: Date | null;
  leaseOwner: string | null;
  attempts: number;
};

export type QueuePort = {
  enqueue: (id: string) => Promise<void>;
};

export async function dispatchOutbox(
  record: OutboxRecord,
  queue: QueuePort,
  now: Date,
  crash?: 'after-enqueue',
): Promise<OutboxRecord> {
  if (record.deliveredAt) {
    return record;
  }
  await queue.enqueue(record.id);
  if (crash === 'after-enqueue') {
    throw Object.assign(new Error('crash after enqueue'), { code: 'crash_after_enqueue' });
  }
  return { ...record, deliveredAt: now, attempts: record.attempts + 1, leaseOwner: null };
}

export function dedupeDelivery(record: OutboxRecord): 'apply' | 'skip' {
  return record.deliveredAt ? 'skip' : 'apply';
}

export function handleQueueEvent(processed: Set<string>, eventId: string): 'apply' | 'skip' {
  if (processed.has(eventId)) return 'skip';
  processed.add(eventId);
  return 'apply';
}
