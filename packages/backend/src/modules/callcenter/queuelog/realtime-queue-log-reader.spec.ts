import { RealtimeQueueLogReader } from './realtime-queue-log-reader';
import { queueLogReaderProvider } from './queue-log-reader.factory';

describe('queue_log source selection and failures', () => {
  const makeReader = (exists: () => Promise<boolean>, query = jest.fn()) =>
    new RealtimeQueueLogReader({
      getQueryInterface: () => ({ tableExists: exists }),
      query,
    } as any);

  it('uses dialect-aware table discovery and propagates connection errors', async () => {
    expect(await makeReader(async () => true).isAvailable()).toBe(true);
    expect(await makeReader(async () => false).isAvailable()).toBe(false);
    await expect(makeReader(async () => { throw new Error('access denied'); }).isAvailable())
      .rejects.toThrow('access denied');
  });

  it('does not turn a failed realtime read into an empty successful batch', async () => {
    const reader = makeReader(async () => true, jest.fn().mockRejectedValue(new Error('connection lost')));
    await expect(reader.readEntries(new Date(0), new Date())).rejects.toThrow('connection lost');
  });

  it('falls back only for a missing table and a readable file', async () => {
    const previous = process.env.CC_QUEUE_LOG_BACKEND;
    process.env.CC_QUEUE_LOG_BACKEND = 'auto';
    try {
      const factory = (queueLogReaderProvider as any).useFactory;
      const file = { source: 'file', isAvailable: jest.fn().mockResolvedValue(true) };
      const realtime = { source: 'realtime', isAvailable: jest.fn().mockResolvedValue(false) };
      expect(await factory(file, realtime)).toBe(file);
      realtime.isAvailable.mockRejectedValueOnce(new Error('permission denied'));
      await expect(factory(file, realtime)).rejects.toThrow('permission denied');
      realtime.isAvailable.mockResolvedValue(false);
      file.isAvailable.mockResolvedValue(false);
      await expect(factory(file, realtime)).rejects.toThrow('queue_log source unavailable');
    } finally {
      if (previous === undefined) delete process.env.CC_QUEUE_LOG_BACKEND;
      else process.env.CC_QUEUE_LOG_BACKEND = previous;
    }
  });
});
