import { CallCenterQueueLogReconcilerService } from './callcenter-queuelog-reconciler.service';
import { FileQueueLogReader } from './queuelog/file-queue-log-reader';
import type { QueueLogEntry } from './queuelog/queue-log-reader.interface';

describe('CallCenterQueueLogReconcilerService', () => {
  let service: CallCenterQueueLogReconcilerService;
  let readEntries: jest.Mock;
  let findOne: jest.Mock;
  let bulkCreate: jest.Mock;
  let recomputeDay: jest.Mock;

  const yesterday = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    d.setHours(12, 0, 0, 0);
    return d;
  })();

  function makeEntries(callId: string, queue: string): QueueLogEntry[] {
    const t0 = new Date(yesterday.getTime());
    const t1 = new Date(yesterday.getTime() + 30_000);
    const t2 = new Date(yesterday.getTime() + 90_000);
    return [
      {
        timestamp: t0,
        callId,
        queueName: queue,
        agent: 'NONE',
        event: 'ENTERQUEUE',
        params: ['1', '79001234567'],
      },
      {
        timestamp: t1,
        callId,
        queueName: queue,
        agent: 'PJSIP/101',
        event: 'CONNECT',
        params: ['30', 'bridge'],
      },
      {
        timestamp: t2,
        callId,
        queueName: queue,
        agent: 'PJSIP/101',
        event: 'COMPLETECALLER',
        params: ['30', '60', '1'],
      },
    ];
  }

  beforeEach(() => {
    readEntries = jest.fn().mockResolvedValue([]);
    findOne = jest.fn().mockResolvedValue(null);
    bulkCreate = jest.fn().mockResolvedValue([]);
    recomputeDay = jest.fn().mockResolvedValue(undefined);
    service = new CallCenterQueueLogReconcilerService(
      { source: 'realtime', readEntries, isAvailable: async () => true } as any,
      { findOne, bulkCreate } as any,
      { recomputeDay } as any,
    );
  });

  it('inserts missing call via bulkCreate with answered disposition', async () => {
    readEntries.mockResolvedValue(makeEntries('U-new', 'sales_7'));
    const n = await service.reconcileRange(
      new Date(yesterday.getTime() - 3600_000),
      new Date(yesterday.getTime() + 3600_000),
    );
    expect(n).toBe(1);
    expect(bulkCreate).toHaveBeenCalledTimes(1);
    const rows = bulkCreate.mock.calls[0][0];
    expect(rows[0]).toEqual(
      expect.objectContaining({
        call_uniqueid: 'U-new',
        queue_name: 'sales_7',
        disposition: 'answered',
        user_uid: 7,
        agent_interface: 'PJSIP/101',
        talk_time: 60,
      }),
    );
    expect(bulkCreate.mock.calls[0][1]).toEqual(
      expect.objectContaining({ ignoreDuplicates: true }),
    );
  });

  it('persists transfer destination from QueueLog TRANSFER data1', async () => {
    const t0 = new Date(yesterday.getTime());
    const t1 = new Date(yesterday.getTime() + 30_000);
    const t2 = new Date(yesterday.getTime() + 90_000);
    readEntries.mockResolvedValue([
      {
        timestamp: t0,
        callId: 'U-xfer',
        queueName: 'sales_7',
        agent: 'NONE',
        event: 'ENTERQUEUE',
        params: ['1', '79001234567'],
      },
      {
        timestamp: t1,
        callId: 'U-xfer',
        queueName: 'sales_7',
        agent: 'PJSIP/101',
        event: 'CONNECT',
        params: ['10', 'bridge'],
      },
      {
        timestamp: t2,
        callId: 'U-xfer',
        queueName: 'sales_7',
        agent: 'PJSIP/101',
        event: 'TRANSFER',
        params: ['205', 'from-internal', '10', '45', '1'],
      },
    ]);
    await service.reconcileRange(
      new Date(yesterday.getTime() - 3600_000),
      new Date(yesterday.getTime() + 3600_000),
    );
    const rows = bulkCreate.mock.calls[0][0];
    expect(rows[0]).toEqual(
      expect.objectContaining({
        call_uniqueid: 'U-xfer',
        disposition: 'transferred',
        transfer_destination: '205',
        talk_time: 45,
      }),
    );
  });

  it('skips callId already present in cc_queue_calls', async () => {
    readEntries.mockResolvedValue(makeEntries('U-exist', 'sales_7'));
    findOne.mockResolvedValue({ uid: 1, call_uniqueid: 'U-exist' });
    const n = await service.reconcileRange(yesterday, new Date(yesterday.getTime() + 1));
    expect(n).toBe(0);
    expect(bulkCreate).not.toHaveBeenCalled();
  });

  it('skips entries with unresolvable tenant (no user_uid=0)', async () => {
    readEntries.mockResolvedValue(makeEntries('U-orphan', 'orphan-queue'));
    const n = await service.reconcileRange(yesterday, new Date(yesterday.getTime() + 1));
    expect(n).toBe(0);
    expect(bulkCreate).not.toHaveBeenCalled();
  });

  it('calls recomputeDay for backfilled prior calendar day', async () => {
    readEntries.mockResolvedValue(makeEntries('U-yday', 'support_3'));
    await service.reconcileRange(
      new Date(yesterday.getTime() - 60_000),
      new Date(yesterday.getTime() + 120_000),
    );
    expect(recomputeDay).toHaveBeenCalled();
    const [dayArg, uidArg] = recomputeDay.mock.calls[0];
    expect(uidArg).toBe(3);
    expect(dayArg instanceof Date).toBe(true);
  });

  it('skips reader when already running', async () => {
    (service as any).running = true;
    const n = await service.reconcileRange(yesterday, new Date());
    expect(n).toBe(0);
    expect(readEntries).not.toHaveBeenCalled();
  });
});

describe('FileQueueLogReader.parseLine', () => {
  it('parses pipe-separated queue_log sample into QueueLogEntry', () => {
    const line = '1710000000|1710000000.1|sales_7|PJSIP/101|CONNECT|15|bridge-1|2';
    const entry = FileQueueLogReader.parseLine(line);
    expect(entry).toEqual({
      timestamp: new Date(1710000000 * 1000),
      callId: '1710000000.1',
      queueName: 'sales_7',
      agent: 'PJSIP/101',
      event: 'CONNECT',
      params: ['15', 'bridge-1', '2'],
    });
  });
});
