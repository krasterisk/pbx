import { Logger } from '@nestjs/common';
import {
  CallCenterHistoryWriterService,
  FLUSH_MAX_BATCH,
  MAX_BUFFER,
} from './callcenter-history-writer.service';

describe('CallCenterHistoryWriterService', () => {
  let service: CallCenterHistoryWriterService;
  let bulkCreate: jest.Mock;

  beforeEach(() => {
    bulkCreate = jest.fn().mockResolvedValue([]);
    const model = { bulkCreate } as any;
    service = new CallCenterHistoryWriterService(model);
  });

  it('enqueue does not write to DB immediately', () => {
    service.enqueue({ call_uniqueid: 'u1', queue_name: 'q1', disposition: 'answered' });
    expect(bulkCreate).not.toHaveBeenCalled();
    expect(service.bufferLength).toBe(1);
  });

  it('triggers bulkCreate when buffer reaches FLUSH_MAX_BATCH', async () => {
    for (let i = 0; i < FLUSH_MAX_BATCH; i++) {
      service.enqueue({
        call_uniqueid: `u-${i}`,
        queue_name: 'q1',
        disposition: 'answered',
      });
    }
    // Threshold flush is fire-and-forget; allow microtask to settle
    await Promise.resolve();
    await new Promise(r => setImmediate(r));

    expect(bulkCreate).toHaveBeenCalledTimes(1);
    expect(bulkCreate.mock.calls[0][0]).toHaveLength(FLUSH_MAX_BATCH);
    expect(service.bufferLength).toBe(0);
  });

  it('manual flush writes buffered rows and clears buffer', async () => {
    service.enqueue({ call_uniqueid: 'a', queue_name: 'q', disposition: 'abandoned' });
    service.enqueue({ call_uniqueid: 'b', queue_name: 'q', disposition: 'answered' });
    expect(bulkCreate).not.toHaveBeenCalled();

    await service.flush();

    expect(bulkCreate).toHaveBeenCalledTimes(1);
    expect(bulkCreate.mock.calls[0][0]).toHaveLength(2);
    expect(bulkCreate.mock.calls[0][1]).toEqual({ validate: false });
    expect(service.bufferLength).toBe(0);
  });

  it('cap: buffer length never exceeds MAX_BUFFER and logs warn on drop', () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    // Push past cap without triggering threshold flush by stubbing flush
    const flushSpy = jest.spyOn(service, 'flush').mockResolvedValue(undefined);

    for (let i = 0; i < MAX_BUFFER + 50; i++) {
      service.enqueue({
        call_uniqueid: `flood-${i}`,
        queue_name: 'q',
        disposition: 'other',
      });
    }

    expect(service.bufferLength).toBeLessThanOrEqual(MAX_BUFFER);
    expect(warnSpy).toHaveBeenCalled();
    const warnMsg = String(warnSpy.mock.calls[0][0]);
    expect(warnMsg).toMatch(/cap|dropped/i);

    flushSpy.mockRestore();
    warnSpy.mockRestore();
  });
});
