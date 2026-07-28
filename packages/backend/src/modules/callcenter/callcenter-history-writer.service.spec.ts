import { Logger } from '@nestjs/common';
import {
  CallCenterHistoryWriterService,
  FLUSH_MAX_BATCH,
  MAX_BUFFER,
} from './callcenter-history-writer.service';

describe('CallCenterHistoryWriterService', () => {
  let service: CallCenterHistoryWriterService;
  let bulkCreate: jest.Mock;
  let emitEvent: jest.Mock;

  beforeEach(() => {
    bulkCreate = jest.fn().mockResolvedValue([]);
    emitEvent = jest.fn();
    const model = { bulkCreate } as any;
    const stateService = { emitEvent } as any;
    service = new CallCenterHistoryWriterService(model, stateService);
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
        user_uid: 7,
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

  describe('historyRow SSE (D-05)', () => {
    it('emits one historyRow per written row addressed to row.user_uid', async () => {
      const createdAt = new Date('2026-07-24T10:00:00Z');
      bulkCreate.mockResolvedValue([
        {
          uid: 101,
          user_uid: 7,
          caller_id_num: '79001112233',
          caller_id_name: 'Alice',
          direction: 'inbound',
          disposition: 'answered',
          agent_user_uid: 42,
          created_at: createdAt,
          queue_name: 'q',
          call_uniqueid: 'a',
        },
        {
          uid: 102,
          user_uid: 9,
          caller_id_num: '79004445566',
          caller_id_name: '',
          direction: 'outbound',
          disposition: 'abandoned',
          agent_user_uid: 43,
          created_at: createdAt,
          queue_name: 'q',
          call_uniqueid: 'b',
        },
      ]);

      service.enqueue({
        call_uniqueid: 'a',
        queue_name: 'q',
        disposition: 'answered',
        user_uid: 7,
        caller_id_num: '79001112233',
        caller_id_name: 'Alice',
        direction: 'inbound',
        agent_user_uid: 42,
        created_at: createdAt,
      });
      service.enqueue({
        call_uniqueid: 'b',
        queue_name: 'q',
        disposition: 'abandoned',
        user_uid: 9,
        caller_id_num: '79004445566',
        direction: 'outbound',
        agent_user_uid: 43,
        created_at: createdAt,
      });

      await service.flush();

      expect(emitEvent).toHaveBeenCalledTimes(2);
      expect(emitEvent).toHaveBeenNthCalledWith(1, 'historyRow', 7, {
        uid: 101,
        callerIdNum: '79001112233',
        callerIdName: 'Alice',
        direction: 'inbound',
        disposition: 'answered',
        agentUserUid: 42,
        createdAt,
        queueName: 'q',
        callUniqueid: 'a',
      });
      expect(emitEvent).toHaveBeenNthCalledWith(2, 'historyRow', 9, {
        uid: 102,
        callerIdNum: '79004445566',
        callerIdName: '',
        direction: 'outbound',
        disposition: 'abandoned',
        agentUserUid: 43,
        createdAt,
        queueName: 'q',
        callUniqueid: 'b',
      });
    });

    it('does not emit when bulkCreate throws', async () => {
      bulkCreate.mockRejectedValue(new Error('DB down'));
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();

      service.enqueue({
        call_uniqueid: 'x',
        queue_name: 'q',
        disposition: 'other',
        user_uid: 7,
      });
      await service.flush();

      expect(emitEvent).not.toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it('falls back to buffered row fields when bulkCreate returns empty', async () => {
      bulkCreate.mockResolvedValue([]);
      const createdAt = new Date('2026-07-24T11:00:00Z');

      service.enqueue({
        uid: undefined,
        call_uniqueid: 'c',
        queue_name: 'q',
        disposition: 'answered',
        user_uid: 7,
        caller_id_num: '101',
        caller_id_name: 'Bob',
        direction: 'personal',
        agent_user_uid: 5,
        created_at: createdAt,
      });
      await service.flush();

      expect(emitEvent).toHaveBeenCalledTimes(1);
      expect(emitEvent).toHaveBeenCalledWith('historyRow', 7, {
        uid: undefined,
        callerIdNum: '101',
        callerIdName: 'Bob',
        direction: 'personal',
        disposition: 'answered',
        agentUserUid: 5,
        createdAt,
        queueName: 'q',
        callUniqueid: 'c',
      });
    });

    it('createOne emits historyRow after a successful single insert', async () => {
      const createdAt = new Date('2026-07-24T12:00:00Z');
      const create = jest.fn().mockResolvedValue({
        uid: 55,
        user_uid: 7,
        caller_id_num: '200',
        caller_id_name: 'Carol',
        direction: 'internal',
        disposition: 'answered',
        agent_user_uid: 1,
        created_at: createdAt,
        queue_name: 'direct',
        call_uniqueid: 's1',
      });
      const model = { bulkCreate, create } as any;
      const stateService = { emitEvent } as any;
      const single = new CallCenterHistoryWriterService(model, stateService);

      await single.createOne({
        call_uniqueid: 's1',
        queue_name: 'direct',
        disposition: 'answered',
        user_uid: 7,
      });

      expect(create).toHaveBeenCalledTimes(1);
      expect(emitEvent).toHaveBeenCalledWith('historyRow', 7, {
        uid: 55,
        callerIdNum: '200',
        callerIdName: 'Carol',
        direction: 'internal',
        disposition: 'answered',
        agentUserUid: 1,
        createdAt,
        queueName: 'direct',
        callUniqueid: 's1',
      });
    });
  });
});
